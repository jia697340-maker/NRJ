/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import {
  getWalletQuotes,
  processWalletPendingOrders,
  type WalletCustomMarketConfig,
  type WalletQuote,
  type WalletState
} from './walletService'

const EASTMONEY_URL = 'https://push2.eastmoney.com/api/qt/ulist.np/get'
const TENCENT_URL = 'https://qt.gtimg.cn/q='

const readPath = (value: any, path: string) => {
  if (!path.trim()) return value
  return path.split('.').filter(Boolean).reduce((current, key) => current?.[key], value)
}

const asTimestamp = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value < 10_000_000_000 ? value * 1000 : value
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : Date.now()
}

const mergeQuotes = (state: WalletState, incoming: WalletQuote[], providerLabel: string) => {
  const oldQuotes = new Map(state.liveQuotes.map(item => [item.code, item]))
  const incomingMap = new Map(incoming.map(item => [item.code, item]))
  const order = [...state.liveQuotes.map(item => item.code), ...incoming.filter(item => !oldQuotes.has(item.code)).map(item => item.code)]
  state.liveQuotes = order.map(code => {
    const item = incomingMap.get(code)
    const old = oldQuotes.get(code)
    if (!item) return old!
    const history = [...(old?.history || [])]
    if (item.priceCents > 0 && history.at(-1) !== item.priceCents) history.push(item.priceCents)
    return { ...old, ...item, history: history.slice(-96) }
  })
  state.marketSettings.status = 'ready'
  state.marketSettings.providerLabel = providerLabel
  state.marketSettings.lastUpdatedAt = Date.now()
  state.marketSettings.error = ''
  processWalletPendingOrders(state)
  return state.liveQuotes
}

const fetchEastmoneyQuotes = async (state: WalletState, signal?: AbortSignal) => {
  const seeds = state.liveQuotes.length ? state.liveQuotes : []
  const marketCodes = seeds.map(item => item.marketCode).filter(Boolean)
  if (!marketCodes.length) throw new Error('没有可请求的真实股票代码')
  const query = new URLSearchParams({
    secids: marketCodes.join(','),
    fields: 'f12,f14,f2,f3,f18,f4,f15,f16,f17,f5,f6,f13'
  })
  const response = await fetch(`${EASTMONEY_URL}?${query}`, { signal, credentials: 'omit', cache: 'no-store' })
  if (!response.ok) throw new Error(`内置行情请求失败 (${response.status})`)
  const payload = await response.json()
  const rows = payload?.data?.diff
  if (!Array.isArray(rows) || !rows.length) throw new Error('内置行情没有返回有效股票')
  const seedMap = new Map(seeds.map(item => [item.code, item]))
  return rows.map((row: any): WalletQuote => {
    const code = String(row.f12 || '')
    const seed = seedMap.get(code)
    return {
      code,
      name: String(row.f14 || seed?.name || code),
      sector: seed?.sector || '股票',
      market: Number(row.f13) === 1 ? '沪市' : '深市',
      marketCode: `${Number(row.f13) === 1 ? 1 : 0}.${code}`,
      priceCents: Math.max(0, Math.round(Number(row.f2) || 0)),
      previousCloseCents: Math.max(0, Math.round(Number(row.f18) || 0)),
      history: [], updatedAt: Date.now(), source: 'eastmoney'
    }
  }).filter((item: WalletQuote) => item.code && item.priceCents > 0)
}

const tencentSymbol = (quote: WalletQuote) => `${quote.marketCode?.startsWith('1.') ? 'sh' : 'sz'}${quote.code}`

const fetchTencentQuotes = async (state: WalletState, signal?: AbortSignal) => {
  const seeds = state.liveQuotes.length ? state.liveQuotes : []
  if (!seeds.length) throw new Error('没有可请求的真实股票代码')
  const response = await fetch(`${TENCENT_URL}${seeds.map(tencentSymbol).join(',')}`, { signal, credentials: 'omit', cache: 'no-store' })
  if (!response.ok) throw new Error(`备用行情请求失败 (${response.status})`)
  const buffer = await response.arrayBuffer()
  const text = new TextDecoder('gbk').decode(buffer)
  const seedMap = new Map(seeds.map(item => [item.code, item]))
  const quotes: WalletQuote[] = []
  for (const line of text.split(';')) {
    const raw = line.match(/="([\s\S]*)"/)?.[1]
    if (!raw) continue
    const fields = raw.split('~')
    const code = fields[2]
    const seed = seedMap.get(code)
    const price = Math.round(Number(fields[3]) * 100)
    const previousClose = Math.round(Number(fields[4]) * 100)
    if (!code || !price) continue
    quotes.push({
      code, name: fields[1] || seed?.name || code, sector: seed?.sector || '股票',
      market: seed?.market || (line.includes('v_sh') ? '沪市' : '深市'), marketCode: seed?.marketCode,
      priceCents: price, previousCloseCents: previousClose, history: [], updatedAt: Date.now(), source: 'tencent'
    })
  }
  if (!quotes.length) throw new Error('备用行情没有返回有效股票')
  return quotes
}

const parseHeaders = (text: string) => {
  if (!text.trim()) return {} as Record<string, string>
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]))
  } catch {
    throw new Error('自定义请求头必须是 JSON 对象')
  }
}

const fetchCustomQuotes = async (state: WalletState, config: WalletCustomMarketConfig, signal?: AbortSignal) => {
  if (!config.url.trim()) throw new Error('请填写自定义行情地址')
  const symbols = state.liveQuotes.map(item => item.code).join(',')
  let url = config.url.trim().replaceAll('{symbols}', encodeURIComponent(symbols))
  if (!config.url.includes('{symbols}') && config.symbolsParameter.trim()) {
    const parsed = new URL(url)
    parsed.searchParams.set(config.symbolsParameter.trim(), symbols)
    url = parsed.toString()
  }
  const response = await fetch(url, {
    method: config.method,
    headers: parseHeaders(config.headersText),
    signal,
    credentials: 'omit',
    cache: 'no-store'
  })
  if (!response.ok) throw new Error(`自定义行情请求失败 (${response.status})`)
  const payload = await response.json()
  const data = readPath(payload, config.dataPath)
  const looksLikeSingleQuote = data && typeof data === 'object' && readPath(data, config.codeField) !== undefined
  const rows = Array.isArray(data) ? data : looksLikeSingleQuote ? [data] : data && typeof data === 'object' ? Object.values(data) : []
  const oldMap = new Map(state.liveQuotes.map(item => [item.code, item]))
  const quotes = rows.map((row: any): WalletQuote | null => {
    const code = String(readPath(row, config.codeField) || '')
    const price = Number(readPath(row, config.priceField))
    if (!code || !Number.isFinite(price) || price <= 0) return null
    const old = oldMap.get(code)
    return {
      code, name: String(readPath(row, config.nameField) || old?.name || code), sector: old?.sector || '股票',
      market: old?.market || '自定义', marketCode: old?.marketCode,
      priceCents: Math.round(price * 100),
      previousCloseCents: Math.round((Number(readPath(row, config.previousCloseField)) || price) * 100),
      history: [], updatedAt: asTimestamp(readPath(row, config.timestampField)), source: 'custom'
    }
  }).filter(Boolean) as WalletQuote[]
  if (!quotes.length) throw new Error('字段映射未解析出有效行情')
  return quotes
}

export const refreshWalletLiveMarket = async (state: WalletState, signal?: AbortSignal) => {
  state.marketSettings.lastAttemptedAt = Date.now()
  state.marketSettings.status = 'loading'
  state.marketSettings.error = ''
  try {
    if (state.marketSettings.source === 'custom') {
      return mergeQuotes(state, await fetchCustomQuotes(state, state.marketSettings.custom, signal), state.marketSettings.custom.name || '自定义行情')
    }
    try {
      return mergeQuotes(state, await fetchEastmoneyQuotes(state, signal), '内置网络行情 · 东方财富')
    } catch (primaryError) {
      try {
        return mergeQuotes(state, await fetchTencentQuotes(state, signal), '内置网络行情 · 腾讯')
      } catch (fallbackError) {
        const primary = primaryError instanceof Error ? primaryError.message : '主要来源失败'
        const fallback = fallbackError instanceof Error ? fallbackError.message : '备用来源失败'
        throw new Error(`${primary}；${fallback}`)
      }
    }
  } catch (error) {
    state.marketSettings.status = state.marketSettings.lastUpdatedAt ? 'stale' : 'error'
    state.marketSettings.error = error instanceof Error ? error.message : '真实行情刷新失败'
    throw error
  }
}

export const shouldRefreshWalletLiveMarket = (state: WalletState) => {
  if (state.marketSettings.mode !== 'live' || state.marketSettings.status === 'loading') return false
  return Date.now() - state.marketSettings.lastAttemptedAt >= Math.max(15, state.marketSettings.refreshSeconds) * 1000
}

export const setWalletMarketMode = (state: WalletState, mode: 'simulation' | 'live') => {
  state.marketSettings.mode = mode
  if (mode === 'simulation') state.marketSettings.status = 'idle'
  return getWalletQuotes(state)
}
