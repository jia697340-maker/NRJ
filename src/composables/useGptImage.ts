/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'

export type GptImageQuality = 'auto' | 'low' | 'medium' | 'high'
export type GptImageFormat = 'png' | 'jpeg' | 'webp'
export type GptImageModeration = 'auto' | 'low'

export interface GptImageConfig {
  apiKey: string
  baseUrl: string
}

export interface GptImageGenerateParams {
  model: string
  prompt: string
  size: string
  quality: GptImageQuality
  n?: number
  output_format?: GptImageFormat
  output_compression?: number
  moderation?: GptImageModeration
  referenceImages?: string[]
}

const mimeTypes: Record<GptImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp'
}

const normalizeEndpoint = (baseUrl: string, mode: 'generations' | 'edits') => {
  const trimmed = (baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '')
  if (/\/images\/(generations|edits)$/i.test(trimmed)) {
    return trimmed.replace(/\/images\/(generations|edits)$/i, `/images/${mode}`)
  }
  return `${trimmed}/images/${mode}`
}

const dataUrlToBlob = async (value: string) => {
  if (value.startsWith('data:')) {
    return (await fetch(value)).blob()
  }
  const clean = value.replace(/\s/g, '')
  const binary = window.atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: 'image/png' })
}

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error || new Error('读取图片失败'))
  reader.readAsDataURL(blob)
})

const remoteImageToDataUrl = async (url: string) => {
  try {
    const response = await fetch(url)
    if (!response.ok) return url
    return await blobToDataUrl(await response.blob())
  } catch {
    // 某些第三方图片 CDN 不允许跨域读取，保留 URL 仍可用于预览。
    return url
  }
}

const getErrorMessage = async (response: Response) => {
  try {
    const data = await response.json()
    return data?.error?.message || data?.message || `GPT 生图请求失败 (${response.status})`
  } catch {
    return `GPT 生图请求失败 (${response.status})`
  }
}

const validateGptImage2Size = (model: string, size: string) => {
  if (!model.startsWith('gpt-image-2') || size === 'auto') return
  const match = size.match(/^(\d+)x(\d+)$/)
  if (!match) throw new Error('GPT Image 2 尺寸格式应为“宽x高”')
  const width = Number(match[1])
  const height = Number(match[2])
  const pixels = width * height
  const ratio = width / height
  if (width % 16 !== 0 || height % 16 !== 0) throw new Error('GPT Image 2 的宽高必须是 16 的倍数')
  if (ratio < 1 / 3 || ratio > 3) throw new Error('GPT Image 2 的宽高比例必须在 1:3 到 3:1 之间')
  if (pixels < 655360 || pixels > 8294400) throw new Error('GPT Image 2 的总像素必须在 655,360 到 8,294,400 之间')
}

export function useGptImage() {
  const isGenerating = ref(false)
  const finalImages = ref<string[]>([])
  const finalImage = ref<string | null>(null)
  const errorMsg = ref<string | null>(null)
  const lastGeneratedParams = ref<GptImageGenerateParams | null>(null)
  let abortController: AbortController | null = null

  const abortGeneration = () => {
    abortController?.abort()
    abortController = null
  }

  const generateImages = async (
    config: GptImageConfig,
    params: GptImageGenerateParams
  ): Promise<string[]> => {
    if (isGenerating.value) throw new Error('已有 GPT 图片正在生成')
    if (!config.apiKey?.trim()) throw new Error('请先填写 GPT 生图 API Key')
    if (!params.prompt?.trim()) throw new Error('请填写画面描述')

    abortController = new AbortController()
    isGenerating.value = true
    finalImages.value = []
    finalImage.value = null
    errorMsg.value = null
    lastGeneratedParams.value = JSON.parse(JSON.stringify(params))

    try {
      const references = (params.referenceImages || []).filter(Boolean)
      if (references.length > 16) throw new Error('GPT Image 2 每次最多使用 16 张参考图，请减少所选参考组')
      const mode = references.length > 0 ? 'edits' : 'generations'
      const endpoint = normalizeEndpoint(config.baseUrl, mode)
      const headers: Record<string, string> = {
        Authorization: `Bearer ${config.apiKey.trim()}`
      }

      const outputFormat = params.output_format || 'png'
      const commonParams: Record<string, string | number> = {
        model: params.model || 'gpt-image-2',
        prompt: params.prompt.trim(),
        size: params.size || '1024x1024',
        quality: params.quality || 'medium',
        n: Math.min(10, Math.max(1, Number(params.n) || 1)),
        output_format: outputFormat,
        moderation: params.moderation || 'auto'
      }
      if (outputFormat !== 'png') {
        commonParams.output_compression = Math.min(100, Math.max(0, Number(params.output_compression) || 100))
      }
      validateGptImage2Size(String(commonParams.model), String(commonParams.size))

      let body: BodyInit
      if (mode === 'edits') {
        const formData = new FormData()
        Object.entries(commonParams).forEach(([key, value]) => formData.append(key, String(value)))
        for (let index = 0; index < references.length; index++) {
          const blob = await dataUrlToBlob(references[index])
          formData.append('image[]', blob, `reference_${index + 1}.png`)
        }
        body = formData
      } else {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify(commonParams)
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: abortController.signal
      })
      if (!response.ok) throw new Error(await getErrorMessage(response))

      const data = await response.json()
      const items = Array.isArray(data?.data) ? data.data : []
      if (items.length === 0) {
        if (data?.task_id || data?.id) {
          throw new Error('该第三方接口返回了异步任务，当前仅支持 OpenAI 兼容的同步图片响应')
        }
        throw new Error('接口没有返回图片数据')
      }

      const format = commonParams.output_format as GptImageFormat
      const images = await Promise.all(items.map(async (item: any) => {
        if (item?.b64_json) return `data:${mimeTypes[format]};base64,${item.b64_json}`
        if (item?.url) return remoteImageToDataUrl(item.url)
        return ''
      }))
      const validImages = images.filter(Boolean)
      if (validImages.length === 0) throw new Error('无法解析接口返回的图片')

      finalImages.value = validImages
      finalImage.value = validImages[0]
      return validImages
    } catch (error: any) {
      const message = error?.name === 'AbortError' ? '已取消 GPT 图片生成' : (error?.message || 'GPT 图片生成失败')
      errorMsg.value = message
      throw new Error(message)
    } finally {
      isGenerating.value = false
      abortController = null
    }
  }

  const generateImage = async (config: GptImageConfig, params: GptImageGenerateParams) => {
    const images = await generateImages(config, { ...params, n: 1 })
    return images[0]
  }

  return {
    isGenerating,
    finalImages,
    finalImage,
    errorMsg,
    lastGeneratedParams,
    generateImages,
    generateImage,
    abortGeneration
  }
}
