/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import localforage from 'localforage'
import AvatarUploadModal from './AvatarUploadModal.vue'
import PersonaImportModal from './PersonaImportModal.vue'
import ProfileView from './profile/ProfileView.vue'
import CreatePersonaView from './profile/CreatePersonaView.vue'
import PersonaLibraryView from './profile/PersonaLibraryView.vue'
import ChatAppearanceView from './profile/ChatAppearanceView.vue'
import NotificationSettingsView from './profile/NotificationSettingsView.vue'
import { useChatAuth } from '../composables/useChatAuth'

const props = defineProps<{
  currentView: 'profile' | 'createUserPersona' | 'personaLibrary' | 'chatAppearance' | 'notificationSettings'
}>()

const emit = defineEmits<{
  (e: 'update:currentView', view: 'profile' | 'createUserPersona' | 'personaLibrary' | 'chatAppearance' | 'notificationSettings' | 'list' | 'discover' | 'contacts' | 'chat'): void
}>()

const { currentChatUserId, logout } = useChatAuth()

const getKey = (base: string) => currentChatUserId.value ? `${base}_${currentChatUserId.value}` : base

const handleLogout = () => {
  logout()
}

const defaultPersonas = [
  { 
    id: 1, 
    name: '你的名字', 
    signature: '',
    customText: '点击设置自定义文案...',
    mood: '',
    isCreate: false 
  },
  { 
    id: 2, 
    name: '', 
    signature: '',
    customText: '',
    mood: '',
    isCreate: true 
  }
]

const personas = ref([...defaultPersonas])
const activePersonaIndex = ref(0)

interface PersonaGroup {
  id: string
  name: string
  personaIds: number[]
}
const personaGroups = ref<PersonaGroup[]>([])
const activeGroupId = ref<string | null>(null)

const avatarStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'avatars'
})

const syncPersonasToStorage = () => {
  localStorage.setItem(getKey('app_chat_personas'), JSON.stringify(personas.value))
}

onMounted(() => {
  const saved = localStorage.getItem(getKey('app_chat_personas'))
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        let loadedPersonas = parsed

        // 排序逻辑：将当前账号绑定的人设前置到第一位，新建占位符置底
        if (currentChatUserId.value) {
          const bound = loadedPersonas.filter((p: any) => p.boundAccountId === currentChatUserId.value && !p.isCreate)
          const normal = loadedPersonas.filter((p: any) => p.boundAccountId !== currentChatUserId.value && !p.isCreate)
          const creates = loadedPersonas.filter((p: any) => p.isCreate)
          loadedPersonas = [...bound, ...normal, ...creates]
        }

        personas.value = loadedPersonas

        // 同步继承的账号头像
        loadedPersonas.forEach((p: any) => {
          if (p.boundAccountId === currentChatUserId.value) {
            updateAccount(currentChatUserId.value, {
              avatarUrl: p.avatar || ''
            })
          }
        })
      }
    } catch (e) {}
  } else {
    // 初次进入，没有任何本地人设缓存，强制继承全局注册账号的信息
    const globalAccount = useChatAuth().currentAccount.value
    if (globalAccount) {
      personas.value[0].networkName = globalAccount.name || ''
      personas.value[0].avatar = globalAccount.avatarUrl || ''
      // 这里不覆盖 name（真名），保留默认的“你的名字”或为空，严格区分网名与真名
      personas.value[0].boundAccountId = currentChatUserId.value
      syncPersonasToStorage()
    }
  }
  
  const savedIndex = localStorage.getItem(getKey('app_chat_active_persona_index'))
  if (savedIndex !== null) {
    const idx = parseInt(savedIndex, 10)
    if (idx >= 0 && idx < personas.value.length) {
      activePersonaIndex.value = idx
    }
  }

  // 如果存在绑定人设，并且排在第一位，则默认展示第一位
  if (currentChatUserId.value && personas.value[0]?.boundAccountId === currentChatUserId.value) {
    activePersonaIndex.value = 0
  }

  const savedGroups = localStorage.getItem(getKey('app_chat_persona_groups'))
  if (savedGroups) {
    try {
      personaGroups.value = JSON.parse(savedGroups)
    } catch (e) {}
  }
  const savedGroupId = localStorage.getItem(getKey('app_chat_active_group_id'))
  if (savedGroupId && savedGroupId !== 'null') {
    activeGroupId.value = savedGroupId
  }
})

watch(personas, () => {
  syncPersonasToStorage()
}, { deep: true })

watch(activePersonaIndex, (newVal) => {
  localStorage.setItem(getKey('app_chat_active_persona_index'), newVal.toString())
})

watch(personaGroups, (newVal) => {
  localStorage.setItem(getKey('app_chat_persona_groups'), JSON.stringify(newVal))
}, { deep: true })

watch(activeGroupId, (newVal) => {
  localStorage.setItem(getKey('app_chat_active_group_id'), newVal === null ? 'null' : newVal)
})

const activePersona = computed(() => personas.value[activePersonaIndex.value] || personas.value[0])

const prevPersona = () => {
  if (activePersonaIndex.value > 0) {
    activePersonaIndex.value--
  }
}

const nextPersona = () => {
  if (activePersonaIndex.value < personas.value.length - 1) {
    activePersonaIndex.value++
  }
}

// 新建用户人设表单状态
const newUserId = ref('')
const newNetworkName = ref('')
const newUserAvatar = ref('')
const newUserName = ref('')
const newUserDetail = ref('')
const uploadModalVisible = ref(false)
const importModalVisible = ref(false)
const importModalMode = ref<'card'|'doc'>('card')
const createActionSheetVisible = ref(false)

// 自定义文案编辑状态
const customTextModalVisible = ref(false)
const tempCustomText = ref('')

const openCustomTextEdit = () => {
  if (activePersona.value.isCreate) return
  tempCustomText.value = activePersona.value.customText || ''
  customTextModalVisible.value = true
}

const saveCustomText = () => {
  if (!activePersona.value.isCreate) {
    activePersona.value.customText = tempCustomText.value
  }
  customTextModalVisible.value = false
}

const closeCustomTextEdit = () => {
  customTextModalVisible.value = false
}

// 人设库状态
const isPersonaManageMode = ref(false)
const selectedPersonaIds = ref<number[]>([])
const editingPersonaId = ref<number | null>(null)

const togglePersonaManageMode = () => {
  isPersonaManageMode.value = !isPersonaManageMode.value
  selectedPersonaIds.value = []
}

const toggleSelectPersona = (id: number) => {
  const index = selectedPersonaIds.value.indexOf(id)
  if (index > -1) {
    selectedPersonaIds.value.splice(index, 1)
  } else {
    selectedPersonaIds.value.push(id)
  }
}

const validPersonas = computed(() => {
  let list = personas.value.filter(p => !p.isCreate)
  if (activeGroupId.value !== null) {
    const group = personaGroups.value.find(g => g.id === activeGroupId.value)
    if (group) {
      list = list.filter(p => group.personaIds.includes(p.id))
    }
  }
  return list
})

const isAllPersonasSelected = computed(() => {
  return validPersonas.value.length > 0 && selectedPersonaIds.value.length === validPersonas.value.length
})

const toggleSelectAllPersonas = () => {
  if (isAllPersonasSelected.value) {
    selectedPersonaIds.value = []
  } else {
    selectedPersonaIds.value = validPersonas.value.map(p => p.id)
  }
}

const deleteSelectedPersonas = () => {
  if (selectedPersonaIds.value.length === 0) return
  personas.value = personas.value.filter(p => p.isCreate || !selectedPersonaIds.value.includes(p.id))
  
  personaGroups.value.forEach(group => {
    group.personaIds = group.personaIds.filter(id => !selectedPersonaIds.value.includes(id))
  })

  selectedPersonaIds.value = []
  isPersonaManageMode.value = false
  if (activePersonaIndex.value >= personas.value.length - 1) {
    activePersonaIndex.value = Math.max(0, personas.value.length - 2)
  }
}

// 分组相关逻辑
const createGroupModalVisible = ref(false)
const newGroupName = ref('')

const openCreateGroupModal = () => {
  newGroupName.value = ''
  createGroupModalVisible.value = true
}

const confirmCreateGroup = () => {
  if (!newGroupName.value.trim()) return
  const newGroup: PersonaGroup = {
    id: 'g_' + Date.now(),
    name: newGroupName.value.trim(),
    personaIds: []
  }
  personaGroups.value.push(newGroup)
  createGroupModalVisible.value = false
  activeGroupId.value = newGroup.id
  selectedPersonaIds.value = []
}

const groupActionSheetVisible = ref(false)
const targetActionGroupId = ref<string | null>(null)

const handleGroupTabClick = (groupId: string) => {
  if (activeGroupId.value === groupId) {
    targetActionGroupId.value = groupId
    groupActionSheetVisible.value = true
  } else {
    activeGroupId.value = groupId
    selectedPersonaIds.value = []
  }
}

const renameGroupModalVisible = ref(false)
const renameGroupName = ref('')

const openRenameGroupModal = () => {
  if (!targetActionGroupId.value) return
  const groupToRename = personaGroups.value.find(g => g.id === targetActionGroupId.value)
  if (groupToRename) {
    renameGroupName.value = groupToRename.name
    renameGroupModalVisible.value = true
  }
  groupActionSheetVisible.value = false
}

const confirmRenameGroup = () => {
  if (!renameGroupName.value.trim() || !targetActionGroupId.value) return
  const group = personaGroups.value.find(g => g.id === targetActionGroupId.value)
  if (group) {
    group.name = renameGroupName.value.trim()
  }
  renameGroupModalVisible.value = false
}

const copyGroup = () => {
  if (!targetActionGroupId.value) return
  const groupToCopy = personaGroups.value.find(g => g.id === targetActionGroupId.value)
  if (groupToCopy) {
    const newGroup: PersonaGroup = {
      id: 'g_' + Date.now(),
      name: groupToCopy.name + ' (副本)',
      personaIds: [...groupToCopy.personaIds]
    }
    personaGroups.value.push(newGroup)
    activeGroupId.value = newGroup.id
  }
  groupActionSheetVisible.value = false
}

const deleteGroup = () => {
  if (!targetActionGroupId.value) return
  personaGroups.value = personaGroups.value.filter(g => g.id !== targetActionGroupId.value)
  if (activeGroupId.value === targetActionGroupId.value) {
    activeGroupId.value = null
  }
  groupActionSheetVisible.value = false
}

const addToGroupModalVisible = ref(false)

const openAddToGroupModal = () => {
  if (selectedPersonaIds.value.length === 0) return
  addToGroupModalVisible.value = true
}

const confirmAddToGroup = (groupId: string) => {
  const group = personaGroups.value.find(g => g.id === groupId)
  if (group) {
    group.personaIds = Array.from(new Set([...group.personaIds, ...selectedPersonaIds.value]))
  }
  addToGroupModalVisible.value = false
  isPersonaManageMode.value = false
  selectedPersonaIds.value = []
}

const removeFromCurrentGroup = () => {
  if (activeGroupId.value === null || selectedPersonaIds.value.length === 0) return
  const group = personaGroups.value.find(g => g.id === activeGroupId.value)
  if (group) {
    group.personaIds = group.personaIds.filter(id => !selectedPersonaIds.value.includes(id))
  }
  isPersonaManageMode.value = false
  selectedPersonaIds.value = []
}

const openPersonaLibrary = () => {
  isPersonaManageMode.value = false
  selectedPersonaIds.value = []
  emit('update:currentView', 'personaLibrary')
}

const openChatAppearance = () => {
  emit('update:currentView', 'chatAppearance')
}

const openNotificationSettings = () => {
  emit('update:currentView', 'notificationSettings')
}

const openCreateOptions = () => {
  createActionSheetVisible.value = true
}

const handleManualCreate = () => {
  createActionSheetVisible.value = false
  editingPersonaId.value = null
  
  // 继承全局账号信息作为默认值
  const globalAccount = useChatAuth().currentAccount.value
  if (globalAccount) {
    newUserId.value = globalAccount.accountId || ''
    newNetworkName.value = globalAccount.name || ''
    newUserName.value = '' // 真名留空，让用户自己填写
    newUserDetail.value = globalAccount.persona || ''
    
    newUserAvatar.value = globalAccount.avatarUrl || ''
  } else {
    newUserId.value = ''
    newNetworkName.value = ''
    newUserAvatar.value = ''
    newUserName.value = ''
    newUserDetail.value = ''
  }
  
  emit('update:currentView', 'createUserPersona')
}

const handleImportSillyTavern = () => {
  createActionSheetVisible.value = false
  importModalMode.value = 'card'
  importModalVisible.value = true
}

const handleImportDoc = () => {
  createActionSheetVisible.value = false
  importModalMode.value = 'doc'
  importModalVisible.value = true
}

const openEditUserPersona = (persona: any) => {
  if (isPersonaManageMode.value) {
    toggleSelectPersona(persona.id)
    return
  }
  editingPersonaId.value = persona.id
  newUserId.value = String(persona.id) // 绑定编辑时的 ID
  newNetworkName.value = persona.networkName || useChatAuth().currentAccount.value?.name || ''
  newUserAvatar.value = persona.avatar || useChatAuth().currentAccount.value?.avatarUrl || ''
  newUserName.value = persona.name || ''
  newUserDetail.value = persona.signature || ''
  emit('update:currentView', 'createUserPersona')
}

const handleAvatarSaved = (url: string | null) => {
  newUserAvatar.value = url || ''
}

const { updateAccount } = useChatAuth()

const saveUserPersona = () => {
  if (!newUserName.value.trim() && !newNetworkName.value.trim()) return
  
  // 使用用户输入的 ID，如果为空则降级为时间戳
  const finalId = newUserId.value.trim() ? newUserId.value.trim() : Date.now()
  
  if (editingPersonaId.value !== null) {
    const index = personas.value.findIndex(p => p.id === editingPersonaId.value)
    if (index > -1) {
      // 允许在编辑时修改 ID
      personas.value[index].id = finalId
      personas.value[index].networkName = newNetworkName.value
      personas.value[index].name = newUserName.value
      personas.value[index].signature = newUserDetail.value
      personas.value[index].avatar = newUserAvatar.value
      
      // 同步检查：如果这个被编辑的人设正好是绑定了当前账号的
      if (personas.value[index].boundAccountId === currentChatUserId.value) {
        updateAccount(currentChatUserId.value, {
          accountId: String(finalId),
          name: newNetworkName.value || useChatAuth().currentAccount.value?.name || '',
          realName: newUserName.value,
          avatarUrl: newUserAvatar.value,
          persona: newUserDetail.value
        })
      }
    }
  } else {
    const newPersona = {
      // 使用用户填写的自定义 ID
      id: finalId,
      networkName: newNetworkName.value,
      name: newUserName.value,
      signature: newUserDetail.value,
      mood: '',
      isCreate: false,
      avatar: newUserAvatar.value
    }
    // 如果已经存在同 accountId 的人设，则覆盖，避免列表出现多条一样的数据
    const existingIndex = personas.value.findIndex(p => p.id === newPersona.id && !p.isCreate)
    if (existingIndex > -1) {
       personas.value[existingIndex] = newPersona
       activePersonaIndex.value = existingIndex
    } else {
       personas.value.splice(personas.value.length - 1, 0, newPersona)
       activePersonaIndex.value = personas.value.length - 2
    }
  }
  
  // 强制同步写入 localStorage
  syncPersonasToStorage()
  localStorage.setItem(getKey('app_chat_active_persona_index'), activePersonaIndex.value.toString())
  
  if (editingPersonaId.value !== null) {
    emit('update:currentView', 'personaLibrary')
  } else {
    // 触发一个特殊标记，让父组件（app_ChatPreview）去决定要返回到哪里
    emit('update:currentView', 'profile_from_create_save' as any)
  }
}

const backFromPersonaCreate = () => {
  if (editingPersonaId.value !== null) {
    emit('update:currentView', 'personaLibrary')
  } else {
    // 取消时，也让父组件决定退回到哪里
    emit('update:currentView', 'profile_from_create_cancel' as any)
  }
}

const handleImportPersonas = (importedPersonas: any[]) => {
  // 追加到 personas 列表，保留原本的“新建人设”入口（isCreate: true）在最后
  const validPersonas = personas.value.filter(p => !p.isCreate)
  const createPlaceholders = personas.value.filter(p => p.isCreate)
  personas.value = [...validPersonas, ...importedPersonas, ...createPlaceholders]
  
  // 切换到人设库以便用户查看
  emit('update:currentView', 'personaLibrary')
}

// 绑定/解绑逻辑
const handleBindPersonaToAccount = (personaId: number) => {
  if (!currentChatUserId.value) return
  
  // 先把当前账号绑定的其他人都解绑（保证一对一或多对一的单一绑定侧）
  personas.value.forEach(p => {
    if (p.boundAccountId === currentChatUserId.value) {
      p.boundAccountId = undefined
    }
  })
  
  const index = personas.value.findIndex(p => p.id === personaId)
  if (index > -1) {
    personas.value[index].boundAccountId = currentChatUserId.value
    
    // 立即进行一次单向同步：人设 -> 账号
    const acc = useChatAuth().currentAccount.value
    if (acc) {
      updateAccount(currentChatUserId.value, {
        accountId: String(personas.value[index].id),
        name: personas.value[index].networkName || acc.name,
        realName: personas.value[index].name || '',
        avatarUrl: personas.value[index].avatar || '',
        persona: personas.value[index].signature
      })

      newUserAvatar.value = personas.value[index].avatar || ''
      
      // 立即更新表单，让用户立刻在界面上看到填入的信息
      newNetworkName.value = personas.value[index].networkName || personas.value[index].name || ''
      newUserId.value = String(personas.value[index].id)
    }
    
    // 重排数组：绑定的提至首位，新建人设保留在末尾
    const bound = personas.value.filter(p => p.boundAccountId === currentChatUserId.value && !p.isCreate)
    const normal = personas.value.filter(p => p.boundAccountId !== currentChatUserId.value && !p.isCreate)
    const creates = personas.value.filter(p => p.isCreate)
    personas.value = [...bound, ...normal, ...creates]
    
    // 重置展示索引为 0
    activePersonaIndex.value = 0
    
    syncPersonasToStorage()
  }
}

const handleUnbindPersonaFromAccount = (personaId: number) => {
  const index = personas.value.findIndex(p => p.id === personaId)
  if (index > -1) {
    personas.value[index].boundAccountId = undefined
    
    // 取消绑定时，也立即在表单中清空继承的账号信息
    newNetworkName.value = ''
    newUserAvatar.value = ''
    newUserId.value = Date.now().toString()
    
    syncPersonasToStorage()
  }
}
</script>

<template>
  <div>
    <!-- ================== 3. 极简我的界面 (Profile) ================== -->
    <ProfileView
      v-if="props.currentView === 'profile'"
      :activePersona="activePersona"
      :activePersonaIndex="activePersonaIndex"
      :personas="personas"
      @prevPersona="prevPersona"
      @nextPersona="nextPersona"
      @openCustomTextEdit="openCustomTextEdit"
      @openCreateOptions="openCreateOptions"
      @openPersonaLibrary="openPersonaLibrary"
      @openChatAppearance="openChatAppearance"
      @openNotificationSettings="openNotificationSettings"
      @handleLogout="handleLogout"
    />

    <!-- ================== 通知偏好视图 ================== -->
    <NotificationSettingsView
      v-else-if="props.currentView === 'notificationSettings'"
      @back="emit('update:currentView', 'profile')"
    />

    <!-- ================== 聊天外观视图 ================== -->
    <ChatAppearanceView
      v-else-if="props.currentView === 'chatAppearance'"
      @back="emit('update:currentView', 'profile')"
    />

    <!-- ================== 6. 新建用户人设视图 ================== -->
    <CreatePersonaView
      v-else-if="props.currentView === 'createUserPersona'"
      v-model:newUserId="newUserId"
      v-model:newNetworkName="newNetworkName"
      v-model:newUserName="newUserName"
      v-model:newUserDetail="newUserDetail"
      :newUserAvatar="newUserAvatar"
      :isBoundToAccount="editingPersonaId !== null && personas.find(p => p.id === editingPersonaId)?.boundAccountId === currentChatUserId"
      @back="backFromPersonaCreate"
      @save="saveUserPersona"
      @openUploadModal="uploadModalVisible = true"
      @bindAccount="editingPersonaId !== null && handleBindPersonaToAccount(editingPersonaId)"
      @unbindAccount="editingPersonaId !== null && handleUnbindPersonaFromAccount(editingPersonaId)"
    />

    <!-- ================== 7. 人设库视图 ================== -->
    <PersonaLibraryView
      v-else-if="props.currentView === 'personaLibrary'"
      :isPersonaManageMode="isPersonaManageMode"
      :activeGroupId="activeGroupId"
      :personaGroups="personaGroups"
      :validPersonas="validPersonas"
      :selectedPersonaIds="selectedPersonaIds"
      :isAllPersonasSelected="isAllPersonasSelected"
      @togglePersonaManageMode="togglePersonaManageMode"
      @backToProfile="emit('update:currentView', 'profile')"
      @handleGroupTabClick="handleGroupTabClick"
      @openCreateGroupModal="openCreateGroupModal"
      @openEditUserPersona="openEditUserPersona"
      @toggleSelectAllPersonas="toggleSelectAllPersonas"
      @removeFromCurrentGroup="removeFromCurrentGroup"
      @openAddToGroupModal="openAddToGroupModal"
      @deleteSelectedPersonas="deleteSelectedPersonas"
    />

    <!-- 居中弹出的方正选择框 -->
    <div v-if="createActionSheetVisible" class="fancy-dialog-overlay" @click="createActionSheetVisible = false">
      <div class="fancy-dialog" @click.stop>
        <!-- 弹窗内部：分为 20% 波点区 和 80% 纯白区 -->
        <div class="fd-top-zone">
          <div class="fd-close-btn" @click="createActionSheetVisible = false">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#666" stroke-width="2" fill="none" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>
        
        <div class="fd-bottom-zone">
          <div class="fd-text-wrap">
            <div class="fd-title">新档案录入</div>
            <div class="fd-desc">请选择你偏好的身份建立方式</div>
          </div>
          
          <div class="fd-actions">
            <div class="fd-btn primary" @click="handleManualCreate">
              <span class="fd-btn-text">手动创建档案</span>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
            <div class="fd-btn secondary" @click="handleImportSillyTavern">
              <span class="fd-btn-text">导入 SillyTavern 存档</span>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
            <div class="fd-btn secondary" @click="handleImportDoc">
              <span class="fd-btn-text">导入设定文档</span>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="#ff9500" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建分组弹窗 -->
    <div v-if="createGroupModalVisible" class="ct-modal-overlay" @click="createGroupModalVisible = false">
      <div class="ct-modal-box" @click.stop>
        <div class="ct-header">
          <div class="ct-title">新建分组</div>
          <div class="ct-close" @click="createGroupModalVisible = false">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#999" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>
        <div class="ct-body">
          <input 
            type="text" 
            v-model="newGroupName" 
            class="cg-input" 
            placeholder="输入分组名称" 
            maxlength="20"
          />
        </div>
        <div class="ct-footer">
          <div class="ct-btn cancel" @click="createGroupModalVisible = false">取消</div>
          <div class="ct-btn save" @click="confirmCreateGroup">创建</div>
        </div>
      </div>
    </div>

    <!-- 重命名分组弹窗 -->
    <div v-if="renameGroupModalVisible" class="ct-modal-overlay" @click="renameGroupModalVisible = false">
      <div class="ct-modal-box" @click.stop>
        <div class="ct-header">
          <div class="ct-title">重命名分组</div>
          <div class="ct-close" @click="renameGroupModalVisible = false">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#999" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>
        <div class="ct-body">
          <input 
            type="text" 
            v-model="renameGroupName" 
            class="cg-input" 
            placeholder="输入分组名称" 
            maxlength="20"
          />
        </div>
        <div class="ct-footer">
          <div class="ct-btn cancel" @click="renameGroupModalVisible = false">取消</div>
          <div class="ct-btn save" @click="confirmRenameGroup">保存</div>
        </div>
      </div>
    </div>

    <!-- 分组操作菜单 (Action Sheet) -->
    <div v-if="groupActionSheetVisible" class="fancy-dialog-overlay" @click="groupActionSheetVisible = false">
      <div class="fancy-dialog" @click.stop style="width: 280px;">
        <div class="fd-top-zone" style="height: 48px;">
          <div class="fd-close-btn" @click="groupActionSheetVisible = false">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#666" stroke-width="2" fill="none" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>
        <div class="fd-bottom-zone" style="padding-top: 16px;">
          <div class="fd-text-wrap" style="margin-bottom: 16px;">
            <div class="fd-title">分组操作</div>
          </div>
          <div class="fd-actions" style="margin-top: 0;">
            <div class="fd-btn secondary" @click="openRenameGroupModal">
              <span class="fd-btn-text">重命名分组</span>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </div>
            <div class="fd-btn secondary" @click="copyGroup">
              <span class="fd-btn-text">复制分组</span>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </div>
            <div class="fd-btn secondary" @click="deleteGroup" style="color: #ef4444;">
              <span class="fd-btn-text" style="color: #ef4444;">删除分组</span>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 加入分组选择单 -->
    <div v-if="addToGroupModalVisible" class="fancy-dialog-overlay" @click="addToGroupModalVisible = false">
      <div class="fancy-dialog" @click.stop style="width: 320px;">
        <div class="fd-top-zone" style="height: 48px;">
          <div class="fd-close-btn" @click="addToGroupModalVisible = false">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#666" stroke-width="2" fill="none" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>
        <div class="fd-bottom-zone" style="padding-top: 16px;">
          <div class="fd-text-wrap" style="margin-bottom: 12px;">
            <div class="fd-title">加入分组</div>
            <div class="fd-desc">请选择要加入的目标分组</div>
          </div>
          
          <div class="group-select-list">
            <div v-if="personaGroups.length === 0" class="empty-group-hint">暂无分组，请先创建</div>
            <div 
              v-for="group in personaGroups" 
              :key="group.id" 
              class="group-select-item"
              @click="confirmAddToGroup(group.id)"
            >
              <div class="gs-name">{{ group.name }}</div>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="#999" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 独立的高颜值文案编辑弹窗 -->
    <div v-if="customTextModalVisible" class="ct-modal-overlay" @click="closeCustomTextEdit">
      <div class="ct-modal-box" @click.stop>
        <div class="ct-header">
          <div class="ct-title">设置自定义文案</div>
          <div class="ct-close" @click="closeCustomTextEdit">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#999" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>
        <div class="ct-body">
          <textarea 
            v-model="tempCustomText" 
            class="ct-textarea" 
            placeholder="写点你想说的话吧..." 
            maxlength="100"
          ></textarea>
          <div class="ct-counter">{{ tempCustomText.length }}/100</div>
        </div>
        <div class="ct-footer">
          <div class="ct-btn cancel" @click="closeCustomTextEdit">取消</div>
          <div class="ct-btn save" @click="saveCustomText">确认保存</div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <AvatarUploadModal 
        v-model:visible="uploadModalVisible" 
        :current-avatar="newUserAvatar"
        shape="avatar"
        @saved="handleAvatarSaved" 
      />
      <PersonaImportModal
        v-model:visible="importModalVisible"
        :mode="importModalMode"
        @import="handleImportPersonas"
      />
    </Teleport>
  </div>
</template>

<style scoped src='./app_ChatProfile.css'></style>
