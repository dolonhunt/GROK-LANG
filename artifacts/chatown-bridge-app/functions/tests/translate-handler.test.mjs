import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = 5101

describe('POST /translate handler', () => {
  let child

  before(async () => {
    child = spawn('node', [join(__dirname, '../src/local-server.mjs')], {
      env: { ...process.env, PORT: String(PORT), TRANSLATE_PROVIDER: 'libre' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // wait for listen
    await sleep(400)
  })

  after(() => {
    child?.kill('SIGTERM')
  })

  it('health returns ok', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/health`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.ok, true)
  })

  it('rejects invalid body', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '', from: 'bn', to: 'zh' }),
    })
    assert.equal(res.status, 400)
  })

  it('identity when from===to', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello', from: 'bn', to: 'bn' }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.translation, 'hello')
    assert.equal(body.provider, 'identity')
  })

  it('translates bn→zh (network)', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'ধন্যবাদ', from: 'bn', to: 'zh' }),
    })
    // May fail if public APIs are down — still assert structure when 200
    if (res.status === 200) {
      const body = await res.json()
      assert.equal(typeof body.translation, 'string')
      assert.ok(body.translation.length > 0)
      // second call should be cached
      const res2 = await fetch(`http://127.0.0.1:${PORT}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'ধন্যবাদ', from: 'bn', to: 'zh' }),
      })
      const body2 = await res2.json()
      assert.equal(body2.cached, true)
      assert.equal(body2.translation, body.translation)
    } else {
      console.warn('skip network translation assert, status', res.status)
    }
  })
})
