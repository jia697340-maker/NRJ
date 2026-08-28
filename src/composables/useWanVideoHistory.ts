/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'
import type { WanDuration, WanMedia, WanMode, WanModel, WanRatio, WanResolution, WanUsage } from '../services/wanVideo'

export type WanTaskStatus = 'submitting' | 'pending' | 'running' | 'paused' | 'downloading' | 'completed' | 'failed' | 'canceled' | 'expired'

export interface WanTaskParams {
  prompt: string
  model: WanModel
  mode: WanMode
  resolution: WanResolution
  ratio: WanRatio
  duration: WanDuration
  audio: boolean
  seed?: number
  promptExtend: boolean
  watermark: boolean
  media: Array<Pick<WanMedia, 'type' | 'label'>>
}

export interface WanVideoTask {
  id: string
  createdAt: number
  updatedAt: number
  status: WanTaskStatus
  baseUrl: string
  remoteTaskId?: string
  requestId?: string
  params: WanTaskParams
  originalPrompt?: string
  usage?: WanUsage
  remoteVideoUrl?: string
  remoteVideoExpiresAt?: number
  localFilePath?: string
  localFileUri?: string
  errorCode?: string
  error?: string
}

const taskStore = localforage.createInstance({ name: 'clingy-video', storeName: 'wanVideoTasks' })
const tasks = ref<WanVideoTask[]>([])

const loadWanTasks = async () => {
  const loaded: WanVideoTask[] = []
  for (const key of await taskStore.keys()) {
    const task = await taskStore.getItem<WanVideoTask>(key)
    if (task) loaded.push(task)
  }
  tasks.value = loaded.sort((a, b) => b.createdAt - a.createdAt)
  return tasks.value
}

const saveWanTask = async (task: WanVideoTask) => {
  const saved = { ...task, updatedAt: Date.now() }
  await taskStore.setItem(saved.id, saved)
  await loadWanTasks()
  return saved
}

const patchWanTask = async (id: string, patch: Partial<WanVideoTask>) => {
  const task = await taskStore.getItem<WanVideoTask>(id)
  if (!task) throw new Error('本地找不到这个 Wan 视频任务')
  return saveWanTask({ ...task, ...patch, id, updatedAt: Date.now() })
}

const getWanTask = (id: string) => taskStore.getItem<WanVideoTask>(id)

const removeWanTask = async (id: string) => {
  await taskStore.removeItem(id)
  await loadWanTasks()
}

void loadWanTasks()

export function useWanVideoHistory() {
  return { tasks, loadWanTasks, saveWanTask, patchWanTask, getWanTask, removeWanTask }
}
