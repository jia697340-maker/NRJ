/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'

export type SeedreamImageFormat = 'png' | 'jpeg'
export type SeedreamImageSize = '1K' | '2K' | '4K'

export interface SeedreamImageConfig {
  apiKey: string
  baseUrl: string
}

export interface SeedreamImageGenerateParams {
  model: string
  prompt: string
  size?: SeedreamImageSize | string
  outputFormat?: SeedreamImageFormat
  watermark?: boolean
  seed?: number | null
  referenceImages?: string[]
  sequentialImageGeneration?: 'disabled' | 'auto'
  maxImages?: number
}

const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

const normalizeEndpoint = (baseUrl: string) => {
  const trimmed = (baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
  return /\/images\/generations$/i.test(trimmed) ? trimmed : `${trimmed}/images/generations`
}

const getErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json()
    return payload?.error?.message || payload?.error?.code || payload?.message || `Seedream 请求失败 (${response.status})`
  } catch {
    return `Seedream 请求失败 (${response.status})`
  }
}

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error || new Error('读取 Seedream 图片失败'))
  reader.readAsDataURL(blob)
})

const resolveImage = async (item: any, format: SeedreamImageFormat) => {
  const base64 = item?.b64_json || item?.base64 || item?.image_base64
  if (typeof base64 === 'string' && base64.trim()) {
    if (base64.startsWith('data:image/')) return base64
    const mime = base64.startsWith('iVBOR') ? 'png' : base64.startsWith('/9j/') ? 'jpeg' : format
    return `data:image/${mime};base64,${base64}`
  }
  if (typeof item?.url === 'string' && item.url.trim()) {
    const response = await fetch(item.url)
    if (!response.ok) throw new Error(`下载 Seedream 图片失败 (${response.status})`)
    return blobToDataUrl(await response.blob())
  }
  throw new Error('Seedream 响应中没有可用图片')
}

const validateParams = (params: SeedreamImageGenerateParams) => {
  if (!params.prompt?.trim()) throw new Error('请填写画面描述')
  if (!params.model?.trim()) throw new Error('请填写 Seedream 模型 ID')
  const references = (params.referenceImages || []).filter(Boolean)
  if (references.length > 10) throw new Error('Seedream 每次最多使用 10 张参考图')
  const maxImages = Number(params.maxImages || 1)
  if (!Number.isInteger(maxImages) || maxImages < 1 || maxImages > 15) {
    throw new Error('组图数量必须为 1–15 的整数')
  }
  if (references.length + maxImages > 15) throw new Error('参考图与输出图片合计不能超过 15 张')
}

export function useSeedreamImage() {
  const isGenerating = ref(false)
  const finalImages = ref<string[]>([])
  const finalImage = ref<string | null>(null)
  const errorMsg = ref<string | null>(null)
  const lastGeneratedParams = ref<SeedreamImageGenerateParams | null>(null)
  let abortController: AbortController | null = null

  const abortGeneration = () => {
    abortController?.abort()
    abortController = null
  }

  const generateImages = async (
    config: SeedreamImageConfig,
    params: SeedreamImageGenerateParams
  ): Promise<string[]> => {
    if (isGenerating.value) throw new Error('已有 Seedream 图片正在生成')
    if (!config.apiKey?.trim()) throw new Error('请先填写火山方舟 API Key')
    if (!config.baseUrl?.trim()) throw new Error('请先填写方舟 API 或代理地址')
    validateParams(params)

    abortController = new AbortController()
    isGenerating.value = true
    finalImages.value = []
    finalImage.value = null
    errorMsg.value = null
    lastGeneratedParams.value = JSON.parse(JSON.stringify(params))

    try {
      const references = (params.referenceImages || []).filter(Boolean)
      const sequential = params.sequentialImageGeneration || 'disabled'
      const body: Record<string, unknown> = {
        model: params.model.trim(),
        prompt: params.prompt.trim(),
        size: params.size || '2K',
        response_format: 'b64_json',
        watermark: Boolean(params.watermark),
        sequential_image_generation: sequential,
      }
      if (/seedream-5-0/i.test(params.model)) body.output_format = params.outputFormat || 'png'
      if (references.length) body.image = references
      if (params.seed !== null && params.seed !== undefined && Number.isFinite(Number(params.seed))) {
        body.seed = Number(params.seed)
      }
      if (sequential === 'auto') {
        body.sequential_image_generation_options = { max_images: Number(params.maxImages || 4) }
      }

      const response = await fetch(normalizeEndpoint(config.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey.trim()}`
        },
        body: JSON.stringify(body),
        signal: abortController.signal
      })
      if (!response.ok) throw new Error(await getErrorMessage(response))

      const payload = await response.json()
      const data = Array.isArray(payload?.data) ? payload.data : []
      if (!data.length) throw new Error('Seedream 没有返回图片')
      const format = params.outputFormat || 'png'
      const images = await Promise.all(data.map((item: any) => resolveImage(item, format)))
      finalImages.value = images
      finalImage.value = images[0] || null
      return images
    } catch (error: any) {
      const message = error?.name === 'AbortError'
        ? '已取消 Seedream 图片生成'
        : (error?.message || 'Seedream 图片生成失败')
      errorMsg.value = message
      throw new Error(message)
    } finally {
      isGenerating.value = false
      abortController = null
    }
  }

  const generateImage = async (config: SeedreamImageConfig, params: SeedreamImageGenerateParams) => {
    const images = await generateImages(config, { ...params, sequentialImageGeneration: 'disabled', maxImages: 1 })
    return images[0]
  }

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
