/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { sendChatMessage } from './api'
import { buildPromptVariableGuide, findUnknownPromptVariables, type PromptVariableScope } from './promptVariables'
import type { PromptItem, PromptLanguage, PromptPresetId, PromptScheme } from '../store/prompt'

export interface GeneratedPromptPayload {
  name: string
  description: string
  basePresetId: PromptPresetId
  mode: 'items' | 'full'
  items: PromptItem[]
  fullText: string
}

export interface GeneratedOfflinePromptPayload {
  name: string
  description: string
  mainPrompt: string
  modePrompt: string
  postHistoryPrompt: string
}

const extractJson = (content: string) => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = (fenced || content).trim()
  try { return JSON.parse(candidate) } catch {}
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1))
  throw new Error('AI 没有返回可识别的 JSON。')
}

const normalizeGenerated = (raw: any, fallbackBase: PromptPresetId): GeneratedPromptPayload => {
  const mode = raw?.mode === 'full' ? 'full' : 'items'
  const items = Array.isArray(raw?.items) ? raw.items.map((item: any, index: number) => ({
    id: `custom_prompt_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 5)}`,
    name: String(item?.name || `提示词条目 ${index + 1}`).trim(),
    content: String(item?.content || '').trim(),
    enabled: item?.enabled !== false
  })).filter((item: PromptItem) => item.content) : []
  const fullText = String(raw?.fullText || '').trim()
  if (mode === 'items' && !items.length) throw new Error('AI 返回的方案没有有效条目。')
  if (mode === 'full' && !fullText) throw new Error('AI 返回的全文提示词为空。')
  return {
    name: String(raw?.name || 'AI 生成方案').trim().slice(0, 40),
    description: String(raw?.description || '由 AI 生成的自定义提示词方案').trim().slice(0, 160),
    basePresetId: raw?.basePresetId === 'v1' ? 'v1' : fallbackBase,
    mode,
    items,
    fullText
  }
}

export const buildPromptGenerationGuide = (
  scope: PromptVariableScope,
  language: PromptLanguage,
  basePresetId: PromptPresetId,
  current?: PromptScheme
) => `你正在为“粘人精”应用生成一套${scope === 'offline' ? '线下面对面互动' : '常规聊天'}提示词方案。

目标语言：${language === 'en' ? '英文系统指令' : '简体中文系统指令'}
运行兼容基底：${basePresetId.toUpperCase()}

可用变量（变量名必须原样保留，禁止创造未列出的变量）：
${buildPromptVariableGuide(scope)}

请只返回一个 JSON 对象，不要 Markdown，不要解释。结构必须是：
{
  "name": "方案名称",
  "description": "方案用途",
  "basePresetId": "${basePresetId}",
  "mode": "items",
  "items": [
    { "name": "条目名称", "content": "提示词正文", "enabled": true }
  ],
  "fullText": ""
}

要求：
1. mode 可以是 items 或 full；items 模式填写 items，full 模式填写 fullText。
2. 不要输出应用无法解析的新功能标签，不要伪造不存在的变量。
3. 明确区分角色与用户，不替用户决定言行、思想、感受或同意。
4. 保持具体、可执行，避免互相冲突和重复规则。
5. 方案会先作为新副本预览，绝不能要求覆盖官方预设。
${current ? `\n当前参考方案（仅供优化，不要逐字照抄）：\n${JSON.stringify(current.variants[language], null, 2)}` : ''}`

export const parseGeneratedPromptPayload = (content: string, basePresetId: PromptPresetId, scope: PromptVariableScope = 'global') => {
  const normalized = normalizeGenerated(extractJson(content), basePresetId)
  const allText = normalized.mode === 'full' ? normalized.fullText : normalized.items.map(item => item.content).join('\n')
  const unknownVariables = findUnknownPromptVariables(allText, scope)
  return { payload: normalized, unknownVariables }
}

export const generatePromptSchemeOnline = async (options: {
  requirement: string
  language: PromptLanguage
  basePresetId: PromptPresetId
  scope?: PromptVariableScope
  current?: PromptScheme
  signal?: AbortSignal
}) => {
  const scope = options.scope || 'global'
  const guide = buildPromptGenerationGuide(scope, options.language, options.basePresetId, options.current)
  const response = await sendChatMessage([
    { role: 'system', content: '你是提示词方案编辑器。严格按照用户提供的 JSON 结构输出，不要输出解释或 Markdown。' },
    { role: 'user', content: `${guide}\n\n用户的具体要求：\n${options.requirement.trim() || '生成一套自然、稳定、长期使用的方案。'}` }
  ], options.signal, false, false, 'prompt-generation')
  if (response.truncated) throw new Error('模型输出达到上限，请缩短要求或提高 API 最大输出。')
  return parseGeneratedPromptPayload(response.content, options.basePresetId, scope)
}

export const buildOfflinePromptGenerationGuide = (language: PromptLanguage, current?: {
  mainPrompt: string
  modePrompt: string
  postHistoryPrompt: string
}) => `你正在为“粘人精”应用生成一套线下面对面互动提示词预设。
目标语言：${language === 'en' ? '英文系统指令' : '简体中文系统指令'}

可用变量（必须原样保留）：
${buildPromptVariableGuide('offline')}

只返回 JSON，不要 Markdown 或解释：
{
  "name": "预设名称",
  "description": "用途说明",
  "mainPrompt": "定义本轮主要任务",
  "modePrompt": "定义面对面互动、动作、距离、环境与连续性",
  "postHistoryPrompt": "放在聊天历史之后的最终回复规则"
}

必须满足：只生成角色的下一次回应；不得替用户说话、行动、思考、感受或选择；保持人物、地点、时间和物品连续；不得创造未列出的变量。
${current ? `\n当前预设仅供优化参考：\n${JSON.stringify(current, null, 2)}` : ''}`

export const parseGeneratedOfflinePrompt = (content: string) => {
  const raw = extractJson(content)
  const payload: GeneratedOfflinePromptPayload = {
    name: String(raw?.name || 'AI 线下预设').trim().slice(0, 40),
    description: String(raw?.description || '由 AI 生成的线下互动预设').trim().slice(0, 160),
    mainPrompt: String(raw?.mainPrompt || '').trim(),
    modePrompt: String(raw?.modePrompt || '').trim(),
    postHistoryPrompt: String(raw?.postHistoryPrompt || '').trim()
  }
  if (!payload.mainPrompt || !payload.modePrompt || !payload.postHistoryPrompt) throw new Error('AI 返回的线下预设缺少主要任务、线下模式或回复规则。')
  const unknownVariables = findUnknownPromptVariables(`${payload.mainPrompt}\n${payload.modePrompt}\n${payload.postHistoryPrompt}`, 'offline')
  return { payload, unknownVariables }
}

export const generateOfflinePromptOnline = async (options: {
  requirement: string
  language: PromptLanguage
  current?: { mainPrompt: string; modePrompt: string; postHistoryPrompt: string }
  signal?: AbortSignal
}) => {
  const guide = buildOfflinePromptGenerationGuide(options.language, options.current)
  const response = await sendChatMessage([
    { role: 'system', content: '你是线下互动提示词编辑器。只返回符合要求的 JSON。' },
    { role: 'user', content: `${guide}\n\n用户要求：\n${options.requirement.trim() || '生成自然、稳定、不替用户作主的线下互动预设。'}` }
  ], options.signal, false, false, 'prompt-generation')
  if (response.truncated) throw new Error('模型输出达到上限，请缩短要求或提高 API 最大输出。')
  return parseGeneratedOfflinePrompt(response.content)
}
