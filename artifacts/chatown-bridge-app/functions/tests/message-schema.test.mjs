import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/** Mirrors client Message schema validation */
function isValidMessage(m) {
  if (!m || typeof m !== 'object') return false
  if (typeof m.id !== 'string' || !m.id) return false
  if (typeof m.speakerId !== 'string' || !m.speakerId) return false
  if (m.srcLang !== 'bn' && m.srcLang !== 'zh') return false
  if (typeof m.srcText !== 'string') return false
  if (!m.translations || typeof m.translations !== 'object') return false
  if (typeof m.ts !== 'number') return false
  return true
}

describe('message schema', () => {
  it('accepts valid message', () => {
    assert.equal(
      isValidMessage({
        id: '1',
        speakerId: 'local-bn',
        srcLang: 'bn',
        srcText: 'হ্যালো',
        translations: { bn: 'হ্যালো', zh: '你好' },
        ts: Date.now(),
      }),
      true,
    )
  })

  it('rejects missing fields', () => {
    assert.equal(isValidMessage({ id: '1' }), false)
    assert.equal(isValidMessage(null), false)
  })
})
