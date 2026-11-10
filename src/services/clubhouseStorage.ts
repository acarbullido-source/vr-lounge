import {
  createInitialClubhouseState,
  normalizePlayerKey,
} from '../constants/barGames'
import type {
  ClubhousePersistentState,
  CompletedMatchRecord,
  PlayerClubhouseStats,
} from '../types/barGames'
import { hasSupabaseCredentials } from './realtime'

const CANONICAL_CLUBHOUSE_KEY = 'vr-lounge:single-room-clubhouse:v1'
const LOCAL_CLUBHOUSE_PREFIX = 'vr-lounge:clubhouse-v3:'

const supabaseUrl =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const supabaseAnonKey =
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

/**
 * Caches whether an optional `public.clubhouse_stats` table exists on Supabase so
 * zero-SQL projects never emit 404/401 network errors while still persisting seamlessly
 * in localStorage + Realtime peer hydration.
 */
let supabaseClubhouseTableState: 'unknown' | 'available' | 'unavailable' = 'unknown'
let cloudClubhouseDebounceTimer: number | null = null

function getSupabaseRestHeaders(): Record<string, string> {
  const isNewFormatKey =
    supabaseAnonKey.startsWith('sb_publishable_') || supabaseAnonKey.startsWith('sb_secret_')
  return {
    apikey: supabaseAnonKey,
    'Content-Type': 'application/json',
    ...(isNewFormatKey ? {} : { Authorization: `Bearer ${supabaseAnonKey}` }),
  }
}

export function sanitizeClubhouseState(raw: unknown): ClubhousePersistentState | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Partial<ClubhousePersistentState>
  const defaults = createInitialClubhouseState()
  return {
    revision: typeof c.revision === 'number' ? c.revision : 0,
    updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
    playerStats:
      c.playerStats && typeof c.playerStats === 'object' ? c.playerStats : defaults.playerStats,
    ledger: c.ledger && typeof c.ledger === 'object' ? c.ledger : defaults.ledger,
    recentMatches: Array.isArray(c.recentMatches) ? c.recentMatches.slice(0, 40) : [],
    props: Array.isArray(c.props) && c.props.length > 0 ? c.props.slice(0, 25) : defaults.props,
    watchlist:
      Array.isArray(c.watchlist) && c.watchlist.length > 0
        ? c.watchlist.slice(0, 24)
        : defaults.watchlist,
  }
}

export function loadLocalClubhouseState(roomCode: string): ClubhousePersistentState | null {
  if (typeof window === 'undefined') return null
  try {
    const primaryRaw = window.localStorage.getItem(CANONICAL_CLUBHOUSE_KEY)
    if (primaryRaw) {
      const parsed = sanitizeClubhouseState(JSON.parse(primaryRaw))
      if (parsed) return parsed
    }
    if (roomCode) {
      const key = `${LOCAL_CLUBHOUSE_PREFIX}${roomCode.toUpperCase().trim()}`
      const raw = window.localStorage.getItem(key)
      if (raw) {
        const parsed = sanitizeClubhouseState(JSON.parse(raw))
        if (parsed) {
          window.localStorage.setItem(CANONICAL_CLUBHOUSE_KEY, JSON.stringify(parsed))
          return parsed
        }
      }
    }
    return null
  } catch {
    return null
  }
}

export function saveLocalClubhouseState(
  roomCode: string,
  state: ClubhousePersistentState,
): void {
  if (typeof window === 'undefined') return
  try {
    const serialized = JSON.stringify(state)
    window.localStorage.setItem(CANONICAL_CLUBHOUSE_KEY, serialized)
    if (roomCode) {
      const key = `${LOCAL_CLUBHOUSE_PREFIX}${roomCode.toUpperCase().trim()}`
      window.localStorage.setItem(key, serialized)
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchCloudClubhouseState(
  roomCode: string,
): Promise<ClubhousePersistentState | null> {
  if (
    !hasSupabaseCredentials() ||
    supabaseClubhouseTableState === 'unavailable' ||
    typeof fetch === 'undefined'
  ) {
    return null
  }

  const normalized = encodeURIComponent(roomCode.toUpperCase().trim())
  const base = supabaseUrl.replace(/\/+$/, '')

  try {
    const res = await fetch(
      `${base}/rest/v1/clubhouse_stats?room_code=eq.${normalized}&select=clubhouse_json&limit=1`,
      {
        method: 'GET',
        headers: getSupabaseRestHeaders(),
      },
    )

    if (res.status === 404 || res.status === 401 || res.status === 403) {
      supabaseClubhouseTableState = 'unavailable'
      return null
    }
    if (!res.ok) return null

    supabaseClubhouseTableState = 'available'
    const rows = (await res.json()) as Array<{ clubhouse_json?: unknown }>
    if (!Array.isArray(rows) || rows.length === 0) return null
    return sanitizeClubhouseState(rows[0]?.clubhouse_json)
  } catch {
    return null
  }
}

export function scheduleCloudClubhouseSave(
  roomCode: string,
  state: ClubhousePersistentState,
): void {
  if (
    !hasSupabaseCredentials() ||
    supabaseClubhouseTableState === 'unavailable' ||
    typeof fetch === 'undefined'
  ) {
    return
  }

  if (cloudClubhouseDebounceTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(cloudClubhouseDebounceTimer)
  }

  const runSave = async () => {
    const base = supabaseUrl.replace(/\/+$/, '')
    try {
      const res = await fetch(`${base}/rest/v1/clubhouse_stats?on_conflict=room_code`, {
        method: 'POST',
        headers: {
          ...getSupabaseRestHeaders(),
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          room_code: roomCode.toUpperCase().trim(),
          clubhouse_json: state,
          revision: state.revision,
          updated_at: new Date(state.updatedAt).toISOString(),
        }),
      })

      if (res.status === 404 || res.status === 401 || res.status === 403) {
        supabaseClubhouseTableState = 'unavailable'
      } else if (res.ok) {
        supabaseClubhouseTableState = 'available'
      }
    } catch {
      // Silent fallback to localStorage + peer sync
    }
  }

  if (typeof window !== 'undefined') {
    cloudClubhouseDebounceTimer = window.setTimeout(() => {
      cloudClubhouseDebounceTimer = null
      void runSave()
    }, 900)
  }
}

/**
 * Pure helper updating all-time Clubhouse player stats after a dart throw, putt streak, or completed match.
 */
export function recordClubhouseAchievement(
  prev: ClubhousePersistentState,
  opts: {
    shooterName?: string
    checkoutScore?: number
    hitBullseye?: boolean
    puttingStreak?: number
    arcadeScore?: number
    shuffleboardWin?: boolean
    cornholeWin?: boolean
    completedMatch?: CompletedMatchRecord | null
  },
): ClubhousePersistentState {
  const playerStats: Record<string, PlayerClubhouseStats> = { ...prev.playerStats }

  const ensureEntry = (name: string): PlayerClubhouseStats => {
    const key = normalizePlayerKey(name)
    const existing = playerStats[key]
    if (existing) {
      return { ...existing, displayName: name }
    }
    return {
      key,
      displayName: name,
      dartWins: 0,
      dartLosses: 0,
      puttingWins: 0,
      puttingLosses: 0,
      highestCheckout: 0,
      longestPuttingStreak: 0,
      bullseyes: 0,
      shuffleboardWins: 0,
      cornholeWins: 0,
      arcadeHighScore: 0,
      updatedAt: Date.now(),
    }
  }

  let mutated = false

  if (opts.shooterName) {
    const entry = ensureEntry(opts.shooterName)
    if (opts.hitBullseye) {
      entry.bullseyes += 1
      mutated = true
    }
    if (opts.checkoutScore && opts.checkoutScore > entry.highestCheckout) {
      entry.highestCheckout = opts.checkoutScore
      mutated = true
    }
    if (opts.puttingStreak && opts.puttingStreak > entry.longestPuttingStreak) {
      entry.longestPuttingStreak = opts.puttingStreak
      mutated = true
    }
    if (opts.arcadeScore && opts.arcadeScore > (entry.arcadeHighScore ?? 0)) {
      entry.arcadeHighScore = opts.arcadeScore
      mutated = true
    }
    if (opts.shuffleboardWin) {
      entry.shuffleboardWins = (entry.shuffleboardWins ?? 0) + 1
      mutated = true
    }
    if (opts.cornholeWin) {
      entry.cornholeWins = (entry.cornholeWins ?? 0) + 1
      mutated = true
    }
    if (mutated) {
      entry.updatedAt = Date.now()
      playerStats[entry.key] = entry
    }
  }

  let recentMatches = prev.recentMatches
  if (opts.completedMatch) {
    const m = opts.completedMatch
    const isDarts = m.game === 'darts-501' || m.game === 'darts-cricket'
    const isPutting = m.game === 'putting-puttoff' || m.game === 'putting-streak'
    for (const part of m.participants) {
      const entry = ensureEntry(part.displayName)
      const won = part.userId === m.winnerId
      if (isDarts) {
        if (won) entry.dartWins += 1
        else if (m.participants.length > 1) entry.dartLosses += 1
      } else if (isPutting) {
        if (won) entry.puttingWins += 1
        else if (m.participants.length > 1) entry.puttingLosses += 1
      } else if (m.game === 'shuffleboard') {
        if (won) entry.shuffleboardWins = (entry.shuffleboardWins ?? 0) + 1
      } else if (m.game === 'cornhole') {
        if (won) entry.cornholeWins = (entry.cornholeWins ?? 0) + 1
      } else if (
        m.game === 'arcade-hoops' ||
        m.game === 'arcade-skeeball' ||
        m.game === 'arcade-retro'
      ) {
        if (part.finalScore > (entry.arcadeHighScore ?? 0)) {
          entry.arcadeHighScore = part.finalScore
        }
      }
      entry.updatedAt = Date.now()
      playerStats[entry.key] = entry
    }
    recentMatches = [m, ...prev.recentMatches].slice(0, 35)
    mutated = true
  }

  if (!mutated) return prev

  return {
    ...prev,
    revision: prev.revision + 1,
    updatedAt: Date.now(),
    playerStats,
    recentMatches,
  }
}
