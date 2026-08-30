import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const walletSource = await readFile('src/services/walletService.ts', 'utf8')
const walletTranspiled = ts.transpileModule(walletSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const walletUrl = `data:text/javascript;base64,${Buffer.from(walletTranspiled).toString('base64')}`
const marketSource = await readFile('src/services/walletMarketService.ts', 'utf8')
const marketTranspiled = ts.transpileModule(marketSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText.replace("from './walletService';", `from '${walletUrl}';`)

const wallet = await import(walletUrl)
const market = await import(`data:text/javascript;base64,${Buffer.from(marketTranspiled).toString('base64')}`)
const state = wallet.createWalletState('market-user', '行情用户')
market.setWalletMarketMode(state, 'live')

globalThis.fetch = async () => new Response(JSON.stringify({
  data: {
    diff: state.liveQuotes.map((quote, index) => ({
      f2: 10000 + index * 100, f12: quote.code, f13: quote.marketCode.startsWith('1.') ? 1 : 0,
      f14: quote.name, f18: 9900 + index * 100
    }))
  }
}), { status: 200, headers: { 'Content-Type': 'application/json' } })

await market.refreshWalletLiveMarket(state)
assert.equal(state.marketSettings.status, 'ready')
assert.equal(state.marketSettings.providerLabel, '内置网络行情 · 东方财富')
assert.equal(state.liveQuotes[0].priceCents, 10000)
assert.deepEqual(state.liveQuotes[0].history, [10000])

state.marketSettings.source = 'custom'
state.marketSettings.custom.url = 'https://example.test/quotes?symbols={symbols}'
state.marketSettings.custom.dataPath = 'quotes'
globalThis.fetch = async url => {
  assert.match(String(url), /600519%2C000001/)
  return new Response(JSON.stringify({ quotes: [{ code: '600519', name: '自定义茅台', price: 1300.5, previousClose: 1290, timestamp: 1700000000 }] }), { status: 200 })
}
await market.refreshWalletLiveMarket(state)
assert.equal(state.liveQuotes[0].name, '自定义茅台')
assert.equal(state.liveQuotes[0].priceCents, 130050)
assert.equal(state.marketSettings.providerLabel, '自定义行情')

console.log('wallet market tests passed')
