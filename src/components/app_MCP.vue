<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref } from 'vue'
import { addMcpConnection, clearMcpActivities, duplicateMcpConnection, mcpActivities, mcpSettings, removeMcpConnection, updateMcpConnection, createMcpConnection } from '../store/mcp'
import type { McpAuth, McpConnection, McpConnectionTestResult, McpSecretPersistence, McpToolPolicy, McpTransport } from '../types/mcp'
import { discoverMcpConnection } from '../services/mcp/discovery'
import { exportMcpConnection, importMcpConfig } from '../services/mcp/importConfig'
import { createSecretRef, getMcpSecret, removeMcpSecret, setMcpSecret } from '../services/mcp/secrets'
import { closeMcpConnectionRuntime } from '../services/mcpRuntime'
import { useChatState } from '../composables/useChatState'

defineEmits<{ close: [] }>()
type View = 'home' | 'add' | 'edit' | 'tools' | 'activity' | 'import' | 'scan'
const view = ref<View>('home'); const selectedId = ref(''); const notice = ref(''); const busy = ref(false)
const testResult = ref<McpConnectionTestResult | null>(null); const importText = ref(''); const publicConfigUrl = ref('')
const addMode = ref<'url' | 'manual' | 'json' | 'public' | 'stdio'>('url')
const secretValues = reactive<Record<string, string>>({}); const showSecrets = reactive<Record<string, boolean>>({})
const persistence = ref<McpSecretPersistence>('device'); const { mockChats } = useChatState()
const characters = computed(() => (mockChats.value || []).filter((item: any) => item.id !== 1 && item.chatType !== 'group').map((item: any) => ({ id: String(item.characterEntityId || item.id), name: item.name || '未命名角色' })).filter((item: any, index: number, list: any[]) => list.findIndex(other => other.id === item.id) === index))
const selected = computed(() => mcpSettings.connections.find(item => item.id === selectedId.value))
const selectedActivities = computed(() => selectedId.value ? mcpActivities.filter(item => item.connectionId === selectedId.value) : mcpActivities)
const draft = reactive<McpConnection>(createMcpConnection())
const transportOptions: Array<{ id: McpTransport; label: string }> = [{ id: 'auto', label: '自动检测' }, { id: 'streamable-http', label: 'Streamable HTTP' }, { id: 'sse', label: 'SSE' }]
const authOptions: Array<{ id: McpAuth['type']; label: string }> = [{ id: 'none', label: '无认证' }, { id: 'bearer', label: 'Bearer Token' }, { id: 'api-key', label: 'API Key' }, { id: 'custom-headers', label: '自定义 Headers' }, { id: 'oauth', label: 'OAuth' }]
const policies: Array<{ id: McpToolPolicy; label: string; note: string }> = [
  { id: 'auto', label: '自动允许', note: '模型调用后直接执行' }, { id: 'model', label: '模型判断', note: '由模型按描述决定是否使用' },
  { id: 'confirm', label: '每次确认', note: '执行前询问你' }, { id: 'disabled', label: '禁止', note: '不向模型提供' }
]
const newDraft = (url = '') => Object.assign(draft, createMcpConnection({ url, name: '我的 MCP', auth: { type: 'none' } }))
const showNotice = (text: string) => { notice.value = text; window.setTimeout(() => { if (notice.value === text) notice.value = '' }, 3000) }
const goHome = () => { view.value = 'home'; selectedId.value = ''; testResult.value = null }
const openAdd = (mode: typeof addMode.value = 'url') => { newDraft(); addMode.value = mode; importText.value = ''; publicConfigUrl.value = ''; view.value = mode === 'json' || mode === 'stdio' ? 'import' : 'add' }
const authWithRefs = (type: McpAuth['type']): McpAuth => {
  if (type === 'bearer') return { type, secretRef: createSecretRef(), persistence: persistence.value }
  if (type === 'api-key') return { type, header: 'X-API-Key', secretRef: createSecretRef(), persistence: persistence.value }
  if (type === 'custom-headers') return { type, headers: [{ name: 'Authorization', secretRef: createSecretRef() }], persistence: persistence.value }
  if (type === 'oauth') return { type, status: 'not-configured' }
  return { type: 'none' }
}
const setAuthType = (type: McpAuth['type']) => { draft.auth = authWithRefs(type) }
const addHeader = () => { if (draft.auth.type === 'custom-headers') draft.auth.headers.push({ name: '', secretRef: createSecretRef() }) }
const removeHeader = (index: number) => { if (draft.auth.type === 'custom-headers') draft.auth.headers.splice(index, 1) }
const secretRefs = (auth: McpAuth) => auth.type === 'custom-headers' ? auth.headers.map(item => item.secretRef) : 'secretRef' in auth ? [auth.secretRef] : []
const saveSecrets = async (auth: McpAuth) => {
  if (auth.type !== 'none' && auth.type !== 'oauth') auth.persistence = persistence.value
  for (const secretRef of secretRefs(auth)) if (secretValues[secretRef] !== undefined) await setMcpSecret(secretRef, secretValues[secretRef], persistence.value)
}
const hydrateSecrets = async (auth: McpAuth) => { for (const secretRef of secretRefs(auth)) secretValues[secretRef] = await getMcpSecret(secretRef) }
const validateDraft = () => {
  if (!draft.name.trim()) throw new Error('请填写连接名称。')
  const url = new URL(draft.url)
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Remote MCP 必须使用 HTTPS；仅本机开发地址可使用 HTTP。')
  if (draft.auth.type === 'oauth') throw new Error('当前仅预留 OAuth 架构，尚不能完成 OAuth 登录。请选择其他认证方式。')
}
const persistDraft = async () => {
  validateDraft(); await saveSecrets(draft.auth)
  const existing = mcpSettings.connections.find(item => item.id === draft.id)
  if (existing) await closeMcpConnectionRuntime(existing.id)
  return existing ? updateMcpConnection(draft.id, JSON.parse(JSON.stringify(draft))) : addMcpConnection(JSON.parse(JSON.stringify(draft)))
}
const testDraft = async (save = true) => {
  try {
    busy.value = true; testResult.value = null; validateDraft(); await saveSecrets(draft.auth)
    const result = await discoverMcpConnection(createMcpConnection(JSON.parse(JSON.stringify(draft))))
    testResult.value = result; Object.assign(draft, result.connection)
    if (save) { const stored = await persistDraft(); Object.assign(stored, result.connection); selectedId.value = stored.id }
    showNotice(result.ok ? `连接成功，发现 ${result.connection.discoveredTools.filter(item => item.available !== false).length} 个工具` : result.connection.lastErrorMessage || '连接失败')
    return result.ok
  } catch (error) { showNotice(error instanceof Error ? error.message : '无法测试连接'); return false }
  finally { busy.value = false }
}
const saveDraft = async () => { try { busy.value = true; const stored = await persistDraft(); selectedId.value = stored.id; view.value = 'home'; showNotice('连接已保存') } catch (error) { showNotice(error instanceof Error ? error.message : '保存失败') } finally { busy.value = false } }
const openEdit = async (connection: McpConnection) => { selectedId.value = connection.id; Object.assign(draft, JSON.parse(JSON.stringify(connection))); persistence.value = connection.auth.type !== 'none' && connection.auth.type !== 'oauth' ? connection.auth.persistence || 'device' : 'device'; await hydrateSecrets(draft.auth); testResult.value = null; view.value = 'edit' }
const refreshConnection = async (connection: McpConnection) => { await openEdit(connection); if (await testDraft(true)) view.value = 'home' }
const removeConnection = async (connection: McpConnection) => {
  if (!window.confirm(`确定删除“${connection.name}”吗？删除后它的工具会立即从模型中移除。`)) return
  await closeMcpConnectionRuntime(connection.id); for (const ref of secretRefs(connection.auth)) await removeMcpSecret(ref)
  removeMcpConnection(connection.id); goHome(); showNotice('连接已删除')
}
const duplicateConnection = async (connection: McpConnection) => { const copy = duplicateMcpConnection(connection.id); await openEdit(copy); showNotice('已复制连接；出于安全考虑，请重新填写认证信息') }
const copyExport = async (connection: McpConnection) => { await navigator.clipboard.writeText(exportMcpConnection(connection)); showNotice('已复制不含秘密的连接配置') }
const applyImport = async (text: string) => {
  try {
    const result = importMcpConfig(text)
    if (result.kind === 'stdio') return showNotice(result.message || '网页无法直连 stdio MCP。')
    let first: McpConnection | undefined
    for (const item of result.connections) { const connection = addMcpConnection(item); first ||= connection }
    showNotice(`${result.connections.length} 个 Remote MCP 已导入${result.message ? `；${result.message}` : ''}`)
    if (first) await openEdit(first)
  } catch (error) { showNotice(error instanceof Error ? error.message : '导入失败') }
}
const fetchPublicConfig = async () => {
  try { busy.value = true; const response = await fetch(publicConfigUrl.value); if (!response.ok) throw new Error(`配置链接返回 HTTP ${response.status}`); await applyImport(await response.text()) }
  catch (error) { showNotice(error instanceof Error ? `${error.message}。配置站点还需允许浏览器 CORS。` : '无法读取公开配置链接') } finally { busy.value = false }
}
const openTools = (connection: McpConnection) => { selectedId.value = connection.id; view.value = 'tools' }
const openActivity = (connection?: McpConnection) => { selectedId.value = connection?.id || ''; view.value = 'activity' }
const setToolPolicy = (connection: McpConnection, tool: string, policy: McpToolPolicy) => { connection.toolPolicies[tool] = policy; connection.updatedAt = Date.now() }
const toggleCharacter = (connection: McpConnection, characterId: string) => {
  const ids = connection.allowedCharacterIds ? [...connection.allowedCharacterIds] : characters.value.map((item: any) => item.id)
  const index = ids.indexOf(characterId); if (index >= 0) ids.splice(index, 1); else ids.push(characterId)
  connection.allowedCharacterIds = ids.length === characters.value.length ? undefined : ids; connection.updatedAt = Date.now()
}
const allCharacters = (connection: McpConnection) => !connection.allowedCharacterIds?.length
const scanVideo = ref<HTMLVideoElement>(); let scanStream: MediaStream | undefined; let scanTimer = 0
const stopScan = () => { if (scanTimer) cancelAnimationFrame(scanTimer); scanTimer = 0; scanStream?.getTracks().forEach(track => track.stop()); scanStream = undefined }
const consumeQrText = async (text: string) => { stopScan(); if (/^https?:\/\//i.test(text.trim())) { newDraft(text.trim()); view.value = 'add'; addMode.value = 'url' } else await applyImport(text) }
const startScan = async () => {
  stopScan(); view.value = 'scan'; await nextTick()
  try {
    const Detector = (window as any).BarcodeDetector
    if (!Detector) throw new Error('当前浏览器不支持实时二维码识别，请改用图片识别或粘贴 URL/JSON。')
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); if (scanVideo.value) { scanVideo.value.srcObject = scanStream; await scanVideo.value.play() }
    const detector = new Detector({ formats: ['qr_code'] })
    const tick = async () => { if (!scanVideo.value || !scanStream) return; try { const codes = await detector.detect(scanVideo.value); if (codes[0]?.rawValue) return void consumeQrText(codes[0].rawValue) } catch {}; scanTimer = requestAnimationFrame(tick) }; tick()
  } catch (error) { showNotice(error instanceof Error ? error.message : '无法打开摄像头') }
}
const scanImage = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return
  try { const Detector = (window as any).BarcodeDetector; if (!Detector) throw new Error('当前浏览器不支持二维码图片识别。'); const bitmap = await createImageBitmap(file); const codes = await new Detector({ formats: ['qr_code'] }).detect(bitmap); bitmap.close(); if (!codes[0]?.rawValue) throw new Error('图片中没有识别到二维码。'); await consumeQrText(codes[0].rawValue) } catch (error) { showNotice(error instanceof Error ? error.message : '二维码识别失败') }
}
onUnmounted(stopScan)
</script>

<template>
  <div class="mcp-app">
    <header class="mcp-header"><button v-if="view !== 'home'" class="icon-button" type="button" aria-label="返回" @click="stopScan(); goHome()">‹</button><span v-else></span><div class="header-copy"><h1>MCP</h1><p>{{ view === 'home' ? '让角色连接外部工具和数据' : view === 'tools' ? '工具与权限' : view === 'activity' ? '活动记录' : view === 'scan' ? '扫描二维码' : '连接配置' }}</p></div><button class="icon-button close" type="button" aria-label="关闭" @click="$emit('close')">×</button></header>
    <div v-if="notice" class="mcp-toast">{{ notice }}</div>

    <main v-if="view === 'home'" class="mcp-scroll">
      <section class="master-panel"><div class="master-mark">M</div><div class="master-copy"><strong>MCP 总开关</strong><small>{{ mcpSettings.enabled ? `${mcpSettings.connections.filter(item => item.enabled).length} 个连接可供角色使用` : '所有 MCP 工具均已暂停' }}</small></div><button class="switch-control" :class="{ on: mcpSettings.enabled }" type="button" role="switch" :aria-checked="mcpSettings.enabled" @click="mcpSettings.enabled = !mcpSettings.enabled"><span></span></button></section>
      <div class="list-heading"><div><h2>我的连接</h2><p>Remote MCP 通过当前设备直接连接</p></div><button type="button" @click="openActivity()">活动记录</button></div>
      <section v-if="mcpSettings.connections.length" class="connection-list">
        <article v-for="connection in mcpSettings.connections" :key="connection.id" class="connection-card" @click="openEdit(connection)"><span class="connection-mark">{{ connection.name.slice(0, 1).toUpperCase() }}</span><div class="connection-copy"><strong>{{ connection.name }}</strong><small :class="`status-${connection.status}`">{{ connection.status === 'connected' ? `已连接 · ${connection.discoveredTools.filter(item => item.available !== false).length} 个工具` : connection.status === 'error' ? connection.lastErrorMessage : connection.enabled ? '尚未测试' : '已停用' }}</small><em>{{ connection.url }}</em></div><button class="switch-control" :class="{ on: connection.enabled }" type="button" role="switch" :aria-checked="connection.enabled" @click.stop="connection.enabled = !connection.enabled"><span></span></button></article>
      </section>
      <section v-else class="empty-state"><span>M</span><h2>还没有 MCP 连接</h2><p>添加支持浏览器访问的 Remote MCP，让角色按需使用外部工具。</p></section>
      <button class="primary-action" type="button" @click="openAdd()">＋ 添加 MCP</button>
      <p class="browser-note">PWA/浏览器直连要求服务使用 HTTPS，并正确允许当前网站的 Origin、CORS、OPTIONS 和认证 Header。stdio MCP 需要先通过本地 Host / Bridge 转为 Remote MCP。</p>
    </main>

    <main v-else-if="view === 'add' || view === 'edit'" class="mcp-scroll form-scroll">
      <section v-if="view === 'add'" class="entry-grid"><button v-for="item in [{id:'url',t:'粘贴连接地址',n:'输入 URL 后自动检测'},{id:'manual',t:'手动配置',n:'设置 transport 与认证'},{id:'json',t:'导入 JSON',n:'兼容常见 mcpServers'},{id:'scan',t:'扫描二维码',n:'二维码不应包含秘密'},{id:'public',t:'公开配置链接',n:'从 HTTPS 链接导入'},{id:'stdio',t:'导入 stdio 配置',n:'识别并提示转换方式'}]" :key="item.id" type="button" @click="item.id === 'scan' ? startScan() : item.id === 'json' || item.id === 'stdio' ? openAdd(item.id as any) : addMode = item.id as any"><strong>{{ item.t }}</strong><small>{{ item.n }}</small></button></section>
      <section v-if="addMode === 'public'" class="form-card"><label>公开配置链接<input v-model.trim="publicConfigUrl" inputmode="url" placeholder="https://example.com/mcp-config.json"></label><button class="wide-button" type="button" :disabled="busy" @click="fetchPublicConfig">{{ busy ? '正在读取…' : '读取并导入' }}</button></section>
      <template v-else>
        <section class="form-card"><label>名称<input v-model.trim="draft.name" maxlength="80" placeholder="我的 MCP"></label><label>服务地址<input v-model.trim="draft.url" inputmode="url" autocomplete="url" placeholder="https://example.com/mcp"></label></section>
        <section class="form-card"><h2>连接方式</h2><div class="segmented wrap"><button v-for="item in transportOptions" :key="item.id" type="button" :class="{ active: draft.transport === item.id }" @click="draft.transport = item.id">{{ item.label }}</button></div><label class="number-label">超时（毫秒）<input v-model.number="draft.timeoutMs" type="number" min="1000" max="120000" inputmode="numeric"></label></section>
        <section class="form-card"><h2>认证方式</h2><div class="choice-stack"><button v-for="item in authOptions" :key="item.id" type="button" :class="{ active: draft.auth.type === item.id }" @click="setAuthType(item.id)"><span>{{ item.label }}</span><i></i></button></div><p v-if="draft.auth.type === 'oauth'" class="warning-box">OAuth 的类型、状态与回调位置已预留，但当前静态 PWA 尚不能完成通用第三方 OAuth 登录。</p>
          <template v-if="draft.auth.type !== 'none' && draft.auth.type !== 'oauth'"><div class="segmented persistence"><button type="button" :class="{active:persistence==='session'}" @click="persistence='session'">仅本次会话</button><button type="button" :class="{active:persistence==='device'}" @click="persistence='device'">保存在此设备</button></div><p class="privacy-note">秘密与连接配置分开保存，不会进入模型上下文、活动日志或默认导出。Web/PWA 的设备存储不等同于服务器密钥库。</p></template>
          <label v-if="draft.auth.type === 'bearer'">Token<div class="secret-row"><input v-model="secretValues[draft.auth.secretRef]" :type="showSecrets[draft.auth.secretRef] ? 'text' : 'password'" autocomplete="off" placeholder="Bearer Token"><button type="button" @click="showSecrets[draft.auth.secretRef]=!showSecrets[draft.auth.secretRef]">{{ showSecrets[draft.auth.secretRef] ? '隐藏' : '显示' }}</button></div></label>
          <template v-else-if="draft.auth.type === 'api-key'"><label>Header 名称<input v-model.trim="draft.auth.header" placeholder="X-API-Key"></label><label>Value<div class="secret-row"><input v-model="secretValues[draft.auth.secretRef]" :type="showSecrets[draft.auth.secretRef] ? 'text' : 'password'" autocomplete="off" placeholder="API Key"><button type="button" @click="showSecrets[draft.auth.secretRef]=!showSecrets[draft.auth.secretRef]">{{ showSecrets[draft.auth.secretRef] ? '隐藏' : '显示' }}</button></div></label></template>
          <template v-else-if="draft.auth.type === 'custom-headers'"><div v-for="(header,index) in draft.auth.headers" :key="header.secretRef" class="header-pair"><input v-model.trim="header.name" placeholder="Header 名称"><div class="secret-row"><input v-model="secretValues[header.secretRef]" :type="showSecrets[header.secretRef] ? 'text' : 'password'" placeholder="Value"><button type="button" @click="removeHeader(index)">删除</button></div></div><button class="text-action" type="button" @click="addHeader">＋ 添加 Header</button></template>
        </section>
        <section class="form-card"><h2>默认工具策略</h2><div class="policy-grid"><button v-for="item in policies" :key="item.id" type="button" :class="{active:draft.defaultToolPolicy===item.id}" @click="draft.defaultToolPolicy=item.id"><strong>{{ item.label }}</strong><small>{{ item.note }}</small></button></div><label class="number-label">连接优先级<input v-model.number="draft.priority" type="number" min="-100" max="100" inputmode="numeric"><small>数值越高，工具在模型列表中越靠前；不会随机替换同名工具。</small></label><button class="plain-toggle" type="button" @click="draft.fallbackEnabled=!draft.fallbackEnabled"><span><strong>允许作为备用连接</strong><small>仅记录备用偏好；不同 MCP 的工具不会在失败后擅自互换。</small></span><i :class="{on:draft.fallbackEnabled}"></i></button></section>
        <section v-if="testResult" class="test-card" :class="{success:testResult.ok}"><h2>{{ testResult.ok ? '连接成功' : '连接失败' }}</h2><p v-for="check in testResult.checks" :key="check.id"><b>{{ check.ok ? '✓' : '!' }}</b><span>{{ check.label }}<small v-if="check.message">{{ check.message }}</small></span></p><div v-if="testResult.ok" class="server-summary"><span>Server：{{ draft.serverName }}</span><span>协议：{{ draft.protocolVersion }}</span><span>工具：{{ draft.discoveredTools.filter(item=>item.available!==false).length }}</span><span>资源：{{ draft.discoveredResources.length }}</span><span>Prompts：{{ draft.discoveredPrompts.length }}</span><span>延迟：{{ draft.latencyMs }}ms</span></div></section>
        <div class="form-actions"><button type="button" :disabled="busy" @click="testDraft(true)">{{ busy ? '正在连接…' : '测试连接' }}</button><button class="primary" type="button" :disabled="busy" @click="saveDraft">保存</button></div>
        <section v-if="view === 'edit' && selected" class="manage-card"><button type="button" @click="openTools(selected)">查看工具与权限 <span>{{ selected.discoveredTools.length }}</span></button><button type="button" @click="refreshConnection(selected)">刷新工具列表</button><button type="button" @click="openActivity(selected)">查看调用记录</button><button type="button" @click="copyExport(selected)">复制连接配置（不含秘密）</button><button type="button" @click="duplicateConnection(selected)">复制连接</button><button class="danger" type="button" @click="removeConnection(selected)">删除连接</button></section>
      </template>
    </main>

    <main v-else-if="view === 'import'" class="mcp-scroll"><section class="form-card"><h2>{{ addMode === 'stdio' ? '导入 stdio 配置' : '导入 JSON 配置' }}</h2><p class="section-note">可粘贴 NRJ 配置或常见 mcpServers JSON。stdio 会被识别，但网页不会伪装成可直接运行。</p><textarea v-model="importText" spellcheck="false" placeholder='{ "mcpServers": { "example": { "url": "https://example.com/mcp" } } }'></textarea><button class="wide-button" type="button" @click="applyImport(importText)">识别并导入</button></section></main>

    <main v-else-if="view === 'scan'" class="mcp-scroll"><section class="scanner-card"><video ref="scanVideo" muted playsinline></video><div class="scan-frame"></div><p>将只含公开连接配置的二维码放入框内。Token、Authorization 等秘密不应写进二维码。</p><label class="wide-button file-button">从图片识别<input type="file" accept="image/*" @change="scanImage"></label><button class="text-action" type="button" @click="stopScan(); openAdd('url')">改为粘贴 URL</button></section></main>

    <main v-else-if="view === 'tools' && selected" class="mcp-scroll"><section class="scope-card"><h2>可用于</h2><button class="scope-all" type="button" :class="{active:allCharacters(selected)}" @click="selected.allowedCharacterIds=undefined">所有角色</button><div class="character-grid"><button v-for="character in characters" :key="character.id" type="button" :class="{active:allCharacters(selected)||selected.allowedCharacterIds?.includes(character.id)}" @click="toggleCharacter(selected,character.id)">{{ character.name }}</button></div><p>群聊中只要存在一个获准角色，该连接即可用；执行时仍会检查单工具策略。</p></section><section class="scope-card category-card"><h2>工具分类策略</h2><div v-for="category in [{id:'read',name:'读取 / 搜索'},{id:'write',name:'写入 / 发送'},{id:'other',name:'其他工具'}]" :key="category.id" class="category-row"><strong>{{ category.name }}</strong><div class="policy-chips"><button v-for="item in policies" :key="item.id" type="button" :class="{active:(selected.categoryPolicies[category.id]||selected.defaultToolPolicy)===item.id}" @click="selected.categoryPolicies[category.id]=item.id">{{ item.label }}</button></div></div><p>优先级：单工具策略 → 分类策略 → 服务器默认策略。</p></section><section class="tool-list"><article v-for="tool in selected.discoveredTools" :key="tool.name" :class="{unavailable:tool.available===false}"><div class="tool-heading"><div><strong>{{ tool.name }}</strong><small>{{ tool.description || '服务器未提供说明' }}</small></div><span>{{ tool.category || 'other' }}</span></div><div class="policy-chips"><button v-for="item in policies" :key="item.id" type="button" :class="{active:(selected.toolPolicies[tool.name]||selected.categoryPolicies[tool.category||'other']||selected.defaultToolPolicy)===item.id}" @click="setToolPolicy(selected,tool.name,item.id)">{{ item.label }}</button></div><label>模型可见补充说明<textarea v-model="selected.toolDescriptionOverrides[tool.name]" rows="2" placeholder="可选；帮助模型理解何时使用此工具"></textarea></label></article><div v-if="!selected.discoveredTools.length" class="empty-inline">尚未发现工具，请先测试连接或刷新工具列表。</div></section></main>

    <main v-else-if="view === 'activity'" class="mcp-scroll"><div class="list-heading"><div><h2>{{ selected ? selected.name : '全部活动' }}</h2><p>参数中的敏感字段已隐藏</p></div><button type="button" @click="clearMcpActivities">清空</button></div><section class="activity-list"><details v-for="item in selectedActivities" :key="item.id"><summary><span><strong>{{ item.connectionName }} · {{ item.toolName }}</strong><small>{{ new Date(item.startedAt).toLocaleString() }}</small></span><em :class="item.status">{{ item.status === 'success' ? '成功' : item.status === 'denied' ? '已拒绝' : item.status === 'cancelled' ? '已取消' : '失败' }} · {{ item.durationMs }}ms</em></summary><dl><div><dt>聊天</dt><dd>{{ item.chatId || '未知' }}</dd></div><div><dt>结果大小</dt><dd>{{ item.resultSize }} 字符</dd></div><div v-if="item.errorCode"><dt>错误</dt><dd>{{ item.errorCode }} · {{ item.errorMessage }}</dd></div></dl><pre>{{ JSON.stringify(item.arguments,null,2) }}</pre></details><div v-if="!selectedActivities.length" class="empty-inline">还没有工具调用记录。</div></section></main>
  </div>
</template>

<style scoped src="./app_MCP.css"></style>
