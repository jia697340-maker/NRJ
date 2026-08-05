/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  initialMin: number
  initialMax: number
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', min: number, max: number): void
}>()

const tempMinCount = ref('')
const tempMaxCount = ref('')

watch(() => props.visible, (newVal) => {
  if (newVal) {
    tempMinCount.value = String(props.initialMin)
    tempMaxCount.value = String(props.initialMax)
  }
})

const close = () => {
  emit('update:visible', false)
}

const handleSave = () => {
  const minVal = parseInt(tempMinCount.value) || 1
  const maxVal = parseInt(tempMaxCount.value) || 3
  
  if (minVal > maxVal) {
    alert('最小条数不能大于最大条数')
    return
  }
  
  emit('save', minVal, maxVal)
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10000;" @click.self="close">
    <div class="custom-confirm-modal">
      <div class="confirm-title" style="margin-bottom: 8px;">设置回复条数限制</div>
      <div class="confirm-desc" style="padding-top: 0;">
        强制要求角色在一次回复中切分的消息条数范围。<br/>注意：这仅作为强提示词限制，具体效果取决于大模型能力。
      </div>
      <div style="padding: 0 24px 20px; display: flex; gap: 12px; align-items: center;">
        <input type="number" class="form-input" v-model="tempMinCount" placeholder="最小" min="1" style="margin-bottom: 0; width: 100%; box-sizing: border-box; text-align: center;" />
        <span style="color: var(--text-secondary)">至</span>
        <input type="number" class="form-input" v-model="tempMaxCount" placeholder="最大" min="1" style="margin-bottom: 0; width: 100%; box-sizing: border-box; text-align: center;" />
      </div>
      <div class="confirm-actions">
        <div class="confirm-btn cancel" @click="close">取消</div>
        <div class="confirm-btn danger" style="color: var(--text-primary);" @click="handleSave">确认</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';
</style>
