export type Lang = 'bn' | 'zh'
export type AppMode = 'local' | 'shared'

export interface Message {
  id: string
  speakerId: string
  speakerName?: string
  srcLang: Lang
  srcText: string
  translations: { bn?: string; zh?: string }
  /** optional romanization / pinyin of src or translation */
  romanizations?: { bn?: string; zh?: string }
  ts: number
}

export interface Participant {
  id: string
  uid: string
  deviceId: string
  name: string
  lang: Lang
  speakerLabel?: string
  joinedAt: number
}

export interface Room {
  id: string
  code: string
  createdAt: number
  expiresAt: number
  speaking?: { participantId: string; name: string; until: number } | null
  maxParticipants: number
}

export interface TranslateRequest {
  text: string
  from: Lang
  to: Lang
}

export interface TranslateResponse {
  translation: string
  cached?: boolean
  provider?: string
}

export type SpeechStatus =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'error'
  | 'unsupported'
  | 'denied'

export interface SpeechError {
  code: 'permission-denied' | 'no-speech' | 'network' | 'unsupported' | 'aborted' | 'other'
  message: string
}

export interface GlossaryEntry {
  id: string
  source: string
  target: string
  from: Lang
  to: Lang
}

export interface Phrase {
  id: string
  bn: string
  zh: string
  category: string
}
