/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive } from 'vue'
import localforage from 'localforage'
import JSZip from 'jszip'

export type BubbleShape = 'rounded' | 'capsule' | 'cloud' | 'comic' | 'ticket' | 'custom'
export type BubbleAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'free'
export type BubbleExportFormat = 'nrjbubble' | 'zip' | 'json-full' | 'json-light'

export interface BubbleOrnament {
  id: string
  assetId: string
  name: string
  anchor: BubbleAnchor
  offsetX: number
  offsetY: number
  size: number
  rotation: number
  opacity: number
  zIndex: number
}

export interface BubbleSideStyle {
  background: string
  gradientEnd: string
  gradientAngle: number
  textColor: string
  borderColor: string
  borderWidth: number
  borderStyle: 'solid' | 'dashed' | 'none'
  radius: number
  corner: number
  paddingX: number
  paddingY: number
  fontSize: number
  lineHeight: number
  maxWidth: number
  shadowColor: string
  shadowBlur: number
  shadowY: number
  opacity: number
  blur: number
  shape: BubbleShape
  customClipPath: string
  backgroundImageId: string
  backgroundFit: 'cover' | 'contain' | 'stretch' | 'tile'
  backgroundPositionX: number
  backgroundPositionY: number
  backgroundOpacity: number
  frameImageId: string
  frameSliceTop: number
  frameSliceRight: number
  frameSliceBottom: number
  frameSliceLeft: number
  frameWidth: number
  maskImageId: string
  tailType: 'none' | 'triangle' | 'image'
  tailImageId: string
  tailPosition: 'top' | 'middle' | 'bottom'
  tailSize: number
  tailOffset: number
  ornaments: BubbleOrnament[]
}

export interface BubblePreset {
  id: string
  name: string
  description: string
  source: 'created' | 'imported' | 'system'
  self: BubbleSideStyle
  other: BubbleSideStyle
  customCss: string
  createdAt: number
  updatedAt: number
}

export interface BubbleAssetRecord {
  id: string
  name: string
  mime: string
  size: number
  dataUrl: string
  createdAt: number
}

interface BubbleWorkshopState {
  presets: BubblePreset[]
  globalPresetId: string
  chatPresetIds: Record<string, string>
}

interface BubbleTransfer {
  format: 'nrj-bubble'
  schemaVersion: 2
  exportedAt: number
  presets: BubblePreset[]
  assets: BubbleAssetRecord[]
}

const STORAGE_KEY = 'clingy_bubble_workshop_v2'
const OLD_STORAGE_KEY = 'clingy_bubble_workshop'
const LEGACY_KEY = 'clingy_bubble_settings'
const assetStore = localforage.createInstance({ name: 'nrt-app', storeName: 'bubbleAssets' })

export const DEFAULT_BUBBLE_CSS = `/* 系统原始气泡公开选择器 */
.chat-bubble-theme [data-chat-bubble="self"],
.chat-bubble-theme [data-chat-bubble="other"] {
  width: fit-content;
  max-width: 100%;
  padding: 8px 12px;
  color: var(--text-primary);
  background: transparent;
  border: 1px dashed #bbbbbb;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.chat-bubble-theme [data-chat-bubble="self"] { border-top-right-radius: 4px; }
.chat-bubble-theme [data-chat-bubble="other"] { border-top-left-radius: 4px; }`

export const DEFAULT_SIDE_STYLE: BubbleSideStyle = {
  background: 'transparent', gradientEnd: '', gradientAngle: 135,
  textColor: 'var(--text-primary)', borderColor: '#bbbbbb', borderWidth: 1, borderStyle: 'dashed',
  radius: 14, corner: 4, paddingX: 12, paddingY: 8, fontSize: 14, lineHeight: 1.5, maxWidth: 100,
  shadowColor: 'rgba(0,0,0,.12)', shadowBlur: 0, shadowY: 0, opacity: 1, blur: 0,
  shape: 'rounded', customClipPath: '',
  backgroundImageId: '', backgroundFit: 'cover', backgroundPositionX: 50, backgroundPositionY: 50, backgroundOpacity: 1,
  frameImageId: '', frameSliceTop: 24, frameSliceRight: 24, frameSliceBottom: 24, frameSliceLeft: 24, frameWidth: 16,
  maskImageId: '', tailType: 'none', tailImageId: '', tailPosition: 'top', tailSize: 12, tailOffset: 10,
  ornaments: []
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const makeSide = (value: Partial<BubbleSideStyle> = {}): BubbleSideStyle => ({
  ...clone(DEFAULT_SIDE_STYLE), ...value,
  ornaments: Array.isArray(value.ornaments) ? value.ornaments.map(item => ({ ...item })) : []
})

export const SYSTEM_BUBBLE_PRESET: BubblePreset = {
  id: '__system__', name: '系统原样', description: '', source: 'system',
  self: makeSide(), other: makeSide(), customCss: '', createdAt: 0, updatedAt: 0
}

const normalizePreset = (value: Partial<BubblePreset>, source?: 'created' | 'imported'): BubblePreset => ({
  id: String(value.id || `bubble-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
  name: String(value.name || '未命名气泡').slice(0, 40),
  description: String(value.description || '').slice(0, 120),
  source: source || (value.source === 'imported' ? 'imported' : 'created'),
  self: makeSide(value.self), other: makeSide(value.other), customCss: String(value.customCss || ''),
  createdAt: Number(value.createdAt || Date.now()), updatedAt: Number(value.updatedAt || Date.now())
})

const migrateOldState = (): BubbleWorkshopState => {
  try {
    const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || 'null')
    const customs: BubblePreset[] = Array.isArray(old?.customPresets)
      ? old.customPresets.filter((item: any) => !item.builtIn).map((item: any) => normalizePreset(item, 'created'))
      : []
    if (customs.length) {
      const ids = new Set(customs.map(item => item.id))
      return {
        presets: customs,
        globalPresetId: ids.has(old.globalPresetId) ? old.globalPresetId : '',
        chatPresetIds: Object.fromEntries(Object.entries(old.chatPresetIds || {}).filter(([, id]) => ids.has(String(id)))) as Record<string, string>
      }
    }
  } catch {}
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null')
    if (legacy && legacy.preset && legacy.preset !== 'default') {
      const migrated = normalizePreset({
        name: '导入的原气泡', source: 'imported',
        self: makeSide({ background: legacy.selfBgColor, textColor: legacy.selfTextColor, radius: parseInt(legacy.selfRadius) || 8 }),
        other: makeSide({ background: legacy.otherBgColor, textColor: legacy.otherTextColor, radius: parseInt(legacy.otherRadius) || 8 }),
        customCss: legacy.customCss || ''
      }, 'imported')
      return { presets: [migrated], globalPresetId: migrated.id, chatPresetIds: {} }
    }
  } catch {}
  return { presets: [], globalPresetId: '', chatPresetIds: {} }
}

const readState = (): BubbleWorkshopState => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved) {
      const presets: BubblePreset[] = Array.isArray(saved.presets)
        ? saved.presets
            .filter((item: BubblePreset & { builtIn?: boolean }) => item.source !== 'system' && !item.builtIn)
            .map((item: BubblePreset) => normalizePreset(item))
        : []
      const ids = new Set(presets.map(item => item.id))
      return {
        presets,
        globalPresetId: ids.has(saved.globalPresetId) ? saved.globalPresetId : '',
        chatPresetIds: Object.fromEntries(Object.entries(saved.chatPresetIds || {}).filter(([, id]) => ids.has(String(id)))) as Record<string, string>
      }
    }
  } catch {}
  return migrateOldState()
}

export const bubbleWorkshopState = reactive<BubbleWorkshopState>(readState())
export const bubbleAssetUrls = reactive<Record<string, string>>({})

const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(bubbleWorkshopState))
const presetById = (id?: string | null) => bubbleWorkshopState.presets.find(item => item.id === id)

export function getAllBubblePresets() { return bubbleWorkshopState.presets.map(clone) }
export function getBubblePreset(id?: string | null) { return clone(presetById(id) || SYSTEM_BUBBLE_PRESET) }
export function getEffectiveBubblePreset(chatId?: string | number | null) {
  const assigned = chatId == null ? '' : bubbleWorkshopState.chatPresetIds[String(chatId)]
  return getBubblePreset(assigned || bubbleWorkshopState.globalPresetId)
}

export function createBubblePreset(source?: BubblePreset, name = '我的气泡') {
  const now = Date.now()
  const preset = normalizePreset({ ...(source || SYSTEM_BUBBLE_PRESET), id: `bubble-${now}-${Math.random().toString(36).slice(2, 7)}`, name, source: 'created', createdAt: now, updatedAt: now })
  bubbleWorkshopState.presets.unshift(preset); persist(); return clone(preset)
}

export function saveBubblePreset(value: BubblePreset) {
  const preset = normalizePreset({ ...value, source: value.source === 'imported' ? 'imported' : 'created', updatedAt: Date.now() })
  const index = bubbleWorkshopState.presets.findIndex(item => item.id === preset.id)
  if (index >= 0) bubbleWorkshopState.presets[index] = preset
  else bubbleWorkshopState.presets.unshift(preset)
  persist(); return clone(preset)
}

export function duplicateBubblePreset(id: string) { return createBubblePreset(getBubblePreset(id), `${getBubblePreset(id).name} 副本`) }
export function deleteBubblePreset(id: string) {
  const index = bubbleWorkshopState.presets.findIndex(item => item.id === id)
  if (index < 0) return false
  bubbleWorkshopState.presets.splice(index, 1)
  if (bubbleWorkshopState.globalPresetId === id) bubbleWorkshopState.globalPresetId = ''
  Object.keys(bubbleWorkshopState.chatPresetIds).forEach(key => { if (bubbleWorkshopState.chatPresetIds[key] === id) delete bubbleWorkshopState.chatPresetIds[key] })
  persist(); return true
}
export function setGlobalBubblePreset(id: string | null) { bubbleWorkshopState.globalPresetId = presetById(id)?.id || ''; persist() }
export function setChatBubblePreset(chatId: string | number, id: string | null) {
  const key = String(chatId)
  if (id && presetById(id)) bubbleWorkshopState.chatPresetIds[key] = id
  else delete bubbleWorkshopState.chatPresetIds[key]
  persist()
}

const fileToDataUrl = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = reject; reader.readAsDataURL(file)
})
export async function saveBubbleAsset(file: File) {
  if (!/^image\/(png|webp|gif|apng|svg\+xml|jpeg)$/i.test(file.type)) throw new Error('请选择 PNG、WebP、GIF、APNG、SVG 或 JPG 图片')
  if (file.size > 8 * 1024 * 1024) throw new Error('单个素材不能超过 8MB')
  const record: BubbleAssetRecord = { id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: file.name, mime: file.type, size: file.size, dataUrl: await fileToDataUrl(file), createdAt: Date.now() }
  await assetStore.setItem(record.id, record); bubbleAssetUrls[record.id] = record.dataUrl; return record
}
export async function getBubbleAsset(id: string) {
  if (!id) return null
  const record = await assetStore.getItem<BubbleAssetRecord>(id)
  if (record?.dataUrl) bubbleAssetUrls[id] = record.dataUrl
  return record
}
export async function removeBubbleAsset(id: string) { delete bubbleAssetUrls[id]; await assetStore.removeItem(id) }

export function collectBubbleAssetIds(preset: BubblePreset) {
  const ids = new Set<string>()
  ;(['self', 'other'] as const).forEach(key => {
    const side = preset[key]
    ;[side.backgroundImageId, side.frameImageId, side.maskImageId, side.tailImageId].filter(Boolean).forEach(id => ids.add(id))
    side.ornaments.forEach(item => item.assetId && ids.add(item.assetId))
  })
  return [...ids]
}
export async function hydrateBubblePresetAssets(preset: BubblePreset) { await Promise.all(collectBubbleAssetIds(preset).map(getBubbleAsset)) }

const safeColor = (value: string, fallback: string) => {
  const color = String(value || '').trim()
  return /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|transparent|var\(--[\w-]+\))$/i.test(color) ? color : fallback
}
const num = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number(value) || 0))
const shapePath = (side: BubbleSideStyle) => {
  if (side.shape === 'cloud') return 'polygon(8% 17%,20% 5%,35% 11%,48% 2%,63% 10%,78% 5%,93% 20%,97% 42%,92% 63%,98% 80%,83% 96%,64% 91%,48% 99%,31% 92%,13% 96%,3% 78%,8% 59%,2% 39%)'
  if (side.shape === 'comic') return 'polygon(5% 10%,28% 13%,38% 2%,51% 13%,72% 5%,78% 17%,97% 13%,91% 34%,99% 48%,90% 61%,97% 82%,76% 78%,67% 98%,51% 86%,35% 97%,29% 82%,6% 89%,12% 66%,1% 52%,11% 39%)'
  if (side.shape === 'ticket') return 'polygon(0 0,100% 0,100% 38%,96% 42%,100% 46%,100% 100%,0 100%,0 62%,4% 58%,0 54%)'
  if (side.shape === 'custom' && /^(polygon|path|circle|ellipse|inset)\(/.test(side.customClipPath.trim())) return side.customClipPath.trim()
  return 'none'
}

export function sanitizeBubbleCustomCss(css: string) {
  let value = String(css || '').replace(/@import[\s\S]*?;/gi, '').replace(/expression\s*\(/gi, '').replace(/url\s*\(\s*(['"]?)javascript:[\s\S]*?\)/gi, 'none')
  return value.replace(/([^{}]+)\{([^{}]*)\}/g, (_rule, rawSelector: string, declarations: string) => {
    const selectors = rawSelector.trim().split(',').map(item => item.trim()).filter(Boolean)
    if (!selectors.length || selectors.some(item => !/\[data-(?:chat-bubble|bubble-part)=/i.test(item))) return ''
    return `${selectors.map(item => item.includes('.chat-bubble-theme') ? item : `.chat-bubble-theme ${item}`).join(',')} {${declarations}}`
  })
}
export function validateBubbleCss(css: string) {
  let depth = 0
  for (const char of css) { if (char === '{') depth++; if (char === '}') depth--; if (depth < 0) return '存在多余的右大括号' }
  if (depth) return '大括号没有完整闭合'
  if (/@import/i.test(css)) return '不支持 @import'
  if (/javascript\s*:/i.test(css)) return '样式中包含不安全链接'
  return ''
}

const sideCss = (side: BubbleSideStyle, direction: 'self' | 'other') => {
  const image = bubbleAssetUrls[side.backgroundImageId]
  const frame = bubbleAssetUrls[side.frameImageId]
  const mask = bubbleAssetUrls[side.maskImageId]
  const tailImage = bubbleAssetUrls[side.tailImageId]
  const gradient = side.gradientEnd ? `linear-gradient(${num(side.gradientAngle, 0, 360)}deg,${safeColor(side.background, 'transparent')},${safeColor(side.gradientEnd, side.background)})` : safeColor(side.background, 'transparent')
  const fit = side.backgroundFit === 'stretch' ? '100% 100%' : side.backgroundFit === 'tile' ? 'auto' : side.backgroundFit
  const repeat = side.backgroundFit === 'tile' ? 'repeat' : 'no-repeat'
  const radii = side.shape === 'capsule' ? '999px' : direction === 'self' ? `${side.radius}px ${side.corner}px ${side.radius}px ${side.radius}px` : `${side.corner}px ${side.radius}px ${side.radius}px ${side.radius}px`
  const clip = shapePath(side)
  const tailTop = side.tailPosition === 'top' ? `${side.tailOffset}px` : side.tailPosition === 'middle' ? '50%' : 'auto'
  const tailBottom = side.tailPosition === 'bottom' ? `${side.tailOffset}px` : 'auto'
  const tailSide = direction === 'self' ? 'right' : 'left'
  const tailBorder = direction === 'self' ? `border-left:${side.tailSize}px solid ${safeColor(side.background, 'transparent')}` : `border-right:${side.tailSize}px solid ${safeColor(side.background, 'transparent')}`
  return `
.chat-bubble-theme [data-chat-bubble="${direction}"]{position:relative;isolation:isolate;width:fit-content;max-width:${num(side.maxWidth,55,100)}%;padding:${num(side.paddingY,2,30)}px ${num(side.paddingX,2,36)}px;color:${safeColor(side.textColor,'var(--text-primary)')}!important;background:transparent!important;border:0!important;border-radius:${radii};box-shadow:none!important;font-size:${num(side.fontSize,10,24)}px;line-height:${num(side.lineHeight,1,2.2)};opacity:${num(side.opacity,.2,1)};overflow:visible!important;word-break:break-word}
.chat-bubble-theme [data-chat-bubble="${direction}"]::before{content:"";position:absolute;inset:0;z-index:-1;box-sizing:border-box;pointer-events:none;background:${image ? `linear-gradient(rgba(255,255,255,${1-num(side.backgroundOpacity,0,1)}),rgba(255,255,255,${1-num(side.backgroundOpacity,0,1)})),url("${image}"),` : ''}${gradient};background-size:${image ? `${fit},${fit},auto` : 'auto'};background-position:${side.backgroundPositionX}% ${side.backgroundPositionY}%;background-repeat:${repeat};border:${num(side.borderWidth,0,8)}px ${side.borderStyle} ${safeColor(side.borderColor,'transparent')};border-radius:${radii};box-shadow:0 ${num(side.shadowY,-20,30)}px ${num(side.shadowBlur,0,60)}px ${safeColor(side.shadowColor,'transparent')};backdrop-filter:blur(${num(side.blur,0,30)}px);clip-path:${clip};${mask ? `-webkit-mask-image:url("${mask}");mask-image:url("${mask}");-webkit-mask-size:100% 100%;mask-size:100% 100%;` : ''}${frame ? `border:${num(side.frameWidth,1,50)}px solid transparent;border-image-source:url("${frame}");border-image-slice:${side.frameSliceTop}% ${side.frameSliceRight}% ${side.frameSliceBottom}% ${side.frameSliceLeft}% fill;border-image-repeat:stretch;` : ''}}
.chat-bubble-theme [data-chat-bubble="${direction}"]::after{${side.tailType === 'none' ? 'content:none' : 'content:""'};position:absolute;z-index:-1;${tailSide}:-${side.tailSize-1}px;top:${tailTop};bottom:${tailBottom};width:${side.tailType === 'image' ? side.tailSize*1.5 : 0}px;height:${side.tailType === 'image' ? side.tailSize*1.5 : 0}px;${side.tailType === 'triangle' ? `border-top:${side.tailSize/2}px solid transparent;border-bottom:${side.tailSize/2}px solid transparent;${tailBorder};` : ''}${side.tailType === 'image' && tailImage ? `background:url("${tailImage}") center/contain no-repeat;` : ''}}
`
}
export function buildBubblePresetCss(preset: BubblePreset) { return `${sideCss(preset.self,'self')}\n${sideCss(preset.other,'other')}\n${sanitizeBubbleCustomCss(preset.customCss)}` }

export function getBubbleOrnamentStyle(item: BubbleOrnament) {
  const vertical = item.anchor.startsWith('top') ? { top: `${item.offsetY}px` } : item.anchor.startsWith('bottom') ? { bottom: `${item.offsetY}px` } : { top: `${item.offsetY}%` }
  const horizontal = item.anchor.endsWith('left') ? { left: `${item.offsetX}px` } : item.anchor.endsWith('right') ? { right: `${item.offsetX}px` } : { left: `${item.offsetX}%` }
  return { ...vertical, ...horizontal, width: `${item.size}px`, height: `${item.size}px`, opacity: item.opacity, zIndex: item.zIndex, transform: `rotate(${item.rotation}deg)`, pointerEvents: 'none' as const }
}

async function buildTransfer(preset: BubblePreset, includeAssets: boolean): Promise<BubbleTransfer> {
  const assets = includeAssets ? (await Promise.all(collectBubbleAssetIds(preset).map(getBubbleAsset))).filter(Boolean) as BubbleAssetRecord[] : []
  return { format: 'nrj-bubble', schemaVersion: 2, exportedAt: Date.now(), presets: [clone(preset)], assets }
}
export async function exportBubblePresetBlob(preset: BubblePreset, format: BubbleExportFormat) {
  const transfer = await buildTransfer(preset, format !== 'json-light')
  if (format === 'json-full' || format === 'json-light') return new Blob([JSON.stringify(transfer, null, 2)], { type: 'application/json' })
  const zip = new JSZip(); zip.file('manifest.json', JSON.stringify({ format: transfer.format, schemaVersion: 2, exportedAt: transfer.exportedAt }, null, 2)); zip.file('bubble.json', JSON.stringify({ presets: transfer.presets }, null, 2))
  const folder = zip.folder('assets')!
  transfer.assets.forEach(asset => folder.file(`${asset.id}.json`, JSON.stringify(asset)))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

const remapPresetAssets = (preset: BubblePreset, mapping: Record<string,string>) => {
  ;(['self','other'] as const).forEach(key => {
    const side = preset[key]
    ;(['backgroundImageId','frameImageId','maskImageId','tailImageId'] as const).forEach(field => { if (mapping[side[field]]) side[field] = mapping[side[field]] })
    side.ornaments.forEach(item => { if (mapping[item.assetId]) item.assetId = mapping[item.assetId] })
  })
}
async function importTransfer(transfer: BubbleTransfer) {
  if (transfer?.format !== 'nrj-bubble' || !Array.isArray(transfer.presets)) throw new Error('不是有效的气泡方案')
  const mapping: Record<string,string> = {}
  for (const asset of transfer.assets || []) {
    if (!asset.dataUrl?.startsWith('data:image/')) continue
    const newId = `asset-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; mapping[asset.id] = newId
    const record = { ...asset, id: newId, createdAt: Date.now() }; await assetStore.setItem(newId, record); bubbleAssetUrls[newId] = record.dataUrl
  }
  const imported: BubblePreset[] = []
  for (const raw of transfer.presets) {
    const preset = normalizePreset({ ...raw, id: `bubble-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, name: raw.name, source: 'imported', createdAt: Date.now(), updatedAt: Date.now() }, 'imported')
    remapPresetAssets(preset, mapping); bubbleWorkshopState.presets.unshift(preset); imported.push(clone(preset))
  }
  persist(); return imported
}
export async function importBubblePresetFile(file: File) {
  if (/\.json$/i.test(file.name)) return importTransfer(JSON.parse(await file.text()))
  if (!/\.(nrjbubble|zip)$/i.test(file.name)) throw new Error('请选择 .nrjbubble、.json 或 .zip 方案文件')
  const zip = await JSZip.loadAsync(file); const manifest = JSON.parse(await zip.file('manifest.json')?.async('string') || '{}'); const bubble = JSON.parse(await zip.file('bubble.json')?.async('string') || '{}')
  const assets: BubbleAssetRecord[] = []
  for (const name of Object.keys(zip.files).filter(name => /^assets\/.+\.json$/i.test(name))) assets.push(JSON.parse(await zip.file(name)!.async('string')))
  return importTransfer({ format: manifest.format, schemaVersion: manifest.schemaVersion, exportedAt: manifest.exportedAt, presets: bubble.presets, assets })
}

const decodeBase64 = (text: string) => new TextDecoder().decode(Uint8Array.from(atob(text), char => char.charCodeAt(0)))
const encodeCompressedQrTransfer = async (transfer: BubbleTransfer) => {
  const zip = new JSZip()
  zip.file('bubble', JSON.stringify(transfer))
  const data = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 9 } })
  return `nrjbubblez:${data}`
}
export async function createBubbleQrPayload(preset: BubblePreset) {
  const full = await buildTransfer(preset, true); let payload = await encodeCompressedQrTransfer(full)
  if (payload.length <= 2200) return { payload, complete: true }
  const light = await buildTransfer(preset, false); payload = await encodeCompressedQrTransfer(light)
  if (payload.length > 2200) throw new Error('当前方案内容过多，请使用方案文件分享')
  return { payload, complete: false }
}
export async function importBubbleQrPayload(payload: string) {
  if (payload.startsWith('nrjbubblez:')) {
    const zip = await JSZip.loadAsync(payload.slice('nrjbubblez:'.length), { base64: true })
    const content = await zip.file('bubble')?.async('string')
    if (!content) throw new Error('气泡分享二维码内容不完整')
    return importTransfer(JSON.parse(content))
  }
  if (payload.startsWith('nrjbubble:')) return importTransfer(JSON.parse(decodeBase64(payload.slice('nrjbubble:'.length))))
  throw new Error('不是有效的气泡分享二维码')
}
