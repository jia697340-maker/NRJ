/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatAuth } from '../../composables/useChatAuth'
import AvatarUploadModal from '../AvatarUploadModal.vue'

const emit = defineEmits<{
  (e: 'login-success'): void
  (e: 'close'): void
}>()

const { chatAccounts, currentAccount, login, register, deleteAccount } = useChatAuth()

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
const personaExpandModalVisible = ref(false)
const personaCharCount = computed(() => regForm.value.persona ? regForm.value.persona.length : 0)

const accountIdTaken = computed(() => chatAccounts.value.some(account => (
  account.accountId.toLowerCase() === regForm.value.accountId.trim().toLowerCase()
)))

// 删除确认弹窗状态
const deleteConfirmVisible = ref(false)
const accountsToDelete = ref<string[]>([])

// 管理模式状态
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
  e.stopPropagation()
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

const formatIndex = (idx: number) => {
  return String(idx + 1).padStart(2, '0')
}
</script>

<template>
  <div class="chat-auth-view">
    <div class="auth-inner">
      <!-- 顶部导航条 -->
      <header class="auth-nav">
        <div class="nav-left">
          <button class="nav-back-btn" type="button" aria-label="返回" @click="handleBack">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M15 5l-7 7 7 7"/>
            </svg>
          </button>
          <div class="nav-code">
            <span>{{ isRegistering ? '02 / REGISTER' : '01 / ACCOUNT' }}</span>
            <i></i>
          </div>
        </div>

        <!-- 右侧管理/模式按钮 -->
        <button 
          v-if="!isRegistering && chatAccounts.length > 0" 
          class="nav-manage-btn" 
          type="button"
          @click="toggleManage"
        >
          {{ isManaging ? 'DONE' : 'EDIT' }}
        </button>
        <div v-else class="nav-placeholder">
          <span>VOL.01</span>
        </div>
      </header>

      <!-- 大标题区 -->
      <section class="hero-section" :class="{ 'in-register': isRegistering }">
        <div class="hero-kicker">
          {{ isRegistering ? `REGISTRATION · STEP 0${registerStep}` : 'IDENTITY ARCHIVE' }}
        </div>
        <div class="hero-title-row">
          <h1 class="hero-title">
            <span>{{ isRegistering ? (registerStep === 1 ? '创建' : '完善') : '欢迎' }}</span>
            <span class="backword">{{ isRegistering ? (registerStep === 1 ? '身份' : '人设') : '回来' }}</span>
          </h1>
          <span class="hero-tag-badge">
            {{ isRegistering ? (registerStep === 1 ? 'NEW PROFILE' : 'CHARACTER BIO') : 'WELCOME BACK' }}
          </span>
        </div>
        <p class="hero-sub">
          {{ isRegistering ? (registerStep === 1 ? '建立专属档案，开启私密互动。' : '让角色更好地感知与陪伴你。') : '请选择一个身份继续，或建立第一张账号卡。' }}
        </p>
      </section>

      <!-- 首页：身份档案册列表 / 空状态 -->
      <section v-if="!isRegistering" class="archive-section">
        <div class="archive-bg"></div>

        <div class="archive-card">
          <!-- 卡片头部索引与印章 -->
          <div class="archive-head">
            <div class="archive-index">
              <span class="num">{{ chatAccounts.length === 0 ? '00' : formatIndex(chatAccounts.length - 1) }}</span>
              <span>{{ chatAccounts.length === 0 ? 'IDENTITY FILE' : `IDENTITY ARCHIVE (${chatAccounts.length})` }}</span>
            </div>
            <div class="stamp" :class="{ empty: chatAccounts.length === 0, active: isManaging }">
              {{ chatAccounts.length === 0 ? 'EMPTY' : (isManaging ? 'MANAGING' : 'VERIFIED') }}
            </div>
          </div>

          <!-- 卡片核心区域：空状态 vs 账号列表 -->
          <template v-if="chatAccounts.length === 0">
            <div class="slot-empty">
              <div class="avatar-box" @click="startRegister">
                <div class="avatar-placeholder"></div>
              </div>
              <div class="skeleton">
                <div class="sk w1"></div>
                <div class="sk w2"></div>
                <div class="sk w3"></div>
                <div class="mini">PROFILE · WAITING TO BE FILLED</div>
              </div>
            </div>

            <div class="empty-note">
              <h2 class="empty-title">还没有建立身份</h2>
              <p class="empty-desc">创建第一张账号卡后，会收纳在这里。之后可以直接从身份册中选择并进入聊天。</p>
            </div>
          </template>

          <template v-else>
            <div class="accounts-scroll-box" :class="{ 'managing-mode': isManaging }">
              <div 
                v-for="(acc, index) in chatAccounts" 
                :key="acc.id" 
                class="account-entry-item"
                :class="{ 'is-selected': selectedAccounts.has(acc.id), 'is-current': currentAccount?.id === acc.id }"
                @click="handleLogin(acc.id)"
              >
                <!-- 管理模式复选框 -->
                <div v-if="isManaging" class="item-checkbox" :class="{ checked: selectedAccounts.has(acc.id) }">
                  <svg v-if="selectedAccounts.has(acc.id)" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>

                <!-- 序号标记 -->
                <div class="entry-index-tag">{{ formatIndex(index) }}</div>

                <!-- 头像 -->
                <div 
                  class="entry-avatar"
                  :style="acc.avatarUrl ? { backgroundImage: `url(${acc.avatarUrl})` } : {}"
                >
                  <span v-if="!acc.avatarUrl">{{ acc.name ? acc.name.charAt(0) : 'U' }}</span>
                </div>

                <!-- 账号档案信息 -->
                <div class="entry-info">
                  <div class="entry-name-row">
                    <span class="entry-name">{{ acc.name }}</span>
                    <span v-if="currentAccount?.id === acc.id" class="entry-current-badge">CURRENT</span>
                  </div>
                  <div class="entry-sub-row">
                    <span class="entry-account-id">@{{ acc.accountId }}</span>
                    <span v-if="acc.persona" class="entry-persona-brief">{{ acc.persona }}</span>
                  </div>
                </div>

                <!-- 单项删除按钮 -->
                <button 
                  v-if="!isManaging" 
                  type="button" 
                  class="entry-single-delete" 
                  title="删除身份"
                  @click="(e) => confirmSingleDelete(acc.id, e)"
                >
                  <svg viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          </template>

          <!-- 右下角角标说明 (流式排版) -->
          <div class="corner-note">
            NRJ / CHAT PROFILE<br/>
            VOL. 01
          </div>

          <!-- 底部建立新身份入口 -->
          <div v-if="!isManaging" class="create-entry" @click="startRegister">
            <div class="create-text-group">
              <div class="create-main">
                <span class="plus-icon">＋</span>
                <span>建立新身份</span>
              </div>
              <small>CREATE NEW PROFILE</small>
            </div>
            <div class="arrow-circle">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </div>
        </div>

        <div class="footer-code">
          <span>NRJ · PERSONAL IDENTITY</span>
          <i></i>
          <span>2026</span>
        </div>
      </section>

      <!-- 注册流程：第1步 基础信息 -->
      <section v-else-if="registerStep === 1" class="archive-section">
        <div class="archive-bg"></div>

        <div class="archive-card reg-card">
          <!-- 卡片头部索引与印章 -->
          <div class="archive-head">
            <div class="archive-index">
              <span class="num">01</span>
              <span>STEP 01 / 02 · BASIC PROFILE</span>
            </div>
            <div class="stamp">
              INITIAL
            </div>
          </div>

          <!-- 账号用途区分 (若已有账号) -->
          <div v-if="chatAccounts.length" class="account-purpose-section">
            <div class="purpose-heading">
              <strong>账号定位</strong>
              <span>支持随时切换身份</span>
            </div>
            <div class="purpose-options">
              <button 
                type="button" 
                :class="{ active: regForm.purpose === 'alternate' }" 
                @click="setAccountPurpose('alternate')"
              >
                <strong>另一个账号</strong>
                <span>大小号独立相处，可选择私密关联</span>
              </button>
              <button 
                type="button" 
                :class="{ active: regForm.purpose === 'persona' }" 
                @click="setAccountPurpose('persona')"
              >
                <strong>全新人设身份</strong>
                <span>从陌生人开始，不关联旧身份</span>
              </button>
            </div>

            <template v-if="regForm.purpose === 'alternate'">
              <div class="linked-account-label">关联到哪个已有账号（可选）</div>
              <div class="linked-account-options">
                <button 
                  v-for="account in chatAccounts" 
                  :key="account.id" 
                  type="button" 
                  :class="{ selected: regForm.linkedAccountIds.includes(account.id) }" 
                  @click="selectLinkedAccount(account.id)"
                >
                  <span 
                    class="linked-avatar" 
                    :style="account.avatarUrl ? { backgroundImage: `url(${account.avatarUrl})` } : {}"
                  >
                    {{ account.avatarUrl ? '' : account.name.charAt(0) }}
                  </span>
                  <span>
                    <strong>{{ account.name }}</strong>
                    <small>ID: {{ account.accountId }}</small>
                  </span>
                </button>
              </div>
              <button 
                v-if="regForm.linkedAccountIds.length" 
                type="button" 
                class="copy-profile-row" 
                :class="{ checked: copyLinkedProfile }" 
                @click="toggleCopyLinkedProfile"
              >
                <span class="copy-check">
                  <svg v-if="copyLinkedProfile" viewBox="0 0 24 24"><path d="m5 12 4 4L19 7"/></svg>
                </span>
                <span><strong>复制基础资料</strong><small>复制网名、头像和人设，不复制联系人与聊天</small></span>
              </button>
            </template>
          </div>

          <!-- 头像设置槽位 (档案证件框质感) -->
          <div class="form-avatar-box" @click="avatarModalVisible = true">
            <div class="form-avatar-circle" :style="regForm.avatarUrl ? { backgroundImage: `url(${regForm.avatarUrl})` } : {}">
              <span v-if="!regForm.avatarUrl" class="avatar-add-icon">＋</span>
            </div>
            <div class="avatar-tip">
              <span>{{ regForm.avatarUrl ? '点击更换身份头像' : '点击设置身份头像' }}</span>
              <small>PROFILE AVATAR · PHOTO</small>
            </div>
            <div class="avatar-action-badge">
              <span>{{ regForm.avatarUrl ? '已设置' : '上传' }}</span>
            </div>
          </div>

          <!-- 输入框表单 -->
          <div class="reg-form-fields">
            <div class="form-field-group">
              <label class="field-label">
                <span>身份昵称 / NAME</span>
              </label>
              <div class="field-input-box">
                <input type="text" v-model="regForm.name" placeholder="输入你想被称呼的昵称" />
                <button v-if="regForm.name" type="button" class="field-clear-btn" @click="clearInput('name')">×</button>
              </div>
            </div>

            <div class="form-field-group">
              <label class="field-label">
                <span>聊天账号ID / ACCOUNT ID</span>
              </label>
              <div class="field-input-box" :class="{ error: accountIdTaken }">
                <input type="text" v-model="regForm.accountId" placeholder="输入唯一的账号识别码" />
                <button v-if="regForm.accountId" type="button" class="field-clear-btn" @click="clearInput('accountId')">×</button>
              </div>
              <small v-if="accountIdTaken" class="input-err-hint">此账号 ID 已被占用，请更换</small>
            </div>
          </div>

          <!-- 底部提交按钮 -->
          <button 
            type="button" 
            class="form-action-btn" 
            :disabled="!regForm.name || !regForm.accountId || accountIdTaken" 
            @click="nextStep"
          >
            <span>下一步 / STEP 02</span>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <div class="footer-code">
          <span>NRJ · NEW REGISTRATION</span>
          <i></i>
          <span>2026</span>
        </div>
      </section>

      <!-- 注册流程：第2步 人设详情 -->
      <section v-else-if="registerStep === 2" class="archive-section">
        <div class="archive-bg"></div>

        <div class="archive-card reg-card">
          <!-- 卡片头部索引与印章 -->
          <div class="archive-head">
            <div class="archive-index">
              <span class="num">02</span>
              <span>STEP 02 / 02 · PERSONA & BIO</span>
            </div>
            <div class="stamp">
              MEMO
            </div>
          </div>

          <div class="form-field-group">
            <div class="field-label-row">
              <label class="field-label">
                <span>用户人设与背景 (选填)</span>
              </label>
              <div class="field-tools-badge">
                <span v-if="personaCharCount > 0" class="char-counter">{{ personaCharCount }} 字</span>
                <button 
                  type="button" 
                  class="field-expand-btn" 
                  title="大屏放大编辑" 
                  @click="personaExpandModalVisible = true"
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                  </svg>
                  <span>放大编辑</span>
                </button>
              </div>
            </div>
            <div class="field-textarea-box">
              <textarea 
                v-model="regForm.persona" 
                placeholder="例如：热爱设计的大学生，性格温柔、偶尔有些粘人……" 
                rows="5"
              ></textarea>
              <div class="textarea-actions-corner">
                <button v-if="regForm.persona" type="button" class="field-clear-btn" title="清空内容" @click="clearInput('persona')">×</button>
              </div>
            </div>
            <small class="field-sub-hint">设定后，角色在与你互动时将更自然地理解你的背景与说话习惯。</small>
          </div>

          <div class="form-action-group">
            <button type="button" class="form-action-btn secondary" @click="skipPersona">
              跳过此步
            </button>
            <button type="button" class="form-action-btn" @click="finishRegister">
              完成创建并进入
            </button>
          </div>
        </div>

        <div class="footer-code">
          <span>NRJ · PERSONAL IDENTITY</span>
          <i></i>
          <span>2026</span>
        </div>
      </section>
    </div>

    <!-- 底部批量管理操作栏 -->
    <div v-if="!isRegistering && isManaging" class="manage-bottom-bar">
      <div class="select-all" @click="toggleSelectAll">
        <div class="item-checkbox" :class="{ checked: isAllSelected }">
          <svg v-if="isAllSelected" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <span>全选 ({{ selectedAccounts.size }}/{{ chatAccounts.length }})</span>
      </div>
      <button 
        type="button" 
        class="batch-delete-btn" 
        :disabled="selectedAccounts.size === 0" 
        @click="confirmBatchDelete"
      >
        注销选中身份
      </button>
    </div>

    <!-- 自定义注销确认弹窗 -->
    <div class="custom-modal-overlay" v-if="deleteConfirmVisible" @click="cancelDelete">
      <div class="custom-modal" @click.stop>
        <div class="modal-badge">SECURITY NOTICE</div>
        <div class="modal-title">注销身份档案</div>
        <div class="modal-desc">
          确认永久删除 {{ accountsToDelete.length > 1 ? `选中的 ${accountsToDelete.length} 个` : '该' }} 身份账号及所有对话记忆？此操作不可撤销。
        </div>
        <div class="modal-actions">
          <button type="button" class="modal-btn cancel" @click="cancelDelete">取消</button>
          <button type="button" class="modal-btn danger" @click="executeDelete">确认注销</button>
        </div>
      </div>
    </div>

    <!-- 人设大屏放大编辑弹窗 -->
    <Teleport to="body">
      <div v-if="personaExpandModalVisible" class="expand-editor-overlay" @click="personaExpandModalVisible = false">
        <div class="expand-editor-card" @click.stop>
          <div class="expand-card-bg"></div>

          <!-- 弹窗头部 -->
          <div class="expand-header">
            <div class="expand-header-left">
              <div class="expand-tag">PERSONA MEMO · EXPANDED</div>
              <h2 class="expand-title">人设与背景大屏编辑</h2>
            </div>
            <button type="button" class="expand-close-btn" @click="personaExpandModalVisible = false">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- 提示文本 -->
          <p class="expand-desc">
            在这里输入详细的人设背景、说话口吻与偏好习惯，方便随时润色与长文排版。
          </p>

          <!-- 大屏多行编辑框 -->
          <div class="expand-textarea-wrap">
            <textarea 
              v-model="regForm.persona" 
              class="expand-textarea" 
              placeholder="例如：热爱设计的大学生，性格温柔细腻，偶尔有些粘人……可以在这里书写更丰富、更立体的设定，让角色全方位了解你。"
              rows="10"
              autofocus
            ></textarea>
          </div>

          <!-- 底部工具栏与操作 -->
          <div class="expand-footer">
            <div class="expand-footer-left">
              <div class="expand-char-badge">
                <span class="dot"></span>
                <span>当前字数：<strong>{{ personaCharCount }}</strong> 字</span>
              </div>
              <button v-if="regForm.persona" type="button" class="expand-clear-text-btn" @click="clearInput('persona')">
                清空重写
              </button>
            </div>
            <button type="button" class="expand-confirm-btn" @click="personaExpandModalVisible = false">
              <span>完成并保留</span>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 头像上传裁剪弹窗 -->
    <Teleport to="body">
      <AvatarUploadModal 
        v-model:visible="avatarModalVisible" 
        :current-avatar="regForm.avatarUrl"
        shape="circle"
        enable-crop
        @saved="handleAvatarSaved" 
      />
    </Teleport>
  </div>
</template>

<style scoped>
/* 核心设计色彩与变量 */
.chat-auth-view {
  --bg: #fffafb;
  --paper: #ffffff;
  --ink: #2f3033;
  --muted: #a9a4a7;
  --line: #f1d9df;
  --line-2: #f8e9ed;
  --pink: #ff9fb3;
  --pink-2: #ffc6d2;
  --pink-3: #fff2f5;

  position: fixed;
  inset: 0;
  z-index: 9999;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, rgba(255,255,255,.76), rgba(255,248,250,.98)), var(--bg);
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}

.auth-inner {
  max-width: 440px;
  min-height: 100%;
  margin: 0 auto;
  padding: 24px 20px 48px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* 顶部导航条 */
.auth-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  min-height: 40px;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-back-btn {
  width: 58px;
  height: 28px;
  min-width: 58px;
  min-height: 28px;
  max-width: 58px;
  max-height: 28px;
  flex-shrink: 0;
  border: 1px solid var(--line);
  background: rgba(255,255,255,.94);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  box-sizing: border-box;
  transition: all .2s ease;
}

.nav-back-btn svg {
  width: 15px;
  height: 15px;
  stroke: var(--ink);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nav-back-btn:active {
  background: var(--pink-3);
  transform: scale(0.96);
}

.nav-code {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 10px;
  color: #a3989c;
  letter-spacing: .14em;
  text-transform: uppercase;
  user-select: none;
  white-space: nowrap;
  flex-shrink: 0;
}

.nav-code span {
  display: inline-block;
  line-height: 1;
}

.nav-code i {
  display: inline-block;
  width: 28px;
  height: 1px;
  background: var(--pink-2);
}

.nav-manage-btn {
  height: 32px;
  padding: 0 12px;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--pink);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
  cursor: pointer;
  transition: all .2s;
}

.nav-manage-btn:active {
  background: var(--pink-3);
  border-color: var(--pink-2);
}

.nav-placeholder {
  font-size: 10px;
  color: #b6aeb1;
  letter-spacing: .12em;
  font-weight: 500;
}

/* 大标题区 */
.hero-section {
  position: relative;
  margin-bottom: 20px;
  padding-left: 2px;
  transition: all .25s ease;
}

.hero-section.in-register {
  margin-bottom: 14px;
}

.hero-kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: var(--pink);
  letter-spacing: .16em;
  text-transform: uppercase;
  margin-bottom: 6px;
  font-weight: 600;
}

.hero-kicker:before {
  content: "";
  width: 24px;
  height: 1px;
  background: var(--pink-2);
}

.hero-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.hero-title {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  line-height: 1.05;
  margin: 0;
  font-size: 32px;
  font-weight: 750;
  letter-spacing: -.04em;
  color: var(--ink);
}

.hero-section.in-register .hero-title {
  font-size: 30px;
}

.hero-title .backword {
  position: relative;
  top: 3px;
}

.hero-tag-badge {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .12em;
  color: #c7bdc0;
  text-transform: uppercase;
  user-select: none;
}

.hero-sub {
  margin: 10px 0 0;
  font-size: 13px;
  color: #9f989b;
  letter-spacing: .02em;
  line-height: 1.5;
}

.hero-section.in-register .hero-sub {
  margin-top: 6px;
  font-size: 12.5px;
}

/* 档案册主体卡片区 */
.archive-section {
  position: relative;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
}

.archive-bg {
  position: absolute;
  inset: 12px 6px 12px 12px;
  border: 1px solid var(--line-2);
  transform: translate(6px, 6px);
  background: rgba(255,255,255,.45);
  pointer-events: none;
}

.archive-card {
  position: relative;
  background: rgba(255,255,255,.88);
  border: 1px solid var(--line);
  padding: 20px 18px 20px 22px;
  clip-path: polygon(0 0, 88% 0, 94% 6%, 100% 6%, 100% 100%, 0 100%);
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(60, 36, 44, 0.035);
  box-sizing: border-box;
}

.archive-card.reg-card {
  gap: 16px;
  padding: 20px 20px 22px 24px;
  background: rgba(255,255,255,.92);
}

/* 装订线与装订孔 */
.archive-card:before {
  content: "";
  position: absolute;
  left: 9px;
  top: 16px;
  bottom: 16px;
  width: 1px;
  background: var(--line);
}

.archive-card:after {
  content: "";
  position: absolute;
  left: 5px;
  top: 36px;
  width: 9px;
  height: 9px;
  border: 1px solid var(--pink-2);
  border-radius: 50%;
  background: var(--paper);
}

.archive-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.archive-index {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: #9e9397;
  letter-spacing: .12em;
}

.archive-index .num {
  font-size: 20px;
  line-height: 1;
  color: var(--ink);
  letter-spacing: -.04em;
  font-weight: 750;
}

.stamp {
  border: 1px solid var(--pink-2);
  color: var(--pink);
  font-size: 9px;
  padding: 3px 8px;
  letter-spacing: .14em;
  transform: rotate(2deg);
  background: #fffafd;
  font-weight: 600;
  user-select: none;
}

.stamp.empty {
  border-color: var(--pink-2);
  color: var(--pink);
}

.stamp.active {
  border-color: #ff4d4f;
  color: #ff4d4f;
  transform: none;
}

/* 空状态插槽 */
.slot-empty {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 16px;
  align-items: center;
  padding: 16px 0;
  border-top: 1px dashed var(--line);
  border-bottom: 1px dashed var(--line);
  margin-bottom: 16px;
}

.avatar-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
}

.avatar-placeholder {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 1px solid var(--pink-2);
  position: relative;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #ffffff, #fff5f8);
  cursor: pointer;
  transition: transform .2s ease;
}

.avatar-placeholder:hover {
  transform: scale(1.04);
}

.avatar-placeholder:before {
  content: "+";
  color: var(--pink);
  font-weight: 300;
  font-size: 24px;
  line-height: 1;
  transform: translateY(-1px);
}

.avatar-placeholder:after {
  content: "";
  position: absolute;
  inset: -6px;
  border: 1px solid var(--line-2);
  border-radius: 50%;
}

.skeleton {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.sk {
  height: 1px;
  background: var(--line);
}

.sk.w1 { width: 64%; }
.sk.w2 { width: 88%; }
.sk.w3 { width: 48%; }

.mini {
  margin-top: 3px;
  font-size: 9px;
  color: #c2b8bb;
  letter-spacing: .08em;
  font-weight: 500;
}

.empty-note {
  padding: 6px 4px 18px 0;
}

.empty-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 650;
  color: var(--ink);
}

.empty-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: #a29a9d;
}

/* 账号列表容器与卡片 */
.accounts-scroll-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 4px 0 16px;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 2px;
}

.account-entry-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(255,255,255,.94);
  border: 1px solid var(--line);
  border-radius: 8px;
  cursor: pointer;
  transition: all .2s;
}

.account-entry-item:hover {
  border-color: var(--pink-2);
  background: #ffffff;
}

.account-entry-item:active {
  transform: scale(0.99);
}

.account-entry-item.is-selected {
  border-color: var(--pink);
  background: var(--pink-3);
}

.account-entry-item.is-current {
  border-left: 3px solid var(--pink);
}

.entry-index-tag {
  font-size: 9px;
  color: var(--muted);
  font-family: monospace;
}

.entry-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid var(--pink-2);
  background: linear-gradient(135deg, #fff2f5, #ffd9e2);
  background-size: cover;
  background-position: center;
  display: grid;
  place-items: center;
  font-weight: 600;
  font-size: 15px;
  color: var(--pink);
  flex-shrink: 0;
}

.entry-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.entry-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.entry-name {
  font-size: 14px;
  font-weight: 650;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-current-badge {
  font-size: 8px;
  padding: 1px 4px;
  border: 1px solid var(--pink-2);
  border-radius: 3px;
  color: var(--pink);
  background: #fff;
  letter-spacing: .05em;
}

.entry-sub-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #9f989b;
}

.entry-account-id {
  font-family: monospace;
  color: #8c8287;
  font-size: 10px;
}

.entry-persona-brief {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  color: var(--muted);
}

.entry-single-delete {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #c7bdc0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;
  transition: all .2s;
  flex-shrink: 0;
}

.entry-single-delete svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.entry-single-delete:hover {
  color: #ff4d4f;
  background: rgba(255, 77, 79, 0.08);
}

/* 档案右下角注解 (流式对齐) */
.corner-note {
  text-align: right;
  font-size: 9px;
  line-height: 1.5;
  color: #d2c5c9;
  letter-spacing: .10em;
  margin-top: auto;
  margin-bottom: 12px;
  padding-right: 2px;
  user-select: none;
}

/* 底部建立新身份入口 (流式排列) */
.create-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  border-top: 1px solid var(--pink-2);
  padding: 12px 2px 0;
  color: var(--pink);
  cursor: pointer;
  transition: opacity .2s;
  user-select: none;
}

.create-entry:active {
  opacity: 0.7;
}

.create-text-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.create-main {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 650;
  letter-spacing: .02em;
}

.plus-icon {
  font-size: 16px;
  font-weight: 400;
}

.create-text-group small {
  font-size: 9px;
  color: #c4b8bc;
  letter-spacing: .10em;
}

.arrow-circle {
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  border: 1px solid var(--pink-2);
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: #ffffff;
  transition: transform .2s ease;
}

.arrow-circle svg {
  width: 14px;
  height: 14px;
  stroke: var(--pink);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.create-entry:hover .arrow-circle {
  transform: translateX(2px);
}

/* 底部页脚 */
.footer-code {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding: 0 4px;
  color: #d0c6c9;
  font-size: 9px;
  letter-spacing: .11em;
  user-select: none;
}

.footer-code i {
  display: block;
  width: 36px;
  height: 1px;
  background: var(--line-2);
}

/* 注册档案卡统一设计 */
.register-archive-card {
  position: relative;
  background: rgba(255,255,255,.86);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 22px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: 0 10px 30px rgba(60, 36, 44, 0.035);
}

.reg-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px dashed var(--line);
  padding-bottom: 12px;
}

.reg-step-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--pink);
  letter-spacing: .12em;
}

.reg-step-title {
  font-size: 10px;
  color: #b8afb3;
  letter-spacing: .12em;
}

.account-purpose-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line-2);
  border-radius: 8px;
  background: rgba(255,255,255,.6);
}

.purpose-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.purpose-heading strong {
  font-size: 12px;
  color: var(--ink);
}

.purpose-heading span, .linked-account-label {
  font-size: 10px;
  color: var(--muted);
}

.purpose-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.purpose-options button {
  display: flex;
  min-height: 64px;
  padding: 9px;
  border: 1px solid var(--line-2);
  border-radius: 6px;
  background: #fff;
  color: var(--ink);
  text-align: left;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  transition: all .2s;
}

.purpose-options button.active {
  border-color: var(--pink);
  background: var(--pink-3);
}

.purpose-options strong {
  font-size: 12px;
}

.purpose-options span {
  font-size: 9px;
  line-height: 1.4;
  color: var(--muted);
}

.linked-account-options {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.linked-account-options > button {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
  padding: 6px 8px;
  border: 1px solid var(--line-2);
  border-radius: 6px;
  background: #fff;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.linked-account-options > button.selected {
  border-color: var(--pink);
  background: var(--pink-3);
}

.linked-avatar {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--pink-3) center/cover;
  font-size: 11px;
  font-weight: 700;
  color: var(--pink);
  flex-shrink: 0;
}

.linked-account-options strong {
  font-size: 11px;
  display: block;
}

.linked-account-options small {
  font-size: 9px;
  color: var(--muted);
}

.copy-profile-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px;
  border: 1px solid var(--line-2);
  border-radius: 6px;
  background: #fff;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.copy-check {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  flex-shrink: 0;
}

.copy-profile-row.checked .copy-check {
  border-color: var(--pink);
  background: var(--pink);
  color: #fff;
}

.copy-check svg {
  width: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
}

.copy-profile-row strong {
  font-size: 11px;
  display: block;
}

.copy-profile-row small {
  font-size: 9px;
  color: var(--muted);
}

/* 注册头像槽位 */
.form-avatar-box {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border: 1px dashed var(--line);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(255,255,255,.8), rgba(255,248,250,.9));
  cursor: pointer;
  transition: all .2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.form-avatar-box:hover {
  border-color: var(--pink);
  background: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(255, 159, 179, 0.12);
}

.form-avatar-box:active {
  transform: translateY(0);
}

.form-avatar-circle {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 1.5px dashed var(--pink-2);
  background: linear-gradient(180deg, #ffffff, #fff5f7);
  background-size: cover;
  background-position: center;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: border-color .2s ease;
}

.form-avatar-box:hover .form-avatar-circle {
  border-color: var(--pink);
}

.avatar-add-icon {
  font-size: 20px;
  color: var(--pink);
  font-weight: 300;
}

.avatar-tip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.avatar-tip span {
  font-size: 13px;
  font-weight: 650;
  color: var(--ink);
}

.avatar-tip small {
  font-size: 9px;
  color: #b3a6aa;
  letter-spacing: .08em;
}

.avatar-action-badge {
  font-size: 10px;
  font-weight: 600;
  color: var(--pink);
  background: #fff;
  border: 1px solid var(--pink-2);
  padding: 3px 8px;
  border-radius: 12px;
  letter-spacing: .05em;
}

/* 输入表单组 */
.reg-form-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-label {
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  color: #7d7579;
  letter-spacing: .06em;
}

.field-tools-badge {
  display: flex;
  align-items: center;
  gap: 8px;
}

.char-counter {
  font-size: 10px;
  font-weight: 600;
  color: var(--pink);
  background: var(--pink-3);
  padding: 1px 6px;
  border-radius: 10px;
  letter-spacing: .04em;
}

.field-expand-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #ffffff;
  border: 1px solid var(--line);
  color: #8c8287;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 6px;
  cursor: pointer;
  transition: all .2s ease;
}

.field-expand-btn svg {
  width: 11px;
  height: 11px;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.field-expand-btn:hover {
  background: var(--pink-3);
  border-color: var(--pink-2);
  color: var(--pink);
  transform: translateY(-1px);
}

.field-input-box {
  position: relative;
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 12px;
  transition: all .2s ease;
}

.field-input-box:focus-within {
  border-color: var(--pink);
  box-shadow: 0 0 0 3px rgba(255, 159, 179, 0.16);
  background: #ffffff;
}

.field-input-box.error {
  border-color: #ff4d4f;
  box-shadow: 0 0 0 3px rgba(255, 77, 79, 0.12);
}

.field-input-box input {
  width: 100%;
  height: 42px;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13.5px;
  color: var(--ink);
  font-family: inherit;
}

.field-input-box input::placeholder {
  color: #c9bfc3;
}

.field-textarea-box {
  position: relative;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
  transition: all .2s ease;
}

.field-textarea-box:focus-within {
  border-color: var(--pink);
  box-shadow: 0 0 0 3px rgba(255, 159, 179, 0.16);
}

.field-textarea-box textarea {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: var(--ink);
  font-family: inherit;
  resize: none;
  line-height: 1.6;
}

.field-textarea-box textarea::placeholder {
  color: #c9bfc3;
}

.field-clear-btn {
  width: 18px;
  height: 18px;
  border: none;
  background: #f1eaed;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 12px;
  color: #8c8287;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: all .15s;
}

.field-clear-btn:hover {
  background: var(--pink-2);
  color: #fff;
}

.textarea-actions-corner {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.input-err-hint {
  font-size: 10.5px;
  color: #ff4d4f;
  margin-top: 2px;
}

.field-sub-hint {
  font-size: 10.5px;
  color: #a89fa3;
  line-height: 1.45;
  margin-top: 2px;
}

/* 按钮组 */
.form-action-btn {
  width: 100%;
  height: 44px;
  border-radius: 8px;
  background: var(--pink);
  color: #fff;
  border: 1px solid var(--pink);
  font-size: 13.5px;
  font-weight: 650;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all .2s ease;
  letter-spacing: .04em;
  margin-top: 4px;
}

.form-action-btn svg {
  width: 15px;
  height: 15px;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform .2s ease;
}

.form-action-btn:hover:not(:disabled) {
  background: #ff8ca3;
  border-color: #ff8ca3;
  box-shadow: 0 4px 12px rgba(255, 159, 179, 0.28);
}

.form-action-btn:hover:not(:disabled) svg {
  transform: translateX(2px);
}

.form-action-btn:active:not(:disabled) {
  transform: scale(0.99);
}

.form-action-btn:disabled {
  background: #eddde1;
  border-color: #eddde1;
  color: #fff;
  cursor: not-allowed;
}

.form-action-btn.secondary {
  background: #ffffff;
  border-color: var(--line);
  color: #8c8287;
}

.form-action-btn.secondary:hover {
  background: var(--pink-3);
  border-color: var(--pink-2);
  color: var(--pink);
  box-shadow: none;
}

.form-action-group {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

/* 复选框样式 */
.item-checkbox {
  width: 18px;
  height: 18px;
  border: 1px solid var(--pink-2);
  border-radius: 4px;
  background: #fff;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: all .2s;
}

.item-checkbox.checked {
  background: var(--pink);
  border-color: var(--pink);
}

.item-checkbox svg {
  width: 12px;
  height: 12px;
  stroke: #fff;
  stroke-width: 3;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 底部管理操作栏 */
.manage-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 64px;
  background: rgba(255,255,255,.96);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-sizing: border-box;
  z-index: 10;
  box-shadow: 0 -4px 16px rgba(0,0,0,0.03);
}

.select-all {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.batch-delete-btn {
  height: 38px;
  padding: 0 16px;
  border-radius: 6px;
  background: #ff4d4f;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity .2s;
}

.batch-delete-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 自定义确认弹窗 */
.custom-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.custom-modal {
  background: #ffffff;
  width: min(100%, 320px);
  border-radius: 12px;
  border: 1px solid var(--line);
  padding: 22px 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 40px rgba(0,0,0,0.12);
}

.modal-badge {
  font-size: 9px;
  color: #ff4d4f;
  letter-spacing: .12em;
  font-weight: 700;
  margin-bottom: 6px;
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 8px;
}

.modal-desc {
  font-size: 12px;
  color: #8c8287;
  line-height: 1.6;
  margin-bottom: 20px;
}

.modal-actions {
  display: flex;
  gap: 10px;
}

.modal-btn {
  flex: 1;
  height: 38px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
}

.modal-btn.cancel {
  background: #f7f7f8;
  color: #666;
  border-color: #eee;
}

.modal-btn.danger {
  background: #ff4d4f;
  color: #fff;
}

/* 人设大屏全屏编辑器 Modal 样式 */
.expand-editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(47, 48, 51, 0.45);
  backdrop-filter: blur(6px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  box-sizing: border-box;
  animation: fadeIn .2s ease;
}

.expand-editor-card {
  position: relative;
  width: min(100%, 520px);
  max-height: 90vh;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 22px 22px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 16px 40px rgba(60, 36, 44, 0.12);
  box-sizing: border-box;
}

.expand-card-bg {
  position: absolute;
  inset: 8px;
  border: 1px dashed var(--line-2);
  border-radius: 10px;
  pointer-events: none;
}

.expand-header {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.expand-header-left {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.expand-tag {
  font-size: 9px;
  font-weight: 700;
  color: var(--pink);
  letter-spacing: .12em;
}

.expand-title {
  margin: 0;
  font-size: 17px;
  font-weight: 750;
  color: var(--ink);
  letter-spacing: -.02em;
}

.expand-close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: #ffffff;
  display: grid;
  place-items: center;
  color: #8c8287;
  cursor: pointer;
  padding: 0;
  transition: all .2s ease;
  flex-shrink: 0;
}

.expand-close-btn svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.expand-close-btn:hover {
  background: var(--pink-3);
  border-color: var(--pink-2);
  color: var(--pink);
}

.expand-desc {
  margin: 0;
  font-size: 11.5px;
  color: #9f989b;
  line-height: 1.5;
}

.expand-textarea-wrap {
  position: relative;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: inset 0 2px 6px rgba(60, 36, 44, 0.02);
  transition: all .2s ease;
}

.expand-textarea-wrap:focus-within {
  border-color: var(--pink);
  box-shadow: 0 0 0 3px rgba(255, 159, 179, 0.16);
}

.expand-textarea {
  width: 100%;
  height: 220px;
  max-height: 48vh;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13.5px;
  color: var(--ink);
  font-family: inherit;
  resize: vertical;
  line-height: 1.7;
}

.expand-textarea::placeholder {
  color: #c9bfc3;
}

.expand-footer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
}

.expand-footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.expand-char-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #7d7579;
  background: var(--pink-3);
  padding: 4px 10px;
  border-radius: 14px;
  border: 1px solid var(--line-2);
}

.expand-char-badge .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pink);
}

.expand-char-badge strong {
  color: var(--pink);
  font-weight: 700;
}

.expand-clear-text-btn {
  background: transparent;
  border: none;
  font-size: 11px;
  color: #a89fa3;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  transition: color .2s;
}

.expand-clear-text-btn:hover {
  color: #ff4d4f;
}

.expand-confirm-btn {
  height: 38px;
  padding: 0 16px;
  border-radius: 8px;
  background: var(--pink);
  color: #fff;
  border: 1px solid var(--pink);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all .2s ease;
  letter-spacing: .02em;
}

.expand-confirm-btn svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.expand-confirm-btn:hover {
  background: #ff8ca3;
  border-color: #ff8ca3;
  box-shadow: 0 4px 12px rgba(255, 159, 179, 0.28);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
