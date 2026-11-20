import { useState } from 'react'
import type { Lang } from '../lib/types'
import { LANG_LABEL } from '../lib/types'

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
  const [lang, setLang] = useState<Lang>('en')
  const [code, setCode] = useState(initialCode || '')
  const [speakerLabel, setSpeakerLabel] = useState('')

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Shared room</h2>
        <button type="button" onClick={onBack} className="text-sm text-slate-400 hover:text-white">
          ← Back
        </button>
      </div>

      <div className="flex rounded-xl bg-slate-900/80 p-1 ring-1 ring-white/10">
        {(['create', 'join'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize ${
              tab === t ? 'bg-teal-500 text-slate-950' : 'text-slate-400'
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
          className="mt-1 w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm text-white ring-1 ring-white/10"
          placeholder="Your name"
          maxLength={32}
        />
      </label>

      <fieldset className="text-xs text-slate-400">
        <legend className="mb-1">My language</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['en', 'bn', 'zh'] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`rounded-xl py-2.5 text-sm ring-1 ${
                lang === l
                  ? 'bg-teal-500/20 text-teal-100 ring-teal-500/40'
                  : 'bg-slate-900 text-slate-300 ring-white/10'
              }`}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
      </fieldset>

      {tab === 'join' && (
        <>
          <label className="block text-xs text-slate-400">
            Room code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-xl bg-slate-900 px-3 py-2.5 font-mono text-lg tracking-widest text-white ring-1 ring-white/10"
              placeholder="ABC123"
              maxLength={6}
            />
          </label>
          <label className="block text-xs text-slate-400">
            Speaker label (optional)
            <input
              value={speakerLabel}
              onChange={(e) => setSpeakerLabel(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm text-white ring-1 ring-white/10"
              placeholder="Speaker 2"
              maxLength={20}
            />
          </label>
        </>
      )}

      {error && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-500/30" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy || !name.trim() || (tab === 'join' && code.trim().length < 4)}
        className="rounded-xl bg-teal-500 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
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
