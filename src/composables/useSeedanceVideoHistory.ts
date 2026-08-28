/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'
import type { SeedanceMedia, SeedanceMode, SeedanceModel, SeedanceRatio, SeedanceResolution, SeedanceUsage } from '../services/seedanceVideo'

export type SeedanceTaskStatus = 'submitting' | 'queued' | 'running' | 'paused' | 'downloading' | 'completed' | 'failed' | 'cancelled' | 'expired'

export interface SeedanceTaskParams {
  prompt: string
  model: SeedanceModel
  mode: SeedanceMode
  resolution: SeedanceResolution
  ratio: SeedanceRatio
  duration: number
  generateAudio: boolean
  watermark: boolean
  returnLastFrame: boolean
  seed?: number
  media: Array<Pick<SeedanceMedia, 'role' | 'label'>>
}

export interface SeedanceVideoTask {
  id: string
  createdAt: number
  updatedAt: number
  status: SeedanceTaskStatus
  baseUrl: string
  remoteTaskId?: string
  params: SeedanceTaskParams
  actualSeed?: number
  actualResolution?: SeedanceResolution
  actualRatio?: SeedanceRatio
  actualDuration?: number
  framesPerSecond?: number
  usage?: SeedanceUsage
  remoteVideoUrl?: string
  remoteVideoExpiresAt?: number
  lastFrameUrl?: string
  localFilePath?: string
  localFileUri?: string
  errorCode?: string
  error?: string
}

const taskStore = localforage.createInstance({ name: 'nrt-app', storeName: 'seedanceVideoTasks' })
const tasks = ref<SeedanceVideoTask[]>([])

const loadSeedanceTasks = async () => {
  const loaded: SeedanceVideoTask[] = []
  for (const key of await taskStore.keys()) {
    const task = await taskStore.getItem<SeedanceVideoTask>(key)
    if (task) loaded.push(task)
  }
  tasks.value = loaded.sort((a, b) => b.createdAt - a.createdAt)
  return tasks.value
}

const saveSeedanceTask = async (task: SeedanceVideoTask) => {
  const saved = { ...task, updatedAt: Date.now() }
  await taskStore.setItem(saved.id, saved)
  await loadSeedanceTasks()
  return saved
}

const patchSeedanceTask = async (id: string, patch: Partial<SeedanceVideoTask>) => {
  const task = await taskStore.getItem<SeedanceVideoTask>(id)
  if (!task) throw new Error('本地找不到这个 Seedance 视频任务')
  return saveSeedanceTask({ ...task, ...patch, id, updatedAt: Date.now() })
}

const getSeedanceTask = (id: string) => taskStore.getItem<SeedanceVideoTask>(id)

const removeSeedanceTask = async (id: string) => {
  await taskStore.removeItem(id)
  await loadSeedanceTasks()
}

void loadSeedanceTasks()

export function useSeedanceVideoHistory() {
  return { tasks, loadSeedanceTasks, saveSeedanceTask, patchSeedanceTask, getSeedanceTask, removeSeedanceTask }
}
