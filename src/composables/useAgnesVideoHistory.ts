/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'
import type { AgnesSizeMapping, AgnesVideoInput } from '../services/agnesVideo'
import type { VideoConnectionMode } from '../services/videoHttp'

export type AgnesTaskStatus = 'submitting' | 'queued' | 'running' | 'paused' | 'completed' | 'failed'

export interface AgnesLocalTask {
  id: string
  taskId?: string
  videoId?: string
  status: AgnesTaskStatus
  progress: number
  createdAt: number
  updatedAt: number
  baseUrl: string
  connectionMode: VideoConnectionMode
  project: string
  input: AgnesVideoInput
  actualSeconds?: number
  actualSize?: string
  sizeMapping?: AgnesSizeMapping
  videoUrl?: string
  localFilePath?: string
  localFileUri?: string
  localWebUrl?: string
  error?: string
}

const taskStore = localforage.createInstance({ name: 'nrt-app', storeName: 'agnesVideoTasks' })
const tasks = ref<AgnesLocalTask[]>([])

const load = async () => {
  const rows: AgnesLocalTask[] = []
  for (const key of await taskStore.keys()) {
    const row = await taskStore.getItem<AgnesLocalTask>(key)
    if (row) rows.push(row)
  }
  tasks.value = rows.sort((a, b) => b.createdAt - a.createdAt)
  return tasks.value
}

const save = async (task: AgnesLocalTask) => {
  const next = { ...task, updatedAt: Date.now() }
  await taskStore.setItem(next.id, next)
  await load()
  return next
}

const patch = async (id: string, value: Partial<AgnesLocalTask>) => {
  const row = await taskStore.getItem<AgnesLocalTask>(id)
  if (!row) throw new Error('本地找不到这个 Agnes 视频任务')
  return save({ ...row, ...value, id })
}

const get = (id: string) => taskStore.getItem<AgnesLocalTask>(id)
const remove = async (id: string) => { await taskStore.removeItem(id); await load() }
void load()

export const useAgnesVideoHistory = () => ({ tasks, load, save, patch, get, remove })
