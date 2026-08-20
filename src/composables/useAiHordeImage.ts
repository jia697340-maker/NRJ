/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'

export interface AiHordeConfig { apiKey?: string; baseUrl?: string; clientAgent?: string }
export interface AiHordeModel { name: string; count: number; queued: number; jobs: number; eta: number }
export interface AiHordeParams {
  prompt: string; negativePrompt?: string; model?: string; width?: number; height?: number; steps?: number
  cfgScale?: number; sampler?: string; seed?: string | number; nsfw?: boolean; censorNsfw?: boolean
  trustedWorkers?: boolean; validatedBackends?: boolean; extraSlowWorkers?: boolean; pollInterval?: number; timeout?: number
  onQueued?: (request: { id: string; kudos?: number }) => void
}

const DEFAULT_BASE = 'https://aihorde.net/api/v2'
const PENDING_KEY = 'app_ai_horde_pending_request'
const dataFromImage = async (value: string) => {
  if (value.startsWith('data:')) return value
  if (!/^https?:/i.test(value)) return `data:image/webp;base64,${value}`
  const response = await fetch(value)
  if (!response.ok) throw new Error('AI Horde 结果图片下载失败')
  const blob = await response.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob)
  })
}
const errorMessage = async (response: Response) => {
  try { const value = await response.json(); return value?.message || value?.error || value?.rc || `AI Horde 请求失败 (${response.status})` } catch { return `AI Horde 请求失败 (${response.status})` }
}

export function useAiHordeImage() {
  const isGenerating = ref(false)
  const finalImage = ref<string | null>(null)
  const errorMsg = ref<string | null>(null)
  const progressText = ref('')
  const activeRequestId = ref('')
  const lastGeneratedParams = ref<AiHordeParams | null>(null)
  let controller: AbortController | null = null
  let activeBase = DEFAULT_BASE
  let activeKey = '0000000000'

  const requestHeaders = (config: AiHordeConfig) => ({
    'Content-Type': 'application/json',
    apikey: config.apiKey?.trim() || '0000000000',
    'Client-Agent': config.clientAgent?.trim() || 'nianrenjin:1.0:unknown'
  })
  const fetchModels = async (): Promise<AiHordeModel[]> => {
    const response = await fetch(`${DEFAULT_BASE}/status/models?type=image`)
    if (!response.ok) throw new Error(`无法获取 AI Horde 在线模型 (${response.status})`)
    return (await response.json()).sort((a: AiHordeModel, b: AiHordeModel) => (b.count || 0) - (a.count || 0))
  }
  const cancelRequest = async () => {
    controller?.abort()
    if (activeRequestId.value) {
      try { await fetch(`${activeBase}/generate/status/${activeRequestId.value}`, { method: 'DELETE', headers: { apikey: activeKey } }) } catch { /* 取消以本地状态为准。 */ }
    }
    localStorage.removeItem(PENDING_KEY)
  }
  const waitForResult = async (config: AiHordeConfig, id: string, params: AiHordeParams) => {
    const base = (config.baseUrl || DEFAULT_BASE).replace(/\/+$/, '')
    const startedAt = Date.now()
    const timeout = Math.min(15 * 60_000, Math.max(30_000, Number(params.timeout) || 10 * 60_000))
    const interval = Math.min(10_000, Math.max(1500, Number(params.pollInterval) || 2500))
    while (Date.now() - startedAt < timeout) {
      await new Promise(resolve => setTimeout(resolve, interval))
      if (controller?.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const check = await fetch(`${base}/generate/check/${id}`, { headers: requestHeaders(config), signal: controller?.signal })
      if (!check.ok) throw new Error(await errorMessage(check))
      const state = await check.json()
      if (state.faulted) throw new Error('AI Horde 任务已故障，请更换在线模型后重试')
      progressText.value = state.done
        ? '正在获取生成结果…'
        : `排队 ${state.queue_position ?? '—'} · 预计等待 ${Math.max(0, Number(state.wait_time) || 0)} 秒 · 已完成 ${state.finished || 0}`
      if (!state.done) continue
      const resultResponse = await fetch(`${base}/generate/status/${id}`, { headers: requestHeaders(config), signal: controller?.signal })
      if (!resultResponse.ok) throw new Error(await errorMessage(resultResponse))
      const result = await resultResponse.json()
      const image = result?.generations?.[0]?.img
      if (!image) throw new Error('AI Horde 任务完成但没有返回图片')
      return dataFromImage(image)
    }
    throw new Error('AI Horde 排队超过设定时间，任务可能仍在服务端运行')
  }
  const generateImage = async (config: AiHordeConfig, params: AiHordeParams) => {
    if (isGenerating.value) throw new Error('已有 AI Horde 图片正在生成')
    if (!params.prompt?.trim()) throw new Error('请填写画面描述')
    const width = Math.round(Math.min(1536, Math.max(256, Number(params.width) || 768)) / 64) * 64
    const height = Math.round(Math.min(1536, Math.max(256, Number(params.height) || 1024)) / 64) * 64
    controller = new AbortController()
    isGenerating.value = true
    finalImage.value = null
    errorMsg.value = null
    progressText.value = '正在提交社区算力队列…'
    lastGeneratedParams.value = { ...params, onQueued: undefined }
    activeBase = (config.baseUrl || DEFAULT_BASE).replace(/\/+$/, '')
    activeKey = config.apiKey?.trim() || '0000000000'
    try {
      const prompt = params.negativePrompt?.trim() ? `${params.prompt.trim()}###${params.negativePrompt.trim()}` : params.prompt.trim()
      const payload: any = {
        prompt,
        params: { sampler_name: params.sampler || 'k_euler_a', cfg_scale: Number(params.cfgScale) || 7, width, height, steps: Math.min(50, Math.max(1, Number(params.steps) || 24)), n: 1 },
        nsfw: params.nsfw === true,
        censor_nsfw: params.censorNsfw !== false,
        trusted_workers: params.trustedWorkers !== false,
        validated_backends: params.validatedBackends !== false,
        extra_slow_workers: params.extraSlowWorkers === true,
        replacement_filter: true,
        r2: true,
        shared: false
      }
      if (params.seed !== '' && params.seed !== undefined) payload.params.seed = String(params.seed)
      if (params.model) payload.models = [params.model]
      const response = await fetch(`${activeBase}/generate/async`, { method: 'POST', headers: requestHeaders(config), body: JSON.stringify(payload), signal: controller.signal })
      if (!response.ok) throw new Error(await errorMessage(response))
      const queued = await response.json()
      if (!queued?.id) throw new Error('AI Horde 没有返回任务编号')
      activeRequestId.value = queued.id
      localStorage.setItem(PENDING_KEY, JSON.stringify({ id: queued.id, baseUrl: activeBase, createdAt: Date.now(), params: lastGeneratedParams.value }))
      params.onQueued?.({ id: queued.id, kudos: queued.kudos })
      const image = await waitForResult(config, queued.id, params)
      finalImage.value = image
      return image
    } catch (error: any) {
      const message = error?.name === 'AbortError' ? '已取消 AI Horde 图片生成' : (error?.message || 'AI Horde 图片生成失败')
      errorMsg.value = message
      throw new Error(message)
    } finally {
      localStorage.removeItem(PENDING_KEY)
      isGenerating.value = false
      activeRequestId.value = ''
      controller = null
    }
  }

  return { isGenerating, finalImage, errorMsg, progressText, activeRequestId, lastGeneratedParams, fetchModels, generateImage, abortGeneration: cancelRequest }
}

