/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { McpToolRisk } from '../types/mcp'

export interface McpApprovalRequest {
  id: string
  connectionName: string
  toolName: string
  risk: McpToolRisk
  arguments: Record<string, unknown>
}

const pending = new Map<string, (approved: boolean) => void>()

export const requestMcpApproval = (request: Omit<McpApprovalRequest, 'id'>) => new Promise<boolean>(resolve => {
  const id = `mcp_approval_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  pending.set(id, resolve)
  window.dispatchEvent(new CustomEvent<McpApprovalRequest>('mcp-approval-request', { detail: { ...request, id } }))
})

export const resolveMcpApproval = (id: string, approved: boolean) => {
  const resolve = pending.get(id)
  if (!resolve) return
  pending.delete(id)
  resolve(approved)
}

