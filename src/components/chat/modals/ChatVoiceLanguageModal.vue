/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  visible: boolean
  currentLanguage: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', value: string): void
}>()

const languageSearchQuery = ref('')

const languageOptions = [
  { value: '', label: '自动检测 (Auto)' },
  { value: 'zh', label: '中文 (Chinese)' },
  { value: 'en', label: '英语 (English)' },
  { value: 'ja', label: '日语 (Japanese)' },
  { value: 'ko', label: '韩语 (Korean)' },
  { value: 'fr', label: '法语 (French)' },
  { value: 'de', label: '德语 (German)' },
  { value: 'es', label: '西班牙语 (Spanish)' },
  { value: 'it', label: '意大利语 (Italian)' },
  { value: 'ru', label: '俄语 (Russian)' },
  { value: 'pt', label: '葡萄牙语 (Portuguese)' },
  { value: 'ar', label: '阿拉伯语 (Arabic)' },
  { value: 'hi', label: '印地语 (Hindi)' },
  { value: 'bn', label: '孟加拉语 (Bengali)' },
  { value: 'id', label: '印尼语 (Indonesian)' },
  { value: 'vi', label: '越南语 (Vietnamese)' },
  { value: 'th', label: '泰语 (Thai)' },
  { value: 'tr', label: '土耳其语 (Turkish)' },
  { value: 'fa', label: '波斯语 (Persian)' },
  { value: 'pl', label: '波兰语 (Polish)' },
  { value: 'uk', label: '乌克兰语 (Ukrainian)' },
  { value: 'nl', label: '荷兰语 (Dutch)' },
  { value: 'ro', label: '罗马尼亚语 (Romanian)' },
  { value: 'hu', label: '匈牙利语 (Hungarian)' },
  { value: 'cs', label: '捷克语 (Czech)' },
  { value: 'el', label: '希腊语 (Greek)' },
  { value: 'sv', label: '瑞典语 (Swedish)' },
  { value: 'fi', label: '芬兰语 (Finnish)' },
  { value: 'da', label: '丹麦语 (Danish)' },
  { value: 'no', label: '挪威语 (Norwegian)' },
  { value: 'he', label: '希伯来语 (Hebrew)' },
  { value: 'ms', label: '马来语 (Malay)' },
  { value: 'tl', label: '他加禄语 (Tagalog)' },
  { value: 'ur', label: '乌尔都语 (Urdu)' },
  { value: 'ta', label: '泰米尔语 (Tamil)' },
  { value: 'te', label: '泰卢固语 (Telugu)' },
  { value: 'ml', label: '马拉雅拉姆语 (Malayalam)' },
  { value: 'gu', label: '古吉拉特语 (Gujarati)' },
  { value: 'kn', label: '卡纳达语 (Kannada)' },
  { value: 'mr', label: '马拉地语 (Marathi)' }
]

const filteredLanguageOptions = computed(() => {
  if (!languageSearchQuery.value.trim()) return languageOptions
  const query = languageSearchQuery.value.trim().toLowerCase()
  return languageOptions.filter(opt => 
    opt.label.toLowerCase().includes(query) || 
    opt.value.toLowerCase().includes(query)
  )
})

const close = () => {
  emit('update:visible', false)
}

const handleSelect = (val: string) => {
  emit('select', val)
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10010;" @click.self="close">
    <div class="custom-confirm-modal" style="max-width: 320px; padding-bottom: 20px; max-height: 80vh; display: flex; flex-direction: column;">
      <div class="confirm-title" style="margin-bottom: 12px;">选择发音语言</div>
      <div style="padding: 0 16px; margin-bottom: 12px;">
        <input 
          type="text" 
          v-model="languageSearchQuery" 
          placeholder="搜索语言名称..." 
          style="width: 100%; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; font-size: 14px; background: var(--sys-bg-primary); color: var(--text-primary); box-sizing: border-box; outline: none;"
        />
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 0 16px; display: flex; flex-direction: column; gap: 8px;">
        <div v-if="filteredLanguageOptions.length === 0" style="text-align: center; color: var(--text-secondary); font-size: 13px; padding: 20px 0;">
          未找到相关语言
        </div>
        <div 
          v-else
          v-for="opt in filteredLanguageOptions" 
          :key="opt.value" 
          class="memory-type-item"
          :class="{ active: currentLanguage === opt.value }"
          @click="handleSelect(opt.value)"
          style="margin-bottom: 0;"
        >
          <div class="type-name" style="margin-bottom: 0;">{{ opt.label }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';
</style>
