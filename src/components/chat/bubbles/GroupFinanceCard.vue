<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { groupFinanceFeatureLabel, type GroupFinanceInteraction } from '../../../services/groupFinance'

const props = defineProps<{ interaction: GroupFinanceInteraction; direction: 'left' | 'right'; group: any; actorId?: string }>()
const emit = defineEmits<{ (e: 'act', payload: { interactionId: string; action: 'claim' | 'pay' | 'reject' | 'join'; answer?: string }): void; (e: 'touch-start', id: string): void; (e: 'touch-end'): void }>()
const showDetail = ref(false)
const answer = ref('')
const actor = computed(() => props.actorId || 'user')
const done = computed(() => props.interaction.allocations.filter(item => item.status === 'claimed' || item.status === 'paid').length)
const pending = computed(() => props.interaction.allocations.filter(item => item.status === 'pending').length)
const myState = computed(() => props.interaction.participants[actor.value] || 'pending')
const targetAllocation = computed(() => props.interaction.allocations.find(item => item.memberId === actor.value))
const eligible = computed(() => actor.value !== props.interaction.creatorId && (props.interaction.eligibility.type === 'all' || props.interaction.eligibility.memberIds.includes(actor.value)))
const canAct = computed(() => eligible.value && ['active', 'partial'].includes(props.interaction.status) && myState.value === 'pending')
const amountVisible = computed(() => props.interaction.category !== 'packet' || ['claimed', 'paid'].includes(myState.value) || props.interaction.status === 'completed')
const myAmount = computed(() => props.interaction.allocations.find(item => item.claimedBy === actor.value || item.memberId === actor.value)?.amountCents || 0)
const statusText = computed(() => ({ scheduled: '等待开始', active: '进行中', partial: '进行中', completed: '已完成', cancelled: '已取消', expired: '已结束' }[props.interaction.status]))
const actionLabel = computed(() => {
  if (props.interaction.feature === 'packet_lottery') return '参与抽奖'
  if (props.interaction.category === 'collection') return '确认付款'
  if (props.interaction.category === 'transfer') return '确认收款'
  if (props.interaction.feature === 'packet_password') return '输入口令'
  if (props.interaction.feature === 'packet_quiz') return '提交答案'
  if (props.interaction.feature === 'packet_number') return '猜数字'
  return '领取'
})
const submit = () => {
  const action = props.interaction.feature === 'packet_lottery' ? 'join' : props.interaction.category === 'collection' ? 'pay' : 'claim'
  emit('act', { interactionId: props.interaction.id, action, answer: answer.value.trim() || undefined })
  answer.value = ''
}
const name = (id?: string) => id === 'user' ? (props.group.userProfile?.name || '我') : props.group.memberNicknames?.[String(id || '')] || id || '群成员'
const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`
</script>

<template>
  <article class="gfc-card" :class="[interaction.category, direction, { inactive: !['active','partial','scheduled'].includes(interaction.status) }]" @click="showDetail = true" @touchstart="emit('touch-start', interaction.id)" @touchend="emit('touch-end')">
    <div class="gfc-main"><div class="gfc-icon">{{ interaction.category === 'packet' ? '礼' : interaction.category === 'transfer' ? '转' : '收' }}</div><div class="gfc-copy"><strong>{{ interaction.category === 'transfer' ? money(interaction.amountCents) : interaction.remark }}</strong><span v-if="interaction.category === 'packet'">{{ groupFinanceFeatureLabel(interaction.feature) }} · {{ done }}/{{ interaction.count }}</span><span v-else>{{ groupFinanceFeatureLabel(interaction.feature) }} · {{ done }}/{{ interaction.count }}</span></div></div>
    <footer><span>{{ statusText }}</span><b v-if="amountVisible && myAmount">{{ money(myAmount) }}</b><i>查看详情 ›</i></footer>
  </article>

  <Teleport to="body">
    <div v-if="showDetail" class="gfc-overlay" @click.self="showDetail = false">
      <section class="gfc-detail"><header><div><b>{{ groupFinanceFeatureLabel(interaction.feature) }}</b><small>{{ interaction.creatorName }}发起</small></div><button type="button" @click="showDetail = false">×</button></header>
        <div class="gfc-summary"><strong>{{ interaction.category === 'packet' && !amountVisible ? interaction.remark : money(interaction.amountCents) }}</strong><span>{{ interaction.remark }}</span><small>{{ statusText }} · 已完成 {{ done }}/{{ interaction.count }} · 剩余 {{ pending }}</small></div>
        <div v-if="interaction.challenge?.prompt" class="gfc-challenge">{{ interaction.challenge.prompt }}</div>
        <div class="gfc-list">
          <div v-for="item in interaction.allocations" :key="item.id"><span>{{ item.claimedBy ? name(item.claimedBy) : item.memberId ? name(item.memberId) : '待领取' }}</span><b>{{ item.status === 'claimed' || item.status === 'paid' || interaction.category !== 'packet' ? money(item.amountCents) : '金额隐藏' }}</b><small>{{ ({ pending:'待处理',joined:'已参与',claimed:'已领取',paid:'已付款',rejected:'已退回',lost:'未中奖',expired:'已过期',refunded:'已退款' } as any)[item.status] }}</small></div>
        </div>
        <div v-if="canAct" class="gfc-actions">
          <input v-if="['packet_password','packet_quiz','packet_number'].includes(interaction.feature)" v-model="answer" :inputmode="interaction.feature === 'packet_number' ? 'numeric' : 'text'" :placeholder="interaction.feature === 'packet_password' ? '输入口令' : interaction.feature === 'packet_quiz' ? '输入答案' : '输入猜测数字'">
          <button type="button" @click="submit">{{ actionLabel }}</button>
          <button v-if="interaction.category === 'transfer' || interaction.category === 'collection'" type="button" class="secondary" @click="emit('act', { interactionId: interaction.id, action: 'reject' }); showDetail = false">{{ interaction.category === 'collection' ? '拒绝' : '退还' }}</button>
        </div>
        <div v-else class="gfc-result">{{ interaction.creatorId === actor ? '等待成员处理' : myState === 'claimed' ? `你已领取 ${money(myAmount)}` : myState === 'paid' ? `你已付款 ${money(myAmount)}` : myState === 'rejected' ? '你已拒绝' : myState === 'joined' ? '你已参与，等待开奖' : eligible ? '当前已不可操作' : '你不在本次参与范围内' }}</div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.gfc-card{box-sizing:border-box;width:min(240px,calc(100vw - 112px));overflow:hidden;border-radius:11px;background:#ef8b3a;color:#fff;box-shadow:0 3px 10px rgba(0,0,0,.1);cursor:pointer}.gfc-card.transfer{background:#4f8fc8}.gfc-card.collection{background:#4c9a82}.gfc-card.inactive{filter:saturate(.55);opacity:.78}.gfc-main{display:flex;align-items:center;gap:11px;min-height:60px;padding:12px}.gfc-icon{display:grid;place-items:center;width:36px;height:36px;flex:0 0 auto;border:1px solid rgba(255,255,255,.72);border-radius:9px;font-size:13px;font-weight:650}.gfc-copy{display:flex;min-width:0;flex-direction:column;gap:4px}.gfc-copy strong,.gfc-copy span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gfc-copy strong{font-size:14px}.gfc-copy span{font-size:10px;opacity:.82}.gfc-card footer{display:flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(255,255,255,.94);color:#777;font-size:9px}.gfc-card footer b{color:#555;font-size:9px}.gfc-card footer i{margin-left:auto;font-style:normal}.gfc-overlay{position:fixed;inset:0;z-index:10020;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.46)}.gfc-detail{display:flex;max-height:78vh;width:min(100%,480px);flex-direction:column;overflow:hidden;border-radius:18px 18px 0 0;background:var(--sys-bg-primary);color:var(--text-primary);padding-bottom:env(safe-area-inset-bottom)}.gfc-detail header{display:flex;align-items:center;justify-content:space-between;min-height:54px;padding:0 16px;border-bottom:1px solid var(--border-color)}.gfc-detail header>div{display:flex;flex-direction:column;gap:2px}.gfc-detail header b{font-size:14px}.gfc-detail header small{color:var(--text-tertiary);font-size:9px}.gfc-detail header button{border:0;background:transparent;color:var(--text-secondary);font:inherit;font-size:20px}.gfc-summary{display:flex;flex-direction:column;gap:5px;padding:18px 16px 13px}.gfc-summary strong{font-size:23px}.gfc-summary span{font-size:12px}.gfc-summary small{color:var(--text-tertiary);font-size:9px}.gfc-challenge{margin:0 16px 10px;padding:10px 12px;border-radius:10px;background:var(--sys-bg-secondary);font-size:11px;line-height:1.5}.gfc-list{min-height:0;overflow-y:auto;border-top:1px solid var(--border-color)}.gfc-list>div{display:grid;grid-template-columns:minmax(0,1fr) auto 48px;align-items:center;gap:8px;min-height:43px;padding:0 16px;border-bottom:1px solid var(--border-color);font-size:11px}.gfc-list span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gfc-list b{font-size:10px}.gfc-list small{text-align:right;color:var(--text-tertiary);font-size:9px}.gfc-actions{display:flex;gap:7px;padding:10px 16px;border-top:1px solid var(--border-color)}.gfc-actions input{min-width:0;flex:1;height:38px;box-sizing:border-box;border:1px solid var(--border-color);border-radius:9px;background:var(--sys-bg-secondary);color:var(--text-primary);font:inherit;font-size:11px;outline:0;padding:0 10px}.gfc-actions button{height:38px;padding:0 15px;border:0;border-radius:9px;background:var(--text-primary);color:var(--sys-bg-secondary);font:inherit;font-size:11px}.gfc-actions button.secondary{background:var(--sys-bg-tertiary);color:var(--text-secondary)}.gfc-result{padding:13px 16px;border-top:1px solid var(--border-color);color:var(--text-tertiary);font-size:10px;text-align:center}@media(max-width:340px){.gfc-card{width:min(220px,calc(100vw - 96px))}.gfc-list>div{padding-right:10px;padding-left:10px}.gfc-actions{padding-right:10px;padding-left:10px}}
</style>
