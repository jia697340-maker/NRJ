/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type EmojiCategory = 'user' | 'role' | 'global' | 'group'

export interface EmojiScopeLike {
  id: string
  name?: string
  category: EmojiCategory
  roleId?: string | number
  targetId?: string | number
  ownerCharacterId?: string
  groupId?: string
}

export const emojiOwnerCharacterId = (item: EmojiScopeLike) => String(
  item.ownerCharacterId ?? item.roleId ?? item.targetId ?? ''
)

export const normalizeEmojiScope = <T extends EmojiScopeLike>(item: T): T => {
  const ownerCharacterId = emojiOwnerCharacterId(item)
  return {
    ...item,
    ownerCharacterId: item.category === 'role' ? ownerCharacterId : undefined,
    roleId: item.category === 'role' && ownerCharacterId ? ownerCharacterId : undefined,
    targetId: undefined,
    groupId: item.category === 'group' ? String(item.groupId || '') : undefined
  }
}

export const selectUserSendableEmojis = <T extends EmojiScopeLike>(items: T[], groupId?: string) => items.filter(item => (
  item.category === 'user'
  || (item.category === 'group' && Boolean(groupId) && String(item.groupId || '') === String(groupId))
))

export const selectRoleAvailableEmojis = <T extends EmojiScopeLike>(
  items: T[],
  characterId: string,
  options: { groupId?: string; includePrivateRoleLibrary?: boolean } = {}
) => items.filter(item => (
  item.category === 'global'
  || (item.category === 'group' && Boolean(options.groupId) && String(item.groupId || '') === String(options.groupId))
  || (options.includePrivateRoleLibrary !== false
    && item.category === 'role'
    && emojiOwnerCharacterId(item) === String(characterId))
))

export const findRoleEmojiByResponse = <T extends EmojiScopeLike>(
  items: T[],
  characterId: string,
  response: { id?: string; name?: string },
  options: { groupId?: string; includePrivateRoleLibrary?: boolean } = {}
) => {
  const available = selectRoleAvailableEmojis(items, characterId, options)
  if (response.id) {
    const byId = available.find(item => String(item.id) === String(response.id))
    if (byId) return byId
  }
  return available.find(item => String(item.name || '').trim() === String(response.name || '').trim())
}
