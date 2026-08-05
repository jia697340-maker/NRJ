/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'

// 模块级状态共享，确保全局只有一个队列在运行
let globalAudioInstance: HTMLAudioElement | null = null
const isPlaying = ref(false)
const isSynthesizing = ref(false)
const currentPlayingId = ref<number | null>(null)

// 语音播放队列
interface VoiceTask {
  msgId: number
  text: string
  chatSettings: any
  resolve: () => void
  reject: (err: any) => void
}
const voiceQueue: VoiceTask[] = []
let isQueueProcessing = false

export function useVoicePlayer() {

  const hexToBlob = (hexString: string, mimeType: string) => {
    const bytes = new Uint8Array(Math.ceil(hexString.length / 2))
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hexString.substring(i * 2, (i * 2) + 2), 16)
    }
    return new Blob([bytes], { type: mimeType })
  }

  // 内部真实的播放逻辑，独立出来供队列调用
  const _executePlayVoice = async (msgId: number, text: string, chatSettings: any) => {
    currentPlayingId.value = msgId

    // 合并角色特定配置
    const model = chatSettings?.voiceModel || 'speech-2.6-turbo'
    const voiceSetting = {
      voice_id: chatSettings?.voiceId || 'female-yujie',
      speed: chatSettings?.voiceSpeed ?? 1.0,
      pitch: chatSettings?.voicePitch ?? 1.0,
      vol: chatSettings?.voiceVolume ?? 1.0
    }

    // 文本清洗：正则过滤掉动作和表情（星号和括号中的内容）
    const cleanText = text
      .replace(/\*.*?\*/g, '')
      .replace(/[\(（].*?[\)）]/g, '')
      .replace(/<[^>]*>/g, '') // 额外清洗可能残留的HTML标签
      .trim()
      
    // 如果清洗后没内容了，就不播报了
    if (!cleanText) {
      isPlaying.value = false
      currentPlayingId.value = null
      return
    }

    const voiceStore = localforage.createInstance({
      name: 'nrt-app',
      storeName: 'chatVoices'
    })
    // 缓存键值结合了 msgId、模型、音色，确保修改音色后能重新生成
    const cacheKey = `voice_${msgId}_${model}_${voiceSetting.voice_id}`

    try {
      // 1. 先尝试读取本地缓存（即使没开开关或没密钥也能听以前的）
      const cachedAudioHex = await voiceStore.getItem<string>(cacheKey)
      if (cachedAudioHex) {
        return new Promise<void>((resolve) => {
          const blob = hexToBlob(cachedAudioHex, 'audio/mp3')
          const blobUrl = URL.createObjectURL(blob)
          
          globalAudioInstance = new Audio(blobUrl)
          
          globalAudioInstance.onended = () => {
            if (currentPlayingId.value === msgId) {
              isPlaying.value = false
              currentPlayingId.value = null
            }
            resolve()
          }
          
          globalAudioInstance.onpause = () => {
            if (currentPlayingId.value === msgId) {
              isPlaying.value = false
              currentPlayingId.value = null
            }
            // 暂停也认为本段任务结束，放行下一段
            resolve()
          }

          globalAudioInstance.onerror = (e) => {
            console.error('Audio play error', e)
            resolve() // 发生错误也放行队列
          }

          globalAudioInstance.play().then(() => {
            isPlaying.value = true
            isSynthesizing.value = false
          }).catch(err => {
            console.error('缓存音频播放失败:', err)
            resolve() // 无法播放也要放行
          })
        })
      }

      // 2. 缓存未命中，开始检查配置并调用 API
      
    // 既然需要播放，获取全局 MiniMax 配置
    const savedGlobalConfig = localStorage.getItem('minimax_voice_config_v4')
    if (!savedGlobalConfig) {
      throw new Error('MISSING_API_KEY')
    }

      let globalConfig: any = {}
      try {
        globalConfig = JSON.parse(savedGlobalConfig)
      } catch (e) {
        console.error(e)
      }

      const apiKey = globalConfig.apiKey
      if (!apiKey) {
        throw new Error('MISSING_API_KEY')
      }

      isSynthesizing.value = true

      const region = globalConfig.region || 'global'
      const baseUrl = region === 'china' ? 'https://api.minimaxi.com' : 'https://api.minimax.io'

    const payload = {
      model: model,
      text: cleanText,
      stream: false,
      voice_setting: voiceSetting,
      audio_setting: {
        format: "mp3",
        sample_rate: 32000,
        bitrate: 128000
      }
    }
    
    console.log('[useVoicePlayer] 发起合成请求 payload:', payload)

    const res = await fetch(`${baseUrl}/v1/t2a_v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      throw new Error(`语音合成请求失败 (状态码: ${res.status})`)
    }

      const data = await res.json()
      if (data.base_resp && data.base_resp.status_code !== 0) {
        throw new Error(data.base_resp.status_msg || '语音合成失败')
      }

      if (data.data && data.data.audio) {
        // 保存到缓存
        try {
          await voiceStore.setItem(cacheKey, data.data.audio)
        } catch (e) {
          console.error('保存语音缓存失败:', e)
        }

        return new Promise<void>((resolve) => {
          const blob = hexToBlob(data.data.audio, 'audio/mp3')
          const blobUrl = URL.createObjectURL(blob)
          
          globalAudioInstance = new Audio(blobUrl)
          
          globalAudioInstance.onended = () => {
            if (currentPlayingId.value === msgId) {
              isPlaying.value = false
              currentPlayingId.value = null
            }
            resolve()
          }
          
          globalAudioInstance.onpause = () => {
             if (currentPlayingId.value === msgId) {
              isPlaying.value = false
              currentPlayingId.value = null
            }
            resolve()
          }

          globalAudioInstance.onerror = (e) => {
            console.error('Audio play error', e)
            resolve()
          }

          globalAudioInstance.play().then(() => {
            isPlaying.value = true
          }).catch(err => {
            console.error('音频播放失败:', err)
            resolve()
          })
        })
      } else {
        throw new Error('未接收到有效音频流')
      }

  } catch (err: any) {
    console.error('语音合成播放错误:', err)
    currentPlayingId.value = null
    // 必须抛出错误，否则外层完全不知道失败了
    throw err
  } finally {
      isSynthesizing.value = false
    }
  }

  const processQueue = async () => {
    if (isQueueProcessing || voiceQueue.length === 0) return
    isQueueProcessing = true

    while (voiceQueue.length > 0) {
      const task = voiceQueue.shift()
      if (task) {
        try {
          // 清理可能遗留的上一首
          if (globalAudioInstance) {
            globalAudioInstance.pause()
            globalAudioInstance = null
          }
          await _executePlayVoice(task.msgId, task.text, task.chatSettings)
          task.resolve()
        } catch (err) {
          task.reject(err)
        }
      }
    }

    isQueueProcessing = false
  }

  const playVoice = (msgId: number, text: string, chatSettings: any) => {
    // 拦截点击同一条停止的功能（如果是用户手动点击按钮触发的重叠点击）
    if (currentPlayingId.value === msgId && isPlaying.value && voiceQueue.length === 0) {
      stopVoice()
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      voiceQueue.push({ msgId, text, chatSettings, resolve, reject })
      processQueue()
    })
  }

  const stopVoice = () => {
     // 清空队列
     voiceQueue.length = 0
     if (globalAudioInstance) {
        globalAudioInstance.pause()
        globalAudioInstance = null
      }
      isPlaying.value = false
      currentPlayingId.value = null
      isQueueProcessing = false
  }

  return {
    playVoice,
    stopVoice,
    isPlaying,
    isSynthesizing,
    currentPlayingId
  }
}
