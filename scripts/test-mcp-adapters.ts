import assert from 'node:assert/strict'
import { parseAdapterResponse, prepareAdapterRequest } from '../src/services/modelAdapters.ts'

const tool = {
  name: 'mcp__local_context__current_time_demo',
  description: '读取当前时间',
  inputSchema: { type: 'object', properties: {} }
}
const call = { id: 'call_1', name: tool.name, arguments: { timezone: 'Asia/Shanghai' } }
const conversation = [
  { role: 'user', content: '现在几点？' },
  { role: 'assistant', content: '', _mcpToolCalls: [call] },
  { role: 'tool', name: call.name, tool_call_id: call.id, content: '{"local":"12:00"}' }
]

const openAI = prepareAdapterRequest({
  provider: 'custom', profile: 'openai-compatible', url: 'https://api.example.com', key: 'test', model: 'test', tools: [tool]
}, conversation)
assert.equal(openAI.body.tools[0].function.name, tool.name)
assert.equal(openAI.body.messages[1].tool_calls[0].function.name, tool.name)
assert.equal(openAI.body.messages[2].tool_call_id, call.id)

const claude = prepareAdapterRequest({
  provider: 'claude', url: 'https://api.anthropic.com', key: 'test', model: 'claude-test', tools: [tool]
}, conversation)
assert.equal(claude.body.tools[0].name, tool.name)
assert.equal(claude.body.messages[1].content[0].type, 'tool_use')
assert.equal(claude.body.messages[2].content[0].type, 'tool_result')

const gemini = prepareAdapterRequest({
  provider: 'gemini', url: 'https://generativelanguage.googleapis.com', key: 'test', model: 'gemini-test', tools: [tool]
}, conversation)
assert.equal(gemini.protocol, 'gemini-generate-content')
assert.equal(gemini.body.tools[0].functionDeclarations[0].name, tool.name)
assert.equal(gemini.body.contents[1].parts.find((part: any) => part.functionCall)?.functionCall.name, tool.name)
assert.equal(gemini.body.contents[2].parts[0].functionResponse.name, tool.name)

const responses = prepareAdapterRequest({
  provider: 'openai', profile: 'openai-responses', url: 'https://api.openai.com', key: 'test', model: 'gpt-test', tools: [tool]
}, conversation)
assert.equal(responses.body.tools[0].name, tool.name)
assert.equal(responses.body.input[1].type, 'function_call')
assert.equal(responses.body.input[2].type, 'function_call_output')

assert.deepEqual(parseAdapterResponse('openai-compatible', {
  choices: [{ message: { content: '', tool_calls: [{ id: call.id, type: 'function', function: { name: call.name, arguments: '{"timezone":"Asia/Shanghai"}' } }] } }]
}).toolCalls, [call])
assert.deepEqual(parseAdapterResponse('claude', {
  content: [{ type: 'tool_use', id: call.id, name: call.name, input: call.arguments }]
}).toolCalls, [call])
assert.deepEqual(parseAdapterResponse('gemini', {
  candidates: [{ content: { parts: [{ functionCall: { id: call.id, name: call.name, args: call.arguments } }] } }]
}).toolCalls, [call])
assert.deepEqual(parseAdapterResponse('openai-responses', {
  output: [{ type: 'function_call', call_id: call.id, name: call.name, arguments: JSON.stringify(call.arguments) }], status: 'completed'
}).toolCalls, [call])

const builtInOnly = parseAdapterResponse('openai-compatible', {
  choices: [{ message: { content: 'done', tool_calls: [{ id: 'search_1', type: 'function', function: { name: 'web_search', arguments: '{}' } }] } }]
})
assert.deepEqual(builtInOnly.toolCalls, [], '服务商内置工具不得进入本机 MCP 执行链')

console.log('MCP adapter serialization and parsing tests passed.')
