import assert from 'node:assert/strict'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() { return storage.size }
  },
  configurable: true
})

const promptStore = await import('../src/store/prompt.ts')
const variables = await import('../src/services/promptVariables.ts')

assert.equal(promptStore.globalPromptSettings.schemes.filter(item => item.source === 'builtin').length, 2)
assert.equal(promptStore.getActivePromptScheme()?.id, 'builtin_v1')

const builtinBefore = JSON.stringify(promptStore.getPromptScheme('builtin_v2'))
const copy = promptStore.createPromptSchemeCopy('builtin_v2', '测试副本')
copy.variants.zh.items[0].content = '测试内容 {{char_name}}'
promptStore.savePromptScheme(copy)
assert.equal(promptStore.getActivePromptScheme()?.name, '测试副本')
assert.equal(promptStore.globalPromptSettings.activePresetId, 'v2')
assert.equal(JSON.stringify(promptStore.getPromptScheme('builtin_v2')), builtinBefore, '复制和编辑不得改变内置 V2')

copy.variants.zh.mode = 'full'
copy.variants.zh.fullText = '全文模式 {{char_name}} 与 {{user_name}}'
promptStore.savePromptScheme(copy)
const runtimeItems = promptStore.getActivePromptItems()
assert.equal(runtimeItems.length, 1)
assert.match(runtimeItems[0].content, /全文模式/)

assert.equal(variables.resolvePromptVariables('{{char_name}} 对 {{user_name}} 说话', { char_name: '角色', user_name: '用户' }), '角色 对 用户 说话')
assert.deepEqual(variables.findUnknownPromptVariables('{{char_name}} {{unknown_value}}', 'global'), ['{{unknown_value}}'])
assert.ok(variables.getPromptVariables('global').some(item => item.token === '{{format_rules}}'))
assert.ok(variables.getPromptVariables('offline').every(item => ['{{char_name}}', '{{user_name}}'].includes(item.token)))

promptStore.deletePromptScheme(copy.id)
assert.equal(promptStore.getPromptScheme(copy.id), undefined)
assert.equal(promptStore.getActivePromptScheme()?.id, 'builtin_v2')

console.log('Prompt scheme lifecycle and variable registry tests passed.')
