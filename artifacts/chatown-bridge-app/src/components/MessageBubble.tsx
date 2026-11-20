import type { Message, Lang } from '../lib/types'

interface Props {
  message: Message
  viewLang: Lang
  showRomanization?: boolean
}

export function MessageBubble({ message, viewLang, showRomanization }: Props) {
  const isSrc = message.srcLang === viewLang
  const translation = message.translations[viewLang]
  const romSrc = message.romanizations?.[message.srcLang]
  const romTr = message.romanizations?.[viewLang]

  return (
    <article
      className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
        isSrc ? 'ml-auto bg-teal-900/50 text-teal-50' : 'mr-auto bg-slate-800/80 text-slate-100'
      }`}
      aria-label={`Message from ${message.speakerName || message.srcLang}`}
    >
      <div className="mb-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-400">
        <span>{message.speakerName || (message.srcLang === 'bn' ? 'বাংলা' : '中文')}</span>
        <span>{message.srcLang === 'bn' ? 'বাংলা' : '中文'}</span>
        <time dateTime={new Date(message.ts).toISOString()}>
          {new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>
      <p className={message.srcLang === 'bn' ? 'font-bn' : 'font-zh'}>{message.srcText}</p>
      {showRomanization && romSrc && (
        <p className="text-[11px] italic text-slate-400">{romSrc}</p>
      )}
      {translation && translation !== message.srcText && (
        <p
          className={`mt-1 border-t border-white/10 pt-1 ${
            viewLang === 'bn' ? 'font-bn text-emerald-200' : 'font-zh text-red-200'
          }`}
        >
          {translation}
        </p>
      )}
      {showRomanization && romTr && translation && translation !== message.srcText && (
        <p className="text-[11px] italic text-slate-400">{romTr}</p>
      )}
    </article>
  )
}
