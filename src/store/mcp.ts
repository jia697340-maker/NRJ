/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'
import type { McpActivityRecord, McpConnection, McpSettings } from '../types/mcp'
import { readStoredJSON } from './utils'
import { isNativeMobileApp, setSecureValue } from '../services/mobileSecureStorage'

export const MCP_SETTINGS_KEY = 'clingy_mcp_settings'
export const MCP_ACTIVITY_KEY = 'clingy_mcp_activity_v3'
export const MCP_SETTINGS_EVENT = 'nrj:mcp-settings-changed'
export const MCP_ACTIVITY_EVENT = 'nrj:mcp-activity-changed'
const OBSOLETE_KEYS = ['clingy_mcp_jina_api_key', 'clingy_mcp_connections', 'clingy_mcp_activity', 'clingy_mcp_shared_life']

const id = () => globalThis.crypto?.randomUUID?.() || `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
export const defaultMcpSettings = (): McpSettings => ({
  schemaVersion: 3,
  enabled: false,
  connections: [],
  limits: { maxCallsPerTurn: 8, maxTotalTimeMs: 60000, maxConcurrentCalls: 3, maxResultCharacters: 30000 }
})

export const createMcpConnection = (value: Partial<McpConnection> = {}): McpConnection => {
  const now = Date.now()
  return {
    id: value.id || id(), name: value.name || '我的 MCP', description: value.description || '', enabled: value.enabled ?? true,
    url: value.url || '', transport: value.transport || 'auto', resolvedTransport: value.resolvedTransport,
    auth: value.auth || { type: 'none' }, serverName: value.serverName, serverVersion: value.serverVersion,
    protocolVersion: value.protocolVersion, capabilities: value.capabilities || {},
    discoveredTools: Array.isArray(value.discoveredTools) ? value.discoveredTools : [],
    discoveredResources: Array.isArray(value.discoveredResources) ? value.discoveredResources : [],
    discoveredPrompts: Array.isArray(value.discoveredPrompts) ? value.discoveredPrompts : [],
    defaultToolPolicy: value.defaultToolPolicy || 'model', categoryPolicies: value.categoryPolicies || {},
    toolPolicies: value.toolPolicies || {}, toolDescriptionOverrides: value.toolDescriptionOverrides || {},
    allowedCharacterIds: Array.isArray(value.allowedCharacterIds) ? value.allowedCharacterIds.map(String) : undefined,
    timeoutMs: Math.max(1000, Number(value.timeoutMs) || 15000), priority: Number(value.priority) || 0,
    fallbackEnabled: value.fallbackEnabled ?? false, status: value.status || 'never-tested',
    lastErrorCode: value.lastErrorCode, lastErrorMessage: value.lastErrorMessage, latencyMs: value.latencyMs,
    createdAt: Number(value.createdAt) || now, updatedAt: Number(value.updatedAt) || now, lastConnectedAt: value.lastConnectedAt
  }
}

const normalize = (raw: unknown): McpSettings => {
  if (!raw || typeof raw !== 'object' || (raw as any).schemaVersion !== 3) return defaultMcpSettings()
  const value = raw as Partial<McpSettings>
  const defaults = defaultMcpSettings()
  return {
    ...defaults, ...value, schemaVersion: 3,
    connections: Array.isArray(value.connections) ? value.connections.map(item => createMcpConnection(item)) : [],
    limits: { ...defaults.limits, ...(value.limits || {}) }
  }
}

// 旧豆瓣/Jina 授权不迁入通用 MCP；迁移幂等，并避免损坏的旧对象使页面崩溃。
const initial = normalize(readStoredJSON<unknown>(MCP_SETTINGS_KEY, null))
for (const key of OBSOLETE_KEYS) localStorage.removeItem(key)
if (isNativeMobileApp()) void setSecureValue('clingy_mcp_jina_api_key', '')
export const mcpSettings = reactive<McpSettings>(initial)
export const mcpActivities = reactive<McpActivityRecord[]>(readStoredJSON<McpActivityRecord[]>(MCP_ACTIVITY_KEY, []).slice(0, 200))

watch(mcpSettings, value => {
  localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(value))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(MCP_SETTINGS_EVENT))
}, { deep: true })
watch(mcpActivities, value => {
  localStorage.setItem(MCP_ACTIVITY_KEY, JSON.stringify(value.slice(0, 200)))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(MCP_ACTIVITY_EVENT))
}, { deep: true })

export const addMcpConnection = (value: Partial<McpConnection>) => {
  const connection = createMcpConnection(value)
  mcpSettings.connections.push(connection)
  return connection
}
export const updateMcpConnection = (connectionId: string, patch: Partial<McpConnection>) => {
  const connection = mcpSettings.connections.find(item => item.id === connectionId)
  if (!connection) throw new Error('MCP 连接不存在。')
  Object.assign(connection, patch, { id: connection.id, updatedAt: Date.now() })
  return connection
}
export const removeMcpConnection = (connectionId: string) => {
  const index = mcpSettings.connections.findIndex(item => item.id === connectionId)
  if (index < 0) return false
  mcpSettings.connections.splice(index, 1)
  return true
}
export const duplicateMcpConnection = (connectionId: string) => {
  const source = mcpSettings.connections.find(item => item.id === connectionId)
  if (!source) throw new Error('MCP 连接不存在。')
  const copied = JSON.parse(JSON.stringify(source))
  if (copied.auth?.type === 'bearer') copied.auth.secretRef = id()
  if (copied.auth?.type === 'api-key') copied.auth.secretRef = id()
  if (copied.auth?.type === 'custom-headers') copied.auth.headers = copied.auth.headers.map((item: any) => ({ ...item, secretRef: id() }))
  return addMcpConnection({ ...copied, id: undefined, name: `${source.name} 副本`, status: 'never-tested', lastConnectedAt: undefined })
}
export const appendMcpActivity = (record: McpActivityRecord) => { mcpActivities.unshift(record); if (mcpActivities.length > 200) mcpActivities.splice(200) }
export const clearMcpActivities = () => { mcpActivities.splice(0) }
export const resetMcpSettings = () => Object.assign(mcpSettings, defaultMcpSettings())
