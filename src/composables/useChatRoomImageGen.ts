/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { sendChatMessage } from '../services/api'
import localforage from 'localforage'
import { useGptImageReference } from './useGptImageReference'
import { useGeminiImageReference } from './useGeminiImageReference'
import { useFluxImageReference } from './useFluxImageReference'

export function useChatRoomImageGen(
  selectedChat: any,
  myProfile: any,
  generateNovelImage: any,
  generateGptImage: any,
  generateGeminiImage: any,
  generateFluxImage: any,
  saveCustomContacts: (targetChat?: any) => void,
  scrollToBottom: () => Promise<void>
) {
  const handleAIImageGen = async (
    chatToUpdate: any,
    currentChatId: number,
    baseMessageId: number,
    actionContent: string,
    isRoomActive: boolean
  ) => {
    const provider = chatToUpdate.imageGenProvider || 'novelai'
    const naiConfig = chatToUpdate.naiConfig || {}
    const gptConfig = chatToUpdate.gptImageConfig || {}
    const geminiConfig = chatToUpdate.geminiImageConfig || {}
    const fluxConfig = chatToUpdate.fluxImageConfig || {}
    const vibeText = naiConfig.vibeText || ''
    const positivePrompt = naiConfig.positivePrompt || ''
    const visualProfile = naiConfig.visualProfile?.enabled ? naiConfig.visualProfile : null
    
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

    if (provider === 'flux') {
      let scenePrompt = actionContent.trim()
      if (fluxConfig.enableLlmAssist) {
        try {
          const contextSize = Math.min(50, Math.max(1, Number(fluxConfig.llmContextSize) || 12))
          const recentMessages = chatToUpdate.messages
            .filter((message: any) => message.type === 'left' || message.type === 'right')
            .slice(-contextSize)
            .map((message: any) => `${message.type === 'left' ? (chatToUpdate.name || '角色') : (myProfile.value.name || '用户')}：${message.content}`)
            .join('\n')
          const result = await sendChatMessage([
            {
              role: 'system',
              content: '你是 FLUX.2 的画面整理助手。根据角色设定、聊天上下文和本次要求，输出一段明确的中文自然语言生图描述，包含人物外貌、动作、场景、构图、镜头与光线。不要输出 JSON、标签、Negative Prompt 或解释。'
            },
            {
              role: 'user',
              content: `角色设定：${chatToUpdate.persona || '未设置'}\n\n最近聊天：\n${recentMessages}\n\n本次画面：${actionContent}`
            }
          ], undefined, false, true)
          scenePrompt = (typeof result === 'string' ? result : result.content).trim() || scenePrompt
        } catch (error) {
          console.warn('FLUX 生图画面整理失败，改用原始描述', error)
        }
      }

      const { loadData, referenceGroups, getImagesForGroups } = useFluxImageReference()
      await loadData()
      const groupIds: string[] = fluxConfig.referenceGroupIds || []
      const instructions = referenceGroups.value
        .filter(group => groupIds.includes(group.id) && group.description?.trim())
        .map(group => `参考组“${group.name}”：${group.description.trim()}`)
      const finalFluxPrompt = [fluxConfig.promptPrefix?.trim(), ...instructions, scenePrompt].filter(Boolean).join('\n')
      const references = getImagesForGroups(groupIds)
      const msgRef = chatToUpdate.messages.find((message: any) => message.id === baseMessageId)
      if (msgRef) {
        msgRef.content = '正在使用 FLUX.2 绘制图像...'
        msgRef.imageData.prompt = finalFluxPrompt
        msgRef.imageData.sourceText = actionContent
        msgRef.imageData.provider = 'flux'
        msgRef.imageData.referenceGroupIds = groupIds
      }

      try {
        const generatedImage = await generateFluxImage({
          apiKey: fluxConfig.apiKey || localStorage.getItem('app_flux_image_apikey') || '',
          proxyUrl: fluxConfig.proxyUrl || localStorage.getItem('app_flux_image_proxy_url') || 'https://clingy-flux-proxy.q89028615.workers.dev'
        }, {
          model: fluxConfig.model || localStorage.getItem('app_flux_image_model') || 'flux-2-pro-preview',
          prompt: finalFluxPrompt,
          width: fluxConfig.width || Number(localStorage.getItem('app_flux_image_width') || 1024),
          height: fluxConfig.height || Number(localStorage.getItem('app_flux_image_height') || 1536),
          outputFormat: fluxConfig.outputFormat || localStorage.getItem('app_flux_image_format') || 'png',
          safetyTolerance: fluxConfig.safetyTolerance ?? Number(localStorage.getItem('app_flux_image_safety') || 2),
          seed: fluxConfig.seed === '' || fluxConfig.seed === undefined
            ? (localStorage.getItem('app_flux_image_seed') || null)
            : Number(fluxConfig.seed),
          disablePromptUpsampling: fluxConfig.enableLlmAssist
            ? true
            : (fluxConfig.disablePromptUpsampling ?? localStorage.getItem('app_flux_image_disable_pup') === 'true'),
          referenceImages: references.map(image => image.dataUrl)
        })
        const message = chatToUpdate.messages.find((item: any) => item.id === baseMessageId)
        if (message) {
          message.isGeneratingImage = false
          message.content = '[图片]'
          const imageId = `flux_img_${Date.now()}_${Math.floor(Math.random() * 1000)}`
          const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
          await imageStore.setItem(imageId, generatedImage)
          message.imageData.imageId = imageId
          chatToUpdate.preview = '[发来图片/视频]'
          saveCustomContacts(chatToUpdate)
          if (isRoomActive && selectedChat.value?.id === currentChatId) await scrollToBottom()
        }
      } catch (error: any) {
        const message = chatToUpdate.messages.find((item: any) => item.id === baseMessageId)
        if (message) {
          message.isGeneratingImage = false
          message.content = `[FLUX 图片生成失败: ${error.message}]`
          saveCustomContacts(chatToUpdate)
        }
      }
      return
    }

    if (provider === 'gemini') {
      const { loadData, referenceGroups, getImagesForGroups } = useGeminiImageReference()
      await loadData()
      const groupIds: string[] = geminiConfig.referenceGroupIds || []
      const groupInstructions = referenceGroups.value
        .filter(group => groupIds.includes(group.id))
        .map(group => `${group.kind === 'character' ? '角色一致性' : group.kind === 'style' ? '画风参考' : group.kind === 'scene' ? '场景参考' : '物体参考'}“${group.name}”：${group.description || '按该组图片进行参考'}。`)
      const contextSize = Math.min(50, Math.max(1, Number(geminiConfig.contextSize) || 12))
      const recentMessages = geminiConfig.includeChatContext === false
        ? ''
        : chatToUpdate.messages
          .filter((message: any) => (message.type === 'left' || message.type === 'right') && message.id !== baseMessageId)
          .slice(-contextSize)
          .map((message: any) => `${message.type === 'left' ? (chatToUpdate.name || '角色') : (myProfile.value.name || '用户')}：${message.content}`)
          .join('\n')
      const finalGeminiPrompt = [
        geminiConfig.promptPrefix?.trim(),
        ...groupInstructions,
        recentMessages && `最近聊天上下文：\n${recentMessages}`,
        `本次需要绘制的画面：${actionContent.trim()}`
      ].filter(Boolean).join('\n\n')
      const references = getImagesForGroups(groupIds)
      const msgRef = chatToUpdate.messages.find((message: any) => message.id === baseMessageId)
      if (msgRef) {
        msgRef.content = '正在使用 Gemini 绘制图像...'
        msgRef.imageData.prompt = finalGeminiPrompt
        msgRef.imageData.sourceText = actionContent
        msgRef.imageData.provider = 'gemini'
        msgRef.imageData.referenceGroupIds = groupIds
      }

      try {
        const transport = geminiConfig.transport || localStorage.getItem('app_gemini_image_transport') || 'official'
        const generatedImage = await generateGeminiImage({
          apiKey: geminiConfig.apiKey || localStorage.getItem('app_gemini_image_apikey') || '',
          baseUrl: geminiConfig.baseUrl || localStorage.getItem('app_gemini_image_baseurl') || (transport === 'official' ? 'https://generativelanguage.googleapis.com' : 'https://openrouter.ai/api/v1'),
          transport
        }, {
          model: geminiConfig.model || localStorage.getItem('app_gemini_image_model') || (transport === 'official' ? 'gemini-3.1-flash-image' : 'google/gemini-3.1-flash-image'),
          prompt: finalGeminiPrompt,
          aspectRatio: geminiConfig.aspectRatio || localStorage.getItem('app_gemini_image_aspect_ratio') || '2:3',
          imageSize: geminiConfig.imageSize || localStorage.getItem('app_gemini_image_size') || '1K',
          mimeType: geminiConfig.mimeType || localStorage.getItem('app_gemini_image_mime_type') || 'image/png',
          thinkingLevel: geminiConfig.thinkingLevel || localStorage.getItem('app_gemini_image_thinking_level') || 'minimal',
          useGoogleSearch: geminiConfig.useGoogleSearch ?? localStorage.getItem('app_gemini_image_google_search') === 'true',
          useImageSearch: geminiConfig.useImageSearch ?? localStorage.getItem('app_gemini_image_image_search') === 'true',
          referenceImages: references.map(image => image.dataUrl)
        })
        const message = chatToUpdate.messages.find((item: any) => item.id === baseMessageId)
        if (message) {
          message.isGeneratingImage = false
          message.content = '[图片]'
          const imageId = `gemini_img_${Date.now()}_${Math.floor(Math.random() * 1000)}`
          const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
          await imageStore.setItem(imageId, generatedImage)
          message.imageData.imageId = imageId
          chatToUpdate.preview = '[发来图片/视频]'
          saveCustomContacts(chatToUpdate)
          if (isRoomActive && selectedChat.value?.id === currentChatId) await scrollToBottom()
        }
      } catch (error: any) {
        const message = chatToUpdate.messages.find((item: any) => item.id === baseMessageId)
        if (message) {
          message.isGeneratingImage = false
          message.content = `[Gemini 图片生成失败: ${error.message}]`
          saveCustomContacts(chatToUpdate)
        }
      }
      return
    }

    if (provider === 'gpt') {
      let gptPrompt = actionContent.trim()
      if (gptConfig.enableLlmAssist) {
        try {
          const contextSize = Math.min(50, Math.max(1, Number(gptConfig.llmContextSize) || 12))
          const recentMessages = chatToUpdate.messages
            .filter((message: any) => message.type === 'left' || message.type === 'right')
            .slice(-contextSize)
            .map((message: any) => `${message.type === 'left' ? (chatToUpdate.name || '角色') : (myProfile.value.name || '用户')}：${message.content}`)
            .join('\n')
          const result = await sendChatMessage([
            {
              role: 'system',
              content: '你是 GPT Image 2 的画面整理助手。根据角色设定、聊天上下文和本次画面要求，输出一段完整、明确的中文自然语言生图描述。写清人物外貌、动作、场景、构图、镜头和光线。不要输出 JSON、标签列表、Negative Prompt 或解释。'
            },
            {
              role: 'user',
              content: `角色设定：${chatToUpdate.persona || '未设置'}\n\n最近聊天：\n${recentMessages}\n\n本次画面：${actionContent}`
            }
          ], undefined, false, true)
          gptPrompt = (typeof result === 'string' ? result : result.content).trim() || gptPrompt
        } catch (error) {
          console.warn('GPT 生图画面整理失败，改用原始描述', error)
        }
      }

      const { loadData, referenceGroups, getImagesForGroups } = useGptImageReference()
      await loadData()
      const groupIds: string[] = gptConfig.referenceGroupIds || []
      const selectedGroups = referenceGroups.value.filter(group => groupIds.includes(group.id))
      const groupInstructions = selectedGroups
        .filter(group => group.description?.trim())
        .map(group => `参考组“${group.name}”的用途：${group.description.trim()}`)
      const finalGptPrompt = [
        gptConfig.promptPrefix?.trim(),
        ...groupInstructions,
        gptPrompt
      ].filter(Boolean).join('\n')
      const references = getImagesForGroups(groupIds)

      const msgRef = chatToUpdate.messages.find((message: any) => message.id === baseMessageId)
      if (msgRef) {
        msgRef.content = '正在使用 GPT Image 2 绘制图像...'
        msgRef.imageData.prompt = finalGptPrompt
        msgRef.imageData.sourceText = actionContent
        msgRef.imageData.provider = 'gpt'
        msgRef.imageData.referenceGroupIds = groupIds
      }

      try {
        const generatedImage = await generateGptImage({
          apiKey: gptConfig.apiKey || localStorage.getItem('app_gpt_image_apikey') || '',
          baseUrl: gptConfig.baseUrl || localStorage.getItem('app_gpt_image_baseurl') || 'https://api.openai.com/v1'
        }, {
          model: gptConfig.model || localStorage.getItem('app_gpt_image_model') || 'gpt-image-2',
          prompt: finalGptPrompt,
          size: gptConfig.size || localStorage.getItem('app_gpt_image_size') || '1024x1536',
          quality: gptConfig.quality || localStorage.getItem('app_gpt_image_quality') || 'medium',
          output_format: gptConfig.outputFormat || localStorage.getItem('app_gpt_image_format') || 'png',
          output_compression: gptConfig.outputCompression ?? Number(localStorage.getItem('app_gpt_image_compression') || 90),
          moderation: gptConfig.moderation || localStorage.getItem('app_gpt_image_moderation') || 'auto',
          referenceImages: references.map(image => image.dataUrl)
        })

        const message = chatToUpdate.messages.find((item: any) => item.id === baseMessageId)
        if (message) {
          message.isGeneratingImage = false
          message.content = '[图片]'
          const imageId = `gpt_img_${Date.now()}_${Math.floor(Math.random() * 1000)}`
          const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
          await imageStore.setItem(imageId, generatedImage)
          message.imageData.imageId = imageId
          chatToUpdate.preview = '[发来图片/视频]'
          saveCustomContacts(chatToUpdate)
          if (isRoomActive && selectedChat.value?.id === currentChatId) await scrollToBottom()
        }
      } catch (error: any) {
        const message = chatToUpdate.messages.find((item: any) => item.id === baseMessageId)
        if (message) {
          message.isGeneratingImage = false
          message.content = `[GPT 图片生成失败: ${error.message}]`
          saveCustomContacts(chatToUpdate)
        }
      }
      return
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
        const llmUserPrompt = `[最近的聊天记录上下文]\n${recentMsgs}\n\n[本次生图的动作/画面描述]\n${actionContent}\n\n只输出严格 JSON，不要 Markdown：{"scene_zh":"不超过80字的中文画面理解","positive_en":"逗号分隔的英文 NovelAI tags","negative_en":"逗号分隔的英文 negative tags"}`

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

        const jsonText = llmReply.match(/\{[\s\S]*\}/)?.[0]
        if (jsonText) {
          const parsed = JSON.parse(jsonText)
          finalPrompt = String(parsed.positive_en || '').trim()
          dynamicNegativePrompt = String(parsed.negative_en || '').trim()
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
    if (visualProfile?.promptEn) {
      finalPrompt = [visualProfile.promptEn, finalPrompt].filter(Boolean).join(', ')
    }
    if (vibeText) {
      finalPrompt = [vibeText, finalPrompt].filter(Boolean).join(', ')
    }
    
    let finalNegative = naiConfig.negativePrompt || ''
    if (dynamicNegativePrompt) {
      finalNegative = [finalNegative, dynamicNegativePrompt].filter(Boolean).join(', ')
    }
    if (visualProfile?.negativeEn) {
      finalNegative = [finalNegative, visualProfile.negativeEn].filter(Boolean).join(', ')
    }

    const msgRef = chatToUpdate.messages.find((m: any) => m.id === baseMessageId)
    if (msgRef) {
      msgRef.content = '正在绘制图像...'
      msgRef.imageData.prompt = finalPrompt
      msgRef.imageData.negativePrompt = finalNegative
      msgRef.imageData.sourceText = actionContent
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

    generateNovelImage(finalConfig, genParams)
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
          saveCustomContacts(chatToUpdate)
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
          saveCustomContacts(chatToUpdate)
        }
      })
  }

  return {
    handleAIImageGen
  }
}
