/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'
import { readStoredJSON } from './utils'
import { globalPromptSettings, type PromptItem, type PromptLanguage } from './prompt'
import { buildEnglishTaskPromptItems } from './taskPromptEnglish'

const TASK_PROMPT_STORAGE_KEY = 'clingy_task_prompt_settings'
const savedTaskPromptSettings = readStoredJSON<Record<string, any>>(TASK_PROMPT_STORAGE_KEY, {})

export const defaultTaskPromptItems: PromptItem[] = [
  {
    id: 'task_video_call_decision_system',
    name: '视频/语音通话 - 接听决策 (系统)',
    content: `[任务]\n判断角色{{char_name}}是否会接听用户{{user_name}}此刻发起的视频或语音通话。只进行这次选择，不续写对话，也不输出解释或表情符号。\n\n【角色{{char_name}}的设定】\n{{char_persona}}\n\n【用户{{user_name}}的资料】\n{{user_persona}}\n\n【长期记忆】\n{{long_term_memory}}\n\n【近期聊天】\n{{short_term_memory}}`,
    enabled: true
  },
  {
    id: 'task_video_call_decision_user',
    name: '视频/语音通话 - 接听决策 (用户)',
    content: `[当前事件]\n{{user_name}} 正在向 {{char_name}} 发起实时通话请求。\n请完全根据上述 {{char_name}} 的设定、{{user_name}} 的设定，以及最近的聊天记录上下文，自主判断 {{char_name}} 现在是否接听这个通话。\n\n[输出格式要求]\n请且仅请输出一段合法的 JSON，不要附带任何其他字符。\n- 接听：返回 {"decision": "accept"}\n- 挂断：返回 {"decision": "reject"}`,
    enabled: true
  },
  {
    id: 'task_video_call_temp_summary',
    name: '视频/语音通话 - 阶段性临时总结',
    content: `【通话阶段提要】\n将以下通话记录整理成简明提要：\n1. 提炼关键讨论点和当前进展。\n2. 以第三人称客观书写。\n3. 字数控制在50-150字以内。\n\n{{optional_previous_summary}}\n【新的聊天记录】：\n{{new_messages}}`,
    enabled: true
  },
  {
    id: 'task_video_call_final_summary',
    name: '视频/语音通话 - 最终档案总结',
    content: `【完整通话档案】\n根据【前半段通话提要】（如有）与【通话结尾的对话明细】，生成本次完整通话的第三人称档案总结。该总结将存入长期记忆。\n\n要求：\n1. 以第三人称客观书写（例如：{{char_name}}和{{user_name}}通过通话讨论了……）。\n2. 提炼核心事件、双方作出的决定与情绪状态。\n3. 语言精炼，字数控制在100-300字以内。\n\n{{optional_previous_summary}}\n{{remaining_messages}}`,
    enabled: true
  },
  {
    id: 'task_voice_call_status',
    name: '语音通话 - 状态强制设定',
    content: `\n\n【当前模式：语音通话】角色{{char_name}}与用户{{user_name}}正在实时通话。角色{{char_name}}使用自然口语，不使用网络聊天中的颜文字、表情包标签或动作描写括号。`,
    enabled: true
  },
  {
    id: 'task_video_call_status',
    name: '视频通话 - 状态强制设定',
    content: `\n\n【当前模式：视频通话】{{char_name}}与{{user_name}}正在进行实时视频通话。请严格区分{{char_name}}的“语言”和“动作/环境描写”：\n1. 语言：必须使用 <msg>说话内容</msg> 标签，且只能包含嘴上说出的话，绝对不要包含任何括号动作描写。\n2. 动作/环境/旁白：必须使用独立的 <narration>动作、表情或周围环境描写</narration> 标签，并以第三人称客观输出。涉及人物时必须使用 {{char_name}}、{{user_name}} 等明确姓名，不得使用“我”“你”等第一、第二人称代词。\n示例：\n<narration>{{char_name}}把镜头凑近了一些，仔细看着屏幕里的{{user_name}}。</narration>\n<msg>能听清我说话吗？</msg>`,
    enabled: true
  }
]

export const defaultTaskPromptItemsEn = buildEnglishTaskPromptItems(defaultTaskPromptItems)
export const taskSystemPromptItemIds = new Set(defaultTaskPromptItems.map(item => item.id))

const cloneItems = (items: PromptItem[]) => JSON.parse(JSON.stringify(items)) as PromptItem[]
const defaultsForLanguage = (language: PromptLanguage) => cloneItems(language === 'en' ? defaultTaskPromptItemsEn : defaultTaskPromptItems)
const legacyItems = Array.isArray(savedTaskPromptSettings.items) ? savedTaskPromptSettings.items as PromptItem[] : []
const customItems = legacyItems.filter(item => !taskSystemPromptItemIds.has(item.id))
const savedLanguageItems = savedTaskPromptSettings.itemsByLanguage && typeof savedTaskPromptSettings.itemsByLanguage === 'object'
  ? savedTaskPromptSettings.itemsByLanguage as Record<PromptLanguage, PromptItem[]>
  : {} as Record<PromptLanguage, PromptItem[]>

const hydrate = (language: PromptLanguage, stored?: PromptItem[]) => {
  const defaults = defaultsForLanguage(language)
  const result = Array.isArray(stored) && stored.length ? cloneItems(stored) : defaults
  for (const item of result) {
    if (typeof item.content === 'string') {
      item.content = item.content.replace(/不要发送图片、语音条、表情包或转账。/g, '').trim()
      if (item.id === 'task_video_call_decision_system') {
        item.content = item.content
          .replace('当前任务执行器负责判断角色{{char_name}}是否接听用户{{user_name}}发起的视频或语音通话。任务执行器不是角色{{char_name}}、用户{{user_name}}或场景旁白，只执行分类判定。', '判断角色{{char_name}}是否会接听用户{{user_name}}此刻发起的视频或语音通话。只进行这次选择，不续写对话。')
          .replace('你现在需要扮演【{{char_name}}】，正在处理一个是否接听视频/语音通话的决策。', '判断角色{{char_name}}是否会接听用户{{user_name}}此刻发起的视频或语音通话。只进行这次选择，不续写对话。')
          .replace('【你的名字】：{{char_name}}', '【角色】：{{char_name}}')
          .replace('【你的设定】：{{char_persona}}', '【角色设定】：{{char_persona}}')
          .replace('【对方的名字】：{{user_name}}', '【用户】：{{user_name}}')
          .replace('【对方的设定】：{{user_persona}}', '【用户资料】：{{user_persona}}')
          .replace('The task executor decides whether the character {{char_name}} answers an incoming real-time video or voice call from the user {{user_name}}. The task executor is not {{char_name}}, {{user_name}}, or the scene narrator and performs only this classification task.', 'Decide whether the character {{char_name}} would answer the video or voice call that the user {{user_name}} is placing now. Make only this choice and do not continue the dialogue.')
          .replace('You are portraying {{char_name}} and must decide whether to answer an incoming real-time video or voice call.', 'Decide whether the character {{char_name}} would answer the video or voice call that the user {{user_name}} is placing now. Make only this choice and do not continue the dialogue.')
          .replace('[Your name]', '[Character]')
          .replace('[Your persona]', '[Character persona]')
          .replace("[Other person's name]", '[User]')
          .replace("[Other person's profile]", '[User profile]')
      }
      if (item.id === 'task_voice_call_status') {
        item.content = item.content
          .replace('【当前模式：语音通话】你们正在进行实时语音通话。请使用口语化表达，不要使用网络聊天时的颜文字、表情包标签或动作描写括号。', '【当前模式：语音通话】角色{{char_name}}与用户{{user_name}}正在实时通话。角色{{char_name}}使用自然口语，不使用网络聊天中的颜文字、表情包标签或动作描写括号。')
          .replace('You are in a real-time voice call. Use natural spoken language. Do not use kaomoji, sticker tags, or parenthetical action descriptions associated with text chat.', 'The character {{char_name}} and the user {{user_name}} are in a real-time voice call. {{char_name}} uses natural spoken language without kaomoji, sticker tags, or parenthetical action descriptions from text chat.')
      }
      if (item.id === 'task_video_call_status') {
        item.content = item.content
          .replace('<narration>你的动作、表情或周围环境描写</narration> 标签，以第三人称或第一人称旁白形式客观输出。', '<narration>动作、表情或周围环境描写</narration> 标签，并以第三人称客观输出。涉及人物时必须使用 {{char_name}}、{{user_name}} 等明确姓名，不得使用“我”“你”等第一、第二人称代词。')
          .replace('<narration>我把镜头凑近了一些，仔细看着屏幕里的你。</narration>', '<narration>{{char_name}}把镜头凑近了一些，仔细看着屏幕里的{{user_name}}。</narration>')
          .replace('<narration>your action, expression, or surrounding environment</narration>, written as natural first- or third-person narration.', '<narration>action, expression, or surrounding environment</narration>, written objectively in the third person. Refer to everyone by explicit name, such as {{char_name}} and {{user_name}}, rather than first- or second-person pronouns.')
          .replace('<narration>I move the camera a little closer and study you on the screen.</narration>', '<narration>{{char_name}} moves the camera a little closer and studies {{user_name}} on the screen.</narration>')
      }
    }
  }
  for (const item of defaults) if (!result.some(existing => existing.id === item.id)) result.push(item)
  for (const item of customItems) if (!result.some(existing => existing.id === item.id)) result.push(cloneItems([item])[0])
  return result
}

const initialLanguage = globalPromptSettings.language
const itemsByLanguage: Record<PromptLanguage, PromptItem[]> = {
  zh: hydrate('zh', savedLanguageItems.zh || (initialLanguage === 'zh' ? legacyItems : undefined)),
  en: hydrate('en', savedLanguageItems.en || (initialLanguage === 'en' ? legacyItems : undefined))
}

export const taskPromptSettings = reactive({
  items: cloneItems(itemsByLanguage[initialLanguage]),
  language: initialLanguage,
  itemsByLanguage
})

export const activateTaskPromptLanguage = (language: PromptLanguage, resetSystemItems = false) => {
  taskPromptSettings.itemsByLanguage[taskPromptSettings.language] = cloneItems(taskPromptSettings.items)
  const sharedCustom = cloneItems(taskPromptSettings.items.filter(item => !taskSystemPromptItemIds.has(item.id)))
  const stored = taskPromptSettings.itemsByLanguage[language]
  const systemItems = resetSystemItems || !stored
    ? defaultsForLanguage(language)
    : cloneItems(stored).filter(item => taskSystemPromptItemIds.has(item.id))
  taskPromptSettings.language = language
  taskPromptSettings.items = [...systemItems, ...sharedCustom]
  taskPromptSettings.itemsByLanguage[language] = cloneItems(taskPromptSettings.items)
}

watch(() => globalPromptSettings.language, language => {
  if (language !== taskPromptSettings.language) activateTaskPromptLanguage(language)
})

watch(taskPromptSettings, (newVal) => {
  const persisted = JSON.parse(JSON.stringify(newVal))
  persisted.itemsByLanguage[newVal.language] = cloneItems(newVal.items)
  localStorage.setItem(TASK_PROMPT_STORAGE_KEY, JSON.stringify(persisted))
}, { deep: true })
