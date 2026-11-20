import type { Message, Lang } from '../lib/types'
import { LANG_SHORT } from '../lib/types'
import { displayFontClass } from '../lib/lang'

interface Props {
  message: Message
  viewLang: Lang
  showRomanization?: boolean
}

export function MessageBubble({ message, viewLang, showRomanization }: Props) {
  const isSrc = message.srcLang === viewLang
  const translation =
    message.translations[viewLang] ||
    (message.srcLang === viewLang ? message.srcText : undefined)
  const romSrc = message.romanizations?.[message.srcLang]
  const romTr = message.romanizations?.[viewLang]

  return (
    <article
      className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ring-1 ${
        isSrc
          ? 'ml-auto bg-teal-500/15 text-teal-50 ring-teal-500/25'
          : 'mr-auto bg-white/5 text-slate-100 ring-white/10'
      }`}
      aria-label={`Message from ${message.speakerName || message.srcLang}`}
    >
      <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        <span>{message.speakerName || LANG_SHORT[message.srcLang]}</span>
        <span className="chip bg-black/20 text-slate-300">{LANG_SHORT[message.srcLang]}</span>
        <time dateTime={new Date(message.ts).toISOString()}>
          {new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>
      <p className={displayFontClass(message.srcLang)}>{message.srcText}</p>
      {showRomanization && romSrc && message.srcLang !== 'en' && (
        <p className="text-[11px] italic text-slate-400">{romSrc}</p>
      )}
      {translation && translation !== message.srcText && (
        <p
          className={`mt-1.5 border-t border-white/10 pt-1.5 ${displayFontClass(viewLang)} ${
            viewLang === 'bn'
              ? 'text-emerald-200'
              : viewLang === 'zh'
                ? 'text-red-200'
                : 'text-sky-200'
          }`}
        >
          {translation}
        </p>
      )}
      {showRomanization && romTr && translation && translation !== message.srcText && viewLang !== 'en' && (
        <p className="text-[11px] italic text-slate-400">{romTr}</p>
      )}
    </article>
  )
}
