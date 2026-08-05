/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import { globalPromptSettings, type PromptItem } from '../store'

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
    if (await showConfirm('确定要将提示词重置为官方最新默认配置吗？这将会覆盖您修改过的系统同名条目，但会保留您自己新增的条目。')) {
      const { defaultPromptItems } = await import('../store')
      
      const currentItems = [...globalPromptSettings.items]
      const defaultIds = defaultPromptItems.map((i: any) => i.id)
      
      // 留下完全是用户自己添加的条目
      const customItems = currentItems.filter(i => !defaultIds.includes(i.id))
      
      // 把官方最新列表拼在前面，用户的拼接在后面
      globalPromptSettings.items = [...JSON.parse(JSON.stringify(defaultPromptItems)), ...customItems]
      
      await showConfirm('已成功重置为官方最新配置！', '提示', false)
    }
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
    resetPromptItems
  }
}
