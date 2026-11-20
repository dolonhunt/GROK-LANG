/** Simple in-memory sliding window rate limiter: 30 req / min per key */
const WINDOW_MS = 60_000
const MAX = 30
const buckets = new Map()

export function checkRateLimit(key) {
  const now = Date.now()
  let arr = buckets.get(key) || []
  arr = arr.filter((t) => now - t < WINDOW_MS)
  if (arr.length >= MAX) {
    buckets.set(key, arr)
    return { ok: false, remaining: 0, retryAfterMs: WINDOW_MS - (now - arr[0]) }
  }
  arr.push(now)
  buckets.set(key, arr)
  return { ok: true, remaining: MAX - arr.length }
}

// For unit tests
export function _resetRateLimit() {
  buckets.clear()
}
