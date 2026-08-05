/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed } from 'vue'

export function useChatMessageSelection() {
  const selectionMode = ref<'general' | 'recall' | 'mark' | null>(null)
  const isMultiSelectMode = computed(() => selectionMode.value === 'general')
  const isRecallMultiSelectMode = computed(() => selectionMode.value === 'recall')
  const selectedMessageIds = ref<Set<number>>(new Set())

  const enterMultiSelectMode = (mode: 'general' | 'recall' | 'mark' = 'general', initialMessageId?: number) => {
    selectionMode.value = mode
    selectedMessageIds.value.clear()
    if (initialMessageId !== undefined) {
      selectedMessageIds.value.add(initialMessageId)
    }
  }

  const exitMultiSelectMode = () => {
    selectionMode.value = null
    selectedMessageIds.value.clear()
  }

  const toggleMessageSelection = (messageId: number) => {
    if (selectedMessageIds.value.has(messageId)) {
      selectedMessageIds.value.delete(messageId)
    } else {
      selectedMessageIds.value.add(messageId)
    }
  }

  const isSelected = (messageId: number) => {
    return selectedMessageIds.value.has(messageId)
  }

  const selectAll = (messages: any[]) => {
    let validMessages: any[] = []
    if (selectionMode.value === 'general' || selectionMode.value === 'mark') {
      validMessages = messages.filter(m => m.type === 'left' || m.type === 'right')
    } else if (selectionMode.value === 'recall') {
      const now = Date.now()
      validMessages = messages.filter(m => m.type === 'right' && !m.isRecalled && (now - m.id <= 300000))
    }

    if (selectedMessageIds.value.size === validMessages.length && validMessages.length > 0) {
      // If already all selected, clear selection
      selectedMessageIds.value.clear()
    } else {
      validMessages.forEach(m => selectedMessageIds.value.add(m.id))
    }
  }

  const getSelectedCount = computed(() => selectedMessageIds.value.size)

  return {
    selectionMode,
    isMultiSelectMode,
    isRecallMultiSelectMode,
    selectedMessageIds,
    enterMultiSelectMode,
    exitMultiSelectMode,
    toggleMessageSelection,
    isSelected,
    selectAll,
    getSelectedCount
  }
}
