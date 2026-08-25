import { useGptImage } from '../composables/useGptImage'
import { usePollinationsImage } from '../composables/usePollinationsImage'
import { useNovelAI } from '../composables/useNovelAI'
import { useGeminiImage, type GeminiImageMimeType, type GeminiImageSize, type GeminiImageTransport, type GeminiThinkingLevel } from '../composables/useGeminiImage'
import { useFluxImage, type FluxImageFormat } from '../composables/useFluxImage'
import { useNijiImage, type NijiGatewayProtocol, type NijiSpeedMode } from '../composables/useNijiImage'
import { useSeedreamImage, type SeedreamImageFormat, type SeedreamImageSize } from '../composables/useSeedreamImage'
import { useAiHordeImage } from '../composables/useAiHordeImage'
import { generateSeedAudio, loadSeedAudioConfig } from '../composables/useSeedAudio'
import { storeForumMedia } from './forumRepository'
import type { ForumMediaItem } from '../types/forum'
import type { ForumAutoImageProvider } from '../types/forum'

const valueToBlob = async (value: string) => {
  const response = await fetch(value)
  if (!response.ok) throw new Error('无法保存生成的媒体')
  return response.blob()
}

export const generateForumImage = async (prompt: string, provider: Exclude<ForumAutoImageProvider, 'off'> = 'pollinations'): Promise<ForumMediaItem> => {
  let value = ''
  if (provider === 'pollinations') value = await usePollinationsImage().generateImage(
    { apiKey: localStorage.getItem('app_pollinations_image_apikey') || '', baseUrl: localStorage.getItem('app_pollinations_image_baseurl') || 'https://gen.pollinations.ai/v1' },
    { model: localStorage.getItem('app_pollinations_image_model') || 'zimage', prompt, size: localStorage.getItem('app_pollinations_image_size') || '1024x1024', quality: (localStorage.getItem('app_pollinations_image_quality') || 'medium') as 'low' | 'medium' | 'high', safe: localStorage.getItem('app_pollinations_image_safe') || 'privacy,secrets,sexual,violence' }
  )
  else if (provider === 'aihorde') value = await useAiHordeImage().generateImage(
    { apiKey: localStorage.getItem('app_ai_horde_image_apikey') || '', baseUrl: localStorage.getItem('app_ai_horde_image_baseurl') || 'https://aihorde.net/api/v2' },
    { prompt, negativePrompt: localStorage.getItem('app_ai_horde_image_negative_prompt') || '', model: localStorage.getItem('app_ai_horde_image_model') || '', width: Number(localStorage.getItem('app_ai_horde_image_width') || 768), height: Number(localStorage.getItem('app_ai_horde_image_height') || 1024), steps: Number(localStorage.getItem('app_ai_horde_image_steps') || 24), cfgScale: Number(localStorage.getItem('app_ai_horde_image_cfg_scale') || 7), sampler: localStorage.getItem('app_ai_horde_image_sampler') || 'k_euler_a', seed: localStorage.getItem('app_ai_horde_image_seed') || '', timeout: Number(localStorage.getItem('app_ai_horde_image_timeout') || 600000), trustedWorkers: localStorage.getItem('app_ai_horde_image_trusted_workers') !== 'false', validatedBackends: localStorage.getItem('app_ai_horde_image_validated_backends') !== 'false', censorNsfw: localStorage.getItem('app_ai_horde_image_censor_nsfw') !== 'false' }
  )
  else if (provider === 'gpt') value = await useGptImage().generateImage(
    { apiKey: localStorage.getItem('app_gpt_image_apikey') || '', baseUrl: localStorage.getItem('app_gpt_image_baseurl') || 'https://api.openai.com/v1' },
    { model: localStorage.getItem('app_gpt_image_model') || 'gpt-image-2', prompt, size: localStorage.getItem('app_gpt_image_size') || '1024x1024', quality: (localStorage.getItem('app_gpt_image_quality') || 'medium') as 'low' | 'medium' | 'high', output_format: (localStorage.getItem('app_gpt_image_format') || 'png') as 'png' | 'jpeg' | 'webp', moderation: (localStorage.getItem('app_gpt_image_moderation') || 'auto') as 'auto' | 'low' }
  )
  else if (provider === 'gemini') {
    const transport = (localStorage.getItem('app_gemini_image_transport') || 'official') as GeminiImageTransport
    value = await useGeminiImage().generateImage(
      { apiKey: localStorage.getItem('app_gemini_image_apikey') || '', baseUrl: localStorage.getItem('app_gemini_image_baseurl') || (transport === 'official' ? 'https://generativelanguage.googleapis.com' : 'https://openrouter.ai/api/v1'), transport },
      { model: localStorage.getItem('app_gemini_image_model') || (transport === 'official' ? 'gemini-3.1-flash-image' : 'google/gemini-3.1-flash-image'), prompt, aspectRatio: localStorage.getItem('app_gemini_image_aspect_ratio') || '1:1', imageSize: (localStorage.getItem('app_gemini_image_size') || '1K') as GeminiImageSize, mimeType: (localStorage.getItem('app_gemini_image_mime_type') || 'image/png') as GeminiImageMimeType, thinkingLevel: (localStorage.getItem('app_gemini_image_thinking_level') || 'minimal') as GeminiThinkingLevel }
    )
  }
  else if (provider === 'flux') value = await useFluxImage().generateImage(
    { apiKey: localStorage.getItem('app_flux_image_apikey') || '', proxyUrl: localStorage.getItem('app_flux_image_proxy_url') || 'https://clingy-flux-proxy.q89028615.workers.dev' },
    { model: localStorage.getItem('app_flux_image_model') || 'flux-2-pro-preview', prompt, width: Number(localStorage.getItem('app_flux_image_width') || 1024), height: Number(localStorage.getItem('app_flux_image_height') || 1024), outputFormat: (localStorage.getItem('app_flux_image_format') || 'png') as FluxImageFormat, safetyTolerance: Number(localStorage.getItem('app_flux_image_safety') || 2), seed: localStorage.getItem('app_flux_image_seed') ? Number(localStorage.getItem('app_flux_image_seed')) : null, disablePromptUpsampling: localStorage.getItem('app_flux_image_disable_pup') === 'true' }
  )
  else if (provider === 'niji') value = await useNijiImage().generateImage(
    { apiKey: localStorage.getItem('app_niji_image_apikey') || '', baseUrl: localStorage.getItem('app_niji_image_baseurl') || '', protocol: (localStorage.getItem('app_niji_image_protocol') || 'proxy') as NijiGatewayProtocol, pollInterval: Number(localStorage.getItem('app_niji_image_poll_interval') || 3000), timeout: Number(localStorage.getItem('app_niji_image_timeout') || 600000) },
    { prompt, speedMode: (localStorage.getItem('app_niji_image_speed') || 'fast') as NijiSpeedMode, aspectRatio: localStorage.getItem('app_niji_image_aspect_ratio') || '1:1', stylize: Number(localStorage.getItem('app_niji_image_stylize') || 100), chaos: Number(localStorage.getItem('app_niji_image_chaos') || 0), weird: Number(localStorage.getItem('app_niji_image_weird') || 0), seed: localStorage.getItem('app_niji_image_seed') ? Number(localStorage.getItem('app_niji_image_seed')) : null, raw: localStorage.getItem('app_niji_image_raw') === 'true' }
  )
  else if (provider === 'seedream') value = await useSeedreamImage().generateImage(
    { apiKey: localStorage.getItem('app_seedream_image_apikey') || '', baseUrl: localStorage.getItem('app_seedream_image_baseurl') || 'https://ark.cn-beijing.volces.com/api/v3' },
    { model: localStorage.getItem('app_seedream_image_model') || 'doubao-seedream-5-0-lite-260128', prompt, size: (localStorage.getItem('app_seedream_image_size') || '2K') as SeedreamImageSize, outputFormat: (localStorage.getItem('app_seedream_image_format') || 'png') as SeedreamImageFormat, watermark: localStorage.getItem('app_seedream_image_watermark') === 'true', seed: localStorage.getItem('app_seedream_image_seed') ? Number(localStorage.getItem('app_seedream_image_seed')) : null }
  )
  else if (provider === 'novelai') {
    const generated = await useNovelAI().generateImage(
      { apiKey: localStorage.getItem('app_novelai_apikey') || '', baseUrl: localStorage.getItem('app_novelai_baseurl') || 'https://image.novelai.net', useStream: localStorage.getItem('app_novelai_usestream') !== 'false' },
      { input: prompt, model: localStorage.getItem('app_novelai_model') || 'nai-diffusion-4-5-full', action: 'generate', width: 1024, height: 1024, scale: 5, sampler: 'k_euler_ancestral', steps: 28, n_samples: 1, noise_schedule: 'karras', negative_prompt: localStorage.getItem('app_novelai_negative') || '' }
    )
    if (!generated) throw new Error('NovelAI 没有返回图片')
    value = generated
  }
  else throw new Error('未选择可用的论坛生图引擎')
  const blob = await valueToBlob(value)
  const item = await storeForumMedia(blob, { type: 'image', mimeType: blob.type || 'image/png', alt: prompt })
  item.url = URL.createObjectURL(blob)
  return item
}

export const generateForumVoice = async (text: string): Promise<ForumMediaItem> => {
  const blob = await generateSeedAudio(loadSeedAudioConfig(), { text, format: 'mp3' })
  const item = await storeForumMedia(blob, { type: 'voice', mimeType: blob.type || 'audio/mpeg', transcript: text, subtitle: text })
  item.url = URL.createObjectURL(blob)
  return item
}

export const createLightShortVideo = async (image: ForumMediaItem, voice?: ForumMediaItem, subtitle = ''): Promise<ForumMediaItem> => ({
  id: `light_video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  type: 'short-video',
  url: image.url,
  storageKey: image.storageKey,
  mimeType: 'application/x-nrj-light-video',
  posterUrl: image.url,
  audioUrl: voice?.url,
  audioStorageKey: voice?.storageKey,
  subtitle,
  animation: 'zoom'
})
