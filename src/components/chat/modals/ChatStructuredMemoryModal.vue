/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { StructuredMemoryState } from '../../../services/memoryEngine'

const props = defineProps<{ visible: boolean; state?: StructuredMemoryState | null; memberMemories?: Record<string, any[]>; memberNames?: Record<string, string> }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'update-state', state: StructuredMemoryState): void; (e: 'update-member-memories', memories: Record<string, any[]>): void }>()

type Tab = 'events' | 'variables' | 'tables' | 'relations' | 'members'
const activeTab = ref<Tab>('events')
const search = ref('')
const working = ref<StructuredMemoryState | null>(null)
const workingMembers = ref<Record<string, any[]>>({})
const editTarget = ref<any>(null)
const editTitle = ref('')
const editValue = ref('')
const deleteTarget = ref<{ type: Tab; id: string } | null>(null)

const cloneState = () => {
  working.value = props.state ? { relations: [], ...JSON.parse(JSON.stringify(props.state)) } : {
    version: 2, events: [], variables: [], tableRows: [], relations: [], coverage: [], lastConsolidatedAt: 0
  }
  workingMembers.value = JSON.parse(JSON.stringify(props.memberMemories || {}))
}

watch(() => props.visible, visible => { if (visible) cloneState() }, { immediate: true })

const filteredEvents = computed(() => (working.value?.events || []).filter(item =>
  !search.value || `${item.title} ${item.summary} ${item.tags.join(' ')}`.toLowerCase().includes(search.value.toLowerCase())
))
const filteredVariables = computed(() => (working.value?.variables || []).filter(item =>
  !search.value || `${item.category} ${item.key} ${item.value}`.toLowerCase().includes(search.value.toLowerCase())
))
const filteredTables = computed(() => (working.value?.tableRows || []).filter(item =>
  !search.value || `${item.table} ${item.title} ${item.value}`.toLowerCase().includes(search.value.toLowerCase())
))
const filteredRelations = computed(() => (working.value?.relations || []).filter(item =>
  !search.value || `${item.source} ${item.relation} ${item.target}`.toLowerCase().includes(search.value.toLowerCase())
))
const filteredMemberMemories = computed(() => Object.entries(workingMembers.value).flatMap(([memberId, memories]) =>
  (memories || []).filter(item => item.enabled !== false).map(item => ({ ...item, memberId, memberName: props.memberNames?.[memberId] || memberId }))
).filter(item => !search.value || `${item.memberName} ${item.content}`.toLowerCase().includes(search.value.toLowerCase())))

const tableNames: Record<string, string> = {
  people: '人物档案', preferences: '喜好禁忌', events: '重要事件', commitments: '承诺待办',
  gifts: '礼物纪念物', relationships: '关系变化', timeline: '时间线', conflicts: '冲突和解', places: '地点经历'
}

const openEdit = (item: any, type: Tab) => {
  editTarget.value = { item, type }
  editTitle.value = type === 'variables' ? item.key : type === 'relations' ? item.source : item.title
  if (type === 'members') editTitle.value = item.memberName
  editValue.value = type === 'events' ? item.summary : type === 'relations' ? `${item.relation} → ${item.target}` : type === 'members' ? item.content : item.value
}

const saveEdit = () => {
  if (!editTarget.value || !editTitle.value.trim() || !editValue.value.trim()) return
  const { item, type } = editTarget.value
  if (type === 'members') {
    const target = (workingMembers.value[item.memberId] || []).find(memory => memory.id === item.id)
    if (target) { target.content = editValue.value.trim(); target.updatedAt = Date.now() }
    emit('update-member-memories', JSON.parse(JSON.stringify(workingMembers.value)))
    editTarget.value = null
    return
  }
  if (type === 'variables') item.key = editTitle.value.trim()
  else if (type === 'relations') {
    const parts = editValue.value.split('→').map(part => part.trim())
    item.source = editTitle.value.trim()
    item.relation = parts[0] || item.relation
    item.target = parts.slice(1).join('→') || item.target
  }
  else item.title = editTitle.value.trim()
  if (type === 'events') item.summary = editValue.value.trim()
  else if (type === 'relations') item.confidence = item.confidence || 0.75
  else item.value = editValue.value.trim()
  item.updatedAt = Date.now()
  commit()
  editTarget.value = null
}

const commit = () => {
  if (working.value) emit('update-state', JSON.parse(JSON.stringify(working.value)))
}

const toggleLock = (item: any) => {
  item.locked = !item.locked
  commit()
}

const requestDelete = (type: Tab, id: string) => { deleteTarget.value = { type, id } }
const confirmDelete = () => {
  if (!working.value || !deleteTarget.value) return
  const { type, id } = deleteTarget.value
  if (type === 'events') working.value.events = working.value.events.filter(item => item.id !== id)
  if (type === 'variables') working.value.variables = working.value.variables.filter(item => item.id !== id)
  if (type === 'tables') working.value.tableRows = working.value.tableRows.filter(item => item.id !== id)
  if (type === 'relations') working.value.relations = working.value.relations.filter(item => item.id !== id)
  if (type === 'members') {
    for (const memberId of Object.keys(workingMembers.value)) workingMembers.value[memberId] = workingMembers.value[memberId].filter(item => item.id !== id)
    emit('update-member-memories', JSON.parse(JSON.stringify(workingMembers.value)))
  }
  deleteTarget.value = null
  commit()
}

const evidenceText = (item: any) => {
  const count = item.evidence?.messageIds?.length || 0
  return count ? `${count} 条证据` : '暂无证据'
}
</script>

<template>
  <transition name="folder-fade">
    <div v-if="visible" class="folder-modal-overlay" @click.self="emit('close')">
      <div class="structured-modal" @click.stop>
        <div class="memory-header">
          <div class="memory-title">结构化记忆</div>
          <div class="memory-close" @click="emit('close')">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        </div>

        <div class="memory-tabs">
          <div class="memory-tab" :class="{ active: activeTab === 'events' }" @click="activeTab = 'events'">事件 {{ working?.events.length || 0 }}</div>
          <div class="memory-tab" :class="{ active: activeTab === 'variables' }" @click="activeTab = 'variables'">变量 {{ working?.variables.length || 0 }}</div>
          <div class="memory-tab" :class="{ active: activeTab === 'tables' }" @click="activeTab = 'tables'">表格 {{ working?.tableRows.length || 0 }}</div>
          <div class="memory-tab" :class="{ active: activeTab === 'relations' }" @click="activeTab = 'relations'">关系 {{ working?.relations?.length || 0 }}</div>
          <div v-if="memberMemories" class="memory-tab" :class="{ active: activeTab === 'members' }" @click="activeTab = 'members'">成员 {{ filteredMemberMemories.length }}</div>
        </div>

        <div class="memory-search">
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input v-model="search" placeholder="搜索记忆" autocomplete="off" />
          <div v-if="search" class="clear-search" @click="search = ''">×</div>
        </div>

        <div class="structured-body">
          <template v-if="activeTab === 'events'">
            <div v-if="filteredEvents.length === 0" class="empty-state">暂无事件记忆</div>
            <div v-for="item in filteredEvents" :key="item.id" class="memory-card">
              <div class="card-top"><div class="card-title">{{ item.title }}</div><div class="importance">重要度 {{ item.importance }}</div></div>
              <div class="card-content">{{ item.summary }}</div>
              <div v-if="item.unresolved?.length" class="unresolved">未完成：{{ item.unresolved.join('、') }}</div>
              <div class="card-meta">{{ item.startTime || '时间未记录' }} · {{ evidenceText(item) }}</div>
              <div class="card-actions"><div @click="openEdit(item, 'events')">编辑</div><div class="danger" @click="requestDelete('events', item.id)">删除</div></div>
            </div>
          </template>

          <template v-else-if="activeTab === 'variables'">
            <div v-if="filteredVariables.length === 0" class="empty-state">暂无变量记忆</div>
            <div v-for="item in filteredVariables" :key="item.id" class="memory-card variable-card">
              <div class="card-top"><div><span class="category">{{ item.category }}</span><span class="card-title">{{ item.key }}</span></div><div class="lock" :class="{ active: item.locked }" @click="toggleLock(item)">{{ item.locked ? '已锁定' : '可更新' }}</div></div>
              <div class="card-content value-content">{{ item.value }}</div>
              <div class="card-meta">置信度 {{ Math.round(item.confidence * 100) }}% · {{ evidenceText(item) }}<span v-if="item.previousValues?.length"> · {{ item.previousValues.length }} 个旧值</span></div>
              <div class="card-actions"><div @click="openEdit(item, 'variables')">编辑</div><div class="danger" @click="requestDelete('variables', item.id)">删除</div></div>
            </div>
          </template>

          <template v-else-if="activeTab === 'tables'">
            <div v-if="filteredTables.length === 0" class="empty-state">暂无表格记忆</div>
            <div v-for="item in filteredTables" :key="item.id" class="memory-card table-card">
              <div class="card-top"><div><span class="category">{{ tableNames[item.table] || item.table }}</span><span class="card-title">{{ item.title }}</span></div><div class="importance">{{ item.status }}</div></div>
              <div class="card-content value-content">{{ item.value }}</div>
              <div class="card-meta">{{ item.time || '时间未记录' }} · {{ evidenceText(item) }}</div>
              <div class="card-actions"><div @click="openEdit(item, 'tables')">编辑</div><div class="danger" @click="requestDelete('tables', item.id)">删除</div></div>
            </div>
          </template>

          <template v-else-if="activeTab === 'relations'">
            <div v-if="filteredRelations.length === 0" class="empty-state">暂无关系图谱</div>
            <div v-for="item in filteredRelations" :key="item.id" class="memory-card relation-card">
              <div class="relation-line"><span>{{ item.source }}</span><b>— {{ item.relation }} →</b><span>{{ item.target }}</span></div>
              <div class="card-meta">置信度 {{ Math.round(item.confidence * 100) }}% · {{ item.startTime || '起始时间未记录' }} · {{ evidenceText(item) }}</div>
              <div class="card-actions"><div @click="openEdit(item, 'relations')">编辑</div><div class="danger" @click="requestDelete('relations', item.id)">删除</div></div>
            </div>
          </template>
          <template v-else>
            <div v-if="filteredMemberMemories.length === 0" class="empty-state">暂无成员主观记忆</div>
            <div v-for="item in filteredMemberMemories" :key="`${item.memberId}_${item.id}`" class="memory-card">
              <div class="card-top"><div class="card-title">{{ item.memberName }}</div><div class="importance">主观记忆</div></div>
              <div class="card-content">{{ item.content }}</div>
              <div class="card-meta">{{ item.date || '日期未记录' }} · {{ item.evidenceMessageIds?.length || 0 }} 条证据</div>
              <div class="card-actions"><div @click="openEdit(item, 'members')">编辑</div><div class="danger" @click="requestDelete('members', item.id)">删除</div></div>
            </div>
          </template>
        </div>

        <div v-if="editTarget" class="inner-overlay" @click.self="editTarget = null">
          <div class="edit-modal" @click.stop>
            <div class="edit-title">编辑记忆</div>
            <input v-model="editTitle" class="edit-input" placeholder="标题" />
            <textarea v-model="editValue" class="edit-textarea" placeholder="内容"></textarea>
            <div class="confirm-actions"><div class="confirm-btn cancel" @click="editTarget = null">取消</div><div class="confirm-btn primary" @click="saveEdit">保存</div></div>
          </div>
        </div>

        <div v-if="deleteTarget" class="inner-overlay" @click.self="deleteTarget = null">
          <div class="edit-modal confirm-box" @click.stop>
            <div class="edit-title">删除记忆</div>
            <div class="delete-desc">确定删除这条结构化记忆吗？关联的向量会在下次重建时同步更新。</div>
            <div class="confirm-actions"><div class="confirm-btn cancel" @click="deleteTarget = null">取消</div><div class="confirm-btn danger" @click="confirmDelete">删除</div></div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.folder-modal-overlay { position: fixed; inset: 0; z-index: 10003; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.42); }
.structured-modal { width: 92%; max-width: min(430px, calc(100% - 24px)); box-sizing: border-box; height: min(78vh, 680px); display: flex; flex-direction: column; overflow: hidden; border-radius: 20px; background: var(--sys-bg-secondary, #fff); box-shadow: 0 14px 38px rgba(0,0,0,.16); }
.memory-header { min-height: 56px; padding: 0 18px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,.05); }
.memory-title { font-size: 17px; font-weight: 600; color: var(--text-primary, #222); }
.memory-close { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--text-secondary, #666); cursor: pointer; }
.memory-tabs { display: flex; padding: 8px 14px 0; gap: 8px; }
.memory-tab { flex: 1; padding: 9px 4px; text-align: center; font-size: 13px; color: var(--text-tertiary, #999); border-radius: 10px; cursor: pointer; }
.memory-tab.active { color: var(--text-primary, #222); font-weight: 600; background: var(--sys-bg-primary, #f5f5f7); }
.memory-search { margin: 10px 14px; height: 36px; padding: 0 11px; display: flex; align-items: center; gap: 8px; border-radius: 10px; color: var(--text-tertiary, #999); background: var(--sys-bg-primary, #f5f5f7); }
.memory-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text-primary, #222); font: inherit; font-size: 13px; }
.clear-search { cursor: pointer; font-size: 18px; }
.structured-body { flex: 1; width: 100%; box-sizing: border-box; overflow-y: auto; padding: 0 14px 18px; }
.empty-state { padding: 70px 0; text-align: center; color: var(--text-tertiary, #999); font-size: 13px; }
.memory-card { width: 100%; box-sizing: border-box; margin-bottom: 10px; padding: 14px; border-radius: 13px; background: var(--sys-bg-primary, #f7f7f8); }
.card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.card-title { font-size: 14px; font-weight: 600; color: var(--text-primary, #222); }
.importance, .lock { flex-shrink: 0; padding: 3px 7px; border-radius: 8px; font-size: 10px; color: var(--text-tertiary, #888); background: rgba(0,0,0,.04); }
.lock { cursor: pointer; }.lock.active { color: var(--theme-color, #5b8def); background: color-mix(in srgb, var(--theme-color, #5b8def) 12%, transparent); }
.category { margin-right: 7px; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 500; color: var(--theme-color, #5b8def); background: color-mix(in srgb, var(--theme-color, #5b8def) 10%, transparent); }
.card-content { margin-top: 8px; font-size: 13px; line-height: 1.55; color: var(--text-secondary, #555); white-space: pre-wrap; }.value-content { font-size: 14px; color: var(--text-primary, #333); }
.unresolved { margin-top: 7px; color: #b56a35; font-size: 12px; }.card-meta { margin-top: 9px; color: var(--text-tertiary, #999); font-size: 10px; }
.relation-line { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 7px; padding: 8px 0; color: var(--text-primary, #333); font-size: 13px; }.relation-line b { color: var(--theme-color, #5b8def); font-size: 11px; font-weight: 500; }
.card-actions { display: flex; justify-content: flex-end; gap: 18px; margin-top: 10px; font-size: 12px; color: var(--theme-color, #5b8def); cursor: pointer; }.danger { color: #d86464 !important; }
.inner-overlay { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center; border-radius: 20px; background: rgba(0,0,0,.35); }
.structured-modal { position: relative; }.edit-modal { width: 82%; overflow: hidden; border-radius: 16px; background: var(--sys-bg-secondary, #fff); }.edit-title { padding: 20px 20px 14px; text-align: center; font-size: 16px; font-weight: 600; color: var(--text-primary, #222); }
.edit-input, .edit-textarea { display: block; box-sizing: border-box; width: calc(100% - 32px); margin: 0 16px 10px; border: 1px solid var(--border-color, #e5e5e5); border-radius: 10px; outline: 0; background: var(--sys-bg-primary, #f7f8fa); color: var(--text-primary, #222); font: inherit; font-size: 14px; padding: 10px 12px; }.edit-textarea { min-height: 110px; resize: none; line-height: 1.5; }
.confirm-actions { display: flex; margin-top: 14px; border-top: 1px solid rgba(0,0,0,.06); }.confirm-btn { flex: 1; padding: 13px; text-align: center; cursor: pointer; color: var(--text-secondary, #666); font-size: 14px; }.confirm-btn + .confirm-btn { border-left: 1px solid rgba(0,0,0,.06); }.confirm-btn.primary { color: var(--theme-color, #5b8def); font-weight: 600; }
.delete-desc { padding: 0 24px 12px; text-align: center; font-size: 13px; line-height: 1.5; color: var(--text-tertiary, #888); }
</style>
