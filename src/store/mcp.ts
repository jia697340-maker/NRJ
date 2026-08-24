/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'
import type { McpActivityRecord, McpConnectionRecord } from '../types/mcp'
import { readStoredJSON } from './utils'

const SETTINGS_KEY = 'clingy_mcp_settings'
const CONNECTIONS_KEY = 'clingy_mcp_connections'
const ACTIVITY_KEY = 'clingy_mcp_activity'

const storedSettings = readStoredJSON<{ enabled?: boolean }>(SETTINGS_KEY, {})
const storedConnections = readStoredJSON<McpConnectionRecord[]>(CONNECTIONS_KEY, [])
const storedActivity = readStoredJSON<McpActivityRecord[]>(ACTIVITY_KEY, [])

export const mcpSettings = reactive({
  // MCP 永远由用户主动开启；没有历史设置时必须保持关闭。
  enabled: storedSettings.enabled === true
})

export const mcpConnections = reactive<McpConnectionRecord[]>(Array.isArray(storedConnections) ? storedConnections.map(item => ({
  ...item,
  enabled: item.enabled === true,
  status: 'idle',
  statusText: item.enabled ? '等待连接' : '未启用',
  token: String(item.token || ''),
  tools: Array.isArray(item.tools) ? item.tools.map(tool => ({ ...tool, enabled: tool.enabled === true })) : []
})) : [])

export const mcpActivity = reactive<McpActivityRecord[]>(Array.isArray(storedActivity) ? storedActivity.slice(0, 80) : [])

watch(mcpSettings, value => localStorage.setItem(SETTINGS_KEY, JSON.stringify(value)), { deep: true })
watch(mcpConnections, value => localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(value)), { deep: true })
watch(mcpActivity, value => localStorage.setItem(ACTIVITY_KEY, JSON.stringify(value.slice(0, 80))), { deep: true })

export const upsertMcpConnection = (connection: McpConnectionRecord) => {
  const index = mcpConnections.findIndex(item => item.id === connection.id)
  if (index >= 0) mcpConnections.splice(index, 1, connection)
  else mcpConnections.unshift(connection)
}

export const removeMcpConnection = (id: string) => {
  const index = mcpConnections.findIndex(item => item.id === id)
  if (index >= 0) mcpConnections.splice(index, 1)
}

export const addMcpActivity = (activity: Omit<McpActivityRecord, 'id' | 'createdAt'>) => {
  mcpActivity.unshift({ ...activity, id: `mcp_activity_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now() })
  if (mcpActivity.length > 80) mcpActivity.splice(80)
}

export const clearMcpActivity = () => mcpActivity.splice(0)

