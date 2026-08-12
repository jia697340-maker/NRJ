<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CharacterProfileAiModal from './CharacterProfileAiModal.vue'
import { applySocialProfilePatch, ensureSocialProfile, type CharacterSocialProfile, type SocialCoverStyle, type SocialManagementMode } from '../../../services/characterSocialProfile'
import { createCharacterMoment, deleteCharacterMoment, listMomentsByAuthor, updateCharacterMoment } from '../../../services/momentRepository'
import type { SocialGenerationResult } from '../../../services/characterSocialGenerator'

const props = defineProps<{ chat: any }>()
const emit = defineEmits<{ (event: 'back'): void; (event: 'open-chat'): void; (event: 'save'): void | Promise<void> }>()

const profile = ref<CharacterSocialProfile>(ensureSocialProfile(props.chat))
const currentPage = ref<'profile' | 'moments'>('profile')
const moments = ref<any[]>([])
const loadingMoments = ref(true)
const momentError = ref('')
const showManage = ref(false)
const manageTab = ref<'profile' | 'permissions' | 'history'>('profile')
const showAi = ref(false)
const showManualMoment = ref(false)
const manualMomentText = ref('')
const manualSubmitting = ref(false)
const editingMoment = ref<any | null>(null)
const editingText = ref('')
const deleteTarget = ref<any | null>(null)
const toast = ref('')
const manageSnapshot = ref({ nickname: profile.value.nickname, socialId: profile.value.socialId, signature: profile.value.signature, coverStyle: profile.value.coverStyle })
let toastTimer: number | null = null

const displayName = computed(() => profile.value.nickname || props.chat.realName || props.chat.name || '未命名角色')
const recentMoments = computed(() => moments.value.slice(0, 3))
const pendingChanges = computed(() => profile.value.changes.filter(change => change.status === 'pending'))
const permissionRows = [
  { key: 'nickname', title: '修改网名', description: '允许角色调整对外显示的昵称' },
  { key: 'socialId', title: '修改社交 ID', description: '身份标识较稳定，建议谨慎开启' },
  { key: 'signature', title: '修改个性签名', description: '允许角色根据状态更新签名' },
  { key: 'cover', title: '更换主页背景', description: '仅限已有背景方案' },
  { key: 'publishMoments', title: '发布朋友圈', description: '允许角色主动发布新内容' },
  { key: 'editMoments', title: '编辑自己的朋友圈', description: '默认仅管理角色自己生成的内容' },
  { key: 'deleteMoments', title: '删除自己的朋友圈', description: '高风险操作，默认关闭' },
  { key: 'manageUserMoments', title: '管理用户代发内容', description: '允许角色修改或删除你替其发布的内容' },
  { key: 'generateImages', title: '生成朋友圈配图', description: '可能消耗图像额度' }
] as const
const coverOptions: Array<{ id: SocialCoverStyle; label: string }> = [
  { id: 'dots', label: '柔和波点' },
  { id: 'grid', label: '细线格纹' },
  { id: 'stars', label: '静谧星点' },
  { id: 'plain', label: '克制纯色' }
]

const notify = (message: string) => {
  toast.value = message
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = '' }, 2200)
}

const openManage = (tab: 'profile' | 'permissions' | 'history' = 'profile') => {
  manageSnapshot.value = { nickname: profile.value.nickname, socialId: profile.value.socialId, signature: profile.value.signature, coverStyle: profile.value.coverStyle }
  manageTab.value = tab
  showManage.value = true
}

const loadMoments = async () => {
  loadingMoments.value = true
  momentError.value = ''
  try {
    moments.value = await listMomentsByAuthor(props.chat.id)
  } catch (error: any) {
    momentError.value = error?.message || '朋友圈加载失败'
  } finally {
    loadingMoments.value = false
  }
}

const persist = async () => {
  props.chat.socialProfile = profile.value
  await emit('save')
}

const saveProfile = async () => {
  const patch = {
    nickname: profile.value.nickname.trim() || props.chat.realName || props.chat.name,
    socialId: profile.value.socialId.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20),
    signature: profile.value.signature.trim(),
    coverStyle: profile.value.coverStyle
  }
  const now = Date.now()
  Object.entries(patch).forEach(([field, value]) => {
    const before = (manageSnapshot.value as any)[field]
    if (before === value) return
    profile.value.changes.unshift({ id: `${now}_${field}_manual`, field, before, after: value, source: 'user', createdAt: now, status: 'applied' })
  })
  Object.assign(profile.value, patch, { updatedAt: now })
  props.chat.socialProfile = profile.value
  profile.value = props.chat.socialProfile
  await persist()
  manageSnapshot.value = { ...patch }
  notify('主页资料已保存')
}

const setManagementMode = async (mode: SocialManagementMode) => {
  profile.value.managementMode = mode
  profile.value.updatedAt = Date.now()
  await persist()
}

const togglePermission = async (key: keyof CharacterSocialProfile['permissions']) => {
  profile.value.permissions[key] = !profile.value.permissions[key]
  profile.value.updatedAt = Date.now()
  await persist()
}

const submitManualMoment = async () => {
  const content = manualMomentText.value.trim()
  if (!content || manualSubmitting.value) return
  manualSubmitting.value = true
  try {
    await createCharacterMoment(props.chat, content, 'manual', { createdBy: 'user' })
    manualMomentText.value = ''
    showManualMoment.value = false
    await loadMoments()
    notify('朋友圈已发布')
  } catch (error: any) {
    notify(error?.message || '发布失败，请重试')
  } finally {
    manualSubmitting.value = false
  }
}

const openEditMoment = (moment: any) => {
  editingMoment.value = moment
  editingText.value = moment.content || ''
}

const saveEditedMoment = async () => {
  if (!editingMoment.value || !editingText.value.trim()) return
  try {
    await updateCharacterMoment(editingMoment.value.id, { content: editingText.value.trim() })
    editingMoment.value = null
    await loadMoments()
    notify('朋友圈已更新')
  } catch (error: any) {
    notify(error?.message || '修改失败')
  }
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  try {
    await deleteCharacterMoment(deleteTarget.value.id)
    deleteTarget.value = null
    await loadMoments()
    notify('朋友圈已删除')
  } catch (error: any) {
    notify(error?.message || '删除失败')
  }
}

const applyAiResult = async (generated: SocialGenerationResult, generation: { includeRecentChat: boolean; allowChatDetails: boolean; momentCount: number }) => {
  const patch: any = {}
  ;(['nickname', 'socialId', 'signature', 'coverStyle'] as const).forEach(field => {
    if (generated[field] !== undefined) patch[field] = generated[field]
  })
  if (Object.keys(patch).length) {
    applySocialProfilePatch(props.chat, patch, 'ai-assist')
    profile.value = props.chat.socialProfile
    await persist()
  }
  profile.value.generation = { ...generation }
  await persist()
  if (generated.moments?.length) {
    for (const content of generated.moments) await createCharacterMoment(props.chat, content, 'ai-assist', { createdBy: 'user' })
    await loadMoments()
  }
  notify(generated.moments?.length ? `已采用资料并发布 ${generated.moments.length} 条朋友圈` : '已采用生成的主页资料')
}

const reviewChange = async (change: any, accept: boolean) => {
  if (accept) {
    if (change.field === 'momentEdit') await updateCharacterMoment(change.before, { content: change.after })
    else if (change.field === 'momentDelete') await deleteCharacterMoment(change.before)
    else if (change.field === 'momentPublish') await createCharacterMoment(props.chat, change.after, 'ai-chat', { createdBy: 'character' })
    else (profile.value as any)[change.field] = change.after
    change.status = 'applied'
  } else change.status = 'rejected'
  profile.value.updatedAt = Date.now()
  await persist()
  if (String(change.field).startsWith('moment')) await loadMoments()
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const sourceLabel = (moment: any) => ({ manual: '用户代发', 'ai-assist': 'AI 辅助', 'ai-chat': '角色发布', autonomy: '自主发布' } as Record<string, string>)[moment.source] || '历史内容'

onMounted(() => {
  void loadMoments()
  window.addEventListener('clingy:moments-updated', loadMoments)
})
onUnmounted(() => {
  window.removeEventListener('clingy:moments-updated', loadMoments)
  if (toastTimer) window.clearTimeout(toastTimer)
})
</script>

<template>
  <div class="character-social-view">
    <Transition name="social-toast"><div v-if="toast" class="character-social-toast" role="status">{{ toast }}</div></Transition>

    <template v-if="currentPage === 'profile'">
      <header class="character-social-nav">
        <button class="social-nav-button" type="button" aria-label="返回聊天" @click="emit('back')"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" /></svg></button>
        <span>个人资料</span>
        <button class="social-nav-button" type="button" aria-label="管理主页" @click="openManage()"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></button>
      </header>

      <main class="character-profile-scroll">
        <section class="character-profile-hero" :class="`cover-${profile.coverStyle}`">
          <div class="character-cover-label"><svg viewBox="0 0 24 24"><path d="M4 7h4l2-2h4l2 2h4v12H4z"/><circle cx="12" cy="13" r="3"/></svg>{{ coverOptions.find(item => item.id === profile.coverStyle)?.label }}</div>
        </section>

        <section class="character-profile-card">
          <div class="character-avatar" :style="props.chat.avatarUrl ? { backgroundImage: `url(${props.chat.avatarUrl})` } : {}"><span v-if="!props.chat.avatarUrl">{{ displayName.charAt(0) }}</span></div>
          <div class="character-profile-title"><h1>{{ displayName }}</h1><p>ID：{{ profile.socialId }}</p></div>
          <p class="character-signature" :class="{ empty: !profile.signature }">{{ profile.signature || '这个人还没有写个性签名' }}</p>
          <div v-if="props.chat.remark" class="character-remark"><span>备注</span><b>{{ props.chat.remark }}</b></div>
          <div class="character-profile-actions">
            <button class="character-primary-action" type="button" @click="emit('open-chat')"><svg viewBox="0 0 24 24"><path d="M5 5h14v11H9l-4 3z"/></svg>发消息</button>
            <button class="character-secondary-action" type="button" @click="openManage()"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg>管理主页</button>
          </div>
        </section>

        <button class="character-moments-entry" type="button" @click="currentPage = 'moments'">
          <span class="character-entry-icon"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 16l4-4 3 3 3-4 6 6"/></svg></span>
          <span class="character-entry-copy"><strong>朋友圈</strong><small v-if="moments.length">{{ moments.length }} 条动态</small><small v-else>还没有发布内容</small></span>
          <span v-if="recentMoments.length" class="character-moment-previews">
            <span v-for="moment in recentMoments" :key="moment.id" :style="moment.images?.[0] ? { backgroundImage: `url(${typeof moment.images[0] === 'string' ? moment.images[0] : moment.images[0].url})` } : {}">{{ moment.images?.[0] ? '' : moment.content?.charAt(0) }}</span>
          </span>
          <svg class="character-entry-arrow" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>
        </button>

        <section class="character-awareness-note" :class="{ enabled: profile.awarenessEnabled }">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9h.01"/></svg>
          <div><strong>{{ profile.awarenessEnabled ? '角色已感知自己的主页' : '主页目前仅对你可见' }}</strong><span>{{ profile.awarenessEnabled ? `管理模式：${profile.managementMode === 'readonly' ? '只读' : profile.managementMode === 'confirm' ? '修改需确认' : '自主管理'}` : '开启后，角色才能记住资料与自己的主页身份' }}</span></div>
          <button type="button" @click="openManage('permissions')">设置</button>
        </section>
      </main>
    </template>

    <template v-else>
      <header class="character-social-nav moment-nav">
        <button class="social-nav-button" type="button" aria-label="返回角色主页" @click="currentPage = 'profile'"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" /></svg></button>
        <div><strong>{{ displayName }}的朋友圈</strong><small>{{ moments.length }} 条动态</small></div>
        <button class="social-nav-button" type="button" aria-label="AI 生成朋友圈" @click="showAi = true"><svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1 4.1 1.4-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"/></svg></button>
      </header>
      <main class="character-moments-scroll">
        <section class="character-moment-toolbar">
          <div><strong>主页动态</strong><span>手动发布或让 AI 生成多条草稿</span></div>
          <div><button type="button" @click="showManualMoment = true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>手动发布</button><button class="accent" type="button" @click="showAi = true"><svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1 4.1 1.4-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4z"/></svg>AI 生成</button></div>
        </section>

        <div v-if="loadingMoments" class="character-state-card" aria-live="polite"><span class="character-loading-ring"></span><strong>正在加载朋友圈</strong><p>正在整理该角色的主页内容</p></div>
        <div v-else-if="momentError" class="character-state-card error" role="alert"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg><strong>朋友圈暂时无法加载</strong><p>{{ momentError }}</p><button type="button" @click="loadMoments">重新加载</button></div>
        <div v-else-if="!moments.length" class="character-state-card empty"><svg viewBox="0 0 24 24"><path d="M5 5h14v14H5zM8 15l3-3 2 2 3-4 3 4"/></svg><strong>还没有朋友圈</strong><p>可以手动替角色发布，也可以按字段选择让 AI 生成。</p><div><button type="button" @click="showManualMoment = true">写第一条</button><button class="accent" type="button" @click="showAi = true">AI 帮我生成</button></div></div>

        <section v-else class="character-moment-list">
          <article v-for="moment in moments" :key="moment.id" class="character-moment-card">
            <header><div class="moment-author-avatar" :style="props.chat.avatarUrl ? { backgroundImage: `url(${props.chat.avatarUrl})` } : {}">{{ props.chat.avatarUrl ? '' : displayName.charAt(0) }}</div><div><strong>{{ displayName }}</strong><span>{{ formatTime(moment.time) }} · {{ sourceLabel(moment) }}</span></div><button type="button" aria-label="编辑朋友圈" @click="openEditMoment(moment)"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></button></header>
            <p>{{ moment.content }}</p>
            <div v-if="moment.images?.length" class="character-moment-images"><img v-for="(image,index) in moment.images" :key="index" :src="typeof image === 'string' ? image : image.url" alt="朋友圈配图"></div>
            <footer><span v-if="moment.updatedAt">已编辑</span><span>{{ moment.visibility || '公开' }}</span><button type="button" @click="openEditMoment(moment)">编辑</button><button class="danger" type="button" @click="deleteTarget = moment">删除</button></footer>
          </article>
        </section>
      </main>
    </template>

    <Teleport to="body">
      <Transition name="social-sheet">
        <div v-if="showManage" class="character-sheet-overlay" @click.self="showManage = false">
          <section class="character-manage-sheet" role="dialog" aria-modal="true" aria-labelledby="manage-title">
            <header><div><p>PROFILE CONTROL</p><h2 id="manage-title">管理角色主页</h2></div><button type="button" aria-label="关闭" @click="showManage = false"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
            <nav aria-label="主页管理分类"><button v-for="tab in [{id:'profile',label:'资料'},{id:'permissions',label:'角色权限'},{id:'history',label:'变更记录'}]" :key="tab.id" type="button" :class="{ active: manageTab === tab.id }" @click="manageTab = tab.id as any">{{ tab.label }}<span v-if="tab.id === 'history' && pendingChanges.length">{{ pendingChanges.length }}</span></button></nav>
            <div class="character-manage-scroll">
              <template v-if="manageTab === 'profile'">
                <div class="manage-intro"><div><strong>主页资料</strong><span>手动填写，或只选择一个字段让 AI 帮忙</span></div><button type="button" @click="showAi = true"><svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1 4.1 1.4-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4z"/></svg>AI 完善</button></div>
                <label class="manage-field"><span>网名<small>{{ profile.nickname.length }}/30</small></span><input v-model="profile.nickname" maxlength="30" placeholder="角色对外显示的名字"></label>
                <label class="manage-field"><span>社交 ID<small>4～20 位</small></span><input v-model="profile.socialId" maxlength="20" pattern="[A-Za-z0-9_-]+" placeholder="字母、数字、下划线或短横线"></label>
                <label class="manage-field"><span>个性签名<small>{{ profile.signature.length }}/120</small></span><textarea v-model="profile.signature" maxlength="120" placeholder="写一句这个角色会放在主页的话"></textarea></label>
                <fieldset class="manage-cover-field"><legend>主页背景</legend><button v-for="cover in coverOptions" :key="cover.id" type="button" :class="{ selected: profile.coverStyle === cover.id }" @click="profile.coverStyle = cover.id"><span :class="`cover-${cover.id}`"></span><b>{{ cover.label }}</b><svg v-if="profile.coverStyle === cover.id" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></button></fieldset>
                <button class="manage-save-button" type="button" :disabled="!profile.nickname.trim() || profile.socialId.length < 4" @click="saveProfile">保存主页资料</button>
              </template>

              <template v-else-if="manageTab === 'permissions'">
                <section class="permission-master"><div><strong>角色可感知自己的主页</strong><span>开启后，资料会作为角色的社交身份进入上下文</span></div><label class="character-switch"><input v-model="profile.awarenessEnabled" type="checkbox" @change="persist"><span></span></label></section>
                <section class="management-mode" :class="{ disabled: !profile.awarenessEnabled }"><header><strong>主页管理模式</strong><span>决定角色提出的修改如何生效</span></header><div><button v-for="mode in [{id:'readonly',label:'只读',desc:'只能记住'},{id:'confirm',label:'需确认',desc:'修改进入审核'},{id:'autonomous',label:'自主管理',desc:'允许直接生效'}]" :key="mode.id" type="button" :disabled="!profile.awarenessEnabled" :class="{ active: profile.managementMode === mode.id }" @click="setManagementMode(mode.id as SocialManagementMode)"><strong>{{ mode.label }}</strong><span>{{ mode.desc }}</span></button></div></section>
                <section class="permission-list" :class="{ disabled: !profile.awarenessEnabled || profile.managementMode === 'readonly' }"><header><strong>允许的操作</strong><span>高风险权限默认关闭</span></header><div v-for="row in permissionRows" :key="row.key" class="permission-row"><div><strong>{{ row.title }}</strong><span>{{ row.description }}</span></div><label class="character-switch"><input type="checkbox" :checked="profile.permissions[row.key]" :disabled="!profile.awarenessEnabled || profile.managementMode === 'readonly'" @change="togglePermission(row.key)"><span></span></label></div></section>
              </template>

              <template v-else>
                <div v-if="!profile.changes.length" class="manage-history-empty"><svg viewBox="0 0 24 24"><path d="M12 8v5l3 2M4 12a8 8 0 1 0 2-5.3L4 9M4 4v5h5"/></svg><strong>还没有主页变更</strong><span>用户、AI 和角色的修改都会记录在这里</span></div>
                <div v-else class="manage-history-list"><article v-for="change in profile.changes" :key="change.id" :class="change.status"><header><strong>{{ {nickname:'网名',socialId:'社交 ID',signature:'个性签名',coverStyle:'主页背景',momentEdit:'编辑朋友圈',momentDelete:'删除朋友圈',momentPublish:'发布朋友圈'}[change.field] || change.field }}</strong><span>{{ change.source === 'user' ? '用户修改' : change.source === 'ai-assist' ? 'AI 辅助' : '角色申请' }}</span></header><p><del>{{ change.before || '空' }}</del><svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5 5 5-5 5"/></svg><b>{{ change.after }}</b></p><footer><time>{{ new Date(change.createdAt).toLocaleString('zh-CN') }}</time><div v-if="change.status === 'pending'"><button type="button" @click="reviewChange(change,false)">拒绝</button><button class="accept" type="button" @click="reviewChange(change,true)">同意</button></div><span v-else>{{ change.status === 'applied' ? '已生效' : '已拒绝' }}</span></footer></article></div>
              </template>
            </div>
          </section>
        </div>
      </Transition>

      <Transition name="social-sheet">
        <div v-if="showManualMoment" class="character-sheet-overlay center" @click.self="showManualMoment = false"><section class="character-editor-modal" role="dialog" aria-modal="true"><header><div><h2>替角色发布朋友圈</h2><span>发布后角色可按权限感知和管理</span></div><button type="button" aria-label="关闭" @click="showManualMoment = false"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><label><span>朋友圈内容</span><textarea v-model="manualMomentText" maxlength="1000" autofocus placeholder="记录这一刻的想法…"></textarea><small>{{ manualMomentText.length }}/1000</small></label><footer><button type="button" @click="showManualMoment = false">取消</button><button class="primary" type="button" :disabled="!manualMomentText.trim() || manualSubmitting" @click="submitManualMoment"><span v-if="manualSubmitting" class="character-loading-ring small"></span>{{ manualSubmitting ? '发布中…' : '发布' }}</button></footer></section></div>
      </Transition>

      <Transition name="social-sheet">
        <div v-if="editingMoment" class="character-sheet-overlay center" @click.self="editingMoment = null"><section class="character-editor-modal" role="dialog" aria-modal="true"><header><div><h2>编辑朋友圈</h2><span>{{ sourceLabel(editingMoment) }} · {{ formatTime(editingMoment.time) }}</span></div><button type="button" aria-label="关闭" @click="editingMoment = null"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><label><span>朋友圈内容</span><textarea v-model="editingText" maxlength="1000"></textarea><small>{{ editingText.length }}/1000</small></label><footer><button class="danger-text" type="button" @click="deleteTarget = editingMoment; editingMoment = null">删除</button><button type="button" @click="editingMoment = null">取消</button><button class="primary" type="button" :disabled="!editingText.trim()" @click="saveEditedMoment">保存</button></footer></section></div>
      </Transition>

      <Transition name="social-sheet">
        <div v-if="deleteTarget" class="character-sheet-overlay center" @click.self="deleteTarget = null"><section class="character-confirm-modal" role="alertdialog" aria-modal="true"><div class="confirm-icon"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg></div><h2>删除这条朋友圈？</h2><p>删除后无法恢复，其他角色也将无法再看到它。</p><div><button type="button" @click="deleteTarget = null">取消</button><button class="danger" type="button" @click="confirmDelete">删除</button></div></section></div>
      </Transition>
    </Teleport>

    <CharacterProfileAiModal :visible="showAi" :chat="props.chat" :existing-moments="moments" @close="showAi = false" @apply="applyAiResult" />
  </div>
</template>

<style scoped src="./CharacterProfileView.css"></style>
