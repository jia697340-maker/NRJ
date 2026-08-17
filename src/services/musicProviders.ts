/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { MusicHomeSection, MusicPlaylist, MusicQuality, MusicSearchPage, MusicSourceConfig, MusicTrack, MusicUserProfile } from '../types/music'
import { parseMusicLyrics } from './musicLyrics'

export interface MusicProvider {
  id: string
  search(query: string, page?: number): Promise<MusicSearchPage>
  getHome?(): Promise<MusicHomeSection[]>
  getPlaylist?(id: string): Promise<{ playlist: MusicPlaylist; tracks: MusicTrack[] }>
  getStreamUrl?(track: MusicTrack, quality: MusicQuality): Promise<string | null>
  getLyrics?(track: MusicTrack): Promise<MusicTrack['lyrics']>
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
  Object.entries(value).forEach(([key, item]) => { if (typeof item === 'string') result[key] = item })
  return Object.keys(result).length ? result : undefined
}
const sessionHeaders = (sessionId?: string): HeadersInit => sessionId ? { 'X-Music-Session': sessionId } : {}

const neteaseTrack = (song: any): MusicTrack => ({
  id: `netease:${song.id}`, sourceId: 'netease', sourceTrackId: String(song.id),
  title: song.name || '未知歌曲',
  artist: (song.ar || song.artists || []).map((item: any) => item.name).join(' / ') || '未知歌手',
  artists: (song.ar || song.artists || []).map((item: any) => item.name),
  album: song.al?.name || song.album?.name || '未知专辑',
  albumId: String(song.al?.id || song.album?.id || ''),
  duration: Math.round((song.dt || song.duration || 0) / 1000), coverUrl: song.al?.picUrl || song.album?.picUrl,
  available: song.noCopyrightRcmd === null || song.noCopyrightRcmd === undefined,
  requiresVip: Number(song.fee || 0) === 1,
  reason: song.noCopyrightRcmd ? '当前版权范围不可播，已从结果中隐藏' : '完整播放', playbackType: 'full'
})

const neteasePlaylist = (item: any): MusicPlaylist => ({
  id: String(item.id), sourceId: 'netease', name: item.name || '未命名歌单',
  trackCount: item.trackCount || 0, playCount: item.playCount || 0,
  coverUrl: item.picUrl || item.coverImgUrl, description: item.description, ownerName: item.creator?.nickname
})

class NeteaseMusicProvider implements MusicProvider {
  id = 'netease'
  private config: MusicSourceConfig
  constructor(config: MusicSourceConfig) { this.config = config }
  private get base() { if (!this.config.apiBase) throw new Error('请先在来源管理中填写网易云服务地址'); return this.config.apiBase }
  private async request(path: string, params: Record<string, string | number | undefined> = {}) {
    const payload = { ...params, timestamp: Date.now(), ...(this.config.token ? { cookie: this.config.token } : {}) }
    if (!this.config.token) return withTimeout(joinUrl(this.base, path, payload))
    return withTimeout(joinUrl(this.base, path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  }
  async search(query: string, page = 1): Promise<MusicSearchPage> {
    const data: any = await this.request('/cloudsearch', { keywords: query, type: 1, limit: 30, offset: (page - 1) * 30 })
    const songs = data.result?.songs || []
    return { tracks: songs.map(neteaseTrack).filter((track: MusicTrack) => track.available !== false), hasMore: songs.length === 30 }
  }
  async getHome(): Promise<MusicHomeSection[]> {
    const [recommended, charts, daily, login]: any[] = await Promise.all([
      this.request('/personalized', { limit: 12 }), this.request('/toplist'),
      this.request('/recommend/songs').catch(() => null), this.request('/login/status').catch(() => null)
    ])
    const sections: MusicHomeSection[] = [
      { id: 'netease-recommend', title: '网易云推荐歌单', type: 'playlists', playlists: (recommended.result || []).map(neteasePlaylist) },
      { id: 'netease-charts', title: '网易云排行榜', type: 'charts', playlists: (charts.list || []).slice(0, 10).map(neteasePlaylist) }
    ]
    const uid = login?.data?.profile?.userId || login?.profile?.userId
    if (uid) {
      const userLists: any = await this.request('/user/playlist', { uid, limit: 50 }).catch(() => null)
      if (userLists?.playlist?.length) sections.unshift({ id: 'netease-mine', title: '我的网易云歌单', type: 'playlists', playlists: userLists.playlist.map(neteasePlaylist) })
    }
    if (daily?.data?.dailySongs?.length) sections.unshift({ id: 'netease-daily', title: '每日推荐歌曲', type: 'tracks', tracks: daily.data.dailySongs.map(neteaseTrack).filter((track: MusicTrack) => track.available !== false) })
    return sections
  }
  async getPlaylist(id: string) {
    const data: any = await this.request('/playlist/track/all', { id, limit: 1000 })
    const detail: any = await this.request('/playlist/detail', { id })
    return { playlist: neteasePlaylist(detail.playlist || { id, name: '歌单' }), tracks: (data.songs || []).map(neteaseTrack).filter((track: MusicTrack) => track.available !== false) }
  }
  async getStreamUrl(track: MusicTrack, quality: MusicQuality) {
    const levels: Record<MusicQuality, string> = { standard: 'standard', higher: 'higher', exhigh: 'exhigh', lossless: 'lossless', hires: 'hires' }
    const data: any = await this.request('/song/url/v1', { id: track.sourceTrackId, level: levels[quality] })
    const item = data.data?.[0]
    if (!item?.url || item.freeTrialInfo || item.freeTimeTrialPrivilege?.resConsumable === true) return null
    return item.url as string
  }
  async getLyrics(track: MusicTrack) { const data: any = await this.request('/lyric/new', { id: track.sourceTrackId }); return parseMusicLyrics(data.yrc?.lyric || data.lrc?.lyric || '', data.tlyric?.lyric || '') }
  async getProfile(): Promise<MusicUserProfile | null> {
    const data: any = await this.request('/login/status'); const profile = data.data?.profile || data.profile
    if (!profile) return null
    const detail: any = await this.request('/user/detail', { uid: profile.userId }).catch(() => null)
    return { id: String(profile.userId), sourceId: 'netease', nickname: profile.nickname, avatarUrl: profile.avatarUrl, signature: profile.signature, level: detail?.level, vipLabel: detail?.profile?.vipType ? '黑胶 VIP' : '网易云账号' }
  }
}

const aggregateTrack = (value: unknown): MusicTrack | null => {
  if (!isRecord(value)) return null
  const id = textValue(value.id); const source = textValue(value.source)
  if (!id || !source || value.is_invalid === true) return null
  return {
    id: `aggregate:${source}:${id}`, sourceId: 'aggregate', sourceTrackId: id,
    originSourceId: source, originExtra: stringMap(value.extra),
    title: textValue(value.name, '未知歌曲'), artist: textValue(value.artist, '未知歌手'), album: textValue(value.album, '未知专辑'),
    albumId: textValue(value.album_id), duration: numberValue(value.duration), coverUrl: textValue(value.cover) || undefined,
    available: true, requiresVip: value.is_vip === true, reason: `${source} · 完整播放`, playbackType: 'full'
  }
}

const aggregatePlaylist = (value: unknown): MusicPlaylist | null => {
  if (!isRecord(value)) return null
  const id = textValue(value.id); const source = textValue(value.source)
  if (!id || !source) return null
  return { id: `${source}:${id}`, sourceId: 'aggregate', name: textValue(value.name, '未命名歌单'), trackCount: numberValue(value.track_count), playCount: numberValue(value.play_count), coverUrl: textValue(value.cover) || undefined, description: textValue(value.description) || undefined, ownerName: textValue(value.creator) || undefined }
}

const aggregateParams = (track: MusicTrack) => ({
  id: track.sourceTrackId, source: track.originSourceId || '', name: track.title, artist: track.artist,
  album: track.album, cover: track.coverUrl || '', duration: Math.round(track.duration || 0),
  extra: track.originExtra ? JSON.stringify(track.originExtra) : undefined
})

class AggregateMusicProvider implements MusicProvider {
  id = 'aggregate'
  private config: MusicSourceConfig
  constructor(config: MusicSourceConfig) { this.config = config }
  private get base() { if (!this.config.apiBase) throw new Error('请先填写聚合音乐服务地址'); return this.config.apiBase }
  private request(path: string, params: Record<string, string | number | undefined> = {}, init: RequestInit = {}) {
    return withTimeout(joinUrl(this.base, path, params), { ...init, headers: { ...sessionHeaders(this.config.token), ...(init.headers || {}) } })
  }
  async search(query: string): Promise<MusicSearchPage> {
    const data = unwrapData(await this.request('/api/v1/music/search', { q: query, type: 'song' }))
    const songs = isRecord(data) && Array.isArray(data.songs) ? data.songs : []
    return { tracks: songs.map(aggregateTrack).filter(Boolean) as MusicTrack[] }
  }
  async getHome(): Promise<MusicHomeSection[]> {
    const data = unwrapData(await this.request('/api/v1/playlist/recommend'))
    const playlists = (Array.isArray(data) ? data : []).map(aggregatePlaylist).filter(Boolean) as MusicPlaylist[]
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
  const bundledAggregateApiBase = String(import.meta.env.VITE_PUBLIC_MUSIC_API_BASE || `${window.location.origin}/music-api`).trim()
  return [
    { id: 'local', name: '本地音乐', enabled: true, kind: 'local', capabilities: ['播放', '歌词', '歌单', '离线'] },
    { id: 'aggregate', name: '聚合音乐', enabled: Boolean(bundledAggregateApiBase), kind: 'aggregate', apiBase: bundledAggregateApiBase, capabilities: ['免登录搜索', '完整播放', '智能换源', '可选登录'] },
    { id: 'subsonic', name: '私人音乐库', enabled: false, kind: 'subsonic', apiBase: '', capabilities: ['Navidrome', 'OpenSubsonic', '歌单', '无损'] }
  ]
}

export const createMusicProviders = (configs: MusicSourceConfig[]) => configs.filter(item => item.enabled && item.id !== 'local' && Boolean(item.apiBase?.trim())).map(config => {
  if (config.kind === 'aggregate') return new AggregateMusicProvider(config)
  if (config.kind === 'netease') return new NeteaseMusicProvider(config)
  if (config.kind === 'subsonic') return new SubsonicMusicProvider(config)
  return null
}).filter(Boolean) as MusicProvider[]

export const createNeteaseQrLogin = async (apiBase: string) => {
  const keyData: any = await withTimeout(joinUrl(apiBase, '/login/qr/key', { timestamp: Date.now() })); const key = keyData.data?.unikey
  if (!key) throw new Error('二维码密钥获取失败')
  const qrData: any = await withTimeout(joinUrl(apiBase, '/login/qr/create', { key, qrimg: 'true', timestamp: Date.now() }))
  if (!qrData.data?.qrimg) throw new Error('登录二维码生成失败')
  return { key, image: qrData.data.qrimg as string }
}

export const checkNeteaseQrLogin = async (apiBase: string, key: string) => withTimeout(joinUrl(apiBase, '/login/qr/check', { key, timestamp: Date.now() })) as Promise<{ code: number; message?: string; cookie?: string }>

export const createAggregateQrLogin = async (apiBase: string, source: string, sessionId?: string): Promise<AggregateQrSession> => {
  const data = unwrapData(await withTimeout(joinUrl(apiBase, `/api/v1/system/qr_login/${encodeURIComponent(source)}`), { method: 'POST', headers: sessionHeaders(sessionId) }))
  if (!isRecord(data) || !textValue(data.key) || !textValue(data.url)) throw new Error('聚合服务没有返回有效二维码')
  const extra = isRecord(data.extra) ? data.extra : {}
  return { source: textValue(data.source, source), key: textValue(data.key), url: textValue(data.url), imageUrl: textValue(data.image_url) || undefined, expiresAt: numberValue(data.expires_at) || undefined, sessionId: textValue(extra.session_id) || undefined }
}

export const checkAggregateQrLogin = async (apiBase: string, source: string, key: string, sessionId?: string): Promise<AggregateQrResult> => {
  const data = unwrapData(await withTimeout(joinUrl(apiBase, `/api/v1/system/qr_login/${encodeURIComponent(source)}`, { key }), { headers: sessionHeaders(sessionId) }))
  if (!isRecord(data)) throw new Error('登录状态响应无效')
  const extra = isRecord(data.extra) ? data.extra : {}
  return { status: textValue(data.status, 'failed'), message: textValue(data.message) || undefined, sessionId: textValue(extra.session_id) || undefined }
}
