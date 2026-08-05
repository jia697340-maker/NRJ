/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import type { WorldBookEntry } from '../../store'

const props = defineProps<{
  activeEntry: WorldBookEntry
}>()

const emit = defineEmits<{
  (e: 'updateEntry'): void
}>()

const handleInput = () => {
  emit('updateEntry')
}
</script>

<template>
  <div class="view editor-form-view">
    <div class="editor-container">
      
      <div class="editor-card">
        <div class="card-header">
          <div class="card-title">标题</div>
        </div>
        <div class="card-body">
          <input 
            v-model="activeEntry.title" 
            class="card-input" 
            placeholder="请输入页面标题..."
            @input="handleInput"
          />
        </div>
      </div>

      <div class="editor-card flex-fill">
        <div class="card-header">
          <div class="card-title">正文内容</div>
        </div>
        <div class="card-body full-height">
          <textarea 
            v-model="activeEntry.content" 
            class="card-textarea" 
            placeholder="开始编写正文..."
            @input="handleInput"
          ></textarea>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.editor-form-view { background: var(--sys-bg-primary); color: var(--text-secondary); padding-top: 56px; }
.app-header:has(~ .app-body .editor-form-view) { background: var(--sys-bg-primary); border-bottom: 1px solid var(--border-color); }
.app-header:has(~ .app-body .editor-form-view) .btn-icon { color: var(--text-tertiary); }
.app-header:has(~ .app-body .editor-form-view) .app-title { color: var(--text-primary); }

.editor-container { padding: 20px 16px; padding-bottom: 80px; max-width: 800px; margin: 0 auto; height: 100%; display: flex; flex-direction: column; gap: 20px; }

.editor-card {
  background: var(--sys-bg-secondary);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
  display: flex; flex-direction: column;
  overflow: hidden;
}

.editor-card.flex-fill { flex: 1; }

.card-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  background: #fdfdfd;
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-secondary);
}

.card-body { padding: 16px; }
.card-body.full-height { flex: 1; display: flex; }

.card-input {
  width: 100%;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
}
.card-input::placeholder { color: var(--text-tertiary); font-weight: 500; }

.card-textarea {
  flex: 1;
  width: 100%;
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-secondary);
  border: none;
  outline: none;
  background: transparent;
  resize: none;
  font-family: inherit;
}
.card-textarea::placeholder { color: var(--text-tertiary); }
</style>
