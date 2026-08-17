/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import type { MusicHomeSection, MusicPersistedState } from '../types/music'

const STATE_KEY = 'clingy_music_state_v2'
const HOME_CACHE_KEY = 'clingy_music_home_cache_v1'
const audioStore = localforage.createInstance({ name: 'clingy_music', storeName: 'audio_files' })

export const loadMusicState = async (): Promise<Partial<MusicPersistedState> | null> => {
  try { return await localforage.getItem<MusicPersistedState>(STATE_KEY) } catch { return null }
}

export const saveMusicState = async (state: MusicPersistedState) => {
  // Vue 的 reactive/ref 内容可能携带 Proxy，IndexedDB 的 structured clone 无法保存 Proxy。
  // 音乐状态只包含 JSON 数据，序列化后再写入可同时剥离 Proxy 与组件引用。
  const serializable = JSON.parse(JSON.stringify(state)) as MusicPersistedState
  await localforage.setItem(STATE_KEY, serializable)
}

export const loadMusicHomeCache = async (): Promise<{ sections: MusicHomeSection[]; savedAt: number } | null> => {
  try { return await localforage.getItem<{ sections: MusicHomeSection[]; savedAt: number }>(HOME_CACHE_KEY) } catch { return null }
}

export const saveMusicHomeCache = async (sections: MusicHomeSection[]) => {
  const serializable = JSON.parse(JSON.stringify({ sections, savedAt: Date.now() })) as { sections: MusicHomeSection[]; savedAt: number }
  await localforage.setItem(HOME_CACHE_KEY, serializable)
}

export const saveLocalMusicFile = async (key: string, file: Blob) => {
  await audioStore.setItem(key, file)
}

export const getLocalMusicFile = async (key: string) => audioStore.getItem<Blob>(key)

export const deleteLocalMusicFile = async (key: string) => audioStore.removeItem(key)

export const clearLocalMusicFiles = async () => audioStore.clear()
