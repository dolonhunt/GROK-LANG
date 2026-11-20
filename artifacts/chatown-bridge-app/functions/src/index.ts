import { onRequest } from 'firebase-functions/v2/https'
import { defineString, defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { createHash } from 'node:crypto'

initializeApp()

const translateProvider = defineString('TRANSLATE_PROVIDER', { default: 'libre' })
const geminiKey = defineSecret('GEMINI_API_KEY')
const googleKey = defineSecret('GOOGLE_TRANSLATE_API_KEY')
const nllbUrl = defineString('NLLB_URL', { default: '' })
const libreUrl = defineString('LIBRETRANSLATE_URL', { default: 'https://libretranslate.com' })

function cacheKey(from: string, to: string, text: string): string {
  return createHash('sha256').update(`${from}|${to}|${text}`).digest('hex')
}

// In-memory rate limit per instance (also use Firestore for multi-instance in Phase 2)
const rateBuckets = new Map<string, number[]>()
const RATE_MAX = 30
const RATE_WINDOW = 60_000

function rateOk(key: string): boolean {
  const now = Date.now()
  let arr = (rateBuckets.get(key) || []).filter((t) => now - t < RATE_WINDOW)
  if (arr.length >= RATE_MAX) {
    rateBuckets.set(key, arr)
    return false
  }
  arr.push(now)
  rateBuckets.set(key, arr)
  return true
}

async function callProvider(
  text: string,
  from: string,
  to: string,
  provider: string,
  secrets: { gemini?: string; google?: string },
): Promise<string> {
  if (provider === 'gemini' && secrets.gemini) {
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    const langName: Record<string, string> = { bn: 'Bengali', zh: 'Chinese (Simplified)' }
    const prompt = `Translate the following ${langName[from]} text to ${langName[to]}. Output ONLY the translation, no quotes or explanation.\n\n${text}`
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${secrets.gemini}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        }),
      },
    )
    if (!res.ok) throw new Error(`Gemini ${res.status}`)
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!out) throw new Error('Empty Gemini')
    return out
  }

  if (provider === 'google' && secrets.google) {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${secrets.google}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: from === 'zh' ? 'zh-CN' : from,
          target: to === 'zh' ? 'zh-CN' : to,
          format: 'text',
        }),
      },
    )
    if (!res.ok) throw new Error(`Google ${res.status}`)
    const data = (await res.json()) as {
      data?: { translations?: { translatedText?: string }[] }
    }
    const out = data?.data?.translations?.[0]?.translatedText
    if (!out) throw new Error('Empty Google')
    return out
  }

  if (provider === 'nllb') {
    const base = nllbUrl.value()
    if (!base) throw new Error('NLLB_URL not set')
    const code: Record<string, string> = { bn: 'ben_Beng', zh: 'zho_Hans' }
    const res = await fetch(`${base.replace(/\/$/, '')}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: code[from], target: code[to] }),
    })
    if (!res.ok) throw new Error(`NLLB ${res.status}`)
    const data = (await res.json()) as {
      translation?: string
      translated_text?: string
      text?: string
    }
    const out = data.translation || data.translated_text || data.text
    if (!out) throw new Error('Empty NLLB')
    return out
  }

  // libre / default
  const base = libreUrl.value().replace(/\/$/, '')
  const res = await fetch(`${base}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: from,
      target: to,
      format: 'text',
    }),
  })
  if (res.ok) {
    const data = (await res.json()) as { translatedText?: string }
    if (data.translatedText) return data.translatedText
  }
  // MyMemory fallback
  const pair = `${from === 'zh' ? 'zh-CN' : from}|${to === 'zh' ? 'zh-CN' : to}`
  const mm = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`,
  )
  if (!mm.ok) throw new Error(`MyMemory ${mm.status}`)
  const mdata = (await mm.json()) as { responseData?: { translatedText?: string } }
  const out = mdata?.responseData?.translatedText
  if (!out) throw new Error('Empty fallback translation')
  return out
}

export const translate = onRequest(
  {
    cors: true,
    secrets: [geminiKey, googleKey],
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('')
      return
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' })
      return
    }

    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : null) ||
      req.ip ||
      'unknown'
    const uid = (req.headers['x-uid'] as string) || ip
    if (!rateOk(uid)) {
      res.status(429).json({ error: 'Rate limit exceeded (30/min)', code: 'rate_limit' })
      return
    }

    const { text, from, to } = req.body || {}
    const trimmed = typeof text === 'string' ? text.trim() : ''
    if (!trimmed || !['bn', 'zh'].includes(from) || !['bn', 'zh'].includes(to)) {
      res.status(400).json({ error: 'Invalid body: need text, from∈{bn,zh}, to∈{bn,zh}' })
      return
    }
    if (from === to) {
      res.json({ translation: trimmed, cached: true, provider: 'identity' })
      return
    }

    const key = cacheKey(from, to, trimmed)
    const db = getFirestore()
    const cacheRef = db.collection('cache').doc(key)
    const snap = await cacheRef.get()
    if (snap.exists) {
      const data = snap.data()!
      res.json({
        translation: data.translation as string,
        cached: true,
        provider: (data.provider as string) || translateProvider.value(),
      })
      return
    }

    try {
      const provider = translateProvider.value()
      const translation = await callProvider(trimmed, from, to, provider, {
        gemini: geminiKey.value(),
        google: googleKey.value(),
      })
      await cacheRef.set({
        from,
        to,
        text: trimmed,
        translation,
        provider,
        createdAt: FieldValue.serverTimestamp(),
      })
      res.json({ translation, cached: false, provider })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: e instanceof Error ? e.message : 'Translate failed' })
    }
  },
)
