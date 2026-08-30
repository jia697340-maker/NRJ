/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, readonly } from 'vue'

export const DESKTOP_COLUMNS = 4
export const DESKTOP_ROWS = 4
export type WidgetType = 'dual-avatar' | 'moment-card' | 'custom-image' | 'folder-widget'

export interface DesktopAppEntry { type: 'app'; id: string }
export interface DesktopFolderEntry { type: 'folder'; id: string; name: string; appIds: string[] }
export interface DesktopWidgetEntry { type: 'widget'; id: string; widgetType: WidgetType; widthUnits: number; heightUnits: number }
export type DesktopEntry = DesktopAppEntry | DesktopFolderEntry | DesktopWidgetEntry
export type DesktopDockEntry = DesktopAppEntry | DesktopFolderEntry
export type DesktopGridEntry = DesktopEntry & { column: number; row: number }
export interface DesktopPage { id: string; entries: DesktopGridEntry[] }
export interface DesktopLayoutState { version: 2; dock: DesktopDockEntry[]; pages: DesktopPage[]; hiddenAppIds: string[] }
export interface DesktopLocation {
  area: 'dock' | 'page' | 'folder'; index?: number; page?: number; pageId?: string
  folderId?: string; entryId?: string; column?: number; row?: number
}

const STORAGE_KEY = 'clingy_desktop_layout_v2'
const LEGACY_STORAGE_KEY = 'clingy_desktop_layout_v1'
const DOCK_CAPACITY = 4
const DEFAULT_PAGE_COUNT = 4
export const DEFAULT_WIDGET_IDS = { moment: 'widget-moment-default', dualAvatar: 'widget-dual-avatar-default' } as const
const THIRD_PAGE_APP_IDS = new Set(['widget_beautify', 'character_workshop', 'persona_workshop', 'bubble_dressup', 'character_phone', 'watch_together', 'timebox', 'mcp'])
const FOURTH_PAGE_APP_IDS = new Set(['text_game', 'keep_alive', 'appearance_wardrobe', 'book_store', 'game', 'bubble', 'mall', 'fate'])

const state = reactive<DesktopLayoutState>({ version: 2, dock: [], pages: [], hiddenAppIds: [] })
let initialized = false
let pageHideBound = false
let saveTimer: ReturnType<typeof setTimeout> | null = null
let batching = false
let batchDirty = false

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const pageId = () => makeId('page')
const spanOf = (entry: DesktopEntry) => entry.type === 'widget' ? { width: entry.widthUnits, height: entry.heightUnits } : { width: 1, height: 1 }
const cloneEntry = (entry: DesktopEntry): DesktopEntry => entry.type === 'app' ? { type: 'app', id: entry.id }
  : entry.type === 'folder' ? { type: 'folder', id: entry.id, name: entry.name, appIds: [...entry.appIds] }
    : { type: 'widget', id: entry.id, widgetType: entry.widgetType, widthUnits: entry.widthUnits, heightUnits: entry.heightUnits }
const cloneGridEntry = (entry: DesktopGridEntry): DesktopGridEntry => ({ ...cloneEntry(entry), column: entry.column, row: entry.row }) as DesktopGridEntry
const isInside = (entry: DesktopEntry, column: number, row: number) => {
  const { width, height } = spanOf(entry)
  return column >= 1 && row >= 1 && column + width - 1 <= DESKTOP_COLUMNS && row + height - 1 <= DESKTOP_ROWS
}
const overlaps = (a: DesktopGridEntry, b: DesktopGridEntry) => {
  const sa = spanOf(a), sb = spanOf(b)
  return a.column < b.column + sb.width && a.column + sa.width > b.column && a.row < b.row + sb.height && a.row + sa.height > b.row
}
const canPlace = (entries: DesktopGridEntry[], entry: DesktopEntry, column: number, row: number, ignoreId?: string) => {
  if (!isInside(entry, column, row)) return false
  const candidate = { ...entry, column, row } as DesktopGridEntry
  return entries.every(existing => existing.id === ignoreId || !overlaps(existing, candidate))
}
const findFirstPosition = (entries: DesktopGridEntry[], entry: DesktopEntry) => {
  for (let row = 1; row <= DESKTOP_ROWS; row++) for (let column = 1; column <= DESKTOP_COLUMNS; column++) {
    if (canPlace(entries, entry, column, row)) return { column, row }
  }
  return null
}
const packEntries = (entries: DesktopEntry[], pinned?: { entry: DesktopEntry; column: number; row: number }) => {
  const result: DesktopGridEntry[] = []
  if (pinned) {
    if (!isInside(pinned.entry, pinned.column, pinned.row)) return null
    result.push({ ...cloneEntry(pinned.entry), column: pinned.column, row: pinned.row } as DesktopGridEntry)
  }
  for (const entry of entries) {
    if (pinned?.entry.id === entry.id) continue
    const position = findFirstPosition(result, entry)
    if (!position) return null
    result.push({ ...cloneEntry(entry), ...position } as DesktopGridEntry)
  }
  return result
}
const fillPage = (entries: DesktopEntry[]) => packEntries(entries) ?? []

const createDefaultLayout = (appIds: string[]): DesktopLayoutState => {
  const primary = appIds.filter(id => !THIRD_PAGE_APP_IDS.has(id) && !FOURTH_PAGE_APP_IDS.has(id))
  const dock = primary.slice(0, DOCK_CAPACITY).map(id => ({ type: 'app', id }) as DesktopAppEntry)
  const moment: DesktopWidgetEntry = { type: 'widget', id: DEFAULT_WIDGET_IDS.moment, widgetType: 'moment-card', widthUnits: 4, heightUnits: 2 }
  const dual: DesktopWidgetEntry = { type: 'widget', id: DEFAULT_WIDGET_IDS.dualAvatar, widgetType: 'dual-avatar', widthUnits: 2, heightUnits: 2 }
  const firstEntries: DesktopGridEntry[] = [{ ...moment, column: 1, row: 1 }, { ...dual, column: 3, row: 3 }]
  primary.slice(4, 8).forEach((id, index) => firstEntries.push({ type: 'app', id, column: index % 2 + 1, row: Math.floor(index / 2) + 3 }))
  const pageOne = primary.slice(8).map(id => ({ type: 'app', id }) as DesktopAppEntry)
  const pageTwo = appIds.filter(id => THIRD_PAGE_APP_IDS.has(id)).map(id => ({ type: 'app', id }) as DesktopAppEntry)
  const pageThree = appIds.filter(id => FOURTH_PAGE_APP_IDS.has(id)).map(id => ({ type: 'app', id }) as DesktopAppEntry)
  return { version: 2, dock, pages: [firstEntries, fillPage(pageOne), fillPage(pageTwo), fillPage(pageThree)].map(entries => ({ id: pageId(), entries })), hiddenAppIds: [] }
}
const persistNow = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch (error) { console.warn('桌面布局保存失败', error) }
}
const save = () => {
  if (batching) { batchDirty = true; return }
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(persistNow, 140)
}
const beginLayoutBatch = () => { batching = true; batchDirty = false; if (saveTimer) { clearTimeout(saveTimer); saveTimer = null } }
const endLayoutBatch = () => { batching = false; if (batchDirty) persistNow(); batchDirty = false }

const normalizeBaseEntries = (entries: unknown, validIds: Set<string>, hidden: Set<string>, usedApps: Set<string>, allowWidgets: boolean): DesktopEntry[] => {
  if (!Array.isArray(entries)) return []
  const result: DesktopEntry[] = []
  for (const item of entries) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Record<string, unknown>
    if (candidate.type === 'app' && typeof candidate.id === 'string' && validIds.has(candidate.id) && !hidden.has(candidate.id) && !usedApps.has(candidate.id)) {
      usedApps.add(candidate.id); result.push({ type: 'app', id: candidate.id })
    } else if (candidate.type === 'folder' && typeof candidate.id === 'string' && Array.isArray(candidate.appIds)) {
      const appIds = candidate.appIds.filter((id): id is string => typeof id === 'string' && validIds.has(id) && !hidden.has(id) && !usedApps.has(id))
      appIds.forEach(id => usedApps.add(id))
      if (appIds.length === 1) result.push({ type: 'app', id: appIds[0] })
      if (appIds.length > 1) result.push({ type: 'folder', id: candidate.id, name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim().slice(0, 12) : '文件夹', appIds })
    } else if (allowWidgets && candidate.type === 'widget' && typeof candidate.id === 'string' && ['dual-avatar', 'moment-card', 'custom-image', 'folder-widget'].includes(String(candidate.widgetType))) {
      result.push({ type: 'widget', id: candidate.id, widgetType: candidate.widgetType as WidgetType, widthUnits: Math.max(1, Math.min(4, Number(candidate.widthUnits) || 1)), heightUnits: Math.max(1, Math.min(4, Number(candidate.heightUnits) || 1)) })
    }
  }
  return result
}
const appendMissingApps = (layout: DesktopLayoutState, appIds: string[], used: Set<string>, hidden: Set<string>) => {
  for (const id of appIds) {
    if (used.has(id) || hidden.has(id)) continue
    const preferred = FOURTH_PAGE_APP_IDS.has(id) ? 3 : THIRD_PAGE_APP_IDS.has(id) ? 2 : 1
    while (layout.pages.length <= preferred) layout.pages.push({ id: pageId(), entries: [] })
    const entry: DesktopAppEntry = { type: 'app', id }
    let target = layout.pages[preferred], position = findFirstPosition(target.entries, entry)
    if (!position) { target = { id: pageId(), entries: [] }; layout.pages.push(target); position = { column: 1, row: 1 } }
    target.entries.push({ ...entry, ...position })
  }
}
const migrateLegacy = (raw: any, appIds: string[]): DesktopLayoutState => {
  const valid = new Set(appIds), used = new Set<string>()
  const hidden = new Set<string>((Array.isArray(raw?.hiddenAppIds) ? raw.hiddenAppIds : []).filter((id: unknown): id is string => typeof id === 'string' && valid.has(id)))
  const dock = normalizeBaseEntries(raw?.dock, valid, hidden, used, false).slice(0, DOCK_CAPACITY) as DesktopDockEntry[]
  const rawPages = Array.isArray(raw?.pages) ? raw.pages : []
  const pages: DesktopPage[] = []
  for (let index = 0; index < Math.max(DEFAULT_PAGE_COUNT, rawPages.length); index++) pages.push({ id: pageId(), entries: fillPage(normalizeBaseEntries(rawPages[index], valid, hidden, used, false)) })
  const layout: DesktopLayoutState = { version: 2, dock, pages, hiddenAppIds: [...hidden] }
  appendMissingApps(layout, appIds, used, hidden)
  const oldApps = layout.pages[0].entries.map(entry => cloneEntry(entry))
  const moment: DesktopWidgetEntry = { type: 'widget', id: DEFAULT_WIDGET_IDS.moment, widgetType: 'moment-card', widthUnits: 4, heightUnits: 2 }
  const dual: DesktopWidgetEntry = { type: 'widget', id: DEFAULT_WIDGET_IDS.dualAvatar, widgetType: 'dual-avatar', widthUnits: 2, heightUnits: 2 }
  const rebuilt: DesktopGridEntry[] = [{ ...moment, column: 1, row: 1 }, { ...dual, column: 3, row: 3 }]
  oldApps.slice(0, 4).forEach((entry, index) => rebuilt.push({ ...entry, column: index % 2 + 1, row: Math.floor(index / 2) + 3 } as DesktopGridEntry))
  layout.pages[0].entries = rebuilt
  for (const overflow of oldApps.slice(4)) {
    let target = layout.pages[1], position = findFirstPosition(target.entries, overflow)
    if (!position) { target = { id: pageId(), entries: [] }; layout.pages.push(target); position = { column: 1, row: 1 } }
    target.entries.push({ ...overflow, ...position } as DesktopGridEntry)
  }
  return layout
}
const normalizeV2 = (raw: any, appIds: string[]): DesktopLayoutState => {
  const valid = new Set(appIds), used = new Set<string>(), widgetIds = new Set<string>()
  const hidden = new Set<string>((Array.isArray(raw?.hiddenAppIds) ? raw.hiddenAppIds : []).filter((id: unknown): id is string => typeof id === 'string' && valid.has(id)))
  const dock = normalizeBaseEntries(raw?.dock, valid, hidden, used, false).slice(0, DOCK_CAPACITY) as DesktopDockEntry[]
  const pages: DesktopPage[] = []
  const overflowEntries: DesktopEntry[] = []
  for (const rawPage of Array.isArray(raw?.pages) ? raw.pages : []) {
    const candidates = normalizeBaseEntries(rawPage?.entries, valid, hidden, used, true).filter(entry => entry.type !== 'widget' || (!widgetIds.has(entry.id) && (widgetIds.add(entry.id), true)))
    const rawEntries = Array.isArray(rawPage?.entries) ? rawPage.entries : []
    const placed: DesktopGridEntry[] = []
    for (const entry of candidates) {
      const source = rawEntries.find((item: any) => item?.id === entry.id)
      const column = Number(source?.column), row = Number(source?.row)
      const position = Number.isInteger(column) && Number.isInteger(row) && canPlace(placed, entry, column, row) ? { column, row } : findFirstPosition(placed, entry)
      if (position) placed.push({ ...entry, ...position } as DesktopGridEntry)
      else overflowEntries.push(entry)
    }
    pages.push({ id: typeof rawPage?.id === 'string' ? rawPage.id : pageId(), entries: placed })
  }
  while (pages.length < DEFAULT_PAGE_COUNT) pages.push({ id: pageId(), entries: [] })
  for (const entry of overflowEntries) {
    let target = pages.find(page => !!findFirstPosition(page.entries, entry)), position = target ? findFirstPosition(target.entries, entry) : null
    if (!target || !position) { target = { id: pageId(), entries: [] }; pages.push(target); position = { column: 1, row: 1 } }
    target.entries.push({ ...entry, ...position } as DesktopGridEntry)
  }
  const layout: DesktopLayoutState = { version: 2, dock, pages, hiddenAppIds: [...hidden] }
  appendMissingApps(layout, appIds, used, hidden)
  return layout
}
const assignLayout = (layout: DesktopLayoutState) => {
  state.version = 2
  state.dock.splice(0, state.dock.length, ...layout.dock.map(entry => cloneEntry(entry) as DesktopDockEntry))
  state.pages.splice(0, state.pages.length, ...layout.pages.map(page => ({ id: page.id, entries: page.entries.map(cloneGridEntry) })))
  state.hiddenAppIds.splice(0, state.hiddenAppIds.length, ...layout.hiddenAppIds)
}
const initialize = (appIds: string[]) => {
  if (initialized) return
  let layout: DesktopLayoutState | null = null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) layout = normalizeV2(JSON.parse(stored), appIds)
    if (!layout) { const legacy = localStorage.getItem(LEGACY_STORAGE_KEY); layout = legacy ? migrateLegacy(JSON.parse(legacy), appIds) : createDefaultLayout(appIds) }
  } catch (error) { console.warn('桌面布局数据损坏，已恢复默认布局', error) }
  assignLayout(layout ?? createDefaultLayout(appIds)); initialized = true
  if (!pageHideBound) { window.addEventListener('pagehide', persistNow); pageHideBound = true }
  persistNow()
}

const pageFor = (location: DesktopLocation) => location.pageId ? state.pages.find(page => page.id === location.pageId) ?? null : state.pages[location.page ?? 0] ?? null
const findFolder = (folderId: string) => {
  for (const entry of state.dock) if (entry.type === 'folder' && entry.id === folderId) return entry
  for (const page of state.pages) for (const entry of page.entries) if (entry.type === 'folder' && entry.id === folderId) return entry
  return null
}
const findFolderContainer = (folderId: string): { entries: DesktopDockEntry[] | DesktopGridEntry[]; index: number } | null => {
  const dockIndex = state.dock.findIndex(entry => entry.type === 'folder' && entry.id === folderId)
  if (dockIndex >= 0) return { entries: state.dock, index: dockIndex }
  for (const page of state.pages) { const index = page.entries.findIndex(entry => entry.type === 'folder' && entry.id === folderId); if (index >= 0) return { entries: page.entries, index } }
  return null
}
const resolveFolderAfterRemoval = (folderId: string) => {
  const found = findFolderContainer(folderId); if (!found) return
  const folder = found.entries[found.index]; if (folder.type !== 'folder') return
  if (folder.appIds.length === 1) {
    const replacement: DesktopAppEntry = { type: 'app', id: folder.appIds[0] }
    if ('column' in folder) (found.entries as DesktopGridEntry[]).splice(found.index, 1, { ...replacement, column: folder.column, row: folder.row })
    else (found.entries as DesktopDockEntry[]).splice(found.index, 1, replacement)
  } else if (!folder.appIds.length) found.entries.splice(found.index, 1)
}
const entryAt = (location: DesktopLocation): DesktopEntry | null => {
  if (location.area === 'folder') { const folder = location.folderId ? findFolder(location.folderId) : null; const id = folder?.appIds[location.index ?? -1]; return id ? { type: 'app', id } : null }
  if (location.area === 'dock') return state.dock[location.index ?? -1] ?? null
  const page = pageFor(location); if (!page) return null
  if (location.entryId) return page.entries.find(entry => entry.id === location.entryId) ?? null
  if (location.column && location.row) return page.entries.find(entry => { const span = spanOf(entry); return location.column! >= entry.column && location.column! < entry.column + span.width && location.row! >= entry.row && location.row! < entry.row + span.height }) ?? null
  return null
}
const removeAt = (location: DesktopLocation): DesktopEntry | null => {
  if (location.area === 'folder') { const folder = location.folderId ? findFolder(location.folderId) : null; const id = folder?.appIds.splice(location.index ?? -1, 1)[0]; return id ? { type: 'app', id } : null }
  if (location.area === 'dock') return state.dock.splice(location.index ?? -1, 1)[0] ?? null
  const page = pageFor(location); if (!page) return null
  const index = page.entries.findIndex(entry => entry.id === (location.entryId ?? entryAt(location)?.id))
  return index >= 0 ? page.entries.splice(index, 1)[0] : null
}
const moveEntry = (from: DesktopLocation, to: DesktopLocation): DesktopLocation | null => {
  const moving = entryAt(from); if (!moving || (moving.type === 'widget' && to.area !== 'page') || (to.area === 'folder' && moving.type !== 'app')) return null
  if (to.area === 'page') {
    const targetPage = pageFor(to); if (!targetPage || !to.column || !to.row) return null
    const previewEntries = targetPage.entries.filter(entry => entry.id !== moving.id).slice().sort((a, b) => a.row - b.row || a.column - b.column).map(cloneEntry)
    const previewPacked = packEntries(previewEntries, { entry: moving, column: to.column, row: to.row })
    if (!previewPacked) {
      const displaced = entryAt(to)
      if (!displaced || displaced.id === moving.id || from.area === 'folder') return null
      if (from.area === 'dock') {
        if (displaced.type === 'widget') return null
        const targetGrid = targetPage.entries.find(entry => entry.id === displaced.id), dockIndex = from.index ?? -1
        if (!targetGrid || dockIndex < 0) return null
        targetPage.entries.splice(targetPage.entries.indexOf(targetGrid), 1, { ...cloneEntry(moving), column: to.column, row: to.row } as DesktopGridEntry)
        state.dock.splice(dockIndex, 1, cloneEntry(displaced) as DesktopDockEntry)
        save(); return { area: 'page', pageId: targetPage.id, entryId: moving.id, column: to.column, row: to.row }
      }
      const sourcePage = pageFor(from), sourceGrid = sourcePage?.entries.find(entry => entry.id === moving.id)
      if (!sourcePage || !sourceGrid || sourcePage === targetPage) return null
      const targetSwap = packEntries(targetPage.entries.filter(entry => entry.id !== displaced.id).map(cloneEntry), { entry: moving, column: to.column, row: to.row })
      const sourceSwap = packEntries(sourcePage.entries.filter(entry => entry.id !== moving.id).map(cloneEntry), { entry: displaced, column: sourceGrid.column, row: sourceGrid.row })
      if (!targetSwap || !sourceSwap) return null
      targetPage.entries.splice(0, targetPage.entries.length, ...targetSwap); sourcePage.entries.splice(0, sourcePage.entries.length, ...sourceSwap)
      save(); return { area: 'page', pageId: targetPage.id, entryId: moving.id, column: to.column, row: to.row }
    }
    const sourcePage = from.area === 'page' ? pageFor(from) : null
    const sourceSnapshot = sourcePage?.entries.map(cloneGridEntry), targetSnapshot = sourcePage === targetPage ? null : targetPage.entries.map(cloneGridEntry)
    const removed = removeAt(from); if (!removed) return null
    const packed = previewPacked
    if (!packed) {
      if (sourcePage && sourceSnapshot) sourcePage.entries.splice(0, sourcePage.entries.length, ...sourceSnapshot)
      if (targetSnapshot) targetPage.entries.splice(0, targetPage.entries.length, ...targetSnapshot)
      return null
    }
    targetPage.entries.splice(0, targetPage.entries.length, ...packed)
    if (from.area === 'folder' && from.folderId) resolveFolderAfterRemoval(from.folderId)
    save(); return { area: 'page', pageId: targetPage.id, entryId: removed.id, column: to.column, row: to.row }
  }
  if (to.area === 'folder') {
    const folder = to.folderId ? findFolder(to.folderId) : null
    if (!folder || moving.type !== 'app') return null
    const removed = removeAt(from); if (!removed || removed.type !== 'app') return null
    const index = Math.max(0, Math.min(to.index ?? folder.appIds.length, folder.appIds.length)); folder.appIds.splice(index, 0, removed.id)
    if (from.area === 'folder' && from.folderId) resolveFolderAfterRemoval(from.folderId)
    save(); return { area: 'folder', folderId: folder.id, index }
  }
  const targetIndex = Math.max(0, Math.min(to.index ?? state.dock.length, state.dock.length))
  if (from.area === 'dock') {
    const sourceIndex = from.index ?? -1; if (sourceIndex < 0) return null
    const [removed] = state.dock.splice(sourceIndex, 1); const adjusted = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
    state.dock.splice(adjusted, 0, removed); save(); return { area: 'dock', index: adjusted }
  }
  if (state.dock.length >= DOCK_CAPACITY) {
    if (from.area !== 'page') return null
    const sourcePage = pageFor(from), sourceGrid = sourcePage?.entries.find(entry => entry.id === moving.id)
    const swapIndex = Math.max(0, Math.min(targetIndex, state.dock.length - 1)), displaced = state.dock[swapIndex]
    if (!sourcePage || !sourceGrid || !displaced) return null
    sourcePage.entries.splice(sourcePage.entries.indexOf(sourceGrid), 1, { ...cloneEntry(displaced), column: sourceGrid.column, row: sourceGrid.row } as DesktopGridEntry)
    state.dock.splice(swapIndex, 1, cloneEntry(moving) as DesktopDockEntry)
    save(); return { area: 'dock', index: swapIndex }
  }
  const removed = removeAt(from); if (!removed || removed.type === 'widget') return null
  state.dock.splice(targetIndex, 0, removed); if (from.area === 'folder' && from.folderId) resolveFolderAfterRemoval(from.folderId)
  save(); return { area: 'dock', index: targetIndex }
}
const addToFolder = (from: DesktopLocation, folderId: string) => {
  const moving = entryAt(from), folder = findFolder(folderId)
  if (!moving || moving.type !== 'app' || !folder || folder.appIds.includes(moving.id)) return false
  const removed = removeAt(from); if (!removed || removed.type !== 'app') return false
  folder.appIds.push(removed.id); if (from.area === 'folder' && from.folderId) resolveFolderAfterRemoval(from.folderId); save(); return true
}
const createFolder = (from: DesktopLocation, target: DesktopLocation) => {
  const moving = entryAt(from), targetEntry = entryAt(target)
  if (!moving || moving.type !== 'app' || !targetEntry || targetEntry.type !== 'app' || target.area === 'folder') return null
  const targetPosition = target.area === 'page' ? pageFor(target)?.entries.find(entry => entry.id === targetEntry.id) : null
  const movingId = moving.id, targetId = targetEntry.id; removeAt(from)
  const folder: DesktopFolderEntry = { type: 'folder', id: makeId('folder'), name: '文件夹', appIds: [targetId, movingId] }
  if (target.area === 'dock') { const index = state.dock.findIndex(entry => entry.id === targetId); if (index < 0) return null; state.dock.splice(index, 1, folder); save(); return folder.id }
  const page = pageFor(target), index = page?.entries.findIndex(entry => entry.id === targetId) ?? -1
  if (!page || index < 0 || !targetPosition) return null
  page.entries.splice(index, 1, { ...folder, column: targetPosition.column, row: targetPosition.row }); if (from.area === 'folder' && from.folderId) resolveFolderAfterRemoval(from.folderId); save(); return folder.id
}
const hideApp = (location: DesktopLocation) => {
  const entry = entryAt(location); if (!entry || entry.type !== 'app') return false
  removeAt(location); if (!state.hiddenAppIds.includes(entry.id)) state.hiddenAppIds.push(entry.id)
  if (location.area === 'folder' && location.folderId) resolveFolderAfterRemoval(location.folderId); save(); return true
}
const removeWidget = (id: string) => {
  for (const page of state.pages) { const index = page.entries.findIndex(entry => entry.type === 'widget' && entry.id === id); if (index >= 0) { page.entries.splice(index, 1); save(); return true } }
  return false
}
const renameFolder = (folderId: string, name: string) => { const folder = findFolder(folderId); if (folder) { folder.name = name.trim().slice(0, 12) || '文件夹'; save() } }
const addPage = (afterIndex: number) => { const index = Math.max(0, Math.min(afterIndex + 1, state.pages.length)); state.pages.splice(index, 0, { id: pageId(), entries: [] }); persistNow(); return index }
const deletePage = (index: number) => { if (state.pages.length <= 1 || !state.pages[index] || state.pages[index].entries.length) return false; state.pages.splice(index, 1); persistNow(); return true }
const addWidget = (widgetType: WidgetType, widthUnits: number, heightUnits: number, preferredPage: number) => {
  const entry: DesktopWidgetEntry = { type: 'widget', id: makeId(`widget-${widgetType}`), widgetType, widthUnits, heightUnits }
  let index = Math.max(0, Math.min(preferredPage, state.pages.length - 1)), target = state.pages[index], position = findFirstPosition(target.entries, entry)
  if (!position) { index = addPage(index); target = state.pages[index]; position = { column: 1, row: 1 } }
  target.entries.push({ ...entry, ...position }); persistNow()
  return { entry, pageIndex: index, location: { area: 'page', pageId: target.id, entryId: entry.id, ...position } as DesktopLocation }
}
const reset = (appIds: string[], resetWidgets = false) => {
  const currentWidgets = state.pages.flatMap((page, pageIndex) => page.entries.filter((entry): entry is DesktopGridEntry & DesktopWidgetEntry => entry.type === 'widget').map(entry => ({ entry: cloneEntry(entry) as DesktopWidgetEntry, pageIndex, column: entry.column, row: entry.row })))
  const defaults = createDefaultLayout(appIds)
  const fresh: DesktopLayoutState = { version: 2, dock: defaults.dock, pages: [], hiddenAppIds: [] }
  const pageCount = resetWidgets ? DEFAULT_PAGE_COUNT : Math.max(DEFAULT_PAGE_COUNT, state.pages.length)
  for (let index = 0; index < pageCount; index++) fresh.pages.push({ id: !resetWidgets && state.pages[index] ? state.pages[index].id : pageId(), entries: [] })
  if (!resetWidgets) {
    for (const item of currentWidgets) fresh.pages[item.pageIndex].entries.push({ ...item.entry, column: item.column, row: item.row })
  } else {
    const widgets = currentWidgets.map(item => ({ ...item, entry: { ...item.entry, widthUnits: item.entry.widgetType === 'moment-card' ? 4 : 2, heightUnits: 2 }, pageIndex: item.entry.id === DEFAULT_WIDGET_IDS.moment || item.entry.id === DEFAULT_WIDGET_IDS.dualAvatar ? 0 : item.pageIndex }))
    const moment = widgets.find(item => item.entry.id === DEFAULT_WIDGET_IDS.moment)
    const dual = widgets.find(item => item.entry.id === DEFAULT_WIDGET_IDS.dualAvatar)
    if (moment) fresh.pages[0].entries.push({ ...moment.entry, column: 1, row: 1 })
    if (dual) fresh.pages[0].entries.push({ ...dual.entry, column: 3, row: 3 })
    for (const item of widgets.filter(value => value !== moment && value !== dual)) {
      while (fresh.pages.length <= item.pageIndex) fresh.pages.push({ id: pageId(), entries: [] })
      let target = fresh.pages[item.pageIndex], position = findFirstPosition(target.entries, item.entry)
      if (!position) { target = { id: pageId(), entries: [] }; fresh.pages.push(target); position = { column: 1, row: 1 } }
      target.entries.push({ ...item.entry, ...position })
    }
  }
  defaults.pages.forEach((page, preferredPage) => {
    for (const app of page.entries.filter((entry): entry is DesktopGridEntry & DesktopAppEntry => entry.type === 'app')) {
      let target = fresh.pages[preferredPage], position = findFirstPosition(target.entries, app)
      if (!position) {
        target = fresh.pages.slice(preferredPage + 1).find(candidate => !!findFirstPosition(candidate.entries, app)) ?? { id: pageId(), entries: [] }
        if (!fresh.pages.includes(target)) fresh.pages.push(target)
        position = findFirstPosition(target.entries, app) ?? { column: 1, row: 1 }
      }
      target.entries.push({ type: 'app', id: app.id, ...position })
    }
  })
  assignLayout(fresh); persistNow()
}

export const useDesktopLayout = () => ({ layout: readonly(state) as Readonly<DesktopLayoutState>, initialize, entryAt, findFolder, moveEntry, addToFolder, createFolder, hideApp, removeWidget, renameFolder, reset, addPage, deletePage, addWidget, canPlace, beginLayoutBatch, endLayoutBatch })
