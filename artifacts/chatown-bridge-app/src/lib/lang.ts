import type { Lang, Message, UserLang } from './types'

/** Fill translations for all of en/bn/zh when possible (src + one target). */
export function pickTranslation(msg: Message, want: Lang): string {
  if (msg.srcLang === want) return msg.srcText
  return msg.translations[want] || msg.translations.en || msg.translations.bn || msg.translations.zh || msg.srcText
}

/** Target language when speaking TO China (always zh from en/bn). */
export function toChina(from: UserLang | Lang): Lang {
  return from === 'zh' ? 'en' : 'zh'
}

/** When boss speaks Chinese, output in user's preferred language. */
export function fromChina(userLang: UserLang): Lang {
  return userLang
}

export function displayFontClass(lang: Lang): string {
  if (lang === 'bn') return 'font-bn'
  if (lang === 'zh') return 'font-zh'
  return 'font-en'
}
