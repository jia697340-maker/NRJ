/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { sendChatMessage } from '../../services/api'
import {
  DIAGNOSTIC_UPDATED_EVENT,
  clearDiagnosticTraces,
  deleteDiagnosticTrace,
  enforceDiagnosticRetention,
  getDiagnosticSettings,
  listDiagnosticTraces,
  saveDiagnosticSettings,
  type DiagnosticTrace
} from '../../services/diagnosticTrace'

type DetailTab = 'overview' | 'context' | 'sources' | 'response'
type ConfirmAction = 'clear' | 'delete' | 'replay' | null

const settings = ref(getDiagnosticSettings())
const retentionInput = ref(String(settings.value.maxRecords))
const traces = ref<DiagnosticTrace[]>([])
const selectedId = ref('')
const detailTab = ref<DetailTab>('overview')
const search = ref('')
const statusFilter = ref<'all' | DiagnosticTrace['status']>('all')
const typeFilter = ref('all')
const isLoading = ref(false)
const loadError = ref('')
const settingMessage = ref('')
const settingError = ref('')
const confirmAction = ref<ConfirmAction>(null)
const isWorking = ref(false)
const actionMessage = ref('')

let settingTimer: ReturnType<typeof setTimeout> | null = null

const selectedTrace = computed(() => traces.value.find(item => item.id === selectedId.value) || null)
const availableTypes = computed(() => [...new Set(traces.value.map(item => item.type))])
const filteredTraces = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return traces.value.filter(trace => {
    if (statusFilter.value !== 'all' && trace.status !== statusFilter.value) return false
    if (typeFilter.value !== 'all' && trace.type !== typeFilter.value) return false
    if (!keyword) return true
    return [trace.chatName, trace.model, trace.type, trace.errorMessage]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(keyword))
  })
})
const successfulCount = computed(() => traces.value.filter(item => item.status === 'success').length)
const averageDuration = computed(() => {
  if (!traces.value.length) return 0
  return Math.round(traces.value.reduce((sum, item) => sum + item.duration, 0) / traces.value.length)
})
const estimatedStorage = computed(() => new Blob([JSON.stringify(traces.value)]).size)
const systemTokens = computed(() => selectedTrace.value?.messages
  .filter(item => item.role === 'system')
  .reduce((sum, item) => sum + item.estimatedTokens, 0) || 0)
const historyTokens = computed(() => Math.max(0, (selectedTrace.value?.estimatedTokens || 0) - systemTokens.value))
const hasMedia = computed(() => selectedTrace.value?.messages.some(item => item.hasMedia) === true)

const announceSetting = (message: string) => {
  settingMessage.value = message
  if (settingTimer) clearTimeout(settingTimer)
  settingTimer = setTimeout(() => { settingMessage.value = '' }, 2400)
}

const loadTraces = async (keepSelection = true) => {
  isLoading.value = true
  loadError.value = ''
  try {
    const previous = keepSelection ? selectedId.value : ''
    traces.value = await listDiagnosticTraces()
    if (previous && traces.value.some(item => item.id === previous)) selectedId.value = previous
    else selectedId.value = window.matchMedia('(max-width: 760px)').matches ? '' : (traces.value[0]?.id || '')
  } catch (error: any) {
    loadError.value = error?.message || '读取诊断记录失败，请稍后重试。'
  } finally {
    isLoading.value = false
  }
}

const toggleEnabled = () => {
  settings.value = saveDiagnosticSettings({ ...settings.value, enabled: !settings.value.enabled })
  announceSetting(settings.value.enabled ? '诊断记录已开启' : '诊断记录已关闭，已有记录不会自动删除')
}

const toggleRawConsoleLogging = () => {
  settings.value = saveDiagnosticSettings({ ...settings.value, rawConsoleLogging: !settings.value.rawConsoleLogging })
  announceSetting(settings.value.rawConsoleLogging ? 'API 原始日志已开启' : 'API 原始日志已关闭')
}

const saveRetention = async () => {
  settingError.value = ''
  const parsed = Number(retentionInput.value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
    settingError.value = '请输入 1 至 500 之间的整数。'
    return
  }
  settings.value = saveDiagnosticSettings({ ...settings.value, maxRecords: parsed })
  retentionInput.value = String(settings.value.maxRecords)
  await enforceDiagnosticRetention()
  await loadTraces()
  announceSetting(`最多保留 ${settings.value.maxRecords} 条记录`)
}

const selectTrace = (trace: DiagnosticTrace) => {
  selectedId.value = trace.id
  detailTab.value = 'overview'
  actionMessage.value = ''
}

const formatDate = (timestamp: number) => new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
}).format(timestamp)
const formatDuration = (milliseconds: number) => milliseconds < 1000 ? `${milliseconds} ms` : `${(milliseconds / 1000).toFixed(1)} s`
const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
const statusLabel = (status: DiagnosticTrace['status']) => ({ success: '成功', error: '失败', aborted: '已中止' }[status])
const typeLabel = (type: string) => ({
  Chat: '聊天', Summary: '总结', Vision: '视觉', Moment: '朋友圈',
  CharacterGeneration: '角色生成', CharacterReview: '角色审查'
}[type] || type)
const roleLabel = (role: string) => ({ system: '系统', user: '用户', assistant: '助手', tool: '工具' }[role] || role)

const exportTrace = (trace: DiagnosticTrace) => {
  const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `diagnostic_${trace.id}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  actionMessage.value = '诊断文件已导出'
}

const requestDelete = () => { if (selectedTrace.value) confirmAction.value = 'delete' }
const requestReplay = () => { if (selectedTrace.value && !hasMedia.value) confirmAction.value = 'replay' }

const executeConfirmedAction = async () => {
  const action = confirmAction.value
  const trace = selectedTrace.value
  if (!action || (action !== 'clear' && !trace)) return
  isWorking.value = true
  actionMessage.value = ''
  try {
    if (action === 'clear') {
      await clearDiagnosticTraces()
      await loadTraces(false)
      actionMessage.value = '全部诊断记录已清空'
    } else if (action === 'delete' && trace) {
      await deleteDiagnosticTrace(trace.id)
      await loadTraces(false)
      actionMessage.value = '记录已删除'
    } else if (action === 'replay' && trace) {
      await sendChatMessage(
        trace.messages.map(message => ({ role: message.role, content: message.content })),
        undefined,
        trace.type === 'Summary',
        trace.type === 'Vision',
        trace.purpose as any,
        trace.adapter as any,
        {
          chatId: trace.chatId,
          chatName: trace.chatName,
          worldBookEntries: trace.worldBookEntries,
          memoryEntries: trace.memoryEntries
        },
        true
      )
      await new Promise(resolve => setTimeout(resolve, 120))
      await loadTraces(false)
      actionMessage.value = '场景回放完成，已生成一条新记录'
    }
    confirmAction.value = null
  } catch (error: any) {
    actionMessage.value = error?.message || '操作失败，请检查网络与 API 设置。'
    confirmAction.value = null
  } finally {
    isWorking.value = false
  }
}

const confirmTitle = computed(() => ({ clear: '清空全部记录', delete: '删除这条记录', replay: '重新发起调用' }[confirmAction.value || 'clear']))
const confirmDescription = computed(() => {
  if (confirmAction.value === 'clear') return '清空后无法恢复，但不会影响聊天、角色或其他应用数据。'
  if (confirmAction.value === 'delete') return '仅删除当前诊断快照，不会删除对应聊天消息。'
  return '将使用当前 API 设置和这份已脱敏上下文再次请求模型，可能产生 API 费用。'
})

const handleUpdated = () => loadTraces()

onMounted(() => {
  loadTraces()
  window.addEventListener(DIAGNOSTIC_UPDATED_EVENT, handleUpdated)
})
onBeforeUnmount(() => {
  window.removeEventListener(DIAGNOSTIC_UPDATED_EVENT, handleUpdated)
  if (settingTimer) clearTimeout(settingTimer)
})
</script>

<template>
  <section class="diagnostic-panel" aria-labelledby="diagnostic-title">
    <header class="panel-heading">
      <div>
        <div class="title-line">
          <h2 id="diagnostic-title">诊断中心</h2>
          <span class="seal" aria-hidden="true">诊</span>
        </div>
        <p>记录模型调用的上下文构成与运行结果，帮助定位记忆、世界书和 API 问题。</p>
      </div>
      <span class="privacy-note">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.7-2.8 8.1-7 10-4.2-1.9-7-5.3-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>
        敏感字段自动脱敏
      </span>
    </header>

    <div class="control-card" :class="{ enabled: settings.enabled }">
      <div class="control-main">
        <div class="control-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="M8 9l2 2-2 2M12 14h4"/></svg>
        </div>
        <div class="control-copy">
          <div class="control-title-row">
            <strong>调用诊断记录</strong>
            <span :class="['state-chip', settings.enabled ? 'on' : 'off']">{{ settings.enabled ? '记录中' : '默认关闭' }}</span>
          </div>
          <p>{{ settings.enabled ? '仅在模型调用完成后写入一条快照，超出上限自动删除最早记录。' : '关闭时不生成、不克隆、不写入诊断快照，不增加持续存储负担。' }}</p>
        </div>
        <button
          type="button"
          class="switch"
          :class="{ active: settings.enabled }"
          role="switch"
          :aria-checked="settings.enabled"
          :aria-label="settings.enabled ? '关闭诊断记录' : '开启诊断记录'"
          @click="toggleEnabled"
        ><span></span></button>
      </div>

      <div class="control-main raw-console-row">
        <div class="control-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="M8 9l2 2-2 2M12 14h4"/></svg>
        </div>
        <div class="control-copy">
          <div class="control-title-row">
            <strong>API 原始日志</strong>
            <span :class="['state-chip', settings.rawConsoleLogging ? 'on' : 'off']">{{ settings.rawConsoleLogging ? '输出中' : '默认关闭' }}</span>
          </div>
          <p>仅在浏览器控制台输出脱敏后的请求、原始返回与解析结果；聊天正文仍会完整显示，请仅在排查时开启。</p>
        </div>
        <button
          type="button"
          class="switch"
          :class="{ active: settings.rawConsoleLogging }"
          role="switch"
          :aria-checked="settings.rawConsoleLogging"
          :aria-label="settings.rawConsoleLogging ? '关闭 API 原始日志' : '开启 API 原始日志'"
          @click="toggleRawConsoleLogging"
        ><span></span></button>
      </div>

      <div class="retention-row">
        <label for="diagnostic-retention">
          <span>保留条数</span>
          <small>支持 1–500 条，修改后立即裁剪超出记录</small>
        </label>
        <div class="number-field" :class="{ invalid: settingError }">
          <input id="diagnostic-retention" v-model="retentionInput" type="number" inputmode="numeric" min="1" max="500" step="1" @keyup.enter="saveRetention" @blur="saveRetention" />
          <span>条</span>
        </div>
      </div>
      <div class="control-feedback" aria-live="polite">
        <span v-if="settingError" class="feedback-error">{{ settingError }}</span>
        <span v-else-if="settingMessage" class="feedback-success">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4L19 6"/></svg>{{ settingMessage }}
        </span>
      </div>
    </div>

    <div class="ledger" aria-label="诊断记录概览">
      <div><span>已存记录</span><strong>{{ traces.length }}<small> / {{ settings.maxRecords }}</small></strong></div>
      <div><span>成功调用</span><strong>{{ traces.length ? Math.round(successfulCount / traces.length * 100) : 0 }}<small>%</small></strong></div>
      <div><span>平均耗时</span><strong>{{ averageDuration ? formatDuration(averageDuration) : '—' }}</strong></div>
      <div><span>估算占用</span><strong>{{ formatBytes(estimatedStorage) }}</strong></div>
    </div>

    <div class="records-heading">
      <div>
        <h3>调用卷宗</h3>
        <p>选择一条记录查看实际发送内容与来源轨迹。</p>
      </div>
      <button type="button" class="text-action danger" :disabled="!traces.length || isWorking" @click="confirmAction = 'clear'">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>清空记录
      </button>
    </div>

    <div class="filters" role="search">
      <label class="search-field">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
        <span class="sr-only">搜索诊断记录</span>
        <input v-model="search" type="search" placeholder="搜索角色、模型或错误" />
      </label>
      <label class="select-field">
        <span class="sr-only">按状态筛选</span>
        <select v-model="statusFilter"><option value="all">全部状态</option><option value="success">成功</option><option value="error">失败</option><option value="aborted">已中止</option></select>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4 4 4-4"/></svg>
      </label>
      <label class="select-field">
        <span class="sr-only">按类型筛选</span>
        <select v-model="typeFilter"><option value="all">全部类型</option><option v-for="type in availableTypes" :key="type" :value="type">{{ typeLabel(type) }}</option></select>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4 4 4-4"/></svg>
      </label>
    </div>

    <div v-if="isLoading" class="state-view" aria-live="polite">
      <span class="spinner"></span><strong>正在读取卷宗</strong><p>诊断记录较多时可能需要片刻。</p>
    </div>
    <div v-else-if="loadError" class="state-view error-state" role="alert">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg>
      <strong>暂时无法读取记录</strong><p>{{ loadError }}</p><button type="button" @click="loadTraces()">重新读取</button>
    </div>
    <div v-else-if="!traces.length" class="state-view empty-state">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5M9 13h6M9 17h4"/></svg>
      <strong>{{ settings.enabled ? '等待第一条诊断记录' : '诊断记录尚未开启' }}</strong>
      <p>{{ settings.enabled ? '下一次模型调用完成后，这里会出现脱敏后的上下文卷宗。' : '开启后才会记录后续调用；开启前的历史调用不会被补录。' }}</p>
      <button v-if="!settings.enabled" type="button" @click="toggleEnabled">开启诊断记录</button>
    </div>
    <div v-else-if="!filteredTraces.length" class="state-view empty-state compact">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <strong>没有符合条件的记录</strong><p>尝试更换筛选条件或清除搜索关键词。</p>
    </div>

    <div v-else class="workspace">
      <div class="trace-list" aria-label="诊断记录列表">
        <button
          v-for="trace in filteredTraces"
          :key="trace.id"
          type="button"
          class="trace-row"
          :class="{ active: trace.id === selectedId }"
          :aria-pressed="trace.id === selectedId"
          @click="selectTrace(trace)"
        >
          <span :class="['status-mark', trace.status]"></span>
          <span class="trace-content">
            <span class="trace-top"><strong>{{ trace.chatName || typeLabel(trace.type) }}</strong><time>{{ formatDate(trace.createdAt) }}</time></span>
            <span class="trace-middle"><span>{{ typeLabel(trace.type) }}</span><span>{{ trace.model }}</span></span>
            <span class="trace-bottom"><span>{{ statusLabel(trace.status) }}</span><span>{{ formatDuration(trace.duration) }}</span><span>约 {{ trace.estimatedTokens.toLocaleString() }} Token</span></span>
          </span>
          <svg class="row-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
        </button>
      </div>

      <article v-if="selectedTrace" class="detail-card" aria-live="polite">
        <header class="detail-heading">
          <button type="button" class="mobile-detail-back" aria-label="返回诊断记录列表" @click="selectedId = ''">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div>
            <div class="detail-eyebrow"><span :class="['detail-status', selectedTrace.status]">{{ statusLabel(selectedTrace.status) }}</span><span>{{ typeLabel(selectedTrace.type) }}</span></div>
            <h3>{{ selectedTrace.chatName || '未关联聊天' }}</h3>
            <p>{{ formatDate(selectedTrace.createdAt) }} · {{ selectedTrace.model }}</p>
          </div>
          <div class="detail-actions">
            <button type="button" title="导出当前记录" aria-label="导出当前记录" @click="exportTrace(selectedTrace)"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 20h14"/></svg></button>
            <button type="button" title="删除当前记录" aria-label="删除当前记录" @click="requestDelete"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg></button>
          </div>
        </header>

        <nav class="detail-tabs" aria-label="记录详情栏目">
          <button v-for="tab in ([['overview','概览'],['context','上下文'],['sources','来源轨迹'],['response','返回结果']] as const)" :key="tab[0]" type="button" :class="{ active: detailTab === tab[0] }" @click="detailTab = tab[0]">{{ tab[1] }}</button>
        </nav>

        <div class="detail-body">
          <template v-if="detailTab === 'overview'">
            <div class="metric-grid">
              <div><span>调用耗时</span><strong>{{ formatDuration(selectedTrace.duration) }}</strong></div>
              <div><span>上下文估算</span><strong>{{ selectedTrace.estimatedTokens.toLocaleString() }} <small>Token</small></strong></div>
              <div><span>返回长度</span><strong>{{ selectedTrace.responseCharacters.toLocaleString() }} <small>字</small></strong></div>
              <div><span>消息数量</span><strong>{{ selectedTrace.messages.length }} <small>条</small></strong></div>
            </div>
            <div class="token-card">
              <div class="section-title"><span>上下文分布</span><small>估算值</small></div>
              <div class="token-bar" aria-label="上下文 Token 分布"><span :style="{ width: `${selectedTrace.estimatedTokens ? systemTokens / selectedTrace.estimatedTokens * 100 : 0}%` }"></span></div>
              <div class="token-legend"><span><i class="system"></i>系统提示词 <strong>{{ systemTokens.toLocaleString() }}</strong></span><span><i class="history"></i>对话与预填充 <strong>{{ historyTokens.toLocaleString() }}</strong></span></div>
            </div>
              <dl class="definition-list">
                <div><dt>服务提供方</dt><dd>{{ selectedTrace.provider }}</dd></div>
                <div><dt>模型适配</dt><dd>{{ selectedTrace.adapter }}</dd></div>
                <div><dt>实际协议</dt><dd>{{ selectedTrace.protocol || '旧记录未记录' }}</dd></div>
                <div><dt>响应模式</dt><dd>{{ selectedTrace.stream ? '流式响应' : '完整响应' }}</dd></div>
                <div><dt>思考配置</dt><dd>{{ selectedTrace.reasoning ? `${selectedTrace.reasoning.mode === 'custom' ? '自定义' : '跳过'} · ${selectedTrace.reasoning.effort} · ${selectedTrace.reasoning.nativeEnabled ? '原生开启' : '原生关闭'}` : '旧记录未记录' }}</dd></div>
                <div><dt>摘要字符</dt><dd>{{ (selectedTrace.thinkingCharacters || 0).toLocaleString() }}</dd></div>
                <div><dt>停止原因</dt><dd>{{ selectedTrace.stopReason || '未返回' }}<span v-if="selectedTrace.truncated" class="warning-chip">可能被截断</span></dd></div>
              </dl>
            <div v-if="selectedTrace.errorMessage" class="inline-error"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg><div><strong>调用失败</strong><p>{{ selectedTrace.errorMessage }}</p></div></div>
          </template>

          <div v-else-if="detailTab === 'context'" class="message-stack">
            <div v-for="(message, index) in selectedTrace.messages" :key="index" class="message-block">
              <div class="message-meta"><span>{{ roleLabel(message.role) }}</span><span>{{ message.characters.toLocaleString() }} 字 · 约 {{ message.estimatedTokens.toLocaleString() }} Token</span></div>
              <pre>{{ message.content }}</pre>
              <span v-if="message.hasMedia" class="media-note">媒体内容为保护存储空间已省略</span>
            </div>
          </div>

          <template v-else-if="detailTab === 'sources'">
            <div class="source-section">
              <div class="section-title"><span>世界书条目</span><small>{{ selectedTrace.worldBookEntries.length }} 项</small></div>
              <div v-if="selectedTrace.worldBookEntries.length" class="source-list"><span v-for="item in selectedTrace.worldBookEntries" :key="item">{{ item }}</span></div>
              <p v-else class="source-empty">本次调用没有绑定启用中的世界书条目。</p>
            </div>
            <div class="source-section">
              <div class="section-title"><span>长期记忆候选</span><small>{{ selectedTrace.memoryEntries.length }} 项</small></div>
              <div v-if="selectedTrace.memoryEntries.length" class="source-list"><span v-for="item in selectedTrace.memoryEntries" :key="item">{{ item }}</span></div>
              <p v-else class="source-empty">本次调用没有可展示的长期记忆来源。</p>
            </div>
            <p class="source-footnote">来源轨迹显示调用时可用并参与上下文构建的数据名称；完整注入文本请在“上下文”中核对。</p>
          </template>

          <template v-else>
            <div v-if="selectedTrace.response" class="response-section"><div class="section-title"><span>模型返回</span><small>{{ selectedTrace.responseCharacters.toLocaleString() }} 字</small></div><pre>{{ selectedTrace.response }}</pre></div>
            <div v-if="selectedTrace.thinking" class="response-section"><div class="section-title"><span>{{ selectedTrace.reasoningSource === 'prompt' ? '兼容分析文本' : '模型思考摘要' }}</span><small>仅本地查看</small></div><pre>{{ selectedTrace.thinking }}</pre></div>
            <div v-if="!selectedTrace.response && !selectedTrace.thinking" class="response-empty">没有可展示的返回内容。</div>
          </template>
        </div>

        <footer class="detail-footer">
          <span class="action-feedback" aria-live="polite">{{ actionMessage }}</span>
          <button type="button" class="replay-button" :disabled="hasMedia || isWorking" :title="hasMedia ? '包含媒体的快照不能安全回放' : '使用当前设置重新发起调用'" @click="requestReplay">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 108-8c-2.6 0-4.8 1.1-6.3 2.8L4 9M4 4v5h5"/></svg>
            {{ hasMedia ? '媒体场景不可回放' : '重新发起调用' }}
          </button>
        </footer>
      </article>
    </div>

    <Teleport defer to="#app">
      <Transition name="dialog-fade">
        <div v-if="confirmAction" class="dialog-overlay" @click.self="!isWorking && (confirmAction = null)">
          <div class="confirm-dialog" role="dialog" aria-modal="true" :aria-labelledby="'diagnostic-confirm-title'">
            <div class="dialog-symbol" :class="{ danger: confirmAction !== 'replay' }">
              <svg v-if="confirmAction === 'replay'" viewBox="0 0 24 24"><path d="M4 12a8 8 0 108-8c-2.6 0-4.8 1.1-6.3 2.8L4 9M4 4v5h5"/></svg>
              <svg v-else viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>
            </div>
            <h3 id="diagnostic-confirm-title">{{ confirmTitle }}</h3>
            <p>{{ confirmDescription }}</p>
            <div class="dialog-actions">
              <button type="button" :disabled="isWorking" @click="confirmAction = null">取消</button>
              <button type="button" class="primary" :class="{ danger: confirmAction !== 'replay' }" :disabled="isWorking" @click="executeConfirmedAction">
                <span v-if="isWorking" class="button-spinner"></span>{{ isWorking ? '处理中' : (confirmAction === 'replay' ? '确认调用' : '确认删除') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.diagnostic-panel { --ink:#1a1a1a; --muted:#747474; --faint:#a0a0a0; --line:#e8e8e8; --paper:#fff; --wash:#fafafa; --cinnabar:#be2a2a; --safe:#38785a; min-height:100%; padding:4px 0 44px; color:var(--ink); }
.panel-heading,.records-heading,.control-main,.retention-row,.detail-heading,.detail-footer,.trace-top,.trace-middle,.trace-bottom,.section-title,.message-meta { display:flex; align-items:center; justify-content:space-between; }
.panel-heading { align-items:flex-start; gap:24px; margin:0 0 22px; }
.title-line { display:flex; align-items:flex-start; gap:7px; }
.title-line h2,.records-heading h3,.detail-heading h3 { margin:0; font-family:"STSong","SimSun","Songti SC",serif; letter-spacing:2px; }
.title-line h2 { font-size:20px; }
.seal { display:grid; place-items:center; width:16px; height:16px; margin-top:2px; border-radius:2px; background:var(--cinnabar); color:#fff; font:11px "FangSong","SimSun",serif; }
.panel-heading p,.records-heading p { margin:8px 0 0; color:#777; font-size:12px; line-height:1.65; }
.privacy-note { display:flex; align-items:center; gap:6px; margin-top:3px; color:#777; font-size:11px; white-space:nowrap; }
.privacy-note svg { width:16px; height:16px; fill:none; stroke:var(--safe); stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
.control-card { border:1px solid var(--line); background:var(--paper); transition:border-color .2s,box-shadow .2s; }
.control-card.enabled { border-color:#d9e6df; box-shadow:0 5px 20px rgba(56,120,90,.055); }
.control-main { gap:16px; padding:20px; }
.raw-console-row { border-top:1px solid #f0f0f0; background:#fdfdfd; }
.control-icon { flex:0 0 42px; display:grid; place-items:center; width:42px; height:42px; border:1px solid #e7e7e7; background:#fbfbfb; }
.control-icon svg,.text-action svg,.detail-actions svg,.replay-button svg { width:19px; height:19px; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
.control-copy { flex:1; min-width:0; }
.control-title-row { display:flex; align-items:center; gap:9px; }
.control-title-row strong { font-size:15px; font-weight:600; }
.control-copy p { margin:7px 0 0; color:#858585; font-size:12px; line-height:1.55; }
.state-chip { padding:2px 6px; border:1px solid; border-radius:2px; font:10px "STSong","SimSun",serif; letter-spacing:1px; }
.state-chip.off { color:#888; border-color:#d8d8d8; }.state-chip.on { color:var(--safe); border-color:#a9cabb; background:#f7fbf9; }
.switch { appearance:none; position:relative; flex:0 0 46px; width:46px; height:27px; padding:0; border:1px solid #d4d4d4; border-radius:20px; background:#eee; cursor:pointer; transition:.22s ease; }
.switch span { position:absolute; top:3px; left:3px; width:19px; height:19px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.14); transition:transform .22s ease; }
.switch.active { border-color:#2e6d51; background:var(--safe); }.switch.active span { transform:translateX(19px); }
.switch:focus-visible,.trace-row:focus-visible,.detail-tabs button:focus-visible,.filters input:focus-visible,.filters select:focus-visible,.detail-actions button:focus-visible,.replay-button:focus-visible,.text-action:focus-visible,.state-view button:focus-visible,.dialog-actions button:focus-visible { outline:2px solid rgba(190,42,42,.35); outline-offset:2px; }
.retention-row { gap:18px; padding:16px 20px; border-top:1px solid #f0f0f0; background:#fdfdfd; }
.retention-row label { display:flex; flex-direction:column; gap:5px; }.retention-row label span { font-size:13px; font-weight:550; }.retention-row small { color:#999; font-size:11px; line-height:1.45; }
.number-field { display:flex; align-items:center; width:112px; height:38px; border:1px solid #dedede; background:#fff; transition:.2s; }.number-field:focus-within { border-color:#999; box-shadow:0 0 0 3px rgba(0,0,0,.035); }.number-field.invalid { border-color:rgba(190,42,42,.55); }
.number-field input { appearance:textfield; min-width:0; width:100%; height:100%; padding:0 8px 0 12px; border:0; outline:0; background:transparent; color:var(--ink); font:500 14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; text-align:right; }.number-field input::-webkit-inner-spin-button { appearance:none; }.number-field span { padding-right:11px; color:#999; font-size:12px; }
.control-feedback { min-height:0; padding:0 20px; font-size:11px; }.control-feedback:has(> span) { padding-bottom:12px; }.feedback-error { color:var(--cinnabar); }.feedback-success { display:flex; align-items:center; gap:4px; color:var(--safe); }.feedback-success svg { width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2; }
.ledger { display:grid; grid-template-columns:repeat(4,1fr); margin:26px 0 32px; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.ledger>div { display:flex; flex-direction:column; align-items:center; gap:9px; padding:17px 10px; border-right:1px dashed #ededed; }.ledger>div:last-child { border:0; }.ledger span { color:#777; font:12px "STSong","SimSun",serif; letter-spacing:1px; }.ledger strong { font-size:17px; font-weight:550; }.ledger small { color:#999; font-size:11px; font-weight:400; }
.records-heading { align-items:flex-end; margin-bottom:15px; }.records-heading h3 { font-size:17px; }.records-heading p { margin-top:6px; }
.text-action { appearance:none; display:flex; align-items:center; gap:6px; padding:8px 5px; border:0; background:transparent; color:#666; font-size:12px; cursor:pointer; }.text-action svg { width:15px; height:15px; }.text-action.danger { color:var(--cinnabar); }.text-action:disabled { opacity:.35; cursor:not-allowed; }
.filters { display:grid; grid-template-columns:minmax(190px,1fr) 120px 128px; gap:8px; margin-bottom:12px; }
.search-field,.select-field { position:relative; display:flex; align-items:center; height:40px; border:1px solid #e4e4e4; background:#fff; transition:.2s; }.search-field:focus-within,.select-field:focus-within { border-color:#aaa; }
.search-field svg { flex:0 0 auto; width:16px; height:16px; margin-left:12px; fill:none; stroke:#888; stroke-width:1.7; stroke-linecap:round; }.search-field input,.select-field select { appearance:none; width:100%; height:100%; border:0; outline:0; background:transparent; color:#333; font-size:12px; }.search-field input { padding:0 12px 0 9px; }.search-field input::placeholder { color:#aaa; }.select-field select { padding:0 30px 0 12px; cursor:pointer; }.select-field>svg { position:absolute; right:9px; width:15px; height:15px; pointer-events:none; fill:none; stroke:#888; stroke-width:1.7; }
.workspace { display:grid; grid-template-columns:minmax(250px,35%) minmax(0,65%); min-height:570px; border:1px solid var(--line); background:#fff; }
.trace-list { max-height:680px; overflow:auto; border-right:1px solid var(--line); background:#fdfdfd; }
.trace-row { appearance:none; display:flex; align-items:center; width:100%; min-height:100px; padding:16px 12px 16px 14px; border:0; border-bottom:1px solid #efefef; background:transparent; color:inherit; text-align:left; cursor:pointer; transition:background .18s,border-color .18s; }.trace-row:hover { background:#fafafa; }.trace-row.active { background:#fff; box-shadow:inset 3px 0 var(--cinnabar); }
.status-mark { align-self:flex-start; flex:0 0 7px; width:7px; height:7px; margin:6px 10px 0 1px; border-radius:50%; background:#999; }.status-mark.success { background:var(--safe); }.status-mark.error { background:var(--cinnabar); }.status-mark.aborted { background:#9a6a2e; }
.trace-content { flex:1; min-width:0; display:flex; flex-direction:column; gap:7px; }.trace-top { gap:8px; }.trace-top strong { overflow:hidden; font-size:13px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }.trace-top time { flex:0 0 auto; color:#999; font-size:9px; }.trace-middle { justify-content:flex-start; gap:6px; color:#777; font-size:10px; }.trace-middle span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.trace-middle span:first-child { flex:0 0 auto; padding:1px 5px; border:1px solid #e1e1e1; }.trace-bottom { justify-content:flex-start; gap:9px; color:#999; font-size:10px; }.row-chevron { flex:0 0 15px; width:15px; height:15px; margin-left:5px; fill:none; stroke:#c5c5c5; stroke-width:1.6; }
.detail-card { min-width:0; display:flex; flex-direction:column; background:#fff; }
.mobile-detail-back { display:none; }
.detail-heading { align-items:flex-start; gap:16px; padding:20px 22px 17px; border-bottom:1px solid #eee; }.detail-eyebrow { display:flex; align-items:center; gap:8px; margin-bottom:7px; color:#888; font-size:10px; letter-spacing:.5px; }.detail-status { padding:2px 6px; border:1px solid; }.detail-status.success { color:var(--safe); border-color:#b7d2c5; }.detail-status.error { color:var(--cinnabar); border-color:#e0b1b1; }.detail-status.aborted { color:#9a6a2e; border-color:#ddc7a8; }.detail-heading h3 { overflow-wrap:anywhere; font-size:18px; }.detail-heading p { margin:6px 0 0; color:#999; font-size:10px; }
.detail-actions { display:flex; gap:5px; }.detail-actions button { appearance:none; display:grid; place-items:center; width:34px; height:34px; border:1px solid transparent; background:transparent; color:#777; cursor:pointer; transition:.2s; }.detail-actions button:hover { border-color:#e8e8e8; background:#fafafa; color:#222; }.detail-actions svg { width:17px; height:17px; }
.detail-tabs { display:flex; padding:0 18px; border-bottom:1px solid #eee; overflow-x:auto; }.detail-tabs button { appearance:none; position:relative; flex:0 0 auto; padding:13px 11px 11px; border:0; background:transparent; color:#888; font-size:11px; cursor:pointer; }.detail-tabs button::after { content:""; position:absolute; right:10px; bottom:-1px; left:10px; height:2px; background:transparent; }.detail-tabs button.active { color:#222; font-weight:600; }.detail-tabs button.active::after { background:var(--cinnabar); }
.detail-body { flex:1; min-height:350px; max-height:512px; padding:20px 22px; overflow:auto; }.metric-grid { display:grid; grid-template-columns:repeat(2,1fr); border:1px solid #e9e9e9; }.metric-grid>div { display:flex; flex-direction:column; gap:7px; padding:15px; border-right:1px solid #eee; border-bottom:1px solid #eee; }.metric-grid>div:nth-child(2n) { border-right:0; }.metric-grid>div:nth-last-child(-n+2) { border-bottom:0; }.metric-grid span { color:#888; font-size:10px; }.metric-grid strong { font-size:15px; font-weight:550; }.metric-grid small { color:#999; font-size:10px; font-weight:400; }
.token-card { margin-top:16px; padding:16px; border:1px solid #eee; background:#fcfcfc; }.section-title { gap:12px; color:#333; font-size:12px; font-weight:600; }.section-title small { color:#999; font-size:10px; font-weight:400; }.token-bar { height:7px; margin:14px 0 11px; overflow:hidden; background:#e4e7e5; }.token-bar span { display:block; height:100%; min-width:2px; background:var(--cinnabar); }.token-legend { display:flex; justify-content:space-between; gap:14px; color:#777; font-size:10px; }.token-legend span { display:flex; align-items:center; gap:5px; }.token-legend i { width:7px; height:7px; background:#e4e7e5; }.token-legend i.system { background:var(--cinnabar); }.token-legend strong { color:#444; font-weight:500; }
.definition-list { margin:16px 0 0; }.definition-list>div { display:flex; justify-content:space-between; gap:20px; padding:11px 2px; border-bottom:1px solid #f0f0f0; }.definition-list dt { color:#888; font-size:11px; }.definition-list dd { margin:0; color:#333; font-size:11px; text-align:right; overflow-wrap:anywhere; }.warning-chip { margin-left:6px; color:#9a6a2e; }
.inline-error { display:flex; gap:10px; margin-top:16px; padding:13px; border:1px solid #efd1d1; background:#fffafa; color:var(--cinnabar); }.inline-error svg { flex:0 0 18px; width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.7; }.inline-error strong { font-size:11px; }.inline-error p { margin:4px 0 0; color:#8f5151; font-size:10px; line-height:1.5; overflow-wrap:anywhere; }
.message-stack { display:flex; flex-direction:column; gap:13px; }.message-block { border:1px solid #e9e9e9; }.message-meta { padding:9px 11px; border-bottom:1px solid #eee; background:#fafafa; color:#888; font-size:9px; }.message-meta span:first-child { color:#333; font-weight:600; }.message-block pre,.response-section pre { margin:0; padding:13px; color:#333; font:10px/1.7 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; white-space:pre-wrap; overflow-wrap:anywhere; }.media-note { display:block; padding:0 13px 10px; color:#9a6a2e; font-size:9px; }
.source-section+.source-section { margin-top:24px; }.source-list { display:flex; flex-wrap:wrap; gap:7px; margin-top:12px; }.source-list span { padding:6px 8px; border:1px solid #e5e5e5; background:#fafafa; color:#555; font-size:10px; }.source-empty,.source-footnote { margin:12px 0 0; color:#999; font-size:10px; line-height:1.6; }.source-footnote { margin-top:26px; padding-top:14px; border-top:1px dashed #e5e5e5; }
.response-section { border:1px solid #e9e9e9; }.response-section+.response-section { margin-top:14px; }.response-section .section-title { padding:10px 12px; border-bottom:1px solid #eee; background:#fafafa; }.response-empty { display:grid; place-items:center; min-height:220px; color:#999; font-size:11px; }
.detail-footer { min-height:58px; gap:14px; padding:10px 18px; border-top:1px solid #eee; }.action-feedback { flex:1; color:var(--safe); font-size:10px; line-height:1.4; }.replay-button { appearance:none; display:flex; align-items:center; justify-content:center; gap:7px; min-height:38px; padding:0 14px; border:1px solid #222; background:#222; color:#fff; font-size:11px; cursor:pointer; transition:.18s; }.replay-button:hover:not(:disabled) { background:#000; }.replay-button:active:not(:disabled) { transform:translateY(1px); }.replay-button:disabled { border-color:#ddd; background:#eee; color:#999; cursor:not-allowed; }.replay-button svg { width:16px; height:16px; }
.state-view { display:flex; min-height:280px; flex-direction:column; align-items:center; justify-content:center; padding:30px; border:1px solid var(--line); text-align:center; }.state-view.compact { min-height:190px; }.state-view>svg { width:38px; height:38px; margin-bottom:14px; fill:none; stroke:#aaa; stroke-width:1.25; stroke-linecap:round; stroke-linejoin:round; }.state-view strong { font:600 14px "STSong","SimSun",serif; letter-spacing:1px; }.state-view p { max-width:390px; margin:8px 0 0; color:#999; font-size:11px; line-height:1.7; }.state-view button { appearance:none; margin-top:17px; padding:9px 18px; border:1px solid #222; background:#222; color:#fff; font-size:11px; cursor:pointer; }.error-state>svg { stroke:var(--cinnabar); }.spinner,.button-spinner { display:block; width:22px; height:22px; margin-bottom:14px; border:2px solid #e5e5e5; border-top-color:#555; border-radius:50%; animation:spin .8s linear infinite; }.button-spinner { width:13px; height:13px; margin:0; border-color:rgba(255,255,255,.35); border-top-color:#fff; }
.dialog-overlay { position:fixed; inset:0; z-index:3000; display:grid; place-items:center; padding:20px; background:rgba(255,255,255,.78); backdrop-filter:blur(5px); }.confirm-dialog { width:min(360px,100%); padding:25px 24px 21px; border:1px solid #e3e3e3; background:#fff; box-shadow:0 16px 44px rgba(0,0,0,.08); text-align:center; }.dialog-symbol { display:grid; place-items:center; width:40px; height:40px; margin:0 auto 15px; border:1px solid #dcdcdc; color:#333; }.dialog-symbol.danger { border-color:#e4c0c0; color:var(--cinnabar); }.dialog-symbol svg { width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }.confirm-dialog h3 { margin:0; font:600 17px "STSong","SimSun",serif; letter-spacing:2px; }.confirm-dialog p { margin:10px auto 21px; color:#777; font-size:12px; line-height:1.7; }.dialog-actions { display:grid; grid-template-columns:1fr 1fr; gap:9px; }.dialog-actions button { appearance:none; min-height:42px; border:1px solid #ddd; background:#fff; color:#555; font-size:12px; cursor:pointer; }.dialog-actions button.primary { display:flex; align-items:center; justify-content:center; gap:7px; border-color:#222; background:#222; color:#fff; }.dialog-actions button.primary.danger { border-color:var(--cinnabar); background:var(--cinnabar); }.dialog-actions button:disabled { opacity:.55; cursor:wait; }
.dialog-fade-enter-active,.dialog-fade-leave-active { transition:opacity .2s ease; }.dialog-fade-enter-active .confirm-dialog,.dialog-fade-leave-active .confirm-dialog { transition:transform .2s ease,opacity .2s ease; }.dialog-fade-enter-from,.dialog-fade-leave-to { opacity:0; }.dialog-fade-enter-from .confirm-dialog,.dialog-fade-leave-to .confirm-dialog { transform:translateY(8px) scale(.985); opacity:0; }
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
@keyframes spin { to { transform:rotate(360deg); } }
@media (max-width:760px) {
  .panel-heading { flex-direction:column; gap:9px; }.privacy-note { margin:0; }
  .control-main { padding:17px 15px; }.control-icon { display:none; }.control-copy p { padding-right:4px; }.retention-row { align-items:flex-end; padding:15px; }
  .ledger { grid-template-columns:repeat(2,1fr); }.ledger>div:nth-child(2) { border-right:0; }.ledger>div:nth-child(-n+2) { border-bottom:1px dashed #ededed; }
  .filters { grid-template-columns:1fr 1fr; }.search-field { grid-column:1/-1; }
  .workspace { display:block; min-height:0; border:0; }.trace-list { max-height:none; border:1px solid var(--line); }.trace-row { min-height:92px; }
  .detail-card { position:fixed; inset:0; z-index:1500; overflow:hidden; }.detail-card::before { content:""; display:block; flex:0 0 18px; background:#fff; }
  .detail-heading { padding:14px 16px; }.mobile-detail-back { appearance:none; display:grid; place-items:center; flex:0 0 30px; width:30px; height:36px; margin-left:-7px; border:0; background:transparent; color:#333; cursor:pointer; }.mobile-detail-back svg { width:22px; height:22px; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }.detail-heading>div:nth-of-type(1) { flex:1; min-width:0; }.detail-heading h3 { font-size:16px; }.detail-actions { flex:0 0 auto; }
  .detail-tabs { padding:0 8px; }.detail-tabs button { flex:1; padding-right:8px; padding-left:8px; }.detail-body { max-height:none; min-height:0; padding:16px; }.detail-footer { flex:0 0 auto; padding:9px 13px 18px; }
  .metric-grid { grid-template-columns:1fr 1fr; }.token-legend { flex-direction:column; gap:7px; }.definition-list>div { gap:12px; }
}
@media (max-width:420px) {
  .control-copy p { font-size:11px; }.control-title-row { align-items:flex-start; flex-direction:column; gap:5px; }.switch { flex-basis:44px; width:44px; }
  .retention-row { align-items:flex-start; }.retention-row label { flex:1; }.number-field { width:94px; }
  .records-heading { align-items:flex-start; gap:10px; }.text-action { flex:0 0 auto; }
  .trace-top time { display:none; }.trace-bottom { gap:7px; }
  .detail-heading { gap:8px; }.detail-actions button { width:30px; }.detail-body { padding:14px; }.metric-grid>div { padding:13px 11px; }
  .action-feedback:empty { display:none; }.detail-footer { flex-direction:column; align-items:stretch; }.replay-button { width:100%; }
}
@media (prefers-reduced-motion:reduce) { .switch,.switch span,.trace-row,.dialog-fade-enter-active,.dialog-fade-leave-active { transition:none !important; }.spinner,.button-spinner { animation-duration:1.5s; } }
</style>
