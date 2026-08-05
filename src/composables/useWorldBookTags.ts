/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import type { WorldBook } from '../store'

export function useWorldBookTags(showConfirm: (msg: string, cb: () => void) => void) {
  const tagModal = ref({
    show: false,
    newTagsInput: '',
    selectedIndices: new Set<number>(),
    errorMsg: ''
  })

  const openTagManager = () => {
    tagModal.value.show = true
    tagModal.value.newTagsInput = ''
    tagModal.value.selectedIndices.clear()
    tagModal.value.errorMsg = ''
  }

  const toggleTagSelect = (index: number) => {
    if (tagModal.value.selectedIndices.has(index)) {
      tagModal.value.selectedIndices.delete(index)
    } else {
      tagModal.value.selectedIndices.add(index)
    }
  }

  const addTags = (activeBook: WorldBook | null) => {
    if (!activeBook || !tagModal.value.newTagsInput.trim()) return
    if (!activeBook.tags) activeBook.tags = []
    
    tagModal.value.errorMsg = ''
    
    // 按逗号或空格分割
    const rawTags = tagModal.value.newTagsInput.split(/[,，\s]+/)
    let added = false
    let hasDuplicate = false
    
    for (const t of rawTags) {
      const clean = t.trim()
      if (clean) {
        if (!activeBook.tags.includes(clean)) {
          activeBook.tags.push(clean)
          added = true
        } else {
          hasDuplicate = true
        }
      }
    }
    
    if (added) {
      activeBook.updatedAt = Date.now()
      tagModal.value.newTagsInput = ''
    } else if (hasDuplicate) {
      tagModal.value.errorMsg = '存在已添加的标签，已被过滤'
    }
  }

  const deleteSelectedTags = (activeBook: WorldBook | null) => {
    if (!activeBook || !activeBook.tags) return
    const indices = Array.from(tagModal.value.selectedIndices).sort((a, b) => b - a)
    for (const i of indices) {
      activeBook.tags.splice(i, 1)
    }
    activeBook.updatedAt = Date.now()
    tagModal.value.selectedIndices.clear()
  }

  const clearAllTags = (activeBook: WorldBook | null) => {
    if (!activeBook) return
    showConfirm('确定要清空所有标签吗？', () => {
      activeBook.tags = []
      activeBook.updatedAt = Date.now()
      tagModal.value.selectedIndices.clear()
    })
  }

  return {
    tagModal,
    openTagManager,
    toggleTagSelect,
    addTags,
    deleteSelectedTags,
    clearAllTags
  }
}
