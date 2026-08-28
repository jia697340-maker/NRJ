/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'
import type { VeoAspectRatio, VeoDuration, VeoMode, VeoModel, VeoOperationVideo, VeoResolution } from '../services/veoVideo'

export type VeoTaskStatus = 'submitting' | 'generating' | 'paused' | 'downloading' | 'completed' | 'failed'

export interface VeoTaskParams {
  prompt: string
  model: VeoModel
  mode: VeoMode
  aspectRatio: VeoAspectRatio
  resolution: VeoResolution
  durationSeconds: VeoDuration
  seed?: number
  inputNames: string[]
}

export interface VeoVideoTask {
  id: string
  createdAt: number
  updatedAt: number
  status: VeoTaskStatus
  operationName?: string
  baseUrl: string
  params: VeoTaskParams
  remoteVideo?: VeoOperationVideo
  videoBlob?: Blob
  error?: string
}

export type VeoVideoTaskMeta = Omit<VeoVideoTask, 'videoBlob'> & { hasVideo: boolean }

const taskStore = localforage.createInstance({ name: 'nrt-app', storeName: 'veoVideoTasks' })
const tasks = ref<VeoVideoTaskMeta[]>([])

const toMeta = (task: VeoVideoTask): VeoVideoTaskMeta => {
  const { videoBlob, ...rest } = task
  return { ...rest, hasVideo: Boolean(videoBlob?.size) }
}

const loadVeoTasks = async () => {
  const loaded: VeoVideoTaskMeta[] = []
  for (const key of await taskStore.keys()) {
    const task = await taskStore.getItem<VeoVideoTask>(key)
    if (task) loaded.push(toMeta(task))
  }
  tasks.value = loaded.sort((a, b) => b.createdAt - a.createdAt)
  return tasks.value
}

const saveVeoTask = async (task: VeoVideoTask) => {
  task.updatedAt = Date.now()
  await taskStore.setItem(task.id, task)
  await loadVeoTasks()
  return task
}

const patchVeoTask = async (id: string, patch: Partial<VeoVideoTask>) => {
  const task = await taskStore.getItem<VeoVideoTask>(id)
  if (!task) throw new Error('本地找不到这个视频任务')
  return saveVeoTask({ ...task, ...patch, id, updatedAt: Date.now() })
}

const getVeoTask = (id: string) => taskStore.getItem<VeoVideoTask>(id)

const removeVeoTask = async (id: string) => {
  await taskStore.removeItem(id)
  await loadVeoTasks()
}

const getVeoVideoUrl = async (id: string) => {
  const task = await getVeoTask(id)
  return task?.videoBlob?.size ? URL.createObjectURL(task.videoBlob) : null
}

void loadVeoTasks()

export function useVeoVideoHistory() {
  return { tasks, loadVeoTasks, saveVeoTask, patchVeoTask, getVeoTask, removeVeoTask, getVeoVideoUrl }
}
