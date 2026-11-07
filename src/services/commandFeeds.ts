import type { CommandNewsCategoryId } from '../types/lounge'

export interface CommandWeatherCityPreset {
  id: string
  name: string
  shortLabel: string
  region: string
  latitude: number
  longitude: number
  fallbackTempF: number
  fallbackHumidity: number
  fallbackWindMph: number
  fallbackCode: number
}

export const COMMAND_WEATHER_CITIES: readonly CommandWeatherCityPreset[] = [
  {
    id: 'nyc',
    name: 'New York',
    shortLabel: 'NYC',
    region: 'NY · US East',
    latitude: 40.7128,
    longitude: -74.006,
    fallbackTempF: 64,
    fallbackHumidity: 58,
    fallbackWindMph: 11,
    fallbackCode: 1,
  },
  {
    id: 'sf',
    name: 'San Francisco',
    shortLabel: 'SF',
    region: 'CA · US West',
    latitude: 37.7749,
    longitude: -122.4194,
    fallbackTempF: 61,
    fallbackHumidity: 71,
    fallbackWindMph: 14,
    fallbackCode: 2,
  },
  {
    id: 'chi',
    name: 'Chicago',
    shortLabel: 'CHI',
    region: 'IL · Midwest',
    latitude: 41.8781,
    longitude: -87.6298,
    fallbackTempF: 57,
    fallbackHumidity: 62,
    fallbackWindMph: 16,
    fallbackCode: 2,
  },
  {
    id: 'mia',
    name: 'Miami',
    shortLabel: 'MIA',
    region: 'FL · Atlantic',
    latitude: 25.7617,
    longitude: -80.1918,
    fallbackTempF: 81,
    fallbackHumidity: 74,
    fallbackWindMph: 12,
    fallbackCode: 1,
  },
  {
    id: 'lon',
    name: 'London',
    shortLabel: 'LON',
    region: 'United Kingdom',
    latitude: 51.5072,
    longitude: -0.1276,
    fallbackTempF: 56,
    fallbackHumidity: 76,
    fallbackWindMph: 10,
    fallbackCode: 3,
  },
  {
    id: 'tyo',
    name: 'Tokyo',
    shortLabel: 'TYO',
    region: 'Japan · APAC',
    latitude: 35.6762,
    longitude: 139.6503,
    fallbackTempF: 66,
    fallbackHumidity: 54,
    fallbackWindMph: 8,
    fallbackCode: 0,
  },
] as const

export interface WeatherForecastDay {
  dayLabel: string
  highF: number
  lowF: number
  precipProb: number
  icon: string
}

export interface CommandWeatherReport {
  cityId: string
  cityName: string
  region: string
  tempF: number
  tempC: number
  feelsLikeF: number
  humidity: number
  windMph: number
  gustMph: number
  pressureHpa: number
  conditionLabel: string
  conditionIcon: string
  forecast: WeatherForecastDay[]
  source: 'open-meteo-live' | 'telemetry-fallback'
  updatedAt: number
}

export interface CommandNewsItem {
  id: string
  title: string
  source: string
  publishedAgo: string
  url: string
  badge?: string
  badgeColor?: string
}

export interface CommandNewsFeedResult {
  category: CommandNewsCategoryId
  providerLabel: string
  items: CommandNewsItem[]
  isLive: boolean
  updatedAt: number
}

export interface WorldClockEntry {
  code: string
  city: string
  time: string
}

const WEATHER_CACHE_TTL_MS = 120_000
const NEWS_CACHE_TTL_MS = 90_000

const weatherCache = new Map<string, CommandWeatherReport>()
const newsCache = new Map<CommandNewsCategoryId, CommandNewsFeedResult>()

export function describeWmoWeatherCode(code: number): {
  icon: string
  label: string
} {
  if (code === 0) return { icon: '☀️', label: 'Clear Sky' }
  if (code === 1) return { icon: '🌤', label: 'Mostly Clear' }
  if (code === 2) return { icon: '⛅', label: 'Partly Cloudy' }
  if (code === 3) return { icon: '☁️', label: 'Overcast' }
  if (code === 45 || code === 48) return { icon: '🌫', label: 'Coastal Fog' }
  if (code >= 51 && code <= 57) return { icon: '🌦', label: 'Light Drizzle' }
  if (code >= 61 && code <= 67) return { icon: '🌧', label: 'Rain Showers' }
  if (code >= 71 && code <= 77) return { icon: '❄️', label: 'Snowfall' }
  if (code >= 80 && code <= 82) return { icon: '🌧', label: 'Passing Showers' }
  if (code >= 85 && code <= 86) return { icon: '🌨', label: 'Snow Squalls' }
  if (code >= 95) return { icon: '⛈', label: 'Thunderstorm' }
  return { icon: '🌤', label: 'Fair Conditions' }
}

function fToC(f: number): number {
  return Math.round(((f - 32) * 5) / 9)
}

function shortWeekdayLabel(dateStr: string, index: number): string {
  if (index === 0) return 'TODAY'
  try {
    const dt = new Date(`${dateStr}T12:00:00`)
    return dt
      .toLocaleDateString('en-US', { weekday: 'short' })
      .toUpperCase()
      .slice(0, 3)
  } catch {
    return `D+${index}`
  }
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 4500): Promise<T> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return (await res.json()) as T
  } finally {
    globalThis.clearTimeout(timer)
  }
}

function buildFallbackWeather(
  preset: CommandWeatherCityPreset,
  customLabel?: string,
): CommandWeatherReport {
  const cond = describeWmoWeatherCode(preset.fallbackCode)
  const base = preset.fallbackTempF
  return {
    cityId: customLabel ? 'custom' : preset.id,
    cityName: customLabel || preset.name,
    region: customLabel ? 'Custom Sector' : preset.region,
    tempF: base,
    tempC: fToC(base),
    feelsLikeF: base - 1,
    humidity: preset.fallbackHumidity,
    windMph: preset.fallbackWindMph,
    gustMph: preset.fallbackWindMph + 6,
    pressureHpa: 1016,
    conditionLabel: cond.label,
    conditionIcon: cond.icon,
    forecast: [
      { dayLabel: 'TODAY', highF: base + 3, lowF: base - 9, precipProb: 10, icon: cond.icon },
      { dayLabel: 'TOM', highF: base + 5, lowF: base - 8, precipProb: 15, icon: '⛅' },
      { dayLabel: 'DAY 3', highF: base + 1, lowF: base - 10, precipProb: 25, icon: '🌤' },
      { dayLabel: 'DAY 4', highF: base + 4, lowF: base - 7, precipProb: 10, icon: '☀️' },
    ],
    source: 'telemetry-fallback',
    updatedAt: Date.now(),
  }
}

export async function fetchCommandWeather(
  cityId: string,
  customCityQuery = '',
  forceRefresh = false,
): Promise<CommandWeatherReport> {
  const trimmedCustom = customCityQuery.trim()
  const cacheKey =
    cityId === 'custom' && trimmedCustom
      ? `custom:${trimmedCustom.toLowerCase()}`
      : cityId

  if (!forceRefresh) {
    const hit = weatherCache.get(cacheKey)
    if (hit && Date.now() - hit.updatedAt < WEATHER_CACHE_TTL_MS) {
      return hit
    }
  }

  let targetLat = COMMAND_WEATHER_CITIES[0].latitude
  let targetLon = COMMAND_WEATHER_CITIES[0].longitude
  let targetName = COMMAND_WEATHER_CITIES[0].name
  let targetRegion = COMMAND_WEATHER_CITIES[0].region
  const matchedPreset =
    COMMAND_WEATHER_CITIES.find((c) => c.id === cityId) ?? COMMAND_WEATHER_CITIES[0]

  if (cityId === 'custom' && trimmedCustom) {
    try {
      const geo = await fetchJsonWithTimeout<{
        results?: Array<{
          name: string
          admin1?: string
          country_code?: string
          latitude: number
          longitude: number
        }>
      }>(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          trimmedCustom,
        )}&count=1&language=en&format=json`,
      )
      const top = geo.results?.[0]
      if (top) {
        targetLat = top.latitude
        targetLon = top.longitude
        targetName = top.name
        targetRegion = [top.admin1, top.country_code].filter(Boolean).join(' · ') || 'Global'
      } else {
        targetName = trimmedCustom
        targetRegion = 'Station Lookup'
      }
    } catch {
      const fb = buildFallbackWeather(matchedPreset, trimmedCustom)
      weatherCache.set(cacheKey, fb)
      return fb
    }
  } else {
    targetLat = matchedPreset.latitude
    targetLon = matchedPreset.longitude
    targetName = matchedPreset.name
    targetRegion = matchedPreset.region
  }

  try {
    interface OpenMeteoResponse {
      current?: {
        temperature_2m?: number
        apparent_temperature?: number
        relative_humidity_2m?: number
        weather_code?: number
        wind_speed_10m?: number
        wind_gusts_10m?: number
        surface_pressure?: number
      }
      daily?: {
        time?: string[]
        weather_code?: number[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
        precipitation_probability_max?: number[]
      }
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,surface_pressure` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=4`

    const data = await fetchJsonWithTimeout<OpenMeteoResponse>(url)
    const cur = data.current
    if (!cur || typeof cur.temperature_2m !== 'number') {
      throw new Error('Missing current telemetry')
    }

    const tempF = Math.round(cur.temperature_2m)
    const cond = describeWmoWeatherCode(cur.weather_code ?? 0)
    const days = data.daily?.time ?? []
    const forecast: WeatherForecastDay[] = days.slice(0, 4).map((dStr, idx) => {
      const dCond = describeWmoWeatherCode(data.daily?.weather_code?.[idx] ?? 1)
      return {
        dayLabel: shortWeekdayLabel(dStr, idx),
        highF: Math.round(data.daily?.temperature_2m_max?.[idx] ?? tempF + 3),
        lowF: Math.round(data.daily?.temperature_2m_min?.[idx] ?? tempF - 8),
        precipProb: Math.round(data.daily?.precipitation_probability_max?.[idx] ?? 0),
        icon: dCond.icon,
      }
    })

    const report: CommandWeatherReport = {
      cityId: cityId === 'custom' && trimmedCustom ? 'custom' : matchedPreset.id,
      cityName: targetName,
      region: targetRegion,
      tempF,
      tempC: fToC(tempF),
      feelsLikeF: Math.round(cur.apparent_temperature ?? tempF),
      humidity: Math.round(cur.relative_humidity_2m ?? 55),
      windMph: Math.round(cur.wind_speed_10m ?? 8),
      gustMph: Math.round(cur.wind_gusts_10m ?? (cur.wind_speed_10m ?? 8) + 5),
      pressureHpa: Math.round(cur.surface_pressure ?? 1015),
      conditionLabel: cond.label,
      conditionIcon: cond.icon,
      forecast:
        forecast.length > 0
          ? forecast
          : buildFallbackWeather(matchedPreset, targetName).forecast,
      source: 'open-meteo-live',
      updatedAt: Date.now(),
    }
    weatherCache.set(cacheKey, report)
    return report
  } catch {
    const fb = buildFallbackWeather(
      matchedPreset,
      cityId === 'custom' && trimmedCustom ? trimmedCustom : undefined,
    )
    weatherCache.set(cacheKey, fb)
    return fb
  }
}

function formatRelativeMinutes(isoOrEpoch: string | number): string {
  const ts =
    typeof isoOrEpoch === 'number' ? isoOrEpoch * 1000 : Date.parse(isoOrEpoch)
  if (!Number.isFinite(ts)) return 'LIVE'
  const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60_000))
  if (diffMin < 60) return `${diffMin}m ago`
  const hrs = Math.round(diffMin / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

const FALLBACK_NEWS: Record<CommandNewsCategoryId, CommandNewsItem[]> = {
  top: [
    {
      id: 'fb-top-1',
      title: 'Global Aviation & High-Speed Rail Corridors Report Record Seasonal Demand',
      source: 'Global Wire',
      publishedAgo: '14m ago',
      url: 'https://en.wikipedia.org/wiki/Portal:Current_events',
      badge: 'WORLD',
      badgeColor: '#38BDF8',
    },
    {
      id: 'fb-top-2',
      title: 'Next-Gen Spatial Computing Headsets Drive Surge in Social Watch-Parties',
      source: 'Tech Dispatch',
      publishedAgo: '32m ago',
      url: 'https://news.ycombinator.com',
      badge: 'TRENDING',
      badgeColor: '#E5A93C',
    },
    {
      id: 'fb-top-3',
      title: 'International Clean Grid Interconnect Reaches New Peak Renewable Share',
      source: 'Energy Brief',
      publishedAgo: '1h ago',
      url: 'https://en.wikipedia.org/wiki/Portal:Current_events',
      badge: 'ENERGY',
      badgeColor: '#34D399',
    },
    {
      id: 'fb-top-4',
      title: 'Major Sports Leagues Expand Ultra-Low-Latency 60fps Multiview Broadcasts',
      source: 'Media Desk',
      publishedAgo: '2h ago',
      url: 'https://tv.youtube.com',
      badge: 'MEDIA',
      badgeColor: '#F87171',
    },
    {
      id: 'fb-top-5',
      title: 'Alpine Weather Stations Forecast Crisp Clear Skies Across High-Elevation Lakes',
      source: 'Meteo Desk',
      publishedAgo: '3h ago',
      url: 'https://open-meteo.com',
      badge: 'WEATHER',
      badgeColor: '#60A5FA',
    },
  ],
  tech: [
    {
      id: 'fb-tech-1',
      title: 'WebXR & WebGPU Browser Engines Achieve Desktop-Class Frame Pacing on Standalone Headsets',
      source: 'Hacker News',
      publishedAgo: '18m ago',
      url: 'https://news.ycombinator.com',
      badge: 'WEBXR',
      badgeColor: '#38BDF8',
    },
    {
      id: 'fb-tech-2',
      title: 'Open-Source Low-Latency WebRTC Mesh Routing Cuts Multi-Peer Voice Jitter by 40%',
      source: 'Systems Weekly',
      publishedAgo: '45m ago',
      url: 'https://news.ycombinator.com',
      badge: 'NET',
      badgeColor: '#34D399',
    },
    {
      id: 'fb-tech-3',
      title: 'Compiler Advances in Rust & TypeScript Toolchains Push Bundler Builds Under 1 Second',
      source: 'Dev Wire',
      publishedAgo: '1h ago',
      url: 'https://news.ycombinator.com',
      badge: 'DEV',
      badgeColor: '#E5A93C',
    },
    {
      id: 'fb-tech-4',
      title: 'On-Device Multimodal Models Bring Real-Time Voice & Captioning to Browser Apps',
      source: 'AI Frontier',
      publishedAgo: '2h ago',
      url: 'https://news.ycombinator.com',
      badge: 'AI',
      badgeColor: '#C084FC',
    },
    {
      id: 'fb-tech-5',
      title: 'Three.js & React Three Fiber Ecosystem Highlights Procedural Architecture Workflows',
      source: 'Graphics Lab',
      publishedAgo: '3h ago',
      url: 'https://threejs.org',
      badge: '3D',
      badgeColor: '#F472B6',
    },
  ],
  space: [
    {
      id: 'fb-space-1',
      title: 'Orbital Observatory Captures High-Resolution Infrared Mosaic of Deep-Field Galaxies',
      source: 'Spaceflight Wire',
      publishedAgo: '22m ago',
      url: 'https://spaceflightnow.com',
      badge: 'ORBIT',
      badgeColor: '#38BDF8',
    },
    {
      id: 'fb-space-2',
      title: 'Lunar South Pole Relay Architecture Completes High-Bandwidth Optical Link Test',
      source: 'Deep Space Net',
      publishedAgo: '55m ago',
      url: 'https://www.nasa.gov',
      badge: 'LUNAR',
      badgeColor: '#E5A93C',
    },
    {
      id: 'fb-space-3',
      title: 'Reusable Heavy-Lift Booster Fleet Sets Rapid Turnaround Cadence Milestone',
      source: 'Launch Pad',
      publishedAgo: '2h ago',
      url: 'https://spaceflightnow.com',
      badge: 'LAUNCH',
      badgeColor: '#34D399',
    },
    {
      id: 'fb-space-4',
      title: 'Geomagnetic Solar Watch: High-Latitude Aurora Visibility Elevated Tonight',
      source: 'NOAA Space Wx',
      publishedAgo: '3h ago',
      url: 'https://www.swpc.noaa.gov',
      badge: 'AURORA',
      badgeColor: '#A78BFA',
    },
    {
      id: 'fb-space-5',
      title: 'Commercial Station Module Passes Full-Scale Habitation & Life-Support Pressure Test',
      source: 'Aero Journal',
      publishedAgo: '4h ago',
      url: 'https://www.nasa.gov',
      badge: 'LEO',
      badgeColor: '#60A5FA',
    },
  ],
  markets: [
    {
      id: 'fb-mkt-1',
      title: 'BTC / USD · Spot Digital Reserve Holding Steady on Strong Institutional Volume',
      source: 'Spot Desk',
      publishedAgo: 'LIVE',
      url: 'https://www.coingecko.com',
      badge: '+1.8%',
      badgeColor: '#34D399',
    },
    {
      id: 'fb-mkt-2',
      title: 'ETH / USD · Layer-2 Settlement Throughput Hits New Daily Transaction Record',
      source: 'Spot Desk',
      publishedAgo: 'LIVE',
      url: 'https://www.coingecko.com',
      badge: '+2.4%',
      badgeColor: '#34D399',
    },
    {
      id: 'fb-mkt-3',
      title: 'SOL / USD · High-Frequency Decentralized Exchange Volume Leads 24h Activity',
      source: 'Spot Desk',
      publishedAgo: 'LIVE',
      url: 'https://www.coingecko.com',
      badge: '+3.1%',
      badgeColor: '#34D399',
    },
    {
      id: 'fb-mkt-4',
      title: 'PAXG / GOLD · Precious Metals Benchmark Tracks Global Central Bank Demand',
      source: 'Commodities',
      publishedAgo: 'LIVE',
      url: 'https://www.coingecko.com',
      badge: '+0.4%',
      badgeColor: '#E5A93C',
    },
    {
      id: 'fb-mkt-5',
      title: 'SEMI & CLOUD INDEX · AI Infrastructure & Spatial Compute Equities Lead Tech Sector',
      source: 'Market Pulse',
      publishedAgo: '15m ago',
      url: 'https://finance.yahoo.com',
      badge: 'TECH',
      badgeColor: '#38BDF8',
    },
  ],
}

export async function fetchCommandNewsFeed(
  category: CommandNewsCategoryId,
  forceRefresh = false,
): Promise<CommandNewsFeedResult> {
  if (!forceRefresh) {
    const cached = newsCache.get(category)
    if (cached && Date.now() - cached.updatedAt < NEWS_CACHE_TTL_MS) {
      return cached
    }
  }

  try {
    if (category === 'top') {
      // Wikimedia REST v1 Featured Feed (news + mostread) — wildcard CORS, zero key!
      const now = new Date()
      const yyyy = now.getUTCFullYear()
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(now.getUTCDate()).padStart(2, '0')
      const wiki = await fetchJsonWithTimeout<{
        news?: Array<{
          story?: string
          links?: Array<{
            titles?: { normalized?: string }
            content_urls?: { desktop?: { page?: string } }
          }>
        }>
        mostread?: {
          articles?: Array<{
            titles?: { normalized?: string }
            description?: string
            views?: number
            content_urls?: { desktop?: { page?: string } }
          }>
        }
      }>(`https://en.wikipedia.org/api/rest_v1/feed/featured/${yyyy}/${mm}/${dd}`)

      const items: CommandNewsItem[] = []
      for (const [idx, entry] of (wiki.news ?? []).slice(0, 4).entries()) {
        const cleanStory = stripHtmlTags(entry.story ?? '')
        if (!cleanStory) continue
        const primaryLink =
          entry.links?.[0]?.content_urls?.desktop?.page ??
          'https://en.wikipedia.org/wiki/Portal:Current_events'
        items.push({
          id: `wiki-news-${idx}`,
          title: cleanStory.slice(0, 145),
          source: 'World Wire',
          publishedAgo: 'LIVE',
          url: primaryLink,
          badge: 'BREAKING',
          badgeColor: '#F87171',
        })
      }

      for (const [idx, art] of (wiki.mostread?.articles ?? []).slice(0, 5).entries()) {
        if (items.length >= 6) break
        const title = art.titles?.normalized
        if (!title || title === 'Main Page' || title.startsWith('Special:')) continue
        const desc = art.description ? ` — ${art.description}` : ''
        items.push({
          id: `wiki-most-${idx}`,
          title: `${title}${desc}`.slice(0, 140),
          source: 'Global Pulse',
          publishedAgo: art.views ? `${Math.round(art.views / 1000)}K reads` : 'TRENDING',
          url:
            art.content_urls?.desktop?.page ??
            `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
          badge: 'TRENDING',
          badgeColor: '#38BDF8',
        })
      }

      if (items.length >= 3) {
        const result: CommandNewsFeedResult = {
          category,
          providerLabel: 'Wikimedia Global Wire (Live)',
          items,
          isLive: true,
          updatedAt: Date.now(),
        }
        newsCache.set(category, result)
        return result
      }
    }

    if (category === 'tech') {
      const hn = await fetchJsonWithTimeout<{
        hits?: Array<{
          objectID: string
          title?: string
          url?: string
          points?: number
          author?: string
          created_at_i?: number
        }>
      }>('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=7')

      const items: CommandNewsItem[] = (hn.hits ?? [])
        .filter((h) => Boolean(h.title))
        .slice(0, 6)
        .map((h) => ({
          id: `hn-${h.objectID}`,
          title: (h.title ?? '').trim().slice(0, 140),
          source: h.url ? new URL(h.url).hostname.replace(/^www\./, '') : 'news.ycombinator.com',
          publishedAgo: formatRelativeMinutes(h.created_at_i ?? Date.now() / 1000),
          url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
          badge: `${h.points ?? 100}▲`,
          badgeColor: '#E5A93C',
        }))

      if (items.length >= 3) {
        const result: CommandNewsFeedResult = {
          category,
          providerLabel: 'Hacker News Frontpage (Live)',
          items,
          isLive: true,
          updatedAt: Date.now(),
        }
        newsCache.set(category, result)
        return result
      }
    }

    if (category === 'space') {
      const sfn = await fetchJsonWithTimeout<{
        results?: Array<{
          id: number
          title: string
          url: string
          news_site: string
          published_at: string
        }>
      }>('https://api.spaceflightnewsapi.net/v4/articles/?limit=6')

      const items: CommandNewsItem[] = (sfn.results ?? []).slice(0, 6).map((a) => ({
        id: `sfn-${a.id}`,
        title: a.title.trim().slice(0, 140),
        source: a.news_site || 'Spaceflight News',
        publishedAgo: formatRelativeMinutes(a.published_at),
        url: a.url,
        badge: 'SPACE',
        badgeColor: '#38BDF8',
      }))

      if (items.length >= 3) {
        const result: CommandNewsFeedResult = {
          category,
          providerLabel: 'Spaceflight News v4 (Live)',
          items,
          isLive: true,
          updatedAt: Date.now(),
        }
        newsCache.set(category, result)
        return result
      }
    }

    if (category === 'markets') {
      const cg = await fetchJsonWithTimeout<
        Record<
          string,
          {
            usd?: number
            usd_24h_change?: number
          }
        >
      >(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,pax-gold,avalanche-2,chainlink&vs_currencies=usd&include_24hr_change=true',
      )

      const assets: Array<{ id: string; sym: string; name: string }> = [
        { id: 'bitcoin', sym: 'BTC', name: 'Bitcoin Spot' },
        { id: 'ethereum', sym: 'ETH', name: 'Ethereum Network' },
        { id: 'solana', sym: 'SOL', name: 'Solana High-Throughput' },
        { id: 'pax-gold', sym: 'GOLD', name: 'Gold Troy Oz (PAXG)' },
        { id: 'chainlink', sym: 'LINK', name: 'Chainlink Oracle Net' },
        { id: 'avalanche-2', sym: 'AVAX', name: 'Avalanche Subnets' },
      ]

      const items: CommandNewsItem[] = []
      for (const asset of assets) {
        const row = cg[asset.id]
        if (!row || typeof row.usd !== 'number') continue
        const priceStr =
          row.usd >= 100
            ? `$${row.usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
            : `$${row.usd.toFixed(2)}`
        const chg = row.usd_24h_change ?? 0
        const sign = chg >= 0 ? '+' : ''
        items.push({
          id: `cg-${asset.id}`,
          title: `${asset.sym} / USD  ·  ${priceStr}  —  ${asset.name}`,
          source: 'Live Spot Feed',
          publishedAgo: '24H',
          url: `https://www.coingecko.com/en/coins/${asset.id}`,
          badge: `${sign}${chg.toFixed(2)}%`,
          badgeColor: chg >= 0 ? '#34D399' : '#F87171',
        })
      }

      if (items.length >= 3) {
        const result: CommandNewsFeedResult = {
          category,
          providerLabel: 'Global Spot Tickers (Live)',
          items,
          isLive: true,
          updatedAt: Date.now(),
        }
        newsCache.set(category, result)
        return result
      }
    }
  } catch {
    // Graceful fallback to curated resilient telemetry below
  }

  const fallback: CommandNewsFeedResult = {
    category,
    providerLabel: 'Command Relay Cache',
    items: FALLBACK_NEWS[category],
    isLive: false,
    updatedAt: Date.now(),
  }
  newsCache.set(category, fallback)
  return fallback
}

export function getCommandWorldClocks(now = new Date()): WorldClockEntry[] {
  const zones: Array<{ code: string; city: string; tz: string }> = [
    { code: 'UTC', city: 'ZULU', tz: 'UTC' },
    { code: 'NYC', city: 'EST/EDT', tz: 'America/New_York' },
    { code: 'LAX', city: 'PST/PDT', tz: 'America/Los_Angeles' },
    { code: 'LON', city: 'UK', tz: 'Europe/London' },
    { code: 'TYO', city: 'JST', tz: 'Asia/Tokyo' },
  ]
  return zones.map((z) => {
    try {
      const time = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: z.tz,
      }).format(now)
      return { code: z.code, city: z.city, time }
    } catch {
      return { code: z.code, city: z.city, time: now.toISOString().slice(11, 19) }
    }
  })
}
