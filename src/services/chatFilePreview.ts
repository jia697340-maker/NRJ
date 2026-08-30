/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { CharacterAssetMeta } from '../types/chatAssets'
import { getCharacterAssetBlob } from './characterAssetRepository'

export type ChatFilePreviewKind = 'text' | 'csv' | 'docx' | 'xlsx' | 'pdf' | 'image' | 'audio' | 'video'

export interface ChatFilePreviewCapability {
  supported: boolean
  kind?: ChatFilePreviewKind
  label: string
  reason?: string
}

export interface ChatFilePreviewResult {
  kind: ChatFilePreviewKind
  label: string
  text?: string
  rows?: string[][]
  sheetNames?: string[]
  activeSheetIndex?: number
  truncated?: boolean
  objectUrl?: string
}

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'html', 'htm', 'rtf', 'svg', 'js', 'ts', 'py', 'java', 'css', 'vue', 'log'])
const MEDIA_KIND_BY_EXTENSION: Record<string, ChatFilePreviewKind> = {
  pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', bmp: 'image',
  mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', aac: 'audio', flac: 'audio',
  mp4: 'video', webm: 'video', mov: 'video', m4v: 'video'
}
const MAX_TABLE_ROWS = 300
const MAX_TABLE_COLUMNS = 60

export const getChatFileExtension = (name: string) => {
  const match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] || ''
}

export const getChatFilePreviewCapability = (asset: Pick<CharacterAssetMeta, 'name' | 'mimeType'>): ChatFilePreviewCapability => {
  const extension = getChatFileExtension(asset.name)
  const mime = String(asset.mimeType || '').toLowerCase()
  const structuredTextMime = mime === 'application/json' || mime.endsWith('+json') || mime === 'application/xml' || mime === 'text/xml' || mime.endsWith('+xml') || mime.includes('yaml')
  if (extension === 'svg' || mime.includes('image/svg+xml')) return { supported: true, kind: 'text', label: 'SVG 源码' }
  if (extension === 'csv' || mime.includes('text/csv')) return { supported: true, kind: 'csv', label: '表格' }
  if (extension === 'docx' || mime.includes('wordprocessingml')) return { supported: true, kind: 'docx', label: '文档' }
  if (extension === 'xlsx' || mime.includes('spreadsheetml')) return { supported: true, kind: 'xlsx', label: '工作簿' }
  if (TEXT_EXTENSIONS.has(extension) || mime.startsWith('text/') || structuredTextMime) return { supported: true, kind: 'text', label: ['html', 'htm', 'svg'].includes(extension) ? `${extension.toUpperCase()} 源码` : '文本' }
  if (mime === 'application/pdf') return { supported: true, kind: 'pdf', label: 'PDF' }
  if (mime.startsWith('image/')) return { supported: true, kind: 'image', label: '图片' }
  if (mime.startsWith('audio/')) return { supported: true, kind: 'audio', label: '音频' }
  if (mime.startsWith('video/')) return { supported: true, kind: 'video', label: '视频' }
  const mediaKind = MEDIA_KIND_BY_EXTENSION[extension]
  if (mediaKind) return { supported: true, kind: mediaKind, label: mediaKind === 'pdf' ? 'PDF' : mediaKind === 'image' ? '图片' : mediaKind === 'audio' ? '音频' : '视频' }
  return { supported: false, label: '文件', reason: '该格式暂不支持应用内预览，可下载原文件或用其他应用打开。' }
}

const normalizeCellValue = (value: unknown): string => {
  if (value == null) return ''
  if (value instanceof Date) return value.toLocaleString('zh-CN')
  if (typeof value === 'object') {
    const cell = value as any
    if (cell.result != null) return normalizeCellValue(cell.result)
    if (Array.isArray(cell.richText)) return cell.richText.map((part: any) => String(part?.text || '')).join('')
    if (cell.text != null) return String(cell.text)
    if (cell.hyperlink) return String(cell.text || cell.hyperlink)
    try { return JSON.stringify(value) } catch { return String(value) }
  }
  return String(value)
}

export const parseCsvRows = (source: string, maxRows = MAX_TABLE_ROWS, maxColumns = MAX_TABLE_COLUMNS) => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let truncated = false
  const text = source.replace(/^\uFEFF/, '')
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1 }
      else if (char === '"') quoted = false
      else cell += char
      continue
    }
    if (char === '"' && cell.length === 0) { quoted = true; continue }
    if (char === ',') { if (row.length < maxColumns) row.push(cell); else truncated = true; cell = ''; continue }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      if (row.length < maxColumns) row.push(cell); else truncated = true
      if (rows.length < maxRows) rows.push(row); else truncated = true
      row = []; cell = ''
      if (rows.length >= maxRows) break
      continue
    }
    cell += char
  }
  if ((cell || row.length) && rows.length < maxRows) { if (row.length < maxColumns) row.push(cell); else truncated = true; rows.push(row) }
  return { rows, truncated }
}

const rtfToPlainText = (source: string) => source
  .replace(/\{\\fonttbl[\s\S]*?\}(?=\})/g, '')
  .replace(/\\u(-?\d+)\??/g, (_match, raw) => String.fromCharCode(Number(raw) < 0 ? Number(raw) + 65536 : Number(raw)))
  .replace(/\\par\b/g, '\n')
  .replace(/\\tab\b/g, '\t')
  .replace(/\\([\\{}])/g, '$1')
  .replace(/\\'[0-9a-fA-F]{2}/g, '')
  .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
  .replace(/[{}]/g, '')
  .trim()

const loadXlsxSheet = async (blob: Blob, requestedSheet = 0): Promise<ChatFilePreviewResult> => {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await blob.arrayBuffer())
  const sheets = workbook.worksheets
  if (!sheets.length) throw new Error('工作簿中没有可显示的工作表')
  const activeSheetIndex = Math.max(0, Math.min(requestedSheet, sheets.length - 1))
  const sheet = sheets[activeSheetIndex]
  const rowLimit = Math.min(sheet.rowCount, MAX_TABLE_ROWS)
  const columnLimit = Math.min(sheet.columnCount, MAX_TABLE_COLUMNS)
  const rows: string[][] = []
  for (let rowIndex = 1; rowIndex <= rowLimit; rowIndex += 1) {
    const row: string[] = []
    for (let columnIndex = 1; columnIndex <= columnLimit; columnIndex += 1) row.push(normalizeCellValue(sheet.getCell(rowIndex, columnIndex).value))
    rows.push(row)
  }
  return { kind: 'xlsx', label: '工作簿', rows, sheetNames: sheets.map(item => item.name), activeSheetIndex, truncated: sheet.rowCount > rowLimit || sheet.columnCount > columnLimit }
}

export const loadChatFilePreview = async (asset: CharacterAssetMeta, requestedSheet = 0): Promise<ChatFilePreviewResult> => {
  const capability = getChatFilePreviewCapability(asset)
  if (!capability.supported || !capability.kind) throw new Error(capability.reason || '该格式暂不支持预览')
  const blob = await getCharacterAssetBlob(asset)
  if (capability.kind === 'text') {
    const source = await blob.text()
    return { kind: 'text', label: capability.label, text: getChatFileExtension(asset.name) === 'rtf' ? rtfToPlainText(source) : source }
  }
  if (capability.kind === 'csv') {
    const parsed = parseCsvRows(await blob.text())
    return { kind: 'csv', label: '表格', ...parsed }
  }
  if (capability.kind === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() })
    return { kind: 'docx', label: '文档', text: result.value || '文档中没有可显示的文字内容。' }
  }
  if (capability.kind === 'xlsx') return loadXlsxSheet(blob, requestedSheet)
  return { kind: capability.kind, label: capability.label, objectUrl: URL.createObjectURL(blob) }
}

export const revokeChatFilePreview = (preview?: ChatFilePreviewResult | null) => {
  if (preview?.objectUrl) URL.revokeObjectURL(preview.objectUrl)
}
