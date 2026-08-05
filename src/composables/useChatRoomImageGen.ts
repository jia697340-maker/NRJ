/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { sendChatMessage } from '../services/api'
import localforage from 'localforage'

export function useChatRoomImageGen(
  selectedChat: any,
  myProfile: any,
  generateImage: any,
  saveCustomContacts: () => void,
  scrollToBottom: () => Promise<void>
) {
  const handleAIImageGen = async (
    chatToUpdate: any,
    currentChatId: number,
    baseMessageId: number,
    actionContent: string,
    isRoomActive: boolean
  ) => {
    const naiConfig = selectedChat.value.naiConfig || {}
    const vibeText = naiConfig.vibeText || ''
    const positivePrompt = naiConfig.positivePrompt || ''
    
    // 给用户一个 "正在构思画面..." 的状态
    chatToUpdate.messages.push({
      id: baseMessageId,
      type: 'left',
      content: '正在构思画面...',
      isGeneratingImage: true,
      imageData: {
        text: actionContent,
        prompt: '' // 等翻译完再填入
      }
    })
    chatToUpdate.preview = '[正在作画中...]'
    if (isRoomActive && selectedChat.value && selectedChat.value.id === currentChatId) {
      await scrollToBottom()
    }

    let finalPrompt = ''
    let dynamicNegativePrompt = ''

    // LLM 生图辅助逻辑
    if (naiConfig.enableLlmAssist && naiConfig.llmApiUrl && naiConfig.llmApiKey) {
      try {
        const contextSize = typeof naiConfig.llmContextSize === 'number' ? naiConfig.llmContextSize : 15
        const recentMsgs = chatToUpdate.messages
          .filter((m: any) => m.type === 'left' || m.type === 'right')
          .slice(-contextSize)
          .map((m: any) => `${m.type === 'left' ? (chatToUpdate.name || 'AI') : (myProfile.value.name || 'User')}: ${m.content}`)
          .join('\n')

        const enabledPrompts = (naiConfig.llmPrompts || [])
          .filter((p: any) => p.enabled)
          .map((p: any) => p.content)
          .join('\n\n')

        const llmSystemPrompt = `你是一个专业的生图辅助 AI。以下是你的工作准则：\n\n${enabledPrompts || ''}`
        const llmUserPrompt = `[最近的聊天记录上下文]\n${recentMsgs}\n\n[本次生图的动作/画面描述]\n${actionContent}\n\n请根据上述上下文和画面描述，严格按照你的设定输出 Markdown 格式的解析和正反向提示词。`

        let endpoint = naiConfig.llmApiUrl || ''
        if (endpoint && !endpoint.endsWith('/chat/completions')) {
          endpoint = endpoint.replace(/\/+$/, '') + (endpoint.includes('/v1') ? '/chat/completions' : '/v1/chat/completions')
        }
        
        const requestBody = {
          model: naiConfig.llmModel || 'gpt-4o',
          messages: [
            { role: 'system', content: llmSystemPrompt },
            { role: 'user', content: llmUserPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1000
        }
        
        const llmRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${naiConfig.llmApiKey}`
          },
          body: JSON.stringify(requestBody)
        })

        if (!llmRes.ok) {
          throw new Error(`LLM 辅助生图请求失败: ${llmRes.status}`)
        }

        const llmData = await llmRes.json()
        const llmReply = llmData.choices[0].message.content || ''

        const posMatch = llmReply.match(/###\s*🟢\s*【Positive Prompt[^{]*】[\s\S]*?(?=(?:###|$))/i)
        const negMatch = llmReply.match(/###\s*🔴\s*【Negative Prompt[^{]*】[\s\S]*?(?=(?:###|$))/i)

        if (posMatch) {
          const rawPos = posMatch[0].replace(/###\s*🟢\s*【[^】]*】/i, '').trim()
          finalPrompt = rawPos.replace(/\n/g, ' ').replace(/\s+/g, ' ')
        }
        if (negMatch) {
          const rawNeg = negMatch[0].replace(/###\s*🔴\s*【[^】]*】/i, '').trim()
          dynamicNegativePrompt = rawNeg.replace(/\n/g, ' ').replace(/\s+/g, ' ')
        }

        if (!finalPrompt) {
          throw new Error('未能在 LLM 回复中提取到 Positive Prompt')
        }
      } catch (err) {
        console.error('LLM 辅助生图失败，回退至基础翻译模式', err)
        const translatePromptRequest = [
          { role: 'system', content: 'You are an expert prompt engineer for NovelAI (Danbooru tags). Translate the user\'s scene description into comma-separated english tags. Only output the tags, no explanation.' },
          { role: 'user', content: actionContent }
        ]
        try {
          const res = await sendChatMessage(translatePromptRequest, undefined, false, true)
          finalPrompt = typeof res === 'string' ? res : res.content
          finalPrompt = finalPrompt.trim()
        } catch (e) {
          finalPrompt = actionContent
        }
      }
    } else {
      const translatePromptRequest = [
        { role: 'system', content: 'You are an expert prompt engineer for NovelAI (Danbooru tags). Translate the user\'s scene description into comma-separated english tags. Only output the tags, no explanation.' },
        { role: 'user', content: actionContent }
      ]
      try {
        const res = await sendChatMessage(translatePromptRequest, undefined, false, true)
        finalPrompt = typeof res === 'string' ? res : res.content
        finalPrompt = finalPrompt.trim()
      } catch (err: any) {
        console.error('生图翻译提示词失败', err)
        finalPrompt = actionContent
      }
    }

    if (positivePrompt) {
      finalPrompt = [positivePrompt, finalPrompt].filter(Boolean).join(', ')
    }
    if (vibeText) {
      finalPrompt = [vibeText, finalPrompt].filter(Boolean).join(', ')
    }
    
    let finalNegative = naiConfig.negativePrompt || ''
    if (dynamicNegativePrompt) {
      finalNegative = [finalNegative, dynamicNegativePrompt].filter(Boolean).join(', ')
    }

    const msgRef = chatToUpdate.messages.find((m: any) => m.id === baseMessageId)
    if (msgRef) {
      msgRef.content = '正在绘制图像...'
      msgRef.imageData.prompt = finalPrompt
    }

    const { negativePrompt, presetId, apiKey, baseUrl, useStream, vibe_group_ids, seed, sm, sm_dyn, skip_cfg_above_sigma, ...restConfig } = naiConfig
    
    // We already deleted these logically but need to be safe
    delete restConfig.vibeText
    delete restConfig.positivePrompt
    
    const genParams: any = {
      ...restConfig,
      input: finalPrompt
    }
    
    if (genParams.n_samples === undefined) genParams.n_samples = 1
    if (genParams.action === undefined) genParams.action = 'generate'
    if (finalNegative) genParams.negative_prompt = finalNegative
    if (seed) genParams.seed = parseInt(seed as string)

    const model = genParams.model || 'nai-diffusion-4-5-full'
    if (model.includes('nai-diffusion-3')) {
      genParams.sm = sm
      genParams.sm_dyn = sm_dyn
    }
    if (model.includes('nai-diffusion-4')) {
      if (skip_cfg_above_sigma) {
        genParams.skip_cfg_above_sigma = 19
      }
    }

    if (vibe_group_ids && vibe_group_ids.length > 0) {
      try {
        const vibeStore = localforage.createInstance({ name: 'app_vibe_storage' })
        const vibeGroups = await vibeStore.getItem<any[]>('vibeGroups') || []
        const vibeImages = await vibeStore.getItem<any[]>('vibeImages') || []

        const refImages: string[] = []
        const refStrengths: number[] = []
        const refExtracteds: number[] = []

        for (const gid of vibe_group_ids) {
          const g = vibeGroups.find((vg: any) => vg.id === gid)
          if (g) {
            for (const item of g.items) {
              const img = vibeImages.find((vi: any) => vi.id === item.imageId)
              if (img) {
                refImages.push(img.base64)
                refStrengths.push(item.strength)
                refExtracteds.push(item.extracted)
              }
            }
          }
        }

        if (refImages.length > 0) {
          genParams.reference_image_multiple = refImages
          genParams.reference_strength_multiple = refStrengths
          genParams.reference_information_extracted_multiple = refExtracteds
        }
      } catch (e) {
        console.error('加载 Vibe 图片失败', e)
      }
    }

    const finalConfig = {
      apiKey: apiKey || localStorage.getItem('app_novelai_apikey') || '',
      baseUrl: baseUrl || localStorage.getItem('app_novelai_baseurl') || 'https://image.novelai.net',
      useStream: useStream !== false
    }

    generateImage(finalConfig, genParams)
      .then(async (base64Img: string) => {
        const msgToUpdate = chatToUpdate.messages.find((m: any) => m.id === baseMessageId)
        if (msgToUpdate) {
          msgToUpdate.isGeneratingImage = false
          msgToUpdate.content = '[图片]'
          
          const imageId = `nai_img_${Date.now()}_${Math.floor(Math.random()*1000)}`
          const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
          await imageStore.setItem(imageId, base64Img)
          msgToUpdate.imageData.imageId = imageId
          
          chatToUpdate.preview = '[发来图片/视频]'
          saveCustomContacts()
          if (isRoomActive && selectedChat.value && selectedChat.value.id === currentChatId) {
             await scrollToBottom()
          }
        }
      })
      .catch((err: any) => {
        const msgToUpdate = chatToUpdate.messages.find((m: any) => m.id === baseMessageId)
        if (msgToUpdate) {
          msgToUpdate.isGeneratingImage = false
          msgToUpdate.content = `[图片生成失败: ${err.message}]`
          saveCustomContacts()
        }
      })
  }

  return {
    handleAIImageGen
  }
}
