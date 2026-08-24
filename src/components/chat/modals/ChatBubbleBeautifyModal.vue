<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChatState } from '../../../composables/useChatState'
import BubbleImportModal from '../../bubble/modals/BubbleImportModal.vue'
import ChatBubbleQuickCssModal from './ChatBubbleQuickCssModal.vue'
import {
  bubbleWorkshopState,
  getAllBubblePresets,
  getBubblePreset,
  setChatBubblePreset,
  setGlobalBubblePreset,
  deleteBubblePreset,
  type BubblePreset
} from '../../../services/bubbleWorkshop'
import './ChatBubbleBeautifyModal.css'

const emit = defineEmits<{ close: [] }>()
const { selectedChat } = useChatState()
const scope = ref<'chat' | 'global'>('chat')
const currentAssignment = computed(() => selectedChat.value ? bubbleWorkshopState.chatPresetIds[String(selectedChat.value.id)] : '')
const selectedId = ref(currentAssignment.value || bubbleWorkshopState.globalPresetId || '')
const presets = computed(() => getAllBubblePresets())
const selectedPreset = computed(() => getBubblePreset(selectedId.value))
const followsGlobal = computed(() => !currentAssignment.value)

const showImportModal = ref(false)
const showCssModal = ref(false)
const isBatchMode = ref(false)
const selectedBatchIds = ref<string[]>([])
const showBatchDeleteConfirm = ref(false)
const toastMessage = ref('')
let toastTimer: any = null

const showToast = (msg: string) => {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, 2200)
}

const chooseScope = (value: 'chat' | 'global') => {
  scope.value = value
  selectedId.value = value === 'global'
    ? bubbleWorkshopState.globalPresetId
    : (currentAssignment.value || bubbleWorkshopState.globalPresetId)
}

const apply = () => {
  if (scope.value === 'global') setGlobalBubblePreset(selectedId.value || null)
  else if (selectedChat.value) setChatBubblePreset(selectedChat.value.id, selectedId.value || null)
  emit('close')
}

const followGlobal = () => {
  if (selectedChat.value) setChatBubblePreset(selectedChat.value.id, null)
  emit('close')
}

const handleImported = (importedPresets: BubblePreset[]) => {
  if (importedPresets.length > 0) {
    selectedId.value = importedPresets[0].id
  }
}

const handleCssSaved = (newPreset: BubblePreset) => {
  selectedId.value = newPreset.id
}

const toggleBatchMode = () => {
  isBatchMode.value = !isBatchMode.value
  selectedBatchIds.value = []
}

const isAllSelected = computed(() => {
  return presets.value.length > 0 && selectedBatchIds.value.length === presets.value.length
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedBatchIds.value = []
  } else {
    selectedBatchIds.value = presets.value.map(p => p.id)
  }
}

const toggleBatchItem = (id: string) => {
  const index = selectedBatchIds.value.indexOf(id)
  if (index >= 0) {
    selectedBatchIds.value.splice(index, 1)
  } else {
    selectedBatchIds.value.push(id)
  }
}

const handleCardClick = (preset: BubblePreset) => {
  if (isBatchMode.value) {
    toggleBatchItem(preset.id)
  } else {
    selectedId.value = preset.id
  }
}

const handleDeletePreset = (id: string, e: Event) => {
  e.stopPropagation()
  deleteBubblePreset(id)
  if (selectedId.value === id) {
    selectedId.value = ''
  }
  showToast('已移除方案')
}

const confirmBatchDelete = () => {
  const idsToDelete = [...selectedBatchIds.value]
  if (!idsToDelete.length) return
  idsToDelete.forEach(id => {
    deleteBubblePreset(id)
    if (selectedId.value === id) {
      selectedId.value = ''
    }
  })
  showToast(`已删除 ${idsToDelete.length} 个方案`)
  selectedBatchIds.value = []
  showBatchDeleteConfirm.value = false
  isBatchMode.value = false
}

const miniStyle = (preset: BubblePreset, target: 'self' | 'other') => {
  const value = preset[target]
  return {
    color: value.textColor,
    background: value.gradientEnd ? `linear-gradient(${value.gradientAngle}deg,${value.background},${value.gradientEnd})` : value.background,
    border: value.borderStyle === 'none' ? 'none' : `${value.borderWidth}px ${value.borderStyle} ${value.borderColor}`,
    borderRadius: target === 'self' ? `${value.radius}px ${value.corner}px ${value.radius}px ${value.radius}px` : `${value.corner}px ${value.radius}px ${value.radius}px ${value.radius}px`,
    boxShadow: `0 ${value.shadowY}px ${value.shadowBlur}px ${value.shadowColor}`
  }
}
</script>

<template>
  <div class="bpm-page">
    <!-- 顶部极简导航栏 -->
    <header class="bpm-header">
      <button class="bpm-back-btn" aria-label="返回" @click="emit('close')">
        <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
      </button>
      <div class="bpm-header-center">
        <h1 class="bpm-title">气泡美化</h1>
        <span class="bpm-sub-badge">{{ selectedPreset ? selectedPreset.name : '系统原生' }}</span>
      </div>
      <button class="bpm-done-btn" @click="apply">
        应用
      </button>
    </header>

    <main class="bpm-body">
      <!-- 范围分段器（极简白底胶囊） -->
      <section class="bpm-scope-container">
        <div class="bpm-capsule-switch">
          <button
            class="bpm-switch-tab"
            :class="{ active: scope === 'chat' }"
            @click="chooseScope('chat')"
          >
            <span>当前会话</span>
            <span v-if="!followsGlobal" class="bpm-mini-tag">独享</span>
          </button>
          <button
            class="bpm-switch-tab"
            :class="{ active: scope === 'global' }"
            @click="chooseScope('global')"
          >
            <span>全局默认</span>
          </button>
        </div>
        <div v-if="scope === 'chat' && !followsGlobal" class="bpm-scope-hint">
          <span>当前已启用独立个性化气泡</span>
          <button class="bpm-link-btn" @click="followGlobal">跟随全局</button>
        </div>
      </section>

      <!-- 气泡方案展示列表 -->
      <section class="bpm-list-wrapper">
        <!-- 顶部操作栏 -->
        <div class="bpm-action-header">
          <div class="bpm-left-title">
            <span class="bpm-group-label">气泡作品库</span>
            <span class="bpm-count-tag">{{ isBatchMode ? `已选 ${selectedBatchIds.length}` : presets.length }}</span>
          </div>

          <div class="bpm-right-actions">
            <template v-if="!isBatchMode">
              <button class="bpm-pill-btn" @click="showImportModal = true">
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span>导入</span>
              </button>
              <button class="bpm-pill-btn" @click="showCssModal = true">
                <svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><polyline points="8 6 2 12 8 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span>CSS</span>
              </button>
              <button v-if="presets.length > 0" class="bpm-pill-btn" @click="toggleBatchMode">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span>管理</span>
              </button>
            </template>
            <template v-else>
              <button class="bpm-pill-btn bpm-btn-text" @click="toggleSelectAll">
                {{ isAllSelected ? '取消全选' : '全选' }}
              </button>
              <button class="bpm-pill-btn bpm-btn-active" @click="toggleBatchMode">
                完成
              </button>
            </template>
          </div>
        </div>

        <!-- 方案卡片网格 -->
        <div class="bpm-grid-flow">
          <!-- 原生默认卡片 -->
          <div
            class="bpm-card-item bpm-card-system"
            :class="{ 'is-selected': !selectedId && !isBatchMode }"
            @click="!isBatchMode && (selectedId = '')"
          >
            <div class="bpm-card-stage">
              <div class="bpm-bubble-preview-area">
                <div class="bpm-demo-bubble other sys-bubble">你好呀</div>
                <div class="bpm-demo-bubble self sys-bubble">在这里</div>
              </div>
            </div>
            <div class="bpm-card-meta">
              <div class="bpm-meta-text">
                <span class="bpm-meta-name">系统原生</span>
                <span class="bpm-meta-badge sys">默认</span>
              </div>
              <div v-if="!selectedId && !isBatchMode" class="bpm-status-check">
                <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
            </div>
          </div>

          <!-- 自定义方案卡片 -->
          <div
            v-for="preset in presets"
            :key="preset.id"
            class="bpm-card-item"
            :class="{
              'is-selected': !isBatchMode && selectedId === preset.id,
              'is-batch-picked': isBatchMode && selectedBatchIds.includes(preset.id),
              'is-batch-active': isBatchMode
            }"
            @click="handleCardClick(preset)"
          >
            <!-- 批量勾选圆点 -->
            <div v-if="isBatchMode" class="bpm-batch-checkbox" :class="{ checked: selectedBatchIds.includes(preset.id) }">
              <svg v-if="selectedBatchIds.includes(preset.id)" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>

            <!-- 气泡真实效果舞台 -->
            <div class="bpm-card-stage">
              <div class="bpm-bubble-preview-area">
                <div class="bpm-demo-bubble other" :style="miniStyle(preset, 'other')">你好呀</div>
                <div class="bpm-demo-bubble self" :style="miniStyle(preset, 'self')">在这里</div>
              </div>
            </div>

            <!-- 底部信息 -->
            <div class="bpm-card-meta">
              <div class="bpm-meta-text">
                <span class="bpm-meta-name" :title="preset.name">{{ preset.name }}</span>
                <span class="bpm-meta-badge" :class="preset.source || (preset.customCss ? 'css' : 'custom')">
                  {{ preset.source === 'imported' ? '导入' : (preset.customCss ? 'CSS' : '原创') }}
                </span>
              </div>

              <button
                v-if="!isBatchMode"
                class="bpm-remove-btn"
                title="删除方案"
                @click="handleDeletePreset(preset.id, $event)"
              >
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              </button>

              <div v-if="!isBatchMode && selectedId === preset.id" class="bpm-status-check">
                <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!presets.length" class="bpm-empty-notice">
          <p class="bpm-empty-main">暂无自定义方案</p>
          <p class="bpm-empty-sub">支持点击上方导入方案文件、粘贴口令或编写 CSS</p>
        </div>
      </section>

      <div class="bpm-footer-note">
        气泡工坊制作的作品将自动沉淀并同步至此处
      </div>
    </main>

    <!-- 批量操作悬浮条 -->
    <Transition name="bpm-slide-bar">
      <div v-if="isBatchMode" class="bpm-float-bar">
        <div class="bpm-float-bar-card">
          <span class="bpm-float-bar-count">已选 {{ selectedBatchIds.length }} 个方案</span>
          <button
            class="bpm-float-delete-btn"
            :disabled="selectedBatchIds.length === 0"
            @click="showBatchDeleteConfirm = true"
          >
            批量删除
          </button>
        </div>
      </div>
    </Transition>

    <!-- 批量删除确认弹窗 -->
    <Transition name="bpm-fade">
      <div v-if="showBatchDeleteConfirm" class="bpm-dialog-overlay" @click.self="showBatchDeleteConfirm = false">
        <div class="bpm-modal-box">
          <h4 class="bpm-modal-title">确认批量删除</h4>
          <p class="bpm-modal-desc">将彻底移除所选的 {{ selectedBatchIds.length }} 个气泡方案，删除后无法找回。</p>
          <div class="bpm-modal-btns">
            <button class="bpm-modal-cancel" @click="showBatchDeleteConfirm = false">取消</button>
            <button class="bpm-modal-confirm" @click="confirmBatchDelete">确认删除</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 导入弹窗 -->
    <BubbleImportModal
      :visible="showImportModal"
      @update:visible="showImportModal = $event"
      @imported="handleImported"
      @toast="showToast"
    />

    <!-- 快捷自定义 CSS 弹窗 -->
    <ChatBubbleQuickCssModal
      :visible="showCssModal"
      @update:visible="showCssModal = $event"
      @saved="handleCssSaved"
      @toast="showToast"
    />

    <!-- 轻量 Toast 提示 -->
    <Transition name="bpm-fade">
      <div v-if="toastMessage" class="bpm-toast-wrap">
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>
