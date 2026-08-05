/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed } from 'vue'

export function useChatListMultiSelect(mockChats: any, deleteChats: (ids: any[]) => Promise<void>) {
  const isMultiSelectMode = ref(false)
  const selectedChatIds = ref<Set<string | number>>(new Set())

  const enterMultiSelectMode = (initialChatId?: string | number) => {
    isMultiSelectMode.value = true
    selectedChatIds.value.clear()
    if (initialChatId !== undefined) {
      selectedChatIds.value.add(initialChatId)
    }
  }

  const exitMultiSelectMode = () => {
    isMultiSelectMode.value = false
    selectedChatIds.value.clear()
  }

  const toggleSelectChat = (id: string | number) => {
    const newSet = new Set(selectedChatIds.value)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    selectedChatIds.value = newSet
  }

  const toggleSelectAll = (allVisibleChats: any[]) => {
    if (selectedChatIds.value.size === allVisibleChats.length) {
      selectedChatIds.value.clear()
    } else {
      selectedChatIds.value = new Set(allVisibleChats.map(c => c.id))
    }
  }

  const deleteSelectedChats = async (showDialog: any) => {
    if (selectedChatIds.value.size === 0) return
    showDialog({
      title: '批量删除',
      content: '确定要删除选中的角色吗？（系统通知将保留）',
      confirmText: '删除',
      onConfirm: async () => {
        await deleteChats(Array.from(selectedChatIds.value))
        exitMultiSelectMode()
      }
    })
  }

  return {
    isMultiSelectMode,
    selectedChatIds,
    enterMultiSelectMode,
    exitMultiSelectMode,
    toggleSelectChat,
    toggleSelectAll,
    deleteSelectedChats
  }
}
