/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed } from 'vue'
import { worldBooks, worldBookGroups } from '../store'
import type { WorldBookGroup } from '../store'

export function useWorldBookGroups(
  activeGroupId: { value: string },
  showConfirm: (msg: string, cb: () => void) => void
) {
  const groupManageModal = ref({
    show: false,
    newGroupName: '',
    editGroupId: null as string | null,
    editGroupName: '',
    isManageMode: false,
    selectedGroups: new Set<string>()
  })

  const openGroupManager = () => {
    groupManageModal.value.show = true
    groupManageModal.value.newGroupName = ''
    groupManageModal.value.editGroupId = null
    groupManageModal.value.isManageMode = false
    groupManageModal.value.selectedGroups.clear()
  }

  const toggleGroupManageMode = () => {
    groupManageModal.value.isManageMode = !groupManageModal.value.isManageMode
    if (!groupManageModal.value.isManageMode) {
      groupManageModal.value.selectedGroups.clear()
    }
  }

  const toggleGroupSelect = (id: string) => {
    if (groupManageModal.value.selectedGroups.has(id)) {
      groupManageModal.value.selectedGroups.delete(id)
    } else {
      groupManageModal.value.selectedGroups.add(id)
    }
  }

  const isAllGroupsSelected = computed(() => {
    if (worldBookGroups.length === 0) return false
    return groupManageModal.value.selectedGroups.size === worldBookGroups.length
  })

  const toggleSelectAllGroups = () => {
    if (isAllGroupsSelected.value) {
      groupManageModal.value.selectedGroups.clear()
    } else {
      worldBookGroups.forEach(g => groupManageModal.value.selectedGroups.add(g.id))
    }
  }

  const deleteSelectedGroups = () => {
    if (groupManageModal.value.selectedGroups.size === 0) return
    showConfirm(`确认删除选中的 ${groupManageModal.value.selectedGroups.size} 个分组吗？书籍不会被删除。`, () => {
      for (let i = worldBookGroups.length - 1; i >= 0; i--) {
        if (groupManageModal.value.selectedGroups.has(worldBookGroups[i].id)) {
          worldBookGroups.splice(i, 1)
        }
      }
      
      worldBooks.forEach(b => {
        if (b.groupIds) {
          b.groupIds = b.groupIds.filter(gid => !groupManageModal.value.selectedGroups.has(gid))
        }
      })
      
      if (activeGroupId.value !== 'all' && groupManageModal.value.selectedGroups.has(activeGroupId.value)) {
        activeGroupId.value = 'all'
      }
      
      groupManageModal.value.selectedGroups.clear()
      groupManageModal.value.isManageMode = false
    })
  }

  const addGroup = () => {
    const name = groupManageModal.value.newGroupName.trim()
    if (!name) return
    worldBookGroups.push({
      id: Date.now().toString() + '_grp',
      name
    })
    groupManageModal.value.newGroupName = ''
  }

  const startEditGroup = (group: WorldBookGroup) => {
    groupManageModal.value.editGroupId = group.id
    groupManageModal.value.editGroupName = group.name
  }

  const saveEditGroup = () => {
    const name = groupManageModal.value.editGroupName.trim()
    if (!name || !groupManageModal.value.editGroupId) return
    const g = worldBookGroups.find(g => g.id === groupManageModal.value.editGroupId)
    if (g) g.name = name
    groupManageModal.value.editGroupId = null
  }

  const deleteGroup = (id: string) => {
    showConfirm('确认删除这个分组吗？书籍不会被删除。', () => {
      const index = worldBookGroups.findIndex(g => g.id === id)
      if (index !== -1) {
        worldBookGroups.splice(index, 1)
        // 清理绑定了此分组的书籍
        worldBooks.forEach(b => {
          if (b.groupIds) {
            b.groupIds = b.groupIds.filter(gid => gid !== id)
          }
        })
        if (activeGroupId.value === id) {
          activeGroupId.value = 'all'
        }
      }
    })
  }

  return {
    groupManageModal,
    isAllGroupsSelected,
    openGroupManager,
    toggleGroupManageMode,
    toggleGroupSelect,
    toggleSelectAllGroups,
    deleteSelectedGroups,
    addGroup,
    startEditGroup,
    saveEditGroup,
    deleteGroup
  }
}
