/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import type { CharacterPhoneEvent, CharacterPhoneRecord, CharacterPhoneSettings } from '../types/characterPhone'

export const CHARACTER_PHONE_STORE_NAME = 'characterPhones'
export const characterPhoneStore = localforage.createInstance({ name: 'nrt-app', storeName: CHARACTER_PHONE_STORE_NAME })

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const keyOf = (accountId: string, characterId: string, timelineId: string) => `${accountId || 'guest'}::${characterId}::${timelineId || 'main'}`
const today = () => new Date().toLocaleDateString('en-CA')

export const defaultCharacterPhoneSettings = (): CharacterPhoneSettings => ({
  enabled: true,
  allowUseDuringChat: false,
  allowBackgroundUse: false,
  bridgeToChat: false,
  chatToPhone: false,
  userOperationsDiscoverable: true,
  allowDeepReadFollowup: false,
  allowHighImpactActions: false,
  contextTokenBudget: 800,
  maxActionsPerRun: 2,
  dailyBackgroundLimit: 12,
  backgroundActionsToday: 0,
  backgroundActionDate: today()
})

export const createEmptyCharacterPhone = (accountId: string, characterId: string, chatId: string | number, timelineId: string): CharacterPhoneRecord => {
  const now = Date.now()
  return {
    schemaVersion: 1,
    accountId: accountId || 'guest',
    characterId,
    chatId,
    timelineId: timelineId || 'main',
    generated: false,
    generationSource: 'none',
    devices: [],
    conversations: [],
    events: [],
    settings: defaultCharacterPhoneSettings(),
    createdAt: now,
    updatedAt: now
  }
}

const normalize = (raw: any, fallback: CharacterPhoneRecord): CharacterPhoneRecord => ({
  ...fallback,
  ...(raw && typeof raw === 'object' ? raw : {}),
  schemaVersion: 1,
  devices: Array.isArray(raw?.devices) ? raw.devices : [],
  conversations: Array.isArray(raw?.conversations) ? raw.conversations : [],
  events: Array.isArray(raw?.events) ? raw.events.map((event: any) => ({ ...event, deliveredToChatAt: Number(event.deliveredToChatAt || 0), deliveredToBackgroundAt: Number(event.deliveredToBackgroundAt || 0) })) : [],
  settings: { ...defaultCharacterPhoneSettings(), ...(raw?.settings || {}) }
})

export const loadCharacterPhone = async (accountId: string, characterId: string, chatId: string | number, timelineId = 'main') => {
  const fallback = createEmptyCharacterPhone(accountId, characterId, chatId, timelineId)
  const stored = await characterPhoneStore.getItem<CharacterPhoneRecord>(keyOf(accountId, characterId, timelineId))
  return normalize(stored, fallback)
}

export const saveCharacterPhone = async (record: CharacterPhoneRecord) => {
  record.updatedAt = Date.now()
  await characterPhoneStore.setItem(keyOf(record.accountId, record.characterId, record.timelineId), clone(record))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clingy:character-phone-updated', { detail: { characterId: record.characterId, timelineId: record.timelineId } }))
  return record
}

export const addCharacterPhoneEvent = (record: CharacterPhoneRecord, input: Omit<CharacterPhoneEvent, 'id' | 'createdAt' | 'deliveredToChatAt' | 'deliveredToBackgroundAt'>) => {
  const event: CharacterPhoneEvent = { ...input, id: `phone_event_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now(), deliveredToChatAt: 0, deliveredToBackgroundAt: 0 }
  record.events.push(event)
  if (record.events.length > 1000) record.events.splice(0, record.events.length - 1000)
  return event
}

export const readCharacterPhonesForCharacter = async (accountId: string, characterId: string) => {
  const records: CharacterPhoneRecord[] = []
  const prefix = `${accountId || 'guest'}::${characterId}::`
  await characterPhoneStore.iterate<CharacterPhoneRecord, void>((value, key) => { if (String(key).startsWith(prefix)) records.push(normalize(value, value)) })
  return records
}

export const deleteCharacterPhones = async (accountId: string, characterId: string) => {
  const keys: string[] = []
  const prefix = `${accountId || 'guest'}::${characterId}::`
  await characterPhoneStore.iterate((_value, key) => { if (String(key).startsWith(prefix)) keys.push(String(key)) })
  await Promise.all(keys.map(key => characterPhoneStore.removeItem(key)))
}

export const exportCharacterPhoneSnapshot = async (accountId: string, characterId: string, timelineId: string) => {
  const value = await characterPhoneStore.getItem<CharacterPhoneRecord>(keyOf(accountId, characterId, timelineId))
  return value ? clone(value) : null
}

export const importCharacterPhoneSnapshot = async (record: CharacterPhoneRecord | null) => {
  if (!record) return
  await characterPhoneStore.setItem(keyOf(record.accountId, record.characterId, record.timelineId), clone(record))
}
