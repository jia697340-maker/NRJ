/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import { useChatAuth } from './useChatAuth'

export function useChatListGroups(customGroups: any, activeGroup: any, loadCustomContacts: () => void) {
  const { currentChatUserId } = useChatAuth()
  
  const getGroupsKey = () => currentChatUserId.value ? `clingy_chat_groups_${currentChatUserId.value}` : 'clingy_chat_groups'
  const getContactsKey = () => currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'

  const showAddGroupDialog = (showDialog: any) => {
    showDialog({
      title: '新建分组',
      content: '',
      showInput: true,
      inputValue: '',
      inputPlaceholder: '请输入分组名称',
      onConfirm: (val?: string) => {
        const name = val?.trim()
        if (name && !customGroups.value.includes(name) && name !== '全部') {
          customGroups.value.push(name)
          localStorage.setItem(getGroupsKey(), JSON.stringify(customGroups.value))
        }
      }
    })
  }

  const showRenameGroupDialog = (showDialog: any, oldName: string, closeGroupMenu: () => void) => {
    closeGroupMenu()
    showDialog({
      title: '重命名分组',
      content: '',
      showInput: true,
      inputValue: oldName,
      inputPlaceholder: '请输入新分组名称',
      onConfirm: (val?: string) => {
        const newName = val?.trim()
        if (newName && newName !== oldName && !customGroups.value.includes(newName) && newName !== '全部') {
          const idx = customGroups.value.indexOf(oldName)
          if (idx !== -1) {
            customGroups.value[idx] = newName
            localStorage.setItem(getGroupsKey(), JSON.stringify(customGroups.value))
            
            if (activeGroup.value === oldName) {
              activeGroup.value = newName
            }

            const savedStr = localStorage.getItem(getContactsKey())
            if (savedStr) {
              let contacts = JSON.parse(savedStr)
              let updated = false
              contacts.forEach((c: any) => {
                if (c.groups && c.groups.includes(oldName)) {
                  c.groups = c.groups.filter((g: string) => g !== oldName)
                  c.groups.push(newName)
                  updated = true
                }
              })
              if (updated) {
                localStorage.setItem(getContactsKey(), JSON.stringify(contacts))
                loadCustomContacts()
              }
            }
          }
        }
      }
    })
  }

  const deleteGroup = (showDialog: any, group: string, closeGroupMenu: () => void) => {
    closeGroupMenu()
    showDialog({
      title: '删除分组',
      content: `确定要删除分组"${group}"吗？这不会删除分组内的角色。`,
      confirmText: '删除',
      onConfirm: () => {
        customGroups.value = customGroups.value.filter((g: string) => g !== group)
        localStorage.setItem(getGroupsKey(), JSON.stringify(customGroups.value))
        
        if (activeGroup.value === group) {
          activeGroup.value = '全部'
        }

        const savedStr = localStorage.getItem(getContactsKey())
        if (savedStr) {
          let contacts = JSON.parse(savedStr)
          let updated = false
          contacts.forEach((c: any) => {
            if (c.groups && c.groups.includes(group)) {
              c.groups = c.groups.filter((g: string) => g !== group)
              updated = true
            }
          })
          if (updated) {
            localStorage.setItem(getContactsKey(), JSON.stringify(contacts))
            loadCustomContacts()
          }
        }
      }
    })
  }

  const confirmAssignGroups = (selectedGroups: Set<string>, selectedChatIds: Set<string | number>, onSuccess: () => void) => {
    const groupsArray = Array.from(selectedGroups)
    const idsToAssign = Array.from(selectedChatIds)
    
    const savedStr = localStorage.getItem(getContactsKey())
    if (savedStr) {
      let contacts = JSON.parse(savedStr)
      contacts.forEach((c: any) => {
        if (idsToAssign.includes(c.id)) {
          if (!c.groups) c.groups = []
          groupsArray.forEach(g => {
            if (!c.groups.includes(g)) {
              c.groups.push(g)
            }
          })
        }
      })
      localStorage.setItem(getContactsKey(), JSON.stringify(contacts))
      loadCustomContacts()
    }
    
    onSuccess()
  }

  const deleteSelectedGroups = (showDialog: any, selectedManageGroups: Set<string>, onSuccess: () => void) => {
    if (selectedManageGroups.size === 0) return
    showDialog({
      title: '批量删除分组',
      content: `确定要删除选中的 ${selectedManageGroups.size} 个分组吗？角色不会被删除。`,
      confirmText: '删除',
      onConfirm: () => {
        const toDelete = Array.from(selectedManageGroups)
        customGroups.value = customGroups.value.filter((g: string) => !toDelete.includes(g))
        localStorage.setItem(getGroupsKey(), JSON.stringify(customGroups.value))
        
        if (toDelete.includes(activeGroup.value)) {
          activeGroup.value = '全部'
        }

        const savedStr = localStorage.getItem(getContactsKey())
        if (savedStr) {
          let contacts = JSON.parse(savedStr)
          let updated = false
          contacts.forEach((c: any) => {
            if (c.groups) {
              const originalLength = c.groups.length
              c.groups = c.groups.filter((g: string) => !toDelete.includes(g))
              if (c.groups.length !== originalLength) {
                updated = true
              }
            }
          })
          if (updated) {
            localStorage.setItem(getContactsKey(), JSON.stringify(contacts))
            loadCustomContacts()
          }
        }
        onSuccess()
      }
    })
  }

  const mergeSelectedGroups = (showDialog: any, selectedManageGroups: Set<string>, onSuccess: () => void) => {
    if (selectedManageGroups.size < 2) return
    showDialog({
      title: '合并分组',
      content: `将选中的 ${selectedManageGroups.size} 个分组合并为一个新分组。`,
      showInput: true,
      inputValue: '',
      inputPlaceholder: '请输入新分组名称',
      onConfirm: (val?: string) => {
        const newName = val?.trim()
        if (newName) {
          const toMerge = Array.from(selectedManageGroups)
          customGroups.value = customGroups.value.filter((g: string) => !toMerge.includes(g))
          if (!customGroups.value.includes(newName) && newName !== '全部') {
            customGroups.value.push(newName)
          }
          localStorage.setItem(getGroupsKey(), JSON.stringify(customGroups.value))
          
          if (toMerge.includes(activeGroup.value)) {
            activeGroup.value = newName
          }

          const savedStr = localStorage.getItem(getContactsKey())
          if (savedStr) {
            let contacts = JSON.parse(savedStr)
            let updated = false
            contacts.forEach((c: any) => {
              if (c.groups) {
                const hasAnyMergeGroup = toMerge.some(g => c.groups.includes(g))
                if (hasAnyMergeGroup) {
                  c.groups = c.groups.filter((g: string) => !toMerge.includes(g))
                  if (!c.groups.includes(newName)) {
                    c.groups.push(newName)
                  }
                  updated = true
                }
              }
            })
            if (updated) {
              localStorage.setItem(getContactsKey(), JSON.stringify(contacts))
              loadCustomContacts()
            }
          }
          onSuccess()
        }
      }
    })
  }

  return {
    showAddGroupDialog,
    showRenameGroupDialog,
    deleteGroup,
    confirmAssignGroups,
    deleteSelectedGroups,
    mergeSelectedGroups
  }
}
