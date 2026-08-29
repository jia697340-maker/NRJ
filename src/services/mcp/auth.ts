import type { McpAuth } from '../../types/mcp'
import { getMcpSecret } from './secrets'

export const isSensitiveHeader = (name: string) => /authorization|api[-_]?key|token|secret|cookie|credential/i.test(name)
export const buildMcpHeaders = async (auth: McpAuth): Promise<Record<string, string>> => {
  if (auth.type === 'none') return {}
  if (auth.type === 'oauth') throw new Error('OAuth 认证尚未配置，请改用服务器支持的 Bearer、API Key 或自定义 Header。')
  if (auth.type === 'bearer') return { Authorization: `Bearer ${await getMcpSecret(auth.secretRef)}` }
  if (auth.type === 'api-key') return { [auth.header || 'X-API-Key']: await getMcpSecret(auth.secretRef) }
  const headers: Record<string, string> = {}
  for (const item of auth.headers) if (item.name.trim()) headers[item.name.trim()] = await getMcpSecret(item.secretRef)
  return headers
}
export const getMcpAuthSecretValues = async (auth: McpAuth) => {
  if (auth.type === 'none' || auth.type === 'oauth') return []
  if (auth.type === 'custom-headers') return Promise.all(auth.headers.map(item => getMcpSecret(item.secretRef)))
  return [await getMcpSecret(auth.secretRef)]
}
export const redactObject = (value: unknown, knownSecrets: string[] = []): any => {
  if (Array.isArray(value)) return value.map(item => redactObject(item, knownSecrets))
  if (!value || typeof value !== 'object') {
    if (typeof value !== 'string') return value
    let text = value
    for (const secret of knownSecrets.filter(Boolean)) text = text.split(secret).join('••••••••')
    return text
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, isSensitiveHeader(key) ? '••••••••' : redactObject(item, knownSecrets)]))
}
