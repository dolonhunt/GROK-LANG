import type { LayoutMode, UserLang } from '../lib/types'
import { LANG_SHORT } from '../lib/types'

interface HeaderProps {
  autoPlay: boolean
  onAutoPlayChange: (v: boolean) => void
  onClear: () => void
  modeLabel?: string
  roomCode?: string | null
  speakingName?: string | null
  onShare?: () => void
  onLobby?: () => void
  onExtras?: () => void
  layoutMode?: LayoutMode
  onLayoutModeChange?: (m: LayoutMode) => void
  userLang: UserLang
  onUserLangChange: (l: UserLang) => void
}

export function Header({
  autoPlay,
  onAutoPlayChange,
  onClear,
  modeLabel = 'Local',
  roomCode,
  speakingName,
  onShare,
  onLobby,
  onExtras,
  layoutMode = 'boss',
  onLayoutModeChange,
  userLang,
  onUserLangChange,
}: HeaderProps) {
  return (
    <header className="safe-pt border-b border-white/5 bg-slate-950/70 px-3 pb-2.5 pt-2 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/20 text-sm font-bold text-teal-300 ring-1 ring-teal-500/30">
              CB
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold tracking-tight text-white">
                Chatown Bridge
              </h1>
              <p className="text-[11px] text-slate-400">
                EN / BN ⇄ 中文 · <span className="text-teal-300/90">{modeLabel}</span>
                {roomCode ? ` · ${roomCode}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {/* My language EN | BN */}
          <div
            className="flex rounded-full bg-slate-900/90 p-0.5 ring-1 ring-white/10"
            role="group"
            aria-label="My language"
          >
            {(['en', 'bn'] as UserLang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => onUserLangChange(l)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  userLang === l
                    ? 'bg-teal-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {LANG_SHORT[l]}
              </button>
            ))}
          </div>

          {onLayoutModeChange && (
            <button
              type="button"
              onClick={() => onLayoutModeChange(layoutMode === 'boss' ? 'dual' : 'boss')}
              className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-200 ring-1 ring-white/10"
            >
              {layoutMode === 'boss' ? 'Boss' : 'Dual'}
            </button>
          )}

          <button
            type="button"
            role="switch"
            aria-checked={autoPlay}
            aria-label="Speak translation aloud"
            onClick={() => onAutoPlayChange(!autoPlay)}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              autoPlay ? 'bg-teal-500' : 'bg-slate-700'
            }`}
            title="Speak aloud"
          >
            <span
              className={`absolute top-0.5 left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] shadow transition-transform ${
                autoPlay ? 'translate-x-5' : ''
              }`}
            >
              🔊
            </span>
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {onExtras && (
          <ActionBtn onClick={onExtras} label="Extras" />
        )}
        {onShare && <ActionBtn onClick={onShare} label="Share" accent />}
        {onLobby && <ActionBtn onClick={onLobby} label="Rooms" />}
        <ActionBtn onClick={onClear} label="Clear" />
      </div>

      {speakingName && (
        <div
          className="mt-2 rounded-xl bg-amber-500/15 px-3 py-1.5 text-center text-xs font-medium text-amber-100 ring-1 ring-amber-500/30"
          role="status"
        >
          {speakingName} is speaking…
        </div>
      )}
    </header>
  )
}

function ActionBtn({
  onClick,
  label,
  accent,
}: {
  onClick: () => void
  label: string
  accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ring-1 ${
        accent
          ? 'bg-teal-500/15 text-teal-200 ring-teal-500/30'
          : 'bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  )
}
