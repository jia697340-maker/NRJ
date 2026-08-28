/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, ref } from 'vue'
import localforage from 'localforage'

export type FontSourceType = 'local' | 'url'
export type FontFormat = 'woff2' | 'woff' | 'ttf' | 'otf'
export type FontSystemArea = 'desktop' | 'lockscreen'
export type FontDownloadPhase = 'connecting' | 'downloading'

export interface CustomFontRecord {
  id: string
  name: string
  fileName: string
  family: string
  format: FontFormat
  size: number
  sourceType: FontSourceType
  sourceUrl?: string
  normalizedSourceUrl?: string
  etag?: string
  lastModified?: string
  downloadedAt?: number
  scopes: string[]
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface FontDownloadProgress {
  phase: FontDownloadPhase
  loadedBytes: number
  totalBytes: number | null
  percent: number | null
}

export interface DownloadedFont {
  blob: Blob
  normalizedUrl: string
  finalUrl: string
  etag?: string
  lastModified?: string
}

export interface ExistingUrlFont {
  record: CustomFontRecord
  available: boolean
}

type FontMetadata = Pick<CustomFontRecord, 'name' | 'fileName' | 'sourceType' | 'sourceUrl' | 'normalizedSourceUrl' | 'etag' | 'lastModified'>

const META_KEY = 'clingy_custom_fonts'
const STYLE_ID = 'clingy-custom-font-rules'
const CONNECTION_TIMEOUT_MS = 20_000
const STALL_TIMEOUT_MS = 30_000
const PROGRESS_INTERVAL_MS = 100
const fontStore = localforage.createInstance({ name: 'nrt-app', storeName: 'customFonts' })
const records = reactive<CustomFontRecord[]>([])
const loadedIds = reactive(new Set<string>())
const loadingIds = reactive(new Set<string>())
const errors = reactive<Record<string, string>>({})
const initialized = ref(false)
const loadedFaces = new Map<string, FontFace>()
const loadPromises = new Map<string, Promise<void>>()
const loadGenerations = new Map<string, number>()
let initializationPromise: Promise<void> | null = null
let activeAppId: string | null = null
let activeSystemArea: FontSystemArea = 'desktop'
let preloadHandle: number | ReturnType<typeof setTimeout> | null = null
let preloadUsesIdleCallback = false
let preloadRunning = false

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
  if (globalFont) rules.push(`${textDescendants('body')} { ${declarations(globalFont)} }`)

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

const normalizeSourceUrl = (url: string) => {
  let parsed: URL
  try { parsed = new URL(url.trim()) } catch { throw new Error('请输入完整有效的 URL') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('仅支持 http 或 https 字体地址')
  parsed.hash = ''
  return parsed.toString()
}

const makeId = () => `font_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const nextGeneration = (id: string) => {
  const next = (loadGenerations.get(id) || 0) + 1
  loadGenerations.set(id, next)
  return next
}

const removeLoadedFace = (id: string) => {
  const face = loadedFaces.get(id)
  if (face) document.fonts.delete(face)
  loadedFaces.delete(id)
  loadedIds.delete(id)
}

const shouldLoadNow = (record: CustomFontRecord) => record.scopes.some(scope => {
  if (scope === 'global') return true
  if (scope === `system:${activeSystemArea}`) return true
  return activeAppId !== null && scope === `app:${activeAppId}`
})

const loadFont = (record: CustomFontRecord, providedBlob?: Blob, retry = false): Promise<void> => {
  if (!record.enabled || loadedIds.has(record.id)) return Promise.resolve()
  const existingPromise = loadPromises.get(record.id)
  if (existingPromise) return existingPromise
  if (errors[record.id] && !retry) return Promise.resolve()

  const generation = loadGenerations.get(record.id) || 0
  loadingIds.add(record.id)
  if (retry) delete errors[record.id]

  const promise = (async () => {
    let objectUrl: string | null = null
    try {
      const blob = providedBlob || await fontStore.getItem<Blob>(record.id)
      if (!blob) throw new Error('本机字体文件已丢失')
      objectUrl = URL.createObjectURL(blob)
      const face = new FontFace(record.family, `url("${objectUrl}") format("${record.format}")`, { display: 'swap' })
      await face.load()

      const current = records.find(item => item.id === record.id)
      if (!current || !current.enabled || (loadGenerations.get(record.id) || 0) !== generation) return
      removeLoadedFace(record.id)
      document.fonts.add(face)
      loadedFaces.set(record.id, face)
      loadedIds.add(record.id)
      delete errors[record.id]
    } catch (error) {
      if ((loadGenerations.get(record.id) || 0) === generation && records.some(item => item.id === record.id)) {
        errors[record.id] = error instanceof Error ? error.message : '字体加载失败'
      }
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      loadingIds.delete(record.id)
      loadPromises.delete(record.id)
      rebuildStyles()
    }
  })()

  loadPromises.set(record.id, promise)
  return promise
}

const loadRelevantFonts = async () => {
  await Promise.all(records.filter(record => record.enabled && shouldLoadNow(record)).map(record => loadFont(record)))
  rebuildStyles()
}

const initialize = async () => {
  if (initializationPromise) return initializationPromise
  if (initialized.value) return
  initializationPromise = (async () => {
    records.splice(0, records.length, ...readMeta())
    initialized.value = true
    await loadRelevantFonts()
  })().finally(() => { initializationPromise = null })
  return initializationPromise
}

const setFontContext = async (appId: string | null, systemArea: FontSystemArea) => {
  activeAppId = appId
  activeSystemArea = systemArea
  if (appId) document.body.dataset.activeFontApp = appId
  else delete document.body.dataset.activeFontApp
  if (!initialized.value) await initialize()
  else await loadRelevantFonts()
}

const setActiveApp = async (appId: string | null) => setFontContext(appId, activeSystemArea)

const setActiveSystemArea = async (area: FontSystemArea) => setFontContext(activeAppId, area)

const ensureStorageAvailable = async (size: number) => {
  if (!size || !navigator.storage?.estimate) return
  const estimate = await navigator.storage.estimate()
  const available = Math.max(0, (estimate.quota || 0) - (estimate.usage || 0))
  if (estimate.quota && available < size * 1.15) throw new Error('本机存储空间不足，无法保存该字体')
}

const requestPersistentStorage = async () => {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

const addFont = async (blob: Blob, options: FontMetadata & { scopes: string[]; onPhase?: (phase: 'saving' | 'loading') => void }) => {
  if (!blob.size) throw new Error('字体文件为空')
  await ensureStorageAvailable(blob.size)
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
    normalizedSourceUrl: options.normalizedSourceUrl,
    etag: options.etag,
    lastModified: options.lastModified,
    downloadedAt: options.sourceType === 'url' ? now : undefined,
    scopes: options.scopes.length ? [...new Set(options.scopes)] : ['global'],
    enabled: true,
    createdAt: now,
    updatedAt: now
  }

  options.onPhase?.('saving')
  await fontStore.setItem(id, blob)
  records.push(record)
  try {
    saveMeta()
    options.onPhase?.('loading')
    await loadFont(record, blob, true)
    if (errors[record.id]) throw new Error(errors[record.id])
    return record
  } catch (error) {
    nextGeneration(id)
    removeLoadedFace(id)
    const index = records.findIndex(item => item.id === id)
    if (index >= 0) records.splice(index, 1)
    delete errors[id]
    await fontStore.removeItem(id).catch(() => undefined)
    try { saveMeta() } catch { /* 原始保存错误优先返回 */ }
    throw error
  }
}

const replaceFont = async (id: string, blob: Blob, metadata: FontMetadata & { onPhase?: (phase: 'saving' | 'loading') => void }) => {
  const record = records.find(item => item.id === id)
  if (!record) throw new Error('要更新的字体记录不存在')
  if (!blob.size) throw new Error('字体文件为空')
  await ensureStorageAvailable(blob.size)
  const format = await detectFormat(blob)
  metadata.onPhase?.('loading')
  const objectUrl = URL.createObjectURL(blob)
  let replacementFace: FontFace
  try {
    replacementFace = new FontFace(record.family, `url("${objectUrl}") format("${format}")`, { display: 'swap' })
    await replacementFace.load()
  } catch {
    throw new Error('远程文件无法作为字体加载，原字体已保留')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }

  const oldBlob = await fontStore.getItem<Blob>(id)
  const oldRecord = { ...record, scopes: [...record.scopes] }
  metadata.onPhase?.('saving')
  await fontStore.setItem(id, blob)
  try {
    record.name = metadata.name.trim() || record.name
    record.fileName = metadata.fileName || record.fileName
    record.format = format
    record.size = blob.size
    record.sourceType = metadata.sourceType
    record.sourceUrl = metadata.sourceUrl
    record.normalizedSourceUrl = metadata.normalizedSourceUrl
    record.etag = metadata.etag
    record.lastModified = metadata.lastModified
    record.downloadedAt = Date.now()
    record.updatedAt = Date.now()
    saveMeta()
  } catch (error) {
    Object.assign(record, oldRecord)
    if (oldBlob) await fontStore.setItem(id, oldBlob)
    else await fontStore.removeItem(id)
    throw error
  }

  nextGeneration(id)
  removeLoadedFace(id)
  delete errors[id]
  if (record.enabled) {
    document.fonts.add(replacementFace)
    loadedFaces.set(id, replacementFace)
    loadedIds.add(id)
  }
  rebuildStyles()
  return record
}

const updateFont = async (id: string, changes: Partial<Pick<CustomFontRecord, 'name' | 'scopes' | 'enabled'>>) => {
  const record = records.find(item => item.id === id)
  if (!record) return
  const previous = { ...record, scopes: [...record.scopes] }
  if (typeof changes.name === 'string') record.name = changes.name.trim() || record.name
  if (changes.scopes) record.scopes = [...new Set(changes.scopes.length ? changes.scopes : ['global'])]
  if (typeof changes.enabled === 'boolean') record.enabled = changes.enabled
  record.updatedAt = Date.now()
  try {
    saveMeta()
  } catch (error) {
    Object.assign(record, previous)
    throw error
  }
  if (!record.enabled) {
    nextGeneration(record.id)
    removeLoadedFace(record.id)
  } else if (typeof changes.enabled === 'boolean') {
    delete errors[record.id]
  }
  if (record.enabled && shouldLoadNow(record)) {
    await loadFont(record, undefined, typeof changes.enabled === 'boolean')
    // 若字体在“停用中的旧加载任务”结束前被重新启用，继续完成一次有效加载。
    if (record.enabled && !loadedIds.has(record.id) && !loadingIds.has(record.id) && !errors[record.id]) {
      await loadFont(record, undefined, true)
    }
  } else if (record.enabled && !loadedIds.has(record.id)) {
    // 在设置页重新启用或改到其他 App scope 时，也加入空闲预热队列。
    void schedulePreloadEnabledFonts()
  }
  rebuildStyles()
}

const retryFont = async (id: string) => {
  const record = records.find(item => item.id === id)
  if (!record || !record.enabled) return
  delete errors[id]
  await loadFont(record, undefined, true)
}

const removeFont = async (id: string) => {
  const blob = await fontStore.getItem<Blob>(id)
  const index = records.findIndex(item => item.id === id)
  const record = index >= 0 ? records[index] : undefined
  await fontStore.removeItem(id)
  nextGeneration(id)
  if (index >= 0) records.splice(index, 1)
  try {
    saveMeta()
  } catch (error) {
    if (record) records.splice(index, 0, record)
    if (blob) await fontStore.setItem(id, blob)
    throw error
  }
  removeLoadedFace(id)
  loadingIds.delete(id)
  delete errors[id]
  rebuildStyles()
}

const findExistingUrlFont = async (url: string): Promise<ExistingUrlFont | null> => {
  const normalized = normalizeSourceUrl(url)
  const record = records.find(item => {
    if (item.sourceType !== 'url' || !item.sourceUrl) return false
    try { return (item.normalizedSourceUrl || normalizeSourceUrl(item.sourceUrl)) === normalized } catch { return false }
  })
  if (!record) return null
  const available = !!(await fontStore.getItem<Blob>(record.id))
  if (!available) errors[record.id] = '本机字体文件已丢失'
  return { record, available }
}

const downloadFont = async (url: string, options: {
  signal?: AbortSignal
  onProgress?: (progress: FontDownloadProgress) => void
} = {}): Promise<DownloadedFont> => {
  const normalizedUrl = normalizeSourceUrl(url)
  const controller = new AbortController()
  let timeoutKind: 'connection' | 'stall' | null = null
  let connectionTimer: ReturnType<typeof setTimeout> | undefined
  let stallTimer: ReturnType<typeof setTimeout> | undefined
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let lastProgressAt = 0

  const abortFromCaller = () => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) abortFromCaller()
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true })

  const abortAfter = (kind: 'connection' | 'stall') => {
    timeoutKind = kind
    controller.abort()
  }
  const resetStallTimer = () => {
    if (stallTimer) clearTimeout(stallTimer)
    stallTimer = setTimeout(() => abortAfter('stall'), STALL_TIMEOUT_MS)
  }

  const emitProgress = (progress: FontDownloadProgress, force = false) => {
    const now = performance.now()
    if (!force && now - lastProgressAt < PROGRESS_INTERVAL_MS) return
    lastProgressAt = now
    options.onProgress?.(progress)
  }

  try {
    emitProgress({ phase: 'connecting', loadedBytes: 0, totalBytes: null, percent: null }, true)
    connectionTimer = setTimeout(() => abortAfter('connection'), CONNECTION_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(normalizedUrl, { mode: 'cors', credentials: 'omit', signal: controller.signal })
    } catch (error) {
      if (controller.signal.aborted) throw error
      throw new Error('无法读取远程字体，可能是网络异常或服务器不允许跨域读取')
    } finally {
      if (connectionTimer) clearTimeout(connectionTimer)
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined)
      throw new Error(`远程地址返回 ${response.status}，字体无法导入`)
    }
    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    if (contentType.includes('text/html') || contentType.includes('application/json') || contentType.startsWith('image/')) {
      await response.body?.cancel().catch(() => undefined)
      throw new Error('该地址返回的不是字体文件，请使用字体直链')
    }

    const rawTotal = Number(response.headers.get('content-length') || 0)
    let total = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : null
    if (total) await ensureStorageAvailable(total)
    emitProgress({ phase: 'downloading', loadedBytes: 0, totalBytes: total, percent: total ? 0 : null }, true)

    let blob: Blob
    if (!response.body) {
      blob = await response.blob()
      emitProgress({ phase: 'downloading', loadedBytes: blob.size, totalBytes: total, percent: 100 }, true)
    } else {
      reader = response.body.getReader()
      const chunks: BlobPart[] = []
      let received = 0
      resetStallTimer()
      while (true) {
        let result: ReadableStreamReadResult<Uint8Array>
        try {
          result = await reader.read()
        } catch (error) {
          if (controller.signal.aborted) throw error
          throw new Error('字体下载中断，请检查网络后重试')
        }
        const { done, value } = result
        if (done) break
        resetStallTimer()
        chunks.push(value as Uint8Array<ArrayBuffer>)
        received += value.byteLength
        if (total && received > total) total = null
        const percent = total ? Math.min(99, Math.round(received / total * 100)) : null
        emitProgress({ phase: 'downloading', loadedBytes: received, totalBytes: total, percent })
      }
      blob = new Blob(chunks, { type: contentType || 'application/octet-stream' })
      emitProgress({ phase: 'downloading', loadedBytes: blob.size, totalBytes: total, percent: 100 }, true)
    }

    await ensureStorageAvailable(blob.size)
    return {
      blob,
      normalizedUrl,
      finalUrl: response.url || normalizedUrl,
      etag: response.headers.get('etag') || undefined,
      lastModified: response.headers.get('last-modified') || undefined
    }
  } catch (error) {
    if (controller.signal.aborted) {
      if (timeoutKind === 'connection') throw new Error('服务器长时间未响应，请稍后重试')
      if (timeoutKind === 'stall') throw new Error('下载长时间没有进度，请检查网络后重试')
      throw new DOMException('已取消导入', 'AbortError')
    }
    if (error instanceof Error) throw error
    throw new Error('字体下载中断，请重试')
  } finally {
    if (connectionTimer) clearTimeout(connectionTimer)
    if (stallTimer) clearTimeout(stallTimer)
    options.signal?.removeEventListener('abort', abortFromCaller)
    try { reader?.releaseLock() } catch { /* reader 已结束 */ }
  }
}

const clearPreloadHandle = () => {
  if (preloadHandle === null) return
  if (preloadUsesIdleCallback && 'cancelIdleCallback' in window) window.cancelIdleCallback(preloadHandle as number)
  else clearTimeout(preloadHandle as ReturnType<typeof setTimeout>)
  preloadHandle = null
}

const preloadScore = (record: CustomFontRecord) => {
  const formatScore = record.format === 'woff2' ? 0 : record.format === 'woff' ? 1 : 2
  const commonAppScore = record.scopes.some(scope => ['app:chat', 'app:messages', 'app:forum'].includes(scope)) ? 0 : 1
  return formatScore * 1_000_000_000 + commonAppScore * 100_000_000 + record.size
}

const schedulePreloadEnabledFonts = async () => {
  await initialize()
  clearPreloadHandle()

  const runNext = async () => {
    preloadHandle = null
    if (preloadRunning) {
      scheduleNext()
      return
    }
    const record = records
      .filter(item => item.enabled && !loadedIds.has(item.id) && !loadingIds.has(item.id) && !errors[item.id])
      .sort((a, b) => preloadScore(a) - preloadScore(b))[0]
    if (!record) return
    preloadRunning = true
    try {
      await loadFont(record)
    } finally {
      preloadRunning = false
      scheduleNext()
    }
  }

  const scheduleNext = () => {
    if (preloadHandle !== null) return
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
    }
    if (idleWindow.requestIdleCallback) {
      preloadUsesIdleCallback = true
      preloadHandle = idleWindow.requestIdleCallback(() => { void runNext() }, { timeout: 2500 })
    } else {
      preloadUsesIdleCallback = false
      preloadHandle = setTimeout(() => { void runNext() }, 350)
    }
  }

  scheduleNext()
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
  setActiveSystemArea,
  setFontContext,
  schedulePreloadEnabledFonts,
  addFont,
  replaceFont,
  updateFont,
  retryFont,
  removeFont,
  findExistingUrlFont,
  downloadFont,
  requestPersistentStorage,
  normalizeSourceUrl,
  detectFormat,
  formatSize
})
