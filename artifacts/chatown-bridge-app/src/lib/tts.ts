import type { Lang } from './types'

const LANG_MAP: Record<Lang, string> = {
  en: 'en-US',
  bn: 'bn-BD',
  zh: 'zh-CN',
}

export interface VoiceInfo {
  available: boolean
  voiceName?: string
  notice?: string
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
  if (lang === 'en' && L.startsWith('en')) s += 60
  if (lang === 'bn' && (L.startsWith('bn') || L.includes('bengali') || L.includes('bangla'))) s += 60
  if (lang === 'zh' && (L.startsWith('zh') || L.includes('chinese') || L.includes('cmn'))) s += 60
  if (v.localService) s += 10
  if (v.default) s += 5
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
  if (voices.length) {
    const en = voices.find((v) => v.lang.toLowerCase().startsWith('en'))
    return { voice: en || voices[0]!, fallback: true }
  }
  return { voice: null, fallback: false }
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
          ? 'No Bangla voice. Install বাংলা TTS in system settings.'
          : lang === 'zh'
            ? 'No Chinese voice installed.'
            : 'No English voice installed.',
    }
  }
  if (fallback && lang === 'bn') {
    return {
      available: true,
      voiceName: voice.name,
      fallback: true,
      notice: `Bangla voice missing — using “${voice.name}”. Install বাংলা TTS for better audio.`,
    }
  }
  return { available: true, voiceName: voice.name, fallback }
}

export type SpeakOptions = { rate?: number }

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
    const run = () => {
      const u = new SpeechSynthesisUtterance(text)
      u.voice = voice
      u.lang = fallback && lang !== 'en' ? voice.lang : LANG_MAP[lang]
      u.rate = opts.rate ?? (lang === 'zh' ? 0.92 : lang === 'bn' ? 0.9 : 1)
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
