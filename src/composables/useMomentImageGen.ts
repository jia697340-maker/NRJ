/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { useNovelAI } from './useNovelAI'
import { useGptImage } from './useGptImage'
import { useGptImageReference } from './useGptImageReference'
import { useGeminiImage } from './useGeminiImage'
import { useGeminiImageReference } from './useGeminiImageReference'
import { useFluxImage } from './useFluxImage'
import { useFluxImageReference } from './useFluxImageReference'
import { sendChatMessage } from '../services/api'

// 朋友圈与聊天共用已有 NovelAI 接入；每次生成使用独立实例，避免影响聊天室中的生成状态。
export async function generateMomentImage(description: string, character: any): Promise<string> {
  if (character?.imageGenProvider === 'flux') {
    const fluxConfig = character?.fluxImageConfig || {}
    const apiKey = fluxConfig.apiKey || localStorage.getItem('app_flux_image_apikey') || ''
    if (!apiKey) throw new Error('未配置 Black Forest Labs 生图密钥')
    const { loadData, referenceGroups, getImagesForGroups } = useFluxImageReference()
    await loadData()
    const groupIds: string[] = fluxConfig.referenceGroupIds || []
    const instructions = referenceGroups.value
      .filter(group => groupIds.includes(group.id) && group.description?.trim())
      .map(group => `参考组“${group.name}”：${group.description.trim()}`)
    const prompt = [fluxConfig.promptPrefix, ...instructions, description.trim()].filter(Boolean).join('\n')
    const { generateImage } = useFluxImage()
    return generateImage({
      apiKey,
      proxyUrl: fluxConfig.proxyUrl || localStorage.getItem('app_flux_image_proxy_url') || 'https://clingy-flux-proxy.q89028615.workers.dev'
    }, {
      model: fluxConfig.model || localStorage.getItem('app_flux_image_model') || 'flux-2-pro-preview',
      prompt,
      width: fluxConfig.width || Number(localStorage.getItem('app_flux_image_width') || 1024),
      height: fluxConfig.height || Number(localStorage.getItem('app_flux_image_height') || 1536),
      outputFormat: fluxConfig.outputFormat || localStorage.getItem('app_flux_image_format') || 'png',
      safetyTolerance: fluxConfig.safetyTolerance ?? Number(localStorage.getItem('app_flux_image_safety') || 2),
      seed: fluxConfig.seed === '' || fluxConfig.seed === undefined ? null : Number(fluxConfig.seed),
      disablePromptUpsampling: fluxConfig.disablePromptUpsampling ?? localStorage.getItem('app_flux_image_disable_pup') === 'true',
      referenceImages: getImagesForGroups(groupIds).map(image => image.dataUrl)
    })
  }

  if (character?.imageGenProvider === 'gemini') {
    const geminiConfig = character?.geminiImageConfig || {}
    const transport = geminiConfig.transport || localStorage.getItem('app_gemini_image_transport') || 'official'
    const apiKey = geminiConfig.apiKey || localStorage.getItem('app_gemini_image_apikey') || ''
    if (!apiKey) throw new Error('未配置 Gemini 生图密钥')
    const { loadData, referenceGroups, getImagesForGroups } = useGeminiImageReference()
    await loadData()
    const groupIds: string[] = geminiConfig.referenceGroupIds || []
    const instructions = referenceGroups.value
      .filter(group => groupIds.includes(group.id))
      .map(group => `${group.kind === 'character' ? '角色一致性' : group.kind === 'style' ? '画风参考' : group.kind === 'scene' ? '场景参考' : '物体参考'}“${group.name}”：${group.description || '按该组图片进行参考'}。`)
    const prompt = [geminiConfig.promptPrefix, ...instructions, description.trim()].filter(Boolean).join('\n')
    const { generateImage } = useGeminiImage()
    return generateImage({
      apiKey,
      baseUrl: geminiConfig.baseUrl || localStorage.getItem('app_gemini_image_baseurl') || (transport === 'official' ? 'https://generativelanguage.googleapis.com' : 'https://openrouter.ai/api/v1'),
      transport
    }, {
      model: geminiConfig.model || localStorage.getItem('app_gemini_image_model') || (transport === 'official' ? 'gemini-3.1-flash-image' : 'google/gemini-3.1-flash-image'),
      prompt,
      aspectRatio: geminiConfig.aspectRatio || localStorage.getItem('app_gemini_image_aspect_ratio') || '2:3',
      imageSize: geminiConfig.imageSize || localStorage.getItem('app_gemini_image_size') || '1K',
      mimeType: geminiConfig.mimeType || localStorage.getItem('app_gemini_image_mime_type') || 'image/png',
      thinkingLevel: geminiConfig.thinkingLevel || localStorage.getItem('app_gemini_image_thinking_level') || 'minimal',
      useGoogleSearch: geminiConfig.useGoogleSearch ?? localStorage.getItem('app_gemini_image_google_search') === 'true',
      useImageSearch: geminiConfig.useImageSearch ?? localStorage.getItem('app_gemini_image_image_search') === 'true',
      referenceImages: getImagesForGroups(groupIds).map(image => image.dataUrl)
    })
  }

  if ((character?.imageGenProvider || 'novelai') === 'gpt') {
    const gptConfig = character?.gptImageConfig || {}
    const apiKey = gptConfig.apiKey || localStorage.getItem('app_gpt_image_apikey') || ''
    if (!apiKey) throw new Error('未配置 GPT 生图密钥')

    const { loadData, referenceGroups, getImagesForGroups } = useGptImageReference()
    await loadData()
    const groupIds: string[] = gptConfig.referenceGroupIds || []
    const groupInstructions = referenceGroups.value
      .filter(group => groupIds.includes(group.id) && group.description?.trim())
      .map(group => `参考组“${group.name}”的用途：${group.description.trim()}`)
    const prompt = [gptConfig.promptPrefix, ...groupInstructions, description.trim()].filter(Boolean).join('\n')
    const { generateImage } = useGptImage()
    return generateImage({
      apiKey,
      baseUrl: gptConfig.baseUrl || localStorage.getItem('app_gpt_image_baseurl') || 'https://api.openai.com/v1'
    }, {
      model: gptConfig.model || localStorage.getItem('app_gpt_image_model') || 'gpt-image-2',
      prompt,
      size: gptConfig.size || localStorage.getItem('app_gpt_image_size') || '1024x1536',
      quality: gptConfig.quality || localStorage.getItem('app_gpt_image_quality') || 'medium',
      output_format: gptConfig.outputFormat || localStorage.getItem('app_gpt_image_format') || 'png',
      output_compression: gptConfig.outputCompression ?? Number(localStorage.getItem('app_gpt_image_compression') || 90),
      moderation: gptConfig.moderation || localStorage.getItem('app_gpt_image_moderation') || 'auto',
      referenceImages: getImagesForGroups(groupIds).map(image => image.dataUrl)
    })
  }

  const naiConfig = character?.naiConfig || {}
  const apiKey = naiConfig.apiKey || localStorage.getItem('app_novelai_apikey') || ''
  if (!apiKey) throw new Error('未配置图像引擎密钥')

  let prompt = description.trim()
  try {
    const translated = await sendChatMessage([
      { role: 'system', content: 'Translate the scene into concise NovelAI Danbooru-style English tags. Output tags only.' },
      { role: 'user', content: prompt }
    ], undefined, false, true)
    prompt = (typeof translated === 'string' ? translated : translated.content).trim() || prompt
  } catch {
    // 支持直接将中文描述交给兼容的图像服务，翻译失败不阻断发帖。
  }

  prompt = [naiConfig.positivePrompt, naiConfig.vibeText, prompt].filter(Boolean).join(', ')
  const { generateImage } = useNovelAI()
  const image = await generateImage({
    apiKey,
    baseUrl: naiConfig.baseUrl || localStorage.getItem('app_novelai_baseurl') || 'https://image.novelai.net',
    useStream: naiConfig.useStream !== false
  }, {
    input: prompt,
    model: naiConfig.model || 'nai-diffusion-4-5-full',
    action: 'generate',
    width: naiConfig.width || 832,
    height: naiConfig.height || 1216,
    scale: naiConfig.scale || 5,
    sampler: naiConfig.sampler || 'k_euler_ancestral',
    steps: naiConfig.steps || 28,
    n_samples: 1,
    noise_schedule: naiConfig.noise_schedule || 'karras',
    negative_prompt: naiConfig.negativePrompt || ''
  })
  if (!image) throw new Error('图像引擎未返回图片')
  return image
}
