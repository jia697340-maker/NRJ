/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  platformName: string
  defaultRetentionDays: number
  maxRetentionDays: number
  promiseText: string
}>()
const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'confirm', retentionDays: number, promise: string): void
}>()
const operatorName = String(import.meta.env.VITE_MUSIC_OPERATOR_NAME || '本站运营者')
const operatorContact = String(import.meta.env.VITE_MUSIC_OPERATOR_CONTACT || '请联系站点提供者')
const retentionChoice = ref('30')
const customDays = ref(30)
const promiseInput = ref('')
const choices = [
  { value: '0', label: '仅本次会话' }, { value: '1', label: '1 天' },
  { value: '7', label: '7 天' }, { value: '30', label: '30 天' },
  { value: '90', label: '90 天' }, { value: 'custom', label: '自定义' }
]
const retentionDays = computed(() => retentionChoice.value === 'custom' ? Math.round(Number(customDays.value)) : Number(retentionChoice.value))
const retentionText = computed(() => retentionDays.value === 0 ? '仅保留到本次浏览器会话结束（服务端最长保留 24 小时）' : `保留 ${retentionDays.value} 天`)
const validRetention = computed(() => Number.isInteger(retentionDays.value) && retentionDays.value >= 0 && retentionDays.value <= props.maxRetentionDays)
const canConfirm = computed(() => validRetention.value && promiseInput.value.trim() === props.promiseText)

watch(() => props.visible, visible => {
  if (!visible) return
  const initial = [0, 1, 7, 30, 90].includes(props.defaultRetentionDays) ? props.defaultRetentionDays : 30
  retentionChoice.value = String(initial)
  customDays.value = Math.min(props.maxRetentionDays, Math.max(1, props.defaultRetentionDays || 30))
  promiseInput.value = ''
})

const confirm = () => {
  if (canConfirm.value) emit('confirm', retentionDays.value, promiseInput.value.trim())
}

const copyAndFillPromise = async () => {
  promiseInput.value = props.promiseText
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.promiseText)
    }
  } catch {}
}
</script>

<template>
  <div v-if="visible" class="consent-mask" @click.stop="emit('cancel')">
    <section class="consent-sheet" @click.stop>
      <header><div><strong>{{ platformName }}扫码登录</strong><small>自愿账号连接与凭据保管确认</small></div><button @click="emit('cancel')">×</button></header>
      <div class="consent-body">
        <div class="consent-card"><strong>账号连接会处理什么</strong><p>站内公开代理会生成二维码、轮询扫码状态，并在你使用个人音乐功能时读取账号昵称、头像、歌单、收藏及已有播放权益。不会上传聊天、角色资料或本地音乐文件。</p></div>
        <div class="consent-card"><strong>凭据如何保管</strong><p>扫码成功后，{{ platformName }} 返回的必要登录凭据保存在本站服务端隔离会话存储中；浏览器只保存随机的 HttpOnly、Secure 会话标识。平台凭据不会返回网页、写入普通日志，也无需你手工填写 Cookie 或 Token。</p></div>
        <div class="consent-card"><strong>功能与风险边界</strong><p>登录完全自愿，拒绝或退出不影响匿名评论、榜单和其他公开功能。本站不会利用该授权发布评论、回复或点赞。平台可能主动使会话失效，或调整扫码与账号接口，本站无法控制其可用性。</p></div>
        <fieldset class="retention-box">
          <legend>选择凭据保留期限</legend>
          <div class="retention-options"><label v-for="choice in choices" :key="choice.value" :class="{ active: retentionChoice === choice.value }"><input v-model="retentionChoice" type="radio" :value="choice.value" />{{ choice.label }}</label></div>
          <label v-if="retentionChoice === 'custom'" class="custom-days">自定义天数<input v-model.number="customDays" type="number" min="1" :max="maxRetentionDays" inputmode="numeric" />最多 {{ maxRetentionDays }} 天</label>
          <small>当前选择：{{ retentionText }}。到期后自动失效并清理；你也可以随时在“音乐与隐私”中立即断开并删除。</small>
        </fieldset>
        <div class="promise-box">
          <div class="promise-header">
            <strong>确认授权承诺</strong>
            <button type="button" class="btn-copy-fill" @click="copyAndFillPromise">复制并填入</button>
          </div>
          <div class="promise-copy">{{ promiseText }}</div>
          <textarea v-model="promiseInput" rows="3" autocomplete="off" spellcheck="false" placeholder="可直接点击右上角“复制并填入”，或在此粘贴/输入上方完整承诺" />
          <small :class="{ valid: canConfirm }">{{ canConfirm ? '承诺文字一致，可以生成二维码' : '承诺文字必须与上方一致' }}</small>
        </div>
        <div class="consent-note">运营者：{{ operatorName }}；联系：{{ operatorContact }}。点击确认表示你选择“{{ retentionText }}”，且理解退出、到期和平台失效均会终止账号连接。</div>
        <div class="consent-actions"><button class="secondary" @click="emit('cancel')">暂不登录</button><button class="primary" :disabled="!canConfirm" @click="confirm">确认承诺并生成二维码</button></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.consent-mask{position:fixed;inset:0;z-index:1006;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.46);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.consent-sheet{width:100%;max-width:440px;max-height:92%;display:flex;flex-direction:column;border:1px solid var(--music-card-border);border-radius:20px 20px 0 0;background:var(--music-card-bg)}header{display:flex;align-items:center;justify-content:space-between;padding:19px 18px 14px;border-bottom:1px solid var(--music-divider)}header strong{display:block;font-size:17px}header small{display:block;margin-top:4px;color:var(--music-text-sub);font-size:11px}header button{width:32px;height:32px;border:0;border-radius:50%;background:var(--music-pill-bg);color:var(--music-text);font-size:22px;cursor:pointer}.consent-body{overflow:auto;padding:14px 16px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px}.consent-card,.retention-box,.promise-box{padding:13px;border:1px solid var(--music-card-border);border-radius:14px;background:var(--music-secondary-bg)}.consent-card strong,.promise-box strong{font-size:13px}.consent-card p{margin:5px 0 0;color:var(--music-text-sub);font-size:10px;line-height:1.65}.retention-box{margin:0}.retention-box legend{padding:0 5px;font-size:13px;font-weight:750}.retention-options{display:flex;flex-wrap:wrap;gap:7px}.retention-options label{display:flex;align-items:center;gap:4px;min-height:32px;padding:0 9px;border:1px solid var(--music-card-border);border-radius:9px;background:var(--music-card-bg);font-size:10px}.retention-options label.active{border-color:var(--music-text);font-weight:750}.retention-options input{width:13px;height:13px;accent-color:var(--music-text)}.retention-box small,.promise-box small{display:block;margin-top:9px;color:var(--music-text-sub);font-size:9px;line-height:1.6}.custom-days{display:flex;align-items:center;gap:8px;margin-top:9px;color:var(--music-text-sub);font-size:10px}.custom-days input{width:74px;height:32px;padding:0 8px;border:1px solid var(--music-card-border);border-radius:8px;background:var(--music-card-bg);color:var(--music-text)}.promise-header{display:flex;align-items:center;justify-content:space-between}.btn-copy-fill{padding:3px 8px;border:1px solid var(--music-card-border);border-radius:6px;background:var(--music-pill-bg);color:var(--music-text);font-size:10px;cursor:pointer;transition:opacity .15s}.btn-copy-fill:hover{opacity:.8}.btn-copy-fill:active{opacity:.6}.promise-copy{margin-top:8px;padding:9px;border-radius:9px;background:var(--music-card-bg);font-size:10px;line-height:1.6;user-select:text}.promise-box textarea{box-sizing:border-box;width:100%;margin-top:8px;padding:9px;border:1px solid var(--music-card-border);border-radius:9px;outline:0;resize:none;background:var(--music-card-bg);color:var(--music-text);font:inherit;font-size:10px;line-height:1.55}.promise-box small.valid{color:#3d8b62}.consent-note{padding:4px;color:var(--music-text-sub);font-size:9px;line-height:1.6}.consent-actions{display:grid;grid-template-columns:1fr 1.5fr;gap:8px}.consent-actions button{min-height:42px;border:1px solid var(--music-card-border);border-radius:12px;font-size:11px;font-weight:750;appearance:none;-webkit-appearance:none;cursor:pointer}.secondary{background:var(--music-secondary-bg);color:var(--music-text)}.primary{background:var(--music-text);color:var(--music-bg)}.primary:disabled{cursor:not-allowed;opacity:.38}
</style>
