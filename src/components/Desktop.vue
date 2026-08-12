<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { globalSettings } from '../store'
import AppIcon from './AppIcon.vue'
import DesktopFolderIcon from './DesktopFolderIcon.vue'
import MomentCard from './MomentCard.vue'
import DualAvatarWidget from './DualAvatarWidget.vue'
import { useChatState } from '../composables/useChatState'
import { useDesktopLayout, type DesktopEntry, type DesktopFolderEntry, type DesktopLocation } from '../composables/useDesktopLayout'

interface AppInfo {
  id: string
  name: string
  icon: string
  color: string
  customImage?: string | null
}

const props = defineProps<{ apps: AppInfo[] }>()
const emit = defineEmits<{ 'open-app': [appId: string] }>()

const chatState = useChatState()
const { layout, initialize, entryAt, findFolder, moveEntry, addToFolder, createFolder, hideApp, renameFolder, reset } = useDesktopLayout()
initialize(props.apps.map(app => app.id))

const appsById = computed<Record<string, AppInfo>>(() => Object.fromEntries(props.apps.map(app => [app.id, app])))
const scrollContainer = ref<HTMLElement | null>(null)
const folderPanel = ref<HTMLElement | null>(null)
const dragProxy = ref<HTMLElement | null>(null)
const currentPage = ref(0)
const editing = ref(false)
const showResetConfirm = ref(false)
const openFolderId = ref<string | null>(null)
const folderNameDraft = ref('文件夹')
const dragVisible = ref(false)
const dragEntry = ref<DesktopEntry | null>(null)
const dragKey = ref('')
const folderCandidateKey = ref('')

const openFolder = computed(() => openFolderId.value ? findFolder(openFolderId.value) : null)

const entryKey = (entry: DesktopEntry) => `${entry.type}:${entry.id}`
const getApp = (id: string) => appsById.value[id]
const badgeForApp = (id: string) => id === 'chat' ? chatState.totalUnreadCount.value : 0
const badgeForEntry = (entry: DesktopEntry) => entry.type === 'app'
  ? badgeForApp(entry.id)
  : entry.appIds.includes('chat') ? chatState.totalUnreadCount.value : 0

const locationKey = (location: DesktopLocation) => `${location.area}:${location.page ?? ''}:${location.folderId ?? ''}:${location.index}`

const handleScroll = () => {
  const element = scrollContainer.value
  if (!element) return
  currentPage.value = Math.round(element.scrollLeft / Math.max(element.clientWidth, 1))
}

const openFolderView = (folder: DesktopFolderEntry) => {
  if (Date.now() < suppressClickUntil) return
  openFolderId.value = folder.id
  folderNameDraft.value = folder.name
}

const closeFolderView = () => {
  if (dragVisible.value) return
  openFolderId.value = null
}

const commitFolderName = () => {
  if (!openFolderId.value) return
  renameFolder(openFolderId.value, folderNameDraft.value)
  folderNameDraft.value = findFolder(openFolderId.value)?.name ?? '文件夹'
}

const activateApp = (entry: DesktopEntry) => {
  if (Date.now() < suppressClickUntil) return
  if (entry.type === 'folder') {
    openFolderView(entry)
    return
  }
  if (!editing.value) emit('open-app', entry.id)
}

const finishEditing = () => {
  editing.value = false
  openFolderId.value = null
}

const confirmReset = () => {
  reset(props.apps.map(app => app.id))
  showResetConfirm.value = false
  openFolderId.value = null
  currentPage.value = 0
  scrollContainer.value?.scrollTo({ left: 0, behavior: 'smooth' })
}

const removeApp = (location: DesktopLocation) => {
  if (!hideApp(location)) return
  if (openFolderId.value && !findFolder(openFolderId.value)) openFolderId.value = null
}

type PendingPress = {
  pointerId: number
  startX: number
  startY: number
  location: DesktopLocation
  element: HTMLElement
  timer: ReturnType<typeof setTimeout>
}

let pendingPress: PendingPress | null = null
let sourceLocation: DesktopLocation | null = null
let dragStartX = 0
let dragStartY = 0
let dragLeft = 0
let dragTop = 0
let dragWidth = 0
let dragHeight = 0
let latestX = 0
let latestY = 0
let moveFrame = 0
let candidateTimer: ReturnType<typeof setTimeout> | null = null
let candidateLocation: DesktopLocation | null = null
let lastCandidateKey = ''
let edgePageTimer: ReturnType<typeof setTimeout> | null = null
let edgeDirection = 0
let suppressClickUntil = 0
let activePointerId: number | null = null
let capturedPointerElement: HTMLElement | null = null

const clearCandidate = () => {
  if (candidateTimer) clearTimeout(candidateTimer)
  candidateTimer = null
  candidateLocation = null
  lastCandidateKey = ''
  folderCandidateKey.value = ''
}

const clearEdgeTimer = () => {
  if (edgePageTimer) clearTimeout(edgePageTimer)
  edgePageTimer = null
  edgeDirection = 0
}

const removeGlobalPointerListeners = () => {
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('pointercancel', handlePointerCancel)
}

const cancelPendingPress = () => {
  if (pendingPress) clearTimeout(pendingPress.timer)
  pendingPress = null
  if (!dragVisible.value) removeGlobalPointerListeners()
}

const captureRects = () => {
  const rects = new Map<string, DOMRect>()
  document.querySelectorAll<HTMLElement>('.desktop-entry[data-entry-key]').forEach(element => {
    if (!element.dataset.entryKey || element.dataset.entryKey === dragKey.value) return
    rects.set(element.dataset.entryKey, element.getBoundingClientRect())
  })
  return rects
}

const animateLayoutChange = async (change: () => void) => {
  const before = captureRects()
  change()
  await nextTick()
  document.querySelectorAll<HTMLElement>('.desktop-entry[data-entry-key]').forEach(element => {
    const key = element.dataset.entryKey
    const oldRect = key ? before.get(key) : null
    if (!oldRect || key === dragKey.value) return
    const newRect = element.getBoundingClientRect()
    const deltaX = oldRect.left - newRect.left
    const deltaY = oldRect.top - newRect.top
    if (Math.abs(deltaX) < .5 && Math.abs(deltaY) < .5) return
    element.animate([
      { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
      { transform: 'translate3d(0, 0, 0)' }
    ], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' })
  })
}

const setFolderCandidate = (location: DesktopLocation, targetEntry: DesktopEntry) => {
  if (!dragEntry.value || dragEntry.value.type !== 'app') return
  if (targetEntry.type === 'app' && targetEntry.id === dragEntry.value.id) return
  if (targetEntry.type === 'folder' && targetEntry.appIds.includes(dragEntry.value.id)) return
  const key = `${locationKey(location)}:${entryKey(targetEntry)}`
  if (lastCandidateKey === key) return
  clearCandidate()
  lastCandidateKey = key
  candidateTimer = setTimeout(() => {
    candidateLocation = { ...location }
    folderCandidateKey.value = entryKey(targetEntry)
    navigator.vibrate?.(8)
  }, 360)
}

const locationFromElement = (element: Element | null): DesktopLocation | null => {
  const target = element?.closest<HTMLElement>('[data-drop-area]')
  if (!target?.dataset.dropArea) return null
  const area = target.dataset.dropArea as DesktopLocation['area']
  return {
    area,
    index: Number(target.dataset.dropIndex ?? 0),
    page: area === 'page' ? Number(target.dataset.dropPage ?? currentPage.value) : undefined,
    folderId: area === 'folder' ? target.dataset.dropFolder : undefined
  }
}

const maybeTurnPage = (x: number) => {
  if (openFolderId.value) {
    clearEdgeTimer()
    return
  }
  const desktopRect = scrollContainer.value?.getBoundingClientRect()
  if (!desktopRect) return
  const edge = Math.min(42, desktopRect.width * .12)
  const direction = x < desktopRect.left + edge ? -1 : x > desktopRect.right - edge ? 1 : 0
  if (!direction || currentPage.value + direction < 0 || currentPage.value + direction >= layout.pages.length) {
    clearEdgeTimer()
    return
  }
  if (edgeDirection === direction && edgePageTimer) return
  clearEdgeTimer()
  edgeDirection = direction
  edgePageTimer = setTimeout(() => {
    const nextPage = currentPage.value + direction
    scrollContainer.value?.scrollTo({ left: nextPage * (scrollContainer.value?.clientWidth ?? 0), behavior: 'smooth' })
    currentPage.value = nextPage
    clearEdgeTimer()
  }, 520)
}

const processDragPosition = () => {
  moveFrame = 0
  const proxy = dragProxy.value
  if (proxy) proxy.style.transform = `translate3d(${latestX - dragStartX}px, ${latestY - dragStartY}px, 0) scale(1.08)`

  const panelRect = folderPanel.value?.getBoundingClientRect()
  if (openFolderId.value && panelRect && (latestX < panelRect.left - 22 || latestX > panelRect.right + 22 || latestY < panelRect.top - 22 || latestY > panelRect.bottom + 22)) {
    openFolderId.value = null
    clearCandidate()
    return
  }

  maybeTurnPage(latestX)
  const hit = document.elementFromPoint(latestX, latestY)
  const slot = hit?.closest<HTMLElement>('.desktop-drop-slot')
  const targetLocation = locationFromElement(slot ?? hit)
  if (!targetLocation || !sourceLocation) {
    clearCandidate()
    return
  }

  const targetEntry = slot ? entryAt(targetLocation) : null
  if (slot && targetEntry && dragEntry.value?.type === 'app' && targetLocation.area !== 'folder') {
    const rect = slot.getBoundingClientRect()
    const inCenter = Math.abs(latestX - (rect.left + rect.width / 2)) < rect.width * .29 && Math.abs(latestY - (rect.top + rect.height / 2)) < rect.height * .34
    if (inCenter && entryKey(targetEntry) !== dragKey.value) {
      setFolderCandidate(targetLocation, targetEntry)
      return
    }
  }
  clearCandidate()

  if (sameLocation(sourceLocation, targetLocation)) return
  void animateLayoutChange(() => {
    const moved = moveEntry(sourceLocation!, targetLocation)
    if (moved) sourceLocation = moved
  })
}

const sameLocation = (a: DesktopLocation, b: DesktopLocation) => a.area === b.area && a.page === b.page && a.folderId === b.folderId && a.index === b.index

const startDrag = async (press: PendingPress) => {
  const entry = entryAt(press.location)
  if (!entry) return
  editing.value = true
  dragEntry.value = entry.type === 'app' ? { ...entry } : { ...entry, appIds: [...entry.appIds] }
  dragKey.value = entryKey(entry)
  sourceLocation = { ...press.location }
  const rect = press.element.getBoundingClientRect()
  dragLeft = rect.left
  dragTop = rect.top
  dragWidth = rect.width
  dragHeight = rect.height
  dragStartX = press.startX
  dragStartY = press.startY
  latestX = press.startX
  latestY = press.startY
  dragVisible.value = true
  activePointerId = press.pointerId
  capturedPointerElement = press.element
  try { press.element.setPointerCapture(press.pointerId) } catch { /* 部分旧版移动浏览器不支持指针捕获 */ }
  pendingPress = null
  suppressClickUntil = Date.now() + 700
  navigator.vibrate?.(12)
  await nextTick()
  if (dragProxy.value) {
    Object.assign(dragProxy.value.style, {
      left: `${dragLeft}px`, top: `${dragTop}px`, width: `${dragWidth}px`, height: `${dragHeight}px`
    })
  }
}

const handleItemPointerDown = (event: PointerEvent, location: DesktopLocation) => {
  if (event.button !== 0 || pendingPress || dragVisible.value) return
  const element = (event.currentTarget as HTMLElement).closest<HTMLElement>('.desktop-entry')
  if (!element) return
  const delay = editing.value ? 90 : 400
  const press: PendingPress = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    location: { ...location },
    element,
    timer: setTimeout(() => void startDrag(press), delay)
  }
  pendingPress = press
  window.addEventListener('pointermove', handlePointerMove, { passive: false })
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerCancel)
}

const handlePointerMove = (event: PointerEvent) => {
  if (pendingPress && event.pointerId === pendingPress.pointerId && !dragVisible.value) {
    const distance = Math.hypot(event.clientX - pendingPress.startX, event.clientY - pendingPress.startY)
    if (distance > 9) cancelPendingPress()
    return
  }
  if (!dragVisible.value) return
  if (activePointerId !== null && event.pointerId !== activePointerId) return
  event.preventDefault()
  latestX = event.clientX
  latestY = event.clientY
  if (!moveFrame) moveFrame = requestAnimationFrame(processDragPosition)
}

const endDrag = (commitCandidate: boolean) => {
  if (moveFrame) cancelAnimationFrame(moveFrame)
  moveFrame = 0
  if (commitCandidate && candidateLocation && sourceLocation) {
    const target = entryAt(candidateLocation)
    if (target?.type === 'folder') addToFolder(sourceLocation, target.id)
    else if (target?.type === 'app') createFolder(sourceLocation, candidateLocation)
  }
  clearCandidate()
  clearEdgeTimer()
  dragVisible.value = false
  dragEntry.value = null
  dragKey.value = ''
  sourceLocation = null
  if (capturedPointerElement && activePointerId !== null) {
    try { capturedPointerElement.releasePointerCapture(activePointerId) } catch { /* 指针可能已由浏览器释放 */ }
  }
  capturedPointerElement = null
  activePointerId = null
  suppressClickUntil = Date.now() + 450
  removeGlobalPointerListeners()
}

const handlePointerUp = (event: PointerEvent) => {
  if (pendingPress && !dragVisible.value) {
    cancelPendingPress()
    return
  }
  if (activePointerId !== null && event.pointerId !== activePointerId) return
  if (dragVisible.value) endDrag(true)
}

const handlePointerCancel = () => {
  if (pendingPress && !dragVisible.value) cancelPendingPress()
  else if (dragVisible.value) endDrag(false)
}

let backgroundTimer: ReturnType<typeof setTimeout> | null = null
let backgroundStart = { x: 0, y: 0 }
const handleBackgroundPointerDown = (event: PointerEvent) => {
  if (editing.value || event.button !== 0 || (event.target as Element).closest('.desktop-entry, button, input, .folder-panel')) return
  backgroundStart = { x: event.clientX, y: event.clientY }
  backgroundTimer = setTimeout(() => {
    editing.value = true
    navigator.vibrate?.(10)
    backgroundTimer = null
  }, 400)
}
const handleBackgroundPointerMove = (event: PointerEvent) => {
  if (backgroundTimer && Math.hypot(event.clientX - backgroundStart.x, event.clientY - backgroundStart.y) > 9) {
    clearTimeout(backgroundTimer)
    backgroundTimer = null
  }
}
const clearBackgroundPress = () => {
  if (backgroundTimer) clearTimeout(backgroundTimer)
  backgroundTimer = null
}

onBeforeUnmount(() => {
  cancelPendingPress()
  clearCandidate()
  clearEdgeTimer()
  clearBackgroundPress()
  if (moveFrame) cancelAnimationFrame(moveFrame)
})
</script>

<template>
  <div class="desktop" :class="{ 'is-editing': editing, 'is-dragging': dragVisible }" @pointerdown="handleBackgroundPointerDown" @pointermove="handleBackgroundPointerMove" @pointerup="clearBackgroundPress" @pointercancel="clearBackgroundPress">
    <Transition name="toolbar-slide">
      <div v-if="editing" class="edit-toolbar">
        <button type="button" class="reset-button" @click="showResetConfirm = true">重置</button>
        <span>编辑主屏幕</span>
        <button type="button" class="done-button" @click="finishEditing">完成</button>
      </div>
    </Transition>

    <div ref="scrollContainer" class="pages-container" @scroll="handleScroll">
      <div class="page">
        <div class="top-widget-area"><MomentCard /></div>
        <div class="middle-content">
          <div class="app-grid drop-container" data-drop-area="page" data-drop-page="0" :data-drop-index="layout.pages[0]?.length ?? 0">
            <div v-for="(entry, index) in layout.pages[0]" :key="entryKey(entry)" class="desktop-entry desktop-drop-slot" :class="{ 'dragging-source': dragKey === entryKey(entry), 'folder-target': folderCandidateKey === entryKey(entry) }" :data-entry-key="entryKey(entry)" data-drop-area="page" data-drop-page="0" :data-drop-index="index" @pointerdown="handleItemPointerDown($event, { area: 'page', page: 0, index })" @click="activateApp(entry)">
              <AppIcon v-if="entry.type === 'app' && getApp(entry.id)" :app="getApp(entry.id)" :badge="badgeForEntry(entry)" :editing="editing" @delete="removeApp({ area: 'page', page: 0, index })" />
              <DesktopFolderIcon v-else-if="entry.type === 'folder'" :folder="entry" :apps-by-id="appsById" :badge="badgeForEntry(entry)" :editing="editing" />
            </div>
          </div>
          <div class="right-widget-area"><DualAvatarWidget /></div>
        </div>
      </div>

      <div v-for="pageIndex in Math.max(layout.pages.length - 1, 0)" :key="`desktop-page-${pageIndex}`" class="page">
        <div class="page-two-grid drop-container" data-drop-area="page" :data-drop-page="pageIndex" :data-drop-index="layout.pages[pageIndex]?.length ?? 0">
          <div v-for="(entry, index) in layout.pages[pageIndex]" :key="entryKey(entry)" class="desktop-entry desktop-drop-slot" :class="{ 'dragging-source': dragKey === entryKey(entry), 'folder-target': folderCandidateKey === entryKey(entry) }" :data-entry-key="entryKey(entry)" data-drop-area="page" :data-drop-page="pageIndex" :data-drop-index="index" @pointerdown="handleItemPointerDown($event, { area: 'page', page: pageIndex, index })" @click="activateApp(entry)">
            <AppIcon v-if="entry.type === 'app' && getApp(entry.id)" :app="getApp(entry.id)" :badge="badgeForEntry(entry)" :editing="editing" @delete="removeApp({ area: 'page', page: 1, index })" />
            <DesktopFolderIcon v-else-if="entry.type === 'folder'" :folder="entry" :apps-by-id="appsById" :badge="badgeForEntry(entry)" :editing="editing" />
          </div>
        </div>
      </div>
    </div>

    <div class="page-indicator" aria-label="桌面分页"><div v-for="(_, index) in layout.pages" :key="index" class="page-dot" :class="{ active: currentPage === index }"></div></div>

    <div class="dock-container">
      <div class="dock drop-container" data-drop-area="dock" :data-drop-index="layout.dock.length">
        <div v-for="(entry, index) in layout.dock" :key="`dock-${entryKey(entry)}`" class="desktop-entry desktop-drop-slot" :class="{ 'dragging-source': dragKey === entryKey(entry), 'folder-target': folderCandidateKey === entryKey(entry) }" :data-entry-key="entryKey(entry)" data-drop-area="dock" :data-drop-index="index" @pointerdown="handleItemPointerDown($event, { area: 'dock', index })" @click="activateApp(entry)">
          <AppIcon v-if="entry.type === 'app' && getApp(entry.id)" :app="{ ...getApp(entry.id), name: globalSettings.showDockAppNames ? getApp(entry.id).name : '' }" :badge="badgeForEntry(entry)" :editing="editing" @delete="removeApp({ area: 'dock', index })" />
          <DesktopFolderIcon v-else-if="entry.type === 'folder'" :folder="entry" :apps-by-id="appsById" :badge="badgeForEntry(entry)" :editing="editing" />
        </div>
      </div>
    </div>

    <Transition name="folder-open">
      <div v-if="openFolder" class="folder-overlay" @click.self="closeFolderView">
        <section ref="folderPanel" class="folder-panel" aria-label="文件夹">
          <input v-model="folderNameDraft" class="folder-title" maxlength="12" aria-label="文件夹名称" @blur="commitFolderName" @keyup.enter="($event.target as HTMLInputElement).blur()" />
          <div class="folder-grid drop-container" data-drop-area="folder" :data-drop-folder="openFolder.id" :data-drop-index="openFolder.appIds.length">
            <div v-for="(appId, index) in openFolder.appIds" :key="appId" class="desktop-entry desktop-drop-slot folder-app" :class="{ 'dragging-source': dragKey === `app:${appId}` }" :data-entry-key="`app:${appId}`" data-drop-area="folder" :data-drop-folder="openFolder.id" :data-drop-index="index" @pointerdown="handleItemPointerDown($event, { area: 'folder', folderId: openFolder.id, index })" @click="!editing && emit('open-app', appId)">
              <AppIcon v-if="getApp(appId)" :app="getApp(appId)" :badge="badgeForApp(appId)" :editing="editing" @delete="removeApp({ area: 'folder', folderId: openFolder.id, index })" />
            </div>
          </div>
          <p v-if="editing" class="folder-hint">拖动排序，拖到文件夹外即可移出</p>
        </section>
      </div>
    </Transition>

    <div v-if="dragVisible && dragEntry" ref="dragProxy" class="drag-proxy" aria-hidden="true">
      <AppIcon v-if="dragEntry.type === 'app' && getApp(dragEntry.id)" :app="getApp(dragEntry.id)" :badge="badgeForEntry(dragEntry)" hide-delete />
      <DesktopFolderIcon v-else-if="dragEntry.type === 'folder'" :folder="dragEntry" :apps-by-id="appsById" :badge="badgeForEntry(dragEntry)" />
    </div>

    <Transition name="fade">
      <div v-if="showResetConfirm" class="confirm-overlay" @click.self="showResetConfirm = false">
        <div class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <h3 id="reset-title">重置主屏幕？</h3>
          <p>将恢复默认 APP 顺序、Dock 和文件夹。不会影响 APP 数据、壁纸或自定义图标。</p>
          <div class="confirm-actions"><button type="button" @click="showResetConfirm = false">取消</button><button type="button" class="danger" @click="confirmReset">重置</button></div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.desktop { flex: 1; display: flex; flex-direction: column; padding-top: 6vh; position: relative; width: 100%; height: 100%; box-sizing: border-box; overflow: hidden; color: var(--text-primary); transition: padding-top .2s ease; }
.desktop.is-editing { padding-top: calc(6vh + 42px); }
.pages-container { flex: 1; display: flex; width: 100%; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: none; -ms-overflow-style: none; }
.pages-container::-webkit-scrollbar { display: none; }
.page { flex: 0 0 100%; width: 100%; height: 100%; scroll-snap-align: start; scroll-snap-stop: always; display: flex; flex-direction: column; }
.top-widget-area { margin: 1.5vh 5vw; display: flex; justify-content: center; }
.middle-content { flex: 1; display: flex; padding: 0 5vw; gap: 4vw; box-sizing: border-box; }
.app-grid { flex: 1; display: grid; grid-template-columns: repeat(2, auto); grid-template-rows: repeat(2, auto); gap: 2.5vh 5vw; justify-content: center; justify-items: center; align-content: center; width: 100%; }
.right-widget-area { flex: 1; border-radius: 4vw; display: flex; flex-direction: column; justify-content: center; }
.page-two-grid { padding: 4vh 6vw; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: min-content; gap: 4vh 2vw; align-content: start; min-height: 100%; }
.desktop-entry { position: relative; min-width: 0; touch-action: pan-x; -webkit-touch-callout: none; contain: layout style; z-index: 1; }
.is-editing .desktop-entry { touch-action: none; }
.dragging-source { opacity: .16; }
.folder-target::after { content: ''; position: absolute; inset: -8px; border-radius: 24%; border: 2px solid rgba(255,255,255,.92); background: rgba(255,255,255,.12); box-shadow: 0 0 0 3px rgba(64,145,255,.45); pointer-events: none; animation: folder-pulse .65s ease-in-out infinite alternate; }
@keyframes folder-pulse { from { transform: scale(.96); } to { transform: scale(1.03); } }
.page-indicator { display: flex; justify-content: center; align-items: center; gap: 1.5vw; padding-bottom: 1vh; }
.page-dot { width: 1.5vw; height: 1.5vw; background: rgba(255,255,255,.4); border-radius: 50%; transition: all .3s ease; }
.page-dot.active { width: 2vw; height: 2vw; background: rgba(255,255,255,.9); }
.dock-container { padding: 1.5vh 4vw 3vh; width: 100%; box-sizing: border-box; }
.dock { min-height: calc(14.5vw + 4vh); padding: 2vh 3vw; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: center; width: 100%; border-radius: 6vw; background: var(--dock-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); transition: background-color .3s; }
.edit-toolbar { position: absolute; z-index: 80; top: max(44px, calc(env(safe-area-inset-top) + 40px)); left: 4vw; right: 4vw; height: 38px; padding: 0 5px; display: flex; align-items: center; justify-content: space-between; border-radius: 19px; background: rgba(30,30,32,.58); color: #fff; box-shadow: 0 4px 18px rgba(0,0,0,.16); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); font-size: 13px; font-weight: 600; }
.edit-toolbar button { height: 30px; padding: 0 13px; border: 0; border-radius: 15px; color: #fff; font: inherit; }
.reset-button { background: rgba(255,255,255,.14); }
.done-button { background: #0a84ff; }
.drag-proxy { position: fixed; z-index: 300; margin: 0; pointer-events: none; transform-origin: center; filter: drop-shadow(0 12px 15px rgba(0,0,0,.25)); will-change: transform; contain: layout paint style; }
.folder-overlay { position: absolute; z-index: 120; inset: 0; display: flex; align-items: center; justify-content: center; padding: 8vw; background: rgba(215,228,238,.38); backdrop-filter: blur(22px) saturate(1.15); -webkit-backdrop-filter: blur(22px) saturate(1.15); }
.folder-panel { width: 100%; max-height: 68%; min-height: 270px; padding: 20px 16px 16px; overflow: hidden; border: 1px solid rgba(255,255,255,.5); border-radius: 28px; background: rgba(236,244,250,.64); box-shadow: 0 18px 55px rgba(35,70,100,.2); }
.folder-title { display: block; width: min(210px, 80%); height: 34px; margin: 0 auto 18px; padding: 0 12px; border: 0; border-radius: 10px; outline: none; color: var(--text-primary); background: rgba(255,255,255,.32); text-align: center; font-size: 16px; font-weight: 600; }
.folder-title:focus { background: rgba(255,255,255,.58); box-shadow: 0 0 0 2px rgba(10,132,255,.32); }
.folder-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 25px 10px; align-content: start; min-height: 190px; max-height: calc(68vh - 100px); padding: 10px 4px 35px; overflow-y: auto; overscroll-behavior: contain; }
.folder-app { min-height: 82px; }
.folder-hint { margin-top: -20px; color: rgba(55,70,82,.7); font-size: 11px; text-align: center; }
.confirm-overlay { position: absolute; z-index: 400; inset: 0; display: flex; align-items: center; justify-content: center; padding: 26px; background: rgba(0,0,0,.28); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.confirm-card { width: 100%; max-width: 320px; overflow: hidden; border-radius: 20px; color: var(--text-primary); background: var(--sys-bg-secondary); box-shadow: 0 20px 60px rgba(0,0,0,.28); text-align: center; }
.confirm-card h3 { margin: 22px 20px 8px; font-size: 17px; }
.confirm-card p { margin: 0 22px 20px; color: var(--text-secondary); font-size: 13px; line-height: 1.55; }
.confirm-actions { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--border-color); }
.confirm-actions button { height: 48px; border: 0; color: #0a84ff; background: transparent; font-size: 16px; }
.confirm-actions button + button { border-left: 1px solid var(--border-color); }
.confirm-actions .danger { color: #ff3b30; font-weight: 600; }
.toolbar-slide-enter-active,.toolbar-slide-leave-active,.folder-open-enter-active,.folder-open-leave-active,.fade-enter-active,.fade-leave-active { transition: opacity .2s ease, transform .25s cubic-bezier(.2,.8,.2,1); }
.toolbar-slide-enter-from,.toolbar-slide-leave-to { opacity: 0; transform: translateY(-10px); }
.folder-open-enter-from,.folder-open-leave-to,.fade-enter-from,.fade-leave-to { opacity: 0; }
.folder-open-enter-from .folder-panel,.folder-open-leave-to .folder-panel { transform: scale(.88); }
@media (min-width: 768px) {
  .page-two-grid { padding: 60px; gap: 40px 60px; grid-template-columns: repeat(4, minmax(64px, 1fr)); justify-content: center; }
  .middle-content { padding: 0 40px; gap: 60px; max-width: 960px; margin: 0 auto; }
  .app-grid { gap: 30px 40px; }
  .dock-container { display: flex; justify-content: center; }
  .dock { width: 500px; min-height: 104px; padding: 2vh 20px; border-radius: 28px; }
  .folder-panel { max-width: 430px; padding: 28px; }
  .folder-grid { gap: 30px 24px; }
  .edit-toolbar { left: 50%; right: auto; width: 500px; transform: translateX(-50%); }
}
@media (prefers-reduced-motion: reduce) { .folder-target::after { animation: none; } }
</style>
