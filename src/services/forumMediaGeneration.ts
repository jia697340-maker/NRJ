import { useGptImage } from '../composables/useGptImage'
import { usePollinationsImage } from '../composables/usePollinationsImage'
import { generateSeedAudio, loadSeedAudioConfig } from '../composables/useSeedAudio'
import { storeForumMedia } from './forumRepository'
import type { ForumMediaItem } from '../types/forum'

const valueToBlob = async (value: string) => {
  const response = await fetch(value)
  if (!response.ok) throw new Error('无法保存生成的媒体')
  return response.blob()
}

export const generateForumImage = async (prompt: string, provider = 'gpt'): Promise<ForumMediaItem> => {
  let value = ''
  if (provider === 'pollinations') {
    value = await usePollinationsImage().generateImage({ apiKey: localStorage.getItem('app_pollinations_image_apikey') || '', baseUrl: localStorage.getItem('app_pollinations_image_baseurl') || 'https://gen.pollinations.ai/v1' }, { model: localStorage.getItem('app_pollinations_image_model') || 'flux', prompt, size: '1024x1024', quality: 'standard', safe: true })
  } else {
    value = await useGptImage().generateImage({ apiKey: localStorage.getItem('app_gpt_image_apikey') || '', baseUrl: localStorage.getItem('app_gpt_image_baseurl') || 'https://api.openai.com/v1' }, { model: localStorage.getItem('app_gpt_image_model') || 'gpt-image-2', prompt, size: '1024x1024', quality: 'medium', output_format: 'png', moderation: 'auto' })
  }
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
