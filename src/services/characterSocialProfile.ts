/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type SocialManagementMode = 'readonly' | 'confirm' | 'autonomous'

export type SocialProfilePermissions = {
  nickname: boolean
  socialId: boolean
  signature: boolean
  cover: boolean
  publishMoments: boolean
  editMoments: boolean
  deleteMoments: boolean
  manageUserMoments: boolean
  generateImages: boolean
}

export type SocialProfileChange = {
  id: string
  field: string
  before: unknown
  after: unknown
  source: 'user' | 'character' | 'ai-assist'
  createdAt: number
  status: 'applied' | 'pending' | 'rejected'
}

export type CharacterSocialProfile = {
  nickname: string
  socialId: string
  signature: string
  coverImageKey: string
  awarenessEnabled: boolean
  managementMode: SocialManagementMode
  permissions: SocialProfilePermissions
  generation: {
    includeRecentChat: boolean
    allowChatDetails: boolean
    momentCount: number
  }
  changes: SocialProfileChange[]
  updatedAt: number
}

const createSocialId = (characterId?: string | number) => {
  const seed = String(characterId ?? Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(-8)
  return `nrt_${seed || Math.random().toString(36).slice(2, 8)}`
}

export const defaultSocialProfile = (chat?: any): CharacterSocialProfile => ({
  nickname: String(chat?.realName || chat?.name || '').trim(),
  socialId: createSocialId(chat?.id),
  signature: '',
  coverImageKey: `profile_cover_${String(chat?.characterEntityId || chat?.id || 'unknown')}`,
  awarenessEnabled: false,
  managementMode: 'readonly',
  permissions: {
    nickname: true,
    socialId: false,
    signature: true,
    cover: true,
    publishMoments: true,
    editMoments: true,
    deleteMoments: false,
    manageUserMoments: false,
    generateImages: false
  },
  generation: {
    includeRecentChat: true,
    allowChatDetails: false,
    momentCount: 3
  },
  changes: [],
  updatedAt: Date.now()
})

export const normalizeSocialProfile = (chat: any): CharacterSocialProfile => {
  const defaults = defaultSocialProfile(chat)
  const saved = chat?.socialProfile && typeof chat.socialProfile === 'object' ? chat.socialProfile : {}
  return {
    ...defaults,
    ...saved,
    nickname: String(saved.nickname || defaults.nickname).trim(),
    socialId: String(saved.socialId || defaults.socialId).trim(),
    signature: String(saved.signature || ''),
    coverImageKey: String(saved.coverImageKey || defaults.coverImageKey),
    managementMode: ['readonly', 'confirm', 'autonomous'].includes(saved.managementMode) ? saved.managementMode : defaults.managementMode,
    permissions: { ...defaults.permissions, ...(saved.permissions || {}) },
    generation: {
      ...defaults.generation,
      ...(saved.generation || {}),
      momentCount: Math.min(20, Math.max(1, Number(saved.generation?.momentCount || defaults.generation.momentCount)))
    },
    changes: Array.isArray(saved.changes) ? saved.changes.slice(0, 80) : [],
    updatedAt: Number(saved.updatedAt || defaults.updatedAt)
  }
}

export const ensureSocialProfile = (chat: any): CharacterSocialProfile => {
  const normalized = normalizeSocialProfile(chat)
  if (chat) chat.socialProfile = normalized
  return normalized
}

export const applySocialProfilePatch = (
  chat: any,
  patch: Partial<Pick<CharacterSocialProfile, 'nickname' | 'socialId' | 'signature'>>,
  source: SocialProfileChange['source'] = 'user'
) => {
  const profile = ensureSocialProfile(chat)
  const now = Date.now()
  Object.entries(patch).forEach(([field, value]) => {
    if (value === undefined || value === (profile as any)[field]) return
    profile.changes.unshift({
      id: `${now}_${field}_${Math.random().toString(36).slice(2, 6)}`,
      field,
      before: (profile as any)[field],
      after: value,
      source,
      createdAt: now,
      status: 'applied'
    })
    ;(profile as any)[field] = value
  })
  profile.changes = profile.changes.slice(0, 80)
  profile.updatedAt = now
  return profile
}

export const buildSocialProfilePrompt = (chat: any, english = false) => {
  const profile = normalizeSocialProfile(chat)
  if (!profile.awarenessEnabled) return ''
  const permissions = Object.entries(profile.permissions).filter(([, enabled]) => enabled).map(([key]) => key).join(', ') || 'none'
  if (english) {
    return `\n\n[Your social profile]\nNickname: ${profile.nickname || chat?.realName || chat?.name}; social ID: ${profile.socialId}; signature: ${profile.signature || '(none)'}. You may remember and naturally refer to this profile. Management mode: ${profile.managementMode}; permitted fields/actions: ${permissions}. In readonly mode, never output profile-management tags. In confirm mode, changes become requests for user review. In autonomous mode, permitted changes may apply directly. To change one field, output <update_social_profile field="nickname|socialId|signature">new value</update_social_profile>. To edit your post, output <edit_own_moment id="moment id">new content</edit_own_moment>; to delete it, output <delete_own_moment id="moment id" />. These tags are actions outside chat messages. Do not change profile details mechanically or too often.`
  }
  return `\n\n【你的社交主页】\n网名：${profile.nickname || chat?.realName || chat?.name}；ID：${profile.socialId}；个性签名：${profile.signature || '暂无'}。你知道并可以自然记住这些资料。管理模式：${profile.managementMode === 'readonly' ? '只读' : profile.managementMode === 'confirm' ? '修改需用户确认' : '自主管理'}；允许的字段与动作：${permissions}。只读模式下不得输出主页修改标签；需确认模式下修改会进入待确认；自主管理模式下允许的修改可以直接生效。修改单个资料字段时输出 <update_social_profile field="nickname|socialId|signature">新内容</update_social_profile>。编辑自己的朋友圈输出 <edit_own_moment id="动态ID">新内容</edit_own_moment>；删除输出 <delete_own_moment id="动态ID" />。这些标签是聊天消息之外的操作，不要放进 <msg>。不要机械或频繁修改主页。`
}

export const persistSocialProfile = (chat: any) => {
  if (!chat?.id) return
  const currentUserId = localStorage.getItem('clingy_chat_auth_state') || ''
  const key = currentUserId ? `clingy_custom_contacts_${currentUserId}` : 'clingy_custom_contacts'
  const saved = localStorage.getItem(key)
  if (!saved) return
  try {
    const contacts = JSON.parse(saved)
    const target = contacts.find((item: any) => String(item.id) === String(chat.id))
    if (target) {
      target.socialProfile = chat.socialProfile
      localStorage.setItem(key, JSON.stringify(contacts))
    }
  } catch (_) {}
}
