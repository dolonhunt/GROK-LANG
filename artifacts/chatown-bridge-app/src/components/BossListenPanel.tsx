import type { Lang, Message, SpeechStatus, UserLang } from '../lib/types'
import { LANG_LABEL } from '../lib/types'
import { Transcript } from './Transcript'
import { PushToTalk } from './PushToTalk'
import { displayFontClass } from '../lib/lang'

interface Props {
  messages: Message[]
  userLang: UserLang
  statusZh: SpeechStatus
  statusMine: SpeechStatus
  interimZh?: string
  interimMine?: string
  disabled?: boolean
  lastTranslation?: string | null
  onHoldZhStart: () => void
  onHoldZhEnd: () => void
  onHoldMineStart: () => void
  onHoldMineEnd: () => void
  onReplay: () => void
  banner?: string | null
  showRomanization?: boolean
}

export function BossListenPanel({
  messages,
  userLang,
  statusZh,
  statusMine,
  interimZh,
  interimMine,
  disabled,
  lastTranslation,
  onHoldZhStart,
  onHoldZhEnd,
  onHoldMineStart,
  onHoldMineEnd,
  onReplay,
  banner,
  showRomanization,
}: Props) {
  const font = displayFontClass(userLang)
  const listening = statusZh === 'listening' || statusMine === 'listening'
  const processing = statusZh === 'processing' || statusMine === 'processing'

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Boss listen mode">
      <div className="mx-3 mt-3 card rounded-2xl px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300/90">
              Meeting · Boss mode
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Boss 中文 → you hear <span className="text-slate-200">{LANG_LABEL[userLang]}</span> aloud.
              Reply in {LANG_LABEL[userLang]} → 中文.
            </p>
          </div>
          <span className="chip bg-red-500/15 text-red-200 ring-1 ring-red-500/20">中文</span>
        </div>
        {banner && (
          <p className="mt-2 text-[11px] text-amber-200" role="status">
            {banner}
          </p>
        )}
      </div>

      {/* Live translation card */}
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-teal-500/20 via-slate-900/80 to-blue-600/10 px-4 py-4 ring-1 ring-teal-500/25">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-200/80">
            Live · {LANG_LABEL[userLang]}
          </span>
          <button
            type="button"
            onClick={onReplay}
            disabled={!lastTranslation}
            className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/15 disabled:opacity-30"
            aria-label="Play translation again"
          >
            🔊 Again
          </button>
        </div>
        <p className={`${font} min-h-[4rem] text-[1.35rem] font-semibold leading-snug text-white sm:text-2xl`}>
          {lastTranslation ||
            (statusZh === 'listening'
              ? interimZh
                ? `… ${interimZh}`
                : 'Listening to Chinese…'
              : statusMine === 'listening'
                ? interimMine
                  ? `… ${interimMine}`
                  : `Listening (${LANG_LABEL[userLang]})…`
                : processing
                  ? 'Translating…'
                  : userLang === 'bn'
                    ? 'Boss-এর কথা এখানে শোনাবে'
                    : 'Boss’s words will appear here')}
        </p>
      </div>

      <Transcript
        messages={messages}
        viewLang={userLang as Lang}
        showRomanization={showRomanization}
        emptyHint="Meeting transcript will show here."
      />

      {/* Two mics: listen (zh) + reply (en/bn) */}
      <div className="safe-pb grid grid-cols-2 gap-3 px-4 pb-2 pt-1">
        <div className="card flex flex-col items-center rounded-2xl py-3">
          <PushToTalk
            lang="zh"
            status={statusZh}
            interim={interimZh}
            disabled={disabled || listening && statusZh !== 'listening'}
            onPressStart={onHoldZhStart}
            onPressEnd={onHoldZhEnd}
          />
          <p className="mt-1 text-center text-[10px] text-slate-400">Hold · Boss speaks</p>
        </div>
        <div className="card flex flex-col items-center rounded-2xl py-3">
          <PushToTalk
            lang={userLang}
            status={statusMine}
            interim={interimMine}
            disabled={disabled || listening && statusMine !== 'listening'}
            onPressStart={onHoldMineStart}
            onPressEnd={onHoldMineEnd}
          />
          <p className="mt-1 text-center text-[10px] text-slate-400">
            Hold · You reply ({LANG_SHORT_SAFE(userLang)})
          </p>
        </div>
      </div>
    </section>
  )
}

function LANG_SHORT_SAFE(l: UserLang) {
  return l === 'bn' ? 'BN' : 'EN'
}
