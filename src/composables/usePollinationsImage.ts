/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'

export interface PollinationsImageConfig { apiKey: string; baseUrl?: string }
export interface PollinationsImageModel {
  name: string
  description?: string
  paid_only?: boolean
  input_modalities?: string[]
  output_modalities?: string[]
  pricing?: Record<string, number | string>
}
export interface PollinationsImageParams {
  model: string
  prompt: string
  size?: string
  quality?: 'standard' | 'hd' | 'low' | 'medium' | 'high'
  safe?: string | boolean
  referenceImages?: string[]
}

const DEFAULT_ROOT = 'https://gen.pollinations.ai'
let modelCache: { at: number; items: PollinationsImageModel[] } | null = null

const rootFromBase = (baseUrl = DEFAULT_ROOT) => baseUrl.trim().replace(/\/+$/, '').replace(/\/v1$/i, '')
const apiFromBase = (baseUrl = `${DEFAULT_ROOT}/v1`) => `${rootFromBase(baseUrl)}/v1`
const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error || new Error('读取图片失败'))
  reader.readAsDataURL(blob)
})
const valueToBlob = async (value: string) => {
  if (value.startsWith('data:') || /^https?:/i.test(value)) return (await fetch(value)).blob()
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: 'image/png' })
}
const parseError = async (response: Response) => {
  try {
    const payload = await response.json()
    const message = payload?.error?.message || payload?.message || payload?.error
    if (response.status === 402) return 'Pollinations Pollen 余额或当前密钥预算不足'
    if (response.status === 429) return `Pollinations 请求过于频繁${response.headers.get('retry-after') ? `，请在 ${response.headers.get('retry-after')} 秒后重试` : ''}`
    return String(message || `Pollinations 请求失败 (${response.status})`)
  } catch {
    return `Pollinations 请求失败 (${response.status})`
  }
}

export function usePollinationsImage() {
  const isGenerating = ref(false)
  const finalImage = ref<string | null>(null)
  const errorMsg = ref<string | null>(null)
  const lastGeneratedParams = ref<PollinationsImageParams | null>(null)
  let controller: AbortController | null = null

  const abortGeneration = () => controller?.abort()

  const fetchModels = async (force = false): Promise<PollinationsImageModel[]> => {
    if (!force && modelCache && Date.now() - modelCache.at < 5 * 60_000) return modelCache.items
    const response = await fetch(`${DEFAULT_ROOT}/image/models?community=false`)
    if (!response.ok) throw new Error(`无法获取 Pollinations 模型 (${response.status})`)
    const payload = await response.json()
    const items = (Array.isArray(payload) ? payload : payload?.data || [])
      .filter((item: any) => Array.isArray(item.output_modalities) ? item.output_modalities.includes('image') : true)
    modelCache = { at: Date.now(), items }
    return items
  }

  const generateImage = async (config: PollinationsImageConfig, params: PollinationsImageParams) => {
    if (isGenerating.value) throw new Error('已有 Pollinations 图片正在生成')
    if (!config.apiKey?.trim()) throw new Error('请先填写 Pollinations API Key 或完成 BYOP 授权')
    if (!params.prompt?.trim()) throw new Error('请填写画面描述')
    controller = new AbortController()
    isGenerating.value = true
    finalImage.value = null
    errorMsg.value = null
    lastGeneratedParams.value = JSON.parse(JSON.stringify({ ...params, referenceImages: undefined }))
    try {
      const references = (params.referenceImages || []).filter(Boolean).slice(0, 8)
      let supportsImages = false
      if (references.length) {
        try {
          const model = (await fetchModels()).find(item => item.name === params.model)
          supportsImages = Boolean(model?.input_modalities?.includes('image'))
        } catch {
          supportsImages = ['gpt-image-2', 'gptimage', 'gptimage-large', 'kontext', 'klein', 'seedream5', 'seedream-pro', 'nanobanana', 'nanobanana-pro'].includes(params.model)
        }
      }
      const endpoint = `${apiFromBase(config.baseUrl)}/images/${supportsImages ? 'edits' : 'generations'}`
      const headers: Record<string, string> = { Authorization: `Bearer ${config.apiKey.trim()}` }
      let body: BodyInit
      if (supportsImages) {
        const form = new FormData()
        form.append('model', params.model || 'zimage')
        form.append('prompt', params.prompt.trim())
        form.append('size', params.size || '1024x1024')
        form.append('quality', params.quality || 'medium')
        form.append('response_format', 'b64_json')
        if (params.safe !== undefined) form.append('safe', String(params.safe))
        for (let index = 0; index < references.length; index++) form.append('image', await valueToBlob(references[index]), `reference_${index + 1}.png`)
        body = form
      } else {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify({ model: params.model || 'zimage', prompt: params.prompt.trim(), n: 1, size: params.size || '1024x1024', quality: params.quality || 'medium', response_format: 'b64_json', safe: params.safe ?? 'privacy,secrets,sexual,violence' })
      }
      const response = await fetch(endpoint, { method: 'POST', headers, body, signal: controller.signal })
      if (!response.ok) throw new Error(await parseError(response))
      const payload = await response.json()
      const item = payload?.data?.[0]
      let result = ''
      if (item?.b64_json) result = `data:image/png;base64,${item.b64_json}`
      else if (item?.url) {
        const imageResponse = await fetch(item.url, { signal: controller.signal })
        if (!imageResponse.ok) throw new Error('Pollinations 图片地址无法读取')
        result = await blobToDataUrl(await imageResponse.blob())
      }
      if (!result) throw new Error('Pollinations 没有返回可解析的图片')
      finalImage.value = result
      return result
    } catch (error: any) {
      const message = error?.name === 'AbortError' ? '已取消 Pollinations 图片生成' : (error?.message || 'Pollinations 图片生成失败')
      errorMsg.value = message
      throw new Error(message)
    } finally {
      isGenerating.value = false
      controller = null
    }
  }

  return { isGenerating, finalImage, errorMsg, lastGeneratedParams, fetchModels, generateImage, abortGeneration }
}

