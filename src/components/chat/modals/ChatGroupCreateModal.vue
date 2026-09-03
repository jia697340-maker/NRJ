/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createGroupChat, type GroupChatRecord } from '../../../services/groupChat'

const props = defineProps<{
  visible: boolean
  chats: any[]
  userProfile: any
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
  (e: 'created', group: GroupChatRecord): void
}>()

const seqId = ref('')
const name = ref('')
const groupContext = ref('')
const selectedIds = ref<Set<string>>(new Set())
const errorText = ref('')

const contacts = computed(() => {
  return (props.chats || []).filter(chat => chat.id !== 1 && chat.chatType !== 'group' && chat.contactState !== 'candidate')
})

const resetForm = () => {
  seqId.value = String(Date.now()).slice(-6)
  name.value = ''
  groupContext.value = ''
  selectedIds.value = new Set()
  errorText.value = ''
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      resetForm()
    }
  },
  { immediate: true }
)

const closeModal = () => {
  emit('update:visible', false)
  emit('close')
}

const toggleMember = (chat: any) => {
  const id = String(chat.characterEntityId || chat.id)
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
  if (errorText.value) {
    errorText.value = ''
  }
}

const handleCreate = () => {
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    errorText.value = '请填写群名称'
    return
  }
  if (selectedIds.value.size < 2) {
    errorText.value = '请至少选择两位群成员'
    return
  }

  const group = createGroupChat(
    {
      name: trimmedName,
      groupContext: groupContext.value.trim(),
      memberIds: [...selectedIds.value]
    },
    props.userProfile
  )

  emit('created', group)
  closeModal()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="canvas-modal-overlay" @click.self="closeModal">
      <div class="canvas-modal-content group-canvas-content">
        <!-- 顶栏元信息与关闭按钮 -->
        <div class="canvas-meta-header">
          <div class="canvas-meta">
            <span>GROUP-{{ seqId }}</span>
            <span>·</span>
            <span>群聊档案建立</span>
          </div>
          <div class="canvas-close-btn" aria-label="关闭" @click="closeModal">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
        </div>

        <!-- 头部群名称与主视觉 -->
        <div class="canvas-header">
          <div class="canvas-portrait group-portrait-badge">
            <div class="portrait-group-icon">
              <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <span class="portrait-group-letter">{{ name ? name.charAt(0) : '群' }}</span>
          </div>
          <div class="canvas-names">
            <input
              type="text"
              v-model="name"
              class="canvas-h1"
              maxlength="40"
              placeholder="群聊名称"
              autocomplete="off"
              @input="errorText = ''"
            />
            <div class="canvas-sub">群聊与多人共处会话</div>
          </div>
        </div>

        <div class="canvas-divider"></div>

        <!-- 表单主体滚动区 -->
        <div class="canvas-body group-canvas-scroll">
          <!-- 群背景设定 -->
          <div class="group-canvas-block">
            <div class="canvas-label-row">
              <span class="canvas-label">群背景设定</span>
              <span class="canvas-sub-tag">选填</span>
            </div>
            <textarea
              v-model="groupContext"
              class="canvas-textarea group-context-textarea"
              maxlength="2000"
              placeholder="例如：大家是同个课题组的同学。留空时不添加额外群背景设定。"
            ></textarea>
          </div>

          <div class="canvas-inner-divider"></div>

          <!-- 成员选择区 -->
          <div class="group-canvas-block member-block">
            <div class="canvas-label-row">
              <span class="canvas-label">选择群成员</span>
              <span class="canvas-member-count" :class="{ 'is-met': selectedIds.size >= 2 }">
                已选 {{ selectedIds.size }} 人 (需≥2人)
              </span>
            </div>

            <div v-if="contacts.length > 0" class="canvas-member-list">
              <div
                v-for="chat in contacts"
                :key="chat.id"
                class="canvas-member-item"
                :class="{ 'is-selected': selectedIds.has(String(chat.characterEntityId || chat.id)) }"
                @click="toggleMember(chat)"
              >
                <div
                  class="member-avatar-box"
                  :style="chat.avatarUrl ? { backgroundImage: `url(${chat.avatarUrl})` } : {}"
                >
                  <span v-if="!chat.avatarUrl">{{ chat.avatarText || chat.name?.charAt(0) || '友' }}</span>
                </div>

                <div class="member-meta-info">
                  <div class="member-title-row">
                    <span class="member-main-name">{{ chat.name }}</span>
                    <span v-if="chat.remark" class="member-remark-tag">{{ chat.remark }}</span>
                  </div>
                  <div class="member-intro">{{ chat.persona || '暂无详细人设' }}</div>
                </div>

                <div class="member-check-circle" :class="{ 'checked': selectedIds.has(String(chat.characterEntityId || chat.id)) }">
                  <svg v-if="selectedIds.has(String(chat.characterEntityId || chat.id))" viewBox="0 0 24 24" width="12" height="12" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>
            </div>

            <div v-else class="canvas-empty-notice">
              <p>暂无可选角色，请先在联系人列表中创建角色</p>
            </div>
          </div>

          <!-- 错误提醒 -->
          <div v-if="errorText" class="canvas-error-pill">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{{ errorText }}</span>
          </div>
        </div>

        <!-- 悬浮创建 FAB 胶囊按钮 -->
        <div
          class="canvas-fab"
          :class="{ 'disabled': !name.trim() || selectedIds.size < 2 }"
          @click="handleCreate"
        >
          建立群聊
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* 无界档案画布遮罩与主容器 */
.canvas-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(245, 245, 247, 0.82);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10005;
  animation: canvasOverlayIn 0.22s ease-out;
}

.canvas-modal-content.group-canvas-content {
  background: #ffffff;
  border-radius: 20px;
  width: 90%;
  max-width: 380px;
  height: 84%;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  position: relative;
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.02);
  overflow: hidden;
  padding: 28px 22px 24px;
  box-sizing: border-box;
  animation: canvasModalIn 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 顶部元数据栏 */
.canvas-meta-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 22px;
  flex-shrink: 0;
}

.canvas-meta {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  color: #999999;
  letter-spacing: 0.8px;
  display: flex;
  gap: 6px;
  align-items: center;
  font-weight: 600;
  text-transform: uppercase;
}

.canvas-close-btn {
  color: #999999;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.canvas-close-btn:hover {
  color: #111111;
  background-color: #f2f2f2;
}

.canvas-close-btn:active {
  transform: scale(0.92);
}

/* 主视觉头部 */
.canvas-header {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.group-portrait-badge {
  width: 62px;
  height: 62px;
  border-radius: 14px;
  background-color: #f7f7f8;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  border: 1px solid #eeeeee;
  color: #555555;
  position: relative;
  overflow: hidden;
}

.portrait-group-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.85;
}

.portrait-group-letter {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #888888;
  margin-top: 1px;
}

.canvas-names {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.canvas-h1 {
  border: none;
  outline: none;
  background: transparent;
  width: 100%;
  font-size: 22px;
  font-weight: 700;
  color: #111111;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
  letter-spacing: -0.3px;
}

.canvas-h1::placeholder {
  color: #cccccc;
  font-weight: 500;
}

.canvas-sub {
  font-size: 12px;
  font-weight: 400;
  color: #999999;
  letter-spacing: 0.2px;
}

/* 分割线 */
.canvas-divider {
  width: 100%;
  height: 1px;
  background: #f0f0f0;
  margin-bottom: 18px;
  flex-shrink: 0;
}

.canvas-inner-divider {
  width: 100%;
  height: 1px;
  background: #f7f7f7;
  margin: 14px 0 12px;
  flex-shrink: 0;
}

/* 滚动区域 */
.group-canvas-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 2px;
  padding-bottom: 56px;
  box-sizing: border-box;
}

.group-canvas-scroll::-webkit-scrollbar {
  width: 4px;
}
.group-canvas-scroll::-webkit-scrollbar-thumb {
  background: #e2e2e2;
  border-radius: 4px;
}

.group-canvas-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.canvas-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.canvas-label {
  font-size: 11px;
  font-weight: 700;
  color: #333333;
  letter-spacing: 1px;
  text-transform: uppercase;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
}

.canvas-sub-tag {
  font-size: 11px;
  color: #bbbbbb;
}

.canvas-member-count {
  font-size: 11px;
  color: #999999;
  font-weight: 500;
  background: #f5f5f5;
  padding: 2px 7px;
  border-radius: 6px;
  transition: all 0.2s;
}

.canvas-member-count.is-met {
  color: #111111;
  background: #eaeaea;
  font-weight: 600;
}

/* 文本域 */
.canvas-textarea.group-context-textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 60px;
  border: none;
  outline: none;
  background: transparent;
  resize: none;
  font-size: 13px;
  line-height: 1.6;
  color: #222222;
  padding: 4px 0;
  font-family: inherit;
}

.canvas-textarea.group-context-textarea::placeholder {
  color: #cccccc;
  font-size: 13px;
}

/* 成员列表 */
.canvas-member-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.canvas-member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #f2f2f2;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.18s, border-color 0.18s, transform 0.1s;
}

.canvas-member-item:hover {
  background-color: #fafafa;
  border-color: #e5e5e5;
}

.canvas-member-item.is-selected {
  background-color: #f9f9f9;
  border-color: #111111;
}

.canvas-member-item:active {
  transform: scale(0.99);
}

.member-avatar-box {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background-color: #f0f0f0;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: #666666;
  flex-shrink: 0;
  border: 1px solid #eaeaea;
}

.member-meta-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.member-main-name {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-remark-tag {
  font-size: 10px;
  color: #888888;
  background: #f0f0f0;
  padding: 1px 4px;
  border-radius: 4px;
  flex-shrink: 0;
}

.member-intro {
  font-size: 11px;
  color: #8c8c8c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-check-circle {
  width: 19px;
  height: 19px;
  border-radius: 50%;
  border: 1.5px solid #d4d4d4;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  transition: all 0.18s ease;
}

.member-check-circle.checked {
  background-color: #111111;
  border-color: #111111;
}

/* 空状态 */
.canvas-empty-notice {
  padding: 20px 12px;
  text-align: center;
  color: #aaaaaa;
  font-size: 12px;
}

.canvas-empty-notice p {
  margin: 0;
}

/* 错误提示 */
.canvas-error-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #fff2f2;
  border-radius: 8px;
  color: #e53935;
  font-size: 12px;
  margin-top: 6px;
}

/* 右下角 FAB 浮动按钮 */
.canvas-fab {
  position: absolute;
  right: 22px;
  bottom: 22px;
  background: #111111;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.8px;
  padding: 10px 22px;
  border-radius: 100px;
  cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.14);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  z-index: 10;
}

.canvas-fab:hover:not(.disabled) {
  background: #282828;
  transform: translateY(-1px);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.18);
}

.canvas-fab:active:not(.disabled) {
  transform: scale(0.96);
}

.canvas-fab.disabled {
  background: #f0f0f2;
  color: #b5b5b8;
  box-shadow: none;
  cursor: not-allowed;
  pointer-events: none;
}

/* 进场动画 */
@keyframes canvasOverlayIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes canvasModalIn {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
