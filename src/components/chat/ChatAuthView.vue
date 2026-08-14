/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useChatAuth } from '../../composables/useChatAuth'
import AvatarUploadModal from '../AvatarUploadModal.vue'

const emit = defineEmits<{
  (e: 'login-success'): void
  (e: 'close'): void
}>()

const { chatAccounts, login, register, deleteAccount } = useChatAuth()

const isRegistering = ref(false)
const registerStep = ref(1)

// 注册表单
const regForm = ref({
  id: '',
  name: '',
  accountId: '',
  avatarUrl: '',
  persona: '',
  purpose: 'primary' as 'primary' | 'alternate' | 'persona',
  linkedAccountIds: [] as string[]
})
const copyLinkedProfile = ref(false)

const avatarModalVisible = ref(false)
const accountIdTaken = computed(() => chatAccounts.value.some(account => (
  account.accountId.toLowerCase() === regForm.value.accountId.trim().toLowerCase()
)))

// 删除确认弹窗状态
const deleteConfirmVisible = ref(false)
const accountsToDelete = ref<string[]>([])

// 批量管理状态
const isManaging = ref(false)
const selectedAccounts = ref<Set<string>>(new Set())

const toggleManage = () => {
  isManaging.value = !isManaging.value
  if (!isManaging.value) {
    selectedAccounts.value.clear()
  }
}

const toggleSelect = (id: string) => {
  if (selectedAccounts.value.has(id)) {
    selectedAccounts.value.delete(id)
  } else {
    selectedAccounts.value.add(id)
  }
}

const isAllSelected = computed(() => {
  return chatAccounts.value.length > 0 && selectedAccounts.value.size === chatAccounts.value.length
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedAccounts.value.clear()
  } else {
    chatAccounts.value.forEach(acc => selectedAccounts.value.add(acc.id))
  }
}

// 主题切换 (pink | purple)
const currentTheme = ref<'pink' | 'purple'>('pink')

onMounted(() => {
  const savedTheme = localStorage.getItem('clingy_auth_theme')
  if (savedTheme === 'purple') {
    currentTheme.value = 'purple'
  }
})

const toggleTheme = () => {
  currentTheme.value = currentTheme.value === 'pink' ? 'purple' : 'pink'
  localStorage.setItem('clingy_auth_theme', currentTheme.value)
}

const clearInput = (field: 'name' | 'accountId' | 'persona') => {
  regForm.value[field] = ''
}

const startRegister = () => {
  isRegistering.value = true
  registerStep.value = 1
  regForm.value = {
    id: 'user_' + Date.now(),
    name: '',
    accountId: '',
    avatarUrl: '',
    persona: '',
    purpose: chatAccounts.value.length ? 'alternate' : 'primary',
    linkedAccountIds: []
  }
  copyLinkedProfile.value = false
  isManaging.value = false
  selectedAccounts.value.clear()
}

const handleAvatarSaved = (url: string | null) => {
  regForm.value.avatarUrl = url || ''
}

const nextStep = () => {
  if (!regForm.value.name || !regForm.value.accountId || accountIdTaken.value) return
  registerStep.value = 2
}

const finishRegister = () => {
  if (!register(regForm.value)) return
  emit('login-success')
}

const setAccountPurpose = (purpose: 'alternate' | 'persona') => {
  regForm.value.purpose = purpose
  if (purpose === 'persona') {
    regForm.value.linkedAccountIds = []
    copyLinkedProfile.value = false
  }
}

const selectLinkedAccount = (id: string) => {
  regForm.value.linkedAccountIds = regForm.value.linkedAccountIds.includes(id) ? [] : [id]
  const source = chatAccounts.value.find(account => account.id === id)
  if (source && copyLinkedProfile.value) {
    regForm.value.name = source.name
    regForm.value.avatarUrl = source.avatarUrl
    regForm.value.persona = source.persona
  }
}

const toggleCopyLinkedProfile = () => {
  copyLinkedProfile.value = !copyLinkedProfile.value
  const source = chatAccounts.value.find(account => regForm.value.linkedAccountIds.includes(account.id))
  if (source && copyLinkedProfile.value) {
    regForm.value.name = source.name
    regForm.value.avatarUrl = source.avatarUrl
    regForm.value.persona = source.persona
  }
}

const skipPersona = () => {
  regForm.value.persona = ''
  finishRegister()
}

const handleLogin = (id: string) => {
  if (isManaging.value) {
    toggleSelect(id)
    return
  }
  login(id)
  emit('login-success')
}

const confirmSingleDelete = (id: string, e: Event) => {
  e.stopPropagation() // 防止触发登录点击
  accountsToDelete.value = [id]
  deleteConfirmVisible.value = true
}

const confirmBatchDelete = () => {
  if (selectedAccounts.value.size === 0) return
  accountsToDelete.value = Array.from(selectedAccounts.value)
  deleteConfirmVisible.value = true
}

const executeDelete = () => {
  accountsToDelete.value.forEach(id => {
    deleteAccount(id)
  })
  accountsToDelete.value = []
  selectedAccounts.value.clear()
  deleteConfirmVisible.value = false
  if (chatAccounts.value.length === 0) {
    isManaging.value = false
  }
}

const cancelDelete = () => {
  accountsToDelete.value = []
  deleteConfirmVisible.value = false
}

const handleBack = () => {
  if (isRegistering.value) {
    if (registerStep.value === 2) {
      registerStep.value = 1
    } else {
      isRegistering.value = false
    }
  } else {
    emit('close')
  }
}
</script>

<template>
  <div :class="['chat-auth-container', `theme-${currentTheme}`]">
    <!-- 顶部导航栏 -->
    <div class="auth-header">
      <div class="back-btn" @click="handleBack">
        <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </div>
      <div class="header-actions">
        <div v-if="!isRegistering && chatAccounts.length > 0" class="manage-btn" @click="toggleManage">
          {{ isManaging ? '完成' : '管理' }}
        </div>
        <div class="theme-switch" @click="toggleTheme" title="切换主题">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: var(--auth-primary)"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </div>
      </div>
    </div>

    <div class="auth-content">
      <!-- 大标题区域 -->
      <div class="hero-section">
        <h1 class="hero-title">{{ isRegistering ? (registerStep === 1 ? '创建新账号' : '完善人设') : '欢迎回来' }}</h1>
        <p class="hero-subtitle">{{ isRegistering ? (registerStep === 1 ? '开启你的专属旅程' : '让角色更好地了解你') : '请选择一个账号继续' }}</p>
      </div>

      <!-- 登录列表 -->
      <template v-if="!isRegistering">
        <div class="account-list" :style="{ paddingBottom: isManaging ? '80px' : '0' }">
          <div v-if="chatAccounts.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <p>暂无账号，请先创建</p>
          </div>
          
          <div 
            v-for="acc in chatAccounts" 
            :key="acc.id" 
            class="account-card"
            @click="handleLogin(acc.id)"
          >
            <!-- 多选框 -->
            <div v-if="isManaging" class="checkbox" :class="{ checked: selectedAccounts.has(acc.id) }">
              <svg v-if="selectedAccounts.has(acc.id)" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>

            <div class="avatar" :style="acc.avatarUrl ? { backgroundImage: `url(${acc.avatarUrl})` } : {}">
              {{ acc.avatarUrl ? '' : acc.name.charAt(0) }}
            </div>
            <div class="info">
              <div class="name">{{ acc.name }}</div>
              <div class="id">ID: {{ acc.accountId }}</div>
            </div>
            <!-- 单选删除按钮（管理模式下隐藏） -->
            <div class="actions" v-if="!isManaging">
              <div class="delete-btn" @click="(e) => confirmSingleDelete(acc.id, e)">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="!isManaging" class="register-entry" @click="startRegister">
          <span>注册新账号</span>
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </template>

      <!-- 注册 - 第一步：基础信息 -->
      <template v-else-if="registerStep === 1">
        <div class="register-form">
          <section v-if="chatAccounts.length" class="account-purpose-section">
            <div class="purpose-heading"><strong>这个账号用于</strong><span>之后仍可在账号资料中查看</span></div>
            <div class="purpose-options">
              <button type="button" :class="{ active: regForm.purpose === 'alternate' }" @click="setAccountPurpose('alternate')"><strong>另一个账号</strong><span>大小号独立相处，可选择私密关联</span></button>
              <button type="button" :class="{ active: regForm.purpose === 'persona' }" @click="setAccountPurpose('persona')"><strong>全新人设身份</strong><span>从陌生人开始，不关联旧身份</span></button>
            </div>
            <template v-if="regForm.purpose === 'alternate'">
              <div class="linked-account-label">关联到哪个已有账号（可选）</div>
              <div class="linked-account-options">
                <button v-for="account in chatAccounts" :key="account.id" type="button" :class="{ selected: regForm.linkedAccountIds.includes(account.id) }" @click="selectLinkedAccount(account.id)">
                  <span class="linked-avatar" :style="account.avatarUrl ? { backgroundImage: `url(${account.avatarUrl})` } : {}">{{ account.avatarUrl ? '' : account.name.charAt(0) }}</span><span><strong>{{ account.name }}</strong><small>ID：{{ account.accountId }}</small></span>
                </button>
              </div>
              <button v-if="regForm.linkedAccountIds.length" type="button" class="copy-profile-row" :class="{ checked: copyLinkedProfile }" @click="toggleCopyLinkedProfile"><span class="copy-check"><svg v-if="copyLinkedProfile" viewBox="0 0 24 24"><path d="m5 12 4 4L19 7"/></svg></span><span><strong>复制基础资料</strong><small>复制网名、头像和人设，不复制联系人与关系</small></span></button>
            </template>
          </section>

          <div class="avatar-upload" @click="avatarModalVisible = true">
            <div class="avatar-preview" :style="regForm.avatarUrl ? { backgroundImage: `url(${regForm.avatarUrl})` } : {}">
              <svg v-if="!regForm.avatarUrl" viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            </div>
            <div class="avatar-hint">点击设置头像</div>
          </div>

          <!-- 微信风格输入框 -->
          <div class="wechat-input-group">
            <label>网名</label>
            <div class="input-wrapper">
              <input type="text" v-model="regForm.name" placeholder="例如：粘人精" />
              <div class="clear-btn" v-if="regForm.name" @click="clearInput('name')">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              </div>
            </div>
          </div>

          <div class="wechat-input-group">
            <label>聊天ID号</label>
            <div class="input-wrapper">
              <input type="text" v-model="regForm.accountId" placeholder="设置一个唯一的ID号" />
              <div class="clear-btn" v-if="regForm.accountId" @click="clearInput('accountId')">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              </div>
            </div>
            <small v-if="accountIdTaken" class="input-error">这个聊天 ID 已被使用</small>
          </div>

          <button class="hero-btn" :disabled="!regForm.name || !regForm.accountId || accountIdTaken" @click="nextStep">下一步</button>
        </div>
      </template>

      <!-- 注册 - 第二步：设置人设 -->
      <template v-else-if="registerStep === 2">
        <div class="register-form">
          <div class="wechat-input-group textarea-group">
            <label>用户人设 (选填)</label>
            <div class="input-wrapper">
              <textarea v-model="regForm.persona" placeholder="例如：我是一个大学生，性格开朗..." rows="4"></textarea>
              <div class="clear-btn" v-if="regForm.persona" @click="clearInput('persona')" style="top: 8px; right: 0;">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              </div>
            </div>
          </div>

          <div class="hero-btn-group">
            <button class="hero-btn ghost" @click="skipPersona">跳过</button>
            <button class="hero-btn" @click="finishRegister">完成注册</button>
          </div>
        </div>
      </template>
    </div>

    <!-- 底部管理操作栏 -->
    <div v-if="!isRegistering && isManaging" class="manage-bottom-bar">
      <div class="select-all" @click="toggleSelectAll">
        <div class="checkbox" :class="{ checked: isAllSelected }">
          <svg v-if="isAllSelected" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <span>全选</span>
      </div>
      <button class="batch-delete-btn" :disabled="selectedAccounts.size === 0" @click="confirmBatchDelete">
        注销选中账号 ({{ selectedAccounts.size }})
      </button>
    </div>

    <!-- 自定义删除确认弹窗 -->
    <div class="custom-modal-overlay" v-if="deleteConfirmVisible" @click="cancelDelete">
      <div class="custom-modal" @click.stop>
        <div class="modal-icon warning">
          <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <div class="modal-title">注销账号</div>
        <div class="modal-desc">此操作将永久删除 {{ accountsToDelete.length > 1 ? `选中的 ${accountsToDelete.length} 个` : '该' }} 账号及相关数据，且不可恢复。确定要继续吗？</div>
        <div class="modal-actions">
          <button class="modal-btn cancel" @click="cancelDelete">取消</button>
          <button class="modal-btn danger" @click="executeDelete">确定注销</button>
        </div>
      </div>
    </div>

    <!-- 头像上传弹窗 -->
    <Teleport to="body">
      <AvatarUploadModal 
        v-model:visible="avatarModalVisible" 
        :current-avatar="regForm.avatarUrl"
        shape="circle"
        @saved="handleAvatarSaved" 
      />
    </Teleport>
  </div>
</template>

<style scoped>
/* 主题变量定义 */
.theme-pink {
  --auth-primary: #FFB6C1; /* 浅粉色 */
  --auth-primary-light: rgba(255, 182, 193, 0.15);
  --auth-primary-hover: #FFA0B0;
  --auth-bg: #FFFFFF;
  --auth-bg-gradient: linear-gradient(180deg, #FFFFFF 0%, #FFF5F7 100%);
  --auth-text-title: #333333;
  --auth-text-sub: #999999;
}

.theme-purple {
  --auth-primary: #DDA0DD; /* 浅紫色 */
  --auth-primary-light: rgba(221, 160, 221, 0.15);
  --auth-primary-hover: #D08CD0;
  --auth-bg: #FFFFFF;
  --auth-bg-gradient: linear-gradient(180deg, #FFFFFF 0%, #F8F4FF 100%);
  --auth-text-title: #333333;
  --auth-text-sub: #999999;
}

.chat-auth-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--auth-bg-gradient);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--auth-text-title);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.auth-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.manage-btn {
  font-size: 15px;
  font-weight: 500;
  color: var(--auth-text-sub);
  cursor: pointer;
  transition: opacity 0.2s;
}
.manage-btn:active {
  opacity: 0.6;
}

.auth-header .back-btn,
.auth-header .theme-switch {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  color: var(--auth-text-title);
  transition: background 0.3s;
}
.auth-header .back-btn:active,
.auth-header .theme-switch:active {
  background: rgba(0, 0, 0, 0.05);
}

.auth-content {
  flex: 1;
  padding: 10px 32px 32px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.hero-section {
  margin-top: 10px;
  margin-bottom: 40px;
}

.hero-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--auth-text-title);
  margin: 0 0 8px 0;
  letter-spacing: 0.5px;
}

.hero-subtitle {
  font-size: 15px;
  color: var(--auth-text-sub);
  margin: 0;
}

.empty-state {
  text-align: center;
  color: var(--auth-text-sub);
  padding: 60px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.empty-icon {
  width: 80px;
  height: 80px;
  border-radius: 40px;
  background: var(--auth-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,0.04);
  color: var(--auth-primary);
}

.account-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
  transition: padding-bottom 0.3s;
}

.account-card {
  display: flex;
  align-items: center;
  padding: 16px;
  background: var(--auth-bg);
  border-radius: 16px;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid rgba(0, 0, 0, 0.02);
}
.account-card:active {
  transform: scale(0.98);
  background: #FAFAFA;
}

.checkbox {
  width: 22px;
  height: 22px;
  border-radius: 11px;
  border: 2px solid rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  transition: all 0.2s;
}
.checkbox.checked {
  background: var(--auth-primary);
  border-color: var(--auth-primary);
  color: white;
}

.account-card .avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background-color: var(--auth-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 600;
  background-size: cover;
  background-position: center;
  margin-right: 16px;
}

.account-card .info {
  flex: 1;
}

.account-card .name {
  font-size: 17px;
  font-weight: 600;
  color: var(--auth-text-title);
  margin-bottom: 4px;
}

.account-card .id {
  font-size: 13px;
  color: var(--auth-text-sub);
}

.account-card .actions {
  display: flex;
  align-items: center;
}

.delete-btn {
  width: 32px;
  height: 32px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff4d4f;
  transition: all 0.2s;
}
.delete-btn:active {
  background: rgba(255, 77, 79, 0.1);
}

.register-entry {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px;
  color: var(--auth-primary);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 20px;
  align-self: center;
  transition: opacity 0.2s;
}
.register-entry:active {
  opacity: 0.6;
}

/* 微信风格注册表单 */
.register-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.avatar-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  cursor: pointer;
}

.avatar-preview {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: var(--auth-primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--auth-primary);
  background-size: cover;
  background-position: center;
}

.avatar-hint {
  font-size: 14px;
  font-weight: 500;
  color: var(--auth-text-sub);
}

.wechat-input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wechat-input-group label {
  font-size: 14px;
  color: var(--auth-text-title);
  font-weight: 500;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrapper input,
.input-wrapper textarea {
  width: 100%;
  padding: 12px 32px 12px 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 16px;
  color: var(--auth-text-title);
  font-family: inherit;
  border-radius: 0;
  transition: border-bottom-color 0.3s;
}

.input-wrapper textarea {
  resize: none;
  padding-right: 0;
}

.input-wrapper input:focus,
.input-wrapper textarea:focus {
  outline: none;
  border-bottom-color: var(--auth-primary);
}

.input-wrapper input::placeholder,
.input-wrapper textarea::placeholder {
  color: #cccccc;
}

.clear-btn {
  position: absolute;
  right: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #bbbbbb;
  cursor: pointer;
}
.clear-btn:active {
  color: var(--auth-text-title);
}

.hero-btn {
  width: 100%;
  height: 48px;
  border-radius: 24px;
  background: var(--auth-primary);
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  margin-top: 24px;
  transition: background 0.2s, opacity 0.2s;
}
.hero-btn:active {
  background: var(--auth-primary-hover);
}
.hero-btn:disabled {
  background: var(--auth-primary-light);
  color: rgba(255, 255, 255, 0.8);
  cursor: not-allowed;
}
.hero-btn.ghost {
  background: var(--auth-bg);
  color: var(--auth-text-title);
  border: 1px solid rgba(0,0,0,0.1);
}

.hero-btn-group {
  display: flex;
  gap: 16px;
  margin-top: 16px;
}

/* 底部管理操作栏 */
.manage-bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 70px;
  background: var(--auth-bg);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  box-sizing: border-box;
  animation: slideUpBar 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 10;
}

.select-all {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  color: var(--auth-text-title);
  user-select: none;
}

.batch-delete-btn {
  height: 40px;
  padding: 0 20px;
  border-radius: 20px;
  background: #ff4d4f;
  color: white;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}
.batch-delete-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 自定义弹窗 */
.custom-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}
.custom-modal {
  background: var(--auth-bg);
  width: 300px;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-icon {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.modal-icon.warning {
  background: rgba(255, 77, 79, 0.1);
  color: #ff4d4f;
}
.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--auth-text-title);
  margin-bottom: 8px;
}
.modal-desc {
  font-size: 14px;
  color: var(--auth-text-sub);
  line-height: 1.5;
  margin-bottom: 24px;
}
.modal-actions {
  display: flex;
  width: 100%;
  gap: 12px;
}
.modal-btn {
  flex: 1;
  height: 40px;
  border-radius: 20px;
  font-size: 15px;
  font-weight: 500;
  border: none;
  cursor: pointer;
}
.modal-btn.cancel {
  background: #f5f5f5;
  color: #666;
}
.modal-btn.danger {
  background: #ff4d4f;
  color: white;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scaleUp {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes slideUpBar {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.register-form{width:100%;min-width:0}.account-purpose-section{box-sizing:border-box;width:100%;min-width:0}.purpose-heading span{max-width:52%;min-width:0;text-align:right;white-space:normal}.purpose-options{grid-template-columns:repeat(2,minmax(0,1fr))}.purpose-options button{min-width:0}
.account-purpose-section{display:flex;flex-direction:column;gap:10px;margin-bottom:22px;padding:14px;border:1px solid rgba(0,0,0,.05);border-radius:16px;background:rgba(255,255,255,.68)}.purpose-heading{display:flex;align-items:center;justify-content:space-between}.purpose-heading strong{font-size:13px;color:var(--auth-text-main)}.purpose-heading span,.linked-account-label{font-size:10px;color:var(--auth-text-sub)}.purpose-options{display:grid;grid-template-columns:1fr 1fr;gap:8px}.purpose-options button{display:flex;min-height:68px;padding:11px;border:1px solid transparent;border-radius:12px;background:rgba(245,245,247,.9);color:var(--auth-text-main);text-align:left;flex-direction:column;gap:5px}.purpose-options button.active{border-color:var(--auth-primary);background:rgba(255,255,255,.98);box-shadow:0 4px 12px rgba(0,0,0,.035)}.purpose-options strong{font-size:12px}.purpose-options span{font-size:9px;line-height:1.45;color:var(--auth-text-sub)}.linked-account-label{margin-top:2px}.linked-account-options{display:flex;gap:7px;overflow-x:auto;padding-bottom:2px}.linked-account-options>button{display:flex;align-items:center;gap:8px;min-width:145px;padding:8px;border:1px solid transparent;border-radius:11px;background:rgba(245,245,247,.9);color:var(--auth-text-main);text-align:left}.linked-account-options>button.selected{border-color:var(--auth-primary);background:#fff}.linked-avatar{display:grid;place-items:center;flex:0 0 34px;width:34px;height:34px;border-radius:50%;background:var(--auth-bg-soft) center/cover;font-size:11px;font-weight:700}.linked-account-options button>span:last-child,.copy-profile-row>span:last-child{display:flex;min-width:0;flex-direction:column;gap:3px}.linked-account-options strong,.copy-profile-row strong{overflow:hidden;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.linked-account-options small,.copy-profile-row small{font-size:8px;color:var(--auth-text-sub)}.copy-profile-row{display:flex;align-items:center;gap:9px;width:100%;padding:9px;border:0;border-radius:11px;background:rgba(245,245,247,.9);color:var(--auth-text-main);text-align:left}.copy-check{display:grid;place-items:center;flex:0 0 20px;width:20px;height:20px;border:1px solid #ccd0d5;border-radius:6px;background:#fff}.copy-profile-row.checked .copy-check{border-color:var(--auth-primary);background:var(--auth-primary);color:#fff}.copy-check svg{width:14px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round}.input-error{display:block;margin-top:6px;color:#d75a60;font-size:10px}@media(max-width:430px){.purpose-options{grid-template-columns:1fr}.account-purpose-section{padding:12px}}
</style>
