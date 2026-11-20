import { useState, type FormEvent } from 'react'
import type { Lang } from '../lib/types'

interface Props {
  defaultLang?: Lang
  disabled?: boolean
  onSend: (text: string, from: Lang) => void
}

export function TextInputBar({ defaultLang = 'bn', disabled, onSend }: Props) {
  const [text, setText] = useState('')
  const [from, setFrom] = useState<Lang>(defaultLang)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || disabled) return
    onSend(t, from)
    setText('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="safe-pb flex items-end gap-2 border-t border-slate-800 bg-slate-950/95 px-3 pt-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="from-lang" className="sr-only">
          Source language
        </label>
        <select
          id="from-lang"
          value={from}
          onChange={(e) => setFrom(e.target.value as Lang)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-200"
          aria-label="Source language"
        >
          <option value="bn">বাংলা</option>
          <option value="zh">中文</option>
        </select>
      </div>
      <label htmlFor="typed-msg" className="sr-only">
        Type a message
      </label>
      <input
        id="typed-msg"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={from === 'bn' ? 'লিখুন…' : '输入…'}
        className={`min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none ${
          from === 'bn' ? 'font-bn' : 'font-zh'
        }`}
        disabled={disabled}
        autoComplete="off"
        enterKeyHint="send"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
        aria-label="Send message"
      >
        Send
      </button>
    </form>
  )
}
