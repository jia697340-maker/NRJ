/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, readonly } from 'vue'

export interface DesktopAppEntry {
  type: 'app'
  id: string
}

export interface DesktopFolderEntry {
  type: 'folder'
  id: string
  name: string
  appIds: string[]
}

export type DesktopEntry = DesktopAppEntry | DesktopFolderEntry

export interface DesktopLayoutState {
  version: 1
  dock: DesktopEntry[]
  pages: DesktopEntry[][]
  hiddenAppIds: string[]
}

export interface DesktopLocation {
  area: 'dock' | 'page' | 'folder'
  index: number
  page?: number
  folderId?: string
}

const STORAGE_KEY = 'clingy_desktop_layout_v1'
const FIRST_PAGE_CAPACITY = 4
const OTHER_PAGE_CAPACITY = 12
const DOCK_CAPACITY = 4
const THIRD_PAGE_APP_IDS = new Set([
  'character_workshop',
  'persona_workshop',
  'bubble_dressup',
  'character_phone',
  'watch_together',
  'timebox',
  'mcp',
  'text_game'
])
const FOURTH_PAGE_APP_IDS = new Set([
  'book_store',
  'game',
  'bubble',
  'mall',
  'fate'
])

const state = reactive<DesktopLayoutState>({
  version: 1,
  dock: [],
  pages: [[], [], [], []],
  hiddenAppIds: []
})

let initialized = false
let pageHideBound = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

const cloneEntry = (entry: DesktopEntry): DesktopEntry => entry.type === 'app'
  ? { type: 'app', id: entry.id }
  : { type: 'folder', id: entry.id, name: entry.name, appIds: [...entry.appIds] }

const createDefaultLayout = (appIds: string[]): DesktopLayoutState => ({
  version: 1,
  dock: appIds.slice(0, 4).map(id => ({ type: 'app', id })),
  pages: [
    appIds.slice(4, 8).map(id => ({ type: 'app', id })),
    appIds.slice(8).filter(id => !THIRD_PAGE_APP_IDS.has(id) && !FOURTH_PAGE_APP_IDS.has(id)).map(id => ({ type: 'app', id })),
    appIds.filter(id => THIRD_PAGE_APP_IDS.has(id)).map(id => ({ type: 'app', id })),
    appIds.filter(id => FOURTH_PAGE_APP_IDS.has(id)).map(id => ({ type: 'app', id }))
  ],
  hiddenAppIds: []
})

const persistNow = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('桌面布局保存失败', error)
  }
}

// 排序过程中可能连续跨过多个格位；合并写入，避免同步 localStorage 阻塞拖动帧。
const save = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(persistNow, 120)
}

const normalize = (raw: Partial<DesktopLayoutState>, appIds: string[]): DesktopLayoutState => {
  const validIds = new Set(appIds)
  const used = new Set<string>()
  const hidden = new Set((Array.isArray(raw.hiddenAppIds) ? raw.hiddenAppIds : []).filter(id => validIds.has(id)))

  const normalizeEntries = (entries: unknown): DesktopEntry[] => {
    if (!Array.isArray(entries)) return []
    const result: DesktopEntry[] = []
    for (const item of entries) {
      if (!item || typeof item !== 'object') continue
      const candidate = item as Partial<DesktopEntry> & { appIds?: unknown }
      if (candidate.type === 'app' && typeof candidate.id === 'string' && validIds.has(candidate.id) && !used.has(candidate.id) && !hidden.has(candidate.id)) {
        used.add(candidate.id)
        result.push({ type: 'app', id: candidate.id })
      } else if (candidate.type === 'folder' && typeof candidate.id === 'string' && Array.isArray(candidate.appIds)) {
        const folderApps = candidate.appIds.filter((id): id is string => typeof id === 'string' && validIds.has(id) && !used.has(id) && !hidden.has(id))
        folderApps.forEach(id => used.add(id))
        if (folderApps.length === 1) result.push({ type: 'app', id: folderApps[0] })
        if (folderApps.length > 1) result.push({ type: 'folder', id: candidate.id, name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : '文件夹', appIds: folderApps })
      }
    }
    return result
  }

  const dock = normalizeEntries(Array.isArray(raw.dock) ? raw.dock.slice(0, DOCK_CAPACITY) : raw.dock)
  const rawPages = Array.isArray(raw.pages) ? raw.pages : []
  const pages = [
    normalizeEntries(rawPages[0]),
    normalizeEntries(rawPages[1]),
    normalizeEntries(rawPages[2]),
    normalizeEntries(rawPages[3])
  ]

  for (const id of appIds) {
    if (!used.has(id) && !hidden.has(id)) {
      const targetPage = FOURTH_PAGE_APP_IDS.has(id) ? 3 : (THIRD_PAGE_APP_IDS.has(id) ? 2 : 1)
      pages[targetPage].push({ type: 'app', id })
    }
  }

  return { version: 1, dock, pages, hiddenAppIds: [...hidden] }
}

const assignLayout = (layout: DesktopLayoutState) => {
  state.version = 1
  state.dock.splice(0, state.dock.length, ...layout.dock.map(cloneEntry))
  state.pages.splice(0, state.pages.length, ...layout.pages.map(page => page.map(cloneEntry)))
  while (state.pages.length < 4) state.pages.push([])
  state.hiddenAppIds.splice(0, state.hiddenAppIds.length, ...layout.hiddenAppIds)
}

const initialize = (appIds: string[]) => {
  if (initialized) return
  let layout = createDefaultLayout(appIds)
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) layout = normalize(JSON.parse(stored), appIds)
  } catch (error) {
    console.warn('桌面布局数据损坏，已恢复默认布局', error)
  }
  assignLayout(layout)
  initialized = true
  if (!pageHideBound) {
    window.addEventListener('pagehide', persistNow)
    pageHideBound = true
  }
  save()
}

const getContainer = (location: DesktopLocation): DesktopEntry[] | null => {
  if (location.area === 'dock') return state.dock
  if (location.area === 'page') return state.pages[location.page ?? 0] ?? null
  return null
}

const findFolder = (folderId: string) => {
  for (const entry of state.dock) if (entry.type === 'folder' && entry.id === folderId) return entry
  for (const page of state.pages) for (const entry of page) if (entry.type === 'folder' && entry.id === folderId) return entry
  return null
}

const findFolderContainer = (folderId: string): { container: DesktopEntry[], index: number } | null => {
  const dockIndex = state.dock.findIndex(entry => entry.type === 'folder' && entry.id === folderId)
  if (dockIndex >= 0) return { container: state.dock, index: dockIndex }
  for (const page of state.pages) {
    const index = page.findIndex(entry => entry.type === 'folder' && entry.id === folderId)
    if (index >= 0) return { container: page, index }
  }
  return null
}

const resolveFolderAfterRemoval = (folderId: string) => {
  const found = findFolderContainer(folderId)
  if (!found) return
  const folder = found.container[found.index]
  if (folder.type !== 'folder') return
  if (folder.appIds.length === 1) found.container.splice(found.index, 1, { type: 'app', id: folder.appIds[0] })
  if (folder.appIds.length === 0) found.container.splice(found.index, 1)
}

const entryAt = (location: DesktopLocation): DesktopEntry | null => {
  if (location.area === 'folder') {
    const folder = location.folderId ? findFolder(location.folderId) : null
    const id = folder?.appIds[location.index]
    return id ? { type: 'app', id } : null
  }
  return getContainer(location)?.[location.index] ?? null
}

const removeAt = (location: DesktopLocation): DesktopEntry | null => {
  if (location.area === 'folder') {
    const folder = location.folderId ? findFolder(location.folderId) : null
    if (!folder) return null
    const removed = folder.appIds.splice(location.index, 1)[0]
    if (!removed) return null
    return { type: 'app', id: removed }
  }
  return getContainer(location)?.splice(location.index, 1)[0] ?? null
}

const capacityFor = (location: DesktopLocation) => {
  if (location.area === 'dock') return DOCK_CAPACITY
  if (location.area === 'page') return location.page === 0 ? FIRST_PAGE_CAPACITY : OTHER_PAGE_CAPACITY
  return Number.POSITIVE_INFINITY
}

const canInsert = (location: DesktopLocation, movingWithinSameContainer = false) => {
  if (location.area === 'folder') return true
  const container = getContainer(location)
  return !!container && (movingWithinSameContainer || container.length < capacityFor(location))
}

const sameContainer = (a: DesktopLocation, b: DesktopLocation) => a.area === b.area && a.page === b.page && a.folderId === b.folderId

const moveEntry = (from: DesktopLocation, to: DesktopLocation): DesktopLocation | null => {
  const isSameContainer = sameContainer(from, to)
  if (!canInsert(to, isSameContainer)) {
    // 固定容量区域（第一页和 Dock）已满时采用原生桌面式交换，避免图标无法跨区移动。
    if (from.area === 'folder' || to.area === 'folder') return null
    const fromContainer = getContainer(from)
    const toContainer = getContainer(to)
    if (!fromContainer || !toContainer || !fromContainer[from.index] || !toContainer.length) return null
    const targetIndex = Math.max(0, Math.min(to.index, toContainer.length - 1))
    const moving = fromContainer[from.index]
    const displaced = toContainer[targetIndex]
    fromContainer.splice(from.index, 1, displaced)
    toContainer.splice(targetIndex, 1, moving)
    save()
    return { ...to, index: targetIndex }
  }
  const moving = entryAt(from)
  if (!moving) return null

  if (isSameContainer) {
    if (from.area === 'folder') {
      const folder = from.folderId ? findFolder(from.folderId) : null
      if (!folder) return null
      const [id] = folder.appIds.splice(from.index, 1)
      const targetIndex = Math.max(0, Math.min(to.index, folder.appIds.length))
      folder.appIds.splice(targetIndex, 0, id)
      save()
      return { ...to, index: targetIndex }
    }
    const container = getContainer(from)
    if (!container) return null
    const [entry] = container.splice(from.index, 1)
    const targetIndex = Math.max(0, Math.min(to.index, container.length))
    container.splice(targetIndex, 0, entry)
    save()
    return { ...to, index: targetIndex }
  }

  if (to.area === 'folder' && moving.type !== 'app') return null
  const removed = removeAt(from)
  if (!removed) return null
  if (to.area === 'folder') {
    const folder = to.folderId ? findFolder(to.folderId) : null
    if (!folder || removed.type !== 'app') return null
    const targetIndex = Math.max(0, Math.min(to.index, folder.appIds.length))
    folder.appIds.splice(targetIndex, 0, removed.id)
    if (from.area === 'folder' && from.folderId) resolveFolderAfterRemoval(from.folderId)
    save()
    return { ...to, index: targetIndex }
  }
  const container = getContainer(to)
  if (!container) return null
  const targetIndex = Math.max(0, Math.min(to.index, container.length))
  container.splice(targetIndex, 0, removed)
  if (from.area === 'folder' && from.folderId) resolveFolderAfterRemoval(from.folderId)
  save()
  return { ...to, index: targetIndex }
}

const addToFolder = (from: DesktopLocation, folderId: string) => {
  const moving = entryAt(from)
  const folder = findFolder(folderId)
  if (!moving || moving.type !== 'app' || !folder || folder.appIds.includes(moving.id)) return false
  const removed = removeAt(from)
  if (!removed || removed.type !== 'app') return false
  folder.appIds.push(removed.id)
  if (from.area === 'folder' && from.folderId) resolveFolderAfterRemoval(from.folderId)
  save()
  return true
}

const createFolder = (from: DesktopLocation, target: DesktopLocation) => {
  if (sameContainer(from, target) && from.index === target.index) return null
  const moving = entryAt(from)
  const targetEntry = entryAt(target)
  if (!moving || moving.type !== 'app' || !targetEntry || targetEntry.type !== 'app') return null

  const targetContainer = getContainer(target)
  if (!targetContainer || target.area === 'folder') return null
  const movingId = moving.id
  const targetId = targetEntry.id
  removeAt(from)
  const updatedTargetIndex = targetContainer.findIndex(entry => entry.type === 'app' && entry.id === targetId)
  if (updatedTargetIndex < 0) return null
  const folder: DesktopFolderEntry = {
    type: 'folder',
    id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '文件夹',
    appIds: [targetId, movingId]
  }
  targetContainer.splice(updatedTargetIndex, 1, folder)
  if (from.area === 'folder' && from.folderId) resolveFolderAfterRemoval(from.folderId)
  save()
  return folder.id
}

const hideApp = (location: DesktopLocation) => {
  const entry = entryAt(location)
  if (!entry || entry.type !== 'app') return false
  removeAt(location)
  if (!state.hiddenAppIds.includes(entry.id)) state.hiddenAppIds.push(entry.id)
  if (location.area === 'folder' && location.folderId) resolveFolderAfterRemoval(location.folderId)
  save()
  return true
}

const renameFolder = (folderId: string, name: string) => {
  const folder = findFolder(folderId)
  if (!folder) return
  folder.name = name.trim().slice(0, 12) || '文件夹'
  save()
}

const reset = (appIds: string[]) => {
  assignLayout(createDefaultLayout(appIds))
  save()
}

export const useDesktopLayout = () => ({
  layout: readonly(state) as Readonly<DesktopLayoutState>,
  initialize,
  entryAt,
  findFolder,
  moveEntry,
  addToFolder,
  createFolder,
  hideApp,
  renameFolder,
  reset,
  canInsert
})
