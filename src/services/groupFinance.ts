/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { createIncomingWalletPayment, createOutgoingWalletPayment, resolveWalletPayment } from './walletService'

export type GroupFinanceFeature =
  | 'packet_lucky' | 'packet_equal' | 'packet_targeted'
  | 'packet_password' | 'packet_quiz' | 'packet_number' | 'packet_lottery' | 'packet_rain'
  | 'transfer_single' | 'transfer_batch_equal' | 'transfer_batch_custom'
  | 'collection_aa' | 'collection_custom'

export type GroupFinanceCategory = 'packet' | 'transfer' | 'collection'
export type GroupFinanceStatus = 'scheduled' | 'active' | 'partial' | 'completed' | 'cancelled' | 'expired'
export type GroupFinanceParticipantStatus = 'pending' | 'joined' | 'claimed' | 'paid' | 'rejected' | 'lost' | 'expired' | 'refunded'

export interface GroupFinanceSettings {
  enabled: boolean
  features: Record<GroupFinanceFeature, boolean>
  ledgerEnabled: boolean
}

export interface GroupFinanceAllocation {
  id: string
  memberId?: string
  amountCents: number
  status: GroupFinanceParticipantStatus
  claimedBy?: string
  resolvedAt?: number
  walletPaymentId?: string
  walletAccountId?: string
}

export interface GroupFinanceInteraction {
  id: string
  category: GroupFinanceCategory
  feature: GroupFinanceFeature
  creatorId: string
  creatorName: string
  targetIds: string[]
  amountCents: number
  count: number
  remark: string
  status: GroupFinanceStatus
  allocations: GroupFinanceAllocation[]
  participants: Record<string, GroupFinanceParticipantStatus>
  eligibility: { type: 'all' | 'targets'; memberIds: string[] }
  challenge?: { prompt?: string; answer?: string; min?: number; max?: number; secretNumber?: number }
  fundingSource?: 'balance' | 'credit' | 'bank_card'
  fundingSourceId?: string
  walletAccountId?: string
  createdAt: number
  expiresAt: number
  scheduledAt?: number
  revision: number
}

export interface GroupFinanceLedgerEntry {
  id: string
  interactionId: string
  kind: 'created' | 'claimed' | 'paid' | 'rejected' | 'expired' | 'refunded' | 'completed'
  actorId: string
  amountCents: number
  createdAt: number
  note: string
}

export interface GroupFinanceState {
  schemaVersion: 1
  interactions: GroupFinanceInteraction[]
  ledger: GroupFinanceLedgerEntry[]
}

export interface GroupFinanceEvent {
  eventId: string
  interactionId: string
  feature: GroupFinanceFeature
  category: GroupFinanceCategory
  action: 'claim' | 'pay' | 'reject' | 'join'
  actorId: string
  actorName: string
  creatorId: string
  creatorName: string
  allocationId?: string
  amountCents?: number
  createdAt: number
}

export const GROUP_FINANCE_FEATURES: Array<{ id: GroupFinanceFeature; label: string; category: GroupFinanceCategory }> = [
  { id: 'packet_lucky', label: '拼手气红包', category: 'packet' },
  { id: 'packet_equal', label: '等额红包', category: 'packet' },
  { id: 'packet_targeted', label: '定向红包', category: 'packet' },
  { id: 'packet_password', label: '口令红包', category: 'packet' },
  { id: 'packet_quiz', label: '答题红包', category: 'packet' },
  { id: 'packet_number', label: '猜数字', category: 'packet' },
  { id: 'packet_lottery', label: '定时抽奖', category: 'packet' },
  { id: 'packet_rain', label: '红包雨', category: 'packet' },
  { id: 'transfer_single', label: '指定成员转账', category: 'transfer' },
  { id: 'transfer_batch_equal', label: '批量等额转账', category: 'transfer' },
  { id: 'transfer_batch_custom', label: '批量分别金额', category: 'transfer' },
  { id: 'collection_aa', label: 'AA / 人均收款', category: 'collection' },
  { id: 'collection_custom', label: '分别金额收款', category: 'collection' }
]

export const defaultGroupFinanceSettings = (): GroupFinanceSettings => ({
  enabled: true,
  features: Object.fromEntries(GROUP_FINANCE_FEATURES.map(item => [item.id, item.id === 'packet_lucky' || item.id === 'transfer_single'])) as Record<GroupFinanceFeature, boolean>,
  ledgerEnabled: true
})

export const normalizeGroupFinanceSettings = (raw: any): GroupFinanceSettings => {
  const defaults = defaultGroupFinanceSettings()
  const features = { ...defaults.features }
  if (raw?.features && typeof raw.features === 'object') for (const item of GROUP_FINANCE_FEATURES) features[item.id] = raw.features[item.id] === true
  return { enabled: raw?.enabled === undefined ? defaults.enabled : raw.enabled === true, features, ledgerEnabled: raw?.ledgerEnabled !== false }
}

export const normalizeGroupFinanceState = (raw: any): GroupFinanceState => ({
  schemaVersion: 1,
  interactions: Array.isArray(raw?.interactions) ? raw.interactions : [],
  ledger: Array.isArray(raw?.ledger) ? raw.ledger : []
})

const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
const safeCents = (value: unknown) => Math.max(0, Math.round(Number(value) || 0))
const shuffled = <T>(input: T[]) => {
  const result = [...input]
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

const splitEqual = (total: number, count: number) => {
  const base = Math.floor(total / count)
  const extra = total - base * count
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0))
}

const splitLucky = (total: number, count: number) => {
  if (count <= 1) return [total]
  const weights = Array.from({ length: count }, () => -Math.log(Math.max(Number.EPSILON, Math.random())))
  const weightTotal = weights.reduce((sum, value) => sum + value, 0)
  const remaining = total - count
  const raw = weights.map(weight => remaining * weight / weightTotal)
  const cents = raw.map(value => 1 + Math.floor(value))
  let tail = total - cents.reduce((sum, value) => sum + value, 0)
  for (const index of shuffled(cents.map((_, index) => index))) {
    if (tail <= 0) break
    cents[index] += 1
    tail -= 1
  }
  return shuffled(cents)
}

const addLedger = (group: any, interaction: GroupFinanceInteraction, kind: GroupFinanceLedgerEntry['kind'], actorId: string, amountCents: number, note: string) => {
  if (group.groupFinanceSettings?.ledgerEnabled === false) return
  group.groupFinanceState.ledger.unshift({ id: uid('gf_ledger'), interactionId: interaction.id, kind, actorId, amountCents, createdAt: Date.now(), note })
}

const reserveAllocation = (allocation: GroupFinanceAllocation, input: any) => {
  if (input.creatorId !== 'user') return
  const payment = createOutgoingWalletPayment(input.walletAccountId || 'guest', allocation.amountCents, input.category === 'packet' ? 'red_packet' : 'transfer', input.remark, input.fundingSource, input.fundingSourceId)
  allocation.walletPaymentId = payment.id
  allocation.walletAccountId = input.walletAccountId || 'guest'
}

export const createGroupFinanceInteraction = (group: any, input: {
  feature: GroupFinanceFeature
  creatorId: string
  creatorName: string
  targetIds: string[]
  amountCents: number
  customAmounts?: Record<string, number>
  count?: number
  remark?: string
  expireHours?: number
  scheduledAt?: number
  challenge?: GroupFinanceInteraction['challenge']
  fundingSource?: 'balance' | 'credit' | 'bank_card'
  fundingSourceId?: string
  walletAccountId?: string
}) => {
  const settings = normalizeGroupFinanceSettings(group.groupFinanceSettings)
  if (!settings.enabled || !settings.features[input.feature]) throw new Error('当前群聊未开启该资金玩法')
  const definition = GROUP_FINANCE_FEATURES.find(item => item.id === input.feature)
  if (!definition) throw new Error('未知的群资金玩法')
  const targets = Array.from(new Set(input.targetIds.filter(Boolean)))
  const count = Math.max(1, Math.min(100, Math.floor(input.count || targets.length || 1)))
  const total = safeCents(input.amountCents)
  if (!total) throw new Error('金额必须大于 0')
  if (definition.category !== 'collection' && total < count) throw new Error('总金额不能小于份数')
  const custom = input.customAmounts || {}
  let allocations: GroupFinanceAllocation[] = []
  if (definition.category === 'collection') {
    if (!targets.length) throw new Error('请选择收款成员')
    const amounts = input.feature === 'collection_custom'
      ? targets.map(id => safeCents(custom[id]))
      : splitEqual(total, targets.length)
    if (amounts.some(value => value <= 0)) throw new Error('每位成员的金额都必须大于 0')
    allocations = targets.map((memberId, index) => ({ id: uid('gf_part'), memberId, amountCents: amounts[index], status: 'pending' }))
  } else if (input.feature === 'packet_lucky' || input.feature === 'packet_equal' || input.feature === 'packet_password' || input.feature === 'packet_quiz' || input.feature === 'packet_number' || input.feature === 'packet_lottery' || input.feature === 'packet_rain') {
    const amounts = input.feature === 'packet_equal' ? splitEqual(total, count) : splitLucky(total, count)
    allocations = amounts.map(amountCents => ({ id: uid('gf_part'), amountCents, status: 'pending' }))
  } else {
    if (!targets.length) throw new Error('请选择接收成员')
    const amounts = input.feature === 'transfer_batch_custom'
      ? targets.map(id => safeCents(custom[id]))
      : input.feature === 'packet_targeted' && Object.keys(custom).length
        ? targets.map(id => safeCents(custom[id]))
        : splitEqual(total, targets.length)
    if (amounts.some(value => value <= 0)) throw new Error('每位成员的金额都必须大于 0')
    allocations = targets.map((memberId, index) => ({ id: uid('gf_part'), memberId, amountCents: amounts[index], status: 'pending' }))
  }
  const interaction: GroupFinanceInteraction = {
    id: uid('gf'), category: definition.category, feature: input.feature,
    creatorId: input.creatorId, creatorName: input.creatorName, targetIds: targets,
    amountCents: allocations.reduce((sum, item) => sum + item.amountCents, 0), count: allocations.length,
    remark: String(input.remark || (definition.category === 'packet' ? '恭喜发财，大吉大利' : definition.category === 'collection' ? '群收款' : '群转账')).slice(0, 120),
    status: 'active', allocations,
    participants: {}, eligibility: { type: targets.length ? 'targets' : 'all', memberIds: targets }, challenge: input.challenge,
    fundingSource: input.fundingSource, fundingSourceId: input.fundingSourceId, walletAccountId: input.walletAccountId,
    createdAt: Date.now(), expiresAt: input.feature === 'packet_lottery' && input.scheduledAt ? input.scheduledAt : Date.now() + Math.max(1, Number(input.expireHours) || 24) * 3600000,
    scheduledAt: input.scheduledAt, revision: 1
  }
  group.groupFinanceState = normalizeGroupFinanceState(group.groupFinanceState)
  const reserved: GroupFinanceAllocation[] = []
  try {
    if (definition.category !== 'collection') for (const allocation of allocations) { reserveAllocation(allocation, { ...input, category: definition.category }); reserved.push(allocation) }
  } catch (error) {
    for (const allocation of reserved) if (allocation.walletPaymentId && allocation.walletAccountId) resolveWalletPayment(allocation.walletAccountId, allocation.walletPaymentId, 'rejected')
    throw error
  }
  group.groupFinanceState.interactions.unshift(interaction)
  addLedger(group, interaction, 'created', input.creatorId, interaction.amountCents, interaction.remark)
  return interaction
}

const canParticipate = (interaction: GroupFinanceInteraction, actorId: string) => {
  if (actorId === interaction.creatorId && interaction.category === 'packet') return false
  return interaction.eligibility.type === 'all' || interaction.eligibility.memberIds.includes(actorId)
}

const updateStatus = (interaction: GroupFinanceInteraction) => {
  const resolved = interaction.allocations.filter(item => ['claimed', 'paid', 'rejected', 'expired', 'refunded'].includes(item.status)).length
  const successful = interaction.allocations.filter(item => item.status === 'claimed' || item.status === 'paid').length
  interaction.status = resolved === interaction.allocations.length ? (successful ? 'completed' : 'expired') : resolved > 0 ? 'partial' : 'active'
  interaction.revision += 1
}

export const actOnGroupFinance = (group: any, input: { interactionId: string; actorId: string; action: 'claim' | 'pay' | 'reject' | 'join'; answer?: string; walletAccountId?: string }) => {
  const interaction: GroupFinanceInteraction | undefined = group.groupFinanceState?.interactions?.find((item: GroupFinanceInteraction) => item.id === input.interactionId)
  if (!interaction) return { ok: false as const, reason: 'missing' }
  if (interaction.expiresAt <= Date.now()) { settleExpiredGroupFinance(group); return { ok: false as const, reason: 'closed' } }
  if (!['active', 'partial'].includes(interaction.status)) return { ok: false as const, reason: 'closed' }
  if (!canParticipate(interaction, input.actorId)) return { ok: false as const, reason: 'ineligible' }
  if (interaction.participants[input.actorId] && interaction.participants[input.actorId] !== 'pending') return { ok: false as const, reason: 'duplicate' }
  const allowedActions = interaction.feature === 'packet_lottery'
    ? ['join']
    : interaction.category === 'collection'
      ? ['pay', 'reject']
      : interaction.category === 'transfer'
        ? ['claim', 'reject']
        : ['claim']
  if (!allowedActions.includes(input.action)) return { ok: false as const, reason: 'invalid_action' }
  if (input.action === 'join') {
    interaction.participants[input.actorId] = 'joined'; interaction.revision += 1
    return { ok: true as const, interaction, allocation: undefined }
  }
  let allocation = interaction.allocations.find(item => item.memberId === input.actorId && item.status === 'pending')
  if (!allocation && interaction.category === 'packet') allocation = interaction.allocations.find(item => !item.memberId && item.status === 'pending')
  if (!allocation) return { ok: false as const, reason: 'no_allocation' }
  if (interaction.feature === 'packet_password' || interaction.feature === 'packet_quiz') {
    if (String(input.answer || '').trim().toLocaleLowerCase() !== String(interaction.challenge?.answer || '').trim().toLocaleLowerCase()) return { ok: false as const, reason: 'wrong_answer' }
  }
  if (interaction.feature === 'packet_number') {
    if (Number(input.answer) !== Number(interaction.challenge?.secretNumber)) return { ok: false as const, reason: 'wrong_answer' }
  }
  if (input.action === 'reject') {
    allocation.status = 'rejected'; interaction.participants[input.actorId] = 'rejected'
    if (allocation.walletPaymentId && allocation.walletAccountId) resolveWalletPayment(allocation.walletAccountId, allocation.walletPaymentId, 'rejected')
    addLedger(group, interaction, 'rejected', input.actorId, allocation.amountCents, interaction.remark)
  } else if (interaction.category === 'collection' && input.action === 'pay') {
    if (input.actorId === 'user') {
      const payment = createOutgoingWalletPayment(input.walletAccountId || 'guest', allocation.amountCents, 'transfer', interaction.remark)
      resolveWalletPayment(input.walletAccountId || 'guest', payment.id, 'claimed')
    } else if (interaction.creatorId === 'user') {
      const payment = createIncomingWalletPayment(input.walletAccountId || 'guest', allocation.amountCents, 'transfer', interaction.remark)
      resolveWalletPayment(input.walletAccountId || 'guest', payment.id, 'claimed')
    }
    allocation.status = 'paid'; allocation.claimedBy = input.actorId; interaction.participants[input.actorId] = 'paid'
    addLedger(group, interaction, 'paid', input.actorId, allocation.amountCents, interaction.remark)
  } else {
    allocation.status = 'claimed'; allocation.memberId ||= input.actorId; allocation.claimedBy = input.actorId; interaction.participants[input.actorId] = 'claimed'
    if (allocation.walletPaymentId && allocation.walletAccountId) resolveWalletPayment(allocation.walletAccountId, allocation.walletPaymentId, 'claimed')
    else if (interaction.creatorId !== 'user' && input.actorId === 'user') {
      const payment = createIncomingWalletPayment(input.walletAccountId || 'guest', allocation.amountCents, interaction.category === 'packet' ? 'red_packet' : 'transfer', interaction.remark)
      resolveWalletPayment(input.walletAccountId || 'guest', payment.id, 'claimed')
    }
    addLedger(group, interaction, 'claimed', input.actorId, allocation.amountCents, interaction.remark)
  }
  allocation.resolvedAt = Date.now()
  updateStatus(interaction)
  if (interaction.status === 'completed') addLedger(group, interaction, 'completed', 'system', interaction.amountCents, interaction.remark)
  return { ok: true as const, interaction, allocation }
}

export const settleExpiredGroupFinance = (group: any, now = Date.now()) => {
  group.groupFinanceState = normalizeGroupFinanceState(group.groupFinanceState)
  let changed = false
  for (const interaction of group.groupFinanceState.interactions as GroupFinanceInteraction[]) {
    if (interaction.status === 'scheduled' && Number(interaction.scheduledAt) <= now) { interaction.status = 'active'; interaction.revision += 1; changed = true }
    if (!['active', 'partial'].includes(interaction.status) || interaction.expiresAt > now) continue
    if (interaction.feature === 'packet_lottery') {
      const entrants = shuffled(Object.entries(interaction.participants).filter(([, status]) => status === 'joined').map(([id]) => id))
      const winners = entrants.slice(0, interaction.allocations.length)
      interaction.allocations.forEach((allocation, index) => {
        const winner = winners[index]
        if (!winner) return
        allocation.memberId = winner; allocation.claimedBy = winner; allocation.status = 'claimed'; allocation.resolvedAt = now
        interaction.participants[winner] = 'claimed'
        if (allocation.walletPaymentId && allocation.walletAccountId) resolveWalletPayment(allocation.walletAccountId, allocation.walletPaymentId, 'claimed')
        else if (interaction.creatorId !== 'user' && winner === 'user') {
          const payment = createIncomingWalletPayment(interaction.walletAccountId || 'guest', allocation.amountCents, 'red_packet', interaction.remark)
          resolveWalletPayment(interaction.walletAccountId || 'guest', payment.id, 'claimed')
        }
      })
      for (const entrant of entrants.filter(id => !winners.includes(id))) interaction.participants[entrant] = 'lost'
    }
    for (const allocation of interaction.allocations.filter(item => item.status === 'pending')) {
      allocation.status = 'expired'; allocation.resolvedAt = now
      if (allocation.walletPaymentId && allocation.walletAccountId) resolveWalletPayment(allocation.walletAccountId, allocation.walletPaymentId, 'expired')
    }
    const hasSuccess = interaction.allocations.some(item => item.status === 'claimed' || item.status === 'paid')
    interaction.status = hasSuccess ? 'completed' : 'expired'; interaction.revision += 1
    addLedger(group, interaction, 'expired', 'system', interaction.allocations.filter(item => item.status === 'expired').reduce((sum, item) => sum + item.amountCents, 0), interaction.remark)
    changed = true
  }
  return changed
}

export const findGroupFinanceInteraction = (group: any, id: string) => group.groupFinanceState?.interactions?.find((item: GroupFinanceInteraction) => item.id === id)

export const groupFinanceFeatureLabel = (feature: GroupFinanceFeature) => GROUP_FINANCE_FEATURES.find(item => item.id === feature)?.label || '群资金互动'

export const groupFinanceSummary = (interaction: GroupFinanceInteraction) => {
  const done = interaction.allocations.filter(item => item.status === 'claimed' || item.status === 'paid').length
  if (interaction.category === 'packet') return `[${groupFinanceFeatureLabel(interaction.feature)}] ${interaction.remark} · ${done}/${interaction.count}`
  if (interaction.category === 'transfer') return `[群转账] ¥${(interaction.amountCents / 100).toFixed(2)} · ${done}/${interaction.count}`
  return `[群收款] ¥${(interaction.amountCents / 100).toFixed(2)} · ${done}/${interaction.count}`
}

export const createGroupFinanceEventNotice = (input: {
  interaction: GroupFinanceInteraction
  allocation?: GroupFinanceAllocation
  action: GroupFinanceEvent['action']
  actorId: string
  actorName: string
  createdAt?: number
}) => {
  const createdAt = Number(input.createdAt || Date.now())
  const actorName = String(input.actorName || '群成员')
  const creatorName = String(input.interaction.creatorName || '群成员')
  const actionText = input.action === 'join'
    ? `${actorName}参与了${creatorName}发起的定时抽奖`
    : input.action === 'reject'
      ? `${actorName}拒绝了${creatorName}发起的${input.interaction.category === 'collection' ? '群收款' : '群转账'}`
      : input.action === 'pay'
        ? `${actorName}完成了${creatorName}发起的群收款`
        : input.interaction.category === 'packet'
          ? `${actorName}领取了${creatorName}发出的红包`
          : `${actorName}收下了${creatorName}发出的群转账`
  const event: GroupFinanceEvent = {
    eventId: uid('gf_event'), interactionId: input.interaction.id,
    feature: input.interaction.feature, category: input.interaction.category,
    action: input.action, actorId: input.actorId, actorName,
    creatorId: input.interaction.creatorId, creatorName,
    allocationId: input.allocation?.id,
    amountCents: input.allocation?.amountCents,
    createdAt
  }
  return { content: actionText, event }
}

const modulePrompts: Record<GroupFinanceFeature, string> = {
  packet_lucky: `【拼手气红包】
发起：成员可在符合当下关系与语境时主动输出 action="create" feature="packet_lucky"，amount 填红包总金额（元），count 填份数，targets 填 all 或限定成员 ID，正文填红包备注。金额必须大于零且总分数不少于份数。
参与：当前事件显示自己有资格、仍有剩余且自己尚未参与时，可输出 action="claim" event="事件ID"。不要填写或猜测自己将得到的金额。
程序职责：随机拆分到分、资格与重复领取校验、钱包结算、过期退款和剩余份数均由程序处理；你不能自行宣称领取金额或成功结果。`,
  packet_equal: `【等额红包】
发起：输出 action="create" feature="packet_equal"，amount 填总金额（元），count 填份数，targets 填 all 或限定成员 ID，正文填备注。不要自行计算并输出每份金额。
参与：有资格且事件仍开放时，用 action="claim" event="事件ID" 领取；同一成员只能尝试领取一次成功份额。
程序职责：等额拆分、无法整除时的分币尾差、资格、余额、领取、过期与退款全部由程序确认，角色只能根据返回后的客观状态继续聊天。`,
  packet_targeted: `【定向红包】
发起：用于明确送给某一个或多个成员的红包，与普通转账的区别是保留“红包领取”语义。输出 action="create" feature="packet_targeted" amount="总金额元" targets="一个或多个成员ID"，正文填祝福或缘由；不得使用 all。
参与：只有 targets 中的成员可用 action="claim" event="事件ID" 领取自己的份额，其他成员不能代领。
程序职责：目标校验、多人份额分配、逐人领取、未领退款和钱包变化由程序处理；不要把同一事件拆成多张红包卡。`,
  packet_password: `【口令红包】
发起：输出 action="create" feature="packet_password" amount="总金额元" count="份数" targets="all或成员ID" answer="正确口令"，正文只写公开提示或红包说明。answer 是校验值，不要在普通群消息中直接泄露，除非角色本来就想公开口令。
参与：看到公开提示后，角色可按自己是否知道/猜到口令决定是否参与；用 action="claim" event="事件ID" answer="输入的口令"。
程序职责：答案匹配、领取资格、金额拆分、余额、重复提交、过期和退款由程序裁定；答错不等于领取成功。`,
  packet_quiz: `【答题红包】
发起：输出 action="create" feature="packet_quiz" amount="总金额元" count="份数" targets="all或成员ID" answer="标准答案"，正文填写完整公开题目。标准答案只放 answer，不要在普通消息里同步公布。
参与：角色根据题目独立作答，用 action="claim" event="事件ID" answer="自己的答案"；不知道时可以不参与，不能读取隐藏标准答案。
程序职责：答案规范化核对、资格、红包分配、余额、剩余和过期均由程序处理；只能在程序确认后谈论是否领到。`,
  packet_number: `【猜数字】
发起：输出 action="create" feature="packet_number" amount="总金额元" count="份数" targets="all或成员ID" min="最小整数" max="最大整数"，正文填写活动说明。不要填写正确数字，秘密数字由程序生成，所有角色事先都不知道。
参与：事件仍开放且自己有资格时，用 action="claim" event="事件ID" answer="猜测的整数"；根据人设可猜、可观望，不要假装知道结果。
程序职责：随机秘密数字、范围与答案校验、份额、钱包、重复参与和过期由程序处理。`,
  packet_lottery: `【定时抽奖】
发起：输出 action="create" feature="packet_lottery" amount="总奖池元" count="中奖人数" targets="all或限定成员ID" delay_minutes="距离开奖的分钟数"，正文填写奖项说明。count 表示中奖名额，不是报名人数。
参与：开奖前有资格的成员用 action="join" event="事件ID" 报名；报名只表示进入候选名单，不代表中奖，已报名者不要重复报名。
程序职责：截止时间、候选资格、随机抽取、逐份结算、未分配奖金退款和最终结果全部由程序生成；角色不得提前指定或宣布赢家。`,
  packet_rain: `【红包雨】
发起：输出 action="create" feature="packet_rain" amount="总金额元" count="红包份数" targets="all或限定成员ID"，正文填写活动说明。
参与：有资格且仍有剩余时，用 action="claim" event="事件ID" 抢一份；每名成员对同一事件只能成功一次。
程序职责：整个红包雨只生成一张聚合活动卡，随机金额、并发先后、资格、剩余、钱包和过期均由程序处理；禁止为了表现热闹自行输出多张资金事件。`,
  transfer_single: `【指定成员转账】
发起：用于明确转给一名成员、由对方确认收款的款项。输出 action="create" feature="transfer_single" amount="金额元" targets="唯一成员ID"，正文填写用途或说明；targets 不能是 all，也不能包含多人。
参与：只有收款人可对事件输出 action="claim" 确认收款，或 action="reject" 退还；两者都必须填写 event="事件ID"。
程序职责：付款预留、到账、拒收退款、过期退款及状态由程序处理；不要自行宣布钱已到账。`,
  transfer_batch_equal: `【批量等额转账】
发起：用于一次给多名成员转相同额度。输出 action="create" feature="transfer_batch_equal" amount="全部成员合计总金额元" targets="多个成员ID"，正文填写统一说明。程序会按人数等额拆分并处理分币尾差。
参与：每名目标成员只处理自己的子项，用 action="claim" event="事件ID" 收款，或 action="reject" event="事件ID" 退还。
程序职责：以一张聚合卡展示，逐人独立结算和退款；不要为每名成员生成一张转账消息。`,
  transfer_batch_custom: `【批量分别金额转账】
发起：用于一次向多人转账且每人金额不同。输出 action="create" feature="transfer_batch_custom" targets="多个成员ID" amounts="成员ID:金额元,成员ID:金额元"，正文填写说明；targets 与 amounts 必须一一对应且金额都大于零，amount 可省略。
参与：每名目标成员仅可对自己的子项 action="claim" 或 action="reject"，并填写同一聚合 event 的事件ID。
程序职责：合计、逐项付款预留、到账、退回、过期和聚合进度由程序处理；禁止拆成多张卡或自行改写金额。`,
  collection_aa: `【AA / 人均群收款】
发起：用于向多名明确成员发起同额分摊。输出 action="create" feature="collection_aa" amount="应收合计元" targets="多个应付成员ID"，正文写清收款用途。程序按人数均分并处理分币尾差。
参与：目标成员可用 action="pay" event="事件ID" 支付自己的应付项，或 action="reject" event="事件ID" 拒绝；不能替别人支付或更改应付额。
程序职责：人均计算、逐人付款、发起人收款、进度与过期状态由程序维护；角色只能基于当前事件状态回应。`,
  collection_custom: `【分别金额群收款】
发起：用于多名成员各自应付金额不同的收款。输出 action="create" feature="collection_custom" targets="多个应付成员ID" amounts="成员ID:金额元,成员ID:金额元"，正文写明用途；targets 与 amounts 必须一一对应，amount 可省略。
参与：每名目标成员只可对自己的应付项输出 action="pay" 或 action="reject"，并填写 event="事件ID"。
程序职责：合计、付款、发起人到账、拒绝、逐项进度和过期由程序处理；不要拆成多张收款卡，也不要虚构他人的付款状态。`
}

export const buildGroupFinancePrompt = (group: any) => {
  const settings = normalizeGroupFinanceSettings(group.groupFinanceSettings)
  if (!settings.enabled) return ''
  const enabled = GROUP_FINANCE_FEATURES.filter(item => settings.features[item.id])
  if (!enabled.length) return ''
  const active: GroupFinanceInteraction[] = normalizeGroupFinanceState(group.groupFinanceState).interactions.filter(item => ['scheduled', 'active', 'partial'].includes(item.status)).slice(0, 8)
  const events = active.length ? `\n当前可参与事件（只依据这里的客观状态行动）：\n${active.map(item => {
    const targets = item.eligibility.type === 'all' ? '全体成员（发起人除外）' : item.eligibility.memberIds.join(',')
    const states = Object.entries(item.participants).map(([id, status]) => `${id}:${status}`).join(',') || '无人参与'
    const challenge = item.challenge?.prompt ? `｜公开题面/提示：${item.challenge.prompt}` : ''
    const allocations = item.category === 'packet' ? '' : `｜明细${item.allocations.map(part => `${part.memberId || '待定'}:¥${(part.amountCents / 100).toFixed(2)}:${part.status}`).join(',')}`
    return `${item.id}｜${groupFinanceFeatureLabel(item.feature)}｜发起人${item.creatorId}｜总额¥${(item.amountCents / 100).toFixed(2)}｜说明${item.remark}｜参与范围${targets}｜${item.allocations.filter(part => part.status === 'pending').length}项待处理｜参与状态${states}｜截止${new Date(item.expiresAt).toISOString()}${allocations}${challenge}`
  }).join('\n')}` : ''
  return `【已启用的群资金互动】\n这些能力与普通聊天同等可由群成员在符合人设、关系和现场语境时主动使用或参与，不要为了展示功能而机械使用。资金动作与普通 group_msg 可在同一次输出中自然穿插。\n统一格式：<group_finance sender="成员ID" action="create|claim|pay|reject|join" feature="创建时的玩法" event="参与时的事件ID" targets="all或成员ID逗号列表" amount="总金额元" amounts="仅分别金额时用，成员ID:元,成员ID:元" count="份数" answer="口令/答案/猜测" min="最小值" max="最大值" delay_minutes="分钟">备注、题目或说明</group_finance>。\nsender 必须是当前可发言成员；程序负责余额、资格、随机分配、答案校验、开奖、进度、过期与退款，不得伪造处理结果。动作无效时普通对话仍然有效。\n${enabled.map(item => `- ${modulePrompts[item.id]}`).join('\n')}${events}`
}
