/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type GroupMemberRole = 'owner' | 'admin' | 'member'

export type GroupMembershipRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'
export type GroupMembershipRequestKind = 'rejoin_application' | 'former_member_invitation'

export interface GroupMembershipRequest {
  id: string
  groupId: string
  memberId: string
  memberName: string
  kind: GroupMembershipRequestKind
  status: GroupMembershipRequestStatus
  message: string
  createdAt: number
  updatedAt: number
  operatorId?: string
  resolvedBy?: string
  removalSource?: 'kicked' | 'left'
}

export type GroupBadgeType = 'owner' | 'admin' | 'member' | 'special'

export interface GroupLevelTitleConfig {
  level: number // 1 to 100
  name: string
  minPoints: number
}

export interface GroupPointRules {
  baseMsgPoints: number // 每次发言基础积分，默认 1
  dailyFirstBonus: number // 每日首次发言额外奖励，默认 2
  dailyCap: number // 每日积分获取上限，默认 20
  announcementConfirmPoints: number // 确认公告奖励积分，默认 1
}

export interface GroupMemberMuteInfo {
  isMuted: boolean
  mutedUntil: number // timestamp ms
  muteReason?: string
  mutedBy?: string
}

export interface GroupAnnouncement {
  id: string
  groupId: string
  title: string
  content: string
  publisherId: string
  publisherName: string
  publisherRole: GroupMemberRole
  isPinned: boolean
  needConfirm: boolean
  readCount: number
  confirmCount: number
  readUserIds: string[]
  confirmedUserIds: string[]
  status: 'published' | 'deleted'
  version: number
  createdAt: number
  updatedAt: number
}

export interface GroupAdminLog {
  id: string
  groupId: string
  operatorId: string
  operatorName: string
  actionType: 'member_add' | 'member_leave' | 'member_apply' | 'member_invite' | 'group_profile' | 'promote' | 'demote' | 'transfer' | 'mute' | 'unmute' | 'whole_mute' | 'kick' | 'message_recall' | 'announcement_publish' | 'announcement_update' | 'announcement_delete' | 'title_edit' | 'level_up' | 'points_adjust' | 'points_reset' | 'rule_update'
  targetId?: string
  targetName?: string
  detail: string
  createdAt: number
}

export type GroupAiManagementMode = 'off' | 'remind_only' | 'semi_auto' | 'full_auto'

export interface GroupMemberItemViewModel {
  id: string
  name: string
  nickname: string
  avatarUrl: string
  avatarText: string
  isAi: boolean
  role: GroupMemberRole
  badgeType: GroupBadgeType
  level: number
  levelTitle: string
  points: number
  pointsProgress: number // 0 to 100
  isMuted: boolean
  mutedUntil: number
  muteRemainingMs: number
  muteRemainingText: string
  muteReason: string
  canManage: boolean
  canBeMuted: boolean
  canBePromoted: boolean
  canBeDemoted: boolean
  canBeKicked: boolean
  canTransferTo: boolean
  hasCustomTitle?: boolean
  specialTitleName?: string
  dailyHonor?: string
}

export interface GroupUserPermissions {
  isOwner: boolean
  isAdmin: boolean
  canManageMembers: boolean
  canPublishAnnouncement: boolean
  canManageAnnouncements: boolean
  canMuteMembers: boolean
  canSetWholeGroupMute: boolean
  canTransferOwnership: boolean
  canEditLevelTitles: boolean
  canSetAiManagement: boolean
  canViewLogs: boolean
}
