import assert from 'node:assert/strict'

let neteaseCheckCount = 0
let bilibiliCheckCount = 0
let qqCheckCount = 0
globalThis.fetch = async (url, init) => {
  const requestUrl = String(url)
  if (requestUrl.endsWith('/api/login/qrcode/unikey')) {
    return new Response(JSON.stringify({ code: 200, unikey: 'test-key' }), {
      status: 200,
      headers: { 'Set-Cookie': 'NMTID=test-device; Path=/; Domain=.music.163.com' },
    })
  }
  if (requestUrl.endsWith('/api/login/qrcode/client/login')) {
    neteaseCheckCount += 1
    assert.match(String(init.headers.Cookie || ''), /NMTID=test-device/)
    if (neteaseCheckCount === 1) return Response.json({ code: 802, message: '已扫码' })
    return new Response(JSON.stringify({ code: 803, message: '授权登录成功' }), {
      status: 200,
      headers: { 'Set-Cookie': 'MUSIC_U=secret-token; Path=/; HttpOnly, __csrf=csrf-token; Path=/' },
    })
  }
  if (requestUrl.endsWith('/api/w/nuser/account/get')) {
    assert.match(String(init.headers.Cookie || ''), /MUSIC_U=secret-token/)
    return Response.json({ code: 200, profile: { userId: 7, nickname: '测试用户', avatarUrl: 'https://example.com/avatar.jpg' } })
  }
  if (requestUrl.includes('/x/passport-login/web/qrcode/generate')) {
    return Response.json({ code: 0, data: { qrcode_key: 'bili-key', url: 'https://passport.bilibili.com/h5-app/passport/login/scan?navhide=1' } })
  }
  if (requestUrl.includes('/x/passport-login/web/qrcode/poll')) {
    bilibiliCheckCount += 1
    if (bilibiliCheckCount === 1) return Response.json({ code: 0, data: { code: 86090, message: '二维码已扫码' } })
    return new Response(JSON.stringify({ code: 0, data: { code: 0, message: '扫码登录成功', refresh_token: 'bili-refresh' } }), {
      status: 200,
      headers: { 'Set-Cookie': 'SESSDATA=bili-secret; Path=/; HttpOnly' },
    })
  }
  if (requestUrl.includes('/x/web-interface/nav')) {
    assert.match(String(init.headers.Cookie || ''), /SESSDATA=bili-secret/)
    return Response.json({ code: 0, data: { isLogin: true, mid: 8, uname: 'B站测试用户', face: 'https://example.com/bili.jpg' } })
  }
  if (requestUrl.includes('/ptqrshow')) {
    return new Response(Buffer.from('fake-png'), { status: 200, headers: { 'Set-Cookie': 'qrsig=qq-qr-secret; Path=/; HttpOnly' } })
  }
  if (requestUrl.includes('/ptqrlogin')) {
    qqCheckCount += 1
    assert.match(String(init.headers.Cookie || ''), /qrsig=qq-qr-secret/)
    if (qqCheckCount === 1) return new Response("ptuiCB('67','0','','0','二维码认证中','')")
    return new Response("ptuiCB('0','0','https://graph.qq.com/login-jump','0','登录成功','')")
  }
  if (requestUrl === 'https://graph.qq.com/login-jump') {
    return new Response('', { status: 200, headers: { 'Set-Cookie': 'uin=o123456; Path=/; HttpOnly, p_skey=qq-secret; Path=/; HttpOnly' } })
  }
  throw new Error(`Unexpected request: ${requestUrl}`)
}

const { default: handler } = await import('../netlify/functions/music-qr.mjs')
const endpoint = 'https://example.netlify.app/.netlify/functions/music-qr'
const invoke = (action, cookie = '', platform = 'netease') => handler(new Request(endpoint, {
  method: 'POST',
  headers: { Origin: 'https://example.netlify.app', Cookie: cookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({ action, platform }),
}))
const responseCookie = (response, name) => {
  const value = response.headers.get('set-cookie') || ''
  const match = value.match(new RegExp(`${name}=([^;,]+)`))
  return match ? `${name}=${match[1]}` : ''
}

const created = await invoke('create')
assert.equal(created.status, 200)
assert.equal((await created.clone().json()).url, 'https://music.163.com/login?codekey=test-key')
const qrCookie = responseCookie(created, '__Host-clingy-ncm-qr')
assert.ok(qrCookie)

const scanned = await invoke('check', qrCookie)
assert.equal((await scanned.json()).status, 'scanned')

const success = await invoke('check', qrCookie)
const successBody = await success.clone().json()
assert.deepEqual(successBody, { status: 'success', message: '网易云登录成功' })
assert.doesNotMatch(JSON.stringify(successBody), /secret-token|csrf-token/)
const authCookie = responseCookie(success, '__Host-clingy-ncm-auth')
assert.ok(authCookie)

const status = await invoke('status', authCookie)
assert.deepEqual(await status.json(), {
  connected: true,
  profile: { id: '7', nickname: '测试用户', avatarUrl: 'https://example.com/avatar.jpg' },
})

const biliCreated = await invoke('create', '', 'bilibili')
assert.equal((await biliCreated.clone().json()).status, 'waiting')
const biliQrCookie = responseCookie(biliCreated, '__Host-clingy-bilibili-qr')
assert.ok(biliQrCookie)
assert.equal((await (await invoke('check', biliQrCookie, 'bilibili')).json()).status, 'scanned')
const biliSuccess = await invoke('check', biliQrCookie, 'bilibili')
assert.deepEqual(await biliSuccess.clone().json(), { status: 'success', message: 'B站登录成功' })
const biliAuthCookie = responseCookie(biliSuccess, '__Host-clingy-bilibili-auth')
assert.ok(biliAuthCookie)
assert.deepEqual(await (await invoke('status', biliAuthCookie, 'bilibili')).json(), {
  connected: true,
  profile: { id: '8', nickname: 'B站测试用户', avatarUrl: 'https://example.com/bili.jpg' },
})

const qqCreated = await invoke('create', '', 'qq')
const qqCreatedBody = await qqCreated.clone().json()
assert.match(qqCreatedBody.imageUrl, /^data:image\/png;base64,/) 
const qqQrCookie = responseCookie(qqCreated, '__Host-clingy-qqmusic-qr')
assert.ok(qqQrCookie)
assert.equal((await (await invoke('check', qqQrCookie, 'qq')).json()).status, 'scanned')
const qqSuccess = await invoke('check', qqQrCookie, 'qq')
assert.deepEqual(await qqSuccess.clone().json(), { status: 'success', message: 'QQ音乐登录成功' })
const qqAuthCookie = responseCookie(qqSuccess, '__Host-clingy-qqmusic-auth')
assert.ok(qqAuthCookie)
assert.equal((await (await invoke('status', qqAuthCookie, 'qq')).json()).connected, true)

const capabilities = await invoke('capabilities')
assert.deepEqual((await capabilities.json()).platforms.sort(), ['bilibili', 'netease', 'qq'])

const logout = await invoke('logout', `${authCookie}; ${biliAuthCookie}; ${qqAuthCookie}`, 'all')
assert.equal((await logout.json()).success, true)
assert.match(logout.headers.get('set-cookie') || '', /Max-Age=0/)

console.log('music QR function tests passed')
