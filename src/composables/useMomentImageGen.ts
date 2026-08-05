/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { useNovelAI } from './useNovelAI'
import { sendChatMessage } from '../services/api'

// 朋友圈与聊天共用已有 NovelAI 接入；每次生成使用独立实例，避免影响聊天室中的生成状态。
export async function generateMomentImage(description: string, character: any): Promise<string> {
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
