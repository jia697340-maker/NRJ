/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'

export type NijiGatewayProtocol = 'proxy' | 'hosted'
export type NijiSpeedMode = 'fast' | 'relax' | 'turbo'

export interface NijiImageConfig {
  apiKey: string
  baseUrl: string
  protocol: NijiGatewayProtocol
  pollInterval?: number
  timeout?: number
}

export interface NijiImageGenerateParams {
  prompt: string
  aspectRatio?: string
  speedMode?: NijiSpeedMode
  stylize?: number
  chaos?: number
  weird?: number
  seed?: number | null
  raw?: boolean
  styleReference?: string
  styleWeight?: number
  imagePromptUrl?: string
  imageWeight?: number
}

const trimBaseUrl = (url: string) => url.trim().replace(/\/+$/, '')

const wait = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(resolve, milliseconds)
  signal.addEventListener('abort', () => {
    window.clearTimeout(timer)
    reject(new DOMException('Aborted', 'AbortError'))
  }, { once: true })
})

const readJson = async (response: Response, label: string) => {
  let payload: any
  try {
    payload = await response.json()
  } catch {
    throw new Error(`${label}没有返回 JSON (${response.status})`)
  }
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.error || payload?.message || `${label}失败 (${response.status})`)
  }
  return payload
}

const normalizeImageUrl = (value: any): string => {
  if (typeof value === 'string') {
    const candidate = value.trim()
    return /^(?:https?:|data:image\/|blob:)/i.test(candidate) ? candidate : ''
  }
  if (value && typeof value === 'object') {
    return String(value.image_url || value.imageUrl || value.url || value.uri || '')
  }
  return ''
}

const extractImageUrl = (payload: any): string => {
  const source = payload?.data ?? payload
  const candidates = [
    source?.imageUrl,
    source?.image_url,
    source?.uri,
    source?.url,
    source?.result,
    source?.output?.imageUrl,
    source?.output?.image_url,
    source?.output?.url,
    source?.images?.[0],
    source?.imageUrls?.[0],
    source?.image_urls?.[0],
    payload?.images?.[0]
  ]
  return candidates.map(normalizeImageUrl).find(Boolean) || ''
}

const extractTaskId = (payload: any) => String(
  payload?.data?.taskId || payload?.data?.id || payload?.taskId || payload?.task_id || payload?.id || payload?.result || ''
).trim()

const taskFailed = (payload: any) => {
  const source = payload?.data ?? payload
  const status = String(source?.status ?? '').toUpperCase()
  return source?.status === 2 || ['FAILURE', 'FAILED', 'ERROR', 'CANCELLED'].includes(status)
}

const taskCompleted = (payload: any) => {
  const source = payload?.data ?? payload
  const status = String(source?.status ?? '').toUpperCase()
  const progress = String(source?.progress ?? '')
  return source?.status === 1 || ['SUCCESS', 'COMPLETED', 'DONE', 'FINISHED'].includes(status) || progress === '100%'
}

const taskError = (payload: any) => {
  const source = payload?.data ?? payload
  return source?.failReason || source?.fail_reason || source?.error?.message || source?.error || source?.description || source?.message || 'Niji 中转任务失败'
}

const appendParameter = (parts: string[], name: string, value: string | number | undefined | null) => {
  if (value === undefined || value === null || value === '') return
  parts.push(`--${name} ${value}`)
}

export const buildNijiPrompt = (params: NijiImageGenerateParams) => {
  const basePrompt = params.prompt
    .trim()
    .replace(/\s+--niji(?:\s+\d+)?\b/gi, '')
    .replace(/\s+--ar\s+\S+/gi, '')
  if (!basePrompt) throw new Error('请填写 Niji 画面描述')

  const parts = [params.imagePromptUrl?.trim(), basePrompt].filter(Boolean) as string[]
  appendParameter(parts, 'niji', 7)
  appendParameter(parts, 'ar', params.aspectRatio || '2:3')
  appendParameter(parts, 's', Math.min(1000, Math.max(0, Number(params.stylize) || 0)))
  if (Number(params.chaos) > 0) appendParameter(parts, 'c', Math.min(100, Math.max(0, Number(params.chaos))))
  if (Number(params.weird) > 0) appendParameter(parts, 'w', Math.min(3000, Math.max(0, Number(params.weird))))
  if (params.seed !== null && params.seed !== undefined && Number.isFinite(Number(params.seed))) appendParameter(parts, 'seed', Number(params.seed))
  if (params.raw) parts.push('--raw')
  if (params.styleReference?.trim()) {
    appendParameter(parts, 'sref', params.styleReference.trim())
    appendParameter(parts, 'sw', Math.min(1000, Math.max(0, Number(params.styleWeight) || 100)))
  }
  if (params.imagePromptUrl?.trim()) appendParameter(parts, 'iw', Math.min(2, Math.max(0, Number(params.imageWeight) || 1)))
  return parts.join(' ')
}

const downloadAsDataUrl = async (url: string, signal: AbortSignal) => {
  if (url.startsWith('data:image/')) return url
  try {
    const response = await fetch(url, { signal })
    if (!response.ok) return url
    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) return url
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch (error: any) {
    if (error?.name === 'AbortError') throw error
    return url
  }
}

export function useNijiImage() {
  const isGenerating = ref(false)
  const finalImage = ref<string | null>(null)
  const errorMsg = ref<string | null>(null)
  const progressText = ref('')
  const lastGeneratedParams = ref<NijiImageGenerateParams | null>(null)
  let abortController: AbortController | null = null

  const abortGeneration = () => abortController?.abort()

  const generateImage = async (config: NijiImageConfig, params: NijiImageGenerateParams): Promise<string> => {
    if (isGenerating.value) throw new Error('已有 Niji 图片正在生成')
    if (!config.apiKey?.trim()) throw new Error('请先填写第三方中转 API Key')
    if (!config.baseUrl?.trim()) throw new Error('请先填写第三方中转地址')

    abortController = new AbortController()
    const { signal } = abortController
    isGenerating.value = true
    finalImage.value = null
    errorMsg.value = null
    progressText.value = '正在提交 Niji 7 任务…'
    lastGeneratedParams.value = JSON.parse(JSON.stringify(params))

    try {
      const baseUrl = trimBaseUrl(config.baseUrl)
      const prompt = buildNijiPrompt(params)
      const protocol = config.protocol || 'proxy'
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      let submitUrl = ''
      let submitBody: Record<string, unknown>

      if (protocol === 'hosted') {
        headers['API-KEY'] = config.apiKey.trim()
        submitUrl = /\/midjourney\/v1\/submit-jobs$/i.test(baseUrl) ? baseUrl : `${baseUrl}/midjourney/v1/submit-jobs`
        submitBody = { prompt, mode: params.speedMode || 'fast' }
      } else {
        headers.Authorization = `Bearer ${config.apiKey.trim()}`
        submitUrl = /\/mj\/submit\/imagine$/i.test(baseUrl) ? baseUrl : `${baseUrl}/mj/submit/imagine`
        submitBody = { prompt, botType: 'NIJI_JOURNEY' }
      }

      const submitPayload = await readJson(await fetch(submitUrl, {
        method: 'POST', headers, body: JSON.stringify(submitBody), signal
      }), 'Niji 任务提交')
      const immediateImage = extractImageUrl(submitPayload)
      if (immediateImage) {
        finalImage.value = await downloadAsDataUrl(immediateImage, signal)
        return finalImage.value
      }

      const taskId = extractTaskId(submitPayload)
      if (!taskId) throw new Error('中转返回成功，但没有提供任务 ID')

      const startedAt = Date.now()
      const timeout = Math.min(30 * 60_000, Math.max(60_000, Number(config.timeout) || 10 * 60_000))
      const interval = Math.min(15_000, Math.max(1_500, Number(config.pollInterval) || 3_000))
      while (Date.now() - startedAt < timeout) {
        await wait(interval, signal)
        let taskPayload: any
        if (protocol === 'hosted') {
          const statusUrl = /\/midjourney\/v1\/submit-jobs$/i.test(baseUrl)
            ? baseUrl.replace(/\/submit-jobs$/i, '/job-status')
            : `${baseUrl}/midjourney/v1/job-status`
          const response = await fetch(statusUrl, {
            method: 'POST', headers, body: JSON.stringify({ taskIds: [taskId] }), signal
          })
          const payload = await readJson(response, 'Niji 状态查询')
          taskPayload = Array.isArray(payload?.data) ? payload.data.find((item: any) => String(item?.taskId) === taskId) || payload.data[0] : payload
        } else {
          const root = baseUrl.replace(/\/mj\/submit\/imagine$/i, '')
          taskPayload = await readJson(await fetch(`${root}/mj/task/${encodeURIComponent(taskId)}/fetch`, { headers, signal }), 'Niji 状态查询')
        }

        if (taskFailed(taskPayload)) throw new Error(String(taskError(taskPayload)))
        const imageUrl = extractImageUrl(taskPayload)
        if (imageUrl && taskCompleted(taskPayload)) {
          progressText.value = '正在保存生成结果…'
          finalImage.value = await downloadAsDataUrl(imageUrl, signal)
          return finalImage.value
        }
        const source = taskPayload?.data ?? taskPayload
        progressText.value = source?.progress ? `Niji 7 绘制中 ${source.progress}` : 'Niji 7 绘制中…'
      }
      throw new Error('Niji 任务等待超时，请稍后查询中转服务状态')
    } catch (error: any) {
      const message = error?.name === 'AbortError' ? '已取消 Niji 图片生成' : (error?.message || 'Niji 图片生成失败')
      errorMsg.value = message
      throw new Error(message)
    } finally {
      isGenerating.value = false
      progressText.value = ''
      abortController = null
    }
  }

  return { isGenerating, finalImage, errorMsg, progressText, lastGeneratedParams, generateImage, abortGeneration }
}
