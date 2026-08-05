/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  currentType: 'round' | 'count'
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', value: 'round' | 'count'): void
}>()

const handleSelect = (type: 'round' | 'count') => {
  emit('select', type)
}

const close = () => {
  emit('update:visible', false)
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10000;" @click.self="close">
    <div class="custom-confirm-modal" style="position: relative; max-width: 340px;">
      <!-- 关闭按钮 -->
      <div @click="close" style="position: absolute; right: 16px; top: 16px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-secondary); font-size: 22px; font-weight: 300; line-height: 1; z-index: 2;">
        &times;
      </div>
      <div class="confirm-title" style="margin-bottom: 16px;">选择记忆计算方式</div>
      <div class="memory-type-options" style="padding: 0 16px 20px;">
        <div class="memory-type-item" :class="{ active: currentType === 'round' }" @click="handleSelect('round')">
          <div class="type-name">按轮数</div>
          <div class="type-desc">一问一答算作一轮完整对话。更符合常规聊天的记忆计算方式。</div>
        </div>
        <div class="memory-type-item" :class="{ active: currentType === 'count' }" @click="handleSelect('count')">
          <div class="type-name">按条数</div>
          <div class="type-desc">每一条独立的消息算作一条（包括用户发送和角色回复）。更精确控制上下文长度。</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';
</style>
