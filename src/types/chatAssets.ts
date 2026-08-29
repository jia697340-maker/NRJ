/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type CharacterAssetKind = 'file' | 'video'
export type CharacterAssetSource = 'configured' | 'generated'
export type CharacterAssetGroupVisibility = 'private_only' | 'allowed'

export interface CharacterAssetMeta {
  id: string
  ownerCharacterId: string
  kind: CharacterAssetKind
  source: CharacterAssetSource
  name: string
  mimeType: string
  size: number
  summary: string
  tags: string[]
  contentHash: string
  groupVisibility: CharacterAssetGroupVisibility
  createdAt: number
  updatedAt: number
  duration?: number
  width?: number
  height?: number
}

export type GeneratedFileFormat = 'pptx' | 'docx' | 'pdf' | 'xlsx' | 'csv' | 'txt' | 'md' | 'html' | 'rtf' | 'json' | 'xml' | 'yaml' | 'zip' | 'js' | 'ts' | 'py' | 'java' | 'css' | 'vue'

export interface CharacterFileGenerationConfig {
  enabled: boolean
  allowedFormats: GeneratedFileFormat[]
  maxSizeMb: number
}

export interface CharacterVideoGenerationConfig {
  enabled: boolean
  provider: string
  credentialRef: string
  model: string
  baseUrl: string
  aspectRatio: string
  resolution: string
  durationSeconds: number
  maxDailyGenerations: number
  maxEstimatedCost: number
}

export interface ChatFileData {
  assetId: string
  name: string
  mimeType: string
  size: number
  source: CharacterAssetSource
  contentHash: string
}

export interface ChatVideoData {
  assetId: string
  name: string
  mimeType: string
  size: number
  source: CharacterAssetSource
  contentHash: string
  duration?: number
  width?: number
  height?: number
}

export interface FileGenerationPayload {
  format: GeneratedFileFormat
  title: string
  content?: string
  sections?: Array<{ title: string; content?: string; bullets?: string[] }>
  rows?: Array<Record<string, string | number | boolean | null>>
  files?: Array<{ name: string; content: string }>
}

export interface CharacterAssetAction {
  type: 'send_existing_file' | 'generate_file' | 'send_existing_video' | 'generate_video'
  ref?: string
  format?: GeneratedFileFormat
  title?: string
  mode?: 'text_to_video' | 'image_to_video'
  referenceRef?: string
  content: string
}
