/**
 * Local Phase 1–3 API: translate + shared rooms (in-memory).
 * POST /translate, room CRUD, speaking lock, optional whisper stub.
 */
import { createServer } from 'node:http'
import { translationCacheKey } from './cacheKey.mjs'
import { translateText, getProviderName } from './providers.mjs'
import { checkRateLimit } from './rateLimit.mjs'
import { randomBytes } from 'node:crypto'

const PORT = Number(process.env.PORT || 5001)
const cache = new Map()
const rooms = new Map() // code -> { room, participants: Map, messages: [] }
const TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_PARTICIPANTS = 10

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Uid')
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function clientKey(req) {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(6)
  let code = ''
  for (let i = 0; i < 6; i++) code += alphabet[bytes[i] % alphabet.length]
  return code
}

function getRoom(code) {
  return rooms.get(String(code || '').toUpperCase())
}

function publicRoom(entry) {
  return {
    room: entry.room,
    participants: [...entry.participants.values()],
    messages: entry.messages,
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
  const path = url.pathname

  try {
    if (req.method === 'GET' && (path === '/' || path === '/health')) {
      return sendJson(res, 200, {
        ok: true,
        provider: getProviderName(),
        cacheSize: cache.size,
        rooms: rooms.size,
      })
    }

    // --- Translate ---
    if (req.method === 'POST' && path === '/translate') {
      const rl = checkRateLimit(clientKey(req))
      if (!rl.ok) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' })
        return res.end(JSON.stringify({ error: 'Rate limit exceeded (30/min)', code: 'rate_limit' }))
      }
      const body = await readJson(req)
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      const from = body.from
      const to = body.to
      if (!text || !['bn', 'zh'].includes(from) || !['bn', 'zh'].includes(to)) {
        return sendJson(res, 400, { error: 'Invalid body: need text, from∈{bn,zh}, to∈{bn,zh}' })
      }
      if (from === to) {
        return sendJson(res, 200, { translation: text, cached: true, provider: 'identity' })
      }
      const key = translationCacheKey(from, to, text)
      if (cache.has(key)) {
        const hit = cache.get(key)
        return sendJson(res, 200, {
          translation: hit.translation,
          cached: true,
          provider: getProviderName(),
        })
      }
      const translation = await translateText(text, from, to)
      cache.set(key, { translation, ts: Date.now() })
      return sendJson(res, 200, { translation, cached: false, provider: getProviderName() })
    }

    // --- Summary (simple) ---
    if (req.method === 'POST' && path === '/summary') {
      const body = await readJson(req)
      const messages = Array.isArray(body.messages) ? body.messages : []
      const lang = body.lang === 'zh' ? 'zh' : 'bn'
      return sendJson(res, 200, {
        summary:
          lang === 'bn'
            ? `সারাংশ: ${messages.length} টি বার্তা।`
            : `摘要：${messages.length} 条消息。`,
      })
    }

    // --- Whisper stub (opt-in only; audio processing placeholder) ---
    if (req.method === 'POST' && path === '/whisper') {
      // Privacy: production should reject unless WHISPER_URL is set and user opted in.
      // This stub never stores audio; returns error directing client to Web Speech.
      const whisperUrl = process.env.WHISPER_URL
      if (!whisperUrl) {
        return sendJson(res, 501, {
          error: 'Whisper VPS not configured (WHISPER_URL). Use Web Speech or type.',
          code: 'whisper_unavailable',
        })
      }
      // Forward multipart would go here; for local we refuse body size abuse
      return sendJson(res, 501, { error: 'Configure reverse proxy to Whisper VPS', code: 'not_implemented' })
    }

    // --- Rooms ---
    if (req.method === 'POST' && path === '/rooms') {
      const body = await readJson(req)
      const code = roomCode()
      const now = Date.now()
      const room = {
        id: code,
        code,
        createdAt: now,
        expiresAt: now + TTL_MS,
        speaking: null,
        maxParticipants: MAX_PARTICIPANTS,
      }
      const participant = {
        id: body.uid || `p-${code}-host`,
        uid: body.uid || `p-${code}-host`,
        deviceId: body.deviceId || 'unknown',
        name: body.name || 'Host',
        lang: body.lang === 'zh' ? 'zh' : 'bn',
        joinedAt: now,
      }
      const entry = {
        room,
        participants: new Map([[participant.id, participant]]),
        messages: [],
      }
      rooms.set(code, entry)
      return sendJson(res, 200, { room, participant })
    }

    const joinMatch = path.match(/^\/rooms\/([A-Za-z0-9]+)\/join$/)
    if (req.method === 'POST' && joinMatch) {
      const code = joinMatch[1].toUpperCase()
      const entry = getRoom(code)
      if (!entry) return sendJson(res, 404, { error: 'Room not found' })
      if (entry.room.expiresAt < Date.now()) return sendJson(res, 410, { error: 'Room expired' })
      if (entry.participants.size >= MAX_PARTICIPANTS) {
        return sendJson(res, 403, { error: 'Room full (max 10)' })
      }
      const body = await readJson(req)
      const participant = {
        id: body.uid || `p-${randomBytes(4).toString('hex')}`,
        uid: body.uid || `p-${randomBytes(4).toString('hex')}`,
        deviceId: body.deviceId || 'unknown',
        name: body.name || 'Guest',
        lang: body.lang === 'zh' ? 'zh' : 'bn',
        speakerLabel: body.speakerLabel,
        joinedAt: Date.now(),
      }
      entry.participants.set(participant.id, participant)
      return sendJson(res, 200, { room: entry.room, participant })
    }

    const speakMatch = path.match(/^\/rooms\/([A-Za-z0-9]+)\/speaking$/)
    if (req.method === 'POST' && speakMatch) {
      const entry = getRoom(speakMatch[1])
      if (!entry) return sendJson(res, 404, { error: 'Room not found' })
      const body = await readJson(req)
      if (body.speaking) {
        entry.room.speaking = {
          participantId: body.speaking.participantId,
          name: body.speaking.name,
          until: Date.now() + 15_000,
        }
      } else {
        entry.room.speaking = null
      }
      return sendJson(res, 200, { ok: true, speaking: entry.room.speaking })
    }

    const msgMatch = path.match(/^\/rooms\/([A-Za-z0-9]+)\/messages$/)
    if (req.method === 'POST' && msgMatch) {
      const entry = getRoom(msgMatch[1])
      if (!entry) return sendJson(res, 404, { error: 'Room not found' })
      const body = await readJson(req)
      if (!body.id || !body.srcText) return sendJson(res, 400, { error: 'Invalid message' })
      const msg = {
        id: body.id,
        speakerId: body.speakerId,
        speakerName: body.speakerName,
        srcLang: body.srcLang,
        srcText: body.srcText,
        translations: body.translations || {},
        romanizations: body.romanizations,
        ts: body.ts || Date.now(),
      }
      // fill missing translation once
      const needBn = !msg.translations.bn
      const needZh = !msg.translations.zh
      if (needBn || needZh) {
        const from = msg.srcLang
        if (needBn && from === 'bn') msg.translations.bn = msg.srcText
        if (needZh && from === 'zh') msg.translations.zh = msg.srcText
        if (needBn && from !== 'bn') {
          const key = translationCacheKey(from, 'bn', msg.srcText)
          if (cache.has(key)) msg.translations.bn = cache.get(key).translation
          else {
            const t = await translateText(msg.srcText, from, 'bn')
            cache.set(key, { translation: t, ts: Date.now() })
            msg.translations.bn = t
          }
        }
        if (needZh && from !== 'zh') {
          const key = translationCacheKey(from, 'zh', msg.srcText)
          if (cache.has(key)) msg.translations.zh = cache.get(key).translation
          else {
            const t = await translateText(msg.srcText, from, 'zh')
            cache.set(key, { translation: t, ts: Date.now() })
            msg.translations.zh = t
          }
        }
      }
      entry.messages.push(msg)
      // clear speaking lock after message
      entry.room.speaking = null
      if (entry.messages.length > 500) entry.messages.splice(0, entry.messages.length - 500)
      return sendJson(res, 200, msg)
    }

    const roomMatch = path.match(/^\/rooms\/([A-Za-z0-9]+)$/)
    if (req.method === 'GET' && roomMatch) {
      const entry = getRoom(roomMatch[1])
      if (!entry) return sendJson(res, 404, { error: 'Room not found' })
      // expire speaking lock
      if (entry.room.speaking && entry.room.speaking.until < Date.now()) {
        entry.room.speaking = null
      }
      return sendJson(res, 200, publicRoom(entry))
    }

    sendJson(res, 404, { error: 'Not found' })
  } catch (e) {
    console.error(e)
    sendJson(res, 500, { error: e instanceof Error ? e.message : 'Server error' })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[chatown] API http://127.0.0.1:${PORT} provider=${getProviderName()}`)
})
