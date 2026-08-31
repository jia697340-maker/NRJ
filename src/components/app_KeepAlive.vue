<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  clearKeepAliveLogs,
  enterPictureInPicture,
  exitPictureInPicture,
  initializeKeepAliveRuntime,
  keepAliveConfig,
  keepAliveState,
  registerBackgroundSyncProbe,
  removeUploadedAudio,
  resetKeepAlive,
  runCustomWorker,
  runNetworkProbe,
  saveUploadedAudio,
  setStrategy,
  startAudio,
  startBackgroundTest,
  startKeepAlive,
  stopAudio,
  stopBackgroundTest,
  stopCustomWorker,
  stopKeepAlive,
  updateAudioVolume,
  type KeepAliveAudioSource,
  type KeepAliveStrategy,
} from '../services/keepAliveRuntime'

defineEmits<{ close: [] }>()

type View = 'home' | 'media' | 'lab' | 'diagnostics' | 'logs'
const view = ref<View>('home')
const notice = ref('')
const confirmReset = ref(false)
const customCode = ref(keepAliveConfig.customCode)
const testSeconds = ref(60)
let noticeTimer = 0

const showNotice = (text: string) => {
  notice.value = text
  window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { notice.value = '' }, 2600)
}

const statusText = (value: string) => ({
  idle: '未运行', active: '运行中', playing: '播放中', paused: '已暂停', loading: '载入中',
  released: '已释放', unsupported: '不支持', error: '异常', stalled: '疑似暂停', connecting: '连接中',
  ready: '可使用', checking: '检测中', supported: '可使用', registered: '已登记', inactive: '未接管',
  running: '检测中', success: '正常', complete: '已完成', frozen: '已冻结', hidden: '后台', visible: '前台',
})[value] || value

const statusTone = (value: string) => {
  if (['active', 'playing', 'ready', 'supported', 'registered', 'success', 'visible'].includes(value)) return 'good'
  if (['error', 'unsupported'].includes(value)) return 'bad'
  if (['paused', 'released', 'stalled', 'hidden', 'frozen', 'inactive'].includes(value)) return 'warn'
  return 'neutral'
}

const runningCount = computed(() => [
  keepAliveState.wakeLock === 'active', keepAliveState.audio === 'playing', keepAliveState.worker === 'active',
  keepAliveState.webrtc === 'active', keepAliveState.pip === 'active', keepAliveConfig.titlePulse && keepAliveState.running,
].filter(Boolean).length)

const capabilityRows = computed(() => [
  { name: '屏幕常亮', value: keepAliveState.wakeLock, detail: '仅在页面可见时有效' },
  { name: '媒体会话', value: keepAliveState.audio, detail: keepAliveState.audioName },
  { name: 'Worker 心跳', value: keepAliveState.worker, detail: `${keepAliveState.workerTicks} 次 · 延迟 ${keepAliveState.workerLagMs}ms` },
  { name: 'WebRTC 回环', value: keepAliveState.webrtc, detail: '高耗电实验能力' },
  { name: '动态画中画', value: keepAliveState.pip, detail: '需要用户主动开启' },
  { name: 'Service Worker', value: keepAliveState.serviceWorker, detail: '负责 PWA 缓存与恢复入口' },
])

const audioSources: Array<{ id: KeepAliveAudioSource; name: string; note: string }> = [
  { id: 'silent', name: '无声音频', note: '音频采样本身为静音' },
  { id: 'soft', name: '极低音量', note: '接近无感的低强度音轨' },
  { id: 'upload', name: '本地文件', note: keepAliveState.uploadReady ? keepAliveState.uploadName : 'MP3、M4A、WAV 等' },
  { id: 'url', name: '音频 URL', note: '仅支持 HTTPS 地址' },
]

const strategies: Array<{ id: KeepAliveStrategy; name: string; note: string; experimental?: boolean }> = [
  { id: 'wakeLock', name: '屏幕常亮', note: '防止停留本应用时自动锁屏' },
  { id: 'audio', name: '媒体保活', note: '循环音频并接入系统媒体会话' },
  { id: 'worker', name: 'Worker 心跳', note: '减轻普通后台定时器限速' },
  { id: 'multiTab', name: '多页面协调', note: '检测同源页面并选出活动主页面' },
  { id: 'titlePulse', name: '标题活动提示', note: '后台交替显示活动标记' },
  { id: 'webrtc', name: 'WebRTC 回环', note: '本机数据通道，无摄像头和麦克风', experimental: true },
]

const setAudioSource = async (source: KeepAliveAudioSource) => {
  keepAliveConfig.audioSource = source
  localStorage.setItem('nianrenji-keep-alive-config-v1', JSON.stringify(keepAliveConfig))
  if (keepAliveState.audio === 'playing') {
    try { await startAudio() } catch { /* 错误已写入运行日志。 */ }
  }
}

const handleFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try { await saveUploadedAudio(file); showNotice('本地音频已保存') }
  catch (error) { showNotice(error instanceof Error ? error.message : '音频无法保存') }
}

const applyUrl = async () => {
  if (!/^https:\/\//i.test(keepAliveConfig.audioUrl.trim())) return showNotice('请输入 HTTPS 音频地址')
  await setAudioSource('url')
  try { await startAudio(); showNotice('URL 音频已开始播放') }
  catch { showNotice('URL 音频无法播放，请检查地址与格式') }
}

const toggleRun = async () => {
  try {
    if (keepAliveState.running) await stopKeepAlive()
    else await startKeepAlive()
  } catch { /* 分项错误会显示在状态与日志里。 */ }
}

const toggleStrategy = async (item: typeof strategies[number]) => {
  try { await setStrategy(item.id, !keepAliveConfig[item.id]) }
  catch { showNotice(`${item.name}未能启用`) }
}

const toggleAudioPlayback = async () => {
  try {
    if (keepAliveState.audio === 'playing') await stopAudio()
    else await startAudio()
  } catch { showNotice('音频未能播放，请检查来源') }
}

const togglePip = async () => {
  if (keepAliveState.pip === 'active') await exitPictureInPicture()
  else await enterPictureInPicture()
}

const applyReset = async () => {
  await resetKeepAlive()
  customCode.value = keepAliveConfig.customCode
  confirmReset.value = false
  showNotice('保活设置已重置')
}

const formatDuration = (milliseconds: number) => {
  if (!milliseconds) return '—'
  const seconds = Math.round(milliseconds / 1000)
  return seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}

const formatTime = (value: number) => value ? new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

onMounted(() => { void initializeKeepAliveRuntime() })
</script>

<template>
  <div class="keep-alive-app">
    <header class="ka-header">
      <button v-if="view !== 'home'" class="ka-icon-button" type="button" aria-label="返回" @click="view='home'">‹</button><span v-else></span>
      <div class="ka-header-copy"><h1>保活</h1><p>{{ view==='home'?'后台适应与运行保护':view==='media'?'媒体与画中画':view==='lab'?'代码与实验能力':view==='diagnostics'?'设备体检':'运行记录' }}</p></div>
      <button class="ka-icon-button close" type="button" aria-label="关闭" @click="$emit('close')">×</button>
    </header>
    <div v-if="notice" class="ka-toast" role="status">{{ notice }}</div>

    <main v-if="view==='home'" class="ka-scroll">
      <section class="ka-master" :class="{running:keepAliveState.running}">
        <div class="ka-orbit"><i></i><span>活</span></div>
        <div class="ka-master-copy"><small>{{ keepAliveState.running?'KEEPING ACTIVE':'READY' }}</small><strong>{{ keepAliveState.running?'保活正在运行':'保活工具箱' }}</strong><p>{{ keepAliveState.running?`${runningCount} 项能力当前有效`:'按设备能力组合运行，不承诺系统级永久后台' }}</p></div>
        <button class="ka-master-button" type="button" @click="toggleRun">{{ keepAliveState.running?'停止':'启动' }}</button>
      </section>

      <section class="ka-status-strip">
        <div><span :class="statusTone(keepAliveState.visibility)"></span><small>页面</small><strong>{{ statusText(keepAliveState.visibility) }}</strong></div>
        <div><span :class="statusTone(keepAliveState.lifecycle)"></span><small>生命周期</small><strong>{{ statusText(keepAliveState.lifecycle) }}</strong></div>
        <div><span :class="keepAliveState.standalone?'good':'neutral'"></span><small>运行方式</small><strong>{{ keepAliveState.standalone?'主屏幕':'浏览器' }}</strong></div>
      </section>

      <div class="ka-section-heading"><div><h2>运行策略</h2><p>开关在运行期间也可独立调整</p></div></div>
      <section class="ka-card ka-strategy-list">
        <button v-for="item in strategies" :key="item.id" type="button" @click="toggleStrategy(item)">
          <span class="ka-method-mark">{{ item.name.slice(0,1) }}</span><span class="ka-row-copy"><strong>{{ item.name }}<em v-if="item.experimental">实验</em></strong><small>{{ item.note }}</small></span>
          <i class="ka-switch" :class="{on:keepAliveConfig[item.id]}"><b></b></i>
        </button>
      </section>

      <div class="ka-section-heading"><div><h2>能力状态</h2><p>绿色表示当前实际运行，不只是配置已开启</p></div><button type="button" @click="view='logs'">记录</button></div>
      <section class="ka-card ka-capability-list">
        <div v-for="item in capabilityRows" :key="item.name"><span :class="['ka-state-dot',statusTone(item.value)]"></span><span><strong>{{ item.name }}</strong><small>{{ item.detail }}</small></span><em :class="statusTone(item.value)">{{ statusText(item.value) }}</em></div>
      </section>

      <section class="ka-entry-grid">
        <button type="button" @click="view='media'"><span>声</span><strong>媒体与画中画</strong><small>无声、文件、URL、动态画面</small></button>
        <button type="button" @click="view='diagnostics'"><span>测</span><strong>设备体检</strong><small>离开应用后查看真实存活情况</small></button>
        <button type="button" @click="view='lab'"><span>码</span><strong>代码实验室</strong><small>隔离 Worker 与高级探针</small></button>
        <button type="button" @click="view='logs'"><span>录</span><strong>运行记录</strong><small>冻结、恢复和异常反馈</small></button>
      </section>

      <p class="ka-footnote">移动系统可以暂停或回收任何网页。这里的能力用于提高持续运行概率，并在失效后提供可理解的状态与恢复线索。</p>
      <button class="ka-reset-link" type="button" @click="confirmReset=true">重置全部保活设置</button>
    </main>

    <main v-else-if="view==='media'" class="ka-scroll">
      <section class="ka-card ka-now-playing"><div class="ka-wave"><i v-for="n in 8" :key="n"></i></div><div><small>当前媒体</small><strong>{{ keepAliveState.audioName }}</strong><p>{{ statusText(keepAliveState.audio) }} · 系统媒体会话 {{ statusText(keepAliveState.mediaSession) }}</p></div><button type="button" @click="toggleAudioPlayback">{{ keepAliveState.audio==='playing'?'暂停':'播放' }}</button></section>
      <div class="ka-section-heading"><div><h2>音频来源</h2><p>切换来源不会删除已保存的本地文件</p></div></div>
      <section class="ka-source-grid">
        <button v-for="source in audioSources" :key="source.id" type="button" :class="{active:keepAliveConfig.audioSource===source.id}" @click="setAudioSource(source.id)"><strong>{{ source.name }}</strong><small>{{ source.note }}</small></button>
      </section>
      <section class="ka-card ka-form-card">
        <label class="ka-range-label"><span><strong>播放音量</strong><small>{{ Math.round(keepAliveConfig.audioVolume*100) }}%</small></span><input :value="keepAliveConfig.audioVolume" type="range" min="0" max="0.25" step="0.01" @input="updateAudioVolume(Number(($event.target as HTMLInputElement).value))"></label>
        <p>无声音频的采样内容本身为静音；音量设为 0 仍可能被浏览器识别为静音媒体。其他音频请按实际需要调整。</p>
      </section>
      <section class="ka-card ka-form-card">
        <h2>本地音频</h2><p>文件仅保存在当前设备浏览器中，不会上传。支持最大 80 MB。</p>
        <label class="ka-file-button">选择音频文件<input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.webm" @change="handleFile"></label>
        <button v-if="keepAliveState.uploadReady" class="ka-text-button danger" type="button" @click="removeUploadedAudio">删除已保存音频</button>
      </section>
      <section class="ka-card ka-form-card"><h2>音频 URL</h2><p>远程地址必须使用 HTTPS；部分站点可能限制跨域播放。</p><div class="ka-inline-input"><input v-model.trim="keepAliveConfig.audioUrl" inputmode="url" autocomplete="url" placeholder="https://example.com/audio.mp3"><button type="button" @click="applyUrl">应用</button></div></section>
      <div class="ka-section-heading"><div><h2>动态画中画</h2><p>显示时间、页面状态和 Worker 心跳</p></div></div>
      <section class="ka-card ka-pip-card"><div class="ka-pip-preview"><span></span><strong>应用保活中</strong><small>{{ new Date().toLocaleTimeString('zh-CN',{hour12:false}) }}</small></div><div class="ka-pip-copy"><strong>{{ keepAliveState.pip==='active'?'画中画正在显示':'悬浮状态窗口' }}</strong><p>需要浏览器支持 Canvas 流与视频画中画，开启时必须由用户点击。</p><button type="button" @click="togglePip">{{ keepAliveState.pip==='active'?'退出画中画':'开启画中画' }}</button></div></section>
    </main>

    <main v-else-if="view==='diagnostics'" class="ka-scroll">
      <section class="ka-card ka-test-card">
        <span class="ka-test-ring" :class="{running:keepAliveState.testStatus==='running'}">{{ keepAliveState.testStatus==='running'?'测':'检' }}</span>
        <div><small>后台体检</small><strong>{{ keepAliveState.testStatus==='running'?'请正常离开应用':'测量真实暂停与恢复情况' }}</strong><p>返回后会根据经过时间、Worker 心跳和页面生命周期生成结果。</p></div>
      </section>
      <section class="ka-card ka-form-card"><h2>测试时长</h2><div class="ka-segments"><button v-for="seconds in [30,60,180,300]" :key="seconds" type="button" :class="{active:testSeconds===seconds}" @click="testSeconds=seconds">{{ seconds<60?`${seconds}秒`:`${seconds/60}分钟` }}</button></div><button v-if="keepAliveState.testStatus!=='running'" class="ka-wide-button" type="button" @click="startBackgroundTest(testSeconds)">开始体检</button><button v-else class="ka-wide-button secondary" type="button" @click="stopBackgroundTest">结束并查看</button></section>
      <section class="ka-card ka-metric-grid">
        <div><small>最近后台</small><strong>{{ formatDuration(keepAliveState.lastHiddenDurationMs) }}</strong></div><div><small>最长心跳间隔</small><strong>{{ formatDuration(keepAliveState.longestGapMs) }}</strong></div><div><small>本次后台</small><strong>{{ formatDuration(keepAliveState.testHiddenDurationMs) }}</strong></div><div><small>本次 Worker 心跳</small><strong>{{ keepAliveState.testWorkerTicks || '—' }}</strong></div>
      </section>
      <section class="ka-card ka-capability-list"><div><span :class="['ka-state-dot',keepAliveState.pageWasDiscarded?'warn':'good']"></span><span><strong>页面回收记录</strong><small>浏览器仅在重新载入后提供部分检测</small></span><em :class="keepAliveState.pageWasDiscarded?'warn':'good'">{{ keepAliveState.pageWasDiscarded?'检测到':'未检测到' }}</em></div><div><span :class="['ka-state-dot',keepAliveState.standalone?'good':'neutral']"></span><span><strong>主屏幕安装</strong><small>PWA 提供独立入口与离线外壳，不等于后台权限</small></span><em>{{ keepAliveState.standalone?'已安装':'浏览器中' }}</em></div></section>
      <div class="ka-section-heading"><div><h2>独立探针</h2><p>用于检查当前浏览器能力</p></div></div>
      <section class="ka-card ka-action-list"><button type="button" @click="runNetworkProbe"><span><strong>网络请求探针</strong><small>{{ keepAliveState.networkProbe==='success'?`${keepAliveState.networkProbeMs}ms`:statusText(keepAliveState.networkProbe) }}</small></span><em>运行</em></button><button type="button" @click="registerBackgroundSyncProbe"><span><strong>后台同步探针</strong><small>{{ statusText(keepAliveState.backgroundSync) }} · 执行时间由浏览器决定</small></span><em>登记</em></button></section>
    </main>

    <main v-else-if="view==='lab'" class="ka-scroll">
      <section class="ka-card ka-lab-warning"><strong>隔离代码 Worker</strong><p>代码不能访问页面 DOM、应用存储和网络。它只能运行计算、定时器，并通过 <code>heartbeat(value)</code> 返回状态。浏览器冻结整个页面进程后，Worker 也会暂停。</p></section>
      <section class="ka-card ka-code-card"><div class="ka-code-heading"><span><strong>心跳代码</strong><small>{{ statusText(keepAliveState.customWorker) }} · {{ keepAliveState.customWorkerMessages }} 条消息</small></span><button type="button" @click="customCode=keepAliveConfig.customCode">恢复</button></div><textarea v-model="customCode" spellcheck="false" aria-label="自定义 Worker 代码"></textarea><div class="ka-code-actions"><button type="button" @click="stopCustomWorker">停止</button><button class="primary" type="button" @click="runCustomWorker(customCode)">运行代码</button></div><p v-if="keepAliveState.customWorkerLastMessage">最近返回：{{ keepAliveState.customWorkerLastMessage }}</p></section>
      <div class="ka-section-heading"><div><h2>实验能力</h2><p>高耗电能力默认关闭并可单独停止</p></div></div>
      <section class="ka-card ka-action-list"><button type="button" @click="toggleStrategy(strategies.find(item=>item.id==='webrtc')!)"><span><strong>WebRTC 本机回环</strong><small>不申请摄像头或麦克风 · {{ statusText(keepAliveState.webrtc) }}</small></span><i class="ka-switch" :class="{on:keepAliveConfig.webrtc}"><b></b></i></button><button type="button" @click="togglePip"><span><strong>Canvas 动态画中画</strong><small>1 FPS 状态画面 · {{ statusText(keepAliveState.pip) }}</small></span><em>{{ keepAliveState.pip==='active'?'退出':'开启' }}</em></button></section>
      <p class="ka-footnote">摄像头、麦克风、屏幕共享和持续高负载循环不属于合理的保活用途，因此不会被伪装成普通保活开关。</p>
    </main>

    <main v-else class="ka-scroll">
      <div class="ka-section-heading first"><div><h2>运行记录</h2><p>最多保留最近 80 条</p></div><button type="button" @click="clearKeepAliveLogs">清空</button></div>
      <section v-if="keepAliveState.logs.length" class="ka-card ka-log-list"><div v-for="log in keepAliveState.logs" :key="log.id"><i :class="log.level"></i><span><strong>{{ log.text }}</strong><small>{{ formatTime(log.time) }}</small></span></div></section>
      <section v-else class="ka-empty"><span>录</span><strong>还没有运行记录</strong><p>启动保活、执行体检或发生恢复事件后会显示在这里。</p></section>
    </main>

    <div v-if="confirmReset" class="ka-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="ka-reset-title" @click.self="confirmReset=false"><section class="ka-dialog"><h2 id="ka-reset-title">重置保活设置</h2><p>将停止音频、画中画、Worker、WebRTC和屏幕常亮，并删除本地音频、URL、代码与运行记录。</p><div><button type="button" @click="confirmReset=false">取消</button><button class="danger" type="button" @click="applyReset">确认重置</button></div></section></div>
  </div>
</template>

<style scoped src="./app_KeepAlive.css"></style>
