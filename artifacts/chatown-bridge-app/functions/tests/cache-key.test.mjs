import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { translationCacheKey, cacheKeyPayload } from '../src/cacheKey.mjs'

describe('translationCacheKey', () => {
  it('is deterministic', () => {
    const a = translationCacheKey('bn', 'zh', 'হ্যালো')
    const b = translationCacheKey('bn', 'zh', 'হ্যালো')
    assert.equal(a, b)
    assert.equal(a.length, 64)
  })

  it('differs by direction and text', () => {
    const a = translationCacheKey('bn', 'zh', 'hello')
    const b = translationCacheKey('zh', 'bn', 'hello')
    const c = translationCacheKey('bn', 'zh', 'Hello')
    assert.notEqual(a, b)
    assert.notEqual(a, c)
  })

  it('payload format is from|to|text', () => {
    assert.equal(cacheKeyPayload('bn', 'zh', 'x'), 'bn|zh|x')
  })
})
