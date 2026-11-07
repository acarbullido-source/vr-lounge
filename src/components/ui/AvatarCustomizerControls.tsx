import { Check, Shuffle } from 'lucide-react'
import { useState } from 'react'
import {
  AVATAR_ACCESSORIES,
  AVATAR_BODY_COLORS,
  AVATAR_COLORS,
  AVATAR_FACES,
  AVATAR_FLAIR_BADGES,
  AVATAR_HATS,
  AVATAR_OUTFITS,
  AVATAR_PRESETS,
  AVATAR_STYLES,
  createRandomAvatarLook,
  resolveAvatarCustomization,
} from '../../constants/avatars'
import type { AvatarCustomization, AvatarStyleId } from '../../types/lounge'

export interface AvatarPortraitSvgProps {
  avatarColor: string
  avatarStyle: AvatarStyleId
  customization: AvatarCustomization
  size?: number
}

export function AvatarPortraitSvg({
  avatarColor,
  avatarStyle,
  customization,
  size = 92,
}: AvatarPortraitSvgProps) {
  const { bodyColor, faceStyle, hat, outfit, accessory } = customization

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className="shrink-0 overflow-visible"
      aria-label="Avatar Live Preview"
    >
      {/* Subtle ambient glow ring */}
      <circle
        cx="60"
        cy="64"
        r="48"
        fill={avatarColor}
        fillOpacity="0.1"
        stroke={accessory === 'vip-halo' ? avatarColor : 'rgba(255,255,255,0.08)'}
        strokeWidth={accessory === 'vip-halo' ? '2.5' : '1'}
      />

      {/* Shoulder Drone companion */}
      {accessory === 'shoulder-drone' && (
        <g transform="translate(95, 58)">
          <circle cx="0" cy="0" r="8" fill={bodyColor} stroke={avatarColor} strokeWidth="1.5" />
          <circle cx="-1" cy="0" r="3" fill={avatarColor} />
          <ellipse cx="0" cy="0" rx="12" ry="3.2" fill="none" stroke={avatarColor} strokeWidth="1.2" />
        </g>
      )}

      {/* Orbiting satellites */}
      {accessory === 'orbit-rings' && (
        <g>
          <polygon points="20,66 24,61 28,66 24,71" fill={avatarColor} />
          <polygon points="94,74 97,70 100,74 97,78" fill="#F8FAFC" />
        </g>
      )}

      {/* Torso / Outfit */}
      <g transform="translate(60, 92)">
        <rect
          x="-28"
          y="-16"
          width="56"
          height="32"
          rx="14"
          fill={bodyColor}
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1.2"
        />
        {outfit === 'varsity' && (
          <>
            <rect x="-28" y="-13" width="11" height="26" rx="5" fill="#F1F5F9" />
            <rect x="17" y="-13" width="11" height="26" rx="5" fill="#F1F5F9" />
            <rect x="-15" y="-6" width="9" height="9" rx="2" fill={avatarColor} />
          </>
        )}
        {outfit === 'hoodie' && (
          <>
            <line x1="-6" y1="-12" x2="-6" y2="2" stroke={avatarColor} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="6" y1="-12" x2="6" y2="2" stroke={avatarColor} strokeWidth="2.4" strokeLinecap="round" />
          </>
        )}
        {outfit === 'cyber-vest' && (
          <>
            <polygon points="-22,-16 -13,-24 -10,-15" fill={avatarColor} />
            <polygon points="22,-16 13,-24 10,-15" fill={avatarColor} />
            <circle cx="0" cy="-2" r="6.5" fill={avatarColor} />
            <circle cx="0" cy="-2" r="3" fill="#F8FAFC" />
          </>
        )}
        {outfit === 'tuxedo' && (
          <>
            <polygon points="-11,-15 11,-15 0,6" fill="#F8FAFC" />
            <polygon points="-8,-12 0,-9 -8,-6" fill={avatarColor} />
            <polygon points="8,-12 0,-9 8,-6" fill={avatarColor} />
          </>
        )}
        {outfit === 'astronaut' && (
          <>
            <rect x="-14" y="-9" width="28" height="17" rx="4" fill="#E2E8F0" />
            <circle cx="-6" cy="-1" r="2.8" fill="#EF4444" />
            <circle cx="6" cy="-1" r="2.8" fill={avatarColor} />
          </>
        )}
        {outfit === 'cloak' && (
          <>
            <path d="M-28,-10 Q0,-22 28,-10 L24,2 Q0,-6 -24,2 Z" fill={avatarColor} fillOpacity="0.88" />
            <polygon points="0,-14 5,-9 0,-4 -5,-9" fill="#FBBF24" />
          </>
        )}
        {accessory === 'bowtie' && (
          <g transform="translate(0, -14)">
            <polygon points="-9,-4 0,0 -9,4" fill={avatarColor} />
            <polygon points="9,-4 0,0 9,4" fill={avatarColor} />
            <circle cx="0" cy="0" r="2.2" fill="#F8FAFC" />
          </g>
        )}
      </g>

      {/* Head Silhouette */}
      <g transform="translate(60, 52)">
        {/* Cat ears behind head */}
        {avatarStyle === 'cat-ears' && (
          <>
            <polygon points="-22,-14 -14,-31 -5,-16" fill={bodyColor} stroke="rgba(255,255,255,0.2)" />
            <polygon points="-19,-16 -14,-26 -8,-17" fill={avatarColor} />
            <polygon points="22,-14 14,-31 5,-16" fill={bodyColor} stroke="rgba(255,255,255,0.2)" />
            <polygon points="19,-16 14,-26 8,-17" fill={avatarColor} />
          </>
        )}

        {/* Studio headphone cans */}
        {avatarStyle === 'visor-studio' && (
          <>
            <rect x="-29" y="-8" width="7" height="18" rx="3.5" fill={avatarColor} />
            <rect x="22" y="-8" width="7" height="18" rx="3.5" fill={avatarColor} />
          </>
        )}

        {/* Sleek side fins */}
        {avatarStyle === 'visor-sleek' && (
          <>
            <polygon points="-24,-2 -32,-9 -24,6" fill={avatarColor} />
            <polygon points="24,-2 32,-9 24,6" fill={avatarColor} />
          </>
        )}

        {/* Head shell */}
        {avatarStyle === 'astro-dome' ? (
          <>
            <circle cx="0" cy="0" r="24" fill={bodyColor} fillOpacity="0.55" stroke={avatarColor} strokeWidth="2" />
            <circle cx="0" cy="1" r="18" fill="#070A10" />
          </>
        ) : avatarStyle === 'bot-retro' ? (
          <>
            <rect x="-25" y="-20" width="50" height="40" rx="8" fill={bodyColor} stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" />
            <rect x="-20" y="-14" width="40" height="28" rx="5" fill="#070B12" stroke={avatarColor} strokeWidth="2" />
            {hat === 'none' && (
              <>
                <line x1="8" y1="-20" x2="12" y2="-30" stroke="#94A3B8" strokeWidth="2" />
                <circle cx="12" cy="-32" r="3.5" fill={avatarColor} />
              </>
            )}
          </>
        ) : (
          <>
            <rect
              x="-23"
              y="-19"
              width="46"
              height="38"
              rx={avatarStyle === 'knight-helm' ? '10' : '15'}
              fill={bodyColor}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.2"
            />
            <rect x="-20" y="-10" width="40" height="20" rx="7" fill="#07090D" />
            <rect x="-15" y="-12" width="30" height="2.6" rx="1.3" fill={avatarColor} />
            {avatarStyle === 'knight-helm' && (
              <>
                <rect x="-3" y="-25" width="6" height="9" rx="2" fill={avatarColor} />
                <rect x="-2" y="4" width="4" height="11" rx="1.5" fill={avatarColor} />
              </>
            )}
            {avatarStyle === 'visor-halo' && (
              <ellipse cx="0" cy="-21" rx="23" ry="4.5" fill="none" stroke={avatarColor} strokeWidth="2.6" />
            )}
          </>
        )}

        {/* Face Expression */}
        {faceStyle === 'visor-led' && (
          <>
            <rect x="-11" y="-5" width="5" height="8" rx="2.5" fill={avatarColor} />
            <rect x="6" y="-5" width="5" height="8" rx="2.5" fill={avatarColor} />
          </>
        )}
        {faceStyle === 'happy-pixel' && (
          <>
            <path d="M-13,0 L-8,-5 L-3,0" fill="none" stroke={avatarColor} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3,0 L8,-5 L13,0" fill="none" stroke={avatarColor} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {faceStyle === 'cool-shades' && (
          <>
            <rect x="-16" y="-6" width="14" height="9" rx="2" fill="#05070B" stroke={avatarColor} strokeWidth="1.8" />
            <rect x="2" y="-6" width="14" height="9" rx="2" fill="#05070B" stroke={avatarColor} strokeWidth="1.8" />
            <line x1="-2" y1="-2" x2="2" y2="-2" stroke={avatarColor} strokeWidth="1.8" />
          </>
        )}
        {faceStyle === 'starry' && (
          <>
            <polygon points="-9,-7 -6,-1 -9,5 -12,-1" fill={avatarColor} />
            <polygon points="9,-7 12,-1 9,5 6,-1" fill={avatarColor} />
          </>
        )}
        {faceStyle === 'cyber-scan' && (
          <>
            <line x1="-15" y1="-1" x2="15" y2="-1" stroke={avatarColor} strokeOpacity="0.4" strokeWidth="2" />
            <rect x="-4" y="-3" width="8" height="4" rx="2" fill={avatarColor} />
          </>
        )}
        {faceStyle === 'wink' && (
          <>
            <path d="M-13,0 L-8,-5 L-3,0" fill="none" stroke={avatarColor} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="4" y1="-1" x2="13" y2="-1" stroke={avatarColor} strokeWidth="2.4" strokeLinecap="round" />
          </>
        )}

        {/* Hat / Headwear */}
        {hat === 'beanie' && (
          <g transform="translate(0, -21)">
            <path d="M-21,3 Q0,-18 21,3 Z" fill={bodyColor} />
            <rect x="-22" y="-1" width="44" height="6" rx="3" fill={avatarColor} />
            <circle cx="0" cy="-12" r="4" fill={accentFallback(avatarColor)} />
          </g>
        )}
        {hat === 'baseball-cap' && (
          <g transform="translate(0, -20)">
            <path d="M-21,2 Q0,-15 21,2 Z" fill={avatarColor} />
            <rect x="-16" y="0" width="36" height="4.5" rx="2" fill="#0F172A" />
          </g>
        )}
        {hat === 'crown' && (
          <g transform="translate(0, -21)">
            <polygon points="-17,3 -17,-10 -8,-2 0,-13 8,-2 17,-10 17,3" fill="#FBBF24" />
            <circle cx="0" cy="-2" r="2.6" fill={avatarColor} />
          </g>
        )}
        {hat === 'cowboy' && (
          <g transform="translate(0, -20)">
            <ellipse cx="0" cy="2" rx="30" ry="5" fill="#78350F" />
            <path d="M-15,2 L-11,-12 L0,-8 L11,-12 L15,2 Z" fill="#78350F" />
            <rect x="-14" y="-1" width="28" height="3" fill={avatarColor} />
          </g>
        )}
        {hat === 'wizard' && (
          <g transform="translate(0, -20)">
            <ellipse cx="0" cy="2" rx="29" ry="4.5" fill="#312E81" />
            <polygon points="-15,2 3,-26 15,2" fill="#312E81" />
            <rect x="-14" y="-1" width="28" height="3.2" fill={avatarColor} />
          </g>
        )}
        {hat === 'top-hat' && (
          <g transform="translate(0, -20)">
            <rect x="-24" y="0" width="48" height="4" rx="2" fill="#0F172A" />
            <rect x="-15" y="-18" width="30" height="19" rx="2" fill="#111827" />
            <rect x="-15" y="-4" width="30" height="3.5" fill={avatarColor} />
          </g>
        )}
        {hat === 'party-cone' && (
          <g transform="translate(0, -20)">
            <polygon points="-13,3 0,-22 13,3" fill={avatarColor} />
            <circle cx="0" cy="-23" r="4" fill="#22D3EE" />
          </g>
        )}
      </g>
    </svg>
  )
}

function accentFallback(hex: string) {
  return hex || '#E5A93C'
}

export interface AvatarCustomizerControlsProps {
  idPrefix?: string
  avatarColor: string
  avatarStyle: AvatarStyleId
  customization: AvatarCustomization
  flairPreviewName: string
  compact?: boolean
  onChange: (patch: {
    avatarColor?: string
    avatarStyle?: AvatarStyleId
    avatarCustomization?: Partial<AvatarCustomization>
  }) => void
}

type StudioTab = 'presets' | 'head' | 'outfit' | 'colors'

export function AvatarCustomizerControls({
  idPrefix = 'avatar',
  avatarColor,
  avatarStyle,
  customization,
  flairPreviewName,
  compact = false,
  onChange,
}: AvatarCustomizerControlsProps) {
  const [tab, setTab] = useState<StudioTab>('presets')
  const cust = resolveAvatarCustomization(customization)

  const handleRandomize = () => {
    const next = createRandomAvatarLook()
    onChange({
      avatarColor: next.avatarColor,
      avatarStyle: next.avatarStyle,
      avatarCustomization: next.avatarCustomization,
    })
  }

  const activeHeadLabel =
    AVATAR_STYLES.find((s) => s.id === avatarStyle)?.label ?? 'Quest Proline'
  const activeHatLabel = AVATAR_HATS.find((h) => h.id === cust.hat)?.label ?? 'No Hat'
  const activeOutfitLabel =
    AVATAR_OUTFITS.find((o) => o.id === cust.outfit)?.label ?? 'Cozy Hoodie'

  return (
    <div className="space-y-3">
      {/* Live Avatar Summary Banner + Randomize Button */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#080b10]/85 p-3">
        <div className="flex items-center gap-3 min-w-0">
          <AvatarPortraitSvg
            avatarColor={avatarColor}
            avatarStyle={avatarStyle}
            customization={cust}
            size={compact ? 68 : 80}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-[#f4f1ea]">
              {cust.flairEmoji ? `${cust.flairEmoji} ` : ''}
              {flairPreviewName.trim() || 'Guest'}
            </div>
            <div className="mt-0.5 text-[11px] text-[#c7c2b8]">
              {activeHeadLabel} · {activeOutfitLabel}
            </div>
            <div className="mt-0.5 text-[11px] text-[#8a867e]">
              Hat: {activeHatLabel} · Face:{' '}
              {AVATAR_FACES.find((f) => f.id === cust.faceStyle)?.label}
            </div>
          </div>
        </div>

        <button
          id={`btn-${idPrefix}-randomize`}
          type="button"
          onClick={handleRandomize}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#e5a93c]/40 bg-[#e5a93c]/15 px-3 py-2 text-xs font-semibold text-[#e5a93c] transition hover:bg-[#e5a93c]/25 active:scale-[0.98]"
          title="Generate a random custom avatar combination"
        >
          <Shuffle className="h-3.5 w-3.5" />
          <span>Randomize</span>
        </button>
      </div>

      {/* Category Sub-Tabs */}
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-[#080a0f] p-1 text-[11px] font-semibold">
        {(
          [
            { id: 'presets', label: '✨ Presets' },
            { id: 'head', label: '🥽 Head & Face' },
            { id: 'outfit', label: '🎩 Hat & Fit' },
            { id: 'colors', label: '🎨 Colors & Flair' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            id={`tab-${idPrefix}-${t.id}`}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-2 py-1.5 transition ${
              tab === t.id
                ? 'bg-[#e5a93c] text-[#090c12] shadow'
                : 'text-[#c7c2b8] hover:bg-white/8 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: CURATED 1-CLICK CHARACTER PRESETS */}
      {tab === 'presets' && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AVATAR_PRESETS.map((preset) => {
            const isSelected =
              avatarStyle === preset.avatarStyle &&
              avatarColor === preset.avatarColor &&
              cust.hat === preset.customization.hat &&
              cust.outfit === preset.customization.outfit
            return (
              <button
                key={preset.id}
                id={`btn-${idPrefix}-preset-${preset.id}`}
                type="button"
                onClick={() =>
                  onChange({
                    avatarColor: preset.avatarColor,
                    avatarStyle: preset.avatarStyle,
                    avatarCustomization: preset.customization,
                  })
                }
                className={`rounded-xl border p-2.5 text-left transition ${
                  isSelected
                    ? 'border-[#e5a93c] bg-[#e5a93c]/14 text-[#f4f1ea]'
                    : 'border-white/10 bg-[#0b0e14]/80 text-[#c7c2b8] hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">{preset.icon}</span>
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: preset.avatarColor }}
                  />
                </div>
                <div className="mt-1 text-xs font-semibold text-[#f4f1ea]">
                  {preset.label}
                </div>
                <div className="mt-0.5 text-[10px] leading-tight text-[#8a867e]">
                  {preset.tagline}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* TAB 2: 8 HEAD ARCHETYPES + 7 VISOR FACE EXPRESSIONS */}
      {tab === 'head' && (
        <div className="space-y-3">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Head Silhouette (8 Archetypes)
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {AVATAR_STYLES.map((style) => {
                const active = avatarStyle === style.id
                return (
                  <button
                    key={style.id}
                    id={`btn-${idPrefix}-style-${style.id}`}
                    type="button"
                    onClick={() => onChange({ avatarStyle: style.id })}
                    className={`rounded-xl border px-2.5 py-2 text-left transition ${
                      active
                        ? 'border-[#e5a93c] bg-[#e5a93c]/14 text-[#f4f1ea]'
                        : 'border-white/10 bg-[#0b0e14]/80 text-[#c7c2b8] hover:border-white/25'
                    }`}
                  >
                    <div className="text-xs font-semibold">
                      {style.icon} {style.label}
                    </div>
                    <div className="mt-0.5 text-[10px] text-[#8a867e]">{style.tagline}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Visor Expression (Voice-Reactive)
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {AVATAR_FACES.map((face) => {
                const active = cust.faceStyle === face.id
                return (
                  <button
                    key={face.id}
                    id={`btn-${idPrefix}-face-${face.id}`}
                    type="button"
                    onClick={() =>
                      onChange({ avatarCustomization: { faceStyle: face.id } })
                    }
                    className={`rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'border-[#e5a93c] bg-[#e5a93c]/16 text-[#f4f1ea]'
                        : 'border-white/10 bg-[#0b0e14]/80 text-[#c7c2b8] hover:border-white/25'
                    }`}
                  >
                    <span className="mr-1.5 font-mono text-[#e5a93c]">{face.glyph}</span>
                    {face.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 8 HATS + 6 SCULPTED OUTFITS + 5 FLOATING AURAS */}
      {tab === 'outfit' && (
        <div className="space-y-3">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Hat &amp; Headwear
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {AVATAR_HATS.map((hat) => {
                const active = cust.hat === hat.id
                return (
                  <button
                    key={hat.id}
                    id={`btn-${idPrefix}-hat-${hat.id}`}
                    type="button"
                    onClick={() => onChange({ avatarCustomization: { hat: hat.id } })}
                    className={`rounded-xl border px-2.5 py-1.5 text-left text-xs font-medium transition ${
                      active
                        ? 'border-[#e5a93c] bg-[#e5a93c]/16 text-[#f4f1ea]'
                        : 'border-white/10 bg-[#0b0e14]/80 text-[#c7c2b8] hover:border-white/25'
                    }`}
                  >
                    <span className="mr-1.5">{hat.icon}</span>
                    {hat.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Jacket &amp; Torso Outfit
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {AVATAR_OUTFITS.map((outfit) => {
                const active = cust.outfit === outfit.id
                return (
                  <button
                    key={outfit.id}
                    id={`btn-${idPrefix}-outfit-${outfit.id}`}
                    type="button"
                    onClick={() =>
                      onChange({ avatarCustomization: { outfit: outfit.id } })
                    }
                    className={`rounded-xl border px-2.5 py-2 text-left transition ${
                      active
                        ? 'border-[#e5a93c] bg-[#e5a93c]/16 text-[#f4f1ea]'
                        : 'border-white/10 bg-[#0b0e14]/80 text-[#c7c2b8] hover:border-white/25'
                    }`}
                  >
                    <div className="text-xs font-semibold">
                      {outfit.icon} {outfit.label}
                    </div>
                    <div className="text-[10px] text-[#8a867e]">{outfit.tagline}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Companion &amp; Aura Flair
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {AVATAR_ACCESSORIES.map((acc) => {
                const active = cust.accessory === acc.id
                return (
                  <button
                    key={acc.id}
                    id={`btn-${idPrefix}-acc-${acc.id}`}
                    type="button"
                    onClick={() =>
                      onChange({ avatarCustomization: { accessory: acc.id } })
                    }
                    className={`rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'border-[#e5a93c] bg-[#e5a93c]/16 text-[#f4f1ea]'
                        : 'border-white/10 bg-[#0b0e14]/80 text-[#c7c2b8] hover:border-white/25'
                    }`}
                  >
                    <span className="mr-1">{acc.icon}</span>
                    {acc.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: 12 GLOW TRIM COLORS + 10 BODY SHELL COLORS + NAMEPLATE BADGE */}
      {tab === 'colors' && (
        <div className="space-y-3">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Accent &amp; LED Glow Color
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVATAR_COLORS.map((swatch) => {
                const selected = avatarColor === swatch.hex
                return (
                  <button
                    key={swatch.hex}
                    id={`btn-${idPrefix}-color-${swatch.name.toLowerCase().replace(/\s+/g, '-')}`}
                    type="button"
                    title={swatch.name}
                    onClick={() => onChange({ avatarColor: swatch.hex })}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                      selected
                        ? 'ring-2 ring-[#f4f1ea] ring-offset-2 ring-offset-[#0b0e14]'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  >
                    {selected && <Check className="h-3.5 w-3.5 text-[#080a0d]" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Outfit &amp; Helmet Shell Color
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVATAR_BODY_COLORS.map((swatch) => {
                const selected = cust.bodyColor === swatch.hex
                const lightSwatch = swatch.hex === '#CBD5E1'
                return (
                  <button
                    key={swatch.hex}
                    id={`btn-${idPrefix}-body-${swatch.name.toLowerCase().replace(/\s+/g, '-')}`}
                    type="button"
                    title={swatch.name}
                    onClick={() =>
                      onChange({ avatarCustomization: { bodyColor: swatch.hex } })
                    }
                    className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/15 transition ${
                      selected
                        ? 'ring-2 ring-[#e5a93c] ring-offset-2 ring-offset-[#0b0e14]'
                        : 'opacity-85 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  >
                    {selected && (
                      <Check
                        className={`h-3.5 w-3.5 ${
                          lightSwatch ? 'text-[#080a0d]' : 'text-[#f4f1ea]'
                        }`}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              Nameplate Flair Badge
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {AVATAR_FLAIR_BADGES.map((badge) => {
                const active = cust.flairEmoji === badge.emoji
                return (
                  <button
                    key={badge.label}
                    id={`btn-${idPrefix}-flair-${badge.label.toLowerCase().replace(/\s+/g, '-')}`}
                    type="button"
                    onClick={() =>
                      onChange({ avatarCustomization: { flairEmoji: badge.emoji } })
                    }
                    className={`rounded-xl border px-2.5 py-1 text-xs font-medium transition ${
                      active
                        ? 'border-[#e5a93c] bg-[#e5a93c]/16 text-[#f4f1ea]'
                        : 'border-white/10 bg-[#0b0e14]/80 text-[#c7c2b8] hover:border-white/25'
                    }`}
                  >
                    {badge.emoji ? `${badge.emoji} ${badge.label}` : '✕ None'}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
