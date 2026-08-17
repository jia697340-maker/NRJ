/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import QRCode from 'qrcode'
import type { MusicSourceConfig } from '../../../types/music'
import { checkAggregateQrLogin, createAggregateQrLogin, createMusicProviders } from '../../../services/musicProviders'
import { useMusicLibrary } from '../../../composables/useMusicLibrary'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'closeApp'): void }>()
const { sourceConfigs, updateSourceConfig, setMessage } = useMusicLibrary()
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
let qrTimer: number | null = null
const aggregateLoginSources = [
  { id: 'netease', name: '网易云' }, { id: 'qq', name: 'QQ' },
  { id: 'qq_wx', name: '微信' }, { id: 'kugou', name: '酷狗' }, { id: 'bilibili', name: 'B站' }
]
const sourceAddressLabel = (source: MusicSourceConfig) => source.kind === 'aggregate' && source.apiBase === `${window.location.origin}/music-api`
  ? '本站内置音乐服务（无需配置）'
  : source.apiBase || '尚未配置服务地址'

const editSource = (source: MusicSourceConfig) => { editingId.value = source.id; draftBase.value = source.apiBase || ''; draftUsername.value = source.username || ''; draftToken.value = source.token || '' }
const saveSource = (source: MusicSourceConfig) => {
  const apiBase = draftBase.value.trim()
  updateSourceConfig({ ...source, enabled: apiBase ? true : source.enabled, apiBase, username: draftUsername.value.trim(), token: draftToken.value })
  editingId.value = ''
  setMessage(`${source.name}设置已保存`)
}
const stopQr = () => { if (qrTimer !== null) window.clearInterval(qrTimer); qrTimer = null }
const startAggregateQrLogin = async (source: MusicSourceConfig, platform: { id: string; name: string }) => {
  if (!source.apiBase) { setMessage('请先填写并保存聚合服务地址'); return }
  stopQr(); qrImage.value = ''; qrSourceName.value = platform.name; qrStatus.value = '正在生成二维码…'
  qrOwnerId.value = source.id
  try {
    const qr = await createAggregateQrLogin(source.apiBase, platform.id, source.token)
    const sessionId = qr.sessionId || source.token
    if (qr.sessionId && qr.sessionId !== source.token) updateSourceConfig({ ...source, token: qr.sessionId })
    qrImage.value = qr.imageUrl || await QRCode.toDataURL(qr.url, { width: 256, margin: 1, errorCorrectionLevel: 'M' })
    qrStatus.value = `请使用${platform.name} App 扫码确认`
    qrTimer = window.setInterval(async () => {
      try {
        const result = await checkAggregateQrLogin(source.apiBase!, platform.id, qr.key, sessionId)
        if (result.sessionId && result.sessionId !== source.token) updateSourceConfig({ ...source, token: result.sessionId })
        if (result.status === 'scanned') qrStatus.value = '已扫码，请在手机上确认'
        if (result.status === 'success') { qrStatus.value = `${platform.name}登录成功`; stopQr(); setMessage(`${platform.name}账号已连接`); window.setTimeout(() => { qrImage.value = '' }, 1000) }
        if (result.status === 'expired' || result.status === 'failed') { qrStatus.value = result.message || '二维码已失效，请重新生成'; stopQr() }
      } catch { qrStatus.value = '登录状态查询失败，请检查聚合服务'; stopQr() }
    }, 1800)
  } catch (error) { qrStatus.value = error instanceof Error ? error.message : '二维码生成失败' }
}
onBeforeUnmount(stopQr)
const toggleSource = (source: MusicSourceConfig) => {
  if (!source.enabled && source.kind !== 'local' && !source.apiBase?.trim()) {
    editSource(source)
    setMessage('先填写服务地址，保存后会自动启用')
    return
  }
  updateSourceConfig({ ...source, enabled: !source.enabled })
}
const checkSource = async (source: MusicSourceConfig) => {
  checkingId.value = source.id
  try {
    const provider = createMusicProviders([{ ...source, enabled: true }])[0]
    if (!provider) throw new Error('该来源无需连接测试')
    if (provider.getProfile) {
      const profile = await provider.getProfile()
      setMessage(profile ? `已连接：${profile.nickname}` : '服务可访问，当前尚未登录')
    } else {
      const result = await provider.search('音乐')
      setMessage(result.tracks.length ? '来源连接正常' : '来源已响应，但没有返回结果')
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
          <div v-if="source.kind === 'aggregate' || source.kind === 'subsonic'" class="source-config">
            <template v-if="editingId === source.id">
              <input v-model="draftBase" class="source-input" :placeholder="source.kind === 'aggregate' ? '单服务聚合 API 地址' : 'Navidrome / OpenSubsonic 地址'" />
              <input v-if="source.kind === 'subsonic'" v-model="draftUsername" class="source-input compact" placeholder="用户名" />
              <input v-if="source.kind === 'subsonic'" v-model="draftToken" class="source-input compact" type="password" placeholder="密码" />
              <button class="source-action primary" @click="saveSource(source)">保存</button>
              <button class="source-action" @click="editingId = ''">取消</button>
            </template>
            <template v-else>
              <div class="source-address">{{ sourceAddressLabel(source) }}</div>
              <button class="source-action" @click="editSource(source)">{{ source.kind === 'aggregate' ? '高级' : '设置' }}</button>
              <button v-if="source.apiBase" class="source-action" :disabled="checkingId === source.id" @click="checkSource(source)">{{ checkingId === source.id ? '检测中' : '检测' }}</button>
            </template>
          </div>
          <div v-if="source.kind === 'aggregate' && editingId !== source.id" class="aggregate-login-row">
            <span>{{ source.apiBase ? '账号登录（可选，点击直接出码）' : '本站音乐服务暂不可用' }}</span>
            <button v-for="platform in aggregateLoginSources" :key="platform.id" class="source-action" @click="startAggregateQrLogin(source, platform)">{{ platform.name }}</button>
          </div>
          <div v-if="qrOwnerId === source.id && (qrImage || qrStatus)" class="qr-login-box"><img v-if="qrImage" :src="qrImage" :alt="`${qrSourceName}登录二维码`" /><span><strong>{{ qrSourceName }}</strong>{{ qrStatus }}</span></div>
        </article>
        <button class="guide-toggle" :class="{ active: showGuide }" @click="showGuide = !showGuide"><span>后端搭建说明</span><em>{{ showGuide ? '收起' : '查看' }}</em></button>
        <div v-if="showGuide" class="source-guide">
          <strong>普通用户 · 无需配置</strong>
          <p>本站已通过 /music-api 接入聚合服务，打开应用即可搜索；扫码登录只是歌单、收藏与账号权益的可选扩展。</p>
          <strong>站点部署者 · 一次接入</strong>
          <p>使用项目附带的 docker-compose.music.yml 同时启动网站和 go-music-api，用户只访问网站地址，不需要填写后端 URL。</p>
          <p>公开给多人使用时，后端必须按用户隔离会话；不要让多人共用 cookies.json。</p>
        </div>
        <div class="source-note">搜索只显示可在本应用内完整播放的结果；30 秒试听、官网跳转和不可播放曲目会自动隐藏。平台账号权益仍由原平台管理。</div>
        <button class="leave-music" @click="emit('closeApp')">返回桌面</button>
      </div>
    </section>
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
