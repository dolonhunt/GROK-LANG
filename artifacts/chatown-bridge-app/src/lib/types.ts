export type Lang = 'bn' | 'zh' | 'en'
export type AppMode = 'local' | 'shared'
export type LayoutMode = 'boss' | 'dual'

/** Languages the user typically needs for output / UI */
export type UserLang = 'bn' | 'en'

export interface Message {
  id: string
  speakerId: string
  speakerName?: string
  srcLang: Lang
  srcText: string
  translations: { bn?: string; zh?: string; en?: string }
  romanizations?: { bn?: string; zh?: string; en?: string }
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
  en: string
  category: string
}

export const LANGS: Lang[] = ['en', 'bn', 'zh']

export const LANG_LABEL: Record<Lang, string> = {
  en: 'English',
  bn: 'বাংলা',
  zh: '中文',
}

export const LANG_SHORT: Record<Lang, string> = {
  en: 'EN',
  bn: 'BN',
  zh: '中文',
}

export const SPEECH_LOCALE: Record<Lang, string> = {
  en: 'en-US',
  bn: 'bn-BD',
  zh: 'zh-CN',
}

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'bn' || v === 'zh'
}

