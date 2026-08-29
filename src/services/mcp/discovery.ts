import type { McpConnection, McpConnectionTestResult, McpRemoteTool } from '../../types/mcp'
import { createMcpConnection } from '../../store/mcp'
import { McpClient } from './client'
import { normalizeMcpError } from './errors'

const dangerPattern = /delete|remove|destroy|drop|send|publish|post|write|update|edit|create|execute|run|pay|transfer|message|email|上传|删除|发送|发布|修改|创建|支付|转账/i
export const classifyMcpTool = (tool: McpRemoteTool) => dangerPattern.test(`${tool.name} ${tool.description}`) ? 'write' : /search|find|list|read|get|fetch|query|查看|读取|搜索|查询/i.test(`${tool.name} ${tool.description}`) ? 'read' : 'other'

export const discoverMcpConnection = async (source: McpConnection, signal?: AbortSignal): Promise<McpConnectionTestResult> => {
  const connection = createMcpConnection(source); const checks: McpConnectionTestResult['checks'] = []
  const startedAt = performance.now(); let client: McpClient | undefined
  try {
    const parsed = new URL(connection.url)
    if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) throw new Error('浏览器/PWA 只能直连 HTTPS Remote MCP；本机开发地址除外。')
    checks.push({ id: 'url', label: 'URL 格式与 HTTPS', ok: true })
    client = new McpClient(connection, signal); await client.connect()
    const initialized = await client.initialize(); checks.push({ id: 'initialize', label: 'MCP initialize', ok: true })
    const previous = new Map(connection.discoveredTools.map(item => [item.name, item]))
    const listed = await client.listTools(); checks.push({ id: 'tools', label: 'tools/list', ok: true, message: `发现 ${listed.length} 个工具` })
    const seen = new Set(listed.map(item => item.name))
    connection.discoveredTools = [
      ...listed.map(item => ({ ...item, category: previous.get(item.name)?.category || classifyMcpTool(item) })),
      ...connection.discoveredTools.filter(item => !seen.has(item.name)).map(item => ({ ...item, available: false }))
    ]
    for (const tool of listed) if (!connection.toolPolicies[tool.name] && classifyMcpTool(tool) === 'write') connection.toolPolicies[tool.name] = 'confirm'
    connection.discoveredResources = await client.listResources()
    connection.discoveredPrompts = await client.listPrompts()
    connection.serverName = initialized.serverInfo?.name || connection.serverName
    connection.serverVersion = initialized.serverInfo?.version || connection.serverVersion
    connection.protocolVersion = initialized.protocolVersion
    connection.capabilities = initialized.capabilities || {}
    connection.resolvedTransport = client.resolvedTransport
    connection.status = 'connected'; connection.lastConnectedAt = Date.now(); connection.latencyMs = Math.round(performance.now() - startedAt)
    connection.lastErrorCode = undefined; connection.lastErrorMessage = undefined; connection.updatedAt = Date.now()
    checks.push({ id: 'protocol', label: '协议兼容', ok: true, message: connection.protocolVersion })
    return { ok: true, connection, checks }
  } catch (error) {
    const normalized = normalizeMcpError(error, connection.url)
    connection.status = 'error'; connection.lastErrorCode = normalized.code; connection.lastErrorMessage = normalized.message; connection.latencyMs = Math.round(performance.now() - startedAt)
    checks.push({ id: normalized.code, label: '连接失败', ok: false, message: normalized.message })
    return { ok: false, connection, checks }
  } finally { await client?.close().catch(() => {}) }
}

