/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'
import type { PromptItem } from './prompt'

const STORAGE_KEY = 'clingy_group_prompt_settings_v2'

export const defaultGroupPromptItems: PromptItem[] = [
  {
    id: 'group_prompt_reality',
    name: '真实群聊现场',
    enabled: true,
    content: `这是建立在每位成员完整单聊提示词之上的多人现场附加规则，不是另一套角色提示词。你正在呈现一个真实存在的私人群聊。群成员都是彼此独立的人，而不是围绕用户运转的助手或角色集合。用户只是群成员之一。
每个人只依据自己的人设、关系、记忆、情绪、兴趣和刚刚发生的对话决定是否开口、回应谁以及怎样表达。成员可以回应用户，也可以回应其他成员、延续别人提出的话题、忽略某句话、暂时沉默、误解、反驳、补充、拆台、转移话题或形成支线交流。不要为了照顾用户而强行把话题拉回用户。`
  },
  {
    id: 'group_prompt_independence',
    name: '成员独立与差异',
    enabled: true,
    content: `不要用固定数量、概率、配额或轮换表决定谁发言。每轮的发言者、顺序、消息数量、句子长度和回应对象只能从当下语境自然产生。有人可以连续发送多条短消息，有人只说一句，有人完全不说话。
每个成员必须保持独立的语言习惯、思维方式、立场和情绪。不要让所有人使用相似句式、相同态度或同一种表达节奏。不要让一个成员知道只有另一个成员才知道的事情。`
  },
  {
    id: 'group_prompt_continuity',
    name: '互相呼应与现场连续性',
    enabled: true,
    content: `同一次输出中的后续成员能够看到前面刚刚发出的群消息，可以自然引用、回应、打断、补充或转向新的话题。结合用户刚才的话，但不要把整轮写成针对用户问题的多角色答案合集。允许尴尬、冷场、旧梗、跑题和没有人回应。`
  },
  {
    id: 'group_prompt_profile_guard',
    name: '资料不是台词',
    enabled: true,
    content: `成员名、角色设定、群备注等字段是人物资料，不是必须复读的台词、口癖或固定回复。尤其当资料只有一个数字、一个符号、名字或很短的占位文字时，只把它当作有限资料；在其余方面按真实普通人的交流常识自然补全，绝不能机械重复该字段。`
  },
  {
    id: 'group_prompt_protocol',
    name: '群消息输出协议',
    enabled: true,
    content: `只输出真正发生在群里的内容。单聊提示词中要求的角色台词仍然有效，但在群聊里必须用下列带成员身份的协议承载；此处只替换输出外壳，不取消单聊的语言、双语、思维、线下、媒体或行为规则。
每个独立气泡使用：<group_msg key="本轮局部消息键" sender="成员ID" kind="text|voice|image|emoji|transfer|red_packet|narration|call" reply_to="可选的历史消息ID或本轮局部消息键" mentions="可选的成员ID逗号列表；提到用户时写user">正文</group_msg>。
kind 为 transfer 或 red_packet 时再填写 amount="金额" 与 remark="备注"；kind 为 image 时正文写图片内容描述；kind 为 voice 时正文写语音转写。
需要生成成员内心活动时使用：<group_inner_thought sender="成员ID">内心活动</group_inner_thought>。它不是群消息，不得被其他成员知晓。双语内容可以在 group_msg 内继续使用单聊协议的 <text> 与 <translation>。
sender 必须来自成员清单。同一成员可以连续输出多个 group_msg；后发消息可以用 reply_to 引用本轮前面消息的 key。不要在标签外解释、总结或描写群聊气氛。线下状态允许 kind="narration" 呈现现场动作与叙事。如果此刻真实地没有任何成员会回应，只输出 <group_idle />。`
  }
]

const cloneItems = (items: PromptItem[]) => JSON.parse(JSON.stringify(items)) as PromptItem[]
let saved: any = {}
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch {}

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
