/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive } from 'vue'

export type ForumGenerationRuntimeStatus = 'idle' | 'running' | 'completed' | 'failed'

export const forumGenerationRuntime = reactive({
  status: 'idle' as ForumGenerationRuntimeStatus,
  progress: 0,
  error: '',
  startedAt: undefined as number | undefined,
  completedAt: undefined as number | undefined,
  summary: undefined as undefined | { postIds: string[]; postCount: number; kindCounts: Record<string, number>; circleIds: string[]; circleNames: string[] }
})

let activeTask: Promise<boolean> | null = null

export const runSingleForumGenerationTask = (runner: (onProgress: (value: number) => void) => Promise<void>) => {
  if (activeTask) return activeTask
  forumGenerationRuntime.status = 'running'
  forumGenerationRuntime.progress = 0
  forumGenerationRuntime.error = ''
  forumGenerationRuntime.startedAt = Date.now()
  forumGenerationRuntime.completedAt = undefined
  forumGenerationRuntime.summary = undefined
  let task!: Promise<boolean>
  task = (async () => {
    try {
      await runner(value => { forumGenerationRuntime.progress = Math.max(0, Math.min(100, Math.round(value))) })
      forumGenerationRuntime.status = 'completed'
      forumGenerationRuntime.progress = 100
      forumGenerationRuntime.completedAt = Date.now()
      return true
    } catch (cause) {
      forumGenerationRuntime.status = 'failed'
      forumGenerationRuntime.progress = 0
      forumGenerationRuntime.error = cause instanceof Error ? cause.message : String(cause)
      forumGenerationRuntime.completedAt = Date.now()
      forumGenerationRuntime.summary = undefined
      return false
    } finally {
      if (activeTask === task) activeTask = null
    }
  })()
  activeTask = task
  return task
}

export const hasActiveForumGenerationTask = () => activeTask !== null
