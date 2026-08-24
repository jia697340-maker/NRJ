/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { addMcpActivity, mcpConnections, mcpSettings, upsertMcpConnection } from '../store/mcp'
import type { McpConnectionRecord, McpModelTool, McpToolExecutionResult, McpToolRecord } from '../types/mcp'
import { callMcpRemoteTool } from './mcpClient'
import { requestMcpApproval } from './mcpApproval'

const SHARED_LIFE_KEY = 'clingy_mcp_shared_life'

const localTools: Record<string, McpToolRecord[]> = {
  'local-context': [
    { name: 'current_time', description: '获取用户设备当前的日期、时间、时区和语言。', inputSchema: { type: 'object', properties: {} }, enabled: false, risk: 'read' },
    { name: 'inspect_shared_link', description: '识别用户分享的小红书、抖音、B站、豆瓣、外卖或其他网页链接所属平台，只分析链接本身，不联网读取内容。', inputSchema: { type: 'object', properties: { text: { type: 'string', description: '包含网址的分享文本' } }, required: ['text'] }, enabled: false, risk: 'read' },
    { name: 'calculate', description: '计算只包含数字、括号和加减乘除的算式。', inputSchema: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] }, enabled: false, risk: 'read' }
  ],
  'local-shared-life': [
    { name: 'save_shared_link', description: '把一个链接保存到用户与角色的共同收藏中。此操作会写入本机数据。', inputSchema: { type: 'object', properties: { url: { type: 'string' }, title: { type: 'string' }, category: { type: 'string' }, note: { type: 'string' } }, required: ['url', 'title'] }, enabled: false, risk: 'write' },
    { name: 'list_shared_links', description: '读取用户与角色保存在本机的共同链接收藏。', inputSchema: { type: 'object', properties: { category: { type: 'string' } } }, enabled: false, risk: 'read' },
    { name: 'create_virtual_delivery', description: '创建沉浸式虚拟外卖订单，会写入本机生活记录，不会在真实平台下单或付款。', inputSchema: { type: 'object', properties: { restaurant: { type: 'string' }, items: { type: 'array', items: { type: 'string' } }, total: { type: 'number' }, message: { type: 'string' } }, required: ['restaurant', 'items'] }, enabled: false, risk: 'write' },
    { name: 'list_virtual_deliveries', description: '读取本机的沉浸式虚拟外卖订单。', inputSchema: { type: 'object', properties: {} }, enabled: false, risk: 'read' }
  ]
}

export const ensureLocalMcpConnections = () => {
  const definitions = [
    { id: 'local-context', name: '手机情境', description: '时间、链接识别与轻量计算，不读取私密内容。' },
    { id: 'local-shared-life', name: '共同生活', description: '共同收藏与虚拟外卖，写入操作逐次确认。' }
  ]
  for (const definition of definitions) {
    if (mcpConnections.some(item => item.id === definition.id)) continue
    upsertMcpConnection({
      ...definition, kind: 'local', url: '', token: '', enabled: false, status: 'idle', statusText: '未启用',
      tools: localTools[definition.id].map(tool => ({ ...tool })), createdAt: Date.now(), updatedAt: Date.now()
    })
  }
}

const safeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'tool'
const shortHash = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return (hash >>> 0).toString(36).slice(0, 6)
}
const qualifiedName = (connection: McpConnectionRecord, tool: McpToolRecord) =>
  `mcp__${safeName(connection.id).slice(0, 18)}__${safeName(tool.name).slice(0, 25)}_${shortHash(`${connection.id}\0${tool.name}`)}`

export const getEnabledMcpTools = (): McpModelTool[] => {
  if (!mcpSettings.enabled) return []
  ensureLocalMcpConnections()
  return mcpConnections.filter(connection => connection.enabled).flatMap(connection => connection.tools
    .filter(tool => tool.enabled)
    .map(tool => ({ name: qualifiedName(connection, tool), description: `[${connection.name}] ${tool.description}`.slice(0, 1200), inputSchema: tool.inputSchema })))
}

const extractUrl = (text: string) => text.match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[，。；、）》】]+$/, '') || ''
const platformFor = (url: string) => {
  let host = ''
  try { host = new URL(url).hostname.toLowerCase() } catch {}
  if (/xiaohongshu|xhslink/.test(host)) return '小红书'
  if (/douyin/.test(host)) return '抖音'
  if (/bilibili|b23\.tv/.test(host)) return 'B站'
  if (/douban/.test(host)) return '豆瓣'
  if (/meituan/.test(host)) return '美团'
  if (/ele\.me|eleme/.test(host)) return '饿了么'
  if (/music\.163/.test(host)) return '网易云音乐'
  if (/y\.qq/.test(host)) return 'QQ音乐'
  return host || '未知平台'
}

const calculate = (expression: string) => {
  const source = expression.replace(/\s+/g, '')
  if (!source || !/^[\d.+\-*/%()]+$/.test(source)) throw new Error('算式只能包含数字、括号和加减乘除。')
  const tokens = source.match(/\d*\.\d+|\d+|[()+\-*/%]/g) || []
  const values: number[] = []
  const ops: string[] = []
  const priority: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2 }
  const apply = () => {
    const op = ops.pop()!
    const b = values.pop()!
    const a = values.pop()!
    if ((op === '/' || op === '%') && b === 0) throw new Error('不能除以零。')
    values.push(op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : op === '/' ? a / b : a % b)
  }
  let previous = 'start'
  for (const token of tokens) {
    if (/^\d/.test(token) || token.startsWith('.')) { values.push(Number(token)); previous = 'number'; continue }
    if (token === '(') { ops.push(token); previous = '('; continue }
    if (token === ')') { while (ops.length && ops.at(-1) !== '(') apply(); if (ops.pop() !== '(') throw new Error('括号不匹配。'); previous = ')'; continue }
    if ((token === '+' || token === '-') && (previous === 'start' || previous === '(' || previous === 'operator')) values.push(0)
    while (ops.length && ops.at(-1) !== '(' && priority[ops.at(-1)!] >= priority[token]) apply()
    ops.push(token); previous = 'operator'
  }
  while (ops.length) { if (ops.at(-1) === '(') throw new Error('括号不匹配。'); apply() }
  if (values.length !== 1 || !Number.isFinite(values[0])) throw new Error('算式格式不正确。')
  return values[0]
}

const readSharedLife = () => {
  try { return JSON.parse(localStorage.getItem(SHARED_LIFE_KEY) || '{"links":[],"deliveries":[]}') } catch { return { links: [], deliveries: [] } }
}

const callLocalTool = async (connectionId: string, name: string, args: Record<string, unknown>): Promise<McpToolExecutionResult> => {
  if (connectionId === 'local-context' && name === 'current_time') {
    const now = new Date()
    return { content: JSON.stringify({ iso: now.toISOString(), local: now.toLocaleString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, language: navigator.language }) }
  }
  if (connectionId === 'local-context' && name === 'inspect_shared_link') {
    const url = extractUrl(String(args.text || ''))
    if (!url) throw new Error('分享文本中没有找到可识别的网址。')
    return { content: JSON.stringify({ url, platform: platformFor(url), note: '这里只识别链接平台；读取正文需要启用对应远程 MCP。' }) }
  }
  if (connectionId === 'local-context' && name === 'calculate') return { content: String(calculate(String(args.expression || ''))) }
  const data = readSharedLife()
  if (connectionId === 'local-shared-life' && name === 'save_shared_link') {
    const url = extractUrl(String(args.url || '')) || String(args.url || '')
    data.links.unshift({ id: `link_${Date.now()}`, url, title: String(args.title || '未命名链接'), category: String(args.category || platformFor(url)), note: String(args.note || ''), createdAt: Date.now() })
    data.links = data.links.slice(0, 200)
    localStorage.setItem(SHARED_LIFE_KEY, JSON.stringify(data))
    return { content: '已保存到共同收藏。' }
  }
  if (connectionId === 'local-shared-life' && name === 'list_shared_links') {
    const category = String(args.category || '').trim()
    return { content: JSON.stringify((data.links || []).filter((item: any) => !category || item.category === category).slice(0, 30)) }
  }
  if (connectionId === 'local-shared-life' && name === 'create_virtual_delivery') {
    const order = { id: `delivery_${Date.now()}`, restaurant: String(args.restaurant || ''), items: Array.isArray(args.items) ? args.items.map(String) : [], total: Number(args.total) || 0, message: String(args.message || ''), status: '商家已接单', virtual: true, createdAt: Date.now() }
    data.deliveries.unshift(order)
    data.deliveries = data.deliveries.slice(0, 80)
    localStorage.setItem(SHARED_LIFE_KEY, JSON.stringify(data))
    return { content: JSON.stringify(order) }
  }
  if (connectionId === 'local-shared-life' && name === 'list_virtual_deliveries') return { content: JSON.stringify((data.deliveries || []).slice(0, 20)) }
  throw new Error('未找到对应的本机能力。')
}

export const executeMcpModelTool = async (modelName: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<McpToolExecutionResult> => {
  if (!mcpSettings.enabled) throw new Error('MCP 总开关未开启。')
  const found = mcpConnections.filter(connection => connection.enabled).flatMap(connection => connection.tools.map(tool => ({ connection, tool })))
    .find(item => item.tool.enabled && qualifiedName(item.connection, item.tool) === modelName)
  if (!found) throw new Error('该工具未启用或已被移除。')
  const startedAt = Date.now()
  if (found.tool.risk !== 'read') {
    const approved = await requestMcpApproval({ connectionName: found.connection.name, toolName: found.tool.name, risk: found.tool.risk, arguments: args })
    if (!approved) {
      addMcpActivity({ connectionId: found.connection.id, connectionName: found.connection.name, toolName: found.tool.name, summary: '用户拒绝了本次操作', status: 'denied' })
      throw new Error('用户拒绝了本次工具调用。')
    }
  }
  try {
    const result = found.connection.kind === 'local'
      ? await callLocalTool(found.connection.id, found.tool.name, args)
      : await callMcpRemoteTool(found.connection, found.tool.name, args, signal)
    addMcpActivity({ connectionId: found.connection.id, connectionName: found.connection.name, toolName: found.tool.name, summary: result.isError ? '工具返回错误' : '调用完成', status: result.isError ? 'error' : 'success', durationMs: Date.now() - startedAt })
    return result
  } catch (error: any) {
    addMcpActivity({ connectionId: found.connection.id, connectionName: found.connection.name, toolName: found.tool.name, summary: error?.message || '调用失败', status: 'error', durationMs: Date.now() - startedAt })
    throw error
  }
}
