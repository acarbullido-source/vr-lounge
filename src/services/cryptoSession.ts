/**
 * End-to-End Encryption (AES-256-GCM) & HMAC Channel Topic Derivation for VR Lounge.
 *
 * All realtime packets (chat, 6DoF avatar poses, media sync, WebRTC signaling,
 * bar games, and retained room layouts) are encrypted client-side using Web Crypto
 * (`crypto.subtle`) with keys derived from the group's shared passcode via PBKDF2 + HKDF.
 *
 * Even when using public MQTT fallback brokers or inspecting browser storage,
 * an observer without the passcode cannot discover the HMAC topic token or decrypt packets.
 */

const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()

export interface EncryptedWirePacket {
  v: 2
  iv: string
  ct: string
}

interface CachedRoomCryptoContext {
  masterKeyHex: string
  roomCode: string
  topicToken: string
  aesKey: CryptoKey
}

const roomCryptoCache = new Map<string, Promise<CachedRoomCryptoContext>>()

export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase()
  if (clean.length % 2 !== 0 || !/^[0-9a-f]+$/.test(clean)) {
    throw new Error('Invalid hex string')
  }
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'))
  }
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

/**
 * Constant-time string comparison for hex digests to prevent timing side-channels.
 */
export function constantTimeEqualHex(a: string, b: string): boolean {
  const cleanA = a.trim().toLowerCase()
  const cleanB = b.trim().toLowerCase()
  if (cleanA.length !== cleanB.length || cleanA.length === 0) return false
  let diff = 0
  for (let i = 0; i < cleanA.length; i++) {
    diff |= cleanA.charCodeAt(i) ^ cleanB.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Derives a 256-bit hex key from a normalized passcode and domain-separated salt
 * using PBKDF2-HMAC-SHA256 (120,000 iterations).
 */
export async function derivePbkdf2Hex(
  normalizedPasscode: string,
  domainSalt: string,
  iterations = 120_000,
): Promise<string> {
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(normalizedPasscode),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: TEXT_ENCODER.encode(domainSalt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )
  return bytesToHex(new Uint8Array(bits))
}

/**
 * Derives the room-specific unguessable HMAC topic token and AES-256-GCM key
 * from the 256-bit `masterKeyHex` unlocked by the user's passcode.
 */
export async function getRoomCryptoContext(
  masterKeyHex: string,
  roomCode: string,
): Promise<CachedRoomCryptoContext> {
  const normalizedRoom = roomCode.trim().toUpperCase() || 'LOUNGE'
  const cacheKey = `${masterKeyHex}:${normalizedRoom}`
  const existing = roomCryptoCache.get(cacheKey)
  if (existing) return existing

  const promise = (async (): Promise<CachedRoomCryptoContext> => {
    const masterBytes = hexToBytes(masterKeyHex)

    // 1. Derive unguessable 128-bit (32-hex) topic token via HMAC-SHA256
    const hmacKey = await globalThis.crypto.subtle.importKey(
      'raw',
      masterBytes.buffer as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const hmacSig = await globalThis.crypto.subtle.sign(
      'HMAC',
      hmacKey,
      TEXT_ENCODER.encode(`vr-lounge-topic-v2:${normalizedRoom}`),
    )
    const topicToken = bytesToHex(new Uint8Array(hmacSig)).slice(0, 32)

    // 2. Derive 256-bit AES-GCM key via HKDF-SHA256
    const hkdfKey = await globalThis.crypto.subtle.importKey(
      'raw',
      masterBytes.buffer as ArrayBuffer,
      'HKDF',
      false,
      ['deriveKey'],
    )
    const aesKey = await globalThis.crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: TEXT_ENCODER.encode('vr-lounge-aes-gcm-salt-v2'),
        info: TEXT_ENCODER.encode(`vr-lounge-room-aes-v2:${normalizedRoom}`),
      },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )

    return {
      masterKeyHex,
      roomCode: normalizedRoom,
      topicToken,
      aesKey,
    }
  })()

  roomCryptoCache.set(cacheKey, promise)
  return promise
}

export function clearRoomCryptoCache(): void {
  roomCryptoCache.clear()
}

export function isEncryptedWirePacket(val: unknown): val is EncryptedWirePacket {
  if (!val || typeof val !== 'object') return false
  const candidate = val as Partial<EncryptedWirePacket>
  return (
    candidate.v === 2 &&
    typeof candidate.iv === 'string' &&
    candidate.iv.length > 0 &&
    typeof candidate.ct === 'string' &&
    candidate.ct.length > 0
  )
}

/**
 * Encrypts an arbitrary JSON-serializable value with AES-256-GCM and a fresh 96-bit CSPRNG IV.
 */
export async function encryptRoomPayload(
  masterKeyHex: string,
  roomCode: string,
  payload: unknown,
): Promise<EncryptedWirePacket> {
  const ctx = await getRoomCryptoContext(masterKeyHex, roomCode)
  const iv = new Uint8Array(12)
  globalThis.crypto.getRandomValues(iv)
  const plaintextBytes = TEXT_ENCODER.encode(JSON.stringify(payload))
  const ciphertextBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    ctx.aesKey,
    plaintextBytes,
  )
  return {
    v: 2,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ciphertextBuffer)),
  }
}

/**
 * Decrypts and authenticates an AES-256-GCM wire packet.
 * Returns `null` if the ciphertext was tampered with or encrypted with a different passcode key.
 */
export async function decryptRoomPayload<T = unknown>(
  masterKeyHex: string,
  roomCode: string,
  packet: unknown,
): Promise<T | null> {
  if (!isEncryptedWirePacket(packet)) return null
  try {
    const ctx = await getRoomCryptoContext(masterKeyHex, roomCode)
    const iv = base64ToBytes(packet.iv)
    if (iv.byteLength !== 12) return null
    const ct = base64ToBytes(packet.ct)
    const plaintextBuffer = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      ctx.aesKey,
      ct.buffer as ArrayBuffer,
    )
    const jsonText = TEXT_DECODER.decode(plaintextBuffer)
    return JSON.parse(jsonText) as T
  } catch {
    return null
  }
}
