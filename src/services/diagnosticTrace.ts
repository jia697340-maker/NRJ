/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'

export const DIAGNOSTIC_SETTINGS_KEY = 'clingy_diagnostic_settings_v1'
export const DIAGNOSTIC_UPDATED_EVENT = 'clingy-diagnostics-updated'
const DIAGNOSTIC_INDEX_KEY = 'clingy_diagnostic_index_v1'

export interface DiagnosticSettings {
  enabled: boolean
  maxRecords: number
}

export interface DiagnosticContextMeta {
  chatId?: string | number
  chatName?: string
  worldBookEntries?: string[]
  memoryEntries?: string[]
}

export interface DiagnosticMessage {
  role: string
  content: string
  characters: number
  estimatedTokens: number
  hasMedia: boolean
}

export interface DiagnosticTrace {
  id: string
  createdAt: number
  completedAt: number
  status: 'success' | 'error' | 'aborted'
  type: string
  purpose: string
  chatId?: string | number
  chatName?: string
  provider: string
  model: string
  adapter: string
  stream: boolean
  duration: number
  tokens?: number
  estimatedTokens: number
  responseCharacters: number
  stopReason?: string
  truncated?: boolean
  errorMessage?: string
  response?: string
  thinking?: string
  messages: DiagnosticMessage[]
  worldBookEntries: string[]
  memoryEntries: string[]
  requestOptions: {
    temperature?: number
    maxTokens?: number
    topP?: number
    frequencyPenalty?: number
    presencePenalty?: number
  }
}

export interface DiagnosticDraft {
  id: string
  createdAt: number
  type: string
  purpose: string
  chatId?: string | number
  chatName?: string
  provider: string
  model: string
  adapter: string
  stream: boolean
  messages: DiagnosticMessage[]
  worldBookEntries: string[]
  memoryEntries: string[]
  requestOptions: DiagnosticTrace['requestOptions']
}

const DEFAULT_SETTINGS: DiagnosticSettings = { enabled: false, maxRecords: 50 }
const MIN_RECORDS = 1
const MAX_RECORDS = 500
const traceStore = localforage.createInstance({ name: 'clingy_app', storeName: 'diagnostic_traces' })

const clampRecordCount = (value: unknown) => {
  const parsed = Math.round(Number(value))
  if (!Number.isFinite(parsed)) return DEFAULT_SETTINGS.maxRecords
  return Math.min(MAX_RECORDS, Math.max(MIN_RECORDS, parsed))
}

export const getDiagnosticSettings = (): DiagnosticSettings => {
  try {
    const raw = localStorage.getItem(DIAGNOSTIC_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw)
    return {
      enabled: parsed?.enabled === true,
      maxRecords: clampRecordCount(parsed?.maxRecords)
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export const saveDiagnosticSettings = (settings: DiagnosticSettings) => {
  const normalized = { enabled: settings.enabled === true, maxRecords: clampRecordCount(settings.maxRecords) }
  localStorage.setItem(DIAGNOSTIC_SETTINGS_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent(DIAGNOSTIC_UPDATED_EVENT, { detail: { kind: 'settings' } }))
  return normalized
}

const estimateTokens = (text: string) => Math.max(0, Math.ceil(text.length * 1.2))

const redactText = (value: string) => value
  .replace(/\b(sk|key|token|bearer)[-_][a-z0-9_-]{12,}\b/gi, '[已脱敏]')
  .replace(/([?&](?:key|api_key|apikey|token)=)[^&\s]+/gi, '$1[已脱敏]')

const normalizeContent = (content: unknown): { text: string; hasMedia: boolean } => {
  if (typeof content === 'string') return { text: redactText(content), hasMedia: false }
  if (!Array.isArray(content)) return { text: redactText(String(content ?? '')), hasMedia: false }

  let hasMedia = false
  const parts = content.map((item: any) => {
    if (item?.type === 'text') return redactText(String(item.text || ''))
    if (item?.type === 'image_url' || item?.image_url || item?.inline_data || item?.inlineData) {
      hasMedia = true
      return '[图像内容已省略]'
    }
    hasMedia = true
    return `[${String(item?.type || '媒体')}内容已省略]`
  })
  return { text: parts.join('\n'), hasMedia }
}

const normalizeMessages = (messages: Array<{ role: string; content: unknown }>): DiagnosticMessage[] =>
  messages.map(message => {
    const normalized = normalizeContent(message.content)
    return {
      role: message.role || 'unknown',
      content: normalized.text,
      characters: normalized.text.length,
      estimatedTokens: estimateTokens(normalized.text) + 4,
      hasMedia: normalized.hasMedia
    }
  })

const uniqueLabels = (items?: string[]) => [...new Set((items || []).map(item => String(item).trim()).filter(Boolean))].slice(0, 200)

const readTraceIndex = (): Array<{ id: string; createdAt: number }> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DIAGNOSTIC_INDEX_KEY) || '[]')
    return Array.isArray(parsed)
      ? parsed.filter(item => typeof item?.id === 'string' && Number.isFinite(item?.createdAt))
      : []
  } catch {
    return []
  }
}

const writeTraceIndex = (index: Array<{ id: string; createdAt: number }>) => {
  localStorage.setItem(DIAGNOSTIC_INDEX_KEY, JSON.stringify(index.slice(0, MAX_RECORDS)))
}

export const createDiagnosticDraft = (input: {
  messages: Array<{ role: string; content: unknown }>
  type: string
  purpose: string
  provider: string
  model: string
  adapter: string
  stream: boolean
  context?: DiagnosticContextMeta
  requestOptions?: DiagnosticTrace['requestOptions']
}): DiagnosticDraft | null => {
  // 关闭时只读取一个很小的 localStorage 设置值，不创建快照、不克隆上下文、不访问 IndexedDB。
  if (!getDiagnosticSettings().enabled) return null
  const messages = normalizeMessages(input.messages)
  return {
    id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
    type: input.type,
    purpose: input.purpose,
    chatId: input.context?.chatId,
    chatName: input.context?.chatName,
    provider: input.provider,
    model: input.model,
    adapter: input.adapter,
    stream: input.stream,
    messages,
    worldBookEntries: uniqueLabels(input.context?.worldBookEntries),
    memoryEntries: uniqueLabels(input.context?.memoryEntries),
    requestOptions: input.requestOptions || {}
  }
}

const trimTraces = async (limit: number) => {
  let index = readTraceIndex()
  // 仅在索引缺失（例如旧版本迁移）时扫描一次数据库；日常写入不会遍历历史快照。
  if (index.length === 0) {
    await traceStore.iterate((value: DiagnosticTrace) => {
      if (value?.id) index.push({ id: value.id, createdAt: value.createdAt || 0 })
    })
  }
  index.sort((a, b) => b.createdAt - a.createdAt)
  const overflow = index.slice(limit)
  if (overflow.length) await Promise.all(overflow.map(item => traceStore.removeItem(item.id)))
  writeTraceIndex(index.slice(0, limit))
}

export const commitDiagnosticTrace = async (
  draft: DiagnosticDraft | null,
  outcome: {
    status: DiagnosticTrace['status']
    response?: string
    thinking?: string
    tokens?: number
    stopReason?: string
    truncated?: boolean
    errorMessage?: string
  }
) => {
  if (!draft) return
  // 用户可能在请求过程中关闭记录；此时也不把进行中的快照写入数据库。
  const settings = getDiagnosticSettings()
  if (!settings.enabled) return
  const completedAt = Date.now()
  const response = redactText(String(outcome.response || ''))
  const thinking = redactText(String(outcome.thinking || ''))
  const trace: DiagnosticTrace = {
    ...draft,
    completedAt,
    status: outcome.status,
    duration: completedAt - draft.createdAt,
    tokens: outcome.tokens,
    estimatedTokens: draft.messages.reduce((sum, item) => sum + item.estimatedTokens, 0),
    responseCharacters: response.length,
    response: response || undefined,
    thinking: thinking || undefined,
    stopReason: outcome.stopReason,
    truncated: outcome.truncated,
    errorMessage: outcome.errorMessage ? redactText(String(outcome.errorMessage)) : undefined
  }
  await traceStore.setItem(trace.id, trace)
  const nextIndex = [
    { id: trace.id, createdAt: trace.createdAt },
    ...readTraceIndex().filter(item => item.id !== trace.id)
  ].sort((a, b) => b.createdAt - a.createdAt)
  const overflow = nextIndex.slice(settings.maxRecords)
  if (overflow.length) await Promise.all(overflow.map(item => traceStore.removeItem(item.id)))
  writeTraceIndex(nextIndex.slice(0, settings.maxRecords))
  window.dispatchEvent(new CustomEvent(DIAGNOSTIC_UPDATED_EVENT, { detail: { kind: 'trace', id: trace.id } }))
}

export const listDiagnosticTraces = async (): Promise<DiagnosticTrace[]> => {
  const traces: DiagnosticTrace[] = []
  await traceStore.iterate((value: DiagnosticTrace) => {
    if (value?.id) traces.push(value)
  })
  traces.sort((a, b) => b.createdAt - a.createdAt)
  writeTraceIndex(traces.map(item => ({ id: item.id, createdAt: item.createdAt || 0 })))
  return traces
}

export const clearDiagnosticTraces = async () => {
  await traceStore.clear()
  localStorage.removeItem(DIAGNOSTIC_INDEX_KEY)
  window.dispatchEvent(new CustomEvent(DIAGNOSTIC_UPDATED_EVENT, { detail: { kind: 'clear' } }))
}

export const deleteDiagnosticTrace = async (id: string) => {
  await traceStore.removeItem(id)
  writeTraceIndex(readTraceIndex().filter(item => item.id !== id))
  window.dispatchEvent(new CustomEvent(DIAGNOSTIC_UPDATED_EVENT, { detail: { kind: 'delete', id } }))
}

export const enforceDiagnosticRetention = async () => {
  const settings = getDiagnosticSettings()
  await trimTraces(settings.maxRecords)
}
