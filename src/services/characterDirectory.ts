/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { normalizeSocialProfile, type CharacterSocialProfile } from './characterSocialProfile'
import { useChatAuth } from '../composables/useChatAuth'
import { ensureSocialCircle, normalizeSocialCircleItem, normalizeSocialCircleSettings, type SocialCircleItem, type SocialCircleSettings, type SocialPrivacy } from './socialGraph'

const DIRECTORY_KEY = 'clingy_character_directory_v1'
const CONTACT_KEY_PREFIX = 'clingy_custom_contacts_'

export interface CharacterDirectoryEntry {
  entityId: string
  ownerAccountId: string
  name: string
  persona: string
  avatarKey: string
  socialProfile: CharacterSocialProfile
  socialCircle: SocialCircleItem[]
  socialCircleSettings: SocialCircleSettings
  socialPrivacy: SocialPrivacy
  discoverable: boolean
  allowFriendRequests: boolean
  sourceForumAccountId?: string
  idAliases: string[]
  createdAt: number
  updatedAt: number
}

export interface ForumContactBridgeInput {
  forumAccountId: string
  name: string
  handle: string
  avatar?: string
  bio?: string
  persona?: string
  interactionSummary?: string
  existingEntityId?: string
}

export interface MatchedListenerContactInput {
  entityId: string
  name: string
  socialId: string
  signature?: string
  persona: string
  avatarUrl?: string
  interactionSummary?: string
}

const cleanId = (value: unknown) => String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const readDirectory = (): CharacterDirectoryEntry[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DIRECTORY_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeDirectory = (entries: CharacterDirectoryEntry[]) => {
  localStorage.setItem(DIRECTORY_KEY, JSON.stringify(entries))
  window.dispatchEvent(new CustomEvent('clingy:character-directory-updated'))
}

const publicIdTaken = (entries: CharacterDirectoryEntry[], socialId: string, entityId?: string) => {
  const normalized = socialId.toLowerCase()
  return entries.some(entry => entry.entityId !== entityId && (
    entry.socialProfile.socialId.toLowerCase() === normalized
    || entry.idAliases.some(alias => alias.toLowerCase() === normalized)
  ))
}

const uniqueSocialId = (entries: CharacterDirectoryEntry[], desired: string, entityId: string) => {
  const base = cleanId(desired) || `nrt_${entityId.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`
  if (!publicIdTaken(entries, base, entityId)) return base
  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${base.slice(0, Math.max(4, 20 - String(suffix).length - 1))}_${suffix}`
    if (!publicIdTaken(entries, candidate, entityId)) return candidate
  }
  return `nrt_${Date.now().toString(36)}`.slice(0, 20)
}

const contactStoreKeys = () => {
  const keys: string[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (key?.startsWith(CONTACT_KEY_PREFIX)) keys.push(key)
  }
  return keys
}

const syncEntryToStoredContacts = (entry: CharacterDirectoryEntry) => {
  contactStoreKeys().forEach(key => {
    try {
      const contacts = JSON.parse(localStorage.getItem(key) || '[]')
      if (!Array.isArray(contacts)) return
      let changed = false
      contacts.forEach((contact: any) => {
        if (String(contact.characterEntityId || contact.id) !== entry.entityId) return
        contact.characterEntityId = entry.entityId
        contact.name = entry.name
        contact.persona = entry.persona
        contact.socialProfile = clone(entry.socialProfile)
        contact.socialCircle = clone(entry.socialCircle || [])
        contact.socialCircleSettings = clone(entry.socialCircleSettings || normalizeSocialCircleSettings(contact))
        contact.socialPrivacy = entry.socialPrivacy || 'public'
        contact.discoverable = entry.discoverable !== false
        contact.allowFriendRequests = entry.allowFriendRequests !== false
        contact.avatarKey = entry.avatarKey || contact.avatarKey
        changed = true
      })
      if (changed) localStorage.setItem(key, JSON.stringify(contacts))
    } catch {}
  })
}

export const registerAccountContactsInDirectory = (contacts: any[], accountId: string) => {
  const entries = readDirectory()
  let changed = false
  contacts.forEach(contact => {
    if (!contact || contact.id === 1) return
    const profile = normalizeSocialProfile(contact)
    let entry = entries.find(item => item.entityId === String(contact.characterEntityId || contact.id))
    if (!entry) entry = entries.find(item => item.socialProfile.socialId.toLowerCase() === profile.socialId.toLowerCase())
    if (entry) {
      const needsSync = String(contact.characterEntityId || '') !== entry.entityId
        || contact.name !== entry.name
        || contact.persona !== entry.persona
        || JSON.stringify(contact.socialProfile || null) !== JSON.stringify(entry.socialProfile)
      contact.characterEntityId = entry.entityId
      contact.name = entry.name
      contact.persona = entry.persona
      contact.socialProfile = clone(entry.socialProfile)
      contact.socialCircle = clone(entry.socialCircle || [])
      contact.socialCircleSettings = clone(entry.socialCircleSettings || normalizeSocialCircleSettings(contact))
      contact.socialPrivacy = entry.socialPrivacy || 'public'
      contact.discoverable = entry.discoverable !== false
      contact.allowFriendRequests = entry.allowFriendRequests !== false
      contact.avatarKey = entry.avatarKey || contact.avatarKey
      if (needsSync) changed = true
      return
    }
    const entityId = String(contact.characterEntityId || contact.id)
    profile.socialId = uniqueSocialId(entries, profile.socialId, entityId)
    contact.characterEntityId = entityId
    contact.socialProfile = profile
    entries.push({
      entityId,
      ownerAccountId: accountId,
      name: String(contact.name || contact.realName || '').trim(),
      persona: String(contact.persona || ''),
      avatarKey: String(contact.avatarKey || `avatar_contact_${contact.id}`),
      socialProfile: clone(profile),
      socialCircle: clone(ensureSocialCircle(contact)),
      socialCircleSettings: clone(normalizeSocialCircleSettings(contact)),
      socialPrivacy: contact.socialPrivacy || 'public',
      discoverable: contact.discoverable !== false,
      allowFriendRequests: contact.allowFriendRequests !== false,
      idAliases: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
    changed = true
  })
  if (changed) writeDirectory(entries)
  return changed
}

export const listCharacterDirectory = () => readDirectory()

export const isFormalChatCharacterContact = (contact: any) => {
  if (!contact || contact.id === 1 || contact.chatType === 'group' || contact.contactState === 'candidate') return false
  const friendship = contact.relationship?.friendship
  return friendship === undefined || friendship === 'friends'
}

export const listCurrentChatCharacterDirectory = () => {
  const { currentChatUserId } = useChatAuth()
  const accountId = currentChatUserId.value
  if (!accountId) return []
  let contacts: any[] = []
  try { contacts = JSON.parse(localStorage.getItem(`${CONTACT_KEY_PREFIX}${accountId}`) || '[]') } catch {}
  const formalEntityIds = new Set(contacts.filter(isFormalChatCharacterContact).map(contact => String(contact.characterEntityId || contact.id)))
  return readDirectory().filter(entry => formalEntityIds.has(entry.entityId))
}

export const refreshCharacterDirectoryFromAllAccounts = () => {
  const { chatAccounts } = useChatAuth()
  chatAccounts.value.forEach(account => {
    try {
      const contacts = JSON.parse(localStorage.getItem(`${CONTACT_KEY_PREFIX}${account.id}`) || '[]')
      if (Array.isArray(contacts)) {
        const changed = registerAccountContactsInDirectory(contacts, account.id)
        if (changed) localStorage.setItem(`${CONTACT_KEY_PREFIX}${account.id}`, JSON.stringify(contacts))
      }
    } catch {}
  })
}

export const searchCharacterDirectory = (query: string) => {
  refreshCharacterDirectoryFromAllAccounts()
  const normalized = cleanId(query.replace(/^id\s*[:：]?\s*/i, '')).toLowerCase()
  if (!normalized) return []
  return readDirectory().filter(entry => entry.discoverable !== false && entry.socialPrivacy !== 'hidden' && (
    entry.socialProfile.socialId.toLowerCase() === normalized
    || entry.idAliases.some(alias => alias.toLowerCase() === normalized)
  ))
}

export const getCharacterDirectoryEntry = (entityId: string) => (
  readDirectory().find(entry => entry.entityId === String(entityId)) || null
)

export const saveCharacterDirectoryProfile = (chat: any) => {
  const entries = readDirectory()
  const entityId = String(chat.characterEntityId || chat.id)
  const entry = entries.find(item => item.entityId === entityId)
  if (!entry) return null
  const profile = normalizeSocialProfile(chat)
  const requestedId = cleanId(profile.socialId)
  if (requestedId.length < 4) throw new Error('角色 ID 至少需要 4 位')
  if (publicIdTaken(entries, requestedId, entityId)) throw new Error('这个角色 ID 已被使用')
  if (entry.socialProfile.socialId.toLowerCase() !== requestedId.toLowerCase()) {
    entry.idAliases = [entry.socialProfile.socialId, ...entry.idAliases].filter((value, index, all) => (
      value.toLowerCase() !== requestedId.toLowerCase() && all.findIndex(item => item.toLowerCase() === value.toLowerCase()) === index
    )).slice(0, 5)
  }
  profile.socialId = requestedId
  entry.name = String(chat.realName || chat.name || entry.name).trim()
  entry.persona = String(chat.persona || entry.persona)
  entry.socialProfile = clone(profile)
  entry.socialCircle = clone(ensureSocialCircle(chat))
  entry.socialCircleSettings = clone(normalizeSocialCircleSettings(chat))
  entry.socialPrivacy = chat.socialPrivacy || entry.socialPrivacy || 'public'
  entry.discoverable = chat.discoverable !== false
  entry.allowFriendRequests = chat.allowFriendRequests !== false
  entry.updatedAt = Date.now()
  writeDirectory(entries)
  syncEntryToStoredContacts(entry)
  return entry
}

export const createDirectoryCandidate = (entry: CharacterDirectoryEntry) => {
  const { currentChatUserId } = useChatAuth()
  const accountId = currentChatUserId.value
  if (!accountId) return null
  const key = `${CONTACT_KEY_PREFIX}${accountId}`
  let contacts: any[] = []
  try { contacts = JSON.parse(localStorage.getItem(key) || '[]') } catch {}
  const existing = contacts.find(contact => String(contact.characterEntityId || contact.id) === entry.entityId)
  if (existing) return existing
  const candidate = {
    id: entry.entityId,
    characterEntityId: entry.entityId,
    name: entry.name,
    remark: '',
    persona: entry.persona,
    avatarKey: entry.avatarKey,
    socialProfile: clone(entry.socialProfile),
    socialCircle: clone(entry.socialCircle || []),
    socialCircleSettings: clone(entry.socialCircleSettings || normalizeSocialCircleSettings(null)),
    socialPrivacy: entry.socialPrivacy || 'public',
    discoverable: entry.discoverable !== false,
    allowFriendRequests: entry.allowFriendRequests !== false,
    socialDiscoveryContext: entry.ownerAccountId === accountId ? null : {
      sourceEntityId: '',
      sourceName: '',
      relation: '',
      privacy: entry.socialPrivacy || 'public',
      allowFriendRequests: entry.allowFriendRequests !== false,
      enableMoments: true
    },
    contactState: 'candidate',
    groups: [],
    messages: [],
    userProfile: null,
    userProfileSource: { type: 'account', name: '账号人设（自动跟随）', hasLocalChanges: false },
    relationship: {
      friendship: 'strangers', blockedBy: 'none', changedAt: Date.now(), stateChangedAt: Date.now(),
      blockedMessages: [], undeliveredUserMessages: [], requests: [], events: [],
      disclosedLinkedAccountIds: [],
      plan: { action: 'none', summary: '目前没有新的打算', visibility: 'exact', status: 'completed' }
    }
  }
  contacts.push(candidate)
  localStorage.setItem(key, JSON.stringify(contacts))
  return candidate
}

export const createForumFriendContact = (input: ForumContactBridgeInput) => {
  const { currentChatUserId } = useChatAuth()
  const accountId = currentChatUserId.value
  if (!accountId) throw new Error('请先登录聊天 App 账号')
  const entries = readDirectory()
  let entry = entries.find(item => item.sourceForumAccountId === input.forumAccountId) || (input.existingEntityId ? entries.find(item => item.entityId === input.existingEntityId) : undefined)
  if (!entry) {
    const suffix = input.forumAccountId.replace(/[^a-zA-Z0-9]/g, '').slice(-12) || Date.now().toString(36)
    const entityId = `forum_${suffix}`
    const socialProfile = normalizeSocialProfile({ id: entityId, name: input.name, socialProfile: { nickname: input.name, socialId: input.handle, signature: input.bio || '' } })
    socialProfile.socialId = uniqueSocialId(entries, socialProfile.socialId, entityId)
    entry = {
      entityId,
      ownerAccountId: accountId,
      name: input.name.trim(),
      persona: [input.persona, input.interactionSummary].filter(Boolean).join('\n\n').slice(0, 4000),
      avatarKey: `forum_avatar_${suffix}`,
      socialProfile,
      socialCircle: [],
      socialCircleSettings: normalizeSocialCircleSettings(null),
      socialPrivacy: 'public',
      discoverable: true,
      allowFriendRequests: true,
      sourceForumAccountId: input.forumAccountId,
      idAliases: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    entries.push(entry)
  }
  entry.sourceForumAccountId = input.forumAccountId
  entry.updatedAt = Date.now()
  writeDirectory(entries)
  const candidate = createDirectoryCandidate(entry)
  if (!candidate) throw new Error('无法写入聊天联系人')
  candidate.contactState = 'friend'
  candidate.forumSourceAccountId = input.forumAccountId
  candidate.avatarUrl = /^https?:|^blob:|^data:image/.test(input.avatar || '') ? input.avatar : candidate.avatarUrl
  candidate.relationship ||= {}
  candidate.relationship.friendship = 'friends'
  candidate.relationship.blockedBy = 'none'
  candidate.relationship.changedAt = Date.now()
  candidate.relationship.stateChangedAt = Date.now()
  candidate.relationship.events ||= []
  candidate.relationship.events.unshift({ id: `forum_friend_${Date.now()}`, type: 'friendship_restored', title: '通过论坛成为好友', detail: input.interactionSummary || '', createdAt: Date.now(), memoryRelevant: true })
  const key = `${CONTACT_KEY_PREFIX}${accountId}`
  let contacts: any[] = []
  try { contacts = JSON.parse(localStorage.getItem(key) || '[]') } catch {}
  const index = contacts.findIndex(contact => String(contact.characterEntityId || contact.id) === entry!.entityId)
  if (index >= 0) contacts[index] = candidate
  else contacts.push(candidate)
  localStorage.setItem(key, JSON.stringify(contacts))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clingy:character-directory-updated'))
  return { entry, contact: candidate }
}

export const createMatchedListenerContact = (input: MatchedListenerContactInput) => {
  const { currentChatUserId } = useChatAuth()
  const accountId = currentChatUserId.value
  if (!accountId) throw new Error('请先登录聊天 App 账号')
  const entries = readDirectory()
  let entry = entries.find(item => item.entityId === input.entityId)
  if (!entry) {
    const socialProfile = normalizeSocialProfile({
      id: input.entityId,
      name: input.name,
      socialProfile: { nickname: input.name, socialId: input.socialId, signature: input.signature || '' }
    })
    socialProfile.socialId = uniqueSocialId(entries, socialProfile.socialId, input.entityId)
    entry = {
      entityId: input.entityId,
      ownerAccountId: accountId,
      name: input.name.trim(),
      persona: input.persona,
      avatarKey: `listen_avatar_${input.entityId.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}`,
      socialProfile,
      socialCircle: [],
      socialCircleSettings: normalizeSocialCircleSettings(null),
      socialPrivacy: 'public',
      discoverable: true,
      allowFriendRequests: true,
      idAliases: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    entries.push(entry)
    writeDirectory(entries)
  }
  const candidate = createDirectoryCandidate(entry)
  if (!candidate) throw new Error('无法写入聊天联系人')
  candidate.name = input.name.trim()
  candidate.persona = input.persona
  candidate.avatarUrl = input.avatarUrl || candidate.avatarUrl
  candidate.contactState = 'friend'
  candidate.relationship ||= {}
  candidate.relationship.friendship = 'friends'
  candidate.relationship.blockedBy = 'none'
  candidate.relationship.changedAt = Date.now()
  candidate.relationship.stateChangedAt = Date.now()
  candidate.relationship.events ||= []
  candidate.relationship.events.unshift({
    id: `listen_friend_${Date.now()}`,
    type: 'friendship_restored',
    title: '通过一起听成为好友',
    detail: input.interactionSummary || '',
    createdAt: Date.now(),
    memoryRelevant: true
  })
  const key = `${CONTACT_KEY_PREFIX}${accountId}`
  let contacts: any[] = []
  try { contacts = JSON.parse(localStorage.getItem(key) || '[]') } catch {}
  const index = contacts.findIndex(contact => String(contact.characterEntityId || contact.id) === entry!.entityId)
  if (index >= 0) contacts[index] = candidate
  else contacts.push(candidate)
  localStorage.setItem(key, JSON.stringify(contacts))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clingy:character-directory-updated'))
  return { entry, contact: candidate }
}

export const isDirectoryOwner = (entityId: string) => {
  const { currentChatUserId } = useChatAuth()
  return getCharacterDirectoryEntry(entityId)?.ownerAccountId === currentChatUserId.value
}

export const upsertSocialCircleCharacter = (ownerChat: any, rawItem: SocialCircleItem) => {
  const item = normalizeSocialCircleItem(rawItem)
  const entries = readDirectory()
  const ownerEntry = entries.find(entry => entry.entityId === String(ownerChat.characterEntityId || ownerChat.id))
  const accountId = ownerEntry?.ownerAccountId || useChatAuth().currentChatUserId.value || 'default-user'
  let entry = entries.find(existing => existing.entityId === item.entityId)
  const socialProfile = normalizeSocialProfile({
    id: item.entityId,
    name: item.name,
    socialProfile: { nickname: item.nickname, socialId: item.socialId, signature: item.signature }
  })
  socialProfile.nickname = item.nickname || item.name
  socialProfile.socialId = uniqueSocialId(entries, item.socialId, item.entityId)
  socialProfile.signature = item.signature
  const reciprocalCircle = item.reciprocalVisible ? [normalizeSocialCircleItem({
    id: `edge_${item.entityId}_${String(ownerChat.characterEntityId || ownerChat.id)}`,
    entityId: String(ownerChat.characterEntityId || ownerChat.id),
    name: ownerChat.realName || ownerChat.name,
    nickname: ownerChat.socialProfile?.nickname || ownerChat.realName || ownerChat.name,
    socialId: ownerChat.socialProfile?.socialId,
    signature: ownerChat.socialProfile?.signature || '',
    relation: `我的${item.relation || '熟人'}`,
    category: item.category,
    persona: String(ownerChat.persona || '').slice(0, 800),
    avatarKey: ownerChat.avatarKey || '',
    avatarUrl: ownerChat.avatarUrl || '',
    privacy: 'public',
    discoverable: true,
    allowFriendRequests: true,
    reciprocalVisible: true,
    enableMoments: true,
    allowMention: true,
    interactionFrequency: item.interactionFrequency,
    origin: 'directory'
  })] : []
  if (entry) {
    entry.name = item.name
    entry.persona = item.persona
    entry.avatarKey = item.avatarKey || ''
    entry.socialProfile = socialProfile
    entry.socialPrivacy = item.privacy
    entry.discoverable = item.discoverable
    entry.allowFriendRequests = item.allowFriendRequests
    entry.socialCircle ||= reciprocalCircle
    if (item.reciprocalVisible && !entry.socialCircle.some(person => person.entityId === reciprocalCircle[0]?.entityId)) entry.socialCircle.unshift(...reciprocalCircle)
    entry.updatedAt = Date.now()
  } else {
    entry = {
      entityId: item.entityId,
      ownerAccountId: accountId,
      name: item.name,
      persona: item.persona,
      avatarKey: item.avatarKey || '',
      socialProfile,
      socialCircle: reciprocalCircle,
      socialCircleSettings: normalizeSocialCircleSettings(null),
      socialPrivacy: item.privacy,
      discoverable: item.discoverable,
      allowFriendRequests: item.allowFriendRequests,
      idAliases: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    entries.push(entry)
  }
  writeDirectory(entries)
  return entry
}

export const syncSocialCircleToDirectory = (chat: any) => {
  ensureSocialCircle(chat).forEach(item => upsertSocialCircleCharacter(chat, item))
  if (isDirectoryOwner(String(chat.characterEntityId || chat.id))) saveCharacterDirectoryProfile(chat)
}
