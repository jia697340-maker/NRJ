/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { Capacitor } from '@capacitor/core'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'

const KEY_PREFIX = 'nianrenjin_'
let initialized = false

const initialize = async () => {
  if (initialized) return
  await SecureStorage.setKeyPrefix(KEY_PREFIX)
  initialized = true
}

export const isNativeMobileApp = () => Capacitor.isNativePlatform()

export const getSecureValue = async (key: string) => {
  if (!isNativeMobileApp()) return null
  await initialize()
  const value = await SecureStorage.get(key, false, false)
  return typeof value === 'string' ? value : null
}

export const setSecureValue = async (key: string, value: string) => {
  if (!isNativeMobileApp()) return
  await initialize()
  if (value) await SecureStorage.set(key, value, false, false)
  else await SecureStorage.remove(key, false)
}
