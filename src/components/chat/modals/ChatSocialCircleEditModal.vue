/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { normalizeSocialCircleItem, type SocialCircleItem } from '../../../services/socialGraph'
import { IMAGE_PROVIDERS, type ImageProviderId } from '../../../services/imageProviderRegistry'
import {
  generateSocialAvatarImage,
  inferSocialAvatarConcept,
  resolveSocialAvatarSource,
  saveSocialAvatarAsset,
  type SocialAvatarConcept
} from '../../../services/socialAvatar'
import ChatImageProviderModal from './ChatImageProviderModal.vue'
export type SocialContactItem = SocialCircleItem

const props = defineProps<{
  visible: boolean
  editItem?: SocialContactItem | null
  ownerChat?: any
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'save', item: SocialContactItem): void
}>()

const form = ref<SocialContactItem>(normalizeSocialCircleItem({ id: '', name: '', relation: '', category: 'friend' }))
const avatarPreview = ref('')
const pendingAvatar = ref<Blob | string | null>(null)
const pendingGeneratedAvatar = ref(false)
const showAvatarGenerator = ref(false)
const showProviderModal = ref(false)
const avatarProvider = ref<ImageProviderId>('novelai')
const avatarConcept = ref<SocialAvatarConcept | null>(null)
const avatarGenerating = ref(false)
const avatarError = ref('')
const saving = ref(false)
let previewObjectUrl = ''
let generationSession = 0

const providerName = computed(() => IMAGE_PROVIDERS.find(item => item.id === avatarProvider.value)?.name || '生图引擎')

const setAvatarPreview = (url: string, isObjectUrl = false) => {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
  previewObjectUrl = isObjectUrl ? url : ''
  avatarPreview.value = url
}

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
  async (val) => {
    if (val) {
      const session = ++generationSession
      setAvatarPreview('')
      pendingAvatar.value = null
      pendingGeneratedAvatar.value = false
      showAvatarGenerator.value = false
      avatarConcept.value = null
      avatarError.value = ''
      saving.value = false
      avatarProvider.value = (IMAGE_PROVIDERS.some(item => item.id === props.ownerChat?.imageGenProvider)
        ? props.ownerChat.imageGenProvider
        : 'novelai') as ImageProviderId
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
      const resolved = await resolveSocialAvatarSource(form.value.avatarKey, form.value.avatarUrl)
      if (session !== generationSession) {
        if (resolved.objectUrl) URL.revokeObjectURL(resolved.url)
        return
      }
      setAvatarPreview(resolved.url, resolved.objectUrl)
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
    if (!file) return
    pendingAvatar.value = file
    pendingGeneratedAvatar.value = false
    form.value.avatarUrl = ''
    form.value.avatarGeneration = undefined
    avatarError.value = ''
    setAvatarPreview(URL.createObjectURL(file), true)
  }
  input.click()
}

const handleClearAvatar = () => {
  pendingAvatar.value = null
  pendingGeneratedAvatar.value = false
  form.value.avatarKey = ''
  form.value.avatarUrl = ''
  form.value.avatarGeneration = undefined
  setAvatarPreview('')
}

const handleProviderSelect = (provider: string) => {
  if (IMAGE_PROVIDERS.some(item => item.id === provider)) avatarProvider.value = provider as ImageProviderId
}

const inferAvatar = async () => {
  avatarError.value = ''
  avatarConcept.value = await inferSocialAvatarConcept(normalizeSocialCircleItem(form.value), props.ownerChat)
}

const handleGenerateAvatar = async (reinfer = false) => {
  if (avatarGenerating.value) return
  avatarGenerating.value = true
  avatarError.value = ''
  const session = generationSession
  try {
    if (reinfer || !avatarConcept.value) await inferAvatar()
    if (!avatarConcept.value) throw new Error('没有可用的头像构想')
    const image = await generateSocialAvatarImage(
      normalizeSocialCircleItem(form.value),
      props.ownerChat,
      avatarProvider.value,
      avatarConcept.value
    )
    if (session !== generationSession) return
    pendingAvatar.value = image
    pendingGeneratedAvatar.value = true
    form.value.avatarUrl = ''
    setAvatarPreview(image)
  } catch (error: any) {
    if (session === generationSession) avatarError.value = error?.message || '头像生成失败，请检查 API 设置后重试'
  } finally {
    if (session === generationSession) avatarGenerating.value = false
  }
}

const handleClose = () => {
  generationSession += 1
  avatarGenerating.value = false
  setAvatarPreview('')
  emit('update:visible', false)
}

const handleSave = async () => {
  if (!form.value.name.trim()) {
    return
  }
  saving.value = true
  avatarError.value = ''
  try {
    let source = pendingAvatar.value
    if (!source && form.value.avatarUrl?.startsWith('data:')) source = form.value.avatarUrl
    if (source) {
      form.value.avatarKey = await saveSocialAvatarAsset(form.value.entityId, source)
      form.value.avatarUrl = ''
      if (pendingGeneratedAvatar.value && avatarConcept.value) {
        form.value.avatarGeneration = {
          provider: avatarProvider.value,
          concept: avatarConcept.value.concept,
          prompt: avatarConcept.value.visualPrompt,
          generatedAt: Date.now()
        }
      }
    }
    if (form.value.avatarUrl?.startsWith('data:')) form.value.avatarUrl = ''
    if (!form.value.nickname.trim() || form.value.nickname === '未命名人物') form.value.nickname = form.value.name.trim()
    form.value.updatedAt = Date.now()
    emit('save', normalizeSocialCircleItem(JSON.parse(JSON.stringify(form.value))))
    handleClose()
  } catch (error: any) {
    avatarError.value = error?.message || '头像保存失败，请检查浏览器存储空间'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="social-edit-modal-overlay" @click.self="handleClose">
    <div class="social-edit-modal">
      <!-- 头部 -->
      <div class="social-edit-header">
        <button class="social-edit-btn-cancel" @click="handleClose">取消</button>
        <div class="social-edit-title">{{ editItem ? '编辑社交人脉' : '新建社交人脉' }}</div>
        <button class="social-edit-btn-save" :disabled="!form.name.trim() || saving" @click="handleSave">{{ saving ? '保存中…' : '保存' }}</button>
      </div>

      <!-- 表单主体 -->
      <div class="social-edit-body">
        <!-- 头像区 -->
        <div class="social-avatar-section">
          <div class="social-avatar-uploader" @click="handleAvatarPick">
            <img v-if="avatarPreview" :src="avatarPreview" class="social-avatar-preview" />
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
          <div class="social-avatar-hint">头像保存在本机图片库，不占用联系人文本存储</div>
          <div class="social-avatar-actions">
            <button type="button" class="social-avatar-action" @click="handleAvatarPick">本地上传</button>
            <button type="button" class="social-avatar-action primary" @click="showAvatarGenerator = !showAvatarGenerator">AI 推测头像</button>
            <button v-if="avatarPreview" type="button" class="social-avatar-action danger" @click="handleClearAvatar">清除</button>
          </div>
          <p v-if="avatarError && !showAvatarGenerator" class="social-avatar-error">{{ avatarError }}</p>
        </div>

        <div v-if="showAvatarGenerator" class="social-avatar-ai-card">
          <div class="social-avatar-ai-head">
            <div><strong>按性格推测头像</strong><span>推测此人会主动使用的头像，不默认生成本人照片</span></div>
            <button type="button" class="social-provider-btn" @click="showProviderModal = true">{{ providerName }}</button>
          </div>
          <div v-if="avatarConcept" class="social-avatar-concept">
            <div class="social-avatar-concept-title">头像构想</div>
            <textarea v-model="avatarConcept.concept" class="social-avatar-concept-textarea compact" rows="2" maxlength="160"></textarea>
            <div v-if="avatarConcept.choiceBasis" class="social-avatar-basis">{{ avatarConcept.choiceBasis }}</div>
            <div class="social-avatar-concept-title prompt">画面描述</div>
            <textarea v-model="avatarConcept.visualPrompt" class="social-avatar-concept-textarea" rows="4" maxlength="3000"></textarea>
          </div>
          <div v-else class="social-avatar-ai-empty">填写姓名和性格设定后，AI 会先判断适合真人、动物、风景、物件、插画或抽象图形，再进行生图。</div>
          <p v-if="avatarError" class="social-avatar-error">{{ avatarError }}</p>
          <div class="social-avatar-ai-actions">
            <button v-if="avatarConcept" type="button" class="social-ai-secondary" :disabled="avatarGenerating" @click="handleGenerateAvatar(true)">重新推测</button>
            <button type="button" class="social-ai-generate" :disabled="avatarGenerating || !form.name.trim() || !form.persona.trim()" @click="handleGenerateAvatar(false)">{{ avatarGenerating ? '正在推测并生成…' : avatarConcept ? '按此构想生成' : '推测并生成头像' }}</button>
          </div>
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
    <ChatImageProviderModal v-model:visible="showProviderModal" :current-provider="avatarProvider" :z-index="10080" @select="handleProviderSelect" />
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

.social-avatar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.social-avatar-action,
.social-provider-btn,
.social-ai-secondary,
.social-ai-generate {
  border: 1px solid #e3e3e4;
  border-radius: 8px;
  background: #f6f6f7;
  color: #555555;
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.social-avatar-action {
  height: 29px;
  padding: 0 10px;
}

.social-avatar-action.primary,
.social-ai-generate {
  border-color: #1a1a1a;
  background: #1a1a1a;
  color: #ffffff;
}

.social-avatar-action.danger {
  color: #a25b59;
}

.social-avatar-action:hover,
.social-provider-btn:hover,
.social-ai-secondary:hover {
  border-color: #cfcfd1;
  background: #eeeeef;
}

.social-avatar-ai-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 13px;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  background: #fafafa;
}

.social-avatar-ai-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.social-avatar-ai-head > div {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.social-avatar-ai-head strong {
  color: #252525;
  font-size: 12.5px;
}

.social-avatar-ai-head span,
.social-avatar-ai-empty,
.social-avatar-basis {
  color: #858585;
  font-size: 10.5px;
  line-height: 1.45;
}

.social-provider-btn {
  flex: 0 0 auto;
  min-width: 74px;
  height: 28px;
  padding: 0 9px;
  background: #ffffff;
}

.social-avatar-concept {
  padding: 10px;
  border: 1px solid #ebebeb;
  border-radius: 10px;
  background: #ffffff;
}

.social-avatar-concept-title {
  margin-bottom: 5px;
  color: #626262;
  font-size: 10.5px;
  font-weight: 600;
}

.social-avatar-concept-title.prompt {
  margin-top: 9px;
}

.social-avatar-concept-textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 9px;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  outline: none;
  resize: vertical;
  background: #f8f8f9;
  color: #2a2a2a;
  font-family: inherit;
  font-size: 11.5px;
  line-height: 1.5;
}

.social-avatar-concept-textarea:focus {
  border-color: #bdbdbd;
  background: #ffffff;
}

.social-avatar-concept-textarea.compact {
  resize: none;
}

.social-avatar-basis {
  margin-top: 5px;
  padding-left: 2px;
}

.social-avatar-error {
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 8px 9px;
  border-radius: 8px;
  background: #fff1f0;
  color: #b64b47;
  font-size: 10.5px;
  line-height: 1.4;
}

.social-avatar-ai-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}

.social-ai-secondary,
.social-ai-generate {
  min-height: 31px;
  padding: 0 11px;
}

.social-ai-generate:disabled,
.social-ai-secondary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
