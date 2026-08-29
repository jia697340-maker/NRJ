export interface McpTransportClient {
  readonly kind: 'streamable-http' | 'sse'
  connect(): Promise<void>
  request(method: string, params?: unknown): Promise<any>
  notify(method: string, params?: unknown): Promise<void>
  close(): Promise<void>
}

