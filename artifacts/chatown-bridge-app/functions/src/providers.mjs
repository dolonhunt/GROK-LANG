/**
 * Provider abstraction: gemini | nllb | google | libre (free chain)
 * Supports en | bn | zh
 */

const PROVIDER = (process.env.TRANSLATE_PROVIDER || 'libre').toLowerCase()

export function getProviderName() {
  return PROVIDER
}

export async function translateText(text, from, to) {
  switch (PROVIDER) {
    case 'gemini':
      return geminiTranslate(text, from, to)
    case 'google':
      return googleTranslate(text, from, to)
    case 'nllb':
      return nllbTranslate(text, from, to)
    case 'mock':
      return mockTranslate(text, from, to)
    case 'libre':
    default:
      return freeChain(text, from, to)
  }
}

/** Map app codes → provider codes */
function toLibre(code) {
  if (code === 'zh') return 'zh'
  if (code === 'bn') return 'bn'
  return 'en'
}

function toGtx(code) {
  if (code === 'zh') return 'zh-CN'
  if (code === 'bn') return 'bn'
  return 'en'
}

function toMyMemory(code) {
  if (code === 'zh') return 'zh-CN'
  if (code === 'bn') return 'bn'
  return 'en'
}

async function freeChain(text, from, to) {
  const errors = []
  for (const fn of [libreTranslate, myMemoryTranslate, gtxTranslate, mockTranslate]) {
    try {
      return await fn(text, from, to)
    } catch (e) {
      errors.push(`${fn.name}: ${e instanceof Error ? e.message : e}`)
    }
  }
  throw new Error(`All free providers failed: ${errors.join(' | ')}`)
}

async function libreTranslate(text, from, to) {
  const base = (process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com').replace(/\/$/, '')
  const apiKey = process.env.LIBRETRANSLATE_API_KEY || ''
  const body = {
    q: text,
    source: toLibre(from),
    target: toLibre(to),
    format: 'text',
  }
  if (apiKey) body.api_key = apiKey
  const res = await fetch(`${base}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!data?.translatedText) throw new Error('Empty libre translation')
  return data.translatedText
}

async function myMemoryTranslate(text, from, to) {
  const pair = `${toMyMemory(from)}|${toMyMemory(to)}`
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  const out = data?.responseData?.translatedText
  if (!out) throw new Error('Empty MyMemory translation')
  if (/INVALID|MYMEMORY WARNING/i.test(out)) throw new Error(out)
  return out
}

async function gtxTranslate(text, from, to) {
  const sl = toGtx(from)
  const tl = toGtx(to)
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=` +
    encodeURIComponent(text)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 ChatownBridge/0.2' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('Bad gtx shape')
  const out = data[0].map((part) => part[0]).join('')
  if (!out) throw new Error('Empty gtx translation')
  return out
}

const MOCK = {
  // en
  hello: { en: 'hello', bn: 'হ্যালো', zh: '你好' },
  thanks: { en: 'thank you', bn: 'ধন্যবাদ', zh: '谢谢' },
  'thank you': { en: 'thank you', bn: 'ধন্যবাদ', zh: '谢谢' },
  yes: { en: 'yes', bn: 'হ্যাঁ', zh: '是' },
  no: { en: 'no', bn: 'না', zh: '不' },
  goodbye: { en: 'goodbye', bn: 'বিদায়', zh: '再见' },
  welcome: { en: 'welcome', bn: 'স্বাগতম', zh: '欢迎' },
  // bn
  হ্যালো: { en: 'hello', bn: 'হ্যালো', zh: '你好' },
  ধন্যবাদ: { en: 'thank you', bn: 'ধন্যবাদ', zh: '谢谢' },
  নমস্কার: { en: 'hello', bn: 'নমস্কার', zh: '您好' },
  হ্যাঁ: { en: 'yes', bn: 'হ্যাঁ', zh: '是' },
  না: { en: 'no', bn: 'না', zh: '不' },
  বিদায়: { en: 'goodbye', bn: 'বিদায়', zh: '再见' },
  // zh
  你好: { en: 'hello', bn: 'হ্যালো', zh: '你好' },
  谢谢: { en: 'thank you', bn: 'ধন্যবাদ', zh: '谢谢' },
  您好: { en: 'hello', bn: 'নমস্কার', zh: '您好' },
  是: { en: 'yes', bn: 'হ্যাঁ', zh: '是' },
  不: { en: 'no', bn: 'না', zh: '不' },
  再见: { en: 'goodbye', bn: 'বিদায়', zh: '再见' },
  欢迎: { en: 'welcome', bn: 'স্বাগতম', zh: '欢迎' },
  我来自孟加拉国: { en: 'I am from Bangladesh', bn: 'আমি বাংলাদেশ থেকে এসেছি', zh: '我来自孟加拉国' },
  'আমি বাংলাদেশ থেকে এসেছি': {
    en: 'I am from Bangladesh',
    bn: 'আমি বাংলাদেশ থেকে এসেছি',
    zh: '我来自孟加拉国',
  },
}

function mockTranslate(text, from, to) {
  const t = text.trim()
  const key = t.toLowerCase()
  const row = MOCK[t] || MOCK[key]
  if (row && row[to]) return Promise.resolve(row[to])
  // prefix tag so UI still works offline
  const tag = { en: '[en]', bn: '[bn]', zh: '[zh]' }
  return Promise.resolve(`${tag[to] || ''} ${t}`.trim())
}

async function geminiTranslate(text, from, to) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set')
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  const langName = { bn: 'Bengali', zh: 'Chinese (Simplified)', en: 'English' }
  const prompt = `Translate the following ${langName[from] || from} text to ${langName[to] || to}. Output ONLY the translation, no quotes or explanation.\n\n${text}`
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    },
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  const out = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!out) throw new Error('Empty Gemini translation')
  return out
}

async function googleTranslate(text, from, to) {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!key) throw new Error('GOOGLE_TRANSLATE_API_KEY not set')
  const url = `https://translation.googleapis.com/language/translate/v2?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: toGtx(from),
      target: toGtx(to),
      format: 'text',
    }),
  })
  if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`)
  const data = await res.json()
  const out = data?.data?.translations?.[0]?.translatedText
  if (!out) throw new Error('Empty Google translation')
  return out
}

async function nllbTranslate(text, from, to) {
  const base = process.env.NLLB_URL
  if (!base) throw new Error('NLLB_URL not set')
  const code = { bn: 'ben_Beng', zh: 'zho_Hans', en: 'eng_Latn' }
  const res = await fetch(`${base.replace(/\/$/, '')}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.NLLB_API_KEY ? { Authorization: `Bearer ${process.env.NLLB_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      text,
      source: code[from],
      target: code[to],
    }),
  })
  if (!res.ok) throw new Error(`NLLB HTTP ${res.status}`)
  const data = await res.json()
  const out = data?.translation || data?.translated_text || data?.text
  if (!out) throw new Error('Empty NLLB translation')
  return out
}

export const SUPPORTED_LANGS = ['en', 'bn', 'zh']
