/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import { useChatAuth } from './useChatAuth'

export type ChatUserProfileSourceType = 'account' | 'library' | 'custom'

export interface ChatUserProfileSnapshot {
  name: string
  remark: string
  persona: string
  avatarUrl: string
  timezone?: string
  clockMode?: 'system' | 'timezone' | 'custom'
  clockAnchorRealAt?: number
  clockAnchorTimeAt?: number
}

export interface ChatUserProfileSource {
  type: ChatUserProfileSourceType
  personaId?: number
  name: string
  hasLocalChanges?: boolean
}

export interface UserPersonaRecord {
  id: number
  name: string
  signature: string
  customText: string
  isCreate?: boolean
  networkName?: string
  avatar?: string
  boundAccountId?: string
}

export const ACCOUNT_PROFILE_SOURCE_NAME = '账号人设（自动跟随）'

const avatarStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'avatars'
})

export const getPersonaStorageKey = () => {
  const { currentChatUserId } = useChatAuth()
  return currentChatUserId.value
    ? `app_chat_personas_${currentChatUserId.value}`
    : 'app_chat_personas'
}

const resolvePersonaAvatar = async (persona: UserPersonaRecord) => {
  const resolved = { ...persona }
  if (typeof resolved.avatar !== 'string') return resolved

  if (resolved.avatar.startsWith('localforage:')) {
    const stored = await avatarStore.getItem<string>(resolved.avatar.slice('localforage:'.length))
    if (stored) resolved.avatar = stored
  } else if (resolved.avatar.startsWith('account-avatar:')) {
    const accountId = resolved.avatar.slice('account-avatar:'.length)
    const account = useChatAuth().chatAccounts.value.find(item => item.id === accountId)
    resolved.avatar = account?.avatarUrl || ''
  }
  return resolved
}

export const loadUserPersonas = async (): Promise<UserPersonaRecord[]> => {
  const raw = localStorage.getItem(getPersonaStorageKey())
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const personas = parsed.filter((item: UserPersonaRecord) => !item.isCreate)
    return Promise.all(personas.map(resolvePersonaAvatar))
  } catch {
    return []
  }
}

export const personaToSnapshot = (persona: UserPersonaRecord): ChatUserProfileSnapshot => ({
  name: persona.name || '',
  remark: persona.customText || '',
  persona: persona.signature || '',
  avatarUrl: persona.avatar || ''
})

const hasSnapshotContent = (snapshot: any) => (
  !!snapshot && ['name', 'remark', 'persona', 'avatarUrl'].some(key => {
    const value = snapshot[key]
    return value !== null && value !== undefined && String(value).trim() !== ''
  })
)

export const getEffectiveUserProfile = (chat: any, accountProfile: any) => {
  const sourceType = chat?.userProfileSource?.type
  const hasExplicitOverride = sourceType === 'library' || sourceType === 'custom'
  // 没有来源标记但保存过非空快照的旧聊天，按独立人设保留，避免迁移时丢失用户设置。
  const hasLegacyOverride = !sourceType && hasSnapshotContent(chat?.userProfile)
  const profile = hasExplicitOverride || hasLegacyOverride
    ? { ...accountProfile, ...(chat?.userProfile || {}) }
    : { ...accountProfile }

  return {
    ...profile,
    // 时区属于当前用户账号，不跟随某个聊天的人设快照。
    timezone: accountProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    clockMode: accountProfile?.clockMode || 'system',
    clockAnchorRealAt: Number(accountProfile?.clockAnchorRealAt || Date.now()),
    clockAnchorTimeAt: Number(accountProfile?.clockAnchorTimeAt || Date.now())
  }
}

export const normalizeChatUserProfileState = (chat: any) => {
  if (!chat || typeof chat !== 'object') return false
  const sourceType = chat.userProfileSource?.type
  const personaId = chat.userProfileSource?.personaId

  if (sourceType === 'library' || sourceType === 'custom') return false

  if (!sourceType && hasSnapshotContent(chat.userProfile)) {
    chat.userProfileSource = {
      type: 'custom',
      name: '历史独立人设',
      hasLocalChanges: false
    }
    return true
  }

  let changed = chat.userProfile !== null || sourceType !== 'account'
  if (chat.userProfileSource?.name !== ACCOUNT_PROFILE_SOURCE_NAME || chat.userProfileSource?.hasLocalChanges) {
    changed = true
  }
  chat.userProfile = null
  chat.userProfileSource = {
    type: 'account',
    ...(personaId ? { personaId } : {}),
    name: ACCOUNT_PROFILE_SOURCE_NAME,
    hasLocalChanges: false
  }
  return changed
}

export const syncBoundPersonaToCurrentAccount = async () => {
  const { currentChatUserId, currentAccount, updateAccount } = useChatAuth()
  const accountId = currentChatUserId.value
  const account = currentAccount.value
  if (!accountId || !account) return null

  const personas = await loadUserPersonas()
  const boundPersona = personas.find(item => item.boundAccountId === accountId)
  if (!boundPersona) return null

  const snapshot = personaToSnapshot(boundPersona)
  const accountUpdates = {
    name: boundPersona.networkName || account.name,
    realName: snapshot.name,
    avatarUrl: snapshot.avatarUrl,
    persona: snapshot.persona
  }
  if (Object.entries(accountUpdates).some(([key, value]) => account[key as keyof typeof account] !== value)) {
    updateAccount(accountId, accountUpdates)
  }

  const extraKey = `clingy_user_extra_${accountId}`
  let extra: Record<string, any> = {}
  try {
    extra = JSON.parse(localStorage.getItem(extraKey) || '{}')
  } catch {}
  if (extra.remark !== snapshot.remark) {
    localStorage.setItem(extraKey, JSON.stringify({ ...extra, remark: snapshot.remark }))
  }
  return snapshot
}

export const applyUserProfileToChat = (
  chat: any,
  snapshot: ChatUserProfileSnapshot,
  source: ChatUserProfileSource
) => {
  if (source.type === 'account') {
    chat.userProfile = null
    chat.userProfileSource = {
      type: 'account',
      ...(source.personaId ? { personaId: source.personaId } : {}),
      name: ACCOUNT_PROFILE_SOURCE_NAME,
      hasLocalChanges: false
    }
    return
  }
  chat.userProfile = { ...snapshot }
  chat.userProfileSource = { ...source, hasLocalChanges: false }
}

export const updateStoredPersona = async (
  personaId: number,
  snapshot: ChatUserProfileSnapshot
): Promise<UserPersonaRecord | null> => {
  const key = getPersonaStorageKey()
  const raw = localStorage.getItem(key)
  if (!raw) return null

  try {
    const personas: UserPersonaRecord[] = JSON.parse(raw)
    const index = personas.findIndex(item => item.id === personaId)
    if (index < 0) return null

    const storedAvatar = personas[index].avatar
    personas[index] = {
      ...personas[index],
      name: snapshot.name,
      signature: snapshot.persona,
      customText: snapshot.remark
    }

    // 未修改头像时保留轻量引用，避免把 IndexedDB 中的大图重新塞入 localStorage。
    const resolvedOldAvatar = await resolvePersonaAvatar({ ...personas[index], avatar: storedAvatar })
    if (snapshot.avatarUrl !== (resolvedOldAvatar.avatar || '')) {
      if (snapshot.avatarUrl.startsWith('data:image/')) {
        const avatarKey = `chat_persona_avatar_${personaId}_${Date.now()}`
        await avatarStore.setItem(avatarKey, snapshot.avatarUrl)
        personas[index].avatar = `localforage:${avatarKey}`
      } else {
        personas[index].avatar = snapshot.avatarUrl
      }
    }

    localStorage.setItem(key, JSON.stringify(personas))

    if (personas[index].boundAccountId) {
      const boundAccountId = personas[index].boundAccountId!
      useChatAuth().updateAccount(boundAccountId, {
        realName: snapshot.name,
        avatarUrl: snapshot.avatarUrl,
        persona: snapshot.persona
      })
      const extraKey = `clingy_user_extra_${boundAccountId}`
      let extra: Record<string, any> = {}
      try {
        extra = JSON.parse(localStorage.getItem(extraKey) || '{}')
      } catch {}
      localStorage.setItem(extraKey, JSON.stringify({ ...extra, remark: snapshot.remark }))
    }
    return { ...personas[index], avatar: snapshot.avatarUrl }
  } catch (error) {
    console.error('Failed to update persona source', error)
    return null
  }
}
