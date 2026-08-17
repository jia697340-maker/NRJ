/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type MusicSourceId = 'local' | 'aggregate' | 'netease' | 'qq' | 'kugou' | 'kuwo' | 'migu' | 'bilibili' | 'subsonic' | string
export type MusicQuality = 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires'

export interface MusicLyricLine {
  time: number
  text: string
  translation?: string
  endTime?: number
}

export interface MusicTrack {
  id: string
  sourceId: MusicSourceId
  sourceTrackId: string
  title: string
  artist: string
  artists?: string[]
  album: string
  albumId?: string
  duration: number
  coverUrl?: string
  audioUrl?: string
  quality?: MusicQuality
  available?: boolean
  requiresLogin?: boolean
  requiresVip?: boolean
  reason?: string
  lyrics?: MusicLyricLine[]
  lyricText?: string
  addedAt?: number
  playCount?: number
  lastPlayedAt?: number
  liked?: boolean
  localBlobKey?: string
  mimeType?: string
  fileName?: string
  externalUrl?: string
  originSourceId?: string
  originExtra?: Record<string, string>
  playbackType?: 'full' | 'local'
}

export interface MusicPlaylist {
  id: string
  sourceId: MusicSourceId
  name: string
  trackCount: number
  playCount: number
  coverUrl?: string
  isLiked?: boolean
  description?: string
  ownerName?: string
  trackIds?: string[]
  updatedAt?: number
}

export interface MusicAlbum {
  id: string
  sourceId: MusicSourceId
  name: string
  artist: string
  coverUrl?: string
  releaseDate?: string
  trackCount?: number
}

export interface MusicArtist {
  id: string
  sourceId: MusicSourceId
  name: string
  avatarUrl?: string
  albumCount?: number
  trackCount?: number
}

export interface MusicSearchPage {
  tracks: MusicTrack[]
  playlists?: MusicPlaylist[]
  albums?: MusicAlbum[]
  artists?: MusicArtist[]
  hasMore?: boolean
}

export interface MusicHomeSection {
  id: string
  title: string
  subtitle?: string
  type: 'tracks' | 'playlists' | 'charts'
  tracks?: MusicTrack[]
  playlists?: MusicPlaylist[]
}

export interface MusicUserProfile {
  id: string
  sourceId: MusicSourceId
  nickname: string
  avatarUrl?: string
  level?: number
  vipLabel?: string
  signature?: string
}

export interface MusicSourceConfig {
  id: MusicSourceId
  name: string
  enabled: boolean
  apiBase?: string
  username?: string
  token?: string
  kind: 'local' | 'aggregate' | 'netease' | 'meting' | 'generic' | 'subsonic'
  capabilities: string[]
}

export interface MusicPrivacyPreferences {
  version: number
  noticeAcknowledged: boolean
  allowAnonymousPublicSources: boolean
  updatedAt: number
}

export interface MusicBackendPrivacyCapabilities {
  sessionIsolation: boolean
  cookiesEndpointProtected: boolean
  httpOnlySession: boolean
  credentialNotReturned: boolean
  logoutSupported: boolean
  retentionDays?: number
}

export interface MusicPersistedState {
  version: number
  likedTrackKeys: string[]
  history: MusicTrack[]
  customPlaylists: MusicPlaylist[]
  playlistTracks: Record<string, MusicTrack[]>
  queue: MusicTrack[]
  currentTrackKey: string | null
  currentTime: number
  volume: number
  playMode: 'loop' | 'single' | 'random'
  preferredQuality: MusicQuality
  sourceConfigs: MusicSourceConfig[]
}

export const musicTrackKey = (track: Pick<MusicTrack, 'sourceId' | 'sourceTrackId' | 'id'>) => `${track.sourceId}:${track.sourceTrackId || track.id}`
