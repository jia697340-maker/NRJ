<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ensureAutonomyDefaults, persistAutonomyChat, runAutonomousCheck, type AutonomyEvent } from '../../services/characterAutonomy'

const props = defineProps<{ chat: any }>()
const emit = defineEmits<{ (e: 'back'): void; (e: 'save'): void }>()
const running = ref(false)
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const showClearConfirm = ref(false)
const filter = ref<'all' | 'message' | 'moment' | 'status'>('all')

onMounted(() => ensureAutonomyDefaults(props.chat))

const save = () => {
  ensureAutonomyDefaults(props.chat)
  persistAutonomyChat(props.chat)
  emit('save')
}

const statusLabel = computed(() => {
  if (!props.chat.autonomyEnabled) return '已暂停'
  if (running.value || props.chat.autonomyState?.running) return '正在判断'
  return ({ online: '在线', offline: '离线', busy: '忙碌', away: '暂离' } as Record<string, string>)[props.chat.autonomyState?.status] || '等待活动'
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

const runNow = async () => {
  if (running.value || !props.chat.autonomyEnabled) return
  running.value = true
  feedback.value = null
  try {
    await runAutonomousCheck(props.chat, 'manual')
    feedback.value = { type: 'success', text: '角色已经完成了这次自主判断' }
  } catch (error: any) {
    feedback.value = { type: 'error', text: error?.message || '检查失败，请稍后重试' }
  } finally {
    running.value = false
  }
}

const toggleMain = () => {
  if (props.chat.autonomyEnabled && !props.chat.autonomyState?.nextCheckAt) {
    props.chat.autonomyState ||= {}
    props.chat.autonomyState.nextCheckAt = Date.now() + 60000
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
              <div><span>当前状态</span><strong><i :class="chat.autonomyState?.status || 'offline'"></i>{{ statusLabel }}</strong></div>
              <div><span>下次判断</span><strong>{{ nextCheckLabel }}</strong></div>
            </div>
            <button class="primary-action" type="button" :disabled="!chat.autonomyEnabled || running" @click="runNow">
              <svg v-if="!running" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48 8.48 2.12 2.12m0-12.72-2.12 2.12m-8.48 8.48-2.12 2.12" /></svg>
              <span v-else class="button-spinner" aria-hidden="true"></span>
              {{ running ? '正在判断…' : '立即检查一次' }}
            </button>
          </section>

          <div v-if="feedback" class="feedback" :class="feedback.type" role="status">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path v-if="feedback.type === 'success'" d="m5 12 4 4L19 6"/><path v-else d="M12 8v5m0 3h.01M10.3 4.4 3.5 17a2 2 0 0 0 1.76 3h13.48a2 2 0 0 0 1.76-3L13.7 4.4a2 2 0 0 0-3.4 0Z"/></svg>
            <span>{{ feedback.text }}</span><button type="button" aria-label="关闭提示" @click="feedback = null">×</button>
          </div>

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
              <label class="switch"><input id="allow-message" v-model="chat.autonomyAllowMessages" type="checkbox" :disabled="!chat.autonomyEnabled" @change="save"><span></span></label>
            </div>
            <div class="setting-row">
              <div class="setting-icon"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 9h.01M4 16l4-4 3 3 3-4 6 6"/></svg></div>
              <div class="setting-copy"><label for="allow-moment">朋友圈活动</label><p>发布动态，并保留后续互动能力。</p></div>
              <label class="switch"><input id="allow-moment" v-model="chat.autonomyAllowMoments" type="checkbox" :disabled="!chat.autonomyEnabled" @change="save"><span></span></label>
            </div>
            <div class="setting-row">
              <div class="setting-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg></div>
              <div class="setting-copy"><label for="allow-status">上线与状态变化</label><p>可上线、下线、忙碌或暂离。</p></div>
              <label class="switch"><input id="allow-status" v-model="chat.autonomyAllowStatus" type="checkbox" :disabled="!chat.autonomyEnabled" @change="save"><span></span></label>
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
              <label>最短检查间隔<span class="select-wrap wide"><select v-model.number="chat.autonomyMinIntervalMinutes" :disabled="!chat.autonomyEnabled" @change="save"><option :value="30">30 分钟</option><option :value="45">45 分钟</option><option :value="60">1 小时</option><option :value="120">2 小时</option></select><svg viewBox="0 0 24 24"><path d="m8 10 4 4 4-4"/></svg></span></label>
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
                <div class="timeline-content"><div><strong>{{ event.title }}</strong><time>{{ formatTime(event.createdAt) }}</time></div><p>{{ event.detail }}</p><span v-if="event.catchup">重新打开后结算</span></div>
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
.text-button{width:48px;padding:0}
@media(max-width:760px){.autonomy-scroll{padding:14px 12px calc(24px + env(safe-area-inset-bottom))}.autonomy-layout{display:flex;flex-direction:column}.primary-column,.history-column{width:100%}.history-column{order:2}.hero-card,.settings-card,.history-card{border-radius:14px}.history-card{min-height:330px}.hero-card{padding:17px}.hero-avatar{width:52px;height:52px}.autonomy-header{height:56px;min-height:56px}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
