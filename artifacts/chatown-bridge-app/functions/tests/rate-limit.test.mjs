import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { checkRateLimit, _resetRateLimit } from '../src/rateLimit.mjs'

describe('checkRateLimit', () => {
  beforeEach(() => _resetRateLimit())

  it('allows up to 30 requests', () => {
    for (let i = 0; i < 30; i++) {
      assert.equal(checkRateLimit('u1').ok, true)
    }
    assert.equal(checkRateLimit('u1').ok, false)
  })

  it('is per-key', () => {
    for (let i = 0; i < 30; i++) checkRateLimit('a')
    assert.equal(checkRateLimit('a').ok, false)
    assert.equal(checkRateLimit('b').ok, true)
  })
})
