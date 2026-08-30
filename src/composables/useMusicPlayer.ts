/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed, ref } from 'vue'
import type { MusicPlaylist, MusicTrack } from '../types/music'
import { musicTrackKey } from '../types/music'
import { createMusicProviders } from '../services/musicProviders'
import { getLocalMusicFile } from '../services/musicStorage'
import { probeMusicUrl, verifiedEmbedTrack } from '../services/musicPlaybackValidation'
import {
  initializeMusicRuntime, musicCurrentIndex, musicCurrentTime, musicHistory, musicLikedKeys,
  musicPlayMode, musicPreferredQuality, musicQueue, musicSourceConfigs, musicVolume, persistMusicRuntime
} from '../services/musicRuntime'

export type { MusicPlaylist, MusicTrack } from '../types/music'

export const defaultPlaylists: MusicPlaylist[] = [
  { id: 'liked', sourceId: 'local', name: '我喜欢的音乐', trackCount: 0, playCount: 0, isLiked: true },
  { id: 'local', sourceId: 'local', name: '本地音乐', trackCount: 0, playCount: 0 },
  { id: 'history', sourceId: 'local', name: '最近播放', trackCount: 0, playCount: 0 }
]

export const horizontalCards = [
  { id: 'hc-1', name: '每日推荐', sub: '为你挑选' },
  { id: 'hc-2', name: '私人漫游', sub: '连续发现' },
  { id: 'hc-3', name: '排行榜', sub: '热门更新' },
  { id: 'hc-4', name: '本地音乐', sub: '离线曲库' },
  { id: 'hc-5', name: '音乐统计', sub: '听见时间' }
]

const audio = new Audio()
audio.preload = 'metadata'
const isPlaying = ref(false)
const isBuffering = ref(false)
const playbackError = ref('')
const isLyricMode = ref(false)
const resolvedUrl = ref('')
const sleepEndsAt = ref(0)
const activePlaybackType = ref<'full' | 'local' | 'embed'>('full')
const activeEmbedId = ref('')
const activeEmbedProvider = ref<'youtube' | 'bilibili'>('youtube')
const embedViewRequest = ref(0)
let localObjectUrl = ''
let requestSequence = 0
let sleepTimer: number | null = null
let embedValidationTimer: number | null = null
let activeCandidateId = ''
let embedController: MusicEmbedController | null = null
const rejectedCandidateIds = new Set<string>()

export interface MusicEmbedController {
  load(videoId: string, autoplay: boolean): Promise<void>
  play(): void
  pause(): void
  seek(seconds: number): void
  setVolume(value: number): void
  destroy(): void
}

let resumePendingEmbed: (() => void) | null = null
export const registerMusicEmbedController = (controller: MusicEmbedController | null) => {
  embedController = controller
  if (controller && resumePendingEmbed) resumePendingEmbed()
}

export const updateMusicEmbedState = (state: 'playing' | 'paused' | 'buffering' | 'ended' | 'error', duration = 0, currentTime = 0) => {
  if (activePlaybackType.value !== 'embed') return
  const validationSucceeded = state === 'playing' || state === 'ended' || state === 'error' || (state === 'paused' && activeEmbedProvider.value === 'bilibili')
  if (validationSucceeded && embedValidationTimer !== null) { window.clearTimeout(embedValidationTimer); embedValidationTimer = null }
  if (duration > 0 && currentTrack.value) currentTrack.value.duration = duration
  if (currentTime >= 0) musicCurrentTime.value = currentTime
  if (state === 'playing') { isPlaying.value = true; isBuffering.value = false; playbackError.value = '' }
  if (state === 'paused') { isPlaying.value = false; isBuffering.value = false }
  if (state === 'buffering') isBuffering.value = true
  if (state === 'ended') void nextTrack(true)
  if (state === 'error') {
    isPlaying.value = false; isBuffering.value = false
    rejectedCandidateIds.add(activeCandidateId)
    void loadCurrentTrack(true)
  }
}

const currentTrack = computed(() => musicCurrentIndex.value >= 0 ? musicQueue.value[musicCurrentIndex.value] || null : null)
const isLikedCurrent = computed(() => currentTrack.value ? musicLikedKeys.value.includes(musicTrackKey(currentTrack.value)) : false)
const progressPercent = computed(() => currentTrack.value?.duration ? Math.min(100, Math.max(0, musicCurrentTime.value / currentTrack.value.duration * 100)) : 0)
const currentLyricIndex = computed(() => {
  const lyrics = currentTrack.value?.lyrics || []
  if (!lyrics.length) return -1
  if (musicCurrentTime.value < lyrics[0].time) return -1
  let result = 0
  for (let index = 0; index < lyrics.length; index += 1) {
    if (musicCurrentTime.value >= lyrics[index].time) {
      result = index
    } else {
      break
    }
  }
  return result
})

const cleanupObjectUrl = () => { if (localObjectUrl) { URL.revokeObjectURL(localObjectUrl); localObjectUrl = '' } }

const resolveTrackUrl = async (track: MusicTrack) => {
  if ((track.externalUrl && track.playbackType !== 'embed') || track.sourceId === 'apple' || /试听|preview/i.test(track.reason || '')) throw new Error('该结果不是完整歌曲，已禁止播放')
  if (track.playbackType !== 'full' && track.playbackType !== 'local' && !track.localBlobKey) throw new Error('该曲目没有完整播放能力，请重新搜索')
  if (track.audioUrl) return track.audioUrl
  if (track.localBlobKey) {
    const blob = await getLocalMusicFile(track.localBlobKey)
    if (!blob) throw new Error('本地音频文件已不存在，请重新导入')
    cleanupObjectUrl()
    localObjectUrl = URL.createObjectURL(blob)
    return localObjectUrl
  }
  const provider = createMusicProviders(musicSourceConfigs.value).find(item => item.id === track.sourceId)
  if (!provider?.getStreamUrl) throw new Error(track.reason || '该来源暂未配置播放能力')
  const url = await provider.getStreamUrl(track, musicPreferredQuality.value)
  if (!url) throw new Error(track.requiresVip ? '当前账号没有这首歌的完整播放权限' : '没有找到可完整播放的音源')
  return url
}

const loadCandidateLyrics = async (candidate: MusicTrack, target: MusicTrack) => {
  if (target.lyrics?.length) return
  const provider = createMusicProviders(musicSourceConfigs.value).find(item => item.id === candidate.sourceId)
  if (!provider?.getLyrics) return
  const lyrics = await provider.getLyrics(candidate).catch(() => [])
  if (!lyrics?.length) return
  candidate.lyrics = lyrics
  target.lyrics = lyrics
}

const candidateId = (track: MusicTrack) => `${track.sourceId}:${track.sourceTrackId}:${track.embedId || ''}`
const playbackCandidates = (track: MusicTrack) => {
  const primary = { ...track, sourceCandidates: undefined }
  const candidates = [primary, ...(track.sourceCandidates || []).map(item => ({ ...item, sourceCandidates: undefined }))]
  const seen = new Set<string>()
  return candidates.filter(item => {
    const key = candidateId(item)
    if (seen.has(key) || rejectedCandidateIds.has(key) || item.validationStatus === 'trial' || item.available === false) return false
    seen.add(key)
    return true
  })
}

const recordHistory = (track: MusicTrack) => {
  const key = musicTrackKey(track)
  const existing = musicHistory.value.find(item => musicTrackKey(item) === key)
  const updated = { ...(existing || track), playCount: (existing?.playCount || track.playCount || 0) + 1, lastPlayedAt: Date.now() }
  musicHistory.value = [updated, ...musicHistory.value.filter(item => musicTrackKey(item) !== key)].slice(0, 500)
}

const loadCurrentTrack = async (autoplay = true, restoreTime = 0) => {
  const track = currentTrack.value
  if (!track) return
  const sequence = ++requestSequence
  isBuffering.value = true
  playbackError.value = ''
  const failures: string[] = []
  for (const candidate of playbackCandidates(track)) {
    if (sequence !== requestSequence) return
    activeCandidateId = candidateId(candidate)
    try {
      if (verifiedEmbedTrack(candidate)) {
        audio.pause(); audio.removeAttribute('src'); cleanupObjectUrl()
        activePlaybackType.value = 'embed'; activeEmbedId.value = candidate.embedId || ''; activeEmbedProvider.value = candidate.embedProvider || 'youtube'
        track.reason = candidate.reason; track.duration = candidate.duration || track.duration
        resolvedUrl.value = candidate.externalUrl || `youtube:${candidate.embedId}`
        const startEmbed = () => {
          if (!embedController || !candidate.embedId) return
          void embedController.load(candidate.embedId, autoplay).then(() => {
            if (embedValidationTimer !== null) window.clearTimeout(embedValidationTimer)
            embedValidationTimer = window.setTimeout(() => {
              rejectedCandidateIds.add(activeCandidateId)
              playbackError.value = '当前视频无法在应用内播放，正在切换备用来源'
              void loadCurrentTrack(true)
            }, 7000)
          })
        }
        resumePendingEmbed = startEmbed
        startEmbed()
        if (autoplay) embedViewRequest.value += 1
        recordHistory(track); persistMusicRuntime()
        return
      }
      const url = await resolveTrackUrl(candidate)
      const probe = await probeMusicUrl(url, 12000, candidate.sourceId === 'aggregate' ? 'include' : 'omit')
      if (!probe.valid) {
        candidate.available = false; candidate.validationStatus = probe.trial ? 'trial' : 'unavailable'; candidate.reason = probe.reason
        rejectedCandidateIds.add(activeCandidateId); failures.push(probe.reason); continue
      }
      if (sequence !== requestSequence) return
      await loadCandidateLyrics(candidate, track)
      if (sequence !== requestSequence) return
      activePlaybackType.value = candidate.localBlobKey ? 'local' : 'full'; activeEmbedId.value = ''
      resumePendingEmbed = null
      track.reason = `${candidate.originSourceId || candidate.sourceId} · 已验证完整播放`; track.duration = probe.duration || candidate.duration
      resolvedUrl.value = url
      audio.src = url
      audio.volume = musicVolume.value
      audio.load()
      if (restoreTime > 0) audio.currentTime = restoreTime
      if (autoplay) await audio.play()
      recordHistory(track)
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: track.album, artwork: track.coverUrl ? [{ src: track.coverUrl }] : [] })
        navigator.mediaSession.playbackState = autoplay ? 'playing' : 'paused'
      }
      persistMusicRuntime()
      return
    } catch (error) {
      rejectedCandidateIds.add(activeCandidateId)
      failures.push(error instanceof Error ? error.message : '播放失败')
    }
  }
  if (sequence === requestSequence) {
    isPlaying.value = false; isBuffering.value = false
    playbackError.value = failures.at(-1) || '所有候选来源都暂时无法播放'
  }
}

const nextTrack = async (fromEnded = false) => {
  if (!musicQueue.value.length) return
  if (fromEnded && musicPlayMode.value === 'single') {
    if (activePlaybackType.value === 'embed') { embedController?.seek(0); embedController?.play(); return }
    audio.currentTime = 0
  }
  else if (musicPlayMode.value === 'random' && musicQueue.value.length > 1) {
    let next = musicCurrentIndex.value
    while (next === musicCurrentIndex.value) next = Math.floor(Math.random() * musicQueue.value.length)
    musicCurrentIndex.value = next
  } else musicCurrentIndex.value = (musicCurrentIndex.value + 1) % musicQueue.value.length
  musicCurrentTime.value = 0
  await loadCurrentTrack(true)
}

const prevTrack = async () => {
  if (!musicQueue.value.length) return
  if ((activePlaybackType.value === 'embed' ? musicCurrentTime.value : audio.currentTime) > 3) { seek(0); return }
  musicCurrentIndex.value = (musicCurrentIndex.value - 1 + musicQueue.value.length) % musicQueue.value.length
  musicCurrentTime.value = 0
  await loadCurrentTrack(true)
}

const seek = (seconds: number) => {
  if (activePlaybackType.value === 'embed' && embedController) {
    const duration = currentTrack.value?.duration || 0
    const target = Math.max(0, Math.min(duration, seconds))
    embedController.seek(target); musicCurrentTime.value = target
    return
  }
  const duration = Number.isFinite(audio.duration) ? audio.duration : currentTrack.value?.duration || 0
  audio.currentTime = Math.max(0, Math.min(duration, seconds))
  musicCurrentTime.value = audio.currentTime
}

audio.addEventListener('play', () => { isPlaying.value = true; isBuffering.value = false })
audio.addEventListener('pause', () => { isPlaying.value = false; persistMusicRuntime() })
audio.addEventListener('waiting', () => { isBuffering.value = true })
audio.addEventListener('canplay', () => { isBuffering.value = false })
audio.addEventListener('timeupdate', () => { musicCurrentTime.value = audio.currentTime || 0 })
audio.addEventListener('durationchange', () => {
  const track = currentTrack.value
  if (!track || !Number.isFinite(audio.duration)) return
  const source = musicSourceConfigs.value.find(item => item.id === track.sourceId)
  if (source?.kind === 'meting' && audio.duration >= 29 && audio.duration <= 31.5) {
    audio.pause(); audio.removeAttribute('src'); resolvedUrl.value = ''; isPlaying.value = false
    track.available = false; track.reason = '已屏蔽 30 秒试听音源'; playbackError.value = track.reason
    rejectedCandidateIds.add(activeCandidateId)
    void loadCurrentTrack(true)
    return
  }
  track.duration = audio.duration
})
audio.addEventListener('ended', () => { void nextTrack(true) })
audio.addEventListener('error', () => {
  if (!resolvedUrl.value || activePlaybackType.value === 'embed') return
  isPlaying.value = false; isBuffering.value = true
  rejectedCandidateIds.add(activeCandidateId)
  playbackError.value = '当前地址加载失败，正在自动换源'
  void loadCurrentTrack(true)
})
audio.volume = musicVolume.value

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => { void audio.play() })
  navigator.mediaSession.setActionHandler('pause', () => audio.pause())
  navigator.mediaSession.setActionHandler('previoustrack', () => { void prevTrack() })
  navigator.mediaSession.setActionHandler('nexttrack', () => { void nextTrack() })
  navigator.mediaSession.setActionHandler('seekto', details => { if (typeof details.seekTime === 'number') seek(details.seekTime) })
}

export function useMusicPlayer() {
  void initializeMusicRuntime().then(() => {
    audio.volume = musicVolume.value
    if (currentTrack.value && !audio.src) void loadCurrentTrack(false, musicCurrentTime.value)
  })

  const togglePlay = async () => {
    if (!currentTrack.value) return
    if (activePlaybackType.value === 'embed' && embedController) {
      if (isPlaying.value) embedController.pause(); else embedController.play()
      return
    }
    if (!audio.src || !resolvedUrl.value) { await loadCurrentTrack(true); return }
    if (audio.paused) await audio.play().catch(error => { playbackError.value = error instanceof Error ? error.message : '播放失败' })
    else audio.pause()
  }

  const playTrack = async (track: MusicTrack, replaceQueue = false) => {
    rejectedCandidateIds.clear()
    const key = musicTrackKey(track)
    if (replaceQueue) musicQueue.value = [track]
    let index = musicQueue.value.findIndex(item => musicTrackKey(item) === key)
    if (index < 0) { musicQueue.value = [...musicQueue.value, track]; index = musicQueue.value.length - 1 }
    else musicQueue.value[index] = track
    musicCurrentIndex.value = index
    musicCurrentTime.value = 0
    await loadCurrentTrack(true)
  }

  const playTracks = async (tracks: MusicTrack[], start = 0) => {
    if (!tracks.length) return
    rejectedCandidateIds.clear()
    musicQueue.value = [...tracks]
    musicCurrentIndex.value = Math.max(0, Math.min(start, tracks.length - 1))
    musicCurrentTime.value = 0
    await loadCurrentTrack(true)
  }

  const removeFromQueue = (index: number) => {
    if (index < 0 || index >= musicQueue.value.length) return
    const removingCurrent = index === musicCurrentIndex.value
    musicQueue.value.splice(index, 1)
    if (!musicQueue.value.length) { audio.pause(); embedController?.pause(); audio.removeAttribute('src'); musicCurrentIndex.value = -1; resolvedUrl.value = ''; activeEmbedId.value = '' }
    else if (index < musicCurrentIndex.value) musicCurrentIndex.value -= 1
    else if (removingCurrent) { musicCurrentIndex.value %= musicQueue.value.length; void loadCurrentTrack(true) }
    persistMusicRuntime()
  }

  const clearQueue = () => { audio.pause(); embedController?.pause(); audio.removeAttribute('src'); cleanupObjectUrl(); musicQueue.value = []; musicCurrentIndex.value = -1; musicCurrentTime.value = 0; resolvedUrl.value = ''; activeEmbedId.value = ''; activePlaybackType.value = 'full'; persistMusicRuntime() }
  const toggleMode = () => { musicPlayMode.value = musicPlayMode.value === 'loop' ? 'single' : musicPlayMode.value === 'single' ? 'random' : 'loop'; persistMusicRuntime() }
  const toggleLike = () => { if (!currentTrack.value) return; const key = musicTrackKey(currentTrack.value); musicLikedKeys.value = musicLikedKeys.value.includes(key) ? musicLikedKeys.value.filter(item => item !== key) : [...musicLikedKeys.value, key]; persistMusicRuntime() }
  const setVolume = (value: number) => { musicVolume.value = Math.max(0, Math.min(1, value)); audio.volume = musicVolume.value; embedController?.setVolume(musicVolume.value); persistMusicRuntime() }
  const setQuality = (value: typeof musicPreferredQuality.value) => { musicPreferredQuality.value = value; persistMusicRuntime() }
  const setSleepTimer = (minutes: number) => {
    if (sleepTimer !== null) window.clearTimeout(sleepTimer)
    sleepTimer = null; sleepEndsAt.value = 0
    if (minutes > 0) {
      sleepEndsAt.value = Date.now() + minutes * 60_000
      sleepTimer = window.setTimeout(() => { audio.pause(); sleepEndsAt.value = 0; sleepTimer = null }, minutes * 60_000)
    }
  }
  const nextTrackAction = () => nextTrack()
  const formatTime = (seconds: number) => { const value = Number.isFinite(seconds) ? seconds : 0; return `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}` }

  return {
    playlist: musicQueue, currentTrack, currentTrackIndex: musicCurrentIndex, isPlaying, isBuffering,
    playbackError, currentTime: musicCurrentTime, isLikedCurrent, playMode: musicPlayMode,
    isLyricMode, progressPercent, currentLyricIndex, volume: musicVolume, sleepEndsAt, activePlaybackType, activeEmbedId, activeEmbedProvider, embedViewRequest,
    preferredQuality: musicPreferredQuality, togglePlay, playTrack, playTracks, nextTrack: nextTrackAction,
    prevTrack, seek, toggleMode, toggleLike, removeFromQueue, clearQueue, setVolume, setQuality, setSleepTimer, formatTime
  }
}
