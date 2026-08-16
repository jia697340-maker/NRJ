/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { GroupAdminLog, GroupLevelTitleConfig, GroupMemberItemViewModel, GroupBadgeType, GroupMemberRole } from '../types/groupManagement'
import { saveGroupChat } from '../services/groupChat'
import { useChatAuth } from './useChatAuth'
import {
  DEFAULT_GROUP_LEVEL_TITLES,
  ensureGroupManagementState,
  getGroupMemberRole,
  getGroupPermissions,
  groupManagementService,
  isGroupMemberMuted,
  reconcileExpiredGroupMutes,
  type PublishAnnouncementPayload,
  type UpdateAnnouncementPayload
} from '../services/groupManagementService'

export const DEFAULT_LEVEL_TITLES = DEFAULT_GROUP_LEVEL_TITLES

export function useGroupManagement(groupRef: { value: any }, userProfileRef?: { value: any }, contactsRef?: { value: any[] }) {
  const isLoading = ref(false)
  const errorMessage = ref('')
  const toastMessage = ref('')
  const adminLogs = ref<GroupAdminLog[]>([])
  const now = ref(Date.now())
  const { currentChatUserId } = useChatAuth()
  let clock: ReturnType<typeof setInterval> | null = null

  const group = () => groupRef.value
  const persist = () => {
    const record = group()
    if (record) saveGroupChat(currentChatUserId.value, record)
  }

  const syncLogs = () => { adminLogs.value = [...(group()?.adminLogs || [])] }
  const formatMuteRemaining = (ms: number): string => {
    if (ms <= 0) return ''
    const totalSec = Math.ceil(ms / 1000); const days = Math.floor(totalSec / 86400); const hours = Math.floor((totalSec % 86400) / 3600); const minutes = Math.floor((totalSec % 3600) / 60); const seconds = totalSec % 60
    if (days > 0) return `${days}天${hours}小时`
    if (hours > 0) return `${hours}小时${minutes}分`
    if (minutes > 0) return `${minutes}分${seconds}秒`
    return `${seconds}秒`
  }

  watch(() => groupRef.value, record => {
    if (record) ensureGroupManagementState(record)
    syncLogs()
  }, { immediate: true })

  onMounted(() => {
    clock = setInterval(() => {
      now.value = Date.now()
      if (reconcileExpiredGroupMutes(groupRef.value, now.value)) { persist(); syncLogs() }
    }, 1000)
  })
  onUnmounted(() => { if (clock) clearInterval(clock) })

  const currentUserPermissions = computed(() => getGroupPermissions(group(), 'user'))
  const userMuteRemainingMs = computed(() => Math.max(0, Number(group()?.memberMutes?.user?.mutedUntil || 0) - now.value))
  const isCurrentUserMuted = computed(() => Boolean(group()?.isWholeGroupMuted && getGroupMemberRole(group(), 'user') === 'member') || userMuteRemainingMs.value > 0)
  const currentUserMuteRemainingText = computed(() => group()?.isWholeGroupMuted && getGroupMemberRole(group(), 'user') === 'member' ? '全员禁言中' : formatMuteRemaining(userMuteRemainingMs.value))
  const levelTitleConfigs = computed<GroupLevelTitleConfig[]>(() => group()?.levelTitles || DEFAULT_LEVEL_TITLES)

  const calculateLevelInfo = (points = 0) => {
    const configs = levelTitleConfigs.value; let index = 0
    for (let i = configs.length - 1; i >= 0; i--) if (points >= configs[i].minPoints) { index = i; break }
    const current = configs[index]; const next = configs[index + 1]
    const progress = next ? Math.min(100, Math.max(0, Math.round(((points - current.minPoints) / (next.minPoints - current.minPoints)) * 100))) : 100
    return { level: current.level, title: current.name, progress }
  }

  const findContact = (id: string) => contactsRef?.value?.find(item => item.chatType !== 'group' && String(item.characterEntityId || item.id) === id)
  const membersViewModel = computed<GroupMemberItemViewModel[]>(() => {
    const record = group(); if (!record) return []
    const ids = ['user', ...(record.memberIds || []).map(String)]
    return ids.map(id => {
      const isUser = id === 'user'; const contact = isUser ? null : findContact(id); const role: GroupMemberRole = getGroupMemberRole(record, id)
      const points = Math.max(0, Number(record.memberPoints?.[id] || 0)); const level = calculateLevelInfo(points); const specialTitle = record.memberSpecialTitles?.[id]
      const fallbackName = isUser ? String(userProfileRef?.value?.name || record.userProfile?.name || '我') : String(contact?.name || record.memoryMemberNames?.[id] || id)
      const nickname = String(record.memberNicknames?.[id] || fallbackName); const mutedUntil = Number(record.memberMutes?.[id]?.mutedUntil || 0); const remaining = Math.max(0, mutedUntil - now.value)
      const currentRole = getGroupMemberRole(record, 'user'); const userIsOwner = currentRole === 'owner'; const userIsAdmin = currentRole === 'admin'
      const manageable = !isUser && (userIsOwner || (userIsAdmin && role === 'member'))
      let badgeType: GroupBadgeType = role; if (specialTitle) badgeType = 'special'
      return {
        id, name: fallbackName, nickname, avatarUrl: isUser ? String(record.userProfile?.avatarUrl || '') : String(contact?.avatarUrl || ''), avatarText: String(contact?.avatarText || nickname.charAt(0) || (isUser ? '我' : '伴')), isAi: !isUser,
        role, badgeType, level: level.level, levelTitle: specialTitle || level.title, points, pointsProgress: level.progress,
        isMuted: isGroupMemberMuted(record, id, now.value), mutedUntil, muteRemainingMs: remaining, muteRemainingText: record.isWholeGroupMuted && role === 'member' && remaining <= 0 ? '全员禁言中' : formatMuteRemaining(remaining), muteReason: String(record.memberMutes?.[id]?.muteReason || ''),
        canManage: manageable, canBeMuted: manageable && role !== 'owner', canBePromoted: !isUser && userIsOwner && role === 'member', canBeDemoted: !isUser && userIsOwner && role === 'admin', canBeKicked: manageable, canTransferTo: !isUser && userIsOwner && role !== 'owner', hasCustomTitle: !!specialTitle, specialTitleName: specialTitle
      }
    })
  })

  const announcementsViewModel = computed(() => [...(group()?.announcements || [])].filter(item => item.status !== 'deleted').sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || Number(b.createdAt) - Number(a.createdAt)))
  const activeTopAnnouncement = computed(() => announcementsViewModel.value.find(item => item.isPinned) || announcementsViewModel.value[0] || null)
  const unreadAnnouncementsCount = computed(() => announcementsViewModel.value.filter(item => !item.readUserIds.includes('user')).length)

  const runAction = async <T>(action: () => T | Promise<T>, successTip?: string): Promise<T | null> => {
    isLoading.value = true; errorMessage.value = ''
    try {
      const result = await action(); persist(); syncLogs()
      if (successTip) { toastMessage.value = successTip; setTimeout(() => { toastMessage.value = '' }, 2500) }
      return result
    } catch (error: any) { errorMessage.value = error?.message || '操作失败，请重试'; return null }
    finally { isLoading.value = false }
  }

  const promoteMember = (memberId: string) => runAction(() => groupManagementService.promoteMember(group(), 'user', memberId), '已设为管理员')
  const recoverOwnership = () => runAction(() => groupManagementService.recoverOwnership(group()), '已恢复群主身份')
  const addMember = (memberId: string) => runAction(() => groupManagementService.addMember(group(), 'user', memberId), '已添加群成员')
  const demoteAdmin = (memberId: string) => runAction(() => groupManagementService.demoteAdmin(group(), 'user', memberId), '已取消管理员')
  const transferOwnership = (memberId: string) => runAction(() => groupManagementService.transferOwnership(group(), 'user', memberId), '群主身份已转让')
  const muteMember = (memberId: string, durationSeconds: number, reason = '') => runAction(() => groupManagementService.muteMember(group(), 'user', memberId, durationSeconds, reason), '禁言设置成功')
  const unmuteMember = (memberId: string) => runAction(() => groupManagementService.unmuteMember(group(), 'user', memberId), '已解除禁言')
  const setWholeGroupMute = (enabled: boolean) => runAction(() => groupManagementService.setWholeGroupMute(group(), 'user', enabled), enabled ? '全员禁言已开启' : '全员禁言已关闭')
  const removeMember = (memberId: string) => runAction(() => groupManagementService.removeMember(group(), 'user', memberId), '已将该成员移出群聊')
  const updateMyGroupNickname = (memberIdOrNickname: string, nickname?: string) => { const targetId = nickname === undefined ? 'user' : memberIdOrNickname; const value = nickname === undefined ? memberIdOrNickname : nickname; return runAction(() => groupManagementService.updateMemberNickname(group(), 'user', targetId, value), '群昵称修改成功') }
  const publishAnnouncement = (payload: Omit<PublishAnnouncementPayload, 'groupId'>) => runAction(() => groupManagementService.publishAnnouncement(group(), 'user', payload), '公告发布成功')
  const updateAnnouncement = (id: string, payload: UpdateAnnouncementPayload) => runAction(() => groupManagementService.updateAnnouncement(group(), 'user', id, payload), '公告修改成功')
  const deleteAnnouncement = (id: string) => runAction(() => groupManagementService.deleteAnnouncement(group(), 'user', id), '公告已删除')
  const markAnnouncementRead = (id: string) => runAction(() => groupManagementService.markAnnouncementRead(group(), 'user', id))
  const confirmAnnouncement = (id: string) => runAction(() => groupManagementService.confirmAnnouncement(group(), 'user', id), '已确认收到该公告')
  const updateLevelTitles = (titles: GroupLevelTitleConfig[]) => runAction(() => groupManagementService.updateLevelTitles(group(), 'user', titles), '群头衔配置已更新')
  const setAiManagementMode = (mode: any) => runAction(() => groupManagementService.setAiManagementMode(group(), 'user', mode), 'AI管理模式已切换')
  const loadAdminLogs = async () => { const result = await runAction(() => groupManagementService.fetchAdminLogs(group(), 'user')); if (result) adminLogs.value = result }
  const deleteAdminLogs = (logIds: string[]) => runAction(() => groupManagementService.deleteAdminLogs(group(), 'user', logIds), '已删除所选管理日志')

  return { isLoading, errorMessage, toastMessage, adminLogs, currentUserPermissions, isCurrentUserMuted, userMuteRemainingMs, currentUserMuteRemainingText, levelTitleConfigs, membersViewModel, announcementsViewModel, activeTopAnnouncement, unreadAnnouncementsCount, recoverOwnership, addMember, promoteMember, demoteAdmin, transferOwnership, muteMember, unmuteMember, setWholeGroupMute, removeMember, updateMyGroupNickname, publishAnnouncement, updateAnnouncement, deleteAnnouncement, markAnnouncementRead, confirmAnnouncement, updateLevelTitles, setAiManagementMode, loadAdminLogs, deleteAdminLogs }
}
