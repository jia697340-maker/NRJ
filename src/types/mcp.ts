/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type McpTransport = 'auto' | 'streamable-http' | 'sse'
export type McpToolPolicy = 'auto' | 'model' | 'confirm' | 'disabled'
export type McpSecretPersistence = 'session' | 'device'
export type McpConnectionStatus = 'never-tested' | 'connecting' | 'connected' | 'disconnected' | 'error'
export type McpErrorCode =
  | 'network' | 'cors' | 'timeout' | 'unauthorized' | 'forbidden' | 'not_found'
  | 'invalid_endpoint' | 'protocol_mismatch' | 'initialize_failed' | 'tools_list_failed'
  | 'tool_not_found' | 'tool_disabled' | 'permission_denied' | 'tool_call_failed'
  | 'server_error' | 'parse_error' | 'cancelled' | 'unknown'

export interface McpSecretHeaderDefinition { name: string; secretRef: string }
export type McpAuth =
  | { type: 'none' }
  | { type: 'bearer'; secretRef: string; persistence?: McpSecretPersistence }
  | { type: 'api-key'; header: string; secretRef: string; persistence?: McpSecretPersistence }
  | { type: 'custom-headers'; headers: McpSecretHeaderDefinition[]; persistence?: McpSecretPersistence }
  | { type: 'oauth'; accountId?: string; status?: 'not-configured' | 'ready' | 'expired' }

export interface McpRemoteTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: Record<string, unknown>
  category?: string
  available?: boolean
  lastSeenAt?: number
}
export interface McpRemoteResource { uri: string; name: string; description?: string; mimeType?: string }
export interface McpRemotePrompt { name: string; description?: string; arguments?: Array<{ name: string; description?: string; required?: boolean }> }

export interface McpConnection {
  id: string
  name: string
  description?: string
  enabled: boolean
  url: string
  transport: McpTransport
  resolvedTransport?: Exclude<McpTransport, 'auto'>
  auth: McpAuth
  serverName?: string
  serverVersion?: string
  protocolVersion?: string
  capabilities?: Record<string, unknown>
  discoveredTools: McpRemoteTool[]
  discoveredResources: McpRemoteResource[]
  discoveredPrompts: McpRemotePrompt[]
  defaultToolPolicy: McpToolPolicy
  categoryPolicies: Record<string, McpToolPolicy>
  toolPolicies: Record<string, McpToolPolicy>
  toolDescriptionOverrides: Record<string, string>
  allowedCharacterIds?: string[]
  timeoutMs: number
  priority: number
  fallbackEnabled: boolean
  status: McpConnectionStatus
  lastErrorCode?: McpErrorCode
  lastErrorMessage?: string
  latencyMs?: number
  createdAt: number
  updatedAt: number
  lastConnectedAt?: number
}

export interface McpRuntimeLimits { maxCallsPerTurn: number; maxTotalTimeMs: number; maxConcurrentCalls: number; maxResultCharacters: number }
export interface McpSettings { schemaVersion: 3; enabled: boolean; connections: McpConnection[]; limits: McpRuntimeLimits }
export interface McpModelTool { name: string; description: string; inputSchema: Record<string, unknown> }
export interface McpModelToolCall { id: string; name: string; arguments: Record<string, unknown> }
export interface McpToolExecutionResult { content: string; isError?: boolean }
export interface McpExecutionContext { chatId?: string; characterIds?: string[]; characterName?: string; signal?: AbortSignal }

export interface McpActivityRecord {
  id: string
  executionId: string
  connectionId: string
  connectionName: string
  toolName: string
  startedAt: number
  completedAt: number
  durationMs: number
  chatId?: string
  characterIds?: string[]
  arguments: Record<string, unknown>
  resultSize: number
  status: 'success' | 'error' | 'cancelled' | 'denied'
  errorCode?: McpErrorCode
  errorMessage?: string
}
export interface McpConnectionTestResult { ok: boolean; connection: McpConnection; checks: Array<{ id: string; label: string; ok: boolean; message?: string }> }
export interface McpImportResult {
  kind: 'remote' | 'stdio'
  connections: Array<Partial<McpConnection> & Pick<McpConnection, 'name' | 'url' | 'transport' | 'auth'>>
  message?: string
}
export interface McpConfirmationRequest {
  id: string
  executionId: string
  connectionId: string
  connectionName: string
  toolName: string
  characterName?: string
  chatId?: string
  arguments: Record<string, unknown>
  createdAt: number
}
