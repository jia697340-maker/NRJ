/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import type { ChatAccount } from '../composables/useChatAuth'

export type UserProfileAudience = 'public' | 'friends' | 'private'
export type UserProfileSection = 'identity' | 'socialId' | 'signature' | 'status' | 'moments' | 'relationships'
export type UserNetworkPresentation = 'full' | 'compact' | 'anonymous' | 'hidden'
export type UserPrivacyConfirmation = 'always' | 'sensitive' | 'private_to_public' | 'never'

export interface UserCharacterPrivacyOverride {
  characterId: string
  profileAudience?: UserProfileAudience | 'inherit'
  momentsAudience?: UserProfileAudience | 'inherit'
  relationshipsAudience?: UserProfileAudience | 'inherit'
  statusAudience?: UserProfileAudience | 'inherit'
  discoverable?: boolean | null
  allowFriendRequests?: boolean | null
  allowMomentLikes?: boolean | null
  allowMomentComments?: boolean | null
  allowMomentMentions?: boolean | null
  allowProfileAwareness?: boolean | null
  networkPresentation?: UserNetworkPresentation | 'inherit'
  showOnUserProfile?: boolean | null
  publicRelationLabel?: string
  relationLabelApproved?: boolean
  pinned?: boolean
  pinOrder?: number
  updatedAt: number
}

export interface UserSocialProfile {
  version: 1
  accountInternalId: string
  displayName: string
  socialId: string
  signature: string
  coverImageKey: string
  profileAudience: UserProfileAudience
  sectionAudiences: Record<UserProfileSection, UserProfileAudience>
  hiddenSections: UserProfileSection[]
  discoverable: boolean
  discoveryScope: 'all' | 'chatted' | 'mutual' | 'selected' | 'none'
  allowFriendRequests: boolean
  friendRequestScope: 'discoverable' | 'chatted' | 'mutual' | 'selected' | 'none'
  participateInCharacterNetworks: boolean
  networkDefaultPresentation: UserNetworkPresentation
  showCharacterRelationships: boolean
  allowMomentLikes: boolean
  allowMomentComments: boolean
  allowMomentMentions: boolean
  allowProfileAwareness: boolean
  showStatus: boolean
  statusText: string
  statusCreatedAt: number
  statusExpiresAt: number | null
  keepExpiredStatus: boolean
  recentStatuses: Array<{ text: string; createdAt: number; expiredAt: number }>
  privacyConfirmation: UserPrivacyConfirmation
  overrides: Record<string, UserCharacterPrivacyOverride>
  updatedAt: number
}

export interface UserProfileViewer {
  characterId?: string | number
  isSelf?: boolean
  isFriend?: boolean
  blocked?: boolean
  hasChat?: boolean
  isMutual?: boolean
}

const PROFILE_PREFIX = 'clingy_user_social_profile_'
export const userProfileCoverStore = localforage.createInstance({ name: 'nrt-app', storeName: 'user_profile_covers' })

export const getUserSocialProfileKey = (accountInternalId: string) => `${PROFILE_PREFIX}${accountInternalId}`

export const defaultUserSocialProfile = (account: ChatAccount): UserSocialProfile => ({
  version: 1,
  accountInternalId: account.id,
  displayName: account.name || '',
  socialId: account.accountId || '',
  signature: '',
  coverImageKey: `user_profile_cover_${account.id}`,
  profileAudience: 'private',
  sectionAudiences: {
    identity: 'private', socialId: 'private', signature: 'private', status: 'private', moments: 'private', relationships: 'private'
  },
  hiddenSections: [],
  discoverable: false,
  discoveryScope: 'none',
  allowFriendRequests: false,
  friendRequestScope: 'none',
  participateInCharacterNetworks: false,
  networkDefaultPresentation: 'full',
  showCharacterRelationships: false,
  allowMomentLikes: false,
  allowMomentComments: false,
  allowMomentMentions: false,
  allowProfileAwareness: false,
  showStatus: false,
  statusText: '',
  statusCreatedAt: 0,
  statusExpiresAt: null,
  keepExpiredStatus: true,
  recentStatuses: [],
  privacyConfirmation: 'always',
  overrides: {},
  updatedAt: Date.now()
})

const audiences: UserProfileAudience[] = ['public', 'friends', 'private']
const presentations: UserNetworkPresentation[] = ['full', 'compact', 'anonymous', 'hidden']

export const normalizeUserSocialProfile = (account: ChatAccount, raw?: Partial<UserSocialProfile> | null): UserSocialProfile => {
  const defaults = defaultUserSocialProfile(account)
  const saved = raw && typeof raw === 'object' ? raw : {}
  const sectionAudiences = { ...defaults.sectionAudiences, ...(saved.sectionAudiences || {}) }
  Object.keys(sectionAudiences).forEach(key => {
    const section = key as UserProfileSection
    if (!audiences.includes(sectionAudiences[section])) sectionAudiences[section] = defaults.sectionAudiences[section]
  })
  const overrides: Record<string, UserCharacterPrivacyOverride> = {}
  Object.entries(saved.overrides || {}).forEach(([id, value]) => {
    if (!value || typeof value !== 'object') return
    overrides[id] = { ...value, characterId: id, updatedAt: Number(value.updatedAt || Date.now()) }
  })
  return {
    ...defaults,
    ...saved,
    version: 1,
    accountInternalId: account.id,
    displayName: String(saved.displayName || account.name || '').trim().slice(0, 40),
    socialId: account.accountId || String(saved.socialId || ''),
    signature: String(saved.signature || '').slice(0, 160),
    coverImageKey: String(saved.coverImageKey || defaults.coverImageKey),
    profileAudience: audiences.includes(saved.profileAudience as UserProfileAudience) ? saved.profileAudience! : defaults.profileAudience,
    sectionAudiences,
    hiddenSections: Array.isArray(saved.hiddenSections) ? saved.hiddenSections.filter(item => Object.keys(defaults.sectionAudiences).includes(item)) : [],
    networkDefaultPresentation: presentations.includes(saved.networkDefaultPresentation as UserNetworkPresentation) ? saved.networkDefaultPresentation! : defaults.networkDefaultPresentation,
    statusExpiresAt: saved.statusExpiresAt === null || saved.statusExpiresAt === undefined ? null : Number(saved.statusExpiresAt),
    recentStatuses: Array.isArray(saved.recentStatuses) ? saved.recentStatuses.slice(0, 12) : [],
    overrides,
    updatedAt: Number(saved.updatedAt || defaults.updatedAt)
  }
}

export const loadUserSocialProfile = (account: ChatAccount): UserSocialProfile => {
  let raw: Partial<UserSocialProfile> | null = null
  try { raw = JSON.parse(localStorage.getItem(getUserSocialProfileKey(account.id)) || 'null') } catch {}
  const profile = normalizeUserSocialProfile(account, raw)
  if (!raw) saveUserSocialProfile(profile)
  return expireUserStatus(profile)
}

export const saveUserSocialProfile = (profile: UserSocialProfile) => {
  profile.updatedAt = Date.now()
  localStorage.setItem(getUserSocialProfileKey(profile.accountInternalId), JSON.stringify(profile))
  window.dispatchEvent(new CustomEvent('clingy:user-profile-updated', { detail: { accountId: profile.accountInternalId } }))
}

export const expireUserStatus = (profile: UserSocialProfile, now = Date.now()) => {
  if (!profile.statusText || !profile.statusExpiresAt || profile.statusExpiresAt > now) return profile
  if (profile.keepExpiredStatus) {
    profile.recentStatuses = [
      { text: profile.statusText, createdAt: profile.statusCreatedAt || now, expiredAt: profile.statusExpiresAt },
      ...profile.recentStatuses.filter(item => item.text !== profile.statusText)
    ].slice(0, 12)
  }
  profile.statusText = ''
  profile.statusCreatedAt = 0
  profile.statusExpiresAt = null
  saveUserSocialProfile(profile)
  return profile
}

export const getCharacterOverride = (profile: UserSocialProfile, characterId: string | number) => (
  profile.overrides[String(characterId)] || null
)

const audienceAllows = (audience: UserProfileAudience, viewer: UserProfileViewer) => (
  Boolean(viewer.isSelf) || (audience === 'public') || (audience === 'friends' && Boolean(viewer.isFriend))
)

export const canCharacterDiscoverUser = (profile: UserSocialProfile, viewer: UserProfileViewer) => {
  if (viewer.isSelf) return true
  if (viewer.blocked) return false
  const override = viewer.characterId === undefined ? null : getCharacterOverride(profile, viewer.characterId)
  if (override?.discoverable !== null && override?.discoverable !== undefined) return override.discoverable
  if (!profile.discoverable) return false
  if (profile.discoveryScope === 'none' || profile.discoveryScope === 'selected') return false
  if (profile.discoveryScope === 'chatted') return Boolean(viewer.hasChat)
  if (profile.discoveryScope === 'mutual') return Boolean(viewer.isMutual)
  return true
}

export const canCharacterRequestUser = (profile: UserSocialProfile, viewer: UserProfileViewer) => {
  if (viewer.blocked) return false
  const override = viewer.characterId === undefined ? null : getCharacterOverride(profile, viewer.characterId)
  if (override?.allowFriendRequests !== null && override?.allowFriendRequests !== undefined) return override.allowFriendRequests
  if (!profile.allowFriendRequests) return false
  if (profile.friendRequestScope === 'none' || profile.friendRequestScope === 'selected') return false
  if (profile.friendRequestScope === 'chatted') return Boolean(viewer.hasChat)
  if (profile.friendRequestScope === 'mutual') return Boolean(viewer.isMutual)
  return canCharacterDiscoverUser(profile, viewer)
}

export const canViewUserProfileSection = (profile: UserSocialProfile, section: UserProfileSection, viewer: UserProfileViewer) => {
  if (viewer.isSelf) return !profile.hiddenSections.includes(section)
  if (viewer.blocked || profile.hiddenSections.includes(section)) return false
  const override = viewer.characterId === undefined ? null : getCharacterOverride(profile, viewer.characterId)
  const overrideAudience = section === 'moments' ? override?.momentsAudience
    : section === 'relationships' ? override?.relationshipsAudience
      : section === 'status' ? override?.statusAudience : override?.profileAudience
  const audience = overrideAudience && overrideAudience !== 'inherit' ? overrideAudience : profile.sectionAudiences[section]
  return audienceAllows(profile.profileAudience, viewer) && audienceAllows(audience, viewer)
}

export const getNetworkPresentation = (profile: UserSocialProfile, viewer: UserProfileViewer): UserNetworkPresentation => {
  if (!profile.participateInCharacterNetworks || viewer.blocked) return 'hidden'
  const override = viewer.characterId === undefined ? null : getCharacterOverride(profile, viewer.characterId)
  const mode = override?.networkPresentation && override.networkPresentation !== 'inherit'
    ? override.networkPresentation
    : profile.networkDefaultPresentation
  return mode
}

export const applyUserPrivacyPreset = (profile: UserSocialProfile, audience: UserProfileAudience) => {
  profile.profileAudience = audience
  Object.keys(profile.sectionAudiences).forEach(key => { profile.sectionAudiences[key as UserProfileSection] = audience })
  const enabled = audience !== 'private'
  profile.discoverable = enabled
  profile.discoveryScope = enabled ? 'all' : 'none'
  profile.allowFriendRequests = enabled
  profile.friendRequestScope = enabled ? 'discoverable' : 'none'
  profile.participateInCharacterNetworks = enabled
  profile.showCharacterRelationships = enabled
  profile.showStatus = enabled
  profile.allowMomentLikes = enabled
  profile.allowMomentComments = enabled
  profile.allowMomentMentions = enabled
  profile.allowProfileAwareness = enabled
  profile.updatedAt = Date.now()
}

export const buildUserProfilePrompt = (profile: UserSocialProfile, viewer: UserProfileViewer, moments: any[] = []) => {
  if (!profile.allowProfileAwareness || !canViewUserProfileSection(profile, 'identity', viewer)) return ''
  const override = viewer.characterId === undefined ? null : getCharacterOverride(profile, viewer.characterId)
  if (override?.allowProfileAwareness === false) return ''
  const parts = [`用户主页网名：${profile.displayName || '未设置'}`]
  if (canViewUserProfileSection(profile, 'signature', viewer) && profile.signature) parts.push(`签名：${profile.signature}`)
  if (profile.showStatus && canViewUserProfileSection(profile, 'status', viewer) && profile.statusText) parts.push(`当前状态：${profile.statusText}`)
  if (profile.allowMomentMentions && canViewUserProfileSection(profile, 'moments', viewer)) {
    const recent = moments.slice(0, 3).map(item => String(item.content || '').slice(0, 100)).filter(Boolean)
    if (recent.length) parts.push(`最近动态：${recent.join('；')}`)
  }
  return `\n\n【用户的社交主页】\n${parts.join('；')}。只在自然相关时提及，不泄露不可见资料。如果角色真心希望公开一段新的关系标签，可以输出 <propose_user_relation>关系标签</propose_user_relation> 交由用户确认；未经确认不得擅自公开。`
}

export const removeUserSocialProfile = async (accountInternalId: string) => {
  let raw: UserSocialProfile | null = null
  try { raw = JSON.parse(localStorage.getItem(getUserSocialProfileKey(accountInternalId)) || 'null') } catch {}
  localStorage.removeItem(getUserSocialProfileKey(accountInternalId))
  await userProfileCoverStore.removeItem(raw?.coverImageKey || `user_profile_cover_${accountInternalId}`)
}
