/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type MusicSourceCapability = 'search' | 'home' | 'playlist' | 'stream' | 'lyrics' | 'comments'

interface SourceHealth {
  failures: number
  lastSuccessAt: number
  cooldownUntil: number
}

const health = new Map<string, SourceHealth>()

const healthKey = (sourceId: string, capability: MusicSourceCapability) => `${sourceId}:${capability}`

const cooldownFor = (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason || '')
  if (/\b429\b|请求过于频繁|too many/i.test(message)) return 5 * 60_000
  if (/\b502\b|\b503\b|\b504\b|bad gateway|service unavailable/i.test(message)) return 60_000
  if (/超时|timeout|abort/i.test(message)) return 30_000
  return 15_000
}

export const markMusicSourceSuccess = (sourceId: string, capability: MusicSourceCapability) => {
  health.set(healthKey(sourceId, capability), { failures: 0, lastSuccessAt: Date.now(), cooldownUntil: 0 })
}

export const markMusicSourceFailure = (sourceId: string, capability: MusicSourceCapability, reason: unknown) => {
  const key = healthKey(sourceId, capability)
  const previous = health.get(key)
  health.set(key, {
    failures: (previous?.failures || 0) + 1,
    lastSuccessAt: previous?.lastSuccessAt || 0,
    cooldownUntil: Date.now() + cooldownFor(reason)
  })
}

export const orderMusicSourcesForCapability = <T extends { id: string }>(sources: T[], capability: MusicSourceCapability) => {
  const now = Date.now()
  return sources
    .map((source, index) => ({ source, index, state: health.get(healthKey(source.id, capability)) }))
    .filter(item => (item.state?.cooldownUntil || 0) <= now)
    .sort((left, right) => {
      const successDelta = (right.state?.lastSuccessAt || 0) - (left.state?.lastSuccessAt || 0)
      if (successDelta) return successDelta
      return left.index - right.index
    })
    .map(item => item.source)
}

export const isMusicSourceCoolingDown = (sourceId: string, capability: MusicSourceCapability) => {
  return (health.get(healthKey(sourceId, capability))?.cooldownUntil || 0) > Date.now()
}

export const resetMusicSourceFallbackHealth = () => health.clear()
