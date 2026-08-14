/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { normalizeSocialProfile, type CharacterSocialProfile } from './characterSocialProfile'
import { useChatAuth } from '../composables/useChatAuth'

const DIRECTORY_KEY = 'clingy_character_directory_v1'
const CONTACT_KEY_PREFIX = 'clingy_custom_contacts_'

export interface CharacterDirectoryEntry {
  entityId: string
  ownerAccountId: string
  name: string
  persona: string
  avatarKey: string
  socialProfile: CharacterSocialProfile
  idAliases: string[]
  createdAt: number
  updatedAt: number
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
  return readDirectory().filter(entry => (
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

export const isDirectoryOwner = (entityId: string) => {
  const { currentChatUserId } = useChatAuth()
  return getCharacterDirectoryEntry(entityId)?.ownerAccountId === currentChatUserId.value
}
