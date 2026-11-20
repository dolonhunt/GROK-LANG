import { spawn } from 'node:child_process'

const api = spawn('node', ['functions/src/local-server.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: process.env.PORT || '5001' },
})
const web = spawn('npx', ['vite'], { stdio: 'inherit', shell: true })

function shutdown() {
  api.kill('SIGTERM')
  web.kill('SIGTERM')
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

api.on('exit', (c) => {
  console.log('api exited', c)
  web.kill()
  process.exit(c || 0)
})
web.on('exit', (c) => {
  console.log('web exited', c)
  api.kill()
  process.exit(c || 0)
})
