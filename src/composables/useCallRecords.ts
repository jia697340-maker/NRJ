/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { chatSettings } from '../store'

// declined: 用户主动拒接；timeout: 响铃到自动挂断都没人接；blocked: 手机没响（免打扰或用户不在房间）
export type MissedCallKind = 'declined' | 'timeout' | 'blocked'

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

export const isInDoNotDisturb = () => {
  const start = chatSettings.dndStart
  const end = chatSettings.dndEnd
  if (!start || !end) return false

  const s = toMinutes(start)
  const e = toMinutes(end)
  if (s === null || e === null || s === e) return false

  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  // 跨零点的时段（如 23:00 - 07:00）需要反向判定
  return s < e ? (cur >= s && cur < e) : (cur >= s || cur < e)
}

const formatRecordDate = () => {
  const now = new Date()
  return now.toLocaleDateString('zh-CN') + ' ' + now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 接通后塞给模型的隐形旁白，让它知道这通电话是自己拨出的、以及为什么拨
export const buildIncomingCallAcceptedNotice = (charName: string, userName: string, reason: string, speakFirst = false) => {
  let notice = `电话已接通，${charName} 与 ${userName} 开始语音通话。这通电话是 ${charName} 主动拨给 ${userName} 的，${userName} 接听了。`
  if (reason) {
    notice += `\n${charName} 拨打这通电话的原因是：${reason}`
  }
  notice += `\n接下来请使用符合电话交流的口语化表达，不要使用网络聊天时的颜文字、表情包或动作描写。${charName} 的回复应该像真人通电话一样自然、连贯。`
  if (speakFirst) {
    notice += `\n${userName} 刚接起电话还没说话，现在请 ${charName} 先开口说第一句。`
  }
  return notice
}

const missedNarrations: Record<MissedCallKind, string> = {
  declined: '{char}给{user}打了电话，但{user}直接拒接了。',
  timeout: '{char}给{user}打了电话，一直响到自动挂断，{user}都没有接听。',
  blocked: '{char}给{user}打了电话，但{user}的手机当时没有响起来（可能在忙或者开了免打扰），这通电话{user}并没有接到。'
}

const missedLabels: Record<MissedCallKind, string> = {
  declined: '对方已拒接',
  timeout: '对方未接听',
  blocked: '对方未接到'
}

/**
 * 把一通没能接通的角色来电落进消息流：
 * 一条可见的通话记录气泡（左侧，代表呼入）+ 一条隐形旁白（让模型知道自己被拒/被漏接）。
 * 同时补一条通话记录档案，方便在通话记录页里看到未接来电。
 * 调用方负责后续的 saveCustomContacts / 滚动 / 通知。
 */
export const appendMissedIncomingCall = (
  chat: any,
  userName: string,
  reason: string,
  kind: MissedCallKind
) => {
  const charName = chat?.name || '角色'
  if (!chat) return
  if (!chat.messages) chat.messages = []

  const label = missedLabels[kind]
  const baseId = Date.now()

  chat.messages.push({
    id: baseId,
    type: 'left',
    content: '未接来电',
    isCallRecord: true,
    duration: label,
    callData: {
      status: 'canceled',
      duration: label,
      direction: 'in',
      missed: true,
      reason
    }
  })

  chat.messages.push({
    id: baseId + 1,
    type: 'system',
    content: missedNarrations[kind].replace(/\{user\}/g, userName || '对方').replace(/\{char\}/g, charName),
    isHidden: true
  })

  if (!chat.callSummaries) chat.callSummaries = []
  chat.callSummaries.push({
    id: baseId + 2,
    date: formatRecordDate(),
    duration: label,
    direction: 'in',
    missed: true,
    content: reason ? `未接来电。对方拨打的原因：${reason}` : '未接来电。',
    rawMessages: []
  })
}

/**
 * 双方已经在通话中，角色却又拨了一次号：只留一条隐形旁白纠正它。
 * 这个分支只可能发生在角色和用户本人的通话里（跟别的联系人通话时会走 blocked 降级），
 * 所以不能写成“对方占线”，否则模型会以为用户在跟第三个人打电话。
 * 这里不能插可见气泡，否则它会被当成本次通话内的消息，挂断时被剔除并混进通话总结。
 * 打上 isVoiceCallProcessMsg 标记，挂断后它不会再污染普通文字聊天的上下文。
 */
export const appendBusyLineNotice = (chat: any, userName: string, reason: string) => {
  if (!chat) return
  if (!chat.messages) chat.messages = []

  const charName = chat.name || '角色'
  let notice = `${charName}和${userName || '对方'}此刻正在通话中，所以${charName}的这个拨号动作没有生效，不需要再拨一次。`
  if (reason) {
    notice += `\n${charName}原本想拨这通电话的原因是：${reason}。这些话可以直接在当前通话里说。`
  }

  chat.messages.push({
    id: Date.now(),
    type: 'system',
    content: notice,
    isHidden: true,
    isVoiceCallProcessMsg: true
  })
}
