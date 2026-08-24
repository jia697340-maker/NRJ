/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { McpConnectionRecord, McpToolExecutionResult, McpToolRecord, McpToolRisk } from '../types/mcp'

const CLIENT_INFO = { name: 'nianrenjin-web', version: '1.0.0' }
const REQUEST_TIMEOUT = 25_000

interface McpSession {
  sessionId?: string
  protocolVersion: string
  requestId: number
}

const sessions = new Map<string, McpSession>()

const privateHost = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return host === 'localhost' || host === '0.0.0.0' || host === '::1' || host.endsWith('.local') ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
}

export const validateMcpUrl = (raw: string) => {
  let parsed: URL
  try { parsed = new URL(raw.trim()) } catch { throw new Error('请输入完整的 MCP 地址。') }
  if (parsed.protocol !== 'https:') throw new Error('移动端连接只允许使用 HTTPS 地址。')
  if (privateHost(parsed.hostname)) throw new Error('为保护设备安全，不能连接本机或局域网地址。')
  parsed.hash = ''
  return parsed.toString()
}

const parseSse = (text: string) => {
  const messages: any[] = []
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
    if (!data || data === '[DONE]') continue
    try { messages.push(JSON.parse(data)) } catch { /* 忽略心跳或非 JSON 事件 */ }
  }
  return messages
}

const responsePayload = async (response: Response) => {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('text/event-stream')) {
    const events = parseSse(await response.text())
    return events.find(item => item?.id !== undefined) || events.at(-1) || {}
  }
  return response.json().catch(() => ({}))
}

const requestHeaders = (connection: Pick<McpConnectionRecord, 'token'>, session?: McpSession) => ({
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
  ...(connection.token.trim() ? { Authorization: `Bearer ${connection.token.trim()}` } : {}),
  // 无状态托管服务常只放行常规 CORS 请求头；有会话时再按协议同时发送这两个头。
  ...(session?.sessionId ? { 'Mcp-Session-Id': session.sessionId, 'MCP-Protocol-Version': session.protocolVersion } : {})
})

const post = async (connection: McpConnectionRecord, body: any, session?: McpSession, signal?: AbortSignal) => {
  const timeout = new AbortController()
  const timer = window.setTimeout(() => timeout.abort(), REQUEST_TIMEOUT)
  const onAbort = () => timeout.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const response = await fetch(validateMcpUrl(connection.url), {
      method: 'POST',
      headers: requestHeaders(connection, session),
      body: JSON.stringify(body),
      signal: timeout.signal
    })
    if (response.status === 401) throw new Error('连接需要有效的访问密钥。')
    if (response.status === 403) throw new Error('服务拒绝了当前网页来源或权限不足。')
    if (!response.ok && response.status !== 202) throw new Error(`MCP 服务响应异常（${response.status}）。`)
    return { response, payload: response.status === 202 ? {} : await responsePayload(response) }
  } catch (error: any) {
    if (signal?.aborted) throw error
    if (error?.name === 'AbortError') throw new Error('MCP 服务连接超时。')
    if (/Failed to fetch|NetworkError/i.test(String(error?.message))) throw new Error('网页无法直连该服务，可能未开放 CORS。')
    throw error
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

const inferRisk = (name: string, description: string): McpToolRisk => {
  const text = `${name} ${description}`.toLowerCase()
  if (/(password|token|cookie|credential|login|qrcode|payment|pay|purchase|checkout|transfer|address|phone)/.test(text)) return 'sensitive'
  if (/(publish|post|send|comment|reply|like|follow|delete|remove|update|edit|create|write|order|cancel|download)/.test(text)) return 'external'
  return 'read'
}

export const connectMcpServer = async (connection: McpConnectionRecord, signal?: AbortSignal) => {
  const initialSession: McpSession = { protocolVersion: '2025-11-25', requestId: 1 }
  const initialized = await post(connection, {
    jsonrpc: '2.0', id: initialSession.requestId++, method: 'initialize',
    params: { protocolVersion: initialSession.protocolVersion, capabilities: {}, clientInfo: CLIENT_INFO }
  }, undefined, signal)
  if (initialized.payload?.error) throw new Error(initialized.payload.error.message || 'MCP 初始化失败。')
  const result = initialized.payload?.result || {}
  initialSession.protocolVersion = String(result.protocolVersion || initialSession.protocolVersion)
  initialSession.sessionId = initialized.response.headers.get('Mcp-Session-Id') || undefined
  sessions.set(connection.id, initialSession)

  await post(connection, { jsonrpc: '2.0', method: 'notifications/initialized' }, initialSession, signal)
  const listed = await post(connection, { jsonrpc: '2.0', id: initialSession.requestId++, method: 'tools/list', params: {} }, initialSession, signal)
  if (listed.payload?.error) throw new Error(listed.payload.error.message || '读取工具列表失败。')
  const previous = new Map(connection.tools.map(tool => [tool.name, tool]))
  const tools: McpToolRecord[] = (Array.isArray(listed.payload?.result?.tools) ? listed.payload.result.tools : []).map((tool: any) => {
    const name = String(tool?.name || '').trim()
    const description = String(tool?.description || '').trim().slice(0, 1200)
    return {
      name,
      description,
      inputSchema: tool?.inputSchema && typeof tool.inputSchema === 'object' ? tool.inputSchema : { type: 'object', properties: {} },
      // 工具首次出现或描述结构发生变化时不自动授权。
      enabled: previous.has(name) && JSON.stringify(previous.get(name)?.inputSchema) === JSON.stringify(tool?.inputSchema || { type: 'object', properties: {} })
        ? previous.get(name)!.enabled
        : false,
      risk: inferRisk(name, description)
    }
  }).filter((tool: McpToolRecord) => tool.name)
  return {
    tools,
    protocolVersion: initialSession.protocolVersion,
    serverName: String(result.serverInfo?.title || result.serverInfo?.name || connection.name)
  }
}

export const callMcpRemoteTool = async (connection: McpConnectionRecord, name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<McpToolExecutionResult> => {
  let session = sessions.get(connection.id)
  if (!session) {
    await connectMcpServer(connection, signal)
    session = sessions.get(connection.id)
  }
  if (!session) throw new Error('MCP 会话创建失败。')
  const called = await post(connection, {
    jsonrpc: '2.0', id: session.requestId++, method: 'tools/call', params: { name, arguments: args }
  }, session, signal)
  if (called.payload?.error) throw new Error(called.payload.error.message || '工具调用失败。')
  const result = called.payload?.result || {}
  const parts = Array.isArray(result.content) ? result.content : []
  const content = parts.map((part: any) => part?.type === 'text' ? String(part.text || '') : part?.type === 'resource' ? JSON.stringify(part.resource || {}) : `[${part?.type || '内容'}]`).filter(Boolean).join('\n')
  return { content: content || JSON.stringify(result), isError: result.isError === true }
}

export const disconnectMcpServer = (connectionId: string) => sessions.delete(connectionId)
