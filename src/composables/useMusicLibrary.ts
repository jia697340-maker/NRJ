/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed, ref } from 'vue'
import type { MusicCommentPage, MusicHomeSection, MusicPlaylist, MusicSearchPage, MusicSourceConfig, MusicTrack, MusicUserProfile } from '../types/music'
import { musicTrackKey } from '../types/music'
import { createMusicProviders, loadPublicMusicHomeSections, logoutBundledMusicAccounts } from '../services/musicProviders'
import { loadMusicHomeCache, saveLocalMusicFile, saveMusicHomeCache } from '../services/musicStorage'
import { readLocalMusicMetadata } from '../services/musicFileMetadata'
import { parseMusicLyrics } from '../services/musicLyrics'
import { defaultMusicPrivacyPreferences, loadMusicPrivacyPreferences, saveMusicPrivacyPreferences } from '../services/musicPrivacy'
import {
  initializeMusicRuntime, musicCustomPlaylists, musicCustomTrackCount, musicCustomTotalMinutes,
  musicCustomNickname, musicCustomVipLabel, musicCustomSignature,
  musicHistory, musicLikedKeys, musicPlaylistTracks, musicSourceConfigs, persistMusicRuntime
} from '../services/musicRuntime'

const searchQuery = ref('')
const searchResult = ref<MusicSearchPage>({ tracks: [] })
const homeSections = ref<MusicHomeSection[]>([])
const isSearching = ref(false)
const isLoadingHome = ref(false)
const homeLoadError = ref('')
const isHomeUsingCache = ref(false)
const libraryMessage = ref('')
const accountProfiles = ref<MusicUserProfile[]>([])
const localTracks = computed(() => musicPlaylistTracks.local || [])
const privacyPreferences = ref(defaultMusicPrivacyPreferences())
const isPrivacyReady = ref(false)
let privacyPromise: Promise<void> | null = null
const initializePrivacy = () => {
  if (privacyPromise) return privacyPromise
  privacyPromise = (async () => {
    privacyPreferences.value = await loadMusicPrivacyPreferences()
    if (!privacyPreferences.value.allowAnonymousPublicSources) {
      musicSourceConfigs.value = musicSourceConfigs.value.map(item => item.kind === 'meting' ? { ...item, enabled: false } : item)
    }
    isPrivacyReady.value = true
  })()
  return privacyPromise
}
const likedTracks = computed(() => {
  const all = [...localTracks.value, ...musicHistory.value, ...Object.values(musicPlaylistTracks).flat()]
  const seen = new Set<string>()
  return all.filter(track => musicLikedKeys.value.includes(musicTrackKey(track)) && !seen.has(musicTrackKey(track)) && seen.add(musicTrackKey(track)))
})

const readDuration = (file: File) => new Promise<number>(resolve => {
  const audio = document.createElement('audio')
  const url = URL.createObjectURL(file)
  audio.preload = 'metadata'
  audio.onloadedmetadata = () => { const value = Number.isFinite(audio.duration) ? audio.duration : 0; URL.revokeObjectURL(url); resolve(value) }
  audio.onerror = () => { URL.revokeObjectURL(url); resolve(0) }
  audio.src = url
})

const trackFromFile = async (file: File): Promise<MusicTrack> => {
  const base = file.name.replace(/\.[^.]+$/, '')
  const separator = base.includes(' - ') ? ' - ' : base.includes('-') ? '-' : ''
  const parts = separator ? base.split(separator).map(item => item.trim()) : [base]
  const key = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const metadata = await readLocalMusicMetadata(file)
  await saveLocalMusicFile(key, file)
  return {
    id: `local:${key}`, sourceId: 'local', sourceTrackId: key,
    title: metadata.title || (parts.length > 1 ? parts.slice(1).join(' - ') : base),
    artist: metadata.artist || (parts.length > 1 ? parts[0] : '未知歌手'), album: metadata.album || '本地音乐',
    duration: await readDuration(file), available: true, localBlobKey: key, playbackType: 'local',
    mimeType: file.type, fileName: file.name, addedAt: Date.now()
  }
}

export function useMusicLibrary() {
  const libraryReady = initializeMusicRuntime().then(initializePrivacy)
  void libraryReady
  const providers = () => createMusicProviders(musicSourceConfigs.value)

  const setMessage = (value: string) => {
    libraryMessage.value = value
    window.setTimeout(() => { if (libraryMessage.value === value) libraryMessage.value = '' }, 2600)
  }

  const searchAll = async (query: string) => {
    const normalized = query.trim()
    if (!normalized || isSearching.value) return
    searchQuery.value = normalized
    isSearching.value = true
    try {
      await libraryReady
      const activeProviders = providers()
      if (!activeProviders.length) {
        searchResult.value = { tracks: [] }
        setMessage('本站音乐服务尚未连接，请让部署者检查 /music-api')
        return
      }
      const results = await Promise.allSettled(activeProviders.map(provider => provider.search(normalized)))
      const pages = results.filter((item): item is PromiseFulfilledResult<MusicSearchPage> => item.status === 'fulfilled').map(item => item.value)
      const deduplicated: MusicTrack[] = []
      const keys = new Set<string>()
      for (const track of pages.flatMap(item => item.tracks)) {
        if (track.available === false || track.externalUrl || track.playbackType !== 'full') continue
        const identity = `${track.title.toLowerCase().replace(/\s|[()（）【】\[\]]/g, '')}|${track.artist.toLowerCase().replace(/\s/g, '')}|${Math.round((track.duration || 0) / 3)}`
        if (!keys.has(identity)) { keys.add(identity); deduplicated.push(track) }
      }
      searchResult.value = {
        tracks: deduplicated,
        playlists: pages.flatMap(item => item.playlists || []),
        albums: pages.flatMap(item => item.albums || []),
        artists: pages.flatMap(item => item.artists || [])
      }
      const failed = results.filter(item => item.status === 'rejected').length
      if (!pages.length) setMessage('本站音乐服务暂时没有响应，请稍后重试')
      else if (!deduplicated.length) setMessage('没有找到可完整播放的结果，试听与外链已自动隐藏')
      else if (failed) setMessage(`${failed} 个来源暂时不可用，已显示可完整播放的结果`)
    } finally { isSearching.value = false }
  }

  const clearSearch = () => {
    searchQuery.value = ''
    searchResult.value = { tracks: [] }
    isSearching.value = false
  }

  const loadHome = async (force = false) => {
    if (isLoadingHome.value) return
    if (!force && homeSections.value.length > 0) return

    isLoadingHome.value = true
    homeLoadError.value = ''
    try {
      await libraryReady

      // 如果非强制刷新，先尝试加载本地缓存以秒开
      if (!force && !homeSections.value.length) {
        const cache = await loadMusicHomeCache()
        const cachedSections = (cache?.sections || []).filter(section => section.id !== 'public-discovery')
        if (cachedSections.length) {
          homeSections.value = cachedSections
          isHomeUsingCache.value = true
        }
      }

      const capable = providers().filter(provider => provider.getHome)
      const [publicResult, results] = await Promise.all([
        loadPublicMusicHomeSections().catch(() => []),
        Promise.allSettled(capable.map(provider => provider.getHome!()))
      ])
      const providerSections = results
        .filter((item): item is PromiseFulfilledResult<MusicHomeSection[]> => item.status === 'fulfilled')
        .flatMap(item => item.value)
        .filter(section => Boolean(section.tracks?.length || section.playlists?.length))
      const freshSections = [...publicResult, ...providerSections.filter(section => section.id !== 'public-recommend')]
      if (freshSections.length) {
        homeSections.value = freshSections
        isHomeUsingCache.value = false
        await saveMusicHomeCache(homeSections.value)
        return
      }

      if (!homeSections.value.length) {
        const cache = await loadMusicHomeCache()
        const cachedSections = (cache?.sections || []).filter(section => section.id !== 'public-discovery')
        if (cachedSections.length) {
          homeSections.value = cachedSections
          isHomeUsingCache.value = true
          homeLoadError.value = '在线推荐暂时连接不上，正在显示上次成功载入的首页'
        } else {
          homeSections.value = []
          isHomeUsingCache.value = false
          homeLoadError.value = '真实推荐暂时没有载入，请点击重试'
        }
      }
    } catch {
      if (!homeSections.value.length) {
        const cache = await loadMusicHomeCache()
        const cachedSections = (cache?.sections || []).filter(section => section.id !== 'public-discovery')
        if (cachedSections.length) {
          homeSections.value = cachedSections
          isHomeUsingCache.value = true
          homeLoadError.value = '在线推荐暂时连接不上，正在显示上次成功载入的首页'
        } else {
          homeSections.value = []
          isHomeUsingCache.value = false
          homeLoadError.value = '真实推荐暂时没有载入，请点击重试'
        }
      }
    } finally {
      isLoadingHome.value = false
    }
  }

  const refreshProfiles = async () => {
    const capable = providers().filter(provider => provider.getProfile)
    const results = await Promise.allSettled(capable.map(provider => provider.getProfile!()))
    accountProfiles.value = results.filter((item): item is PromiseFulfilledResult<MusicUserProfile | null> => item.status === 'fulfilled').map(item => item.value).filter(Boolean) as MusicUserProfile[]
  }

  const loadPlaylist = async (playlist: MusicPlaylist) => {
    const provider = providers().find(item => item.id === playlist.sourceId)
    if (!provider?.getPlaylist) throw new Error('该来源暂不支持读取歌单')
    const result = await provider.getPlaylist(playlist.id)
    musicPlaylistTracks[`${playlist.sourceId}:${playlist.id}`] = result.tracks
    persistMusicRuntime()
    return result
  }

  const loadComments = async (track: MusicTrack, page = 1): Promise<MusicCommentPage> => {
    if (track.originSourceId !== 'netease') throw new Error('该歌曲不是网易云来源，暂无对应评论')
    const provider = providers().find(item => item.id === track.sourceId && item.getComments)
      || providers().find(item => item.id === 'aggregate' && item.getComments)
    if (!provider?.getComments) throw new Error('本站评论服务尚未连接')
    return provider.getComments(track, page)
  }

  const importLocalFiles = async (files: File[]) => {
    const supported = files.filter(file => file.type.startsWith('audio/') || /\.(mp3|flac|m4a|aac|ogg|opus|wav)$/i.test(file.name))
    const lyricFiles = files.filter(file => /\.(lrc|txt)$/i.test(file.name))
    const tracks: MusicTrack[] = []
    for (const file of supported) tracks.push(await trackFromFile(file))
    const combined = [...localTracks.value, ...tracks]
    for (const lyricFile of lyricFiles) {
      const base = lyricFile.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/\s/g, '')
      const match = combined.find(track => track.fileName?.replace(/\.[^.]+$/, '').toLowerCase().replace(/\s/g, '') === base || track.title.toLowerCase().replace(/\s/g, '') === base)
      if (match) { match.lyricText = await lyricFile.text(); match.lyrics = parseMusicLyrics(match.lyricText) }
    }
    musicPlaylistTracks.local = combined
    persistMusicRuntime()
    setMessage(`已导入 ${tracks.length} 首本地音乐`)
    return tracks
  }

  const toggleLikeTrack = (track: MusicTrack) => {
    const key = musicTrackKey(track)
    musicLikedKeys.value = musicLikedKeys.value.includes(key) ? musicLikedKeys.value.filter(item => item !== key) : [...musicLikedKeys.value, key]
    persistMusicRuntime()
  }

  const createPlaylist = (name: string) => {
    const playlist: MusicPlaylist = { id: `custom-${Date.now()}`, sourceId: 'local', name: name.trim() || '新建歌单', trackCount: 0, playCount: 0, trackIds: [], updatedAt: Date.now() }
    musicCustomPlaylists.value = [playlist, ...musicCustomPlaylists.value]
    musicPlaylistTracks[playlist.id] = []
    persistMusicRuntime()
    return playlist
  }

  const addToPlaylist = (playlistId: string, track: MusicTrack) => {
    const current = musicPlaylistTracks[playlistId] || []
    if (!current.some(item => musicTrackKey(item) === musicTrackKey(track))) musicPlaylistTracks[playlistId] = [...current, track]
    const playlist = musicCustomPlaylists.value.find(item => item.id === playlistId)
    if (playlist) { playlist.trackCount = musicPlaylistTracks[playlistId].length; playlist.updatedAt = Date.now() }
    persistMusicRuntime()
  }

  const updateSourceConfig = (config: MusicSourceConfig) => {
    musicSourceConfigs.value = musicSourceConfigs.value.map(item => item.id === config.id ? { ...config } : item)
    persistMusicRuntime()
  }

  const setAnonymousPublicSources = async (allowed: boolean) => {
    privacyPreferences.value = { version: 1, noticeAcknowledged: true, allowAnonymousPublicSources: allowed, updatedAt: Date.now() }
    musicSourceConfigs.value = musicSourceConfigs.value.map(item => item.kind === 'meting' ? { ...item, enabled: allowed && Boolean(item.apiBase?.trim()) } : item)
    persistMusicRuntime()
    await saveMusicPrivacyPreferences(privacyPreferences.value)
    setMessage(allowed ? '已启用匿名公共音乐查询' : '已关闭第三方公共音乐查询')
  }

  const clearOnlineAccountData = async () => {
    const online = musicSourceConfigs.value.filter(item => item.kind === 'aggregate' && item.apiBase)
    await Promise.allSettled([logoutBundledMusicAccounts(), ...online.map(async item => {
      const url = new URL(`${item.apiBase!.replace(/\/$/, '')}/api/v1/system/logout`, window.location.origin)
      await fetch(url, { method: 'POST', credentials: 'include' })
    })])
    musicSourceConfigs.value = musicSourceConfigs.value.map(item => item.kind === 'local' ? item : { ...item, token: undefined })
    accountProfiles.value = []
    persistMusicRuntime()
    setMessage('已断开音乐账号并清除当前浏览器的登录凭证')
  }

  const importPlaylistLink = async (value: string) => {
    const input = value.trim()
    if (!input) throw new Error('请输入歌单链接')
    const neteaseMatch = input.match(/(?:playlist\?id=|playlist\/)(\d+)/i)
    if (neteaseMatch) {
      const provider = providers().find(item => item.id === 'aggregate')
      if (!provider?.getPlaylist) throw new Error('本站聚合音乐服务暂不可用')
      const result = await provider.getPlaylist(`netease:${neteaseMatch[1]}`)
      const target = createPlaylist(`${result.playlist.name} · 网易云导入`)
      musicPlaylistTracks[target.id] = result.tracks
      target.trackCount = result.tracks.length
      persistMusicRuntime(); setMessage(`已导入 ${result.tracks.length} 首歌曲`)
      return target
    }
    throw new Error('目前可直接解析网易云歌单；其他平台可先导出 M3U8、CSV 或 JSON 后导入')
  }

  const importPlaylistFile = async (file: File) => {
    const text = await file.text()
    if (file.name.toLowerCase().endsWith('.json')) { await importLibraryBackup(file); return }
    const tracks: MusicTrack[] = []
    let pendingTitle = ''
    for (const raw of text.replace(/\r/g, '').split('\n')) {
      const line = raw.trim()
      if (!line) continue
      if (line.startsWith('#EXTINF:')) { pendingTitle = line.split(',').slice(1).join(',').trim(); continue }
      if (line.startsWith('#')) continue
      if (/^https?:\/\//i.test(line)) {
        const parts = pendingTitle.includes(' - ') ? pendingTitle.split(' - ') : [pendingTitle || `网络曲目 ${tracks.length + 1}`]
        tracks.push({ id: `imported:${Date.now()}:${tracks.length}`, sourceId: 'imported', sourceTrackId: line, title: parts.length > 1 ? parts.slice(1).join(' - ') : parts[0], artist: parts.length > 1 ? parts[0] : '未知歌手', album: file.name, duration: 0, audioUrl: line, available: true, playbackType: 'full' })
        pendingTitle = ''
      }
    }
    if (!tracks.length) throw new Error('文件中没有识别到可播放的 M3U/M3U8 网络曲目')
    const playlist = createPlaylist(file.name.replace(/\.[^.]+$/, ''))
    musicPlaylistTracks[playlist.id] = tracks; playlist.trackCount = tracks.length
    persistMusicRuntime(); setMessage(`已从歌单文件导入 ${tracks.length} 首`)
  }

  const deleteHistoryTracks = (trackIds: string[]) => {
    const set = new Set(trackIds)
    musicHistory.value = musicHistory.value.filter(item => !set.has(item.id))
    persistMusicRuntime()
    setMessage(`已清除 ${trackIds.length} 条歌曲记录`)
  }

  const clearAllHistory = () => {
    musicHistory.value = []
    persistMusicRuntime()
    setMessage('已清空全部歌曲记录')
  }

  const setCustomTrackCount = (val: number | null) => {
    musicCustomTrackCount.value = val
    persistMusicRuntime()
  }

  const setCustomTotalMinutes = (val: number | null) => {
    musicCustomTotalMinutes.value = val
    persistMusicRuntime()
  }

  const setCustomProfile = (profile: { nickname?: string | null; vipLabel?: string | null; signature?: string | null }) => {
    if (profile.nickname !== undefined) musicCustomNickname.value = profile.nickname
    if (profile.vipLabel !== undefined) musicCustomVipLabel.value = profile.vipLabel
    if (profile.signature !== undefined) musicCustomSignature.value = profile.signature
    persistMusicRuntime()
  }

  const resetCustomProfile = () => {
    musicCustomNickname.value = null
    musicCustomVipLabel.value = null
    musicCustomSignature.value = null
    persistMusicRuntime()
    setMessage('音乐个人信息已重置')
  }

  const exportLibrary = () => {
    const payload = JSON.stringify({ version: 2, exportedAt: Date.now(), likedTrackKeys: musicLikedKeys.value, history: musicHistory.value, customPlaylists: musicCustomPlaylists.value, playlistTracks: { ...musicPlaylistTracks }, sourceConfigs: musicSourceConfigs.value.map(({ token: _token, ...item }) => item), customTrackCount: musicCustomTrackCount.value, customTotalMinutes: musicCustomTotalMinutes.value, customNickname: musicCustomNickname.value, customVipLabel: musicCustomVipLabel.value, customSignature: musicCustomSignature.value }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `黏人机音乐备份-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url)
  }

  const importLibraryBackup = async (file: File) => {
    const data = JSON.parse(await file.text())
    if (!data || !data.version || !data.playlistTracks) throw new Error('不是有效的音乐备份')
    musicLikedKeys.value = Array.from(new Set([...musicLikedKeys.value, ...(data.likedTrackKeys || [])]))
    musicHistory.value = [...(data.history || []), ...musicHistory.value].slice(0, 500)
    musicCustomPlaylists.value = [...(data.customPlaylists || []), ...musicCustomPlaylists.value.filter(item => !(data.customPlaylists || []).some((other: MusicPlaylist) => other.id === item.id))]
    if (typeof data.customTrackCount === 'number') musicCustomTrackCount.value = data.customTrackCount
    if (typeof data.customTotalMinutes === 'number') musicCustomTotalMinutes.value = data.customTotalMinutes
    if (typeof data.customNickname === 'string') musicCustomNickname.value = data.customNickname
    if (typeof data.customVipLabel === 'string') musicCustomVipLabel.value = data.customVipLabel
    if (typeof data.customSignature === 'string') musicCustomSignature.value = data.customSignature
    Object.entries(data.playlistTracks || {}).forEach(([key, tracks]) => { musicPlaylistTracks[key] = tracks as MusicTrack[] })
    persistMusicRuntime()
    setMessage('音乐资料已合并导入')
  }

  return {
    searchQuery, searchResult, homeSections, accountProfiles, isSearching, isLoadingHome,
    homeLoadError, isHomeUsingCache, libraryMessage, localTracks, likedTracks,
    history: musicHistory, customPlaylists: musicCustomPlaylists, playlistTracks: musicPlaylistTracks,
    sourceConfigs: musicSourceConfigs, privacyPreferences, isPrivacyReady,
    customTrackCount: musicCustomTrackCount, customTotalMinutes: musicCustomTotalMinutes,
    customNickname: musicCustomNickname, customVipLabel: musicCustomVipLabel, customSignature: musicCustomSignature,
    searchAll, clearSearch, loadHome, refreshProfiles, loadPlaylist, loadComments, importLocalFiles, toggleLikeTrack,
    createPlaylist, addToPlaylist, updateSourceConfig, setAnonymousPublicSources,
    clearOnlineAccountData, importPlaylistLink, importPlaylistFile, exportLibrary,
    importLibraryBackup, deleteHistoryTracks, clearAllHistory, setCustomTrackCount,
    setCustomTotalMinutes, setCustomProfile, resetCustomProfile, setMessage
  }
}
