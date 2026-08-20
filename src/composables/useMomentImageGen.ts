/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
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
import { usePollinationsImage } from './usePollinationsImage'
import { useAiHordeImage } from './useAiHordeImage'
import { sendChatMessage } from '../services/api'
import { resolveIdentityContext } from '../services/identityProfile'

// 朋友圈与聊天共用已有 NovelAI 接入；每次生成使用独立实例，避免影响聊天室中的生成状态。
export async function generateMomentImage(description: string, character: any): Promise<string> {
  const provider = character?.imageGenProvider || 'novelai'
  const identity = await resolveIdentityContext('character', String(character?.characterEntityId || character?.id), provider === 'seedream' ? 10 : 8)
  if (provider === 'pollinations') {
    const config = character?.pollinationsImageConfig || {}
    const apiKey = config.apiKey || localStorage.getItem('app_pollinations_image_apikey') || ''
    if (!apiKey) throw new Error('未配置 Pollinations API Key 或 BYOP 授权')
    const prompt = [config.promptPrefix, identity.prompt, description.trim()].filter(Boolean).join('\n')
    const { generateImage } = usePollinationsImage()
    return generateImage({ apiKey, baseUrl: config.baseUrl || localStorage.getItem('app_pollinations_image_baseurl') || 'https://gen.pollinations.ai/v1' }, {
      model: config.model || localStorage.getItem('app_pollinations_image_model') || 'zimage',
      prompt,
      size: config.size || localStorage.getItem('app_pollinations_image_size') || '1024x1024',
      quality: config.quality || localStorage.getItem('app_pollinations_image_quality') || 'medium',
      safe: config.safe || localStorage.getItem('app_pollinations_image_safe') || 'privacy,secrets,sexual,violence',
      referenceImages: config.useIdentityReferences === false ? [] : identity.referenceImages.slice(0, 8)
    })
  }

  if (provider === 'aihorde') {
    const config = character?.aiHordeImageConfig || {}
    if (!config.privacyAcknowledged) throw new Error('请先确认 AI Horde 分布式隐私风险')
    const prompt = [config.promptPrefix, identity.prompt, description.trim()].filter(Boolean).join('\n')
    const { generateImage } = useAiHordeImage()
    return generateImage({
      apiKey: config.apiKey || localStorage.getItem('app_ai_horde_image_apikey') || '',
      baseUrl: config.baseUrl || localStorage.getItem('app_ai_horde_image_baseurl') || 'https://aihorde.net/api/v2'
    }, {
      prompt, negativePrompt: config.negativePrompt || '', model: config.model || localStorage.getItem('app_ai_horde_image_model') || '',
      width: config.width || Number(localStorage.getItem('app_ai_horde_image_width') || 768), height: config.height || Number(localStorage.getItem('app_ai_horde_image_height') || 1024),
      steps: config.steps || Number(localStorage.getItem('app_ai_horde_image_steps') || 24), cfgScale: config.cfgScale || Number(localStorage.getItem('app_ai_horde_image_cfg_scale') || 7),
      sampler: config.sampler || localStorage.getItem('app_ai_horde_image_sampler') || 'k_euler_a', seed: config.seed ?? '', timeout: config.timeout || 600000,
      trustedWorkers: config.trustedWorkers !== false, validatedBackends: config.validatedBackends !== false, censorNsfw: config.censorNsfw !== false
    })
  }
  if (character?.imageGenProvider === 'seedream') {
    const seedreamConfig = character?.seedreamImageConfig || {}
    const apiKey = seedreamConfig.apiKey || localStorage.getItem('app_seedream_image_apikey') || ''
    if (!apiKey) throw new Error('未配置火山方舟 Seedream API Key')
    const { loadData, referenceGroups, getImagesForGroups } = useSeedreamImageReference()
    await loadData()
    const groupIds: string[] = seedreamConfig.referenceGroupIds || []
    const instructions = referenceGroups.value
      .filter(group => groupIds.includes(group.id) && group.description?.trim())
      .map(group => `参考组“${group.name}”：${group.description.trim()}`)
    const prompt = [seedreamConfig.promptPrefix, ...instructions, identity.prompt, description.trim()].filter(Boolean).join('\n')
    const { generateImage } = useSeedreamImage()
    return generateImage({
      apiKey,
      baseUrl: seedreamConfig.baseUrl || localStorage.getItem('app_seedream_image_baseurl') || 'https://ark.cn-beijing.volces.com/api/v3'
    }, {
      model: seedreamConfig.model || localStorage.getItem('app_seedream_image_model') || 'doubao-seedream-5-0-lite-260128',
      prompt,
      size: seedreamConfig.size || localStorage.getItem('app_seedream_image_size') || '2K',
      outputFormat: seedreamConfig.outputFormat || localStorage.getItem('app_seedream_image_format') || 'png',
      watermark: seedreamConfig.watermark ?? localStorage.getItem('app_seedream_image_watermark') === 'true',
      seed: seedreamConfig.seed === '' || seedreamConfig.seed === undefined ? null : Number(seedreamConfig.seed),
      referenceImages: [...identity.referenceImages, ...getImagesForGroups(groupIds).map(image => image.dataUrl)].slice(0, 10)
    })
  }

  if (character?.imageGenProvider === 'niji') {
    const nijiConfig = character?.nijiImageConfig || {}
    const apiKey = nijiConfig.apiKey || localStorage.getItem('app_niji_image_apikey') || ''
    if (!apiKey) throw new Error('未配置 Niji 第三方中转密钥')
    const prompt = [nijiConfig.promptPrefix, identity.prompt, description.trim()].filter(Boolean).join('\n')
    const { generateImage } = useNijiImage()
    return generateImage({
      apiKey,
      baseUrl: nijiConfig.baseUrl || localStorage.getItem('app_niji_image_baseurl') || '',
      protocol: nijiConfig.protocol || localStorage.getItem('app_niji_image_protocol') || 'proxy',
      pollInterval: nijiConfig.pollInterval || Number(localStorage.getItem('app_niji_image_poll_interval') || 3000),
      timeout: nijiConfig.timeout || Number(localStorage.getItem('app_niji_image_timeout') || 600000)
    }, {
      prompt,
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
  }

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
    const prompt = [fluxConfig.promptPrefix, ...instructions, identity.prompt, description.trim()].filter(Boolean).join('\n')
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
      referenceImages: [...identity.referenceImages, ...getImagesForGroups(groupIds).map(image => image.dataUrl)].slice(0, 8)
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
    const prompt = [geminiConfig.promptPrefix, ...instructions, identity.prompt, description.trim()].filter(Boolean).join('\n')
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
      referenceImages: [...identity.referenceImages, ...getImagesForGroups(groupIds).map(image => image.dataUrl)].slice(0, 8)
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
    const prompt = [gptConfig.promptPrefix, ...groupInstructions, identity.prompt, description.trim()].filter(Boolean).join('\n')
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
      referenceImages: [...identity.referenceImages, ...getImagesForGroups(groupIds).map(image => image.dataUrl)].slice(0, 8)
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

  prompt = [naiConfig.positivePrompt, naiConfig.vibeText, identity.prompt, prompt].filter(Boolean).join(', ')
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
    negative_prompt: [naiConfig.negativePrompt, identity.negativePrompt].filter(Boolean).join(', ')
  })
  if (!image) throw new Error('图像引擎未返回图片')
  return image
}
