/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, ref } from 'vue'
import localforage from 'localforage'

export type FontSourceType = 'local' | 'url'
export type FontFormat = 'woff2' | 'woff' | 'ttf' | 'otf'

export interface CustomFontRecord {
  id: string
  name: string
  fileName: string
  family: string
  format: FontFormat
  size: number
  sourceType: FontSourceType
  sourceUrl?: string
  scopes: string[]
  enabled: boolean
  createdAt: number
  updatedAt: number
}

const META_KEY = 'clingy_custom_fonts'
const STYLE_ID = 'clingy-custom-font-rules'
const fontStore = localforage.createInstance({ name: 'nrt-app', storeName: 'customFonts' })
const records = reactive<CustomFontRecord[]>([])
const loadedIds = reactive(new Set<string>())
const loadingIds = reactive(new Set<string>())
const errors = reactive<Record<string, string>>({})
const initialized = ref(false)
const loadedFaces = new Map<string, FontFace>()
let activeAppId: string | null = null

const readMeta = () => {
  try {
    const value = JSON.parse(localStorage.getItem(META_KEY) || '[]')
    return Array.isArray(value) ? value as CustomFontRecord[] : []
  } catch {
    return []
  }
}

const saveMeta = () => localStorage.setItem(META_KEY, JSON.stringify(records))

const escapeCssValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
const escapeAttr = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const rebuildStyles = () => {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }

  const active = records.filter(record => record.enabled && loadedIds.has(record.id))
  const latestFor = (scope: string) => active
    .filter(record => record.scopes.includes(scope))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]

  const declarations = (record: CustomFontRecord) => `font-family: "${escapeCssValue(record.family)}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;`
  const textDescendants = (selector: string) => `${selector}, ${selector} *:not(.text-icon):not(code):not(pre):not(kbd):not(samp)`
  const rules: string[] = []
  const globalFont = latestFor('global')
  if (globalFont) {
    rules.push(`${textDescendants('body')} { ${declarations(globalFont)} }`)
  }

  const exactScopes = new Set(active.flatMap(record => record.scopes).filter(scope => scope !== 'global'))
  exactScopes.forEach(scope => {
    const record = latestFor(scope)
    if (!record) return
    const [kind, id] = scope.split(':', 2)
    const attr = kind === 'app' ? 'data-font-app' : 'data-font-area'
    const selector = `[${attr}="${escapeAttr(id)}"]`
    rules.push(`${textDescendants(selector)} { ${declarations(record)} }`)
    if (kind === 'app') {
      const activeSelector = `body[data-active-font-app="${escapeAttr(id)}"]`
      rules.push(`${textDescendants(activeSelector)} { ${declarations(record)} }`)
    }
  })

  // 图标与代码保持自己的字形，避免自定义字体破坏功能性内容。
  rules.push(`.text-icon { font-family: "Noto Serif SC", STZhongsong, "Microsoft YaHei", serif !important; }`)
  rules.push(`code, pre, kbd, samp { font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important; }`)
  style.textContent = rules.join('\n')
}

const detectFormat = async (blob: Blob): Promise<FontFormat> => {
  const bytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer())
  const signature = String.fromCharCode(...bytes)
  if (signature === 'wOF2') return 'woff2'
  if (signature === 'wOFF') return 'woff'
  if (signature === 'OTTO') return 'otf'
  if (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) return 'ttf'
  if (signature === 'true' || signature === 'typ1') return 'ttf'
  throw new Error('文件内容不是受支持的字体格式')
}

const makeId = () => `font_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const loadFont = async (record: CustomFontRecord) => {
  if (!record.enabled || loadedIds.has(record.id) || loadingIds.has(record.id)) return
  loadingIds.add(record.id)
  delete errors[record.id]
  try {
    const blob = await fontStore.getItem<Blob>(record.id)
    if (!blob) throw new Error('本机字体文件已丢失')
    const url = URL.createObjectURL(blob)
    try {
      const face = new FontFace(record.family, `url("${url}") format("${record.format}")`, { display: 'swap' })
      await face.load()
      document.fonts.add(face)
      loadedFaces.set(record.id, face)
      loadedIds.add(record.id)
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    errors[record.id] = error instanceof Error ? error.message : '字体加载失败'
  } finally {
    loadingIds.delete(record.id)
    rebuildStyles()
  }
}

const shouldLoadNow = (record: CustomFontRecord) => record.scopes.some(scope => {
  if (scope === 'global' || scope.startsWith('system:')) return true
  return activeAppId !== null && scope === `app:${activeAppId}`
})

const loadRelevantFonts = async () => {
  await Promise.all(records.filter(record => record.enabled && shouldLoadNow(record)).map(loadFont))
  rebuildStyles()
}

const initialize = async () => {
  if (initialized.value) return
  records.splice(0, records.length, ...readMeta())
  initialized.value = true
  await loadRelevantFonts()
}

const setActiveApp = async (appId: string | null) => {
  activeAppId = appId
  if (appId) document.body.dataset.activeFontApp = appId
  else delete document.body.dataset.activeFontApp
  if (!initialized.value) await initialize()
  await loadRelevantFonts()
}

const addFont = async (blob: Blob, options: { name: string; fileName: string; sourceType: FontSourceType; sourceUrl?: string; scopes: string[] }) => {
  if (!blob.size) throw new Error('字体文件为空')
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate()
    const available = Math.max(0, (estimate.quota || 0) - (estimate.usage || 0))
    if (estimate.quota && available < blob.size * 1.15) throw new Error('本机存储空间不足，无法保存该字体')
  }
  const format = await detectFormat(blob)
  const id = makeId()
  const now = Date.now()
  const record: CustomFontRecord = {
    id,
    name: options.name.trim() || options.fileName.replace(/\.[^.]+$/, '') || '自定义字体',
    fileName: options.fileName,
    family: `ClingyCustomFont_${id.replace(/[^a-zA-Z0-9_]/g, '_')}`,
    format,
    size: blob.size,
    sourceType: options.sourceType,
    sourceUrl: options.sourceUrl,
    scopes: options.scopes.length ? [...new Set(options.scopes)] : ['global'],
    enabled: true,
    createdAt: now,
    updatedAt: now
  }
  await fontStore.setItem(id, blob)
  records.push(record)
  saveMeta()
  await loadFont(record)
  return record
}

const updateFont = async (id: string, changes: Partial<Pick<CustomFontRecord, 'name' | 'scopes' | 'enabled'>>) => {
  const record = records.find(item => item.id === id)
  if (!record) return
  if (typeof changes.name === 'string') record.name = changes.name.trim() || record.name
  if (changes.scopes) record.scopes = [...new Set(changes.scopes.length ? changes.scopes : ['global'])]
  if (typeof changes.enabled === 'boolean') record.enabled = changes.enabled
  record.updatedAt = Date.now()
  saveMeta()
  if (!record.enabled) {
    const face = loadedFaces.get(record.id)
    if (face) document.fonts.delete(face)
    loadedFaces.delete(record.id)
    loadedIds.delete(record.id)
  }
  if (record.enabled && shouldLoadNow(record)) await loadFont(record)
  rebuildStyles()
}

const removeFont = async (id: string) => {
  await fontStore.removeItem(id)
  const index = records.findIndex(item => item.id === id)
  if (index >= 0) records.splice(index, 1)
  const face = loadedFaces.get(id)
  if (face) document.fonts.delete(face)
  loadedFaces.delete(id)
  loadedIds.delete(id)
  loadingIds.delete(id)
  delete errors[id]
  saveMeta()
  rebuildStyles()
}

const downloadFont = async (url: string, onProgress?: (progress: number | null) => void) => {
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new Error('请输入完整有效的 URL') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('仅支持 http 或 https 字体地址')

  let response: Response
  try {
    response = await fetch(parsed.toString(), { mode: 'cors', credentials: 'omit' })
  } catch {
    throw new Error('图床禁止跨域读取，建议下载字体后使用本地上传')
  }
  if (!response.ok) throw new Error(`远程地址返回 ${response.status}，字体无法导入`)
  const contentType = (response.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('text/html') || contentType.includes('application/json') || contentType.startsWith('image/')) {
    throw new Error('该地址返回的不是字体文件，请使用字体直链')
  }

  const total = Number(response.headers.get('content-length') || 0)
  if (!response.body) {
    const blob = await response.blob()
    onProgress?.(100)
    return blob
  }
  const reader = response.body.getReader()
  const chunks: ArrayBuffer[] = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(new Uint8Array(value).buffer as ArrayBuffer)
    received += value.byteLength
    onProgress?.(total > 0 ? Math.min(99, Math.round(received / total * 100)) : null)
  }
  onProgress?.(100)
  return new Blob(chunks, { type: contentType || 'application/octet-stream' })
}

const formatSize = (size: number) => size >= 1024 * 1024
  ? `${(size / 1024 / 1024).toFixed(size >= 10 * 1024 * 1024 ? 1 : 2)} MB`
  : `${Math.max(1, Math.round(size / 1024))} KB`

export const useCustomFonts = () => ({
  records,
  loadedIds,
  loadingIds,
  errors,
  initialized,
  initialize,
  setActiveApp,
  addFont,
  updateFont,
  removeFont,
  downloadFont,
  detectFormat,
  formatSize
})
