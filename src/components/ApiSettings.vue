<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { globalSettings, apiSettings, apiNodesState, addApiNode, createEmptyApiNode, deleteApiNode, getApiNodeEnableConflicts, setApiNodeEnabled, type ApiNode, type ApiNodeConflictResolution } from '../store'
import { apiCapabilityRegistry, type ApiCapabilityId } from '../services/apiCapabilities'
import ApiNodeEditor from './api/ApiNodeEditor.vue'

const emit = defineEmits<{ close: [] }>()
const selectedNodeId = ref<'list' | 'default' | string>('list')
const searchQuery = ref('')
const pendingDelete = ref<ApiNode | null>(null)
const pendingEnable = ref<ApiNode | null>(null)

const selectedNode = computed(() => apiNodesState.nodes.find(node => node.id === selectedNodeId.value))
const filteredNodes = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return apiNodesState.nodes
  return apiNodesState.nodes.filter(node => `${node.name} ${capabilityNames(node).join(' ')}`.toLowerCase().includes(query))
})
const capabilityNames = (node: ApiNode) => (Object.keys(node.capabilities) as ApiCapabilityId[]).map(id => apiCapabilityRegistry[id]?.name || id)
const nodeSummary = (node: ApiNode) => capabilityNames(node).join('、') || '暂未分配功能'

const addNode = () => {
  const node = addApiNode(createEmptyApiNode(`自定义节点 ${apiNodesState.nodes.length + 1}`))
  selectedNodeId.value = node.id
}
const requestToggle = (node: ApiNode) => {
  if (node.enabled) { setApiNodeEnabled(node.id, false); return }
  const conflicts = getApiNodeEnableConflicts(node.id)
  if (!conflicts.length) { setApiNodeEnabled(node.id, true); return }
  pendingEnable.value = node
}
const resolveEnable = (resolution: ApiNodeConflictResolution) => {
  if (!pendingEnable.value) return
  setApiNodeEnabled(pendingEnable.value.id, true, resolution)
  pendingEnable.value = null
}
const confirmDelete = () => {
  if (!pendingDelete.value) return
  deleteApiNode(pendingDelete.value.id)
  selectedNodeId.value = 'list'
  pendingDelete.value = null
}
const fallbackText = (capability: ApiCapabilityId) => apiCapabilityRegistry[capability].fallback === 'local-non-vector' ? '改用本地非向量检索' : '回退默认节点'
</script>

<template>
  <div class="api-modal editorial-style" :class="{'is-dark':globalSettings.darkMode}">
    <div class="lily-watermark"></div>
    <div class="content-scroll">
      <header class="page-header">
        <div class="page-title-group"><button class="title-wrapper title-button" type="button" @click="selectedNodeId==='list'?emit('close'):selectedNodeId='list'"><h1 class="en-title">Destiny</h1><span class="cn-subtitle">API 节点配置</span></button></div>
        <div class="minimal-search" :class="{'is-active':searchQuery}"><svg class="search-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input v-model="searchQuery" class="search-input" :placeholder="selectedNodeId==='list'?'搜索节点':'搜索当前设置'" autocomplete="off"><button v-if="searchQuery" class="clear-search-btn" type="button" @click="searchQuery=''">×</button></div>
      </header>

      <div v-if="selectedNodeId==='list'" class="api-node-home">
        <section class="settings-section"><div class="red-dot"></div><div class="section-title"><span class="cn">默认节点</span><span class="en">DEFAULT</span></div>
          <button class="node-card default" type="button" @click="selectedNodeId='default'"><span class="node-state active">常驻</span><span class="node-card-copy"><strong>默认聊天节点</strong><small>普通聊天 · 未绑定文本功能的回退节点</small></span><span class="node-arrow">›</span></button>
        </section>

        <section class="settings-section"><div class="red-dot"></div><div class="section-title"><span class="cn">自定义节点</span><span class="en">CUSTOM</span><small class="section-count">{{apiNodesState.nodes.length}}</small></div>
          <div v-if="filteredNodes.length" class="node-list"><button v-for="node in filteredNodes" :key="node.id" class="node-card" type="button" @click="selectedNodeId=node.id"><span class="node-state" :class="{active:node.enabled}">{{node.enabled?'启用':'停用'}}</span><span class="node-card-copy"><strong>{{node.name}}</strong><small :title="nodeSummary(node)">{{nodeSummary(node)}}</small></span><span class="node-arrow">›</span></button></div>
          <p v-else-if="searchQuery" class="node-empty">没有匹配的节点</p><p v-else class="node-empty">还没有自定义节点。需要专用模型时再创建即可。</p>
          <button class="add-node-button" type="button" @click="addNode"><span>＋ 新建节点</span><small>一套凭证可负责多个功能</small></button>
        </section>

        <section v-if="apiNodesState.migrationNotes.length" class="settings-section migration-note"><div class="red-dot"></div><div class="section-title"><span class="cn">升级说明</span><span class="en">MIGRATION</span></div><p v-for="note in apiNodesState.migrationNotes" :key="note">{{note}}</p></section>
      </div>

      <div v-else class="thread-wrapper"><div class="red-line-track"></div>
        <ApiNodeEditor v-if="selectedNodeId==='default'" :settings="apiSettings" :search-query="searchQuery" is-default :dark-mode="globalSettings.darkMode" @back="selectedNodeId='list'" />
        <ApiNodeEditor v-else-if="selectedNode" :settings="selectedNode" :node="selectedNode" :search-query="searchQuery" :dark-mode="globalSettings.darkMode" @back="selectedNodeId='list'" @toggle-enabled="requestToggle(selectedNode)" @delete="pendingDelete=selectedNode" />
      </div>
      <div class="scroll-spacer"></div>
    </div>

    <div class="bottom-mask"></div><button class="editorial-return-btn" type="button" @click="selectedNodeId==='list'?emit('close'):selectedNodeId='list'"><span class="cn">{{selectedNodeId==='list'?'返回':'节点列表'}}</span><span class="en">RETURN</span><div class="btn-line"></div></button>

    <div v-if="pendingDelete" class="editorial-modal-overlay"><div class="editorial-modal-content wide"><h2 class="modal-en-title">Delete</h2><p class="modal-cn-desc">删除「{{pendingDelete.name}}」？</p><div class="delete-impact"><template v-if="Object.keys(pendingDelete.capabilities).length"><b>当前负责</b><span v-for="id in Object.keys(pendingDelete.capabilities) as ApiCapabilityId[]" :key="id">{{apiCapabilityRegistry[id].name}} · {{fallbackText(id)}}</span></template><span v-else>此节点尚未负责任何功能。</span></div><p class="modal-cn-desc small">删除后配置不可恢复，不会留下悬空绑定。</p><div class="modal-actions"><button class="text-action-btn" type="button" @click="pendingDelete=null">取消</button><button class="text-action-btn reset-btn" type="button" @click="confirmDelete">确认删除</button></div></div></div>

    <div v-if="pendingEnable" class="editorial-modal-overlay"><div class="editorial-modal-content wide"><h2 class="modal-en-title">Conflict</h2><p class="modal-cn-desc">重新启用「{{pendingEnable.name}}」时，以下功能已由其他节点负责：</p><div class="delete-impact"><span v-for="item in getApiNodeEnableConflicts(pendingEnable.id)" :key="item.capability">{{apiCapabilityRegistry[item.capability].name}} · {{item.owner.name}}</span></div><div class="conflict-actions"><button type="button" @click="resolveEnable('keep-current')"><b>保留当前分配</b><small>启用本节点，但放弃冲突职责</small></button><button type="button" @click="resolveEnable('take-over')"><b>转交给此节点</b><small>从当前节点移除并恢复到本节点</small></button></div><button class="text-action-btn" type="button" @click="pendingEnable=null">取消</button></div></div>
  </div>
</template>

<style scoped src="./ApiSettings.css"></style>
