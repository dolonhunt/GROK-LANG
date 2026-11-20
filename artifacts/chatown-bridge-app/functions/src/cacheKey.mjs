import { createHash } from 'node:crypto'

export function translationCacheKey(from, to, text) {
  return createHash('sha256').update(`${from}|${to}|${text}`).digest('hex')
}

export function cacheKeyPayload(from, to, text) {
  return `${from}|${to}|${text}`
}
