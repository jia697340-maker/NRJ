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
  const characterName = String(chat?.realName || chat?.name || (english ? 'current character' : '当前角色'))
  const permissions = Object.entries(profile.permissions).filter(([, enabled]) => enabled).map(([key]) => key).join(', ') || 'none'
  const modeRule = english
    ? profile.managementMode === 'readonly'
      ? 'This profile is read-only, so no profile-management action tags are permitted.'
      : profile.managementMode === 'confirm'
        ? `Any change proposed by ${characterName} becomes a request for the user's review.`
        : `Permitted changes proposed by ${characterName} may take effect directly.`
    : profile.managementMode === 'readonly'
      ? '当前主页为只读状态，不使用任何主页修改标签。'
      : profile.managementMode === 'confirm'
        ? `角色${characterName}提出的修改会交由用户确认。`
        : `角色${characterName}可以直接执行允许范围内的修改。`
  if (english) {
    return `\n\n[${characterName}'s social profile]\nNickname: ${profile.nickname || chat?.realName || chat?.name}; social ID: ${profile.socialId}; signature: ${profile.signature || '(none)'}. Management mode: ${profile.managementMode}; permitted fields/actions: ${permissions}. ${characterName} may naturally remember this profile. ${modeRule} To change one field: <update_social_profile field="nickname|socialId|signature">new value</update_social_profile>. To edit or delete a post owned by ${characterName}: <edit_own_moment id="moment id">new content</edit_own_moment> or <delete_own_moment id="moment id" />. These actions remain outside chat messages and are not used mechanically or too often.`
  }
  return `\n\n【角色${characterName}的社交主页】\n网名：${profile.nickname || chat?.realName || chat?.name}；ID：${profile.socialId}；个性签名：${profile.signature || '暂无'}。管理模式：${profile.managementMode === 'readonly' ? '只读' : profile.managementMode === 'confirm' ? '修改需用户确认' : '自主管理'}；允许的字段与动作：${permissions}。角色${characterName}可以自然记住这些资料。${modeRule} 修改字段使用 <update_social_profile field="nickname|socialId|signature">新内容</update_social_profile>；编辑或删除角色${characterName}自己的朋友圈使用 <edit_own_moment id="动态ID">新内容</edit_own_moment> 或 <delete_own_moment id="动态ID" />。这些操作位于聊天消息之外，不机械或频繁使用。`
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
