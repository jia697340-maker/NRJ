/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, ref } from 'vue'
import type { MusicPlaylist, MusicQuality, MusicSourceConfig, MusicTrack } from '../types/music'
import { defaultMusicSourceConfigs } from './musicProviders'
import { loadMusicState, saveMusicState } from './musicStorage'

export const musicQueue = ref<MusicTrack[]>([])
export const musicCurrentIndex = ref(-1)
export const musicCurrentTime = ref(0)
export const musicVolume = ref(0.85)
export const musicPlayMode = ref<'loop' | 'single' | 'random'>('loop')
export const musicPreferredQuality = ref<MusicQuality>('exhigh')
export const musicLikedKeys = ref<string[]>([])
export const musicHistory = ref<MusicTrack[]>([])
export const musicCustomPlaylists = ref<MusicPlaylist[]>([])
export const musicPlaylistTracks = reactive<Record<string, MusicTrack[]>>({})
export const musicSourceConfigs = ref<MusicSourceConfig[]>(defaultMusicSourceConfigs())
export const musicRuntimeReady = ref(false)

let saveTimer: number | null = null

export const persistMusicRuntime = () => {
  if (!musicRuntimeReady.value) return
  if (saveTimer !== null) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void saveMusicState({
      version: 2,
      likedTrackKeys: musicLikedKeys.value,
      history: musicHistory.value.slice(0, 500),
      customPlaylists: musicCustomPlaylists.value,
      playlistTracks: { ...musicPlaylistTracks },
      queue: musicQueue.value,
      currentTrackKey: musicQueue.value[musicCurrentIndex.value]?.id || null,
      currentTime: musicCurrentTime.value,
      volume: musicVolume.value,
      playMode: musicPlayMode.value,
      preferredQuality: musicPreferredQuality.value,
      sourceConfigs: musicSourceConfigs.value
    })
  }, 250)
}

let initializePromise: Promise<void> | null = null
const restorePlayableTracks = (value: unknown): MusicTrack[] => (Array.isArray(value) ? value : []).flatMap(item => {
  if (!item || item.externalUrl || item.sourceId === 'apple' || /试听|preview/i.test(item.reason || '')) return []
  if (item.localBlobKey) return [{ ...item, playbackType: 'local' as const }]
  return [{ ...item, playbackType: 'full' as const }]
})

export const initializeMusicRuntime = () => {
  if (initializePromise) return initializePromise
  initializePromise = (async () => {
    const saved = await loadMusicState()
    if (saved) {
      musicLikedKeys.value = Array.isArray(saved.likedTrackKeys) ? saved.likedTrackKeys : []
      musicHistory.value = restorePlayableTracks(saved.history)
      musicCustomPlaylists.value = Array.isArray(saved.customPlaylists) ? saved.customPlaylists : []
      Object.entries(saved.playlistTracks || {}).forEach(([key, tracks]) => { musicPlaylistTracks[key] = restorePlayableTracks(tracks) })
      musicQueue.value = restorePlayableTracks(saved.queue)
      musicCurrentIndex.value = saved.currentTrackKey ? Math.max(0, musicQueue.value.findIndex(item => item.id === saved.currentTrackKey)) : (musicQueue.value.length ? 0 : -1)
      musicCurrentTime.value = Number(saved.currentTime || 0)
      musicVolume.value = Number.isFinite(saved.volume) ? Number(saved.volume) : 0.85
      musicPlayMode.value = saved.playMode || 'loop'
      musicPreferredQuality.value = saved.preferredQuality || 'exhigh'
      const defaults = defaultMusicSourceConfigs()
      const stored = Array.isArray(saved.sourceConfigs) ? saved.sourceConfigs : []
      musicSourceConfigs.value = defaults.map(item => {
        const merged = { ...item, ...(stored.find(savedItem => savedItem.id === item.id) || {}) }
        if (!merged.apiBase?.trim() && item.apiBase?.trim()) {
          merged.apiBase = item.apiBase
          merged.enabled = item.enabled
        }
        if (merged.kind !== 'local' && !merged.apiBase?.trim()) merged.enabled = false
        return merged
      })
    }
    musicRuntimeReady.value = true
  })()
  return initializePromise
}
