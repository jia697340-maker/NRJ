/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, type Ref } from 'vue'
import localforage from 'localforage'
import { useNovelAI } from './useNovelAI'
import { useGptImage } from './useGptImage'
import { useGptImageReference } from './useGptImageReference'
import { useGeminiImage } from './useGeminiImage'
import { useGeminiImageReference } from './useGeminiImageReference'
import { useFluxImage } from './useFluxImage'
import { useFluxImageReference } from './useFluxImageReference'
import { useNijiImage } from './useNijiImage'
import { useSeedreamImage } from './useSeedreamImage'
import { useSeedreamImageReference } from './useSeedreamImageReference'

export function useChatRoomGalleryUI(
  selectedChat: Ref<any>,
  isMultiSelectMode: Ref<boolean>,
  saveCustomContacts: () => void,
  showToast: (msg: string) => void
) {
  const showImageGalleryModal = ref(false)
  const galleryTargetMessage = ref<any>(null)

  const handleOpenGallery = async (msg: any) => {
    if (isMultiSelectMode.value) return
    const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
    const historyItems = msg?.imageData?.history || []
    for (const item of historyItems) {
      if (!item.imageId) continue
      const storedImage = await imageStore.getItem<string>(item.imageId)
      if (!storedImage) continue
      try {
        item.url = URL.createObjectURL(await (await fetch(storedImage)).blob())
      } catch {
        item.url = storedImage
      }
    }
    galleryTargetMessage.value = msg
    showImageGalleryModal.value = true
  }

  const handleGalleryRegenerate = async (prompt: string) => {
    if (!galleryTargetMessage.value || !selectedChat.value) return

    const storedProvider = galleryTargetMessage.value.imageData?.provider
      || (String(galleryTargetMessage.value.imageData?.imageId || '').startsWith('gemini_img_') ? 'gemini' : '')
      || (String(galleryTargetMessage.value.imageData?.imageId || '').startsWith('gpt_img_') ? 'gpt' : '')
      || (String(galleryTargetMessage.value.imageData?.imageId || '').startsWith('flux_img_') ? 'flux' : '')
      || (String(galleryTargetMessage.value.imageData?.imageId || '').startsWith('niji_img_') ? 'niji' : '')
      || (String(galleryTargetMessage.value.imageData?.imageId || '').startsWith('seedream_img_') ? 'seedream' : '')
      || (String(galleryTargetMessage.value.imageData?.imageId || '').startsWith('nai_img_') ? 'novelai' : '')
    const provider = storedProvider || selectedChat.value.imageGenProvider || 'novelai'
    if (provider === 'seedream') {
      const seedreamConfig = selectedChat.value.seedreamImageConfig || {}
      showToast('正在使用 Seedream 5.0 重新生成...')
      try {
        const { loadData, referenceGroups, getImagesForGroups } = useSeedreamImageReference()
        await loadData()
        const groupIds: string[] = seedreamConfig.referenceGroupIds || []
        const instructions = referenceGroups.value
          .filter(group => groupIds.includes(group.id) && group.description?.trim())
          .map(group => `参考组“${group.name}”：${group.description.trim()}`)
        const finalPrompt = [seedreamConfig.promptPrefix, ...instructions, prompt].filter(Boolean).join('\n')
        const { generateImage } = useSeedreamImage()
        const image = await generateImage({
          apiKey: seedreamConfig.apiKey || localStorage.getItem('app_seedream_image_apikey') || '',
          baseUrl: seedreamConfig.baseUrl || localStorage.getItem('app_seedream_image_baseurl') || 'https://ark.cn-beijing.volces.com/api/v3'
        }, {
          model: seedreamConfig.model || localStorage.getItem('app_seedream_image_model') || 'doubao-seedream-5-0-lite-260128',
          prompt: finalPrompt,
          size: seedreamConfig.size || localStorage.getItem('app_seedream_image_size') || '2K',
          outputFormat: seedreamConfig.outputFormat || localStorage.getItem('app_seedream_image_format') || 'png',
          watermark: seedreamConfig.watermark ?? localStorage.getItem('app_seedream_image_watermark') === 'true',
          seed: seedreamConfig.seed === '' || seedreamConfig.seed === undefined ? null : Number(seedreamConfig.seed),
          referenceImages: getImagesForGroups(groupIds).map(item => item.dataUrl)
        })
        const imageId = `seedream_img_${Date.now()}_${Math.floor(Math.random() * 1000)}`
        const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
        await imageStore.setItem(imageId, image)
        const localUrl = URL.createObjectURL(await (await fetch(image)).blob())
        if (!galleryTargetMessage.value.imageData.history) {
          galleryTargetMessage.value.imageData.history = []
          if (galleryTargetMessage.value.imageData.imageId) {
            galleryTargetMessage.value.imageData.history.push({
              imageId: galleryTargetMessage.value.imageData.imageId,
              prompt: galleryTargetMessage.value.imageData.prompt || '',
              url: galleryTargetMessage.value._localImageUrl || localUrl,
              provider: 'seedream'
            })
          }
        }
        galleryTargetMessage.value.imageData.history.push({ imageId, prompt, url: localUrl, provider: 'seedream' })
        galleryTargetMessage.value.imageData.imageId = imageId
        galleryTargetMessage.value.imageData.prompt = finalPrompt
        galleryTargetMessage.value.imageData.provider = 'seedream'
        galleryTargetMessage.value._localImageUrl = localUrl
        saveCustomContacts()
        showToast('Seedream 重新生成成功！')
      } catch (error: any) {
        showToast(`Seedream 生成失败: ${error.message}`)
      }
      return
    }
    if (provider === 'niji') {
      const nijiConfig = selectedChat.value.nijiImageConfig || {}
      showToast('正在使用 Niji 7 重新生成...')
      try {
        const finalPrompt = [nijiConfig.promptPrefix, prompt].filter(Boolean).join('\n')
        const { generateImage } = useNijiImage()
        const image = await generateImage({
          apiKey: nijiConfig.apiKey || localStorage.getItem('app_niji_image_apikey') || '',
          baseUrl: nijiConfig.baseUrl || localStorage.getItem('app_niji_image_baseurl') || '',
          protocol: nijiConfig.protocol || localStorage.getItem('app_niji_image_protocol') || 'proxy',
          pollInterval: nijiConfig.pollInterval || Number(localStorage.getItem('app_niji_image_poll_interval') || 3000),
          timeout: nijiConfig.timeout || Number(localStorage.getItem('app_niji_image_timeout') || 600000)
        }, {
          prompt: finalPrompt,
          speedMode: nijiConfig.speedMode || localStorage.getItem('app_niji_image_speed') || 'fast',
          aspectRatio: nijiConfig.aspectRatio || localStorage.getItem('app_niji_image_aspect_ratio') || '2:3',
          stylize: nijiConfig.stylize ?? Number(localStorage.getItem('app_niji_image_stylize') || 100),
          chaos: nijiConfig.chaos ?? Number(localStorage.getItem('app_niji_image_chaos') || 0),
          weird: nijiConfig.weird ?? Number(localStorage.getItem('app_niji_image_weird') || 0),
          seed: nijiConfig.seed === '' || nijiConfig.seed === undefined ? null : Number(nijiConfig.seed),
          raw: nijiConfig.raw ?? localStorage.getItem('app_niji_image_raw') === 'true',
          styleReference: nijiConfig.styleReference || localStorage.getItem('app_niji_image_sref') || '',
          styleWeight: nijiConfig.styleWeight ?? Number(localStorage.getItem('app_niji_image_sw') || 100),
          imagePromptUrl: nijiConfig.imagePromptUrl || localStorage.getItem('app_niji_image_reference_url') || '',
          imageWeight: nijiConfig.imageWeight ?? Number(localStorage.getItem('app_niji_image_iw') || 1)
        })
        const imageId = `niji_img_${Date.now()}_${Math.floor(Math.random() * 1000)}`
        const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
        await imageStore.setItem(imageId, image)
        let localUrl = image
        try { localUrl = URL.createObjectURL(await (await fetch(image)).blob()) } catch { /* 保留远程地址 */ }
        if (!galleryTargetMessage.value.imageData.history) galleryTargetMessage.value.imageData.history = []
        galleryTargetMessage.value.imageData.history.push({ imageId, prompt, url: localUrl, provider: 'niji' })
        galleryTargetMessage.value.imageData.imageId = imageId
        galleryTargetMessage.value.imageData.prompt = finalPrompt
        galleryTargetMessage.value.imageData.provider = 'niji'
        galleryTargetMessage.value._localImageUrl = localUrl
        saveCustomContacts()
        showToast('Niji 重新生成成功！')
      } catch (error: any) {
        showToast(`Niji 生成失败: ${error.message}`)
      }
      return
    }
    if (provider === 'flux') {
      const fluxConfig = selectedChat.value.fluxImageConfig || {}
      showToast('正在使用 FLUX.2 重新生成...')
      try {
        const { loadData, referenceGroups, getImagesForGroups } = useFluxImageReference()
        await loadData()
        const groupIds: string[] = fluxConfig.referenceGroupIds || []
        const instructions = referenceGroups.value
          .filter(group => groupIds.includes(group.id) && group.description?.trim())
          .map(group => `参考组“${group.name}”：${group.description.trim()}`)
        const finalPrompt = [fluxConfig.promptPrefix, ...instructions, prompt].filter(Boolean).join('\n')
        const { generateImage } = useFluxImage()
        const image = await generateImage({
          apiKey: fluxConfig.apiKey || localStorage.getItem('app_flux_image_apikey') || '',
          proxyUrl: fluxConfig.proxyUrl || localStorage.getItem('app_flux_image_proxy_url') || 'https://clingy-flux-proxy.q89028615.workers.dev'
        }, {
          model: fluxConfig.model || localStorage.getItem('app_flux_image_model') || 'flux-2-pro-preview',
          prompt: finalPrompt,
          width: fluxConfig.width || Number(localStorage.getItem('app_flux_image_width') || 1024),
          height: fluxConfig.height || Number(localStorage.getItem('app_flux_image_height') || 1536),
          outputFormat: fluxConfig.outputFormat || localStorage.getItem('app_flux_image_format') || 'png',
          safetyTolerance: fluxConfig.safetyTolerance ?? Number(localStorage.getItem('app_flux_image_safety') || 2),
          seed: fluxConfig.seed === '' || fluxConfig.seed === undefined ? null : Number(fluxConfig.seed),
          disablePromptUpsampling: fluxConfig.disablePromptUpsampling ?? localStorage.getItem('app_flux_image_disable_pup') === 'true',
          referenceImages: getImagesForGroups(groupIds).map(item => item.dataUrl)
        })
        const imageId = `flux_img_${Date.now()}_${Math.floor(Math.random() * 1000)}`
        const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
        await imageStore.setItem(imageId, image)
        const localUrl = URL.createObjectURL(await (await fetch(image)).blob())
        if (!galleryTargetMessage.value.imageData.history) {
          galleryTargetMessage.value.imageData.history = []
          if (galleryTargetMessage.value.imageData.imageId) {
            galleryTargetMessage.value.imageData.history.push({
              imageId: galleryTargetMessage.value.imageData.imageId,
              prompt: galleryTargetMessage.value.imageData.prompt || '',
              url: galleryTargetMessage.value._localImageUrl || localUrl,
              provider: 'flux'
            })
          }
        }
        galleryTargetMessage.value.imageData.history.push({ imageId, prompt, url: localUrl, provider: 'flux' })
        galleryTargetMessage.value.imageData.imageId = imageId
        galleryTargetMessage.value.imageData.prompt = finalPrompt
        galleryTargetMessage.value.imageData.provider = 'flux'
        galleryTargetMessage.value._localImageUrl = localUrl
        saveCustomContacts()
        showToast('FLUX 重新生成成功！')
      } catch (error: any) {
        showToast(`FLUX 生成失败: ${error.message}`)
      }
      return
    }
    if (provider === 'gemini') {
      const geminiConfig = selectedChat.value.geminiImageConfig || {}
      showToast('正在使用 Gemini 重新生成...')
      try {
        const transport = geminiConfig.transport || localStorage.getItem('app_gemini_image_transport') || 'official'
        const { loadData, referenceGroups, getImagesForGroups } = useGeminiImageReference()
        await loadData()
        const groupIds: string[] = geminiConfig.referenceGroupIds || []
        const instructions = referenceGroups.value
          .filter(group => groupIds.includes(group.id))
          .map(group => `${group.kind === 'character' ? '角色一致性' : group.kind === 'style' ? '画风参考' : group.kind === 'scene' ? '场景参考' : '物体参考'}“${group.name}”：${group.description || '按该组图片进行参考'}。`)
        const finalPrompt = [geminiConfig.promptPrefix, ...instructions, prompt].filter(Boolean).join('\n')
        const { generateImage } = useGeminiImage()
        const image = await generateImage({
          apiKey: geminiConfig.apiKey || localStorage.getItem('app_gemini_image_apikey') || '',
          baseUrl: geminiConfig.baseUrl || localStorage.getItem('app_gemini_image_baseurl') || (transport === 'official' ? 'https://generativelanguage.googleapis.com' : 'https://openrouter.ai/api/v1'),
          transport
        }, {
          model: geminiConfig.model || localStorage.getItem('app_gemini_image_model') || (transport === 'official' ? 'gemini-3.1-flash-image' : 'google/gemini-3.1-flash-image'),
          prompt: finalPrompt,
          aspectRatio: geminiConfig.aspectRatio || localStorage.getItem('app_gemini_image_aspect_ratio') || '2:3',
          imageSize: geminiConfig.imageSize || localStorage.getItem('app_gemini_image_size') || '1K',
          mimeType: geminiConfig.mimeType || localStorage.getItem('app_gemini_image_mime_type') || 'image/png',
          thinkingLevel: geminiConfig.thinkingLevel || localStorage.getItem('app_gemini_image_thinking_level') || 'minimal',
          useGoogleSearch: geminiConfig.useGoogleSearch ?? localStorage.getItem('app_gemini_image_google_search') === 'true',
          useImageSearch: geminiConfig.useImageSearch ?? localStorage.getItem('app_gemini_image_image_search') === 'true',
          referenceImages: getImagesForGroups(groupIds).map(item => item.dataUrl)
        })
        const imageId = `gemini_img_${Date.now()}_${Math.floor(Math.random() * 1000)}`
        const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
        await imageStore.setItem(imageId, image)
        const localUrl = URL.createObjectURL(await (await fetch(image)).blob())
        if (!galleryTargetMessage.value.imageData.history) {
          galleryTargetMessage.value.imageData.history = []
          if (galleryTargetMessage.value.imageData.imageId) {
            galleryTargetMessage.value.imageData.history.push({
              imageId: galleryTargetMessage.value.imageData.imageId,
              prompt: galleryTargetMessage.value.imageData.prompt || '',
              url: galleryTargetMessage.value._localImageUrl || localUrl,
              provider: 'gemini'
            })
          }
        }
        galleryTargetMessage.value.imageData.history.push({ imageId, prompt, url: localUrl, provider: 'gemini' })
        galleryTargetMessage.value.imageData.imageId = imageId
        galleryTargetMessage.value.imageData.prompt = finalPrompt
        galleryTargetMessage.value.imageData.provider = 'gemini'
        galleryTargetMessage.value._localImageUrl = localUrl
        saveCustomContacts()
        showToast('Gemini 重新生成成功！')
      } catch (error: any) {
        showToast(`Gemini 生成失败: ${error.message}`)
      }
      return
    }
    if (provider === 'gpt') {
      const gptConfig = selectedChat.value.gptImageConfig || {}
      showToast('正在使用 GPT Image 2 重新生成...')
      try {
        const { loadData, referenceGroups, getImagesForGroups } = useGptImageReference()
        await loadData()
        const groupIds: string[] = gptConfig.referenceGroupIds || []
        const instructions = referenceGroups.value
          .filter(group => groupIds.includes(group.id) && group.description?.trim())
          .map(group => `参考组“${group.name}”的用途：${group.description.trim()}`)
        const finalPrompt = [gptConfig.promptPrefix, ...instructions, prompt].filter(Boolean).join('\n')
        const { generateImage } = useGptImage()
        const image = await generateImage({
          apiKey: gptConfig.apiKey || localStorage.getItem('app_gpt_image_apikey') || '',
          baseUrl: gptConfig.baseUrl || localStorage.getItem('app_gpt_image_baseurl') || 'https://api.openai.com/v1'
        }, {
          model: gptConfig.model || localStorage.getItem('app_gpt_image_model') || 'gpt-image-2',
          prompt: finalPrompt,
          size: gptConfig.size || localStorage.getItem('app_gpt_image_size') || '1024x1536',
          quality: gptConfig.quality || localStorage.getItem('app_gpt_image_quality') || 'medium',
          output_format: gptConfig.outputFormat || localStorage.getItem('app_gpt_image_format') || 'png',
          output_compression: gptConfig.outputCompression ?? Number(localStorage.getItem('app_gpt_image_compression') || 90),
          moderation: gptConfig.moderation || localStorage.getItem('app_gpt_image_moderation') || 'auto',
          referenceImages: getImagesForGroups(groupIds).map(item => item.dataUrl)
        })

        const imageId = `gpt_img_${Date.now()}_${Math.floor(Math.random() * 1000)}`
        const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
        await imageStore.setItem(imageId, image)
        const response = await fetch(image)
        const localUrl = URL.createObjectURL(await response.blob())

        if (!galleryTargetMessage.value.imageData.history) {
          galleryTargetMessage.value.imageData.history = []
          if (galleryTargetMessage.value.imageData.imageId) {
            galleryTargetMessage.value.imageData.history.push({
              imageId: galleryTargetMessage.value.imageData.imageId,
              prompt: galleryTargetMessage.value.imageData.prompt || '',
              url: galleryTargetMessage.value._localImageUrl || localUrl
            })
          }
        }
        galleryTargetMessage.value.imageData.history.push({ imageId, prompt, url: localUrl, provider: 'gpt' })
        galleryTargetMessage.value.imageData.imageId = imageId
        galleryTargetMessage.value.imageData.prompt = finalPrompt
        galleryTargetMessage.value.imageData.provider = 'gpt'
        galleryTargetMessage.value._localImageUrl = localUrl
        saveCustomContacts()
        showToast('GPT 重新生成成功！')
      } catch (error: any) {
        showToast(`GPT 生成失败: ${error.message}`)
      }
      return
    }
    
    const naiConfig = selectedChat.value.naiConfig || {}
    const { negativePrompt, presetId, apiKey, baseUrl, useStream, vibe_group_ids, seed, sm, sm_dyn, skip_cfg_above_sigma, ...restConfig } = naiConfig
    delete restConfig.vibeText
    delete restConfig.positivePrompt
    
    const genParams: any = {
      ...restConfig,
      input: prompt
    }
    
    if (genParams.n_samples === undefined) {
      genParams.n_samples = 1
    }
    if (genParams.action === undefined) {
      genParams.action = 'generate'
    }
    if (negativePrompt) {
      genParams.negative_prompt = negativePrompt
    }
    if (seed) {
      genParams.seed = parseInt(seed as string)
    }

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
        const vibeGroupsRaw = localStorage.getItem('app_novelai_vibe_groups')
        const vibeImagesRaw = localStorage.getItem('app_novelai_vibe_images')
        const vibeGroups = vibeGroupsRaw ? JSON.parse(vibeGroupsRaw) : []
        const vibeImages = vibeImagesRaw ? JSON.parse(vibeImagesRaw) : []

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
      apiKey: (apiKey as string) || localStorage.getItem('app_novelai_apikey') || '',
      baseUrl: (baseUrl as string) || localStorage.getItem('app_novelai_baseurl') || 'https://image.novelai.net',
      useStream: useStream !== false
    }

    showToast('正在重新生成...')
    const { generateImage } = useNovelAI()
    
    try {
      const base64Img = await generateImage(finalConfig, genParams)
      if (!base64Img) {
        throw new Error('未获取到图片数据')
      }
      const imageId = `nai_img_${Date.now()}_${Math.floor(Math.random()*1000)}`
      const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
      await imageStore.setItem(imageId, base64Img)
      
      const byteCharacters = window.atob(base64Img)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/png' })
      const localUrl = URL.createObjectURL(blob)

      if (!galleryTargetMessage.value.imageData.history) {
        galleryTargetMessage.value.imageData.history = []
        if (galleryTargetMessage.value.imageData.imageId) {
           galleryTargetMessage.value.imageData.history.push({
             imageId: galleryTargetMessage.value.imageData.imageId,
             prompt: galleryTargetMessage.value.imageData.prompt || '',
             url: galleryTargetMessage.value._localImageUrl || localUrl
           })
        }
      }
      
      galleryTargetMessage.value.imageData.history.push({
        imageId: imageId,
        prompt: prompt,
        url: localUrl
      })

      galleryTargetMessage.value.imageData.imageId = imageId
      galleryTargetMessage.value._localImageUrl = localUrl
      
      saveCustomContacts()
      showToast('重新生成成功！')
    } catch (err: any) {
      showToast(`生成失败: ${err.message}`)
    }
  }

  const handleGalleryDelete = (index: number) => {
    if (galleryTargetMessage.value && galleryTargetMessage.value.imageData && galleryTargetMessage.value.imageData.history) {
      galleryTargetMessage.value.imageData.history.splice(index, 1)
      if (galleryTargetMessage.value.imageData.history.length === 0) {
        showImageGalleryModal.value = false
      }
      saveCustomContacts()
    }
  }

  return {
    showImageGalleryModal,
    galleryTargetMessage,
    handleOpenGallery,
    handleGalleryRegenerate,
    handleGalleryDelete
  }
}
