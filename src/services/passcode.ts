const STORAGE_KEY = 'vr-lounge:access-gate:v2'
const DEFAULT_LOUNGE_PASSCODE = 'dingbaum'

interface StoredUnlockRecord {
  fingerprint: string
  unlockedAt: number
}

export function getConfiguredPasscode(): string {
  const envVal = (import.meta.env.VITE_LOUNGE_PASSCODE as string | undefined)?.trim()
  if (!envVal || envVal === '2468') {
    return DEFAULT_LOUNGE_PASSCODE
  }
  if (
    envVal.toLowerCase() === 'off' ||
    envVal.toLowerCase() === 'false' ||
    envVal.toLowerCase() === 'none'
  ) {
    return ''
  }
  return envVal
}

/**
 * Deterministic lightweight fingerprint so `localStorage` remembers unlocked
 * headsets/browsers without storing the raw passcode in plain text, and
 * automatically invalidates if `VITE_LOUNGE_PASSCODE` is rotated.
 */
function fingerprintPasscode(rawCode: string): string {
  const normalized = `vrlounge-gate-v1:${rawCode.trim().toUpperCase()}`
  let h1 = 0xdeadbeef ^ normalized.length
  let h2 = 0x41c6ce57 ^ normalized.length
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`
}

export function isPasscodeGateEnabled(): boolean {
  return getConfiguredPasscode().length > 0
}

export function isDeviceUnlocked(): boolean {
  const configured = getConfiguredPasscode()
  if (!configured) return true
  if (typeof window === 'undefined') return false

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as StoredUnlockRecord
    return parsed?.fingerprint === fingerprintPasscode(configured)
  } catch {
    return false
  }
}

export function verifyAndUnlockPasscode(candidate: string): boolean {
  const configured = getConfiguredPasscode()
  if (!configured) return true

  const cleanCandidate = candidate.trim().toUpperCase()
  const cleanConfigured = configured.trim().toUpperCase()
  if (!cleanCandidate || cleanCandidate !== cleanConfigured) {
    return false
  }

  try {
    const record: StoredUnlockRecord = {
      fingerprint: fingerprintPasscode(configured),
      unlockedAt: Date.now(),
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Ignore private-browsing storage quota errors
  }

  return true
}

export function lockDevicePasscode(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage removal errors
  }
}

export function isPasscodeNumericOnly(): boolean {
  const configured = getConfiguredPasscode()
  return /^[0-9]+$/.test(configured)
}
