/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { globalPromptSettings, promptPresetOptions, taskPromptSettings } from '../../store'
import { useAdvancedSettingsPrompt } from '../../composables/useAdvancedSettingsPrompt'

const props = defineProps<{
  showConfirm: any
}>()

const {
  promptModalVisible,
  editingPromptItem,
  dragPromptIndex,
  handlePromptDragStart,
  handlePromptDragOver,
  handlePromptDragEnd,
  openPromptModal,
  savePromptItem,
  deletePromptItem,
  resetPromptItems,
  switchPromptPreset
} = useAdvancedSettingsPrompt(props.showConfirm)

const activePromptTab = ref<'normal' | 'task'>('normal')
const activePresetDescription = computed(() =>
  promptPresetOptions.find(option => option.id === globalPromptSettings.activePresetId)?.description || ''
)

const dragTaskPromptIndex = ref<number | null>(null)

const handleTaskPromptDragStart = (index: number) => {
  dragTaskPromptIndex.value = index
}

const handleTaskPromptDragOver = (e: DragEvent, index: number) => {
  e.preventDefault()
  if (dragTaskPromptIndex.value === null || dragTaskPromptIndex.value === index) return
  const items = [...taskPromptSettings.items]
  const draggedItem = items.splice(dragTaskPromptIndex.value, 1)[0]
  items.splice(index, 0, draggedItem)
  taskPromptSettings.items = items
  dragTaskPromptIndex.value = index
}

const handleTaskPromptDragEnd = () => {
  dragTaskPromptIndex.value = null
}

const taskPromptModalVisible = ref(false)
const editingTaskPromptItem = ref<any>(null)
let currentTaskPromptIsNew = false

const openTaskPromptModal = (item?: any) => {
  if (item) {
    editingTaskPromptItem.value = JSON.parse(JSON.stringify(item))
    currentTaskPromptIsNew = false
  } else {
    editingTaskPromptItem.value = {
      id: 'task_prompt_' + Date.now(),
      name: '',
      content: '',
      enabled: true
    }
    currentTaskPromptIsNew = true
  }
  taskPromptModalVisible.value = true
}

const saveTaskPromptItem = () => {
  if (!editingTaskPromptItem.value || !editingTaskPromptItem.value.name.trim() || !editingTaskPromptItem.value.content.trim()) {
    return props.showConfirm({ title: '错误', content: '名称和内容不能为空', showCancel: false })
  }
  
  if (currentTaskPromptIsNew) {
    taskPromptSettings.items.push(editingTaskPromptItem.value)
  } else {
    const index = taskPromptSettings.items.findIndex((i: any) => i.id === editingTaskPromptItem.value.id)
    if (index > -1) {
      taskPromptSettings.items[index] = editingTaskPromptItem.value
    }
  }
  
  taskPromptModalVisible.value = false
}

const deleteTaskPromptItem = (id: string) => {
  props.showConfirm({
    title: '确认删除',
    content: '确定要删除此任务提示词吗？',
    onConfirm: () => {
      taskPromptSettings.items = taskPromptSettings.items.filter((i: any) => i.id !== id)
    }
  })
}

const resetTaskPromptItems = () => {
  props.showConfirm({
    title: '确认恢复',
    content: '这将会丢失您自定义的任务提示词配置，恢复为系统默认状态。确定要继续吗？',
    onConfirm: () => {
      import('../../store').then(module => {
        taskPromptSettings.items = JSON.parse(JSON.stringify(module.defaultTaskPromptItems))
      })
    }
  })
}

</script>

<template>
  <div class="settings-panel">
    <!-- 杂志风装饰性标题栏 -->
    <div class="mag-header">
      <div class="mag-title-box">
        <span class="mag-title">全局提示词</span>
        <span class="mag-subtitle">System Prompts</span>
      </div>
      <div class="mag-desc">
        所有核心底层规则均已抽取为可视化条目。系统按顺序拼接，自动替换占位符。你可以自由调整顺序或修改内容。
      </div>
    </div>

    <!-- 标签页切换 (美化) -->
    <div class="mag-tabs">
      <button 
        class="mag-tab-btn" 
        :class="{ active: activePromptTab === 'normal' }" 
        @click="activePromptTab = 'normal'"
      >
        常规聊天
      </button>
      <button 
        class="mag-tab-btn" 
        :class="{ active: activePromptTab === 'task' }" 
        @click="activePromptTab = 'task'"
      >
        特殊任务
      </button>
    </div>

    <div class="prompt-version-card" v-if="activePromptTab === 'normal'">
      <div class="prompt-version-copy">
        <span class="mag-list-label">提示词版本</span>
        <span class="prompt-version-desc">{{ activePresetDescription }}</span>
      </div>
      <div class="mag-tabs prompt-version-tabs">
        <button
          v-for="option in promptPresetOptions"
          :key="option.id"
          class="mag-tab-btn"
          :class="{ active: globalPromptSettings.activePresetId === option.id }"
          @click="switchPromptPreset(option.id)"
        >
          {{ option.name }}
        </button>
      </div>
    </div>
    
    <div class="mag-settings-card" v-if="activePromptTab === 'normal'">
      <div class="mag-list-container">
        <div class="mag-list-header">
          <span class="mag-list-label">可视条目列表</span>
          <div class="header-actions">
            <button class="mag-icon-text-btn" @click="resetPromptItems()" title="重置为最新默认配置">↺ 恢复默认</button>
            <button class="mag-btn primary" @click="openPromptModal()">+ 新增</button>
          </div>
        </div>
        
        <div class="cot-list">
          <div 
            v-for="(item, index) in globalPromptSettings.items" 
            :key="item.id" 
            class="cot-item-card"
            draggable="true"
            @dragstart="handlePromptDragStart(index)"
            @dragover="handlePromptDragOver($event, index)"
            @dragend="handlePromptDragEnd"
            :class="{ 'is-dragging': dragPromptIndex === index }"
          >
            <div class="cot-card-inner">
              <!-- 第一行：名称与开关 -->
              <div class="cot-card-top">
                <div class="drag-handle">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                </div>
                <span class="cot-item-name">{{ item.name }}</span>
                <div class="spacer"></div>
                <label class="toggle-switch mini">
                  <input type="checkbox" v-model="item.enabled">
                  <span class="slider"></span>
                </label>
              </div>

              <!-- 第二行：操作 -->
              <div class="cot-card-bottom">
                <div class="cot-item-tags">
                  <span class="cot-tag pos">追加到系统设定末尾</span>
                </div>
                <div class="cot-item-actions">
                  <button class="icon-btn edit" @click="openPromptModal(item)">编辑</button>
                  <button class="icon-btn delete" @click="deletePromptItem(item.id)">删除</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 特殊任务提示词 -->
    <div class="mag-settings-card" v-else-if="activePromptTab === 'task'">
      <div class="mag-list-container">
        <div class="mag-list-header">
          <span class="mag-list-label">任务条目列表 (通话决策/总结等)</span>
          <div class="header-actions">
            <button class="mag-icon-text-btn" @click="resetTaskPromptItems()" title="重置为最新默认配置">↺ 恢复默认</button>
            <button class="mag-btn primary" @click="openTaskPromptModal()">+ 新增</button>
          </div>
        </div>
        
        <div class="cot-list">
          <div 
            v-for="(item, index) in taskPromptSettings.items" 
            :key="item.id" 
            class="cot-item-card"
            draggable="true"
            @dragstart="handleTaskPromptDragStart(index)"
            @dragover="handleTaskPromptDragOver($event, index)"
            @dragend="handleTaskPromptDragEnd"
            :class="{ 'is-dragging': dragTaskPromptIndex === index }"
          >
            <div class="cot-card-inner">
              <div class="cot-card-top">
                <div class="drag-handle">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                </div>
                <span class="cot-item-name">{{ item.name }}</span>
                <div class="spacer"></div>
                <label class="toggle-switch mini">
                  <input type="checkbox" v-model="item.enabled">
                  <span class="slider"></span>
                </label>
              </div>

              <div class="cot-card-bottom">
                <div class="cot-item-tags">
                  <span class="cot-tag pos">在特定任务触发时生效</span>
                </div>
                <div class="cot-item-actions">
                  <button class="icon-btn edit" @click="openTaskPromptModal(item)">编辑</button>
                  <button class="icon-btn delete" @click="deleteTaskPromptItem(item.id)">删除</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- Prompt 条目编辑弹窗 -->
  <Transition name="fade">
    <div class="simple-modal-overlay" v-if="promptModalVisible" @click.self="promptModalVisible = false">
      <div class="cot-edit-modal">
        <div class="cot-modal-header">
          <h3>编辑提示词条目</h3>
          <button class="close-btn" @click="promptModalVisible = false">✕</button>
        </div>
        
        <div class="cot-modal-body" v-if="editingPromptItem">
          <div class="form-row">
            <div class="form-label">条目名称</div>
            <input v-model="editingPromptItem.name" class="simple-modal-input" placeholder="例如：文风要求 / 限制条款" />
          </div>
          
          <div class="form-row">
            <div class="form-label">
              提示词内容 
              <span class="hint" v-pre>(支持占位符: {{char_name}}, {{user_name}}, {{char_persona}}, {{user_persona}}, {{world_book}}, {{time_context}}, {{format_rules}})</span>
            </div>
            <textarea 
              v-model="editingPromptItem.content" 
              class="simple-modal-input textarea" 
              placeholder="请输入提示词设定内容..."
              spellcheck="false"
            ></textarea>
          </div>
          
          <div class="form-row horizontal">
            <div class="form-label">是否启用此条目</div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="editingPromptItem.enabled">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        
        <div class="cot-modal-footer">
          <button class="simple-modal-btn cancel" @click="promptModalVisible = false">取消</button>
          <button class="simple-modal-btn confirm primary" @click="savePromptItem">保存</button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- 特殊任务 Prompt 条目编辑弹窗 -->
  <Transition name="fade">
    <div class="simple-modal-overlay" v-if="taskPromptModalVisible" @click.self="taskPromptModalVisible = false">
      <div class="cot-edit-modal">
        <div class="cot-modal-header">
          <h3>编辑特殊任务提示词</h3>
          <button class="close-btn" @click="taskPromptModalVisible = false">✕</button>
        </div>
        
        <div class="cot-modal-body" v-if="editingTaskPromptItem">
          <div class="form-row">
            <div class="form-label">条目名称</div>
            <input v-model="editingTaskPromptItem.name" class="simple-modal-input" placeholder="例如：视频通话总结" />
          </div>
          
          <div class="form-row">
            <div class="form-label">
              提示词内容 
              <span class="hint" style="display:block; margin-top: 4px;">(根据具体任务不同，支持特定的占位符替换，请谨慎修改底层逻辑要求)</span>
            </div>
            <textarea 
              v-model="editingTaskPromptItem.content" 
              class="simple-modal-input textarea" 
              placeholder="请输入提示词设定内容..."
              spellcheck="false"
            ></textarea>
          </div>
          
          <div class="form-row horizontal">
            <div class="form-label">是否启用此条目</div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="editingTaskPromptItem.enabled">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        
        <div class="cot-modal-footer">
          <button class="simple-modal-btn cancel" @click="taskPromptModalVisible = false">取消</button>
          <button class="simple-modal-btn confirm primary" @click="saveTaskPromptItem">保存</button>
        </div>
      </div>
    </div>
  </Transition>

</template>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding-bottom: 30px;
}

/* 杂志风内部头部 */
.mag-header {
  margin-bottom: 16px;
  padding: 0 10px;
}

.mag-title-box {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}

.mag-title {
  font-size: 18px;
  font-weight: 600;
  color: #4A4643;
  letter-spacing: 1px;
}

.mag-subtitle {
  font-family: Georgia, serif;
  font-size: 13px;
  font-style: italic;
  color: #D4C9C1;
}

.mag-desc {
  font-size: 12px;
  color: #8C8681;
  line-height: 1.5;
}

/* 杂志风标签页 */
.mag-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding: 0 10px;
}

.prompt-version-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 0 10px 16px;
  padding: 14px 16px;
  background: #FFFFFF;
  border: 1px solid #EBE5DF;
  border-radius: 16px;
}

.prompt-version-copy {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.prompt-version-desc {
  color: #8C8681;
  font-size: 12px;
  line-height: 1.5;
}

.prompt-version-tabs {
  flex-shrink: 0;
  gap: 8px;
  margin: 0;
  padding: 0;
}

.prompt-version-tabs .mag-tab-btn {
  padding: 6px 12px;
}

@media (max-width: 520px) {
  .prompt-version-card {
    align-items: flex-start;
    flex-direction: column;
  }
}

.mag-tab-btn {
  padding: 6px 16px;
  border-radius: 20px;
  border: 1px solid #EBE5DF;
  background: #ffffff;
  color: #8C8681;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.mag-tab-btn.active {
  background: #4A4643;
  border-color: #4A4643;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(74,70,67,0.2);
}

/* 杂志风卡片容器 */
.mag-settings-card {
  background: #FFFFFF; 
  border-radius: 16px;
  padding: 10px;
}

.mag-list-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mag-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 10px;
  margin-bottom: 4px;
}

.mag-list-label {
  font-size: 14px;
  font-weight: 600;
  color: #4A4643;
  letter-spacing: 0.5px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-shrink: 0;
}

.mag-icon-text-btn {
  background: none;
  border: none;
  color: #8C8681;
  font-size: 12px;
  padding: 4px 8px;
  cursor: pointer;
  white-space: nowrap;
}
.mag-icon-text-btn:active {
  color: #4A4643;
}

.mag-btn {
  padding: 6px 14px;
  font-size: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  white-space: nowrap;
}

.mag-btn.primary {
  background: #4A4643;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(74,70,67,0.1);
}
.mag-btn.primary:active {
  transform: scale(0.96);
}

.cot-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cot-item-card {
  background: #FFFFFF;
  border: 1px solid #EBE5DF;
  border-radius: 16px;
  transition: all 0.2s;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.01);
}

.cot-item-card.is-dragging {
  opacity: 0.5;
  background: #F9FAFB;
  border-color: #D1D5DB;
  box-shadow: none;
}

.cot-card-inner {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.cot-card-top {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.drag-handle {
  cursor: grab;
  color: #D4C9C1;
  display: flex;
  align-items: center;
  padding: 2px;
  flex-shrink: 0;
}

.drag-handle:active {
  cursor: grabbing;
  color: #8C8681;
}

.cot-item-name {
  font-size: 14px;
  font-weight: 600;
  color: #4A4643;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spacer {
  flex: 1;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}
.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.08);
  transition: .3s;
  border-radius: 24px;
}
.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: #ffffff;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
input:checked + .slider {
  background-color: #4A4643; 
}
input:checked + .slider:before {
  transform: translateX(20px);
}

.toggle-switch.mini {
  width: 32px;
  height: 18px;
}

.toggle-switch.mini .slider:before {
  height: 14px;
  width: 14px;
}

.toggle-switch.mini input:checked + .slider:before {
  transform: translateX(14px);
}

.cot-card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 28px;
  width: 100%;
  box-sizing: border-box;
}

.cot-item-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap; 
}

.cot-tag {
  font-family: Georgia, serif;
  font-size: 11px;
  font-style: italic;
  color: #8C8681;
}

.cot-item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.icon-btn {
  background: #F8F6F3;
  border: 1px solid #EBE5DF;
  font-size: 11px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 8px;
  transition: all 0.2s;
}

.icon-btn.edit {
  color: #4A4643;
}
.icon-btn.edit:active {
  background: #EBE5DF;
}

.icon-btn.delete {
  color: #d18888;
}
.icon-btn.delete:active {
  background: rgba(209,136,136,0.1);
}

/* --- 编辑弹窗样式 (杂志美化风) --- */
.simple-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(235, 229, 223, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cot-edit-modal {
  background: #FFFFFF;
  width: 90%;
  max-width: 500px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 12px 48px rgba(74, 70, 67, 0.12);
  display: flex;
  flex-direction: column;
  border: 1px solid #EBE5DF;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.cot-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px dashed #EBE5DF;
  background: #FFFFFF;
}

.cot-modal-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #4A4643;
  letter-spacing: 1px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #8C8681;
  cursor: pointer;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #4A4643;
}

.cot-modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-height: 65vh;
  overflow-y: auto;
}

.cot-modal-body .form-row {
  padding: 0;
  border: none;
  flex-direction: column;
  align-items: flex-start;
  display: flex;
}

.cot-modal-body .form-label {
  margin-bottom: 10px;
  font-size: 14px;
  color: #4A4643;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.hint {
  font-family: Georgia, serif;
  font-size: 12px;
  color: #8C8681;
  font-weight: normal;
  font-style: italic;
  line-height: 1.4;
}

.simple-modal-input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 16px;
  border: 1px solid #EBE5DF;
  border-radius: 12px;
  background: #F8F6F3;
  font-size: 14px;
  color: #4A4643;
  outline: none;
  transition: all 0.3s ease;
  font-family: inherit;
}

.simple-modal-input:focus {
  border-color: #4A4643;
  background: #FFFFFF;
  box-shadow: 0 0 0 3px rgba(74,70,67,0.05);
}

.simple-modal-input::placeholder {
  color: #D4C9C1;
}

.simple-modal-input.textarea {
  min-height: 160px;
  resize: vertical;
  line-height: 1.6;
  font-family: Georgia, "Times New Roman", Times, serif; /* 文本区采用优雅的衬线体 */
}

.cot-modal-body .form-row.horizontal {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background: #F8F6F3;
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid #EBE5DF;
  margin-top: 4px;
}

.cot-modal-footer {
  display: flex;
  padding: 16px 24px;
  border-top: 1px dashed #EBE5DF;
  justify-content: flex-end;
  gap: 12px;
  background: #FAFAFA;
}

.simple-modal-btn {
  flex: none;
  padding: 10px 24px;
  border-radius: 20px;
  border: 1px solid #EBE5DF;
  color: #8C8681;
  font-size: 14px;
  font-weight: 500;
  background: #FFFFFF;
  cursor: pointer;
  transition: all 0.2s ease;
}
.simple-modal-btn:hover {
  color: #4A4643;
  border-color: #D4C9C1;
}

.simple-modal-btn.primary {
  background: #4A4643;
  color: #FFFFFF;
  border: 1px solid #4A4643;
  box-shadow: 0 4px 12px rgba(74,70,67,0.15);
}

.simple-modal-btn.primary:active {
  transform: scale(0.96);
  box-shadow: 0 2px 6px rgba(74,70,67,0.1);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
