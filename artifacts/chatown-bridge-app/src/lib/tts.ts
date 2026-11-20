import type { Lang } from './types'

const LANG_MAP: Record<Lang, string> = {
  bn: 'bn-BD',
  zh: 'zh-CN',
}

export interface VoiceInfo {
  available: boolean
  voiceName?: string
  notice?: string
  /** true if we will use a non-native fallback voice */
  fallback?: boolean
}

let voicesLoaded = false

function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis
    if (!synth) {
      resolve([])
      return
    }
    const existing = synth.getVoices()
    if (existing.length || voicesLoaded) {
      voicesLoaded = true
      resolve(existing)
      return
    }
    const onVoices = () => {
      voicesLoaded = true
      synth.removeEventListener('voiceschanged', onVoices)
      resolve(synth.getVoices())
    }
    synth.addEventListener('voiceschanged', onVoices)
    setTimeout(() => {
      voicesLoaded = true
      resolve(synth.getVoices())
    }, 800)
  })
}

function scoreVoice(v: SpeechSynthesisVoice, lang: Lang): number {
  const L = v.lang.replace('_', '-').toLowerCase()
  const target = LANG_MAP[lang].toLowerCase()
  let s = 0
  if (L === target) s += 100
  if (L.startsWith(lang === 'bn' ? 'bn' : 'zh')) s += 50
  if (lang === 'bn' && (L.includes('bengali') || L.includes('bangla'))) s += 40
  if (lang === 'zh' && (L.includes('chinese') || L.includes('cmn'))) s += 40
  if (v.localService) s += 10
  if (v.default) s += 5
  // prefer female/clear names lightly — skip
  return s
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: Lang,
): { voice: SpeechSynthesisVoice | null; fallback: boolean } {
  const ranked = [...voices]
    .map((v) => ({ v, s: scoreVoice(v, lang) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
  if (ranked[0]) return { voice: ranked[0].v, fallback: ranked[0].s < 50 }

  // Last resort: any voice (so "aloud" still works for the user)
  if (voices.length) {
    const en = voices.find((v) => v.lang.toLowerCase().startsWith('en'))
    return { voice: en || voices[0]!, fallback: true }
  }
  return { voice: null, fallback: false }
}

export async function listVoicesBrief(): Promise<string[]> {
  const voices = await ensureVoices()
  return voices.map((v) => `${v.name} (${v.lang})`)
}

export async function checkVoice(lang: Lang): Promise<VoiceInfo> {
  if (!window.speechSynthesis) {
    return { available: false, notice: 'Speech synthesis not supported in this browser.' }
  }
  const voices = await ensureVoices()
  const { voice, fallback } = pickVoice(voices, lang)
  if (!voice) {
    return {
      available: false,
      notice:
        lang === 'bn'
          ? 'No voice for Bangla. On Android: Settings → Google → Speech → install বাংলা. On iPhone: Settings → Accessibility → Spoken Content → Voices → Bangla.'
          : 'No Chinese voice installed.',
    }
  }
  if (fallback && lang === 'bn') {
    return {
      available: true,
      voiceName: voice.name,
      fallback: true,
      notice: `Bangla system voice missing — will read aloud with “${voice.name}” (install বাংলা voice for better quality).`,
    }
  }
  return { available: true, voiceName: voice.name, fallback }
}

export type SpeakOptions = {
  /** 0.6–1.4, default slightly slower for comprehension */
  rate?: number
  /** force re-speak even if same text */
  force?: boolean
}

let lastUtteranceText = ''

export async function speak(
  text: string,
  lang: Lang,
  opts: SpeakOptions = {},
): Promise<{ ok: boolean; notice?: string; voiceName?: string }> {
  if (!text.trim()) return { ok: false }
  if (!window.speechSynthesis) {
    return { ok: false, notice: 'Speech synthesis not supported.' }
  }

  const voices = await ensureVoices()
  const { voice, fallback } = pickVoice(voices, lang)
  if (!voice) {
    const info = await checkVoice(lang)
    return { ok: false, notice: info.notice }
  }

  return new Promise((resolve) => {
    window.speechSynthesis.cancel()
    // Chrome bug: cancel then speak sometimes needs a tick
    const run = () => {
      const u = new SpeechSynthesisUtterance(text)
      u.voice = voice
      u.lang = fallback && lang === 'bn' ? voice.lang : LANG_MAP[lang]
      // Boss mode: slower Bangla so you can follow
      u.rate = opts.rate ?? (lang === 'bn' ? 0.9 : lang === 'zh' ? 0.92 : 1)
      u.pitch = 1
      u.volume = 1
      lastUtteranceText = text
      u.onend = () => resolve({ ok: true, voiceName: voice.name })
      u.onerror = () => resolve({ ok: false, notice: 'Playback failed — tap 🔊 to retry.' })
      window.speechSynthesis.speak(u)
    }
    setTimeout(run, 40)
  })
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel()
}

export function getLastSpokenText() {
  return lastUtteranceText
}

/** Unlock audio on iOS — call once from a user tap. */
export function unlockAudio(): void {
  if (!window.speechSynthesis) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    window.speechSynthesis.speak(u)
    window.speechSynthesis.cancel()
  } catch {
    /* ignore */
  }
}
