/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { CharacterAssetMeta, GeneratedFileFormat } from '../types/chatAssets'
import { normalizeCharacterAssets } from './characterAssetRepository'
import { canUseCharacterVideoAdapter, getCharacterVideoProvider } from './videoGenerationService'

export const DEFAULT_FILE_FORMATS: GeneratedFileFormat[] = ['pptx', 'docx', 'pdf', 'xlsx', 'csv', 'txt', 'md', 'html', 'rtf', 'json', 'xml', 'yaml', 'zip', 'js', 'ts', 'py', 'java', 'css', 'vue']

const xmlEscape = (value: string) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const ownerId = (chat: any) => String(chat?.characterEntityId || chat?.id || '')

export const getEffectiveCharacterAssets = (chat: any, runtimeMode: 'single' | 'group' = 'single') => {
  const id = ownerId(chat)
  const assets = normalizeCharacterAssets(chat?.characterAssets, id).filter(asset => runtimeMode !== 'group' || asset.groupVisibility === 'allowed')
  const fileEnabled = chat?.enableFileCapability === true
  const videoEnabled = chat?.enableVideoMessageCapability === true
  const allowedFormats = Array.isArray(chat?.fileGenerationConfig?.allowedFormats)
    ? chat.fileGenerationConfig.allowedFormats.filter((format: GeneratedFileFormat) => DEFAULT_FILE_FORMATS.includes(format))
    : DEFAULT_FILE_FORMATS
  return {
    ownerCharacterId: id,
    files: assets.filter(asset => asset.kind === 'file'),
    videos: assets.filter(asset => asset.kind === 'video'),
    file: { enabled: fileEnabled, canGenerate: fileEnabled && chat?.fileGenerationConfig?.enabled === true && allowedFormats.length > 0, allowedFormats },
    video: { enabled: videoEnabled, canGenerate: videoEnabled && chat?.videoGenerationConfig?.enabled === true && canUseCharacterVideoAdapter(chat.videoGenerationConfig) }
  }
}

const scoreAsset = (asset: CharacterAssetMeta, query: string) => {
  const terms = query.toLowerCase().split(/[\s，。！？、,.;:!?]+/).filter(term => term.length > 1)
  const haystack = `${asset.name} ${asset.summary} ${asset.tags.join(' ')}`.toLowerCase()
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 3 : 0), 0) + (asset.source === 'configured' ? 1 : 0)
}

export const selectAssetCandidates = (assets: CharacterAssetMeta[], query = '', limit = 8) => (
  [...assets].sort((a, b) => scoreAsset(b, query) - scoreAsset(a, query) || b.updatedAt - a.updatedAt).slice(0, limit)
)

export const selectVideoReferenceImages = (chat: any, limit = 3) => (
  [...(Array.isArray(chat?.messages) ? chat.messages : [])]
    .reverse()
    .filter((message: any) => !message?.isRecalled && message?.imageData?.imageId)
    .slice(0, limit)
    .map((message: any, index) => ({ ref: `image_${index}`, imageId: String(message.imageData.imageId), summary: String(message.imageData.summary || message.imageData.text || message.content || '聊天中的图片').slice(0, 180) }))
)

export const buildCharacterAssetPrompt = (chat: any, runtimeMode: 'single' | 'group' = 'single', query = '') => {
  const capabilities = getEffectiveCharacterAssets(chat, runtimeMode)
  const fileCandidates = capabilities.file.enabled ? selectAssetCandidates(capabilities.files, query) : []
  const videoCandidates = capabilities.video.enabled ? selectAssetCandidates(capabilities.videos, query) : []
  const videoProvider = getCharacterVideoProvider(String(chat?.videoGenerationConfig?.provider || ''))
  const referenceImages = capabilities.video.canGenerate && videoProvider?.supportsImage ? selectVideoReferenceImages(chat) : []
  if (!fileCandidates.length && !videoCandidates.length && !capabilities.file.canGenerate && !capabilities.video.canGenerate) return ''
  const senderId = xmlEscape(capabilities.ownerCharacterId)
  const lines: string[] = ['【角色真实文件与视频能力】\n只有资源真实存在或生成成功后，系统才会插入附件消息。不要提前声称“已经发送”；可以说“我整理一下”或“我找找”。动作标签必须独立存在。']
  if (fileCandidates.length) {
    lines.push(`可发送的已有文件：\n${fileCandidates.map((asset, index) => `- ref="file_${index}" name="${xmlEscape(asset.name)}" summary="${xmlEscape(asset.summary || '无摘要')}"`).join('\n')}\n发送已有文件：${runtimeMode === 'group' ? `<group_msg sender="${senderId}" kind="file" action="existing" ref="file_序号">文件名</group_msg>` : '<send_existing_file ref="file_序号"></send_existing_file>'}`)
  }
  if (capabilities.file.canGenerate) {
    lines.push(`可以生成真实文件，允许格式：${capabilities.file.allowedFormats.join('、')}。使用：${runtimeMode === 'group' ? `<group_msg sender="${senderId}" kind="file" action="generate" format="格式" title="文件标题">JSON</group_msg>` : '<generate_file format="格式" title="文件标题">JSON</generate_file>'}。JSON 应包含 title，以及适用的 content、sections、rows 或 files；内容必须结合本轮完整上下文并足以直接生成文件。`)
  }
  if (videoCandidates.length) {
    lines.push(`可发送的已有视频：\n${videoCandidates.map((asset, index) => `- ref="video_${index}" name="${xmlEscape(asset.name)}" summary="${xmlEscape(asset.summary || '无摘要')}"`).join('\n')}\n发送已有视频：${runtimeMode === 'group' ? `<group_msg sender="${senderId}" kind="video" action="existing" ref="video_序号">视频名</group_msg>` : '<send_existing_video ref="video_序号"></send_existing_video>'}`)
  }
  if (capabilities.video.canGenerate) {
    const imageReferences = videoProvider?.supportsImage && referenceImages.length
      ? `\n本轮可用于图生视频的聊天图片：\n${referenceImages.map(image => `- reference_ref="${image.ref}" summary="${xmlEscape(image.summary)}"`).join('\n')}\n需要以其中一张为起始画面时，可把 mode 改为 image_to_video 并增加 reference_ref；否则使用 text_to_video。`
      : videoProvider?.supportsImage ? '\n本轮没有可用参考图，只能使用 text_to_video。' : '\n当前视频节点只允许 text_to_video，不得请求 image_to_video 或 reference_ref。'
    lines.push(`可以生成真实视频。使用：${runtimeMode === 'group' ? `<group_msg sender="${senderId}" kind="video" action="generate" mode="text_to_video">具体且可执行的视频提示词</group_msg>` : '<generate_video mode="text_to_video">具体且可执行的视频提示词</generate_video>'}。不得虚构参考图。${imageReferences}`)
  }
  return `\n\n${lines.join('\n\n')}`
}

export const resolveVideoReferenceImage = (chat: any, ref: string) => selectVideoReferenceImages(chat).find(image => image.ref === String(ref || ''))

export const resolveAssetRef = (chat: any, kind: 'file' | 'video', ref: string, runtimeMode: 'single' | 'group' = 'single', query = '') => {
  const capabilities = getEffectiveCharacterAssets(chat, runtimeMode)
  const list = selectAssetCandidates(kind === 'file' ? capabilities.files : capabilities.videos, query)
  const match = String(ref || '').match(new RegExp(`^${kind}_(\\d+)$`))
  return match ? list[Number(match[1])] : undefined
}
