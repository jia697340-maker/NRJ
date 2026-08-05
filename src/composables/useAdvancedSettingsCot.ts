/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import { cotSettings, type CotItem } from '../store'

export function useAdvancedSettingsCot(showConfirm: (message: string, title?: string, showCancel?: boolean) => Promise<boolean>) {
  const cotModalVisible = ref(false)
  const editingCotItem = ref<CotItem | null>(null)

  // 拖拽排序状态
  const dragIndex = ref<number | null>(null)

  const handleDragStart = (index: number) => {
    dragIndex.value = index
  }

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault() // 必须阻止默认行为才能触发 drop
    if (dragIndex.value === null || dragIndex.value === index) return
    
    const items = cotSettings.items
    const draggedItem = items[dragIndex.value]
    
    // 简单的数组元素交换
    items.splice(dragIndex.value, 1)
    items.splice(index, 0, draggedItem)
    
    dragIndex.value = index // 更新当前拖拽元素的索引
  }

  const handleDragEnd = () => {
    dragIndex.value = null
  }

  const openCotModal = (item?: CotItem) => {
    if (item) {
      editingCotItem.value = JSON.parse(JSON.stringify(item))
    } else {
      editingCotItem.value = {
        id: 'cot_' + Date.now(),
        name: '新思维链条目',
        position: 'system_middle',
        role: 'system',
        content: '',
        enabled: true
      }
    }
    cotModalVisible.value = true
  }

  const saveCotItem = () => {
    if (!editingCotItem.value) return
    const index = cotSettings.items.findIndex(i => i.id === editingCotItem.value!.id)
    if (index > -1) {
      cotSettings.items[index] = editingCotItem.value
    } else {
      cotSettings.items.push(editingCotItem.value)
    }
    cotModalVisible.value = false
  }

  const deleteCotItem = async (id: string) => {
    if (await showConfirm('确定要删除此条目吗？')) {
      cotSettings.items = cotSettings.items.filter(i => i.id !== id)
    }
  }

  return {
    cotModalVisible,
    editingCotItem,
    dragIndex,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    openCotModal,
    saveCotItem,
    deleteCotItem
  }
}
