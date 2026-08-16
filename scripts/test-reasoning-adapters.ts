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

const adapters = await import('../src/services/modelAdapters.ts')
const reasoning = await import('../src/services/reasoning.ts')
const apiDebug = await import('../src/services/apiDebug.ts')
const { cotSettings } = await import('../src/store/cot.ts')
const { apiSettings } = await import('../src/store/api.ts')
const { decorateChatPayload, sendChatMessage } = await import('../src/services/api.ts')

const policy = {
  enabled: true,
  mode: 'custom' as const,
  showThinking: true,
  effort: 'medium' as const,
  geminiNativeEnabled: true,
  claudeNativeEnabled: true
}

const gemini37 = adapters.prepareAdapterRequest({
  provider: 'gemini', url: 'https://generativelanguage.googleapis.com', key: 'test', model: 'gemini-3.7-flash',
  temperature: 0.7, topP: 0.9, reasoning: policy
}, [{ role: 'user', content: '问题' }, { role: 'assistant', content: '<thinking>' }])
assert.equal(gemini37.profile, 'gemini')
assert.equal(gemini37.protocol, 'gemini-interactions')
assert.equal(gemini37.body.input.at(-1).type, 'user_input', 'Gemini 3.7 必须移除尾部 model prefill')
assert.deepEqual(gemini37.body.generation_config, { thinking_level: 'medium', thinking_summaries: 'auto' })
assert.equal(gemini37.fallback?.protocol, 'gemini-generate-content')
assert.equal(gemini37.fallback?.body.generationConfig.temperature, undefined)
assert.equal(gemini37.fallback?.body.generationConfig.topP, undefined)
assert.deepEqual(gemini37.fallback?.body.generationConfig.thinkingConfig, { includeThoughts: true, thinkingLevel: 'medium' })

const relayGemini37 = adapters.prepareAdapterRequest({
  provider: 'custom', url: 'https://relay.example.com', key: 'test', model: 'gemini-3.7-flash',
  profile: 'gemini', reasoning: policy
}, [{ role: 'user', content: '问题' }])
assert.equal(relayGemini37.protocol, 'gemini-generate-content', '第三方 Gemini 中转不得强制切换 Interactions')

const gemini25 = adapters.prepareAdapterRequest({
  provider: 'gemini', url: 'https://generativelanguage.googleapis.com', key: 'test', model: 'gemini-2.5-flash',
  reasoning: { ...policy, mode: 'skip' }
}, [{ role: 'user', content: '问题' }])
assert.equal(gemini25.body.generationConfig.thinkingConfig.thinkingBudget, 0)
assert.equal(gemini25.body.generationConfig.thinkingConfig.includeThoughts, false)

const interactionResponse = adapters.parseAdapterResponse('gemini', {
  id: 'v1_interaction_1', status: 'completed',
  steps: [
    { type: 'thought', signature: 'secret', summary: [{ type: 'text', text: '先核对条件。' }] },
    { type: 'model_output', content: [{ type: 'text', text: '最终答案' }] }
  ],
  usage: { total_input_tokens: 12, total_output_tokens: 8, total_tokens: 40 }
}, 'gemini-interactions')
assert.equal(interactionResponse.thinking, '先核对条件。')
assert.equal(interactionResponse.content, '最终答案')
assert.equal(interactionResponse.providerState?.responseId, 'v1_interaction_1')

const emptyThoughtResponse = adapters.parseAdapterResponse('gemini', {
  id: 'v1_interaction_2', status: 'completed',
  steps: [{ type: 'thought', signature: 'secret' }, { type: 'model_output', content: [{ type: 'text', text: '下午好啊' }] }]
}, 'gemini-interactions')
assert.equal(emptyThoughtResponse.thinking, '', '只有签名的简单请求必须被当作合法空摘要')
assert.equal(emptyThoughtResponse.content, '下午好啊')

const thoughtStart = adapters.consumeAdapterStreamEvent('gemini', {
  event_type: 'step.start', step: { type: 'thought', summary: [{ type: 'text', text: '检查' }] }
}, 'gemini-interactions')
const thoughtDelta = adapters.consumeAdapterStreamEvent('gemini', {
  event_type: 'step.delta', delta: { type: 'thought_summary', content: { type: 'text', text: '条件' } }
}, 'gemini-interactions')
const textDelta = adapters.consumeAdapterStreamEvent('gemini', {
  event_type: 'step.delta', delta: { type: 'text', text: '答案' }
}, 'gemini-interactions')
assert.equal(`${thoughtStart.thinking}${thoughtDelta.thinking}`, '检查条件')
assert.equal(textDelta.content, '答案')

const continuedGemini = adapters.prepareAdapterRequest({
  provider: 'gemini', url: 'https://generativelanguage.googleapis.com', key: 'test', model: 'gemini-3.7-flash', reasoning: policy
}, [
  { role: 'user', content: '第一问' },
  { role: 'assistant', content: '第一答', _turnId: 'turn_g1', _providerState: { provider: 'gemini', responseId: 'v1_interaction_1' } },
  { role: 'assistant', content: '拆分回复', _turnId: 'turn_g1' },
  { role: 'user', content: '第二问' }
])
assert.equal(continuedGemini.body.previous_interaction_id, 'v1_interaction_1')
assert.deepEqual(continuedGemini.body.input, [{ type: 'user_input', content: [{ type: 'text', text: '第二问' }] }])

const claude48 = adapters.prepareAdapterRequest({
  provider: 'claude', url: 'https://api.anthropic.com', key: 'test', model: 'claude-opus-4-8',
  temperature: 0.8, topP: 0.9, reasoning: policy
}, [{ role: 'system', content: '规则' }, { role: 'user', content: '问题' }])
assert.deepEqual(claude48.body.thinking, { type: 'adaptive', display: 'summarized' })
assert.deepEqual(claude48.body.output_config, { effort: 'medium' })
assert.equal(claude48.body.temperature, undefined)

const claude5NoPrefill = adapters.prepareAdapterRequest({
  provider: 'claude', url: 'https://api.anthropic.com', key: 'test', model: 'claude-sonnet-5', reasoning: { ...policy, claudeNativeEnabled: false }
}, [{ role: 'user', content: '问题' }, { role: 'assistant', content: '不允许的预填' }])
assert.equal(claude5NoPrefill.body.messages.length, 1)

const claude45 = adapters.prepareAdapterRequest({
  provider: 'claude', url: 'https://api.anthropic.com', key: 'test', model: 'claude-sonnet-4-5', maxTokens: 1000,
  reasoning: policy
}, [{ role: 'user', content: '问题' }])
assert.equal(claude45.body.thinking.type, 'enabled')
assert.ok(claude45.body.max_tokens > claude45.body.thinking.budget_tokens)

const restoredClaude = adapters.prepareAdapterRequest({
  provider: 'claude', url: 'https://api.anthropic.com', key: 'test', model: 'claude-opus-4-8', reasoning: policy
}, [
  { role: 'user', content: '第一问' },
  { role: 'assistant', content: '拆分一', _turnId: 'turn_1', _providerState: { provider: 'claude', blocks: [{ type: 'thinking', thinking: '摘要', signature: 'sig' }, { type: 'text', text: '完整回答' }] } },
  { role: 'assistant', content: '拆分二', _turnId: 'turn_1' },
  { role: 'user', content: '第二问' }
])
assert.equal(restoredClaude.body.messages[1].content[1].text, '完整回答')
assert.doesNotMatch(JSON.stringify(restoredClaude.body.messages), /拆分二/)

assert.equal(adapters.resolveModelAdapterProfile('openai', 'gpt-5.6-sol'), 'openai-responses')
const openAIResponse = adapters.parseAdapterResponse('openai-responses', {
  id: 'resp_1', status: 'completed',
  output: [
    { type: 'reasoning', summary: [{ type: 'summary_text', text: '先检查条件。' }] },
    { type: 'message', content: [{ type: 'output_text', text: '最终答案' }] }
  ],
  usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
})
assert.equal(openAIResponse.content, '最终答案')
assert.equal(openAIResponse.thinking, '先检查条件。')
assert.equal(openAIResponse.providerState?.responseId, 'resp_1')
const continuedOpenAI = adapters.prepareAdapterRequest({
  provider: 'openai', url: 'https://api.openai.com', key: 'test', model: 'gpt-5.6-sol', reasoning: policy
}, [
  { role: 'user', content: '第一问' },
  { role: 'assistant', content: '第一答', _providerState: { provider: 'openai', responseId: 'resp_1' } },
  { role: 'user', content: '第二问' }
])
assert.equal(continuedOpenAI.body.previous_response_id, 'resp_1')
assert.deepEqual(continuedOpenAI.body.input, [{ role: 'user', content: '第二问' }])

const deepSeek = adapters.parseAdapterResponse('deepseek-reasoner', {
  choices: [{ message: { content: '答案', reasoning_content: '推理' }, finish_reason: 'stop' }]
})
assert.equal(deepSeek.thinking, '推理')
assert.equal(deepSeek.reasoningSource, 'native')

const glm = adapters.prepareAdapterRequest({
  provider: 'glm', url: 'https://open.bigmodel.cn/api/paas/v4', key: 'test', model: 'glm-4.7', reasoning: policy
}, [{ role: 'user', content: '问题' }])
assert.deepEqual(glm.body.thinking, { type: 'enabled' })
assert.equal(glm.body.clear_thinking, false)
const continuedGlm = adapters.prepareAdapterRequest({
  provider: 'glm', url: 'https://open.bigmodel.cn/api/paas/v4', key: 'test', model: 'glm-4.7', reasoning: policy
}, [{ role: 'assistant', content: '回答', _providerState: { provider: 'glm', reasoningContent: '完整推理' } }, { role: 'user', content: '继续' }])
assert.equal(continuedGlm.body.messages[0].reasoning_content, '完整推理')
assert.equal(continuedGlm.body.messages[0]._providerState, undefined)

assert.deepEqual(reasoning.extractEmbeddedReasoning('[incipere]\n<thinking>分析</thinking>\n[finire]\n<msg>正文</msg>'), {
  content: '<msg>正文</msg>', thinking: '分析', found: true
})
assert.equal(reasoning.extractEmbeddedReasoning('<thinking>未闭合').found, false)
assert.equal(reasoning.extractEmbeddedReasoning('正文里只有 </thinking> 示例').found, false)
assert.equal(reasoning.shouldDisplayThinking({ enabled: true, mode: 'custom', showThinking: true }, { type: 'left', thinking: '摘要' }), true)
assert.equal(reasoning.shouldDisplayThinking({ enabled: true, mode: 'skip', showThinking: true }, { type: 'left', thinking: '摘要' }), false)
assert.equal(reasoning.shouldDisplayThinking({ enabled: true, mode: 'custom', showThinking: false }, { type: 'left', thinking: '摘要' }), false)
assert.equal(reasoning.shouldDisplayThinking({ enabled: true, mode: 'custom', showThinking: true }, { type: 'left', thinking: '' }), false)

cotSettings.enabled = true
cotSettings.mode = 'custom'
cotSettings.geminiNativeEnabled = true
cotSettings.items = [
  { id: 'cot_default_1', name: '旧包装', position: 'system_top', role: 'system', content: '<thinking>', enabled: true },
  { id: 'custom_user', name: '用户规则', position: 'system_middle', role: 'user', content: '检查角色连续性', enabled: true },
  { id: 'cot_default_4', name: '旧预填', position: 'assistant_prefill', role: 'assistant', content: '<thinking>', enabled: true }
]
const nativeDecorated = decorateChatPayload([{ role: 'system', content: '基础' }, { role: 'user', content: '你好' }], false, 'default', {
  profile: 'gemini', model: 'gemini-3.7-flash', applyCot: true
})
assert.doesNotMatch(JSON.stringify(nativeDecorated), /<thinking>/)
assert.ok(nativeDecorated.some(message => message.role === 'user' && message.content === '检查角色连续性'))
const background = decorateChatPayload([{ role: 'user', content: '后台任务' }], false, 'default', { profile: 'gemini', model: 'gemini-3.7-flash', applyCot: false })
assert.deepEqual(background, [{ role: 'user', content: '后台任务' }])

assert.deepEqual(apiDebug.redactApiDebugValue({
  Authorization: 'Bearer secret',
  nested: { thoughtSignature: 'signature-data', text: '保留正文' }
}), {
  Authorization: '[已脱敏]',
  nested: { thoughtSignature: '[已脱敏]', text: '保留正文' }
})
storage.set('clingy_diagnostic_settings_v1', JSON.stringify({ enabled: false, maxRecords: 50, rawConsoleLogging: true }))
assert.equal(apiDebug.isRawApiConsoleLoggingEnabled(), true)
const debugCalls: unknown[][] = []
const originalConsoleLog = console.log
const originalConsoleGroup = console.groupCollapsed
const originalConsoleGroupEnd = console.groupEnd
console.log = (...args: unknown[]) => { debugCalls.push(args) }
console.groupCollapsed = () => {}
console.groupEnd = () => {}
apiDebug.logApiRequest({
  endpoint: 'https://example.com/v1?key=secret', protocol: 'test',
  headers: { Authorization: 'Bearer secret' }, body: { messages: [{ content: '保留正文' }], signature: 'secret-signature' }
})
console.log = originalConsoleLog
console.groupCollapsed = originalConsoleGroup
console.groupEnd = originalConsoleGroupEnd
assert.doesNotMatch(JSON.stringify(debugCalls), /secret-signature|Bearer secret|[?&]key=secret/)
assert.match(JSON.stringify(debugCalls), /保留正文/)
storage.delete('clingy_diagnostic_settings_v1')

const originalFetch = globalThis.fetch
const requestedEndpoints: string[] = []
globalThis.fetch = (async (input: string | URL | Request) => {
  const endpoint = String(input)
  requestedEndpoints.push(endpoint)
  if (endpoint.endsWith('/v1beta/interactions')) {
    return new Response(JSON.stringify({ error: { message: 'Interactions unavailable' } }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    })
  }
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: '回退成功' }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch
apiSettings.provider = 'gemini'
apiSettings.url = 'https://generativelanguage.googleapis.com'
apiSettings.key = 'test'
apiSettings.model = 'gemini-3.7-flash'
apiSettings.adapterProfile = 'auto'
apiSettings.enableStream = false
apiSettings.enableMaxTokens = false
const fallbackResult = await sendChatMessage(
  [{ role: 'user', content: '测试回退' }], undefined, false, false, 'default', 'auto', { chatId: 'fallback-test' }
)
globalThis.fetch = originalFetch
assert.equal(fallbackResult.content, '回退成功')
assert.ok(requestedEndpoints[0].endsWith('/v1beta/interactions'))
assert.match(requestedEndpoints[1], /gemini-3\.7-flash:generateContent$/)

console.log('Reasoning adapter, native summary, and fallback parser tests passed.')
