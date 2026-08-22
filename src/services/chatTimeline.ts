/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import { cloneTimelineVectors, exportTimelineVectors, importTimelineVectors, removeTimelineVectors } from './memoryEngine'
import { getMomentListKey, listMoments, listSharedCharacterMoments, saveMomentList, saveSharedCharacterMoments } from './momentRepository'
import { walletStorageKey } from './walletService'
import { sendChatMessage } from './api'

export type TimelineDeleteMode = 'trash' | 'permanent'
export type TimelineRetention = 7 | 30 | 90 | -1

export interface TimelineMeta {
  id: string
  name: string
  note: string
  tags: string[]
  color: string
  favorite: boolean
  parentTimelineId: string | null
  forkMessageId: number | string | null
  createdAt: number
  updatedAt: number
  lastActiveAt: number
  frozenAt: number | null
  messageCount: number
  checkpointCount: number
  relationshipLabel: string
  needsReview?: boolean
  reconstructionDraft?: { relationshipStage: string; relationshipSummary: string; walletSummary: string; socialSummary: string; uncertain: string[] }
}

export interface CheckpointMeta {
  id: string
  timelineId: string
  name: string
  note: string
  tags: string[]
  favorite: boolean
  locked: boolean
  messageId: number | string | null
  createdAt: number
}

export interface TrashMeta {
  id: string
  kind: 'timeline' | 'checkpoint'
  name: string
  deletedAt: number
  expiresAt: number | null
  sourceTimelineId?: string
}

export interface ChatTimelineState {
  version: 1
  activeTimelineId: string
  timelines: TimelineMeta[]
  checkpoints: CheckpointMeta[]
  trash: TrashMeta[]
  settings: {
    deleteMode: TimelineDeleteMode
    retentionDays: TimelineRetention
    autoSafetyCheckpoint: boolean
    roleEditScope: 'current' | 'all'
  }
}

interface CrossAppSnapshot {
  wallet: string | null
  moments: any[]
  sharedMoments: any[]
  groups: string | null
}

interface TimelineRecord {
  schemaVersion: 1
  chatId: string
  accountId: string
  timelineId: string
  state: Record<string, any>
  crossApp: CrossAppSnapshot | null
  journal: Array<{ messageId: string; capturedAt: number; runtime: Record<string, any> }>
  updatedAt: number
}

interface CheckpointRecord {
  schemaVersion: 1
  chatId: string
  accountId: string
  checkpointId: string
  timelineId: string
  state: Record<string, any>
  crossApp: CrossAppSnapshot | null
  createdAt: number
  vectors?: any[]
}

const store = localforage.createInstance({ name: 'nrt-app', storeName: 'chatTimelines' })
const persistQueues = new Map<string, Promise<void>>()
const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null))
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
const accountKey = (accountId?: string | null) => accountId || 'guest'
const getGroupChatsKey = (accountId?: string | null) => accountId ? `clingy_group_chats_${accountId}` : 'clingy_group_chats'
const timelineKey = (accountId: string | null | undefined, chatId: string | number, timelineId: string) => `timeline:${accountKey(accountId)}:${chatId}:${timelineId}`
const checkpointKey = (accountId: string | null | undefined, chatId: string | number, checkpointId: string) => `checkpoint:${accountKey(accountId)}:${chatId}:${checkpointId}`
const trashPayloadKey = (accountId: string | null | undefined, chatId: string | number, trashId: string) => `trash:${accountKey(accountId)}:${chatId}:${trashId}`

const STATE_FIELDS = [
  'messages', 'memoryBook', 'memoryState', 'lastSummaryMsgId', 'callSummaries',
  'innerThoughts', 'userInnerThoughts', 'pendingUserThought', 'offlineMeetSessions', 'activeOfflineSessionId',
  'relationship', 'conversationTimeState', 'statusText', 'offlineUntil', 'statusSource', 'statusSetAt',
  'presenceSession', 'presenceHistory', 'presencePendingReply', 'autonomyLedger', 'autonomyDeliveries',
  'autonomyHistory', 'autonomyState', 'autonomyLastMeaningfulActionAt', 'modelCommunicationMessages',
  'contactState', 'socialProfile', 'socialCircle', 'socialCircleSettings', 'socialPrivacy',
  'discoverable', 'allowFriendRequests', 'socialDiscoveryContext', 'userProfile', 'userProfileSource', 'replyVariantSets', 'pendingReplyVariantSetId',
  'unread', 'preview', 'time', 'draft', 'replyDraft', 'webSearchEnabled'
  , 'memberMemories', 'memoryMemberNames', 'memberSettings', 'memberIds', 'memberNotes', 'memberNicknames',
  'membershipRequests', 'announcements', 'adminLogs', 'memberPoints', 'memberMutes', 'memberActivityDaily',
  'memberTimelineBindings'
] as const

const ROLE_SCOPED_FIELDS = [
  'realName', 'remark', 'persona', 'avatarUrl', 'boundWorldBooks', 'boundWorldBookGroups',
  'voiceProvider', 'voiceModel', 'voiceId', 'voiceLanguage', 'voiceSpeed', 'voicePitch', 'voiceVolume',
  'voiceEmotion', 'enableVoiceReply', 'enableVoiceCall', 'enableVideoCall', 'imageGenProvider'
] as const

const RUNTIME_FIELDS = STATE_FIELDS.filter(field => ![
  'messages', 'memoryBook', 'memoryState', 'callSummaries', 'innerThoughts', 'userInnerThoughts',
  'modelCommunicationMessages', 'autonomyHistory', 'presenceHistory', 'offlineMeetSessions'
].includes(field))

const BLANK_RESET_FIELDS = [
  'messages', 'memoryBook', 'memoryState', 'lastSummaryMsgId', 'callSummaries', 'innerThoughts', 'userInnerThoughts',
  'pendingUserThought', 'offlineMeetSessions', 'activeOfflineSessionId', 'relationship', 'conversationTimeState',
  'statusText', 'offlineUntil', 'statusSource', 'statusSetAt', 'presenceSession', 'presenceHistory',
  'presencePendingReply', 'autonomyLedger', 'autonomyDeliveries', 'autonomyHistory', 'autonomyState',
  'autonomyLastMeaningfulActionAt', 'modelCommunicationMessages', 'unread', 'preview', 'time', 'draft', 'replyDraft',
  'memberMemories', 'memoryMemberNames', 'membershipRequests', 'announcements', 'adminLogs', 'memberPoints',
  'memberMutes', 'memberActivityDaily'
] as const

const blankValue = (field: string) => {
  if (['messages', 'memoryBook', 'callSummaries', 'innerThoughts', 'userInnerThoughts', 'offlineMeetSessions', 'presenceHistory', 'autonomyDeliveries', 'autonomyHistory', 'modelCommunicationMessages'].includes(field)) return []
  if (['lastSummaryMsgId', 'offlineUntil', 'statusSetAt', 'autonomyLastMeaningfulActionAt', 'unread'].includes(field)) return 0
  if (['pendingUserThought', 'statusText', 'statusSource', 'preview', 'time', 'draft', 'replyDraft'].includes(field)) return ''
  if (['memberMemories', 'memoryMemberNames', 'memberPoints', 'memberMutes', 'memberActivityDaily'].includes(field)) return {}
  return null
}

const relationshipLabel = (chat: any) => String(
  chat?.relationship?.currentStage?.name || chat?.relationship?.stageName || chat?.relationship?.status || '未设置'
)

const mainMeta = (chat: any): TimelineMeta => ({
  id: 'main', name: '主时间线', note: '', tags: [], color: '#8f7cff', favorite: true,
  parentTimelineId: null, forkMessageId: null, createdAt: Date.now(), updatedAt: Date.now(),
  lastActiveAt: Date.now(), frozenAt: null, messageCount: chat?.messages?.length || 0,
  checkpointCount: 0, relationshipLabel: relationshipLabel(chat)
})

export const ensureChatTimelineState = (chat: any): ChatTimelineState => {
  if (!chat.timelineState || chat.timelineState.version !== 1) {
    chat.timelineState = {
      version: 1,
      activeTimelineId: 'main',
      timelines: [mainMeta(chat)],
      checkpoints: [],
      trash: [],
      settings: { deleteMode: 'trash', retentionDays: -1, autoSafetyCheckpoint: true, roleEditScope: 'current' }
    } satisfies ChatTimelineState
  }
  const value = chat.timelineState as ChatTimelineState
  value.timelines ||= [mainMeta(chat)]
  value.checkpoints ||= []
  value.trash ||= []
  value.settings ||= { deleteMode: 'trash', retentionDays: -1, autoSafetyCheckpoint: true, roleEditScope: 'current' }
  if (!value.timelines.some(item => item.id === value.activeTimelineId)) value.activeTimelineId = value.timelines[0]?.id || 'main'
  chat.activeTimelineId = value.activeTimelineId
  return value
}

export const getActiveTimeline = (chat: any) => {
  const state = ensureChatTimelineState(chat)
  return state.timelines.find(item => item.id === state.activeTimelineId) || state.timelines[0]
}

const captureState = (chat: any) => Object.fromEntries([...STATE_FIELDS, ...ROLE_SCOPED_FIELDS].map(field => [field, deepClone(chat?.[field] ?? blankValue(field))]))
const captureRuntime = (chat: any) => Object.fromEntries(RUNTIME_FIELDS.map(field => [field, deepClone(chat?.[field] ?? blankValue(field))]))

const applyState = (chat: any, snapshot: Record<string, any>) => {
  for (const field of STATE_FIELDS) chat[field] = deepClone(snapshot[field] ?? blankValue(field))
  if (ensureChatTimelineState(chat).settings.roleEditScope === 'current') {
    for (const field of ROLE_SCOPED_FIELDS) if (snapshot[field] !== undefined) chat[field] = deepClone(snapshot[field])
    chat.name = chat.remark || chat.realName || chat.name
  }
  const last = chat.messages?.[chat.messages.length - 1]
  chat.preview = last?.content || '暂无消息'
  chat.time = last ? new Date(Number(last.timestamp || last.id || Date.now())).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''
}

const captureCrossApp = async (accountId?: string | null): Promise<CrossAppSnapshot> => ({
  wallet: localStorage.getItem(walletStorageKey(accountKey(accountId))),
  moments: await listMoments(),
  sharedMoments: await listSharedCharacterMoments(),
  groups: localStorage.getItem(getGroupChatsKey(accountId))
})

const restoreCrossApp = async (snapshot: CrossAppSnapshot | null, accountId?: string | null) => {
  if (!snapshot) return
  const walletKey = walletStorageKey(accountKey(accountId))
  if (snapshot.wallet === null) localStorage.removeItem(walletKey)
  else localStorage.setItem(walletKey, snapshot.wallet)
  await saveMomentList(snapshot.moments || [])
  await saveSharedCharacterMoments(snapshot.sharedMoments || [])
  const groupsKey = getGroupChatsKey(accountId)
  if (snapshot.groups === null) localStorage.removeItem(groupsKey)
  else localStorage.setItem(groupsKey, snapshot.groups)
  window.dispatchEvent(new CustomEvent('clingy-wallet-updated', { detail: { accountId: accountKey(accountId) } }))
}

const updateMetaFromChat = (chat: any) => {
  const meta = getActiveTimeline(chat)
  if (!meta) return
  meta.updatedAt = Date.now()
  meta.lastActiveAt = Date.now()
  meta.messageCount = chat.messages?.length || 0
  meta.relationshipLabel = relationshipLabel(chat)
  meta.checkpointCount = ensureChatTimelineState(chat).checkpoints.filter(item => item.timelineId === meta.id).length
}

const latestMessageId = (chat: any) => String(chat?.messages?.[chat.messages.length - 1]?.id ?? 'empty')

const persistActiveTimelineNow = async (chat: any, accountId?: string | null, includeCrossApp = false) => {
  if (!chat || chat.id === 1) return
  const state = ensureChatTimelineState(chat)
  updateMetaFromChat(chat)
  const key = timelineKey(accountId, chat.id, state.activeTimelineId)
  const existing = await store.getItem<TimelineRecord>(key)
  const boundary = latestMessageId(chat)
  const journal = Array.isArray(existing?.journal) ? existing!.journal : []
  if (journal[journal.length - 1]?.messageId !== boundary) {
    journal.push({ messageId: boundary, capturedAt: Date.now(), runtime: captureRuntime(chat) })
    if (journal.length > 2000) journal.splice(0, journal.length - 2000)
  } else if (journal.length) {
    journal[journal.length - 1] = { messageId: boundary, capturedAt: Date.now(), runtime: captureRuntime(chat) }
  }
  const record: TimelineRecord = {
    schemaVersion: 1, chatId: String(chat.id), accountId: accountKey(accountId), timelineId: state.activeTimelineId,
    state: captureState(chat), crossApp: includeCrossApp ? await captureCrossApp(accountId) : (existing?.crossApp || null),
    journal, updatedAt: Date.now()
  }
  await store.setItem(key, record)
  if (state.settings.roleEditScope === 'all') {
    await Promise.all(state.timelines.filter(item => item.id !== state.activeTimelineId).map(async item => {
      const otherKey = timelineKey(accountId, chat.id, item.id)
      const other = await store.getItem<TimelineRecord>(otherKey)
      if (!other) return
      for (const field of ROLE_SCOPED_FIELDS) other.state[field] = deepClone(chat?.[field] ?? null)
      other.updatedAt = Date.now()
      await store.setItem(otherKey, other)
    }))
  }
  window.dispatchEvent(new CustomEvent('clingy:timeline-updated', { detail: { chatId: chat.id, timelineId: state.activeTimelineId } }))
}

export const persistActiveTimeline = (chat: any, accountId?: string | null, includeCrossApp = false) => {
  if (!chat || chat.id === 1) return Promise.resolve()
  const scope = `${accountKey(accountId)}:${chat.id}:${ensureChatTimelineState(chat).activeTimelineId}`
  const previous = persistQueues.get(scope) || Promise.resolve()
  const queued = previous.catch(() => undefined).then(() => persistActiveTimelineNow(chat, accountId, includeCrossApp))
  persistQueues.set(scope, queued)
  void queued.finally(() => { if (persistQueues.get(scope) === queued) persistQueues.delete(scope) }).catch(() => undefined)
  return queued
}

export const initializeChatTimeline = async (chat: any, accountId?: string | null) => {
  if (!chat || chat.id === 1) return ensureChatTimelineState(chat)
  const state = ensureChatTimelineState(chat)
  const key = timelineKey(accountId, chat.id, state.activeTimelineId)
  const existing = await store.getItem<TimelineRecord>(key)
  if (!existing) await persistActiveTimeline(chat, accountId, true)
  else applyState(chat, existing.state)
  await purgeExpiredTimelineTrash(chat, accountId)
  return state
}

const filteredMemoryState = (memoryState: any, allowedIds: Set<string>) => {
  if (!memoryState || typeof memoryState !== 'object') return memoryState
  const next = deepClone(memoryState)
  const keep = (item: any) => {
    const ids = item?.evidence?.messageIds || item?.evidenceMessageIds || []
    return !ids.length || ids.every((id: any) => allowedIds.has(String(id)))
  }
  for (const key of ['events', 'variables', 'tableRows', 'relations']) if (Array.isArray(next[key])) next[key] = next[key].filter(keep)
  if (Array.isArray(next.coverage)) next.coverage = next.coverage.filter((item: any) => allowedIds.has(String(item.toMsgId)))
  return next
}

const branchStateAtMessage = (record: TimelineRecord, messageId: number | string) => {
  const next = deepClone(record.state)
  const messages = Array.isArray(next.messages) ? next.messages : []
  const index = messages.findIndex((item: any) => String(item.id) === String(messageId))
  next.messages = index >= 0 ? messages.slice(0, index + 1) : messages
  const allowed = new Set<string>((next.messages as any[]).map((item: any) => String(item.id)))
  next.memoryBook = (next.memoryBook || []).filter((item: any) => {
    const ids = item.evidenceMessageIds || []
    if (ids.length) return ids.every((id: any) => allowed.has(String(id)))
    return item.toMsgId === undefined || allowed.has(String(item.toMsgId))
  })
  next.memoryState = filteredMemoryState(next.memoryState, allowed)
  next.callSummaries = (next.callSummaries || []).filter((item: any) => !item.toMsgId || allowed.has(String(item.toMsgId)))
  const journal = [...record.journal].reverse().find(item => allowed.has(item.messageId))
  if (journal) Object.assign(next, deepClone(journal.runtime))
  next.lastSummaryMsgId = Math.min(Number(next.lastSummaryMsgId || 0), Number(messageId) || 0)
  next.unread = 0
  return { state: next, allowed, exactRuntime: Boolean(journal) }
}

export const createTimeline = async (chat: any, accountId: string | null | undefined, input: {
  name: string
  note?: string
  fromMessageId?: number | string | null
  fromCheckpointId?: string | null
  blank?: boolean
  activate?: boolean
}) => {
  const manager = ensureChatTimelineState(chat)
  await persistActiveTimeline(chat, accountId, true)
  const sourceId = manager.activeTimelineId
  const source = await store.getItem<TimelineRecord>(timelineKey(accountId, chat.id, sourceId))
  if (!source) throw new Error('当前时间线尚未保存')
  const id = uid('timeline')
  let state = deepClone(source.state)
  let crossApp = deepClone(source.crossApp)
  let allowed: Set<string> | undefined
  let exactRuntime = true
  let checkpointVectors: any[] | null = null
  let parentTimelineId: string | null = sourceId
  let forkMessageId: number | string | null = input.fromMessageId ?? (chat.messages?.[chat.messages.length - 1]?.id ?? null)
  if (input.fromCheckpointId) {
    const checkpoint = await store.getItem<CheckpointRecord>(checkpointKey(accountId, chat.id, input.fromCheckpointId))
    if (!checkpoint) throw new Error('没有找到这个存档')
    state = deepClone(checkpoint.state)
    crossApp = deepClone(checkpoint.crossApp)
    checkpointVectors = deepClone(checkpoint.vectors || [])
    parentTimelineId = checkpoint.timelineId
    forkMessageId = state.messages?.[state.messages.length - 1]?.id ?? null
  } else if (input.blank) {
    state = captureState(chat)
    for (const field of BLANK_RESET_FIELDS) state[field] = blankValue(field)
    state.contactState = 'friend'
    state.socialPrivacy = chat.socialPrivacy || 'public'
    crossApp = { wallet: null, moments: [], sharedMoments: [], groups: null }
    forkMessageId = null
  } else if (input.fromMessageId !== undefined && input.fromMessageId !== null) {
    const branched = branchStateAtMessage(source, input.fromMessageId)
    state = branched.state
    allowed = branched.allowed
    exactRuntime = branched.exactRuntime
  }
  const now = Date.now()
  const meta: TimelineMeta = {
    id, name: input.name.trim() || '未命名时间线', note: input.note?.trim() || '', tags: [], color: '#8f7cff', favorite: false,
    parentTimelineId, forkMessageId, createdAt: now, updatedAt: now, lastActiveAt: now, frozenAt: input.activate === false ? now : null,
    messageCount: state.messages?.length || 0, checkpointCount: 0,
    relationshipLabel: String(state.relationship?.currentStage?.name || state.relationship?.stageName || state.relationship?.status || '未设置'),
    needsReview: !exactRuntime
  }
  manager.timelines.push(meta)
  const record: TimelineRecord = { schemaVersion: 1, chatId: String(chat.id), accountId: accountKey(accountId), timelineId: id, state, crossApp, journal: [], updatedAt: now }
  await store.setItem(timelineKey(accountId, chat.id, id), record)
  await cloneTimelineVectors(chat.id, sourceId, id, allowed)
  if (checkpointVectors) await importTimelineVectors(chat.id, id, checkpointVectors)
  if (input.activate !== false) await switchTimeline(chat, accountId, id)
  return meta
}

export const switchTimeline = async (chat: any, accountId: string | null | undefined, timelineId: string) => {
  const manager = ensureChatTimelineState(chat)
  if (manager.activeTimelineId === timelineId) return getActiveTimeline(chat)
  const targetMeta = manager.timelines.find(item => item.id === timelineId)
  if (!targetMeta) throw new Error('没有找到这条时间线')
  await persistActiveTimeline(chat, accountId, true)
  const currentMeta = getActiveTimeline(chat)
  if (currentMeta) currentMeta.frozenAt = Date.now()
  const target = await store.getItem<TimelineRecord>(timelineKey(accountId, chat.id, timelineId))
  if (!target) throw new Error('时间线数据缺失')
  manager.activeTimelineId = timelineId
  chat.activeTimelineId = timelineId
  targetMeta.frozenAt = null
  targetMeta.lastActiveAt = Date.now()
  applyState(chat, target.state)
  await restoreCrossApp(target.crossApp, accountId)
  window.dispatchEvent(new CustomEvent('clingy:timeline-switched', { detail: { chatId: chat.id, timelineId } }))
  return targetMeta
}

export const createCheckpoint = async (chat: any, accountId: string | null | undefined, input: {
  name: string
  note?: string
  tags?: string[]
  favorite?: boolean
  locked?: boolean
  messageId?: number | string | null
}) => {
  const manager = ensureChatTimelineState(chat)
  await persistActiveTimeline(chat, accountId, true)
  const active = await store.getItem<TimelineRecord>(timelineKey(accountId, chat.id, manager.activeTimelineId))
  if (!active) throw new Error('当前时间线尚未保存')
  let state = deepClone(active.state)
  let allowedMessageIds: Set<string> | null = null
  if (input.messageId !== undefined && input.messageId !== null) {
    const branched = branchStateAtMessage(active, input.messageId)
    state = branched.state
    allowedMessageIds = branched.allowed
  }
  const id = uid('checkpoint')
  const meta: CheckpointMeta = {
    id, timelineId: manager.activeTimelineId, name: input.name.trim() || '未命名存档', note: input.note?.trim() || '',
    tags: input.tags || [], favorite: input.favorite === true, locked: input.locked === true,
    messageId: input.messageId ?? (state.messages?.[state.messages.length - 1]?.id ?? null), createdAt: Date.now()
  }
  manager.checkpoints.unshift(meta)
  await store.setItem(checkpointKey(accountId, chat.id, id), {
    schemaVersion: 1, chatId: String(chat.id), accountId: accountKey(accountId), checkpointId: id,
    timelineId: manager.activeTimelineId, state, crossApp: deepClone(active.crossApp), createdAt: meta.createdAt,
    vectors: (await exportTimelineVectors(chat.id, manager.activeTimelineId)).filter((record: any) => !allowedMessageIds || !(record.evidenceMessageIds || []).some((id: any) => !allowedMessageIds!.has(String(id))))
  } satisfies CheckpointRecord)
  updateMetaFromChat(chat)
  return meta
}

export const restoreCheckpoint = async (chat: any, accountId: string | null | undefined, checkpointId: string, mode: 'branch' | 'replace') => {
  const manager = ensureChatTimelineState(chat)
  const meta = manager.checkpoints.find(item => item.id === checkpointId)
  const record = await store.getItem<CheckpointRecord>(checkpointKey(accountId, chat.id, checkpointId))
  if (!meta || !record) throw new Error('没有找到这个存档')
  if (mode === 'branch') return createTimeline(chat, accountId, { name: `${meta.name} · 分支`, fromCheckpointId: checkpointId, activate: true })
  if (manager.settings.autoSafetyCheckpoint) await createCheckpoint(chat, accountId, { name: '回退前安全存档', note: `恢复“${meta.name}”前自动保存`, locked: true })
  applyState(chat, record.state)
  await restoreCrossApp(record.crossApp, accountId)
  await importTimelineVectors(chat.id, manager.activeTimelineId, record.vectors || [])
  await persistActiveTimeline(chat, accountId, true)
  return getActiveTimeline(chat)
}

const trashExpiry = (manager: ChatTimelineState) => manager.settings.retentionDays === -1
  ? null
  : Date.now() + manager.settings.retentionDays * 24 * 60 * 60 * 1000

export const deleteCheckpoint = async (chat: any, accountId: string | null | undefined, checkpointId: string, mode: TimelineDeleteMode) => {
  const manager = ensureChatTimelineState(chat)
  const index = manager.checkpoints.findIndex(item => item.id === checkpointId)
  if (index < 0) return
  const meta = manager.checkpoints[index]
  if (meta.locked) throw new Error('请先解除存档锁定')
  const key = checkpointKey(accountId, chat.id, checkpointId)
  const payload = await store.getItem(key)
  if (mode === 'trash') {
    const trash: TrashMeta = { id: uid('trash'), kind: 'checkpoint', name: meta.name, deletedAt: Date.now(), expiresAt: trashExpiry(manager), sourceTimelineId: meta.timelineId }
    manager.trash.unshift(trash)
    await store.setItem(trashPayloadKey(accountId, chat.id, trash.id), { meta, payload })
  }
  manager.checkpoints.splice(index, 1)
  await store.removeItem(key)
}

export const deleteTimeline = async (chat: any, accountId: string | null | undefined, timelineId: string, mode: TimelineDeleteMode, fallbackTimelineId?: string) => {
  const manager = ensureChatTimelineState(chat)
  if (manager.timelines.length <= 1) throw new Error('至少需要保留一条时间线')
  const index = manager.timelines.findIndex(item => item.id === timelineId)
  if (index < 0) return
  if (timelineId === manager.activeTimelineId) {
    const fallback = fallbackTimelineId || manager.timelines.find(item => item.id !== timelineId)?.id
    if (!fallback) throw new Error('请选择切换目标')
    await switchTimeline(chat, accountId, fallback)
  }
  const meta = manager.timelines[index]
  const key = timelineKey(accountId, chat.id, timelineId)
  const payload = await store.getItem(key)
  const checkpoints = manager.checkpoints.filter(item => item.timelineId === timelineId)
  if (mode === 'trash') {
    const trash: TrashMeta = { id: uid('trash'), kind: 'timeline', name: meta.name, deletedAt: Date.now(), expiresAt: trashExpiry(manager), sourceTimelineId: timelineId }
    manager.trash.unshift(trash)
    const checkpointPayloads = await Promise.all(checkpoints.map(async item => ({ meta: item, payload: await store.getItem(checkpointKey(accountId, chat.id, item.id)) })))
    await store.setItem(trashPayloadKey(accountId, chat.id, trash.id), { meta, payload, checkpoints: checkpointPayloads })
  }
  manager.timelines.splice(index, 1)
  manager.checkpoints = manager.checkpoints.filter(item => item.timelineId !== timelineId)
  await store.removeItem(key)
  await Promise.all(checkpoints.map(item => store.removeItem(checkpointKey(accountId, chat.id, item.id))))
  if (mode === 'permanent') await removeTimelineVectors(chat.id, timelineId)
}

export const restoreTrashItem = async (chat: any, accountId: string | null | undefined, trashId: string) => {
  const manager = ensureChatTimelineState(chat)
  const index = manager.trash.findIndex(item => item.id === trashId)
  if (index < 0) return
  const trash = manager.trash[index]
  const packed = await store.getItem<any>(trashPayloadKey(accountId, chat.id, trashId))
  if (!packed) throw new Error('最近删除的数据已经不存在')
  if (trash.kind === 'timeline') {
    manager.timelines.push(packed.meta)
    await store.setItem(timelineKey(accountId, chat.id, packed.meta.id), packed.payload)
    for (const item of packed.checkpoints || []) {
      manager.checkpoints.push(item.meta)
      await store.setItem(checkpointKey(accountId, chat.id, item.meta.id), item.payload)
    }
  } else {
    manager.checkpoints.unshift(packed.meta)
    await store.setItem(checkpointKey(accountId, chat.id, packed.meta.id), packed.payload)
  }
  manager.trash.splice(index, 1)
  await store.removeItem(trashPayloadKey(accountId, chat.id, trashId))
}

export const permanentlyDeleteTrashItem = async (chat: any, accountId: string | null | undefined, trashId: string) => {
  const manager = ensureChatTimelineState(chat)
  const index = manager.trash.findIndex(item => item.id === trashId)
  if (index < 0) return
  const trash = manager.trash[index]
  if (trash.kind === 'timeline' && trash.sourceTimelineId) await removeTimelineVectors(chat.id, trash.sourceTimelineId)
  manager.trash.splice(index, 1)
  await store.removeItem(trashPayloadKey(accountId, chat.id, trashId))
}

export const purgeExpiredTimelineTrash = async (chat: any, accountId?: string | null) => {
  const manager = ensureChatTimelineState(chat)
  const expired = manager.trash.filter(item => item.expiresAt !== null && item.expiresAt <= Date.now())
  for (const item of expired) await permanentlyDeleteTrashItem(chat, accountId, item.id)
}

export const renameTimeline = (chat: any, timelineId: string, name: string) => {
  const meta = ensureChatTimelineState(chat).timelines.find(item => item.id === timelineId)
  if (meta) { meta.name = name.trim() || meta.name; meta.updatedAt = Date.now() }
}

export const updateCheckpointMeta = (chat: any, checkpointId: string, patch: Partial<Pick<CheckpointMeta, 'name' | 'note' | 'tags' | 'favorite' | 'locked'>>) => {
  const meta = ensureChatTimelineState(chat).checkpoints.find(item => item.id === checkpointId)
  if (meta) Object.assign(meta, patch)
}

export const duplicateTimeline = async (chat: any, accountId: string | null | undefined, timelineId: string) => {
  const manager = ensureChatTimelineState(chat)
  const sourceMeta = manager.timelines.find(item => item.id === timelineId)
  const source = await store.getItem<TimelineRecord>(timelineKey(accountId, chat.id, timelineId))
  if (!sourceMeta || !source) throw new Error('没有找到这条时间线')
  const id = uid('timeline')
  const now = Date.now()
  const meta: TimelineMeta = { ...deepClone(sourceMeta), id, name: `${sourceMeta.name} · 副本`, parentTimelineId: timelineId, createdAt: now, updatedAt: now, lastActiveAt: now, frozenAt: now, favorite: false }
  manager.timelines.push(meta)
  await store.setItem(timelineKey(accountId, chat.id, id), { ...deepClone(source), timelineId: id, updatedAt: now })
  await cloneTimelineVectors(chat.id, timelineId, id)
  return meta
}

export const generateTimelineReconstructionDraft = async (chat: any, accountId: string | null | undefined, timelineId: string) => {
  const manager = ensureChatTimelineState(chat)
  const meta = manager.timelines.find(item => item.id === timelineId)
  const record = await store.getItem<TimelineRecord>(timelineKey(accountId, chat.id, timelineId))
  if (!meta || !record) throw new Error('没有找到这条时间线')
  const source = (record.state.messages || []).filter((item: any) => ['left', 'right', 'system'].includes(item.type)).slice(-160).map((item: any) => `${item.type === 'right' ? '用户' : item.type === 'left' ? '角色' : '事件'}：${String(item.content || '').slice(0, 500)}`).join('\n')
  const result: any = await sendChatMessage([{
    role: 'system',
    content: '你负责根据给定的历史聊天重建分支点状态草稿。只能使用聊天中明确出现的信息，不得补造。返回严格 JSON：{"relationshipStage":"关系阶段短名称","relationshipSummary":"关系与未完成事件摘要","walletSummary":"资金和交易状态摘要或无法确定","socialSummary":"朋友圈、好友、群聊等社交状态摘要或无法确定","uncertain":["无法确定的项目"]}'
  }, { role: 'user', content: source || '没有可用的历史消息' }])
  const raw = typeof result === 'string' ? result : result?.content || ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('模型没有返回可用的重建草稿')
  const parsed = JSON.parse(match[0])
  meta.reconstructionDraft = {
    relationshipStage: String(parsed.relationshipStage || '待确认'),
    relationshipSummary: String(parsed.relationshipSummary || ''),
    walletSummary: String(parsed.walletSummary || '无法确定'),
    socialSummary: String(parsed.socialSummary || '无法确定'),
    uncertain: Array.isArray(parsed.uncertain) ? parsed.uncertain.map(String) : []
  }
  return meta.reconstructionDraft
}

export const acceptTimelineReconstructionDraft = async (chat: any, accountId: string | null | undefined, timelineId: string) => {
  const manager = ensureChatTimelineState(chat)
  const meta = manager.timelines.find(item => item.id === timelineId)
  if (!meta?.reconstructionDraft) throw new Error('没有待确认的重建草稿')
  const record = await store.getItem<TimelineRecord>(timelineKey(accountId, chat.id, timelineId))
  if (!record) throw new Error('时间线数据缺失')
  record.state.relationship = {
    ...(record.state.relationship || {}),
    stageName: meta.reconstructionDraft.relationshipStage,
    reconstructionSummary: meta.reconstructionDraft.relationshipSummary,
    reconstructionWalletSummary: meta.reconstructionDraft.walletSummary,
    reconstructionSocialSummary: meta.reconstructionDraft.socialSummary,
    reconstructedAt: Date.now()
  }
  meta.relationshipLabel = meta.reconstructionDraft.relationshipStage
  meta.note ||= meta.reconstructionDraft.relationshipSummary
  meta.needsReview = false
  delete meta.reconstructionDraft
  await store.setItem(timelineKey(accountId, chat.id, timelineId), record)
  if (manager.activeTimelineId === timelineId) applyState(chat, record.state)
}

export const exportTimelineBundle = async (chat: any, accountId: string | null | undefined, kind: 'timeline' | 'checkpoint', id: string) => {
  const manager = ensureChatTimelineState(chat)
  const meta = kind === 'timeline'
    ? manager.timelines.find(item => item.id === id)
    : manager.checkpoints.find(item => item.id === id)
  if (!meta) throw new Error('没有找到要导出的内容')
  const payload = kind === 'timeline'
    ? await store.getItem(timelineKey(accountId, chat.id, id))
    : await store.getItem(checkpointKey(accountId, chat.id, id))
  return {
    format: 'clingy-timeline', schemaVersion: 1, exportedAt: Date.now(), kind,
    character: { id: chat.characterEntityId || chat.id, name: chat.realName || chat.name },
    meta: deepClone(meta), payload: deepClone(payload),
    vectors: kind === 'timeline' ? await exportTimelineVectors(chat.id, id) : []
  }
}

export const importTimelineBundle = async (chat: any, accountId: string | null | undefined, bundle: any) => {
  if (bundle?.format !== 'clingy-timeline' || bundle?.schemaVersion !== 1 || !bundle?.payload || !bundle?.meta) throw new Error('不是有效的时间线存档文件')
  const manager = ensureChatTimelineState(chat)
  if (bundle.kind === 'timeline') {
    const id = uid('timeline')
    const now = Date.now()
    const meta: TimelineMeta = { ...deepClone(bundle.meta), id, name: `${bundle.meta.name || '导入时间线'} · 导入`, parentTimelineId: null, createdAt: now, updatedAt: now, lastActiveAt: now, frozenAt: now }
    const payload: TimelineRecord = { ...deepClone(bundle.payload), chatId: String(chat.id), accountId: accountKey(accountId), timelineId: id, updatedAt: now }
    manager.timelines.push(meta)
    await store.setItem(timelineKey(accountId, chat.id, id), payload)
    await importTimelineVectors(chat.id, id, bundle.vectors || [])
    return meta
  }
  if (bundle.kind === 'checkpoint') {
    const id = uid('checkpoint')
    const meta: CheckpointMeta = { ...deepClone(bundle.meta), id, timelineId: manager.activeTimelineId, name: `${bundle.meta.name || '导入存档'} · 导入`, createdAt: Date.now() }
    const payload: CheckpointRecord = { ...deepClone(bundle.payload), chatId: String(chat.id), accountId: accountKey(accountId), checkpointId: id, timelineId: manager.activeTimelineId, createdAt: meta.createdAt }
    manager.checkpoints.unshift(meta)
    await store.setItem(checkpointKey(accountId, chat.id, id), payload)
    return meta
  }
  throw new Error('文件内容类型不受支持')
}

export const getTimelineStorageStore = () => store
export const getMomentScopeKey = () => getMomentListKey()

export const loadTimelineChatView = async (chat: any, accountId: string | null | undefined, timelineId: string) => {
  if (!timelineId || timelineId === ensureChatTimelineState(chat).activeTimelineId) return chat
  const record = await store.getItem<TimelineRecord>(timelineKey(accountId, chat.id, timelineId))
  if (!record) return chat
  const view = { ...chat, timelineState: deepClone(chat.timelineState), activeTimelineId: timelineId }
  view.timelineState.activeTimelineId = timelineId
  applyState(view, record.state)
  return view
}

export const deleteAllChatTimelineData = async (chatId: string | number, accountId?: string | null, timelineIds: string[] = []) => {
  const prefixParts = [`timeline:${accountKey(accountId)}:${chatId}:`, `checkpoint:${accountKey(accountId)}:${chatId}:`, `trash:${accountKey(accountId)}:${chatId}:`]
  const keys: string[] = []
  await store.iterate((_value, key) => { if (prefixParts.some(prefix => key.startsWith(prefix))) keys.push(key) })
  await Promise.all(keys.map(key => store.removeItem(key)))
  await Promise.all((timelineIds.length ? timelineIds : ['main']).map(id => removeTimelineVectors(chatId, id)))
}
