import type { McpErrorCode } from '../../types/mcp'

export class McpError extends Error {
  code: McpErrorCode
  status?: number
  override cause?: unknown
  constructor(code: McpErrorCode, message: string, status?: number, cause?: unknown) {
    super(message); this.name = 'McpError'; this.code = code; this.status = status; this.cause = cause
  }
}

export const mapHttpError = (status: number, detail = ''): McpError => {
  if (status === 401) return new McpError('unauthorized', '认证失败（401），请检查 Token、API Key 或认证方式。', status)
  if (status === 403) return new McpError('forbidden', '服务器拒绝访问（403），当前凭据或网页来源没有权限。', status)
  if (status === 404) return new McpError('not_found', 'MCP 地址不存在（404），请检查服务地址。', status)
  if (status >= 500) return new McpError('server_error', `MCP Server 返回服务端错误（${status}）。${detail}`.trim(), status)
  return new McpError('invalid_endpoint', `Endpoint 返回 HTTP ${status}，未完成 MCP 协议请求。${detail}`.trim(), status)
}

export const normalizeMcpError = (error: unknown, url?: string): McpError => {
  if (error instanceof McpError) return error
  if (error instanceof DOMException && error.name === 'AbortError') return new McpError('cancelled', '操作已取消。', undefined, error)
  const message = error instanceof Error ? error.message : String(error || '')
  if (/timeout|timed out|超时/i.test(message)) return new McpError('timeout', '连接或工具调用超时。', undefined, error)
  if (error instanceof TypeError && typeof location !== 'undefined' && url) {
    try {
      const crossOrigin = new URL(url, location.href).origin !== location.origin
      if (crossOrigin && navigator.onLine !== false) return new McpError('cors', '该 MCP Server 可能本身正常，但未允许当前网页跨域访问，因此 PWA/浏览器无法直接连接。请检查 CORS、OPTIONS、允许的 Origin 与请求 Header。', undefined, error)
    } catch {}
  }
  if (/protocol|json-rpc|jsonrpc/i.test(message)) return new McpError('protocol_mismatch', `MCP 协议不兼容：${message}`, undefined, error)
  if (/json|parse|unexpected token/i.test(message)) return new McpError('parse_error', `服务器响应无法解析：${message}`, undefined, error)
  return new McpError('network', message ? `无法访问 MCP Server：${message}` : '无法访问 MCP Server，请检查网络、DNS 与 HTTPS。', undefined, error)
}
