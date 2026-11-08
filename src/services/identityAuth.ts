/**
 * Cryptographic Member Identity & Anti-Impersonation Service (ECDSA P-256).
 *
 * Each browser/headset profile receives a persistent ECDSA P-256 keypair via Web Crypto.
 * - A member's `userId` (`u_<12-hex-sha256>`) is mathematically bound to the SHA-256
 *   thumbprint of their SPKI public key.
 * - Every realtime packet is signed with ECDSA-SHA256 and verified by recipients before
 *   processing, preventing any peer from spoofing another member's `userId`, hijacking
 *   their seat/host status, or forging chat messages.
 * - Duplicate display names from different public keys are automatically disambiguated
 *   with their short cryptographic key tag (`#4F9A`).
 */

import type { ParticipantProfile } from '../types/lounge'
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  constantTimeEqualHex,
} from './cryptoSession'

const IDENTITY_STORAGE_KEY = 'vr-lounge:member-identity:v2'
const TEXT_ENCODER = new TextEncoder()
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000 // 10 minutes tolerance for headset clock drift

export interface StoredMemberIdentity {
  userId: string
  keyTag: string
  publicKeySpkiB64: string
  privateKeyPkcs8B64: string
  createdAt: number
}

export interface MemberIdentityRuntime extends StoredMemberIdentity {
  privateKey: CryptoKey
  publicKey: CryptoKey
}

export interface SignedEnvelopeFields {
  id: string
  type: string
  senderId: string
  ts: number
  pubKey: string
  sig: string
  payload: unknown
}

let cachedIdentityRuntime: MemberIdentityRuntime | null = null
let identityInitPromise: Promise<MemberIdentityRuntime> | null = null
const importedPeerPublicKeys = new Map<string, Promise<CryptoKey | null>>()

export async function computePublicKeyUserId(
  spkiBytes: Uint8Array,
): Promise<{ userId: string; keyTag: string }> {
  const hashBuffer = await globalThis.crypto.subtle.digest(
    'SHA-256',
    spkiBytes.buffer as ArrayBuffer,
  )
  const hex = bytesToHex(new Uint8Array(hashBuffer))
  const thumb12 = hex.slice(0, 12)
  return {
    userId: `u_${thumb12}`,
    keyTag: thumb12.slice(0, 4).toUpperCase(),
  }
}

function readStoredIdentityRecord(): StoredMemberIdentity | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(IDENTITY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredMemberIdentity>
    if (
      typeof parsed.userId !== 'string' ||
      !/^u_[0-9a-f]{12}$/.test(parsed.userId) ||
      typeof parsed.publicKeySpkiB64 !== 'string' ||
      typeof parsed.privateKeyPkcs8B64 !== 'string'
    ) {
      return null
    }
    return {
      userId: parsed.userId,
      keyTag:
        typeof parsed.keyTag === 'string' && parsed.keyTag.length === 4
          ? parsed.keyTag.toUpperCase()
          : parsed.userId.slice(2, 6).toUpperCase(),
      publicKeySpkiB64: parsed.publicKeySpkiB64,
      privateKeyPkcs8B64: parsed.privateKeyPkcs8B64,
      createdAt:
        typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
    }
  } catch {
    return null
  }
}

/**
 * Synchronously returns the stored cryptographic `userId` if already initialized,
 * or kicks off keypair generation and returns a temporary placeholder until resolved.
 */
export function getInitialMemberUserId(): string {
  if (cachedIdentityRuntime) return cachedIdentityRuntime.userId
  const stored = readStoredIdentityRecord()
  if (stored) {
    void ensureMemberIdentity()
    return stored.userId
  }
  void ensureMemberIdentity()
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `u_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  }
  return `u_${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`
}

export function getCachedMemberIdentity(): MemberIdentityRuntime | null {
  return cachedIdentityRuntime
}

export async function generateFreshMemberIdentity(): Promise<MemberIdentityRuntime> {
  const keyPair = await globalThis.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )
  const spkiBuffer = await globalThis.crypto.subtle.exportKey(
    'spki',
    keyPair.publicKey,
  )
  const pkcs8Buffer = await globalThis.crypto.subtle.exportKey(
    'pkcs8',
    keyPair.privateKey,
  )
  const spkiBytes = new Uint8Array(spkiBuffer)
  const pkcs8Bytes = new Uint8Array(pkcs8Buffer)
  const { userId, keyTag } = await computePublicKeyUserId(spkiBytes)

  const record: StoredMemberIdentity = {
    userId,
    keyTag,
    publicKeySpkiB64: bytesToBase64(spkiBytes),
    privateKeyPkcs8B64: bytesToBase64(pkcs8Bytes),
    createdAt: Date.now(),
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(record))
    } catch {
      // Ignore private browsing quota errors
    }
  }

  return {
    ...record,
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
  }
}

export async function ensureMemberIdentity(): Promise<MemberIdentityRuntime> {
  if (cachedIdentityRuntime) return cachedIdentityRuntime
  if (identityInitPromise) return identityInitPromise

  identityInitPromise = (async (): Promise<MemberIdentityRuntime> => {
    const stored = readStoredIdentityRecord()
    if (stored) {
      try {
        const spkiBytes = base64ToBytes(stored.publicKeySpkiB64)
        const pkcs8Bytes = base64ToBytes(stored.privateKeyPkcs8B64)
        const derived = await computePublicKeyUserId(spkiBytes)
        if (derived.userId === stored.userId) {
          const publicKey = await globalThis.crypto.subtle.importKey(
            'spki',
            spkiBytes.buffer as ArrayBuffer,
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['verify'],
          )
          const privateKey = await globalThis.crypto.subtle.importKey(
            'pkcs8',
            pkcs8Bytes.buffer as ArrayBuffer,
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['sign'],
          )
          const runtime: MemberIdentityRuntime = {
            ...stored,
            keyTag: derived.keyTag,
            publicKey,
            privateKey,
          }
          cachedIdentityRuntime = runtime
          return runtime
        }
      } catch {
        // Fall through to generate a fresh keypair if stored key was corrupted
      }
    }

    const fresh = await generateFreshMemberIdentity()
    cachedIdentityRuntime = fresh
    return fresh
  })()

  return identityInitPromise
}

function buildCanonicalSigningBytes(
  roomCode: string,
  id: string,
  type: string,
  senderId: string,
  ts: number,
  payload: unknown,
): Uint8Array {
  const normalizedRoom = roomCode.trim().toUpperCase() || 'LOUNGE'
  const canonical = `v2|${normalizedRoom}|${id}|${type}|${senderId}|${ts}|${JSON.stringify(payload)}`
  return TEXT_ENCODER.encode(canonical)
}

/**
 * Signs an outgoing realtime envelope using the given (or local member's) ECDSA P-256 identity.
 */
export async function signRealtimeEnvelope<T extends {
  id: string
  type: string
  senderId: string
  payload: unknown
}>(
  roomCode: string,
  envelope: T,
  identityOverride?: MemberIdentityRuntime,
): Promise<T & SignedEnvelopeFields> {
  const identity = identityOverride ?? (await ensureMemberIdentity())
  const senderId = identity.userId
  const ts = Date.now()
  const canonicalBytes = buildCanonicalSigningBytes(
    roomCode,
    envelope.id,
    envelope.type,
    senderId,
    ts,
    envelope.payload,
  )
  const sigBuffer = await globalThis.crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    identity.privateKey,
    canonicalBytes.buffer as ArrayBuffer,
  )
  return {
    ...envelope,
    senderId,
    ts,
    pubKey: identity.publicKeySpkiB64,
    sig: bytesToBase64(new Uint8Array(sigBuffer)),
  }
}

async function importPeerPublicKey(
  senderId: string,
  pubKeyB64: string,
): Promise<CryptoKey | null> {
  const cacheKey = `${senderId}:${pubKeyB64}`
  const existing = importedPeerPublicKeys.get(cacheKey)
  if (existing) return existing

  const promise = (async (): Promise<CryptoKey | null> => {
    try {
      const spkiBytes = base64ToBytes(pubKeyB64)
      const derived = await computePublicKeyUserId(spkiBytes)
      // Verify that senderId is genuinely bound to the SHA-256 thumbprint of pubKey
      if (
        !senderId.startsWith('u_') ||
        !constantTimeEqualHex(senderId.slice(2), derived.userId.slice(2))
      ) {
        return null
      }
      return await globalThis.crypto.subtle.importKey(
        'spki',
        spkiBytes.buffer as ArrayBuffer,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      )
    } catch {
      return null
    }
  })()

  importedPeerPublicKeys.set(cacheKey, promise)
  if (importedPeerPublicKeys.size > 150) {
    const oldest = importedPeerPublicKeys.keys().next().value
    if (oldest) importedPeerPublicKeys.delete(oldest)
  }
  return promise
}

function validatePayloadSenderConsistency(
  type: string,
  senderId: string,
  payload: unknown,
): boolean {
  if (!payload || typeof payload !== 'object') return true
  const rec = payload as Record<string, unknown>
  switch (type) {
    case 'presence-announce':
    case 'presence-leave':
    case 'pose-update':
    case 'chat-message':
    case 'emoji-reaction':
      return typeof rec.userId === 'string' && rec.userId === senderId
    case 'request-room-state':
      return typeof rec.requesterId === 'string' && rec.requesterId === senderId
    case 'webrtc-signal':
      return typeof rec.fromUserId === 'string' && rec.fromUserId === senderId
    default:
      return true
  }
}

/**
 * Verifies an incoming signed realtime envelope:
 * 1. Checks timestamp freshness against replay attacks.
 * 2. Verifies `senderId` matches `u_${SHA256(pubKey).slice(0, 12)}`.
 * 3. Verifies inner payload `userId`/`fromUserId` matches `senderId` (prevents spoofing another peer inside payload).
 * 4. Verifies the ECDSA P-256 signature over the canonical envelope fields.
 */
export async function verifyRealtimeEnvelope(
  roomCode: string,
  envelope: unknown,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!envelope || typeof envelope !== 'object') return false
  const env = envelope as Partial<SignedEnvelopeFields>
  if (
    typeof env.id !== 'string' ||
    typeof env.type !== 'string' ||
    typeof env.senderId !== 'string' ||
    typeof env.ts !== 'number' ||
    typeof env.pubKey !== 'string' ||
    typeof env.sig !== 'string'
  ) {
    return false
  }

  if (Math.abs(nowMs - env.ts) > MAX_CLOCK_SKEW_MS) {
    return false
  }

  if (!validatePayloadSenderConsistency(env.type, env.senderId, env.payload)) {
    return false
  }

  const pubKey = await importPeerPublicKey(env.senderId, env.pubKey)
  if (!pubKey) return false

  try {
    const sigBytes = base64ToBytes(env.sig)
    const canonicalBytes = buildCanonicalSigningBytes(
      roomCode,
      env.id,
      env.type,
      env.senderId,
      env.ts,
      env.payload,
    )
    return await globalThis.crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pubKey,
      sigBytes.buffer as ArrayBuffer,
      canonicalBytes.buffer as ArrayBuffer,
    )
  } catch {
    return false
  }
}

/**
 * Disambiguates participant display names so a newcomer with a different public key
 * cannot impersonate an existing member's display name in the roster or 3D nametags.
 */
export function disambiguateParticipantRoster(
  roster: ParticipantProfile[],
): ParticipantProfile[] {
  const sorted = [...roster].sort((a, b) =>
    a.joinedAt !== b.joinedAt
      ? a.joinedAt - b.joinedAt
      : a.userId.localeCompare(b.userId),
  )

  const claimedNames = new Map<string, string>() // normalizedName -> first owner userId

  return sorted.map((p) => {
    const keyTag = p.userId.startsWith('u_')
      ? p.userId.slice(2, 6).toUpperCase()
      : p.userId.slice(0, 4).toUpperCase()
    const baseName =
      p.displayName.replace(/\s*\(#[0-9A-F]{4}\)\s*$/i, '').trim() || 'Guest'
    const norm = baseName.toLowerCase()
    const existingOwner = claimedNames.get(norm)

    if (!existingOwner || existingOwner === p.userId) {
      claimedNames.set(norm, p.userId)
      return {
        ...p,
        displayName: baseName,
        verifiedKeyTag: keyTag,
      }
    }

    return {
      ...p,
      displayName: `${baseName} (#${keyTag})`,
      verifiedKeyTag: keyTag,
    }
  })
}
