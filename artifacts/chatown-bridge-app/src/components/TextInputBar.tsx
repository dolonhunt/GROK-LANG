import { useState, type FormEvent } from 'react'
import type { Lang } from '../lib/types'
import { LANG_SHORT } from '../lib/types'

interface Props {
  defaultLang?: Lang
  disabled?: boolean
  onSend: (text: string, from: Lang) => void
  allowedLangs?: Lang[]
}

export function TextInputBar({
  defaultLang = 'en',
  disabled,
  onSend,
  allowedLangs = ['en', 'bn', 'zh'],
}: Props) {
  const [text, setText] = useState('')
  const [from, setFrom] = useState<Lang>(
    allowedLangs.includes(defaultLang) ? defaultLang : allowedLangs[0]!,
  )

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || disabled) return
    onSend(t, from)
    setText('')
  }

  const placeholder =
    from === 'bn' ? 'লিখুন…' : from === 'zh' ? '输入…' : 'Type a message…'

  return (
    <form
      onSubmit={handleSubmit}
      className="safe-pb flex items-end gap-2 border-t border-white/5 bg-slate-950/80 px-3 pt-2 backdrop-blur-xl"
    >
      <div className="flex rounded-xl bg-slate-900 p-0.5 ring-1 ring-white/10">
        {allowedLangs.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setFrom(l)}
            className={`rounded-lg px-2 py-2 text-[11px] font-semibold ${
              from === l ? 'bg-teal-500 text-slate-950' : 'text-slate-400'
            }`}
            aria-label={`Source ${l}`}
          >
            {LANG_SHORT[l]}
          </button>
        ))}
      </div>
      <label htmlFor="typed-msg" className="sr-only">
        Type a message
      </label>
      <input
        id="typed-msg"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className={`min-w-0 flex-1 rounded-xl border-0 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 ring-1 ring-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 ${
          from === 'bn' ? 'font-bn' : from === 'zh' ? 'font-zh' : 'font-en'
        }`}
        disabled={disabled}
        autoComplete="off"
        enterKeyHint="send"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 hover:bg-teal-400 disabled:opacity-40"
        aria-label="Send message"
      >
        Send
      </button>
    </form>
  )
}
