import { McpError, mapHttpError, normalizeMcpError } from '../errors'

export const withTimeoutSignal = (timeoutMs: number, outer?: AbortSignal) => {
  const controller = new AbortController()
  const abort = () => controller.abort(outer?.reason)
  if (outer?.aborted) abort(); else outer?.addEventListener('abort', abort, { once: true })
  const timer = window.setTimeout(() => controller.abort(new Error('timeout')), timeoutMs)
  return { signal: controller.signal, release: () => { clearTimeout(timer); outer?.removeEventListener('abort', abort) } }
}

export const parseSseText = (text: string): Array<{ event: string; data: string; id?: string }> => text.replace(/\r\n/g, '\n').split('\n\n').map(chunk => {
  let event = 'message'; let data = ''; let id: string | undefined
  for (const line of chunk.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += `${data ? '\n' : ''}${line.slice(5).trimStart()}`
    else if (line.startsWith('id:')) id = line.slice(3).trim()
  }
  return { event, data, id }
}).filter(item => item.data)

export const parseRpcResponse = async (response: Response) => {
  if (!response.ok) throw mapHttpError(response.status, (await response.text().catch(() => '')).slice(0, 240))
  if (response.status === 202 || response.status === 204) return undefined
  const contentType = response.headers.get('content-type') || ''
  let data: any
  try {
    if (contentType.includes('text/event-stream')) {
      const events = parseSseText(await response.text())
      const message = [...events].reverse().find(item => item.event === 'message')
      data = message ? JSON.parse(message.data) : undefined
    } else data = await response.json()
  } catch (error) { throw new McpError('parse_error', 'MCP Server 返回了无法解析的 JSON/SSE 响应。', response.status, error) }
  if (data?.error) throw new McpError('server_error', String(data.error.message || 'MCP Server 返回错误。'), response.status, data.error)
  if (!data || data.jsonrpc !== '2.0') throw new McpError('protocol_mismatch', '响应不是有效的 JSON-RPC 2.0 MCP 消息。', response.status)
  return data.result
}

export const safeFetch = async (url: string, init: RequestInit, timeoutMs: number, outer?: AbortSignal) => {
  const timed = withTimeoutSignal(timeoutMs, outer)
  try { return await fetch(url, { ...init, signal: timed.signal }) }
  catch (error) {
    if (timed.signal.aborted && !outer?.aborted) throw new McpError('timeout', `请求超过 ${Math.round(timeoutMs / 1000)} 秒。`, undefined, error)
    throw normalizeMcpError(error, url)
  } finally { timed.release() }
}

