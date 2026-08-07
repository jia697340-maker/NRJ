/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { worldBooks, worldBookGroups } from '../store'
import type { WorldBook, WorldBookEntry, WorldBookGroup } from '../store'

import BookshelfView from './worldbook/BookshelfView.vue'
import BookIndexView from './worldbook/BookIndexView.vue'
import EntryEditorView from './worldbook/EntryEditorView.vue'
import AvatarUploadModal from './AvatarUploadModal.vue'

// Import extracted Composables
import { useWorldBookCovers } from '../composables/useWorldBookCovers'
import { useWorldBookTags } from '../composables/useWorldBookTags'
import { useWorldBookGroups } from '../composables/useWorldBookGroups'

// Import extracted Modals
import WorldBookGroupModal from './worldbook/modals/WorldBookGroupModal.vue'
import WorldBookTagModal from './worldbook/modals/WorldBookTagModal.vue'
import WorldBookSettingsModals from './worldbook/modals/WorldBookSettingsModals.vue'

const emit = defineEmits(['close'])

const currentView = ref<'bookshelf' | 'book_index' | 'entry_editor'>('bookshelf')
const activeBookId = ref<string | null>(null)
const activeEntryId = ref<string | null>(null)
const showBookSettings = ref(false)
const showVisualSettings = ref(false)
const showEntrySettings = ref(false)
const entryFilterMode = ref<'all' | 'enabled' | 'disabled' | 'override'>('all')
const showFilterMenu = ref(false)

const activeGroupId = ref<string>('all')

const confirmDialog = ref<{ show: boolean, message: string, onConfirm: (() => void) | null }>({
  show: false, message: '', onConfirm: null
})

const showConfirm = (message: string, onConfirm: () => void) => {
  confirmDialog.value = { show: true, message, onConfirm }
}
const closeConfirm = () => { confirmDialog.value.show = false }
const handleConfirm = () => {
  if (confirmDialog.value.onConfirm) confirmDialog.value.onConfirm()
  closeConfirm()
}

// === Initialize Composables ===
const {
  bookCovers, bookBackgrounds, modalVisible, bgModalVisible, editingBookId,
  currentEditAvatar, currentEditBg, loadCovers, openCoverModal, handleCoverSaved, handleBgSaved,
  removeBookCoverAndBg
} = useWorldBookCovers()

const {
  tagModal, openTagManager, toggleTagSelect, addTags, deleteSelectedTags, clearAllTags
} = useWorldBookTags(showConfirm)

const {
  groupManageModal, isAllGroupsSelected, openGroupManager, toggleGroupManageMode,
  toggleGroupSelect, toggleSelectAllGroups, deleteSelectedGroups, addGroup,
  startEditGroup, saveEditGroup, deleteGroup
} = useWorldBookGroups(activeGroupId, showConfirm)

onMounted(() => {
  loadCovers()
})

const activeBook = computed(() => {
  return worldBooks.find(b => b.id === activeBookId.value) || null
})

const activeEntry = computed(() => {
  if (!activeBook.value) return null
  return activeBook.value.entries.find(e => e.id === activeEntryId.value) || null
})

const openVisualSettings = () => {
  if (activeBook.value) {
    editingBookId.value = activeBook.value.id
    showVisualSettings.value = true
  }
}

// === 高级编辑交互 ===
const editModal = ref<{ show: boolean, field: 'title' | 'author' | 'rating' | null, title: string, valStr: string, valNum: number }>({ show: false, field: null, title: '', valStr: '', valNum: 0 })

const openEditModal = (field: 'title' | 'author' | 'rating') => {
  const book = activeBook.value
  if (!book) return
  editModal.value.field = field
  editModal.value.show = true
  if (field === 'title') { editModal.value.title = '修改书名'; editModal.value.valStr = activeBook.value.title || '' }
  else if (field === 'author') { editModal.value.title = '修改作者'; editModal.value.valStr = activeBook.value.author || '' }
  else if (field === 'rating') { editModal.value.title = '修改评分'; editModal.value.valNum = activeBook.value.rating || 0 }
}

const saveEditField = () => {
  if (!activeBook.value || !editModal.value.field) return
  const field = editModal.value.field
  if (field === 'title') activeBook.value.title = editModal.value.valStr.trim()
  else if (field === 'author') activeBook.value.author = editModal.value.valStr.trim()
  else if (field === 'rating') activeBook.value.rating = Number(editModal.value.valNum)
  activeBook.value.updatedAt = Date.now()
  editModal.value.show = false
}

// === 分组与书架视图交互 ===
const filteredWorldBooks = computed(() => {
  if (activeGroupId.value === 'all') return worldBooks
  return worldBooks.filter(book => book.groupIds && book.groupIds.includes(activeGroupId.value))
})

const isShelfManageMode = ref(false)
const selectedBooks = ref<Set<string>>(new Set())

// removed toggleShelfManageMode because BookshelfView controls it now via emit/v-model

const toggleBookSelect = (id: string) => {
  if (selectedBooks.value.has(id)) selectedBooks.value.delete(id)
  else selectedBooks.value.add(id)
}

const isAllBooksSelected = computed(() => {
  if (filteredWorldBooks.value.length === 0) return false
  return selectedBooks.value.size === filteredWorldBooks.value.length
})

const toggleSelectAllBooks = () => {
  if (isAllBooksSelected.value) selectedBooks.value.clear()
  else filteredWorldBooks.value.forEach(b => selectedBooks.value.add(b.id))
}

const targetGroupModal = ref<{ show: boolean, mode: 'copy' | 'move', bookIds: string[] }>({ show: false, mode: 'copy', bookIds: [] })

const openMoveModal = (bookIds: string[]) => { targetGroupModal.value = { show: true, mode: 'move', bookIds } }
const openCopyModal = (bookIds: string[]) => { targetGroupModal.value = { show: true, mode: 'copy', bookIds } }

const confirmMoveOrCopy = (targetGroupId: string) => {
  const { mode, bookIds } = targetGroupModal.value
  worldBooks.forEach(book => {
    if (bookIds.includes(book.id)) {
      if (!book.groupIds) book.groupIds = []
      if (mode === 'move') {
        if (activeGroupId.value !== 'all') book.groupIds = book.groupIds.filter(id => id !== activeGroupId.value)
        if (!book.groupIds.includes(targetGroupId)) book.groupIds.push(targetGroupId)
      } else if (mode === 'copy') {
        if (!book.groupIds.includes(targetGroupId)) book.groupIds.push(targetGroupId)
      }
    }
  })
  targetGroupModal.value.show = false
  if (isShelfManageMode.value) { selectedBooks.value.clear(); isShelfManageMode.value = false }
}

const deleteSelectedBooks = () => {
  if (selectedBooks.value.size === 0) return
  showConfirm(`确认删除选中的 ${selectedBooks.value.size} 本记录吗？`, async () => {
    const idsToDelete = Array.from(selectedBooks.value)
    for (let i = worldBooks.length - 1; i >= 0; i--) {
      if (selectedBooks.value.has(worldBooks[i].id)) worldBooks.splice(i, 1)
    }
    for (const id of idsToDelete) {
      await removeBookCoverAndBg(id)
    }
    selectedBooks.value.clear()
    isShelfManageMode.value = false
  })
}

const deleteSingleBook = (id: string, event: Event) => {
  event.stopPropagation()
  showConfirm('确认删除此记录吗？', async () => {
    const index = worldBooks.findIndex(b => b.id === id)
    if (index !== -1) {
      worldBooks.splice(index, 1)
      await removeBookCoverAndBg(id)
    }
  })
}

const handleNewItem = () => {
  const newItem: WorldBook = {
    id: Date.now().toString(), type: 'book', title: '', coverColor: '#ffffff', coverImage: '', enabled: true,
    globalPosition: 'middle', globalDepth: 0, globalWeight: 1, updatedAt: Date.now(), entries: []
  }
  worldBooks.unshift(newItem)
}

const openBook = (id: string) => {
  activeBookId.value = id
  currentView.value = 'book_index'
  isManageMode.value = false
  isShelfManageMode.value = false
  selectedEntries.value.clear()
}

const toggleBookSettings = () => { showBookSettings.value = !showBookSettings.value }

// === 长按与菜单交互 ===
const contextMenuBookId = ref<string | null>(null)
let pressTimer: number | null = null
const handlePressStart = (id: string) => {
  if (pressTimer) clearTimeout(pressTimer)
  pressTimer = window.setTimeout(() => { contextMenuBookId.value = id }, 500)
}

const handlePressEnd = () => {
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = null }
}

const handleContextMenu = (id: string, event: Event) => {
  event.preventDefault()
  contextMenuBookId.value = id
}

// handleClickBook is not used directly in template here, BookshelfView triggers openBook

const closeContextMenu = () => { contextMenuBookId.value = null }

const triggerEditCover = () => {
  if (contextMenuBookId.value) {
    editingBookId.value = contextMenuBookId.value
    modalVisible.value = true
    closeContextMenu()
  }
}

const triggerDeleteBook = () => {
  if (contextMenuBookId.value) {
    const id = contextMenuBookId.value
    closeContextMenu()
    showConfirm('确认移除此项记录？', async () => {
      const index = worldBooks.findIndex(b => b.id === id)
      if (index !== -1) {
        worldBooks.splice(index, 1)
        await removeBookCoverAndBg(id)
      }
    })
  }
}

// === 目录视图交互 ===
const isManageMode = ref(false)
const selectedEntries = ref<Set<string>>(new Set())

// toggleManageMode removed because BookIndexView controls it via v-model

const toggleEntrySelect = (id: string) => {
  if (selectedEntries.value.has(id)) selectedEntries.value.delete(id)
  else selectedEntries.value.add(id)
}

const isAllSelected = computed(() => {
  if (!activeBook.value || activeBook.value.entries.length === 0) return false
  return selectedEntries.value.size === activeBook.value.entries.length
})

const toggleSelectAll = () => {
  const currentActiveBook = activeBook.value
  if (!currentActiveBook) return
  if (isAllSelected.value) selectedEntries.value.clear()
  else currentActiveBook.entries.forEach(e => selectedEntries.value.add(e.id))
}

const deleteSelectedEntries = () => {
  const currentActiveBook = activeBook.value
  if (!currentActiveBook || selectedEntries.value.size === 0) return
  showConfirm(`确认删除选中的 ${selectedEntries.value.size} 个条目吗？`, () => {
    currentActiveBook.entries = currentActiveBook.entries.filter(e => !selectedEntries.value.has(e.id))
    currentActiveBook.updatedAt = Date.now()
    selectedEntries.value.clear()
    isManageMode.value = false
  })
}

const backToBookshelf = () => {
  currentView.value = 'bookshelf'
  activeBookId.value = null
  isManageMode.value = false
  selectedEntries.value.clear()
}

const handleNewEntry = () => {
  if (!activeBook.value) return
  const newEntry: WorldBookEntry = {
    id: Date.now().toString() + '_entry', title: '', content: '', updatedAt: Date.now(), enabled: true,
    light: 'blue', keywords: '', overrideSettings: false, position: 'middle', depth: 0, weight: 1
  }
  if (!activeBook.value.entries) activeBook.value.entries = []
  activeBook.value.entries.push(newEntry)
  activeBook.value.updatedAt = Date.now()
  openEntry(newEntry.id)
}

const openEntry = (id: string) => {
  activeEntryId.value = id
  currentView.value = 'entry_editor'
}

const deleteEntry = (id: string, event: Event) => {
  event.stopPropagation()
  const book = activeBook.value
  if (!book) return
  showConfirm('确认抹去这一页？', () => {
    const index = book.entries.findIndex(e => e.id === id)
    if (index !== -1) {
      book.entries.splice(index, 1)
      book.updatedAt = Date.now()
    }
  })
}

const backToIndex = () => {
  currentView.value = 'book_index'
  activeEntryId.value = null
}

const updateEntry = () => {
  if (activeEntry.value && activeBook.value) {
    activeEntry.value.updatedAt = Date.now()
    activeBook.value.updatedAt = Date.now()
  }
}
</script>

<template>
  <div class="readingo-app">
    <!-- Floating Action Buttons (Replaces Header) -->
    <!-- Bookshelf Actions -->
    <transition name="fade">
      <div v-if="currentView === 'bookshelf'" class="fab-container">
        <!-- The Hero Arch in BookshelfView now acts as the 'close/back' button! -->
        <div class="fab-btn" @click="handleNewItem">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
      </div>
    </transition>

    <!-- Book Index Actions -->
    <transition name="fade">
      <div v-if="currentView === 'book_index'" class="fab-container index-fab-container">
        <!-- Return Button -->
        <div class="fab-btn" @click="backToBookshelf">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </div>
        
        <div class="fab-btn" @click="openVisualSettings">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-5 5c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c0 .28.22.5.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z"/></svg>
        </div>

        <div class="fab-btn" @click="showFilterMenu = !showFilterMenu">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
        </div>
      </div>
    </transition>

    <!-- Entry Editor Actions -->
    <div v-if="currentView === 'entry_editor'" class="app-header transparent-header">
      <div class="h-left">
        <div class="btn-icon" @click="backToIndex">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </div>
        <div class="app-title entry-title-header">编辑页面</div>
      </div>
      <div class="h-right">
        <div class="btn-icon" @click="showEntrySettings = true">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </div>
        <div class="btn-text" @click="backToIndex">保存</div>
      </div>
    </div>

    <!-- Filter Menu Overlay -->
    <div v-if="showFilterMenu" class="transparent-mask" @click="showFilterMenu = false" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 99;"></div>
    <div v-if="showFilterMenu" class="filter-menu-dropdown" @click.stop>
      <div class="filter-item" :class="{active: entryFilterMode === 'all'}" @click="entryFilterMode = 'all'; showFilterMenu = false">全部</div>
      <div class="filter-item" :class="{active: entryFilterMode === 'enabled'}" @click="entryFilterMode = 'enabled'; showFilterMenu = false">仅看开启</div>
      <div class="filter-item" :class="{active: entryFilterMode === 'disabled'}" @click="entryFilterMode = 'disabled'; showFilterMenu = false">仅看关闭</div>
      <div class="filter-item" :class="{active: entryFilterMode === 'override'}" @click="entryFilterMode = 'override'; showFilterMenu = false">独立参数</div>
    </div>

    <div class="app-body">
      <transition name="fade" mode="out-in">
        <div :key="currentView" style="width: 100%; height: 100%;">
          <BookshelfView
            v-if="currentView === 'bookshelf'"
            key="bookshelf"
            :worldBooks="worldBooks"
            :worldBookGroups="worldBookGroups"
            :bookCovers="bookCovers"
            v-model:isShelfManageMode="isShelfManageMode"
            :selectedBooks="selectedBooks"
            @openBook="openBook"
            @openGroupManager="openGroupManager"
            @toggleBookSelect="toggleBookSelect"
            @handlePressStart="handlePressStart"
            @handlePressEnd="handlePressEnd"
            @handleContextMenu="handleContextMenu"
            @deleteSingleBook="deleteSingleBook"
            @toggleSelectAllBooks="toggleSelectAllBooks"
            @openMoveModal="openMoveModal"
            @openCopyModal="openCopyModal"
            @deleteSelectedBooks="deleteSelectedBooks"
            @exitApp="emit('close')"
          />

          <BookIndexView
            v-else-if="currentView === 'book_index' && activeBook"
            key="book_index"
            :activeBook="activeBook"
            :bookCovers="bookCovers"
            :bookBackgrounds="bookBackgrounds"
            v-model:isManageMode="isManageMode"
            :selectedEntries="selectedEntries"
            :filterMode="entryFilterMode"
            @openEditModal="openEditModal"
            @openTagManager="openTagManager"
            @openVisualSettings="openVisualSettings"
            @toggleBookSettings="toggleBookSettings"
            @toggleEntrySelect="toggleEntrySelect"
            @openEntry="openEntry"
            @deleteEntry="deleteEntry"
            @handleNewEntry="handleNewEntry"
            @toggleSelectAll="toggleSelectAll"
            @deleteSelectedEntries="deleteSelectedEntries"
          />

          <EntryEditorView
            v-else-if="currentView === 'entry_editor' && activeEntry"
            key="entry_editor"
            :activeEntry="activeEntry"
            @updateEntry="updateEntry"
          />
        </div>
      </transition>
    </div>

    <!-- Extracted Settings Modals -->
    <WorldBookSettingsModals
      v-model:showVisualSettings="showVisualSettings"
      v-model:showBookSettings="showBookSettings"
      v-model:showEntrySettings="showEntrySettings"
      :activeBook="activeBook"
      :activeEntry="activeEntry"
      @openCoverModal="openCoverModal(activeBook?.id || '')"
      @openBgModal="editingBookId = activeBook?.id || ''; bgModalVisible = true"
      @updateEntry="updateEntry"
      @markBookUpdated="activeBook && (activeBook.updatedAt = Date.now())"
    />

    <!-- Extracted Group Management Modal -->
    <WorldBookGroupModal
      v-model:show="groupManageModal.show"
      :worldBookGroups="worldBookGroups"
      :groupModalState="groupManageModal"
      :isAllGroupsSelected="isAllGroupsSelected"
      v-model:newGroupName="groupManageModal.newGroupName"
      v-model:editGroupName="groupManageModal.editGroupName"
      v-model:editGroupId="groupManageModal.editGroupId"
      @toggleGroupManageMode="toggleGroupManageMode"
      @toggleGroupSelect="toggleGroupSelect"
      @toggleSelectAllGroups="toggleSelectAllGroups"
      @deleteSelectedGroups="deleteSelectedGroups"
      @addGroup="addGroup"
      @startEditGroup="startEditGroup"
      @saveEditGroup="saveEditGroup"
      @deleteGroup="deleteGroup"
    />

    <!-- Target Group Selection Modal -->
    <transition name="fade">
      <div v-if="targetGroupModal.show" class="modal-mask clean-mask" @click="targetGroupModal.show = false">
        <div class="modal-box clean-box tag-manager-panel" @click.stop>
          <div class="panel-header">
            <div class="panel-title">{{ targetGroupModal.mode === 'move' ? '移动到分组' : '复制到分组' }}</div>
            <div class="panel-close" @click="targetGroupModal.show = false">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
          </div>
          <div class="panel-body">
            <div class="t-list-container" style="max-height: 300px;">
              <div v-if="worldBookGroups.length === 0" class="t-empty-state">暂无自定义分组</div>
              <div class="ctx-group" v-else>
                <div v-for="grp in worldBookGroups" :key="grp.id" class="ctx-item" @click="confirmMoveOrCopy(grp.id)">
                  <div class="ctx-text">{{ grp.name }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Fancy Confirm Dialog -->
    <transition name="fade-scale">
      <div v-if="confirmDialog.show" class="pure-mask" @click="closeConfirm">
        <div class="pure-context-menu" @click.stop>
          <div class="pure-context-title">{{ confirmDialog.message }}</div>
          <div class="pure-context-list">
            <div class="pure-context-item" @click="closeConfirm">
              <span>取消</span>
            </div>
            <div class="pure-context-item danger" @click="handleConfirm">
              <span>确认</span>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Edit Field Modal -->
    <transition name="fade">
      <div v-if="editModal.show" class="modal-mask fancy-mask" @click="editModal.show = false">
        <div class="modal-box fancy-box edit-box" @click.stop>
          <div class="edit-header">{{ editModal.title }}</div>
          <div v-if="editModal.field === 'title' || editModal.field === 'author'" class="edit-body">
            <input v-model="editModal.valStr" class="fancy-input" :placeholder="`请输入${editModal.field === 'title' ? '书名' : '作者'}`" @keydown.enter="saveEditField" autofocus/>
          </div>
          <div v-else-if="editModal.field === 'rating'" class="edit-body">
            <input type="number" step="0.1" min="0" max="10" v-model.number="editModal.valNum" class="fancy-input" @keydown.enter="saveEditField" autofocus/>
            <div class="rating-hint">范围: 0.0 - 10.0</div>
          </div>
          <div class="modal-btns fancy-btns">
            <div class="f-btn f-cancel" @click="editModal.show = false">取消</div>
            <div class="f-btn f-primary" @click="saveEditField">保存</div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Extracted Tag Manager Modal -->
    <WorldBookTagModal
      v-model:show="tagModal.show"
      :activeBook="activeBook"
      :tagModalState="tagModal"
      v-model:newTagsInput="tagModal.newTagsInput"
      @addTags="addTags"
      @toggleTagSelect="toggleTagSelect"
      @deleteSelectedTags="deleteSelectedTags"
      @clearAllTags="clearAllTags"
    />

    <!-- Book Context Menu Modal -->
    <transition name="fade-scale">
      <div v-if="contextMenuBookId" class="pure-mask" @click="closeContextMenu">
        <div class="pure-context-menu" @click.stop>
          <div class="pure-context-title">{{ worldBooks.find(b => b.id === contextMenuBookId)?.title || '未命名记录' }}</div>
          <div class="pure-context-list">
            <div class="pure-context-item" @click="triggerEditCover">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              <span>更换封面</span>
            </div>
            <div class="pure-context-item" @click="isShelfManageMode = true; closeContextMenu()">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
              <span>批量管理</span>
            </div>
            <div class="pure-context-item danger" @click="triggerDeleteBook">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              <span>删除书籍</span>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <Teleport to="body">
      <AvatarUploadModal 
        v-model:visible="modalVisible" 
        :current-avatar="currentEditAvatar"
        shape="avatar"
        @saved="handleCoverSaved" 
      />
      <AvatarUploadModal 
        v-model:visible="bgModalVisible" 
        :current-avatar="currentEditBg"
        shape="avatar"
        @saved="handleBgSaved" 
      />
    </Teleport>
  </div>
</template>

<style scoped src='./app_WorldBook.css'></style>
<style scoped>
.fab-container {
  position: absolute;
  bottom: 32px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 90;
}
.index-fab-container {
  bottom: 24px;
  right: 16px;
  gap: 12px;
}
.fab-btn {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
  border: 1px solid rgba(0,0,0,0.05);
}
.fab-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  background: #fff;
  color: var(--text-primary);
}
.fab-btn:active {
  transform: scale(0.95);
}
.index-fab-container .fab-btn {
  width: 44px;
  height: 44px;
}

.filter-menu-dropdown {
  position: fixed;
  bottom: 80px;
  right: 76px;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  padding: 8px 0;
  z-index: 100;
  min-width: 130px;
  border: 1px solid rgba(0,0,0,0.05);
}
.filter-item {
  padding: 10px 16px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
}
.filter-item:hover { background: var(--sys-bg-primary); }
.filter-item.active { color: #3b82f6; font-weight: 600; background: rgba(59, 130, 246, 0.05); }

/* 水印花字装饰 */
.library-watermark {
  position: absolute;
  top: 60px;
  right: -20px;
  font-family: "Georgia", "Times New Roman", serif;
  font-size: 56px;
  font-weight: 700;
  color: var(--text-primary);
  opacity: 0.03; /* 极致的透明度，若隐若现 */
  transform: rotate(90deg);
  transform-origin: right top;
  letter-spacing: 8px;
  pointer-events: none;
  z-index: 0;
  white-space: nowrap;
}
</style>
