import { useEffect, useState } from 'react'
import type { GlossaryEntry, Lang, Message, Phrase } from '../lib/types'
import { loadGlossary, saveGlossary } from '../lib/glossary'
import { exportDocx, exportPdf, exportTxt } from '../lib/export'
import { summarizeMeeting } from '../lib/summary'
import { PHRASEBOOK } from '../data/phrasebook'
import { v4 as uuidv4 } from 'uuid'

interface Props {
  open: boolean
  onClose: () => void
  messages: Message[]
  viewLang: Lang
  showRomanization: boolean
  onShowRomanization: (v: boolean) => void
  onUsePhrase: (bn: string, zh: string, from: Lang) => void
  glossary: GlossaryEntry[]
  onGlossaryChange: (g: GlossaryEntry[]) => void
}

export function ExtrasDrawer({
  open,
  onClose,
  messages,
  viewLang,
  showRomanization,
  onShowRomanization,
  onUsePhrase,
  glossary,
  onGlossaryChange,
}: Props) {
  const [tab, setTab] = useState<'export' | 'glossary' | 'phrasebook' | 'summary'>('export')
  const [summary, setSummary] = useState('')
  const [sumBusy, setSumBusy] = useState(false)
  const [gSrc, setGSrc] = useState('')
  const [gTgt, setGTgt] = useState('')
  const [gFrom, setGFrom] = useState<Lang>('bn')
  const [phraseQ, setPhraseQ] = useState('')

  useEffect(() => {
    if (!open) return
    void loadGlossary().then(onGlossaryChange)
  }, [open, onGlossaryChange])

  if (!open) return null

  const phrases = PHRASEBOOK.filter(
    (p) =>
      !phraseQ ||
      p.bn.includes(phraseQ) ||
      p.zh.includes(phraseQ) ||
      p.category.toLowerCase().includes(phraseQ.toLowerCase()),
  )

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-950/95 backdrop-blur-sm" role="dialog" aria-modal>
      <div className="safe-pt flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="font-semibold text-teal-200">Extras</h2>
        <button type="button" onClick={onClose} className="text-sm text-slate-300" aria-label="Close">
          Close
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-2 py-2 text-xs">
        {(['export', 'glossary', 'phrasebook', 'summary'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-lg px-3 py-1.5 capitalize ${
              tab === t ? 'bg-teal-700 text-white' : 'bg-slate-900 text-slate-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {tab === 'export' && (
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between text-sm">
              <span>Show pinyin / romanization</span>
              <button
                type="button"
                role="switch"
                aria-checked={showRomanization}
                onClick={() => onShowRomanization(!showRomanization)}
                className={`h-6 w-11 rounded-full ${showRomanization ? 'bg-teal-600' : 'bg-slate-700'}`}
              >
                <span
                  className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${
                    showRomanization ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
            <button
              type="button"
              className="rounded-xl bg-slate-800 py-2.5 text-sm"
              onClick={() => exportTxt(messages, viewLang)}
            >
              Export TXT
            </button>
            <button
              type="button"
              className="rounded-xl bg-slate-800 py-2.5 text-sm"
              onClick={() => void exportPdf(messages, viewLang)}
            >
              Export PDF
            </button>
            <button
              type="button"
              className="rounded-xl bg-slate-800 py-2.5 text-sm"
              onClick={() => void exportDocx(messages, viewLang)}
            >
              Export DOCX
            </button>
          </div>
        )}

        {tab === 'glossary' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-400">
              Custom term overrides applied after translation when the source text contains the term.
            </p>
            <div className="flex gap-2">
              <select
                value={gFrom}
                onChange={(e) => setGFrom(e.target.value as Lang)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs"
              >
                <option value="bn">bn→zh</option>
                <option value="zh">zh→bn</option>
              </select>
            </div>
            <input
              value={gSrc}
              onChange={(e) => setGSrc(e.target.value)}
              placeholder="Source term"
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            />
            <input
              value={gTgt}
              onChange={(e) => setGTgt(e.target.value)}
              placeholder="Preferred translation"
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            />
            <button
              type="button"
              className="rounded-xl bg-teal-700 py-2 text-sm font-medium"
              onClick={() => {
                if (!gSrc.trim() || !gTgt.trim()) return
                const entry: GlossaryEntry = {
                  id: uuidv4(),
                  source: gSrc.trim(),
                  target: gTgt.trim(),
                  from: gFrom,
                  to: gFrom === 'bn' ? 'zh' : 'bn',
                }
                const next = [...glossary, entry]
                onGlossaryChange(next)
                void saveGlossary(next)
                setGSrc('')
                setGTgt('')
              }}
            >
              Add term
            </button>
            <ul className="divide-y divide-slate-800 text-sm">
              {glossary.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <span>
                    <span className="text-slate-500">{e.from}→{e.to}</span> {e.source} → {e.target}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-red-400"
                    onClick={() => {
                      const next = glossary.filter((x) => x.id !== e.id)
                      onGlossaryChange(next)
                      void saveGlossary(next)
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
              {glossary.length === 0 && (
                <li className="py-4 text-center text-slate-500">No custom terms yet</li>
              )}
            </ul>
          </div>
        )}

        {tab === 'phrasebook' && (
          <div className="flex flex-col gap-2">
            <input
              value={phraseQ}
              onChange={(e) => setPhraseQ(e.target.value)}
              placeholder="Search phrases…"
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            />
            <ul className="flex flex-col gap-2">
              {phrases.map((p: Phrase) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm"
                >
                  <div className="text-[10px] uppercase text-slate-500">{p.category}</div>
                  <div className="font-bn text-emerald-200">{p.bn}</div>
                  <div className="font-zh text-red-200">{p.zh}</div>
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-teal-400"
                      onClick={() => {
                        onUsePhrase(p.bn, p.zh, 'bn')
                        onClose()
                      }}
                    >
                      Send as bn
                    </button>
                    <button
                      type="button"
                      className="text-xs text-teal-400"
                      onClick={() => {
                        onUsePhrase(p.bn, p.zh, 'zh')
                        onClose()
                      }}
                    >
                      Send as zh
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'summary' && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              disabled={sumBusy || messages.length === 0}
              className="rounded-xl bg-teal-700 py-2.5 text-sm font-medium disabled:opacity-40"
              onClick={async () => {
                setSumBusy(true)
                try {
                  setSummary(await summarizeMeeting(messages, viewLang))
                } finally {
                  setSumBusy(false)
                }
              }}
            >
              {sumBusy ? 'Summarizing…' : 'Generate meeting summary'}
            </button>
            {summary && (
              <pre className="whitespace-pre-wrap rounded-xl bg-slate-900 p-3 text-sm text-slate-200">
                {summary}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
