/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { MusicComment, MusicCommentPage, MusicHomeSection, MusicPlaylist, MusicQuality, MusicSearchPage, MusicSourceConfig, MusicSourceStatus, MusicTrack, MusicUserProfile } from '../types/music'
import { parseMusicLyrics } from './musicLyrics'

export interface MusicProvider {
  id: string
  search(query: string, page?: number): Promise<MusicSearchPage>
  getHome?(): Promise<MusicHomeSection[]>
  getPlaylist?(id: string): Promise<{ playlist: MusicPlaylist; tracks: MusicTrack[] }>
  getStreamUrl?(track: MusicTrack, quality: MusicQuality): Promise<string | null>
  getLyrics?(track: MusicTrack): Promise<MusicTrack['lyrics']>
  getComments?(track: MusicTrack, page?: number): Promise<MusicCommentPage>
  getProfile?(): Promise<MusicUserProfile | null>
}

type JsonRecord = Record<string, unknown>

export interface AggregateQrSession {
  source: string
  key: string
  url: string
  imageUrl?: string
  expiresAt?: number
  sessionId?: string
}

export interface AggregateQrResult {
  status: 'waiting' | 'scanned' | 'success' | 'expired' | 'failed' | string
  message?: string
  sessionId?: string
}

const isRecord = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null && !Array.isArray(value)

const withTimeout = async (url: string, init: RequestInit = {}, timeout = 15000) => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, credentials: init.credentials || 'omit' })
    if (!response.ok) throw new Error(`请求失败 (${response.status})`)
    return await response.json() as unknown
  } finally { window.clearTimeout(timer) }
}

const joinUrl = (base: string, path: string, params: Record<string, string | number | undefined> = {}) => {
  const normalized = base.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
  const url = new URL(normalized, window.location.origin)
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined) url.searchParams.set(key, String(value)) })
  return url.toString()
}

const unwrapData = (value: unknown): unknown => isRecord(value) && 'data' in value ? value.data : value
const textValue = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const numberValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0
const stringMap = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined
  const result: Record<string, string> = {}
  Object.entries(value).forEach(([key, item]) => {
    if (typeof item === 'string') result[key] = item
    else if (typeof item === 'number' && Number.isFinite(item)) result[key] = String(item)
  })
  return Object.keys(result).length ? result : undefined
}
const sessionHeaders = (sessionId?: string): HeadersInit => sessionId ? { 'X-Music-Session': sessionId } : {}
const secureImageUrl = (value: unknown) => textValue(value).replace(/^http:\/\//i, 'https://') || undefined
const aggregateImageUrl = (base: string, value: unknown) => {
  const original = textValue(value).trim()
  if (!original) return undefined
  if (/^http:\/\//i.test(original)) return joinUrl(base, '/api/v1/music/cover', { url: original })
  return secureImageUrl(original)
}
const musicSessionCredentials = (): RequestCredentials => 'include'
const servicePayload = (value: unknown) => {
  if (isRecord(value) && 'code' in value) {
    const code = numberValue(value.code)
    if (code !== 0 && code !== 200) throw new Error(textValue(value.message) || textValue(value.msg) || `请求失败 (${code})`)
  }
  return value
}
const unsupportedEndpoint = (error: unknown) => error instanceof Error && /\b404\b|not found|接口不存在/i.test(error.message)

const neteaseTrack = (song: any): MusicTrack => ({
  id: `netease:${song.id}`, sourceId: 'netease', sourceTrackId: String(song.id),
  neteaseTrackId: String(song.id),
  title: song.name || '未知歌曲',
  artist: (song.ar || song.artists || []).map((item: any) => item.name).join(' / ') || '未知歌手',
  artists: (song.ar || song.artists || []).map((item: any) => item.name),
  album: song.al?.name || song.album?.name || '未知专辑',
  albumId: String(song.al?.id || song.album?.id || ''),
  duration: Math.round((song.dt || song.duration || 0) / 1000), coverUrl: secureImageUrl(song.al?.picUrl || song.album?.picUrl),
  available: song.noCopyrightRcmd === null || song.noCopyrightRcmd === undefined,
  requiresVip: Number(song.fee || 0) === 1,
  reason: song.noCopyrightRcmd ? '当前版权范围不可播，已从结果中隐藏' : '完整播放', playbackType: 'full'
})

const neteasePlaylist = (item: any): MusicPlaylist => ({
  id: String(item.id), sourceId: 'netease', name: item.name || '未命名歌单',
  trackCount: item.trackCount || 0, playCount: item.playCount || 0,
  coverUrl: secureImageUrl(item.picUrl || item.coverImgUrl), description: item.description, ownerName: item.creator?.nickname
})

class NeteaseMusicProvider implements MusicProvider {
  id: string
  private config: MusicSourceConfig
  constructor(config: MusicSourceConfig) { this.config = config; this.id = config.id }
  private get base() { if (!this.config.apiBase) throw new Error('请先在来源管理中填写网易云服务地址'); return this.config.apiBase }
  private async request(path: string, params: Record<string, string | number | undefined> = {}) {
    const payload = { ...params, timestamp: Date.now(), ...(this.config.token ? { cookie: this.config.token } : {}) }
    if (!this.config.token) return servicePayload(await withTimeout(joinUrl(this.base, path, payload)))
    return servicePayload(await withTimeout(joinUrl(this.base, path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
  }
  async search(query: string, page = 1): Promise<MusicSearchPage> {
    const params = { keywords: query, type: 1, limit: 30, offset: (page - 1) * 30 }
    let data: any
    try { data = await this.request('/cloudsearch', params) }
    catch (error) { if (!unsupportedEndpoint(error)) throw error; data = await this.request('/search', params) }
    const songs = data.result?.songs || []
    return { tracks: songs.map(neteaseTrack).filter((track: MusicTrack) => track.available !== false).map((track: MusicTrack) => ({ ...track, sourceId: this.id })), hasMore: songs.length === 30 }
  }
  async getHome(): Promise<MusicHomeSection[]> {
    const recommended: any = await this.request('/personalized', { limit: 12 })
    const [charts, daily, login]: any[] = await Promise.all([
      this.request('/toplist').catch(() => null), this.request('/recommend/songs').catch(() => null), this.request('/login/status').catch(() => null)
    ])
    const sections: MusicHomeSection[] = []
    if (recommended?.result?.length) sections.push({ id: `${this.id}-recommend`, title: '网易云推荐歌单', type: 'playlists', playlists: recommended.result.map(neteasePlaylist).map((item: MusicPlaylist) => ({ ...item, sourceId: this.id })) })
    if (charts?.list?.length) sections.push({ id: `${this.id}-charts`, title: '网易云排行榜', type: 'charts', playlists: charts.list.slice(0, 10).map(neteasePlaylist).map((item: MusicPlaylist) => ({ ...item, sourceId: this.id })) })
    const uid = login?.data?.profile?.userId || login?.profile?.userId
    if (uid) {
      const userLists: any = await this.request('/user/playlist', { uid, limit: 50 }).catch(() => null)
      if (userLists?.playlist?.length) sections.unshift({ id: `${this.id}-mine`, title: '我的网易云歌单', type: 'playlists', playlists: userLists.playlist.map(neteasePlaylist).map((item: MusicPlaylist) => ({ ...item, sourceId: this.id })) })
    }
    if (daily?.data?.dailySongs?.length) sections.unshift({ id: `${this.id}-daily`, title: '每日推荐歌曲', type: 'tracks', tracks: daily.data.dailySongs.map(neteaseTrack).filter((track: MusicTrack) => track.available !== false).map((track: MusicTrack) => ({ ...track, sourceId: this.id })) })
    return sections
  }
  async getPlaylist(id: string) {
    const detail: any = await this.request('/playlist/detail', { id })
    const all: any = await this.request('/playlist/track/all', { id, limit: 1000 }).catch(() => null)
    const songs = all?.songs?.length ? all.songs : detail?.playlist?.tracks || []
    if (!songs.length) throw new Error('歌单来源已响应，但没有返回歌曲')
    return {
      playlist: { ...neteasePlaylist(detail.playlist || { id, name: '歌单' }), sourceId: this.id },
      tracks: songs.map(neteaseTrack).filter((track: MusicTrack) => track.available !== false).map((track: MusicTrack) => ({ ...track, sourceId: this.id }))
    }
  }
  async getStreamUrl(track: MusicTrack, quality: MusicQuality) {
    const levels: Record<MusicQuality, string> = { standard: 'standard', higher: 'higher', exhigh: 'exhigh', lossless: 'lossless', hires: 'hires' }
    let data: any
    try { data = await this.request('/song/url/v1', { id: track.sourceTrackId, level: levels[quality] }) }
    catch (error) { if (!unsupportedEndpoint(error)) throw error; data = null }
    let item = data?.data?.[0]
    if (!item?.url) {
      data = await this.request('/song/url', { id: track.sourceTrackId, br: quality === 'standard' ? 128000 : 320000 })
      item = data?.data?.[0]
    }
    if (!item?.url || item.freeTrialInfo || item.freeTimeTrialPrivilege?.resConsumable === true) return null
    return secureImageUrl(item.url) || null
  }
  async getLyrics(track: MusicTrack) { let data: any; try { data = await this.request('/lyric/new', { id: track.sourceTrackId }) } catch (error) { if (!unsupportedEndpoint(error)) throw error; data = await this.request('/lyric', { id: track.sourceTrackId }) } return parseMusicLyrics(data.yrc?.lyric || data.lrc?.lyric || '', data.tlyric?.lyric || '') }
  async getComments(track: MusicTrack, page = 1): Promise<MusicCommentPage> {
    const id = track.neteaseTrackId || (/^\d+$/.test(track.sourceTrackId) ? track.sourceTrackId : '')
    if (!id) throw new Error('未找到可靠的网易云对应歌曲')
    const limit = 20
    return parseCommentPage(await this.request('/comment/music', { id, limit, offset: (Math.max(1, page) - 1) * limit }))
  }
  async getProfile(): Promise<MusicUserProfile | null> {
    const data: any = await this.request('/login/status'); const profile = data.data?.profile || data.profile
    if (!profile) return null
    const detail: any = await this.request('/user/detail', { uid: profile.userId }).catch(() => null)
    return { id: String(profile.userId), sourceId: this.id, nickname: profile.nickname, avatarUrl: profile.avatarUrl, signature: profile.signature, level: detail?.level, vipLabel: detail?.profile?.vipType ? '黑胶 VIP' : '网易云账号' }
  }
}

const aggregateTrack = (value: unknown): MusicTrack | null => {
  if (!isRecord(value)) return null
  const id = textValue(value.id); const source = textValue(value.source)
  if (!id || !source || value.is_invalid === true) return null
  const extra = stringMap(value.extra)
  const rawMappedNeteaseId = value.netease_id || value.neteaseId || extra?.neteaseId || extra?.netease_id
  const mappedNeteaseId = typeof rawMappedNeteaseId === 'number' || typeof rawMappedNeteaseId === 'string' ? String(rawMappedNeteaseId) : ''
  return {
    id: `aggregate:${source}:${id}`, sourceId: 'aggregate', sourceTrackId: id,
    originSourceId: source, originExtra: extra,
    neteaseTrackId: /^\d+$/.test(mappedNeteaseId) ? mappedNeteaseId : source === 'netease' && /^\d+$/.test(id) ? id : undefined,
    title: textValue(value.name, '未知歌曲'), artist: textValue(value.artist, '未知歌手'), album: textValue(value.album, '未知专辑'),
    albumId: textValue(value.album_id), duration: numberValue(value.duration), coverUrl: secureImageUrl(value.cover),
    available: true, requiresVip: value.is_vip === true, reason: `${source} · 完整播放`, playbackType: 'full'
  }
}

const aggregatePlaylist = (value: unknown, apiBase: string): MusicPlaylist | null => {
  if (!isRecord(value)) return null
  const id = textValue(value.id); const source = textValue(value.source)
  if (!id || !source) return null
  return { id: `${source}:${id}`, sourceId: 'aggregate', name: textValue(value.name, '未命名歌单'), trackCount: numberValue(value.track_count), playCount: numberValue(value.play_count), coverUrl: aggregateImageUrl(apiBase, value.cover), description: textValue(value.description) || undefined, ownerName: textValue(value.creator) || undefined }
}

const aggregateParams = (track: MusicTrack) => ({
  id: track.sourceTrackId, source: track.originSourceId || '', name: track.title, artist: track.artist,
  album: track.album, cover: track.coverUrl || '', duration: Math.round(track.duration || 0),
  extra: track.originExtra ? JSON.stringify(track.originExtra) : undefined
})

const aggregateComment = (value: unknown): MusicComment | null => {
  const rawCommentId = isRecord(value) ? value.id ?? value.commentId : undefined
  const commentId = typeof rawCommentId === 'string' || typeof rawCommentId === 'number' ? String(rawCommentId) : ''
  if (!isRecord(value) || !commentId || !textValue(value.content) || !isRecord(value.user)) return null
  const replied = Array.isArray(value.beReplied) && isRecord(value.beReplied[0]) ? value.beReplied[0] : null
  const reply = isRecord(value.reply) ? value.reply : replied
  const replyUser = reply && isRecord(reply.user) ? reply.user : null
  return {
    id: commentId, content: textValue(value.content), time: numberValue(value.time),
    timeText: textValue(value.timeText) || undefined, likedCount: numberValue(value.likedCount),
    user: { nickname: textValue(value.user.nickname, '网易云用户'), avatarUrl: secureImageUrl(value.user.avatarUrl) },
    reply: reply && textValue(reply.content) ? { content: textValue(reply.content), nickname: textValue(reply.nickname) || textValue(replyUser?.nickname, '网易云用户') } : null
  }
}

const commentRequestParams = (track: MusicTrack, page = 1) => {
  const limit = 20
  const explicitNeteaseId = track.neteaseTrackId
    || track.originExtra?.neteaseId || track.originExtra?.netease_id
    || ((track.originSourceId === 'netease' || track.sourceId === 'netease') && /^\d+$/.test(track.sourceTrackId) ? track.sourceTrackId : '')
  return {
    id: track.sourceTrackId,
    neteaseId: explicitNeteaseId || undefined,
    source: track.originSourceId || track.sourceId,
    name: track.title,
    artist: track.artist,
    album: track.album,
    duration: Math.round(track.duration || 0),
    limit,
    offset: (Math.max(1, page) - 1) * limit
  }
}

const requestMusicComments = async (url: string) => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(url, { credentials: 'omit', cache: 'no-store', signal: controller.signal })
    const raw = await response.text()
    let payload: unknown
    try { payload = JSON.parse(raw) }
    catch { throw new Error('评论服务返回了无效响应') }
    if (!response.ok) {
      const message = isRecord(payload) ? textValue(payload.msg) : ''
      if (response.status === 404) throw new Error(message || '未找到可靠的网易云对应歌曲')
      if (response.status === 400) throw new Error(message || '歌曲信息不完整，无法读取评论')
      if (response.status === 429) throw new Error(message || '评论请求过于频繁，请稍后重试')
      throw new Error('评论暂时无法加载，请稍后重试')
    }
    return payload
  } catch (error) {
    if (error instanceof Error && /未找到可靠|歌曲信息不完整|无效响应|评论暂时|请求过于频繁/.test(error.message)) throw error
    throw new Error(error instanceof DOMException && error.name === 'AbortError' ? '评论加载超时，请稍后重试' : '评论暂时无法加载，请稍后重试')
  } finally { window.clearTimeout(timer) }
}

const parseCommentPage = (payload: unknown): MusicCommentPage => {
  const data = unwrapData(payload)
  if (!isRecord(data)) throw new Error('评论响应格式无效')
  return {
    total: numberValue(data.total), more: data.more === true,
    hotComments: (Array.isArray(data.hotComments) ? data.hotComments : []).map(aggregateComment).filter(Boolean) as MusicComment[],
    comments: (Array.isArray(data.comments) ? data.comments : []).map(aggregateComment).filter(Boolean) as MusicComment[],
    stale: data.stale === true,
    resolvedNeteaseId: textValue(data.resolvedNeteaseId) || undefined,
    matched: data.matched === true
  }
}

export const loadPublicMusicComments = async (track: MusicTrack, page = 1): Promise<MusicCommentPage> => {
  const url = joinUrl(window.location.origin, '/.netlify/functions/music-comments', commentRequestParams(track, page))
  return parseCommentPage(await requestMusicComments(url))
}

class AggregateMusicProvider implements MusicProvider {
  id = 'aggregate'
  private config: MusicSourceConfig
  constructor(config: MusicSourceConfig) { this.config = config }
  private get base() { if (!this.config.apiBase) throw new Error('请先填写聚合音乐服务地址'); return this.config.apiBase }
  private request(path: string, params: Record<string, string | number | undefined> = {}, init: RequestInit = {}) {
    return withTimeout(joinUrl(this.base, path, params), { ...init, credentials: musicSessionCredentials(), headers: { ...(init.headers || {}) } })
  }
  async search(query: string): Promise<MusicSearchPage> {
    const data = unwrapData(await this.request('/api/v1/music/search', { q: query, type: 'song' }))
    const songs = isRecord(data) && Array.isArray(data.songs) ? data.songs : []
    return { tracks: songs.map(aggregateTrack).filter(Boolean) as MusicTrack[] }
  }
  async getHome(): Promise<MusicHomeSection[]> {
    const data = unwrapData(await this.request('/api/v1/playlist/recommend'))
    const playlists = (Array.isArray(data) ? data : []).map(item => aggregatePlaylist(item, this.base)).filter(Boolean) as MusicPlaylist[]
    return playlists.length ? [{ id: 'aggregate-recommend', title: '多平台热门歌单', type: 'playlists', playlists }] : []
  }
  async getPlaylist(compoundId: string) {
    const separator = compoundId.indexOf(':')
    if (separator <= 0) throw new Error('歌单来源信息不完整')
    const source = compoundId.slice(0, separator); const id = compoundId.slice(separator + 1)
    const data = unwrapData(await this.request('/api/v1/playlist/detail', { source, id }))
    const tracks = (Array.isArray(data) ? data : []).map(aggregateTrack).filter(Boolean) as MusicTrack[]
    return { playlist: { id: compoundId, sourceId: 'aggregate', name: '聚合歌单', trackCount: tracks.length, playCount: 0 }, tracks }
  }
  async getStreamUrl(track: MusicTrack) {
    const original = aggregateParams(track)
    const inspectionData = unwrapData(await this.request('/api/v1/music/inspect', original).catch(() => null))
    if (isRecord(inspectionData) && inspectionData.valid === true) return joinUrl(this.base, '/api/v1/music/stream', original)
    const switched = await this.request('/api/v1/music/switch', { name: track.title, artist: track.artist, source: track.originSourceId || '', duration: Math.round(track.duration || 0) }).catch(() => null)
    const replacement = aggregateTrack(switched)
    return replacement ? joinUrl(this.base, '/api/v1/music/stream', aggregateParams(replacement)) : null
  }
  async getLyrics(track: MusicTrack) {
    const data = unwrapData(await this.request('/api/v1/music/lyric', aggregateParams(track)).catch(() => null))
    return parseMusicLyrics(isRecord(data) ? textValue(data.lyric) : '')
  }
  async getComments(track: MusicTrack, page = 1): Promise<MusicCommentPage> {
    const url = joinUrl(this.base, '/api/v1/music/comments', commentRequestParams(track, page))
    return parseCommentPage(await requestMusicComments(url))
  }
}

type MetingItem = { title?: string; name?: string; author?: string; artist?: string; pic?: string; url?: string; lrc?: string }

export const loadPublicMusicHomeSections = async (): Promise<MusicHomeSection[]> => {
  const liveUrl = new URL('/.netlify/functions/music-home', window.location.origin)
  liveUrl.searchParams.set('timestamp', String(Date.now()))
  let data: unknown = null
  for (const url of [liveUrl.toString()]) {
    try {
      data = await withTimeout(url, { credentials: 'omit', cache: 'no-store' }, 15000)
      if (isRecord(data) && Array.isArray(data.result) && data.result.length) break
    } catch { data = null }
  }
  const items = isRecord(data) && Array.isArray(data.result) ? data.result : []
  const playlists = items.flatMap((item): MusicPlaylist[] => {
    if (!isRecord(item) || !textValue(item.name) || !String(item.id || '').trim()) return []
    return [{
      id: `netease:${String(item.id)}`,
      sourceId: 'public-meting',
      name: textValue(item.name),
      trackCount: numberValue(item.trackCount),
      playCount: numberValue(item.playCount),
      coverUrl: secureImageUrl(item.picUrl),
      description: textValue(item.copywriter) || undefined
    }]
  })
  return playlists.length ? [{
    id: 'public-recommend',
    title: '热门推荐歌单',
    subtitle: '实时推荐',
    type: 'playlists',
    playlists
  }] : []
}

class MetingMusicProvider implements MusicProvider {
  id: string
  private config: MusicSourceConfig
  private readonly servers: string[]
  constructor(config: MusicSourceConfig) {
    this.config = config; this.id = config.id
    this.servers = config.id === 'qijieya-meting' ? ['netease', 'tencent'] : config.id === 'injahow-meting' ? ['netease'] : ['netease', 'tencent', 'kugou', 'kuwo', 'baidu']
  }
  private get base() { if (!this.config.apiBase) throw new Error('公共音乐服务地址为空'); return this.config.apiBase }
  private endpoint(server: string, type: string, id: string) {
    const url = new URL(this.base, window.location.origin)
    url.searchParams.set('server', server); url.searchParams.set('type', type); url.searchParams.set('id', id)
    return url.toString()
  }
  private item(value: MetingItem, server: string, index: number): MusicTrack | null {
    const mediaUrl = textValue(value.url)
    const title = textValue(value.title) || textValue(value.name)
    const artist = textValue(value.author) || textValue(value.artist)
    if (!title || !mediaUrl || /(?:preview|trial|试听)/i.test(mediaUrl)) return null
    let sourceTrackId = ''
    try { sourceTrackId = new URL(mediaUrl, window.location.origin).searchParams.get('id') || '' } catch { sourceTrackId = '' }
    if (!sourceTrackId) sourceTrackId = `${Date.now()}-${index}`
    return {
      id: `${this.id}:${server}:${sourceTrackId}`, sourceId: this.id, sourceTrackId,
      originSourceId: server, originExtra: { mediaUrl, lyricUrl: textValue(value.lrc) },
      neteaseTrackId: server === 'netease' && /^\d+$/.test(sourceTrackId) ? sourceTrackId : undefined,
      title, artist: artist || '未知歌手', album: `${server} · 公共音乐`,
      duration: 0, coverUrl: secureImageUrl(value.pic), available: true, playbackType: 'full', reason: '匿名公共音源 · 完整播放'
    }
  }
  async search(query: string): Promise<MusicSearchPage> {
    const sourceNames: Record<string, string> = { netease: '网易云', tencent: 'QQ音乐', kugou: '酷狗', kuwo: '酷我', baidu: '百度' }
    const sourceStatuses: MusicSourceStatus[] = []
    for (const server of this.servers) {
      try {
        const data = servicePayload(await withTimeout(this.endpoint(server, 'search', query), { credentials: 'omit' }, 12000))
        const tracks = (Array.isArray(data) ? data : []).map((item, index) => this.item(item as MetingItem, server, index)).filter(Boolean) as MusicTrack[]
        sourceStatuses.push({ id: `${this.id}:${server}`, name: sourceNames[server] || server, ok: true, detail: tracks.length ? `返回 ${tracks.length} 首` : '已响应，但没有结果' })
        if (tracks.length) return { tracks, sourceStatuses }
      } catch (error) {
        sourceStatuses.push({ id: `${this.id}:${server}`, name: sourceNames[server] || server, ok: false, detail: error instanceof Error ? error.message : '搜索请求失败' })
      }
    }
    return { tracks: [], sourceStatuses }
  }
  async getPlaylist(compoundId: string) {
    const separator = compoundId.indexOf(':')
    const server = separator > 0 ? compoundId.slice(0, separator) : 'netease'
    const playlistId = separator > 0 ? compoundId.slice(separator + 1) : compoundId
    const data = await withTimeout(this.endpoint(server, 'playlist', playlistId), { credentials: 'omit' }, 15000)
    const tracks = (Array.isArray(data) ? data : [])
      .map((item, index) => this.item(item as MetingItem, server, index))
      .filter(Boolean) as MusicTrack[]
    return {
      playlist: {
        id: compoundId,
        sourceId: this.id,
        name: '公开歌单',
        trackCount: tracks.length,
        playCount: 0,
        coverUrl: tracks.find(track => track.coverUrl)?.coverUrl
      },
      tracks
    }
  }
  async getStreamUrl(track: MusicTrack) {
    const value = track.originExtra?.mediaUrl || this.endpoint(track.originSourceId || 'netease', 'url', track.sourceTrackId)
    return /(?:preview|trial|试听)/i.test(value) ? null : value
  }
  async getLyrics(track: MusicTrack) {
    const url = track.originExtra?.lyricUrl || this.endpoint(track.originSourceId || 'netease', 'lrc', track.sourceTrackId)
    try {
      const response = await fetch(url, { credentials: 'omit' })
      if (!response.ok) return []
      return parseMusicLyrics(await response.text())
    } catch { return [] }
  }
}

class VKeysMusicProvider implements MusicProvider {
  id: string
  private config: MusicSourceConfig
  constructor(config: MusicSourceConfig) { this.config = config; this.id = config.id }
  private get base() { return (this.config.apiBase || 'https://api.vkeys.cn/v2/music').replace(/\/$/, '') }
  private endpoint(platform: string, query: string, choose: number) {
    return joinUrl(this.base, platform, { word: query, choose })
  }
  private track(value: unknown, platform: string): MusicTrack | null {
    if (!isRecord(value)) return null
    const mediaUrl = secureImageUrl(value.url)
    const sourceTrackId = textValue(value.mid) || String(value.id || '')
    if (!sourceTrackId || !textValue(value.song) || !mediaUrl) return null
    return {
      id: `${this.id}:${platform}:${sourceTrackId}`, sourceId: this.id, sourceTrackId,
      originSourceId: platform === 'tencent' ? 'tencent' : 'netease',
      originExtra: { mediaUrl },
      neteaseTrackId: platform === 'netease' && /^\d+$/.test(String(value.id || '')) ? String(value.id) : undefined,
      title: textValue(value.song), artist: textValue(value.singer, '未知歌手'), album: textValue(value.album, `${platform} · 落月音乐`),
      duration: numberValue(value.interval), coverUrl: secureImageUrl(value.cover), available: true,
      playbackType: 'full', quality: 'lossless', reason: `${textValue(value.quality, '完整音源')} · 播放时验证`
    }
  }
  async search(query: string): Promise<MusicSearchPage> {
    const statuses: MusicSourceStatus[] = []
    for (const platform of ['netease', 'tencent']) {
      for (let choose = 1; choose <= 3; choose += 1) {
        try {
          const payload = servicePayload(await withTimeout(this.endpoint(platform, query, choose), { credentials: 'omit' }, 12000))
          const track = this.track(isRecord(payload) ? payload.data : null, platform)
          if (track) {
            statuses.push({ id: `${this.id}:${platform}`, name: platform === 'netease' ? '落月网易云' : '落月QQ音乐', ok: true, detail: '已找到播放候选' })
            return { tracks: [track], sourceStatuses: statuses }
          }
        } catch (error) {
          if (choose === 3) statuses.push({ id: `${this.id}:${platform}`, name: platform === 'netease' ? '落月网易云' : '落月QQ音乐', ok: false, detail: error instanceof Error ? error.message : '搜索请求失败' })
        }
      }
    }
    return { tracks: [], sourceStatuses: statuses }
  }
  async getStreamUrl(track: MusicTrack) { return secureImageUrl(track.originExtra?.mediaUrl) || null }
}

const officialVideoCatalog: MusicTrack[] = [
  {
    id: 'official-video:youtube:cOy2rdGe8LE', sourceId: 'official-video', sourceTrackId: 'cOy2rdGe8LE',
    title: '讨厌红楼梦', artist: '陶喆', album: '黑色柳丁 · 官方完整版 MV', duration: 239,
    available: true, playbackType: 'embed', validationStatus: 'unknown', embedProvider: 'youtube', embedId: 'cOy2rdGe8LE',
    externalUrl: 'https://www.youtube.com/watch?v=cOy2rdGe8LE', reason: 'YouTube 官方版本（播放时验证）'
  },
  {
    id: 'official-video:youtube:FhpyoiN1lX4', sourceId: 'official-video', sourceTrackId: 'FhpyoiN1lX4',
    title: '讨厌红楼梦', artist: '陶喆', album: 'Live Again · 官方艺人频道', duration: 209,
    available: true, playbackType: 'embed', validationStatus: 'unknown', embedProvider: 'youtube', embedId: 'FhpyoiN1lX4',
    externalUrl: 'https://www.youtube.com/watch?v=FhpyoiN1lX4', reason: 'YouTube 官方现场版（播放时验证）'
  }
]

const publicVideoCatalog: MusicTrack[] = [
  {
    id: 'public-video:bilibili:BV1mx411V7N7:5', sourceId: 'public-video', sourceTrackId: 'BV1mx411V7N7:5',
    title: '讨厌红楼梦', artist: '陶喆', album: '黑色柳丁 MV 合集 · 公开视频', duration: 239,
    available: true, playbackType: 'embed', validationStatus: 'verified', embedProvider: 'bilibili', embedId: 'BV1mx411V7N7:5',
    externalUrl: 'https://www.bilibili.com/video/BV1mx411V7N7/', reason: 'Bilibili 公开视频完整版'
  }
]

const normalizeMusicSearchText = (value: string) => value.toLowerCase().replace(/[\s·・\-—_()（）【】\[\]]/g, '')

class OfficialVideoProvider implements MusicProvider {
  id = 'official-video'
  async search(query: string): Promise<MusicSearchPage> {
    const normalized = normalizeMusicSearchText(query)
    const tracks = officialVideoCatalog.filter(track => normalizeMusicSearchText(`${track.title}${track.artist}`).includes(normalized) || normalizeMusicSearchText(track.title).includes(normalized))
    return { tracks, sourceStatuses: [{ id: this.id, name: '官方视频', ok: true, detail: tracks.length ? `找到 ${tracks.length} 个官方版本，嵌入权限播放时验证` : '本地官方目录已检查' }] }
  }
  async getStreamUrl() { return null }
}

class PublicVideoProvider implements MusicProvider {
  id = 'public-video'
  async search(query: string): Promise<MusicSearchPage> {
    const normalized = normalizeMusicSearchText(query)
    const tracks = publicVideoCatalog.filter(track => normalizeMusicSearchText(`${track.title}${track.artist}`).includes(normalized) || normalizeMusicSearchText(track.title).includes(normalized))
    return { tracks, sourceStatuses: [{ id: this.id, name: '国内公开视频', ok: true, detail: tracks.length ? `找到 ${tracks.length} 个完整公开版本` : '本地公开目录已检查' }] }
  }
  async getStreamUrl() { return null }
}

class SubsonicMusicProvider implements MusicProvider {
  id = 'subsonic'
  private config: MusicSourceConfig
  constructor(config: MusicSourceConfig) { this.config = config }
  private endpoint(path: string, params: Record<string, string | number> = {}) {
    if (!this.config.apiBase || !this.config.username || !this.config.token) throw new Error('请完整填写私人曲库地址、用户名和密码')
    const encoded = Array.from(new TextEncoder().encode(this.config.token)).map(value => value.toString(16).padStart(2, '0')).join('')
    return joinUrl(this.config.apiBase, `/rest/${path}.view`, { ...params, u: this.config.username, p: `enc:${encoded}`, v: '1.16.1', c: 'clingy-music', f: 'json' })
  }
  private track(item: any): MusicTrack { return { id: `subsonic:${item.id}`, sourceId: 'subsonic', sourceTrackId: String(item.id), title: item.title || item.name || '未知歌曲', artist: item.artist || '未知歌手', album: item.album || '未知专辑', albumId: item.albumId, duration: Number(item.duration || 0), coverUrl: this.endpoint('getCoverArt', { id: item.coverArt || item.id }), available: true, mimeType: item.contentType, playbackType: 'full', reason: '私人曲库 · 完整播放' } }
  private request(path: string, params: Record<string, string | number> = {}) { return withTimeout(this.endpoint(path, params)) as Promise<any> }
  async search(query: string): Promise<MusicSearchPage> { const data = await this.request('search3', { query, songCount: 50, albumCount: 12, artistCount: 12 }); return { tracks: (data['subsonic-response']?.searchResult3?.song || []).map((item: any) => this.track(item)) } }
  async getHome(): Promise<MusicHomeSection[]> { const data = await this.request('getAlbumList2', { type: 'recent', size: 18 }); const albums = data['subsonic-response']?.albumList2?.album || []; return [{ id: 'subsonic-recent', title: '私人曲库最近加入', type: 'playlists', playlists: albums.map((item: any) => ({ id: item.id, sourceId: 'subsonic', name: item.name, trackCount: item.songCount || 0, playCount: item.playCount || 0, coverUrl: this.endpoint('getCoverArt', { id: item.coverArt || item.id }), ownerName: item.artist })) }] }
  async getPlaylist(id: string) { const data = await this.request('getAlbum', { id }); const album = data['subsonic-response']?.album || {}; return { playlist: { id, sourceId: 'subsonic', name: album.name || '专辑', trackCount: album.song?.length || 0, playCount: 0, ownerName: album.artist }, tracks: (album.song || []).map((item: any) => this.track(item)) } }
  async getStreamUrl(track: MusicTrack) { return this.endpoint('stream', { id: track.sourceTrackId }) }
  async getLyrics(track: MusicTrack) { const data = await this.request('getLyrics', { artist: track.artist, title: track.title }); return parseMusicLyrics(data['subsonic-response']?.lyrics?.value || '') }
  async getProfile(): Promise<MusicUserProfile | null> { const data = await this.request('ping'); return data['subsonic-response']?.status === 'ok' ? { id: this.config.username || 'user', sourceId: 'subsonic', nickname: this.config.username || '私人曲库' } : null }
}

export const defaultMusicSourceConfigs = (): MusicSourceConfig[] => {
  const viteEnv = import.meta.env || {}
  const deployedAggregateApiBase = String(viteEnv.VITE_MUSIC_ACCOUNT_API_BASE || viteEnv.VITE_PUBLIC_MUSIC_API_BASE || '').trim()
  const bundledAggregateApiBase = deployedAggregateApiBase
  return [
    { id: 'local', name: '本地音乐', enabled: true, kind: 'local', capabilities: ['播放', '歌词', '歌单', '离线'] },
    { id: 'thatapi-netease', name: '网易云公开一号源', enabled: true, kind: 'netease', apiBase: 'https://netease.thatapi.cn', anonymousPublic: true, capabilities: ['推荐歌单', '歌单详情', '搜索', '评论', '播放'] },
    { id: 'cyanyun-netease', name: '网易云公开二号源', enabled: true, kind: 'netease', apiBase: 'https://www.cyanyun.com/api', anonymousPublic: true, capabilities: ['推荐歌单', '歌单详情', '搜索', '播放'] },
    { id: 'qijieya-meting', name: '网易云与QQ公共源', enabled: true, kind: 'meting', apiBase: 'https://api.qijieya.cn/meting/', anonymousPublic: true, capabilities: ['网易云', 'QQ音乐', '搜索', '歌单', '播放'] },
    { id: 'vkeys-music', name: '落月播放补源', enabled: true, kind: 'generic', apiBase: 'https://api.vkeys.cn/v2/music', anonymousPublic: true, capabilities: ['网易云', 'QQ音乐', '播放补源', '多音质'] },
    { id: 'injahow-meting', name: '公开歌单补源', enabled: true, kind: 'meting', apiBase: 'https://api.injahow.cn/meting/', anonymousPublic: true, capabilities: ['网易云', '歌单', '单曲', '播放补源'] },
    { id: 'hf-netease', name: '网易云应急源', enabled: true, kind: 'netease', apiBase: 'https://moefurina-neteasecloudmusicapienhanced.hf.space', anonymousPublic: true, capabilities: ['推荐歌单', '评论', '播放', '应急备用'] },
    { id: 'public-meting', name: '原公共音乐源', enabled: true, kind: 'meting', apiBase: 'https://meting.mikus.ink/api', anonymousPublic: true, capabilities: ['匿名搜索', '公开榜单', '无需部署', '第三方服务'] },
    { id: 'aggregate', name: '可选账号服务', enabled: Boolean(bundledAggregateApiBase), kind: 'aggregate', apiBase: bundledAggregateApiBase, capabilities: ['可选配置', '扫码登录', '个人歌单', '账号隔离'] },
    { id: 'official-video', name: '官方视频（免部署）', enabled: true, kind: 'embed', capabilities: ['官方完整内容', '无需登录', '无需部署', '网页播放'] },
    { id: 'public-video', name: '国内公开视频（免部署）', enabled: true, kind: 'embed', capabilities: ['公开完整内容', '国内可用', '无需部署', '网页播放'] },
    { id: 'subsonic', name: '私人音乐库', enabled: false, kind: 'subsonic', apiBase: '', capabilities: ['Navidrome', 'OpenSubsonic', '歌单', '无损'] }
  ]
}

export const restoreMusicSourceConfigs = (defaults: MusicSourceConfig[], stored: MusicSourceConfig[]) => defaults.map(item => {
  const storedItem = stored.find(savedItem => savedItem.id === item.id)
  const merged = storedItem
    ? { ...item, ...storedItem, enabled: storedItem.enabled === true }
    : { ...item, enabled: item.kind === 'local' && item.enabled }
  if (!merged.apiBase?.trim() && item.apiBase?.trim()) merged.apiBase = item.apiBase
  return merged
})

export const isPublicMusicDiscoveryEnabled = (configs: MusicSourceConfig[], anonymousAllowed: boolean) => anonymousAllowed
  && configs.some(item => item.id === 'public-meting' && item.enabled)

export const filterMusicHomeSectionsByEnabledSources = (sections: MusicHomeSection[], configs: MusicSourceConfig[]) => {
  const enabledSourceIds = new Set(configs.filter(item => item.enabled).map(item => item.id))
  return sections.filter(section => {
    const sourceIds = [...(section.tracks || []), ...(section.playlists || [])].map(item => item.sourceId)
    return sourceIds.length > 0 && sourceIds.some(sourceId => enabledSourceIds.has(sourceId))
  })
}

export const createMusicProviders = (configs: MusicSourceConfig[]) => configs.filter(item => item.enabled && item.id !== 'local' && (configNeedsNoAddress(item) || Boolean(item.apiBase?.trim()))).map(config => {
  if (config.kind === 'aggregate') return new AggregateMusicProvider(config)
  if (config.kind === 'netease') return new NeteaseMusicProvider(config)
  if (config.kind === 'meting') return new MetingMusicProvider(config)
  if (config.kind === 'generic' && config.id === 'vkeys-music') return new VKeysMusicProvider(config)
  if (config.kind === 'subsonic') return new SubsonicMusicProvider(config)
  if (config.kind === 'embed') return config.id === 'public-video' ? new PublicVideoProvider() : new OfficialVideoProvider()
  return null
}).filter(Boolean) as MusicProvider[]

const configNeedsNoAddress = (config: MusicSourceConfig) => config.kind === 'embed'

export const createNeteaseQrLogin = async (apiBase: string) => {
  const keyData: any = await withTimeout(joinUrl(apiBase, '/login/qr/key', { timestamp: Date.now() })); const key = keyData.data?.unikey
  if (!key) throw new Error('二维码密钥获取失败')
  const qrData: any = await withTimeout(joinUrl(apiBase, '/login/qr/create', { key, qrimg: 'true', timestamp: Date.now() }))
  if (!qrData.data?.qrimg) throw new Error('登录二维码生成失败')
  return { key, image: qrData.data.qrimg as string }
}

export const checkNeteaseQrLogin = async (apiBase: string, key: string) => withTimeout(joinUrl(apiBase, '/login/qr/check', { key, timestamp: Date.now() })) as Promise<{ code: number; message?: string; cookie?: string }>

export const MUSIC_QR_PROMISE = '我已阅读并理解账号连接与凭据保管说明，自愿扫码授权，并确认所选保留期限。'

const bundledMusicQrRequest = (
  action: 'create' | 'check' | 'status' | 'capabilities' | 'logout',
  platform = 'netease',
  options: { retentionDays?: number; promise?: string } = {}
) => withTimeout(
  '/.netlify/functions/music-qr',
  {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, platform, ...options })
  }
)

export const createBundledMusicQrLogin = async (platform: string, retentionDays: number, promise: string): Promise<AggregateQrSession> => {
  const data = await bundledMusicQrRequest('create', platform, { retentionDays, promise })
  if (!isRecord(data) || (!textValue(data.url) && !textValue(data.imageUrl))) throw new Error('登录二维码生成失败')
  return { source: platform, key: 'http-only', url: textValue(data.url), imageUrl: textValue(data.imageUrl) || undefined, expiresAt: numberValue(data.expiresAt) || undefined }
}

export const checkBundledMusicQrLogin = async (platform: string): Promise<AggregateQrResult> => {
  const data = await bundledMusicQrRequest('check', platform)
  if (!isRecord(data)) throw new Error('登录状态响应无效')
  return { status: textValue(data.status, 'failed'), message: textValue(data.message) || undefined }
}

export const getBundledMusicQrCapabilities = async () => bundledMusicQrRequest('capabilities') as Promise<JsonRecord>
export const logoutBundledMusicAccounts = async () => { await bundledMusicQrRequest('logout', 'all') }

export const createAggregateQrLogin = async (apiBase: string, source: string, sessionId?: string): Promise<AggregateQrSession> => {
  const data = unwrapData(await withTimeout(joinUrl(apiBase, `/api/v1/system/qr_login/${encodeURIComponent(source)}`), { method: 'POST', credentials: musicSessionCredentials(), headers: sessionHeaders(sessionId) }))
  if (!isRecord(data) || !textValue(data.key) || !textValue(data.url)) throw new Error('聚合服务没有返回有效二维码')
  const extra = isRecord(data.extra) ? data.extra : {}
  return { source: textValue(data.source, source), key: textValue(data.key), url: textValue(data.url), imageUrl: textValue(data.image_url) || undefined, expiresAt: numberValue(data.expires_at) || undefined, sessionId: textValue(extra.session_id) || undefined }
}

export const checkAggregateQrLogin = async (apiBase: string, source: string, key: string, sessionId?: string): Promise<AggregateQrResult> => {
  const data = unwrapData(await withTimeout(joinUrl(apiBase, `/api/v1/system/qr_login/${encodeURIComponent(source)}`, { key }), { credentials: musicSessionCredentials(), headers: sessionHeaders(sessionId) }))
  if (!isRecord(data)) throw new Error('登录状态响应无效')
  const extra = isRecord(data.extra) ? data.extra : {}
  return { status: textValue(data.status, 'failed'), message: textValue(data.message) || undefined, sessionId: textValue(extra.session_id) || undefined }
}
