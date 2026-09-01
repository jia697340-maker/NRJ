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
  <div v-if="visible" class="source-mask" @click.self="emit('close')">
    <section class="source-dialog" @click.stop>
      <!-- Header -->
      <header class="dialog-header">
        <div class="header-titles">
          <h3 class="main-title">音乐来源</h3>
          <span class="sub-title">启用后会参与首页与聚合搜索</span>
        </div>
        <button class="close-btn" aria-label="关闭" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>

      <!-- Scrollable Body -->
      <div class="dialog-body">
        <div class="source-list">
          <article v-for="source in sourceConfigs" :key="source.id" class="source-card">
            <div class="source-row">
              <div class="source-mark">{{ source.name.slice(0, 1) }}</div>
              <div class="source-main">
                <div class="source-name">{{ source.name }}</div>
                <div class="source-caps">{{ source.capabilities.join(' · ') }}</div>
              </div>
              <button
                class="source-switch"
                :class="{ active: source.enabled }"
                aria-label="切换来源开关"
                @click="toggleSource(source)"
              >
                <span class="switch-thumb"></span>
              </button>
            </div>

            <!-- Config Form or Address Row -->
            <div v-if="source.kind === 'aggregate' || source.kind === 'subsonic' || source.kind === 'meting' || source.kind === 'netease' || source.kind === 'generic' || source.kind === 'embed'" class="source-config">
              <template v-if="editingId === source.id">
                <div class="edit-form-group">
                  <input
                    v-model="draftBase"
                    class="source-input"
                    :placeholder="source.kind === 'aggregate' ? '单服务聚合 API 地址' : source.kind === 'meting' ? 'Meting 兼容 API 地址' : 'Navidrome / OpenSubsonic 地址'"
                  />
                  <div v-if="source.kind === 'subsonic'" class="subsonic-fields">
                    <input v-model="draftUsername" class="source-input" placeholder="用户名" />
                    <input v-model="draftToken" class="source-input" type="password" placeholder="密码" />
                  </div>
                  <div class="edit-actions">
                    <button class="action-btn primary" @click="saveSource(source)">保存</button>
                    <button class="action-btn" @click="editingId = ''">取消</button>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="source-address-row">
                  <span class="source-address">{{ sourceAddressLabel(source) }}</span>
                  <div class="card-btn-group">
                    <button v-if="source.kind !== 'embed'" class="action-btn" @click="editSource(source)">
                      {{ source.kind === 'aggregate' ? '高级' : '设置' }}
                    </button>
                    <button
                      v-if="source.kind === 'aggregate' || source.kind === 'embed' || source.apiBase"
                      class="action-btn"
                      :disabled="checkingId === source.id"
                      @click="checkSource(source)"
                    >
                      {{ checkingId === source.id ? '检测中' : source.kind === 'aggregate' ? '检测代理' : '检测' }}
                    </button>
                  </div>
                </div>
              </template>
            </div>

            <!-- Aggregate Login Row -->
            <div v-if="source.kind === 'aggregate' && editingId !== source.id" class="aggregate-login-row">
              <span class="login-row-label">平台账号登录（无需配置地址）</span>
              <div class="platform-btn-group">
                <button
                  v-for="platform in aggregateLoginSources"
                  :key="platform.id"
                  class="platform-btn"
                  @click="requestAggregateQrLogin(source, platform)"
                >
                  {{ platform.name }}
                </button>
              </div>
            </div>

            <!-- QR Box -->
            <div v-if="qrOwnerId === source.id && (qrImage || qrStatus)" class="qr-login-box">
              <img v-if="qrImage" :src="qrImage" :alt="`${qrSourceName}登录二维码`" />
              <div class="qr-info">
                <strong>{{ qrSourceName }}</strong>
                <span>{{ qrStatus }}</span>
              </div>
            </div>
          </article>
        </div>

        <!-- Guide & Privacy Links -->
        <div class="meta-section">
          <button class="guide-toggle" :class="{ active: showGuide }" @click="showGuide = !showGuide">
            <span>音乐服务说明</span>
            <span class="toggle-icon">{{ showGuide ? '收起' : '查看' }}</span>
          </button>
          
          <div v-if="showGuide" class="source-guide">
            <div class="guide-block">
              <strong>首页与公开音乐 · 无需后端</strong>
              <p>发现页、公开榜单与匿名搜索由浏览器直接载入。首次使用只需确认一次，不用填写地址，也不会因为扫码服务离线而消失。</p>
            </div>
            <div class="guide-block">
              <strong>扫码登录 · 站点统一提供</strong>
              <p>二维码生成与状态查询由站内公开 Serverless 代理完成。普通用户无需部署服务、启动本地程序或填写 Cookie、Token、账号服务地址；拒绝登录不会影响公开音乐。</p>
            </div>
          </div>

          <button class="guide-toggle" @click="emit('openPrivacy', 'management')">
            <span>音乐与隐私</span>
            <span class="toggle-icon">管理</span>
          </button>
        </div>

        <!-- Disclaimer -->
        <p class="source-note">
          搜索阶段不会批量请求音频；点击播放时验证音频，遇到试听、失效地址或限流会自动切换下一家。
        </p>

        <!-- Footer Leave Button -->
        <button class="leave-music" @click="emit('closeApp')">返回桌面</button>
      </div>
    </section>

    <MusicQrConsentModal
      :visible="qrConsentVisible"
      :platformName="pendingQrPlatform?.name || ''"
      :defaultRetentionDays="qrRetentionDays"
      :maxRetentionDays="qrMaxRetentionDays"
      :promiseText="qrPromiseText"
      @cancel="qrConsentVisible = false"
      @confirm="confirmQrLogin"
    />
  </div>
</template>

<style scoped>
.source-mask {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  animation: fadeInMask 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.source-dialog {
  width: 100%;
  max-width: 440px;
  background-color: var(--music-card-bg, #ffffff);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  border-radius: 24px;
  box-shadow: 0 20px 48px -10px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popInDialog 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 22px 14px;
  border-bottom: 1px solid var(--music-divider, rgba(0, 0, 0, 0.05));
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.main-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--music-text, #1e293b);
}

.sub-title {
  font-size: 11px;
  color: var(--music-text-sub, #64748b);
  font-weight: 400;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  background-color: var(--music-pill-bg, rgba(0, 0, 0, 0.04));
  color: var(--music-text, #334155);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.close-btn:hover {
  background-color: var(--music-card-border, rgba(0, 0, 0, 0.08));
}

.close-btn:active {
  transform: scale(0.92);
}

.dialog-body {
  padding: 16px 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 80vh;
  overflow-y: auto;
  box-sizing: border-box;
}

.source-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.source-card {
  padding: 14px 16px;
  border-radius: 16px;
  background-color: var(--music-secondary-bg, rgba(0, 0, 0, 0.025));
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.05));
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.source-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.source-mark {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  border-radius: 10px;
  background-color: var(--music-card-bg, #ffffff);
  font-size: 13px;
  font-weight: 700;
  color: var(--music-text, #1e293b);
  flex-shrink: 0;
}

.source-main {
  min-width: 0;
  flex: 1;
}

.source-name {
  font-size: 13.5px;
  font-weight: 650;
  color: var(--music-text, #1e293b);
}

.source-caps {
  margin-top: 3px;
  overflow: hidden;
  color: var(--music-text-sub, #64748b);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-switch {
  width: 40px;
  height: 22px;
  padding: 2px;
  border: none;
  border-radius: 999px;
  background-color: var(--music-card-border, rgba(0, 0, 0, 0.12));
  cursor: pointer;
  position: relative;
  transition: background-color 0.2s ease;
  flex-shrink: 0;
}

.switch-thumb {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.source-switch.active {
  background-color: var(--music-text, #0f172a);
}

.source-switch.active .switch-thumb {
  transform: translateX(18px);
  background-color: var(--music-bg, #ffffff);
}

.source-config {
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px solid var(--music-divider, rgba(0, 0, 0, 0.05));
}

.source-address-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.source-address {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--music-text-sub, #64748b);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-btn-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  border-radius: 8px;
  background-color: var(--music-card-bg, #ffffff);
  color: var(--music-text, #334155);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s, transform 0.15s;
}

.action-btn:hover {
  background-color: var(--music-secondary-bg, rgba(0, 0, 0, 0.03));
}

.action-btn:active {
  transform: scale(0.95);
}

.action-btn.primary {
  background-color: var(--music-text, #0f172a);
  color: var(--music-bg, #ffffff);
  border-color: var(--music-text, #0f172a);
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.edit-form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subsonic-fields {
  display: flex;
  gap: 8px;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.source-input {
  width: 100%;
  box-sizing: border-box;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.1));
  border-radius: 8px;
  outline: none;
  background-color: var(--music-card-bg, #ffffff);
  color: var(--music-text, #0f172a);
  font-size: 11.5px;
  transition: border-color 0.15s;
}

.source-input:focus {
  border-color: var(--music-text, #0f172a);
}

.aggregate-login-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--music-divider, rgba(0, 0, 0, 0.05));
}

.login-row-label {
  color: var(--music-text-sub, #64748b);
  font-size: 11px;
}

.platform-btn-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.platform-btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  border-radius: 8px;
  background-color: var(--music-card-bg, #ffffff);
  color: var(--music-text, #334155);
  font-size: 10.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s, transform 0.15s;
}

.platform-btn:active {
  transform: scale(0.95);
}

.qr-login-box {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  border-radius: 12px;
  background-color: var(--music-card-bg, #ffffff);
}

.qr-login-box img {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  background-color: #ffffff;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
}

.qr-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--music-text-sub, #64748b);
}

.qr-info strong {
  color: var(--music-text, #0f172a);
  font-size: 12px;
}

.meta-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.guide-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  border-radius: 12px;
  background-color: var(--music-secondary-bg, rgba(0, 0, 0, 0.025));
  color: var(--music-text, #1e293b);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s;
}

.guide-toggle:hover {
  background-color: var(--music-card-border, rgba(0, 0, 0, 0.05));
}

.guide-toggle.active {
  background-color: var(--music-card-bg, #ffffff);
}

.toggle-icon {
  color: var(--music-text-sub, #64748b);
  font-size: 10.5px;
  font-weight: 400;
}

.source-guide {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  border-radius: 12px;
  background-color: var(--music-secondary-bg, rgba(0, 0, 0, 0.02));
}

.guide-block strong {
  display: block;
  font-size: 11.5px;
  color: var(--music-text, #1e293b);
  margin-bottom: 2px;
}

.guide-block p {
  margin: 0;
  color: var(--music-text-sub, #64748b);
  font-size: 10px;
  line-height: 1.55;
}

.source-note {
  margin: 0;
  font-size: 9.5px;
  color: var(--music-text-sub, #94a3b8);
  line-height: 1.5;
  text-align: center;
}

.leave-music {
  width: 100%;
  height: 40px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  background-color: var(--music-card-bg, #ffffff);
  color: var(--music-text, #1e293b);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s, transform 0.15s;
}

.leave-music:hover {
  background-color: var(--music-secondary-bg, rgba(0, 0, 0, 0.04));
}

.leave-music:active {
  transform: scale(0.98);
}

@keyframes fadeInMask {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes popInDialog {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
