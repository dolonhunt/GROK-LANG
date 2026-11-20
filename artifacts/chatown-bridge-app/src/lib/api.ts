import type { Lang, TranslateResponse } from './types'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export class ApiError extends Error {
  status?: number
  code?: string

  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function translate(
  text: string,
  from: Lang,
  to: Lang,
): Promise<TranslateResponse> {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new ApiError('Empty text', 400, 'empty')
  }
  if (from === to) {
    return { translation: trimmed, cached: true, provider: 'identity' }
  }

  const res = await fetch(`${API_BASE}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: trimmed, from, to }),
  })

  if (!res.ok) {
    let msg = `Translation failed (${res.status})`
    try {
      const body = (await res.json()) as { error?: string; code?: string }
      if (body?.error) msg = body.error
      if (body?.code === 'rate_limit') {
        throw new ApiError(msg, 429, 'rate_limit')
      }
    } catch (e) {
      if (e instanceof ApiError) throw e
    }
    throw new ApiError(msg, res.status)
  }

  return res.json() as Promise<TranslateResponse>
}
