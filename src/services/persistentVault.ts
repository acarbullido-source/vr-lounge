import {
  loadSavedAvatarPreferences,
  saveAvatarPreferences,
  type SavedAvatarPreferences,
} from '../constants/avatars'
import { CANONICAL_ROOM_CODE } from '../constants/cinema'
import type { ClubhousePersistentState } from '../types/barGames'
import type {
  NesSaveSlotId,
  NesSaveSlotMeta,
  RoomCustomizationState,
} from '../types/lounge'
import {
  loadLocalClubhouseState,
  sanitizeClubhouseState,
  saveLocalClubhouseState,
} from './clubhouseStorage'
import {
  loadLocalRoomCustomization,
  sanitizeRoomCustomization,
  saveLocalRoomCustomization,
} from './roomStorage'

const IDB_NAME = 'vr-lounge-vault-idb-v1'
const IDB_VERSION = 1
const STORE_KV = 'vault_kv'
const STORE_NES_SAVES = 'nes_saves'
const STORE_NES_BATTERY = 'nes_battery'
const STORE_PROFILES = 'member_profiles'

const NES_SAVES_META_INDEX_KEY = 'vr-lounge:nes-saves-index:v1'
const NES_BATTERY_PREFIX = 'vr-lounge:nes-battery:v1:'
const PROFILE_VAULT_PREFIX = 'vr-lounge:profile-vault:v1:'

export interface MemberProfileVaultEntry {
  normalizedName: string
  displayName: string
  avatarPreferences: SavedAvatarPreferences
  identityRecordRaw?: string | null
  updatedAt: number
}

export interface RetainedNesVaultPayload {
  updatedAt: number
  saves: NesSaveSlotMeta[]
  batteryByCartridge?: Record<string, string>
}

export interface RetainedProfilesVaultPayload {
  updatedAt: number
  profiles: Record<string, MemberProfileVaultEntry>
}

export interface FullLoungeBackupBundle {
  version: 2
  exportedAt: number
  roomCode: string
  roomLayout: RoomCustomizationState | null
  clubhouseState: ClubhousePersistentState | null
  avatarPreferences: SavedAvatarPreferences | null
  memberIdentityRaw: string | null
  nesSaveSlots: NesSaveSlotMeta[]
  nesBatteryByCartridge: Record<string, string>
}

export interface VaultStatusSnapshot {
  durableStorageGranted: boolean
  cloudRelaySynced: boolean
  lastSyncedAt: number | null
  nesSaveCount: number
  hasProfileBackup: boolean
}

let idbPromise: Promise<IDBDatabase | null> | null = null
let durableStorageGranted = false
let cloudRelaySynced = false
let lastSyncedAt: number | null = null
const statusListeners = new Set<(status: VaultStatusSnapshot) => void>()

// In-memory cache of NES save states (keyed by `${cartridgeId}::${slotId}`)
const memoryNesSaves = new Map<string, NesSaveSlotMeta>()
const memoryBatteryRam = new Map<string, string>()
const memoryProfiles = new Map<string, MemberProfileVaultEntry>()

function makeSaveKey(cartridgeId: string, slotId: NesSaveSlotId): string {
  return `${cartridgeId.trim().toLowerCase()}::${slotId}`
}

export function normalizeProfileHandleKey(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s*\(#[0-9a-f]{4}\)\s*$/i, '')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'guest'
  )
}

function notifyVaultStatusListeners(): void {
  const snapshot = getVaultStatusSnapshot()
  for (const listener of statusListeners) {
    try {
      listener(snapshot)
    } catch {
      // Ignore listener error
    }
  }
}

export function getVaultStatusSnapshot(): VaultStatusSnapshot {
  const prefs = loadSavedAvatarPreferences()
  return {
    durableStorageGranted,
    cloudRelaySynced,
    lastSyncedAt,
    nesSaveCount: memoryNesSaves.size,
    hasProfileBackup: Boolean(prefs?.displayName),
  }
}

export function subscribeVaultStatus(
  listener: (status: VaultStatusSnapshot) => void,
): () => void {
  statusListeners.add(listener)
  listener(getVaultStatusSnapshot())
  return () => {
    statusListeners.delete(listener)
  }
}

export function markCloudVaultSynced(): void {
  cloudRelaySynced = true
  lastSyncedAt = Date.now()
  notifyVaultStatusListeners()
}

function openVaultDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }
  if (idbPromise) return idbPromise

  idbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_KV)) {
          db.createObjectStore(STORE_KV)
        }
        if (!db.objectStoreNames.contains(STORE_NES_SAVES)) {
          db.createObjectStore(STORE_NES_SAVES, { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains(STORE_NES_BATTERY)) {
          db.createObjectStore(STORE_NES_BATTERY)
        }
        if (!db.objectStoreNames.contains(STORE_PROFILES)) {
          db.createObjectStore(STORE_PROFILES, { keyPath: 'normalizedName' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })

  return idbPromise
}

async function idbPut(
  storeName: string,
  value: unknown,
  key?: IDBValidKey,
): Promise<void> {
  const db = await openVaultDatabase()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      if (key !== undefined) {
        store.put(value, key)
      } else {
        store.put(value)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openVaultDatabase()
  if (!db) return []
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const req = store.getAll()
      req.onsuccess = () => resolve((req.result as T[]) ?? [])
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, bytes.length))
    binary += String.fromCharCode.apply(null, sub as unknown as number[])
  }
  if (typeof btoa === 'function') {
    return btoa(binary)
  }
  return Buffer.from(bytes).toString('base64')
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i)
    }
    return out
  }
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

/**
 * Compresses a JSON string using Web standard GZIP (`CompressionStream('gzip')`)
 * with an automatic uncompressed base64 fallback.
 */
export async function compressStringToBase64(rawText: string): Promise<string> {
  const utf8 = new TextEncoder().encode(rawText)
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('gzip')
      const writer = cs.writable.getWriter()
      void writer.write(utf8)
      void writer.close()
      const compressedBuf = await new Response(cs.readable).arrayBuffer()
      return `gz:${bytesToBase64(new Uint8Array(compressedBuf))}`
    } catch {
      // Fallback to raw base64 below
    }
  }
  return `raw:${bytesToBase64(utf8)}`
}

export async function decompressBase64ToString(
  encoded: string,
): Promise<string> {
  if (encoded.startsWith('gz:') && typeof DecompressionStream !== 'undefined') {
    const bytes = base64ToBytes(encoded.slice(3))
    const ds = new DecompressionStream('gzip')
    const writer = ds.writable.getWriter()
    void writer.write(bytes as unknown as BufferSource)
    void writer.close()
    const decompressedBuf = await new Response(ds.readable).arrayBuffer()
    return new TextDecoder().decode(decompressedBuf)
  }
  const cleanB64 = encoded.startsWith('raw:')
    ? encoded.slice(4)
    : encoded.startsWith('gz:')
      ? encoded.slice(3)
      : encoded
  const bytes = base64ToBytes(cleanB64)
  return new TextDecoder().decode(bytes)
}

function persistSavesMetaIndexToLocalStorage(): void {
  if (typeof window === 'undefined') return
  try {
    // Store lightweight metadata + most recent saves in localStorage for instant synchronous UI boot
    const all = Array.from(memoryNesSaves.values()).sort(
      (a, b) => b.savedAt - a.savedAt,
    )
    const compactList = all.slice(0, 24).map((s, idx) => ({
      ...s,
      // Keep compressedState in localStorage for the 8 most recent saves so even without IDB it works synchronously
      compressedState: idx < 8 ? s.compressedState : '',
    }))
    window.localStorage.setItem(
      NES_SAVES_META_INDEX_KEY,
      JSON.stringify(compactList),
    )
  } catch {
    // Ignore localStorage quota warnings (IndexedDB holds full state)
  }
}

function hydrateInitialFromLocalStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const rawIndex = window.localStorage.getItem(NES_SAVES_META_INDEX_KEY)
    if (rawIndex) {
      const parsed = JSON.parse(rawIndex) as unknown
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (
            item &&
            typeof item === 'object' &&
            typeof (item as NesSaveSlotMeta).cartridgeId === 'string' &&
            typeof (item as NesSaveSlotMeta).slotId === 'string'
          ) {
            const slot = item as NesSaveSlotMeta
            memoryNesSaves.set(makeSaveKey(slot.cartridgeId, slot.slotId), slot)
          }
        }
      }
    }

    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k) continue
      if (k.startsWith(NES_BATTERY_PREFIX)) {
        const cartId = k.slice(NES_BATTERY_PREFIX.length)
        const val = window.localStorage.getItem(k)
        if (cartId && val) {
          memoryBatteryRam.set(cartId, val)
        }
      } else if (k.startsWith(PROFILE_VAULT_PREFIX)) {
        const val = window.localStorage.getItem(k)
        if (val) {
          const entry = JSON.parse(val) as MemberProfileVaultEntry
          if (entry?.normalizedName) {
            memoryProfiles.set(entry.normalizedName, entry)
          }
        }
      }
    }
  } catch {
    // Ignore parse errors
  }
}

hydrateInitialFromLocalStorage()

/**
 * Requests durable storage from the browser (`navigator.storage.persist()`)
 * and hydrates all IndexedDB records into memory.
 */
export async function initializePersistentVault(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    try {
      const persisted = await navigator.storage.persist()
      durableStorageGranted = persisted
    } catch {
      // Ignore permission errors
    }
  }

  const savedRows = await idbGetAll<{ key: string; slot: NesSaveSlotMeta }>(
    STORE_NES_SAVES,
  )
  for (const row of savedRows) {
    if (row?.slot?.cartridgeId && row?.slot?.slotId) {
      const key = makeSaveKey(row.slot.cartridgeId, row.slot.slotId)
      const existing = memoryNesSaves.get(key)
      if (
        !existing ||
        row.slot.savedAt >= existing.savedAt ||
        (!existing.compressedState && row.slot.compressedState)
      ) {
        memoryNesSaves.set(key, row.slot)
      }
    }
  }

  const profileRows = await idbGetAll<MemberProfileVaultEntry>(STORE_PROFILES)
  for (const prof of profileRows) {
    if (prof?.normalizedName) {
      const existing = memoryProfiles.get(prof.normalizedName)
      if (!existing || prof.updatedAt >= existing.updatedAt) {
        memoryProfiles.set(prof.normalizedName, prof)
      }
    }
  }

  persistSavesMetaIndexToLocalStorage()
  notifyVaultStatusListeners()
}

if (typeof window !== 'undefined') {
  void initializePersistentVault()
}

// ============================================================================
// NES Save State & Battery-Backed SRAM Vault Operations
// ============================================================================

export async function storeNesSaveSlot(
  slot: NesSaveSlotMeta,
): Promise<NesSaveSlotMeta> {
  const key = makeSaveKey(slot.cartridgeId, slot.slotId)
  memoryNesSaves.set(key, slot)
  persistSavesMetaIndexToLocalStorage()
  await idbPut(STORE_NES_SAVES, { key, slot })
  notifyVaultStatusListeners()
  return slot
}

export function getNesSaveSlotsForCartridge(
  cartridgeId: string,
): NesSaveSlotMeta[] {
  const cleanId = cartridgeId.trim().toLowerCase()
  const order: NesSaveSlotId[] = ['auto', 'slot-1', 'slot-2', 'slot-3']
  const results: NesSaveSlotMeta[] = []
  for (const slotId of order) {
    const found = memoryNesSaves.get(makeSaveKey(cleanId, slotId))
    if (found) results.push(found)
  }
  return results
}

export function getNesSaveSlot(
  cartridgeId: string,
  slotId: NesSaveSlotId,
): NesSaveSlotMeta | null {
  return memoryNesSaves.get(makeSaveKey(cartridgeId, slotId)) ?? null
}

export function getMostRecentNesSaveForCartridge(
  cartridgeId: string,
): NesSaveSlotMeta | null {
  const slots = getNesSaveSlotsForCartridge(cartridgeId).filter((s) =>
    Boolean(s.compressedState),
  )
  if (slots.length === 0) return null
  return slots.sort((a, b) => b.savedAt - a.savedAt)[0]
}

export function getAllNesSaveSlots(): NesSaveSlotMeta[] {
  return Array.from(memoryNesSaves.values()).sort(
    (a, b) => b.savedAt - a.savedAt,
  )
}

export function hasAnySaveForCartridge(cartridgeId: string): boolean {
  return getNesSaveSlotsForCartridge(cartridgeId).length > 0
}

export const hasAnyNesSaveForCartridge = hasAnySaveForCartridge

export function saveNesBatteryRam(cartridgeId: string, sramB64: string): void {
  const clean = cartridgeId.trim().toLowerCase()
  if (!clean || !sramB64) return
  memoryBatteryRam.set(clean, sramB64)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(`${NES_BATTERY_PREFIX}${clean}`, sramB64)
    } catch {
      // Ignore quota
    }
  }
  void idbPut(STORE_NES_BATTERY, sramB64, clean)
}

export function loadNesBatteryRam(cartridgeId: string): string | null {
  const clean = cartridgeId.trim().toLowerCase()
  return memoryBatteryRam.get(clean) ?? null
}

export function buildRetainedNesVaultPayload(): RetainedNesVaultPayload {
  // Include up to 16 most recent compressed save slots so MQTT retained message stays compact (~200-500 KB)
  const allSaves = getAllNesSaveSlots()
    .filter((s) => Boolean(s.compressedState))
    .slice(0, 16)
  const batteryByCartridge: Record<string, string> = {}
  for (const [k, v] of memoryBatteryRam.entries()) {
    batteryByCartridge[k] = v
  }
  return {
    updatedAt: Date.now(),
    saves: allSaves,
    batteryByCartridge,
  }
}

export async function mergeIncomingNesVaultPayload(
  payload: RetainedNesVaultPayload | null | undefined,
): Promise<number> {
  if (!payload || typeof payload !== 'object') return 0
  let importedCount = 0

  if (Array.isArray(payload.saves)) {
    for (const incoming of payload.saves) {
      if (
        !incoming ||
        typeof incoming.cartridgeId !== 'string' ||
        typeof incoming.slotId !== 'string' ||
        typeof incoming.savedAt !== 'number'
      ) {
        continue
      }
      const key = makeSaveKey(incoming.cartridgeId, incoming.slotId)
      const current = memoryNesSaves.get(key)
      if (
        !current ||
        incoming.savedAt > current.savedAt ||
        (!current.compressedState && incoming.compressedState)
      ) {
        await storeNesSaveSlot(incoming)
        importedCount++
      }
    }
  }

  if (
    payload.batteryByCartridge &&
    typeof payload.batteryByCartridge === 'object'
  ) {
    for (const [cartId, sramB64] of Object.entries(payload.batteryByCartridge)) {
      if (typeof sramB64 === 'string' && sramB64.length > 0) {
        if (!memoryBatteryRam.has(cartId)) {
          saveNesBatteryRam(cartId, sramB64)
        }
      }
    }
  }

  markCloudVaultSynced()
  return importedCount
}

// ============================================================================
// Member Profile & Cryptographic Identity Cloud/Retained Vault
// ============================================================================

const IDENTITY_STORAGE_KEY = 'vr-lounge:member-identity:v2'

export function recordMemberProfileToVault(
  prefs: SavedAvatarPreferences,
): MemberProfileVaultEntry | null {
  const displayName = prefs.displayName?.trim() || 'Guest'
  const normalizedName = normalizeProfileHandleKey(displayName)
  const identityRecordRaw =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(IDENTITY_STORAGE_KEY)
      : null

  const entry: MemberProfileVaultEntry = {
    normalizedName,
    displayName,
    avatarPreferences: prefs,
    identityRecordRaw,
    updatedAt: Date.now(),
  }

  memoryProfiles.set(normalizedName, entry)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        `${PROFILE_VAULT_PREFIX}${normalizedName}`,
        JSON.stringify(entry),
      )
    } catch {
      // Ignore quota
    }
  }
  void idbPut(STORE_PROFILES, entry)
  notifyVaultStatusListeners()
  return entry
}

export function mergeIncomingProfileVaultMap(
  profilesMap: Record<string, MemberProfileVaultEntry> | null | undefined,
): void {
  if (!profilesMap || typeof profilesMap !== 'object') return
  for (const [key, entry] of Object.entries(profilesMap)) {
    if (
      !entry ||
      typeof entry.normalizedName !== 'string' ||
      typeof entry.updatedAt !== 'number'
    ) {
      continue
    }
    const existing = memoryProfiles.get(key)
    if (!existing || entry.updatedAt > existing.updatedAt) {
      memoryProfiles.set(key, entry)
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            `${PROFILE_VAULT_PREFIX}${key}`,
            JSON.stringify(entry),
          )
        } catch {
          // Ignore
        }
      }
      void idbPut(STORE_PROFILES, entry)
    }
  }
  markCloudVaultSynced()
}

export function mergeIncomingProfilesVaultPayload(
  payload: RetainedProfilesVaultPayload | null | undefined,
): void {
  if (!payload || typeof payload !== 'object') return
  mergeIncomingProfileVaultMap(payload.profiles)
}

export function buildAllMemberProfilesVaultMap(): Record<
  string,
  MemberProfileVaultEntry
> {
  const out: Record<string, MemberProfileVaultEntry> = {}
  for (const [k, v] of memoryProfiles.entries()) {
    out[k] = v
  }
  return out
}

export function buildRetainedProfilesVaultPayload(): RetainedProfilesVaultPayload {
  return {
    updatedAt: Date.now(),
    profiles: buildAllMemberProfilesVaultMap(),
  }
}

/**
 * Restores a member's saved Avatar appearance and ECDSA cryptographic identity
 * by their display name (e.g. after resetting a Quest headset or switching browsers).
 */
export function restoreMemberProfileFromVault(
  displayNameQuery: string,
): MemberProfileVaultEntry | null {
  const key = normalizeProfileHandleKey(displayNameQuery)
  const found = memoryProfiles.get(key)
  if (!found) return null

  saveAvatarPreferences(found.avatarPreferences)
  if (found.identityRecordRaw && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(IDENTITY_STORAGE_KEY, found.identityRecordRaw)
      window.localStorage.setItem('vr-lounge:name', found.displayName)
    } catch {
      // Ignore
    }
  }
  notifyVaultStatusListeners()
  return found
}

// ============================================================================
// Portable `.vrlounge.json` Full Backup Export & Import
// ============================================================================

export function exportFullLoungeVaultBundle(
  roomCode = CANONICAL_ROOM_CODE,
): string {
  const batteryByCartridge: Record<string, string> = {}
  for (const [k, v] of memoryBatteryRam.entries()) {
    batteryByCartridge[k] = v
  }
  const bundle: FullLoungeBackupBundle = {
    version: 2,
    exportedAt: Date.now(),
    roomCode,
    roomLayout: loadLocalRoomCustomization(roomCode),
    clubhouseState: loadLocalClubhouseState(roomCode),
    avatarPreferences: loadSavedAvatarPreferences(),
    memberIdentityRaw:
      typeof window !== 'undefined'
        ? window.localStorage.getItem(IDENTITY_STORAGE_KEY)
        : null,
    nesSaveSlots: getAllNesSaveSlots(),
    nesBatteryByCartridge: batteryByCartridge,
  }
  return JSON.stringify(bundle, null, 2)
}

export async function importFullLoungeVaultBundle(
  rawJson: string,
  roomCode = CANONICAL_ROOM_CODE,
): Promise<{
  ok: boolean
  restoredSaves: number
  restoredLayout: boolean
  restoredClubhouse: boolean
  restoredProfile: boolean
}> {
  try {
    const parsed = JSON.parse(rawJson) as Partial<FullLoungeBackupBundle>
    if (!parsed || typeof parsed !== 'object') {
      return {
        ok: false,
        restoredSaves: 0,
        restoredLayout: false,
        restoredClubhouse: false,
        restoredProfile: false,
      }
    }

    let restoredLayout = false
    if (parsed.roomLayout) {
      const cleanLayout = sanitizeRoomCustomization(parsed.roomLayout)
      if (cleanLayout) {
        saveLocalRoomCustomization(roomCode, cleanLayout)
        restoredLayout = true
      }
    }

    let restoredClubhouse = false
    if (parsed.clubhouseState) {
      const cleanClub = sanitizeClubhouseState(parsed.clubhouseState)
      if (cleanClub) {
        saveLocalClubhouseState(roomCode, cleanClub)
        restoredClubhouse = true
      }
    }

    let restoredProfile = false
    if (parsed.avatarPreferences) {
      saveAvatarPreferences(parsed.avatarPreferences)
      recordMemberProfileToVault(parsed.avatarPreferences)
      restoredProfile = true
    }
    if (parsed.memberIdentityRaw && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          IDENTITY_STORAGE_KEY,
          parsed.memberIdentityRaw,
        )
        restoredProfile = true
      } catch {
        // Ignore
      }
    }

    let restoredSaves = 0
    if (Array.isArray(parsed.nesSaveSlots)) {
      for (const slot of parsed.nesSaveSlots) {
        if (slot?.cartridgeId && slot?.slotId) {
          await storeNesSaveSlot(slot)
          restoredSaves++
        }
      }
    }

    if (
      parsed.nesBatteryByCartridge &&
      typeof parsed.nesBatteryByCartridge === 'object'
    ) {
      for (const [cartId, sram] of Object.entries(parsed.nesBatteryByCartridge)) {
        if (typeof sram === 'string') {
          saveNesBatteryRam(cartId, sram)
        }
      }
    }

    notifyVaultStatusListeners()
    return {
      ok: true,
      restoredSaves,
      restoredLayout,
      restoredClubhouse,
      restoredProfile,
    }
  } catch {
    return {
      ok: false,
      restoredSaves: 0,
      restoredLayout: false,
      restoredClubhouse: false,
      restoredProfile: false,
    }
  }
}
