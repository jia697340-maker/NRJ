/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { appendMcpActivity, mcpSettings } from '../store/mcp'
import type { McpExecutionContext, McpModelTool, McpToolExecutionResult } from '../types/mcp'
import { McpClient } from './mcp/client'
import { McpError, normalizeMcpError } from './mcp/errors'
import { hasChatMcpGrant, requestMcpConfirmation } from './mcp/permissions'
import { connectionAllowsContext, getAvailableMcpTools, resolveModelTool, resolveToolPolicy } from './mcp/registry'
import { normalizeMcpResult } from './mcp/resultSanitizer'
import { getMcpAuthSecretValues, redactObject } from './mcp/auth'

const clients = new Map<string, McpClient>()
const id = () => globalThis.crypto?.randomUUID?.() || `mcp_exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
export const getEnabledMcpTools = (context: McpExecutionContext = {}): McpModelTool[] => getAvailableMcpTools(context)
export const closeMcpConnectionRuntime = async (connectionId: string) => { await clients.get(connectionId)?.close().catch(() => {}); clients.delete(connectionId) }
export const closeAllMcpRuntimes = async () => { await Promise.all([...clients.values()].map(client => client.close().catch(() => {}))); clients.clear() }

const getClient = (connectionId: string, context: McpExecutionContext) => {
  let client = clients.get(connectionId)
  const connection = mcpSettings.connections.find(item => item.id === connectionId)
  if (!connection) throw new McpError('tool_not_found', 'MCP 连接已被删除。')
  if (!client) { client = new McpClient(connection, context.signal); clients.set(connectionId, client) }
  return client
}

export const executeMcpModelTool = async (modelName: string, args: Record<string, unknown>, contextOrSignal?: McpExecutionContext | AbortSignal): Promise<McpToolExecutionResult> => {
  const context: McpExecutionContext = contextOrSignal instanceof AbortSignal ? { signal: contextOrSignal } : (contextOrSignal || {})
  const executionId = id(); const startedAt = Date.now(); const resolved = resolveModelTool(modelName)
  if (!resolved) throw new McpError('tool_not_found', '模型请求的 MCP 工具不存在或连接已删除。')
  const { connection, tool } = resolved
  let activityStatus: 'success' | 'error' | 'cancelled' | 'denied' = 'success'; let errorCode: any; let errorMessage = ''; let resultSize = 0; let knownSecrets: string[] = []
  try {
    if (!mcpSettings.enabled || !connection.enabled || tool.available === false) throw new McpError('tool_disabled', '该 MCP 工具当前未启用或已不可用。')
    if (!connectionAllowsContext(connection, context)) throw new McpError('permission_denied', '当前角色没有使用此 MCP 连接的权限。')
    const policy = resolveToolPolicy(connection, tool.name)
    if (policy === 'disabled') throw new McpError('tool_disabled', '该 MCP 工具已被禁止。')
    if (policy === 'confirm' && !hasChatMcpGrant(context.chatId, connection.id, tool.name)) {
      const allowed = await requestMcpConfirmation({
        id: id(), executionId, connectionId: connection.id, connectionName: connection.name, toolName: tool.name,
        characterName: context.characterName, chatId: context.chatId, arguments: args, createdAt: Date.now()
      }, context.signal)
      if (!allowed) { activityStatus = 'denied'; throw new McpError('permission_denied', '用户拒绝了本次工具调用。') }
    }
    knownSecrets = await getMcpAuthSecretValues(connection.auth)
    let raw: any
    try { raw = await getClient(connection.id, context).callTool(tool.name, args) }
    catch (firstError) {
      await closeMcpConnectionRuntime(connection.id)
      raw = await getClient(connection.id, context).callTool(tool.name, args).catch(() => { throw firstError })
    }
    const normalized = normalizeMcpResult(raw, mcpSettings.limits.maxResultCharacters, knownSecrets)
    resultSize = normalized.originalSize
    return { content: normalized.content, isError: normalized.isError }
  } catch (error) {
    const normalized = normalizeMcpError(error, connection.url); errorCode = normalized.code; errorMessage = normalized.message
    if (normalized.code === 'cancelled') activityStatus = 'cancelled'; else if (activityStatus !== 'denied') activityStatus = 'error'
    return { content: JSON.stringify({ source: 'mcp', connection: connection.name, tool: tool.name, status: 'unavailable', errorCode: normalized.code, reason: normalized.message }), isError: true }
  } finally {
    const completedAt = Date.now()
    appendMcpActivity({
      id: id(), executionId, connectionId: connection.id, connectionName: connection.name, toolName: tool.name,
      startedAt, completedAt, durationMs: completedAt - startedAt, chatId: context.chatId, characterIds: context.characterIds,
      arguments: redactObject(args, knownSecrets), resultSize, status: activityStatus, errorCode, errorMessage: errorMessage || undefined
    })
  }
}
