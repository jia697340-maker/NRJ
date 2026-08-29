import type { McpConnection, McpRemotePrompt, McpRemoteResource, McpRemoteTool } from '../../types/mcp'
import { buildMcpHeaders } from './auth'
import { McpError, normalizeMcpError } from './errors'
import { SseTransport } from './transports/sse'
import { StreamableHttpTransport } from './transports/streamableHttp'
import type { McpTransportClient } from './transports/types'

const CLIENT_INFO = { name: 'NRJ', version: '1.0.0' }
const PREFERRED_PROTOCOL = '2025-11-25'

export class McpClient {
  private transport?: McpTransportClient
  private initialized = false
  serverInfo?: { name?: string; version?: string }
  protocolVersion = ''
  capabilities: Record<string, unknown> = {}
  resolvedTransport?: 'streamable-http' | 'sse'
  private connection: McpConnection
  private signal?: AbortSignal
  constructor(connection: McpConnection, signal?: AbortSignal) { this.connection = connection; this.signal = signal }

  private async transportFor(kind: 'streamable-http' | 'sse') {
    const headers = await buildMcpHeaders(this.connection.auth)
    return kind === 'sse'
      ? new SseTransport(this.connection.url, headers, this.connection.timeoutMs, this.signal)
      : new StreamableHttpTransport(this.connection.url, headers, this.connection.timeoutMs, this.signal)
  }
  async connect() {
    if (this.transport) return
    const requested = this.connection.transport
    if (requested !== 'auto') {
      this.transport = await this.transportFor(requested)
      await this.transport.connect(); this.resolvedTransport = requested; return
    }
    const http = await this.transportFor('streamable-http')
    try {
      await http.connect(); this.transport = http; this.resolvedTransport = 'streamable-http'
      await this.initialize(); return
    } catch (error) {
      await http.close().catch(() => {})
      const normalized = normalizeMcpError(error, this.connection.url)
      if (!['not_found', 'invalid_endpoint', 'protocol_mismatch', 'parse_error'].includes(normalized.code)) throw normalized
      this.initialized = false
      const sse = await this.transportFor('sse'); await sse.connect(); this.transport = sse; this.resolvedTransport = 'sse'
    }
  }
  async initialize() {
    if (this.initialized) return { serverInfo: this.serverInfo, protocolVersion: this.protocolVersion, capabilities: this.capabilities }
    if (!this.transport) await this.connect()
    if (this.initialized) return { serverInfo: this.serverInfo, protocolVersion: this.protocolVersion, capabilities: this.capabilities }
    let result: any
    try {
      result = await this.transport!.request('initialize', {
        protocolVersion: PREFERRED_PROTOCOL,
        capabilities: {}, clientInfo: CLIENT_INFO
      })
    } catch (error) {
      const normalized = normalizeMcpError(error, this.connection.url)
      if (['protocol_mismatch', 'unauthorized', 'forbidden', 'not_found', 'cors', 'network', 'timeout', 'cancelled'].includes(normalized.code)) throw normalized
      throw new McpError('initialize_failed', `MCP initialize 失败：${normalized.message}`, normalized.status, error)
    }
    if (!result?.protocolVersion || !result?.serverInfo) throw new McpError('protocol_mismatch', 'initialize 响应缺少 protocolVersion 或 serverInfo。')
    this.protocolVersion = String(result.protocolVersion)
    this.serverInfo = result.serverInfo
    this.capabilities = result.capabilities || {}
    if (this.transport instanceof StreamableHttpTransport) this.transport.setProtocolVersion(this.protocolVersion)
    await this.transport!.notify('notifications/initialized')
    this.initialized = true
    return result
  }
  async listTools(): Promise<McpRemoteTool[]> {
    await this.initialize()
    try {
      const collected: McpRemoteTool[] = []; let cursor: string | undefined
      do {
        const result = await this.transport!.request('tools/list', cursor ? { cursor } : {})
        for (const tool of result?.tools || []) if (tool?.name) collected.push({
          name: String(tool.name), description: String(tool.description || ''), inputSchema: tool.inputSchema || { type: 'object', properties: {} },
          annotations: tool.annotations, available: true, lastSeenAt: Date.now()
        })
        cursor = result?.nextCursor
      } while (cursor)
      return collected
    } catch (error) { const normalized = normalizeMcpError(error, this.connection.url); if (['unauthorized', 'forbidden', 'not_found', 'cors', 'network', 'timeout', 'cancelled'].includes(normalized.code)) throw normalized; throw new McpError('tools_list_failed', `tools/list 失败：${normalized.message}`, normalized.status, error) }
  }
  async listResources(): Promise<McpRemoteResource[]> {
    await this.initialize(); if (!this.capabilities.resources) return []
    try { const result = await this.transport!.request('resources/list', {}); return (result?.resources || []).map((item: any) => ({ uri: String(item.uri), name: String(item.name || item.uri), description: item.description, mimeType: item.mimeType })) } catch { return [] }
  }
  async listPrompts(): Promise<McpRemotePrompt[]> {
    await this.initialize(); if (!this.capabilities.prompts) return []
    try { const result = await this.transport!.request('prompts/list', {}); return (result?.prompts || []).map((item: any) => ({ name: String(item.name), description: item.description, arguments: item.arguments })) } catch { return [] }
  }
  async callTool(name: string, args: Record<string, unknown>) {
    await this.initialize()
    try { return await this.transport!.request('tools/call', { name, arguments: args || {} }) }
    catch (error) { const normalized = normalizeMcpError(error, this.connection.url); if (['unauthorized', 'forbidden', 'not_found', 'cors', 'network', 'timeout', 'cancelled'].includes(normalized.code)) throw normalized; throw new McpError('tool_call_failed', `tools/call 失败：${normalized.message}`, normalized.status, error) }
  }
  async close() { await this.transport?.close(); this.transport = undefined; this.initialized = false }
}
