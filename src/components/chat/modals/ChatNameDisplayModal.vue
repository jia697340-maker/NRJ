/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { chatSettings } from '../../../store'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', style: 'all' | 'user_only' | 'character_only' | 'none'): void
}>()

const handleSelect = (style: 'all' | 'user_only' | 'character_only' | 'none') => {
  emit('save', style)
  emit('update:visible', false)
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10000;" @click.self="emit('update:visible', false)">
    <div class="custom-confirm-modal" style="max-width: 340px;">
      <div class="confirm-title" style="margin-bottom: 16px;">选择对话昵称显示方式</div>
      <div class="memory-type-options" style="padding: 0 16px 20px;">
        <div class="memory-type-item" :class="{ active: chatSettings.nameDisplayStyle === 'all' || !chatSettings.nameDisplayStyle }" @click="handleSelect('all')">
          <div class="type-name">都显示双方昵称</div>
          <div class="type-desc">所有消息上方都会显示昵称装饰。</div>
        </div>
        <div class="memory-type-item" :class="{ active: chatSettings.nameDisplayStyle === 'user_only' }" @click="handleSelect('user_only')">
          <div class="type-name">只显示用户昵称</div>
          <div class="type-desc">界面中仅显示用户的昵称，隐藏角色的昵称。</div>
        </div>
        <div class="memory-type-item" :class="{ active: chatSettings.nameDisplayStyle === 'character_only' }" @click="handleSelect('character_only')">
          <div class="type-name">只显示角色昵称</div>
          <div class="type-desc">界面中仅显示角色的昵称，隐藏用户的昵称。</div>
        </div>
        <div class="memory-type-item" :class="{ active: chatSettings.nameDisplayStyle === 'none' }" @click="handleSelect('none')">
          <div class="type-name">不显示双方昵称</div>
          <div class="type-desc">隐藏双方的所有昵称显示。</div>
        </div>
      </div>
      <div class="confirm-actions">
        <div class="confirm-btn cancel" style="width: 100%; border-right: none;" @click="emit('update:visible', false)">取消</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wb-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-confirm-modal {
  background: var(--sys-bg-secondary);
  width: 80%;
  max-width: 320px;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  animation: modalScaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modalScaleIn {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.confirm-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  margin-top: 24px;
}

.confirm-actions {
  display: flex;
  border-top: 1px solid var(--border-color);
}

.confirm-btn {
  flex: 1;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
  color: var(--text-primary);
}

.confirm-btn:active {
  background: var(--sys-bg-primary);
}

.memory-type-item {
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}
.memory-type-item:last-child {
  margin-bottom: 0;
}
.memory-type-item.active {
  border-color: var(--text-primary);
  background: rgba(0,0,0,0.03);
}
.is-dark .memory-type-item.active {
  background: rgba(255,255,255,0.05);
}
.type-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.type-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}
</style>
