export type MomentViewer = { id?: string | number; name?: string; groupIds?: string[] }

/** 所有角色读取、提醒和详情页都应调用此函数，避免受众规则分叉。 */
export const canViewMoment = (moment: any, viewer: MomentViewer): boolean => {
  if (!moment) return false
  if (moment.authorId !== undefined && String(moment.authorId) === String(viewer.id)) return true
  if (moment.author && viewer.name && moment.author === viewer.name) return true
  const visibility = moment.visibility || '公开'
  if (visibility === '公开') return true
  if (visibility === '私密') return false
  const audienceGroups = Array.isArray(moment.visibilityGroups) ? moment.visibilityGroups : []
  const viewerGroups = Array.isArray(viewer.groupIds) ? viewer.groupIds : []
  const isInAudience = audienceGroups.some((id: string) => viewerGroups.includes(id))
  if (visibility === '部分可见') return isInAudience
  if (visibility === '不给谁看') return !isInAudience
  return false
}
