<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { disableAutonomyPresence, ensureAutonomyDefaults, persistAutonomyChat, runAutonomousCheck, type AutonomyCheckResult, type AutonomyEvent } from '../../services/characterAutonomy'
import {
  AUTONOMY_INTERVAL_MINUTES_MAX,
  AUTONOMY_INTERVAL_MINUTES_MIN,
  normalizeAutonomyIntervalMinutes,
  normalizeAutonomySilenceMinutes,
  pendingAutonomyLedgerWindow
} from '../../services/autonomyConfig'
import { getPendingAutonomyDeliveryCount } from '../../services/autonomyDelivery'

const props = defineProps<{ chat: any }>()
const emit = defineEmits<{ (e: 'back'): void; (e: 'save'): void }>()
const running = ref(false)
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const previewResult = ref<AutonomyCheckResult | null>(null)
const showClearConfirm = ref(false)
const filter = ref<'all' | 'message' | 'moment' | 'status'>('all')
const intervalDraft = ref('45')
const silenceHoursDraft = ref('12')

onMounted(() => {
  ensureAutonomyDefaults(props.chat)
  intervalDraft.value = String(props.chat.autonomyMinIntervalMinutes)
  silenceHoursDraft.value = String(Math.max(0.5, props.chat.autonomyMaxSilenceMinutes / 60))
  persistAutonomyChat(props.chat)
})

const save = () => {
  ensureAutonomyDefaults(props.chat)
  persistAutonomyChat(props.chat)
  emit('save')
}

const statusLabel = computed(() => {
  if (!props.chat.autonomyEnabled) return '已暂停'
  if (running.value || props.chat.autonomyState?.running) return '正在判断'
  if (!props.chat.enableImmersiveStatus) return '状态功能未开启'
  if (!props.chat.autonomyAllowStatus) return '自主状态已关闭'
  return ({ online: '在线', offline: '离线', busy: '忙碌', away: '暂离' } as Record<string, string>)[props.chat.autonomyState?.status] || '尚未设置'
})

const statusDotClass = computed(() => {
  if (!props.chat.enableImmersiveStatus || !props.chat.autonomyAllowStatus) return 'disabled'
  return props.chat.autonomyState?.status || 'unset'
})

const nextCheckLabel = computed(() => {
  if (!props.chat.autonomyEnabled) return '开启后由角色自行安排'
  const time = Number(props.chat.autonomyState?.nextCheckAt || 0)
  if (!time) return '尚未安排'
  const diff = time - Date.now()
  if (diff <= 0) return '即将检查'
  if (diff < 3600000) return `约 ${Math.ceil(diff / 60000)} 分钟后`
  return `约 ${Math.ceil(diff / 3600000)} 小时后`
})

const pendingDeliveryCount = computed(() => getPendingAutonomyDeliveryCount(props.chat))
const ledgerLabel = computed(() => {
  const pending = pendingAutonomyLedgerWindow(props.chat)
  if (pending) return pending.status === 'failed' ? '有一段补演等待重试' : '有一段关闭时间等待结算'
  const windows = props.chat.autonomyLedger?.windows || []
  const latest = windows[windows.length - 1]
  return latest?.status === 'completed' ? '关闭时间已完整结算' : '暂无待结算时间'
})

const filters = [
  { id: 'all', label: '全部' },
  { id: 'message', label: '消息' },
  { id: 'moment', label: '朋友圈' },
  { id: 'status', label: '状态' }
] as const

const history = computed<AutonomyEvent[]>(() => {
  const list = props.chat.autonomyHistory || []
  if (filter.value === 'all') return list
  return list.filter((item: AutonomyEvent) => item.type === filter.value)
})

const formatTime = (value: number) => new Date(value).toLocaleString('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
})

const runNow = async (preview = false) => {
  if (running.value || !props.chat.autonomyEnabled) return
  running.value = true
  feedback.value = null
  if (!preview) previewResult.value = null
  try {
    const result = await runAutonomousCheck(props.chat, 'manual', { preview })
    if (!result) throw new Error('这个角色正在进行另一项判断')
    if (preview) {
      previewResult.value = result
      feedback.value = { type: 'success', text: '预览完成，没有产生消息、未读或状态变化' }
    } else {
      feedback.value = { type: 'success', text: result.executed > 0 ? `已执行 ${result.executed} 个实际动作` : '角色选择了保持安静' }
    }
  } catch (error: any) {
    feedback.value = { type: 'error', text: error?.message || '检查失败，请稍后重试' }
  } finally {
    running.value = false
  }
}

const toggleStatusPermission = () => {
  if (props.chat.autonomyAllowStatus && !props.chat.enableImmersiveStatus) {
    props.chat.autonomyAllowStatus = false
    feedback.value = { type: 'error', text: '请先在上一页开启“沉浸式状态与时间流逝”' }
    return
  }
  props.chat.autonomyStatusPermissionExplicit = true
  if (!props.chat.autonomyAllowStatus) disableAutonomyPresence(props.chat)
  save()
}

const toggleMessagePermission = () => {
  if (!props.chat.autonomyAllowMessages) props.chat.autonomyEmotionMustDeliver = false
  save()
}

const actionLabel = (type: string) => ({ message: '主动消息', moment: '朋友圈', status: '状态变化' } as Record<string, string>)[type] || type
const actionDetail = (action: any) => action.type === 'status'
  ? `${({ online: '在线', offline: '离线', busy: '忙碌', away: '暂离' } as Record<string, string>)[action.status] || action.status || '未指定'}${action.text ? ` · ${action.text}` : ''}`
  : action.content || '无内容'
const triggerLabel = (trigger?: string) => ({ manual: '手动触发', scheduled: '定时判断', resume: '重新打开后判断' } as Record<string, string>)[trigger || ''] || ''

const toggleMain = () => {
  if (props.chat.autonomyEnabled && !props.chat.autonomyState?.nextCheckAt) {
    props.chat.autonomyState ||= {}
    props.chat.autonomyState.nextCheckAt = Date.now() + normalizeAutonomyIntervalMinutes(props.chat.autonomyMinIntervalMinutes) * 60000
    props.chat.autonomyLastMeaningfulActionAt ||= Date.now()
  }
  save()
}

const saveInterval = () => {
  const parsed = Number(intervalDraft.value.trim())
  if (!Number.isFinite(parsed)) {
    intervalDraft.value = String(props.chat.autonomyMinIntervalMinutes)
    feedback.value = { type: 'error', text: '请输入有效的分钟数' }
    return
  }
  const normalized = normalizeAutonomyIntervalMinutes(parsed)
  props.chat.autonomyMinIntervalMinutes = normalized
  intervalDraft.value = String(normalized)
  props.chat.autonomyState ||= {}
  props.chat.autonomyState.nextCheckAt = Date.now() + normalized * 60000
  feedback.value = parsed !== normalized
    ? { type: 'error', text: `检查间隔已调整到允许范围 ${AUTONOMY_INTERVAL_MINUTES_MIN}–${AUTONOMY_INTERVAL_MINUTES_MAX} 分钟` }
    : { type: 'success', text: `最短检查间隔已设为 ${normalized} 分钟` }
  save()
}

const setIntervalPreset = (minutes: number) => {
  intervalDraft.value = String(minutes)
  saveInterval()
}

const saveSilenceHours = () => {
  const parsed = Number(silenceHoursDraft.value.trim())
  if (!Number.isFinite(parsed)) {
    silenceHoursDraft.value = String(props.chat.autonomyMaxSilenceMinutes / 60)
    feedback.value = { type: 'error', text: '请输入有效的小时数' }
    return
  }
  const minutes = normalizeAutonomySilenceMinutes(parsed * 60)
  props.chat.autonomyMaxSilenceMinutes = minutes
  silenceHoursDraft.value = String(Number((minutes / 60).toFixed(1)))
  save()
}

const toggleContactGuarantee = () => {
  if (props.chat.autonomyGuaranteeContact) props.chat.autonomyLastMeaningfulActionAt ||= Date.now()
  save()
}

const toggleEmotionDelivery = () => {
  if (props.chat.autonomyEmotionMustDeliver && !props.chat.autonomyAllowMessages) {
    props.chat.autonomyEmotionMustDeliver = false
    feedback.value = { type: 'error', text: '请先允许角色主动给你发消息' }
  }
  save()
}

const clearHistory = () => {
  props.chat.autonomyHistory = []
  showClearConfirm.value = false
  save()
}
</script>

<template>
  <section class="autonomy-view full-height">
    <header class="autonomy-header glass-header">
      <button class="icon-button" type="button" aria-label="返回" @click="emit('back')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <div class="header-copy"><h1>角色自主活动</h1><span>本地运行</span></div>
      <button class="text-button" type="button" :disabled="!chat.autonomyHistory?.length" @click="showClearConfirm = true">清空</button>
    </header>

    <main class="autonomy-scroll">
      <div class="autonomy-layout">
        <div class="autonomy-column primary-column">
          <section class="hero-card" :class="{ paused: !chat.autonomyEnabled }">
            <div class="hero-identity">
              <div class="hero-avatar" :style="chat.avatarUrl ? { backgroundImage: `url(${chat.avatarUrl})` } : {}">{{ chat.avatarUrl ? '' : chat.avatarText }}</div>
              <div><p class="eyebrow">{{ chat.autonomyEnabled ? '自主活动中' : '自主活动已关闭' }}</p><h2>{{ chat.name }}</h2><p>{{ chat.autonomyEnabled ? '会根据人设、关系和聊天上下文决定是否行动。' : '不会在你没有发消息时调用 API 或产生新活动。' }}</p></div>
            </div>
            <div class="hero-status">
              <div><span>当前状态</span><strong><i :class="statusDotClass"></i>{{ statusLabel }}</strong></div>
              <div><span>下次判断</span><strong>{{ nextCheckLabel }}</strong></div>
            </div>
            <div class="hero-actions">
              <button class="primary-action secondary" type="button" :disabled="!chat.autonomyEnabled || running" @click="runNow(true)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>
                仅预览
              </button>
              <button class="primary-action" type="button" :disabled="!chat.autonomyEnabled || running" @click="runNow(false)">
                <svg v-if="!running" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48 8.48 2.12 2.12m0-12.72-2.12 2.12m-8.48 8.48-2.12 2.12" /></svg>
                <span v-else class="button-spinner" aria-hidden="true"></span>
                {{ running ? '正在判断…' : '立即执行' }}
              </button>
            </div>
          </section>

          <div v-if="feedback" class="feedback" :class="feedback.type" role="status">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path v-if="feedback.type === 'success'" d="m5 12 4 4L19 6"/><path v-else d="M12 8v5m0 3h.01M10.3 4.4 3.5 17a2 2 0 0 0 1.76 3h13.48a2 2 0 0 0 1.76-3L13.7 4.4a2 2 0 0 0-3.4 0Z"/></svg>
            <span>{{ feedback.text }}</span><button type="button" aria-label="关闭提示" @click="feedback = null">×</button>
          </div>

          <section v-if="previewResult" class="settings-card preview-card">
            <div class="section-heading"><div><h3>本次预览</h3><p>{{ previewResult.summary || '角色没有补充判断说明。' }}</p></div><button class="text-button" type="button" @click="previewResult = null">收起</button></div>
            <div v-if="!previewResult.actions.length" class="setting-row preview-empty"><div class="setting-copy"><label>选择保持安静</label><p>本次没有准备执行任何动作。</p></div></div>
            <template v-else>
              <div v-for="(action, index) in previewResult.actions" :key="`${action.type}_${index}`" class="setting-row">
                <div class="setting-icon"><svg viewBox="0 0 24 24"><path d="M5 5h14v14H5zM8 12l2.5 2.5L16 9"/></svg></div>
                <div class="setting-copy"><label>{{ actionLabel(action.type) }} · {{ action.allowed ? '允许执行' : '将被拦截' }}</label><p>{{ action.blockedReason || actionDetail(action) }}</p></div>
              </div>
            </template>
          </section>

          <section class="settings-card">
            <div class="setting-row main-setting">
              <div class="setting-icon"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9M12 7v5l3 2"/></svg></div>
              <div class="setting-copy"><label for="autonomy-main">允许角色自主活动</label><p>网页存在时自主判断；重新打开后可结算经过的时间。</p></div>
              <label class="switch"><input id="autonomy-main" v-model="chat.autonomyEnabled" type="checkbox" @change="toggleMain"><span></span></label>
            </div>
          </section>

          <section class="settings-card" :class="{ disabled: !chat.autonomyEnabled }">
            <div class="section-heading"><div><h3>允许的行为</h3><p>角色仍然拥有是否执行的最终决定权。</p></div></div>
            <div class="setting-row">
              <div class="setting-icon"><svg viewBox="0 0 24 24"><path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z"/></svg></div>
              <div class="setting-copy"><label for="allow-message">主动给我发消息</label><p>允许在你没有先开口时主动联系。</p></div>
              <label class="switch"><input id="allow-message" v-model="chat.autonomyAllowMessages" type="checkbox" :disabled="!chat.autonomyEnabled" @change="toggleMessagePermission"><span></span></label>
            </div>
            <div class="setting-row">
              <div class="setting-icon"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 9h.01M4 16l4-4 3 3 3-4 6 6"/></svg></div>
              <div class="setting-copy"><label for="allow-moment">朋友圈活动</label><p>发布动态，并保留后续互动能力。</p></div>
              <label class="switch"><input id="allow-moment" v-model="chat.autonomyAllowMoments" type="checkbox" :disabled="!chat.autonomyEnabled" @change="save"><span></span></label>
            </div>
            <div class="setting-row">
              <div class="setting-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg></div>
              <div class="setting-copy"><label for="allow-status">上线与状态变化</label><p>{{ chat.enableImmersiveStatus ? '可上线、下线、忙碌或暂离；未触发前不设置状态。' : '需先在上一页开启“沉浸式状态与时间流逝”。' }}</p></div>
              <label class="switch"><input id="allow-status" v-model="chat.autonomyAllowStatus" type="checkbox" :disabled="!chat.autonomyEnabled || !chat.enableImmersiveStatus" @change="toggleStatusPermission"><span></span></label>
            </div>
          </section>

          <section class="settings-card" :class="{ disabled: !chat.autonomyEnabled }">
            <div class="section-heading"><div><h3>活动节奏</h3><p>这些是运行边界，不是强制角色行动的时间表。</p></div></div>
            <div class="setting-row">
              <div class="setting-copy"><label for="catchup">重新打开时结算时间</label><p>页面被清除期间不运行；再次打开后判断是否留下过活动。</p></div>
              <label class="switch"><input id="catchup" v-model="chat.autonomyCatchup" type="checkbox" :disabled="!chat.autonomyEnabled" @change="save"><span></span></label>
            </div>
            <div class="field-grid">
              <label>可活动时段<span class="select-wrap"><select v-model.number="chat.autonomyActiveStart" :disabled="!chat.autonomyEnabled" @change="save"><option v-for="hour in 24" :key="hour - 1" :value="hour - 1">{{ String(hour - 1).padStart(2, '0') }}:00</option></select><svg viewBox="0 0 24 24"><path d="m8 10 4 4 4-4"/></svg></span></label>
              <label>至<span class="select-wrap"><select v-model.number="chat.autonomyActiveEnd" :disabled="!chat.autonomyEnabled" @change="save"><option v-for="hour in 24" :key="hour" :value="hour">{{ String(hour).padStart(2, '0') }}:00</option></select><svg viewBox="0 0 24 24"><path d="m8 10 4 4 4-4"/></svg></span></label>
              <label>最短检查间隔
                <span class="number-field" :class="{ disabled: !chat.autonomyEnabled }">
                  <input v-model="intervalDraft" type="text" inputmode="numeric" :disabled="!chat.autonomyEnabled" aria-label="最短检查间隔分钟数" @keydown.enter.prevent="saveInterval" @blur="saveInterval">
                  <span>分钟</span>
                </span>
                <span class="field-hint">可手动输入 {{ AUTONOMY_INTERVAL_MINUTES_MIN }}–{{ AUTONOMY_INTERVAL_MINUTES_MAX }} 分钟</span>
                <span class="interval-presets" aria-label="常用检查间隔">
                  <button v-for="minutes in [5, 15, 30, 60, 120]" :key="minutes" type="button" :disabled="!chat.autonomyEnabled" :class="{ active: chat.autonomyMinIntervalMinutes === minutes }" @click="setIntervalPreset(minutes)">{{ minutes < 60 ? `${minutes} 分` : `${minutes / 60} 小时` }}</button>
                </span>
              </label>
            </div>
          </section>

          <section class="settings-card" :class="{ disabled: !chat.autonomyEnabled }">
            <div class="section-heading"><div><h3>联系保障</h3><p>为需要明确送达的自主活动设置底线。</p></div></div>
            <div class="setting-row">
              <div class="setting-icon"><svg viewBox="0 0 24 24"><path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z"/></svg></div>
              <div class="setting-copy"><label for="contact-guarantee">最低联系保障</label><p>超过设定时间仍无自主行动时，本次判断必须选择一种获准行为。</p></div>
              <label class="switch"><input id="contact-guarantee" v-model="chat.autonomyGuaranteeContact" type="checkbox" :disabled="!chat.autonomyEnabled" @change="toggleContactGuarantee"><span></span></label>
            </div>
            <div v-if="chat.autonomyGuaranteeContact" class="setting-row compact-setting">
              <div class="setting-copy"><label>最长沉默时间</label><p>至少 0.5 小时，最长 30 天。</p></div>
              <span class="number-field compact">
                <input v-model="silenceHoursDraft" type="text" inputmode="decimal" :disabled="!chat.autonomyEnabled" aria-label="最长沉默小时数" @keydown.enter.prevent="saveSilenceHours" @blur="saveSilenceHours">
                <span>小时</span>
              </span>
            </div>
            <div class="setting-row">
              <div class="setting-icon"><svg viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 4.5 2.8 7.7 8 9 5.2-1.3 8-4.5 8-9V7Z"/><path d="M12 8v5m0 3h.01"/></svg></div>
              <div class="setting-copy"><label for="emotion-delivery">重要情绪必达</label><p>角色判断有需要让你知道的强烈情绪时，必须形成一条可靠未读消息。</p></div>
              <label class="switch"><input id="emotion-delivery" v-model="chat.autonomyEmotionMustDeliver" type="checkbox" :disabled="!chat.autonomyEnabled" @change="toggleEmotionDelivery"><span></span></label>
            </div>
            <div class="delivery-state-row">
              <span><i :class="{ active: pendingDeliveryCount > 0 }"></i>{{ pendingDeliveryCount > 0 ? `${pendingDeliveryCount} 条消息等待确认` : '没有待确认的重要消息' }}</span>
              <span>{{ ledgerLabel }}</span>
            </div>
          </section>
        </div>

        <aside class="autonomy-column history-column">
          <section class="history-card">
            <div class="history-head"><div><h3>活动历史</h3><p>实际动作与选择沉默都会留在本机。</p></div><span>{{ chat.autonomyHistory?.length || 0 }}</span></div>
            <div class="filter-tabs" role="tablist" aria-label="活动类型">
              <button v-for="item in filters" :key="item.id" type="button" :class="{ active: filter === item.id }" @click="filter = item.id">{{ item.label }}</button>
            </div>
            <div v-if="history.length" class="timeline">
              <article v-for="event in history" :key="event.id" class="timeline-item" :class="event.type">
                <div class="timeline-marker"><svg viewBox="0 0 24 24"><path v-if="event.type === 'message'" d="M5 5h14v11H9l-4 3Z"/><path v-else-if="event.type === 'moment'" d="M4 5h16v14H4zM4 16l4-4 3 3 3-4 6 6"/><path v-else-if="event.type === 'status'" d="M12 4a8 8 0 1 0 8 8"/><path v-else-if="event.type === 'error'" d="M12 8v5m0 3h.01M4 20h16L12 4Z"/><path v-else d="M5 12h14"/></svg></div>
                <div class="timeline-content"><div><strong>{{ event.title }}</strong><time>{{ formatTime(event.createdAt) }}</time></div><p>{{ event.detail }}</p><span v-if="triggerLabel(event.trigger)">{{ triggerLabel(event.trigger) }}</span><span v-if="event.catchup">经过时间结算</span><span v-if="event.blockedReason">权限已拦截</span></div>
              </article>
            </div>
            <div v-else class="empty-state">
              <div><svg viewBox="0 0 24 24"><path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4"/></svg></div>
              <h4>{{ filter === 'all' ? '还没有活动记录' : '没有这一类活动' }}</h4>
              <p>{{ chat.autonomyEnabled ? '角色完成第一次自主判断后，记录会出现在这里。' : '开启自主活动后，角色的选择会保存在这里。' }}</p>
            </div>
          </section>
          <p class="local-note"><svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6Z"/><path d="m9 12 2 2 4-4"/></svg>活动状态、消息与历史只保存在当前设备。</p>
        </aside>
      </div>
    </main>

    <Teleport to="body">
      <div v-if="showClearConfirm" class="autonomy-overlay" @click.self="showClearConfirm = false">
        <div class="autonomy-modal" role="dialog" aria-modal="true" aria-labelledby="clear-title">
          <div class="modal-icon"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg></div>
          <h3 id="clear-title">清空活动历史？</h3><p>只删除自主活动时间线，不会删除聊天消息或朋友圈。</p>
          <div class="modal-actions"><button type="button" @click="showClearConfirm = false">取消</button><button class="danger" type="button" @click="clearHistory">清空</button></div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.autonomy-view{display:flex;flex-direction:column;background:var(--sys-bg-primary);color:var(--text-primary);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",sans-serif}.autonomy-header{height:58px;min-height:58px;display:grid;grid-template-columns:48px 1fr 48px;align-items:center;padding-top:env(safe-area-inset-top);border-bottom:1px solid var(--border-color);background:var(--sys-bg-secondary);z-index:3}.header-copy{text-align:center;line-height:1.1}.header-copy h1{font-size:16px;letter-spacing:.2px;margin:0;font-weight:650}.header-copy span{display:block;margin-top:4px;color:var(--text-tertiary);font-size:10px}.icon-button,.text-button{border:0;background:transparent;color:var(--text-primary);font:inherit;height:44px;display:grid;place-items:center;cursor:pointer;border-radius:10px}.icon-button{width:44px;margin-left:4px}.icon-button svg{width:22px;height:22px}.text-button{font-size:13px;color:var(--text-secondary);padding:0 10px}.text-button:disabled{opacity:.35;cursor:not-allowed}.icon-button:hover,.text-button:not(:disabled):hover{background:var(--sys-bg-primary)}button:focus-visible,select:focus-visible,input:focus-visible+span{outline:2px solid #3478f6;outline-offset:2px}.autonomy-scroll{flex:1;overflow:auto;padding:22px 20px calc(28px + env(safe-area-inset-bottom))}.autonomy-layout{width:min(1060px,100%);margin:auto;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:18px;align-items:start}.autonomy-column{display:flex;flex-direction:column;gap:14px}.hero-card,.settings-card,.history-card{background:var(--card-bg-solid);border:1px solid var(--border-color);border-radius:16px;box-shadow:0 4px 14px rgba(0,0,0,.025)}.hero-card{padding:20px}.hero-card.paused{background:color-mix(in srgb,var(--card-bg-solid) 80%,var(--sys-bg-primary))}.hero-identity{display:flex;gap:14px;align-items:center}.hero-avatar{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--sys-bg-tertiary);background-size:cover;background-position:center;font-size:20px;font-weight:650;box-shadow:0 0 0 3px var(--card-bg-solid),0 0 0 4px var(--border-color)}.eyebrow{font-size:10px!important;text-transform:uppercase;letter-spacing:1px;color:#4f8b70!important;font-weight:650;margin-bottom:4px!important}.hero-card.paused .eyebrow{color:var(--text-tertiary)!important}.hero-identity h2{font-size:19px;margin:0 0 4px}.hero-identity p{font-size:12px;line-height:1.55;color:var(--text-secondary);margin:0}.hero-status{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0 12px}.hero-status>div{padding:11px 12px;border-radius:11px;background:var(--sys-bg-primary);min-width:0}.hero-status span{font-size:10px;color:var(--text-tertiary);display:block;margin-bottom:5px}.hero-status strong{font-size:12px;font-weight:550;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hero-status i{width:7px;height:7px;border-radius:50%;background:#979797;box-shadow:0 0 0 3px rgba(151,151,151,.1)}.hero-status i.online{background:#52a575;box-shadow:0 0 0 3px rgba(82,165,117,.12)}.hero-status i.busy{background:#d66d68}.hero-status i.away{background:#d6a24e}.primary-action{width:100%;height:42px;border-radius:11px;border:1px solid var(--text-primary);background:var(--text-primary);color:var(--sys-bg-secondary);font:inherit;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:transform .15s,opacity .15s,background .15s}.primary-action:hover:not(:disabled){opacity:.88}.primary-action:active:not(:disabled){transform:scale(.985)}.primary-action:disabled{opacity:.28;cursor:not-allowed}.primary-action svg{width:17px;height:17px}.button-spinner{width:15px;height:15px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .75s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}svg{fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.feedback{min-height:42px;padding:9px 12px;border-radius:12px;display:flex;align-items:center;gap:9px;font-size:12px;border:1px solid}.feedback svg{width:17px;height:17px;flex:none}.feedback.success{color:#397a5c;background:rgba(82,165,117,.08);border-color:rgba(82,165,117,.18)}.feedback.error{color:#b9504c;background:rgba(214,109,104,.08);border-color:rgba(214,109,104,.18)}.feedback button{margin-left:auto;border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer}.settings-card{overflow:hidden}.section-heading{padding:16px 16px 9px}.section-heading h3,.history-head h3{font-size:14px;margin:0 0 4px}.section-heading p,.history-head p{font-size:11px;line-height:1.45;color:var(--text-tertiary);margin:0}.setting-row{min-height:62px;padding:11px 16px;display:flex;align-items:center;gap:11px;position:relative}.setting-row:not(:last-child)::after{content:"";position:absolute;height:1px;background:var(--border-color);left:51px;right:0;bottom:0}.main-setting{min-height:72px}.setting-icon{width:27px;height:27px;border-radius:8px;background:var(--sys-bg-primary);display:grid;place-items:center;color:var(--text-secondary);flex:none}.setting-icon svg{width:15px;height:15px}.setting-copy{flex:1;min-width:0}.setting-copy label{display:block;font-size:13px;font-weight:520;line-height:1.3}.setting-copy p{font-size:10.5px;color:var(--text-tertiary);line-height:1.45;margin:4px 0 0}.switch{width:40px;height:24px;flex:none;position:relative}.switch input{position:absolute;opacity:0;pointer-events:none}.switch span{position:absolute;inset:0;border-radius:999px;background:#d7d7da;cursor:pointer;transition:.22s}.switch span::after{content:"";position:absolute;width:18px;height:18px;top:3px;left:3px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.22);transition:.22s}.switch input:checked+span{background:var(--text-primary)}.switch input:checked+span::after{transform:translateX(16px);background:var(--sys-bg-secondary)}.switch input:disabled+span{cursor:not-allowed;opacity:.45}.settings-card.disabled>.setting-row:not(.main-setting),.settings-card.disabled>.section-heading,.settings-card.disabled>.field-grid{opacity:.48}.field-grid{border-top:1px solid var(--border-color);padding:13px 16px 16px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.field-grid>label{font-size:10px;color:var(--text-tertiary);display:flex;flex-direction:column;gap:6px}.field-grid>label:last-child{grid-column:1/-1}.select-wrap{height:38px;position:relative;display:block}.select-wrap select{appearance:none;width:100%;height:100%;border:1px solid var(--border-color);border-radius:9px;background:var(--sys-bg-primary);color:var(--text-primary);font:inherit;font-size:12px;padding:0 30px 0 11px;cursor:pointer}.select-wrap svg{position:absolute;right:9px;top:11px;width:16px;height:16px;pointer-events:none;color:var(--text-tertiary)}.history-card{padding:17px;min-height:360px}.history-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.history-head>span{min-width:28px;height:24px;padding:0 7px;border-radius:999px;background:var(--sys-bg-primary);display:grid;place-items:center;font-size:11px;color:var(--text-secondary)}.filter-tabs{display:flex;gap:4px;margin:15px 0 14px;padding:3px;background:var(--sys-bg-primary);border-radius:9px}.filter-tabs button{height:30px;flex:1;border:0;border-radius:7px;background:transparent;color:var(--text-tertiary);font:inherit;font-size:11px;cursor:pointer;transition:.18s}.filter-tabs button:hover{color:var(--text-primary)}.filter-tabs button.active{background:var(--sys-bg-secondary);color:var(--text-primary);font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.05)}.timeline{display:flex;flex-direction:column}.timeline-item{display:grid;grid-template-columns:29px 1fr;gap:9px;position:relative;padding-bottom:15px}.timeline-item:not(:last-child)::before{content:"";position:absolute;width:1px;background:var(--border-color);top:27px;bottom:0;left:14px}.timeline-marker{width:29px;height:29px;border-radius:9px;background:var(--sys-bg-primary);display:grid;place-items:center;color:var(--text-secondary);z-index:1}.timeline-marker svg{width:15px;height:15px}.timeline-item.error .timeline-marker{color:#b9504c;background:rgba(214,109,104,.08)}.timeline-content{min-width:0;padding-top:1px}.timeline-content>div{display:flex;align-items:center;gap:8px}.timeline-content strong{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.timeline-content time{font-size:9.5px;color:var(--text-tertiary);margin-left:auto;white-space:nowrap}.timeline-content p{font-size:11px;line-height:1.5;color:var(--text-secondary);margin:4px 0 0;word-break:break-word}.timeline-content>span{display:inline-block;margin-top:5px;padding:2px 6px;border-radius:5px;background:var(--sys-bg-primary);font-size:9px;color:var(--text-tertiary)}.empty-state{min-height:245px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px}.empty-state>div{width:45px;height:45px;border-radius:14px;background:var(--sys-bg-primary);display:grid;place-items:center;color:var(--text-tertiary)}.empty-state svg{width:21px;height:21px}.empty-state h4{font-size:13px;margin:13px 0 5px}.empty-state p{max-width:230px;font-size:10.5px;line-height:1.55;color:var(--text-tertiary);margin:0}.local-note{display:flex;align-items:center;justify-content:center;gap:6px;font-size:10px;color:var(--text-tertiary);margin:0}.local-note svg{width:14px;height:14px}.autonomy-overlay{position:fixed;inset:0;z-index:10020;background:rgba(0,0,0,.38);display:grid;place-items:center;padding:20px;backdrop-filter:blur(3px)}.autonomy-modal{width:min(330px,100%);background:var(--sys-bg-secondary);border:1px solid var(--border-color);border-radius:18px;padding:21px;text-align:center;box-shadow:0 18px 48px rgba(0,0,0,.14);animation:modal-in .18s ease-out}@keyframes modal-in{from{opacity:0;transform:scale(.96) translateY(4px)}}.modal-icon{width:42px;height:42px;margin:0 auto 12px;border-radius:13px;background:rgba(214,109,104,.08);color:#c35450;display:grid;place-items:center}.modal-icon svg{width:20px;height:20px}.autonomy-modal h3{font-size:16px;margin:0 0 7px}.autonomy-modal p{font-size:11px;color:var(--text-secondary);line-height:1.55;margin:0 0 18px}.modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.modal-actions button{height:40px;border:1px solid var(--border-color);border-radius:10px;background:var(--sys-bg-primary);color:var(--text-primary);font:inherit;font-size:12px;cursor:pointer}.modal-actions button:hover{filter:brightness(.97)}.modal-actions .danger{background:#c95752;border-color:#c95752;color:#fff;font-weight:600}
.hero-actions{display:grid;grid-template-columns:.8fr 1.2fr;gap:8px}.primary-action.secondary{background:var(--sys-bg-primary);color:var(--text-primary);border-color:var(--border-color);font-weight:550}.hero-status i.unset,.hero-status i.disabled{background:#a8a8ab;box-shadow:0 0 0 3px rgba(151,151,151,.08)}.preview-card .section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.preview-card .section-heading .text-button{width:auto;height:28px;margin-top:-3px}.preview-empty{min-height:58px}.timeline-content>span+span{margin-left:4px}
.text-button{width:48px;padding:0}
.number-field{height:38px;display:flex;align-items:center;border:1px solid var(--border-color);border-radius:9px;background:var(--sys-bg-primary);overflow:hidden;transition:border-color .18s,box-shadow .18s}.number-field:focus-within{border-color:#3478f6;box-shadow:0 0 0 2px rgba(52,120,246,.12)}.number-field input{width:100%;height:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--text-primary);font:inherit;font-size:12px;padding:0 11px;appearance:none}.number-field>span{height:24px;display:flex;align-items:center;padding:0 11px;border-left:1px solid var(--border-color);color:var(--text-tertiary);font-size:10px;white-space:nowrap}.number-field.disabled{opacity:.48}.field-hint{font-size:9.5px;color:var(--text-tertiary);line-height:1.4}.interval-presets{display:flex;gap:5px;flex-wrap:wrap}.interval-presets button{height:27px;padding:0 9px;border:1px solid var(--border-color);border-radius:7px;background:var(--sys-bg-primary);color:var(--text-secondary);font:inherit;font-size:9.5px;cursor:pointer}.interval-presets button:hover:not(:disabled){color:var(--text-primary)}.interval-presets button.active{background:var(--text-primary);border-color:var(--text-primary);color:var(--sys-bg-secondary);font-weight:600}.interval-presets button:disabled{opacity:.45;cursor:not-allowed}.compact-setting{min-height:56px;padding-left:54px}.number-field.compact{width:112px;flex:none}.delivery-state-row{min-height:43px;padding:10px 16px;border-top:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--text-tertiary);font-size:9.5px}.delivery-state-row span{display:flex;align-items:center;gap:6px}.delivery-state-row i{width:6px;height:6px;border-radius:50%;background:#9b9b9f}.delivery-state-row i.active{background:#d66d68;box-shadow:0 0 0 3px rgba(214,109,104,.1)}
@media(max-width:760px){.autonomy-scroll{padding:14px 12px calc(24px + env(safe-area-inset-bottom))}.autonomy-layout{display:flex;flex-direction:column}.primary-column,.history-column{width:100%}.history-column{order:2}.hero-card,.settings-card,.history-card{border-radius:14px}.history-card{min-height:330px}.hero-card{padding:17px}.hero-avatar{width:52px;height:52px}.autonomy-header{height:56px;min-height:56px}}
@media(max-width:430px){.delivery-state-row{align-items:flex-start;flex-direction:column;gap:5px}.compact-setting{padding-left:16px}}
.autonomy-view,.autonomy-scroll,.autonomy-layout,.autonomy-column,.field-grid,.field-grid>label,.select-wrap,.select-wrap select{min-width:0}.autonomy-view,.autonomy-scroll{width:100%;box-sizing:border-box}.field-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
