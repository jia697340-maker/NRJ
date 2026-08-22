/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import { embeddingApiSettings, globalPromptSettings } from '../store'
import { estimateTextTokens } from '../utils/tokenEstimate'

export type MemoryMode = 'long_text' | 'vector' | 'structured'

const LEGACY_STRUCTURED_MODES = new Set(['event', 'variable', 'table'])

export const normalizeMemoryMode = (value: unknown): MemoryMode => {
  if (value === 'long_text' || value === 'vector' || value === 'structured') return value
  if (LEGACY_STRUCTURED_MODES.has(String(value || ''))) return 'structured'
  // 旧版 narrative / subjective / hybrid 都会生成可读的记忆书；升级后默认保留为长文本模式。
  return 'long_text'
}

export interface MemoryEvidence {
  messageIds: Array<number | string>
  excerpt?: string
}

export interface MemoryEvent {
  id: string
  title: string
  summary: string
  startTime?: string
  endTime?: string
  participants: string[]
  location?: string
  result?: string
  decisions: string[]
  unresolved: string[]
  tags: string[]
  importance: number
  emotionBefore?: string
  emotionAfter?: string
  relationshipChange?: string
  evidence: MemoryEvidence
  createdAt: number
  updatedAt: number
  enabled: boolean
}

export interface MemoryVariable {
  id: string
  category: string
  key: string
  value: string
  previousValues: Array<{ value: string; replacedAt: number }>
  confidence: number
  firstSeenAt: number
  lastConfirmedAt: number
  validFrom?: string
  validTo?: string
  status: 'active' | 'superseded' | 'uncertain'
  locked: boolean
  evidence: MemoryEvidence
}

export interface MemoryTableRow {
  id: string
  table: 'people' | 'preferences' | 'events' | 'commitments' | 'gifts' | 'relationships' | 'timeline' | 'conflicts' | 'places'
  title: string
  value: string
  status: string
  time?: string
  tags: string[]
  importance: number
  evidence: MemoryEvidence
  createdAt: number
  updatedAt: number
}

export interface MemoryRelation {
  id: string
  source: string
  target: string
  relation: string
  startTime?: string
  endTime?: string
  status: 'active' | 'superseded' | 'uncertain'
  confidence: number
  evidence: MemoryEvidence
  createdAt: number
  updatedAt: number
}

export interface MemoryCoverage {
  fromMsgId: number
  toMsgId: number
  summarizedAt: number
  mode: MemoryMode
}

export interface StructuredMemoryState {
  version: 2
  events: MemoryEvent[]
  variables: MemoryVariable[]
  tableRows: MemoryTableRow[]
  relations: MemoryRelation[]
  coverage: MemoryCoverage[]
  lastConsolidatedAt: number
}

export interface MemoryExtractionResult {
  narrative: string
  subjective: string
  memberMemories: Record<string, string>
  vectorMemories: Array<{
    text: string
    importance?: number
    evidenceMessageIds?: Array<number | string>
  }>
  events: Array<Partial<MemoryEvent>>
  variables: Array<Partial<MemoryVariable>>
  tableRows: Array<Partial<MemoryTableRow>>
  relations: Array<Partial<MemoryRelation>>
}

interface VectorRecord {
  id: string
  chatId: string
  timelineId?: string
  sourceType: 'memory'
  sourceId: string
  text: string
  vector: number[]
  model: string
  dimensions: number
  createdAt: number
  updatedAt: number
  importance: number
  evidenceMessageIds: Array<number | string>
}

const vectorStore = localforage.createInstance({ name: 'nrt-app', storeName: 'memoryVectors' })

const timelineIdOf = (chat: any) => String(chat?.timelineState?.activeTimelineId || chat?.activeTimelineId || 'main')
const vectorScopeOf = (chat: any) => `${String(chat?.id)}::${timelineIdOf(chat)}`

const defaultState = (): StructuredMemoryState => ({
  version: 2,
  events: [],
  variables: [],
  tableRows: [],
  relations: [],
  coverage: [],
  lastConsolidatedAt: 0
})

export const ensureMemoryState = (chat: any): StructuredMemoryState => {
  if (!chat.memoryState || chat.memoryState.version !== 2) {
    const previous = chat.memoryState || {}
    chat.memoryState = {
      ...defaultState(),
      events: Array.isArray(previous.events) ? previous.events : [],
      variables: Array.isArray(previous.variables) ? previous.variables : [],
      tableRows: Array.isArray(previous.tableRows) ? previous.tableRows : [],
      relations: Array.isArray(previous.relations) ? previous.relations : [],
      coverage: Array.isArray(previous.coverage) ? previous.coverage : [],
      lastConsolidatedAt: previous.lastConsolidatedAt || 0
    }
  }
  if (!Array.isArray(chat.memoryState.events)) chat.memoryState.events = []
  if (!Array.isArray(chat.memoryState.variables)) chat.memoryState.variables = []
  if (!Array.isArray(chat.memoryState.tableRows)) chat.memoryState.tableRows = []
  if (!Array.isArray(chat.memoryState.relations)) chat.memoryState.relations = []
  if (!Array.isArray(chat.memoryState.coverage)) chat.memoryState.coverage = []
  if (!Array.isArray(chat.memoryBook)) chat.memoryBook = []

  // 兼容旧版单游标：只在没有新区间数据时迁移一次。
  if (chat.memoryState.coverage.length === 0 && chat.lastSummaryMsgId) {
    const valid = (chat.messages || []).filter(isMemoryMessage)
    const first = valid[0]?.id
    if (typeof first === 'number') {
      chat.memoryState.coverage.push({
        fromMsgId: first,
        toMsgId: Number(chat.lastSummaryMsgId),
        summarizedAt: Date.now(),
        mode: 'long_text'
      })
    }
  }
  return chat.memoryState
}

export const isMemoryMessage = (message: any) =>
  Boolean(message && (message.type === 'left' || message.type === 'right' || message.type === 'system' || message.type === 'narration'))

const isCovered = (id: number, coverage: MemoryCoverage[]) =>
  coverage.some(range => id >= range.fromMsgId && id <= range.toMsgId)

export const getUncoveredMessages = (chat: any) => {
  const state = ensureMemoryState(chat)
  return (chat.messages || []).filter((message: any) =>
    isMemoryMessage(message) &&
    message.isRecalled !== true &&
    message.isUndelivered !== true &&
    message.excludeFromGeneralMemory !== true &&
    typeof message.id === 'number' &&
    !isCovered(message.id, state.coverage)
  )
}

export const addCoverage = (chat: any, messages: any[], mode: MemoryMode) => {
  const state = ensureMemoryState(chat)
  const ids = messages.map(item => Number(item.id)).filter(Number.isFinite).sort((a, b) => a - b)
  if (ids.length === 0) return
  state.coverage.push({ fromMsgId: ids[0], toMsgId: ids[ids.length - 1], summarizedAt: Date.now(), mode })
  state.coverage.sort((a, b) => a.fromMsgId - b.fromMsgId)
  const merged: MemoryCoverage[] = []
  for (const current of state.coverage) {
    const previous = merged[merged.length - 1]
    if (previous && current.fromMsgId <= previous.toMsgId + 1) {
      previous.toMsgId = Math.max(previous.toMsgId, current.toMsgId)
      previous.summarizedAt = Math.max(previous.summarizedAt, current.summarizedAt)
    } else {
      merged.push({ ...current })
    }
  }
  state.coverage = merged
  chat.lastSummaryMsgId = Math.max(Number(chat.lastSummaryMsgId || 0), ids[ids.length - 1])
}

export const markMemoryCoverage = (chat: any, messages: any[], mode: MemoryMode = normalizeMemoryMode(chat?.memoryMode)) => {
  addCoverage(chat, messages, mode)
}

const safeId = (prefix: string, seed = '') => `${prefix}_${Date.now()}_${Math.abs(hashText(seed || Math.random().toString()))}`

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

const evidenceFrom = (value: any, fallbackIds: Array<number | string>): MemoryEvidence => ({
  messageIds: Array.isArray(value?.messageIds) && value.messageIds.length > 0 ? value.messageIds : fallbackIds,
  excerpt: typeof value?.excerpt === 'string' ? value.excerpt.slice(0, 240) : ''
})

export const applyMemoryExtraction = (
  chat: any,
  result: MemoryExtractionResult,
  sourceMessages: any[],
  mode: MemoryMode,
  options: { includeNarrative?: boolean; addCoverage?: boolean } = {}
) => {
  if (mode === 'vector') throw new Error('向量记忆必须通过向量写入流程保存')
  const state = ensureMemoryState(chat)
  const now = Date.now()
  const evidenceIds = sourceMessages.map(item => item.id).filter((id: any) => id !== undefined)

  const narrativeContent = result.narrative || result.subjective
  if (mode === 'long_text' && options.includeNarrative !== false && narrativeContent) {
    const content = narrativeContent
    chat.memoryBook.push({
      id: now,
      date: new Date().toLocaleDateString('zh-CN'),
      content,
      subjectiveContent: result.subjective || '',
      memoryMode: mode,
      messageCount: sourceMessages.length,
      fromMsgId: sourceMessages[0]?.id,
      toMsgId: sourceMessages[sourceMessages.length - 1]?.id,
      evidenceMessageIds: evidenceIds,
      version: 2,
      createdAt: now,
      updatedAt: now,
      enabled: true
    })
  }

  if (mode === 'long_text' && chat.chatType === 'group' && result.memberMemories && typeof result.memberMemories === 'object') {
    if (!chat.memberMemories || typeof chat.memberMemories !== 'object') chat.memberMemories = {}
    for (const [memberId, rawContent] of Object.entries(result.memberMemories)) {
      const content = String(rawContent || '').trim()
      if (!content || !Array.isArray(chat.memberIds) || !chat.memberIds.map(String).includes(String(memberId))) continue
      if (!Array.isArray(chat.memberMemories[memberId])) chat.memberMemories[memberId] = []
      chat.memberMemories[memberId].push({
        id: safeId(`member_${memberId}`, content), date: new Date().toLocaleDateString('zh-CN'), content,
        memoryMode: mode, messageCount: sourceMessages.length,
        fromMsgId: sourceMessages[0]?.id, toMsgId: sourceMessages[sourceMessages.length - 1]?.id,
        evidenceMessageIds: evidenceIds, sourceGroupId: chat.id, version: 2,
        createdAt: now, updatedAt: now, enabled: true
      })
    }
  }

  if (mode === 'structured') for (const raw of result.events || []) {
    if (!raw.title && !raw.summary) continue
    const title = String(raw.title || '未命名事件').slice(0, 80)
    const summary = String(raw.summary || '').slice(0, 800)
    const duplicate = state.events.find(item => item.title === title && item.summary === summary)
    if (duplicate) {
      duplicate.updatedAt = now
      duplicate.evidence = evidenceFrom(raw.evidence, evidenceIds)
      continue
    }
    state.events.push({
      id: String(raw.id || safeId('event', title + summary)),
      title,
      summary,
      startTime: raw.startTime || '', endTime: raw.endTime || '',
      participants: Array.isArray(raw.participants) ? raw.participants.map(String) : [],
      location: raw.location || '', result: raw.result || '',
      decisions: Array.isArray(raw.decisions) ? raw.decisions.map(String) : [],
      unresolved: Array.isArray(raw.unresolved) ? raw.unresolved.map(String) : [],
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      importance: clamp(raw.importance, 1, 5, 3),
      emotionBefore: raw.emotionBefore || '', emotionAfter: raw.emotionAfter || '',
      relationshipChange: raw.relationshipChange || '',
      evidence: evidenceFrom(raw.evidence, evidenceIds),
      createdAt: now, updatedAt: now, enabled: raw.enabled !== false
    })
  }

  if (mode === 'structured') for (const raw of result.variables || []) {
    const key = String(raw.key || '').trim()
    const value = String(raw.value || '').trim()
    if (!key || !value) continue
    const category = String(raw.category || '其他')
    const existing = state.variables.find(item => item.category === category && item.key === key && item.status === 'active')
    if (existing) {
      if (!existing.locked && existing.value !== value) {
        existing.previousValues = existing.previousValues || []
        existing.previousValues.push({ value: existing.value, replacedAt: now })
        existing.value = value
      }
      existing.lastConfirmedAt = now
      existing.confidence = clamp(raw.confidence, 0, 1, existing.confidence || 0.7)
      existing.evidence = evidenceFrom(raw.evidence, evidenceIds)
      existing.validFrom = raw.validFrom || existing.validFrom
      existing.validTo = raw.validTo || existing.validTo
    } else {
      state.variables.push({
        id: String(raw.id || safeId('variable', category + key)), category, key, value,
        previousValues: [], confidence: clamp(raw.confidence, 0, 1, 0.7),
        firstSeenAt: now, lastConfirmedAt: now,
        validFrom: raw.validFrom || '', validTo: raw.validTo || '',
        status: raw.status === 'uncertain' ? 'uncertain' : 'active',
        locked: Boolean(raw.locked), evidence: evidenceFrom(raw.evidence, evidenceIds)
      })
    }
  }

  const allowedTables = new Set(['people', 'preferences', 'events', 'commitments', 'gifts', 'relationships', 'timeline', 'conflicts', 'places'])
  if (mode === 'structured') for (const raw of result.tableRows || []) {
    const title = String(raw.title || '').trim()
    const value = String(raw.value || '').trim()
    if (!title || !value) continue
    const table = allowedTables.has(String(raw.table)) ? raw.table as MemoryTableRow['table'] : 'events'
    const existing = state.tableRows.find(item => item.table === table && item.title === title && item.status !== 'archived')
    if (existing) {
      existing.value = value
      existing.status = String(raw.status || existing.status || '有效')
      existing.time = raw.time || existing.time
      existing.tags = Array.isArray(raw.tags) ? raw.tags.map(String) : existing.tags
      existing.importance = clamp(raw.importance, 1, 5, existing.importance || 3)
      existing.evidence = evidenceFrom(raw.evidence, evidenceIds)
      existing.updatedAt = now
    } else {
      state.tableRows.push({
        id: String(raw.id || safeId('row', String(table) + title)), table, title, value,
        status: String(raw.status || '有效'), time: raw.time || '',
        tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
        importance: clamp(raw.importance, 1, 5, 3),
        evidence: evidenceFrom(raw.evidence, evidenceIds), createdAt: now, updatedAt: now
      })
    }
  }
  if (mode === 'structured') for (const raw of result.relations || []) {
    const source = String(raw.source || '').trim()
    const target = String(raw.target || '').trim()
    const relation = String(raw.relation || '').trim()
    if (!source || !target || !relation) continue
    const existing = state.relations.find(item => item.source === source && item.target === target && item.relation === relation && item.status === 'active')
    if (existing) {
      existing.startTime = raw.startTime || existing.startTime
      existing.endTime = raw.endTime || existing.endTime
      existing.confidence = clamp(raw.confidence, 0, 1, existing.confidence)
      existing.evidence = evidenceFrom(raw.evidence, evidenceIds)
      existing.updatedAt = now
    } else {
      state.relations.push({
        id: String(raw.id || safeId('relation', source + target + relation)), source, target, relation,
        startTime: raw.startTime || '', endTime: raw.endTime || '',
        status: raw.status === 'uncertain' ? 'uncertain' : 'active',
        confidence: clamp(raw.confidence, 0, 1, 0.75), evidence: evidenceFrom(raw.evidence, evidenceIds),
        createdAt: now, updatedAt: now
      })
    }
  }
  state.lastConsolidatedAt = now
  if (options.addCoverage !== false) addCoverage(chat, sourceMessages, mode)
}

const evidenceOverlaps = (evidence: MemoryEvidence | undefined, ids: Set<number | string>) =>
  Boolean(evidence?.messageIds?.some(id => ids.has(id) || ids.has(Number(id)) || ids.has(String(id))))

export const replaceStructuredMemoriesForEvidence = (
  chat: any,
  result: MemoryExtractionResult,
  sourceMessages: any[],
  mode: MemoryMode
) => {
  const state = ensureMemoryState(chat)
  const evidenceIds = new Set<number | string>(sourceMessages.flatMap(item =>
    Array.isArray(item?.evidenceMessageIds) ? item.evidenceMessageIds : []
  ))

  if (evidenceIds.size > 0) {
    state.events = state.events.filter(item => !evidenceOverlaps(item.evidence, evidenceIds))
    state.variables = state.variables.filter(item => !evidenceOverlaps(item.evidence, evidenceIds))
    state.tableRows = state.tableRows.filter(item => !evidenceOverlaps(item.evidence, evidenceIds))
    state.relations = state.relations.filter(item => !evidenceOverlaps(item.evidence, evidenceIds))
  }

  const evidenceMessages = sourceMessages.flatMap(item =>
    (item.evidenceMessageIds || []).map((id: number | string) => ({ id }))
  )
  applyMemoryExtraction(chat, result, evidenceMessages, mode, { includeNarrative: false, addCoverage: false })
}

export const formatMessagesForMemory = (messages: any[]) => messages.map(message => {
  const english = globalPromptSettings.language === 'en'
  const groupSpeaker = message.senderNameSnapshot || message.senderName || message.senderId
  const speaker = message.type === 'left'
    ? (groupSpeaker ? String(groupSpeaker) : (english ? 'Character' : '角色'))
    : message.type === 'right' ? (english ? 'User' : '用户') : (english ? 'System' : '系统')
  const marked = message.isMarked ? (english ? '[Important] ' : '【重要标记】') : ''
  const time = message.timestamp || message.time || ''
  const media = message.imageData?.summary ? ` [${english ? 'Image' : '图片'}: ${message.imageData.summary}]`
    : message.voiceData?.text ? ` [${english ? 'Voice' : '语音'}: ${message.voiceData.text}]`
      : message.emojiSummary ? ` [${english ? 'Sticker' : '表情'}: ${message.emojiSummary}]`
        : message.isCallRecord ? ` [${english ? 'Call record' : '通话记录'}: ${message.content || ''}]` : ''
  return `[${english ? 'Message ID' : '消息ID'}:${message.id}${time ? ` ${english ? 'Time' : '时间'}:${time}` : ''}] ${speaker}: ${marked}${String(message.content || '')}${media}`
}).join('\n')

export const buildExtractionPrompt = (
  messages: any[],
  mode: MemoryMode,
  customPrompt = '',
  groupContext?: { name?: string; members?: Array<{ id: string; name: string }> }
) => {
  const isEnglish = globalPromptSettings.language === 'en'
  const source = formatMessagesForMemory(messages)
  const members = (groupContext?.members || []).map(item => `${item.name}(ID:${item.id})`).join(isEnglish ? ', ' : '、')
  const common = isEnglish
    ? `Use only facts supported by the source conversation. Never invent missing facts. Preserve source message IDs. Output valid JSON only, without Markdown or explanation. Write memory text in the source conversation's language.${customPrompt ? `\nAdditional requirement: ${customPrompt}` : ''}`
    : `只能依据聊天原文建立记忆，不得补写原文不存在的事实。必须保留来源消息 ID。只输出合法 JSON，不要 Markdown、解释或思维过程。${customPrompt ? `\n用户补充要求：${customPrompt}` : ''}`

  if (mode === 'long_text') {
    const groupRule = groupContext
      ? (isEnglish
          ? `\nThis is group chat “${groupContext.name || 'Unnamed group'}”. Members: ${members}. Keep actual speakers in the objective narrative. Also return memberMemories keyed only by member ID. Each value is that member's first-person memory limited to what they personally experienced, heard, or were explicitly told.`
          : `\n这是群聊“${groupContext.name || '未命名群聊'}”。成员：${members}。客观长文本必须保留真实发言者。另返回 memberMemories，键只能是成员 ID，值为该成员第一人称记忆；只能记录其亲历、听见或被明确告知的内容。`)
      : ''
    return isEnglish
      ? `You write traditional long-form memory for an ongoing relationship. Produce one coherent objective narrative that preserves important events, chronology, promises, boundaries, emotional changes, relationship development, and unfinished matters. Do not output tables, vectors, event cards, variables, or relations.${groupRule}\n${common}\nJSON: {"narrative":"100–500 Chinese characters when the source is Chinese","memberMemories":{}}\n\nConversation:\n${source}`
      : `你负责生成传统长文本记忆。请写成一段连贯、可直接阅读的客观记忆，保留重要事件、先后顺序、承诺、边界、情绪变化、关系发展和未完成事项。不要输出表格、向量条目、事件卡、变量或关系图。${groupRule}\n${common}\nJSON：{"narrative":"100-500字长文本记忆","memberMemories":{}}\n\n聊天记录：\n${source}`
  }

  if (mode === 'vector') {
    return isEnglish
      ? `You prepare atomic memories for vector storage. Split the conversation into self-contained memory statements. Each statement must include the people or entities involved and enough context to make sense when retrieved alone. Preserve dates, changes, promises, boundaries, relationship developments, and unfinished matters. Do not output a narrative summary or tables.\n${common}\nJSON: {"vectorMemories":[{"text":"self-contained memory","importance":1,"evidenceMessageIds":[]}]}\n\nConversation:\n${source}`
      : `你负责生成向量记忆条目。把聊天拆成可以独立召回的原子记忆；每条必须写清涉及的人物或实体，并包含脱离上下文后仍能理解的必要背景。保留时间、变化、承诺、边界、关系发展和未完成事项。不要输出长文本总结或表格。\n${common}\nJSON：{"vectorMemories":[{"text":"可独立理解的记忆","importance":1,"evidenceMessageIds":[]}]}\n\n聊天记录：\n${source}`
  }

  return isEnglish
    ? `You maintain structured table memory. Extract only explicit, useful structured records. Current values supersede older values when the source clearly changes them. Keep uncertainty and evidence. Do not output a narrative summary or vector memories.\n${common}\nJSON: {"events":[{"title":"","summary":"","startTime":"","endTime":"","participants":[],"location":"","result":"","decisions":[],"unresolved":[],"tags":[],"importance":1,"emotionBefore":"","emotionAfter":"","relationshipChange":"","evidence":{"messageIds":[],"excerpt":""}}],"variables":[{"category":"identity/name/date/preference/boundary/habit/person/work/school/location/relationship/plan/promise/conflict/status/other","key":"","value":"","confidence":0.8,"validFrom":"","validTo":"","evidence":{"messageIds":[],"excerpt":""}}],"tableRows":[{"table":"people/preferences/events/commitments/gifts/relationships/timeline/conflicts/places","title":"","value":"","status":"active","time":"","tags":[],"importance":1,"evidence":{"messageIds":[],"excerpt":""}}],"relations":[{"source":"","target":"","relation":"","startTime":"","endTime":"","confidence":0.8,"evidence":{"messageIds":[],"excerpt":""}}]}\n\nConversation:\n${source}`
    : `你负责维护结构化表格记忆。只提取原文明确且有用的结构化记录；原文明确定义新状态时，新值覆盖旧状态。保留不确定性和证据。不要输出长文本总结或向量记忆。\n${common}\nJSON：{"events":[{"title":"","summary":"","startTime":"","endTime":"","participants":[],"location":"","result":"","decisions":[],"unresolved":[],"tags":[],"importance":1,"emotionBefore":"","emotionAfter":"","relationshipChange":"","evidence":{"messageIds":[],"excerpt":""}}],"variables":[{"category":"身份/称呼/日期/喜好/禁忌/习惯/人物/工作学校/位置/关系/计划/承诺/矛盾/状态/其他","key":"","value":"","confidence":0.8,"validFrom":"","validTo":"","evidence":{"messageIds":[],"excerpt":""}}],"tableRows":[{"table":"people/preferences/events/commitments/gifts/relationships/timeline/conflicts/places","title":"","value":"","status":"有效","time":"","tags":[],"importance":1,"evidence":{"messageIds":[],"excerpt":""}}],"relations":[{"source":"","target":"","relation":"","startTime":"","endTime":"","confidence":0.8,"evidence":{"messageIds":[],"excerpt":""}}]}\n\n聊天记录：\n${source}`
}

export const parseMemoryExtraction = (raw: string): MemoryExtractionResult => {
  const cleaned = String(raw || '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').replace(/\[incipere\][\s\S]*?\[finire\]/gi, '').trim()
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced || cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1)
  try {
    const parsed = JSON.parse(candidate)
    return {
      narrative: typeof parsed.narrative === 'string' ? parsed.narrative.trim() : '',
      subjective: typeof parsed.subjective === 'string' ? parsed.subjective.trim() : '',
      memberMemories: parsed.memberMemories && typeof parsed.memberMemories === 'object' && !Array.isArray(parsed.memberMemories) ? parsed.memberMemories : {},
      vectorMemories: Array.isArray(parsed.vectorMemories) ? parsed.vectorMemories : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      variables: Array.isArray(parsed.variables) ? parsed.variables : [],
      tableRows: Array.isArray(parsed.tableRows) ? parsed.tableRows : [],
      relations: Array.isArray(parsed.relations) ? parsed.relations : []
    }
  } catch {
    return { narrative: cleaned, subjective: '', memberMemories: {}, vectorMemories: [], events: [], variables: [], tableRows: [], relations: [] }
  }
}

const resolveEmbeddingEndpoint = () => {
  const base = (embeddingApiSettings.provider === 'custom' ? embeddingApiSettings.customUrl : embeddingApiSettings.url).replace(/\/+$/, '')
  if (base.endsWith('/embeddings')) return base
  return `${base}${base.includes('/v1') ? '' : '/v1'}/embeddings`
}

export const isEmbeddingReady = () => Boolean(
  embeddingApiSettings.enabled &&
  (embeddingApiSettings.provider === 'custom' ? embeddingApiSettings.customUrl : embeddingApiSettings.url) &&
  (embeddingApiSettings.provider === 'custom' ? embeddingApiSettings.customKey : embeddingApiSettings.key) &&
  embeddingApiSettings.model
)

export const createEmbeddings = async (texts: string[]): Promise<number[][]> => {
  if (!isEmbeddingReady() || texts.length === 0) return []
  const key = embeddingApiSettings.provider === 'custom' ? embeddingApiSettings.customKey : embeddingApiSettings.key
  const response = await fetch(resolveEmbeddingEndpoint(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: embeddingApiSettings.model, input: texts })
  })
  if (!response.ok) throw new Error(`Embedding 请求失败（HTTP ${response.status}）`)
  const data = await response.json()
  if (!Array.isArray(data?.data)) throw new Error('Embedding 接口未返回标准 data 数组')
  return data.data.sort((a: any, b: any) => a.index - b.index).map((item: any) => item.embedding)
}

export const assertEmbeddingReady = async () => {
  if (!isEmbeddingReady()) throw new Error('请先启用并完整配置向量节点')
  const [probe] = await createEmbeddings(['长期记忆向量节点连接测试'])
  if (!Array.isArray(probe) || probe.length === 0 || probe.some(value => !Number.isFinite(Number(value)))) {
    throw new Error('向量节点没有返回有效向量')
  }
  return probe.length
}

export const readChatVectorMemories = async (chatOrId: any) => {
  const records: VectorRecord[] = []
  const chatId = typeof chatOrId === 'object' ? vectorScopeOf(chatOrId) : String(chatOrId)
  const legacyChatId = typeof chatOrId === 'object' && timelineIdOf(chatOrId) === 'main' ? String(chatOrId.id) : ''
  await vectorStore.iterate<VectorRecord, void>((record) => {
    if ((record.chatId === chatId || (legacyChatId && record.chatId === legacyChatId)) && record.sourceType === 'memory') records.push(record)
  })
  return records.sort((left, right) => left.createdAt - right.createdAt)
}

export const writeVectorMemoryTexts = async (
  chat: any,
  items: Array<{ id?: string; text: string; importance?: number; evidenceMessageIds?: Array<number | string>; createdAt?: number }>,
  options: { replace?: boolean } = {}
) => {
  if (!isEmbeddingReady()) throw new Error('请先启用并完整配置向量节点')
  const valid = items.map(item => ({ ...item, text: String(item.text || '').trim() })).filter(item => item.text)
  if (!valid.length) throw new Error('没有可写入的向量记忆')
  const batchSize = Math.max(1, Math.min(100, Number(embeddingApiSettings.batchSize || 20)))
  const staged: VectorRecord[] = []
  for (let offset = 0; offset < valid.length; offset += batchSize) {
    const batch = valid.slice(offset, offset + batchSize)
    const vectors = await createEmbeddings(batch.map(item => item.text))
    if (vectors.length !== batch.length) throw new Error('向量节点返回数量与记忆条目不一致')
    batch.forEach((item, index) => {
      const vector = vectors[index]
      if (!Array.isArray(vector) || vector.length === 0) throw new Error('向量节点返回了无效条目')
      const sourceId = String(item.id || safeId('vector', item.text))
      staged.push({
        id: `${vectorScopeOf(chat)}:memory:${sourceId}`,
        chatId: vectorScopeOf(chat),
        timelineId: timelineIdOf(chat),
        sourceType: 'memory',
        sourceId,
        text: item.text,
        vector,
        model: embeddingApiSettings.model,
        dimensions: vector.length,
        createdAt: Number(item.createdAt || Date.now()),
        updatedAt: Date.now(),
        importance: clamp(item.importance, 1, 5, 3),
        evidenceMessageIds: Array.isArray(item.evidenceMessageIds) ? item.evidenceMessageIds : []
      })
    })
  }
  if (options.replace) await clearChatVectors(chat)
  await Promise.all(staged.map(record => vectorStore.setItem(record.id, record)))
  return { indexed: staged.length, skipped: false }
}

export const applyVectorExtraction = async (chat: any, result: MemoryExtractionResult, sourceMessages: any[]) => {
  const fallbackIds = sourceMessages.map(item => item.id).filter((id: any) => id !== undefined)
  const items = (result.vectorMemories || []).map(item => ({
    text: item.text,
    importance: item.importance,
    evidenceMessageIds: item.evidenceMessageIds?.length ? item.evidenceMessageIds : fallbackIds
  }))
  const written = await writeVectorMemoryTexts(chat, items)
  addCoverage(chat, sourceMessages, 'vector')
  return written
}

export const indexChatMemories = async (chat: any) => {
  if (normalizeMemoryMode(chat?.memoryMode) !== 'vector') return { indexed: 0, skipped: true }
  const records = await readChatVectorMemories(chat)
  if (!records.length) return { indexed: 0, skipped: false }
  return writeVectorMemoryTexts(chat, records.map(record => ({
    id: record.sourceId,
    text: record.text,
    importance: record.importance,
    evidenceMessageIds: record.evidenceMessageIds,
    createdAt: record.createdAt
  })), { replace: true })
}

const cosine = (a: number[], b: number[]) => {
  if (!a.length || a.length !== b.length) return 0
  let dot = 0, left = 0, right = 0
  for (let index = 0; index < a.length; index++) {
    dot += a[index] * b[index]
    left += a[index] * a[index]
    right += b[index] * b[index]
  }
  return left && right ? dot / Math.sqrt(left * right) : 0
}

const hashText = (text: string) => {
  let hash = 0
  for (let index = 0; index < text.length; index++) hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
  return hash
}

// 仅用于判断自动总结的主题边界，不参与任何记忆召回。
const terms = (text: string) => new Set(
  String(text || '').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []
)

const collectStructuredMemoryLines = (chat: any) => {
  const state = ensureMemoryState(chat)
  return [
    ...state.events.filter(item => item.enabled !== false).map(item => `[事件] ${item.title}：${item.summary}${item.unresolved.length ? `；未完成：${item.unresolved.join('、')}` : ''}`),
    ...state.variables.filter(item => item.status === 'active').map(item => `[资料] ${item.category}/${item.key}：${item.value}`),
    ...state.tableRows.filter(item => item.status !== 'archived').map(item => `[${item.table}] ${item.title}：${item.value}（${item.status}）`),
    ...state.relations.filter(item => item.status === 'active').map(item => `[关系] ${item.source} —${item.relation}→ ${item.target}`)
  ]
}

export const getMemoryExportItems = async (chat: any, mode: MemoryMode = normalizeMemoryMode(chat?.memoryMode)) => {
  if (mode === 'long_text') {
    return (chat.memoryBook || [])
      .filter((item: any) => item.enabled !== false && !item.archived && String(item.content || '').trim())
      .map((item: any) => ({
        id: String(item.id),
        text: String(item.content),
        evidenceMessageIds: Array.isArray(item.evidenceMessageIds) ? item.evidenceMessageIds : [],
        createdAt: Number(item.createdAt || item.id || Date.now()),
        importance: item.isMarked ? 5 : Number(item.memoryLevel || 1) > 1 ? 4 : 3
      }))
  }
  if (mode === 'vector') {
    return (await readChatVectorMemories(chat)).map(record => ({
      id: record.sourceId,
      text: record.text,
      evidenceMessageIds: record.evidenceMessageIds,
      createdAt: record.createdAt,
      importance: record.importance
    }))
  }
  return collectStructuredMemoryLines(chat).map((text, index) => ({
    id: `structured_${index}`,
    text,
    evidenceMessageIds: [],
    createdAt: Number(ensureMemoryState(chat).lastConsolidatedAt || Date.now()),
    importance: 4
  }))
}

export const resetStructuredMemory = (chat: any) => {
  const state = ensureMemoryState(chat)
  state.events = []
  state.variables = []
  state.tableRows = []
  state.relations = []
  state.lastConsolidatedAt = 0
  return state
}

export const replaceLongTextMemories = (chat: any, items: Array<{ text: string; evidenceMessageIds?: Array<number | string>; createdAt?: number }>) => {
  const now = Date.now()
  chat.memoryBook = items.map((item, index) => ({
    id: now + index,
    date: new Date(Number(item.createdAt || now)).toLocaleDateString('zh-CN'),
    content: String(item.text || '').trim(),
    evidenceMessageIds: Array.isArray(item.evidenceMessageIds) ? item.evidenceMessageIds : [],
    messageCount: Array.isArray(item.evidenceMessageIds) ? item.evidenceMessageIds.length : 0,
    memoryLevel: 1,
    memoryMode: 'long_text',
    version: 3,
    createdAt: Number(item.createdAt || now + index),
    updatedAt: now,
    enabled: true
  })).filter((item: any) => item.content)
  return chat.memoryBook.length
}

export const buildMemoryPacket = async (
  chat: any,
  query: string,
  tokenBudget?: number,
  options: { allowEmbedding?: boolean } = {}
) => {
  const mode = normalizeMemoryMode(chat?.memoryMode)
  const english = globalPromptSettings.language === 'en'
  if (mode === 'long_text') {
    const books = (chat.memoryBook || [])
      .filter((item: any) => item.enabled !== false && !item.archived && String(item.content || '').trim())
      .sort((left: any, right: any) => Number(left.fromMsgId || left.createdAt || left.id || 0) - Number(right.fromMsgId || right.createdAt || right.id || 0))
    if (!books.length) return ''
    const body = books.map((item: any, index: number) => `[${index + 1}] ${item.date || ''}\n${item.content}`).join('\n\n')
    return english
      ? `\n\n[Complete active long-form memory]\nUse every active memory below. If an older memory conflicts with a newer explicit statement, follow the newer statement.\n${body}`
      : `\n\n【全部启用的长文本记忆】\n以下为当前全部启用的记忆，必须整体参考；较新的明确说法与旧内容冲突时，以较新的为准。\n${body}`
  }
  if (mode === 'structured') {
    const lines = collectStructuredMemoryLines(chat)
    if (!lines.length) return ''
    return english
      ? `\n\n[Complete active structured memory]\n${lines.join('\n')}`
      : `\n\n【全部当前有效的结构化记忆】\n${lines.join('\n')}`
  }
  if (options.allowEmbedding === false) return ''
  if (!isEmbeddingReady()) throw new Error('当前使用向量记忆，但向量节点尚未完整配置')
  if (!query.trim()) return ''
  const [queryVector] = await createEmbeddings([query])
  if (!Array.isArray(queryVector)) throw new Error('向量节点没有返回查询向量')
  const records = (await readChatVectorMemories(chat))
    .filter(record => record.model === embeddingApiSettings.model && record.vector.length === queryVector.length)
    .map(record => ({ ...record, score: cosine(queryVector, record.vector) }))
    .sort((left, right) => right.score - left.score)
  if (!records.length) return ''
  const budget = Math.max(200, Number(tokenBudget || chat.memoryTokenBudget || 1200))
  const selected: VectorRecord[] = []
  let used = 0
  for (const record of records) {
    const size = estimateTextTokens(`- ${record.text}\n`)
    if (selected.length > 0 && used + size > budget) continue
    selected.push(record)
    used += size
    if (selected.length >= 16) break
  }
  return english
    ? `\n\n[Vector-recalled memory]\n${selected.map(item => `- ${item.text}`).join('\n')}`
    : `\n\n【向量记忆召回】\n${selected.map(item => `- ${item.text}`).join('\n')}`
}

export const invalidateMemoriesForMessages = (chat: any, messageIds: Array<number | string>) => {
  if (!chat || messageIds.length === 0) return { narratives: 0, structured: 0, memberMemories: 0 }
  const ids = new Set<number | string>(messageIds.flatMap(id => [id, String(id), Number(id)]))
  const overlaps = (values: any[] | undefined) => Boolean(values?.some(id => ids.has(id) || ids.has(String(id)) || ids.has(Number(id))))
  const state = ensureMemoryState(chat)
  const beforeStructured = state.events.length + state.variables.length + state.tableRows.length + state.relations.length
  state.events = state.events.filter(item => !overlaps(item.evidence?.messageIds))
  state.variables = state.variables.filter(item => !overlaps(item.evidence?.messageIds))
  state.tableRows = state.tableRows.filter(item => !overlaps(item.evidence?.messageIds))
  state.relations = state.relations.filter(item => !overlaps(item.evidence?.messageIds))
  state.coverage = state.coverage.filter(range => !messageIds.some(id => Number(id) >= range.fromMsgId && Number(id) <= range.toMsgId))

  const beforeNarratives = Array.isArray(chat.memoryBook) ? chat.memoryBook.length : 0
  const isUnverifiableLegacy = (item: any) => chat.chatType === 'group' && item?.version !== 2 && (!Array.isArray(item?.evidenceMessageIds) || item.evidenceMessageIds.length === 0)
  chat.memoryBook = (chat.memoryBook || []).filter((item: any) => !overlaps(item.evidenceMessageIds) && !isUnverifiableLegacy(item))
  let removedMemberMemories = 0
  if (chat.memberMemories && typeof chat.memberMemories === 'object') {
    for (const memberId of Object.keys(chat.memberMemories)) {
      const list = Array.isArray(chat.memberMemories[memberId]) ? chat.memberMemories[memberId] : []
      const next = list.filter((item: any) => !overlaps(item.evidenceMessageIds) && !isUnverifiableLegacy(item))
      removedMemberMemories += list.length - next.length
      chat.memberMemories[memberId] = next
    }
  }
  chat.lastSummaryMsgId = Math.max(0, ...state.coverage.map(range => range.toMsgId))
  return {
    narratives: beforeNarratives - chat.memoryBook.length,
    structured: beforeStructured - (state.events.length + state.variables.length + state.tableRows.length + state.relations.length),
    memberMemories: removedMemberMemories
  }
}

export const invalidateVectorMemoriesForMessages = async (chat: any, messageIds: Array<number | string>) => {
  if (!chat || messageIds.length === 0 || normalizeMemoryMode(chat.memoryMode) !== 'vector') return 0
  const ids = new Set(messageIds.flatMap(id => [id, String(id), Number(id)]))
  const keys: string[] = []
  await vectorStore.iterate<VectorRecord, void>((record, key) => {
    if (record.chatId !== vectorScopeOf(chat) && !(timelineIdOf(chat) === 'main' && record.chatId === String(chat.id))) return
    if (record.evidenceMessageIds?.some(id => ids.has(id) || ids.has(String(id)) || ids.has(Number(id)))) keys.push(key)
  })
  await Promise.all(keys.map(key => vectorStore.removeItem(key)))
  return keys.length
}

export const clearChatVectors = async (chatOrId: any) => {
  const keys: string[] = []
  const chatId = typeof chatOrId === 'object' ? vectorScopeOf(chatOrId) : String(chatOrId)
  const legacyChatId = typeof chatOrId === 'object' && timelineIdOf(chatOrId) === 'main' ? String(chatOrId.id) : ''
  await vectorStore.iterate<VectorRecord, void>((record, key) => {
    if (record.chatId === chatId || (legacyChatId && record.chatId === legacyChatId)) keys.push(key)
  })
  await Promise.all(keys.map(key => vectorStore.removeItem(key)))
  return keys.length
}

export const cloneTimelineVectors = async (
  chatId: string | number,
  sourceTimelineId: string,
  targetTimelineId: string,
  allowedMessageIds?: Set<string>
) => {
  const sourceScope = `${String(chatId)}::${sourceTimelineId}`
  const targetScope = `${String(chatId)}::${targetTimelineId}`
  const records: VectorRecord[] = []
  await vectorStore.iterate<VectorRecord, void>((record) => {
    if ((record.chatId !== sourceScope && !(sourceTimelineId === 'main' && record.chatId === String(chatId))) || record.sourceType !== 'memory') return
    if (allowedMessageIds && record.evidenceMessageIds?.some(id => !allowedMessageIds.has(String(id)))) return
    records.push(record)
  })
  await clearChatVectors({ id: chatId, timelineState: { activeTimelineId: targetTimelineId } })
  await Promise.all(records.map(record => {
    const cloned = {
      ...record,
      id: `${targetScope}:memory:${record.sourceId}`,
      chatId: targetScope,
      timelineId: targetTimelineId,
      updatedAt: Date.now()
    }
    return vectorStore.setItem(cloned.id, cloned)
  }))
  return records.length
}

export const removeTimelineVectors = async (chatId: string | number, timelineId: string) => (
  clearChatVectors({ id: chatId, timelineState: { activeTimelineId: timelineId } })
)

export const exportTimelineVectors = async (chatId: string | number, timelineId: string) => {
  const scope = `${String(chatId)}::${timelineId}`
  const records: VectorRecord[] = []
  await vectorStore.iterate<VectorRecord, void>(record => {
    if (record.chatId === scope || (timelineId === 'main' && record.chatId === String(chatId))) records.push(record)
  })
  return records
}

export const importTimelineVectors = async (chatId: string | number, timelineId: string, records: any[]) => {
  const scope = `${String(chatId)}::${timelineId}`
  await removeTimelineVectors(chatId, timelineId)
  await Promise.all((records || []).map((record: VectorRecord) => {
    const sourceId = String(record.sourceId || record.id || Math.random())
    const next = { ...record, id: `${scope}:memory:${sourceId}`, chatId: scope, timelineId, sourceId, updatedAt: Date.now() }
    return vectorStore.setItem(next.id, next)
  }))
}

export const estimateMessageTokens = (messages: any[]) => Math.ceil(formatMessagesForMemory(messages).length / 2)

export const detectTopicBoundary = (messages: any[]) => {
  if (messages.length < 12) return false
  const recentText = messages.slice(-3).map(item => item.content || '').join(' ')
  const previousText = messages.slice(-12, -3).map(item => item.content || '').join(' ')
  const recentTerms = terms(recentText)
  const previousTerms = terms(previousText)
  if (recentTerms.size < 3 || previousTerms.size < 6) return false
  let overlap = 0
  recentTerms.forEach(term => { if (previousTerms.has(term)) overlap++ })
  return overlap / recentTerms.size < 0.08
}
