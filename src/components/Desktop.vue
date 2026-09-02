<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { globalSettings } from '../store'
import AppIcon from './AppIcon.vue'
import DesktopFolderIcon from './DesktopFolderIcon.vue'
import DesktopWidgetHost from './DesktopWidgetHost.vue'
import { useChatState } from '../composables/useChatState'
import { useWidgetInstances } from '../composables/useWidgetInstances'
import {
  DESKTOP_COLUMNS, DESKTOP_ROWS, useDesktopLayout,
  type DesktopEntry, type DesktopFolderEntry, type DesktopLocation, type DesktopWidgetEntry, type WidgetType
} from '../composables/useDesktopLayout'

interface AppInfo { id: string; name: string; icon: string; color: string; customImage?: string | null }
const props = defineProps<{ apps: AppInfo[] }>()
const emit = defineEmits<{ 'open-app': [appId: string] }>()
const chatState = useChatState()
const desktopLayout = useDesktopLayout()
const { layout, initialize, entryAt, findFolder, canMoveEntry, moveEntry, addToFolder, createFolder, hideApp, removeWidget, resizeWidget, renameFolder, reset, addPage, deletePage, addWidget, beginLayoutBatch, endLayoutBatch } = desktopLayout
const { ensureInstances, ensureInstance, removeInstance } = useWidgetInstances()
initialize(props.apps.map(app => app.id))

const appsById = computed<Record<string, AppInfo>>(() => Object.fromEntries(props.apps.map(app => [app.id, app])))
const scrollContainer = ref<HTMLElement | null>(null)
const folderPanel = ref<HTMLElement | null>(null)
const dragProxy = ref<HTMLElement | null>(null)
const currentPage = ref(0)
const editing = ref(false)
const placementWidgetId = ref('')
const showResetConfirm = ref(false)
const showWidgetPicker = ref(false)
const selectedWidgetIds = ref<string[]>([])
const resetting = ref(false)
const resizingWidget = ref<DesktopWidgetEntry | null>(null)
const resizeWidth = ref(1)
const resizeHeight = ref(1)
const pageFeedback = ref('')
const openFolderId = ref<string | null>(null)
const folderNameDraft = ref('文件夹')
const dragVisible = ref(false)
const dragEntry = ref<DesktopEntry | null>(null)
const dragKey = ref('')
const folderCandidateKey = ref('')
const invalidDrop = ref(false)
const gridCells = Array.from({ length: DESKTOP_COLUMNS * DESKTOP_ROWS }, (_, index) => ({ column: index % DESKTOP_COLUMNS + 1, row: Math.floor(index / DESKTOP_COLUMNS) + 1 }))

watch(() => layout.pages.flatMap(page => page.entries.filter((entry): entry is DesktopWidgetEntry & { column: number; row: number } => entry.type === 'widget')), widgets => { void ensureInstances(widgets) }, { immediate: true, deep: true })
const openFolder = computed(() => openFolderId.value ? findFolder(openFolderId.value) : null)
const entryKey = (entry: DesktopEntry) => `${entry.type}:${entry.id}`
const getApp = (id: string) => appsById.value[id]
const badgeForApp = (id: string) => id === 'chat' ? chatState.totalUnreadCount.value : 0
const badgeForEntry = (entry: DesktopEntry) => entry.type === 'app' ? badgeForApp(entry.id) : entry.type === 'folder' && entry.appIds.includes('chat') ? chatState.totalUnreadCount.value : 0
const locationKey = (location: DesktopLocation) => `${location.area}:${location.pageId ?? location.page ?? ''}:${location.folderId ?? ''}:${location.entryId ?? location.index ?? ''}:${location.column ?? ''}:${location.row ?? ''}`
const pageEntryLocation = (pageId: string, entry: DesktopEntry & { column: number; row: number }): DesktopLocation => ({ area: 'page', pageId, entryId: entry.id, column: entry.column, row: entry.row })
const usesDefaultFirstLayout = (page: { entries: readonly (DesktopEntry & { column: number; row: number })[] }) => {
  const moment = page.entries.find(entry => entry.id === 'widget-moment-default')
  const dual = page.entries.find(entry => entry.id === 'widget-dual-avatar-default')
  return moment?.type === 'widget' && moment.column === 1 && moment.row === 1 && moment.widthUnits === 4 && moment.heightUnits === 2
    && dual?.type === 'widget' && dual.column === 3 && dual.row === 3 && dual.widthUnits === 2 && dual.heightUnits === 2
}
const visualGridRow = (page: { entries: readonly (DesktopEntry & { column: number; row: number })[] }, row: number) => usesDefaultFirstLayout(page) && row >= 3 ? row + 1 : row
const widgetTypeNames: Record<WidgetType, string> = {
  'dual-avatar': '双头像小组件',
  'moment-card': '动态卡片小组件',
  'custom-image': '自定义图片小组件',
  'folder-widget': '文件夹图片小组件',
  'dual-frame': '双格相框小组件',
  'circle-avatar-widget': '圆形头像卡片小组件',
  'rectangle-image': '长方形图片小组件',
  'profile-card-widget': '社交名片小组件',
  'about-us-widget': '拍立得相框小组件'
}
const desktopWidgets = computed(() => layout.pages.flatMap((page, pageIndex) => page.entries
  .filter((entry): entry is DesktopWidgetEntry & { column: number; row: number } => entry.type === 'widget')
  .map(entry => ({ entry, pageIndex, name: widgetTypeNames[entry.widgetType] }))))

const handleScroll = () => {
  const element = scrollContainer.value
  if (element) currentPage.value = Math.max(0, Math.min(layout.pages.length - 1, Math.round(element.scrollLeft / Math.max(element.clientWidth, 1))))
}
const scrollToPage = async (index: number, smooth = true) => {
  currentPage.value = Math.max(0, Math.min(layout.pages.length - 1, index))
  await nextTick()
  scrollContainer.value?.scrollTo({ left: currentPage.value * (scrollContainer.value?.clientWidth ?? 0), behavior: smooth ? 'smooth' : 'auto' })
}
const openFolderView = (folder: DesktopFolderEntry) => { if (Date.now() >= suppressClickUntil) { openFolderId.value = folder.id; folderNameDraft.value = folder.name } }
const closeFolderView = () => { if (!dragVisible.value) openFolderId.value = null }
const commitFolderName = () => { if (openFolderId.value) { renameFolder(openFolderId.value, folderNameDraft.value); folderNameDraft.value = findFolder(openFolderId.value)?.name ?? '文件夹' } }
const activateEntry = (entry: DesktopEntry) => {
  if (Date.now() < suppressClickUntil || editing.value || entry.type === 'widget') return
  if (entry.type === 'folder') openFolderView(entry); else emit('open-app', entry.id)
}
const finishEditing = () => { editing.value = false; placementWidgetId.value = ''; openFolderId.value = null; resizingWidget.value = null; pageFeedback.value = '' }
const openReset = () => { selectedWidgetIds.value = []; showWidgetPicker.value = false; showResetConfirm.value = true }
const toggleWidgetSelection = (id: string, checked: boolean) => {
  selectedWidgetIds.value = checked ? [...new Set([...selectedWidgetIds.value, id])] : selectedWidgetIds.value.filter(value => value !== id)
}
const selectAllWidgets = () => { selectedWidgetIds.value = desktopWidgets.value.map(item => item.entry.id) }
const confirmReset = async () => {
  if (resetting.value) return
  resetting.value = true
  cancelPendingPress(); if (dragVisible.value) endDrag(false)
  const widgetIdsToRemove = [...selectedWidgetIds.value]
  try {
    reset(props.apps.map(app => app.id), widgetIdsToRemove)
    await Promise.all(widgetIdsToRemove.map(id => removeInstance(id)))
    showResetConfirm.value = false; openFolderId.value = null; placementWidgetId.value = ''; currentPage.value = 0
    pageFeedback.value = widgetIdsToRemove.length ? `已重置应用布局并删除 ${widgetIdsToRemove.length} 个小组件` : '已重置应用布局，小组件位置保持不变'
    await nextTick(); if (scrollContainer.value) scrollContainer.value.scrollLeft = 0
  } finally {
    resetting.value = false
  }
}
const removeApp = (location: DesktopLocation) => { if (hideApp(location) && openFolderId.value && !findFolder(openFolderId.value)) openFolderId.value = null }
const removeWidgetEntry = async (entry: DesktopWidgetEntry) => { if (removeWidget(entry.id)) { if (placementWidgetId.value === entry.id) placementWidgetId.value = ''; await removeInstance(entry.id) } }
const openWidgetResize = (entry: DesktopWidgetEntry) => {
  resizingWidget.value = entry
  resizeWidth.value = entry.widthUnits
  resizeHeight.value = entry.heightUnits
}
const clampResize = (value: number) => Math.max(1, Math.min(4, Math.round(Number(value) || 1)))
const applyWidgetResize = () => {
  const entry = resizingWidget.value
  if (!entry) return
  resizeWidth.value = clampResize(resizeWidth.value)
  resizeHeight.value = clampResize(resizeHeight.value)
  if (resizeWidget(entry.id, resizeWidth.value, resizeHeight.value)) {
    pageFeedback.value = `小组件尺寸已调整为 ${resizeWidth.value} × ${resizeHeight.value}`
    resizingWidget.value = null
  } else pageFeedback.value = '当前位置空间不足，请缩小尺寸或先移动周围内容'
}
const createDesktopPage = async () => { const index = addPage(currentPage.value); pageFeedback.value = '已新建空白页面'; await scrollToPage(index) }
const removeCurrentPage = async () => {
  const page = layout.pages[currentPage.value]
  if (!page || layout.pages.length <= 1) { pageFeedback.value = '桌面至少需要保留一页'; return }
  if (page.entries.length) { pageFeedback.value = '请先移走本页内容，再删除页面'; return }
  const next = Math.max(0, currentPage.value - 1)
  if (deletePage(currentPage.value)) { pageFeedback.value = '页面已删除'; await scrollToPage(next, false) }
}

type PendingPress = { pointerId: number; startX: number; startY: number; location: DesktopLocation; element: HTMLElement; timer: ReturnType<typeof setTimeout> }
let pendingPress: PendingPress | null = null
let sourceLocation: DesktopLocation | null = null
let dragStartX = 0, dragStartY = 0, latestX = 0, latestY = 0
let dragLeft = 0, dragTop = 0, dragWidth = 0, dragHeight = 0
let moveFrame = 0, suppressClickUntil = 0
let candidateTimer: ReturnType<typeof setTimeout> | null = null
let candidateLocation: DesktopLocation | null = null
let lastCandidateKey = ''
let edgePageTimer: ReturnType<typeof setTimeout> | null = null
let edgeDirection = 0
let activePointerId: number | null = null
let capturedPointerElement: HTMLElement | null = null
let pendingDropLocation: DesktopLocation | null = null

const clearCandidate = () => { if (candidateTimer) clearTimeout(candidateTimer); candidateTimer = null; candidateLocation = null; lastCandidateKey = ''; folderCandidateKey.value = '' }
const clearEdgeTimer = () => { if (edgePageTimer) clearTimeout(edgePageTimer); edgePageTimer = null; edgeDirection = 0 }
const removeGlobalPointerListeners = () => { window.removeEventListener('pointermove', handlePointerMove); window.removeEventListener('pointerup', handlePointerUp); window.removeEventListener('pointercancel', handlePointerCancel) }
const cancelPendingPress = () => { if (pendingPress) clearTimeout(pendingPress.timer); pendingPress = null; if (!dragVisible.value) removeGlobalPointerListeners() }
const captureRects = () => {
  const rects = new Map<string, DOMRect>()
  document.querySelectorAll<HTMLElement>('.desktop-entry[data-entry-key]').forEach(element => { if (element.dataset.entryKey && element.dataset.entryKey !== dragKey.value) rects.set(element.dataset.entryKey, element.getBoundingClientRect()) })
  return rects
}
const animateLayoutChange = async (change: () => boolean | DesktopLocation | null) => {
  const before = captureRects(), result = change(); if (!result) return result
  await nextTick()
  document.querySelectorAll<HTMLElement>('.desktop-entry[data-entry-key]').forEach(element => {
    const oldRect = element.dataset.entryKey ? before.get(element.dataset.entryKey) : null
    if (!oldRect || element.dataset.entryKey === dragKey.value) return
    const next = element.getBoundingClientRect(), x = oldRect.left - next.left, y = oldRect.top - next.top
    if (Math.abs(x) < .5 && Math.abs(y) < .5) return
    element.animate([{ transform: `translate3d(${x}px,${y}px,0)` }, { transform: 'translate3d(0,0,0)' }], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' })
  })
  return result
}
const setFolderCandidate = (location: DesktopLocation, targetEntry: DesktopEntry) => {
  if (!dragEntry.value || dragEntry.value.type !== 'app' || targetEntry.type === 'widget') return
  if (targetEntry.type === 'app' && targetEntry.id === dragEntry.value.id) return
  if (targetEntry.type === 'folder' && targetEntry.appIds.includes(dragEntry.value.id)) return
  const key = `${locationKey(location)}:${entryKey(targetEntry)}`; if (lastCandidateKey === key) return
  clearCandidate(); lastCandidateKey = key
  candidateTimer = setTimeout(() => { candidateLocation = { ...location }; folderCandidateKey.value = entryKey(targetEntry); navigator.vibrate?.(8) }, 360)
}
const locationFromPoint = (x: number, y: number): DesktopLocation | null => {
  const hit = document.elementFromPoint(x, y)
  const folderSlot = hit?.closest<HTMLElement>('[data-drop-area="folder"]')
  if (folderSlot) return { area: 'folder', folderId: folderSlot.dataset.dropFolder, index: Number(folderSlot.dataset.dropIndex ?? 0) }
  const dockSlot = hit?.closest<HTMLElement>('[data-drop-area="dock"]')
  if (dockSlot) return { area: 'dock', index: Number(dockSlot.dataset.dropIndex ?? layout.dock.length) }
  const grid = hit?.closest<HTMLElement>('.desktop-grid')
  if (!grid?.dataset.pageId) return null
  const directCell = hit?.closest<HTMLElement>('.desktop-grid-cell')
  if (directCell?.dataset.column && directCell.dataset.row) return { area: 'page', pageId: grid.dataset.pageId, column: Number(directCell.dataset.column), row: Number(directCell.dataset.row) }
  const directEntry = hit?.closest<HTMLElement>('.desktop-entry[data-column][data-row]')
  if (directEntry?.dataset.column && directEntry.dataset.row) return { area: 'page', pageId: grid.dataset.pageId, column: Number(directEntry.dataset.column), row: Number(directEntry.dataset.row) }
  const cells = [...grid.querySelectorAll<HTMLElement>('.desktop-grid-cell')]
  const nearest = cells.reduce<{ cell: HTMLElement; distance: number } | null>((best, cell) => {
    const rect = cell.getBoundingClientRect()
    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0
    const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0
    const distance = dx * dx + dy * dy
    return !best || distance < best.distance ? { cell, distance } : best
  }, null)?.cell
  return nearest?.dataset.column && nearest.dataset.row
    ? { area: 'page', pageId: grid.dataset.pageId, column: Number(nearest.dataset.column), row: Number(nearest.dataset.row) }
    : null
}
const maybeTurnPage = (x: number) => {
  if (openFolderId.value) { clearEdgeTimer(); return }
  const rect = scrollContainer.value?.getBoundingClientRect(); if (!rect) return
  const edge = Math.min(42, rect.width * .12), direction = x < rect.left + edge ? -1 : x > rect.right - edge ? 1 : 0
  if (!direction || currentPage.value + direction < 0 || currentPage.value + direction >= layout.pages.length) { clearEdgeTimer(); return }
  if (edgeDirection === direction && edgePageTimer) return
  clearEdgeTimer(); edgeDirection = direction
  edgePageTimer = setTimeout(() => { void scrollToPage(currentPage.value + direction); clearEdgeTimer() }, 520)
}
const processDragPosition = () => {
  moveFrame = 0
  if (dragProxy.value) dragProxy.value.style.transform = `translate3d(${latestX - dragStartX}px,${latestY - dragStartY}px,0) scale(1.06)`
  const panelRect = folderPanel.value?.getBoundingClientRect()
  if (openFolderId.value && panelRect && (latestX < panelRect.left - 22 || latestX > panelRect.right + 22 || latestY < panelRect.top - 22 || latestY > panelRect.bottom + 22)) { openFolderId.value = null; clearCandidate(); return }
  maybeTurnPage(latestX)
  const targetLocation = locationFromPoint(latestX, latestY)
  pendingDropLocation = null
  if (!targetLocation || !sourceLocation) { clearCandidate(); invalidDrop.value = true; return }
  const hit = document.elementFromPoint(latestX, latestY)
  const targetElement = hit?.closest<HTMLElement>('.desktop-entry[data-entry-key]')
  const targetEntry = targetElement ? entryAt({ area: targetElement.dataset.area as DesktopLocation['area'], pageId: targetElement.dataset.pageId, entryId: targetElement.dataset.entryId, index: targetElement.dataset.index ? Number(targetElement.dataset.index) : undefined }) : null
  if (targetElement && targetEntry && dragEntry.value?.type === 'app' && targetLocation.area !== 'folder' && targetEntry.type !== 'widget') {
    const rect = targetElement.getBoundingClientRect(), centered = Math.abs(latestX - (rect.left + rect.width / 2)) < rect.width * .29 && Math.abs(latestY - (rect.top + rect.height / 2)) < rect.height * .34
    if (centered && entryKey(targetEntry) !== dragKey.value) {
      setFolderCandidate({ ...targetLocation, entryId: targetEntry.id }, targetEntry)
      const canMove = canMoveEntry(sourceLocation, targetLocation)
      invalidDrop.value = !canMove
      if (canMove) pendingDropLocation = { ...targetLocation }
      return
    }
  }
  clearCandidate()
  const same = sourceLocation.area === targetLocation.area && sourceLocation.pageId === targetLocation.pageId && sourceLocation.column === targetLocation.column && sourceLocation.row === targetLocation.row && sourceLocation.index === targetLocation.index
  if (same) { invalidDrop.value = false; return }
  const canMove = canMoveEntry(sourceLocation, targetLocation)
  invalidDrop.value = !canMove
  if (canMove) pendingDropLocation = { ...targetLocation }
}
const startDrag = async (press: PendingPress) => {
  const entry = entryAt(press.location); if (!entry) return
  editing.value = true; placementWidgetId.value = ''; pageFeedback.value = ''
  dragEntry.value = entry.type === 'folder' ? { ...entry, appIds: [...entry.appIds] } : { ...entry }
  dragKey.value = entryKey(entry); sourceLocation = { ...press.location }; pendingDropLocation = null
  const rect = press.element.getBoundingClientRect(); dragLeft = rect.left; dragTop = rect.top; dragWidth = rect.width; dragHeight = rect.height
  dragStartX = press.startX; dragStartY = press.startY; latestX = press.startX; latestY = press.startY; dragVisible.value = true
  beginLayoutBatch()
  activePointerId = press.pointerId; capturedPointerElement = press.element
  try { press.element.setPointerCapture(press.pointerId) } catch { /* older WebView */ }
  pendingPress = null; suppressClickUntil = Date.now() + 700; navigator.vibrate?.(12)
  await nextTick(); if (dragProxy.value) Object.assign(dragProxy.value.style, { left: `${dragLeft}px`, top: `${dragTop}px`, width: `${dragWidth}px`, height: `${dragHeight}px` })
}
const handleItemPointerDown = (event: PointerEvent, location: DesktopLocation) => {
  if (event.button !== 0 || pendingPress || dragVisible.value || (event.target as Element).closest('.delete-app,.delete-widget')) return
  const element = (event.currentTarget as HTMLElement).closest<HTMLElement>('.desktop-entry'); if (!element) return
  const delay = editing.value ? 90 : 400
  const press: PendingPress = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, location: { ...location }, element, timer: setTimeout(() => void startDrag(press), delay) }
  pendingPress = press; window.addEventListener('pointermove', handlePointerMove, { passive: false }); window.addEventListener('pointerup', handlePointerUp); window.addEventListener('pointercancel', handlePointerCancel)
}
const handlePointerMove = (event: PointerEvent) => {
  if (pendingPress && event.pointerId === pendingPress.pointerId && !dragVisible.value) { if (Math.hypot(event.clientX - pendingPress.startX, event.clientY - pendingPress.startY) > 9) cancelPendingPress(); return }
  if (!dragVisible.value || (activePointerId !== null && event.pointerId !== activePointerId)) return
  event.preventDefault(); latestX = event.clientX; latestY = event.clientY; if (!moveFrame) moveFrame = requestAnimationFrame(processDragPosition)
}
const endDrag = (commitCandidate: boolean) => {
  if (moveFrame) cancelAnimationFrame(moveFrame); moveFrame = 0
  if (commitCandidate && candidateLocation && sourceLocation) {
    const target = entryAt(candidateLocation)
    if (target?.type === 'folder') addToFolder(sourceLocation, target.id)
    else if (target?.type === 'app') createFolder(sourceLocation, candidateLocation)
  } else if (commitCandidate && pendingDropLocation && sourceLocation) {
    void animateLayoutChange(() => moveEntry(sourceLocation!, pendingDropLocation!))
  }
  clearCandidate(); clearEdgeTimer(); dragVisible.value = false; dragEntry.value = null; dragKey.value = ''; sourceLocation = null; invalidDrop.value = false
  pendingDropLocation = null
  endLayoutBatch()
  if (capturedPointerElement && activePointerId !== null) try { capturedPointerElement.releasePointerCapture(activePointerId) } catch { /* already released */ }
  capturedPointerElement = null; activePointerId = null; suppressClickUntil = Date.now() + 450; removeGlobalPointerListeners()
}
const handlePointerUp = (event: PointerEvent) => { if (pendingPress && !dragVisible.value) { cancelPendingPress(); return }; if (activePointerId !== null && event.pointerId !== activePointerId) return; if (dragVisible.value) endDrag(true) }
const handlePointerCancel = () => { if (pendingPress && !dragVisible.value) cancelPendingPress(); else if (dragVisible.value) endDrag(false) }

let backgroundTimer: ReturnType<typeof setTimeout> | null = null
let backgroundStart = { x: 0, y: 0 }
const handleBackgroundPointerDown = (event: PointerEvent) => {
  if (editing.value || event.button !== 0 || (event.target as Element).closest('.desktop-entry,button,input,.folder-panel')) return
  backgroundStart = { x: event.clientX, y: event.clientY }; backgroundTimer = setTimeout(() => { editing.value = true; navigator.vibrate?.(10); backgroundTimer = null }, 400)
}
const handleBackgroundPointerMove = (event: PointerEvent) => { if (backgroundTimer && Math.hypot(event.clientX - backgroundStart.x, event.clientY - backgroundStart.y) > 9) { clearTimeout(backgroundTimer); backgroundTimer = null } }
const clearBackgroundPress = () => { if (backgroundTimer) clearTimeout(backgroundTimer); backgroundTimer = null }

const installWidget = async (widgetType: WidgetType, widthUnits: number, heightUnits: number) => {
  const result = addWidget(widgetType, widthUnits, heightUnits, currentPage.value)
  await ensureInstance(result.entry); editing.value = true; placementWidgetId.value = result.entry.id; pageFeedback.value = '长按并拖动新小组件，完成后点“完成”'
  await scrollToPage(result.pageIndex, false)
}
defineExpose({ installWidget })
onBeforeUnmount(() => { cancelPendingPress(); clearCandidate(); clearEdgeTimer(); clearBackgroundPress(); if (moveFrame) cancelAnimationFrame(moveFrame); if (dragVisible.value) endLayoutBatch() })
</script>

<template>
  <div class="desktop" :class="{ 'is-editing': editing, 'is-dragging': dragVisible, 'invalid-drop': invalidDrop }" @pointerdown="handleBackgroundPointerDown" @pointermove="handleBackgroundPointerMove" @pointerup="clearBackgroundPress" @pointercancel="clearBackgroundPress">
    <Transition name="toolbar-slide"><div v-if="editing" class="edit-toolbar">
      <button type="button" class="reset-button" @click="openReset">重置</button>
      <button type="button" title="在当前页后新建页面" @click="createDesktopPage">＋页</button>
      <span>编辑主屏幕</span>
      <button type="button" title="仅可删除空页面" @click="removeCurrentPage">−页</button>
      <button type="button" class="done-button" @click="finishEditing">完成</button>
    </div></Transition>
    <Transition name="fade"><div v-if="editing && pageFeedback" class="desktop-feedback" role="status">{{ pageFeedback }}</div></Transition>

    <div ref="scrollContainer" class="pages-container" @scroll="handleScroll">
      <div v-for="page in layout.pages" :key="page.id" class="page">
        <div class="desktop-grid" :class="{ 'default-first-grid': usesDefaultFirstLayout(page) }" :data-page-id="page.id">
          <div v-for="cell in gridCells" :key="`${page.id}-${cell.column}-${cell.row}`" class="desktop-grid-cell" :data-column="cell.column" :data-row="cell.row" :style="{ gridColumn: cell.column, gridRow: visualGridRow(page, cell.row) }"></div>
          <div v-if="!page.entries.length" class="empty-page-hint">空白页面<br><small>长按桌面可管理页面</small></div>
          <div v-for="entry in page.entries" :key="entryKey(entry)" class="desktop-entry" :class="{ 'dragging-source': dragKey === entryKey(entry), 'folder-target': folderCandidateKey === entryKey(entry), 'placement-entry': placementWidgetId === entry.id }" :style="{ gridColumn: `${entry.column} / span ${entry.type === 'widget' ? entry.widthUnits : 1}`, gridRow: `${visualGridRow(page, entry.row)} / span ${entry.type === 'widget' ? entry.heightUnits : 1}` }" :data-entry-key="entryKey(entry)" data-area="page" :data-page-id="page.id" :data-entry-id="entry.id" :data-column="entry.column" :data-row="entry.row" @pointerdown="handleItemPointerDown($event, pageEntryLocation(page.id, entry))" @click="activateEntry(entry)">
            <AppIcon v-if="entry.type === 'app' && getApp(entry.id)" :app="getApp(entry.id)" :badge="badgeForEntry(entry)" :editing="editing" @delete="removeApp(pageEntryLocation(page.id, entry))" />
            <DesktopFolderIcon v-else-if="entry.type === 'folder'" :folder="entry" :apps-by-id="appsById" :badge="badgeForEntry(entry)" :editing="editing" />
            <DesktopWidgetHost v-else-if="entry.type === 'widget'" :entry="entry" :editing="editing" @delete="removeWidgetEntry(entry)" @resize="openWidgetResize(entry)" />
          </div>
        </div>
      </div>
    </div>

    <div class="page-indicator" aria-label="桌面分页"><div v-for="page in layout.pages" :key="page.id" class="page-dot" :class="{ active: layout.pages[currentPage]?.id === page.id }"></div></div>
    <div class="dock-container"><div class="dock" data-drop-area="dock" :data-drop-index="layout.dock.length">
      <div v-for="(entry,index) in layout.dock" :key="`dock-${entryKey(entry)}`" class="desktop-entry" :class="{ 'dragging-source': dragKey === entryKey(entry), 'folder-target': folderCandidateKey === entryKey(entry) }" :data-entry-key="entryKey(entry)" data-area="dock" :data-index="index" data-drop-area="dock" :data-drop-index="index" @pointerdown="handleItemPointerDown($event,{area:'dock',index})" @click="activateEntry(entry)">
        <AppIcon v-if="entry.type === 'app' && getApp(entry.id)" :app="{...getApp(entry.id),name:globalSettings.showDockAppNames?getApp(entry.id).name:''}" :badge="badgeForEntry(entry)" :editing="editing" @delete="removeApp({area:'dock',index})" />
        <DesktopFolderIcon v-else-if="entry.type === 'folder'" :folder="entry" :apps-by-id="appsById" :badge="badgeForEntry(entry)" :editing="editing" />
      </div>
    </div></div>

    <Transition name="folder-open"><div v-if="openFolder" class="folder-overlay" @click.self="closeFolderView"><section ref="folderPanel" class="folder-panel" aria-label="文件夹">
      <input v-model="folderNameDraft" class="folder-title" maxlength="12" aria-label="文件夹名称" @blur="commitFolderName" @keyup.enter="($event.target as HTMLInputElement).blur()" />
      <div class="folder-grid" data-drop-area="folder" :data-drop-folder="openFolder.id" :data-drop-index="openFolder.appIds.length">
        <div v-for="(appId,index) in openFolder.appIds" :key="appId" class="desktop-entry folder-app" :class="{ 'dragging-source': dragKey === `app:${appId}` }" :data-entry-key="`app:${appId}`" data-area="folder" :data-index="index" data-drop-area="folder" :data-drop-folder="openFolder.id" :data-drop-index="index" @pointerdown="handleItemPointerDown($event,{area:'folder',folderId:openFolder.id,index})" @click="!editing && emit('open-app',appId)">
          <AppIcon v-if="getApp(appId)" :app="getApp(appId)" :badge="badgeForApp(appId)" :editing="editing" @delete="removeApp({area:'folder',folderId:openFolder.id,index})" />
        </div>
      </div><p v-if="editing" class="folder-hint">拖动排序，拖到文件夹外即可移出</p>
    </section></div></Transition>

    <div v-if="dragVisible && dragEntry" ref="dragProxy" class="drag-proxy" aria-hidden="true">
      <AppIcon v-if="dragEntry.type==='app' && getApp(dragEntry.id)" :app="getApp(dragEntry.id)" :badge="badgeForEntry(dragEntry)" hide-delete />
      <DesktopFolderIcon v-else-if="dragEntry.type==='folder'" :folder="dragEntry" :apps-by-id="appsById" :badge="badgeForEntry(dragEntry)" />
      <DesktopWidgetHost v-else-if="dragEntry.type==='widget'" :entry="dragEntry" hide-delete />
    </div>

    <Transition name="fade"><div v-if="showResetConfirm" class="confirm-overlay" @click.self="showResetConfirm=false"><div class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="reset-title">
      <h3 id="reset-title">重置主屏幕？</h3><p>将恢复默认 APP 顺序、Dock 和文件夹。未勾选的小组件会原位保留，不影响 APP 数据、壁纸或自定义图标。</p>
      <section class="reset-widget-picker">
        <button type="button" class="reset-widget-summary" :aria-expanded="showWidgetPicker" @click="showWidgetPicker=!showWidgetPicker">
          <span><b>删除小组件（可选）</b><small>{{ selectedWidgetIds.length ? `已选择 ${selectedWidgetIds.length} 个` : '未选择时不删除、不移动小组件' }}</small></span><i>{{ showWidgetPicker ? '⌃' : '⌄' }}</i>
        </button>
        <div v-if="showWidgetPicker" class="reset-widget-list">
          <div v-if="desktopWidgets.length" class="reset-widget-tools"><button type="button" @click="selectAllWidgets">全选</button><button type="button" @click="selectedWidgetIds=[]">取消全选</button></div>
          <label v-for="item in desktopWidgets" :key="item.entry.id" class="reset-widget-row">
            <input type="checkbox" :checked="selectedWidgetIds.includes(item.entry.id)" @change="toggleWidgetSelection(item.entry.id, ($event.target as HTMLInputElement).checked)" />
            <span class="custom-check"></span>
            <span><b>{{ item.name }}</b><small>第 {{ item.pageIndex + 1 }} 页 · {{ item.entry.widthUnits }} × {{ item.entry.heightUnits }}</small></span>
          </label>
          <p v-if="!desktopWidgets.length" class="reset-widget-empty">当前桌面没有可删除的小组件</p>
        </div>
      </section>
      <div class="confirm-actions"><button type="button" :disabled="resetting" @click="showResetConfirm=false">取消</button><button type="button" class="danger" :disabled="resetting" @click="confirmReset">{{ resetting ? '处理中…' : selectedWidgetIds.length ? `重置并删除 ${selectedWidgetIds.length} 个` : '重置' }}</button></div>
    </div></div></Transition>

    <Transition name="fade"><div v-if="resizingWidget" class="confirm-overlay" @click.self="resizingWidget=null"><div class="confirm-card resize-card" role="dialog" aria-modal="true" aria-labelledby="resize-title">
      <h3 id="resize-title">调整小组件尺寸</h3><p>宽高使用桌面网格单位，可输入 1～4。空间不足时不会移动或覆盖其他内容。</p>
      <div class="resize-presets">
        <button v-for="size in [[1,1],[2,1],[2,2],[3,2],[4,2],[4,3],[4,4]]" :key="size.join('x')" type="button" :class="{active:resizeWidth===size[0]&&resizeHeight===size[1]}" @click="resizeWidth=size[0];resizeHeight=size[1]">{{size[0]}}×{{size[1]}}</button>
      </div>
      <div class="resize-inputs"><label>宽<input v-model.number="resizeWidth" type="number" inputmode="numeric" min="1" max="4" /></label><i>×</i><label>高<input v-model.number="resizeHeight" type="number" inputmode="numeric" min="1" max="4" /></label></div>
      <div class="confirm-actions"><button type="button" @click="resizingWidget=null">取消</button><button type="button" @click="applyWidgetResize">应用尺寸</button></div>
    </div></div></Transition>
  </div>
</template>

<style scoped>
.desktop { flex:1; display:flex; flex-direction:column; padding-top:max(calc(6vh + 42px),calc(env(safe-area-inset-top) + 78px)); position:relative; width:100%; height:100%; box-sizing:border-box; overflow:hidden; color:var(--text-primary); }
.pages-container { flex:1; display:flex; width:100%; overflow-x:auto; overflow-y:hidden; scroll-snap-type:x mandatory; overscroll-behavior-x:contain; scrollbar-width:none; }.pages-container::-webkit-scrollbar{display:none}.page{flex:0 0 100%;width:100%;height:100%;scroll-snap-align:start;scroll-snap-stop:always;display:flex;align-items:flex-start;justify-content:center;overflow:hidden}
.desktop-grid { --cell:min(20.8vw,88px); --row:var(--cell); --gap:min(2.1vw,10px); position:relative; display:grid; grid-template-columns:repeat(4,var(--cell)); grid-template-rows:repeat(4,var(--row)); gap:var(--gap); width:calc(var(--cell)*4 + var(--gap)*3); height:calc(var(--row)*4 + var(--gap)*3); margin-top:1.5vh; }
.desktop-grid.default-first-grid { --hero-height:220px; --hero-row:calc((var(--hero-height) - var(--gap))/2); --hero-spacer:8px; grid-template-rows:var(--hero-row) var(--hero-row) var(--hero-spacer) var(--row) var(--row); height:calc(var(--hero-height) + var(--hero-spacer) + var(--row)*2 + var(--gap)*3); }
.desktop-grid-cell{z-index:0;min-width:0;min-height:0}.desktop-entry{position:relative;min-width:0;min-height:0;touch-action:pan-x;-webkit-touch-callout:none;contain:layout style;z-index:2;display:flex;align-items:center;justify-content:center}.desktop-entry> :deep(*){min-width:0}.is-editing .desktop-entry{touch-action:none}.dragging-source{opacity:.16}.placement-entry::after{content:'拖动放置';position:absolute;z-index:30;right:7px;bottom:7px;padding:4px 7px;border-radius:9px;background:rgba(30,30,32,.72);color:#fff;font-size:10px;pointer-events:none}.folder-target::after{content:'';position:absolute;inset:-5px;border-radius:24%;border:2px solid rgba(255,255,255,.92);background:rgba(255,255,255,.12);box-shadow:0 0 0 3px rgba(64,145,255,.45);pointer-events:none;animation:folder-pulse .65s ease-in-out infinite alternate}.invalid-drop .drag-proxy{filter:drop-shadow(0 12px 15px rgba(0,0,0,.25)) saturate(.55);opacity:.78}@keyframes folder-pulse{from{transform:scale(.96)}to{transform:scale(1.03)}}
.empty-page-hint{position:absolute;z-index:1;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-secondary);font-size:14px;pointer-events:none}.empty-page-hint small{margin-top:5px;font-size:11px;opacity:.8}.page-indicator{display:flex;justify-content:center;align-items:center;gap:6px;min-height:14px;padding-bottom:1vh}.page-dot{width:6px;height:6px;background:rgba(255,255,255,.4);border-radius:50%;transition:all .3s}.page-dot.active{width:8px;height:8px;background:rgba(255,255,255,.9)}
.dock-container{padding:1.5vh 4vw 3vh;width:100%;box-sizing:border-box}.dock{min-height:calc(14.5vw + 4vh);padding:2vh 3vw;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:center;width:100%;border-radius:6vw;background:var(--dock-bg);backdrop-filter:blur(20px);transition:background-color .3s}.edit-toolbar{position:absolute;z-index:80;top:max(44px,calc(env(safe-area-inset-top) + 40px));left:3vw;right:3vw;height:38px;padding:0 5px;display:grid;grid-template-columns:auto auto 1fr auto auto;align-items:center;gap:3px;border-radius:19px;background:rgba(30,30,32,.62);color:#fff;box-shadow:0 4px 18px rgba(0,0,0,.16);backdrop-filter:blur(18px);font-size:12px;font-weight:600}.edit-toolbar span{text-align:center;white-space:nowrap}.edit-toolbar button{height:30px;padding:0 9px;border:0;border-radius:15px;color:#fff;background:rgba(255,255,255,.12);font:inherit}.edit-toolbar .done-button{background:#0a84ff}.desktop-feedback{position:absolute;z-index:75;top:max(88px,calc(env(safe-area-inset-top) + 84px));left:50%;max-width:80%;padding:6px 12px;border-radius:12px;transform:translateX(-50%);background:rgba(30,30,32,.7);color:#fff;font-size:11px;text-align:center;pointer-events:none;backdrop-filter:blur(12px)}
.drag-proxy{position:fixed;z-index:300;margin:0;pointer-events:none;transform-origin:center;filter:drop-shadow(0 12px 15px rgba(0,0,0,.25));will-change:transform;contain:layout paint style}.folder-overlay{position:absolute;z-index:120;inset:0;display:flex;align-items:center;justify-content:center;padding:8vw;background:rgba(215,228,238,.38);backdrop-filter:blur(22px) saturate(1.15)}.folder-panel{width:100%;max-height:68%;min-height:270px;padding:20px 16px 16px;overflow:hidden;border:1px solid rgba(255,255,255,.5);border-radius:28px;background:rgba(236,244,250,.64);box-shadow:0 18px 55px rgba(35,70,100,.2)}.folder-title{display:block;width:min(210px,80%);height:34px;margin:0 auto 18px;padding:0 12px;border:0;border-radius:10px;outline:none;color:var(--text-primary);background:rgba(255,255,255,.32);text-align:center;font-size:16px;font-weight:600}.folder-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:25px 10px;align-content:start;min-height:190px;max-height:calc(68vh - 100px);padding:10px 4px 35px;overflow-y:auto}.folder-app{min-height:82px}.folder-hint{margin-top:-20px;color:rgba(55,70,82,.7);font-size:11px;text-align:center}
.confirm-overlay{position:absolute;z-index:400;inset:0;display:flex;align-items:center;justify-content:center;padding:26px;background:rgba(0,0,0,.28);backdrop-filter:blur(8px)}.confirm-card{width:100%;max-width:350px;max-height:min(82%,620px);display:flex;flex-direction:column;overflow:hidden;border-radius:20px;color:var(--text-primary);background:var(--sys-bg-secondary);box-shadow:0 20px 60px rgba(0,0,0,.28);text-align:center}.confirm-card h3{flex:0 0 auto;margin:22px 20px 8px;font-size:17px}.confirm-card>p{flex:0 0 auto;margin:0 22px 16px;color:var(--text-secondary);font-size:13px;line-height:1.55}.reset-widget-picker{min-height:0;display:flex;flex:0 1 auto;flex-direction:column;margin:0 18px 18px;overflow:hidden;border-radius:13px;background:var(--card-bg-solid);text-align:left}.reset-widget-summary{box-sizing:border-box;display:flex;width:100%;min-height:58px;flex:0 0 auto;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:0;background:transparent;color:inherit;font:inherit;text-align:left}.reset-widget-summary span{min-width:0}.reset-widget-summary b,.reset-widget-summary small{display:block}.reset-widget-summary b{font-size:13px}.reset-widget-summary small{margin-top:3px;color:var(--text-secondary);font-size:10px;line-height:1.35}.reset-widget-summary i{font-size:16px;font-style:normal;color:var(--text-secondary)}.reset-widget-list{min-height:0;max-height:250px;overflow-y:auto;border-top:1px solid var(--border-color);padding:6px 10px 9px}.reset-widget-tools{display:flex;justify-content:flex-end;gap:12px;padding:4px 2px}.reset-widget-tools button{border:0;background:transparent;color:#0a84ff;font:inherit;font-size:10px}.reset-widget-row{display:flex;align-items:center;gap:9px;padding:8px 2px;cursor:pointer}.reset-widget-row input{position:absolute;opacity:0;pointer-events:none}.custom-check{width:19px;height:19px;flex:0 0 auto;border:1.5px solid var(--border-color);border-radius:6px;background:var(--sys-bg-primary)}.reset-widget-row input:checked+.custom-check{background:#0a84ff;border-color:#0a84ff}.reset-widget-row input:checked+.custom-check::after{content:'✓';display:block;color:#fff;font-size:13px;line-height:17px;text-align:center}.reset-widget-row b,.reset-widget-row small{display:block}.reset-widget-row b{font-size:12px}.reset-widget-row small{margin-top:2px;color:var(--text-secondary);font-size:9px}.reset-widget-empty{margin:0;padding:14px 4px;color:var(--text-secondary);font-size:11px;text-align:center}.confirm-actions{flex:0 0 auto;display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--border-color)}.confirm-actions button{min-width:0;height:48px;padding:0 8px;border:0;color:#0a84ff;background:transparent;font-size:15px}.confirm-actions button:disabled{opacity:.45}.confirm-actions button+button{border-left:1px solid var(--border-color)}.confirm-actions .danger{color:#ff3b30;font-weight:600}
.resize-card>p{font-size:11px}.resize-presets{display:flex;gap:5px;overflow-x:auto;margin:0 16px 12px;padding-bottom:2px;scrollbar-width:none}.resize-presets::-webkit-scrollbar{display:none}.resize-presets button{height:27px;min-width:38px;flex:0 0 auto;border:1px solid var(--border-color);border-radius:9px;background:var(--card-bg-solid);color:var(--text-secondary);font:inherit;font-size:9px}.resize-presets button.active{border-color:var(--text-primary);color:var(--text-primary)}.resize-inputs{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 18px 18px}.resize-inputs label{display:flex;align-items:center;gap:5px;color:var(--text-secondary);font-size:11px}.resize-inputs i{color:var(--text-secondary);font-style:normal}.resize-inputs input{box-sizing:border-box;width:48px;height:34px;border:1px solid var(--border-color);border-radius:10px;outline:0;background:var(--sys-bg-primary);color:var(--text-primary);font:inherit;font-size:12px;text-align:center}.resize-inputs input:focus{border-color:var(--text-secondary)}
.toolbar-slide-enter-active,.toolbar-slide-leave-active,.folder-open-enter-active,.folder-open-leave-active,.fade-enter-active,.fade-leave-active{transition:opacity .2s ease,transform .25s cubic-bezier(.2,.8,.2,1)}.toolbar-slide-enter-from,.toolbar-slide-leave-to{opacity:0;transform:translateY(-10px)}.folder-open-enter-from,.folder-open-leave-to,.fade-enter-from,.fade-leave-to{opacity:0}.folder-open-enter-from .folder-panel,.folder-open-leave-to .folder-panel{transform:scale(.88)}
@media(min-width:768px){.dock-container{display:flex;justify-content:center}.dock{width:500px;min-height:104px;padding:2vh 20px;border-radius:28px}.folder-panel{max-width:430px;padding:28px}.edit-toolbar{left:50%;right:auto;width:500px;transform:translateX(-50%)}.desktop-grid{--cell:88px;--gap:12px}}@media(prefers-reduced-motion:reduce){.folder-target::after{animation:none}}
</style>
