/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'
import { readStoredJSON } from './utils'
import type { PromptItem } from './prompt'

const TASK_PROMPT_STORAGE_KEY = 'clingy_task_prompt_settings'
const savedTaskPromptSettings = readStoredJSON<Record<string, any>>(TASK_PROMPT_STORAGE_KEY, {})

export const defaultTaskPromptItems: PromptItem[] = [
  {
    id: 'task_video_call_decision_system',
    name: '视频/语音通话 - 接听决策 (系统)',
    content: `[系统指令]\n你现在需要扮演【{{char_name}}】，正在处理一个是否接听视频/语音通话的决策。\n这仅仅是一个简单的分类判定任务，请不要输出多余的解释、对话或表情符号。\n\n【你的名字】：{{char_name}}\n【你的设定】：{{char_persona}}\n\n【对方的名字】：{{user_name}}\n【对方的设定】：{{user_persona}}\n\n【长期记忆】：\n{{long_term_memory}}\n\n【短期聊天记录】：\n{{short_term_memory}}`,
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
    content: `请你作为一个总结助手，对以下这部分通话记录进行简明扼要的提要总结。\n要求：\n1. 提炼出关键讨论点和当前进展。\n2. 必须以第三人称客观视角书写。\n3. 字数控制在50-150字以内。\n\n{{optional_previous_summary}}\n【新的聊天记录】：\n{{new_messages}}`,
    enabled: true
  },
  {
    id: 'task_video_call_final_summary',
    name: '视频/语音通话 - 最终档案总结',
    content: `你是一个专业的对话总结助手。刚刚完成了一段通话，请根据提供的【前半段通话提要】(如果有) 以及【通话结尾的对话明细】，为本次完整的通话生成一份第三人称的档案总结。\n这份总结将被存入长期记忆库中。\n\n要求：\n1. 以第三人称客观视角书写（例如：{{char_name}}和{{user_name}}通过通话讨论了...）。\n2. 提炼出本次通话的核心事件、作出的决定以及双方的情绪状态。\n3. 语言精炼，作为档案记录，字数控制在100-300字以内。\n\n{{optional_previous_summary}}\n{{remaining_messages}}`,
    enabled: true
  },
  {
    id: 'task_voice_call_status',
    name: '语音通话 - 状态强制设定',
    content: `\n\n【当前模式：语音通话】你们正在进行实时语音通话。请使用口语化表达，不要使用网络聊天时的颜文字、表情包标签或动作描写括号。`,
    enabled: true
  },
  {
    id: 'task_video_call_status',
    name: '视频通话 - 状态强制设定',
    content: `\n\n【当前模式：视频通话】你们正在进行实时视频通话。请严格区分你的“语言”和“动作/环境描写”：\n1. 语言：必须使用 <msg>说话内容</msg> 标签，且只能包含嘴上说出的话，绝对不要包含任何括号动作描写。\n2. 动作/环境/旁白：必须使用独立的 <narration>你的动作、表情或周围环境描写</narration> 标签，以第三人称或第一人称旁白形式客观输出。\n示例：\n<narration>我把镜头凑近了一些，仔细看着屏幕里的你。</narration>\n<msg>能听清我说话吗？</msg>`,
    enabled: true
  }
]

let initialTaskPromptItems = savedTaskPromptSettings.items || []
if (initialTaskPromptItems.length === 0) {
  initialTaskPromptItems = [...defaultTaskPromptItems]
} else {
  let needsSave = false
  // 补全缺失的任务提示词
  defaultTaskPromptItems.forEach(defaultItem => {
    const existing = initialTaskPromptItems.find((i: PromptItem) => i.id === defaultItem.id)
    if (!existing) {
      initialTaskPromptItems.push(defaultItem)
      needsSave = true
    } else {
      // 兼容性清理：如果旧用户的设定里包含了“不要发送图片...”这句话，自动帮他们抹除掉，防止触发白象效应
      if (existing.content.includes('不要发送图片、语音条、表情包或转账。')) {
        existing.content = existing.content.replace(/不要发送图片、语音条、表情包或转账。/g, '').trim()
        needsSave = true
      }
    }
  })
  if (needsSave) {
    localStorage.setItem(TASK_PROMPT_STORAGE_KEY, JSON.stringify({ items: initialTaskPromptItems }))
  }
}

export const taskPromptSettings = reactive({
  items: initialTaskPromptItems as PromptItem[]
})

watch(taskPromptSettings, (newVal) => {
  localStorage.setItem(TASK_PROMPT_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })
