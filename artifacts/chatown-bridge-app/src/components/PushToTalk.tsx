import type { Lang, SpeechStatus } from '../lib/types'

interface Props {
  lang: Lang
  status: SpeechStatus
  interim?: string
  disabled?: boolean
  onPressStart: () => void
  onPressEnd: () => void
}

const LABELS: Record<Lang, { title: string; hold: string }> = {
  en: { title: 'EN', hold: 'Hold to speak English' },
  bn: { title: 'বাংলা', hold: 'Hold to speak Bangla' },
  zh: { title: '中文', hold: 'Hold to speak Chinese' },
}

function micColor(lang: Lang, listening: boolean): string {
  if (lang === 'zh') {
    return listening ? 'bg-red-500' : 'bg-red-600 hover:bg-red-500'
  }
  if (lang === 'bn') {
    return listening ? 'bg-emerald-500' : 'bg-emerald-600 hover:bg-emerald-500'
  }
  return listening ? 'bg-sky-500' : 'bg-sky-600 hover:bg-sky-500'
}

export function PushToTalk({
  lang,
  status,
  interim,
  disabled,
  onPressStart,
  onPressEnd,
}: Props) {
  const listening = status === 'listening'
  const processing = status === 'processing'
  const color = micColor(lang, listening)

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={disabled || processing}
        aria-label={LABELS[lang].hold}
        aria-pressed={listening}
        className={`ptt-btn flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg shadow-black/30 transition-transform active:scale-95 disabled:opacity-50 sm:h-[4.5rem] sm:w-[4.5rem] ${color} ${
          listening ? 'ptt-active scale-105' : ''
        }`}
        onPointerDown={(e) => {
          e.preventDefault()
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          onPressStart()
        }}
        onPointerUp={(e) => {
          e.preventDefault()
          onPressEnd()
        }}
        onPointerCancel={() => onPressEnd()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <MicIcon listening={listening} />
      </button>
      <span
        className={`text-xs font-semibold ${
          lang === 'bn' ? 'font-bn' : lang === 'zh' ? 'font-zh' : 'font-en'
        }`}
      >
        {LABELS[lang].title}
      </span>
      {listening && (
        <span className="max-w-[10rem] truncate text-[10px] text-teal-300" aria-live="polite">
          {interim || 'Listening…'}
        </span>
      )}
      {processing && (
        <span className="text-[10px] text-amber-300" aria-live="polite">
          Translating…
        </span>
      )}
    </div>
  )
}

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-8 w-8"
      aria-hidden
    >
      {listening ? (
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
      ) : (
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
      )}
    </svg>
  )
}
