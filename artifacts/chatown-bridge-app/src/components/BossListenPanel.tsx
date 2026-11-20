import type { Lang, Message, SpeechStatus } from '../lib/types'
import { Transcript } from './Transcript'
import { PushToTalk } from './PushToTalk'

interface Props {
  messages: Message[]
  status: SpeechStatus
  interim?: string
  disabled?: boolean
  lastTranslation?: string | null
  onHoldStart: () => void
  onHoldEnd: () => void
  onReplay: () => void
  banner?: string | null
  showRomanization?: boolean
}

/**
 * One-phone “boss talks Chinese → I hear Bangla aloud” layout.
 * Big Bangla line + hold-to-listen on Chinese mic.
 */
export function BossListenPanel({
  messages,
  status,
  interim,
  disabled,
  lastTranslation,
  onHoldStart,
  onHoldEnd,
  onReplay,
  banner,
  showRomanization,
}: Props) {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-red-950/40 via-slate-950 to-emerald-950/30"
      aria-label="Boss listen mode"
    >
      <div className="border-b border-slate-800 px-3 py-2 text-center">
        <p className="text-xs font-medium text-amber-200">Boss mode · 老板说中文 → আপনি শুনবেন বাংলায়</p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Hold the red mic while your boss speaks. Translation plays aloud automatically.
        </p>
        {banner && (
          <p className="mt-1 text-[11px] text-amber-300" role="status">
            {banner}
          </p>
        )}
      </div>

      {/* Live big Bangla output */}
      <div className="mx-3 mt-3 rounded-2xl border border-emerald-800/50 bg-emerald-950/40 px-4 py-4 shadow-inner">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-emerald-400/80">
          <span>Translation · অনুবাদ (বাংলা)</span>
          <button
            type="button"
            onClick={onReplay}
            disabled={!lastTranslation}
            className="rounded-lg bg-emerald-700/80 px-2 py-1 text-[11px] font-semibold normal-case text-white disabled:opacity-30"
            aria-label="Play translation again"
          >
            🔊 Again
          </button>
        </div>
        <p className="font-bn min-h-[3.5rem] text-xl font-semibold leading-relaxed text-emerald-50 sm:text-2xl">
          {lastTranslation ||
            (status === 'listening'
              ? interim
                ? `… ${interim}`
                : 'শুনছি… Listening…'
              : status === 'processing'
                ? 'অনুবাদ হচ্ছে…'
                : 'Boss-এর কথা এখানে বাংলায় শোনাবে')}
        </p>
      </div>

      <Transcript
        messages={messages}
        viewLang={'bn' as Lang}
        showRomanization={showRomanization}
        emptyHint="Transcript of the meeting appears here."
      />

      <div className="flex flex-col items-center gap-1 py-3">
        <PushToTalk
          lang="zh"
          status={status}
          interim={interim}
          disabled={disabled}
          onPressStart={onHoldStart}
          onPressEnd={onHoldEnd}
        />
        <p className="text-[11px] text-slate-400">Hold · boss speaking (中文)</p>
      </div>
    </section>
  )
}
