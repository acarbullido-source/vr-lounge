import { Delete, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ensureMemberIdentity } from '../../services/identityAuth'
import { isPasscodeNumericOnly, verifyAndUnlockPasscode } from '../../services/passcode'

export interface PasscodeGateProps {
  onUnlocked: () => void
}

const NUMERIC_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
const ALPHA_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
] as const

export function PasscodeGate({ onUnlocked }: PasscodeGateProps) {
  const numericDefault = isPasscodeNumericOnly()
  const [code, setCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [showAlphaPad, setShowAlphaPad] = useState(!numericDefault)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    void ensureMemberIdentity()
  }, [])

  const attemptUnlock = async (candidate: string) => {
    if (verifying) return
    if (!candidate.trim()) {
      setErrorMsg('Enter the lounge passcode to continue.')
      return
    }
    setVerifying(true)
    try {
      const ok = await verifyAndUnlockPasscode(candidate)
      if (ok) {
        setErrorMsg(null)
        onUnlocked()
      } else {
        setErrorMsg('Incorrect passcode. Ask the lounge host for the invite code.')
        setShake(true)
        window.setTimeout(() => setShake(false), 380)
        setCode('')
      }
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && target.tagName === 'INPUT') return

      if (e.key === 'Enter') {
        e.preventDefault()
        void attemptUnlock(code)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setCode((prev) => prev.slice(0, -1))
        setErrorMsg(null)
      } else if (/^[a-zA-Z0-9_-]$/.test(e.key)) {
        e.preventDefault()
        setCode((prev) => (prev.length < 16 ? prev + e.key.toUpperCase() : prev))
        setErrorMsg(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const appendChar = (ch: string) => {
    setErrorMsg(null)
    setCode((prev) => (prev.length < 16 ? prev + ch.toUpperCase() : prev))
  }

  return (
    <div
      id="vr-lounge-passcode-gate"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-slate-950/92 via-zinc-950/88 to-slate-950/95 p-4 backdrop-blur-xl"
    >
      <div
        className={`lounge-panel w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl transition-all duration-200 sm:p-7 ${
          shake ? 'translate-x-1.5 border-[#e05a47]/70' : ''
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#e5a93c]/40 bg-[#e5a93c]/15 text-[#e5a93c] shadow-inner">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#e5a93c]">
                Private Hangout Gate
              </p>
              <h1
                className="text-2xl font-semibold tracking-tight text-[#f4f1ea]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                VR Lounge Access
              </h1>
            </div>
          </div>

          <button
            id="btn-passcode-mode-toggle"
            type="button"
            onClick={() => setShowAlphaPad((v) => !v)}
            className="lounge-btn rounded-xl border border-white/10 bg-zinc-900/85 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[#c7c2b8] shadow-sm hover:border-[#e5a93c]/50 hover:bg-slate-800/80 hover:text-[#f4f1ea]"
          >
            {showAlphaPad ? '123 Pad' : 'ABC Pad'}
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-[#c7c2b8]/90">
          Enter your private group passcode using the VR-friendly touch keypad or your keyboard.
          This headset or browser will stay unlocked automatically.
        </p>

        {/* Direct Input + Show/Hide Toggle */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void attemptUnlock(code)
          }}
          className="mt-4"
        >
          <div className="relative flex items-center">
            <KeyRound className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#8a867e]" />
            <input
              id="input-lounge-passcode"
              type={showCode ? 'text' : 'password'}
              inputMode={showAlphaPad ? 'text' : 'numeric'}
              autoComplete="off"
              maxLength={16}
              value={code}
              onChange={(e) => {
                setErrorMsg(null)
                setCode(e.target.value.toUpperCase())
              }}
              placeholder="ENTER SECRET CODE"
              className="lounge-input w-full rounded-2xl py-3.5 pl-10 pr-11 text-center font-mono text-lg font-semibold tracking-[0.28em] text-[#f4f1ea] placeholder:text-xs placeholder:tracking-widest"
            />
            <button
              id="btn-toggle-passcode-visibility"
              type="button"
              onClick={() => setShowCode((s) => !s)}
              aria-label={showCode ? 'Hide passcode' : 'Show passcode'}
              className="lounge-btn absolute right-3 rounded-lg p-1.5 text-[#8a867e] hover:bg-white/5 hover:text-[#f4f1ea]"
            >
              {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {errorMsg && (
            <p
              id="passcode-error-banner"
              role="alert"
              className="mt-2.5 rounded-xl border border-[#e05a47]/40 bg-[#e05a47]/12 px-3 py-2 text-center text-xs font-medium text-[#f28b7b] shadow-sm"
            >
              {errorMsg}
            </p>
          )}

          {/* VR-Friendly Large Touch / Laser Pointer Keypad */}
          {!showAlphaPad ? (
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {NUMERIC_KEYS.map((digit) => (
                <button
                  key={digit}
                  id={`btn-keypad-${digit}`}
                  type="button"
                  onClick={() => appendChar(digit)}
                  className="lounge-btn flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/85 font-mono text-xl font-semibold text-[#f4f1ea] shadow-sm hover:border-[#e5a93c]/60 hover:bg-slate-800/90 active:scale-[0.97]"
                >
                  {digit}
                </button>
              ))}
              <button
                id="btn-keypad-clear"
                type="button"
                onClick={() => {
                  setCode('')
                  setErrorMsg(null)
                }}
                className="lounge-btn flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/85 text-xs font-semibold uppercase tracking-wider text-[#c7c2b8] shadow-sm hover:border-[#e05a47]/50 hover:bg-zinc-800/90 hover:text-[#f4f1ea] active:scale-[0.97]"
              >
                Clear
              </button>
              <button
                id="btn-keypad-0"
                type="button"
                onClick={() => appendChar('0')}
                className="lounge-btn flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/85 font-mono text-xl font-semibold text-[#f4f1ea] shadow-sm hover:border-[#e5a93c]/60 hover:bg-slate-800/90 active:scale-[0.97]"
              >
                0
              </button>
              <button
                id="btn-keypad-backspace"
                type="button"
                aria-label="Backspace"
                onClick={() => {
                  setCode((prev) => prev.slice(0, -1))
                  setErrorMsg(null)
                }}
                className="lounge-btn flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/85 text-[#c7c2b8] shadow-sm hover:border-[#e5a93c]/50 hover:bg-zinc-800/90 hover:text-[#f4f1ea] active:scale-[0.97]"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-10 gap-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => appendChar(d)}
                    className="lounge-btn flex h-10 items-center justify-center rounded-lg border border-white/10 bg-slate-900/85 font-mono text-xs font-semibold text-[#f4f1ea] hover:border-[#e5a93c]/60 hover:bg-slate-800/90"
                  >
                    {d}
                  </button>
                ))}
              </div>
              {ALPHA_ROWS.map((row, idx) => (
                <div key={idx} className="flex justify-center gap-1">
                  {row.map((ch) => (
                    <button
                      key={ch}
                      id={`btn-keypad-${ch.toLowerCase()}`}
                      type="button"
                      onClick={() => appendChar(ch)}
                      className="lounge-btn flex h-10 min-w-[30px] flex-1 items-center justify-center rounded-lg border border-white/10 bg-slate-900/85 font-mono text-xs font-semibold text-[#f4f1ea] hover:border-[#e5a93c]/60 hover:bg-slate-800/90"
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  id="btn-keypad-clear"
                  type="button"
                  onClick={() => {
                    setCode('')
                    setErrorMsg(null)
                  }}
                  className="lounge-btn h-10 rounded-xl border border-white/10 bg-zinc-900/85 text-xs font-medium text-[#c7c2b8] hover:border-[#e05a47]/50 hover:text-[#f4f1ea]"
                >
                  Clear
                </button>
                <button
                  id="btn-keypad-backspace"
                  type="button"
                  onClick={() => {
                    setCode((prev) => prev.slice(0, -1))
                    setErrorMsg(null)
                  }}
                  className="lounge-btn flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900/85 text-xs font-medium text-[#c7c2b8] hover:border-[#e5a93c]/50 hover:text-[#f4f1ea]"
                >
                  <Delete className="h-4 w-4" /> Backspace
                </button>
              </div>
            </div>
          )}

          <button
            id="btn-unlock-lounge"
            type="submit"
            disabled={verifying}
            className="lounge-btn mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e5a93c] px-4 py-3.5 text-sm font-semibold text-[#080a0d] shadow-lg shadow-[#e5a93c]/15 hover:bg-[#f2be5c] active:scale-[0.99] disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>
              {verifying
                ? 'Deriving E2EE Room Keys…'
                : 'Unlock Private Lounge'}
            </span>
          </button>
        </form>
      </div>
    </div>
  )
}
