/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import { useChatAuth } from './useChatAuth'

export type ChatUserProfileSourceType = 'account' | 'library' | 'custom'

export interface ChatUserProfileSnapshot {
  name: string
  remark: string
  persona: string
  avatarUrl: string
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

export const getEffectiveUserProfile = (chat: any, accountProfile: any) => ({
  ...accountProfile,
  ...(chat?.userProfile || {}),
  // 时区属于当前用户账号，不跟随某个聊天的人设快照。
  timezone: accountProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
})

export const applyUserProfileToChat = (
  chat: any,
  snapshot: ChatUserProfileSnapshot,
  source: ChatUserProfileSource
) => {
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
      useChatAuth().updateAccount(personas[index].boundAccountId!, {
        realName: snapshot.name,
        avatarUrl: snapshot.avatarUrl,
        persona: snapshot.persona
      })
    }
    return { ...personas[index], avatar: snapshot.avatarUrl }
  } catch (error) {
    console.error('Failed to update persona source', error)
    return null
  }
}
