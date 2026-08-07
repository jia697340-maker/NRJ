export type MomentViewer = { id?: string | number; name?: string; groupIds?: string[]; groups?: string[] }

export type MomentBehavior = {
  mode: 'autonomous' | 'custom'
  activeStart: number
  activeEnd: number
  postCooldownMinutes: number
  interactCooldownMinutes: number
  likeProbability: number
  commentProbability: number
  imageProbability: number
  style: string
  audience: '公开' | '私密' | '部分可见' | '不给谁看'
  audienceGroupIds: string[]
}

export const defaultMomentBehavior = (): MomentBehavior => ({
  mode: 'autonomous',
  activeStart: 8,
  activeEnd: 23,
  postCooldownMinutes: 180,
  interactCooldownMinutes: 30,
  likeProbability: 70,
  commentProbability: 45,
  imageProbability: 35,
  style: '自然、符合角色性格，不刷屏',
  audience: '公开',
  audienceGroupIds: []
})

export const getMomentBehavior = (character: any): MomentBehavior => ({
  ...defaultMomentBehavior(),
  ...(character?.momentBehavior || {})
})

export const isMomentActiveHour = (behavior: MomentBehavior, hour = new Date().getHours()) => {
  if (behavior.activeStart === behavior.activeEnd) return true
  return behavior.activeStart < behavior.activeEnd
    ? hour >= behavior.activeStart && hour < behavior.activeEnd
    : hour >= behavior.activeStart || hour < behavior.activeEnd
}

export const canPerformMomentAction = (character: any, action: 'post' | 'like' | 'comment', now = Date.now()) => {
  const behavior = getMomentBehavior(character)
  // 真人自主模式只负责执行角色已经主动选择的动作，不再用随机数和时间表二次否决。
  if (behavior.mode !== 'custom') return true
  if (!isMomentActiveHour(behavior)) return false
  const state = character.momentBehaviorState || {}
  const lastAt = action === 'post' ? state.lastPostAt : state.lastInteractAt
  const cooldown = (action === 'post' ? behavior.postCooldownMinutes : behavior.interactCooldownMinutes) * 60000
  // 同一轮响应允许“点赞+评论”组合；跨轮仍执行完整冷却。
  if (lastAt && now - lastAt < cooldown && now - lastAt > 2000) return false
  const probability = action === 'like' ? behavior.likeProbability : action === 'comment' ? behavior.commentProbability : 100
  return Math.random() * 100 < probability
}

export const recordMomentAction = (character: any, action: 'post' | 'like' | 'comment', now = Date.now()) => {
  character.momentBehaviorState ||= {}
  if (action === 'post') character.momentBehaviorState.lastPostAt = now
  else character.momentBehaviorState.lastInteractAt = now
}

export const addMomentNotification = (moment: any, actor: any, type: string, content = '') => {
  moment.notifications ||= []
  const duplicate = moment.notifications.some((n: any) => n.actorId === actor.id && n.type === type && n.content === content && Date.now() - n.createdAt < 60000)
  if (!duplicate) moment.notifications.unshift({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, actorId: actor.id, actorName: actor.name, type, content, createdAt: Date.now(), read: false })
}

/** 所有角色读取、提醒和详情页都应调用此函数，避免受众规则分叉。 */
export const canViewMoment = (moment: any, viewer: MomentViewer): boolean => {
  if (!moment) return false
  if (moment.authorId !== undefined && String(moment.authorId) === String(viewer.id)) return true
  if (moment.author && viewer.name && moment.author === viewer.name) return true
  const visibility = moment.visibility || '公开'
  if (visibility === '公开') return true
  if (visibility === '私密') return false
  const audienceGroups = Array.isArray(moment.visibilityGroups) ? moment.visibilityGroups : []
  const viewerGroups = [...(Array.isArray(viewer.groupIds) ? viewer.groupIds : []), ...(Array.isArray(viewer.groups) ? viewer.groups : [])]
  const isInAudience = audienceGroups.some((id: string) => viewerGroups.includes(id))
  if (visibility === '部分可见') return isInAudience
  if (visibility === '不给谁看') return !isInAudience
  return false
}
