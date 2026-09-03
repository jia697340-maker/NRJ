/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed, ref } from 'vue'
import type { MusicCommentPage, MusicHomeSection, MusicPlaylist, MusicSearchPage, MusicSourceConfig, MusicSourceStatus, MusicTrack, MusicUserProfile } from '../types/music'
import { musicTrackKey } from '../types/music'
import { createMusicProviders, filterMusicHomeSectionsByEnabledSources, isPublicMusicDiscoveryEnabled, loadPublicMusicComments, loadPublicMusicHomeSections, logoutBundledMusicAccounts } from '../services/musicProviders'
import { clearMusicHomeCache, getLocalMusicFile, loadMusicHomeCache, saveLocalMusicFile, saveMusicHomeCache } from '../services/musicStorage'
import { readLocalMusicMetadata } from '../services/musicFileMetadata'
import { parseMusicLyrics } from '../services/musicLyrics'
import { defaultMusicPrivacyPreferences, loadMusicPrivacyPreferences, MUSIC_PRIVACY_VERSION, saveMusicPrivacyPreferences } from '../services/musicPrivacy'
import { probeMusicUrl, verifiedEmbedTrack } from '../services/musicPlaybackValidation'
import { markMusicSourceFailure, markMusicSourceSuccess, orderMusicSourcesForCapability } from '../services/musicSourceFallback'
import {
  initializeMusicRuntime, musicCustomPlaylists, musicCustomTrackCount, musicCustomTotalMinutes,
  musicCustomNickname, musicCustomVipLabel, musicCustomSignature,
  musicHistory, musicLikedKeys, musicPlaylistTracks, musicPreferredQuality, musicSourceConfigs, persistMusicRuntime
} from '../services/musicRuntime'

const searchQuery = ref('')
const searchResult = ref<MusicSearchPage>({ tracks: [] })
const homeSections = ref<MusicHomeSection[]>([])
const isSearching = ref(false)
const isLoadingHome = ref(false)
const homeLoadError = ref('')
const isHomeUsingCache = ref(false)
const libraryMessage = ref('')
const searchSourceStatuses = ref<MusicSourceStatus[]>([])
const accountProfiles = ref<MusicUserProfile[]>([])
const localTracks = computed(() => musicPlaylistTracks.local || [])
const privacyPreferences = ref(defaultMusicPrivacyPreferences())
const isPrivacyReady = ref(false)
let privacyPromise: Promise<void> | null = null
let homeRequestSequence = 0
const initializePrivacy = () => {
  if (privacyPromise) return privacyPromise
  privacyPromise = (async () => {
    privacyPreferences.value = await loadMusicPrivacyPreferences()
    if (!privacyPreferences.value.allowAnonymousPublicSources) {
      musicSourceConfigs.value = musicSourceConfigs.value.map(item => item.anonymousPublic ? { ...item, enabled: false } : item)
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

const normalizeTrackIdentity = (value: string) => value.toLowerCase().replace(/[\s·・\-—_()（）【】\[\]]/g, '')
export const musicSearchIdentity = (track: Pick<MusicTrack, 'title' | 'artist'>) => `${normalizeTrackIdentity(track.title)}|${normalizeTrackIdentity(track.artist)}`

const mapWithConcurrency = async <T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) => {
  const output = new Array<R>(items.length)
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      output[index] = await task(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return output
}

export function useMusicLibrary() {
  const libraryReady = initializeMusicRuntime().then(initializePrivacy)
  void libraryReady
  const providers = () => createMusicProviders(musicSourceConfigs.value)
  const enabledCachedHomeSections = (sections: MusicHomeSection[]) => filterMusicHomeSectionsByEnabledSources(sections, musicSourceConfigs.value)

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
        searchSourceStatuses.value = []
        setMessage('还没有启用可搜索的在线音乐来源')
        return
      }
      const configFor = (id: string) => musicSourceConfigs.value.find(item => item.id === id)
      const publicProviders = orderMusicSourcesForCapability(activeProviders.filter(provider => configFor(provider.id)?.anonymousPublic), 'search')
      const independentProviders = orderMusicSourcesForCapability(activeProviders.filter(provider => !configFor(provider.id)?.anonymousPublic), 'search')
      const pages: MusicSearchPage[] = []
      const outerStatuses: MusicSourceStatus[] = []
      const independentResults = await Promise.allSettled(independentProviders.map(provider => provider.search(normalized)))
      independentResults.forEach((result, index) => {
        const provider = independentProviders[index]
        const config = configFor(provider.id)
        if (result.status === 'rejected') {
          markMusicSourceFailure(provider.id, 'search', result.reason)
          outerStatuses.push({ id: provider.id, name: config?.name || provider.id, ok: false, detail: result.reason instanceof Error ? result.reason.message : '搜索请求失败' })
          return
        }
        markMusicSourceSuccess(provider.id, 'search')
        pages.push(result.value)
        outerStatuses.push(...(result.value.sourceStatuses?.length ? result.value.sourceStatuses : [{ id: provider.id, name: config?.name || provider.id, ok: true, detail: result.value.tracks.length ? `返回 ${result.value.tracks.length} 首` : '已响应，但没有结果' }]))
      })
      for (const provider of publicProviders) {
        const config = configFor(provider.id)
        try {
          const page = await provider.search(normalized)
          markMusicSourceSuccess(provider.id, 'search')
          outerStatuses.push(...(page.sourceStatuses?.length ? page.sourceStatuses : [{ id: provider.id, name: config?.name || provider.id, ok: true, detail: page.tracks.length ? `返回 ${page.tracks.length} 首` : '已响应，但没有结果' }]))
          if (page.tracks.length || page.playlists?.length || page.albums?.length || page.artists?.length) {
            pages.push(page)
            break
          }
        } catch (error) {
          markMusicSourceFailure(provider.id, 'search', error)
          outerStatuses.push({ id: provider.id, name: config?.name || provider.id, ok: false, detail: error instanceof Error ? error.message : '搜索请求失败' })
        }
      }
      const groups = new Map<string, MusicTrack[]>()
      for (const track of pages.flatMap(item => item.tracks)) {
        if (track.available === false || (track.externalUrl && track.playbackType !== 'embed') || !track.playbackType) continue
        const identity = musicSearchIdentity(track)
        groups.set(identity, [...(groups.get(identity) || []), { ...track, sourceCandidates: undefined }])
      }
      const groupedTracks = [...groups.values()]
      const deduplicated = groupedTracks.flatMap(candidates => {
        const playable = candidates.find(item => item.playbackType === 'full' && item.available !== false)
          || candidates.find(item => verifiedEmbedTrack(item) && item.embedProvider === 'bilibili')
          || candidates.find(verifiedEmbedTrack)
        return playable ? [{ ...playable, validationStatus: playable.validationStatus || 'unknown', sourceCandidates: candidates.filter(item => item.id !== playable.id) }] : []
      })
      searchResult.value = {
        tracks: deduplicated,
        playlists: pages.flatMap(item => item.playlists || []),
        albums: pages.flatMap(item => item.albums || []),
        artists: pages.flatMap(item => item.artists || [])
      }
      searchSourceStatuses.value = outerStatuses
      const failedNames = outerStatuses.filter(item => !item.ok).map(item => item.name)
      if (!pages.length) setMessage('全部已启用音乐来源都暂时没有响应，请稍后重试')
      else if (!deduplicated.length) setMessage('没有找到可播放的结果')
      else if (failedNames.length) setMessage(`${failedNames.slice(0, 2).join('、')}暂时不可用，已自动切换其他来源`)
    } finally { isSearching.value = false }
  }

  const clearSearch = () => {
    searchQuery.value = ''
    searchResult.value = { tracks: [] }
    searchSourceStatuses.value = []
    isSearching.value = false
  }

  const loadHome = async (force = false) => {
    if (isLoadingHome.value && !force) return
    if (!force && homeSections.value.length > 0) return

    const requestSequence = ++homeRequestSequence
    isLoadingHome.value = true
    homeLoadError.value = ''
    if (force) homeSections.value = []
    try {
      await libraryReady

      const configFor = (id: string) => musicSourceConfigs.value.find(item => item.id === id)
      const capable = providers().filter(provider => provider.getHome)
      const publicDiscoveryEnabled = isPublicMusicDiscoveryEnabled(musicSourceConfigs.value, privacyPreferences.value.allowAnonymousPublicSources)

      // 没有任何可提供首页内容的来源时，不读旧缓存，也不调用隐藏的公共推荐接口。
      if (!capable.length && !publicDiscoveryEnabled) {
        if (requestSequence !== homeRequestSequence) return
        homeSections.value = []
        isHomeUsingCache.value = false
        homeLoadError.value = '还没有启用可提供首页内容的音乐来源'
        await clearMusicHomeCache()
        return
      }

      // 如果非强制刷新，先尝试加载本地缓存以秒开
      if (!force && !homeSections.value.length) {
        const cache = await loadMusicHomeCache()
        if (requestSequence !== homeRequestSequence) return
        const cachedSections = enabledCachedHomeSections((cache?.sections || []).filter(section => section.id !== 'public-discovery'))
        if (cachedSections.length) {
          homeSections.value = cachedSections
          isHomeUsingCache.value = true
        }
      }

      const independent = orderMusicSourcesForCapability(capable.filter(provider => !configFor(provider.id)?.anonymousPublic), 'home')
      const publicPool = orderMusicSourcesForCapability(capable.filter(provider => configFor(provider.id)?.anonymousPublic), 'home')
      const independentResults = await Promise.allSettled(independent.map(provider => provider.getHome!()))
      if (requestSequence !== homeRequestSequence) return
      const independentSections = independentResults.flatMap((result, index) => {
        const provider = independent[index]
        if (result.status === 'rejected') { markMusicSourceFailure(provider.id, 'home', result.reason); return [] }
        markMusicSourceSuccess(provider.id, 'home')
        return result.value
      }).filter(section => Boolean(section.tracks?.length || section.playlists?.length))
      let publicSections: MusicHomeSection[] = []
      for (const provider of publicPool) {
        try {
          const sections = (await provider.getHome!()).filter(section => Boolean(section.tracks?.length || section.playlists?.length))
          markMusicSourceSuccess(provider.id, 'home')
          if (sections.length) { publicSections = sections; break }
        } catch (error) { markMusicSourceFailure(provider.id, 'home', error) }
      }
      if (!publicSections.length && publicDiscoveryEnabled) publicSections = await loadPublicMusicHomeSections().catch(() => [])
      if (requestSequence !== homeRequestSequence) return
      const freshSections = [...publicSections, ...independentSections.filter(section => !publicSections.some(publicSection => publicSection.id === section.id))]
      if (freshSections.length) {
        homeSections.value = freshSections
        isHomeUsingCache.value = false
        await saveMusicHomeCache(homeSections.value)
        return
      }

      if (!homeSections.value.length) {
        const cache = await loadMusicHomeCache()
        if (requestSequence !== homeRequestSequence) return
        const cachedSections = enabledCachedHomeSections((cache?.sections || []).filter(section => section.id !== 'public-discovery'))
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
      if (requestSequence !== homeRequestSequence) return
      if (!homeSections.value.length) {
        const cache = await loadMusicHomeCache()
        if (requestSequence !== homeRequestSequence) return
        const cachedSections = enabledCachedHomeSections((cache?.sections || []).filter(section => section.id !== 'public-discovery'))
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
      if (requestSequence === homeRequestSequence) isLoadingHome.value = false
    }
  }

  const refreshProfiles = async () => {
    const capable = providers().filter(provider => provider.getProfile)
    const results = await Promise.allSettled(capable.map(provider => provider.getProfile!()))
    accountProfiles.value = results.filter((item): item is PromiseFulfilledResult<MusicUserProfile | null> => item.status === 'fulfilled').map(item => item.value).filter(Boolean) as MusicUserProfile[]
  }

  const loadPlaylist = async (playlist: MusicPlaylist) => {
    const active = providers().filter(item => item.getPlaylist)
    const original = active.find(item => item.id === playlist.sourceId)
    const ordered = orderMusicSourcesForCapability([...(original ? [original] : []), ...active.filter(item => item.id !== original?.id)], 'playlist')
    const sourceConfig = musicSourceConfigs.value.find(item => item.id === playlist.sourceId)
    const explicitPrefix = playlist.id.includes(':') ? playlist.id.slice(0, playlist.id.indexOf(':')) : (sourceConfig?.kind === 'meting' ? 'netease' : '')
    const rawId = playlist.id.includes(':') ? playlist.id.slice(playlist.id.indexOf(':') + 1) : playlist.id
    const failures: string[] = []
    for (const provider of ordered) {
      const config = musicSourceConfigs.value.find(item => item.id === provider.id)
      if (explicitPrefix === 'tencent' && config?.kind === 'netease') continue
      const id = config?.kind === 'meting' || config?.kind === 'aggregate' ? `${explicitPrefix || 'netease'}:${rawId}` : rawId
      try {
        const result = await provider.getPlaylist!(id)
        if (!result.tracks.length) throw new Error('来源没有返回歌曲')
        markMusicSourceSuccess(provider.id, 'playlist')
        musicPlaylistTracks[`${playlist.sourceId}:${playlist.id}`] = result.tracks
        persistMusicRuntime()
        return result
      } catch (error) {
        markMusicSourceFailure(provider.id, 'playlist', error)
        failures.push(error instanceof Error ? error.message : '歌单读取失败')
      }
    }
    throw new Error(failures.at(-1) || '全部已启用来源都无法读取该歌单')
  }

  const filterPlayablePlaylistTracks = async (tracks: MusicTrack[], onProgress?: (checked: number, total: number) => void) => {
    await libraryReady
    const activeProviders = providers()
    let checked = 0
    const filtered = await mapWithConcurrency(tracks, 6, async track => {
      try {
        const candidates = [{ ...track, sourceCandidates: undefined }, ...(track.sourceCandidates || []).map(item => ({ ...item, sourceCandidates: undefined }))]
        const seen = new Set<string>()
        for (const candidate of candidates) {
          const key = `${candidate.sourceId}:${candidate.sourceTrackId}:${candidate.embedId || ''}`
          if (seen.has(key) || candidate.available === false || candidate.validationStatus === 'trial') continue
          seen.add(key)
          if (candidate.localBlobKey) {
            if (await getLocalMusicFile(candidate.localBlobKey)) return candidate
            continue
          }
          if (verifiedEmbedTrack(candidate) && candidate.validationStatus !== 'unavailable') return candidate
          if (candidate.playbackType !== 'full' || candidate.externalUrl) continue
          const provider = activeProviders.find(item => item.id === candidate.sourceId)
          if (!candidate.audioUrl && !provider?.getStreamUrl) continue
          try {
            const url = candidate.audioUrl || await provider!.getStreamUrl!(candidate, musicPreferredQuality.value)
            if (!url) continue
            const probe = await probeMusicUrl(url, 12000, candidate.sourceId === 'aggregate' ? 'include' : 'omit')
            if (!probe.valid) continue
            return {
              ...candidate,
              duration: probe.duration || candidate.duration,
              available: true,
              validationStatus: 'verified' as const,
              reason: `${candidate.originSourceId || candidate.sourceId} · 已验证完整播放`
            }
          } catch { continue }
        }
        return null
      } finally {
        checked += 1
        onProgress?.(checked, tracks.length)
      }
    })
    const playable = filtered.filter(Boolean) as MusicTrack[]
    return { tracks: playable, removed: tracks.length - playable.length }
  }

  const loadComments = async (track: MusicTrack, page = 1): Promise<MusicCommentPage> => {
    const failures: unknown[] = []
    try {
      return await loadPublicMusicComments(track, page)
    } catch (publicError) {
      failures.push(publicError)
    }
    const capable = providers().filter(item => item.getComments)
    const original = capable.find(item => item.id === track.sourceId)
    const ordered = orderMusicSourcesForCapability([...(original ? [original] : []), ...capable.filter(item => item.id !== original?.id)], 'comments')
    for (const provider of ordered) {
      try {
        const config = musicSourceConfigs.value.find(item => item.id === provider.id)
        let commentTrack = track
        if (config?.kind === 'netease' && !track.neteaseTrackId && !((track.originSourceId === 'netease' || track.sourceId === provider.id) && /^\d+$/.test(track.sourceTrackId))) {
          const matches = await provider.search(`${track.title} ${track.artist}`.trim())
          const wantedTitle = normalizeTrackIdentity(track.title)
          const wantedArtist = normalizeTrackIdentity(track.artist)
          const matched = matches.tracks.find(item => normalizeTrackIdentity(item.title) === wantedTitle && (normalizeTrackIdentity(item.artist).includes(wantedArtist) || wantedArtist.includes(normalizeTrackIdentity(item.artist))))
          if (!matched) throw new Error('未找到可靠的网易云对应歌曲')
          commentTrack = { ...track, neteaseTrackId: matched.sourceTrackId }
        }
        const result = await provider.getComments!(commentTrack, page)
        markMusicSourceSuccess(provider.id, 'comments')
        return result
      } catch (error) {
        markMusicSourceFailure(provider.id, 'comments', error)
        failures.push(error)
      }
    }
    const last = failures.at(-1)
    throw last instanceof Error ? last : new Error('全部评论来源都暂时不可用')
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

  const createPlaylist = (input: string | Pick<MusicPlaylist, 'name' | 'description' | 'isPrivate' | 'coverUrl' | 'coverStorage' | 'originalCoverUrl'>) => {
    const data = typeof input === 'string' ? { name: input } : input
    const now = Date.now()
    const playlist: MusicPlaylist = {
      id: `custom-${now}-${Math.random().toString(36).slice(2, 7)}`,
      sourceId: 'local', name: data.name.trim() || '新建歌单', description: data.description?.trim(),
      isPrivate: Boolean(data.isPrivate), coverUrl: data.coverUrl, coverStorage: data.coverStorage,
      originalCoverUrl: data.originalCoverUrl, trackCount: 0, playCount: 0, trackIds: [], createdAt: now, updatedAt: now
    }
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

  const addToPlaylists = (playlistIds: string[], track: MusicTrack) => {
    const validIds = new Set(musicCustomPlaylists.value.map(item => item.id))
    playlistIds.filter(id => validIds.has(id)).forEach(id => addToPlaylist(id, track))
    setMessage(playlistIds.length ? `已添加到 ${playlistIds.length} 个歌单` : '请选择歌单')
  }

  const updatePlaylist = (playlistId: string, patch: Partial<Pick<MusicPlaylist, 'name' | 'description' | 'isPrivate' | 'coverUrl' | 'coverStorage' | 'originalCoverUrl'>>) => {
    const index = musicCustomPlaylists.value.findIndex(item => item.id === playlistId)
    if (index < 0) return
    const current = musicCustomPlaylists.value[index]
    musicCustomPlaylists.value[index] = { ...current, ...patch, name: patch.name?.trim() || current.name, description: patch.description?.trim(), updatedAt: Date.now() }
    persistMusicRuntime()
  }

  const reorderPlaylists = (orderedIds: string[]) => {
    const order = new Map(orderedIds.map((id, index) => [id, index]))
    musicCustomPlaylists.value = [...musicCustomPlaylists.value].sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER))
    persistMusicRuntime()
  }

  const reorderPlaylistTracks = (playlistId: string, from: number, to: number) => {
    const tracks = [...(musicPlaylistTracks[playlistId] || [])]
    if (from < 0 || from >= tracks.length || to < 0 || to >= tracks.length || from === to) return
    const [track] = tracks.splice(from, 1)
    tracks.splice(to, 0, track)
    musicPlaylistTracks[playlistId] = tracks
    const playlist = musicCustomPlaylists.value.find(item => item.id === playlistId)
    if (playlist) playlist.updatedAt = Date.now()
    persistMusicRuntime()
  }

  const deletePlaylists = (playlistIds: string[]) => {
    const ids = new Set(playlistIds)
    musicCustomPlaylists.value = musicCustomPlaylists.value.filter(item => !ids.has(item.id))
    playlistIds.forEach(id => { delete musicPlaylistTracks[id] })
    persistMusicRuntime()
    setMessage(`已删除 ${playlistIds.length} 个歌单`)
  }

  const updateSourceConfig = (config: MusicSourceConfig) => {
    musicSourceConfigs.value = musicSourceConfigs.value.map(item => item.id === config.id ? { ...config } : item)
    persistMusicRuntime()
    homeRequestSequence += 1
    homeSections.value = []
    isHomeUsingCache.value = false
    homeLoadError.value = ''
    void clearMusicHomeCache().catch(() => undefined).then(() => loadHome(true))
  }

  const setAnonymousPublicSources = async (allowed: boolean) => {
    privacyPreferences.value = { version: MUSIC_PRIVACY_VERSION, noticeAcknowledged: true, allowAnonymousPublicSources: allowed, updatedAt: Date.now() }
    musicSourceConfigs.value = musicSourceConfigs.value.map(item => item.anonymousPublic ? { ...item, enabled: allowed && Boolean(item.apiBase?.trim()) } : item)
    persistMusicRuntime()
    await saveMusicPrivacyPreferences(privacyPreferences.value)
    homeRequestSequence += 1
    homeSections.value = []
    isHomeUsingCache.value = false
    homeLoadError.value = ''
    await clearMusicHomeCache().catch(() => undefined)
    void loadHome(true)
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
    searchQuery, searchResult, searchSourceStatuses, homeSections, accountProfiles, isSearching, isLoadingHome,
    homeLoadError, isHomeUsingCache, libraryMessage, localTracks, likedTracks,
    history: musicHistory, customPlaylists: musicCustomPlaylists, playlistTracks: musicPlaylistTracks,
    sourceConfigs: musicSourceConfigs, privacyPreferences, isPrivacyReady,
    customTrackCount: musicCustomTrackCount, customTotalMinutes: musicCustomTotalMinutes,
    customNickname: musicCustomNickname, customVipLabel: musicCustomVipLabel, customSignature: musicCustomSignature,
    searchAll, clearSearch, loadHome, refreshProfiles, loadPlaylist, filterPlayablePlaylistTracks, loadComments, importLocalFiles, toggleLikeTrack,
    createPlaylist, addToPlaylist, addToPlaylists, updatePlaylist, reorderPlaylists, reorderPlaylistTracks, deletePlaylists, updateSourceConfig, setAnonymousPublicSources,
    clearOnlineAccountData, importPlaylistLink, importPlaylistFile, exportLibrary,
    importLibraryBackup, deleteHistoryTracks, clearAllHistory, setCustomTrackCount,
    setCustomTotalMinutes, setCustomProfile, resetCustomProfile, setMessage
  }
}
