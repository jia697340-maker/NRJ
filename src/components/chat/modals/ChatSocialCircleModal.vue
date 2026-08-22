/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import ChatSocialCircleEditModal, { type SocialContactItem } from './ChatSocialCircleEditModal.vue'
import { generateSocialCircleDraft, normalizeSocialCircleSettings, type SocialCircleSettings } from '../../../services/socialGraph'
import { syncSocialCircleToDirectory } from '../../../services/characterDirectory'
import { removeSocialAvatarIfUnused, resolveSocialAvatarSource, saveSocialAvatarAsset } from '../../../services/socialAvatar'

const props = defineProps<{
  visible: boolean
  selectedChat: any
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'save'): void
}>()

const activeTab = ref<'all' | 'family' | 'friend' | 'work' | 'other'>('all')
const showEditModal = ref(false)
const editingContact = ref<SocialContactItem | null>(null)
const searchQuery = ref('')
const generating = ref(false)
const generationError = ref('')
const avatarSources = ref<Record<string, string>>({})
let avatarLoadToken = 0
const avatarObjectUrls = new Set<string>()

const settings = computed<SocialCircleSettings>(() => normalizeSocialCircleSettings(props.selectedChat))
const persist = () => {
  if (!props.selectedChat) return
  settings.value.updatedAt = Date.now()
  syncSocialCircleToDirectory(props.selectedChat)
  emit('save')
}

const socialList = computed<SocialContactItem[]>({
  get: () => {
    if (!props.selectedChat) return []
    if (!Array.isArray(props.selectedChat.socialCircle)) {
      props.selectedChat.socialCircle = []
    }
    return props.selectedChat.socialCircle
  },
  set: (val) => {
    if (props.selectedChat) {
      props.selectedChat.socialCircle = val
    }
  }
})

const stats = computed(() => {
  const list = socialList.value
  return {
    total: list.length,
    family: list.filter((i) => i.category === 'family').length,
    friend: list.filter((i) => i.category === 'friend').length,
    work: list.filter((i) => i.category === 'work').length,
    other: list.filter((i) => i.category === 'other').length
  }
})

const filteredList = computed(() => {
  let list = socialList.value
  if (activeTab.value !== 'all') {
    list = list.filter((item) => item.category === activeTab.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(
      (item) =>
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.relation && item.relation.toLowerCase().includes(q)) ||
        (item.persona && item.persona.toLowerCase().includes(q))
    )
  }
  return list
})

const revokeAvatarObjectUrls = () => {
  avatarObjectUrls.forEach(url => URL.revokeObjectURL(url))
  avatarObjectUrls.clear()
}

const refreshAvatarSources = async () => {
  const token = ++avatarLoadToken
  let migratedLegacyAvatar = false
  for (const item of socialList.value) {
    if (item.avatarKey || !item.avatarUrl?.startsWith('data:image/')) continue
    try {
      item.avatarKey = await saveSocialAvatarAsset(item.entityId, item.avatarUrl)
      item.avatarUrl = ''
      item.updatedAt = Date.now()
      migratedLegacyAvatar = true
    } catch {
      // 旧头像迁移失败时保留原数据，避免影响现有显示和人物资料。
    }
  }
  if (migratedLegacyAvatar) persist()
  const entries = await Promise.all(socialList.value.map(async item => {
    const resolved = await resolveSocialAvatarSource(item.avatarKey, item.avatarUrl)
    return { id: item.id, ...resolved }
  }))
  if (token !== avatarLoadToken) {
    entries.filter(item => item.objectUrl).forEach(item => URL.revokeObjectURL(item.url))
    return
  }
  revokeAvatarObjectUrls()
  const next: Record<string, string> = {}
  entries.forEach(item => {
    next[item.id] = item.url
    if (item.objectUrl) avatarObjectUrls.add(item.url)
  })
  avatarSources.value = next
}

watch(
  () => [props.visible, socialList.value.map(item => `${item.id}:${item.avatarKey || ''}:${item.avatarUrl || ''}`).join('|')],
  () => {
    if (props.visible) void refreshAvatarSources()
    else {
      avatarLoadToken += 1
      revokeAvatarObjectUrls()
      avatarSources.value = {}
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  avatarLoadToken += 1
  revokeAvatarObjectUrls()
})

const handleClose = () => {
  emit('update:visible', false)
}

const openCreateModal = () => {
  editingContact.value = null
  showEditModal.value = true
}

const openEditModal = (item: SocialContactItem) => {
  editingContact.value = item
  showEditModal.value = true
}

const handleSaveContact = (item: SocialContactItem) => {
  const list = [...socialList.value]
  const idx = list.findIndex((c) => c.id === item.id)
  const previousAvatarKey = idx !== -1 ? list[idx].avatarKey : ''
  if (idx !== -1) {
    list[idx] = item
  } else {
    list.unshift(item)
  }
  socialList.value = list
  persist()
  if (previousAvatarKey && previousAvatarKey !== item.avatarKey) void removeSocialAvatarIfUnused(previousAvatarKey)
}

const handleDeleteContact = (id: string) => {
  const previousAvatarKey = socialList.value.find(item => item.id === id)?.avatarKey
  socialList.value = socialList.value.filter((item) => item.id !== id)
  persist()
  if (previousAvatarKey) void removeSocialAvatarIfUnused(previousAvatarKey)
}

// 快速生成预设示例
const generatePresets = async () => {
  if (!props.selectedChat || generating.value) return
  generating.value = true
  generationError.value = ''
  try {
    const draft = await generateSocialCircleDraft(props.selectedChat, settings.value.generationCount)
    const existingNames = new Set(socialList.value.map(item => item.name.trim().toLowerCase()))
    socialList.value = [...draft.filter(item => !existingNames.has(item.name.trim().toLowerCase())), ...socialList.value]
    persist()
  } catch (error: any) {
    generationError.value = error?.message || '人脉生成失败，请检查 API 设置后重试'
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="journal-overlay" @click.self="handleClose">
    <div class="journal-container">
      <!-- 手账顶栏 -->
      <div class="journal-header">
        <button class="journal-nav-btn" title="关闭" @click="handleClose">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.2" fill="none">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div class="journal-header-title">
          <span class="main-title">生活手账 · 人脉漫游</span>
          <span class="sub-title">MEMORIES & CONNECTIONS</span>
        </div>
        <button class="journal-add-btn" title="添加便签" @click="openCreateModal">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>添加</span>
        </button>
      </div>

      <!-- 主体内页（纯白极简风格） -->
      <div class="journal-page-body">
        <!-- 扉页：主角相片与生活手记卡 -->
        <div class="journal-hero-card">
          <div class="hero-content-row">
            <!-- 头像相框 -->
            <div class="polaroid-frame">
              <div class="polaroid-photo">
                <img
                  v-if="selectedChat?.avatarUrl"
                  :src="selectedChat.avatarUrl"
                  class="polaroid-img"
                />
                <span v-else class="polaroid-text">{{ selectedChat?.avatarText || '伴' }}</span>
              </div>
              <div class="polaroid-caption">{{ selectedChat?.name || '生活圈' }}</div>
            </div>

            <!-- 右侧手记小语与统计 -->
            <div class="hero-notes-wrap">
              <div class="hero-quote">
                “ 记录身边的羁绊与交集，让生活故事更真实丰满。”
              </div>

              <div class="stamp-stats-group">
                <div class="stamp-stat-item">
                  <span class="stat-num">{{ stats.total }}</span>
                  <span class="stat-lbl">全部</span>
                </div>
                <div class="stamp-stat-item family">
                  <span class="stat-num">{{ stats.family }}</span>
                  <span class="stat-lbl">亲人</span>
                </div>
                <div class="stamp-stat-item friend">
                  <span class="stat-num">{{ stats.friend }}</span>
                  <span class="stat-lbl">好友</span>
                </div>
                <div class="stamp-stat-item work">
                  <span class="stat-num">{{ stats.work }}</span>
                  <span class="stat-lbl">工作</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 快速载入预设提示栏 -->
          <div v-if="socialList.length === 0" class="hero-empty-preset-bar">
            <span>还没有记录人脉便签？</span>
            <button class="hero-preset-btn" :disabled="generating" @click="generatePresets">
              {{ generating ? '正在生成…' : 'AI 生成人脉' }}
            </button>
          </div>
        </div>

        <section class="social-control-card">
          <div class="control-master-row"><div><strong>启用角色人脉圈</strong><span>接入角色认知、主页、好友申请与朋友圈</span></div><label class="journal-switch"><input v-model="settings.enabled" type="checkbox" @change="persist"><span></span></label></div>
          <div class="control-grid" :class="{ disabled: !settings.enabled }">
            <label><input v-model="settings.awarenessEnabled" type="checkbox" :disabled="!settings.enabled" @change="persist"><span>角色知道自己的人脉</span></label>
            <label><input v-model="settings.allowMentionInChat" type="checkbox" :disabled="!settings.enabled" @change="persist"><span>聊天中自然提及</span></label>
            <label><input v-model="settings.allowViewMoments" type="checkbox" :disabled="!settings.enabled" @change="persist"><span>查看人脉朋友圈</span></label>
            <label><input v-model="settings.allowInteractMoments" type="checkbox" :disabled="!settings.enabled" @change="persist"><span>点赞和评论</span></label>
            <label><input v-model="settings.allowPublishAboutCircle" type="checkbox" :disabled="!settings.enabled" @change="persist"><span>发布涉及人脉的动态</span></label>
            <label><input v-model="settings.allowIncomingRequests" type="checkbox" :disabled="!settings.enabled" @change="persist"><span>人脉可主动申请用户</span></label>
          </div>
          <div class="management-selector" :class="{ disabled: !settings.enabled }"><span>关系变化管理</span><div><button v-for="mode in [{id:'readonly',label:'只读'},{id:'confirm',label:'需确认'},{id:'autonomous',label:'自主'}]" :key="mode.id" type="button" :disabled="!settings.enabled" :class="{ active: settings.managementMode === mode.id }" @click="settings.managementMode = mode.id as any; persist()">{{ mode.label }}</button></div></div>
          <div class="generation-row"><div><strong>按人设补充人脉</strong><span>只生成一层，已有同名人物自动跳过</span></div><div class="count-stepper"><button type="button" :disabled="settings.generationCount <= 2" @click="settings.generationCount--; persist()">−</button><b>{{ settings.generationCount }} 人</b><button type="button" :disabled="settings.generationCount >= 10" @click="settings.generationCount++; persist()">＋</button></div><button class="generate-more-btn" type="button" :disabled="generating" @click="generatePresets">{{ generating ? '生成中…' : '生成' }}</button></div>
          <p v-if="generationError" class="generation-error">{{ generationError }}</p>
        </section>

        <!-- 搜索与索引切换 -->
        <div class="journal-controls-section">
          <div class="journal-search-input-wrap">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              v-model="searchQuery"
              class="journal-search-input"
              type="text"
              placeholder="搜索姓名、称谓或性格..."
            />
          </div>

          <!-- 分类标签 -->
          <div class="journal-index-tabs">
            <button
              class="index-tab tab-all"
              :class="{ active: activeTab === 'all' }"
              @click="activeTab = 'all'"
            >
              全部 ({{ stats.total }})
            </button>
            <button
              class="index-tab tab-family"
              :class="{ active: activeTab === 'family' }"
              @click="activeTab = 'family'"
            >
              亲人 ({{ stats.family }})
            </button>
            <button
              class="index-tab tab-friend"
              :class="{ active: activeTab === 'friend' }"
              @click="activeTab = 'friend'"
            >
              好友 ({{ stats.friend }})
            </button>
            <button
              class="index-tab tab-work"
              :class="{ active: activeTab === 'work' }"
              @click="activeTab = 'work'"
            >
              工作 ({{ stats.work }})
            </button>
            <button
              class="index-tab tab-other"
              :class="{ active: activeTab === 'other' }"
              @click="activeTab = 'other'"
            >
              其他 ({{ stats.other }})
            </button>
          </div>
        </div>

        <!-- 便签列表区 -->
        <div class="journal-notes-list">
          <!-- 空状态 -->
          <div v-if="filteredList.length === 0" class="journal-empty-box">
            <div class="empty-icon-box">
              <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.5" fill="none">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            </div>
            <div class="empty-text-desc">
              {{ searchQuery ? '未找到匹配的人脉便签' : '当前暂无人脉便签，点击右上角添加' }}
            </div>
            <button v-if="!searchQuery" class="empty-btn-create" @click="openCreateModal">
              立即添加便签
            </button>
          </div>

          <!-- 便签卡片 -->
          <div
            v-for="item in filteredList"
            :key="item.id"
            class="journal-memo-card"
            :class="item.category"
            @click="openEditModal(item)"
          >
            <!-- 关系徽章 -->
            <div class="memo-seal-badge" :class="item.category">
              {{ item.relation || '羁绊' }}
            </div>

            <!-- 便签主体内容 -->
            <div class="memo-card-inner">
              <!-- 左侧：小头像 -->
              <div class="memo-avatar-polaroid">
                <img v-if="avatarSources[item.id] || item.avatarUrl" :src="avatarSources[item.id] || item.avatarUrl" class="memo-avatar-img" />
                <div v-else class="memo-avatar-letter">
                  {{ item.name ? item.name.slice(0, 1) : '友' }}
                </div>
              </div>

              <!-- 右侧：文字与性格 -->
              <div class="memo-text-content">
                <div class="memo-title-row">
                  <span class="memo-contact-name">{{ item.name }}</span>
                  <span class="memo-cat-pill" :class="item.category">
                    {{
                      item.category === 'family'
                        ? '亲人'
                        : item.category === 'friend'
                        ? '好友'
                        : item.category === 'work'
                        ? '工作'
                        : '其他'
                    }}
                  </span>
                </div>

                <!-- 人物性格 -->
                <div class="memo-persona-text">
                  “{{ item.persona || '暂无性格描述...' }}”
                </div>

                <!-- 底部状态与频次标签 -->
                <div class="memo-footer-row">
                  <div
                    class="memo-stamp-status"
                    :class="{ active: item.enableMoments }"
                  >
                    <span class="stamp-dot"></span>
                   <span>{{ item.enableMoments ? '朋友圈动态联通' : '朋友圈静默' }}</span>
                  </div>

                  <span v-if="item.enableMoments" class="memo-freq-tag">
                    {{
                      item.interactionFrequency === 'high'
                        ? '高频互动'
                        : item.interactionFrequency === 'low'
                        ? '低频围观'
                        : '标准互动'
                    }}
                  </span>
                  <span class="memo-privacy-tag">{{ item.privacy === 'public' ? '公开主页' : item.privacy === 'limited' ? '好友可见' : item.privacy === 'private' ? '私密用户' : '隐藏人物' }}</span>
                </div>
              </div>
            </div>

            <!-- 右侧悬浮操作按钮 -->
            <div class="memo-action-pins" @click.stop>
              <button class="pin-btn edit" title="编辑便签" @click="openEditModal(item)">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button class="pin-btn delete" title="删除便签" @click="handleDeleteContact(item.id)">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加 / 编辑弹窗 -->
    <ChatSocialCircleEditModal
      v-model:visible="showEditModal"
      :edit-item="editingContact"
      :owner-chat="selectedChat"
      @save="handleSaveContact"
    />
  </div>
</template>

<style scoped>
.social-control-card{display:flex;flex-direction:column;gap:13px;padding:14px;border:1px solid #ececec;border-radius:14px;background:#fff}.control-master-row,.generation-row{display:flex;align-items:center;gap:12px}.control-master-row>div,.generation-row>div:first-child{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px}.control-master-row strong,.generation-row strong{font-size:13px;color:#202020}.control-master-row span,.generation-row span{font-size:10px;color:#8b8b8b}.journal-switch{position:relative;width:42px;height:24px;flex:0 0 auto}.journal-switch input{position:absolute;opacity:0;pointer-events:none}.journal-switch span{position:absolute;inset:0;border-radius:12px;background:#d7d7d7;transition:.18s}.journal-switch span:after{content:"";position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.18);transition:.18s}.journal-switch input:checked+span{background:#252525}.journal-switch input:checked+span:after{transform:translateX(18px)}.control-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.control-grid.disabled{opacity:.45}.control-grid label{display:flex;align-items:center;gap:7px;padding:9px;border-radius:9px;background:#f7f7f8;color:#555;font-size:10px;cursor:pointer}.control-grid input{appearance:none;width:15px;height:15px;border:1px solid #c8c8c8;border-radius:5px;background:#fff}.control-grid input:checked{border-color:#242424;background:#242424;box-shadow:inset 0 0 0 3px #fff}.count-stepper{display:flex!important;flex:0 0 auto!important;flex-direction:row!important;align-items:center;gap:4px!important}.count-stepper button,.generate-more-btn{border:1px solid #e2e2e2;background:#f7f7f8;color:#333;border-radius:8px;cursor:pointer}.count-stepper button{width:25px;height:25px}.count-stepper b{min-width:38px;font-size:10px;text-align:center}.generate-more-btn{height:29px;padding:0 11px;background:#222;color:#fff;border-color:#222;font-size:11px}.count-stepper button:disabled,.generate-more-btn:disabled,.hero-preset-btn:disabled{opacity:.45;cursor:not-allowed}.generation-error{margin:0;padding:8px 10px;border-radius:8px;background:#fff1f0;color:#b64b47;font-size:10px}.memo-privacy-tag{padding:2px 6px;border-radius:999px;background:#f1f1f2;color:#777;font-size:8px;white-space:nowrap}
.management-selector{display:flex;align-items:center;justify-content:space-between;gap:12px}.management-selector>span{font-size:11px;color:#666}.management-selector>div{display:flex;padding:3px;border-radius:9px;background:#f4f4f5}.management-selector button{height:25px;padding:0 9px;border:0;border-radius:7px;background:transparent;color:#777;font-size:10px;cursor:pointer}.management-selector button.active{background:#fff;color:#222;box-shadow:0 1px 4px rgba(0,0,0,.08);font-weight:650}.management-selector.disabled{opacity:.45}
/* 遮罩 */
.journal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  z-index: 10040;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 纯白容器 */
.journal-container {
  width: 100%;
  max-width: 480px;
  height: 90vh;
  background: #ffffff;
  border: 1px solid #eaeaea;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);
  position: relative;
}

@media (max-width: 480px) {
  .journal-container {
    height: 100vh;
    border-radius: 0;
    border: none;
  }
}

/* 顶栏 */
.journal-header {
  height: 54px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.journal-nav-btn {
  background: #f5f5f7;
  border: 1px solid #ebebeb;
  color: #333333;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.journal-nav-btn:hover {
  background: #e8e8ed;
  color: #000000;
}

.journal-header-title {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.main-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  letter-spacing: 0.5px;
}

.sub-title {
  font-size: 8.5px;
  color: #999999;
  letter-spacing: 1.2px;
  font-weight: 500;
}

.journal-add-btn {
  background: #1a1a1a;
  border: none;
  color: #ffffff;
  height: 30px;
  padding: 0 12px;
  border-radius: 15px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.journal-add-btn:hover {
  background: #333333;
}

/* 页面主体（纯白） */
.journal-page-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background-color: #ffffff;
}

/* 主角卡片 */
.journal-hero-card {
  background: #fafafa;
  border: 1px solid #eeeeee;
  border-radius: 14px;
  padding: 14px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hero-content-row {
  display: flex;
  gap: 14px;
  align-items: center;
}

/* 照片框 */
.polaroid-frame {
  width: 72px;
  background: #ffffff;
  padding: 4px;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.polaroid-photo {
  width: 100%;
  height: 60px;
  background: #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.polaroid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.polaroid-text {
  font-size: 18px;
  font-weight: 600;
  color: #666666;
}

.polaroid-caption {
  font-size: 10.5px;
  color: #555555;
  font-weight: 500;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 64px;
  text-align: center;
}

/* 手记与统计 */
.hero-notes-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hero-quote {
  font-size: 12px;
  color: #666666;
  line-height: 1.5;
}

.stamp-stats-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.stamp-stat-item {
  background: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  padding: 3px 8px;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-num {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
}

.stat-lbl {
  font-size: 10.5px;
  color: #888888;
}

.hero-empty-preset-bar {
  background: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  color: #666666;
}

.hero-preset-btn {
  background: #f0f0f0;
  color: #333333;
  border: 1px solid #dcdcdc;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.hero-preset-btn:hover {
  background: #e4e4e4;
}

/* 搜索与选项卡 */
.journal-controls-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.journal-search-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f7f7f8;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  height: 36px;
  padding: 0 12px;
  color: #888888;
}

.journal-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
  color: #1a1a1a;
}

.journal-search-input::placeholder {
  color: #aaaaaa;
}

/* 纯白风格标签切换 */
.journal-index-tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.journal-index-tabs::-webkit-scrollbar {
  display: none;
}

.index-tab {
  flex-shrink: 0;
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  background: #ffffff;
  color: #666666;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.index-tab:hover {
  background: #f9f9f9;
  color: #333333;
}

.index-tab.active {
  background: #1a1a1a;
  color: #ffffff;
  border-color: #1a1a1a;
  font-weight: 600;
}

/* 便签列表 */
.journal-notes-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.journal-empty-box {
  background: #ffffff;
  border: 1px dashed #dedede;
  border-radius: 14px;
  padding: 40px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}

.empty-icon-box {
  color: #bbbbbb;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text-desc {
  font-size: 12.5px;
  color: #888888;
}

.empty-btn-create {
  margin-top: 4px;
  background: #1a1a1a;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
}

.empty-btn-create:hover {
  background: #333333;
}

/* 便签卡片（纯白极简） */
.journal-memo-card {
  background: #ffffff;
  border: 1px solid #eaeaea;
  border-radius: 12px;
  padding: 14px;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  cursor: pointer;
  transition: all 0.15s ease;
}

.journal-memo-card:hover {
  border-color: #d4d4d4;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

/* 关系徽章 */
.memo-seal-badge {
  position: absolute;
  top: 12px;
  right: 36px;
  font-size: 10.5px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 6px;
  background: #f5f5f7;
  color: #555555;
  border: 1px solid #e5e5e5;
}

/* 便签主体 */
.memo-card-inner {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

/* 便签内头像 */
.memo-avatar-polaroid {
  width: 44px;
  height: 44px;
  background: #f7f7f7;
  border: 1px solid #ebebeb;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.memo-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.memo-avatar-letter {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  color: #555555;
}

/* 文字手记 */
.memo-text-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.memo-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.memo-contact-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.memo-cat-pill {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
  background: #f2f2f2;
  color: #666666;
}

.memo-persona-text {
  font-size: 12px;
  color: #555555;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.memo-footer-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.memo-stamp-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  color: #888888;
}

.memo-stamp-status.active {
  color: #10b981;
}

.stamp-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.memo-freq-tag {
  font-size: 10.5px;
  color: #888888;
}

/* 操作按钮 */
.memo-action-pins {
  position: absolute;
  right: 8px;
  top: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pin-btn {
  background: transparent;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999999;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pin-btn:hover {
  background: #f0f0f0;
  color: #333333;
}

.pin-btn.delete:hover {
  color: #ef4444;
  background: #fee2e2;
}
</style>
