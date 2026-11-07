import { Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { resolveAvatarCustomization } from '../../constants/avatars'
import type {
  AvatarCustomization,
  AvatarStyleId,
  ParticipantProfile,
} from '../../types/lounge'
import { AvatarCustomizerControls } from './AvatarCustomizerControls'

export interface AvatarWardrobeDrawerProps {
  open: boolean
  localProfile: ParticipantProfile
  onUpdateAvatar: (patch: {
    displayName?: string
    avatarColor?: string
    avatarStyle?: AvatarStyleId
    avatarCustomization?: Partial<AvatarCustomization>
  }) => void
  onClose: () => void
}

export function AvatarWardrobeDrawer({
  open,
  localProfile,
  onUpdateAvatar,
  onClose,
}: AvatarWardrobeDrawerProps) {
  const [nameDraft, setNameDraft] = useState(localProfile.displayName)

  useEffect(() => {
    setNameDraft(localProfile.displayName)
  }, [localProfile.displayName])

  if (!open) return null

  const cust = resolveAvatarCustomization(localProfile.avatarCustomization)

  const commitName = () => {
    const trimmed = nameDraft.trim().slice(0, 24)
    if (trimmed && trimmed !== localProfile.displayName) {
      onUpdateAvatar({ displayName: trimmed })
    }
  }

  return (
    <div
      id="avatar-wardrobe-drawer"
      className="pointer-events-auto fixed top-16 right-4 bottom-28 z-40 flex w-[420px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0b0f17]/95 text-[#f4f1ea] shadow-2xl backdrop-blur-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e5a93c]/20 text-[#e5a93c]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide text-[#f4f1ea]">
              Avatar Studio &amp; Live 3D Mirror
            </h2>
            <p className="text-[11px] text-slate-400">
              Updates sync instantly to everyone in the lounge
            </p>
          </div>
        </div>
        <button
          id="btn-close-avatar-wardrobe"
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          title="Close Avatar Studio"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
        {/* Live Display Name Input */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <label
            htmlFor="input-wardrobe-display-name"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400"
          >
            Display Name on 3D Nameplate
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="input-wardrobe-display-name"
              type="text"
              maxLength={24}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitName()
                }
              }}
              className="lounge-input w-full rounded-xl px-3 py-2 text-xs"
              placeholder="Your name in 3D"
            />
            <button
              id="btn-wardrobe-save-name"
              type="button"
              onClick={commitName}
              className="shrink-0 rounded-xl border border-[#e5a93c]/40 bg-[#e5a93c]/15 px-3 py-2 text-xs font-semibold text-[#e5a93c] transition hover:bg-[#e5a93c]/25"
            >
              Save
            </button>
          </div>
        </div>

        {/* Full Modular Avatar Customizer */}
        <AvatarCustomizerControls
          idPrefix="wardrobe"
          avatarColor={localProfile.avatarColor}
          avatarStyle={localProfile.avatarStyle}
          customization={cust}
          flairPreviewName={nameDraft || localProfile.displayName}
          compact
          onChange={onUpdateAvatar}
        />

        <div className="rounded-xl border border-sky-400/20 bg-sky-500/8 px-3 py-2 text-[11px] text-sky-200/90">
          💡 Check out your real-time <strong>3D Holographic Mirror</strong> floating right beside this panel — click <strong>⟳ Spin 360°</strong> on the mirror frame to inspect your hat, cape, or drone from every angle!
        </div>
      </div>
    </div>
  )
}
