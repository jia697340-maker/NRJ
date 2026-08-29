/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'
import type { GeminiOmniAspectRatio, GeminiOmniDuration, GeminiOmniMode, GeminiOmniResolution, GeminiOmniVideoOutput } from '../services/geminiOmniVideo'

export type GeminiOmniTaskStatus = 'uploading' | 'generating' | 'paused' | 'downloading' | 'completed' | 'failed'

export interface GeminiOmniTaskParams {
  prompt: string
  mode: GeminiOmniMode
  aspectRatio: GeminiOmniAspectRatio
  resolution: GeminiOmniResolution
  durationSeconds: GeminiOmniDuration
  inputNames: string[]
}

export interface GeminiOmniTask {
  id: string
  parentId?: string
  rootId: string
  interactionId?: string
  createdAt: number
  updatedAt: number
  status: GeminiOmniTaskStatus
  baseUrl: string
  params: GeminiOmniTaskParams
  remoteVideo?: GeminiOmniVideoOutput
  videoBlob?: Blob
  error?: string
}

export type GeminiOmniTaskMeta = Omit<GeminiOmniTask, 'videoBlob'> & { hasVideo: boolean }

const taskStore = localforage.createInstance({ name: 'nrt-app', storeName: 'geminiOmniTasks' })
const tasks = ref<GeminiOmniTaskMeta[]>([])

const toMeta = (task: GeminiOmniTask): GeminiOmniTaskMeta => {
  const { videoBlob, ...rest } = task
  return { ...rest, hasVideo: Boolean(videoBlob?.size) }
}

const loadGeminiOmniTasks = async () => {
  const loaded: GeminiOmniTaskMeta[] = []
  for (const key of await taskStore.keys()) {
    const task = await taskStore.getItem<GeminiOmniTask>(key)
    if (task) loaded.push(toMeta(task))
  }
  tasks.value = loaded.sort((a, b) => b.createdAt - a.createdAt)
  return tasks.value
}

const saveGeminiOmniTask = async (task: GeminiOmniTask) => {
  const saved = { ...task, updatedAt: Date.now() }
  await taskStore.setItem(saved.id, saved)
  await loadGeminiOmniTasks()
  return saved
}

const patchGeminiOmniTask = async (id: string, patch: Partial<GeminiOmniTask>) => {
  const task = await taskStore.getItem<GeminiOmniTask>(id)
  if (!task) throw new Error('本地找不到这个 Omni 任务')
  return saveGeminiOmniTask({ ...task, ...patch, id })
}

const getGeminiOmniTask = (id: string) => taskStore.getItem<GeminiOmniTask>(id)

const removeGeminiOmniTask = async (id: string) => {
  const removed = await getGeminiOmniTask(id)
  if (!removed) return
  for (const child of tasks.value.filter(item => item.parentId === id)) {
    await patchGeminiOmniTask(child.id, { parentId: removed.parentId })
  }
  await taskStore.removeItem(id)
  await loadGeminiOmniTasks()
}

const getGeminiOmniVideoUrl = async (id: string) => {
  const task = await getGeminiOmniTask(id)
  return task?.videoBlob?.size ? URL.createObjectURL(task.videoBlob) : null
}

void loadGeminiOmniTasks()

export function useGeminiOmniHistory() {
  return { tasks, loadGeminiOmniTasks, saveGeminiOmniTask, patchGeminiOmniTask, getGeminiOmniTask, removeGeminiOmniTask, getGeminiOmniVideoUrl }
}
