/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { createGroupChat, type GroupChatRecord } from '../../services/groupChat'

const props = defineProps<{ chats: any[]; userProfile: any }>()
const emit = defineEmits<{ (e: 'back'): void; (e: 'create', group: GroupChatRecord): void }>()

const name = ref('')
const groupContext = ref('')
const selectedIds = ref<Set<string>>(new Set())
const errorText = ref('')
const contacts = computed(() => props.chats.filter(chat => chat.id !== 1 && chat.chatType !== 'group' && chat.contactState !== 'candidate'))

const toggleMember = (chat: any) => {
  const id = String(chat.characterEntityId || chat.id)
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
  errorText.value = ''
}

const submit = () => {
  if (!name.value.trim()) { errorText.value = '请填写群名称'; return }
  if (selectedIds.value.size < 2) { errorText.value = '请至少选择两个角色'; return }
  emit('create', createGroupChat({ name: name.value.trim(), groupContext: groupContext.value.trim(), memberIds: [...selectedIds.value] }, props.userProfile))
}
</script>

<template>
  <div class="view-container group-create-view">
    <header class="navbar glass-header group-create-header">
      <div class="nav-left"><span class="nav-btn" @click="emit('back')">取消</span></div>
      <div class="nav-center"><span class="title-main">创建群聊</span></div>
      <div class="nav-right"><span class="nav-btn group-create-save" @click="submit">创建</span></div>
    </header>

    <main class="group-create-main">
      <div class="glass-panel group-create-panel">
        <div class="group-create-title">群聊资料</div>
        <div class="group-create-field">
          <div class="group-create-label">群名称</div>
          <input v-model="name" class="simple-modal-input" maxlength="40" placeholder="填写群名称">
        </div>
        <div class="group-create-field">
          <div class="group-create-label"><span>群背景设定</span><small>选填，留空时不会发送任何群背景提示词</small></div>
          <textarea v-model="groupContext" class="simple-modal-input group-create-textarea" maxlength="2000" placeholder="例如：大家是大学室友。可以不填。"></textarea>
        </div>
      </div>

      <div class="glass-panel group-create-panel">
        <div class="group-create-title"><span>选择角色</span><small>已选择 {{ selectedIds.size }} 人</small></div>
        <div v-if="contacts.length" class="group-member-list">
          <div v-for="chat in contacts" :key="chat.id" class="glass-list-item group-member-row" @click="toggleMember(chat)">
            <div class="group-member-avatar" :style="chat.avatarUrl ? { backgroundImage: `url(${chat.avatarUrl})` } : {}">{{ chat.avatarUrl ? '' : chat.avatarText }}</div>
            <div class="group-member-copy"><b>{{ chat.name }}</b><span>{{ chat.persona?.slice(0, 44) || '暂无角色简介' }}</span></div>
            <div class="group-check" :class="{ checked: selectedIds.has(String(chat.characterEntityId || chat.id)) }">
              <svg v-if="selectedIds.has(String(chat.characterEntityId || chat.id))" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
          </div>
        </div>
        <div v-else class="group-empty">还没有可加入群聊的角色，请先创建角色。</div>
      </div>
      <div v-if="errorText" class="group-create-error">{{ errorText }}</div>
    </main>
  </div>
</template>

<style scoped>
@import './settings/ChatSettingsStyles.css';

.group-create-view{background:var(--sys-bg-primary);color:var(--text-primary);display:flex;flex-direction:column}.group-create-header{flex-shrink:0}.group-create-header .nav-left,.group-create-header .nav-right{width:72px}.group-create-save{font-weight:650}.group-create-main{flex:1;overflow-y:auto;padding:18px 16px calc(28px + env(safe-area-inset-bottom));box-sizing:border-box}.group-create-panel{margin-bottom:16px;overflow:hidden}.group-create-title{min-height:44px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-color);font-size:14px;font-weight:650}.group-create-title small{font-size:11px;color:var(--text-tertiary);font-weight:400}.group-create-field{padding:14px 16px;border-bottom:1px solid var(--border-color)}.group-create-field:last-child{border-bottom:0}.group-create-label{display:flex;justify-content:space-between;gap:12px;margin-bottom:9px;font-size:13px}.group-create-label small{color:var(--text-tertiary);font-size:10px;text-align:right;font-weight:400}.group-create-textarea{min-height:112px;resize:none;line-height:1.6}.group-member-list{display:flex;flex-direction:column}.group-member-row{display:grid;grid-template-columns:44px minmax(0,1fr) 22px;gap:12px;align-items:center;cursor:pointer}.group-member-avatar{width:44px;height:44px;border-radius:12px;background:var(--sys-bg-tertiary);background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:650}.group-member-copy{min-width:0;display:flex;flex-direction:column;gap:4px}.group-member-copy b{font-size:14px}.group-member-copy span{font-size:11px;color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.group-check{width:20px;height:20px;border:1.5px solid var(--border-color);border-radius:50%;display:flex;align-items:center;justify-content:center}.group-check.checked{background:var(--text-primary);border-color:var(--text-primary)}.group-empty,.group-create-error{padding:22px 16px;text-align:center;color:var(--text-tertiary);font-size:12px}.group-create-error{padding:0 16px;color:#ff3b30}
.simple-modal-input{display:block;width:100%;box-sizing:border-box;border:1px solid var(--border-color);border-radius:10px;background:var(--sys-bg-primary);color:var(--text-primary);font:inherit;font-size:13px;outline:none;padding:11px 12px;appearance:none;-webkit-appearance:none}.simple-modal-input:focus{border-color:color-mix(in srgb,var(--text-primary) 30%,var(--border-color))}.simple-modal-input::placeholder{color:var(--text-tertiary)}
</style>
