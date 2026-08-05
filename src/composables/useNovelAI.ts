/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'

import JSZip from 'jszip'

export interface NovelAIConfig {
  apiKey: string
  baseUrl: string
  useStream?: boolean
}

export interface NovelAIGenerateParams {
  input: string
  model: string
  action: string
  width: number
  height: number
  scale: number
  sampler: string
  steps: number
  seed?: number
  n_samples: number
  noise_schedule: string
  negative_prompt?: string
  sm?: boolean
  sm_dyn?: boolean
  skip_cfg_above_sigma?: number
  image?: string
  reference_image?: string
  reference_image_multiple?: string[]
  reference_strength_multiple?: number[]
  reference_information_extracted_multiple?: number[]
}

export function useNovelAI() {
  const isGenerating = ref(false)
  const currentProgressImage = ref<string | null>(null)
  const finalImage = ref<string | null>(null)
  const errorMsg = ref<string | null>(null)
  const pointsCost = ref<number | null>(null)
  const lastGeneratedParams = ref<NovelAIGenerateParams | null>(null)

  let abortController: AbortController | null = null

  const abortGeneration = () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }

  const parseEvent = (raw: string) => {
    let event = ''
    const dataLines: string[] = []
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        let l = line.slice(5)
        if (l.startsWith(' ')) l = l.slice(1)
        dataLines.push(l)
      }
    }
    return { event, data: dataLines.join('\n') }
  }

  const safeJson = (text: string) => {
    try { return JSON.parse(text) } catch { return null }
  }

  // 将 base64 转为二进制 Buffer 的辅助函数
  const b64ToArrayBuffer = (b64: string) => {
    const binaryString = window.atob(b64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  // 将二进制转为 base64 的辅助函数
  const arrayBufferToB64 = (buffer: ArrayBuffer) => {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }

  const generateImage = async (config: NovelAIConfig, params: NovelAIGenerateParams) => {
    if (isGenerating.value) return

    abortController = new AbortController()

    isGenerating.value = true
    currentProgressImage.value = null
    finalImage.value = null
    errorMsg.value = null
    pointsCost.value = null

    try {
      const isV4 = params.model.startsWith('nai-diffusion-4')
      
      lastGeneratedParams.value = JSON.parse(JSON.stringify(params))
      
      const payload: any = {
        input: params.input,
        model: params.model,
        action: params.action || 'generate',
        parameters: {
          width: params.width,
          height: params.height,
          scale: params.scale,
          sampler: params.sampler,
          steps: params.steps,
          n_samples: params.n_samples,
          noise_schedule: params.noise_schedule,
          negative_prompt: params.negative_prompt || ''
        }
      }

      if (params.seed !== undefined && params.seed !== null) {
        payload.parameters.seed = params.seed
      }
      if (params.sm !== undefined) {
        payload.parameters.sm = params.sm
      }
      if (params.sm_dyn !== undefined) {
        payload.parameters.sm_dyn = params.sm_dyn
      }
      if (params.skip_cfg_above_sigma !== undefined) {
        payload.parameters.skip_cfg_above_sigma = params.skip_cfg_above_sigma
      }

      let hasImage = false
      if (params.image) {
        hasImage = true
        let rawB64 = params.image
        if (rawB64.includes(',')) rawB64 = rawB64.split(',', 2)[1]
        payload.parameters.image = rawB64
      }
      if (params.reference_image) {
        hasImage = true
        let rawB64 = params.reference_image
        if (rawB64.includes(',')) rawB64 = rawB64.split(',', 2)[1]
        payload.parameters.reference_image = rawB64
      }

      let hasVibe = false
      if (params.reference_image_multiple && params.reference_image_multiple.length > 0) {
        hasVibe = true
        // 预编码氛围图 (encode-vibe)
        const encodedVibes: string[] = []
        for (let i = 0; i < params.reference_image_multiple.length; i++) {
          let rawB64 = params.reference_image_multiple[i]
          if (rawB64.includes(',')) rawB64 = rawB64.split(',', 2)[1]
          
          const extractRate = params.reference_information_extracted_multiple?.[i] ?? 1.0
          
          const encodePayload = {
            image: rawB64,
            information_extracted: extractRate,
            model: params.model
          }
          
          const encodeUrl = `${config.baseUrl.replace(/\/$/, '')}/ai/encode-vibe`
          const encodeResp = await fetch(encodeUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(encodePayload),
            signal: abortController.signal
          })
          
          if (!encodeResp.ok) {
            throw new Error(`氛围参考图预处理失败 (HTTP ${encodeResp.status})`)
          }
          
          const vibeBuffer = await encodeResp.arrayBuffer()
          encodedVibes.push(arrayBufferToB64(vibeBuffer))
        }

        payload.parameters.reference_image_multiple = encodedVibes
        if (params.reference_strength_multiple) {
          payload.parameters.reference_strength_multiple = params.reference_strength_multiple
        }
        if (params.reference_information_extracted_multiple) {
          payload.parameters.reference_information_extracted_multiple = params.reference_information_extracted_multiple
        }
      }

      if (hasImage && hasVibe) {
        throw new Error('氛围转移与精确参考不能同时使用')
      }

      // V4 Specific parameters required
      if (isV4) {
        payload.parameters.params_version = 3
        payload.parameters.v4_prompt = {
          caption: { base_caption: params.input, char_captions: [] },
          use_coords: false,
          use_order: true
        }
        payload.parameters.v4_negative_prompt = {
          caption: { base_caption: params.negative_prompt || '', char_captions: [] },
          legacy_uc: false
        }
      }

      // 存在氛围图时强制关闭流式，避免各种未知 500 或格式解析错误
      const useStream = hasVibe ? false : (config.useStream !== false)
      const endpoint = useStream ? '/ai/generate-image-stream' : '/ai/generate-image'
      const url = `${config.baseUrl.replace(/\/$/, '')}${endpoint}`

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }

      if (useStream) {
        headers['Accept'] = 'text/event-stream'
      } else {
        headers['Accept'] = 'application/x-zip-compressed'
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: abortController.signal
      })

      if (!resp.ok) {
        let text = await resp.text()
        const errorJson = safeJson(text)
        if (errorJson && errorJson.message) {
          text = errorJson.message
        } else if (errorJson && errorJson.error) {
          text = errorJson.error
        }
        throw new Error(`请求失败 (HTTP ${resp.status}): ${text}`)
      }

      if (useStream) {
        // --- SSE Stream Parsing ---
        const reader = resp.body?.getReader()
        if (!reader) throw new Error('无法读取响应流')
        
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          
          buffer += decoder.decode(value, { stream: true })
          let sepIdx
          while ((sepIdx = buffer.indexOf('\n\n')) >= 0) {
            const rawEvent = buffer.slice(0, sepIdx)
            buffer = buffer.slice(sepIdx + 2)
            
            const { event, data } = parseEvent(rawEvent)
            
            if (event === 'ready') {
              const info = safeJson(data) || {}
              pointsCost.value = info.points_cost || null
            } else if (event === 'error') {
              const info = safeJson(data) || {}
              throw new Error(info.error || data || '生成过程中发生错误')
            } else if (event === 'done') {
              const info = safeJson(data) || {}
              let final = info.final_image
              if (!final && Array.isArray(info.images) && info.images.length) {
                final = info.images[0].data
              }
              if (final) {
                const b64 = final.includes(',') ? final.split(',', 2)[1] : final
                const byteCharacters = window.atob(b64)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                
                // 检查是否是 ZIP 压缩包 (ZIP文件头: 'PK' 即 0x50, 0x4B)
                if (byteArray.length > 2 && byteArray[0] === 0x50 && byteArray[1] === 0x4B) {
                  const jszip = new JSZip()
                  const zip = await jszip.loadAsync(byteArray)
                  const imageFile = Object.values(zip.files).find(f => !f.dir && (f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.webp')))
                  if (imageFile) {
                    const buffer = await imageFile.async('arraybuffer')
                    let mimeType = 'image/png'
                    if (imageFile.name.endsWith('.jpg') || imageFile.name.endsWith('.jpeg')) mimeType = 'image/jpeg'
                    else if (imageFile.name.endsWith('.webp')) mimeType = 'image/webp'
                    const imageBlob = new Blob([buffer], { type: mimeType })
                    finalImage.value = URL.createObjectURL(imageBlob)
                  } else {
                    throw new Error('返回的 ZIP 压缩包中未找到图片')
                  }
                } else {
                  const blob = new Blob([byteArray], { type: 'image/png' })
                  finalImage.value = URL.createObjectURL(blob)
                }
                
                pointsCost.value = info.points_cost || pointsCost.value
              } else {
                throw new Error('done 事件未返回图片')
              }
            } else {
              // 中间帧
              const info = safeJson(data)
              let imgB64 = null
              if (info && typeof info.image === 'string') {
                imgB64 = info.image
              } else if (data && !data.startsWith('{')) {
                imgB64 = data
              }
              
              if (imgB64) {
                currentProgressImage.value = `data:image/jpeg;base64,${imgB64}`
              }
            }
          }
        }
      } else {
        // --- Non-Stream (Fallback) Parsing ---
        const arrayBuffer = await resp.arrayBuffer()
        const byteArray = new Uint8Array(arrayBuffer)
        
        const isImage = (bytes: Uint8Array) => {
          if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png'
          if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg'
          if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'image/webp'
          return null
        }

        const handleBase64Image = async (b64: string) => {
          let cleanB64 = b64.trim()
          if (cleanB64.includes(',')) cleanB64 = cleanB64.split(',', 2)[1]
          const byteCharacters = window.atob(cleanB64)
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const b64ByteArray = new Uint8Array(byteNumbers)
          
          if (b64ByteArray.length > 2 && b64ByteArray[0] === 0x50 && b64ByteArray[1] === 0x4B) {
            const jszip = new JSZip()
            const zip = await jszip.loadAsync(b64ByteArray)
            const imageFile = Object.values(zip.files).find(f => !f.dir && (f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.webp')))
            if (imageFile) {
              const buffer = await imageFile.async('arraybuffer')
              const imgType = isImage(new Uint8Array(buffer)) || 'image/png'
              const imageBlob = new Blob([buffer], { type: imgType })
              finalImage.value = URL.createObjectURL(imageBlob)
              return true
            } else {
              throw new Error('嵌套ZIP压缩包中未找到图片文件')
            }
          } else {
            const imgType = isImage(b64ByteArray)
            if (!imgType) throw new Error('Base64解码后不是有效的图片格式')
            const blob = new Blob([b64ByteArray], { type: imgType })
            finalImage.value = URL.createObjectURL(blob)
            return true
          }
        }

        if (byteArray.length > 2 && byteArray[0] === 0x50 && byteArray[1] === 0x4B) {
          // ZIP file
          const jszip = new JSZip()
          const zip = await jszip.loadAsync(arrayBuffer)
          const imageFile = Object.values(zip.files).find(f => !f.dir && (f.name.endsWith('.png') || f.name.endsWith('.jpg') || f.name.endsWith('.webp')))
          if (imageFile) {
            const buffer = await imageFile.async('arraybuffer')
            const extractedBytes = new Uint8Array(buffer)
            const imgType = isImage(extractedBytes)
            if (!imgType) throw new Error('解压出的文件不是有效的图片格式')
            const imageBlob = new Blob([buffer], { type: imgType })
            finalImage.value = URL.createObjectURL(imageBlob)
          } else {
            throw new Error('ZIP压缩包中未找到图片文件')
          }
        } else {
          // Try to decode as text to see if it's JSON or Base64
          let text = ''
          try {
            text = new TextDecoder('utf-8').decode(byteArray)
          } catch (e) {}

          if (text) {
            const data = safeJson(text)
            if (data) {
              let final = null
              if (Array.isArray(data)) {
                 final = data[0]?.image || data[0]?.final_image || data[0]?.data
              } else {
                 final = data.final_image || data.image || (data.images && data.images[0] && data.images[0].data)
              }
              
              if (final && typeof final === 'string') {
                await handleBase64Image(final)
              } else {
                throw new Error('JSON中未找到有效图片字段: ' + text.slice(0, 100))
              }
            } else {
              // Not JSON, maybe raw base64 text?
              const trimmed = text.trim()
              if (trimmed.startsWith('iVBORw') || trimmed.startsWith('/9j/') || trimmed.startsWith('data:image')) {
                await handleBase64Image(trimmed)
              } else {
                // Check if it's raw binary image
                const imgType = isImage(byteArray)
                if (imgType) {
                  const blob = new Blob([arrayBuffer], { type: imgType })
                  finalImage.value = URL.createObjectURL(blob)
                } else {
                  throw new Error('未知格式 (非图片/JSON/ZIP): ' + text.slice(0, 150))
                }
              }
            }
          } else {
            // Text decode failed, must be raw binary
            const imgType = isImage(byteArray)
            if (imgType) {
              const blob = new Blob([arrayBuffer], { type: imgType })
              finalImage.value = URL.createObjectURL(blob)
            } else {
              throw new Error('响应不是有效的图片二进制数据')
            }
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        errorMsg.value = '已取消生成'
      } else {
        errorMsg.value = e.message || '生成失败'
      }
      throw e // 向上抛出异常，让调用方能捕获到
    } finally {
      isGenerating.value = false
      abortController = null
    }
    
    // 如果没有抛出异常，此时 finalImage.value 应该是完整的 Blob URL 或 base64
    // 返回对应的 base64 (如果存的是 object URL，可能需要外面或者这里转，但现有逻辑是通过 fetch 或 ZIP 解析拿到的)
    // 为了支持 useChatRoomAPI 中的 .then(base64Img)，我们需要返回图片的 base64
    // 观察上面的逻辑，finalImage.value 都是被赋值为 URL.createObjectURL(blob)
    // 但原版 useChatRoomAPI.ts 需要 base64Img，因此我们可以把 Blob 转回 base64，或者更简单，在获取的时候直接留一份 base64
    // 注意上面的处理逻辑比较多，最简单的办法是从 finalImage.value 提取 blob 再转 base64 返回
    if (finalImage.value) {
      const response = await fetch(finalImage.value)
      const blob = await response.blob()
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          let b64 = reader.result as string
          resolve(b64)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } else {
      throw new Error('生成成功但未找到图像数据')
    }
  }

  const clearImages = () => {
    if (finalImage.value) {
      URL.revokeObjectURL(finalImage.value)
      finalImage.value = null
    }
    currentProgressImage.value = null
    errorMsg.value = null
    pointsCost.value = null
  }

  return {
    isGenerating,
    currentProgressImage,
    finalImage,
    errorMsg,
    pointsCost,
    generateImage,
    abortGeneration,
    clearImages,
    lastGeneratedParams
  }
}
