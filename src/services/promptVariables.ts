/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type PromptVariableScope = 'global' | 'offline' | 'task'

export interface PromptVariableDefinition {
  key: string
  token: string
  name: string
  description: string
  example: string
  scopes: PromptVariableScope[]
}

export const promptVariableCatalog: PromptVariableDefinition[] = [
  { key: 'char_name', token: '{{char_name}}', name: '角色名称', description: '当前会话中的角色名称', example: '林屿', scopes: ['global', 'offline', 'task'] },
  { key: 'user_name', token: '{{user_name}}', name: '用户名称', description: '当前生效的用户身份名称', example: '小满', scopes: ['global', 'offline', 'task'] },
  { key: 'char_persona', token: '{{char_persona}}', name: '角色人设', description: '角色的完整人物设定', example: '独立、克制，有自己的工作与生活', scopes: ['global', 'task'] },
  { key: 'user_persona', token: '{{user_persona}}', name: '用户人设', description: '当前生效的用户人物设定', example: '喜欢摄影，最近在准备考试', scopes: ['global', 'task'] },
  { key: 'world_book', token: '{{world_book}}', name: '世界书', description: '当前会话绑定且启用的世界书条目', example: '故事发生在临海城市……', scopes: ['global'] },
  { key: 'time_context', token: '{{time_context}}', name: '时间上下文', description: '双方时区、当前时间及时间感知规则', example: '角色当地时间：2026-08-12 21:30', scopes: ['global'] },
  { key: 'role_emojis', token: '{{role_emojis}}', name: '可用表情包', description: '角色当前能够发送的表情包名称列表', example: '点头、抱抱、装死', scopes: ['global'] },
  { key: 'format_rules', token: '{{format_rules}}', name: '输出格式', description: '依据聊天、通话或线下状态动态生成的输出协议', example: '<msg>角色真正说出口的话</msg>', scopes: ['global'] },
  { key: 'status_panel', token: '{{status_panel}}', name: '状态面板', description: '双方当前公开状态与沉浸式状态说明', example: '角色状态：刚下班', scopes: ['global'] },
  { key: 'long_term_memory', token: '{{long_term_memory}}', name: '长期记忆', description: '任务触发时提供的长期记忆内容', example: '双方上周约定一起看展', scopes: ['task'] },
  { key: 'short_term_memory', token: '{{short_term_memory}}', name: '短期记录', description: '任务触发时提供的近期聊天记录', example: '最近若干轮消息', scopes: ['task'] },
  { key: 'optional_previous_summary', token: '{{optional_previous_summary}}', name: '已有摘要', description: '存在时提供的上一阶段摘要', example: '前半段通话主要讨论了……', scopes: ['task'] },
  { key: 'new_messages', token: '{{new_messages}}', name: '新增消息', description: '本次需要继续总结的新消息', example: '本阶段新增的通话记录', scopes: ['task'] },
  { key: 'remaining_messages', token: '{{remaining_messages}}', name: '剩余消息', description: '最终总结阶段尚未归档的消息', example: '通话结尾的对话明细', scopes: ['task'] }
]

export const getPromptVariables = (scope: PromptVariableScope) => promptVariableCatalog.filter(item => item.scopes.includes(scope))

export const resolvePromptVariables = (content: string, values: Record<string, string>) => {
  let resolved = String(content || '')
  for (const [key, value] of Object.entries(values)) resolved = resolved.split(`{{${key}}}`).join(value)
  return resolved
}

export const findUnknownPromptVariables = (content: string, scope: PromptVariableScope) => {
  const supported = new Set(getPromptVariables(scope).map(item => item.token))
  const found = content.match(/\{\{[a-zA-Z0-9_]+\}\}/g) || []
  return [...new Set(found.filter(token => !supported.has(token)))]
}

export const buildPromptVariableGuide = (scope: PromptVariableScope) => getPromptVariables(scope)
  .map(item => `${item.token}｜${item.name}：${item.description}（示例：${item.example}）`)
  .join('\n')
