import { getSecureValue, isNativeMobileApp, setSecureValue } from '../mobileSecureStorage'
import type { McpSecretPersistence } from '../../types/mcp'

const WEB_PREFIX = 'clingy_mcp_secret_v3_'
const NATIVE_PREFIX = 'mcp_secret_v3_'
const sessionSecrets = new Map<string, string>()
export const createSecretRef = () => globalThis.crypto?.randomUUID?.() || `secret_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
export const getMcpSecret = async (ref: string) => {
  if (!ref) return ''
  if (sessionSecrets.has(ref)) return sessionSecrets.get(ref) || ''
  return isNativeMobileApp() ? (await getSecureValue(`${NATIVE_PREFIX}${ref}`)) || '' : localStorage.getItem(`${WEB_PREFIX}${ref}`) || ''
}
export const setMcpSecret = async (ref: string, value: string, persistence: McpSecretPersistence) => {
  if (!ref) throw new Error('Secret 引用不能为空。')
  sessionSecrets.delete(ref)
  if (persistence === 'session') {
    sessionSecrets.set(ref, value)
    if (isNativeMobileApp()) await setSecureValue(`${NATIVE_PREFIX}${ref}`, '')
    else localStorage.removeItem(`${WEB_PREFIX}${ref}`)
  } else if (isNativeMobileApp()) await setSecureValue(`${NATIVE_PREFIX}${ref}`, value)
  else if (value) localStorage.setItem(`${WEB_PREFIX}${ref}`, value)
  else localStorage.removeItem(`${WEB_PREFIX}${ref}`)
}
export const removeMcpSecret = async (ref: string) => {
  if (!ref) return
  sessionSecrets.delete(ref)
  if (isNativeMobileApp()) await setSecureValue(`${NATIVE_PREFIX}${ref}`, '')
  else localStorage.removeItem(`${WEB_PREFIX}${ref}`)
}

