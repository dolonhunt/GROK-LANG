import type { Lang, SpeechError, SpeechStatus } from './types'

export type SpeechCallbacks = {
  onInterim?: (text: string) => void
  onFinal?: (text: string) => void
  onStatus?: (status: SpeechStatus) => void
  onError?: (err: SpeechError) => void
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isSpeechSupported(): boolean {
  return getSpeechRecognitionCtor() !== null
}

const LANG_MAP: Record<Lang, string> = {
  en: 'en-US',
  bn: 'bn-BD',
  zh: 'zh-CN',
}

export class SpeechSession {
  private rec: SpeechRecognition | null = null
  private active = false
  private cbs: SpeechCallbacks = {}

  constructor(cbs: SpeechCallbacks = {}) {
    this.cbs = cbs
  }

  setCallbacks(cbs: SpeechCallbacks) {
    this.cbs = { ...this.cbs, ...cbs }
  }

  start(lang: Lang): boolean {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      this.cbs.onStatus?.('unsupported')
      this.cbs.onError?.({
        code: 'unsupported',
        message: 'Speech recognition is not supported in this browser. Use typed input.',
      })
      return false
    }

    this.abort()
    this.rec = new Ctor()
    this.rec.lang = LANG_MAP[lang]
    this.rec.interimResults = true
    this.rec.continuous = false
    this.rec.maxAlternatives = 1

    this.rec.onstart = () => {
      this.active = true
      this.cbs.onStatus?.('listening')
    }

    this.rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = ''
      let finalText = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        const t = r[0]?.transcript ?? ''
        if (r.isFinal) finalText += t
        else interim += t
      }
      if (interim) this.cbs.onInterim?.(interim)
      if (finalText) {
        this.cbs.onStatus?.('processing')
        this.cbs.onFinal?.(finalText.trim())
      }
    }

    this.rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      this.active = false
      const code = mapError(ev.error)
      if (code === 'aborted') {
        this.cbs.onStatus?.('idle')
        return
      }
      this.cbs.onStatus?.(code === 'permission-denied' ? 'denied' : 'error')
      this.cbs.onError?.({
        code,
        message: humanError(code, ev.error),
      })
    }

    this.rec.onend = () => {
      this.active = false
      this.rec = null
    }

    try {
      this.rec.start()
      return true
    } catch (e) {
      this.active = false
      this.cbs.onStatus?.('error')
      this.cbs.onError?.({
        code: 'other',
        message: e instanceof Error ? e.message : 'Failed to start mic',
      })
      return false
    }
  }

  /** End listening and allow final results (use on pointer-up). */
  stop() {
    if (this.rec) {
      try {
        this.rec.stop()
      } catch {
        /* ignore */
      }
      // keep rec until onend; nulling immediately can drop final result on some browsers
    }
    this.active = false
  }

  /** Hard cancel without final results. */
  abort() {
    if (this.rec) {
      try {
        this.rec.abort()
      } catch {
        /* ignore */
      }
      this.rec = null
    }
    this.active = false
  }

  isActive() {
    return this.active
  }
}

function mapError(error: string): SpeechError['code'] {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission-denied'
    case 'no-speech':
      return 'no-speech'
    case 'network':
      return 'network'
    case 'aborted':
      return 'aborted'
    default:
      return 'other'
  }
}

function humanError(code: SpeechError['code'], raw: string): string {
  switch (code) {
    case 'permission-denied':
      return 'Microphone permission denied. Enable mic access or type your message.'
    case 'no-speech':
      return 'No speech detected. Hold the button and speak clearly.'
    case 'network':
      return 'Speech network error. Check connectivity or type instead.'
    case 'unsupported':
      return 'Speech recognition not supported. Use typed input.'
    default:
      return `Speech error: ${raw}`
  }
}

interface SpeechRecognition extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}
