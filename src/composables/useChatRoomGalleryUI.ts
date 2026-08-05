/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, type Ref } from 'vue'
import localforage from 'localforage'
import { useNovelAI } from './useNovelAI'

export function useChatRoomGalleryUI(
  selectedChat: Ref<any>,
  isMultiSelectMode: Ref<boolean>,
  saveCustomContacts: () => void,
  showToast: (msg: string) => void
) {
  const showImageGalleryModal = ref(false)
  const galleryTargetMessage = ref<any>(null)

  const handleOpenGallery = (msg: any) => {
    if (isMultiSelectMode.value) return
    galleryTargetMessage.value = msg
    showImageGalleryModal.value = true
  }

  const handleGalleryRegenerate = async (prompt: string) => {
    if (!galleryTargetMessage.value || !selectedChat.value) return
    
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
