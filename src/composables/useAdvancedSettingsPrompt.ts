/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import {
  getDefaultPromptItemsByPreset,
  globalPromptSettings,
  systemPromptItemIds,
  type PromptItem,
  type PromptPresetId
} from '../store'

export function useAdvancedSettingsPrompt(showConfirm: (message: string, title?: string, showCancel?: boolean) => Promise<boolean>) {
  const promptModalVisible = ref(false)
  const editingPromptItem = ref<PromptItem | null>(null)
  const dragPromptIndex = ref<number | null>(null)

  const handlePromptDragStart = (index: number) => {
    dragPromptIndex.value = index
  }

  const handlePromptDragOver = (e: DragEvent, index: number) => {
    e.preventDefault()
    if (dragPromptIndex.value === null || dragPromptIndex.value === index) return
    
    const items = globalPromptSettings.items
    const draggedItem = items[dragPromptIndex.value]
    
    items.splice(dragPromptIndex.value, 1)
    items.splice(index, 0, draggedItem)
    
    dragPromptIndex.value = index
  }

  const handlePromptDragEnd = () => {
    dragPromptIndex.value = null
  }

  const openPromptModal = (item?: PromptItem) => {
    if (item) {
      editingPromptItem.value = JSON.parse(JSON.stringify(item))
    } else {
      editingPromptItem.value = {
        id: 'prompt_' + Date.now(),
        name: '新提示词条目',
        content: '',
        enabled: true
      }
    }
    promptModalVisible.value = true
  }

  const savePromptItem = () => {
    if (!editingPromptItem.value) return
    const index = globalPromptSettings.items.findIndex(i => i.id === editingPromptItem.value!.id)
    if (index > -1) {
      globalPromptSettings.items[index] = editingPromptItem.value
    } else {
      globalPromptSettings.items.push(editingPromptItem.value)
    }
    promptModalVisible.value = false
  }

  const deletePromptItem = async (id: string) => {
    if (await showConfirm('确定要删除此条目吗？')) {
      globalPromptSettings.items = globalPromptSettings.items.filter(i => i.id !== id)
    }
  }

  const resetPromptItems = async () => {
    if (await showConfirm(`确定要将当前${globalPromptSettings.activePresetId === 'v2' ? '版本2' : '版本1'}重置为默认配置吗？这将覆盖系统条目的修改，但会保留您自己新增的条目。`)) {
      const currentItems = [...globalPromptSettings.items]
      const customItems = currentItems.filter(item => !systemPromptItemIds.has(item.id))
      globalPromptSettings.items = [
        ...getDefaultPromptItemsByPreset(globalPromptSettings.activePresetId),
        ...customItems
      ]
      
      await showConfirm('已成功重置当前版本的默认配置！', '提示', false)
    }
  }

  const switchPromptPreset = async (presetId: PromptPresetId) => {
    if (presetId === globalPromptSettings.activePresetId) return

    const targetName = presetId === 'v2' ? '版本2' : '版本1'
    const confirmed = await showConfirm(
      `确定切换到${targetName}吗？\n\n切换会载入该版本的系统提示词，并覆盖您对系统条目的修改；自己新增的条目会保留。`,
      '切换提示词版本'
    )
    if (!confirmed) return

    const customItems = globalPromptSettings.items.filter(item => !systemPromptItemIds.has(item.id))
    globalPromptSettings.items = [
      ...getDefaultPromptItemsByPreset(presetId),
      ...customItems
    ]
    globalPromptSettings.activePresetId = presetId
  }

  return {
    promptModalVisible,
    editingPromptItem,
    dragPromptIndex,
    handlePromptDragStart,
    handlePromptDragOver,
    handlePromptDragEnd,
    openPromptModal,
    savePromptItem,
    deletePromptItem,
    resetPromptItems,
    switchPromptPreset
  }
}
