/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'

export type FluxImageModel = 'flux-2-pro-preview' | 'flux-2-pro' | 'flux-2-max'
export type FluxImageFormat = 'jpeg' | 'png' | 'webp'

export interface FluxImageConfig {
  apiKey: string
  proxyUrl: string
}

export interface FluxImageGenerateParams {
  model: FluxImageModel | string
  prompt: string
  width: number
  height: number
  seed?: number | null
  safetyTolerance?: number
  outputFormat?: FluxImageFormat
  disablePromptUpsampling?: boolean
  referenceImages?: string[]
}

const DEFAULT_PROXY_URL = 'https://clingy-flux-proxy.q89028615.workers.dev'

const normalizeProxyEndpoint = (proxyUrl: string) => {
  const trimmed = (proxyUrl || DEFAULT_PROXY_URL).trim().replace(/\/+$/, '')
  return /\/v1\/generate$/i.test(trimmed) ? trimmed : `${trimmed}/v1/generate`
}

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error || new Error('读取 FLUX 图片失败'))
  reader.readAsDataURL(blob)
})

const getErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json()
    return payload?.error?.message || payload?.error || payload?.message || `FLUX 请求失败 (${response.status})`
  } catch {
    return `FLUX 请求失败 (${response.status})`
  }
}

const validateParams = (params: FluxImageGenerateParams) => {
  const width = Number(params.width)
  const height = Number(params.height)
  if (!params.prompt?.trim()) throw new Error('请填写画面描述')
  if (width < 64 || height < 64 || width % 16 !== 0 || height % 16 !== 0) {
    throw new Error('FLUX 宽高必须不小于 64，且为 16 的倍数')
  }
  if (width * height > 4_000_000) throw new Error('FLUX 输出不能超过 4MP')
  if ((params.referenceImages || []).filter(Boolean).length > 8) {
    throw new Error('FLUX 每次最多使用 8 张参考图')
  }
}

export function useFluxImage() {
  const isGenerating = ref(false)
  const finalImages = ref<string[]>([])
  const finalImage = ref<string | null>(null)
  const errorMsg = ref<string | null>(null)
  const lastGeneratedParams = ref<FluxImageGenerateParams | null>(null)
  let abortController: AbortController | null = null

  const abortGeneration = () => {
    abortController?.abort()
    abortController = null
  }

  const generateImage = async (
    config: FluxImageConfig,
    params: FluxImageGenerateParams
  ): Promise<string> => {
    if (isGenerating.value) throw new Error('已有 FLUX 图片正在生成')
    if (!config.apiKey?.trim()) throw new Error('请先填写 Black Forest Labs API Key')
    if (!config.proxyUrl?.trim()) throw new Error('请先填写 FLUX 代理地址')
    validateParams(params)

    abortController = new AbortController()
    isGenerating.value = true
    finalImages.value = []
    finalImage.value = null
    errorMsg.value = null
    lastGeneratedParams.value = JSON.parse(JSON.stringify(params))

    try {
      const references = (params.referenceImages || []).filter(Boolean)
      const body: Record<string, unknown> = {
        model: params.model || 'flux-2-pro-preview',
        prompt: params.prompt.trim(),
        width: Number(params.width) || 1024,
        height: Number(params.height) || 1536,
        safety_tolerance: Math.min(5, Math.max(0, Number(params.safetyTolerance) || 2)),
        output_format: params.outputFormat || 'png',
        disable_pup: Boolean(params.disablePromptUpsampling)
      }
      if (params.seed !== null && params.seed !== undefined && Number.isFinite(Number(params.seed))) {
        body.seed = Number(params.seed)
      }
      references.forEach((image, index) => {
        body[index === 0 ? 'input_image' : `input_image_${index + 1}`] = image
      })

      const response = await fetch(normalizeProxyEndpoint(config.proxyUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bfl-key': config.apiKey.trim()
        },
        body: JSON.stringify(body),
        signal: abortController.signal
      })
      if (!response.ok) throw new Error(await getErrorMessage(response))

      const contentType = response.headers.get('content-type') || 'image/png'
      if (!contentType.startsWith('image/')) throw new Error('FLUX 代理没有返回图片')
      const image = await blobToDataUrl(await response.blob())
      finalImages.value = [image]
      finalImage.value = image
      return image
    } catch (error: any) {
      const message = error?.name === 'AbortError'
        ? '已取消 FLUX 图片生成'
        : (error?.message || 'FLUX 图片生成失败')
      errorMsg.value = message
      throw new Error(message)
    } finally {
      isGenerating.value = false
      abortController = null
    }
  }

  const generateImages = async (config: FluxImageConfig, params: FluxImageGenerateParams) => [
    await generateImage(config, params)
  ]

  return {
    isGenerating,
    finalImages,
    finalImage,
    errorMsg,
    lastGeneratedParams,
    generateImage,
    generateImages,
    abortGeneration
  }
}
