/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type McpConnectionKind = 'remote' | 'local'
export type McpConnectionStatus = 'idle' | 'checking' | 'ready' | 'error'
export type McpToolRisk = 'read' | 'write' | 'external' | 'sensitive'

export interface McpToolRecord {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  enabled: boolean
  risk: McpToolRisk
}

export interface McpConnectionRecord {
  id: string
  presetId?: string
  kind: McpConnectionKind
  name: string
  description: string
  url: string
  token: string
  enabled: boolean
  status: McpConnectionStatus
  statusText: string
  protocolVersion?: string
  serverName?: string
  tools: McpToolRecord[]
  createdAt: number
  updatedAt: number
}

export interface McpActivityRecord {
  id: string
  connectionId: string
  connectionName: string
  toolName: string
  summary: string
  status: 'success' | 'denied' | 'error'
  createdAt: number
  durationMs?: number
}

export interface McpModelTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpModelToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface McpToolExecutionResult {
  content: string
  isError?: boolean
}

