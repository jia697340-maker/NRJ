/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type ImageProviderId = 'novelai' | 'gpt' | 'gemini' | 'flux' | 'niji' | 'seedream' | 'pollinations' | 'aihorde'

export interface ImageProviderCapabilities {
  textToImage: boolean
  imageToImage: boolean
  multiReference: boolean
  negativePrompt: boolean
  seed: boolean
  dynamicModels: boolean
  asyncQueue: boolean
  costEstimate: boolean
  privacyLevel: 'standard' | 'distributed-public-risk'
}

export interface ImageProviderDefinition {
  id: ImageProviderId
  name: string
  shortName: string
  description: string
  configKey: string
  capabilities: ImageProviderCapabilities
}

export const IMAGE_PROVIDERS: ImageProviderDefinition[] = [
  { id: 'novelai', name: 'NovelAI', shortName: 'NAI', description: '二次元及丰富画风', configKey: 'naiConfig', capabilities: { textToImage: true, imageToImage: true, multiReference: true, negativePrompt: true, seed: true, dynamicModels: false, asyncQueue: false, costEstimate: false, privacyLevel: 'standard' } },
  { id: 'gpt', name: 'GPT Image', shortName: 'GPT', description: '图像生成与编辑', configKey: 'gptImageConfig', capabilities: { textToImage: true, imageToImage: true, multiReference: true, negativePrompt: false, seed: false, dynamicModels: false, asyncQueue: false, costEstimate: false, privacyLevel: 'standard' } },
  { id: 'gemini', name: 'Gemini Image', shortName: 'GEM', description: '原生生图与多图编辑', configKey: 'geminiImageConfig', capabilities: { textToImage: true, imageToImage: true, multiReference: true, negativePrompt: false, seed: false, dynamicModels: false, asyncQueue: false, costEstimate: false, privacyLevel: 'standard' } },
  { id: 'flux', name: 'FLUX.2', shortName: 'FLX', description: 'Pro / Max 独立接入', configKey: 'fluxImageConfig', capabilities: { textToImage: true, imageToImage: true, multiReference: true, negativePrompt: false, seed: true, dynamicModels: false, asyncQueue: false, costEstimate: false, privacyLevel: 'standard' } },
  { id: 'niji', name: 'Niji 7', shortName: 'N7', description: '第三方动漫模型', configKey: 'nijiImageConfig', capabilities: { textToImage: true, imageToImage: true, multiReference: false, negativePrompt: false, seed: true, dynamicModels: false, asyncQueue: true, costEstimate: false, privacyLevel: 'standard' } },
  { id: 'seedream', name: 'Seedream 5.0', shortName: 'SDR', description: '方舟原生生图', configKey: 'seedreamImageConfig', capabilities: { textToImage: true, imageToImage: true, multiReference: true, negativePrompt: false, seed: true, dynamicModels: false, asyncQueue: false, costEstimate: false, privacyLevel: 'standard' } },
  { id: 'pollinations', name: 'Pollinations AI', shortName: 'POL', description: '多模型、低成本与 BYOP', configKey: 'pollinationsImageConfig', capabilities: { textToImage: true, imageToImage: true, multiReference: true, negativePrompt: false, seed: false, dynamicModels: true, asyncQueue: false, costEstimate: true, privacyLevel: 'standard' } },
  { id: 'aihorde', name: 'AI Horde', shortName: 'HOR', description: '社区免费志愿算力', configKey: 'aiHordeImageConfig', capabilities: { textToImage: true, imageToImage: false, multiReference: false, negativePrompt: true, seed: true, dynamicModels: true, asyncQueue: true, costEstimate: true, privacyLevel: 'distributed-public-risk' } }
]

export const getImageProvider = (id?: string) => IMAGE_PROVIDERS.find(item => item.id === id) || IMAGE_PROVIDERS[0]
export const getImageProviderName = (id?: string) => getImageProvider(id).name

