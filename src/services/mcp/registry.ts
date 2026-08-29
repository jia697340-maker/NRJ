import { mcpSettings } from '../../store/mcp'
import type { McpConnection, McpExecutionContext, McpModelTool, McpToolPolicy } from '../../types/mcp'

const safeName = (value: string) => value.normalize('NFKD').replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'tool'
const shortHash = (value: string) => { let hash = 2166136261; for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619); return (hash >>> 0).toString(36).slice(0, 6) }
export const modelToolName = (connectionId: string, remoteName: string) => `mcp__${safeName(connectionId).slice(0, 16)}_${shortHash(connectionId)}__${safeName(remoteName).slice(0, 24)}_${shortHash(remoteName)}`.slice(0, 64)
export const connectionAllowsContext = (connection: McpConnection, context: McpExecutionContext = {}) => {
  if (!connection.allowedCharacterIds?.length) return true
  return Boolean(context.characterIds?.some(id => connection.allowedCharacterIds!.includes(String(id))))
}
export const resolveToolPolicy = (connection: McpConnection, toolName: string): McpToolPolicy => {
  const tool = connection.discoveredTools.find(item => item.name === toolName)
  return connection.toolPolicies[toolName] || (tool?.category ? connection.categoryPolicies[tool.category] : undefined) || connection.defaultToolPolicy
}
export const getAvailableMcpTools = (context: McpExecutionContext = {}): McpModelTool[] => {
  if (!mcpSettings.enabled) return []
  return [...mcpSettings.connections].sort((a, b) => b.priority - a.priority).flatMap(connection => {
    if (!connection.enabled || !connectionAllowsContext(connection, context)) return []
    return connection.discoveredTools.filter(tool => tool.available !== false && resolveToolPolicy(connection, tool.name) !== 'disabled').map(tool => ({
      name: modelToolName(connection.id, tool.name),
      description: `[来源：${connection.name}] ${tool.description || tool.name}${resolveToolPolicy(connection, tool.name) === 'model' ? '\n请仅在当前用户请求确实需要此工具时调用。' : ''}${connection.toolDescriptionOverrides[tool.name] ? `\n补充说明：${connection.toolDescriptionOverrides[tool.name]}` : ''}`,
      inputSchema: tool.inputSchema || { type: 'object', properties: {} }
    }))
  })
}
export const resolveModelTool = (name: string) => {
  for (const connection of mcpSettings.connections) for (const tool of connection.discoveredTools) if (modelToolName(connection.id, tool.name) === name) return { connection, tool }
  return undefined
}
