import {
  clearRoomCryptoCache,
  constantTimeEqualHex,
  derivePbkdf2Hex,
} from './cryptoSession'

const STORAGE_KEY = 'vr-lounge:access-gate:v3'
const DEFAULT_PASSCODE_SALT = 'vr-lounge-auth-v2'
/**
 * Salted PBKDF2-HMAC-SHA256 (120,000 iterations) verifier digest.
 * The raw group passcode is NEVER stored in source code, environment variables, or the JS bundle.
 */
const DEFAULT_PASSCODE_VERIFIER_HEX =
  'e60e4d4aecf6dc515d04b9f044748049abd95ddc76f8e61f3e32775a4a172f53'

interface StoredUnlockRecord {
  verifierHex: string
  masterKeyHex: string
  unlockedAt: number
}

let inMemoryMasterKeyHex: string | null = null
let inMemoryVerifierHex: string | null = null

export function getPasscodeSalt(): string {
  const envSalt = (
    import.meta.env?.VITE_LOUNGE_PASSCODE_SALT as string | undefined
  )?.trim()
  return envSalt || DEFAULT_PASSCODE_SALT
}

export function getConfiguredPasscodeVerifier(): string {
  const envVerifier = (
    import.meta.env?.VITE_LOUNGE_PASSCODE_VERIFIER as string | undefined
  )
    ?.trim()
    .toLowerCase()
  if (
    envVerifier === 'off' ||
    envVerifier === 'false' ||
    envVerifier === 'none'
  ) {
    return ''
  }
  if (envVerifier && /^[0-9a-f]{64}$/.test(envVerifier)) {
    return envVerifier
  }
  return DEFAULT_PASSCODE_VERIFIER_HEX
}

export function isPasscodeGateEnabled(): boolean {
  return getConfiguredPasscodeVerifier().length === 64
}

function isValidHex256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value.trim())
}

function readStoredUnlockRecord(): StoredUnlockRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredUnlockRecord>
    if (
      !isValidHex256(parsed.verifierHex) ||
      !isValidHex256(parsed.masterKeyHex)
    ) {
      return null
    }
    return {
      verifierHex: parsed.verifierHex.toLowerCase(),
      masterKeyHex: parsed.masterKeyHex.toLowerCase(),
      unlockedAt:
        typeof parsed.unlockedAt === 'number' ? parsed.unlockedAt : Date.now(),
    }
  } catch {
    return null
  }
}

export function isDeviceUnlocked(): boolean {
  const expectedVerifier = getConfiguredPasscodeVerifier()
  if (!expectedVerifier) return true

  if (
    inMemoryVerifierHex &&
    inMemoryMasterKeyHex &&
    constantTimeEqualHex(inMemoryVerifierHex, expectedVerifier)
  ) {
    return true
  }

  const stored = readStoredUnlockRecord()
  if (!stored) return false

  if (!constantTimeEqualHex(stored.verifierHex, expectedVerifier)) {
    return false
  }

  inMemoryVerifierHex = stored.verifierHex
  inMemoryMasterKeyHex = stored.masterKeyHex
  return true
}

/**
 * Returns the 256-bit room E2EE master key derived from the verified passcode.
 * Without entering the genuine passcode, this key cannot be derived, so tampering
 * with UI state or storage flags cannot decrypt room traffic or compute the room topic.
 */
export function getUnlockedRoomMasterKeyHex(): string | null {
  if (!isDeviceUnlocked()) return null
  if (inMemoryMasterKeyHex && isValidHex256(inMemoryMasterKeyHex)) {
    return inMemoryMasterKeyHex
  }
  const stored = readStoredUnlockRecord()
  if (stored && isValidHex256(stored.masterKeyHex)) {
    inMemoryMasterKeyHex = stored.masterKeyHex
    inMemoryVerifierHex = stored.verifierHex
    return stored.masterKeyHex
  }
  return null
}

/**
 * Verifies a candidate passcode using 120,000-iteration PBKDF2-SHA256 and, on match,
 * derives the independent 256-bit E2EE master key for room transport encryption.
 */
export async function verifyAndUnlockPasscode(
  candidate: string,
): Promise<boolean> {
  const expectedVerifier = getConfiguredPasscodeVerifier()
  const salt = getPasscodeSalt()
  const normalized = candidate.trim().toUpperCase()
  if (!normalized) return false

  const candidateVerifierHex = await derivePbkdf2Hex(
    normalized,
    `${salt}:verifier`,
  )

  if (
    expectedVerifier &&
    !constantTimeEqualHex(candidateVerifierHex, expectedVerifier)
  ) {
    return false
  }

  const masterKeyHex = await derivePbkdf2Hex(normalized, `${salt}:e2ee-master`)
  inMemoryVerifierHex = candidateVerifierHex
  inMemoryMasterKeyHex = masterKeyHex
  clearRoomCryptoCache()

  if (typeof window !== 'undefined') {
    try {
      const record: StoredUnlockRecord = {
        verifierHex: candidateVerifierHex,
        masterKeyHex,
        unlockedAt: Date.now(),
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    } catch {
      // Ignore private-browsing storage quota errors; inMemoryMasterKeyHex remains active
    }
  }

  return true
}

export function lockDevicePasscode(): void {
  inMemoryMasterKeyHex = null
  inMemoryVerifierHex = null
  clearRoomCryptoCache()
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem('vr-lounge:access-gate:v2')
  } catch {
    // Ignore storage removal errors
  }
}

export function isPasscodeNumericOnly(): boolean {
  const hint = (
    import.meta.env?.VITE_LOUNGE_PASSCODE_NUMERIC as string | undefined
  )?.trim()
  return hint === 'true' || hint === '1'
}

/**
 * Utility for generating a new PBKDF2 verifier hash when rotating the group passcode.
 */
export async function generatePasscodeVerifierConfig(
  newPasscode: string,
  customSalt = DEFAULT_PASSCODE_SALT,
): Promise<{
  salt: string
  verifierHex: string
}> {
  const normalized = newPasscode.trim().toUpperCase()
  if (!normalized) {
    throw new Error('Passcode cannot be empty')
  }
  const verifierHex = await derivePbkdf2Hex(normalized, `${customSalt}:verifier`)
  return {
    salt: customSalt,
    verifierHex,
  }
}
