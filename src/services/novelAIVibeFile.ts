/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { VibeEncoding } from '../composables/useNovelAIVibe'

// NovelAI 原生 Vibe v1 兼容实现。格式字段与官方文档及 MIT 项目
// Aaalice233/Aaalice_NAI_Launcher 的公开兼容性测试交叉核对。
const SINGLE_IDENTIFIER = 'novelai-vibe-transfer'
const BUNDLE_IDENTIFIER = 'novelai-vibe-transfer-bundle'
const FORMAT_VERSION = 1
const MAX_FILE_BYTES = 64 * 1024 * 1024
const MAX_BUNDLE_ITEMS = 16

type UnknownRecord = Record<string, unknown>

export interface ParsedNovelAIVibeItem {
  name: string
  externalId?: string
  base64: string
  mimeType?: string
  previewBase64?: string
  previewMimeType?: string
  encodings: VibeEncoding[]
  strength: number
  informationExtracted: number
  sourceFilename: string
}

export interface ParsedNovelAIVibeFile {
  groupName: string
  items: ParsedNovelAIVibeItem[]
}

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const finiteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value))

const stripExtension = (filename: string): string => (
  filename
    .replace(/\.naiv4vibebundle(?:\.json)?$/i, '')
    .replace(/\.naiv4vibe(?:\.json)?$/i, '')
    .replace(/\.json$/i, '')
    .trim()
    || '未命名氛围组'
)

const detectImageMime = (base64: string): string | undefined => {
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png'
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('UklGR')) return 'image/webp'
  if (base64.startsWith('R0lGOD')) return 'image/gif'
  if (base64.startsWith('Qk')) return 'image/bmp'
  return undefined
}

const parseImageValue = (value: unknown): { base64: string; mimeType?: string } | null => {
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmed = value.trim()
  const dataUri = /^data:([^;,]+);base64,(.+)$/s.exec(trimmed)
  const base64 = (dataUri?.[2] ?? trimmed).replace(/\s+/g, '')
  if (!base64) return null
  return {
    base64,
    mimeType: dataUri?.[1] || detectImageMime(base64)
  }
}

const collectEncodings = (value: unknown, fallbackInformation: number): VibeEncoding[] => {
  if (!isRecord(value)) return []
  const unique = new Map<string, VibeEncoding>()

  for (const [model, rawVariants] of Object.entries(value)) {
    if (!isRecord(rawVariants)) continue
    for (const rawVariant of Object.values(rawVariants)) {
      if (!isRecord(rawVariant) || typeof rawVariant.encoding !== 'string' || !rawVariant.encoding.trim()) continue
      const params = isRecord(rawVariant.params) ? rawVariant.params : {}
      const informationExtracted = clampUnit(
        finiteNumber(params.information_extracted) ?? fallbackInformation
      )
      const encoding: VibeEncoding = {
        model,
        informationExtracted,
        encoding: rawVariant.encoding.trim()
      }
      unique.set(`${model}:${informationExtracted}`, encoding)
    }
  }

  return [...unique.values()].sort((left, right) => (
    left.model.localeCompare(right.model)
    || left.informationExtracted - right.informationExtracted
  ))
}

const nearestInformationExtracted = (
  encodings: VibeEncoding[],
  requested: number,
  preferredModel?: string
): number => {
  const modelKey = preferredModel?.toLowerCase().includes('4-5')
    ? preferredModel.toLowerCase().includes('full') ? 'v4-5full' : 'v4-5curated'
    : preferredModel?.toLowerCase().includes('4')
      ? preferredModel.toLowerCase().includes('full') ? 'v4full' : 'v4curated'
      : undefined
  const preferred = modelKey ? encodings.filter(item => item.model.toLowerCase() === modelKey) : []
  const pool = preferred.length > 0 ? preferred : encodings
  if (pool.length === 0) return requested
  return pool.reduce((best, candidate) => (
    Math.abs(candidate.informationExtracted - requested)
      < Math.abs(best.informationExtracted - requested)
      ? candidate
      : best
  )).informationExtracted
}

const parseItem = (
  value: unknown,
  sourceFilename: string,
  fallbackName: string
): ParsedNovelAIVibeItem => {
  if (!isRecord(value)) throw new Error('Vibe 条目不是有效对象')
  if (value.identifier !== SINGLE_IDENTIFIER) throw new Error('不是受支持的 NovelAI Vibe 文件')
  if (value.version !== FORMAT_VERSION) throw new Error(`暂不支持 Vibe 文件版本：${String(value.version)}`)
  if (value.type !== 'image' && value.type !== 'encoding') throw new Error('Vibe 文件缺少有效的 type 字段')

  const importInfo = isRecord(value.importInfo) ? value.importInfo : {}
  const requestedInformation = clampUnit(finiteNumber(importInfo.information_extracted) ?? 0.7)
  const strength = clampUnit(finiteNumber(importInfo.strength) ?? 0.6)
  const encodings = collectEncodings(value.encodings, requestedInformation)
  const image = parseImageValue(value.image)
  const thumbnail = parseImageValue(value.thumbnail)

  if (value.type === 'image' && !image) throw new Error('图片型 Vibe 缺少原图数据')
  if (value.type === 'encoding' && encodings.length === 0) throw new Error('编码型 Vibe 没有可用的预编码数据')

  const model = typeof importInfo.model === 'string' ? importInfo.model : undefined
  return {
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : fallbackName,
    externalId: typeof value.id === 'string' && value.id.trim() ? value.id.trim() : undefined,
    base64: image?.base64 ?? '',
    mimeType: image?.mimeType,
    previewBase64: thumbnail?.base64,
    previewMimeType: thumbnail?.mimeType,
    encodings,
    strength,
    informationExtracted: nearestInformationExtracted(encodings, requestedInformation, model),
    sourceFilename
  }
}

export const parseNovelAIVibeContent = (
  content: string,
  filename: string
): ParsedNovelAIVibeFile => {
  if (new Blob([content]).size > MAX_FILE_BYTES) {
    throw new Error('Vibe 文件过大，最大支持 64MB')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('无法解析 Vibe 文件，请确认文件没有损坏')
  }

  const groupName = stripExtension(filename)
  if (isRecord(parsed) && parsed.identifier === BUNDLE_IDENTIFIER) {
    if (parsed.version !== FORMAT_VERSION) {
      throw new Error(`暂不支持 Vibe Bundle 版本：${String(parsed.version)}`)
    }
    if (!Array.isArray(parsed.vibes) || parsed.vibes.length === 0) {
      throw new Error('Vibe Bundle 中没有可导入的氛围')
    }
    if (parsed.vibes.length > MAX_BUNDLE_ITEMS) {
      throw new Error(`单个 Vibe Bundle 最多支持 ${MAX_BUNDLE_ITEMS} 个氛围`)
    }
    return {
      groupName,
      items: parsed.vibes.map((item, index) => parseItem(item, filename, `${groupName} ${index + 1}`))
    }
  }

  return {
    groupName,
    items: [parseItem(parsed, filename, groupName)]
  }
}

export const parseNovelAIVibeFile = async (file: File): Promise<ParsedNovelAIVibeFile> => {
  if (file.size > MAX_FILE_BYTES) throw new Error('Vibe 文件过大，最大支持 64MB')
  if (!/\.naiv4vibe(?:bundle)?(?:\.json)?$/i.test(file.name)) {
    throw new Error('请选择 .naiv4vibe 或 .naiv4vibebundle 文件')
  }
  return parseNovelAIVibeContent(await file.text(), file.name)
}
