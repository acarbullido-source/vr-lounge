import type { SportsLeagueId } from '../types/lounge'

export interface SportsLeagueSpec {
  id: SportsLeagueId
  label: string
  shortLabel: string
  emoji: string
  accentColor: string
  espnEndpoint: string
}

export const SPORTS_LEAGUE_SPECS: readonly SportsLeagueSpec[] = [
  {
    id: 'nfl',
    label: 'NFL Football',
    shortLabel: 'NFL',
    emoji: '🏈',
    accentColor: '#38BDF8',
    espnEndpoint: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  },
  {
    id: 'nba',
    label: 'NBA Basketball',
    shortLabel: 'NBA',
    emoji: '🏀',
    accentColor: '#F59E0B',
    espnEndpoint: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  },
  {
    id: 'mlb',
    label: 'MLB Baseball',
    shortLabel: 'MLB',
    emoji: '⚾',
    accentColor: '#EF4444',
    espnEndpoint: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  },
  {
    id: 'nhl',
    label: 'NHL Hockey',
    shortLabel: 'NHL',
    emoji: '🏒',
    accentColor: '#06B6D4',
    espnEndpoint: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  },
  {
    id: 'mls',
    label: 'MLS Soccer',
    shortLabel: 'MLS',
    emoji: '⚽',
    accentColor: '#10B981',
    espnEndpoint: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard',
  },
  {
    id: 'ncaaf',
    label: 'NCAA Football',
    shortLabel: 'NCAAF',
    emoji: '🏟',
    accentColor: '#A855F7',
    espnEndpoint:
      'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  },
] as const

export interface SportsGameMatchup {
  id: string
  league: SportsLeagueId
  awayTeam: string
  awayName: string
  awayScore: string
  awayRecord: string
  awayColor: string
  homeTeam: string
  homeName: string
  homeScore: string
  homeRecord: string
  homeColor: string
  statusText: string
  state: 'in' | 'post' | 'pre'
  broadcast: string
  headline: string
}

export interface SportsScoreboardSnapshot {
  league: SportsLeagueId
  leagueLabel: string
  games: SportsGameMatchup[]
  isLiveData: boolean
  noActiveGamesMessage: string | null
  fetchedAt: number
}

const SCOREBOARD_TTL_MS = 60_000
const scoreboardCache = new Map<SportsLeagueId, SportsScoreboardSnapshot>()

const FALLBACK_SLATES: Record<SportsLeagueId, SportsGameMatchup[]> = {
  nfl: [
    {
      id: 'nfl-fallback-1',
      league: 'nfl',
      awayTeam: 'KC',
      awayName: 'Chiefs',
      awayScore: '27',
      awayRecord: '9-1',
      awayColor: '#E31837',
      homeTeam: 'BUF',
      homeName: 'Bills',
      homeScore: '24',
      homeRecord: '8-2',
      homeColor: '#00338D',
      statusText: 'Q4 01:48',
      state: 'in',
      broadcast: 'CBS',
      headline: 'AFC Showcase · Red Zone Possession',
    },
    {
      id: 'nfl-fallback-2',
      league: 'nfl',
      awayTeam: 'SF',
      awayName: '49ers',
      awayScore: '21',
      awayRecord: '7-3',
      awayColor: '#AA0000',
      homeTeam: 'PHI',
      homeName: 'Eagles',
      homeScore: '20',
      homeRecord: '8-2',
      homeColor: '#004C54',
      statusText: 'Q3 06:12',
      state: 'in',
      broadcast: 'FOX',
      headline: 'NFC Heavyweight Tilt',
    },
    {
      id: 'nfl-fallback-3',
      league: 'nfl',
      awayTeam: 'BAL',
      awayName: 'Ravens',
      awayScore: '31',
      awayRecord: '7-3',
      awayColor: '#241773',
      homeTeam: 'CIN',
      homeName: 'Bengals',
      homeScore: '28',
      homeRecord: '6-4',
      homeColor: '#FB4F14',
      statusText: 'FINAL/OT',
      state: 'post',
      broadcast: 'NBC',
      headline: 'AFC North Overtime Thriller',
    },
    {
      id: 'nfl-fallback-4',
      league: 'nfl',
      awayTeam: 'DET',
      awayName: 'Lions',
      awayScore: '34',
      awayRecord: '8-1',
      awayColor: '#0076B6',
      homeTeam: 'GB',
      homeName: 'Packers',
      homeScore: '23',
      homeRecord: '6-3',
      homeColor: '#203731',
      statusText: 'FINAL',
      state: 'post',
      broadcast: 'ESPN',
      headline: 'Lambeau Field Division Clash',
    },
  ],
  nba: [
    {
      id: 'nba-fallback-1',
      league: 'nba',
      awayTeam: 'BOS',
      awayName: 'Celtics',
      awayScore: '114',
      awayRecord: '12-3',
      awayColor: '#007A33',
      homeTeam: 'NYK',
      homeName: 'Knicks',
      homeScore: '109',
      homeRecord: '9-5',
      homeColor: '#F58426',
      statusText: 'Q4 02:19',
      state: 'in',
      broadcast: 'TNT',
      headline: 'Atlantic Division Primetime',
    },
    {
      id: 'nba-fallback-2',
      league: 'nba',
      awayTeam: 'LAL',
      awayName: 'Lakers',
      awayScore: '102',
      awayRecord: '10-4',
      awayColor: '#552583',
      homeTeam: 'GSW',
      homeName: 'Warriors',
      homeScore: '105',
      homeRecord: '11-3',
      homeColor: '#1D428A',
      statusText: 'Q4 00:44',
      state: 'in',
      broadcast: 'ABC',
      headline: 'Pacific Rivalry Showdown',
    },
    {
      id: 'nba-fallback-3',
      league: 'nba',
      awayTeam: 'DEN',
      awayName: 'Nuggets',
      awayScore: '121',
      awayRecord: '9-5',
      awayColor: '#0E2240',
      homeTeam: 'OKC',
      homeName: 'Thunder',
      homeScore: '118',
      homeRecord: '11-4',
      homeColor: '#007AC1',
      statusText: 'FINAL',
      state: 'post',
      broadcast: 'ESPN',
      headline: 'Western Conference Top Seed Battle',
    },
    {
      id: 'nba-fallback-4',
      league: 'nba',
      awayTeam: 'DAL',
      awayName: 'Mavericks',
      awayScore: '110',
      awayRecord: '8-6',
      awayColor: '#00538C',
      homeTeam: 'PHX',
      homeName: 'Suns',
      homeScore: '107',
      homeRecord: '9-6',
      homeColor: '#E56020',
      statusText: 'FINAL',
      state: 'post',
      broadcast: 'NBA TV',
      headline: 'Late 4th Quarter Comeback',
    },
  ],
  mlb: [
    {
      id: 'mlb-fallback-1',
      league: 'mlb',
      awayTeam: 'LAD',
      awayName: 'Dodgers',
      awayScore: '6',
      awayRecord: '98-64',
      awayColor: '#005A9C',
      homeTeam: 'NYY',
      homeName: 'Yankees',
      homeScore: '4',
      homeRecord: '94-68',
      homeColor: '#0C2340',
      statusText: 'TOP 8TH',
      state: 'in',
      broadcast: 'FOX',
      headline: 'Fall Classic Replay · Bases Loaded',
    },
    {
      id: 'mlb-fallback-2',
      league: 'mlb',
      awayTeam: 'ATL',
      awayName: 'Braves',
      awayScore: '5',
      awayRecord: '89-73',
      awayColor: '#CE1141',
      homeTeam: 'PHI',
      homeName: 'Phillies',
      homeScore: '3',
      homeRecord: '95-67',
      homeColor: '#E81828',
      statusText: 'FINAL',
      state: 'post',
      broadcast: 'TBS',
      headline: 'NL East Rivalry Series',
    },
    {
      id: 'mlb-fallback-3',
      league: 'mlb',
      awayTeam: 'SD',
      awayName: 'Padres',
      awayScore: '4',
      awayRecord: '93-69',
      awayColor: '#2F241D',
      homeTeam: 'ARI',
      homeName: 'D-backs',
      homeScore: '2',
      homeRecord: '89-73',
      homeColor: '#A71930',
      statusText: 'FINAL',
      state: 'post',
      broadcast: 'ESPN',
      headline: 'NL West Late-Night Finale',
    },
    {
      id: 'mlb-fallback-4',
      league: 'mlb',
      awayTeam: 'HOU',
      awayName: 'Astros',
      awayScore: '7',
      awayRecord: '88-73',
      awayColor: '#EB6E1F',
      homeTeam: 'SEA',
      homeName: 'Mariners',
      homeScore: '5',
      homeRecord: '85-77',
      homeColor: '#005C5C',
      statusText: 'FINAL (10)',
      state: 'post',
      broadcast: 'FS1',
      headline: 'Extra-Inning Walk-Off',
    },
  ],
  nhl: [
    {
      id: 'nhl-fallback-1',
      league: 'nhl',
      awayTeam: 'EDM',
      awayName: 'Oilers',
      awayScore: '4',
      awayRecord: '11-6-1',
      awayColor: '#FF4C00',
      homeTeam: 'TOR',
      homeName: 'Maple Leafs',
      homeScore: '3',
      homeRecord: '11-6-2',
      homeColor: '#00205B',
      statusText: '3RD 04:12',
      state: 'in',
      broadcast: 'ESPN+',
      headline: 'Hockey Night Power Play',
    },
    {
      id: 'nhl-fallback-2',
      league: 'nhl',
      awayTeam: 'NYR',
      awayName: 'Rangers',
      awayScore: '3',
      awayRecord: '12-4-1',
      awayColor: '#0038A8',
      homeTeam: 'CAR',
      homeName: 'Hurricanes',
      homeScore: '2',
      homeRecord: '13-4-0',
      homeColor: '#CC0000',
      statusText: 'FINAL/SO',
      state: 'post',
      broadcast: 'TNT',
      headline: 'Metropolitan Division Showdown',
    },
    {
      id: 'nhl-fallback-3',
      league: 'nhl',
      awayTeam: 'COL',
      awayName: 'Avalanche',
      awayScore: '5',
      awayRecord: '10-8-0',
      awayColor: '#6F263D',
      homeTeam: 'VGK',
      homeName: 'Golden Knights',
      homeScore: '4',
      homeRecord: '11-5-2',
      homeColor: '#B4975A',
      statusText: 'FINAL',
      state: 'post',
      broadcast: 'ESPN',
      headline: 'Western Conference Thriller',
    },
    {
      id: 'nhl-fallback-4',
      league: 'nhl',
      awayTeam: 'FLA',
      awayName: 'Panthers',
      awayScore: '3',
      awayRecord: '12-5-1',
      awayColor: '#C8102E',
      homeTeam: 'BOS',
      homeName: 'Bruins',
      homeScore: '1',
      homeRecord: '9-8-2',
      homeColor: '#FFB81C',
      statusText: 'FINAL',
      state: 'post',
      broadcast: 'NHL Net',
      headline: 'Atlantic Division Matchup',
    },
  ],
  mls: [
    {
      id: 'mls-fallback-1',
      league: 'mls',
      awayTeam: 'MIA',
      awayName: 'Inter Miami',
      awayScore: '3',
      awayRecord: '22-4-8',
      awayColor: '#F7B5CD',
      homeTeam: 'LAFC',
      homeName: 'LAFC',
      homeScore: '2',
      homeRecord: '19-8-7',
      homeColor: '#C39E6D',
      statusText: "84' LIVE",
      state: 'in',
      broadcast: 'Apple TV',
      headline: 'Supporters Shield Showcase',
    },
    {
      id: 'mls-fallback-2',
      league: 'mls',
      awayTeam: 'LA',
      awayName: 'LA Galaxy',
      awayScore: '2',
      awayRecord: '19-8-7',
      awayColor: '#00245D',
      homeTeam: 'SEA',
      homeName: 'Sounders',
      homeScore: '1',
      homeRecord: '16-9-9',
      homeColor: '#5D9741',
      statusText: 'FT',
      state: 'post',
      broadcast: 'FOX',
      headline: 'Western Conference Semifinal',
    },
    {
      id: 'mls-fallback-3',
      league: 'mls',
      awayTeam: 'CLB',
      awayName: 'Crew',
      awayScore: '2',
      awayRecord: '19-6-9',
      awayColor: '#FED100',
      homeTeam: 'CIN',
      homeName: 'FC Cincinnati',
      homeScore: '2',
      homeRecord: '18-11-5',
      homeColor: '#F05323',
      statusText: 'FT (PKS)',
      state: 'post',
      broadcast: 'FS1',
      headline: 'Hell Is Real Derby Classic',
    },
    {
      id: 'mls-fallback-4',
      league: 'mls',
      awayTeam: 'NYRB',
      awayName: 'Red Bulls',
      awayScore: '1',
      awayRecord: '11-9-14',
      awayColor: '#ED1E36',
      homeTeam: 'NYC',
      homeName: 'NYCFC',
      homeScore: '0',
      homeRecord: '14-12-8',
      homeColor: '#6CACE4',
      statusText: 'FT',
      state: 'post',
      broadcast: 'Apple TV',
      headline: 'Hudson River Derby',
    },
  ],
  ncaaf: [
    {
      id: 'ncaaf-fallback-1',
      league: 'ncaaf',
      awayTeam: '#2 OSU',
      awayName: 'Ohio State',
      awayScore: '31',
      awayRecord: '9-1',
      awayColor: '#BB0000',
      homeTeam: '#1 ORE',
      homeName: 'Oregon',
      homeScore: '32',
      homeRecord: '10-0',
      homeColor: '#154733',
      statusText: 'Q4 00:52',
      state: 'in',
      broadcast: 'NBC',
      headline: 'Top-2 Big Ten Instant Classic',
    },
    {
      id: 'ncaaf-fallback-2',
      league: 'ncaaf',
      awayTeam: '#5 UGA',
      awayName: 'Georgia',
      awayScore: '28',
      awayRecord: '8-2',
      awayColor: '#BA0C2F',
      homeTeam: '#3 TEX',
      homeName: 'Texas',
      homeScore: '24',
      homeRecord: '9-1',
      homeColor: '#BF5700',
      statusText: 'FINAL',
      state: 'post',
      broadcast: 'ABC',
      headline: 'SEC Championship Preview',
    },
    {
      id: 'ncaaf-fallback-3',
      league: 'ncaaf',
      awayTeam: '#7 TENN',
      awayName: 'Tennessee',
      awayScore: '24',
      awayRecord: '8-2',
      awayColor: '#FF8200',
      homeTeam: '#8 ALA',
      homeName: 'Alabama',
      homeScore: '21',
      homeRecord: '8-2',
      homeColor: '#9E1B32',
      statusText: 'FINAL',
      state: 'post',
      broadcast: 'CBS',
      headline: 'Third Saturday in October',
    },
    {
      id: 'ncaaf-fallback-4',
      league: 'ncaaf',
      awayTeam: '#4 PSU',
      awayName: 'Penn State',
      awayScore: '35',
      awayRecord: '9-1',
      awayColor: '#041E42',
      homeTeam: '#12 MIA',
      homeName: 'Miami',
      homeScore: '27',
      homeRecord: '9-1',
      homeColor: '#F47321',
      statusText: 'FINAL',
      state: 'post',
      broadcast: 'ESPN',
      headline: 'CFP Top-12 Showdown',
    },
  ],
}

interface EspnCompetitor {
  id?: string
  homeAway?: 'home' | 'away'
  score?: string
  curatedRank?: { current?: number }
  team?: {
    abbreviation?: string
    shortDisplayName?: string
    displayName?: string
    color?: string
  }
  records?: Array<{ summary?: string }>
}

interface EspnCompetition {
  competitors?: EspnCompetitor[]
  broadcasts?: Array<{ names?: string[] }>
  headlines?: Array<{ shortLinkText?: string; description?: string }>
  status?: {
    type?: {
      state?: 'in' | 'post' | 'pre'
      shortDetail?: string
      detail?: string
    }
  }
}

interface EspnEvent {
  id?: string
  name?: string
  shortName?: string
  competitions?: EspnCompetition[]
  status?: {
    type?: {
      state?: 'in' | 'post' | 'pre'
      shortDetail?: string
      detail?: string
    }
  }
}

function normalizeHexColor(raw?: string, fallback = '#38BDF8'): string {
  if (!raw || typeof raw !== 'string') return fallback
  const clean = raw.replace(/^#/, '').trim()
  if (/^[0-9A-Fa-f]{6}$/.test(clean)) {
    return `#${clean}`
  }
  return fallback
}

function parseEspnEvents(
  league: SportsLeagueId,
  events: EspnEvent[],
): SportsGameMatchup[] {
  const matchups: SportsGameMatchup[] = []

  for (const ev of events.slice(0, 6)) {
    const comp = ev.competitions?.[0]
    if (!comp || !Array.isArray(comp.competitors) || comp.competitors.length < 2) {
      continue
    }

    const away =
      comp.competitors.find((c) => c.homeAway === 'away') ?? comp.competitors[1]
    const home =
      comp.competitors.find((c) => c.homeAway === 'home') ?? comp.competitors[0]

    const awayRank =
      away?.curatedRank?.current && away.curatedRank.current <= 25
        ? `#${away.curatedRank.current} `
        : ''
    const homeRank =
      home?.curatedRank?.current && home.curatedRank.current <= 25
        ? `#${home.curatedRank.current} `
        : ''

    const awayAbbr = `${awayRank}${away?.team?.abbreviation ?? 'AWY'}`.slice(0, 8)
    const homeAbbr = `${homeRank}${home?.team?.abbreviation ?? 'HME'}`.slice(0, 8)

    const statusObj = comp.status?.type ?? ev.status?.type
    const state: 'in' | 'post' | 'pre' =
      statusObj?.state === 'in' || statusObj?.state === 'post'
        ? statusObj.state
        : 'pre'

    const statusText = (
      statusObj?.shortDetail ??
      statusObj?.detail ??
      (state === 'in' ? 'LIVE' : state === 'post' ? 'FINAL' : 'SCHEDULED')
    ).slice(0, 22)

    const broadcast = comp.broadcasts?.[0]?.names?.[0] ?? 'ESPN'
    const headline =
      comp.headlines?.[0]?.shortLinkText ??
      ev.shortName ??
      `${awayAbbr} at ${homeAbbr}`

    matchups.push({
      id: ev.id ?? `${league}-${matchups.length}`,
      league,
      awayTeam: awayAbbr,
      awayName: (away?.team?.shortDisplayName ?? away?.team?.displayName ?? awayAbbr).slice(
        0,
        16,
      ),
      awayScore: String(away?.score ?? '0'),
      awayRecord: away?.records?.[0]?.summary ?? '',
      awayColor: normalizeHexColor(away?.team?.color, '#38BDF8'),
      homeTeam: homeAbbr,
      homeName: (home?.team?.shortDisplayName ?? home?.team?.displayName ?? homeAbbr).slice(
        0,
        16,
      ),
      homeScore: String(home?.score ?? '0'),
      homeRecord: home?.records?.[0]?.summary ?? '',
      homeColor: normalizeHexColor(home?.team?.color, '#F59E0B'),
      statusText,
      state,
      broadcast: broadcast.slice(0, 10),
      headline: headline.slice(0, 46),
    })
  }

  return matchups
}

export async function fetchSportsScoreboard(
  league: SportsLeagueId,
  forceRefresh = false,
): Promise<SportsScoreboardSnapshot> {
  const spec =
    SPORTS_LEAGUE_SPECS.find((s) => s.id === league) ?? SPORTS_LEAGUE_SPECS[0]
  const cached = scoreboardCache.get(spec.id)
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < SCOREBOARD_TTL_MS) {
    return cached
  }

  try {
    const controller = new AbortController()
    const timer = globalThis.setTimeout(() => controller.abort(), 6500)
    const response = await fetch(spec.espnEndpoint, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    globalThis.clearTimeout(timer)

    if (response.ok) {
      const json = (await response.json()) as { events?: EspnEvent[] }
      const parsed = Array.isArray(json.events)
        ? parseEspnEvents(spec.id, json.events)
        : []

      if (parsed.length > 0) {
        const snapshot: SportsScoreboardSnapshot = {
          league: spec.id,
          leagueLabel: spec.label,
          games: parsed,
          isLiveData: true,
          noActiveGamesMessage: null,
          fetchedAt: Date.now(),
        }
        scoreboardCache.set(spec.id, snapshot)
        return snapshot
      }

      // Endpoint succeeded but returned 0 scheduled games today
      const offDaySnapshot: SportsScoreboardSnapshot = {
        league: spec.id,
        leagueLabel: spec.label,
        games: FALLBACK_SLATES[spec.id],
        isLiveData: false,
        noActiveGamesMessage: `No active ${spec.shortLabel} games on today's ESPN schedule — displaying Featured League Slate.`,
        fetchedAt: Date.now(),
      }
      scoreboardCache.set(spec.id, offDaySnapshot)
      return offDaySnapshot
    }
  } catch {
    // Graceful fallback below
  }

  const fallbackSnapshot: SportsScoreboardSnapshot = {
    league: spec.id,
    leagueLabel: spec.label,
    games: FALLBACK_SLATES[spec.id],
    isLiveData: false,
    noActiveGamesMessage: `ESPN ${spec.shortLabel} live feed on standby — showing Featured Matchup Slate (auto-refreshes every 60s).`,
    fetchedAt: Date.now(),
  }
  scoreboardCache.set(spec.id, fallbackSnapshot)
  return fallbackSnapshot
}
