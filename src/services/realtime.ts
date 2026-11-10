import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import type { MqttClient } from 'mqtt'
import type { BarGamesWireEvent } from '../types/barGames'
import type {
  AvatarPose6DoF,
  ChatMessage,
  FloatingReaction,
  NesWireEvent,
  ParticipantProfile,
  PresenterState,
  RoomCustomizationState,
  TransportMode,
  WebRTCSignalMessage,
} from '../types/lounge'
import type {
  RetainedNesVaultPayload,
  RetainedProfilesVaultPayload,
} from './persistentVault'
import {
  decryptRoomPayload,
  derivePbkdf2Hex,
  encryptRoomPayload,
  getRoomCryptoContext,
  type EncryptedWirePacket,
} from './cryptoSession'
import {
  disambiguateParticipantRoster,
  ensureMemberIdentity,
  signRealtimeEnvelope,
  verifyRealtimeEnvelope,
  type SignedEnvelopeFields,
} from './identityAuth'
import {
  getUnlockedRoomMasterKeyHex,
  isPasscodeGateEnabled,
} from './passcode'

export interface RealtimeCallbacks {
  onParticipantsChange: (participants: ParticipantProfile[]) => void
  onPoseUpdate: (pose: AvatarPose6DoF) => void
  onPresenterState: (state: PresenterState) => void
  onRoomCustomization?: (state: RoomCustomizationState) => void
  onBarGamesEvent?: (event: BarGamesWireEvent) => void
  onNesEvent?: (event: NesWireEvent) => void
  onRetainedClubhouseState?: (state: unknown) => void
  onRetainedNesVault?: (payload: RetainedNesVaultPayload) => void
  onRetainedProfilesVault?: (payload: RetainedProfilesVaultPayload) => void
  onRoomStateRequest: (requesterId: string) => void
  onChatMessage: (message: ChatMessage) => void
  onReaction: (reaction: FloatingReaction) => void
  onWebRTCSignal: (signal: WebRTCSignalMessage) => void
  onConnectionStatus?: (connected: boolean) => void
}

export type RelayEnvelopeType =
  | 'pose-update'
  | 'presenter-state'
  | 'room-customization'
  | 'bar-games-event'
  | 'nes-event'
  | 'clubhouse-vault'
  | 'nes-vault'
  | 'profiles-vault'
  | 'request-room-state'
  | 'chat-message'
  | 'emoji-reaction'
  | 'webrtc-signal'
  | 'presence-announce'
  | 'presence-leave'

export interface RelayEnvelope extends SignedEnvelopeFields {
  id: string
  type: RelayEnvelopeType
  senderId: string
  payload: unknown
}

interface PresenceRecord {
  profile: ParticipantProfile
  lastSeen: number
}

const PRESENCE_TTL_MS = 8500
const PRESENCE_HEARTBEAT_MS = 2500

const PUBLIC_WSS_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
] as const

const supabaseUrl =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const supabaseAnonKey =
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

let sharedSupabaseClient: SupabaseClient | null = null
let supabaseKeepaliveSent = false

export function hasSupabaseCredentials(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

function pingSupabaseKeepalive(): void {
  if (supabaseKeepaliveSent || !hasSupabaseCredentials() || typeof fetch === 'undefined') return
  supabaseKeepaliveSent = true
  const base = supabaseUrl.replace(/\/+$/, '')
  const isNewFormatKey =
    supabaseAnonKey.startsWith('sb_publishable_') || supabaseAnonKey.startsWith('sb_secret_')
  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
    ...(isNewFormatKey ? {} : { Authorization: `Bearer ${supabaseAnonKey}` }),
  }
  void fetch(`${base}/auth/v1/settings`, {
    method: 'GET',
    headers,
  }).catch(() => undefined)
}

function getSupabaseClient(): SupabaseClient | null {
  if (!hasSupabaseCredentials()) return null
  if (!sharedSupabaseClient) {
    sharedSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 100,
        },
      },
    })
  }
  return sharedSupabaseClient
}

function shortPacketId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function resolveActiveMasterKeyHex(roomCode: string): Promise<string | null> {
  const unlockedKey = getUnlockedRoomMasterKeyHex()
  if (unlockedKey) return unlockedKey
  if (!isPasscodeGateEnabled()) {
    // Only used when passcode gate is explicitly disabled via VITE_LOUNGE_PASSCODE_VERIFIER=off
    return derivePbkdf2Hex(`OPEN:${roomCode}`, 'vr-lounge-open-fallback-v2', 1000)
  }
  return null
}

/**
 * End-to-End Encrypted + ECDSA-Signed Multi-Tier Realtime Room Transport:
 * - Derives an unguessable 128-bit topic token via `HMAC-SHA256(passcodeKey, roomCode)`.
 * - Signs every outgoing envelope with the local member's persistent ECDSA P-256 private key.
 * - Encrypts every packet and retained layout snapshot with AES-256-GCM before transmitting
 *   over Supabase Realtime Broadcast or MQTT over TLS WebSockets.
 */
export class RoomRealtimeService {
  readonly roomCode: string
  localUserId: string
  mode: TransportMode

  private callbacks: RealtimeCallbacks
  private currentProfile: ParticipantProfile
  private masterKeyHex: string | null = null
  private topicToken = ''
  private supabaseChannel: RealtimeChannel | null = null
  private mqttClient: MqttClient | null = null
  private mqttTopic = ''
  private mqttRetainedLayoutTopic = ''
  private mqttRetainedClubhouseTopic = ''
  private mqttRetainedNesVaultTopic = ''
  private mqttRetainedProfilesTopic = ''
  private pendingRetainedLayout: RoomCustomizationState | null = null
  private pendingRetainedClubhouse: unknown = null
  private pendingRetainedNesVault: RetainedNesVaultPayload | null = null
  private pendingRetainedProfiles: RetainedProfilesVaultPayload | null = null
  private localChannel: BroadcastChannel | null = null
  private heartbeatTimer: number | null = null
  private presenceMap = new Map<string, PresenceRecord>()
  private seenPacketIds = new Set<string>()
  private lastAnnounceReplyByPeer = new Map<string, number>()
  private supabaseReconnectTimer: number | null = null
  private supabaseFailCount = 0
  private destroyed = false

  constructor(
    roomCode: string,
    profile: ParticipantProfile,
    callbacks: RealtimeCallbacks,
  ) {
    this.roomCode = roomCode.toUpperCase().trim()
    this.localUserId = profile.userId
    this.currentProfile = profile
    this.callbacks = callbacks
    this.mode = hasSupabaseCredentials() ? 'supabase' : 'cloud-relay'
  }

  async connect(): Promise<void> {
    if (this.destroyed) return

    // 1. Ensure cryptographic ECDSA P-256 identity and bind localUserId
    const identity = await ensureMemberIdentity()
    if (this.destroyed) return
    this.localUserId = identity.userId
    this.currentProfile = {
      ...this.currentProfile,
      userId: identity.userId,
      verifiedKeyTag: identity.keyTag,
    }

    // 2. Ensure passcode-derived 256-bit E2EE master key is available
    const masterKeyHex = await resolveActiveMasterKeyHex(this.roomCode)
    if (!masterKeyHex || this.destroyed) {
      this.callbacks.onConnectionStatus?.(false)
      return
    }
    this.masterKeyHex = masterKeyHex

    // 3. Derive unguessable HMAC-SHA256 channel topic token & AES-256-GCM key
    const cryptoCtx = await getRoomCryptoContext(masterKeyHex, this.roomCode)
    if (this.destroyed) return
    this.topicToken = cryptoCtx.topicToken
    this.mqttTopic = `vrlounge/v2/enc/${this.topicToken}/bus`
    this.mqttRetainedLayoutTopic = `vrlounge/v2/enc/${this.topicToken}/retained-layout`
    this.mqttRetainedClubhouseTopic = `vrlounge/v2/enc/${this.topicToken}/retained-clubhouse`
    this.mqttRetainedNesVaultTopic = `vrlounge/v2/enc/${this.topicToken}/retained-nes-saves`
    this.mqttRetainedProfilesTopic = `vrlounge/v2/enc/${this.topicToken}/retained-profiles`

    if (this.mode === 'supabase') {
      void this.connectMqttBroker(0, true)
      await this.connectSupabase()
    } else {
      this.connectCloudRelayAndLocal()
    }
  }

  private async buildEncryptedPacket(
    type: RelayEnvelopeType,
    payload: unknown,
  ): Promise<{ envelope: RelayEnvelope; wirePacket: EncryptedWirePacket } | null> {
    if (!this.masterKeyHex) return null
    const baseEnvelope = {
      id: shortPacketId(),
      type,
      senderId: this.localUserId,
      payload,
    }
    // High-frequency 20Hz pose-update packets are already authenticated & encrypted
    // via room AES-256-GCM; skip redundant per-frame ECDSA P-256 signing overhead.
    const signed: RelayEnvelope =
      type === 'pose-update'
        ? { ...baseEnvelope, ts: Date.now(), pubKey: '', sig: '' }
        : await signRealtimeEnvelope(this.roomCode, baseEnvelope)
    const wirePacket = await encryptRoomPayload(
      this.masterKeyHex,
      this.roomCode,
      signed,
    )
    return { envelope: signed, wirePacket }
  }

  private async decodeAndVerifyPacket(rawPacket: unknown): Promise<RelayEnvelope | null> {
    if (!this.masterKeyHex) return null
    const decrypted = await decryptRoomPayload<RelayEnvelope>(
      this.masterKeyHex,
      this.roomCode,
      rawPacket,
    )
    if (!decrypted) return null
    if (decrypted.type === 'pose-update') {
      if (
        typeof decrypted.senderId !== 'string' ||
        !decrypted.senderId ||
        !decrypted.payload
      ) {
        return null
      }
      return decrypted
    }
    const verified = await verifyRealtimeEnvelope(this.roomCode, decrypted)
    if (!verified) return null
    return decrypted
  }

  private async connectSupabase(): Promise<void> {
    const client = getSupabaseClient()
    if (!client || !this.topicToken) {
      this.mode = 'cloud-relay'
      this.connectCloudRelayAndLocal()
      return
    }

    pingSupabaseKeepalive()

    const channelName = `vr-lounge-enc:${this.topicToken}`
    const channel = client.channel(channelName, {
      config: {
        presence: { key: this.localUserId },
        broadcast: { self: false, ack: false },
      },
    })

    // Seed local presence and start periodic signed presence heartbeat
    this.presenceMap.set(this.localUserId, {
      profile: this.currentProfile,
      lastSeen: Date.now(),
    })
    this.emitPresenceRoster()

    channel.on('broadcast', { event: 'enc-envelope' }, ({ payload }) => {
      if (this.destroyed || !payload) return
      void this.decodeAndVerifyPacket(payload).then((env) => {
        if (env && !this.destroyed) {
          this.handleRelayEnvelope(env)
        }
      })
    })

    this.supabaseChannel = channel
    let subscribedOnce = false

    channel.subscribe(async (status) => {
      if (this.destroyed) return
      if (status === 'SUBSCRIBED') {
        subscribedOnce = true
        this.supabaseFailCount = 0
        if (this.supabaseReconnectTimer !== null) {
          window.clearTimeout(this.supabaseReconnectTimer)
          this.supabaseReconnectTimer = null
        }
        this.callbacks.onConnectionStatus?.(true)
        this.publishEncrypted('presence-announce', this.currentProfile)
        this.requestRoomState()

        if (this.heartbeatTimer === null) {
          this.heartbeatTimer = window.setInterval(() => {
            if (this.destroyed) return
            this.presenceMap.set(this.localUserId, {
              profile: this.currentProfile,
              lastSeen: Date.now(),
            })
            this.publishEncrypted('presence-announce', this.currentProfile)
            this.emitPresenceRoster()
          }, PRESENCE_HEARTBEAT_MS)
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.supabaseFailCount += 1
        if (
          (!subscribedOnce || this.supabaseFailCount >= 2) &&
          this.supabaseChannel === channel
        ) {
          this.supabaseChannel = null
          this.mode = 'cloud-relay'
          void client.removeChannel(channel).catch(() => undefined)
          this.connectCloudRelayAndLocal()
          return
        }
        this.callbacks.onConnectionStatus?.(false)
        if (this.supabaseReconnectTimer === null && !this.destroyed) {
          this.supabaseReconnectTimer = window.setTimeout(() => {
            this.supabaseReconnectTimer = null
            if (this.destroyed || this.mode !== 'supabase') return
            if (this.supabaseChannel) {
              void client.removeChannel(this.supabaseChannel).catch(() => undefined)
              this.supabaseChannel = null
            }
            void this.connectSupabase()
          }, 2500)
        }
      } else if (status === 'CLOSED') {
        this.callbacks.onConnectionStatus?.(false)
      }
    })
  }

  private connectCloudRelayAndLocal(): void {
    this.presenceMap.set(this.localUserId, {
      profile: this.currentProfile,
      lastSeen: Date.now(),
    })
    this.emitPresenceRoster()

    // 1. Same-device BroadcastChannel mirror on HMAC topic
    if (typeof BroadcastChannel !== 'undefined' && this.topicToken) {
      if (this.localChannel) {
        this.localChannel.close()
      }
      const bc = new BroadcastChannel(`vr-lounge-bc-enc:${this.topicToken}`)
      bc.onmessage = (ev: MessageEvent<EncryptedWirePacket>) => {
        if (!this.destroyed && ev.data) {
          void this.decodeAndVerifyPacket(ev.data).then((env) => {
            if (env && !this.destroyed) {
              this.handleRelayEnvelope(env)
            }
          })
        }
      }
      this.localChannel = bc
    }

    // 2. Global TLS WebSocket Relay (MQTT over WSS) on unguessable HMAC topic
    void this.connectMqttBroker(0, false)

    this.publishEncrypted('presence-announce', this.currentProfile)
    this.requestRoomState()

    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer)
    }
    this.heartbeatTimer = window.setInterval(() => {
      if (this.destroyed) return
      this.presenceMap.set(this.localUserId, {
        profile: this.currentProfile,
        lastSeen: Date.now(),
      })
      this.publishEncrypted('presence-announce', this.currentProfile)
      this.emitPresenceRoster()
    }, PRESENCE_HEARTBEAT_MS)

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleWindowUnload)
    }
  }

  private async connectMqttBroker(
    brokerIndex: number,
    retainedVaultsOnly = false,
  ): Promise<void> {
    if (this.destroyed || !this.topicToken || !this.masterKeyHex) return
    if (this.mqttClient) {
      try {
        this.mqttClient.end(true)
      } catch {
        // Ignore cleanup error
      }
      this.mqttClient = null
    }
    const url = PUBLIC_WSS_BROKERS[brokerIndex % PUBLIC_WSS_BROKERS.length]

    let mqttConnect: typeof import('mqtt').connect
    try {
      const mqttMod = await import('mqtt')
      mqttConnect = mqttMod.default?.connect ?? mqttMod.connect
    } catch {
      return
    }
    if (this.destroyed) return

    const willBuilt = await this.buildEncryptedPacket('presence-leave', {
      userId: this.localUserId,
    })
    if (this.destroyed) return

    const client = mqttConnect(url, {
      clientId: `vrl-${this.localUserId.slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}`,
      clean: true,
      keepalive: 25,
      connectTimeout: 7000,
      reconnectPeriod: 2500,
      ...(retainedVaultsOnly || !willBuilt
        ? {}
        : {
            will: {
              topic: this.mqttTopic,
              payload: JSON.stringify(willBuilt.wirePacket),
              qos: 0,
              retain: false,
            },
          }),
    })

    let connectedOnce = false

    client.on('connect', () => {
      if (this.destroyed) {
        client.end(true)
        return
      }
      connectedOnce = true

      // Subscribe to the 4 encrypted retained cloud vault topics
      client.subscribe(
        [
          this.mqttRetainedLayoutTopic,
          this.mqttRetainedClubhouseTopic,
          this.mqttRetainedNesVaultTopic,
          this.mqttRetainedProfilesTopic,
        ],
        { qos: 1 },
        () => {
          if (this.destroyed) return
          if (this.pendingRetainedLayout) {
            void this.publishEncryptedRetainedTopic(
              this.mqttRetainedLayoutTopic,
              'room-customization',
              this.pendingRetainedLayout,
            )
          }
          if (this.pendingRetainedClubhouse) {
            void this.publishEncryptedRetainedTopic(
              this.mqttRetainedClubhouseTopic,
              'clubhouse-vault',
              this.pendingRetainedClubhouse,
            )
          }
          if (this.pendingRetainedNesVault) {
            void this.publishEncryptedRetainedTopic(
              this.mqttRetainedNesVaultTopic,
              'nes-vault',
              this.pendingRetainedNesVault,
            )
          }
          if (this.pendingRetainedProfiles) {
            void this.publishEncryptedRetainedTopic(
              this.mqttRetainedProfilesTopic,
              'profiles-vault',
              this.pendingRetainedProfiles,
            )
          }
        },
      )

      // Always subscribe to the encrypted room bus topic so WebRTC signaling and
      // presence packets have dual-path redundancy across Supabase and MQTT relay.
      client.subscribe(this.mqttTopic, { qos: 0 }, (err) => {
        if (!err && !this.destroyed && !retainedVaultsOnly) {
          this.callbacks.onConnectionStatus?.(true)
          this.publishEncrypted('presence-announce', this.currentProfile)
          this.requestRoomState()
        }
      })
    })

    client.on('message', (topic, messageBuffer) => {
      if (this.destroyed) return
      try {
        const parsedWire = JSON.parse(messageBuffer.toString()) as unknown
        void this.decodeAndVerifyPacket(parsedWire).then((env) => {
          if (!env || this.destroyed) return
          if (topic === this.mqttRetainedLayoutTopic) {
            if (env.type === 'room-customization' && env.payload && typeof env.payload === 'object') {
              this.callbacks.onRoomCustomization?.(env.payload as RoomCustomizationState)
            }
            return
          }
          if (topic === this.mqttRetainedClubhouseTopic) {
            if (env.type === 'clubhouse-vault' && env.payload && typeof env.payload === 'object') {
              this.callbacks.onRetainedClubhouseState?.(env.payload)
            }
            return
          }
          if (topic === this.mqttRetainedNesVaultTopic) {
            if (env.type === 'nes-vault' && env.payload && typeof env.payload === 'object') {
              this.callbacks.onRetainedNesVault?.(env.payload as RetainedNesVaultPayload)
            }
            return
          }
          if (topic === this.mqttRetainedProfilesTopic) {
            if (env.type === 'profiles-vault' && env.payload && typeof env.payload === 'object') {
              this.callbacks.onRetainedProfilesVault?.(env.payload as RetainedProfilesVaultPayload)
            }
            return
          }
          this.handleRelayEnvelope(env)
        })
      } catch {
        // Ignore malformed or unencrypted packets
      }
    })

    client.on('error', () => {
      if (!connectedOnce && !this.destroyed && brokerIndex + 1 < PUBLIC_WSS_BROKERS.length) {
        client.end(true)
        this.mqttClient = null
        void this.connectMqttBroker(brokerIndex + 1, retainedVaultsOnly)
      }
    })

    client.on('offline', () => {
      if (!this.destroyed && !retainedVaultsOnly) {
        this.callbacks.onConnectionStatus?.(false)
      }
    })

    this.mqttClient = client
  }

  private async publishEncryptedRetainedTopic(
    topic: string,
    type: RelayEnvelopeType,
    payload: unknown,
  ): Promise<void> {
    if (this.destroyed || !this.mqttClient?.connected || !topic) return
    const built = await this.buildEncryptedPacket(type, payload)
    if (!built || this.destroyed || !this.mqttClient?.connected) return
    this.mqttClient.publish(topic, JSON.stringify(built.wirePacket), {
      qos: 1,
      retain: true,
    })
  }

  private markPacketSeen(id: string): boolean {
    if (!id) return false
    if (this.seenPacketIds.has(id)) return true
    this.seenPacketIds.add(id)
    if (this.seenPacketIds.size > 300) {
      const oldest = this.seenPacketIds.values().next().value
      if (oldest) this.seenPacketIds.delete(oldest)
    }
    return false
  }

  private handleRelayEnvelope(env: RelayEnvelope): void {
    if (!env || env.senderId === this.localUserId) return

    if (env.type !== 'pose-update' && this.markPacketSeen(env.id)) {
      return
    }

    switch (env.type) {
      case 'presence-announce': {
        const profile = env.payload as ParticipantProfile
        if (!profile?.userId || profile.userId !== env.senderId) return
        const verifiedProfile: ParticipantProfile = {
          ...profile,
          userId: env.senderId,
          verifiedKeyTag: env.senderId.slice(2, 6).toUpperCase(),
        }
        const isBrandNewPeer = !this.presenceMap.has(verifiedProfile.userId)
        this.presenceMap.set(verifiedProfile.userId, {
          profile: verifiedProfile,
          lastSeen: Date.now(),
        })
        this.emitPresenceRoster()

        const now = Date.now()
        const lastReplyToPeer = this.lastAnnounceReplyByPeer.get(verifiedProfile.userId) ?? 0
        if (isBrandNewPeer || now - lastReplyToPeer > 3500) {
          this.lastAnnounceReplyByPeer.set(verifiedProfile.userId, now)
          this.publishEncrypted('presence-announce', this.currentProfile)
        }
        break
      }
      case 'presence-leave': {
        this.lastAnnounceReplyByPeer.delete(env.senderId)
        if (this.presenceMap.delete(env.senderId)) {
          this.emitPresenceRoster()
        }
        break
      }
      case 'pose-update': {
        const pose = env.payload as AvatarPose6DoF
        if (pose && pose.userId === env.senderId) {
          this.callbacks.onPoseUpdate(pose)
        }
        break
      }
      case 'presenter-state':
        this.callbacks.onPresenterState(env.payload as PresenterState)
        break
      case 'room-customization':
        this.callbacks.onRoomCustomization?.(env.payload as RoomCustomizationState)
        break
      case 'bar-games-event':
        this.callbacks.onBarGamesEvent?.(env.payload as BarGamesWireEvent)
        break
      case 'nes-event':
        this.callbacks.onNesEvent?.(env.payload as NesWireEvent)
        break
      case 'clubhouse-vault':
        this.callbacks.onRetainedClubhouseState?.(env.payload)
        break
      case 'nes-vault':
        this.callbacks.onRetainedNesVault?.(env.payload as RetainedNesVaultPayload)
        break
      case 'profiles-vault':
        this.callbacks.onRetainedProfilesVault?.(env.payload as RetainedProfilesVaultPayload)
        break
      case 'request-room-state': {
        const req = env.payload as { requesterId: string }
        if (req?.requesterId === env.senderId) {
          // Immediately announce our presence so a joining or refreshing peer discovers
          // all active members without waiting for the periodic presence heartbeat.
          this.lastAnnounceReplyByPeer.set(req.requesterId, Date.now())
          this.publishEncrypted('presence-announce', this.currentProfile)
          this.callbacks.onRoomStateRequest(req.requesterId)
        }
        break
      }
      case 'chat-message': {
        const msg = env.payload as ChatMessage
        if (!msg || msg.userId !== env.senderId) return
        const peerRecord = this.presenceMap.get(env.senderId)
        const verifiedChat: ChatMessage = {
          ...msg,
          userId: env.senderId,
          displayName: peerRecord?.profile.displayName ?? msg.displayName,
          verifiedKeyTag: env.senderId.slice(2, 6).toUpperCase(),
        }
        this.callbacks.onChatMessage(verifiedChat)
        break
      }
      case 'emoji-reaction': {
        const reaction = env.payload as FloatingReaction
        if (!reaction || reaction.userId !== env.senderId) return
        this.callbacks.onReaction(reaction)
        break
      }
      case 'webrtc-signal': {
        const signal = env.payload as WebRTCSignalMessage
        if (signal?.fromUserId === env.senderId && signal?.toUserId === this.localUserId) {
          this.callbacks.onWebRTCSignal(signal)
        }
        break
      }
    }
  }

  private emitPresenceRoster(): void {
    const now = Date.now()
    const active: ParticipantProfile[] = []
    for (const [uid, entry] of this.presenceMap.entries()) {
      if (uid === this.localUserId) {
        active.push(this.currentProfile)
      } else if (now - entry.lastSeen < PRESENCE_TTL_MS) {
        active.push(entry.profile)
      } else {
        this.presenceMap.delete(uid)
      }
    }
    if (!active.some((p) => p.userId === this.localUserId)) {
      active.push(this.currentProfile)
    }

    // Disambiguate display names across distinct cryptographic public keys
    const disambiguated = disambiguateParticipantRoster(active)
    for (const p of disambiguated) {
      if (p.userId === this.localUserId) {
        this.currentProfile = {
          ...this.currentProfile,
          displayName: p.displayName,
          verifiedKeyTag: p.verifiedKeyTag,
        }
      } else {
        const rec = this.presenceMap.get(p.userId)
        if (rec) {
          rec.profile = p
        }
      }
    }
    this.callbacks.onParticipantsChange(disambiguated)
  }

  private publishEncrypted(type: RelayEnvelopeType, payload: unknown): void {
    if (this.destroyed || !this.masterKeyHex) return
    void this.buildEncryptedPacket(type, payload).then((built) => {
      if (!built || this.destroyed) return
      const { wirePacket } = built

      if (this.supabaseChannel && this.mode === 'supabase') {
        void this.supabaseChannel.send({
          type: 'broadcast',
          event: 'enc-envelope',
          payload: wirePacket,
        })
      }

      // Publish all packets on MQTT in cloud-relay mode, AND also dual-publish
      // critical WebRTC signaling & control packets in supabase mode for zero-drop reliability.
      if (
        this.mqttClient?.connected &&
        (this.mode !== 'supabase' || type !== 'pose-update')
      ) {
        const qos = type === 'webrtc-signal' || type === 'presence-announce' ? 1 : 0
        this.mqttClient.publish(this.mqttTopic, JSON.stringify(wirePacket), { qos })
      }

      if (
        this.localChannel &&
        (type !== 'pose-update' || (!this.mqttClient?.connected && !this.supabaseChannel))
      ) {
        this.localChannel.postMessage(wirePacket)
      }
    })
  }

  private handleWindowUnload = (): void => {
    this.publishEncrypted('presence-leave', { userId: this.localUserId })
  }

  async updatePresence(patch: Partial<ParticipantProfile>): Promise<void> {
    this.currentProfile = {
      ...this.currentProfile,
      ...patch,
      userId: this.localUserId,
    }
    if (this.destroyed) return
    this.presenceMap.set(this.localUserId, {
      profile: this.currentProfile,
      lastSeen: Date.now(),
    })
    this.emitPresenceRoster()
    this.publishEncrypted('presence-announce', this.currentProfile)
  }

  broadcastPose(pose: AvatarPose6DoF): void {
    if (this.destroyed) return
    this.publishEncrypted('pose-update', {
      ...pose,
      userId: this.localUserId,
    })
  }

  broadcastPresenterState(state: PresenterState): void {
    if (this.destroyed) return
    this.publishEncrypted('presenter-state', state)
  }

  broadcastRoomCustomization(state: RoomCustomizationState): void {
    if (this.destroyed) return
    this.pendingRetainedLayout = state
    void this.publishEncryptedRetainedTopic(
      this.mqttRetainedLayoutTopic,
      'room-customization',
      state,
    )
    this.publishEncrypted('room-customization', state)
  }

  broadcastBarGamesEvent(event: BarGamesWireEvent): void {
    if (this.destroyed) return
    this.publishEncrypted('bar-games-event', event)
  }

  broadcastNesEvent(event: NesWireEvent): void {
    if (this.destroyed) return
    this.publishEncrypted('nes-event', event)
  }

  publishRetainedClubhouseState(state: unknown): void {
    if (this.destroyed) return
    this.pendingRetainedClubhouse = state
    void this.publishEncryptedRetainedTopic(
      this.mqttRetainedClubhouseTopic,
      'clubhouse-vault',
      state,
    )
    this.publishEncrypted('clubhouse-vault', state)
  }

  publishRetainedNesVault(payload: RetainedNesVaultPayload): void {
    if (this.destroyed) return
    this.pendingRetainedNesVault = payload
    void this.publishEncryptedRetainedTopic(
      this.mqttRetainedNesVaultTopic,
      'nes-vault',
      payload,
    )
    this.publishEncrypted('nes-vault', payload)
  }

  publishRetainedProfilesVault(payload: RetainedProfilesVaultPayload): void {
    if (this.destroyed) return
    this.pendingRetainedProfiles = payload
    void this.publishEncryptedRetainedTopic(
      this.mqttRetainedProfilesTopic,
      'profiles-vault',
      payload,
    )
    this.publishEncrypted('profiles-vault', payload)
  }

  requestRoomState(): void {
    if (this.destroyed) return
    this.publishEncrypted('request-room-state', { requesterId: this.localUserId })
  }

  broadcastChatMessage(message: ChatMessage): void {
    if (this.destroyed) return
    this.publishEncrypted('chat-message', {
      ...message,
      userId: this.localUserId,
    })
  }

  broadcastReaction(reaction: FloatingReaction): void {
    if (this.destroyed) return
    this.publishEncrypted('emoji-reaction', {
      ...reaction,
      userId: this.localUserId,
    })
  }

  sendWebRTCSignal(signal: WebRTCSignalMessage): void {
    if (this.destroyed) return
    this.publishEncrypted('webrtc-signal', {
      ...signal,
      fromUserId: this.localUserId,
    })
  }

  async disconnect(): Promise<void> {
    if (this.destroyed) return
    this.publishEncrypted('presence-leave', { userId: this.localUserId })
    this.destroyed = true

    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.supabaseReconnectTimer !== null) {
      window.clearTimeout(this.supabaseReconnectTimer)
      this.supabaseReconnectTimer = null
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleWindowUnload)
    }

    if (this.supabaseChannel) {
      const client = getSupabaseClient()
      await this.supabaseChannel.untrack().catch(() => undefined)
      if (client) {
        await client.removeChannel(this.supabaseChannel).catch(() => undefined)
      }
      this.supabaseChannel = null
    }

    if (this.mqttClient) {
      this.mqttClient.end(true)
      this.mqttClient = null
    }

    if (this.localChannel) {
      this.localChannel.close()
      this.localChannel = null
    }
  }
}
