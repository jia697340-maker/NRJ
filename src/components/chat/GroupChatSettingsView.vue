<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import localforage from 'localforage'
import { worldBooks } from '../../store'
import { deleteGroupChat, saveGroupChat, type GroupChatRecord } from '../../services/groupChat'
import { useChatAuth } from '../../composables/useChatAuth'
import ChatSettingsSearchBar from './settings/ChatSettingsSearchBar.vue'
import ChatSettingsTabs from './settings/ChatSettingsTabs.vue'

const props = defineProps<{ group: GroupChatRecord; chats: any[] }>()
const emit = defineEmits<{ (e: 'back'): void; (e: 'deleted'): void }>()
const { currentChatUserId } = useChatAuth()
const searchQuery = ref('')
const categories = ['群聊', '成员', '记忆', '通用', '美化']
const activeCategory = ref(localStorage.getItem('clingy_group_setting_tab') || '群聊')
const showAddMembers = ref(false)
const showWorldBookModal = ref(false)
const editingMemberId = ref('')
const showClearConfirm = ref(false)
const showDeleteConfirm = ref(false)
const showSyncConfirm = ref(false)
const syncMemberId = ref('')
const syncPersonaContent = ref('')
const syncAvatarChanged = ref(false)
const syncAvatarUrl = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)
const customAvatarData = ref<string | null>(null)
const wallpaperInput = ref<HTMLInputElement | null>(null)
const wallpaperStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatWallpapers' })
const groupAvatarsStore = localforage.createInstance({ name: 'nrt-app', storeName: 'groupMemberAvatars' })

const save = () => saveGroupChat(currentChatUserId.value, props.group)
const setCategory = (value: string) => { activeCategory.value = value; localStorage.setItem('clingy_group_setting_tab', value) }
const match = (...values: string[]) => !searchQuery.value.trim() || values.some(value => value.toLowerCase().includes(searchQuery.value.trim().toLowerCase()))
const allContacts = computed(() => props.chats.filter(chat => chat.id !== 1 && chat.chatType !== 'group' && chat.contactState !== 'candidate'))
const members = ref<any[]>([])
const loadedAvatars = ref<Record<string, string>>({})

const loadGroupMembers = async () => {
  const list = props.group.memberIds.map(id => allContacts.value.find(chat => String(chat.characterEntityId || chat.id) === id)).filter(Boolean)
  for (const id of props.group.memberIds) {
    if (props.group.memberHasCustomAvatar?.[id]) {
      const saved = await groupAvatarsStore.getItem<string>(`${props.group.id}_${id}`)
      if (saved) loadedAvatars.value[id] = saved
    }
  }
  members.value = list
}
onMounted(loadGroupMembers)
const candidates = computed(() => allContacts.value.filter(chat => !props.group.memberIds.includes(String(chat.characterEntityId || chat.id))))
const editingMember = computed(() => members.value.find(member => String(member.characterEntityId || member.id) === editingMemberId.value))

const openEditingMember = async (member: any) => {
  const id = memberId(member)
  editingMemberId.value = id
  customAvatarData.value = loadedAvatars.value[id] || null
  if (props.group.memberNotes[id] === undefined) {
    props.group.memberNotes[id] = member.persona || ''
  }
}

const triggerAvatarUpload = () => avatarInput.value?.click()
const handleAvatarUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    customAvatarData.value = reader.result as string
    syncAvatarChanged.value = true
    syncAvatarUrl.value = reader.result as string
    ;(event.target as HTMLInputElement).value = ''
  }
  reader.readAsDataURL(file)
}
const resetAvatar = () => {
  customAvatarData.value = null
  syncAvatarChanged.value = true
  syncAvatarUrl.value = ''
}

const handleSaveMember = async () => {
  const id = editingMemberId.value
  const newPersona = props.group.memberNotes[id] || ''
  const basePersona = editingMember.value?.persona || ''
  
  if (syncAvatarChanged.value) {
    props.group.memberHasCustomAvatar ||= {}
    if (customAvatarData.value) {
      props.group.memberHasCustomAvatar[id] = true
      await groupAvatarsStore.setItem(`${props.group.id}_${id}`, customAvatarData.value)
      loadedAvatars.value[id] = customAvatarData.value
    } else {
      delete props.group.memberHasCustomAvatar[id]
      await groupAvatarsStore.removeItem(`${props.group.id}_${id}`)
      delete loadedAvatars.value[id]
    }
  }

  if ((newPersona && newPersona !== basePersona) || syncAvatarChanged.value) {
    syncMemberId.value = id
    syncPersonaContent.value = newPersona
    showSyncConfirm.value = true
    editingMemberId.value = ''
  } else {
    save()
    editingMemberId.value = ''
  }
}

const confirmSaveMember = async (sync: boolean) => {
  showSyncConfirm.value = false
  save()
  if (sync && syncMemberId.value) {
    const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
    const savedStr = localStorage.getItem(contactsKey)
    if (savedStr) {
      let contacts = JSON.parse(savedStr)
      const idx = contacts.findIndex((c: any) => String(c.characterEntityId || c.id) === syncMemberId.value)
      if (idx !== -1) {
        contacts[idx].persona = syncPersonaContent.value
        localStorage.setItem(contactsKey, JSON.stringify(contacts))
        const chatIdx = props.chats.findIndex(c => String(c.characterEntityId || c.id) === syncMemberId.value)
        if (chatIdx !== -1) {
          if (syncPersonaContent.value && syncPersonaContent.value !== contacts[idx].persona) {
            props.chats[chatIdx].persona = syncPersonaContent.value
          }
          if (syncAvatarChanged.value) {
             if (syncAvatarUrl.value) {
               contacts[idx].avatarUrl = syncAvatarUrl.value
               props.chats[chatIdx].avatarUrl = syncAvatarUrl.value
             } else if (!customAvatarData.value) {
               contacts[idx].avatarUrl = ''
               props.chats[chatIdx].avatarUrl = ''
             }
          }
        }
        localStorage.setItem(contactsKey, JSON.stringify(contacts))
      }
    }
  }
  syncMemberId.value = ''
  syncPersonaContent.value = ''
  syncAvatarChanged.value = false
  syncAvatarUrl.value = ''
}

const bookItems = computed(() => worldBooks.filter(item => item.type === 'book'))
const notificationLabel = computed(() => ({ all: '全部消息', mention: '仅提到我', mute: '消息免打扰' }[props.group.notificationMode]))

const memberId = (member: any) => String(member.characterEntityId || member.id)
const avatarStyle = (member: any) => {
  const custom = loadedAvatars.value[memberId(member)]
  return custom ? { backgroundImage: `url(${custom})` } : (member.avatarUrl ? { backgroundImage: `url(${member.avatarUrl})` } : {})
}
const addMember = (member: any) => { props.group.memberIds.push(memberId(member)); save(); loadGroupMembers() }
const removeMember = async (id: string) => {
  if (props.group.memberIds.length <= 2) return
  props.group.memberIds = props.group.memberIds.filter(member => member !== id)
  delete props.group.memberNotes[id]
  delete props.group.memberNicknames[id]
  if (props.group.memberHasCustomAvatar) {
    delete props.group.memberHasCustomAvatar[id]
  }
  await groupAvatarsStore.removeItem(`${props.group.id}_${id}`)
  delete loadedAvatars.value[id]
  save()
  loadGroupMembers()
  editingMemberId.value = ''
}
const toggleBook = (id: string) => {
  props.group.boundWorldBooks = props.group.boundWorldBooks.includes(id)
    ? props.group.boundWorldBooks.filter(item => item !== id)
    : [...props.group.boundWorldBooks, id]
  save()
}
const chooseNotification = (value: GroupChatRecord['notificationMode']) => { props.group.notificationMode = value; save() }
const clearHistory = () => { props.group.messages = []; props.group.memoryBook = []; props.group.memberMemories = {}; save(); showClearConfirm.value = false }
const removeGroup = () => { deleteGroupChat(currentChatUserId.value, props.group.id); showDeleteConfirm.value = false; emit('deleted') }
const chooseWallpaper = () => wallpaperInput.value?.click()
const uploadWallpaper = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => { await wallpaperStore.setItem(`wallpaper_${props.group.id}`, reader.result); (event.target as HTMLInputElement).value = '' }
  reader.readAsDataURL(file)
}
const clearWallpaper = async () => { await wallpaperStore.removeItem(`wallpaper_${props.group.id}`) }
onMounted(() => { if (!categories.includes(activeCategory.value)) activeCategory.value = '群聊' })
</script>

<template>
  <div class="view-container full-height chat-settings-base group-settings-view">
    <ChatSettingsSearchBar v-model="searchQuery" @back="emit('back')" />
    <main class="settings-main-clean">
      <ChatSettingsTabs v-show="!searchQuery" :categories="categories" :active-category="activeCategory" @change="setCategory" />

      <section v-show="searchQuery || activeCategory === '群聊'" class="role-edit-section">
        <div v-show="match('群名称', '背景', '设定')" class="glass-panel group-form-panel">
          <label class="group-field"><span class="item-label">群名称</span><input v-model="group.name" class="group-settings-input" maxlength="30" @change="save"></label>
          <label class="group-field"><span class="item-label">群背景 <small>可选</small></span><textarea v-model="group.groupContext" class="group-settings-textarea" rows="5" placeholder="不填写时，不会向模型发送群背景提示词" @change="save"></textarea></label>
        </div>
        <div v-show="match('世界书', '群资料')" class="glass-panel">
          <div class="glass-list-item" @click="showWorldBookModal = true">
            <span class="item-label">群聊世界书</span>
            <div class="item-value">
              <span>已绑定 {{ group.boundWorldBooks.length }} 本</span>
              <span class="arrow">›</span>
            </div>
          </div>
        </div>
      </section>

      <section v-show="searchQuery || activeCategory === '成员'" class="role-edit-section">
        <div v-show="match('成员', '昵称', '群内身份')" class="glass-panel">
          <div v-for="member in members" :key="memberId(member)" class="glass-list-item" @click="openEditingMember(member)">
            <div class="group-member-line"><span class="group-member-avatar" :style="avatarStyle(member)">{{ member.avatarUrl ? '' : member.avatarText }}</span><span class="item-label">{{ group.memberNicknames[memberId(member)] || member.name }}</span></div><div class="item-value"><span class="item-value-text">群内资料</span><span class="arrow">›</span></div>
          </div>
          <div class="glass-list-item" @click="showAddMembers = true"><span class="item-label">添加成员</span><div class="item-value"><span>{{ candidates.length ? '选择角色' : '暂无可添加角色' }}</span><span class="arrow">›</span></div></div>
        </div>
      </section>

      <section v-show="searchQuery || activeCategory === '记忆'" class="role-edit-section">
        <div v-show="match('记忆类型', '短期记忆', '上下文')" class="glass-panel">
          <div class="group-section-title">短期记忆（上下文）</div>
          <div class="glass-list-item" @click="group.memoryType = 'count'; save()"><span class="item-label">按消息条数</span><span class="group-radio" :class="{ active: group.memoryType === 'count' }"></span></div>
          <div class="glass-list-item" @click="group.memoryType = 'round'; save()"><span class="item-label">按对话轮数</span><span class="group-radio" :class="{ active: group.memoryType === 'round' }"></span></div>
          <label class="group-field" style="padding: 0 16px 16px; border-top: none;">
            <span class="item-label">携带前文上限 ({{ group.memoryType === 'count' ? '条' : '轮' }})</span>
            <input v-model.number="group.memoryValue" type="number" class="group-settings-input" min="10" max="300" @change="save">
          </label>
        </div>

        <div v-show="match('自动总结', '沉淀', '长期记忆')" class="glass-panel">
          <div class="group-section-title">长期记忆沉淀</div>
          <div class="glass-list-item">
            <span class="item-label">群共享记忆</span>
            <div class="item-value"><span>已生成 {{ group.memoryBook.length }} 条</span></div>
          </div>
          <div class="group-explain">每经过 24 条有效对话，系统会在后台自动总结群聊事件并沉淀各角色的主观记忆，避免遗忘。</div>
        </div>

        <div v-show="match('清空', '聊天记录', '群记忆')" class="glass-panel"><div class="glass-list-item danger-row" @click="showClearConfirm = true">清空群聊记录与群记忆</div></div>
      </section>

      <section v-show="searchQuery || activeCategory === '通用'" class="role-edit-section">
        <div v-show="match('通知', '时间感知', '双语')" class="glass-panel">
          <div class="group-section-title">消息通知</div>
          <div v-for="option in [{ value: 'all', label: '全部消息' }, { value: 'mention', label: '仅提到我' }, { value: 'mute', label: '消息免打扰' }]" :key="option.value" class="glass-list-item" @click="chooseNotification(option.value as GroupChatRecord['notificationMode'])"><span class="item-label">{{ option.label }}</span><span class="group-radio" :class="{ active: group.notificationMode === option.value }"></span></div>
          <div class="group-current-value">当前：{{ notificationLabel }}</div>
        </div>
        <div v-show="match('时间感知', '双语', '线下见面', '思维', '心声')" class="glass-panel">
          <div class="glass-list-item"><span class="item-label">时间感知</span><label class="switch"><input v-model="group.timePerception" type="checkbox" @change="save"><span class="slider"></span></label></div>
          <div class="glass-list-item"><span class="item-label">双语模式</span><label class="switch"><input v-model="group.bilingualEnabled" type="checkbox" @change="save"><span class="slider"></span></label></div>
          <div class="glass-list-item"><div><div class="item-label">允许角色内心活动</div><div class="group-item-desc">沿用各成员单聊思维设定，并按成员隔离保存</div></div><label class="switch"><input v-model="group.enableAutoThought" type="checkbox" @change="save"><span class="slider"></span></label></div>
          <div class="glass-list-item"><div><div class="item-label">线下见面模式</div><div class="group-item-desc">在输入栏中可随时开始或结束群体线下现场</div></div><label class="switch"><input v-model="group.offlineMeetEnabled" type="checkbox" @change="save"><span class="slider"></span></label></div>
        </div>
      </section>

      <section v-show="searchQuery || activeCategory === '美化'" class="role-edit-section">
        <div v-show="match('头像', '昵称', '时间')" class="glass-panel">
          <div class="glass-list-item"><span class="item-label">显示成员头像</span><label class="switch"><input v-model="group.showMemberAvatars" type="checkbox" @change="save"><span class="slider"></span></label></div>
          <div class="glass-list-item"><span class="item-label">显示成员昵称</span><label class="switch"><input v-model="group.showMemberNames" type="checkbox" @change="save"><span class="slider"></span></label></div>
          <div class="glass-list-item"><span class="item-label">显示消息时间</span><label class="switch"><input v-model="group.showMessageTime" type="checkbox" @change="save"><span class="slider"></span></label></div>
        </div>
        <div v-show="match('壁纸', '背景图')" class="glass-panel"><div class="glass-list-item" @click="chooseWallpaper"><span class="item-label">更换群聊壁纸</span><span class="arrow">›</span></div><div class="glass-list-item" @click="clearWallpaper"><span class="item-label">恢复默认壁纸</span></div></div>
        <input ref="wallpaperInput" class="group-hidden-file" type="file" accept="image/*" @change="uploadWallpaper">
        <div v-show="match('删除群聊')" class="glass-panel"><div class="glass-list-item danger-row" @click="showDeleteConfirm = true">删除群聊</div></div>
      </section>
    </main>

    <div v-if="showWorldBookModal" class="wb-modal-overlay" @click.self="showWorldBookModal = false"><div class="custom-confirm-modal group-sheet"><div class="confirm-title">群聊世界书</div><div class="group-sheet-list"><div v-if="bookItems.length"><div v-for="book in bookItems" :key="book.id" class="glass-list-item" @click="toggleBook(book.id)"><span class="item-label">{{ book.title }}</span><span class="group-check" :class="{ active: group.boundWorldBooks.includes(book.id) }">✓</span></div></div><div v-else class="group-empty-row">暂无世界书</div></div><div class="confirm-actions"><div class="confirm-btn" @click="showWorldBookModal = false">完成</div></div></div></div>

    <div v-if="showAddMembers" class="wb-modal-overlay" @click.self="showAddMembers = false"><div class="custom-confirm-modal group-sheet"><div class="confirm-title">添加群成员</div><div class="group-sheet-list"><div v-for="member in candidates" :key="memberId(member)" class="glass-list-item" @click="addMember(member)"><div class="group-member-line"><span class="group-member-avatar" :style="avatarStyle(member)">{{ member.avatarUrl ? '' : member.avatarText }}</span><span>{{ member.name }}</span></div><span class="group-add-mark">＋</span></div><div v-if="!candidates.length" class="group-empty-row">没有可添加的角色</div></div><div class="confirm-actions"><div class="confirm-btn" @click="showAddMembers = false">完成</div></div></div></div>

    <div v-if="editingMember" class="wb-modal-overlay" @click.self="editingMemberId = ''">
      <div class="custom-confirm-modal group-member-editor">
        <div class="confirm-title">{{ editingMember.name }} · 群内资料</div>
        <div class="group-modal-fields scrollable-fields">
          <div class="group-field avatar-edit-field">
            <span>群内专属头像</span>
            <div class="avatar-edit-actions">
              <div class="avatar-preview-box" @click="triggerAvatarUpload" :style="customAvatarData ? { backgroundImage: `url(${customAvatarData})` } : (editingMember.avatarUrl ? { backgroundImage: `url(${editingMember.avatarUrl})` } : {})">
                <span v-if="!customAvatarData && !editingMember.avatarUrl">{{ editingMember.avatarText }}</span>
                <div class="avatar-edit-mask">更换</div>
              </div>
              <div class="avatar-reset-btn" v-if="customAvatarData" @click="resetAvatar">恢复默认</div>
            </div>
            <input ref="avatarInput" type="file" accept="image/*" class="group-hidden-file" @change="handleAvatarUpload">
          </div>
          <label class="group-field"><span>群内昵称</span><input v-model="group.memberNicknames[editingMemberId]" class="group-settings-input" :placeholder="editingMember.name"></label>
          <label class="group-field"><span>群内独立人设</span><textarea v-model="group.memberNotes[editingMemberId]" class="group-settings-textarea" rows="7" placeholder="此人设完全替换该成员在私聊中的原人设，仅在本群生效。"></textarea></label>
        </div>
        <div class="group-remove-member" :class="{ disabled: group.memberIds.length <= 2 }" @click="removeMember(editingMemberId)">移出群聊</div>
        <div class="confirm-actions"><div class="confirm-btn cancel" @click="editingMemberId = ''">取消</div><div class="confirm-btn" @click="handleSaveMember">保存</div></div>
      </div>
    </div>

    <div v-if="showSyncConfirm" class="wb-modal-overlay" @click.self="confirmSaveMember(false)">
      <div class="custom-confirm-modal">
        <div class="confirm-title">是否同步到私聊？</div>
        <div class="confirm-desc">你修改了该角色的群内人设或头像。是否需要将这份新的设定同步覆盖他原本的私聊基础资料？</div>
        <div class="confirm-actions" style="flex-direction: column; gap: 8px;">
          <div class="confirm-btn" style="width: 100%; border-right: none;" @click="confirmSaveMember(false)">仅在本群生效</div>
          <div class="confirm-btn cancel" style="width: 100%;" @click="confirmSaveMember(true)">同时同步到私聊</div>
        </div>
      </div>
    </div>

    <div v-if="showClearConfirm" class="wb-modal-overlay" @click.self="showClearConfirm = false"><div class="custom-confirm-modal"><div class="confirm-title">清空群聊？</div><div class="confirm-desc">聊天记录和本群独立记忆将被删除，角色私聊记忆不会被清空。</div><div class="confirm-actions"><div class="confirm-btn cancel" @click="showClearConfirm = false">取消</div><div class="confirm-btn danger" @click="clearHistory">清空</div></div></div></div>
    <div v-if="showDeleteConfirm" class="wb-modal-overlay" @click.self="showDeleteConfirm = false"><div class="custom-confirm-modal"><div class="confirm-title">删除群聊？</div><div class="confirm-desc">此操作会删除群聊记录和本群记忆，不会删除任何角色。</div><div class="confirm-actions"><div class="confirm-btn cancel" @click="showDeleteConfirm = false">取消</div><div class="confirm-btn danger" @click="removeGroup">删除</div></div></div></div>
  </div>
</template>

<style scoped>
@import './settings/ChatSettingsStyles.css';
.group-settings-view{overflow:hidden}.settings-main-clean{height:calc(100% - 66px);overflow-y:auto;padding:8px 14px 34px}.group-form-panel{padding:4px 16px}.group-field{display:flex;flex-direction:column;gap:8px;padding:12px 0;color:var(--text-secondary);font-size:13px}.group-field+.group-field{border-top:1px solid var(--border-color)}.group-field small{font-size:10px;color:var(--text-tertiary);font-weight:400}.group-settings-input,.group-settings-textarea{width:100%;box-sizing:border-box;border:1px solid var(--border-color);border-radius:10px;background:var(--sys-bg-primary);color:var(--text-primary);font:inherit;outline:none;padding:11px 12px}.group-settings-textarea{resize:none;line-height:1.6}.group-settings-input:focus,.group-settings-textarea:focus{border-color:color-mix(in srgb,var(--text-primary) 30%,var(--border-color))}.group-section-title{padding:13px 16px 8px;font-size:11px;color:var(--text-tertiary)}.group-check{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--sys-bg-tertiary);color:transparent;font-size:12px}.group-check.active{background:var(--text-primary);color:var(--sys-bg-secondary)}.group-member-line{display:flex;align-items:center;gap:10px;min-width:0}.group-member-avatar{width:34px;height:34px;border-radius:50%;background:var(--sys-bg-tertiary);background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;font-size:10px;flex:0 0 auto}.group-explain{padding:15px 16px;color:var(--text-secondary);font-size:11px;line-height:1.65;border-bottom:1px solid var(--border-color)}.group-item-desc{font-size:10px;color:var(--text-tertiary);margin-top:4px}.danger-row{justify-content:center;color:#d95b5b}.group-radio{width:18px;height:18px;border:1.5px solid var(--text-tertiary);border-radius:50%;box-sizing:border-box}.group-radio.active{border:5px solid var(--text-primary)}.group-current-value{padding:8px 16px 12px;text-align:right;font-size:10px;color:var(--text-tertiary)}.group-hidden-file{display:none}.group-sheet{max-height:70vh}.group-sheet-list{max-height:48vh;overflow-y:auto;margin-top:12px}.group-add-mark{font-size:20px;color:var(--text-secondary)}.group-empty-row{padding:22px;text-align:center;color:var(--text-tertiary);font-size:12px}.group-member-editor{width:86%}.group-modal-fields{padding:8px 20px}.scrollable-fields{max-height:50vh;overflow-y:auto}.group-remove-member{padding:10px 20px 16px;text-align:center;color:#d95b5b;font-size:13px;cursor:pointer;border-top:1px solid var(--border-color);margin-top:4px}.group-remove-member.disabled{opacity:.35;pointer-events:none}.confirm-btn:not(.cancel):not(.danger){color:var(--text-primary);font-weight:600}
.avatar-edit-field{display:flex;flex-direction:row;align-items:center;justify-content:space-between}.avatar-edit-actions{display:flex;align-items:center;gap:12px}.avatar-preview-box{width:46px;height:46px;border-radius:50%;background-color:var(--sys-bg-tertiary);background-size:cover;background-position:center;position:relative;overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text-secondary)}.avatar-edit-mask{position:absolute;bottom:0;left:0;right:0;height:16px;background:rgba(0,0,0,0.5);color:#fff;font-size:9px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s}.avatar-preview-box:hover .avatar-edit-mask{opacity:1}.avatar-reset-btn{font-size:11px;color:#d95b5b;cursor:pointer;padding:4px}
</style>
