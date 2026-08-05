/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps<{
  modelValue: string | number
  options: { value: string | number, label: string }[]
  placeholder?: string
  disabled?: boolean
  currentStyle?: string
  isDark?: boolean
  classicTheme?: string
}>()

const emit = defineEmits(['update:modelValue', 'change'])

const isOpen = ref(false)
const searchQuery = ref('')
const dropdownRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const selectedLabel = computed(() => {
  const selected = props.options.find(opt => opt.value === props.modelValue)
  return selected ? selected.label : props.placeholder || '请选择'
})

const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options
  const lowerQuery = searchQuery.value.toLowerCase()
  return props.options.filter(opt => opt.label.toString().toLowerCase().includes(lowerQuery))
})

const toggleDropdown = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    searchQuery.value = ''
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
}

const selectOption = (value: string | number) => {
  emit('update:modelValue', value)
  emit('change', value)
  isOpen.value = false
}

const handleClickOutside = (e: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div 
    class="searchable-select" 
    :class="[currentStyle, { 'is-dark': isDark, 'is-open': isOpen, 'is-disabled': disabled }, currentStyle === 'classic_ios' && classicTheme ? 'theme-' + classicTheme : '']"
    ref="dropdownRef"
  >
    <div class="select-trigger" @click="toggleDropdown">
      <span class="selected-text">{{ selectedLabel }}</span>
      <svg class="chevron" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </div>
    
    <Transition name="dropdown-fade">
      <div class="select-dropdown" v-show="isOpen">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            class="search-input" 
            v-model="searchQuery" 
            placeholder="搜索..." 
            ref="searchInputRef"
          />
        </div>
        <div class="options-list">
          <div class="no-data" v-if="filteredOptions.length === 0">无匹配项</div>
          <div 
            v-for="opt in filteredOptions" 
            :key="opt.value"
            class="option-item"
            :class="{ 'is-selected': opt.value === modelValue }"
            @click="selectOption(opt.value)"
          >
            {{ opt.label }}
            <svg v-if="opt.value === modelValue" class="check-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Base */
.searchable-select {
  position: relative;
  width: 100%;
}
.select-trigger {
  width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--sys-bg-secondary);
  font-size: 15px; box-sizing: border-box; cursor: pointer;
  display: flex; justify-content: space-between; align-items: center;
  color: inherit;
}
.select-trigger.is-disabled {
  opacity: 0.6; cursor: not-allowed; background: #f2f2f7;
}
.selected-text {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; text-align: left;
}
.chevron {
  flex-shrink: 0; margin-left: 8px; color: #c7c7cc; transition: transform 0.2s;
}
.is-open .chevron { transform: rotate(180deg); }

.select-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; width: 100%;
  z-index: 1000; background: var(--sys-bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: flex; flex-direction: column;
  max-height: 250px; overflow: hidden;
}
.search-wrap {
  padding: 8px 12px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 8px;
  position: sticky; top: 0; background: var(--sys-bg-secondary); z-index: 2;
}
.search-icon { color: var(--text-tertiary); flex-shrink: 0; }
.search-input {
  border: none; background: transparent; outline: none; width: 100%; font-size: 14px; color: inherit;
}
.options-list {
  overflow-y: auto; flex: 1;
}
.option-item {
  padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;
  cursor: pointer; font-size: 14px;
}
.option-item:hover { background: #f2f2f7; }
.option-item.is-selected { color: #007aff; font-weight: 500; }
.no-data { padding: 12px; text-align: center; color: var(--text-tertiary); font-size: 14px; }

/* Transitions */
.dropdown-fade-enter-active, .dropdown-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.dropdown-fade-enter-from, .dropdown-fade-leave-to { opacity: 0; transform: translateY(-5px); }

/* ========== THEMES ========== */
/* INS */
.ins .select-trigger { border-color: #dbdbdb; background: var(--sys-bg-primary); }
.ins.is-dark .select-trigger { border-color: #363636; background: #1a1a1a; color: #fff; }
.ins .select-dropdown { border-color: #dbdbdb; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.ins.is-dark .select-dropdown { background: #1a1a1a; border-color: #363636; }
.ins .search-wrap { border-bottom-color: #efefef; }
.ins.is-dark .search-wrap { background: #1a1a1a; border-bottom-color: #363636; }
.ins .option-item:hover { background: #efefef; }
.ins.is-dark .option-item:hover { background: #262626; }
.ins .option-item.is-selected { color: #262626; font-weight: 600; }
.ins.is-dark .option-item.is-selected { color: #fff; }

/* Modern iOS */
.modern_ios .select-trigger { border: none; background: #e3e3e8; border-radius: 8px; }
.modern_ios.is-dark .select-trigger { background: #2c2c2e; color: #fff; }
.modern_ios .select-dropdown { background: rgba(255,255,255,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: none; box-shadow: 0 8px 24px rgba(0,0,0,0.12); border-radius: 12px; }
.modern_ios.is-dark .select-dropdown { background: rgba(28,28,30,0.85); box-shadow: 0 8px 24px rgba(0,0,0,0.3); color: #fff; }
.modern_ios .search-wrap { background: transparent; border-bottom: 0.5px solid #c6c6c8; }
.modern_ios.is-dark .search-wrap { border-bottom-color: #38383a; }
.modern_ios .option-item { border-bottom: 0.5px solid #c6c6c8; padding: 12px; }
.modern_ios.is-dark .option-item { border-bottom-color: #38383a; }
.modern_ios .option-item:last-child { border-bottom: none; }
.modern_ios .option-item:hover { background: rgba(0,0,0,0.05); }
.modern_ios.is-dark .option-item:hover { background: rgba(255,255,255,0.1); }
.modern_ios .option-item.is-selected { color: #007aff; }
.modern_ios.is-dark .option-item.is-selected { color: #0a84ff; }

/* Minimalist */
.minimalist .select-trigger { border: 2px solid var(--border-color); border-radius: 0; background: transparent; padding: 14px; }
.minimalist.is-dark .select-trigger { border-color: var(--text-primary); color: #fff; }
.minimalist.is-open .select-trigger { border-color: var(--text-primary); }
.minimalist.is-dark.is-open .select-trigger { border-color: #fff; }
.minimalist .select-dropdown { border: 2px solid #111; border-radius: 0; box-shadow: 4px 4px 0 #111; margin-top: 4px; }
.minimalist.is-dark .select-dropdown { background: #000; border-color: #fff; box-shadow: 4px 4px 0 #fff; color: #fff; }
.minimalist .search-wrap { border-bottom: 2px solid var(--border-color); background: var(--sys-bg-secondary); }
.minimalist.is-dark .search-wrap { background: #000; border-bottom-color: var(--text-primary); }
.minimalist .option-item { padding: 12px; font-weight: 500; }
.minimalist .option-item:hover { background: var(--sys-bg-primary); }
.minimalist.is-dark .option-item:hover { background: #111; }
.minimalist .option-item.is-selected { background: #111; color: #fff; }
.minimalist.is-dark .option-item.is-selected { background: var(--sys-bg-secondary); color: var(--text-primary); }

/* Classic iOS */
.classic_ios .select-trigger {
  border: 1px solid #a6a6a6; border-radius: 6px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
  background: linear-gradient(180deg, #e6e6e6 0%, #fff 20%, #fff 100%);
}
.classic_ios.is-dark .select-trigger { background: #22313f; border-color: #162029; color: #fff; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); }
.classic_ios .select-dropdown {
  background: #e6e6e6; border: 1px solid #a6a6a6; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.classic_ios.is-dark .select-dropdown { background: #2c3e50; border-color: #162029; color: #fff; }
.classic_ios .search-wrap {
  background: linear-gradient(180deg, #d8d8d8 0%, #c8c8c8 100%); border-bottom: 1px solid #a6a6a6;
}
.classic_ios.is-dark .search-wrap { background: linear-gradient(180deg, #34495e 0%, #2c3e50 100%); border-bottom-color: #1a252f; }
.classic_ios .search-input { background: var(--sys-bg-secondary); padding: 4px 8px; border-radius: 12px; border: 1px solid #a6a6a6; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1); }
.classic_ios.is-dark .search-input { background: #1a252f; border-color: #162029; color: #fff; }
.classic_ios .option-item { border-bottom: 1px solid #d4d4d4; background: var(--sys-bg-secondary); }
.classic_ios.is-dark .option-item { background: #34495e; border-bottom-color: #22313f; }
.classic_ios .option-item:hover { background: #3786de; color: #fff; }
.classic_ios.is-dark .option-item:hover { background: #4b6b8f; color: #fff; }
.classic_ios .option-item.is-selected { background: #3786de; color: #fff; }
.classic_ios.is-dark .option-item.is-selected { background: #4b6b8f; color: #fff; }
</style>
