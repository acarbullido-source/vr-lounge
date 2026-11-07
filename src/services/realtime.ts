import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import type { MqttClient } from 'mqtt'
import type {
  AvatarPose6DoF,
  ChatMessage,
  FloatingReaction,
  ParticipantProfile,
  PresenterState,
  RoomCustomizationState,
  TransportMode,
  WebRTCSignalMessage,
} from '../types/lounge'

export interface RealtimeCallbacks {
  onParticipantsChange: (participants: ParticipantProfile[]) => void
  onPoseUpdate: (pose: AvatarPose6DoF) => void
  onPresenterState: (state: PresenterState) => void
  onRoomCustomization?: (state: RoomCustomizationState) => void
  onRoomStateRequest: (requesterId: string) => void
  onChatMessage: (message: ChatMessage) => void
  onReaction: (reaction: FloatingReaction) => void
  onWebRTCSignal: (signal: WebRTCSignalMessage) => void
  onConnectionStatus?: (connected: boolean) => void
}

interface RelayEnvelope {
  id: string
  type:
    | 'pose-update'
    | 'presenter-state'
    | 'room-customization'
    | 'request-room-state'
    | 'chat-message'
    | 'emoji-reaction'
    | 'webrtc-signal'
    | 'presence-announce'
    | 'presence-leave'
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

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

let sharedSupabaseClient: SupabaseClient | null = null
let supabaseKeepaliveSent = false

export function hasSupabaseCredentials(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

/**
 * Lightweight Auth settings GET ping once per browser session so Supabase Free Tier
 * registers project/database activity (preventing the 7-day inactivity pause even when
 * VR Lounge only uses Realtime Broadcast & Presence). Works with both `sb_publishable_…`
 * and legacy `anon` keys.
 */
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
          eventsPerSecond: 40,
        },
      },
    })
  }
  return sharedSupabaseClient
}

function shortPacketId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Multi-tier realtime room transport:
 * 1. Supabase Realtime (Presence + Broadcast) when VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY are set.
 * 2. Zero-Config Cloud Relay (MQTT over TLS WebSockets + local BroadcastChannel mirror) out of the box,
 *    allowing Meta Quest 3 headsets and desktop browsers across different networks to connect immediately
 *    with zero account setup (or as an automatic fallback if a Supabase project is paused).
 */
export class RoomRealtimeService {
  readonly roomCode: string
  readonly localUserId: string
  mode: TransportMode

  private callbacks: RealtimeCallbacks
  private currentProfile: ParticipantProfile
  private supabaseChannel: RealtimeChannel | null = null
  private mqttClient: MqttClient | null = null
  private mqttTopic: string
  private localChannel: BroadcastChannel | null = null
  private heartbeatTimer: number | null = null
  private presenceMap = new Map<string, PresenceRecord>()
  private seenPacketIds = new Set<string>()
  private lastAnnounceReplyAt = 0
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
    this.mqttTopic = `vrlounge/v1/${encodeURIComponent(this.roomCode)}/bus`
  }

  async connect(): Promise<void> {
    if (this.destroyed) return
    if (this.mode === 'supabase') {
      await this.connectSupabase()
    } else {
      this.connectCloudRelayAndLocal()
    }
  }

  private async connectSupabase(): Promise<void> {
    const client = getSupabaseClient()
    if (!client) {
      this.mode = 'cloud-relay'
      this.connectCloudRelayAndLocal()
      return
    }

    pingSupabaseKeepalive()

    const channelName = `vr-lounge:${this.roomCode}`
    const channel = client.channel(channelName, {
      config: {
        presence: { key: this.localUserId },
        broadcast: { self: false, ack: false },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        if (this.destroyed) return
        const state = channel.presenceState<ParticipantProfile>()
        const participants: ParticipantProfile[] = []
        for (const entries of Object.values(state)) {
          if (entries && entries.length > 0) {
            const latest = entries[entries.length - 1]
            if (latest && latest.userId) {
              participants.push({
                userId: latest.userId,
                displayName: latest.displayName,
                avatarColor: latest.avatarColor,
                avatarStyle: latest.avatarStyle,
                seatIndex: latest.seatIndex,
                seatId: latest.seatId,
                isHost: latest.isHost,
                isMuted: latest.isMuted,
                inVR: latest.inVR,
                joinedAt: latest.joinedAt,
              })
            }
          }
        }
        participants.sort((a, b) => a.joinedAt - b.joinedAt)
        this.callbacks.onParticipantsChange(participants)
      })
      .on('broadcast', { event: 'pose-update' }, ({ payload }) => {
        if (!this.destroyed && payload) {
          this.callbacks.onPoseUpdate(payload as AvatarPose6DoF)
        }
      })
      .on('broadcast', { event: 'presenter-state' }, ({ payload }) => {
        if (!this.destroyed && payload) {
          this.callbacks.onPresenterState(payload as PresenterState)
        }
      })
      .on('broadcast', { event: 'room-customization' }, ({ payload }) => {
        if (!this.destroyed && payload) {
          this.callbacks.onRoomCustomization?.(payload as RoomCustomizationState)
        }
      })
      .on('broadcast', { event: 'request-room-state' }, ({ payload }) => {
        if (!this.destroyed && payload && typeof payload.requesterId === 'string') {
          this.callbacks.onRoomStateRequest(payload.requesterId)
        }
      })
      .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
        if (!this.destroyed && payload) {
          this.callbacks.onChatMessage(payload as ChatMessage)
        }
      })
      .on('broadcast', { event: 'emoji-reaction' }, ({ payload }) => {
        if (!this.destroyed && payload) {
          this.callbacks.onReaction(payload as FloatingReaction)
        }
      })
      .on('broadcast', { event: 'webrtc-signal' }, ({ payload }) => {
        if (!this.destroyed && payload) {
          const signal = payload as WebRTCSignalMessage
          if (signal.toUserId === this.localUserId) {
            this.callbacks.onWebRTCSignal(signal)
          }
        }
      })

    this.supabaseChannel = channel
    let subscribedOnce = false

    channel.subscribe(async (status) => {
      if (this.destroyed) return
      if (status === 'SUBSCRIBED') {
        subscribedOnce = true
        this.callbacks.onConnectionStatus?.(true)
        await channel.track(this.currentProfile)
        this.requestRoomState()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (!subscribedOnce && this.supabaseChannel === channel) {
          // Automatic failover to Cloud Relay if Supabase project is paused or unreachable
          this.supabaseChannel = null
          this.mode = 'cloud-relay'
          void client.removeChannel(channel).catch(() => undefined)
          this.connectCloudRelayAndLocal()
          return
        }
        this.callbacks.onConnectionStatus?.(false)
      } else if (status === 'CLOSED') {
        this.callbacks.onConnectionStatus?.(false)
      }
    })
  }

  private connectCloudRelayAndLocal(): void {
    // Seed own presence immediately
    this.presenceMap.set(this.localUserId, {
      profile: this.currentProfile,
      lastSeen: Date.now(),
    })
    this.emitPresenceRoster()

    // 1. Same-device BroadcastChannel mirror for instant 0ms multi-tab sync
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(`vr-lounge-bc:${this.roomCode}`)
      bc.onmessage = (ev: MessageEvent<RelayEnvelope>) => {
        if (!this.destroyed && ev.data) {
          this.handleRelayEnvelope(ev.data)
        }
      }
      this.localChannel = bc
    }

    // 2. Global TLS WebSocket Relay (MQTT over WSS) for cross-network headsets & friends
    void this.connectMqttBroker(0)

    // Announce immediately + periodic heartbeat & stale-peer pruning
    this.publishRelay('presence-announce', this.currentProfile)
    this.requestRoomState()

    this.heartbeatTimer = window.setInterval(() => {
      if (this.destroyed) return
      this.presenceMap.set(this.localUserId, {
        profile: this.currentProfile,
        lastSeen: Date.now(),
      })
      this.publishRelay('presence-announce', this.currentProfile)
      this.emitPresenceRoster()
    }, PRESENCE_HEARTBEAT_MS)

    window.addEventListener('beforeunload', this.handleWindowUnload)
  }

  private async connectMqttBroker(brokerIndex: number): Promise<void> {
    if (this.destroyed) return
    const url = PUBLIC_WSS_BROKERS[brokerIndex % PUBLIC_WSS_BROKERS.length]

    let mqttConnect: typeof import('mqtt').connect
    try {
      const mqttMod = await import('mqtt')
      mqttConnect = mqttMod.default?.connect ?? mqttMod.connect
    } catch {
      return
    }
    if (this.destroyed) return

    const willEnvelope: RelayEnvelope = {
      id: shortPacketId(),
      type: 'presence-leave',
      senderId: this.localUserId,
      payload: { userId: this.localUserId },
    }

    const client = mqttConnect(url, {
      clientId: `vrl-${this.localUserId.slice(0, 12)}-${Math.random().toString(36).slice(2, 6)}`,
      clean: true,
      keepalive: 25,
      connectTimeout: 7000,
      reconnectPeriod: 2500,
      will: {
        topic: this.mqttTopic,
        payload: JSON.stringify(willEnvelope),
        qos: 0,
        retain: false,
      },
    })

    let connectedOnce = false

    client.on('connect', () => {
      if (this.destroyed) {
        client.end(true)
        return
      }
      connectedOnce = true
      client.subscribe(this.mqttTopic, { qos: 0 }, (err) => {
        if (!err && !this.destroyed) {
          this.callbacks.onConnectionStatus?.(true)
          this.publishRelay('presence-announce', this.currentProfile)
          this.requestRoomState()
        }
      })
    })

    client.on('message', (_topic, messageBuffer) => {
      if (this.destroyed) return
      try {
        const parsed = JSON.parse(messageBuffer.toString()) as RelayEnvelope
        this.handleRelayEnvelope(parsed)
      } catch {
        // Ignore malformed packets
      }
    })

    client.on('error', () => {
      if (!connectedOnce && !this.destroyed && brokerIndex + 1 < PUBLIC_WSS_BROKERS.length) {
        client.end(true)
        this.mqttClient = null
        void this.connectMqttBroker(brokerIndex + 1)
      }
    })

    client.on('offline', () => {
      if (!this.destroyed) {
        this.callbacks.onConnectionStatus?.(false)
      }
    })

    this.mqttClient = client
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
        if (!profile?.userId) return
        const isBrandNewPeer = !this.presenceMap.has(profile.userId)
        this.presenceMap.set(profile.userId, {
          profile,
          lastSeen: Date.now(),
        })
        this.emitPresenceRoster()

        // Reply immediately so newly joined peers see us in <200ms
        const now = Date.now()
        if (isBrandNewPeer && now - this.lastAnnounceReplyAt > 250) {
          this.lastAnnounceReplyAt = now
          this.publishRelay('presence-announce', this.currentProfile)
        }
        break
      }
      case 'presence-leave': {
        if (this.presenceMap.delete(env.senderId)) {
          this.emitPresenceRoster()
        }
        break
      }
      case 'pose-update':
        this.callbacks.onPoseUpdate(env.payload as AvatarPose6DoF)
        break
      case 'presenter-state':
        this.callbacks.onPresenterState(env.payload as PresenterState)
        break
      case 'room-customization':
        this.callbacks.onRoomCustomization?.(env.payload as RoomCustomizationState)
        break
      case 'request-room-state': {
        const req = env.payload as { requesterId: string }
        if (req?.requesterId) this.callbacks.onRoomStateRequest(req.requesterId)
        break
      }
      case 'chat-message':
        this.callbacks.onChatMessage(env.payload as ChatMessage)
        break
      case 'emoji-reaction':
        this.callbacks.onReaction(env.payload as FloatingReaction)
        break
      case 'webrtc-signal': {
        const signal = env.payload as WebRTCSignalMessage
        if (signal?.toUserId === this.localUserId) {
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
    active.sort((a, b) => a.joinedAt - b.joinedAt)
    this.callbacks.onParticipantsChange(active)
  }

  private publishRelay(type: RelayEnvelope['type'], payload: unknown): void {
    if (this.destroyed) return
    const envelope: RelayEnvelope = {
      id: shortPacketId(),
      type,
      senderId: this.localUserId,
      payload,
    }

    if (this.mqttClient?.connected) {
      this.mqttClient.publish(this.mqttTopic, JSON.stringify(envelope), { qos: 0 })
    }

    // Always mirror on local BroadcastChannel (or poses only when MQTT isn't connected)
    if (this.localChannel && (type !== 'pose-update' || !this.mqttClient?.connected)) {
      this.localChannel.postMessage(envelope)
    }
  }

  private handleWindowUnload = (): void => {
    this.publishRelay('presence-leave', { userId: this.localUserId })
  }

  async updatePresence(patch: Partial<ParticipantProfile>): Promise<void> {
    this.currentProfile = { ...this.currentProfile, ...patch }
    if (this.destroyed) return
    if (this.supabaseChannel) {
      await this.supabaseChannel.track(this.currentProfile)
    } else {
      this.presenceMap.set(this.localUserId, {
        profile: this.currentProfile,
        lastSeen: Date.now(),
      })
      this.emitPresenceRoster()
      this.publishRelay('presence-announce', this.currentProfile)
    }
  }

  broadcastPose(pose: AvatarPose6DoF): void {
    if (this.destroyed) return
    if (this.supabaseChannel) {
      void this.supabaseChannel.send({
        type: 'broadcast',
        event: 'pose-update',
        payload: pose,
      })
    } else {
      this.publishRelay('pose-update', pose)
    }
  }

  broadcastPresenterState(state: PresenterState): void {
    if (this.destroyed) return
    if (this.supabaseChannel) {
      void this.supabaseChannel.send({
        type: 'broadcast',
        event: 'presenter-state',
        payload: state,
      })
    } else {
      this.publishRelay('presenter-state', state)
    }
  }

  broadcastRoomCustomization(state: RoomCustomizationState): void {
    if (this.destroyed) return
    if (this.supabaseChannel) {
      void this.supabaseChannel.send({
        type: 'broadcast',
        event: 'room-customization',
        payload: state,
      })
    } else {
      this.publishRelay('room-customization', state)
    }
  }

  requestRoomState(): void {
    if (this.destroyed) return
    const payload = { requesterId: this.localUserId }
    if (this.supabaseChannel) {
      void this.supabaseChannel.send({
        type: 'broadcast',
        event: 'request-room-state',
        payload,
      })
    } else {
      this.publishRelay('request-room-state', payload)
    }
  }

  broadcastChatMessage(message: ChatMessage): void {
    if (this.destroyed) return
    if (this.supabaseChannel) {
      void this.supabaseChannel.send({
        type: 'broadcast',
        event: 'chat-message',
        payload: message,
      })
    } else {
      this.publishRelay('chat-message', message)
    }
  }

  broadcastReaction(reaction: FloatingReaction): void {
    if (this.destroyed) return
    if (this.supabaseChannel) {
      void this.supabaseChannel.send({
        type: 'broadcast',
        event: 'emoji-reaction',
        payload: reaction,
      })
    } else {
      this.publishRelay('emoji-reaction', reaction)
    }
  }

  sendWebRTCSignal(signal: WebRTCSignalMessage): void {
    if (this.destroyed) return
    if (this.supabaseChannel) {
      void this.supabaseChannel.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload: signal,
      })
    } else {
      this.publishRelay('webrtc-signal', signal)
    }
  }

  async disconnect(): Promise<void> {
    if (this.destroyed) return
    this.publishRelay('presence-leave', { userId: this.localUserId })
    this.destroyed = true

    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    window.removeEventListener('beforeunload', this.handleWindowUnload)

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
