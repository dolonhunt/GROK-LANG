import type { GlossaryEntry, Lang } from './types'
import { getSetting, setSetting } from './store'

const KEY = 'glossary'

export async function loadGlossary(): Promise<GlossaryEntry[]> {
  return getSetting<GlossaryEntry[]>(KEY, [])
}

export async function saveGlossary(entries: GlossaryEntry[]): Promise<void> {
  await setSetting(KEY, entries)
}

/**
 * After MT: if source text contained a glossary term, prefer the custom target.
 * Exact full-string match replaces the whole translation.
 */
export function ensureGlossary(
  srcText: string,
  translation: string,
  from: Lang,
  to: Lang,
  entries: GlossaryEntry[],
): string {
  let out = translation
  const relevant = entries
    .filter((e) => e.from === from && e.to === to)
    .sort((a, b) => b.source.length - a.source.length)
  for (const e of relevant) {
    if (!srcText.toLowerCase().includes(e.source.toLowerCase())) continue
    if (srcText.trim().toLowerCase() === e.source.toLowerCase()) {
      out = e.target
      continue
    }
    const re = new RegExp(escapeReg(e.source), 'gi')
    out = out.replace(re, e.target)
  }
  return out
}

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
