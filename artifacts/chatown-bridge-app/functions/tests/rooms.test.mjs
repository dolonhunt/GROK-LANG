import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = 5102

describe('rooms API', () => {
  let child
  before(async () => {
    child = spawn('node', [join(__dirname, '../src/local-server.mjs')], {
      env: { ...process.env, PORT: String(PORT), TRANSLATE_PROVIDER: 'mock' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await sleep(400)
  })
  after(() => child?.kill('SIGTERM'))

  it('create + join + message', async () => {
    const create = await fetch(`http://127.0.0.1:${PORT}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A', lang: 'bn', deviceId: 'd1', uid: 'u1' }),
    })
    assert.equal(create.status, 200)
    const { room } = await create.json()
    assert.equal(room.code.length, 6)

    const join = await fetch(`http://127.0.0.1:${PORT}/rooms/${room.code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'B', lang: 'zh', deviceId: 'd2', uid: 'u2' }),
    })
    assert.equal(join.status, 200)

    const msgRes = await fetch(`http://127.0.0.1:${PORT}/rooms/${room.code}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'm1',
        speakerId: 'u1',
        speakerName: 'A',
        srcLang: 'bn',
        srcText: 'ধন্যবাদ',
        translations: {},
        ts: Date.now(),
      }),
    })
    assert.equal(msgRes.status, 200)
    const msg = await msgRes.json()
    assert.ok(msg.translations.zh || msg.translations.bn)

    const get = await fetch(`http://127.0.0.1:${PORT}/rooms/${room.code}`)
    const data = await get.json()
    assert.equal(data.participants.length, 2)
    assert.equal(data.messages.length, 1)
  })
})
