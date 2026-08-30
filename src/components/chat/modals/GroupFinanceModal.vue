<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { GROUP_FINANCE_FEATURES, groupFinanceFeatureLabel, type GroupFinanceCategory, type GroupFinanceFeature } from '../../../services/groupFinance'
import { loadWalletState } from '../../../services/walletService'
import { useChatAuth } from '../../../composables/useChatAuth'
import PaymentPasswordModal from './PaymentPasswordModal.vue'

const props = defineProps<{ visible: boolean; group: any; members: any[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'send', data: any): void }>()
const category = ref<GroupFinanceCategory>('packet')
const feature = ref<GroupFinanceFeature>('packet_lucky')
const amount = ref('')
const count = ref('1')
const remark = ref('')
const expireHours = ref('24')
const selectedIds = ref<string[]>([])
const customAmounts = ref<Record<string, string>>({})
const challengePrompt = ref('')
const challengeAnswer = ref('')
const numberMin = ref('1')
const numberMax = ref('100')
const delayMinutes = ref('10')
const memberSheet = ref(false)
const featureSheet = ref(false)
const fundingSheet = ref(false)
const showPassword = ref(false)
const selectedFunding = ref('balance')
const { currentChatUserId, currentAccount } = useChatAuth()
const wallet = ref<ReturnType<typeof loadWalletState> | null>(null)

const enabledFeatures = computed(() => GROUP_FINANCE_FEATURES.filter(item => props.group?.groupFinanceSettings?.features?.[item.id]))
const categories = computed(() => (['packet', 'transfer', 'collection'] as GroupFinanceCategory[]).filter(item => enabledFeatures.value.some(feature => feature.category === item)))
const visibleFeatures = computed(() => enabledFeatures.value.filter(item => item.category === category.value))
const memberRows = computed(() => props.members.map(member => {
  const id = String(member.characterEntityId || member.id)
  return { id, name: props.group?.memberNicknames?.[id] || member.name || '群成员', avatarUrl: member.avatarUrl || '', avatarText: member.avatarText || (member.name || '群').charAt(0) }
}))
const needsTargets = computed(() => ['packet_targeted', 'transfer_single', 'transfer_batch_equal', 'transfer_batch_custom', 'collection_aa', 'collection_custom'].includes(feature.value))
const customMode = computed(() => ['transfer_batch_custom', 'collection_custom'].includes(feature.value))
const challengeMode = computed(() => ['packet_password', 'packet_quiz'].includes(feature.value))
const numberMode = computed(() => feature.value === 'packet_number')
const lotteryMode = computed(() => feature.value === 'packet_lottery')
const availableCents = computed(() => {
  if (!wallet.value) return 0
  if (selectedFunding.value === 'credit') return Math.max(0, wallet.value.credit.limitCents - wallet.value.credit.usedCents)
  if (selectedFunding.value.startsWith('card_')) {
    const card = wallet.value.bankCards.find(item => item.id === selectedFunding.value.slice(5))
    return card?.type === 'credit' ? Math.max(0, (card.limitCents || 0) - (card.usedCents || 0)) : Math.max(0, card?.balanceCents || 0)
  }
  return Math.max(0, wallet.value.cashCents)
})
const fundingLabel = computed(() => {
  if (selectedFunding.value === 'credit') return '花呗'
  if (selectedFunding.value.startsWith('card_')) return wallet.value?.bankCards.find(item => item.id === selectedFunding.value.slice(5))?.name || '银行卡'
  return '余额'
})
const totalCents = computed(() => {
  if (customMode.value) return selectedIds.value.reduce((sum, id) => sum + Math.round((Number(customAmounts.value[id]) || 0) * 100), 0)
  if (feature.value === 'transfer_batch_equal') return Math.round((Number(amount.value) || 0) * 100) * selectedIds.value.length
  return Math.round((Number(amount.value) || 0) * 100)
})
const amountLabel = computed(() => feature.value === 'transfer_batch_equal' ? '每人金额' : category.value === 'collection' ? '应收总额' : '总金额')
const isCollection = computed(() => category.value === 'collection')
const isValid = computed(() => {
  if (totalCents.value <= 0) return false
  if (category.value === 'packet' && feature.value !== 'packet_targeted' && totalCents.value < Math.max(1, Math.floor(Number(count.value) || 1))) return false
  if (needsTargets.value && !selectedIds.value.length) return false
  if (feature.value === 'transfer_single' && selectedIds.value.length !== 1) return false
  if (customMode.value && selectedIds.value.some(id => Number(customAmounts.value[id]) <= 0)) return false
  if (challengeMode.value && (!challengePrompt.value.trim() || !challengeAnswer.value.trim())) return false
  if (numberMode.value && Number(numberMax.value) <= Number(numberMin.value)) return false
  if (!isCollection.value && totalCents.value > availableCents.value) return false
  return Number(expireHours.value) > 0
})

const reset = () => {
  const firstCategory = categories.value[0] || 'packet'
  category.value = firstCategory
  feature.value = enabledFeatures.value.find(item => item.category === firstCategory)?.id || 'packet_lucky'
  amount.value = ''; count.value = '1'; remark.value = ''; expireHours.value = '24'; selectedIds.value = []; customAmounts.value = {}
  challengePrompt.value = ''; challengeAnswer.value = ''; numberMin.value = '1'; numberMax.value = '100'; delayMinutes.value = '10'
  memberSheet.value = false; featureSheet.value = false; fundingSheet.value = false; showPassword.value = false; selectedFunding.value = 'balance'
  wallet.value = loadWalletState(currentChatUserId.value || 'guest', currentAccount.value?.name || '我')
}
watch(() => props.visible, value => { if (value) reset() })
watch(category, value => {
  if (!visibleFeatures.value.some(item => item.id === feature.value)) feature.value = enabledFeatures.value.find(item => item.category === value)?.id || feature.value
})
watch(feature, value => { if (value === 'transfer_single' && selectedIds.value.length > 1) selectedIds.value = selectedIds.value.slice(0, 1) })
const toggleMember = (id: string) => {
  if (feature.value === 'transfer_single') { selectedIds.value = [id]; memberSheet.value = false; return }
  selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter(item => item !== id) : [...selectedIds.value, id]
}
const submit = () => {
  if (!isValid.value) return
  if (!isCollection.value && wallet.value?.paymentPassword) { showPassword.value = true; return }
  executeSend()
}
const executeSend = () => {
  const source = selectedFunding.value === 'credit' ? 'credit' : selectedFunding.value.startsWith('card_') ? 'bank_card' : 'balance'
  emit('send', {
    feature: feature.value, targetIds: [...selectedIds.value], amountCents: totalCents.value,
    customAmounts: Object.fromEntries(Object.entries(customAmounts.value).map(([id, value]) => [id, Math.round((Number(value) || 0) * 100)])),
    count: Math.max(1, Math.floor(Number(count.value) || selectedIds.value.length || 1)), remark: remark.value.trim(), expireHours: Number(expireHours.value) || 24,
    scheduledAt: lotteryMode.value ? Date.now() + Math.max(1, Number(delayMinutes.value) || 10) * 60000 : undefined,
    challenge: challengeMode.value ? { prompt: challengePrompt.value.trim(), answer: challengeAnswer.value.trim() } : numberMode.value ? { prompt: challengePrompt.value.trim() || `猜一个 ${numberMin.value} 到 ${numberMax.value} 之间的数字`, min: Number(numberMin.value), max: Number(numberMax.value), secretNumber: Math.floor(Math.random() * (Number(numberMax.value) - Number(numberMin.value) + 1)) + Number(numberMin.value) } : undefined,
    fundingSource: source, fundingSourceId: source === 'bank_card' ? selectedFunding.value.slice(5) : undefined
  })
  showPassword.value = false
}
const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`
const categoryLabel = (value: GroupFinanceCategory) => ({ packet: '红包', transfer: '转账', collection: '收款' }[value])
</script>

<template>
  <Teleport to="body">
    <transition name="gf-fade">
      <div v-if="visible" class="gf-overlay" @click.self="emit('close')">
        <section class="gf-sheet" aria-label="群资金互动">
          <header class="gf-header"><div><strong>群资金互动</strong><small>{{ group.name }}</small></div><button type="button" aria-label="关闭" @click="emit('close')">×</button></header>
          <nav v-if="categories.length > 1" class="gf-tabs">
            <button v-for="item in categories" :key="item" type="button" :class="{ active: category === item }" @click="category = item">{{ categoryLabel(item) }}</button>
          </nav>
          <div class="gf-body">
            <button type="button" class="gf-row" @click="featureSheet = true"><span><small>玩法</small><b>{{ groupFinanceFeatureLabel(feature) }}</b></span><i>›</i></button>
            <button v-if="needsTargets" type="button" class="gf-row" @click="memberSheet = true"><span><small>{{ category === 'collection' ? '收款成员' : '接收成员' }}</small><b>{{ selectedIds.length ? `已选择 ${selectedIds.length} 人` : '请选择成员' }}</b></span><i>›</i></button>
            <div v-if="customMode && selectedIds.length" class="gf-custom-list">
              <label v-for="id in selectedIds" :key="id"><span>{{ memberRows.find(item => item.id === id)?.name }}</span><div><i>¥</i><input v-model="customAmounts[id]" inputmode="decimal" placeholder="0.00"></div></label>
            </div>
            <label v-else class="gf-field"><span>{{ amountLabel }}</span><div class="gf-amount"><i>¥</i><input v-model="amount" inputmode="decimal" placeholder="0.00"></div></label>
            <label v-if="category === 'packet' && feature !== 'packet_targeted'" class="gf-field compact"><span>{{ lotteryMode ? '中奖人数' : '份数' }}</span><input v-model="count" type="number" min="1" max="100"></label>
            <template v-if="challengeMode"><label class="gf-field compact"><span>{{ feature === 'packet_password' ? '提示' : '题目' }}</span><input v-model="challengePrompt" maxlength="120" :placeholder="feature === 'packet_password' ? '输入口令提示' : '输入题目'"></label><label class="gf-field compact"><span>{{ feature === 'packet_password' ? '正确口令' : '标准答案' }}</span><input v-model="challengeAnswer" maxlength="60" placeholder="由程序严格核对"></label></template>
            <template v-if="numberMode"><label class="gf-field compact"><span>活动说明</span><input v-model="challengePrompt" maxlength="120" placeholder="猜中即可领取"></label><div class="gf-range"><label><span>最小值</span><input v-model="numberMin" type="number"></label><label><span>最大值</span><input v-model="numberMax" type="number"></label></div></template>
            <label v-if="lotteryMode" class="gf-field compact"><span>开奖等待</span><div class="gf-inline"><input v-model="delayMinutes" type="number" min="1"><i>分钟</i></div></label>
            <label class="gf-field compact"><span>备注</span><input v-model="remark" maxlength="120" :placeholder="category === 'packet' ? '恭喜发财，大吉大利' : category === 'collection' ? '填写收款用途' : '填写转账说明'"></label>
            <button v-if="!isCollection" type="button" class="gf-row" @click="fundingSheet = true"><span><small>付款方式</small><b>{{ fundingLabel }} · 可用 {{ money(availableCents) }}</b></span><i>›</i></button>
            <label class="gf-field compact"><span>有效期</span><div class="gf-inline"><input v-model="expireHours" type="number" min="1"><i>小时</i></div></label>
            <p v-if="!isCollection && totalCents > availableCents" class="gf-error">所选付款方式可用金额不足</p>
            <p v-else-if="category === 'packet' && feature !== 'packet_targeted' && totalCents < Math.max(1, Math.floor(Number(count) || 1))" class="gf-error">总金额不能小于红包份数（每份至少 0.01 元）</p>
          </div>
          <footer class="gf-footer"><div><small>{{ customMode ? `${selectedIds.length} 人` : groupFinanceFeatureLabel(feature) }}</small><b>{{ money(totalCents) }}</b></div><button type="button" :disabled="!isValid" @click="submit">{{ category === 'collection' ? '发起收款' : '确认发送' }}</button></footer>
        </section>

        <div v-if="featureSheet" class="gf-sub-overlay" @click.self="featureSheet = false"><section class="gf-sub-sheet"><header><b>选择玩法</b><button type="button" @click="featureSheet = false">完成</button></header><button v-for="item in visibleFeatures" :key="item.id" type="button" class="gf-choice" @click="feature = item.id; featureSheet = false"><span>{{ item.label }}</span><i :class="{ active: feature === item.id }">✓</i></button></section></div>
        <div v-if="memberSheet" class="gf-sub-overlay" @click.self="memberSheet = false"><section class="gf-sub-sheet"><header><b>选择成员</b><button type="button" @click="memberSheet = false">完成</button></header><button v-for="member in memberRows" :key="member.id" type="button" class="gf-member" @click="toggleMember(member.id)"><i class="gf-avatar" :style="member.avatarUrl ? { backgroundImage: `url(${member.avatarUrl})` } : {}">{{ member.avatarUrl ? '' : member.avatarText }}</i><span>{{ member.name }}</span><em :class="{ active: selectedIds.includes(member.id) }">✓</em></button></section></div>
        <div v-if="fundingSheet" class="gf-sub-overlay" @click.self="fundingSheet = false"><section class="gf-sub-sheet"><header><b>付款方式</b><button type="button" @click="fundingSheet = false">完成</button></header><button type="button" class="gf-choice" @click="selectedFunding = 'balance'; fundingSheet = false"><span>余额 · {{ money(wallet?.cashCents || 0) }}</span><i :class="{ active: selectedFunding === 'balance' }">✓</i></button><button v-if="wallet?.credit?.enabled" type="button" class="gf-choice" @click="selectedFunding = 'credit'; fundingSheet = false"><span>花呗 · {{ money((wallet.credit.limitCents || 0) - (wallet.credit.usedCents || 0)) }}</span><i :class="{ active: selectedFunding === 'credit' }">✓</i></button><button v-for="card in wallet?.bankCards || []" :key="card.id" type="button" class="gf-choice" :disabled="!card.enabled" @click="selectedFunding = `card_${card.id}`; fundingSheet = false"><span>{{ card.name }} ({{ card.lastFour }})</span><i :class="{ active: selectedFunding === `card_${card.id}` }">✓</i></button></section></div>
      </div>
    </transition>
    <PaymentPasswordModal :visible="showPassword" :account-id="currentChatUserId || 'guest'" @close="showPassword = false" @success="executeSend" />
  </Teleport>
</template>

<style scoped>
.gf-fade-enter-active,.gf-fade-leave-active{transition:opacity .2s}.gf-fade-enter-from,.gf-fade-leave-to{opacity:0}.gf-overlay,.gf-sub-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.46);backdrop-filter:blur(2px)}.gf-sheet,.gf-sub-sheet{display:flex;flex-direction:column;width:min(100%,480px);max-height:min(86vh,760px);overflow:hidden;border-radius:18px 18px 0 0;background:var(--sys-bg-primary,#fff);color:var(--text-primary);box-shadow:0 -12px 36px rgba(0,0,0,.16)}.gf-header,.gf-sub-sheet header{display:flex;align-items:center;justify-content:space-between;min-height:54px;padding:0 16px;border-bottom:1px solid var(--border-color)}.gf-header>div{display:flex;min-width:0;flex-direction:column;gap:2px}.gf-header strong{font-size:15px}.gf-header small{overflow:hidden;color:var(--text-tertiary);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.gf-header button,.gf-sub-sheet header button{border:0;background:transparent;color:var(--text-secondary);font:inherit;font-size:20px;cursor:pointer}.gf-sub-sheet header button{font-size:12px}.gf-tabs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:3px;margin:10px 16px 2px;padding:3px;border-radius:9px;background:var(--sys-bg-secondary)}.gf-tabs button{height:32px;border:0;border-radius:7px;background:transparent;color:var(--text-secondary);font:inherit;font-size:12px}.gf-tabs button.active{background:var(--sys-bg-primary);color:var(--text-primary);box-shadow:0 1px 4px rgba(0,0,0,.08)}.gf-body{min-height:0;overflow-y:auto;padding:10px 16px 18px}.gf-row,.gf-field,.gf-custom-list,.gf-range{box-sizing:border-box;width:100%;margin-bottom:9px;border:1px solid var(--border-color);border-radius:11px;background:var(--sys-bg-secondary);color:var(--text-primary)}.gf-row{display:flex;align-items:center;justify-content:space-between;min-height:52px;padding:9px 12px;font:inherit;text-align:left;cursor:pointer}.gf-row span{display:flex;min-width:0;flex-direction:column;gap:3px}.gf-row small{color:var(--text-tertiary);font-size:9px}.gf-row b{overflow:hidden;font-size:12px;font-weight:550;text-overflow:ellipsis;white-space:nowrap}.gf-row>i{color:var(--text-tertiary);font-size:18px;font-style:normal}.gf-field{display:flex;flex-direction:column;gap:7px;padding:10px 12px}.gf-field>span,.gf-range span{color:var(--text-secondary);font-size:10px}.gf-amount{display:flex;align-items:baseline}.gf-amount i{font-size:21px;font-style:normal}.gf-amount input{min-width:0;flex:1;border:0;background:transparent;color:var(--text-primary);font:inherit;font-size:29px;font-weight:600;outline:0}.gf-field.compact{flex-direction:row;align-items:center;justify-content:space-between;min-height:48px}.gf-field.compact>input,.gf-inline input,.gf-range input,.gf-custom-list input{min-width:0;border:0;background:transparent;color:var(--text-primary);font:inherit;font-size:12px;text-align:right;outline:0}.gf-field.compact>input{flex:1;padding-left:15px}.gf-inline{display:flex;align-items:center;gap:5px}.gf-inline input{width:64px}.gf-inline i{color:var(--text-tertiary);font-size:10px;font-style:normal}.gf-range{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 12px}.gf-range label{display:flex;align-items:center;justify-content:space-between;gap:8px}.gf-range input{width:60px}.gf-custom-list{padding:2px 12px}.gf-custom-list label{display:flex;align-items:center;justify-content:space-between;min-height:45px;border-bottom:1px solid var(--border-color);font-size:11px}.gf-custom-list label:last-child{border:0}.gf-custom-list div{display:flex;align-items:center}.gf-custom-list i{color:var(--text-tertiary);font-style:normal}.gf-custom-list input{width:82px}.gf-error{margin:0 2px 8px;color:#d95b5b;font-size:10px}.gf-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 16px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--border-color);background:var(--sys-bg-primary)}.gf-footer>div{display:flex;min-width:0;flex-direction:column}.gf-footer small{overflow:hidden;color:var(--text-tertiary);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.gf-footer b{font-size:15px}.gf-footer>button{flex:0 0 auto;min-width:108px;height:39px;border:0;border-radius:10px;background:var(--text-primary);color:var(--sys-bg-secondary);font:inherit;font-size:13px;font-weight:600}.gf-footer>button:disabled{opacity:.35}.gf-sub-overlay{z-index:10001}.gf-sub-sheet{max-height:70vh;padding-bottom:env(safe-area-inset-bottom)}.gf-choice,.gf-member{display:flex;align-items:center;width:100%;min-height:48px;padding:7px 16px;border:0;border-bottom:1px solid var(--border-color);background:transparent;color:var(--text-primary);font:inherit;font-size:12px;text-align:left}.gf-choice span,.gf-member span{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gf-choice i,.gf-member em{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--sys-bg-tertiary);color:transparent;font-size:11px;font-style:normal}.gf-choice i.active,.gf-member em.active{background:var(--text-primary);color:var(--sys-bg-secondary)}.gf-avatar{display:grid;place-items:center;width:34px;height:34px;margin-right:10px;flex:0 0 auto;border-radius:50%;background:var(--sys-bg-tertiary) center/cover;font-size:10px;font-style:normal}@media(max-width:340px){.gf-body{padding-right:10px;padding-left:10px}.gf-footer{padding-right:10px;padding-left:10px}.gf-footer>button{min-width:98px}.gf-tabs{margin-right:10px;margin-left:10px}}
</style>
