export type NewApiPlatform = 'new-api' | 'one-api' | 'unknown'

export interface NewApiNodeInfo {
  platform: NewApiPlatform
  systemName: string
  baseUrl: string
  maskedKey: string
  connected: boolean
  remainingQuota: number | null
  usedQuota: number | null
  totalQuota: number | null
  unlimitedQuota: boolean
  modelCount: number
  expiresAt: number | null
  checkedAt: number
  currencySymbol: string
  quotaSupported: boolean
  errorMessage?: string
}

export interface NewApiDetectionResult {
  nodeInfo: NewApiNodeInfo
  credentials: {
    baseUrl: string
    apiKey: string
  }
  models: string[]
}

export class NewApiDetectionError extends Error {
  readonly code:
    | 'INVALID_URL'
    | 'UNREACHABLE'
    | 'UNSUPPORTED'
    | 'INVALID_KEY'
    | 'EXPIRED_KEY'
    | 'CORS'
    | 'EMPTY_MODELS'
    | 'TIMEOUT'
    | 'UNKNOWN'

  constructor(
    message: string,
    code:
      | 'INVALID_URL'
      | 'UNREACHABLE'
      | 'UNSUPPORTED'
      | 'INVALID_KEY'
      | 'EXPIRED_KEY'
      | 'CORS'
      | 'EMPTY_MODELS'
      | 'TIMEOUT'
      | 'UNKNOWN'
  ) {
    super(message)
    this.name = 'NewApiDetectionError'
    this.code = code
  }
}

const REQUEST_TIMEOUT_MS = 20_000

const asRecord = (value: unknown): Record<string, any> => {
  return value && typeof value === 'object' ? value as Record<string, any> : {}
}

const asFiniteNumber = (value: unknown): number | null => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

export const normalizeNewApiBaseUrl = (input: string) => {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new NewApiDetectionError('请输入中转站地址', 'INVALID_URL')
  }

  let url: URL
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
  } catch {
    throw new NewApiDetectionError('中转站地址格式不正确', 'INVALID_URL')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new NewApiDetectionError('中转站地址只支持 HTTP 或 HTTPS', 'INVALID_URL')
  }

  url.hash = ''
  url.search = ''
  url.pathname = url.pathname
    .replace(/\/(?:v1|api)\/?$/i, '')
    .replace(/\/+$/, '')

  return url.toString().replace(/\/$/, '')
}

export const maskApiKey = (apiKey: string) => {
  const key = apiKey.trim()
  if (key.length <= 10) return `${key.slice(0, 3)}••••`
  return `${key.slice(0, 7)}••••••${key.slice(-4)}`
}

const fetchWithTimeout = async (url: string, init: RequestInit = {}) => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new NewApiDetectionError('请求超时，请稍后重试', 'TIMEOUT')
    }
    if (error instanceof TypeError) {
      throw new NewApiDetectionError('无法访问该站点，可能是网络异常或站点未开放跨域访问', 'CORS')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

const readJson = async (response: Response) => {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

const readErrorMessage = (payload: unknown) => {
  const root = asRecord(payload)
  const error = asRecord(root.error)
  return String(error.message || root.message || '').trim()
}

const mapAuthenticationError = (status: number, payload: unknown) => {
  const message = readErrorMessage(payload)
  if (/expire|expired|过期/i.test(message)) {
    return new NewApiDetectionError('API Key 已过期', 'EXPIRED_KEY')
  }
  if ([401, 403].includes(status)) {
    return new NewApiDetectionError(message || 'API Key 无效或没有访问权限', 'INVALID_KEY')
  }
  return null
}

const convertQuota = (
  raw: unknown,
  quotaPerUnit: number,
  exchangeRate: number
) => {
  const value = asFiniteNumber(raw)
  if (value === null) return null
  return (value / quotaPerUnit) * exchangeRate
}

export const detectNewApiNode = async (input: {
  baseUrl: string
  apiKey: string
}): Promise<NewApiDetectionResult> => {
  const baseUrl = normalizeNewApiBaseUrl(input.baseUrl)
  const apiKey = input.apiKey.trim()
  if (!apiKey) {
    throw new NewApiDetectionError('请输入 API Key', 'INVALID_KEY')
  }

  let statusResponse: Response
  try {
    statusResponse = await fetchWithTimeout(`${baseUrl}/api/status`, {
      headers: { Accept: 'application/json' }
    })
  } catch (error) {
    if (error instanceof NewApiDetectionError) throw error
    throw new NewApiDetectionError('无法访问该站点', 'UNREACHABLE')
  }

  const statusPayload = asRecord(await readJson(statusResponse))
  const statusData = asRecord(statusPayload.data)
  if (!statusResponse.ok || statusPayload.success === false || !Object.keys(statusData).length) {
    throw new NewApiDetectionError('该地址不是受支持的 New API 或 One API 站点', 'UNSUPPORTED')
  }

  const version = String(statusData.version || statusResponse.headers.get('x-new-api-version') || '')
  const platform: NewApiPlatform = /new[\s_-]?api|rc\.|alpha|beta/i.test(version)
    ? 'new-api'
    : 'one-api'

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${apiKey}`
  }

  const [modelsResponse, usageResponse] = await Promise.all([
    fetchWithTimeout(`${baseUrl}/v1/models`, { headers }),
    fetchWithTimeout(`${baseUrl}/api/usage/token/`, { headers }).catch(() => null)
  ])

  const modelsPayload = asRecord(await readJson(modelsResponse))
  const modelAuthError = mapAuthenticationError(modelsResponse.status, modelsPayload)
  if (modelAuthError) throw modelAuthError
  if (!modelsResponse.ok) {
    throw new NewApiDetectionError(readErrorMessage(modelsPayload) || '获取模型列表失败', 'UNKNOWN')
  }

  const models = Array.isArray(modelsPayload.data)
    ? [...new Set(modelsPayload.data
      .map((item: any) => typeof item === 'string' ? item : item?.id)
      .filter((id: unknown): id is string => typeof id === 'string' && Boolean(id.trim())))]
        .sort((a, b) => a.localeCompare(b))
    : []

  if (!models.length) {
    throw new NewApiDetectionError('站点没有返回可用模型', 'EMPTY_MODELS')
  }

  const usagePayload = usageResponse ? asRecord(await readJson(usageResponse)) : {}
  // 部分兼容站点没有实现令牌用量接口；模型鉴权成功时仍允许导入。
  const usageData = usageResponse?.ok ? asRecord(usagePayload.data) : {}
  const quotaSupported = Boolean(usageResponse?.ok && Object.keys(usageData).length > 0)
  const quotaPerUnit = Math.max(1, asFiniteNumber(statusData.quota_per_unit) || 500_000)
  const exchangeRate = Math.max(0, asFiniteNumber(statusData.custom_currency_exchange_rate) || 1)
  const expiresRaw = asFiniteNumber(usageData.expires_at)
  const expiresAt = expiresRaw && expiresRaw > 0
    ? (expiresRaw < 10_000_000_000 ? expiresRaw * 1000 : expiresRaw)
    : null
  const unlimitedQuota = Boolean(usageData.unlimited_quota)

  if (expiresAt && expiresAt <= Date.now()) {
    throw new NewApiDetectionError('API Key 已过期', 'EXPIRED_KEY')
  }

  const nodeInfo: NewApiNodeInfo = {
    platform,
    systemName: String(statusData.system_name || statusData.systemName || new URL(baseUrl).hostname),
    baseUrl,
    maskedKey: maskApiKey(apiKey),
    connected: true,
    remainingQuota: quotaSupported && !unlimitedQuota
      ? convertQuota(usageData.total_available, quotaPerUnit, exchangeRate)
      : null,
    usedQuota: quotaSupported && !unlimitedQuota
      ? convertQuota(usageData.total_used, quotaPerUnit, exchangeRate)
      : null,
    totalQuota: quotaSupported && !unlimitedQuota
      ? convertQuota(usageData.total_granted, quotaPerUnit, exchangeRate)
      : null,
    unlimitedQuota,
    modelCount: models.length,
    expiresAt,
    checkedAt: Date.now(),
    currencySymbol: String(statusData.custom_currency_symbol || '$'),
    quotaSupported
  }

  return {
    nodeInfo,
    credentials: { baseUrl, apiKey },
    models
  }
}
