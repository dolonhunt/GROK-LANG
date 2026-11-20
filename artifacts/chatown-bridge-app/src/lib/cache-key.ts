/**
 * Deterministic cache key for translation results.
 * Matches server: sha256(from|to|text)
 */
export async function translationCacheKey(
  from: string,
  to: string,
  text: string,
): Promise<string> {
  const payload = `${from}|${to}|${text}`
  const data = new TextEncoder().encode(payload)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Sync helper for Node tests (uses Web Crypto when available). */
export function cacheKeyPayload(from: string, to: string, text: string): string {
  return `${from}|${to}|${text}`
}
