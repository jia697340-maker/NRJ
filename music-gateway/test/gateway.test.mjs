import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const listen = (handler) => new Promise(resolve => {
  const server = createServer(handler)
  server.listen(0, '127.0.0.1', () => resolve(server))
})
const address = server => `http://127.0.0.1:${server.address().port}`
const body = async request => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}
const close = server => new Promise(resolve => server.close(resolve))

test('isolates QR ownership, strips credentials and deletes the current account session', async t => {
  let authCookies = {}
  const publicUpstream = await listen((request, response) => {
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ data: { owner: 'anonymous' } }))
  })
  const authUpstream = await listen(async (request, response) => {
    const url = new URL(request.url, 'http://mock')
    response.setHeader('Content-Type', 'application/json')
    if (url.pathname === '/api/v1/system/cookies' && request.method === 'POST') {
      const next = JSON.parse(await body(request) || '{}')
      for (const [source, value] of Object.entries(next)) value ? authCookies[source] = value : delete authCookies[source]
      response.end(JSON.stringify({ status: 'ok' }))
      return
    }
    if (url.pathname === '/api/v1/system/qr_login/netease' && request.method === 'POST') {
      response.end(JSON.stringify({ data: { source: 'netease', key: 'qr-owner-key', url: 'https://example.test/qr' } }))
      return
    }
    if (url.pathname === '/api/v1/system/qr_login/netease') {
      authCookies.netease = 'MUSIC_U=platform-secret'
      response.end(JSON.stringify({ data: { status: 'success', cookie: 'MUSIC_U=platform-secret', extra: { cookie_saved: 'true' } } }))
      return
    }
    response.end(JSON.stringify({ data: { owner: authCookies.netease ? 'account-a' : 'anonymous' } }))
  })
  const portHolder = await listen((_request, response) => response.end())
  const gatewayPort = portHolder.address().port
  await close(portHolder)
  const dataDir = await mkdtemp(join(tmpdir(), 'clingy-music-gateway-'))
  const child = spawn(process.execPath, ['src/server.mjs'], {
    cwd: new URL('../', import.meta.url),
    env: {
      ...process.env,
      PORT: String(gatewayPort),
      MUSIC_DATA_DIR: dataDir,
      MUSIC_PUBLIC_UPSTREAM: address(publicUpstream),
      MUSIC_AUTH_UPSTREAM: address(authUpstream),
      MUSIC_ALLOWED_ORIGINS: 'https://app.example.test',
      MUSIC_COOKIE_SECURE: 'false',
      MUSIC_COOKIE_SAME_SITE: 'Lax'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  t.after(async () => {
    child.kill()
    await Promise.all([close(publicUpstream), close(authUpstream)])
  })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('gateway startup timeout')), 5000)
    child.stdout.on('data', chunk => {
      if (String(chunk).includes('listening')) { clearTimeout(timer); resolve() }
    })
    child.once('exit', code => reject(new Error(`gateway exited with ${code}`)))
  })

  const base = `http://127.0.0.1:${gatewayPort}`
  const headers = { Origin: 'https://app.example.test' }
  const capability = await fetch(`${base}/api/v1/system/privacy/capabilities`, { headers })
  const cookieA = capability.headers.get('set-cookie').split(';')[0]
  assert.match(capability.headers.get('set-cookie'), /HttpOnly/)
  assert.equal((await capability.json()).data.session_isolation, true)
  const rejectedOrigin = await fetch(`${base}/api/v1/system/privacy/capabilities`, { headers: { Origin: 'https://evil.example.test' } })
  assert.equal(rejectedOrigin.status, 403)
  const protectedCookies = await fetch(`${base}/api/v1/system/cookies`, { headers: { ...headers, Cookie: cookieA } })
  assert.equal(protectedCookies.status, 404)

  const capabilityB = await fetch(`${base}/api/v1/system/privacy/capabilities`, { headers })
  const cookieB = capabilityB.headers.get('set-cookie').split(';')[0]
  const created = await fetch(`${base}/api/v1/system/qr_login/netease`, { method: 'POST', headers: { ...headers, Cookie: cookieA } })
  assert.equal((await created.json()).data.key, 'qr-owner-key')

  const stolenPoll = await fetch(`${base}/api/v1/system/qr_login/netease?key=qr-owner-key`, { headers: { ...headers, Cookie: cookieB } })
  assert.equal(stolenPoll.status, 403)

  const ownerPoll = await fetch(`${base}/api/v1/system/qr_login/netease?key=qr-owner-key`, { headers: { ...headers, Cookie: cookieA } })
  const pollText = await ownerPoll.text()
  assert.equal(pollText.includes('platform-secret'), false)
  assert.equal(pollText.includes('cookie'), false)
  assert.deepEqual(authCookies, {})

  const accountA = await fetch(`${base}/api/v1/playlist/user?source=netease`, { headers: { ...headers, Cookie: cookieA } })
  assert.equal((await accountA.json()).data.owner, 'account-a')
  assert.deepEqual(authCookies, {})
  const accountB = await fetch(`${base}/api/v1/playlist/user?source=netease`, { headers: { ...headers, Cookie: cookieB } })
  assert.equal((await accountB.json()).data.owner, 'anonymous')

  await fetch(`${base}/api/v1/system/logout`, { method: 'POST', headers: { ...headers, Cookie: cookieA } })
  const afterLogout = await fetch(`${base}/api/v1/playlist/user?source=netease`, { headers: { ...headers, Cookie: cookieA } })
  assert.equal((await afterLogout.json()).data.owner, 'anonymous')
})
