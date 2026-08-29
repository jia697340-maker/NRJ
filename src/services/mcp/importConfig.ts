import type { McpAuth, McpImportResult, McpTransport } from '../../types/mcp'

const authWithoutSecret = (raw: any): McpAuth => {
  const type = raw?.type
  if (type === 'bearer') return { type, secretRef: '' }
  if (type === 'api-key') return { type, header: String(raw.header || 'X-API-Key'), secretRef: '' }
  if (type === 'custom-headers') return { type, headers: (raw.headers || []).map((item: any) => ({ name: String(item.name || ''), secretRef: '' })) }
  if (type === 'oauth') return { type, status: 'not-configured' }
  return { type: 'none' }
}
const remote = (name: string, value: any) => ({
  name, description: String(value.description || ''), url: String(value.url || value.endpoint || value.serverUrl || ''),
  transport: (['auto', 'streamable-http', 'sse'].includes(value.transport) ? value.transport : 'auto') as McpTransport,
  auth: authWithoutSecret(value.auth), defaultToolPolicy: value.defaultToolPolicy,
  toolPolicies: value.toolPolicies && typeof value.toolPolicies === 'object' ? value.toolPolicies : {},
  toolDescriptionOverrides: value.toolDescriptionOverrides && typeof value.toolDescriptionOverrides === 'object' ? value.toolDescriptionOverrides : {},
  timeoutMs: Number(value.timeoutMs) || undefined, priority: Number(value.priority) || 0, fallbackEnabled: Boolean(value.fallbackEnabled)
})
export const importMcpConfig = (input: string | object): McpImportResult => {
  const raw = typeof input === 'string' ? JSON.parse(input) : input as any
  if (!raw || typeof raw !== 'object') throw new Error('配置必须是 JSON 对象。')
  if (raw.command || raw.args) return { kind: 'stdio', connections: [], message: '这是本地 stdio MCP。浏览器/PWA 无法启动本地进程，请先使用本地 Host / Bridge 转换为可访问的 HTTP/SSE 地址。' }
  if (raw.mcpServers && typeof raw.mcpServers === 'object') {
    const entries = Object.entries(raw.mcpServers)
    const stdio = entries.filter(([, value]: any) => value?.command)
    const connections = entries.filter(([, value]: any) => !value?.command && (value?.url || value?.endpoint || value?.serverUrl)).map(([name, value]) => remote(name, value))
    if (!connections.length && stdio.length) return { kind: 'stdio', connections: [], message: `识别到 ${stdio.length} 个本地 stdio MCP。网页无法直连，请使用 Host / Bridge 提供 Remote MCP 地址。` }
    return { kind: 'remote', connections, message: stdio.length ? `另有 ${stdio.length} 个 stdio MCP 未导入；它们需要 Host / Bridge。` : undefined }
  }
  const values = Array.isArray(raw.connections) ? raw.connections : [raw]
  const connections = values.filter((item: any) => item?.url || item?.endpoint || item?.serverUrl).map((item: any, index: number) => remote(String(item.name || `导入的 MCP ${index + 1}`), item))
  if (!connections.length) throw new Error('配置中没有 Remote MCP 地址。')
  return { kind: 'remote', connections }
}
export const exportMcpConnection = (connection: any) => JSON.stringify({
  schemaVersion: 3, name: connection.name, description: connection.description || '', url: connection.url,
  transport: connection.transport, auth: authWithoutSecret(connection.auth), defaultToolPolicy: connection.defaultToolPolicy,
  toolPolicies: connection.toolPolicies, toolDescriptionOverrides: connection.toolDescriptionOverrides
}, null, 2)
