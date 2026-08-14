/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import { useChatAuth } from '../composables/useChatAuth'

export type MomentSource = 'manual' | 'ai-assist' | 'ai-chat' | 'autonomy' | 'legacy'

const store = localforage.createInstance({ name: 'nrt-app', storeName: 'discover_moments' })
const SHARED_CHARACTER_MOMENTS_KEY = 'character_moments_shared_v1'

export const getMomentListKey = () => {
  const { currentChatUserId } = useChatAuth()
  return currentChatUserId.value ? `moments_list_${currentChatUserId.value}` : 'moments_list'
}

export const listMoments = async (): Promise<any[]> => {
  const moments = await store.getItem<any[]>(getMomentListKey())
  return Array.isArray(moments) ? moments : []
}

export const saveMomentList = async (moments: any[]) => {
  await store.setItem(getMomentListKey(), JSON.parse(JSON.stringify(moments)))
  window.dispatchEvent(new CustomEvent('clingy:moments-updated'))
}

export const listSharedCharacterMoments = async (): Promise<any[]> => {
  const moments = await store.getItem<any[]>(SHARED_CHARACTER_MOMENTS_KEY)
  return Array.isArray(moments) ? moments : []
}

export const saveSharedCharacterMoments = async (moments: any[]) => {
  await store.setItem(SHARED_CHARACTER_MOMENTS_KEY, JSON.parse(JSON.stringify(moments)))
  window.dispatchEvent(new CustomEvent('clingy:moments-updated'))
}

export const listMomentsByAuthor = async (authorId: string | number) => {
  const [accountMoments, sharedMoments] = await Promise.all([listMoments(), listSharedCharacterMoments()])
  const moments = [...sharedMoments, ...accountMoments.filter(moment => !sharedMoments.some(shared => String(shared.id) === String(moment.id)))]
  return moments
    .filter(moment => String(moment.authorId ?? '') === String(authorId))
    .sort((a, b) => Number(b.time || 0) - Number(a.time || 0))
}

export const createCharacterMoment = async (chat: any, content: string, source: MomentSource, extra: Record<string, unknown> = {}) => {
  const moments = await listSharedCharacterMoments()
  const profile = chat?.socialProfile || {}
  const moment = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    authorId: chat.characterEntityId || chat.id,
    author: profile.nickname || chat.realName || chat.name || '角色',
    avatar: chat.avatarUrl || '',
    content: content.trim(),
    images: [],
    time: Date.now(),
    visibility: '公开',
    visibilityGroups: [],
    isOwn: false,
    likes: [],
    comments: [],
    notifications: [],
    source,
    sharedCharacterMoment: true,
    ...extra
  }
  moments.unshift(moment)
  await saveSharedCharacterMoments(moments)
  return moment
}

export const updateCharacterMoment = async (momentId: string | number, patch: Record<string, unknown>) => {
  const sharedMoments = await listSharedCharacterMoments()
  const sharedTarget = sharedMoments.find(moment => String(moment.id) === String(momentId))
  if (sharedTarget) {
    Object.assign(sharedTarget, patch, { updatedAt: Date.now() })
    await saveSharedCharacterMoments(sharedMoments)
    return sharedTarget
  }
  const moments = await listMoments()
  const target = moments.find(moment => String(moment.id) === String(momentId))
  if (!target) throw new Error('未找到这条朋友圈')
  Object.assign(target, patch, { updatedAt: Date.now() })
  await saveMomentList(moments)
  return target
}

export const deleteCharacterMoment = async (momentId: string | number) => {
  const sharedMoments = await listSharedCharacterMoments()
  const nextShared = sharedMoments.filter(moment => String(moment.id) !== String(momentId))
  if (nextShared.length !== sharedMoments.length) {
    await saveSharedCharacterMoments(nextShared)
    return
  }
  const moments = await listMoments()
  const next = moments.filter(moment => String(moment.id) !== String(momentId))
  if (next.length === moments.length) throw new Error('未找到这条朋友圈')
  await saveMomentList(next)
}
