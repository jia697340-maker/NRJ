/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'
import type {
  KlingAspectRatio,
  KlingAudio,
  KlingBilling,
  KlingDuration,
  KlingMode,
  KlingModel,
  KlingMultiShot,
  KlingOutput,
  KlingResolution,
  KlingShot
} from '../services/klingVideo'

export type KlingTaskStatus = 'submitting' | 'submitted' | 'processing' | 'paused' | 'downloading' | 'completed' | 'failed'

export interface KlingTaskParams {
  prompt: string
  model: KlingModel
  mode: KlingMode
  aspectRatio: KlingAspectRatio
  resolution: KlingResolution
  duration: KlingDuration
  audio: KlingAudio
  multiShot: KlingMultiShot
  shots: KlingShot[]
  watermark: boolean
  inputNames: string[]
  referenceVideoUrl?: string
  elementAliases: string[]
}

export interface KlingVideoTask {
  id: string
  externalTaskId: string
  remoteTaskId?: string
  createdAt: number
  updatedAt: number
  status: KlingTaskStatus
  params: KlingTaskParams
  outputs?: KlingOutput[]
  billing?: KlingBilling[]
  localFilePath?: string
  localFileUri?: string
  error?: string
}

const taskStore = localforage.createInstance({ name: 'nrt-app', storeName: 'klingVideoTasks' })
const tasks = ref<KlingVideoTask[]>([])

const loadKlingTasks = async () => {
  const loaded: KlingVideoTask[] = []
  for (const key of await taskStore.keys()) {
    const task = await taskStore.getItem<KlingVideoTask>(key)
    if (task) loaded.push(task)
  }
  tasks.value = loaded.sort((a, b) => b.createdAt - a.createdAt)
  return tasks.value
}

const saveKlingTask = async (task: KlingVideoTask) => {
  const next = { ...task, updatedAt: Date.now() }
  await taskStore.setItem(next.id, next)
  await loadKlingTasks()
  return next
}

const patchKlingTask = async (id: string, patch: Partial<KlingVideoTask>) => {
  const task = await taskStore.getItem<KlingVideoTask>(id)
  if (!task) throw new Error('本地找不到这个 Kling 视频任务')
  return saveKlingTask({ ...task, ...patch, id, updatedAt: Date.now() })
}

const getKlingTask = (id: string) => taskStore.getItem<KlingVideoTask>(id)

const removeKlingTask = async (id: string) => {
  await taskStore.removeItem(id)
  await loadKlingTasks()
}

void loadKlingTasks()

export function useKlingVideoHistory() {
  return { tasks, loadKlingTasks, saveKlingTask, patchKlingTask, getKlingTask, removeKlingTask }
}
