/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean
  initialValue: number | undefined
  initialThreshold?: number | undefined
  currentSummary?: string | null
  title?: string
  memoryLabel?: string
  memoryDesc?: string
  thresholdLabel?: string
  thresholdDesc?: string
}>(), {
  title: '语音通话设置',
  memoryLabel: '短期上下文记忆',
  memoryDesc: '独立于文字聊天外的通话记录带入条数。',
  thresholdLabel: '临时总结频次',
  thresholdDesc: '通话每达到多少条，自动总结一次前面内容（省Token）。'
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', countValue: number | null, thresholdValue: number | null): void
  (e: 'update-summary', newSummary: string | null): void
}>()

const tempMemoryValue = ref('')
const tempThresholdValue = ref('')
const activeTab = ref<'settings' | 'summary'>('settings')

const isEditing = ref(false)
const editableSummary = ref('')

watch(() => props.visible, (newVal) => {
  if (newVal) {
    tempMemoryValue.value = props.initialValue ? props.initialValue.toString() : ''
    tempThresholdValue.value = props.initialThreshold ? props.initialThreshold.toString() : '50'
    activeTab.value = 'settings'
    isEditing.value = false
    editableSummary.value = props.currentSummary || ''
  }
})

watch(() => props.currentSummary, (newVal) => {
  if (!isEditing.value) {
    editableSummary.value = newVal || ''
  }
})

const startEdit = () => {
  editableSummary.value = props.currentSummary || ''
  isEditing.value = true
}

const cancelEdit = () => {
  isEditing.value = false
  editableSummary.value = props.currentSummary || ''
}

const saveEdit = () => {
  emit('update-summary', editableSummary.value || null)
  isEditing.value = false
}

const close = () => {
  emit('update:visible', false)
}

const handleSave = () => {
  const countVal = parseInt(tempMemoryValue.value)
  const thresholdVal = parseInt(tempThresholdValue.value)
  emit('save', isNaN(countVal) ? null : countVal, isNaN(thresholdVal) ? null : thresholdVal)
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10000;" @click.self="close">
    <div class="custom-confirm-modal" style="width: 340px;">
      <div class="confirm-title" style="margin-bottom: 8px;">{{ title }}</div>

      <!-- Tabs -->
      <div style="display: flex; gap: 16px; padding: 0 24px; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); justify-content: center;">
        <div 
          :style="{ paddingBottom: '8px', cursor: 'pointer', color: activeTab === 'settings' ? 'var(--text-primary)' : 'var(--text-tertiary)', borderBottom: activeTab === 'settings' ? '2px solid var(--text-primary)' : '2px solid transparent', fontWeight: activeTab === 'settings' ? '600' : '400', fontSize: '14px' }"
          @click="activeTab = 'settings'"
        >设置</div>
        <div 
          :style="{ paddingBottom: '8px', cursor: 'pointer', color: activeTab === 'summary' ? 'var(--text-primary)' : 'var(--text-tertiary)', borderBottom: activeTab === 'summary' ? '2px solid var(--text-primary)' : '2px solid transparent', fontWeight: activeTab === 'summary' ? '600' : '400', fontSize: '14px' }"
          @click="activeTab = 'summary'"
        >临时总结</div>
      </div>
      
      <div v-if="activeTab === 'settings'">
        <!-- 语音上下文条数 -->
        <div class="confirm-desc" style="padding-top: 0; text-align: left; padding: 0 24px; margin-bottom: 4px;">
          <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">{{ memoryLabel }}</div>
          <div style="font-size: 12px; color: var(--text-tertiary);">{{ memoryDesc }}</div>
        </div>
        <div style="padding: 0 24px 16px;">
          <input type="number" class="form-input" v-model="tempMemoryValue" placeholder="留空为不限制" style="margin-bottom: 0; width: 100%; box-sizing: border-box;" min="1" max="100" />
        </div>

        <!-- 临时总结阈值 -->
        <div class="confirm-desc" style="padding-top: 0; text-align: left; padding: 0 24px; margin-bottom: 4px;">
          <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">{{ thresholdLabel }}</div>
          <div style="font-size: 12px; color: var(--text-tertiary);">{{ thresholdDesc }}</div>
        </div>
        <div style="padding: 0 24px 16px;">
          <input type="number" class="form-input" v-model="tempThresholdValue" placeholder="默认50" style="margin-bottom: 0; width: 100%; box-sizing: border-box;" min="10" max="200" />
        </div>
      </div>

      <div v-else-if="activeTab === 'summary'">
        <div v-if="isEditing" class="confirm-desc" style="padding-top: 0; text-align: left; padding: 0 24px; margin-bottom: 16px;">
          <textarea v-model="editableSummary" class="form-input" style="width: 100%; height: 150px; resize: none; font-size: 13px; line-height: 1.5; padding: 8px 12px; box-sizing: border-box;" placeholder="输入总结内容..."></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
            <div class="confirm-btn cancel" style="flex: none; width: auto; padding: 4px 12px; height: 28px; line-height: 28px; font-size: 12px;" @click="cancelEdit">取消</div>
            <div class="confirm-btn danger" style="color: var(--text-primary); flex: none; width: auto; padding: 4px 12px; height: 28px; line-height: 28px; font-size: 12px;" @click="saveEdit">保存</div>
          </div>
        </div>
        <!-- 当前临时总结展示 -->
        <div v-else-if="currentSummary" class="confirm-desc" style="padding-top: 0; text-align: left; padding: 0 24px; margin-bottom: 16px; position: relative;">
          <div style="font-size: 13px; color: var(--text-secondary); background: rgba(0,0,0,0.03); padding: 8px 12px; border-radius: 8px; max-height: 150px; overflow-y: auto; line-height: 1.5; white-space: pre-wrap;">
            {{ currentSummary }}
          </div>
          <div style="position: absolute; top: 4px; right: 32px; cursor: pointer; color: var(--theme-color); font-size: 12px;" @click="startEdit">编辑</div>
        </div>
        <div v-else class="confirm-desc" style="padding-top: 20px; padding-bottom: 20px; text-align: center; padding-left: 24px; padding-right: 24px; margin-bottom: 16px; color: var(--text-tertiary); font-size: 13px;">
          当前还没有临时总结哦
        </div>
      </div>

      <div v-if="activeTab === 'settings'" class="confirm-actions" style="margin-top: 8px;">
        <div class="confirm-btn cancel" @click="close">取消</div>
        <div class="confirm-btn danger" style="color: var(--text-primary);" @click="handleSave">确认</div>
      </div>
      <div v-else class="confirm-actions" style="margin-top: 8px;">
        <div class="confirm-btn cancel" style="width: 100%; border-right: none;" @click="close">关闭</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';
</style>
