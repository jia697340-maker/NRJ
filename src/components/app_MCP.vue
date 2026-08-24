<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { clearMcpActivity, mcpActivity, mcpConnections, mcpSettings, removeMcpConnection, upsertMcpConnection } from '../store/mcp'
import type { McpConnectionRecord } from '../types/mcp'
import { connectMcpServer, disconnectMcpServer, validateMcpUrl } from '../services/mcpClient'
import { ensureLocalMcpConnections } from '../services/mcpRuntime'

defineEmits<{ close: [] }>()

type ViewName = 'home' | 'connection' | 'add' | 'activity'

const view = ref<ViewName>('home')
const selectedId = ref('')
const showEnableConfirm = ref(false)
const showDeleteConfirm = ref(false)
const errorText = ref('')
const testing = ref(false)
const draftName = ref('')
const draftUrl = ref('')
const draftToken = ref('')

const recommendations = [
  { id: 'social-xhs', name: '小红书', mark: '红', desc: '读懂笔记、评论与博主资料', url: 'https://mcp.socialdatax.com/xhs/mcp' },
  { id: 'social-douyin', name: '抖音', mark: '音', desc: '解析短链、视频与评论字幕', url: 'https://mcp.socialdatax.com/douyin/mcp' },
  { id: 'social-bilibili', name: 'B站', mark: 'B', desc: '视频、字幕、弹幕与评论', url: 'https://mcp.socialdatax.com/bilibili/mcp' }
]

onMounted(ensureLocalMcpConnections)

const selected = computed(() => mcpConnections.find(item => item.id === selectedId.value) || null)
const enabledCount = computed(() => mcpConnections.filter(item => item.enabled).length)
const toolCount = computed(() => mcpConnections.filter(item => item.enabled).reduce((sum, item) => sum + item.tools.filter(tool => tool.enabled).length, 0))
const localConnections = computed(() => mcpConnections.filter(item => item.kind === 'local'))
const remoteConnections = computed(() => mcpConnections.filter(item => item.kind === 'remote'))
const recommendationInstalled = (id: string) => mcpConnections.some(item => item.presetId === id)

const requestMasterToggle = () => {
  if (mcpSettings.enabled) {
    mcpSettings.enabled = false
    mcpConnections.forEach(item => {
      disconnectMcpServer(item.id)
      item.status = 'idle'
      item.statusText = item.enabled ? '已暂停' : '未启用'
    })
    return
  }
  showEnableConfirm.value = true
}

const confirmMasterEnable = () => {
  mcpSettings.enabled = true
  showEnableConfirm.value = false
}

const openConnection = (id: string) => {
  selectedId.value = id
  errorText.value = ''
  view.value = 'connection'
}

const installRecommendation = (preset: typeof recommendations[number]) => {
  const existing = mcpConnections.find(item => item.presetId === preset.id)
  if (existing) { openConnection(existing.id); return }
  const now = Date.now()
  const connection: McpConnectionRecord = {
    id: `remote_${preset.id}_${now}`,
    presetId: preset.id,
    kind: 'remote',
    name: preset.name,
    description: preset.desc,
    url: preset.url,
    token: '',
    enabled: false,
    status: 'idle',
    statusText: '等待配置',
    tools: [],
    createdAt: now,
    updatedAt: now
  }
  upsertMcpConnection(connection)
  openConnection(connection.id)
}

const openAdd = () => {
  draftName.value = ''
  draftUrl.value = ''
  draftToken.value = ''
  errorText.value = ''
  view.value = 'add'
}

const saveCustom = () => {
  errorText.value = ''
  try {
    const name = draftName.value.trim()
    if (!name) throw new Error('请给连接起一个名称。')
    const url = validateMcpUrl(draftUrl.value)
    const now = Date.now()
    const connection: McpConnectionRecord = {
      id: `remote_custom_${now}`,
      kind: 'remote',
      name: name.slice(0, 40),
      description: '自定义远程 MCP 连接',
      url,
      token: draftToken.value.trim(),
      enabled: false,
      status: 'idle',
      statusText: '等待检测',
      tools: [],
      createdAt: now,
      updatedAt: now
    }
    upsertMcpConnection(connection)
    openConnection(connection.id)
  } catch (error: any) { errorText.value = error?.message || '连接信息不完整。' }
}

const testSelected = async () => {
  const connection = selected.value
  if (!connection || connection.kind !== 'remote') return
  testing.value = true
  errorText.value = ''
  connection.status = 'checking'
  connection.statusText = '正在检测'
  connection.enabled = false
  try {
    connection.url = validateMcpUrl(connection.url)
    const result = await connectMcpServer(connection)
    const tools = result.tools
    connection.tools = tools
    connection.protocolVersion = result.protocolVersion
    connection.serverName = result.serverName
    connection.status = 'ready'
    connection.statusText = tools.length ? `发现 ${tools.length} 个工具` : '连接成功，但没有可用工具'
    connection.updatedAt = Date.now()
  } catch (error: any) {
    connection.status = 'error'
    connection.statusText = '连接失败'
    errorText.value = error?.message || '无法连接该 MCP 服务。'
  } finally { testing.value = false }
}

const toggleConnection = (connection: McpConnectionRecord) => {
  errorText.value = ''
  if (!connection.enabled) {
    if (connection.kind === 'remote' && connection.status !== 'ready') {
      errorText.value = '请先检测连接，再选择允许的工具。'
      return
    }
    if (!connection.tools.some(tool => tool.enabled)) {
      errorText.value = '请至少允许一个工具。'
      return
    }
    connection.enabled = true
    connection.statusText = mcpSettings.enabled ? '已启用' : '已配置，等待总开关'
  } else {
    connection.enabled = false
    connection.statusText = '未启用'
    disconnectMcpServer(connection.id)
  }
  connection.updatedAt = Date.now()
}

const toggleTool = (connection: McpConnectionRecord, index: number) => {
  const tool = connection.tools[index]
  if (!tool) return
  tool.enabled = !tool.enabled
  if (!tool.enabled && !connection.tools.some(item => item.enabled)) connection.enabled = false
  connection.updatedAt = Date.now()
}

const deleteSelected = () => {
  const connection = selected.value
  if (!connection || connection.kind === 'local') return
  disconnectMcpServer(connection.id)
  removeMcpConnection(connection.id)
  showDeleteConfirm.value = false
  view.value = 'home'
}

const goBack = () => {
  errorText.value = ''
  view.value = 'home'
}

const timeLabel = (timestamp: number) => new Date(timestamp).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const riskLabel = (risk: string) => risk === 'read' ? '只读' : risk === 'write' ? '写入' : risk === 'external' ? '外部操作' : '敏感'
</script>

<template>
  <div class="mcp-app">
    <header class="mcp-header">
      <button v-if="view !== 'home'" class="icon-button" type="button" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <div class="header-copy">
        <h1>{{ view === 'connection' ? (selected?.name || '能力详情') : view === 'add' ? '添加连接' : view === 'activity' ? '活动记录' : 'MCP' }}</h1>
        <p>{{ view === 'home' ? '给 TA 添加新能力' : view === 'activity' ? '仅保存在本机' : '权限默认关闭' }}</p>
      </div>
      <button v-if="view === 'home'" class="icon-button" type="button" aria-label="关闭" @click="$emit('close')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg>
      </button>
      <span v-else class="header-spacer" aria-hidden="true"></span>
    </header>

    <main v-if="view === 'home'" class="mcp-scroll">
      <section class="master-panel">
        <div class="master-copy">
          <div class="master-line"><span class="status-dot" :class="{ on: mcpSettings.enabled }"></span><strong>允许 TA 使用工具</strong></div>
          <p>{{ mcpSettings.enabled ? `${enabledCount} 个能力源 · ${toolCount} 个工具可用` : '关闭时不会连接远程服务或调用工具' }}</p>
        </div>
        <button class="switch-control" :class="{ on: mcpSettings.enabled }" type="button" role="switch" :aria-checked="mcpSettings.enabled" @click="requestMasterToggle"><span></span></button>
      </section>

      <section class="content-section">
        <div class="section-heading"><div><h2>手机里的能力</h2><p>数据留在这台设备，写入操作会询问</p></div></div>
        <div class="setting-list">
          <button v-for="item in localConnections" :key="item.id" class="setting-row" type="button" @click="openConnection(item.id)">
            <span class="row-icon local">{{ item.id === 'local-context' ? '境' : '伴' }}</span>
            <span class="row-copy"><strong>{{ item.name }}</strong><small>{{ item.description }}</small></span>
            <span class="compact-state" :class="{ active: item.enabled }">{{ item.enabled ? '已配置' : '关闭' }}</span>
            <svg class="chevron" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </section>

      <section class="content-section">
        <div class="section-heading"><div><h2>链接理解</h2><p>需要用户主动添加，均不会默认启用</p></div></div>
        <div class="recommend-grid">
          <button v-for="item in recommendations" :key="item.id" class="recommend-card" type="button" @click="installRecommendation(item)">
            <span class="recommend-icon" :class="item.id">{{ item.mark }}</span>
            <span class="recommend-copy"><strong>{{ item.name }}</strong><small>{{ item.desc }}</small></span>
            <span class="recommend-action">{{ recommendationInstalled(item.id) ? '管理' : '添加' }}</span>
          </button>
        </div>
        <p class="section-note">社媒连接由第三方服务提供，需要单独的访问密钥；只建议开启读取类工具。</p>
      </section>

      <section class="content-section">
        <div class="section-heading inline-heading"><div><h2>我的连接</h2><p>{{ remoteConnections.length ? `${remoteConnections.length} 个远程地址` : '还没有自定义连接' }}</p></div><button class="text-action" type="button" @click="openAdd">添加</button></div>
        <div v-if="remoteConnections.length" class="setting-list">
          <button v-for="item in remoteConnections" :key="item.id" class="setting-row" type="button" @click="openConnection(item.id)">
            <span class="row-icon remote">M</span>
            <span class="row-copy"><strong>{{ item.name }}</strong><small>{{ item.statusText }}</small></span>
            <span class="compact-state" :class="{ active: item.enabled }">{{ item.enabled ? '已启用' : '关闭' }}</span>
            <svg class="chevron" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
        <button v-else class="empty-add" type="button" @click="openAdd">粘贴一个 HTTPS MCP 地址</button>
      </section>

      <button class="activity-entry" type="button" @click="view = 'activity'">
        <span><strong>活动记录</strong><small>{{ mcpActivity.length ? `最近 ${mcpActivity.length} 次调用` : '暂无调用' }}</small></span>
        <svg class="chevron" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </main>

    <main v-else-if="view === 'connection' && selected" class="mcp-scroll detail-scroll">
      <section class="connection-summary">
        <span class="connection-mark" :class="selected.kind">{{ selected.kind === 'local' ? '机' : 'M' }}</span>
        <div><h2>{{ selected.name }}</h2><p>{{ selected.description }}</p></div>
      </section>

      <section v-if="selected.kind === 'remote'" class="form-section">
        <label class="field-block"><span>服务地址</span><input v-model.trim="selected.url" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://example.com/mcp"></label>
        <label class="field-block"><span>访问密钥</span><input v-model="selected.token" type="password" autocomplete="off" placeholder="需要时填写 Bearer Key"><small>仅保存在当前浏览器，不会交给聊天模型。</small></label>
        <button class="secondary-button" type="button" :disabled="testing" @click="testSelected"><span v-if="testing" class="mini-spinner"></span>{{ testing ? '正在检测' : '检测连接与工具' }}</button>
        <p class="connection-status" :class="selected.status"><span></span>{{ selected.statusText }}</p>
      </section>

      <p v-if="errorText" class="inline-error" role="alert">{{ errorText }}</p>

      <section class="content-section tool-section">
        <div class="section-heading"><div><h2>允许的工具</h2><p>新发现的工具保持关闭，结构变化后会撤销授权</p></div></div>
        <div v-if="selected.tools.length" class="tool-list">
          <button v-for="(tool, index) in selected.tools" :key="tool.name" class="tool-row" type="button" @click="toggleTool(selected, index)">
            <span class="tool-copy"><strong>{{ tool.name }}</strong><small>{{ tool.description || '该服务没有提供说明' }}</small></span>
            <span class="risk-badge" :class="tool.risk">{{ riskLabel(tool.risk) }}</span>
            <span class="small-check" :class="{ on: tool.enabled }"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/></svg></span>
          </button>
        </div>
        <p v-else class="tool-empty">{{ selected.kind === 'remote' ? '检测连接后会在这里列出工具。' : '没有可配置的本机工具。' }}</p>
      </section>

      <section class="bottom-actions">
        <button class="primary-button" type="button" :class="{ active: selected.enabled }" @click="toggleConnection(selected)">{{ selected.enabled ? '停用这个能力' : '启用选中的工具' }}</button>
        <button v-if="selected.kind === 'remote'" class="danger-text" type="button" @click="showDeleteConfirm = true">删除连接</button>
      </section>
    </main>

    <main v-else-if="view === 'add'" class="mcp-scroll detail-scroll">
      <section class="add-intro"><h2>连接远程 MCP</h2><p>只支持可由手机网页直接访问的 HTTPS Streamable HTTP 服务。添加不会自动启用任何工具。</p></section>
      <section class="form-section">
        <label class="field-block"><span>连接名称</span><input v-model="draftName" type="text" maxlength="40" autocomplete="off" placeholder="例如：我的豆瓣 MCP"></label>
        <label class="field-block"><span>MCP 地址</span><input v-model="draftUrl" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://example.com/mcp"></label>
        <label class="field-block"><span>Bearer Key（可选）</span><input v-model="draftToken" type="password" autocomplete="off" placeholder="没有则留空"></label>
        <p v-if="errorText" class="inline-error" role="alert">{{ errorText }}</p>
        <button class="primary-button" type="button" @click="saveCustom">保存并查看权限</button>
      </section>
      <p class="safety-copy">为防止网页访问本机服务，HTTP、localhost 和局域网地址会被拦截。遇到 CORS 限制时，该地址无法在移动网页中使用。</p>
    </main>

    <main v-else-if="view === 'activity'" class="mcp-scroll activity-scroll">
      <div class="activity-toolbar"><span>{{ mcpActivity.length ? '按时间倒序' : '工具调用会显示在这里' }}</span><button v-if="mcpActivity.length" type="button" @click="clearMcpActivity">清空</button></div>
      <div v-if="mcpActivity.length" class="activity-list">
        <article v-for="item in mcpActivity" :key="item.id" class="activity-item">
          <span class="activity-dot" :class="item.status"></span>
          <div><strong>{{ item.connectionName }} · {{ item.toolName }}</strong><p>{{ item.summary }}</p><small>{{ timeLabel(item.createdAt) }}<template v-if="item.durationMs"> · {{ (item.durationMs / 1000).toFixed(1) }}s</template></small></div>
        </article>
      </div>
      <div v-else class="activity-empty"><span>迹</span><strong>还没有活动</strong><p>MCP 关闭时不会产生任何工具调用。</p></div>
    </main>

    <Teleport defer to="#app">
      <Transition name="mcp-modal">
        <div v-if="showEnableConfirm || showDeleteConfirm" class="mcp-modal-backdrop" @click.self="showEnableConfirm = false; showDeleteConfirm = false">
          <section class="mcp-modal-card" role="dialog" aria-modal="true">
            <span class="modal-mark">{{ showDeleteConfirm ? '删' : 'M' }}</span>
            <h2>{{ showDeleteConfirm ? '删除这个连接？' : '开启 MCP？' }}</h2>
            <p>{{ showDeleteConfirm ? '连接地址、密钥与工具授权将从本机移除，活动记录仍会保留。' : '只有你另外启用的能力和工具才可被 TA 使用。写入、外发与敏感操作仍会逐次询问。' }}</p>
            <div class="modal-actions"><button type="button" @click="showEnableConfirm = false; showDeleteConfirm = false">取消</button><button class="confirm" :class="{ danger: showDeleteConfirm }" type="button" @click="showDeleteConfirm ? deleteSelected() : confirmMasterEnable()">{{ showDeleteConfirm ? '确认删除' : '确认开启' }}</button></div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped src="./app_MCP.css"></style>
