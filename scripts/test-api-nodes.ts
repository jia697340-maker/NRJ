import assert from 'node:assert/strict'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() { return storage.size }
  },
  configurable: true
})

const shared = {
  enabled: true,
  provider: 'custom',
  url: 'https://shared.example.com/v1',
  key: 'shared-key',
  customUrl: 'https://legacy-stale.example.com/v1',
  customKey: 'legacy-stale-key',
  adapterProfile: 'openai',
  model: 'shared-model'
}

storage.set('clingy_api_settings', JSON.stringify({
  provider: 'deepseek', url: 'https://api.deepseek.com', key: 'default-key', model: 'deepseek-chat'
}))
storage.set('clingy_summary_api_settings', JSON.stringify(shared))
storage.set('clingy_vision_api_settings', JSON.stringify({ ...shared, model: 'vision-model' }))
storage.set('clingy_moment_api_settings', JSON.stringify({
  ...shared, enabled: false, url: 'https://paused.example.com/v1', key: 'paused-key', model: 'paused-model'
}))
storage.set('clingy_embedding_api_settings', JSON.stringify({
  enabled: true, provider: 'custom', url: 'https://embedding.example.com/v1', key: 'embedding-key', model: 'embedding-model'
}))
storage.set('clingy_forum_api_settings', JSON.stringify({
  ...shared,
  url: 'https://forum.example.com/v1',
  key: 'forum-key',
  fallbackToDefault: false,
  bindAllForum: false,
  scopes: ['forum-post', 'forum-comment', 'forum-dm', 'forum-group', 'forum-media', 'forum-memory']
}))
storage.set('app_llm_presets', JSON.stringify([
  { name: '旧生图辅助', provider: 'custom', apiUrl: 'https://nai.example.com/v1', apiKey: 'nai-key', model: 'nai-model' }
]))
storage.set('chat_paused_nai_config', JSON.stringify({
  naiConfig: { enableLlmAssist: false, llmProvider: 'custom', llmApiUrl: 'https://paused-nai.example.com/v1', llmApiKey: 'paused-nai-key', llmModel: 'paused-nai-model' }
}))

const {
  apiNodesState,
  addApiNode,
  createEmptyApiNode,
  deleteApiNode,
  findApiNode,
  getCapabilityOwner,
  resolveApiCapability,
  setApiNodeCapability,
  setApiNodeEnabled,
  apiNodeEffectiveKey,
  apiNodeEffectiveUrl
} = await import('../src/store/api.ts')

const mergedNode = apiNodesState.nodes.find(node => node.capabilities.summary)
assert.ok(mergedNode, '旧总结配置应迁移为节点')
assert.equal(mergedNode.capabilities['vision-understanding'] != null, true, '连接完全一致的旧配置应合并')
assert.equal(mergedNode.capabilities['image-prompt'] != null, true, '旧识图节点还应承接生图提示词辅助')
assert.equal(apiNodeEffectiveUrl(mergedNode), shared.url, '当前 url 不得被陈旧 customUrl 覆盖')
assert.equal(apiNodeEffectiveKey(mergedNode), shared.key, '当前 key 不得被陈旧 customKey 覆盖')

const forumNode = apiNodesState.nodes.find(node => node.capabilities['forum-content'])
assert.ok(forumNode, '论坛旧配置应迁移')
assert.deepEqual(
  Object.keys(forumNode.capabilities).sort(),
  ['forum-content', 'forum-dm', 'forum-interaction'],
  '论坛只应绑定真实存在的三类 LLM 能力'
)
assert.equal(forumNode.fallbackToDefault, false, '论坛原有的失败回退选择必须保留')
assert.equal(apiNodesState.migrationNotes.some(note => note.includes('没有对应 LLM 调用')), true)

const pausedMomentNode = apiNodesState.nodes.find(node => node.model === 'paused-model')
assert.ok(pausedMomentNode, '旧的停用专用节点也必须迁移并保持可见')
assert.equal(pausedMomentNode.enabled, false)
assert.equal(pausedMomentNode.capabilities['moment-interaction'] != null, true)
const pausedNaiNode = apiNodesState.nodes.find(node => node.model === 'paused-nai-model')
assert.ok(pausedNaiNode, '关闭辅助开关不能导致旧 NAI 凭证无法迁移')
assert.equal(pausedNaiNode.enabled, false)

const assigned = apiNodesState.nodes.flatMap(node => Object.keys(node.capabilities))
assert.equal(new Set(assigned).size, assigned.length, '迁移后每项能力只能有一个启用节点负责人')
assert.equal(resolveApiCapability('summary').source, 'custom')
assert.equal(resolveApiCapability('summary').settings?.model, 'shared-model', '合并节点应保留能力自己的模型覆盖')

setApiNodeEnabled(mergedNode.id, false)
assert.equal(resolveApiCapability('summary').source, 'default', '节点停用后应立即回退默认节点')

const replacement = createEmptyApiNode('替代节点')
replacement.key = 'replacement-key'
replacement.model = 'replacement-model'
addApiNode(replacement)
assert.equal(setApiNodeCapability(replacement.id, 'summary', true).ok, true)
assert.equal(getCapabilityOwner('summary')?.id, replacement.id)

const keepCurrent = setApiNodeEnabled(mergedNode.id, true, 'keep-current')
assert.equal(keepCurrent.ok, true)
assert.equal(mergedNode.capabilities.summary, undefined, '保留当前负责人时，恢复节点应放弃冲突职责')
assert.equal(getCapabilityOwner('summary')?.id, replacement.id)

setApiNodeEnabled(mergedNode.id, false)
assert.equal(setApiNodeCapability(mergedNode.id, 'summary', true).ok, true)
const takeOver = setApiNodeEnabled(mergedNode.id, true, 'take-over')
assert.equal(takeOver.ok, true)
assert.equal(replacement.capabilities.summary, undefined, '接管职责时应移除原负责人的冲突绑定')
assert.equal(getCapabilityOwner('summary')?.id, mergedNode.id)

mergedNode.capabilities.summary!.inheritModel = false
mergedNode.capabilities.summary!.model = 'summary-override-model'
assert.equal(resolveApiCapability('summary').settings?.model, 'summary-override-model', '能力模型覆盖必须真实参与路由')

let requestedUrl = ''
Object.defineProperty(globalThis, 'fetch', {
  value: async (input: string | URL | Request) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({ choices: [{ message: { content: '路由成功' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  },
  configurable: true
})
const { sendCapabilityMessage } = await import('../src/services/api.ts')
const routedResponse = await sendCapabilityMessage('summary', [{ role: 'user', content: '测试' }])
assert.equal(routedResponse.content, '路由成功')
assert.equal(requestedUrl.startsWith(shared.url), true, '真实请求必须使用节点编辑器中的当前地址')
assert.equal(requestedUrl.includes('legacy-stale.example.com'), false, '真实请求不得落到历史 customUrl')

const embeddingNode = getCapabilityOwner('embedding')
assert.ok(embeddingNode)
assert.equal(deleteApiNode(embeddingNode.id), true)
assert.equal(resolveApiCapability('embedding').source, 'local', '向量节点删除后应回退本地非向量记忆')

deleteApiNode(mergedNode.id)
assert.equal(resolveApiCapability('summary').source, 'default', '负责人删除后不得残留悬空路由')
assert.equal(findApiNode(mergedNode.id), undefined)

console.log('API 节点迁移、唯一职责、冲突恢复、覆盖与回退测试通过')
