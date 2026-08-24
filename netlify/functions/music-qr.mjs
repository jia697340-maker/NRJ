import { randomBytes } from 'node:crypto'
import { musicSessionStore } from '../lib/music-session-store.mjs'

const NETEASE_API = 'https://interface.music.163.com'
const BILIBILI_PASSPORT = 'https://passport.bilibili.com'
const QQ_LOGIN = 'https://ssl.ptlogin2.qq.com'
const DEFAULT_RETENTION_DAYS = 30
const MAX_RETENTION_DAYS = 365
export const MUSIC_QR_PROMISE = '我已阅读并理解账号连接与凭据保管说明，自愿扫码授权，并确认所选保留期限。'
const SUPPORTED_PLATFORMS = new Set(['netease', 'qq', 'bilibili'])
const PLATFORM_LABELS = { netease: '网易云', qq: 'QQ音乐', bilibili: 'B站' }
const PLATFORM_COOKIE_IDS = { netease: 'ncm', qq: 'qqmusic', bilibili: 'bilibili' }

const qrCookieName = platform => `__Host-clingy-${PLATFORM_COOKIE_IDS[platform]}-qr`
const authCookieName = platform => `__Host-clingy-${PLATFORM_COOKIE_IDS[platform]}-auth`

const json = (body, init = {}) => {
  const headers = new Headers(init.headers || {})
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return new Response(JSON.stringify(body), { ...init, headers })
}

const normalizeRetentionDays = value => {
  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_RETENTION_DAYS
  if (number === 0) return 0
  return Math.min(MAX_RETENTION_DAYS, Math.max(1, Math.round(number)))
}

const sessionId = () => randomBytes(32).toString('base64url')
const sessionKey = (kind, platform, id) => `${kind}/${platform}/${id}`

const requestCookies = request => Object.fromEntries(
  String(request.headers.get('cookie') || '').split(';').flatMap(part => {
    const separator = part.indexOf('=')
    if (separator < 1) return []
    try { return [[part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())]] }
    catch { return [] }
  })
)

const upstreamSetCookies = response => {
  if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie()
  const value = response.headers.get('set-cookie') || ''
  return value ? value.split(/,(?=\s*[^;,=]+=[^;,]*)/) : []
}

const cookieMap = values => Object.fromEntries(values.flatMap(value => {
  const pair = String(value).split(';', 1)[0]
  const separator = pair.indexOf('=')
  return separator > 0 ? [[pair.slice(0, separator).trim(), pair.slice(separator + 1).trim()]] : []
}))

const mergeCookies = (current, response) => ({ ...current, ...cookieMap(upstreamSetCookies(response)) })
const upstreamCookieHeader = cookies => Object.entries(cookies || {}).map(([key, value]) => `${key}=${value}`).join('; ')
const selectCookies = (cookies, names) => Object.fromEntries(names.flatMap(name => cookies?.[name] ? [[name, cookies[name]]] : []))

const setPrivateCookie = (headers, name, value, maxAge) => {
  const encoded = encodeURIComponent(value)
  const age = Number.isFinite(maxAge) ? `; Max-Age=${Math.max(0, Math.round(maxAge))}` : ''
  headers.append('Set-Cookie', `${name}=${encoded}; Path=/${age}; HttpOnly; Secure; SameSite=Lax`)
}

const clearPrivateCookie = (headers, name) => {
  headers.append('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`)
}

const sameOriginRequest = request => {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') return false
  const origin = request.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).host === new URL(request.url).host }
  catch { return false }
}

const rateBuckets = new Map()
const allowRequest = (request, action) => {
  const ip = String(request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim().slice(0, 80)
  const limit = action === 'create' ? 10 : 90
  const key = `${ip}:${action === 'create' ? 'create' : 'general'}`
  const now = Date.now()
  const bucket = rateBuckets.get(key)
  if (!bucket || now - bucket.startedAt >= 60_000) {
    rateBuckets.set(key, { startedAt: now, count: 1 })
    if (rateBuckets.size > 2000) rateBuckets.delete(rateBuckets.keys().next().value)
    return true
  }
  bucket.count += 1
  return bucket.count <= limit
}

const browserHeaders = referer => ({
  Referer: referer,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
})

const neteaseRequest = async (path, form = {}, cookies = {}) => {
  const headers = { ...browserHeaders('https://music.163.com/'), 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }
  const cookie = upstreamCookieHeader(cookies)
  if (cookie) headers.Cookie = cookie
  return fetch(`${NETEASE_API}${path}`, { method: 'POST', headers, body: new URLSearchParams(form).toString(), redirect: 'manual' })
}

const persistQrState = async (platform, state, maxAge, retentionDays, payload) => {
  const id = sessionId()
  await musicSessionStore.set(sessionKey('qr', platform, id), {
    ...state,
    createdAt: Date.now(),
    expiresAt: Date.now() + maxAge * 1000,
    retentionDays
  })
  const headers = new Headers()
  setPrivateCookie(headers, qrCookieName(platform), id, maxAge)
  return json({ status: 'waiting', ...payload }, { headers })
}

const persistAuth = async (platform, credentials, message, retentionDays, extra = {}) => {
  const id = sessionId()
  const serverDays = retentionDays === 0 ? 1 : retentionDays
  await musicSessionStore.set(sessionKey('auth', platform, id), {
    cookies: credentials,
    connectedAt: Date.now(),
    expiresAt: Date.now() + serverDays * 86400 * 1000,
    retentionDays,
    ...extra
  })
  const headers = new Headers()
  setPrivateCookie(headers, authCookieName(platform), id, retentionDays === 0 ? undefined : retentionDays * 86400)
  clearPrivateCookie(headers, qrCookieName(platform))
  return json({ status: 'success', message, retentionDays }, { headers })
}

const expiredQr = async (platform, id = '') => {
  if (id) await musicSessionStore.delete(sessionKey('qr', platform, id))
  const headers = new Headers()
  clearPrivateCookie(headers, qrCookieName(platform))
  return json({ status: 'expired', message: '二维码已失效，请重新生成' }, { headers })
}

const readStoredSession = async (request, kind, platform) => {
  const cookieName = kind === 'qr' ? qrCookieName(platform) : authCookieName(platform)
  const id = String(requestCookies(request)[cookieName] || '')
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(id)) return null
  const key = sessionKey(kind, platform, id)
  const value = await musicSessionStore.get(key)
  if (!value || Number(value.expiresAt || 0) <= Date.now()) {
    await musicSessionStore.delete(key)
    return null
  }
  return { ...value, id, storageKey: key }
}

const updateQrState = async state => {
  const { id: _id, storageKey, ...value } = state
  await musicSessionStore.set(storageKey, value)
}

const createNeteaseQr = async retentionDays => {
  const upstream = await neteaseRequest('/api/login/qrcode/unikey', { type: '3' })
  const data = await upstream.json()
  if (!upstream.ok || data.code !== 200 || !data.unikey) throw new Error('netease qr create failed')
  return persistQrState('netease', { key: data.unikey, cookies: mergeCookies({}, upstream) }, 15 * 60, retentionDays, {
    url: `https://music.163.com/login?codekey=${encodeURIComponent(data.unikey)}`,
    expiresAt: Date.now() + 15 * 60 * 1000,
  })
}

const checkNeteaseQr = async state => {
  const upstream = await neteaseRequest('/api/login/qrcode/client/login', { key: state.key, type: '3' }, state.cookies)
  const data = await upstream.json()
  const merged = mergeCookies(state.cookies || {}, upstream)
  if (data.code === 801 || data.code === 802) {
    state.cookies = merged
    await updateQrState(state)
    return json({ status: data.code === 802 ? 'scanned' : 'waiting', message: data.message || (data.code === 802 ? '已扫码，请在手机上确认' : '等待扫码') })
  }
  if (data.code === 800) return expiredQr('netease', state.id)
  if (data.code !== 803 || !merged.MUSIC_U) throw new Error('netease qr check failed')
  await musicSessionStore.delete(state.storageKey)
  return persistAuth('netease', selectCookies(merged, ['MUSIC_U', '__csrf', 'MUSIC_R_T', 'MUSIC_A']), '网易云登录成功', state.retentionDays)
}

const createBilibiliQr = async retentionDays => {
  const upstream = await fetch(`${BILIBILI_PASSPORT}/x/passport-login/web/qrcode/generate`, { headers: browserHeaders('https://www.bilibili.com/'), redirect: 'manual' })
  const data = await upstream.json()
  if (!upstream.ok || data.code !== 0 || !data.data?.qrcode_key || !data.data?.url) throw new Error('bilibili qr create failed')
  return persistQrState('bilibili', { key: data.data.qrcode_key }, 3 * 60, retentionDays, { url: data.data.url, expiresAt: Date.now() + 3 * 60 * 1000 })
}

const checkBilibiliQr = async state => {
  const url = new URL(`${BILIBILI_PASSPORT}/x/passport-login/web/qrcode/poll`)
  url.searchParams.set('qrcode_key', state.key)
  const upstream = await fetch(url, { headers: browserHeaders('https://www.bilibili.com/'), redirect: 'manual' })
  const data = await upstream.json()
  const code = Number(data.data?.code)
  if (code === 86101) return json({ status: 'waiting', message: data.data?.message || '等待扫码' })
  if (code === 86090) return json({ status: 'scanned', message: data.data?.message || '已扫码，请在手机上确认' })
  if (code === 86038) return expiredQr('bilibili', state.id)
  const merged = mergeCookies({}, upstream)
  if (code !== 0 || !merged.SESSDATA) throw new Error('bilibili qr check failed')
  const credentials = selectCookies(merged, ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid', 'buvid3', 'buvid4', 'buvid_fp'])
  await musicSessionStore.delete(state.storageKey)
  return persistAuth('bilibili', credentials, 'B站登录成功', state.retentionDays, { refreshToken: data.data?.refresh_token || '' })
}

const qqHash33 = value => {
  let hash = 0
  for (const char of value) hash += (hash << 5) + char.codePointAt(0)
  return hash & 0x7fffffff
}

const createQqQr = async retentionDays => {
  const url = new URL(`${QQ_LOGIN}/ptqrshow`)
  Object.entries({ appid: '716027609', e: '2', l: 'M', s: '3', d: '72', v: '4', t: Math.random().toFixed(17), daid: '383', pt_3rd_aid: '100497308' }).forEach(([key, value]) => url.searchParams.set(key, value))
  const upstream = await fetch(url, { headers: browserHeaders('https://y.qq.com/'), redirect: 'manual' })
  const cookies = mergeCookies({}, upstream)
  if (!upstream.ok || !cookies.qrsig) throw new Error('qq qr create failed')
  const image = Buffer.from(await upstream.arrayBuffer()).toString('base64')
  return persistQrState('qq', { key: cookies.qrsig, cookies }, 2 * 60, retentionDays, { imageUrl: `data:image/png;base64,${image}`, expiresAt: Date.now() + 2 * 60 * 1000 })
}

const parseQqCallback = raw => {
  const values = [...raw.matchAll(/'([^']*)'/g)].map(match => match[1])
  return { code: values[0] || '', redirectUrl: values[2] || '', message: values[4] || raw.trim() }
}

const collectQqRedirectCookies = async (initialUrl, initialCookies) => {
  let currentUrl = initialUrl
  let referer = 'https://y.qq.com/'
  let cookies = { ...initialCookies }
  for (let index = 0; index < 8 && currentUrl; index += 1) {
    const headers = browserHeaders(referer)
    headers.Cookie = upstreamCookieHeader(cookies)
    const response = await fetch(currentUrl, { headers, redirect: 'manual' })
    cookies = mergeCookies(cookies, response)
    const location = response.headers.get('location')
    if (!location || response.status < 300 || response.status >= 400) break
    referer = currentUrl
    currentUrl = new URL(location, currentUrl).toString()
  }
  return cookies
}

const normalizeQqCookies = cookies => {
  const normalized = { ...cookies }
  normalized.uin ||= normalized.ptui_loginuin || normalized.luin || normalized.pt2gguin || normalized.superuin || normalized.p_uin || ''
  normalized.qqmusic_key ||= normalized.p_skey || normalized.skey || ''
  normalized.qm_keyst ||= normalized.qqmusic_key || ''
  return normalized
}

const checkQqQr = async state => {
  const url = new URL(`${QQ_LOGIN}/ptqrlogin`)
  Object.entries({
    u1: 'https://graph.qq.com/oauth2.0/login_jump', ptqrtoken: String(qqHash33(state.key)), ptredirect: '100', h: '1', t: '1', g: '1',
    from_ui: '1', ptlang: '2052', action: `0-0-${Date.now()}`, js_ver: '21072115', js_type: '1', login_sig: '', pt_uistyle: '40',
    aid: '716027609', daid: '383', pt_3rd_aid: '100497308', has_onekey: '1', pttype: '1', service: 'ptqrlogin', nodirect: '0',
  }).forEach(([key, value]) => url.searchParams.set(key, value))
  const headers = browserHeaders('https://xui.ptlogin2.qq.com/')
  headers.Cookie = `qrsig=${state.key}`
  const upstream = await fetch(url, { headers, redirect: 'manual' })
  const callback = parseQqCallback(await upstream.text())
  if (callback.code === '66') return json({ status: 'waiting', message: callback.message || '等待扫码' })
  if (callback.code === '67') return json({ status: 'scanned', message: callback.message || '已扫码，请在手机上确认' })
  if (callback.code === '65') return expiredQr('qq', state.id)
  if (callback.code !== '0' || !callback.redirectUrl) throw new Error('qq qr check failed')
  let cookies = mergeCookies(state.cookies || {}, upstream)
  cookies = normalizeQqCookies(await collectQqRedirectCookies(callback.redirectUrl, cookies))
  const credentials = selectCookies(cookies, ['uin', 'p_uin', 'pt2gguin', 'skey', 'p_skey', 'pt4_token', 'superkey', 'superuin', 'ptcz', 'RK', 'qqmusic_key', 'qm_keyst'])
  if (!credentials.uin && !credentials.p_uin && !credentials.pt2gguin) throw new Error('qq credentials missing')
  await musicSessionStore.delete(state.storageKey)
  return persistAuth('qq', credentials, 'QQ音乐登录成功', state.retentionDays)
}

const createQr = (platform, retentionDays) => {
  if (platform === 'netease') return createNeteaseQr(retentionDays)
  if (platform === 'bilibili') return createBilibiliQr(retentionDays)
  return createQqQr(retentionDays)
}

const checkQr = async (request, platform) => {
  const state = await readStoredSession(request, 'qr', platform)
  if (!state?.key) return expiredQr(platform)
  if (platform === 'netease') return checkNeteaseQr(state)
  if (platform === 'bilibili') return checkBilibiliQr(state)
  return checkQqQr(state)
}

const accountStatus = async (request, platform) => {
  const state = await readStoredSession(request, 'auth', platform)
  if (!state?.cookies || !Object.keys(state.cookies).length) {
    const headers = new Headers()
    clearPrivateCookie(headers, authCookieName(platform))
    return json({ connected: false }, { headers })
  }
  if (platform === 'netease') {
    const upstream = await neteaseRequest('/api/w/nuser/account/get', {}, state.cookies)
    const profile = (await upstream.json())?.profile
    return json(profile ? { connected: true, retentionDays: state.retentionDays, profile: { id: String(profile.userId || ''), nickname: profile.nickname || '网易云用户', avatarUrl: profile.avatarUrl || '' } } : { connected: false })
  }
  if (platform === 'bilibili') {
    const headers = browserHeaders('https://www.bilibili.com/')
    headers.Cookie = upstreamCookieHeader(state.cookies)
    const upstream = await fetch('https://api.bilibili.com/x/web-interface/nav', { headers })
    const data = await upstream.json()
    const profile = data?.data
    return json(data?.code === 0 && profile?.isLogin ? { connected: true, retentionDays: state.retentionDays, profile: { id: String(profile.mid || ''), nickname: profile.uname || 'B站用户', avatarUrl: profile.face || '' } } : { connected: false })
  }
  return json({ connected: true, retentionDays: state.retentionDays, profile: { id: String(state.cookies.uin || state.cookies.p_uin || ''), nickname: 'QQ音乐账号', avatarUrl: '' } })
}

const capabilities = () => json({
  sessionIsolation: true, cookiesEndpointProtected: true, httpOnlySession: true,
  credentialNotReturned: true, serverSideCredentialStore: true, typedPromiseRequired: true,
  logoutSupported: true, retentionDays: DEFAULT_RETENTION_DAYS, maxRetentionDays: MAX_RETENTION_DAYS,
  retentionOptions: [0, 1, 7, 30, 90], promiseText: MUSIC_QR_PROMISE,
  platforms: [...SUPPORTED_PLATFORMS],
})

const logout = async (request, platform) => {
  const headers = new Headers()
  const platforms = platform === 'all' ? [...SUPPORTED_PLATFORMS] : [platform]
  for (const item of platforms) {
    const cookies = requestCookies(request)
    const qrId = String(cookies[qrCookieName(item)] || '')
    const authId = String(cookies[authCookieName(item)] || '')
    if (qrId) await musicSessionStore.delete(sessionKey('qr', item, qrId))
    if (authId) await musicSessionStore.delete(sessionKey('auth', item, authId))
    clearPrivateCookie(headers, qrCookieName(item))
    clearPrivateCookie(headers, authCookieName(item))
  }
  return json({ success: true }, { headers })
}

const readBody = async request => {
  try { return await request.json() }
  catch { return {} }
}

export default async request => {
  if (request.method !== 'POST') return json({ message: '仅支持 POST 请求' }, { status: 405, headers: { Allow: 'POST' } })
  if (!sameOriginRequest(request)) return json({ message: '拒绝跨站请求' }, { status: 403 })
  const body = await readBody(request)
  const action = String(body.action || '')
  const platform = String(body.platform || 'netease')
  if (action !== 'capabilities' && action !== 'logout' && !SUPPORTED_PLATFORMS.has(platform)) return json({ message: '不支持该登录平台' }, { status: 400 })
  if (!allowRequest(request, action)) return json({ status: 'failed', message: '请求过于频繁，请稍后重试' }, { status: 429, headers: { 'Retry-After': '60' } })

  try {
    if (action === 'create') {
      if (String(body.promise || '').trim() !== MUSIC_QR_PROMISE) return json({ status: 'failed', message: '请完整输入账号连接承诺后再生成二维码' }, { status: 400 })
      const rawRetention = Number(body.retentionDays)
      if (!Number.isInteger(rawRetention) || rawRetention < 0 || rawRetention > MAX_RETENTION_DAYS) return json({ status: 'failed', message: `保留期限必须是 0 到 ${MAX_RETENTION_DAYS} 天` }, { status: 400 })
      return await createQr(platform, normalizeRetentionDays(rawRetention))
    }
    if (action === 'check') return await checkQr(request, platform)
    if (action === 'status') return await accountStatus(request, platform)
    if (action === 'capabilities') return capabilities()
    if (action === 'logout') return await logout(request, platform === 'all' || SUPPORTED_PLATFORMS.has(platform) ? platform : 'all')
    return json({ message: '未知操作' }, { status: 400 })
  } catch {
    return json({ status: 'failed', message: `${PLATFORM_LABELS[platform] || '音乐平台'}服务暂时不可用，请稍后重试` }, { status: 502 })
  }
}

export const config = {
  path: '/.netlify/functions/music-qr',
  rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'] }
}
