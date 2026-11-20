import type { Lang } from '../lib/types'

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
  layoutMode?: 'dual' | 'boss'
  onLayoutModeChange?: (m: 'dual' | 'boss') => void
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
}: HeaderProps) {
  return (
    <header className="safe-pt flex flex-col gap-1 border-b border-slate-800 bg-slate-950/90 px-3 pb-2 pt-2 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold tracking-tight text-teal-300 sm:text-lg">
            Chatown Bridge
          </h1>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <LangChip lang="bn" />
            <span aria-hidden>⇄</span>
            <LangChip lang="zh" />
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
              {modeLabel}
              {roomCode ? ` · ${roomCode}` : ''}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {onLayoutModeChange && (
            <button
              type="button"
              onClick={() => onLayoutModeChange(layoutMode === 'boss' ? 'dual' : 'boss')}
              className="rounded-lg border border-amber-800/60 bg-amber-950/40 px-2 py-1 text-xs text-amber-100 hover:bg-amber-900/50"
              title="Boss mode: boss speaks Chinese, you hear Bangla aloud"
            >
              {layoutMode === 'boss' ? 'Boss' : 'Dual'}
            </button>
          )}
          {onExtras && (
            <button
              type="button"
              onClick={onExtras}
              className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Extras
            </button>
          )}
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="rounded-lg border border-teal-800 px-2 py-1 text-xs text-teal-300 hover:bg-teal-950"
            >
              Share
            </button>
          )}
          {onLobby && (
            <button
              type="button"
              onClick={onLobby}
              className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Rooms
            </button>
          )}
          <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-300">
            <span className="sr-only">Auto-play aloud</span>
            <button
              type="button"
              role="switch"
              aria-checked={autoPlay}
              aria-label="Speak translation aloud"
              onClick={() => onAutoPlayChange(!autoPlay)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                autoPlay ? 'bg-teal-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  autoPlay ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </label>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            aria-label="Clear transcript"
          >
            Clear
          </button>
        </div>
      </div>
      {speakingName && (
        <div
          className="rounded-lg bg-amber-900/40 px-2 py-1 text-center text-xs text-amber-200"
          role="status"
        >
          {speakingName} is speaking…
        </div>
      )}
    </header>
  )
}

function LangChip({ lang }: { lang: Lang }) {
  if (lang === 'bn') {
    return (
      <span className="font-bn rounded-full bg-emerald-900/60 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
        বাংলা
      </span>
    )
  }
  return (
    <span className="font-zh rounded-full bg-red-900/50 px-2 py-0.5 text-[11px] font-medium text-red-300">
      中文
    </span>
  )
}
