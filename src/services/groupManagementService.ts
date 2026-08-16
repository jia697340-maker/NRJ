/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

import type { GroupAdminLog, GroupAiManagementMode, GroupAnnouncement, GroupLevelTitleConfig, GroupMemberRole, GroupUserPermissions } from '../types/groupManagement'

export interface PublishAnnouncementPayload { groupId?: string; title: string; content: string; isPinned?: boolean; needConfirm?: boolean }
export interface UpdateAnnouncementPayload { title?: string; content?: string; isPinned?: boolean; needConfirm?: boolean }

export const DEFAULT_GROUP_LEVEL_TITLES: GroupLevelTitleConfig[] = [
  { level: 1, name: '潜水', minPoints: 0 }, { level: 2, name: '冒泡', minPoints: 10 },
  { level: 3, name: '活跃', minPoints: 30 }, { level: 4, name: '常驻', minPoints: 70 },
  { level: 5, name: '核心', minPoints: 150 }, { level: 6, name: '传说', minPoints: 300 }
]

const MAX_ADMINS = 4
const MAX_MUTE_SECONDS = 30 * 24 * 60 * 60
const DAILY_ACTIVITY_CAP = 20
const AI_MODES: GroupAiManagementMode[] = ['off', 'remind_only', 'semi_auto', 'full_auto']
const activeIds = (group: any) => new Set(['user', ...(Array.isArray(group?.memberIds) ? group.memberIds.map(String) : [])])
const memberName = (group: any, id: string) => id === 'user' ? String(group?.memberNicknames?.user || group?.userProfile?.name || '我') : String(group?.memberNicknames?.[id] || group?.memoryMemberNames?.[id] || id)

export const getGroupMemberRole = (group: any, memberId: string): GroupMemberRole => {
  const id = String(memberId)
  if (String(group?.ownerId || 'user') === id) return 'owner'
  if (Array.isArray(group?.adminIds) && group.adminIds.map(String).includes(id)) return 'admin'
  return 'member'
}

export const getGroupLevelInfo = (group: any, memberId: string) => {
  const titles = normalizeLevelTitles(group?.levelTitles)
  const points = Math.max(0, Number(group?.memberPoints?.[String(memberId)] || 0))
  let index = 0
  for (let i = titles.length - 1; i >= 0; i--) if (points >= titles[i].minPoints) { index = i; break }
  return { level: titles[index].level, levelTitle: String(group?.memberSpecialTitles?.[String(memberId)] || titles[index].name), points }
}

export const getGroupPermissions = (group: any, actorId = 'user'): GroupUserPermissions => {
  const role = activeIds(group).has(String(actorId)) ? getGroupMemberRole(group, actorId) : 'member'
  const isOwner = role === 'owner'; const isAdmin = role === 'admin'; const manages = isOwner || isAdmin
  return { isOwner, isAdmin, canManageMembers: manages, canPublishAnnouncement: manages, canManageAnnouncements: manages, canMuteMembers: manages, canSetWholeGroupMute: manages, canTransferOwnership: isOwner, canEditLevelTitles: isOwner, canSetAiManagement: isOwner, canViewLogs: manages }
}

const normalizeLevelTitles = (raw: any): GroupLevelTitleConfig[] => {
  const source = Array.isArray(raw) && raw.length === 6 ? raw : DEFAULT_GROUP_LEVEL_TITLES
  const result: GroupLevelTitleConfig[] = []
  DEFAULT_GROUP_LEVEL_TITLES.forEach((fallback, index) => {
    const requested = index === 0 ? 0 : Math.floor(Number(source[index]?.minPoints))
    const minPoints = index === 0 ? 0 : (Number.isFinite(requested) && requested > result[index - 1].minPoints ? Math.min(1000000, requested) : Math.max(fallback.minPoints, result[index - 1].minPoints + 1))
    result.push({ level: fallback.level, name: String(source[index]?.name || fallback.name).trim().slice(0, 12) || fallback.name, minPoints })
  })
  return result
}

const sameStringArray = (current: any, next: string[]) =>
  Array.isArray(current) && current.length === next.length && current.every((item: any, index: number) => item === next[index])

const sameLevelTitles = (current: any, next: GroupLevelTitleConfig[]) =>
  Array.isArray(current) && current.length === next.length && current.every((item: any, index: number) =>
    item?.level === next[index].level && item?.name === next[index].name && item?.minPoints === next[index].minPoints
  )

const normalizeAnnouncement = (group: any, raw: any): GroupAnnouncement => {
  const readUserIds = [...new Set<string>(Array.isArray(raw?.readUserIds) ? raw.readUserIds.map(String) : [])]
  const confirmedUserIds = [...new Set<string>(Array.isArray(raw?.confirmedUserIds) ? raw.confirmedUserIds.map(String) : [])]
  return { id: String(raw?.id || `notice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`), groupId: String(group.id || raw?.groupId || ''), title: String(raw?.title || '').slice(0, 80), content: String(raw?.content || '').slice(0, 5000), publisherId: String(raw?.publisherId || 'user'), publisherName: String(raw?.publisherName || memberName(group, raw?.publisherId || 'user')), publisherRole: getGroupMemberRole(group, raw?.publisherId || 'user'), isPinned: raw?.isPinned === true, needConfirm: raw?.needConfirm === true, readCount: readUserIds.length, confirmCount: confirmedUserIds.length, readUserIds, confirmedUserIds, status: raw?.status === 'deleted' ? 'deleted' : 'published', version: Math.max(1, Number(raw?.version || 1)), createdAt: Number(raw?.createdAt || Date.now()), updatedAt: Number(raw?.updatedAt || raw?.createdAt || Date.now()) }
}

export const ensureGroupManagementState = (group: any) => {
  if (!group || typeof group !== 'object') return group
  const ids = activeIds(group)
  group.managementSchemaVersion = 1
  group.ownerId = ids.has(String(group.ownerId || 'user')) ? String(group.ownerId || 'user') : 'user'
  const adminIds = [...new Set<string>(Array.isArray(group.adminIds) ? group.adminIds.map(String) : [])].filter(id => ids.has(id) && id !== group.ownerId).slice(0, MAX_ADMINS)
  if (!sameStringArray(group.adminIds, adminIds)) group.adminIds = adminIds
  group.isWholeGroupMuted = group.isWholeGroupMuted === true
  group.aiManagementMode = AI_MODES.includes(group.aiManagementMode) ? group.aiManagementMode : 'off'
  const levelTitles = normalizeLevelTitles(group.levelTitles)
  if (!sameLevelTitles(group.levelTitles, levelTitles)) group.levelTitles = levelTitles
  group.memberPoints = group.memberPoints && typeof group.memberPoints === 'object' ? group.memberPoints : {}
  group.memberMutes = group.memberMutes && typeof group.memberMutes === 'object' ? group.memberMutes : {}
  group.memberSpecialTitles = group.memberSpecialTitles && typeof group.memberSpecialTitles === 'object' ? group.memberSpecialTitles : {}
  group.memberActivityDaily = group.memberActivityDaily && typeof group.memberActivityDaily === 'object' ? group.memberActivityDaily : {}
  if (!Array.isArray(group.announcements)) group.announcements = []
  else if (group.announcements.some((item: any) => !Array.isArray(item?.readUserIds) || !Array.isArray(item?.confirmedUserIds) || !item?.status || !item?.version)) group.announcements = group.announcements.map((item: any) => normalizeAnnouncement(group, item))
  group.adminLogs = Array.isArray(group.adminLogs) ? group.adminLogs : []
  group.removedMembers = group.removedMembers && typeof group.removedMembers === 'object' ? group.removedMembers : {}
  for (const id of ids) group.memberPoints[id] = Math.max(0, Number(group.memberPoints[id] || 0))
  return group
}

const assertMember = (group: any, memberId: string) => { if (!activeIds(group).has(String(memberId))) throw new Error('该成员已不在群聊中') }
const assertOwner = (group: any, actorId: string) => { assertMember(group, actorId); if (getGroupMemberRole(group, actorId) !== 'owner') throw new Error('只有群主可以执行此操作') }
const assertManager = (group: any, actorId: string) => { assertMember(group, actorId); if (!['owner', 'admin'].includes(getGroupMemberRole(group, actorId))) throw new Error('你没有群管理权限') }
const assertCanManageTarget = (group: any, actorId: string, targetId: string) => {
  assertManager(group, actorId); assertMember(group, targetId)
  const actorRole = getGroupMemberRole(group, actorId); const targetRole = getGroupMemberRole(group, targetId)
  if (targetRole === 'owner') throw new Error('群主不能被执行该操作')
  if (actorRole === 'admin' && targetRole !== 'member') throw new Error('管理员只能管理普通成员')
}

const appendEvent = (group: any, input: { actorId: string; actionType: GroupAdminLog['actionType']; detail: string; targetId?: string; eventType: string; eventData?: Record<string, unknown> }) => {
  ensureGroupManagementState(group); const now = Date.now()
  const log: GroupAdminLog = { id: `group_log_${now}_${Math.random().toString(36).slice(2, 7)}`, groupId: String(group.id), operatorId: input.actorId, operatorName: memberName(group, input.actorId), actionType: input.actionType, targetId: input.targetId, targetName: input.targetId ? memberName(group, input.targetId) : undefined, detail: input.detail, createdAt: now }
  group.adminLogs.unshift(log); group.adminLogs = group.adminLogs.slice(0, 500); group.messages ||= []
  group.messages.push({ id: now, timestamp: now, type: 'system', messageType: 'group_management', managementEvent: { type: input.eventType, actorId: input.actorId, targetId: input.targetId, ...input.eventData }, content: input.detail })
  group.updatedAt = now; return log
}

export const isGroupMemberMuted = (group: any, memberId: string, now = Date.now()) => (Boolean(group?.isWholeGroupMuted) && getGroupMemberRole(group, memberId) === 'member') || Number(group?.memberMutes?.[memberId]?.mutedUntil || 0) > now
export const getSpeakableCharacterIds = (group: any, now = Date.now()) => (Array.isArray(group?.memberIds) ? group.memberIds : []).map(String).filter((id: string) => !isGroupMemberMuted(group, id, now))

export const reconcileExpiredGroupMutes = (group: any, now = Date.now()) => {
  ensureGroupManagementState(group); let changed = false
  for (const [id, mute] of Object.entries<any>(group.memberMutes)) if (Number(mute?.mutedUntil || 0) > 0 && Number(mute.mutedUntil) <= now) { delete group.memberMutes[id]; appendEvent(group, { actorId: 'system', targetId: id, actionType: 'unmute', eventType: 'member_unmuted', detail: `${memberName(group, id)}的禁言已自动到期`, eventData: { source: 'automatic_expiry' } }); changed = true }
  return changed
}

export const awardGroupActivity = (group: any, memberId: string, turnId: string, timestamp = Date.now(), amount = 1) => {
  ensureGroupManagementState(group); const id = String(memberId)
  if (!activeIds(group).has(id) || !turnId) return false
  const beforeLevel = getGroupLevelInfo(group, id)
  const day = new Date(timestamp).toISOString().slice(0, 10); const current = group.memberActivityDaily[id]
  const state = current?.date === day ? current : { date: day, earned: 0, turnIds: [] as string[] }
  if (state.turnIds.includes(String(turnId)) || state.earned >= DAILY_ACTIVITY_CAP) return false
  const earned = Math.min(DAILY_ACTIVITY_CAP - state.earned, Math.max(0, amount) + (state.turnIds.length === 0 ? 2 : 0)); if (earned <= 0) return false
  state.turnIds.push(String(turnId)); state.turnIds = state.turnIds.slice(-100); state.earned += earned; group.memberActivityDaily[id] = state; group.memberPoints[id] = Math.max(0, Number(group.memberPoints[id] || 0)) + earned
  const afterLevel = getGroupLevelInfo(group, id)
  if (afterLevel.level > beforeLevel.level) appendEvent(group, { actorId: 'system', targetId: id, actionType: 'level_up', eventType: 'level_up', detail: `${memberName(group, id)}升级为 LV${afterLevel.level} ${afterLevel.levelTitle}`, eventData: { beforeLevel: beforeLevel.level, afterLevel: afterLevel.level } })
  return true
}

export const buildGroupManagementPrompt = (group: any) => {
  ensureGroupManagementState(group); const now = Date.now()
  const roster = ['user', ...(group.memberIds || [])].map(id => { const role = getGroupMemberRole(group, id); const roleName = role === 'owner' ? '群主' : role === 'admin' ? '管理员' : '普通成员'; return `${memberName(group, id)}（ID：${id}，身份：${roleName}${isGroupMemberMuted(group, id, now) ? '，当前禁言' : ''}）` }).join('\n')
  const activeAnnouncements = (group.announcements || []).filter((item: GroupAnnouncement) => item.status !== 'deleted').sort((a: GroupAnnouncement, b: GroupAnnouncement) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt).slice(0, 3)
  const announcements = activeAnnouncements.map((item: GroupAnnouncement) => `- [${item.isPinned ? '置顶' : '公告'}:${item.id}] ${item.title}：${item.content.slice(0, 1200)}`).join('\n')
  const modeText: Record<GroupAiManagementMode, string> = { off: 'AI成员不得主动执行群管理动作。', remind_only: '管理员遇到不合适发言时只可在群中温和提醒，不得执行禁言。', semi_auto: '管理员可提出管理建议，但任何处置必须等待用户确认。需要建议禁言或解禁时，额外输出 <group_management sender="管理员ID" action="mute或unmute" target="目标成员ID" duration="秒数">原因</group_management>，不得把标签写入普通消息。', full_auto: '群主或管理员可在权限范围内自主提醒或对普通成员执行限时禁言。执行时额外输出 <group_management sender="管理员ID" action="mute或unmute" target="目标成员ID" duration="秒数">原因</group_management>，禁言最长86400秒；不得踢人、转让群主、解散群聊或任免管理员。' }
  const mode = group.aiManagementMode as GroupAiManagementMode
  return `【群身份与管理规则】\n${roster}\n${modeText[mode]}${group.isWholeGroupMuted ? '\n当前处于全员禁言，只有群主和管理员可以发言。' : ''}${announcements ? `\n\n【当前有效群公告】\n${announcements}\n成员确实阅读公告后，可输出 <group_announcement_ack sender="成员ID" announcement_id="公告ID" />；只有标记需确认的公告才会登记确认。` : ''}`
}

class GroupManagementService {
  recoverOwnership(group: any) { ensureGroupManagementState(group); if (group.ownerId === 'user') return { success: true }; const previousOwnerId = String(group.ownerId); group.ownerId = 'user'; group.adminIds = group.adminIds.filter((id: string) => id !== 'user' && id !== previousOwnerId); if (activeIds(group).has(previousOwnerId) && group.adminIds.length < MAX_ADMINS) group.adminIds.push(previousOwnerId); delete group.memberMutes.user; appendEvent(group, { actorId: 'system', targetId: 'user', actionType: 'transfer', eventType: 'ownership_recovered', detail: '用户通过群聊恢复控制重新成为群主', eventData: { previousOwnerId, source: 'controller_recovery' } }); return { success: true } }
  addMember(group: any, actorId: string, memberId: string) { ensureGroupManagementState(group); assertManager(group, actorId); const id = String(memberId); if (!id || activeIds(group).has(id)) throw new Error('该成员已经在群聊中'); group.memberIds.push(id); group.memberPoints[id] = Math.max(0, Number(group.memberPoints[id] || 0)); delete group.removedMembers[id]; appendEvent(group, { actorId, targetId: id, actionType: 'member_add', eventType: 'member_added', detail: `${memberName(group, actorId)}邀请${memberName(group, id)}加入了群聊` }); return { success: true } }
  promoteMember(group: any, actorId: string, memberId: string) { ensureGroupManagementState(group); assertOwner(group, actorId); assertMember(group, memberId); if (getGroupMemberRole(group, memberId) !== 'member') throw new Error('该成员当前不能设为管理员'); if (group.adminIds.length >= MAX_ADMINS) throw new Error(`本群最多设置 ${MAX_ADMINS} 名管理员`); group.adminIds.push(String(memberId)); appendEvent(group, { actorId, targetId: memberId, actionType: 'promote', eventType: 'role_changed', detail: `${memberName(group, actorId)}将${memberName(group, memberId)}设为管理员`, eventData: { before: 'member', after: 'admin' } }); return { success: true, role: 'admin' as const } }
  demoteAdmin(group: any, actorId: string, memberId: string) { ensureGroupManagementState(group); assertOwner(group, actorId); assertMember(group, memberId); if (getGroupMemberRole(group, memberId) !== 'admin') throw new Error('该成员不是管理员'); group.adminIds = group.adminIds.filter((id: string) => id !== String(memberId)); appendEvent(group, { actorId, targetId: memberId, actionType: 'demote', eventType: 'role_changed', detail: `${memberName(group, actorId)}取消了${memberName(group, memberId)}的管理员身份`, eventData: { before: 'admin', after: 'member' } }); return { success: true, role: 'member' as const } }
  transferOwnership(group: any, actorId: string, memberId: string) { ensureGroupManagementState(group); assertOwner(group, actorId); assertMember(group, memberId); if (String(memberId) === String(actorId)) throw new Error('该成员已经是群主'); const oldOwnerId = String(group.ownerId); group.ownerId = String(memberId); group.adminIds = group.adminIds.filter((id: string) => id !== String(memberId) && id !== oldOwnerId); delete group.memberMutes[String(memberId)]; appendEvent(group, { actorId, targetId: memberId, actionType: 'transfer', eventType: 'owner_transferred', detail: `${memberName(group, actorId)}已将群主转让给${memberName(group, memberId)}`, eventData: { previousOwnerId: oldOwnerId } }); return { success: true } }
  muteMember(group: any, actorId: string, memberId: string, durationSeconds: number, reason = '') { ensureGroupManagementState(group); assertCanManageTarget(group, actorId, memberId); const duration = Math.floor(Number(durationSeconds)); if (duration <= 0 || duration > MAX_MUTE_SECONDS) throw new Error('禁言时长必须在 1 秒到 30 天之间'); const mutedUntil = Date.now() + duration * 1000; group.memberMutes[String(memberId)] = { isMuted: true, mutedAt: Date.now(), mutedUntil, muteReason: String(reason).trim().slice(0, 200), mutedBy: actorId }; appendEvent(group, { actorId, targetId: memberId, actionType: 'mute', eventType: 'member_muted', detail: `${memberName(group, actorId)}将${memberName(group, memberId)}禁言至${new Date(mutedUntil).toLocaleString('zh-CN')}${reason ? `，原因：${String(reason).trim()}` : ''}`, eventData: { mutedUntil, reason } }); return { success: true, mutedUntil } }
  unmuteMember(group: any, actorId: string, memberId: string) { ensureGroupManagementState(group); assertCanManageTarget(group, actorId, memberId); if (!group.memberMutes[String(memberId)]) throw new Error('该成员当前未被单独禁言'); delete group.memberMutes[String(memberId)]; appendEvent(group, { actorId, targetId: memberId, actionType: 'unmute', eventType: 'member_unmuted', detail: `${memberName(group, actorId)}解除了${memberName(group, memberId)}的禁言` }); return { success: true } }
  setWholeGroupMute(group: any, actorId: string, enabled: boolean) { ensureGroupManagementState(group); assertManager(group, actorId); group.isWholeGroupMuted = Boolean(enabled); appendEvent(group, { actorId, actionType: 'whole_mute', eventType: 'whole_mute_changed', detail: `${memberName(group, actorId)}${enabled ? '开启' : '关闭'}了全员禁言`, eventData: { enabled: Boolean(enabled) } }); return { success: true, enabled: Boolean(enabled) } }
  removeMember(group: any, actorId: string, memberId: string) { ensureGroupManagementState(group); assertCanManageTarget(group, actorId, memberId); if (String(memberId) === 'user') throw new Error('当前版本不能将用户移出群聊'); if ((group.memberIds || []).length <= 2) throw new Error('群聊至少需要保留两个 AI 成员'); group.removedMembers[String(memberId)] = { id: String(memberId), name: memberName(group, memberId), role: getGroupMemberRole(group, memberId), removedAt: Date.now(), removedBy: actorId }; group.memberIds = group.memberIds.filter((id: string) => String(id) !== String(memberId)); group.adminIds = group.adminIds.filter((id: string) => id !== String(memberId)); delete group.memberMutes[String(memberId)]; appendEvent(group, { actorId, targetId: memberId, actionType: 'kick', eventType: 'member_removed', detail: `${memberName(group, actorId)}将${memberName(group, memberId)}移出了群聊` }); return { success: true } }
  updateMemberNickname(group: any, actorId: string, memberId: string, nickname: string) { ensureGroupManagementState(group); assertMember(group, actorId); assertMember(group, memberId); if (String(actorId) !== String(memberId)) assertManager(group, actorId); const value = String(nickname).trim().slice(0, 20); if (!value) throw new Error('群昵称不能为空'); group.memberNicknames[String(memberId)] = value; group.updatedAt = Date.now(); return { success: true, nickname: value } }
  publishAnnouncement(group: any, actorId: string, payload: PublishAnnouncementPayload) { ensureGroupManagementState(group); assertManager(group, actorId); const title = String(payload.title).trim().slice(0, 80); const content = String(payload.content).trim().slice(0, 5000); if (!title || !content) throw new Error('公告标题和内容不能为空'); if (payload.isPinned) group.announcements.forEach((item: GroupAnnouncement) => { item.isPinned = false }); const now = Date.now(); const item = normalizeAnnouncement(group, { id: `notice_${now}_${Math.random().toString(36).slice(2, 7)}`, title, content, publisherId: actorId, publisherName: memberName(group, actorId), isPinned: payload.isPinned, needConfirm: payload.needConfirm, readUserIds: [actorId], confirmedUserIds: payload.needConfirm ? [actorId] : [], createdAt: now, updatedAt: now }); group.announcements.push(item); appendEvent(group, { actorId, actionType: 'announcement_publish', eventType: 'announcement_published', detail: `${memberName(group, actorId)}发布了群公告《${title}》`, eventData: { announcementId: item.id } }); return item }
  updateAnnouncement(group: any, actorId: string, announcementId: string, payload: UpdateAnnouncementPayload) { ensureGroupManagementState(group); assertManager(group, actorId); const item = group.announcements.find((entry: GroupAnnouncement) => entry.id === announcementId && entry.status !== 'deleted'); if (!item) throw new Error('公告不存在或已被删除'); const title = payload.title === undefined ? item.title : String(payload.title).trim().slice(0, 80); const content = payload.content === undefined ? item.content : String(payload.content).trim().slice(0, 5000); if (!title || !content) throw new Error('公告标题和内容不能为空'); if (payload.isPinned) group.announcements.forEach((entry: GroupAnnouncement) => { entry.isPinned = entry.id === item.id }); Object.assign(item, { title, content, isPinned: payload.isPinned ?? item.isPinned, needConfirm: payload.needConfirm ?? item.needConfirm, updatedAt: Date.now(), version: item.version + 1 }); appendEvent(group, { actorId, actionType: 'announcement_update', eventType: 'announcement_updated', detail: `${memberName(group, actorId)}更新了群公告《${item.title}》`, eventData: { announcementId: item.id, version: item.version } }); return item }
  deleteAnnouncement(group: any, actorId: string, announcementId: string) { ensureGroupManagementState(group); assertManager(group, actorId); const item = group.announcements.find((entry: GroupAnnouncement) => entry.id === announcementId && entry.status !== 'deleted'); if (!item) throw new Error('公告不存在或已被删除'); item.status = 'deleted'; item.isPinned = false; item.updatedAt = Date.now(); appendEvent(group, { actorId, actionType: 'announcement_delete', eventType: 'announcement_deleted', detail: `${memberName(group, actorId)}删除了群公告《${item.title}》`, eventData: { announcementId: item.id } }); return { success: true } }
  markAnnouncementRead(group: any, actorId: string, announcementId: string) { ensureGroupManagementState(group); assertMember(group, actorId); const item = group.announcements.find((entry: GroupAnnouncement) => entry.id === announcementId && entry.status !== 'deleted'); if (!item) throw new Error('公告不存在或已被删除'); if (!item.readUserIds.includes(actorId)) item.readUserIds.push(actorId); item.readCount = item.readUserIds.length; return { success: true } }
  confirmAnnouncement(group: any, actorId: string, announcementId: string) { ensureGroupManagementState(group); assertMember(group, actorId); const item = group.announcements.find((entry: GroupAnnouncement) => entry.id === announcementId && entry.status !== 'deleted'); if (!item) throw new Error('公告不存在或已被删除'); if (!item.needConfirm) throw new Error('该公告不需要确认'); if (!item.readUserIds.includes(actorId)) item.readUserIds.push(actorId); const first = !item.confirmedUserIds.includes(actorId); if (first) item.confirmedUserIds.push(actorId); item.readCount = item.readUserIds.length; item.confirmCount = item.confirmedUserIds.length; if (first) awardGroupActivity(group, actorId, `announcement:${announcementId}`, Date.now(), 1); return { success: true } }
  updateLevelTitles(group: any, actorId: string, titles: GroupLevelTitleConfig[]) { ensureGroupManagementState(group); assertOwner(group, actorId); if (!Array.isArray(titles) || titles.length !== 6) throw new Error('必须完整设置六个等级头衔'); if (Number(titles[0]?.minPoints) !== 0) throw new Error('LV1 起始积分必须为 0'); for (let index = 1; index < titles.length; index++) if (!Number.isFinite(Number(titles[index]?.minPoints)) || Number(titles[index].minPoints) <= Number(titles[index - 1].minPoints)) throw new Error('六级积分门槛必须逐级递增'); group.levelTitles = normalizeLevelTitles(titles); appendEvent(group, { actorId, actionType: 'title_edit', eventType: 'level_titles_updated', detail: `${memberName(group, actorId)}更新了群成员等级头衔` }); return { success: true, titles: group.levelTitles } }
  setAiManagementMode(group: any, actorId: string, mode: GroupAiManagementMode) { ensureGroupManagementState(group); assertOwner(group, actorId); if (!AI_MODES.includes(mode)) throw new Error('AI 管理模式无效'); group.aiManagementMode = mode; group.updatedAt = Date.now(); return { success: true, mode } }
  fetchAdminLogs(group: any, actorId: string) { ensureGroupManagementState(group); assertManager(group, actorId); return [...group.adminLogs] as GroupAdminLog[] }
  deleteAdminLogs(group: any, actorId: string, logIds: string[]) {
    ensureGroupManagementState(group)
    assertManager(group, actorId)
    if (!Array.isArray(logIds) || logIds.length === 0) return { success: true, deletedCount: 0 }
    const set = new Set(logIds.map(String))
    const beforeCount = group.adminLogs.length
    group.adminLogs = group.adminLogs.filter((log: GroupAdminLog) => !set.has(String(log.id)))
    const deletedCount = beforeCount - group.adminLogs.length
    group.updatedAt = Date.now()
    return { success: true, deletedCount }
  }
}

export const groupManagementService = new GroupManagementService()
