/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { MusicTrack } from './music'

export type TogetherListenMode = 'stranger' | 'character'
export type TogetherListenStatus = 'matching' | 'inviting' | 'active' | 'ended'
export type TogetherListenMemoryMode = 'none' | 'music-only' | 'shared'
export type TogetherListenTextDisplay = 'separate' | 'single-chat'
export type TogetherListenMessageSender = 'user' | 'partner' | 'system'

export interface TogetherListenSettings {
  memoryMode: TogetherListenMemoryMode
  textDisplay: TogetherListenTextDisplay
  keepLocalRecords: boolean
  autoSummary: boolean
  bilingualEnabled: boolean
  translationLanguage: string
  allowPartnerSpeak: boolean
  eventDrivenEnabled: boolean
  allowPartnerSwitchTrack: boolean
  allowPartnerPlaybackControl: boolean
  includeLyrics: boolean
  allowFriendRequests: boolean
  allowCharacterInvites: boolean
}

export interface TogetherListenParticipant {
  kind: 'stranger' | 'character'
  id: string
  chatId?: string | number
  entityId?: string
  name: string
  anonymousName: string
  avatarUrl?: string
  persona: string
  socialId: string
  signature?: string
  revealed: boolean
  discoverable: boolean
  allowFriendRequests: boolean
}

export interface TogetherListenUserSnapshot {
  name: string
  avatarUrl?: string
}

export interface TogetherListenMessage {
  id: string
  sender: TogetherListenMessageSender
  content: string
  createdAt: number
  trackTitle?: string
  lyricText?: string
  syncedToSingleChat?: boolean
  kind?: 'text' | 'playback' | 'friend-request' | 'notice'
}

export interface TogetherListenPlaybackEvent {
  id: string
  type: 'track' | 'play' | 'pause' | 'seek' | 'queue' | 'leave'
  actor: 'user' | 'partner' | 'system'
  detail: string
  createdAt: number
}

export interface TogetherListenFriendRequest {
  id: string
  direction: 'user_to_partner' | 'partner_to_user'
  message: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: number
  respondedAt?: number
}

export interface TogetherListenSession {
  id: string
  accountId: string
  mode: TogetherListenMode
  status: TogetherListenStatus
  user?: TogetherListenUserSnapshot
  participant: TogetherListenParticipant
  startedAt: number
  endedAt?: number
  initialTrack?: MusicTrack
  currentTrack?: MusicTrack
  trackHistory: MusicTrack[]
  messages: TogetherListenMessage[]
  playbackEvents: TogetherListenPlaybackEvent[]
  friendRequests: TogetherListenFriendRequest[]
  settings: TogetherListenSettings
  summary?: string
  lastPartnerActionAt?: number
  lastError?: string
  promotedChatId?: string | number
}

export interface TogetherListenPersistedState {
  version: number
  settings: TogetherListenSettings
  activeSession: TogetherListenSession | null
  records: TogetherListenSession[]
}

export const defaultTogetherListenSettings = (): TogetherListenSettings => ({
  memoryMode: 'music-only',
  textDisplay: 'separate',
  keepLocalRecords: true,
  autoSummary: true,
  bilingualEnabled: false,
  translationLanguage: '跟随应用',
  allowPartnerSpeak: true,
  eventDrivenEnabled: true,
  allowPartnerSwitchTrack: true,
  allowPartnerPlaybackControl: true,
  includeLyrics: true,
  allowFriendRequests: true,
  allowCharacterInvites: true
})
