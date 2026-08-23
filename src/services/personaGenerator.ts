/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { sendChatMessage } from './api'
import type { PersonaDraft, PersonaGenerationInput, PersonaHealthReport } from '../types/personaWorkshop'

const extractJson = (text: string) => {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型没有返回可解析的人设数据，请重试。')
  try { return JSON.parse(cleaned.slice(start, end + 1)) }
  catch { throw new Error('人设数据结构不完整，可能发生了输出截断，请重试。') }
}

const systemPrompt = `你是用户人设档案设计师。你的任务是帮助用户准确表达自己，以便聊天角色理解用户，而不是替用户扮演、决定感受或强迫其他角色作出反应。
只返回一个合法 JSON 对象，不要 Markdown、解释或思考过程。所有自然语言字段使用简体中文。
现实自我模式不得虚构职业、年龄、家庭、创伤、关系、行动、情绪、同意或承诺；资料不足必须写入 unknowns 或留空。剧情身份模式可以创作，但仍不得规定其他角色必然爱慕、服从或认同用户。
把稳定特质与暂时情绪分开，把用户事实与互动偏好分开。避免标签堆砌、完美主角化和关系绑架。`

const runJson = async (instruction: string, signal?: AbortSignal) => {
  const response = await sendChatMessage([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: instruction }
  ], signal, false, false, 'character-generation')
  if (response.truncated) throw new Error('模型达到输出上限，请提高角色生成节点的最大输出或重试。')
  return extractJson(response.content)
}

const summarizeInput = (input: PersonaGenerationInput) => {
  const kindRule = input.kind === 'self' ? '这是现实自我，只整理明确提供的事实，不得补造人生经历。' : '这是剧情身份，可以根据方向补全合理的虚构设定。'
  if (input.mode === 'keywords') return `${kindRule}\n关键词：${input.keywords.join('、')}。将标签转化为有条件、有例外的稳定倾向。`
  if (input.mode === 'dialogue') return `${kindRule}\n从用户本人说过的话中提取稳定表达和判断倾向。背景：${input.dialogueContext || '未说明'}。样本：${input.dialogueText}。不要把单次情绪、对话对象的设定或偶发口癖当成人格事实。`
  if (input.mode === 'guided') return `${kindRule}\n姓名：${input.guided.name || '未知'}；年龄：${input.guided.age || '未知'}；身份：${input.guided.identity || '未知'}；性格：${input.guided.personality || '未说明'}；生活：${input.guided.life || '未说明'}；边界：${input.guided.boundaries || '未说明'}；补充：${input.prompt || '无'}。`
  if (input.mode === 'interview') return `${kindRule}\n用户的自我描述：${input.interview.selfView || '未回答'}；重视的事：${input.interview.importantThings || '未回答'}；日常生活：${input.interview.dailyLife || '未回答'}；亲近方式：${input.interview.closeness || '未回答'}；冲突反应：${input.interview.conflict || '未回答'}；最常被误解之处：${input.interview.misunderstood || '未回答'}。`
  if (input.mode === 'inspiration') return '创建一个适合长期剧情互动的虚构用户身份。人物应有自己的生活、局限和矛盾，不完美，不规定其他角色的反应。' + (input.prompt ? `方向：${input.prompt}` : '')
  return `${kindRule}\n用户描述：${input.prompt}`
}

const mergeUnlocked = (draft: PersonaDraft, patch: Record<string, any>) => {
  for (const [key, value] of Object.entries(patch)) {
    if (draft.lockedFields.includes(key) || value === undefined || value === null) continue
    if (key === 'understandingSamples' && Array.isArray(value)) draft.understandingSamples = value.slice(0, 6)
    else if (key in draft && typeof value !== 'object') (draft as any)[key] = String(value)
  }
  draft.updatedAt = Date.now()
}

export async function generatePersonaByStages(draft: PersonaDraft, input: PersonaGenerationInput, onProgress: (stage: number, label: string) => void, signal?: AbortSignal) {
  const brief = summarizeInput(input)
  const resume = draft.sourcePrompt === brief && draft.status !== 'ready' ? draft.completedGenerationStage : 0
  if (!resume) draft.completedGenerationStage = 0
  draft.sourcePrompt = brief
  const stages = [
    { label: '整理身份与生活', prompt: `根据以下材料整理用户档案：${brief}\n返回字段 name, networkName, tagline, age, pronouns, identity, world, lifestyle, interests。没有依据的现实事实留空。` },
    { label: '辨认人格内核', prompt: () => `基于已有档案：${JSON.stringify({ name: draft.name, identity: draft.identity, lifestyle: draft.lifestyle, source: brief })}\n返回字段 core, values, goals, vulnerabilities, contradiction。描述稳定倾向及例外，不诊断用户。` },
    { label: '建立理解边界', prompt: () => `基于档案：${JSON.stringify({ core: draft.core, values: draft.values, vulnerabilities: draft.vulnerabilities, source: brief })}\n返回字段 voice, socialDistance, carePreference, conflictStyle, boundaries, sensitivities, unknowns, antiAssumptions。antiAssumptions 必须明确禁止替用户补写感受、行动、同意和承诺。` }
  ]
  for (let index = resume; index < stages.length; index++) {
    onProgress(index + 1, stages[index].label)
    const prompt = stages[index].prompt
    mergeUnlocked(draft, await runJson(typeof prompt === 'function' ? prompt() : prompt, signal))
    draft.completedGenerationStage = index + 1
  }
  draft.kind = input.kind
  draft.mode = input.mode
  draft.keywords = [...input.keywords]
  draft.status = 'ready'
  return draft
}

export async function refinePersona(draft: PersonaDraft, instruction: string, signal?: AbortSignal) {
  const current = { ...draft, versions: undefined, lockedFields: undefined }
  const patch = await runJson(`当前用户人设：${JSON.stringify(current)}\n修改要求：${instruction}\n只返回需要修改的顶层字段。不得修改锁定字段，不要把修改说明写进档案。现实自我不得补造用户未提供的事实。`, signal)
  mergeUnlocked(draft, patch)
}

export async function inspectPersona(draft: PersonaDraft, signal?: AbortSignal): Promise<PersonaHealthReport> {
  const result = await runJson(`检查以下用户人设是否容易导致聊天角色误读用户：${JSON.stringify({ ...draft, versions: undefined, healthReport: undefined })}\n检查身份矛盾、标签堆砌、暂时情绪永久化、关系内容污染、强迫他人反应、替用户决定感受或同意、隐私暴露、未知项缺失和完美主角化。返回 score(0-100), summary, strengths 字符串数组, issues 数组；issues 每项包含 category, severity(low|medium|high), title, detail, suggestion。`, signal)
  return { createdAt: Date.now(), score: Math.max(0, Math.min(100, Number(result.score) || 0)), summary: String(result.summary || ''), strengths: Array.isArray(result.strengths) ? result.strengths.map(String).slice(0, 6) : [], issues: Array.isArray(result.issues) ? result.issues.slice(0, 10) : [] }
}

export async function simulatePersonaUnderstanding(draft: PersonaDraft, signal?: AbortSignal) {
  const result = await runJson(`根据以下用户人设，模拟聊天角色在六种场景中可能如何理解用户，而不是替用户说话：${JSON.stringify({ ...draft, versions: undefined, healthReport: undefined, understandingSamples: undefined })}\n返回 understandingSamples 数组，每项包含 scene, likelyUnderstanding, guardrail。覆盖初次认识、情绪低落、意见不合、用户拒绝、资料未知、群聊。guardrail 指出角色应避免的擅自推断。`, signal)
  return Array.isArray(result.understandingSamples) ? result.understandingSamples.slice(0, 6) : []
}

export const compilePersona = (draft: PersonaDraft) => [
  `【身份资料】\n${[draft.name, draft.age, draft.pronouns, draft.identity].filter(Boolean).join('，') || '未提供明确身份资料'}${draft.world ? `。所处背景：${draft.world}` : ''}`,
  draft.core || draft.values || draft.goals ? `【人格与生活】\n${[draft.core, draft.values && `重视：${draft.values}`, draft.goals && `目标：${draft.goals}`, draft.contradiction && `内在矛盾：${draft.contradiction}`, draft.lifestyle, draft.interests && `兴趣：${draft.interests}`].filter(Boolean).join('\n')}` : '',
  draft.voice || draft.socialDistance || draft.carePreference || draft.conflictStyle ? `【互动方式】\n${[draft.voice, draft.socialDistance, draft.carePreference, draft.conflictStyle].filter(Boolean).join('\n')}` : '',
  draft.boundaries || draft.sensitivities ? `【边界与敏感点】\n${[draft.boundaries, draft.sensitivities].filter(Boolean).join('\n')}` : '',
  `【理解边界】\n${[draft.unknowns && `仍然未知：${draft.unknowns}`, draft.antiAssumptions || '不得替用户补写未表达的感受、行动、同意或承诺。'].filter(Boolean).join('\n')}`
].filter(Boolean).join('\n\n')
