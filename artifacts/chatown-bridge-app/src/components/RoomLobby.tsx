import { useState } from 'react'
import type { Lang } from '../lib/types'

interface Props {
  onCreate: (name: string, lang: Lang) => Promise<void>
  onJoin: (code: string, name: string, lang: Lang, speakerLabel?: string) => Promise<void>
  onBack: () => void
  busy?: boolean
  error?: string | null
  initialCode?: string
}

export function RoomLobby({ onCreate, onJoin, onBack, busy, error, initialCode }: Props) {
  const [tab, setTab] = useState<'create' | 'join'>(initialCode ? 'join' : 'create')
  const [name, setName] = useState('')
  const [lang, setLang] = useState<Lang>('bn')
  const [code, setCode] = useState(initialCode || '')
  const [speakerLabel, setSpeakerLabel] = useState('')

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-teal-200">Shared room</h2>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← Local mode
        </button>
      </div>

      <div className="flex rounded-xl bg-slate-900 p-1">
        {(['create', 'join'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize ${
              tab === t ? 'bg-teal-700 text-white' : 'text-slate-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <label className="block text-xs text-slate-400">
        Display name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm"
          placeholder="Your name"
          maxLength={32}
        />
      </label>

      <fieldset className="text-xs text-slate-400">
        <legend className="mb-1">My language</legend>
        <div className="flex gap-2">
          <LangBtn active={lang === 'bn'} onClick={() => setLang('bn')} label="বাংলা" />
          <LangBtn active={lang === 'zh'} onClick={() => setLang('zh')} label="中文" />
        </div>
      </fieldset>

      {tab === 'join' && (
        <>
          <label className="block text-xs text-slate-400">
            Room code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-lg tracking-widest"
              placeholder="ABC123"
              maxLength={6}
              autoCapitalize="characters"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Speaker label (optional, multi-user device)
            <input
              value={speakerLabel}
              onChange={(e) => setSpeakerLabel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm"
              placeholder="Speaker 2"
              maxLength={20}
            />
          </label>
        </>
      )}

      {error && (
        <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy || !name.trim() || (tab === 'join' && code.trim().length < 4)}
        className="rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
        onClick={() => {
          if (tab === 'create') void onCreate(name.trim(), lang)
          else void onJoin(code.trim(), name.trim(), lang, speakerLabel.trim() || undefined)
        }}
      >
        {busy ? 'Please wait…' : tab === 'create' ? 'Create room' : 'Join room'}
      </button>
    </div>
  )
}

function LangBtn({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border py-2.5 text-sm ${
        active
          ? 'border-teal-500 bg-teal-900/40 text-teal-100'
          : 'border-slate-700 bg-slate-950 text-slate-300'
      }`}
    >
      {label}
    </button>
  )
}
