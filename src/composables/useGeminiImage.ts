/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'

export type GeminiImageTransport = 'official' | 'openrouter'
export type GeminiImageSize = '0.5K' | '1K' | '2K' | '4K'
export type GeminiImageMimeType = 'image/png' | 'image/jpeg'
export type GeminiThinkingLevel = 'minimal' | 'high'

export interface GeminiImageConfig {
  apiKey: string
  baseUrl: string
  transport: GeminiImageTransport
}

export interface GeminiImageGenerateParams {
  model: string
  prompt: string
  aspectRatio: string
  imageSize: GeminiImageSize
  mimeType?: GeminiImageMimeType
  thinkingLevel?: GeminiThinkingLevel
  useGoogleSearch?: boolean
  useImageSearch?: boolean
  referenceImages?: string[]
}

const OFFICIAL_BASE_URL = 'https://generativelanguage.googleapis.com'
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

const normalizeEndpoint = (baseUrl: string, transport: GeminiImageTransport) => {
  const fallback = transport === 'official' ? OFFICIAL_BASE_URL : OPENROUTER_BASE_URL
  const trimmed = (baseUrl || fallback).trim().replace(/\/+$/, '')
  if (transport === 'official') {
    if (/\/v1beta\/interactions$/i.test(trimmed)) return trimmed
    return `${trimmed}/v1beta/interactions`
  }
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed
  return `${trimmed}/chat/completions`
}

const parseDataUrl = (value: string) => {
  const match = value.match(/^data:([^;,]+);base64,([\s\S]+)$/i)
  if (match) return { mimeType: match[1], data: match[2].replace(/\s/g, '') }
  return { mimeType: 'image/png', data: value.replace(/\s/g, '') }
}

const normalizeImage = (data: string, mimeType = 'image/png') => {
  if (!data) return ''
  if (data.startsWith('data:') || /^https?:\/\//i.test(data)) return data
  return `data:${mimeType};base64,${data}`
}

const collectOfficialImages = (payload: any) => {
  const images: string[] = []
  if (payload?.output_image?.data) {
    images.push(normalizeImage(
      payload.output_image.data,
      payload.output_image.mime_type || payload.output_image.mimeType
    ))
  }
  const visit = (value: any) => {
    if (!value) return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (typeof value !== 'object') return
    if (value.type === 'image' && typeof value.data === 'string') {
      images.push(normalizeImage(value.data, value.mime_type || value.mimeType))
      return
    }
    if (value.inline_data?.data || value.inlineData?.data) {
      const inline = value.inline_data || value.inlineData
      images.push(normalizeImage(inline.data, inline.mime_type || inline.mimeType))
      return
    }
    Object.values(value).forEach(visit)
  }
  visit(payload?.steps)
  if (images.length === 0) visit(payload?.output)
  if (images.length === 0) visit(payload?.output_image)
  return [...new Set(images.filter(Boolean))]
}

const collectOpenRouterImages = (payload: any) => {
  const items = payload?.choices?.[0]?.message?.images
  if (Array.isArray(items)) {
    return items
      .map((item: any) => item?.image_url?.url || item?.imageUrl?.url || item?.url || item?.b64_json)
      .map((value: string) => normalizeImage(value))
      .filter(Boolean)
  }
  const data = Array.isArray(payload?.data) ? payload.data : []
  return data
    .map((item: any) => item?.url || item?.b64_json)
    .map((value: string) => normalizeImage(value))
    .filter(Boolean)
}

const getErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json()
    return payload?.error?.message || payload?.message || `Gemini 生图请求失败 (${response.status})`
  } catch {
    return `Gemini 生图请求失败 (${response.status})`
  }
}

export function useGeminiImage() {
  const isGenerating = ref(false)
  const finalImages = ref<string[]>([])
  const finalImage = ref<string | null>(null)
  const errorMsg = ref<string | null>(null)
  const lastGeneratedParams = ref<GeminiImageGenerateParams | null>(null)
  let abortController: AbortController | null = null

  const abortGeneration = () => {
    abortController?.abort()
    abortController = null
  }

  const generateImages = async (
    config: GeminiImageConfig,
    params: GeminiImageGenerateParams
  ): Promise<string[]> => {
    if (isGenerating.value) throw new Error('已有 Gemini 图片正在生成')
    if (!config.apiKey?.trim()) throw new Error('请先填写 Gemini 生图 API Key')
    if (!params.prompt?.trim()) throw new Error('请填写画面描述')

    const transport = config.transport || 'official'
    const references = (params.referenceImages || []).filter(Boolean)
    if (references.length > 14) throw new Error('Gemini 每次最多使用 14 张参考图')
    if (params.model.includes('flash-lite-image') && params.imageSize !== '1K') {
      throw new Error('Gemini 3.1 Flash Lite Image 仅支持 1K 分辨率')
    }
    if (params.imageSize === '0.5K' && !params.model.includes('3.1-flash-image')) {
      throw new Error('仅 Gemini 3.1 Flash Image 支持 0.5K 分辨率')
    }

    abortController = new AbortController()
    isGenerating.value = true
    finalImages.value = []
    finalImage.value = null
    errorMsg.value = null
    lastGeneratedParams.value = JSON.parse(JSON.stringify(params))

    try {
      const endpoint = normalizeEndpoint(config.baseUrl, transport)
      let body: Record<string, any>
      let headers: Record<string, string>

      if (transport === 'official') {
        headers = {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey.trim(),
          'Api-Revision': '2026-05-20'
        }
        const input: any[] = [{ type: 'text', text: params.prompt.trim() }]
        references.forEach(reference => {
          const parsed = parseDataUrl(reference)
          input.push({ type: 'image', data: parsed.data, mime_type: parsed.mimeType })
        })
        body = {
          model: params.model || 'gemini-3.1-flash-image',
          input,
          response_format: {
            type: 'image',
            mime_type: params.mimeType || 'image/png',
            aspect_ratio: params.aspectRatio || '2:3',
            image_size: params.imageSize || '1K'
          }
        }
        if (params.model.includes('3.1-flash-image')) {
          body.generation_config = { thinking_level: params.thinkingLevel || 'minimal' }
        }
        if (params.useGoogleSearch || params.useImageSearch) {
          const searchTypes = [
            ...(params.useGoogleSearch ? ['web_search'] : []),
            ...(params.useImageSearch ? ['image_search'] : [])
          ]
          body.tools = [{
            type: 'google_search',
            ...(searchTypes.length ? { search_types: searchTypes } : {})
          }]
        }
      } else {
        headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey.trim()}`
        }
        const content: any[] = [{ type: 'text', text: params.prompt.trim() }]
        references.forEach(reference => {
          content.push({ type: 'image_url', image_url: { url: reference } })
        })
        body = {
          model: params.model || 'google/gemini-3.1-flash-image',
          messages: [{ role: 'user', content }],
          modalities: ['image', 'text'],
          image_config: {
            aspect_ratio: params.aspectRatio || '2:3',
            image_size: params.imageSize || '1K'
          }
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abortController.signal
      })
      if (!response.ok) throw new Error(await getErrorMessage(response))

      const payload = await response.json()
      const images = transport === 'official'
        ? collectOfficialImages(payload)
        : collectOpenRouterImages(payload)
      if (images.length === 0) throw new Error('Gemini 接口没有返回可解析的图片')

      finalImages.value = images
      finalImage.value = images[0]
      return images
    } catch (error: any) {
      const message = error?.name === 'AbortError'
        ? '已取消 Gemini 图片生成'
        : (error?.message || 'Gemini 图片生成失败')
      errorMsg.value = message
      throw new Error(message)
    } finally {
      isGenerating.value = false
      abortController = null
    }
  }

  const generateImage = async (config: GeminiImageConfig, params: GeminiImageGenerateParams) => {
    const images = await generateImages(config, params)
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
