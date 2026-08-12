/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  initialText?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', text: string): void
}>()

const text = ref('')
const normalizedInitial = computed(() => String(props.initialText || '').trim())
const hasChanged = computed(() => text.value.trim() !== normalizedInitial.value)

watch(() => props.visible, visible => {
  if (visible) text.value = props.initialText || ''
})

const handleSave = () => emit('save', text.value.trim())
</script>

<template>
  <transition name="folder-fade">
    <div v-if="visible" class="folder-modal-overlay" @click="emit('close')" @touchmove.prevent>
      <div class="voice-modal-card" @click.stop>
        <div class="vm-header">
          <h3>填写心声</h3>
        </div>
        <div class="vm-body">
          <textarea
            v-model="text"
            class="vm-textarea"
            maxlength="500"
            placeholder="写下本轮没有直接说出口的想法…"
          ></textarea>
          <div class="thought-hint">
            <span>只会随下一次回复请求发送给角色</span>
            <span>{{ text.length }} / 500</span>
          </div>
        </div>
        <div class="vm-footer">
          <button class="vm-btn cancel" type="button" @click="emit('close')">取消</button>
          <button class="vm-btn send" type="button" :disabled="!hasChanged" @click="handleSave">
            {{ normalizedInitial && !text.trim() ? '清空心声' : '保存到本轮' }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.folder-modal-overlay{position:fixed;inset:0;background-color:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
.voice-modal-card{width:280px;background:var(--sys-bg-primary,#fff);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.15)}
.is-dark .voice-modal-card{background:var(--sys-bg-primary,#2c2c2c)}
.vm-header{padding:16px 20px;border-bottom:1px solid var(--border-color,rgba(0,0,0,.05))}
.vm-header h3{margin:0;color:var(--text-primary,#333);font-size:16px;text-align:center}
.vm-body{padding:20px;display:flex;flex-direction:column;gap:10px}
.vm-textarea{width:100%;height:112px;padding:12px;border:1px solid var(--border-color,rgba(0,0,0,.1));border-radius:8px;outline:none;background:var(--sys-bg-secondary,#f5f5f5);color:var(--text-primary,#333);font:inherit;font-size:14px;line-height:1.55;resize:none;box-sizing:border-box;transition:border-color .2s ease}
.vm-textarea:focus{border-color:#1976d2}
.is-dark .vm-textarea{background:rgba(0,0,0,.2)}
.thought-hint{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--text-secondary,#666);font-size:11px;line-height:1.4}
.thought-hint span:first-child{min-width:0}
.thought-hint span:last-child{flex:none}
.vm-footer{display:flex;border-top:1px solid var(--border-color,rgba(0,0,0,.05))}
.vm-btn{flex:1;height:44px;padding:0 8px;border:0;background:transparent;font:inherit;font-size:15px;font-weight:500;cursor:pointer}
.vm-btn.cancel{border-right:1px solid var(--border-color,rgba(0,0,0,.05));color:var(--text-secondary,#666)}
.vm-btn.send{color:#1976d2}
.vm-btn:disabled{opacity:.4;pointer-events:none}
.folder-fade-enter-active,.folder-fade-leave-active{transition:opacity .3s ease}
.folder-fade-enter-active .voice-modal-card{animation:folderPopIn .3s cubic-bezier(.175,.885,.32,1.1)}
.folder-fade-leave-active .voice-modal-card{animation:folderPopOut .2s ease forwards}
.folder-fade-enter-from,.folder-fade-leave-to{opacity:0}
@keyframes folderPopIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
@keyframes folderPopOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.95)}}
</style>
