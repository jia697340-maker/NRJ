/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { CharacterAssetAction, ChatFileData, ChatVideoData, GeneratedFileFormat } from '../types/chatAssets'
import localforage from 'localforage'
import { DEFAULT_FILE_FORMATS, getEffectiveCharacterAssets, resolveAssetRef, resolveVideoReferenceImage } from './characterCapabilities'
import { getCharacterAssetBlob, saveCharacterAsset } from './characterAssetRepository'
import { generateFileBlob, parseFileGenerationPayload } from './fileGenerationService'
import { generateCharacterVideo, getCharacterVideoProvider, readVideoMetadata } from './videoGenerationService'

export const readActionAttribute = (attrs: string, name: string) => attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] || ''

export const toCharacterAssetAction = (type: CharacterAssetAction['type'], content: string, attrs = ''): CharacterAssetAction => ({
  type, content, ref: readActionAttribute(attrs, 'ref'), title: readActionAttribute(attrs, 'title'),
  format: readActionAttribute(attrs, 'format') as GeneratedFileFormat,
  mode: (readActionAttribute(attrs, 'mode') || 'text_to_video') as CharacterAssetAction['mode'],
  referenceRef: readActionAttribute(attrs, 'reference_ref')
})

const appendMeta = (chat: any, meta: any) => {
  chat.characterAssets = [...(Array.isArray(chat.characterAssets) ? chat.characterAssets : []), meta]
}

const dataUrlToBlob = (value: string) => {
  const match = String(value || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
  if (!match) throw new Error('参考图数据无效')
  const bytes = match[2] ? Uint8Array.from(atob(match[3]), character => character.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(match[3]))
  return new Blob([bytes], { type: match[1] || 'image/png' })
}

const loadVideoReferenceImage = async (chat: any, ref: string) => {
  const reference = resolveVideoReferenceImage(chat, ref)
  if (!reference) throw new Error('图生视频引用不存在或本轮不可见')
  const store = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
  const stored = await store.getItem<Blob | string>(reference.imageId)
  const blob = stored instanceof Blob ? stored : typeof stored === 'string' ? dataUrlToBlob(stored) : null
  if (!blob?.size || !blob.type.startsWith('image/')) throw new Error('图生视频参考图已丢失或格式无效')
  return blob
}

export const executeCharacterAssetAction = async (input: {
  chat: any
  action: CharacterAssetAction
  runtimeMode?: 'single' | 'group'
  query?: string
  signal?: AbortSignal
  onProgress?: (message: string) => void
}) => {
  const runtimeMode = input.runtimeMode || 'single'
  const capabilities = getEffectiveCharacterAssets(input.chat, runtimeMode)
  const action = input.action
  if (action.type === 'send_existing_file') {
    if (!capabilities.file.enabled) throw new Error('该角色的文件能力已关闭')
    const asset = resolveAssetRef(input.chat, 'file', action.ref || '', runtimeMode, input.query)
    if (!asset || asset.ownerCharacterId !== capabilities.ownerCharacterId) throw new Error('文件引用无效或不属于该角色')
    await getCharacterAssetBlob(asset)
    const fileData: ChatFileData = { assetId: asset.id, name: asset.name, mimeType: asset.mimeType, size: asset.size, source: asset.source, contentHash: asset.contentHash }
    return { kind: 'file' as const, asset, fileData }
  }
  if (action.type === 'generate_file') {
    if (!capabilities.file.canGenerate) throw new Error('该角色没有可用的文件生成能力')
    const format = action.format
    if (!format || !DEFAULT_FILE_FORMATS.includes(format) || !capabilities.file.allowedFormats.includes(format)) throw new Error('模型请求的文件格式未获授权')
    input.onProgress?.('正在生成真实文件')
    const result = await generateFileBlob(parseFileGenerationPayload(action.content, format, action.title || '角色生成文件'))
    const maxBytes = Math.max(1, Number(input.chat.fileGenerationConfig?.maxSizeMb || 30)) * 1024 * 1024
    if (result.blob.size > maxBytes) throw new Error('生成文件超过角色设置的大小上限')
    const asset = await saveCharacterAsset({ ownerCharacterId: capabilities.ownerCharacterId, kind: 'file', source: 'generated', blob: result.blob, name: result.name, summary: action.title || action.content.slice(0, 180), groupVisibility: runtimeMode === 'group' ? 'allowed' : 'private_only' })
    appendMeta(input.chat, asset)
    const fileData: ChatFileData = { assetId: asset.id, name: asset.name, mimeType: asset.mimeType, size: asset.size, source: asset.source, contentHash: asset.contentHash }
    return { kind: 'file' as const, asset, fileData }
  }
  if (action.type === 'send_existing_video') {
    if (!capabilities.video.enabled) throw new Error('该角色的视频能力已关闭')
    const asset = resolveAssetRef(input.chat, 'video', action.ref || '', runtimeMode, input.query)
    if (!asset || asset.ownerCharacterId !== capabilities.ownerCharacterId) throw new Error('视频引用无效或不属于该角色')
    await getCharacterAssetBlob(asset)
    const videoData: ChatVideoData = { assetId: asset.id, name: asset.name, mimeType: asset.mimeType, size: asset.size, source: asset.source, contentHash: asset.contentHash, duration: asset.duration, width: asset.width, height: asset.height }
    return { kind: 'video' as const, asset, videoData }
  }
  if (!capabilities.video.canGenerate) throw new Error('该角色没有可用的视频生成能力')
  const provider = getCharacterVideoProvider(String(input.chat.videoGenerationConfig?.provider || ''))
  if (action.mode === 'image_to_video' && !provider?.supportsImage) throw new Error('当前视频节点不支持聊天本地图片生成视频')
  const firstFrame = action.mode === 'image_to_video' ? await loadVideoReferenceImage(input.chat, action.referenceRef || '') : undefined
  const blob = await generateCharacterVideo({ ownerCharacterId: capabilities.ownerCharacterId, prompt: action.content, config: input.chat.videoGenerationConfig, firstFrame, signal: input.signal, onProgress: input.onProgress })
  const metadata = await readVideoMetadata(blob)
  const asset = await saveCharacterAsset({ ownerCharacterId: capabilities.ownerCharacterId, kind: 'video', source: 'generated', blob, name: `${String(action.title || '角色生成视频').replace(/[\\/:*?"<>|]/g, '_')}.mp4`, summary: action.content.slice(0, 500), groupVisibility: runtimeMode === 'group' ? 'allowed' : 'private_only', ...metadata })
  appendMeta(input.chat, asset)
  const videoData: ChatVideoData = { assetId: asset.id, name: asset.name, mimeType: asset.mimeType, size: asset.size, source: asset.source, contentHash: asset.contentHash, ...metadata }
  return { kind: 'video' as const, asset, videoData }
}
