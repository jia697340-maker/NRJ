/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import { useAppIcons } from '../composables/useAppIcons'
import AvatarUploadModal from './AvatarUploadModal.vue'
import { appRegistry } from '../appRegistry'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits(['update:visible'])

const { customIcons, presets, setIcon, savePreset, applyPreset, deletePreset } = useAppIcons()

const close = () => {
  emit('update:visible', false)
}

const apps = appRegistry.map(app => ({ id: app.id, name: app.name, defaultIcon: app.icon }))

const currentEditingApp = ref<string | null>(null)
const showUploadModal = ref(false)

const openEditModal = (appId: string) => {
  currentEditingApp.value = appId
  showUploadModal.value = true
}

const handleIconSaved = async (url: string | null) => {
  if (currentEditingApp.value) {
    await setIcon(currentEditingApp.value, url)
  }
}

// 预设相关
const presetNameInput = ref('')
const showPresetInput = ref(false)
const showPresetsList = ref(false)

const saveCurrentAsPreset = async () => {
  if (presetNameInput.value.trim()) {
    await savePreset(presetNameInput.value.trim())
    presetNameInput.value = ''
    showPresetInput.value = false
    // 保存后自动打开列表看结果
    showPresetsList.value = true
  }
}
</script>

<template>
  <Transition name="soft-fade">
    <div class="soft-modal-overlay" v-if="visible" @click.self="close">
      <div class="soft-modal-panel">
        
        <div class="soft-modal-header">
          <span class="title">自定义应用图标</span>
          <button class="close-btn" @click="close">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- 顶部操作栏 -->
        <div class="actions-bar">
          <button class="btn btn-outline" @click="showPresetsList = true">我的预设方案</button>
          <button class="btn btn-primary" @click="showPresetInput = !showPresetInput">存为预设</button>
        </div>
        
        <div v-if="showPresetInput" class="preset-input-area">
          <input type="text" v-model="presetNameInput" placeholder="输入预设名称..." class="soft-input" />
          <button class="btn btn-small" @click="saveCurrentAsPreset">确认保存</button>
        </div>

        <div class="scroll-content">
          <!-- 预设列表界面 -->
          <div v-if="showPresetsList" class="presets-view">
            <div class="presets-header">
              <span class="presets-title">预设方案管理</span>
              <button class="back-btn" @click="showPresetsList = false">返回图标列表</button>
            </div>
            
            <div v-if="presets.length === 0" class="empty-tip">
              暂无保存的预设方案
            </div>
            
            <div class="preset-list">
              <div class="preset-item" v-for="preset in presets" :key="preset.id">
                <span class="preset-name">{{ preset.name }}</span>
                <div class="preset-actions">
                  <button class="btn-action apply" @click="applyPreset(preset.id)">应用</button>
                  <button class="btn-action delete" @click="deletePreset(preset.id)">删除</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 图标列表界面 -->
          <div v-else class="app-grid-list">
            <div class="app-item" v-for="app in apps" :key="app.id">
              <!-- 预览区 -->
              <div class="icon-preview" 
                   :class="{ 'has-custom': !!customIcons[app.id] }"
                   :style="customIcons[app.id] ? { backgroundImage: `url(${customIcons[app.id]})` } : {}">
                <template v-if="!customIcons[app.id]">
                  <div v-html="app.defaultIcon"></div>
                </template>
              </div>
              <span class="app-name">{{ app.name }}</span>
              <button class="btn-change" @click="openEditModal(app.id)">
                {{ customIcons[app.id] ? '更改' : '设置' }}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </Transition>

  <!-- 挂载到 body 避免层级问题，直接复用 AvatarUploadModal -->
  <Teleport to="body">
    <AvatarUploadModal
      v-model:visible="showUploadModal"
      :current-avatar="currentEditingApp ? (customIcons[currentEditingApp] || null) : null"
      shape="square"
      :title="`设置 ${currentEditingApp ? apps.find(a => a.id === currentEditingApp)?.name : ''} 图标`"
      @saved="handleIconSaved"
    />
  </Teleport>
</template>

<style scoped>
@import './AppearanceSettings.css';

.soft-modal-panel {
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.actions-bar {
  display: flex;
  justify-content: space-between;
  padding: 0 20px 10px;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: var(--text-primary);
  color: var(--sys-bg-primary);
  flex: 1;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  flex: 1;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 8px;
  background: var(--text-primary);
  color: var(--sys-bg-primary);
}

.preset-input-area {
  padding: 0 20px 15px;
  display: flex;
  gap: 10px;
  animation: fadeInDown 0.3s;
}

.soft-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  outline: none;
  font-size: 13px;
}

.scroll-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px 20px 20px;
}

/* 图标网格列表 */
.app-grid-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.app-item {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.icon-preview {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  background-color: var(--card-bg-solid);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  background-size: cover;
  background-position: center;
}

.icon-preview.has-custom {
  background-color: transparent;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.icon-preview :deep(.text-icon) {
  font-size: 24px;
  font-weight: 500;
  color: var(--text-primary);
  font-family: "Noto Serif SC", STZhongsong, "Microsoft YaHei", serif;
}

.app-name {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.btn-change {
  background: var(--sys-bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-change:hover {
  background: rgba(0,0,0,0.05);
}

/* 预设列表视图 */
.presets-view {
  animation: fadeIn 0.3s;
}

.presets-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.presets-title {
  font-weight: 600;
  color: var(--text-primary);
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}
.back-btn:hover {
  text-decoration: underline;
}

.empty-tip {
  text-align: center;
  color: var(--text-tertiary);
  padding: 30px 0;
  font-size: 13px;
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preset-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0,0,0,0.02);
  padding: 12px 16px;
  border-radius: 12px;
}

.preset-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.preset-actions {
  display: flex;
  gap: 8px;
}

.btn-action {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  border: none;
  cursor: pointer;
}

.btn-action.apply {
  background: var(--text-primary);
  color: var(--sys-bg-primary);
}

.btn-action.delete {
  background: #ff3b30;
  color: white;
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
