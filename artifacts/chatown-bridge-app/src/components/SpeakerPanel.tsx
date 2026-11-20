import type { Lang, Message, SpeechStatus } from '../lib/types'
import { Transcript } from './Transcript'
import { PushToTalk } from './PushToTalk'

interface Props {
  lang: Lang
  messages: Message[]
  flipped?: boolean
  status: SpeechStatus
  interim?: string
  disabled?: boolean
  onPressStart: () => void
  onPressEnd: () => void
  banner?: string | null
  showRomanization?: boolean
  hideMic?: boolean
}

export function SpeakerPanel({
  lang,
  messages,
  flipped,
  status,
  interim,
  disabled,
  onPressStart,
  onPressEnd,
  banner,
  showRomanization,
  hideMic,
}: Props) {
  const bg = lang === 'bn' ? 'from-emerald-950/40' : 'from-red-950/30'

  return (
    <section
      className={`flex min-h-0 flex-1 flex-col bg-gradient-to-b ${bg} to-transparent ${
        flipped ? 'panel-flip' : ''
      }`}
      aria-label={lang === 'bn' ? 'Bangla speaker panel' : 'Chinese speaker panel'}
    >
      <div className="flex items-center justify-between border-b border-slate-800/60 px-3 py-1.5">
        <span
          className={`text-xs font-semibold tracking-wide ${
            lang === 'bn' ? 'font-bn text-emerald-300' : 'font-zh text-red-300'
          }`}
        >
          {lang === 'bn' ? 'বাংলা · Bangla' : '中文 · Chinese'}
        </span>
        {banner && (
          <span className="text-[10px] text-amber-300" role="status">
            {banner}
          </span>
        )}
      </div>
      <Transcript
        messages={messages}
        viewLang={lang}
        showRomanization={showRomanization}
        emptyHint={
          lang === 'bn'
            ? 'এখানে অনুবাদ দেখাবে · Hold mic to speak'
            : '翻译显示在这里 · 按住麦克风说话'
        }
      />
      {!hideMic && (
        <div className="flex justify-center py-2">
          <PushToTalk
            lang={lang}
            status={status}
            interim={interim}
            disabled={disabled}
            onPressStart={onPressStart}
            onPressEnd={onPressEnd}
          />
        </div>
      )}
    </section>
  )
}
