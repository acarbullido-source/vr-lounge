import { CANONICAL_ROOM_CODE } from '../constants/cinema'
import { resolveExpansionWingState } from '../constants/expansionRooms'
import { createDefaultRoomCustomization } from '../constants/hangout'
import type { RoomCustomizationState } from '../types/lounge'
import { hasSupabaseCredentials } from './realtime'

const CANONICAL_LAYOUT_KEY = 'vr-lounge:single-room-layout:v1'
const LOCAL_STORAGE_PREFIX = 'vr-lounge:hangout-v2:'

const supabaseUrl =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const supabaseAnonKey =
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

/**
 * Tracks whether an optional `public.room_layouts` table exists on the user's
 * Supabase project so zero-SQL deployments never spam 404/401 network calls.
 */
let supabaseRoomTableState: 'unknown' | 'available' | 'unavailable' = 'unknown'
let cloudSaveDebounceTimer: number | null = null

function getSupabaseRestHeaders(): Record<string, string> {
  const isNewFormatKey =
    supabaseAnonKey.startsWith('sb_publishable_') || supabaseAnonKey.startsWith('sb_secret_')
  return {
    apikey: supabaseAnonKey,
    'Content-Type': 'application/json',
    ...(isNewFormatKey ? {} : { Authorization: `Bearer ${supabaseAnonKey}` }),
  }
}

export function sanitizeRoomCustomization(raw: unknown): RoomCustomizationState | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Partial<RoomCustomizationState>
  if (!candidate.architecture || !candidate.lighting || !candidate.screen || !Array.isArray(candidate.furniture)) {
    return null
  }
  const defaults = createDefaultRoomCustomization()
  return {
    revision: typeof candidate.revision === 'number' ? candidate.revision : 1,
    updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : Date.now(),
    updatedBy: typeof candidate.updatedBy === 'string' ? candidate.updatedBy : 'Guest',
    architecture: {
      ...defaults.architecture,
      ...candidate.architecture,
    },
    lighting: {
      ...defaults.lighting,
      ...candidate.lighting,
    },
    screen: {
      ...defaults.screen,
      ...candidate.screen,
      position:
        Array.isArray(candidate.screen.position) && candidate.screen.position.length === 3
          ? [
              Number(candidate.screen.position[0]) || 0,
              Number(candidate.screen.position[1]) || 3.05,
              Number(candidate.screen.position[2]) || -6.45,
            ]
          : defaults.screen.position,
    },
    furniture: candidate.furniture.slice(0, 80),
    expansionWing: resolveExpansionWingState(candidate.expansionWing),
  }
}

export function loadLocalRoomCustomization(
  roomCode = CANONICAL_ROOM_CODE,
): RoomCustomizationState | null {
  if (typeof window === 'undefined') return null
  try {
    const primaryRaw = window.localStorage.getItem(CANONICAL_LAYOUT_KEY)
    if (primaryRaw) {
      const parsed = sanitizeRoomCustomization(JSON.parse(primaryRaw))
      if (parsed) return parsed
    }

    const legacyKey = `${LOCAL_STORAGE_PREFIX}${(roomCode || CANONICAL_ROOM_CODE).toUpperCase().trim()}`
    const legacyRaw = window.localStorage.getItem(legacyKey)
    if (legacyRaw) {
      const parsed = sanitizeRoomCustomization(JSON.parse(legacyRaw))
      if (parsed) {
        window.localStorage.setItem(CANONICAL_LAYOUT_KEY, JSON.stringify(parsed))
        return parsed
      }
    }

    // Migrate the newest saved layout from any previous room code (e.g. CINEMA-1)
    let bestMigrated: RoomCustomizationState | null = null
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k || !k.startsWith(LOCAL_STORAGE_PREFIX)) continue
      const val = window.localStorage.getItem(k)
      if (!val) continue
      const candidate = sanitizeRoomCustomization(JSON.parse(val))
      if (!candidate) continue
      if (
        !bestMigrated ||
        candidate.updatedAt > bestMigrated.updatedAt ||
        (candidate.updatedAt === bestMigrated.updatedAt &&
          candidate.revision > bestMigrated.revision)
      ) {
        bestMigrated = candidate
      }
    }

    if (bestMigrated) {
      window.localStorage.setItem(CANONICAL_LAYOUT_KEY, JSON.stringify(bestMigrated))
      return bestMigrated
    }
    return null
  } catch {
    return null
  }
}

export function saveLocalRoomCustomization(
  roomCode: string,
  state: RoomCustomizationState,
): void {
  if (typeof window === 'undefined') return
  try {
    const serialized = JSON.stringify(state)
    window.localStorage.setItem(CANONICAL_LAYOUT_KEY, serialized)
    const normalized = (roomCode || CANONICAL_ROOM_CODE).toUpperCase().trim()
    window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${normalized}`, serialized)
  } catch {
    // Ignore storage quota errors
  }
}

export function clearLocalRoomCustomization(roomCode = CANONICAL_ROOM_CODE): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CANONICAL_LAYOUT_KEY)
    const normalized = (roomCode || CANONICAL_ROOM_CODE).toUpperCase().trim()
    window.localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${normalized}`)
  } catch {
    // Ignore errors
  }
}

export async function fetchCloudRoomCustomization(
  roomCode: string,
): Promise<RoomCustomizationState | null> {
  if (
    !hasSupabaseCredentials() ||
    supabaseRoomTableState === 'unavailable' ||
    typeof fetch === 'undefined'
  ) {
    return null
  }

  const normalized = encodeURIComponent(roomCode.toUpperCase().trim())
  const base = supabaseUrl.replace(/\/+$/, '')

  try {
    const res = await fetch(
      `${base}/rest/v1/room_layouts?room_code=eq.${normalized}&select=layout_json&limit=1`,
      {
        method: 'GET',
        headers: getSupabaseRestHeaders(),
      },
    )

    if (res.status === 404 || res.status === 401 || res.status === 403) {
      supabaseRoomTableState = 'unavailable'
      return null
    }

    if (!res.ok) return null
    supabaseRoomTableState = 'available'

    const rows = (await res.json()) as Array<{ layout_json?: unknown }>
    if (!Array.isArray(rows) || rows.length === 0) return null
    return sanitizeRoomCustomization(rows[0]?.layout_json)
  } catch {
    return null
  }
}

export function scheduleCloudRoomSave(
  roomCode: string,
  state: RoomCustomizationState,
): void {
  if (
    !hasSupabaseCredentials() ||
    supabaseRoomTableState === 'unavailable' ||
    typeof fetch === 'undefined'
  ) {
    return
  }

  if (cloudSaveDebounceTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(cloudSaveDebounceTimer)
  }

  const runSave = async () => {
    const base = supabaseUrl.replace(/\/+$/, '')
    try {
      const res = await fetch(`${base}/rest/v1/room_layouts?on_conflict=room_code`, {
        method: 'POST',
        headers: {
          ...getSupabaseRestHeaders(),
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          room_code: roomCode.toUpperCase().trim(),
          layout_json: state,
          revision: state.revision,
          updated_at: new Date(state.updatedAt).toISOString(),
        }),
      })

      if (res.status === 404 || res.status === 401 || res.status === 403) {
        supabaseRoomTableState = 'unavailable'
      } else if (res.ok) {
        supabaseRoomTableState = 'available'
      }
    } catch {
      // Silent fallback to localStorage + realtime peer hydration
    }
  }

  if (typeof window !== 'undefined') {
    cloudSaveDebounceTimer = window.setTimeout(() => {
      cloudSaveDebounceTimer = null
      void runSave()
    }, 850)
  }
}
