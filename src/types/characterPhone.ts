/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type CharacterPhoneLockType = 'none' | 'pin' | 'password' | 'pattern' | 'biometric'
export type CharacterPhoneAppKind = 'chat' | 'contacts' | 'moments' | 'calls' | 'photos' | 'files' | 'sms' | 'notes' | 'calendar' | 'browser' | 'maps' | 'clock' | 'settings' | 'feed' | 'records' | 'gallery' | 'dashboard' | 'list' | 'page'
export type CharacterPhoneKnowledge = 'character_known' | 'character_unknown' | 'character_suspects' | 'character_confirmed'
export type CharacterPhoneActor = 'character' | 'user' | 'contact' | 'system'

export interface CharacterPhoneAppEntry {
  id: string
  title: string
  subtitle?: string
  content?: string
  createdAt: number
  updatedAt?: number
  read?: boolean
  contactId?: string
  meta?: Record<string, unknown>
}

export interface CharacterPhoneApp {
  id: string
  name: string
  kind: CharacterPhoneAppKind
  icon: string
  color: string
  builtIn: boolean
  hidden: boolean
  badge: number
  allowCharacterUse: boolean
  allowBackgroundUse: boolean
  managementMode: 'readonly' | 'confirm' | 'autonomous'
  refreshMode: 'manual' | 'auto'
  refreshIntervalMinutes: number
  lastRefreshedAt: number
  entries: CharacterPhoneAppEntry[]
}

export interface CharacterPhoneDevice {
  id: string
  name: string
  type: 'phone' | 'tablet' | 'other'
  purpose: string
  active: boolean
  wallpaper: string
  battery: number
  storageUsedPercent: number
  silent: boolean
  doNotDisturb: boolean
  lockType: CharacterPhoneLockType
  lockCredential: string
  lockReason: string
  failedAttempts: number
  lockedUntil: number
  foregroundAppId: string
  lastUsedAt: number
  apps: CharacterPhoneApp[]
}

export interface CharacterPhoneConversationMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  displaySenderId: string
  content: string
  createdAt: number
  read: boolean
  actualActor: CharacterPhoneActor
  authorizedByCharacter: boolean
  characterKnowledge: CharacterPhoneKnowledge
  source: 'phone' | 'single_chat' | 'group_chat' | 'generated'
}

export interface CharacterPhoneConversation {
  id: string
  title: string
  kind: 'user' | 'contact' | 'group'
  participantIds: string[]
  linkedChatId?: string | number
  linkedGroupId?: string
  unread: number
  updatedAt: number
  messages: CharacterPhoneConversationMessage[]
}

export interface CharacterPhoneEvent {
  id: string
  type: string
  title: string
  detail: string
  deviceId: string
  appId?: string
  actualActor: CharacterPhoneActor
  characterKnowledge: CharacterPhoneKnowledge
  importance: 1 | 2 | 3 | 4 | 5
  unresolved: boolean
  bridgeEligible: boolean
  deliveredToChatAt: number
  deliveredToBackgroundAt: number
  createdAt: number
  meta?: Record<string, unknown>
}

export interface CharacterPhoneSettings {
  enabled: boolean
  allowUseDuringChat: boolean
  allowBackgroundUse: boolean
  bridgeToChat: boolean
  chatToPhone: boolean
  userOperationsDiscoverable: boolean
  allowDeepReadFollowup: boolean
  allowHighImpactActions: boolean
  contextTokenBudget: number
  maxActionsPerRun: number
  dailyBackgroundLimit: number
  backgroundActionsToday: number
  backgroundActionDate: string
}

export interface CharacterPhoneRecord {
  schemaVersion: 1
  accountId: string
  characterId: string
  chatId: string | number
  timelineId: string
  generated: boolean
  generationSource: 'ai' | 'manual' | 'none'
  devices: CharacterPhoneDevice[]
  conversations: CharacterPhoneConversation[]
  events: CharacterPhoneEvent[]
  settings: CharacterPhoneSettings
  createdAt: number
  updatedAt: number
}

export interface CharacterPhoneReadRequest {
  appId: string
  target: string
}
