import { McpError, mapHttpError, normalizeMcpError } from '../errors'
import type { McpTransportClient } from './types'

interface Pending { resolve: (value: any) => void; reject: (reason: any) => void; timer: number }
export class SseTransport implements McpTransportClient {
  readonly kind = 'sse' as const
  private requestId = 0
  private endpoint = ''
  private controller = new AbortController()
  private pending = new Map<number, Pending>()
  private connectPromise?: Promise<void>
  private url: string
  private headers: Record<string, string>
  private timeoutMs: number
  private outerSignal?: AbortSignal
  constructor(url: string, headers: Record<string, string>, timeoutMs: number, outerSignal?: AbortSignal) { this.url = url; this.headers = headers; this.timeoutMs = timeoutMs; this.outerSignal = outerSignal }
  connect() {
    if (this.connectPromise) return this.connectPromise
    this.connectPromise = this.openStream()
    return this.connectPromise
  }
  private async openStream() {
    const timer = window.setTimeout(() => this.controller.abort(new Error('timeout')), this.timeoutMs)
    const abort = () => this.controller.abort(this.outerSignal?.reason)
    this.outerSignal?.addEventListener('abort', abort, { once: true })
    try {
      const response = await fetch(this.url, { method: 'GET', headers: { ...this.headers, Accept: 'text/event-stream' }, signal: this.controller.signal })
      if (!response.ok) throw mapHttpError(response.status)
      if (!response.body || !(response.headers.get('content-type') || '').includes('text/event-stream')) throw new McpError('invalid_endpoint', '该地址没有返回旧版 MCP SSE 事件流。')
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      while (true) {
        const { value, done } = await reader.read(); if (done) break
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) {
          const chunk = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2); this.consumeEvent(chunk)
          if (this.endpoint) clearTimeout(timer)
          boundary = buffer.indexOf('\n\n')
        }
        if (this.endpoint) return void this.continueReading(reader, decoder, buffer)
      }
      throw new McpError('invalid_endpoint', 'SSE 连接在返回 endpoint 事件前已关闭。')
    } catch (error) {
      if (this.controller.signal.aborted && !this.outerSignal?.aborted) throw new McpError('timeout', `SSE 连接超过 ${Math.round(this.timeoutMs / 1000)} 秒。`)
      throw normalizeMcpError(error, this.url)
    } finally { clearTimeout(timer) }
  }
  private async continueReading(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder, initial: string) {
    let buffer = initial
    try {
      while (!this.controller.signal.aborted) {
        const { value, done } = await reader.read(); if (done) break
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) { this.consumeEvent(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); boundary = buffer.indexOf('\n\n') }
      }
    } catch (error) { if (!this.controller.signal.aborted) this.rejectAll(normalizeMcpError(error, this.url)) }
  }
  private consumeEvent(chunk: string) {
    let event = 'message'; let data = ''
    for (const line of chunk.split('\n')) { if (line.startsWith('event:')) event = line.slice(6).trim(); else if (line.startsWith('data:')) data += `${data ? '\n' : ''}${line.slice(5).trimStart()}` }
    if (event === 'endpoint' && data) { this.endpoint = new URL(data, this.url).href; return }
    if (event !== 'message' || !data) return
    try {
      const message = JSON.parse(data); const pending = this.pending.get(Number(message.id)); if (!pending) return
      clearTimeout(pending.timer); this.pending.delete(Number(message.id)); message.error ? pending.reject(new McpError('server_error', String(message.error.message || 'MCP Server 返回错误。'))) : pending.resolve(message.result)
    } catch {}
  }
  async request(method: string, params?: unknown) {
    await this.connect(); const id = ++this.requestId
    const result = new Promise<any>((resolve, reject) => {
      const timer = window.setTimeout(() => { this.pending.delete(id); reject(new McpError('timeout', `MCP 请求超过 ${Math.round(this.timeoutMs / 1000)} 秒。`)) }, this.timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
    })
    const response = await fetch(this.endpoint, { method: 'POST', headers: { ...this.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) }), signal: this.outerSignal })
    if (!response.ok) { const pending = this.pending.get(id); if (pending) { clearTimeout(pending.timer); this.pending.delete(id); pending.reject(mapHttpError(response.status)) } }
    return result
  }
  async notify(method: string, params?: unknown) {
    await this.connect(); const response = await fetch(this.endpoint, { method: 'POST', headers: { ...this.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) }), signal: this.outerSignal })
    if (!response.ok) throw mapHttpError(response.status)
  }
  private rejectAll(error: unknown) { for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error) }; this.pending.clear() }
  async close() { this.controller.abort(); this.rejectAll(new McpError('cancelled', 'SSE 连接已关闭。')); this.endpoint = ''; this.connectPromise = undefined }
}
