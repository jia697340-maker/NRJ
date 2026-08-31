/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import QRCode from 'qrcode'
import type { MusicSourceConfig } from '../../../types/music'
import { checkBundledMusicQrLogin, createBundledMusicQrLogin, createMusicProviders, getBundledMusicQrCapabilities, MUSIC_QR_PROMISE } from '../../../services/musicProviders'
import { useMusicLibrary } from '../../../composables/useMusicLibrary'
import { verifiedEmbedTrack } from '../../../services/musicPlaybackValidation'
import MusicQrConsentModal from './MusicQrConsentModal.vue'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'closeApp'): void; (e: 'openPrivacy', mode?: 'management' | 'public-consent'): void }>()
const { sourceConfigs, privacyPreferences, updateSourceConfig, setMessage } = useMusicLibrary()
const editingId = ref('')
const draftBase = ref('')
const draftUsername = ref('')
const draftToken = ref('')
const checkingId = ref('')
const qrImage = ref('')
const qrStatus = ref('')
const qrSourceName = ref('')
const qrOwnerId = ref('')
const showGuide = ref(false)
const qrConsentVisible = ref(false)
const pendingQrSource = ref<MusicSourceConfig | null>(null)
const pendingQrPlatform = ref<{ id: string; name: string } | null>(null)
const qrRetentionDays = ref(30)
const qrMaxRetentionDays = ref(365)
const qrPromiseText = ref(MUSIC_QR_PROMISE)
let qrTimer: number | null = null
const aggregateLoginSources = [
  { id: 'netease', name: '网易云' },
  { id: 'qq', name: 'QQ音乐' },
  { id: 'bilibili', name: 'B站' }
]
const sourceAddressLabel = (source: MusicSourceConfig) => source.kind === 'aggregate'
  ? '扫码登录由本站公开代理提供（普通用户无需配置）'
  : source.kind === 'embed' ? '使用平台公开网页播放器，无需服务地址'
  : source.apiBase || '尚未配置服务地址'

const editSource = (source: MusicSourceConfig) => { editingId.value = source.id; draftBase.value = source.apiBase || ''; draftUsername.value = source.username || ''; draftToken.value = source.token || '' }
const saveSource = (source: MusicSourceConfig) => {
  const apiBase = draftBase.value.trim()
  updateSourceConfig({ ...source, enabled: source.anonymousPublic ? source.enabled : (apiBase ? true : source.enabled), apiBase, username: draftUsername.value.trim(), token: source.kind === 'subsonic' ? draftToken.value : undefined })
  editingId.value = ''
  setMessage(`${source.name}设置已保存`)
  if (source.anonymousPublic && !source.enabled) emit('openPrivacy', 'public-consent')
}
const stopQr = () => { if (qrTimer !== null) window.clearInterval(qrTimer); qrTimer = null }
const startAggregateQrLogin = async (source: MusicSourceConfig, platform: { id: string; name: string }, retentionDays: number, promise: string) => {
  stopQr(); qrImage.value = ''; qrSourceName.value = platform.name; qrStatus.value = '正在生成二维码…'
  qrOwnerId.value = source.id
  try {
    const qr = await createBundledMusicQrLogin(platform.id, retentionDays, promise)
    qrImage.value = qr.imageUrl || await QRCode.toDataURL(qr.url, { width: 256, margin: 1, errorCorrectionLevel: 'M' })
    qrStatus.value = platform.id === 'qq' ? '请使用 QQ App 扫码确认' : `请使用${platform.name} App 扫码确认`
    qrTimer = window.setInterval(async () => {
      try {
        const result = await checkBundledMusicQrLogin(platform.id)
        if (result.status === 'scanned') qrStatus.value = '已扫码，请在手机上确认'
        if (result.status === 'success') { qrStatus.value = `${platform.name}登录成功`; stopQr(); setMessage(`${platform.name}账号已连接`); window.setTimeout(() => { qrImage.value = '' }, 1000) }
        if (result.status === 'expired' || result.status === 'failed') { qrStatus.value = result.message || '二维码已失效，请重新生成'; stopQr() }
      } catch { qrStatus.value = '登录状态查询失败，请稍后重试'; stopQr() }
    }, 1800)
  } catch (error) { qrStatus.value = error instanceof Error ? error.message : '二维码生成失败' }
}
const requestAggregateQrLogin = async (source: MusicSourceConfig, platform: { id: string; name: string }) => {
  const capabilities = await getBundledMusicQrCapabilities()
  if (capabilities.httpOnlySession !== true || capabilities.credentialNotReturned !== true || capabilities.serverSideCredentialStore !== true || capabilities.typedPromiseRequired !== true) {
    setMessage('音乐登录服务尚未完成安全接入，请让部署者检查隔离网关')
    return
  }
  qrRetentionDays.value = Number(capabilities.retentionDays) || 30
  qrMaxRetentionDays.value = Number(capabilities.maxRetentionDays) || 365
  qrPromiseText.value = typeof capabilities.promiseText === 'string' ? capabilities.promiseText : MUSIC_QR_PROMISE
  pendingQrSource.value = source; pendingQrPlatform.value = platform; qrConsentVisible.value = true
}
const confirmQrLogin = (retentionDays: number, promise: string) => {
  const source = pendingQrSource.value; const platform = pendingQrPlatform.value
  qrConsentVisible.value = false
  if (source && platform) void startAggregateQrLogin(source, platform, retentionDays, promise)
}
onBeforeUnmount(stopQr)
const toggleSource = (source: MusicSourceConfig) => {
  if (source.anonymousPublic) {
    if (source.enabled) updateSourceConfig({ ...source, enabled: false })
    else if (sourceConfigs.value.some(item => item.anonymousPublic && item.enabled)) updateSourceConfig({ ...source, enabled: true })
    else emit('openPrivacy', 'public-consent')
    return
  }
  if (!source.enabled && source.kind !== 'local' && source.kind !== 'embed' && !source.apiBase?.trim()) {
    editSource(source)
    setMessage('先填写服务地址，保存后会自动启用')
    return
  }
  updateSourceConfig({ ...source, enabled: !source.enabled })
}
const checkSource = async (source: MusicSourceConfig) => {
  if (source.anonymousPublic && !privacyPreferences.value.allowAnonymousPublicSources) {
    emit('openPrivacy', 'public-consent')
    return
  }
  checkingId.value = source.id
  try {
    if (source.kind === 'aggregate') {
      const capabilities = await getBundledMusicQrCapabilities()
      const ready = capabilities.httpOnlySession === true
        && capabilities.credentialNotReturned === true
        && capabilities.serverSideCredentialStore === true
        && capabilities.typedPromiseRequired === true
      if (!ready) throw new Error('本站公开扫码代理安全能力不完整')
      if (!source.apiBase?.trim()) {
        setMessage('扫码代理正常；账号搜索与播放服务尚未配置')
        return
      }
    }
    const provider = createMusicProviders([{ ...source, enabled: true }])[0]
    if (!provider) throw new Error('该来源无需连接测试')
    if (provider.getProfile) {
      const profile = await provider.getProfile()
      setMessage(profile ? `已连接：${profile.nickname}` : '服务可访问，当前尚未登录')
    } else {
      const result = await provider.search(source.kind === 'embed' ? '讨厌红楼梦' : '音乐')
      if (!result.tracks.length) { setMessage(source.kind === 'aggregate' ? '扫码代理正常；账号搜索没有返回结果' : '来源已响应，但没有返回结果'); return }
      const candidate = result.tracks[0]
      if (verifiedEmbedTrack(candidate)) { setMessage(source.id === 'public-video' ? '国内公开视频目录正常，可打开完整播放器' : '官方视频目录正常，可打开完整播放器'); return }
      const url = provider.getStreamUrl ? await provider.getStreamUrl(candidate, 'standard') : null
      if (!url) { setMessage('搜索正常，但没有解析到完整播放地址'); return }
      setMessage('搜索与播放地址解析正常；实际音频会在点击播放时验证')
    }
  } catch (error) { setMessage(error instanceof Error ? error.message : '连接测试失败') }
  finally { checkingId.value = '' }
}
</script>

<template>
  <div v-if="visible" class="source-mask" @click="emit('close')">
    <section class="source-sheet" @click.stop>
      <header class="source-header">
        <div><div class="source-title">音乐来源</div><div class="source-subtitle">启用后会参与首页与聚合搜索</div></div>
        <button class="source-close" @click="emit('close')">×</button>
      </header>
      <div class="source-list">
        <article v-for="source in sourceConfigs" :key="source.id" class="source-card">
          <div class="source-row">
            <div class="source-mark">{{ source.name.slice(0, 1) }}</div>
            <div class="source-main">
              <div class="source-name">{{ source.name }}</div>
              <div class="source-caps">{{ source.capabilities.join(' · ') }}</div>
            </div>
            <button class="source-switch" :class="{ active: source.enabled }" @click="toggleSource(source)"><span></span></button>
          </div>
          <div v-if="source.kind === 'aggregate' || source.kind === 'subsonic' || source.kind === 'meting' || source.kind === 'netease' || source.kind === 'generic' || source.kind === 'embed'" class="source-config">
            <template v-if="editingId === source.id">
              <input v-model="draftBase" class="source-input" :placeholder="source.kind === 'aggregate' ? '单服务聚合 API 地址' : source.kind === 'meting' ? 'Meting 兼容 API 地址' : 'Navidrome / OpenSubsonic 地址'" />
              <input v-if="source.kind === 'subsonic'" v-model="draftUsername" class="source-input compact" placeholder="用户名" />
              <input v-if="source.kind === 'subsonic'" v-model="draftToken" class="source-input compact" type="password" placeholder="密码" />
              <button class="source-action primary" @click="saveSource(source)">保存</button>
              <button class="source-action" @click="editingId = ''">取消</button>
            </template>
            <template v-else>
              <div class="source-address">{{ sourceAddressLabel(source) }}</div>
              <button v-if="source.kind !== 'embed'" class="source-action" @click="editSource(source)">{{ source.kind === 'aggregate' ? '高级' : '设置' }}</button>
              <button v-if="source.kind === 'aggregate' || source.kind === 'embed' || source.apiBase" class="source-action" :disabled="checkingId === source.id" @click="checkSource(source)">{{ checkingId === source.id ? '检测中' : source.kind === 'aggregate' ? '检测代理' : '检测' }}</button>
            </template>
          </div>
          <div v-if="source.kind === 'aggregate' && editingId !== source.id" class="aggregate-login-row">
            <span>平台账号登录（无需填写服务地址）</span>
            <button v-for="platform in aggregateLoginSources" :key="platform.id" class="source-action" @click="requestAggregateQrLogin(source, platform)">{{ platform.name }}</button>
          </div>
          <div v-if="qrOwnerId === source.id && (qrImage || qrStatus)" class="qr-login-box"><img v-if="qrImage" :src="qrImage" :alt="`${qrSourceName}登录二维码`" /><span><strong>{{ qrSourceName }}</strong>{{ qrStatus }}</span></div>
        </article>
        <button class="guide-toggle" :class="{ active: showGuide }" @click="showGuide = !showGuide"><span>音乐服务说明</span><em>{{ showGuide ? '收起' : '查看' }}</em></button>
        <button class="guide-toggle" @click="emit('openPrivacy', 'management')"><span>音乐与隐私</span><em>查看与管理</em></button>
        <div v-if="showGuide" class="source-guide">
          <strong>首页与公开音乐 · 无需后端</strong>
          <p>发现页、公开榜单与匿名搜索由浏览器直接载入。首次使用只需确认一次，不用填写地址，也不会因为扫码服务离线而消失。</p>
          <strong>扫码登录 · 站点统一提供</strong>
          <p>二维码生成与状态查询由站内公开 Serverless 代理完成。普通用户无需部署服务、启动本地程序或填写 Cookie、Token、账号服务地址；拒绝登录不会影响公开音乐。</p>
        </div>
        <div class="source-note">搜索阶段不会批量请求音频；点击播放时才验证实际音频，遇到试听、失效地址或限流会自动切换下一家。平台账号权益仍由原平台管理。</div>
        <button class="leave-music" @click="emit('closeApp')">返回桌面</button>
      </div>
    </section>
    <MusicQrConsentModal :visible="qrConsentVisible" :platformName="pendingQrPlatform?.name || ''" :defaultRetentionDays="qrRetentionDays" :maxRetentionDays="qrMaxRetentionDays" :promiseText="qrPromiseText" @cancel="qrConsentVisible = false" @confirm="confirmQrLogin" />
  </div>
</template>

<style scoped>
.source-mask{position:absolute;inset:0;z-index:80;display:flex;align-items:flex-end;background:rgba(0,0,0,.42);backdrop-filter:blur(8px)}
.source-sheet{width:100%;max-height:84%;display:flex;flex-direction:column;border:1px solid var(--music-card-border);border-radius:20px 20px 0 0;background:var(--music-card-bg);box-shadow:0 -8px 30px rgba(0,0,0,.12)}
.source-header{display:flex;align-items:center;justify-content:space-between;padding:19px 18px 14px;border-bottom:1px solid var(--music-divider)}
.source-title{font-size:17px;font-weight:750}.source-subtitle{margin-top:4px;color:var(--music-text-sub);font-size:11px}.source-close{width:32px;height:32px;border:0;border-radius:50%;background:var(--music-pill-bg);color:var(--music-text);font-size:22px;line-height:1}
.source-list{overflow:auto;padding:14px 16px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px}.source-card{padding:13px;border:1px solid var(--music-card-border);border-radius:14px;background:var(--music-secondary-bg)}
.leave-music{width:100%;height:42px;border:1px solid var(--music-card-border);border-radius:12px;background:var(--music-card-bg);color:var(--music-text);font-size:12px;font-weight:700}
.source-row{display:flex;align-items:center;gap:11px}.source-mark{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--music-card-border);border-radius:10px;background:var(--music-card-bg);font-size:13px;font-weight:800}.source-main{min-width:0;flex:1}.source-name{font-size:14px;font-weight:700}.source-caps{margin-top:4px;overflow:hidden;color:var(--music-text-sub);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.source-switch{width:42px;height:24px;padding:2px;border:0;border-radius:999px;background:var(--music-text-muted);transition:.2s}.source-switch span{display:block;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s}.source-switch.active{background:var(--music-text)}.source-switch.active span{transform:translateX(18px);background:var(--music-bg)}
.source-config{display:flex;align-items:center;gap:7px;margin-top:12px;padding-top:10px;border-top:1px solid var(--music-divider)}.source-address{min-width:0;flex:1;overflow:hidden;color:var(--music-text-sub);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.source-input{min-width:0;flex:1;height:34px;padding:0 10px;border:1px solid var(--music-card-border);border-radius:10px;outline:0;background:var(--music-card-bg);color:var(--music-text);font:inherit;font-size:11px}.source-input.compact{max-width:82px}.source-action{height:32px;padding:0 11px;border:1px solid var(--music-card-border);border-radius:9px;background:var(--music-card-bg);color:var(--music-text);font-size:11px;white-space:nowrap}.source-action.primary{background:var(--music-text);color:var(--music-bg)}.source-action:disabled{opacity:.45}.login-action{padding:0 12px}.source-note{padding:8px 4px;color:var(--music-text-sub);font-size:10px;line-height:1.6}.qr-login-box{display:flex;align-items:center;gap:12px;margin-top:10px;padding:10px;border:1px solid var(--music-card-border);border-radius:12px;background:var(--music-card-bg);color:var(--music-text-sub);font-size:11px}.qr-login-box img{width:92px;height:92px;border-radius:8px;background:#fff}
.source-sheet button,.source-sheet input{appearance:none;-webkit-appearance:none;font-family:inherit}.aggregate-login-row{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin-top:10px;padding-top:10px;border-top:1px solid var(--music-divider)}.aggregate-login-row>span{margin-right:auto;color:var(--music-text-sub);font-size:11px}.qr-login-box span{display:flex;flex-direction:column;gap:5px;line-height:1.5}.qr-login-box strong{color:var(--music-text);font-size:12px}
.guide-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:42px;padding:0 13px;border:1px solid var(--music-card-border);border-radius:12px;background:var(--music-secondary-bg);color:var(--music-text);font-size:12px;font-weight:700}.guide-toggle em{color:var(--music-text-sub);font-size:10px;font-style:normal}.guide-toggle.active{background:var(--music-card-bg)}.source-guide{display:flex;flex-direction:column;gap:6px;padding:13px;border:1px solid var(--music-card-border);border-radius:12px;background:var(--music-secondary-bg)}.source-guide strong{font-size:12px}.source-guide p{margin:0;color:var(--music-text-sub);font-size:10px;line-height:1.65}
</style>
