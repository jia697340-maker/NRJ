/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import type { MusicBackendPrivacyCapabilities, MusicPrivacyPreferences } from '../types/music'

const PRIVACY_KEY = 'clingy_music_privacy_v1'
export const MUSIC_PRIVACY_VERSION = 1

export const defaultMusicPrivacyPreferences = (): MusicPrivacyPreferences => ({
  version: MUSIC_PRIVACY_VERSION,
  noticeAcknowledged: false,
  allowAnonymousPublicSources: false,
  updatedAt: 0
})

export const loadMusicPrivacyPreferences = async () => {
  try {
    const saved = await localforage.getItem<MusicPrivacyPreferences>(PRIVACY_KEY)
    if (saved && saved.version !== MUSIC_PRIVACY_VERSION) return defaultMusicPrivacyPreferences()
    return { ...defaultMusicPrivacyPreferences(), ...(saved || {}) }
  } catch { return defaultMusicPrivacyPreferences() }
}

export const saveMusicPrivacyPreferences = async (value: MusicPrivacyPreferences) => {
  await localforage.setItem(PRIVACY_KEY, JSON.parse(JSON.stringify(value)))
}

const capabilityDefaults = (): MusicBackendPrivacyCapabilities => ({
  sessionIsolation: false,
  cookiesEndpointProtected: false,
  httpOnlySession: false,
  credentialNotReturned: false,
  logoutSupported: false,
  retentionDays: undefined
})

export const getMusicBackendPrivacyCapabilities = async (apiBase: string): Promise<MusicBackendPrivacyCapabilities> => {
  const url = new URL(`${apiBase.replace(/\/$/, '')}/api/v1/system/privacy/capabilities`, window.location.origin)
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url, { credentials: 'include', signal: controller.signal })
    if (!response.ok) return capabilityDefaults()
    const raw = await response.json() as any
    const data = raw?.data || raw
    return {
      sessionIsolation: data?.session_isolation === true || data?.sessionIsolation === true,
      cookiesEndpointProtected: data?.cookies_endpoint_protected === true || data?.cookiesEndpointProtected === true,
      httpOnlySession: data?.http_only_session === true || data?.httpOnlySession === true,
      credentialNotReturned: data?.credential_not_returned === true || data?.credentialNotReturned === true,
      logoutSupported: data?.logout_supported === true || data?.logoutSupported === true,
      retentionDays: Number(data?.retention_days || data?.retentionDays) || undefined
    }
  } catch { return capabilityDefaults() }
  finally { window.clearTimeout(timer) }
}

export const isQrLoginPrivacySafe = (value: MusicBackendPrivacyCapabilities) => value.sessionIsolation && value.cookiesEndpointProtected && value.httpOnlySession && value.credentialNotReturned && value.logoutSupported
