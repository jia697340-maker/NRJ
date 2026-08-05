/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { bubbleSettings } from '../../../store'
import localforage from 'localforage'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const activeTab = ref<'preset' | 'color' | 'image' | 'advanced'>('preset')

// 预设配置项
const presets = [
  { id: 'default', name: '默认', selfBg: 'transparent', otherBg: 'transparent', radius: '14px', dashed: true },
  { id: 'wechat', name: '微信经典', selfBg: '#a9ea7a', otherBg: '#ffffff', radius: '4px' },
  { id: 'ios', name: '仿 iOS', selfBg: '#007aff', otherBg: '#e5e5ea', radius: '18px', selfText: '#ffffff' },
  { id: 'custom', name: '完全自定义', selfBg: '', otherBg: '', radius: '' }
]

const selectPreset = (preset: typeof presets[0]) => {
  bubbleSettings.preset = preset.id
  if (preset.id !== 'custom') {
    bubbleSettings.selfBgColor = preset.selfBg
    bubbleSettings.otherBgColor = preset.otherBg
    bubbleSettings.selfRadius = preset.radius
    bubbleSettings.otherRadius = preset.radius
    if (preset.id === 'ios') {
      bubbleSettings.selfTextColor = '#ffffff'
      bubbleSettings.otherTextColor = '#000000'
    } else {
      bubbleSettings.selfTextColor = '#000000'
      bubbleSettings.otherTextColor = '#000000'
    }
    // 切换预设时清空背景图
    bubbleSettings.selfBgImageId = ''
    bubbleSettings.otherBgImageId = ''
  }
}

// ---------------- 图片上传逻辑 ----------------
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadTarget = ref<'self' | 'other'>('self')
const uploading = ref(false)

const triggerUpload = (target: 'self' | 'other') => {
  uploadTarget.value = target
  fileInputRef.value?.click()
}

const handleFileUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  try {
    uploading.value = true
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64Data = e.target?.result as string
      // 生成唯一的ID用于存储
      const imageId = `bubble_bg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      
      // 使用 localforage 存储图片数据，避免 localStorage 爆满
      await localforage.setItem(imageId, base64Data)

      if (uploadTarget.value === 'self') {
        bubbleSettings.selfBgImageId = imageId
      } else {
        bubbleSettings.otherBgImageId = imageId
      }
      
      bubbleSettings.preset = 'custom'
      uploading.value = false
    }
    reader.readAsDataURL(file)
  } catch (error) {
    console.error('上传图片失败:', error)
    alert('上传图片失败，请重试')
    uploading.value = false
  } finally {
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }
}

const clearImage = async (target: 'self' | 'other') => {
  const imageId = target === 'self' ? bubbleSettings.selfBgImageId : bubbleSettings.otherBgImageId
  if (imageId) {
    await localforage.removeItem(imageId)
    if (target === 'self') {
      bubbleSettings.selfBgImageId = ''
    } else {
      bubbleSettings.otherBgImageId = ''
    }
  }
}

// ---------------- 导入导出逻辑 ----------------
const handleExport = () => {
  const dataStr = JSON.stringify(bubbleSettings, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `clingy_bubble_settings_${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const importInputRef = ref<HTMLInputElement | null>(null)
const handleImport = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string)
      // 仅合并现有字段，防止污染
      Object.keys(data).forEach(key => {
        if (key in bubbleSettings) {
          ;(bubbleSettings as any)[key] = data[key]
        }
      })
      alert('导入成功！')
    } catch (err) {
      console.error(err)
      alert('配置文件格式错误！')
    }
  }
  reader.readAsText(file)
  if (importInputRef.value) {
    importInputRef.value.value = ''
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>气泡美化设置</h3>
        <button class="close-btn" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="modal-tabs">
        <button class="tab-btn" :class="{ active: activeTab === 'preset' }" @click="activeTab = 'preset'">预设</button>
        <button class="tab-btn" :class="{ active: activeTab === 'color' }" @click="activeTab = 'color'">颜色与圆角</button>
        <button class="tab-btn" :class="{ active: activeTab === 'image' }" @click="activeTab = 'image'">背景图</button>
        <button class="tab-btn" :class="{ active: activeTab === 'advanced' }" @click="activeTab = 'advanced'">高级/代码</button>
      </div>

      <div class="modal-body">
        <!-- 预设面板 -->
        <div v-if="activeTab === 'preset'" class="tab-pane">
          <div class="preset-grid">
            <div 
              v-for="p in presets.filter(item => item.id !== 'custom')" 
              :key="p.id" 
              class="preset-item" 
              :class="{ active: bubbleSettings.preset === p.id }"
              @click="selectPreset(p)"
            >
              <div class="preset-preview">
                <div class="preview-bubble other" :class="{ dashed: p.dashed }" :style="{ backgroundColor: p.otherBg || '#fff', borderRadius: p.dashed ? '4px 14px 14px 14px' : (p.radius || '8px') }">对方</div>
                <div class="preview-bubble self" :class="{ dashed: p.dashed }" :style="{ backgroundColor: p.selfBg || '#95ec69', borderRadius: p.dashed ? '14px 4px 14px 14px' : (p.radius || '8px'), color: p.selfText || '#000' }">自己</div>
              </div>
              <div class="preset-name">{{ p.name }}</div>
            </div>
          </div>
        </div>

        <!-- 颜色与圆角面板 -->
        <div v-else-if="activeTab === 'color'" class="tab-pane">
          <div class="settings-group">
            <h4>自己（右侧气泡）</h4>
            <div class="setting-row">
              <label>背景颜色</label>
              <div class="color-picker-wrapper">
                <input type="color" v-model="bubbleSettings.selfBgColor" @change="bubbleSettings.preset = 'custom'" />
                <span>{{ bubbleSettings.selfBgColor }}</span>
              </div>
            </div>
            <div class="setting-row">
              <label>文字颜色</label>
              <div class="color-picker-wrapper">
                <input type="color" v-model="bubbleSettings.selfTextColor" @change="bubbleSettings.preset = 'custom'" />
                <span>{{ bubbleSettings.selfTextColor }}</span>
              </div>
            </div>
            <div class="setting-row">
              <label>圆角大小</label>
              <input type="text" class="bm-input" v-model="bubbleSettings.selfRadius" placeholder="例如: 8px或12px 4px 4px 12px" @change="bubbleSettings.preset = 'custom'" />
            </div>
          </div>

          <div class="settings-group mt-4">
            <h4>对方（左侧气泡）</h4>
            <div class="setting-row">
              <label>背景颜色</label>
              <div class="color-picker-wrapper">
                <input type="color" v-model="bubbleSettings.otherBgColor" @change="bubbleSettings.preset = 'custom'" />
                <span>{{ bubbleSettings.otherBgColor }}</span>
              </div>
            </div>
            <div class="setting-row">
              <label>文字颜色</label>
              <div class="color-picker-wrapper">
                <input type="color" v-model="bubbleSettings.otherTextColor" @change="bubbleSettings.preset = 'custom'" />
                <span>{{ bubbleSettings.otherTextColor }}</span>
              </div>
            </div>
            <div class="setting-row">
              <label>圆角大小</label>
              <input type="text" class="bm-input" v-model="bubbleSettings.otherRadius" placeholder="例如: 8px" @change="bubbleSettings.preset = 'custom'" />
            </div>
          </div>
        </div>

        <!-- 背景图面板 -->
        <div v-else-if="activeTab === 'image'" class="tab-pane">
          <input type="file" ref="fileInputRef" style="display: none" accept="image/*" @change="handleFileUpload" />
          
          <div class="settings-group">
            <h4>自己（右侧气泡）底图</h4>
            <div class="image-upload-area">
              <div v-if="bubbleSettings.selfBgImageId" class="image-controls">
                <span class="status-text success">已应用背景图</span>
                <button class="bm-btn danger small" @click="clearImage('self')">清除</button>
              </div>
              <button v-else class="bm-btn outline block" @click="triggerUpload('self')" :disabled="uploading">
                {{ uploading && uploadTarget === 'self' ? '处理中...' : '选择图片' }}
              </button>
            </div>
            <div class="setting-row mt-2" v-if="bubbleSettings.selfBgImageId">
              <label>透明度</label>
              <input type="range" min="0.1" max="1" step="0.1" v-model="bubbleSettings.selfBgOpacity" />
              <span class="range-val">{{ bubbleSettings.selfBgOpacity }}</span>
            </div>
            <div class="setting-row" v-if="bubbleSettings.selfBgImageId">
              <label>填充模式</label>
              <select class="bm-select" v-model="bubbleSettings.selfBgSize">
                <option value="cover">覆盖填充 (Cover)</option>
                <option value="contain">等比显示 (Contain)</option>
                <option value="100% 100%">拉伸铺满 (100%)</option>
              </select>
            </div>
          </div>

          <div class="settings-group mt-4">
            <h4>对方（左侧气泡）底图</h4>
            <div class="image-upload-area">
              <div v-if="bubbleSettings.otherBgImageId" class="image-controls">
                <span class="status-text success">已应用背景图</span>
                <button class="bm-btn danger small" @click="clearImage('other')">清除</button>
              </div>
              <button v-else class="bm-btn outline block" @click="triggerUpload('other')" :disabled="uploading">
                {{ uploading && uploadTarget === 'other' ? '处理中...' : '选择图片' }}
              </button>
            </div>
            <div class="setting-row mt-2" v-if="bubbleSettings.otherBgImageId">
              <label>透明度</label>
              <input type="range" min="0.1" max="1" step="0.1" v-model="bubbleSettings.otherBgOpacity" />
              <span class="range-val">{{ bubbleSettings.otherBgOpacity }}</span>
            </div>
            <div class="setting-row" v-if="bubbleSettings.otherBgImageId">
              <label>填充模式</label>
              <select class="bm-select" v-model="bubbleSettings.otherBgSize">
                <option value="cover">覆盖填充 (Cover)</option>
                <option value="contain">等比显示 (Contain)</option>
                <option value="100% 100%">拉伸铺满 (100%)</option>
              </select>
            </div>
          </div>
          <p class="tip-text mt-3">注意：图片存储于本地浏览器 IndexedDB 中，如果清理浏览器缓存图片可能会丢失。</p>
        </div>

        <!-- 高级/代码面板 -->
        <div v-else-if="activeTab === 'advanced'" class="tab-pane">
          <div class="settings-group">
            <h4>自定义气泡 CSS</h4>
            <p class="tip-text mb-2">可使用此类选择器：<code>.message-bubble.self</code> 或 <code>.message-bubble.other</code>。此处的代码将被直接注入到聊天页面。</p>
            <textarea 
              class="code-editor" 
              v-model="bubbleSettings.customCss" 
              spellcheck="false"
              placeholder="/* 在此编写 CSS 代码 */"
            ></textarea>
          </div>
          
          <div class="settings-group mt-4">
            <h4>导入 / 导出配置</h4>
            <div class="action-buttons">
              <button class="bm-btn primary" @click="handleExport">导出当前配置 (.json)</button>
              <button class="bm-btn outline" @click="importInputRef?.click()">导入配置</button>
              <input type="file" ref="importInputRef" style="display: none" accept=".json" @change="handleImport" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--sys-bg-primary, #f7f8fa);
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.modal-content {
  background: transparent;
  border-radius: 0;
  width: 100%;
  max-width: none;
  height: 100%;
  max-height: none;
  display: flex;
  flex-direction: column;
  box-shadow: none;
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  padding-top: calc(env(safe-area-inset-top, 20px) + 16px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color, #e5e5e5);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary, #333333);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-tertiary, #999999);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--sys-bg-secondary, #f5f5f5);
  color: var(--text-primary, #333333);
}

.modal-tabs {
  display: flex;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-color, #e5e5e5);
  background: var(--sys-bg-secondary, #fafafa);
  overflow-x: auto;
}

.tab-btn {
  flex: 1;
  background: none;
  border: none;
  padding: 12px 16px;
  font-size: 14px;
  color: var(--text-secondary, #666666);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}

.tab-btn.active {
  color: #007aff;
  border-bottom-color: #007aff;
  font-weight: 500;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.tab-pane {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

h4 {
  margin: 0 0 12px 0;
  font-size: 15px;
  color: var(--text-primary, #333333);
}

.settings-group {
  background: var(--sys-bg-secondary, #f8f9fa);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e5e5e5);
}

.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.mb-2 { margin-bottom: 8px; }

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.setting-row:last-child {
  margin-bottom: 0;
}

.setting-row label {
  font-size: 14px;
  color: var(--text-secondary, #666666);
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--sys-bg-primary, #ffffff);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #e5e5e5);
}

.color-picker-wrapper input[type="color"] {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.color-picker-wrapper span {
  font-size: 12px;
  color: var(--text-secondary, #666666);
  font-family: monospace;
}

.bm-input {
  width: 160px;
  padding: 6px 10px;
  border: 1px solid var(--border-color, #e5e5e5);
  border-radius: 6px;
  font-size: 13px;
  background: var(--sys-bg-primary, #ffffff);
  color: var(--text-primary, #333333);
}

.bm-select {
  padding: 6px 10px;
  border: 1px solid var(--border-color, #e5e5e5);
  border-radius: 6px;
  font-size: 13px;
  background: var(--sys-bg-primary, #ffffff);
  color: var(--text-primary, #333333);
}

.bm-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.bm-btn.primary {
  background: #007aff;
  color: white;
}

.bm-btn.outline {
  background: transparent;
  border: 1px solid #007aff;
  color: #007aff;
}

.bm-btn.danger {
  background: #ff3b30;
  color: white;
}

.bm-btn.small {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
}

.bm-btn.block {
  width: 100%;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

/* 预设网格 */
.preset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.preset-item {
  border: 2px solid var(--border-color, #e5e5e5);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--sys-bg-primary, #ffffff);
}

.preset-item.active {
  border-color: #007aff;
  background: rgba(0, 122, 255, 0.05);
}

.preset-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding: 12px;
  background: var(--sys-bg-secondary, #f0f0f0);
  border-radius: 8px;
  border: 1px solid rgba(0,0,0,0.03);
}

.preview-bubble {
  padding: 6px 12px;
  font-size: 12px;
  max-width: 80%;
}

.preview-bubble.dashed {
  border: 1px dashed #bbbbbb !important;
}

.preview-bubble.other {
  align-self: flex-start;
  border: 1px solid rgba(0,0,0,0.05);
}

.preview-bubble.self {
  align-self: flex-end;
}

.preset-name {
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #333333);
}

/* 提示文本与代码编辑器 */
.tip-text {
  font-size: 12px;
  color: var(--text-tertiary, #999999);
  margin: 0;
  line-height: 1.5;
}

.code-editor {
  width: 100%;
  height: 160px;
  padding: 12px;
  border: 1px solid var(--border-color, #e5e5e5);
  border-radius: 8px;
  background: #282c34;
  color: #abb2bf;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
}

.code-editor:focus {
  outline: none;
  border-color: #007aff;
}

/* 背景图控制区 */
.image-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--sys-bg-primary, #ffffff);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #e5e5e5;
}

.status-text.success {
  color: #34c759;
  font-size: 13px;
  font-weight: 500;
}

.range-val {
  font-size: 12px;
  color: #666;
  width: 24px;
  text-align: right;
}
</style>
