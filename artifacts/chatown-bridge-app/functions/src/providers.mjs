/**
 * Provider abstraction: gemini | nllb | google | libre (free chain)
 * Secrets only via process.env — never client.
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

const LANG = { bn: 'bn', zh: 'zh' }

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
    source: LANG[from] || from,
    target: LANG[to] || to,
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
  const pair = `${from === 'zh' ? 'zh-CN' : from}|${to === 'zh' ? 'zh-CN' : to}`
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  const out = data?.responseData?.translatedText
  if (!out) throw new Error('Empty MyMemory translation')
  if (/INVALID|MYMEMORY WARNING/i.test(out)) throw new Error(out)
  return out
}

/** Unofficial Google free endpoint (client=gtx). Last-resort free path only. */
async function gtxTranslate(text, from, to) {
  const sl = from === 'zh' ? 'zh-CN' : from
  const tl = to === 'zh' ? 'zh-CN' : to
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=` +
    encodeURIComponent(text)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 ChatownBridge/0.1' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  // shape: [[["translated","source",...],...], ...]
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('Bad gtx shape')
  const out = data[0].map((part) => part[0]).join('')
  if (!out) throw new Error('Empty gtx translation')
  return out
}

const MOCK_BN_ZH = {
  হ্যালো: '你好',
  'হ্যালো!': '你好！',
  ধন্যবাদ: '谢谢',
  'ধন্যবাদ।': '谢谢。',
  নমস্কার: '您好',
  আমি: '我',
  ভালো: '好',
  আপনি: '你',
  কেমন: '怎么样',
  আছেন: '好吗',
  'কেমন আছেন?': '你好吗？',
  'কেমন আছো?': '你好吗？',
  হ্যাঁ: '是',
  না: '不',
  বিদায়: '再见',
  স্বাগতম: '欢迎',
  দয়া: '请',
  করে: '请',
  'একটু অপেক্ষা করুন': '请稍等',
  'আমার নাম': '我的名字是',
  'আপনার নাম কি?': '你叫什么名字？',
  'আমি বাংলাদেশ থেকে এসেছি': '我来自孟加拉国',
  'আমি চীন থেকে এসেছি': '我来自中国',
}

const MOCK_ZH_BN = Object.fromEntries(
  Object.entries(MOCK_BN_ZH).map(([bn, zh]) => [zh, bn]),
)

function mockTranslate(text, from, to) {
  const t = text.trim()
  if (from === 'bn' && to === 'zh') {
    if (MOCK_BN_ZH[t]) return Promise.resolve(MOCK_BN_ZH[t])
    // word-ish join
    const parts = t.split(/\s+/)
    const mapped = parts.map((p) => MOCK_BN_ZH[p] || p)
    if (mapped.some((p, i) => p !== parts[i])) return Promise.resolve(mapped.join(''))
    return Promise.resolve(`[zh] ${t}`)
  }
  if (from === 'zh' && to === 'bn') {
    if (MOCK_ZH_BN[t]) return Promise.resolve(MOCK_ZH_BN[t])
    if (MOCK_BN_ZH[t]) return Promise.resolve(t) // already?
    return Promise.resolve(`[bn] ${t}`)
  }
  return Promise.resolve(t)
}

async function geminiTranslate(text, from, to) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set')
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  const langName = { bn: 'Bengali', zh: 'Chinese (Simplified)' }
  const prompt = `Translate the following ${langName[from]} text to ${langName[to]}. Output ONLY the translation, no quotes or explanation.\n\n${text}`
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
      source: from === 'zh' ? 'zh-CN' : from,
      target: to === 'zh' ? 'zh-CN' : to,
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
  const code = { bn: 'ben_Beng', zh: 'zho_Hans' }
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
