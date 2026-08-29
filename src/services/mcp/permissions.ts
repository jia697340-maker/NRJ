import type { McpConfirmationRequest } from '../../types/mcp'
import { redactObject } from './auth'

export const MCP_CONFIRMATION_EVENT = 'nrj:mcp-confirmation-requested'
export const pendingMcpConfirmations = new Map<string, { request: McpConfirmationRequest; resolve: (allowed: boolean) => void }>()
const chatGrants = new Set<string>()
const key = (chatId: string | undefined, connectionId: string, toolName: string) => `${chatId || ''}:${connectionId}:${toolName}`
export const hasChatMcpGrant = (chatId: string | undefined, connectionId: string, toolName: string) => chatGrants.has(key(chatId, connectionId, toolName))

export const requestMcpConfirmation = (request: McpConfirmationRequest, signal?: AbortSignal) => new Promise<boolean>((resolve, reject) => {
  if (signal?.aborted) return reject(new DOMException('操作已取消', 'AbortError'))
  const safeRequest = { ...request, arguments: redactObject(request.arguments) }
  const finish = (allowed: boolean) => { signal?.removeEventListener('abort', abort); pendingMcpConfirmations.delete(request.id); resolve(allowed) }
  const abort = () => { pendingMcpConfirmations.delete(request.id); reject(new DOMException('操作已取消', 'AbortError')) }
  signal?.addEventListener('abort', abort, { once: true })
  pendingMcpConfirmations.set(request.id, { request: safeRequest, resolve: finish })
  window.dispatchEvent(new CustomEvent(MCP_CONFIRMATION_EVENT, { detail: safeRequest }))
})
export const answerMcpConfirmation = (id: string, action: 'once' | 'chat' | 'deny') => {
  const pending = pendingMcpConfirmations.get(id); if (!pending) return false
  if (action === 'chat') chatGrants.add(key(pending.request.chatId, pending.request.connectionId, pending.request.toolName))
  pending.resolve(action !== 'deny'); return true
}
export const clearMcpChatGrants = (chatId?: string) => {
  for (const item of chatGrants) if (!chatId || item.startsWith(`${chatId}:`)) chatGrants.delete(item)
}

