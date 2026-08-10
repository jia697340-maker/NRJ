/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { sendChatMessage } from './api'
import type { CharacterDraft, CharacterGenerationInput } from '../types/characterWorkshop'
import { globalPromptSettings } from '../store'

const extractJson = (text: string) => {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型没有返回可解析的角色数据，请重试当前阶段。')
  try { return JSON.parse(cleaned.slice(start, end + 1)) }
  catch { throw new Error('角色数据结构不完整，可能发生了输出截断，请重试当前阶段。') }
}

const inputSummary = (input: CharacterGenerationInput) => {
  if (input.mode === 'instant') return '自由创造一个不落俗套、适合长期聊天的现代角色。避免万能温柔、外冷内热等常见模板。'
  if (input.mode === 'keywords') return `关键词：${input.keywords.join('、')}。把关键词转化为有因果关系的人格，不要逐个机械表演标签。`
  if (input.mode === 'fandom') return `同人来源：${input.fandomSource}；目标角色：${input.fandomCharacter}；改编程度：${input.divergence}；原作锚点：${input.canonText || '未提供'}；补充要求：${input.prompt || '无'}。锚点是不可覆盖的事实，资料不足处保持未知，不捏造原作事实。`
  if (input.mode === 'dialogue') return `根据以下对话样本反推一个可长期演绎的角色。对话背景：${input.dialogueContext || '未说明'}。样本：${input.dialogueText}。区分稳定表达规律与当时情绪，不把偶发语气词变成固定口癖。`
  if (input.mode === 'guided') return `姓名：${input.guided.name || '待定'}；年龄：${input.guided.age || '待定'}；身份：${input.guided.identity || '待定'}；初始关系：${input.guided.relationship || '待定'}；性格想法：${input.guided.personality || '待定'}；边界：${input.guided.boundaries || '待定'}；补充：${input.prompt || '无'}。保留用户已填写事实。`
  return input.prompt
}

const stageSystem = `你是角色设计师，任务是设计可长期稳定演绎、拥有独立生活的人物，不是写华丽的人设作文。
只返回一个合法 JSON 对象，不要 Markdown、解释或思考过程。所有字段使用自然中文。
避免万能式温柔、无条件讨好、每件事都上升感情、机械口语词、固定反问、标签堆砌。资料不足时合理留白。`

const englishStageSystem = `You are a character designer. Design a person who can be portrayed consistently over the long term and has an independent life; do not write an ornate profile essay.
Return exactly one valid JSON object with no Markdown, explanation, or reasoning. Write every natural-language field in idiomatic Simplified Chinese.
Avoid universally gentle personalities, unconditional appeasement, turning every event into romance, mechanical filler words, fixed follow-up questions, and piles of labels. Leave reasonable unknowns when information is insufficient.`

const mergeUnlocked = (draft: CharacterDraft, patch: Record<string, any>) => {
  for (const [key, value] of Object.entries(patch)) {
    if (draft.lockedFields.includes(key) || value === undefined || value === null) continue
    if (key === 'samples' && Array.isArray(value)) draft.samples = value.slice(0, 8)
    else if (key in draft && typeof value !== 'object') (draft as any)[key] = String(value)
  }
  draft.updatedAt = Date.now()
}

export const runCharacterJson = async (instruction: string, purpose: 'character-generation' | 'character-review-global' = 'character-generation') => {
  const response = await sendChatMessage([
    { role: 'system', content: globalPromptSettings.language === 'en' ? englishStageSystem : stageSystem },
    { role: 'user', content: instruction }
  ], undefined, false, false, purpose)
  if (response.truncated) throw new Error('模型达到输出上限，已保留前面完成的阶段。请重试当前阶段，或提高角色生成节点的最大输出。')
  return extractJson(response.content)
}

export async function generateCharacterByStages(
  draft: CharacterDraft,
  input: CharacterGenerationInput,
  onProgress: (stage: number, label: string) => void
) {
  const brief = inputSummary(input)
  const resumeStage = draft.status !== 'ready' && draft.sourcePrompt === brief ? draft.completedGenerationStage : 0
  if (resumeStage === 0) draft.completedGenerationStage = 0
  draft.sourcePrompt = brief
  const stages = globalPromptSettings.language === 'en' ? [
    {
      label: '建立人物骨架',
      prompt: `Build the character's foundation from these requirements: ${brief}\nReturn fields: name, tagline, age, identity, world, core, desire, fear, contradiction, lifestyle. Keep every field concise but concrete.`
    },
    {
      label: '塑造表达与边界',
      prompt: () => `Character foundation: ${JSON.stringify({ name: draft.name, age: draft.age, identity: draft.identity, core: draft.core, contradiction: draft.contradiction })}\nReturn fields: voice, verbalHabits, antiPatterns, boundaries, knowledgeLimits. voice describes speech rhythm and information density; antiPatterns explicitly prohibit canned machine-like phrases.`
    },
    {
      label: '建立关系行为',
      prompt: () => `Character: ${JSON.stringify({ name: draft.name, core: draft.core, desire: draft.desire, fear: draft.fear, boundaries: draft.boundaries })}\nReturn fields: relationship, conflictStyle, careStyle, independence. The relationship must be able to develop slowly; care appears through concrete behavior; preserve the character's own life.`
    },
    {
      label: '完成对白试演',
      prompt: () => `Write natural dialogue samples for this character: ${JSON.stringify({ name: draft.name, identity: draft.identity, voice: draft.voice, relationship: draft.relationship, antiPatterns: draft.antiPatterns })}\nReturn openingLine and samples. samples is an array of 6 objects with scene, user, and character fields, covering casual conversation, silence, disagreement, comfort, a long reply delay, and discussion of a third party. Vary line length; do not end every sample with a question or elevate every topic into the relationship.`
    }
  ] : [
    {
      label: '建立人物骨架',
      prompt: `根据需求建立人物骨架：${brief}\n返回字段：name, tagline, age, identity, world, core, desire, fear, contradiction, lifestyle。每个字段简洁但具体。`
    },
    {
      label: '塑造表达与边界',
      prompt: () => `基于人物骨架：${JSON.stringify({ name: draft.name, age: draft.age, identity: draft.identity, core: draft.core, contradiction: draft.contradiction })}\n返回字段：voice, verbalHabits, antiPatterns, boundaries, knowledgeLimits。voice 描述语言节奏与信息密度；antiPatterns 明确禁止的机器式套话。`
    },
    {
      label: '建立关系行为',
      prompt: () => `基于角色：${JSON.stringify({ name: draft.name, core: draft.core, desire: draft.desire, fear: draft.fear, boundaries: draft.boundaries })}\n返回字段：relationship, conflictStyle, careStyle, independence。关系必须能缓慢发展，关心通过具体行为体现，并保留角色自己的生活。`
    },
    {
      label: '完成对白试演',
      prompt: () => `为以下角色写自然对话样本：${JSON.stringify({ name: draft.name, identity: draft.identity, voice: draft.voice, relationship: draft.relationship, antiPatterns: draft.antiPatterns })}\n返回字段 openingLine 和 samples。samples 是 6 个对象的数组，每项包含 scene,user,character，覆盖闲聊、冷场、意见不同、安慰、久未回复、谈论第三方。台词长短应有变化，不要每条都反问或升华关系。`
    }
  ]
  for (let index = resumeStage; index < stages.length; index++) {
    onProgress(index + 1, stages[index].label)
    const prompt = stages[index].prompt
    const instruction = typeof prompt === 'function' ? prompt() : prompt
    mergeUnlocked(draft, await runCharacterJson(instruction))
    draft.completedGenerationStage = index + 1
  }
  draft.keywords = [...input.keywords]
  if (input.mode === 'fandom') {
    draft.canonAnchors = input.canonText.split(/\n+/).map(line => line.trim()).filter(Boolean).map((content, index) => ({
      id: `anchor_${Date.now()}_${index}`, type: 'fact' as const, title: `原作锚点 ${index + 1}`, content
    }))
  }
  draft.status = 'ready'
  return draft
}

export async function refineCharacter(draft: CharacterDraft, instruction: string) {
  const current = { ...draft, versions: undefined, lockedFields: undefined }
  const prompt = globalPromptSettings.language === 'en'
    ? `Current character profile: ${JSON.stringify(current)}\nUser request: ${instruction}\nReturn only top-level fields that need modification. Do not modify user-locked fields or mix change explanations into field content. Keep natural-language field values in Simplified Chinese.`
    : `这是当前角色档案：${JSON.stringify(current)}\n用户要求：${instruction}\n只返回需要修改的顶层字段。不得修改用户锁定字段；不要把修改说明混进字段内容。`
  const patch = await runCharacterJson(prompt)
  mergeUnlocked(draft, patch)
  return draft
}

export const compileCharacterPersona = (draft: CharacterDraft) => [
  `【基础身份】\n${draft.name}，${[draft.age, draft.identity].filter(Boolean).join('，')}。${draft.world}`,
  `【人格内核】\n${draft.core}\n核心欲望：${draft.desire}\n恐惧与软肋：${draft.fear}\n内在矛盾：${draft.contradiction}`,
  `【独立生活】\n${draft.lifestyle}\n${draft.independence}`,
  `【与用户的关系】\n${draft.relationship}\n表达关心：${draft.careStyle}\n处理冲突：${draft.conflictStyle}`,
  `【表达方式】\n${draft.voice}\n习惯：${draft.verbalHabits}\n禁止模式：${draft.antiPatterns}`,
  `【边界与认知】\n${draft.boundaries}\n知识边界：${draft.knowledgeLimits}`,
  draft.samples.length ? `【对白参考（学习规律，不逐句复读）】\n${draft.samples.map(item => `${item.scene}\n用户：${item.user}\n${draft.name}：${item.character}`).join('\n\n')}` : ''
].filter(Boolean).join('\n\n')
