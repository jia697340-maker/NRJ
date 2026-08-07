<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { chatLanguageOptions } from '../../../constants/chatLanguages'

const props = defineProps<{
  visible: boolean
  kind: 'output' | 'translation'
  currentLanguage: string
  customLanguage?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', payload: { value: string; customLanguage?: string }): void
}>()

const searchQuery = ref('')
const isCustomEditing = ref(false)
const customValue = ref('')

watch(() => props.visible, visible => {
  if (!visible) return
  searchQuery.value = ''
  isCustomEditing.value = props.currentLanguage === 'custom'
  customValue.value = props.customLanguage || ''
})

const title = computed(() => props.kind === 'output' ? '选择角色输出语言' : '选择翻译目标语言')
const specialOptions = computed(() => props.kind === 'output'
  ? [
      { value: 'auto', label: '跟随人设' },
      { value: 'follow_user', label: '跟随用户' }
    ]
  : [
      { value: 'app', label: '跟随应用语言' },
      { value: 'off', label: '不翻译' }
    ])
const allOptions = computed(() => [...specialOptions.value, ...chatLanguageOptions, { value: 'custom', label: '自定义语言' }])
const filteredOptions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return allOptions.value
  return allOptions.value.filter(option => option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query))
})

const close = () => emit('update:visible', false)
const select = (value: string) => {
  if (value === 'custom') {
    isCustomEditing.value = true
    return
  }
  emit('select', { value })
  close()
}
const saveCustom = () => {
  const value = customValue.value.trim()
  if (!value) return
  emit('select', { value: 'custom', customLanguage: value })
  close()
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10010;" @click.self="close">
    <div class="custom-confirm-modal" style="max-width: 320px; padding-bottom: 20px; max-height: 80vh; display: flex; flex-direction: column;">
      <div class="confirm-title" style="margin-bottom: 12px;">{{ title }}</div>

      <template v-if="isCustomEditing">
        <div style="padding: 0 16px; display: flex; flex-direction: column; gap: 12px;">
          <div class="type-desc" style="font-size: 13px; line-height: 1.5;">输入希望角色使用或翻译成的语言、方言或表达体系。</div>
          <input
            v-model="customValue"
            class="language-search-input"
            type="text"
            placeholder="例如：粤语、文言文、拉丁语"
            @keyup.enter="saveCustom"
          />
          <div class="language-actions">
            <div class="action-btn small-action-btn" @click="isCustomEditing = false">返回列表</div>
            <div class="action-btn small-action-btn primary" :class="{ disabled: !customValue.trim() }" @click="saveCustom">保存</div>
          </div>
        </div>
      </template>

      <template v-else>
        <div style="padding: 0 16px; margin-bottom: 12px;">
          <input v-model="searchQuery" class="language-search-input" type="text" placeholder="搜索语言名称..." />
        </div>
        <div style="flex: 1; overflow-y: auto; padding: 0 16px; display: flex; flex-direction: column; gap: 8px;">
          <div v-if="filteredOptions.length === 0" class="language-empty">未找到相关语言</div>
          <div
            v-for="option in filteredOptions"
            v-else
            :key="option.value"
            class="memory-type-item"
            :class="{ active: currentLanguage === option.value }"
            style="margin-bottom: 0;"
            @click="select(option.value)"
          >
            <div class="type-name" style="margin-bottom: 0;">{{ option.label }}</div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';

.language-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  outline: none;
  background: var(--sys-bg-primary);
  color: var(--text-primary);
  font: inherit;
  font-size: 14px;
}

.language-search-input:focus { border-color: var(--theme-color); }
.language-empty { padding: 20px 0; text-align: center; color: var(--text-secondary); font-size: 13px; }
.language-actions { display: flex; gap: 10px; }
.language-actions .action-btn { flex: 1; min-height: 38px; }
.language-actions .primary { background: var(--theme-color); color: #fff; }
.language-actions .disabled { opacity: 0.45; pointer-events: none; }
</style>
