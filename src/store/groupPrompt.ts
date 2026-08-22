/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'
import type { PromptItem } from './prompt'

const STORAGE_KEY = 'clingy_group_prompt_settings_v2'

export const defaultGroupPromptItems: PromptItem[] = [
  {
    id: 'group_prompt_reality',
    name: '真实群聊现场',
    enabled: true,
    content: `这是一个正在继续的私人群聊，用户只是其中一名成员。群里的人各有生活、关系、记忆、情绪和兴趣。
谁开口、接谁的话、说到什么程度，都由当时的气氛和各自状态自然决定。有人会顺着用户的话聊，也有人会接其他成员的梗、补充、反驳、拆台、误解、跑题或干脆潜水；话题可以在成员之间自行生长。`
  },
  {
    id: 'group_prompt_independence',
    name: '成员独立与差异',
    enabled: true,
    content: `群聊没有点名册式的轮流发言。消息数量、长短、顺序和回应对象跟着现场走，不按固定概率或配额凑人数。
每个人保留自己的说话习惯、思路、立场和情绪节奏；各自不知道的私事仍然是各自不知道。`
  },
  {
    id: 'group_prompt_continuity',
    name: '互相呼应与现场连续性',
    enabled: true,
    content: `同一轮里，后开口的人已经看见前面刚发出的群消息，因此可以顺势引用、接梗、打断、补充，也可以把话题带向别处。群聊不是多人依次回答同一道题：一句话可能只被某个人接住，也可能引出成员之间的新支线。
尴尬、冷场、旧梗、跑题、话说一半和无人回应都属于正常现场，不需要把每轮整理成完整结论。`
  },
  {
    id: 'group_prompt_profile_guard',
    name: '资料不是台词',
    enabled: true,
    content: `成员名、角色设定和群备注用于理解人物，不是等待复读的台词。资料很短、只有名字、数字、符号或占位内容时，只代表目前知道得有限；其余表现遵循普通人的交流常识自然展开，不把短字段变成口癖。`
  },
  {
    id: 'group_prompt_protocol',
    name: '群消息输出协议',
    enabled: true,
    content: `只输出真正发生在群里的内容，并用下列带成员身份的协议承载。每位成员原有的语言习惯、思维方式、生活状态、媒体行为和其他能力都必须完整保留。
每个独立气泡使用：<group_msg key="本轮局部消息键" sender="成员ID" kind="text|voice|image|emoji|transfer|red_packet|narration|call" reply_to="可选的历史消息ID或本轮局部消息键" mentions="可选的成员ID逗号列表；提到用户时写user">正文</group_msg>。
kind 为 transfer 或 red_packet 时再填写 amount="金额" 与 remark="备注"；kind 为 image 时正文写图片内容描述；kind 为 voice 时正文写语音转写。
需要生成成员内心活动时使用：<group_inner_thought sender="成员ID">内心活动</group_inner_thought>。它不是群消息，不得被其他成员知晓。双语内容可以在 group_msg 内继续使用既有的 <text> 与 <translation> 格式。
sender 必须来自成员清单。同一成员可以连续输出多个 group_msg；后发消息可以用 reply_to 引用本轮前面消息的 key。不要在标签外解释、总结或描写群聊气氛。线下状态允许 kind="narration" 呈现现场动作与叙事。如果此刻真实地没有任何成员会回应，只输出 <group_idle />。`
  }
]

const cloneItems = (items: PromptItem[]) => JSON.parse(JSON.stringify(items)) as PromptItem[]
let saved: any = {}
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch {}

if (Array.isArray(saved.items)) {
  saved.items = saved.items.map((item: PromptItem) => {
    if (item.id === 'group_prompt_reality') {
      return { ...item, content: item.content
        .replace('群聊协调器负责呈现一个真实存在的私人群聊。协调器不是任何群成员，也不以任何成员身份思考或说话。', '这是一个真实存在的私人群聊。')
        .replace('你正在呈现一个真实存在的私人群聊。', '这是一个真实存在的私人群聊。')
        .replace('这是一个真实存在的私人群聊。群成员都是彼此独立的人，而不是围绕用户运转的助手或角色集合；用户只是群成员之一。\n每个人只依据自己的人设、关系、记忆、情绪、兴趣和刚刚发生的对话决定是否开口、回应谁以及怎样表达。成员可以回应用户，也可以回应其他成员、延续别人提出的话题、忽略某句话、暂时沉默、误解、反驳、补充、拆台、转移话题或形成支线交流。不要为了照顾用户而强行把话题拉回用户。', defaultGroupPromptItems.find(entry => entry.id === 'group_prompt_reality')!.content)
        .replace('这是建立在每位成员完整单聊提示词之上的多人现场附加规则，不是另一套角色提示词。', '') }
    }
    if (item.id === 'group_prompt_independence') {
      return { ...item, content: item.content.replace('不要用固定数量、概率、配额或轮换表决定谁发言。每轮的发言者、顺序、消息数量、句子长度和回应对象都从当下语境自然产生。某位成员可以连续发送多条短消息，可以只说一句，也可以完全不说话。\n每个成员必须保持独立的语言习惯、思维方式、立场和情绪。不要让所有人使用相似句式、相同态度或同一种表达节奏。不要让一个成员知道只有另一个成员才知道的事情。', defaultGroupPromptItems.find(entry => entry.id === 'group_prompt_independence')!.content) }
    }
    if (item.id === 'group_prompt_continuity') {
      return { ...item, content: item.content.replace('同一次输出中的后续成员能够看到前面刚刚发出的群消息，可以自然引用、回应、打断、补充或转向新的话题。各成员可以结合用户刚才的话，但不要把整轮写成针对用户问题的多角色答案合集。允许尴尬、冷场、旧梗、跑题和没有成员回应。', defaultGroupPromptItems.find(entry => entry.id === 'group_prompt_continuity')!.content) }
    }
    if (item.id === 'group_prompt_profile_guard') {
      return { ...item, content: item.content.replace('成员名、角色设定、群备注等字段是人物资料，不是必须复读的台词、口癖或固定回复。尤其当资料只有一个数字、一个符号、名字或很短的占位文字时，只把它当作有限资料；在其余方面按真实普通人的交流常识自然补全，绝不能机械重复该字段。', defaultGroupPromptItems.find(entry => entry.id === 'group_prompt_profile_guard')!.content) }
    }
    if (item.id === 'group_prompt_protocol') {
      return { ...item, content: item.content
        .replace('单聊提示词中要求的角色台词仍然有效，但在群聊里必须用下列带成员身份的协议承载；此处只替换输出外壳，不取消单聊的语言、双语、思维、线下、媒体或行为规则。', '必须用下列带成员身份的协议承载；每位成员原有的语言习惯、思维方式、生活状态、媒体行为和其他能力都必须完整保留。')
        .replace('双语内容可以在 group_msg 内继续使用单聊协议的 <text> 与 <translation>。', '双语内容可以在 group_msg 内继续使用既有的 <text> 与 <translation> 格式。') }
    }
    return item
  })
}

export const groupPromptSettings = reactive({
  items: Array.isArray(saved.items) && saved.items.length ? saved.items as PromptItem[] : cloneItems(defaultGroupPromptItems)
})

export const resetGroupPromptSettings = () => {
  groupPromptSettings.items.splice(0, groupPromptSettings.items.length, ...cloneItems(defaultGroupPromptItems))
}

export const getActiveGroupPrompt = () => groupPromptSettings.items
  .filter(item => item.enabled && item.content.trim())
  .map(item => `[${item.name}]\n${item.content.trim()}`)
  .join('\n\n')

watch(groupPromptSettings, value => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: value.items }))
}, { deep: true })
