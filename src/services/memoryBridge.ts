/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { buildMemoryPacket, normalizeMemoryMode } from './memoryEngine'
import { estimateTextTokens } from '../utils/tokenEstimate'

export interface MemoryBridgeDirectionConfig {
  shortTermEnabled: boolean
  shortTermValue: number
  longTermEnabled: boolean
  longTermTokenBudget: number
}

export interface MemoryBridgeConfig {
  groupToSingle: MemoryBridgeDirectionConfig
  singleToGroup: MemoryBridgeDirectionConfig
}

const clampInteger = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback
}

const normalizeDirection = (raw: any, shortTermFallback: number): MemoryBridgeDirectionConfig => ({
  shortTermEnabled: raw?.shortTermEnabled !== false,
  shortTermValue: clampInteger(raw?.shortTermValue, 1, 200, shortTermFallback),
  longTermEnabled: raw?.longTermEnabled !== false,
  longTermTokenBudget: clampInteger(raw?.longTermTokenBudget, 200, 4000, 600)
})

export const normalizeMemoryBridgeConfig = (raw: any): MemoryBridgeConfig => ({
  groupToSingle: normalizeDirection(raw?.groupToSingle, 20),
  singleToGroup: normalizeDirection(raw?.singleToGroup, 10)
})

export const normalizeMemoryBridgeMemberSettings = (raw: any) => ({
  ...(raw && typeof raw === 'object' ? raw : {}),
  enableMemoryBridge: raw?.enableMemoryBridge === true,
  memoryBridgeConfig: normalizeMemoryBridgeConfig(raw?.memoryBridgeConfig)
})

const escapeXml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const describeMessage = (message: any) => {
  if (message.imageData || message.messageType === 'image') return `[图片：${message.imageData?.text || message.imageData?.summary || message.imageData?.description || message.content || '无描述'}]`
  if (message.voiceData || message.messageType === 'voice') return `[语音：${message.voiceData?.text || message.content || '无转写'}]`
  if (message.isEmoji || message.messageType === 'emoji') return `[表情包：${message.emojiData?.name || message.emojiSummary || message.content || '未命名'}]`
  if (message.transferData || message.messageType === 'transfer' || message.messageType === 'red_packet') return `[${(message.transferData?.type || message.messageType) === 'transfer' ? '转账' : '红包'} ¥${message.transferData?.amount || ''}，${message.transferData?.remark || message.content || ''}]`
  if (message.callData || message.messageType === 'call') return `[${message.callData?.callType === 'video' ? '视频' : '语音'}通话：${message.content || ''}]`
  return String(message.content || '')
}

const timestampLabel = (message: any) => {
  const timestamp = Number(message?.timestamp || message?.id)
  if (!Number.isFinite(timestamp) || timestamp < 1000000000000) return ''
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

const isBridgeMessage = (message: any) => (
  message &&
  ['left', 'right', 'system', 'narration'].includes(message.type) &&
  message.isRecalled !== true &&
  message.isUndelivered !== true &&
  message.managementEvent?.type !== 'level_up'
)

const recentMessages = (messages: any[], count: number) => (Array.isArray(messages) ? messages : [])
  .filter(isBridgeMessage)
  .slice(-clampInteger(count, 1, 200, 20))

const formatGroupRecentContext = (group: any, count: number) => recentMessages(group.messages, count).map(message => {
  const senderId = String(message.senderId || '')
  const senderName = message.type === 'right'
    ? (group.userProfile?.name || '用户')
    : message.type === 'system'
      ? '系统通知'
      : (group.memberNicknames?.[senderId] || group.memoryMemberNames?.[senderId] || message.senderNameSnapshot || '群成员')
  const time = timestampLabel(message)
  return `${time ? `[${time}] ` : ''}${escapeXml(senderName)}：${escapeXml(describeMessage(message)).slice(0, 1600)}`
}).join('\n')

const formatSingleRecentContext = (chat: any, count: number) => recentMessages(chat.messages, count).map(message => {
  const senderName = message.type === 'right'
    ? (chat.userProfile?.name || '用户')
    : message.type === 'system'
      ? '系统通知'
      : (chat.name || '角色')
  const time = timestampLabel(message)
  return `${time ? `[${time}] ` : ''}${escapeXml(senderName)}：${escapeXml(describeMessage(message)).slice(0, 1600)}`
}).join('\n')

const appendWithinBudget = (parts: string[], text: string, tokenBudget: number) => {
  if (!text.trim()) return
  const current = estimateTextTokens(parts.join('\n\n'))
  if (current >= tokenBudget) return
  if (current + estimateTextTokens(text) <= tokenBudget) {
    parts.push(text)
    return
  }
  const remaining = tokenBudget - current
  if (remaining < 80) return
  parts.push(`${text.slice(0, Math.max(80, remaining))}\n[互通上下文已按总预算截断]`)
}

export const buildGroupToSingleBridgeContext = async (
  groups: any[],
  characterEntityId: string,
  query: string,
  totalTokenBudget = 6000
) => {
  const linkedGroups = (Array.isArray(groups) ? groups : [])
    .filter(group => group?.chatType === 'group' && group.memberIds?.map(String).includes(String(characterEntityId)) && group.memberSettings?.[characterEntityId]?.enableMemoryBridge === true)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
  const parts: string[] = []
  for (const group of linkedGroups) {
    const config = normalizeMemoryBridgeConfig(group.memberSettings?.[characterEntityId]?.memoryBridgeConfig).groupToSingle
    const groupParts: string[] = []
    if (config.longTermEnabled) {
      const source = normalizeMemoryMode(group.memoryMode) === 'long_text'
        ? {
            id: `${group.id}:member:${characterEntityId}`,
            memoryMode: 'long_text',
            memoryBook: group.memberMemories?.[characterEntityId] || [],
            memoryState: null
          }
        : group
      const longTerm = await buildMemoryPacket(source, query, config.longTermTokenBudget)
      if (longTerm) groupParts.push(`【长期主观记忆】${longTerm}`)
    }
    if (config.shortTermEnabled) {
      const shortTerm = formatGroupRecentContext(group, config.shortTermValue)
      if (shortTerm) groupParts.push(`【近期公开上下文 · 最近 ${config.shortTermValue} 条以内】\n${shortTerm}`)
    }
    if (groupParts.length) appendWithinBudget(parts, `<group_memory_bridge group_id="${escapeXml(group.id)}" group_name="${escapeXml(group.name || '未命名群聊')}">\n${groupParts.join('\n\n')}\n</group_memory_bridge>`, totalTokenBudget)
  }
  if (!parts.length) return ''
  return `\n\n【群聊与单聊记忆互通】\n以下内容来自该角色已授权互通的群聊。它们是角色自身经历过的跨场景记忆；注意区分来源群聊，不得把不同群的事件混为一谈。\n${parts.join('\n\n')}`
}

export const buildSingleToGroupBridgeContext = async (group: any, member: any, memberId: string, query: string) => {
  const memberSettings = group?.memberSettings?.[memberId]
  if (memberSettings?.enableMemoryBridge !== true) return ''
  const config = normalizeMemoryBridgeConfig(memberSettings.memoryBridgeConfig).singleToGroup
  const parts: string[] = []
  const totalTokenBudget = Math.min(6000, Math.max(1200, config.longTermTokenBudget + 2500))
  if (config.longTermEnabled) {
    const longTerm = await buildMemoryPacket(member, query, config.longTermTokenBudget)
    if (longTerm) appendWithinBudget(parts, `【与用户单聊形成的长期记忆】${longTerm}`, totalTokenBudget)
  }
  if (config.shortTermEnabled) {
    const shortTerm = formatSingleRecentContext(member, config.shortTermValue)
    if (shortTerm) appendWithinBudget(parts, `【与用户的近期单聊 · 最近 ${config.shortTermValue} 条以内】\n${shortTerm}`, totalTokenBudget)
  }
  if (!parts.length) return ''
  return `【仅属于${group.memberNicknames?.[memberId] || member.name || memberId}的单聊记忆】\n${parts.join('\n\n')}\n这些内容只代表该成员自己的私下认知。其他群成员并不知道；不得把它写成群共同经历，也不得让其他成员据此作出反应。该成员可以依照自身性格决定是否以及如何在群里提及。`
}
