/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

import type { GroupAdminLog, GroupAiManagementMode, GroupAnnouncement, GroupLevelTitleConfig, GroupMemberRole, GroupMembershipRequest, GroupPointRules, GroupUserPermissions } from '../types/groupManagement'

export interface PublishAnnouncementPayload { groupId?: string; title: string; content: string; isPinned?: boolean; needConfirm?: boolean }
export interface UpdateAnnouncementPayload { title?: string; content?: string; isPinned?: boolean; needConfirm?: boolean }

// 默认段位头衔配置（共7个大段位覆盖1~100级）
export const DEFAULT_STAGE_TITLES: { minLevel: number; maxLevel: number; defaultName: string }[] = [
  { minLevel: 1, maxLevel: 10, defaultName: '潜水' },
  { minLevel: 11, maxLevel: 25, defaultName: '冒泡' },
  { minLevel: 26, maxLevel: 45, defaultName: '活跃' },
  { minLevel: 46, maxLevel: 65, defaultName: '常驻' },
  { minLevel: 66, maxLevel: 85, defaultName: '核心' },
  { minLevel: 86, maxLevel: 99, defaultName: '传说' },
  { minLevel: 100, maxLevel: 100, defaultName: '登峰造极' }
]

// 1~100 级升级积分计算公式（LV1 为 0，LV100 约 3500 积分）
export const getMinPointsForLevel = (level: number): number => {
  if (level <= 1) return 0
  if (level > 100) level = 100
  return Math.round(2.5 * Math.pow(level - 1, 1.58))
}

export const generate100LevelTitles = (customStageNames?: Record<number, string>): GroupLevelTitleConfig[] => {
  const configs: GroupLevelTitleConfig[] = []
  for (let lvl = 1; lvl <= 100; lvl++) {
    const stage = DEFAULT_STAGE_TITLES.find(s => lvl >= s.minLevel && lvl <= s.maxLevel) || DEFAULT_STAGE_TITLES[0]
    const name = customStageNames?.[stage.minLevel] || stage.defaultName
    configs.push({
      level: lvl,
      name,
      minPoints: getMinPointsForLevel(lvl)
    })
  }
  return configs
}

export const DEFAULT_GROUP_LEVEL_TITLES: GroupLevelTitleConfig[] = generate100LevelTitles()

export const DEFAULT_GROUP_POINT_RULES: GroupPointRules = {
  baseMsgPoints: 1,
  dailyFirstBonus: 2,
  dailyCap: 20,
  announcementConfirmPoints: 1
}

const MAX_ADMINS = 4
const MAX_MUTE_SECONDS = 30 * 24 * 60 * 60
const AI_MODES: GroupAiManagementMode[] = ['off', 'remind_only', 'semi_auto', 'full_auto']
const activeIds = (group: any) => new Set(['user', ...(Array.isArray(group?.memberIds) ? group.memberIds.map(String) : [])])
const memberName = (group: any, id: string) => id === 'user' ? String(group?.memberNicknames?.user || group?.userProfile?.name || '我') : String(group?.memberNicknames?.[id] || group?.memoryMemberNames?.[id] || group?.removedMembers?.[id]?.name || id)

export const getGroupMemberRole = (group: any, memberId: string): GroupMemberRole => {
  const id = String(memberId)
  if (String(group?.ownerId || 'user') === id) return 'owner'
  if (Array.isArray(group?.adminIds) && group.adminIds.map(String).includes(id)) return 'admin'
  return 'member'
}

export const getGroupLevelInfo = (group: any, memberId: string) => {
  const points = Math.max(0, Number(group?.memberPoints?.[String(memberId)] || 0))
  // 查找对应的等级 (1 到 100)
  let level = 1
  for (let lvl = 100; lvl >= 1; lvl--) {
    if (points >= getMinPointsForLevel(lvl)) {
      level = lvl
      break
    }
  }

  // 匹配头衔名称（优先专属头衔 -> 自定义段位头衔 -> 默认段位头衔）
  const specialTitle = group?.memberSpecialTitles?.[String(memberId)]
  let levelTitle = ''
  if (specialTitle) {
    levelTitle = String(specialTitle)
  } else {
    const stage = DEFAULT_STAGE_TITLES.find(s => level >= s.minLevel && level <= s.maxLevel) || DEFAULT_STAGE_TITLES[0]
    const customStageName = group?.stageTitles?.[stage.minLevel]
    levelTitle = String(customStageName || stage.defaultName)
  }

  // 计算当前等级到下一等级的进度 (0~100)
  const currentLevelMin = getMinPointsForLevel(level)
  const nextLevelMin = level < 100 ? getMinPointsForLevel(level + 1) : currentLevelMin
  const pointsProgress = level >= 100
    ? 100
    : Math.min(100, Math.max(0, Math.round(((points - currentLevelMin) / Math.max(1, nextLevelMin - currentLevelMin)) * 100)))

  return {
    level,
    levelTitle,
    points,
    pointsProgress,
    currentLevelMin,
    nextLevelMin
  }
}

export const getGroupPermissions = (group: any, actorId = 'user'): GroupUserPermissions => {
  const role = activeIds(group).has(String(actorId)) ? getGroupMemberRole(group, actorId) : 'member'
  const isOwner = role === 'owner'; const isAdmin = role === 'admin'; const manages = isOwner || isAdmin
  return { isOwner, isAdmin, canManageMembers: manages, canPublishAnnouncement: manages, canManageAnnouncements: manages, canMuteMembers: manages, canSetWholeGroupMute: manages, canTransferOwnership: isOwner, canEditLevelTitles: isOwner, canSetAiManagement: isOwner, canViewLogs: manages }
}

const sameStringArray = (current: any, next: string[]) =>
  Array.isArray(current) && current.length === next.length && current.every((item: any, index: number) => item === next[index])

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
  group.stageTitles = group.stageTitles && typeof group.stageTitles === 'object' ? group.stageTitles : {}
  group.pointRules = {
    baseMsgPoints: typeof group.pointRules?.baseMsgPoints === 'number' ? group.pointRules.baseMsgPoints : DEFAULT_GROUP_POINT_RULES.baseMsgPoints,
    dailyFirstBonus: typeof group.pointRules?.dailyFirstBonus === 'number' ? group.pointRules.dailyFirstBonus : DEFAULT_GROUP_POINT_RULES.dailyFirstBonus,
    dailyCap: typeof group.pointRules?.dailyCap === 'number' ? group.pointRules.dailyCap : DEFAULT_GROUP_POINT_RULES.dailyCap,
    announcementConfirmPoints: typeof group.pointRules?.announcementConfirmPoints === 'number' ? group.pointRules.announcementConfirmPoints : DEFAULT_GROUP_POINT_RULES.announcementConfirmPoints
  }
  group.memberPoints = group.memberPoints && typeof group.memberPoints === 'object' ? group.memberPoints : {}
  group.memberMutes = group.memberMutes && typeof group.memberMutes === 'object' ? group.memberMutes : {}
  group.memberSpecialTitles = group.memberSpecialTitles && typeof group.memberSpecialTitles === 'object' ? group.memberSpecialTitles : {}
  group.memberActivityDaily = group.memberActivityDaily && typeof group.memberActivityDaily === 'object' ? group.memberActivityDaily : {}
  if (!Array.isArray(group.announcements)) group.announcements = []
  else if (group.announcements.some((item: any) => !Array.isArray(item?.readUserIds) || !Array.isArray(item?.confirmedUserIds) || !item?.status || !item?.version)) group.announcements = group.announcements.map((item: any) => normalizeAnnouncement(group, item))
  group.adminLogs = Array.isArray(group.adminLogs) ? group.adminLogs : []
  group.removedMembers = group.removedMembers && typeof group.removedMembers === 'object' ? group.removedMembers : {}
  group.membershipRequests = Array.isArray(group.membershipRequests) ? group.membershipRequests : []
  group.atAllDaily = group.atAllDaily && typeof group.atAllDaily === 'object' ? group.atAllDaily : {}
  for (const id of ids) group.memberPoints[id] = Math.max(0, Number(group.memberPoints[id] || 0))
  return group
}

const assertMember = (group: any, memberId: string) => { if (!activeIds(group).has(String(memberId))) throw new Error('该成员已不在群聊中') }
const assertFormerMember = (group: any, memberId: string) => {
  const id = String(memberId)
  if (activeIds(group).has(id) || !group.removedMembers?.[id]) throw new Error('只能对主动退群或被移出的原群成员执行此操作')
  return group.removedMembers[id]
}
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

const createMembershipRequest = (group: any, kind: GroupMembershipRequest['kind'], memberId: string, message: string, operatorId?: string): GroupMembershipRequest => {
  ensureGroupManagementState(group)
  const id = String(memberId); const former = assertFormerMember(group, id)
  const duplicate = group.membershipRequests.find((item: GroupMembershipRequest) => item.memberId === id && item.kind === kind && item.status === 'pending')
  if (duplicate) throw new Error(kind === 'rejoin_application' ? '该成员已有待处理的入群申请' : '该成员已有待回应的群邀请')
  const now = Date.now()
  const item: GroupMembershipRequest = { id: `group_request_${now}_${Math.random().toString(36).slice(2, 7)}`, groupId: String(group.id), memberId: id, memberName: memberName(group, id), kind, status: 'pending', message: String(message || '').trim().slice(0, 240), createdAt: now, updatedAt: now, operatorId, removalSource: former.source === 'left' ? 'left' : 'kicked' }
  group.membershipRequests.unshift(item); group.updatedAt = now
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clingy:group-requests-updated'))
  return item
}

const todayKey = (now = Date.now()) => new Date(now).toLocaleDateString('en-CA')

export const getAtAllUsage = (group: any, actorId: string, now = Date.now()) => {
  ensureGroupManagementState(group)
  const role = getGroupMemberRole(group, actorId)
  const limit = role === 'owner' ? 20 : role === 'admin' ? 10 : 0
  const state = group.atAllDaily[String(actorId)]
  const count = state?.date === todayKey(now) ? Math.max(0, Number(state.count || 0)) : 0
  return { count, limit, remaining: Math.max(0, limit - count), canMentionAll: limit > 0 && count < limit }
}

export const consumeAtAll = (group: any, actorId: string, now = Date.now()) => {
  assertMember(group, actorId)
  const usage = getAtAllUsage(group, actorId, now)
  if (!usage.limit) throw new Error('只有群主和管理员可以@全体成员')
  if (!usage.remaining) throw new Error(`今日@全体成员次数已用完（${usage.limit}次）`)
  group.atAllDaily[String(actorId)] = { date: todayKey(now), count: usage.count + 1 }
  return { ...usage, count: usage.count + 1, remaining: usage.remaining - 1 }
}

export const isGroupMemberMuted = (group: any, memberId: string, now = Date.now()) => (Boolean(group?.isWholeGroupMuted) && getGroupMemberRole(group, memberId) === 'member') || Number(group?.memberMutes?.[memberId]?.mutedUntil || 0) > now
export const getSpeakableCharacterIds = (group: any, now = Date.now()) => (Array.isArray(group?.memberIds) ? group.memberIds : []).map(String).filter((id: string) => !isGroupMemberMuted(group, id, now))

export const reconcileExpiredGroupMutes = (group: any, now = Date.now()) => {
  ensureGroupManagementState(group); let changed = false
  for (const [id, mute] of Object.entries<any>(group.memberMutes)) if (Number(mute?.mutedUntil || 0) > 0 && Number(mute.mutedUntil) <= now) { delete group.memberMutes[id]; appendEvent(group, { actorId: 'system', targetId: id, actionType: 'unmute', eventType: 'member_unmuted', detail: `${memberName(group, id)}的禁言已自动到期`, eventData: { source: 'automatic_expiry' } }); changed = true }
  return changed
}

export const awardGroupActivity = (group: any, memberId: string, turnId: string, timestamp = Date.now(), amount?: number) => {
  ensureGroupManagementState(group); const id = String(memberId)
  if (!activeIds(group).has(id) || !turnId) return false
  const rules = group.pointRules as GroupPointRules
  const basePoints = typeof amount === 'number' ? amount : (rules.baseMsgPoints ?? 1)
  const dailyCap = Math.max(1, rules.dailyCap ?? 20)
  const dailyFirstBonus = Math.max(0, rules.dailyFirstBonus ?? 2)

  const beforeLevel = getGroupLevelInfo(group, id)
  const day = new Date(timestamp).toISOString().slice(0, 10); const current = group.memberActivityDaily[id]
  const state = current?.date === day ? current : { date: day, earned: 0, turnIds: [] as string[] }
  if (state.turnIds.includes(String(turnId)) || state.earned >= dailyCap) return false
  const firstBonus = state.turnIds.length === 0 ? dailyFirstBonus : 0
  const earned = Math.min(dailyCap - state.earned, Math.max(0, basePoints) + firstBonus); if (earned <= 0) return false
  state.turnIds.push(String(turnId)); state.turnIds = state.turnIds.slice(-100); state.earned += earned; group.memberActivityDaily[id] = state; group.memberPoints[id] = Math.max(0, Number(group.memberPoints[id] || 0)) + earned
  const afterLevel = getGroupLevelInfo(group, id)
  if (afterLevel.level > beforeLevel.level) appendEvent(group, { actorId: 'system', targetId: id, actionType: 'level_up', eventType: 'level_up', detail: `${memberName(group, id)}升级为 LV${afterLevel.level} ${afterLevel.levelTitle}`, eventData: { beforeLevel: beforeLevel.level, afterLevel: afterLevel.level } })
  return true
}

export const buildGroupManagementPrompt = (group: any) => {
  ensureGroupManagementState(group); const now = Date.now()
  const roster = ['user', ...(group.memberIds || [])].map(id => { const role = getGroupMemberRole(group, id); const roleName = role === 'owner' ? '群主' : role === 'admin' ? '管理员' : '普通成员'; return `${memberName(group, id)}（ID：${id}，身份：${roleName}${isGroupMemberMuted(group, id, now) ? '，当前禁言' : ''}）` }).join('\n')
  const atAllRules = ['user', ...(group.memberIds || [])].filter(id => ['owner', 'admin'].includes(getGroupMemberRole(group, id))).map(id => { const usage = getAtAllUsage(group, id, now); return `${memberName(group, id)}：今日剩余${usage.remaining}/${usage.limit}次` }).join('；')
  const activeAnnouncements = (group.announcements || []).filter((item: GroupAnnouncement) => item.status !== 'deleted').sort((a: GroupAnnouncement, b: GroupAnnouncement) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt).slice(0, 3)
  const announcements = activeAnnouncements.map((item: GroupAnnouncement) => `- [${item.isPinned ? '置顶' : '公告'}:${item.id}] ${item.title}：${item.content.slice(0, 1200)}`).join('\n')
  const formerMembers = Object.values<any>(group.removedMembers || {}).map(item => `${item.name || item.id}（ID：${item.id}，${item.source === 'left' ? '主动退群' : '被移出'}${item.reason ? `，原因：${item.reason}` : ''}）${group.memberNotes?.[item.id] ? `；原群内设定：${String(group.memberNotes[item.id]).slice(0, 300)}` : ''}`).join('\n')
  const pendingMembership = (group.membershipRequests || []).filter((item: GroupMembershipRequest) => item.status === 'pending').map((item: GroupMembershipRequest) => `${item.kind === 'rejoin_application' ? '入群申请' : '重新邀请'} ${item.id}：${item.memberName}（${item.memberId}）${item.message ? `，留言：${item.message}` : ''}`).join('\n')
  const modeText: Record<GroupAiManagementMode, string> = { off: 'AI成员不得主动执行群管理动作。', remind_only: '管理员遇到不合适发言时只可在群中温和提醒，不得执行实际管理动作。', semi_auto: '群主或管理员可依真实群聊情境提出管理建议，但任何实际处置必须等待用户确认。建议禁言或解禁时输出 <group_management sender="管理员ID" action="mute或unmute" target="目标成员ID" duration="秒数">原因</group_management>。', full_auto: '群主或管理员可在自身QQ式权限范围内自主发布公告、修改普通成员群名片、撤回消息、禁言、移出普通成员及邀请原群成员；群主还可授予专属头衔。禁言使用 <group_management sender="管理员ID" action="mute或unmute" target="目标成员ID" duration="秒数">原因</group_management>，单次最长86400秒。不得自主转让群主、解散群聊或任免管理员。' }
  const mode = group.aiManagementMode as GroupAiManagementMode
  return `【群身份与管理规则】\n${roster}\n${modeText[mode]}\n只有群主和管理员可以使用 mentions="all" @全体成员，使用时消息正文也应自然写出“@全体成员”；管理员每天最多10次，群主每天最多20次。${atAllRules}${group.isWholeGroupMuted ? '\n当前处于全员禁言，只有群主和管理员可以发言。' : ''}${announcements ? `\n\n【当前有效群公告】\n${announcements}\n成员确实阅读公告后，可输出 <group_announcement_ack sender="成员ID" announcement_id="公告ID" />；只有标记需确认的公告才会登记确认。` : ''}${formerMembers ? `\n\n【可重新申请或被邀请的原群成员】\n${formerMembers}\n陌生角色一律不得申请或被邀请。` : ''}${pendingMembership ? `\n\n【待处理群聊申请】\n${pendingMembership}` : ''}\n\n【QQ式群管理动作协议】\n仅在身份权限、人物动机和当前管理模式都允许时使用，不能为了展示功能而机械操作。管理员或群主发布公告：<group_admin_action sender="ID" action="announcement" title="标题" pinned="true或false" need_confirm="true或false">正文</group_admin_action>；修改群名称 action="group_name"、修改群简介 action="group_context"，新内容写在标签正文；踢普通成员 action="kick" target="ID"；撤回普通成员消息 action="recall" target="成员ID" message_id="消息ID"；修改普通成员群名片 action="rename" target="ID"；邀请原群成员 action="invite" target="原成员ID"。只有群主可用 action="special_title" target="ID" 授予专属头衔。成员主动退群使用 action="leave"，这不属于群管理模式，但必须有符合人设和事件发展的强烈动机，禁止随机退群。原群成员申请重新加入使用 <group_membership_action sender="原成员ID" action="apply">申请理由</group_membership_action>；回应重新邀请使用 action="accept_invite或reject_invite" request_id="邀请ID"。不得涉及陌生角色。`
}

class GroupManagementService {
  recoverOwnership(group: any) { ensureGroupManagementState(group); if (group.ownerId === 'user') return { success: true }; const previousOwnerId = String(group.ownerId); group.ownerId = 'user'; group.adminIds = group.adminIds.filter((id: string) => id !== 'user' && id !== previousOwnerId); if (activeIds(group).has(previousOwnerId) && group.adminIds.length < MAX_ADMINS) group.adminIds.push(previousOwnerId); delete group.memberMutes.user; appendEvent(group, { actorId: 'system', targetId: 'user', actionType: 'transfer', eventType: 'ownership_recovered', detail: '用户通过群聊恢复控制重新成为群主', eventData: { previousOwnerId, source: 'controller_recovery' } }); return { success: true } }
  addMember(group: any, actorId: string, memberId: string) { ensureGroupManagementState(group); assertManager(group, actorId); const id = String(memberId); if (!id || activeIds(group).has(id)) throw new Error('该成员已经在群聊中'); assertFormerMember(group, id); const restoredName = memberName(group, id); group.memberIds.push(id); group.memberPoints[id] = Math.max(0, Number(group.memberPoints[id] || 0)); delete group.removedMembers[id]; appendEvent(group, { actorId, targetId: id, actionType: 'member_add', eventType: 'member_added', detail: `${memberName(group, actorId)}邀请${restoredName}重新加入了群聊` }); return { success: true } }
  promoteMember(group: any, actorId: string, memberId: string) { ensureGroupManagementState(group); assertOwner(group, actorId); assertMember(group, memberId); if (getGroupMemberRole(group, memberId) !== 'member') throw new Error('该成员当前不能设为管理员'); if (group.adminIds.length >= MAX_ADMINS) throw new Error(`本群最多设置 ${MAX_ADMINS} 名管理员`); group.adminIds.push(String(memberId)); appendEvent(group, { actorId, targetId: memberId, actionType: 'promote', eventType: 'role_changed', detail: `${memberName(group, actorId)}将${memberName(group, memberId)}设为管理员`, eventData: { before: 'member', after: 'admin' } }); return { success: true, role: 'admin' as const } }
  demoteAdmin(group: any, actorId: string, memberId: string) { ensureGroupManagementState(group); assertOwner(group, actorId); assertMember(group, memberId); if (getGroupMemberRole(group, memberId) !== 'admin') throw new Error('该成员不是管理员'); group.adminIds = group.adminIds.filter((id: string) => id !== String(memberId)); appendEvent(group, { actorId, targetId: memberId, actionType: 'demote', eventType: 'role_changed', detail: `${memberName(group, actorId)}取消了${memberName(group, memberId)}的管理员身份`, eventData: { before: 'admin', after: 'member' } }); return { success: true, role: 'member' as const } }
  transferOwnership(group: any, actorId: string, memberId: string) { ensureGroupManagementState(group); assertOwner(group, actorId); assertMember(group, memberId); if (String(memberId) === String(actorId)) throw new Error('该成员已经是群主'); const oldOwnerId = String(group.ownerId); group.ownerId = String(memberId); group.adminIds = group.adminIds.filter((id: string) => id !== String(memberId) && id !== oldOwnerId); delete group.memberMutes[String(memberId)]; appendEvent(group, { actorId, targetId: memberId, actionType: 'transfer', eventType: 'owner_transferred', detail: `${memberName(group, actorId)}已将群主转让给${memberName(group, memberId)}`, eventData: { previousOwnerId: oldOwnerId } }); return { success: true } }
  muteMember(group: any, actorId: string, memberId: string, durationSeconds: number, reason = '') { ensureGroupManagementState(group); assertCanManageTarget(group, actorId, memberId); const duration = Math.floor(Number(durationSeconds)); if (duration <= 0 || duration > MAX_MUTE_SECONDS) throw new Error('禁言时长必须在 1 秒到 30 天之间'); const mutedUntil = Date.now() + duration * 1000; group.memberMutes[String(memberId)] = { isMuted: true, mutedAt: Date.now(), mutedUntil, muteReason: String(reason).trim().slice(0, 200), mutedBy: actorId }; appendEvent(group, { actorId, targetId: memberId, actionType: 'mute', eventType: 'member_muted', detail: `${memberName(group, actorId)}将${memberName(group, memberId)}禁言至${new Date(mutedUntil).toLocaleString('zh-CN')}${reason ? `，原因：${String(reason).trim()}` : ''}`, eventData: { mutedUntil, reason } }); return { success: true, mutedUntil } }
  unmuteMember(group: any, actorId: string, memberId: string) { ensureGroupManagementState(group); assertCanManageTarget(group, actorId, memberId); if (!group.memberMutes[String(memberId)]) throw new Error('该成员当前未被单独禁言'); delete group.memberMutes[String(memberId)]; appendEvent(group, { actorId, targetId: memberId, actionType: 'unmute', eventType: 'member_unmuted', detail: `${memberName(group, actorId)}解除了${memberName(group, memberId)}的禁言` }); return { success: true } }
  setWholeGroupMute(group: any, actorId: string, enabled: boolean) { ensureGroupManagementState(group); assertManager(group, actorId); group.isWholeGroupMuted = Boolean(enabled); appendEvent(group, { actorId, actionType: 'whole_mute', eventType: 'whole_mute_changed', detail: `${memberName(group, actorId)}${enabled ? '开启' : '关闭'}了全员禁言`, eventData: { enabled: Boolean(enabled) } }); return { success: true, enabled: Boolean(enabled) } }
  removeMember(group: any, actorId: string, memberId: string, reason = '') { ensureGroupManagementState(group); assertCanManageTarget(group, actorId, memberId); if (String(memberId) === 'user') throw new Error('当前版本不能将用户移出群聊'); if ((group.memberIds || []).length <= 2) throw new Error('群聊至少需要保留两个 AI 成员'); const id = String(memberId); const name = memberName(group, id); group.removedMembers[id] = { id, name, role: getGroupMemberRole(group, id), removedAt: Date.now(), removedBy: actorId, source: 'kicked', reason: String(reason).trim().slice(0, 200) }; group.memberIds = group.memberIds.filter((item: string) => String(item) !== id); group.adminIds = group.adminIds.filter((item: string) => item !== id); delete group.memberMutes[id]; appendEvent(group, { actorId, targetId: id, actionType: 'kick', eventType: 'member_removed', detail: `${memberName(group, actorId)}将${name}移出了群聊${reason ? `，原因：${String(reason).trim()}` : ''}` }); return { success: true } }
  leaveGroup(group: any, memberId: string, reason = '') { ensureGroupManagementState(group); const id = String(memberId); assertMember(group, id); if (id === 'user') throw new Error('用户请通过群设置管理群聊'); if (getGroupMemberRole(group, id) === 'owner') throw new Error('群主需要先转让群主身份'); if ((group.memberIds || []).length <= 2) throw new Error('群聊至少需要保留两个 AI 成员'); const name = memberName(group, id); group.removedMembers[id] = { id, name, role: getGroupMemberRole(group, id), removedAt: Date.now(), removedBy: id, source: 'left', reason: String(reason).trim().slice(0, 200) }; group.memberIds = group.memberIds.filter((item: string) => String(item) !== id); group.adminIds = group.adminIds.filter((item: string) => item !== id); delete group.memberMutes[id]; appendEvent(group, { actorId: id, targetId: id, actionType: 'member_leave', eventType: 'member_left', detail: `${name}退出了群聊${reason ? `：${String(reason).trim()}` : ''}` }); return { success: true } }
  requestRejoin(group: any, memberId: string, message = '') { const item = createMembershipRequest(group, 'rejoin_application', memberId, message); appendEvent(group, { actorId: String(memberId), targetId: String(memberId), actionType: 'member_apply', eventType: 'member_rejoin_applied', detail: `${item.memberName}申请重新加入群聊` }); return item }
  inviteFormerMember(group: any, actorId: string, memberId: string, message = '') { ensureGroupManagementState(group); assertManager(group, actorId); const item = createMembershipRequest(group, 'former_member_invitation', memberId, message, actorId); appendEvent(group, { actorId, targetId: String(memberId), actionType: 'member_invite', eventType: 'former_member_invited', detail: `${memberName(group, actorId)}邀请${item.memberName}重新加入群聊` }); return item }
  reviewRejoinApplication(group: any, actorId: string, requestId: string, accepted: boolean) { ensureGroupManagementState(group); assertManager(group, actorId); const item = group.membershipRequests.find((entry: GroupMembershipRequest) => entry.id === requestId && entry.kind === 'rejoin_application' && entry.status === 'pending'); if (!item) throw new Error('入群申请不存在或已处理'); item.status = accepted ? 'accepted' : 'rejected'; item.resolvedBy = actorId; item.updatedAt = Date.now(); if (accepted) this.addMember(group, actorId, item.memberId); else appendEvent(group, { actorId, targetId: item.memberId, actionType: 'member_apply', eventType: 'member_rejoin_rejected', detail: `${memberName(group, actorId)}拒绝了${item.memberName}的入群申请` }); return item }
  respondToInvitation(group: any, memberId: string, requestId: string, accepted: boolean) { ensureGroupManagementState(group); const item = group.membershipRequests.find((entry: GroupMembershipRequest) => entry.id === requestId && entry.kind === 'former_member_invitation' && entry.memberId === String(memberId) && entry.status === 'pending'); if (!item) throw new Error('群邀请不存在或已处理'); assertFormerMember(group, memberId); item.status = accepted ? 'accepted' : 'rejected'; item.resolvedBy = String(memberId); item.updatedAt = Date.now(); if (accepted) this.addMember(group, item.operatorId || group.ownerId, memberId); else appendEvent(group, { actorId: String(memberId), targetId: String(memberId), actionType: 'member_invite', eventType: 'former_member_invitation_rejected', detail: `${item.memberName}拒绝了重新入群邀请` }); return item }
  recallMemberMessage(group: any, actorId: string, messageId: string | number, reason = '') { ensureGroupManagementState(group); assertManager(group, actorId); const message = group.messages.find((item: any) => String(item.id) === String(messageId)); if (!message || message.type === 'system' || message.isRecalled) throw new Error('该消息无法撤回'); const senderId = message.type === 'right' ? 'user' : String(message.senderId || ''); assertCanManageTarget(group, actorId, senderId); message.isRecalled = true; message.recalledBy = actorId; message.recalledAt = Date.now(); appendEvent(group, { actorId, targetId: senderId, actionType: 'message_recall', eventType: 'member_message_recalled', detail: `${memberName(group, actorId)}撤回了${memberName(group, senderId)}的一条消息${reason ? `，原因：${String(reason).trim()}` : ''}`, eventData: { messageId: String(messageId) } }); return { success: true } }
  setMemberSpecialTitle(group: any, actorId: string, memberId: string, title: string) { ensureGroupManagementState(group); assertOwner(group, actorId); assertMember(group, memberId); const value = String(title).trim().slice(0, 12); if (value) group.memberSpecialTitles[String(memberId)] = value; else delete group.memberSpecialTitles[String(memberId)]; appendEvent(group, { actorId, targetId: memberId, actionType: 'title_edit', eventType: 'member_special_title_changed', detail: value ? `${memberName(group, actorId)}授予${memberName(group, memberId)}专属头衔“${value}”` : `${memberName(group, actorId)}撤销了${memberName(group, memberId)}的专属头衔` }); return { success: true, title: value } }
  updateGroupProfile(group: any, actorId: string, field: 'name' | 'context', value: string) { ensureGroupManagementState(group); assertManager(group, actorId); const text = String(value).trim().slice(0, field === 'name' ? 40 : 2000); if (!text) throw new Error(field === 'name' ? '群名称不能为空' : '群简介不能为空'); if (field === 'name') group.name = text; else group.groupContext = text; appendEvent(group, { actorId, actionType: 'group_profile', eventType: 'group_profile_changed', detail: `${memberName(group, actorId)}修改了${field === 'name' ? `群名称为“${text}”` : '群简介'}`, eventData: { field } }); return { success: true, value: text } }
  updateMemberNickname(group: any, actorId: string, memberId: string, nickname: string) { ensureGroupManagementState(group); assertMember(group, actorId); assertMember(group, memberId); if (String(actorId) !== String(memberId)) assertManager(group, actorId); const value = String(nickname).trim().slice(0, 20); if (!value) throw new Error('群昵称不能为空'); group.memberNicknames[String(memberId)] = value; group.updatedAt = Date.now(); return { success: true, nickname: value } }
  publishAnnouncement(group: any, actorId: string, payload: PublishAnnouncementPayload) { ensureGroupManagementState(group); assertManager(group, actorId); const title = String(payload.title).trim().slice(0, 80); const content = String(payload.content).trim().slice(0, 5000); if (!title || !content) throw new Error('公告标题和内容不能为空'); if (payload.isPinned) group.announcements.forEach((item: GroupAnnouncement) => { item.isPinned = false }); const now = Date.now(); const item = normalizeAnnouncement(group, { id: `notice_${now}_${Math.random().toString(36).slice(2, 7)}`, title, content, publisherId: actorId, publisherName: memberName(group, actorId), isPinned: payload.isPinned, needConfirm: payload.needConfirm, readUserIds: [actorId], confirmedUserIds: payload.needConfirm ? [actorId] : [], createdAt: now, updatedAt: now }); group.announcements.push(item); appendEvent(group, { actorId, actionType: 'announcement_publish', eventType: 'announcement_published', detail: `${memberName(group, actorId)}发布了群公告《${title}》`, eventData: { announcementId: item.id } }); return item }
  updateAnnouncement(group: any, actorId: string, announcementId: string, payload: UpdateAnnouncementPayload) { ensureGroupManagementState(group); assertManager(group, actorId); const item = group.announcements.find((entry: GroupAnnouncement) => entry.id === announcementId && entry.status !== 'deleted'); if (!item) throw new Error('公告不存在或已被删除'); const title = payload.title === undefined ? item.title : String(payload.title).trim().slice(0, 80); const content = payload.content === undefined ? item.content : String(payload.content).trim().slice(0, 5000); if (!title || !content) throw new Error('公告标题和内容不能为空'); if (payload.isPinned) group.announcements.forEach((entry: GroupAnnouncement) => { entry.isPinned = entry.id === item.id }); Object.assign(item, { title, content, isPinned: payload.isPinned ?? item.isPinned, needConfirm: payload.needConfirm ?? item.needConfirm, updatedAt: Date.now(), version: item.version + 1 }); appendEvent(group, { actorId, actionType: 'announcement_update', eventType: 'announcement_updated', detail: `${memberName(group, actorId)}更新了群公告《${item.title}》`, eventData: { announcementId: item.id, version: item.version } }); return item }
  deleteAnnouncement(group: any, actorId: string, announcementId: string) { ensureGroupManagementState(group); assertManager(group, actorId); const item = group.announcements.find((entry: GroupAnnouncement) => entry.id === announcementId && entry.status !== 'deleted'); if (!item) throw new Error('公告不存在或已被删除'); item.status = 'deleted'; item.isPinned = false; item.updatedAt = Date.now(); appendEvent(group, { actorId, actionType: 'announcement_delete', eventType: 'announcement_deleted', detail: `${memberName(group, actorId)}删除了群公告《${item.title}》`, eventData: { announcementId: item.id } }); return { success: true } }
  markAnnouncementRead(group: any, actorId: string, announcementId: string) { ensureGroupManagementState(group); assertMember(group, actorId); const item = group.announcements.find((entry: GroupAnnouncement) => entry.id === announcementId && entry.status !== 'deleted'); if (!item) throw new Error('公告不存在或已被删除'); if (!item.readUserIds.includes(actorId)) item.readUserIds.push(actorId); item.readCount = item.readUserIds.length; return { success: true } }
  confirmAnnouncement(group: any, actorId: string, announcementId: string) { ensureGroupManagementState(group); assertMember(group, actorId); const item = group.announcements.find((entry: GroupAnnouncement) => entry.id === announcementId && entry.status !== 'deleted'); if (!item) throw new Error('公告不存在或已被删除'); if (!item.needConfirm) throw new Error('该公告不需要确认'); if (!item.readUserIds.includes(actorId)) item.readUserIds.push(actorId); const first = !item.confirmedUserIds.includes(actorId); if (first) item.confirmedUserIds.push(actorId); item.readCount = item.readUserIds.length; item.confirmCount = item.confirmedUserIds.length; if (first) awardGroupActivity(group, actorId, `announcement:${announcementId}`, Date.now(), group.pointRules?.announcementConfirmPoints ?? 1); return { success: true } }
  updateStageTitles(group: any, actorId: string, stageTitles: Record<number, string>) {
    ensureGroupManagementState(group)
    assertOwner(group, actorId)
    if (!stageTitles || typeof stageTitles !== 'object') throw new Error('段位头衔数据格式无效')
    const sanitized: Record<number, string> = {}
    for (const stage of DEFAULT_STAGE_TITLES) {
      const name = String(stageTitles[stage.minLevel] || stage.defaultName).trim().slice(0, 12)
      sanitized[stage.minLevel] = name || stage.defaultName
    }
    group.stageTitles = sanitized
    appendEvent(group, { actorId, actionType: 'title_edit', eventType: 'level_titles_updated', detail: `${memberName(group, actorId)}更新了群成员段位头衔` })
    return { success: true, stageTitles: group.stageTitles }
  }
  updateLevelTitles(group: any, actorId: string, titles: GroupLevelTitleConfig[]) {
    ensureGroupManagementState(group)
    assertOwner(group, actorId)
    // 兼容旧版调用，提取段位名
    const stageTitles: Record<number, string> = {}
    if (Array.isArray(titles)) {
      titles.forEach(t => {
        if (t.level && t.name) {
          const stage = DEFAULT_STAGE_TITLES.find(s => t.level >= s.minLevel && t.level <= s.maxLevel)
          if (stage) stageTitles[stage.minLevel] = t.name
        }
      })
    }
    return this.updateStageTitles(group, actorId, stageTitles)
  }
  adjustMemberPoints(group: any, actorId: string, memberId: string, points: number) {
    ensureGroupManagementState(group)
    assertOwner(group, actorId)
    assertMember(group, memberId)
    const newPts = Math.max(0, Math.round(Number(points) || 0))
    const oldPts = Math.max(0, Number(group.memberPoints?.[String(memberId)] || 0))
    group.memberPoints[String(memberId)] = newPts
    const newLvl = getGroupLevelInfo(group, memberId)
    appendEvent(group, {
      actorId,
      targetId: String(memberId),
      actionType: 'points_adjust',
      eventType: 'member_points_adjusted',
      detail: `${memberName(group, actorId)}将${memberName(group, memberId)}的群积分由 ${oldPts} 调整为 ${newPts}（LV${newLvl.level} ${newLvl.levelTitle}）`,
      eventData: { beforePoints: oldPts, afterPoints: newPts, level: newLvl.level }
    })
    return { success: true, points: newPts, levelInfo: newLvl }
  }
  resetMemberPoints(group: any, actorId: string, memberId: string) {
    ensureGroupManagementState(group)
    assertOwner(group, actorId)
    assertMember(group, memberId)
    const oldPts = Math.max(0, Number(group.memberPoints?.[String(memberId)] || 0))
    group.memberPoints[String(memberId)] = 0
    if (group.memberActivityDaily?.[String(memberId)]) {
      delete group.memberActivityDaily[String(memberId)]
    }
    const newLvl = getGroupLevelInfo(group, memberId)
    appendEvent(group, {
      actorId,
      targetId: String(memberId),
      actionType: 'points_reset',
      eventType: 'member_points_reset',
      detail: `${memberName(group, actorId)}重置了${memberName(group, memberId)}的群积分与等级（恢复为 LV1）`,
      eventData: { previousPoints: oldPts }
    })
    return { success: true, points: 0, levelInfo: newLvl }
  }
  resetAllGroupPoints(group: any, actorId: string) {
    ensureGroupManagementState(group)
    assertOwner(group, actorId)
    group.memberPoints = {}
    group.memberActivityDaily = {}
    for (const id of activeIds(group)) {
      group.memberPoints[id] = 0
    }
    appendEvent(group, {
      actorId,
      actionType: 'points_reset',
      eventType: 'all_points_reset',
      detail: `${memberName(group, actorId)}重置了本群全员的积分与等级（全员恢复为 LV1）`
    })
    return { success: true }
  }
  updateGroupPointRules(group: any, actorId: string, rules: Partial<GroupPointRules>) {
    ensureGroupManagementState(group)
    assertOwner(group, actorId)
    group.pointRules = {
      baseMsgPoints: Math.max(0, Math.min(100, Math.round(Number(rules.baseMsgPoints ?? group.pointRules.baseMsgPoints ?? 1)))),
      dailyFirstBonus: Math.max(0, Math.min(100, Math.round(Number(rules.dailyFirstBonus ?? group.pointRules.dailyFirstBonus ?? 2)))),
      dailyCap: Math.max(1, Math.min(1000, Math.round(Number(rules.dailyCap ?? group.pointRules.dailyCap ?? 20)))),
      announcementConfirmPoints: Math.max(0, Math.min(100, Math.round(Number(rules.announcementConfirmPoints ?? group.pointRules.announcementConfirmPoints ?? 1))))
    }
    appendEvent(group, {
      actorId,
      actionType: 'rule_update',
      eventType: 'point_rules_updated',
      detail: `${memberName(group, actorId)}更新了群聊积分成长规则（每次发言+${group.pointRules.baseMsgPoints}，首发+${group.pointRules.dailyFirstBonus}，日上限${group.pointRules.dailyCap}）`,
      eventData: { rules: group.pointRules }
    })
    return { success: true, pointRules: group.pointRules }
  }
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
