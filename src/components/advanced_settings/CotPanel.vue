/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { cotSettings } from '../../store'
import { useAdvancedSettingsCot } from '../../composables/useAdvancedSettingsCot'

const props = defineProps<{
  showConfirm: any
}>()

const {
  cotModalVisible,
  editingCotItem,
  dragIndex,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  openCotModal,
  saveCotItem,
  deleteCotItem
} = useAdvancedSettingsCot(props.showConfirm)

const getPositionLabel = (pos: string) => {
  const map: Record<string, string> = {
    'system_top': '头部 (System)',
    'system_middle': '中间 (System)',
    'system_bottom': '尾部 (System)',
    'assistant_prefill': '底部 (AI Role - 触发器)'
  }
  return map[pos] || pos
}

</script>

<template>
  <div class="settings-panel">
    <!-- 杂志风装饰性标题栏 -->
    <div class="mag-header">
      <div class="mag-title-box">
        <span class="mag-title">思维链</span>
        <span class="mag-subtitle">Chain of Thought</span>
      </div>
      <div class="mag-desc">开启后将通过 Prompt 和 Prefill 强制接管模型原生思维链过程。</div>
    </div>
    
    <div class="mag-settings-card">
      <!-- 启用开关 -->
      <div class="mag-form-row vertical">
        <div class="row-main">
          <div class="mag-label">启用 COT 控制</div>
          <label class="toggle-switch">
            <input type="checkbox" v-model="cotSettings.enabled">
            <span class="slider"></span>
          </label>
        </div>
        <div class="mag-subdesc">开启后将拦截模型默认行为并注入自定义思维逻辑</div>
      </div>

      <template v-if="cotSettings.enabled">
        <!-- 思考模式切换 -->
        <div class="mag-form-row vertical">
          <div class="row-main">
            <div class="mag-label">思考模式</div>
            <div class="mag-mode-switch">
              <button 
                class="mag-mode-btn" 
                :class="{ active: cotSettings.mode === 'skip' }"
                @click="cotSettings.mode = 'skip'"
              >跳过思考</button>
              <button 
                class="mag-mode-btn" 
                :class="{ active: cotSettings.mode === 'custom' }"
                @click="cotSettings.mode = 'custom'"
              >自定义思考</button>
            </div>
          </div>
          <div class="mag-subdesc">
            {{ cotSettings.mode === 'skip' ? '直接伪装完成思考，强迫模型只输出正文。' : '强制模型按照自定义的拆分条目进行阶段性思考。' }}
          </div>
        </div>

        <!-- 界面显示开关 -->
        <div class="mag-form-row vertical" v-if="cotSettings.mode === 'custom'">
          <div class="row-main">
            <div class="mag-label">界面显示</div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="cotSettings.showThinking">
              <span class="slider"></span>
            </label>
          </div>
          <div class="mag-subdesc">在聊天中展示提取到的思考过程</div>
        </div>

        <div class="mag-list-container" v-if="cotSettings.mode === 'custom'">
          <div class="mag-list-header">
            <span class="mag-list-label">自定义思维链条目</span>
            <button class="mag-btn primary mini" @click="openCotModal()">+ 新增条目</button>
          </div>
          
          <div class="cot-list">
            <div 
              v-for="(item, index) in cotSettings.items" 
              :key="item.id" 
              class="cot-item-card"
              draggable="true"
              @dragstart="handleDragStart(index)"
              @dragover="handleDragOver($event, index)"
              @dragend="handleDragEnd"
              :class="{ 'is-dragging': dragIndex === index }"
            >
              <!-- 上下两行布局 -->
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

                <!-- 第二行：标签与操作 -->
                <div class="cot-card-bottom">
                  <div class="cot-item-tags">
                    <span class="cot-tag pos">{{ getPositionLabel(item.position).split(' ')[0] }}</span>
                    <span class="cot-tag role">{{ item.role }}</span>
                  </div>
                  <div class="cot-item-actions">
                    <button class="icon-btn edit" @click="openCotModal(item)">编辑</button>
                    <button class="icon-btn delete" @click="deleteCotItem(item.id)">删除</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- COT 条目编辑弹窗 -->
  <Transition name="fade">
    <div class="simple-modal-overlay" v-if="cotModalVisible" @click.self="cotModalVisible = false">
      <div class="cot-edit-modal">
        <div class="cot-modal-header">
          <h3>编辑条目</h3>
          <button class="close-btn" @click="cotModalVisible = false">✕</button>
        </div>
        
        <div class="cot-modal-body" v-if="editingCotItem">
          <div class="form-row">
            <div class="form-label">条目名称</div>
            <input v-model="editingCotItem.name" class="simple-modal-input" placeholder="例如：思维链开启引导" />
          </div>
          
          <div class="form-row-multi">
            <div class="form-row half">
              <div class="form-label">注入位置</div>
              <select v-model="editingCotItem.position" class="simple-modal-input select">
                <option value="system_top">头部 (System)</option>
                <option value="system_middle">中间 (System)</option>
                <option value="system_bottom">尾部 (System)</option>
                <option value="assistant_prefill">底部 (AI Role - 触发器)</option>
              </select>
            </div>
            <div class="form-row half">
              <div class="form-label">发送身份</div>
              <select v-model="editingCotItem.role" class="simple-modal-input select">
                <option value="system">系统 (System)</option>
                <option value="assistant">AI自己 (Assistant)</option>
                <option value="user">用户 (User)</option>
              </select>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-label">内容文本 <span class="hint">(支持 &lt;变量名&gt;)</span></div>
            <textarea 
              v-model="editingCotItem.content" 
              class="simple-modal-input textarea" 
              placeholder="请输入提示词内容..."
              spellcheck="false"
            ></textarea>
          </div>
          
          <div class="form-row horizontal">
            <div class="form-label">是否启用</div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="editingCotItem.enabled">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        
        <div class="cot-modal-footer">
          <button class="simple-modal-btn cancel" @click="cotModalVisible = false">取消</button>
          <button class="simple-modal-btn confirm primary" @click="saveCotItem">保存</button>
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
  margin-bottom: 20px;
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
  color: #1F2937;
  letter-spacing: 1px;
}

.mag-subtitle {
  font-family: Georgia, serif;
  font-size: 13px;
  font-style: italic;
  color: #D1D5DB;
}

.mag-desc {
  font-size: 12px;
  color: #6B7280;
  line-height: 1.5;
}

.mag-settings-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 0 10px;
}

.mag-form-row {
  display: flex;
  padding: 18px 10px;
  border-bottom: 1px dashed #E5E7EB;
}

.mag-form-row:last-child {
  border-bottom: none;
}

.mag-form-row.vertical {
  flex-direction: column;
  gap: 8px;
}

.row-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.mag-label {
  font-size: 14px;
  color: #1F2937;
  font-weight: 600;
}

.mag-subdesc {
  font-size: 12px;
  color: #6B7280;
  line-height: 1.4;
}

.mag-mode-switch {
  display: flex;
  background: #F9FAFB;
  border-radius: 10px;
  padding: 3px;
  border: 1px solid #E5E7EB;
}

.mag-mode-btn {
  border: none;
  background: transparent;
  padding: 6px 14px;
  font-size: 12px;
  color: #6B7280;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.mag-mode-btn.active {
  background: #1F2937;
  color: #ffffff;
  box-shadow: 0 2px 4px rgba(31,41,55,0.15);
  font-weight: 500;
}

.mag-btn {
  padding: 6px 14px;
  font-size: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.mag-btn.primary {
  background: #1F2937;
  color: #ffffff;
}

.mag-btn.primary.mini {
  padding: 4px 10px;
  font-size: 11px;
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
  background-color: #1F2937; 
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

.mag-list-container {
  padding: 16px 0;
}

.mag-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.mag-list-label {
  font-size: 14px;
  font-weight: 600;
  color: #1F2937;
}

.cot-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cot-item-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  transition: all 0.2s;
  padding: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.01);
}

.cot-item-card.is-dragging {
  opacity: 0.5;
  background: #F9FAFB;
  border-color: #D1D5DB;
}

.cot-card-inner {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.cot-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.drag-handle {
  cursor: grab;
  color: #D1D5DB;
  display: flex;
  align-items: center;
  padding: 2px;
  flex-shrink: 0;
}

.drag-handle:active {
  cursor: grabbing;
  color: #6B7280;
}

.cot-item-name {
  font-size: 14px;
  font-weight: 600;
  color: #1F2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spacer {
  flex: 1;
}

.cot-card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 26px; 
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
  font-style: italic;
  font-size: 11px;
  color: #6B7280;
}

.cot-item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.icon-btn {
  background: #ffffff;
  border: 1px solid #E5E7EB;
  font-size: 11px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 6px;
}

.icon-btn.edit {
  color: #1F2937;
}
.icon-btn.edit:active {
  background: #F9FAFB;
}

.icon-btn.delete {
  color: #ef4444;
}
.icon-btn.delete:active {
  background: rgba(239,68,68,0.1);
}

.simple-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cot-edit-modal {
  background: #ffffff;
  width: 90%;
  max-width: 500px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  border: 1px solid #E5E7EB;
}

.cot-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #E5E7EB;
  background: #ffffff;
}

.cot-modal-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #1F2937;
  letter-spacing: 1px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 16px;
  color: #6B7280;
  cursor: pointer;
}

.cot-modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 60vh;
  overflow-y: auto;
}

.cot-modal-body .form-row {
  padding: 0;
  border: none;
  flex-direction: column;
  align-items: flex-start;
}

.form-row-multi {
  display: flex;
  gap: 12px;
}

.form-row-multi .half {
  flex: 1;
}

.cot-modal-body .form-label {
  margin-bottom: 8px;
  font-size: 13px;
  color: #1F2937;
}

.hint {
  font-size: 11px;
  color: #6B7280;
  font-weight: normal;
}

.simple-modal-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  background: #F9FAFB;
  font-size: 13px;
  color: #1F2937;
  outline: none;
  transition: border-color 0.2s;
}

.simple-modal-input:focus {
  border-color: #D1D5DB;
  background: #ffffff;
}

.simple-modal-input.textarea {
  min-height: 120px;
  resize: vertical;
  line-height: 1.5;
}

.simple-modal-input.select {
  appearance: auto;
  cursor: pointer;
}

.cot-modal-body .form-row.horizontal {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background: rgba(0,0,0,0.01);
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #E5E7EB;
}

.cot-modal-footer {
  display: flex;
  padding: 14px 20px;
  border-top: 1px solid #E5E7EB;
  justify-content: flex-end;
  gap: 12px;
  background: #ffffff;
}

.simple-modal-btn {
  flex: none;
  padding: 8px 24px;
  border-radius: 8px;
  border: 1px solid #E5E7EB;
  color: #1F2937;
  font-size: 13px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.simple-modal-btn.primary {
  background: #1F2937;
  color: #ffffff;
  border: none;
}

.simple-modal-btn.primary:active {
  background: #374151;
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
