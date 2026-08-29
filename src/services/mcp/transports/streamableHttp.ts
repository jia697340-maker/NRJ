import type { McpTransportClient } from './types'
import { parseRpcResponse, safeFetch } from './shared'

export class StreamableHttpTransport implements McpTransportClient {
  readonly kind = 'streamable-http' as const
  private requestId = 0
  private sessionId = ''
  private protocolVersion = ''
  private url: string
  private headers: Record<string, string>
  private timeoutMs: number
  private signal?: AbortSignal
  constructor(url: string, headers: Record<string, string>, timeoutMs: number, signal?: AbortSignal) { this.url = url; this.headers = headers; this.timeoutMs = timeoutMs; this.signal = signal }
  async connect() { new URL(this.url); }
  setProtocolVersion(value: string) { this.protocolVersion = value }
  private async send(payload: unknown) {
    const response = await safeFetch(this.url, {
      method: 'POST', headers: {
        ...this.headers, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
        ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {}),
        ...(this.protocolVersion ? { 'MCP-Protocol-Version': this.protocolVersion } : {})
      }, body: JSON.stringify(payload)
    }, this.timeoutMs, this.signal)
    this.sessionId = response.headers.get('Mcp-Session-Id') || this.sessionId
    return parseRpcResponse(response)
  }
  request(method: string, params?: unknown) { return this.send({ jsonrpc: '2.0', id: ++this.requestId, method, ...(params === undefined ? {} : { params }) }) }
  async notify(method: string, params?: unknown) { await this.send({ jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) }) }
  async close() {
    if (!this.sessionId) return
    try { await safeFetch(this.url, { method: 'DELETE', headers: { ...this.headers, 'Mcp-Session-Id': this.sessionId, ...(this.protocolVersion ? { 'MCP-Protocol-Version': this.protocolVersion } : {}) } }, Math.min(this.timeoutMs, 5000), this.signal) } catch {}
    this.sessionId = ''
  }
}
