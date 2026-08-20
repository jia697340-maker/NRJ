/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'
import { normalizeSocialCircleItem, type SocialCircleItem } from '../../../services/socialGraph'
export type SocialContactItem = SocialCircleItem

const props = defineProps<{
  visible: boolean
  editItem?: SocialContactItem | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'save', item: SocialContactItem): void
}>()

const form = ref<SocialContactItem>(normalizeSocialCircleItem({ id: '', name: '', relation: '', category: 'friend' }))

const quickRelations = [
  { label: '母亲', cat: 'family' as const },
  { label: '父亲', cat: 'family' as const },
  { label: '兄弟姐妹', cat: 'family' as const },
  { label: '挚友发小', cat: 'friend' as const },
  { label: '同窗好友', cat: 'friend' as const },
  { label: '室友邻里', cat: 'friend' as const },
  { label: '工作搭档', cat: 'work' as const },
  { label: '导师领导', cat: 'work' as const },
  { label: '点头之交', cat: 'other' as const }
]

watch(
  () => props.visible,
  (val) => {
    if (val) {
      if (props.editItem) {
        form.value = JSON.parse(JSON.stringify(props.editItem))
      } else {
        form.value = normalizeSocialCircleItem({
          id: 'sc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          entityId: 'social_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          name: '',
          relation: '',
          category: 'friend',
          persona: '',
          avatarUrl: '',
          enableMoments: true,
          interactionFrequency: 'medium',
          note: '',
          origin: 'manual'
        })
      }
    }
  },
  { immediate: true }
)

const selectQuickRelation = (item: { label: string; cat: 'family' | 'friend' | 'work' | 'other' }) => {
  form.value.relation = item.label
  form.value.category = item.cat
}

const handleAvatarPick = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e: any) => {
    const file = e.target?.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        form.value.avatarUrl = reader.result as string
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

const handleClose = () => {
  emit('update:visible', false)
}

const handleSave = () => {
  if (!form.value.name.trim()) {
    return
  }
  if (!form.value.nickname.trim() || form.value.nickname === '未命名人物') form.value.nickname = form.value.name.trim()
  form.value.updatedAt = Date.now()
  emit('save', normalizeSocialCircleItem(JSON.parse(JSON.stringify(form.value))))
  handleClose()
}
</script>

<template>
  <div v-if="visible" class="social-edit-modal-overlay" @click.self="handleClose">
    <div class="social-edit-modal">
      <!-- 头部 -->
      <div class="social-edit-header">
        <button class="social-edit-btn-cancel" @click="handleClose">取消</button>
        <div class="social-edit-title">{{ editItem ? '编辑社交人脉' : '新建社交人脉' }}</div>
        <button class="social-edit-btn-save" :disabled="!form.name.trim()" @click="handleSave">保存</button>
      </div>

      <!-- 表单主体 -->
      <div class="social-edit-body">
        <!-- 头像区 -->
        <div class="social-avatar-section">
          <div class="social-avatar-uploader" @click="handleAvatarPick">
            <img v-if="form.avatarUrl" :src="form.avatarUrl" class="social-avatar-preview" />
            <div v-else class="social-avatar-placeholder">
              <span>{{ form.name ? form.name.slice(0, 1) : '脉' }}</span>
            </div>
            <div class="social-avatar-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </div>
          <div class="social-avatar-hint">点击设置人物头像</div>
        </div>

        <!-- 基本信息区 -->
        <div class="social-form-group">
          <div class="social-form-label">基础设定</div>
          <div class="social-input-row">
            <span class="social-input-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <input
              v-model="form.name"
              class="social-input"
              type="text"
              placeholder="输入姓名或称呼 (如: 陆伯伯、周敏)"
              maxlength="20"
            />
          </div>

          <div class="social-input-row">
            <span class="social-input-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <input
              v-model="form.relation"
              class="social-input"
              type="text"
              placeholder="与角色的关系 (如: 母亲、发小、乐队鼓手)"
              maxlength="20"
            />
          </div>

          <!-- 快速关系标签 -->
          <div class="social-quick-tags">
            <button
              v-for="item in quickRelations"
              :key="item.label"
              type="button"
              class="social-quick-tag"
              :class="{ active: form.relation === item.label }"
              @click="selectQuickRelation(item)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div class="social-form-group">
          <div class="social-form-label">主页资料</div>
          <div class="social-input-row"><span class="social-input-icon">@</span><input v-model="form.nickname" class="social-input" type="text" maxlength="30" placeholder="对外显示的网名" /></div>
          <div class="social-input-row"><span class="social-input-icon">ID</span><input v-model="form.socialId" class="social-input" type="text" maxlength="20" placeholder="4～20 位字母、数字、下划线或短横线" /></div>
          <div class="social-textarea-wrapper"><textarea v-model="form.signature" class="social-textarea" rows="2" maxlength="120" placeholder="个性签名"></textarea><div class="social-char-count">{{ form.signature.length }}/120</div></div>
        </div>

        <!-- 分类归属 -->
        <div class="social-form-group">
          <div class="social-form-label">人脉分类</div>
          <div class="social-pill-group">
            <button
              type="button"
              class="social-pill-btn"
              :class="{ active: form.category === 'family' }"
              @click="form.category = 'family'"
            >
              亲人家眷
            </button>
            <button
              type="button"
              class="social-pill-btn"
              :class="{ active: form.category === 'friend' }"
              @click="form.category = 'friend'"
            >
              知己朋友
            </button>
            <button
              type="button"
              class="social-pill-btn"
              :class="{ active: form.category === 'work' }"
              @click="form.category = 'work'"
            >
              职场学业
            </button>
            <button
              type="button"
              class="social-pill-btn"
              :class="{ active: form.category === 'other' }"
              @click="form.category = 'other'"
            >
              其他羁绊
            </button>
          </div>
        </div>

        <div class="social-form-group">
          <div class="social-form-label">主页隐私</div>
          <div class="social-pill-group privacy-pills">
            <button v-for="privacy in [{id:'public',label:'公开'},{id:'limited',label:'好友可见'},{id:'private',label:'私密'},{id:'hidden',label:'隐藏'}]" :key="privacy.id" type="button" class="social-pill-btn" :class="{ active: form.privacy === privacy.id }" @click="form.privacy = privacy.id as any">{{ privacy.label }}</button>
          </div>
          <div class="social-switch-row"><div class="social-switch-text"><div class="social-switch-title">允许被发现</div><div class="social-switch-sub">可在人脉页打开此人的主页</div></div><label class="social-switch"><input v-model="form.discoverable" type="checkbox" :disabled="form.privacy === 'hidden'" /><span class="social-switch-slider"></span></label></div>
          <div class="social-switch-row"><div class="social-switch-text"><div class="social-switch-title">接受好友申请</div><div class="social-switch-sub">对方仍会按人设自主同意或拒绝</div></div><label class="social-switch"><input v-model="form.allowFriendRequests" type="checkbox" /><span class="social-switch-slider"></span></label></div>
          <div class="social-switch-row"><div class="social-switch-text"><div class="social-switch-title">在对方人脉圈显示主角色</div><div class="social-switch-sub">建立可见的双向关系，不代表亲密度完全对称</div></div><label class="social-switch"><input v-model="form.reciprocalVisible" type="checkbox" /><span class="social-switch-slider"></span></label></div>
          <div class="social-switch-row"><div class="social-switch-text"><div class="social-switch-title">允许自然提及</div><div class="social-switch-sub">角色可在合适的话题中提到此人</div></div><label class="social-switch"><input v-model="form.allowMention" type="checkbox" /><span class="social-switch-slider"></span></label></div>
        </div>

        <!-- 性格特征与口吻 -->
        <div class="social-form-group">
          <div class="social-form-label">性格设定与口吻描述</div>
          <div class="social-textarea-wrapper">
            <textarea
              v-model="form.persona"
              class="social-textarea"
              rows="3"
              placeholder="描述该人物的性格特点、口癖、与角色的日常相处方式..."
              maxlength="400"
            ></textarea>
            <div class="social-char-count">{{ form.persona.length }}/400</div>
          </div>
        </div>

        <!-- 朋友圈互动配置 -->
        <div class="social-form-group">
          <div class="social-form-label">朋友圈互动偏好</div>
          <div class="social-switch-row">
            <div class="social-switch-text">
              <div class="social-switch-title">朋友圈动态互动</div>
              <div class="social-switch-sub">允许在角色发布朋友圈或日常中产生互动</div>
            </div>
            <label class="social-switch">
              <input v-model="form.enableMoments" type="checkbox" />
              <span class="social-switch-slider"></span>
            </label>
          </div>

          <div v-if="form.enableMoments" class="social-freq-container">
            <div class="social-freq-label">互动活跃度</div>
            <div class="social-pill-group">
              <button
                type="button"
                class="social-pill-btn small"
                :class="{ active: form.interactionFrequency === 'high' }"
                @click="form.interactionFrequency = 'high'"
              >
                频繁热情
              </button>
              <button
                type="button"
                class="social-pill-btn small"
                :class="{ active: form.interactionFrequency === 'medium' }"
                @click="form.interactionFrequency = 'medium'"
              >
                偶尔互动
              </button>
              <button
                type="button"
                class="social-pill-btn small"
                :class="{ active: form.interactionFrequency === 'low' }"
                @click="form.interactionFrequency = 'low'"
              >
                安静围观
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.social-edit-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(30, 24, 20, 0.65);
  backdrop-filter: blur(8px);
  z-index: 10050;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.social-edit-modal {
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  background: #ffffff;
  border: 1px solid #eaeaea;
  border-bottom: none;
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: socialSlideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.1);
}

@keyframes socialSlideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.social-edit-header {
  height: 52px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.social-edit-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}

.social-edit-btn-cancel,
.social-edit-btn-save {
  background: transparent;
  border: none;
  font-size: 13.5px;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.social-edit-btn-cancel {
  color: #888888;
}

.social-edit-btn-cancel:hover {
  background: #f5f5f7;
  color: #1a1a1a;
}

.social-edit-btn-save {
  background: #1a1a1a;
  color: #ffffff;
  font-weight: 500;
}

.social-edit-btn-save:hover {
  background: #333333;
}

.social-edit-btn-save:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.social-edit-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 16px 36px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background-color: #ffffff;
}

/* 头像设置 */
.social-avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.social-avatar-uploader {
  position: relative;
  width: 68px;
  height: 68px;
  border-radius: 12px;
  cursor: pointer;
}

.social-avatar-preview {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid #e5e5e5;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.social-avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  background: #f7f7f8;
  border: 1px dashed #dcdcdc;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666666;
  font-size: 22px;
  font-weight: 600;
}

.social-avatar-badge {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #1a1a1a;
  border: 1.5px solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.social-avatar-hint {
  font-size: 11.5px;
  color: #888888;
}

/* 表单组合 */
.social-form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.social-form-label {
  font-size: 12.5px;
  font-weight: 600;
  color: #333333;
  padding-left: 2px;
}

.social-input-row {
  display: flex;
  align-items: center;
  background: #f8f8f9;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  padding: 0 12px;
  height: 40px;
  gap: 10px;
}

.social-input-icon {
  color: #999999;
  display: flex;
  align-items: center;
}

.social-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #1a1a1a;
  font-size: 13.5px;
}

.social-input::placeholder {
  color: #aaaaaa;
}

/* 快捷关系标签 */
.social-quick-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.social-quick-tag {
  background: #f2f2f3;
  border: 1px solid #e5e5e6;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11.5px;
  color: #555555;
  cursor: pointer;
  transition: all 0.15s ease;
}

.social-quick-tag.active {
  background: #1a1a1a;
  border-color: #1a1a1a;
  color: #ffffff;
  font-weight: 500;
}

/* 胶囊单选按钮 */
.social-pill-group {
  display: flex;
  gap: 8px;
}

.social-pill-btn {
  flex: 1;
  height: 34px;
  background: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  color: #666666;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.social-pill-btn.small {
  height: 30px;
  font-size: 11.5px;
}

.social-pill-btn.active {
  background: #1a1a1a;
  border-color: #1a1a1a;
  color: #ffffff;
  font-weight: 500;
}

/* 文本域 */
.social-textarea-wrapper {
  position: relative;
  background: #f8f8f9;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  padding: 10px 12px 24px;
}

.social-textarea {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  color: #1a1a1a;
  font-size: 13px;
  line-height: 1.5;
  font-family: inherit;
}

.social-textarea::placeholder {
  color: #aaaaaa;
}

.social-char-count {
  position: absolute;
  right: 10px;
  bottom: 6px;
  font-size: 10.5px;
  color: #aaaaaa;
}

/* 开关行 */
.social-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fafafa;
  border: 1px solid #ebebeb;
  border-radius: 10px;
  padding: 12px;
}

.social-switch-title {
  font-size: 13.5px;
  color: #1a1a1a;
  font-weight: 500;
}

.social-switch-sub {
  font-size: 11.5px;
  color: #888888;
  margin-top: 2px;
}

.social-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.social-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.social-switch-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: #dcdcdc;
  border-radius: 24px;
  transition: 0.2s;
}

.social-switch-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: 0.2s;
}

.social-switch input:checked + .social-switch-slider {
  background-color: #10b981;
}

.social-switch input:checked + .social-switch-slider:before {
  transform: translateX(20px);
}

.social-freq-container {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.social-freq-label {
  font-size: 11.5px;
  color: #8c7b6f;
}
</style>
