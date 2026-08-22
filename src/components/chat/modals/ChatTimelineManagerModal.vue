/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useChatAuth } from '../../../composables/useChatAuth'
import {
  acceptTimelineReconstructionDraft,
  createCheckpoint,
  createTimeline,
  deleteCheckpoint,
  deleteTimeline,
  duplicateTimeline,
  ensureChatTimelineState,
  exportTimelineBundle,
  generateTimelineReconstructionDraft,
  getActiveTimeline,
  initializeChatTimeline,
  importTimelineBundle,
  permanentlyDeleteTrashItem,
  renameTimeline,
  restoreCheckpoint,
  restoreTrashItem,
  switchTimeline,
  updateCheckpointMeta,
  type TimelineDeleteMode,
  type TimelineRetention
} from '../../../services/chatTimeline'

const props = defineProps<{
  visible: boolean
  selectedChat: any
  forkMessageId?: number | string | null
  forkKind?: 'timeline' | 'checkpoint'
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save'): void
  (e: 'switched'): void
}>()

const { currentChatUserId } = useChatAuth()
const tab = ref<'timelines' | 'checkpoints' | 'trash' | 'settings'>('timelines')
const busy = ref(false)
const toast = ref('')
const showEditor = ref(false)
const editorKind = ref<'timeline' | 'checkpoint'>('timeline')
const editorMode = ref<'create' | 'rename'>('create')
const editorTargetId = ref('')
const editorName = ref('')
const editorNote = ref('')
const editorTags = ref('')
const editorBlank = ref(false)
const editorForkMessageId = ref<number | string | null>(null)
const deleteTarget = ref<{ kind: 'timeline' | 'checkpoint'; id: string; name: string } | null>(null)
const deleteMode = ref<TimelineDeleteMode>('trash')
const restoreTargetId = ref('')
const reconstructTargetId = ref('')
const reconstructionDraft = ref<any>(null)
const importInput = ref<HTMLInputElement | null>(null)

const manager = computed(() => ensureChatTimelineState(props.selectedChat))
const active = computed(() => getActiveTimeline(props.selectedChat))
const timelines = computed(() => [...manager.value.timelines].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.lastActiveAt - a.lastActiveAt))
const checkpoints = computed(() => [...manager.value.checkpoints].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt - a.createdAt))

let toastTimer: ReturnType<typeof setTimeout> | null = null
const notify = (message: string) => {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2200)
}

const close = () => emit('update:visible', false)
const formatTime = (value: number) => new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const persist = () => emit('save')
const run = async (action: () => Promise<any>, success: string) => {
  if (busy.value) return
  busy.value = true
  try {
    await action()
    persist()
    notify(success)
  } catch (error: any) {
    notify(error?.message || '操作失败')
  } finally {
    busy.value = false
  }
}

watch(() => props.visible, async visible => {
  if (!visible || !props.selectedChat) return
  await initializeChatTimeline(props.selectedChat, currentChatUserId.value)
  if (props.forkMessageId !== undefined && props.forkMessageId !== null) {
    if (props.forkKind === 'checkpoint') openCreateCheckpoint(props.forkMessageId)
    else openCreateTimeline(false, props.forkMessageId)
  }
}, { immediate: true })

const openCreateTimeline = (blank = false, messageId: number | string | null = null) => {
  editorKind.value = 'timeline'
  editorMode.value = 'create'
  editorTargetId.value = ''
  editorBlank.value = blank
  editorForkMessageId.value = messageId
  editorName.value = blank ? '重新认识' : (messageId !== null ? `从消息开启的分支` : `${active.value?.name || '主时间线'} · 分支`)
  editorNote.value = messageId !== null ? '从所选消息结束处开启' : ''
  editorTags.value = ''
  showEditor.value = true
}

const openCreateCheckpoint = (messageId: number | string | null = null) => {
  editorKind.value = 'checkpoint'
  editorMode.value = 'create'
  editorBlank.value = false
  editorForkMessageId.value = messageId
  editorName.value = `${new Date().toLocaleDateString('zh-CN')} 存档`
  editorNote.value = ''
  editorTags.value = ''
  showEditor.value = true
}

const openRenameTimeline = (item: any) => {
  editorKind.value = 'timeline'
  editorMode.value = 'rename'
  editorTargetId.value = item.id
  editorName.value = item.name
  editorNote.value = item.note || ''
  editorTags.value = (item.tags || []).join('、')
  showEditor.value = true
}

const openEditCheckpoint = (item: any) => {
  editorKind.value = 'checkpoint'
  editorMode.value = 'rename'
  editorTargetId.value = item.id
  editorName.value = item.name
  editorNote.value = item.note || ''
  editorTags.value = (item.tags || []).join('、')
  showEditor.value = true
}

const saveEditor = async () => {
  const tags = editorTags.value.split(/[、,，]/).map(item => item.trim()).filter(Boolean)
  if (editorKind.value === 'timeline') {
    if (editorMode.value === 'rename') {
      renameTimeline(props.selectedChat, editorTargetId.value, editorName.value)
      const meta = manager.value.timelines.find(item => item.id === editorTargetId.value)
      if (meta) { meta.note = editorNote.value.trim(); meta.tags = tags }
      showEditor.value = false
      persist()
      notify('时间线已更新')
      return
    }
    await run(() => createTimeline(props.selectedChat, currentChatUserId.value, {
      name: editorName.value,
      note: editorNote.value,
      fromMessageId: editorForkMessageId.value,
      blank: editorBlank.value,
      activate: true
    }), '已创建并切换时间线')
    showEditor.value = false
    emit('switched')
  } else {
    if (editorMode.value === 'rename') {
      updateCheckpointMeta(props.selectedChat, editorTargetId.value, { name: editorName.value.trim(), note: editorNote.value.trim(), tags })
      showEditor.value = false
      persist()
      notify('存档信息已更新')
      return
    }
    await run(() => createCheckpoint(props.selectedChat, currentChatUserId.value, {
      name: editorName.value, note: editorNote.value, tags, messageId: editorForkMessageId.value
    }), '存档已创建')
    showEditor.value = false
  }
}

const activateTimeline = (id: string) => run(async () => {
  await switchTimeline(props.selectedChat, currentChatUserId.value, id)
  emit('switched')
}, '已切换时间线')

const askDelete = (kind: 'timeline' | 'checkpoint', item: any) => {
  deleteTarget.value = { kind, id: item.id, name: item.name }
  deleteMode.value = manager.value.settings.deleteMode
}

const confirmDelete = async () => {
  const target = deleteTarget.value
  if (!target) return
  if (target.kind === 'timeline') await run(() => deleteTimeline(props.selectedChat, currentChatUserId.value, target.id, deleteMode.value), deleteMode.value === 'trash' ? '已移入最近删除' : '时间线已永久删除')
  else await run(() => deleteCheckpoint(props.selectedChat, currentChatUserId.value, target.id, deleteMode.value), deleteMode.value === 'trash' ? '已移入最近删除' : '存档已永久删除')
  deleteTarget.value = null
}

const restoreCheckpointWith = async (mode: 'branch' | 'replace') => {
  const id = restoreTargetId.value
  restoreTargetId.value = ''
  await run(async () => {
    await restoreCheckpoint(props.selectedChat, currentChatUserId.value, id, mode)
    emit('switched')
  }, mode === 'branch' ? '已从存档开启时间线' : '当前时间线已恢复')
}

const exportItem = async (kind: 'timeline' | 'checkpoint', item: any) => {
  await run(async () => {
    const bundle = await exportTimelineBundle(props.selectedChat, currentChatUserId.value, kind, item.id)
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${item.name || kind}.nrt-timeline.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, '已导出')
}

const importBundle = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  await run(async () => {
    const bundle = JSON.parse(await file.text())
    await importTimelineBundle(props.selectedChat, currentChatUserId.value, bundle)
  }, '已导入')
}

const setRetention = (days: TimelineRetention) => {
  manager.value.settings.retentionDays = days
  persist()
}

const generateReconstruction = async () => {
  const id = reconstructTargetId.value
  await run(async () => {
    reconstructionDraft.value = await generateTimelineReconstructionDraft(props.selectedChat, currentChatUserId.value, id)
  }, '重建草稿已生成')
}

const acceptReconstruction = async () => {
  const id = reconstructTargetId.value
  await run(() => acceptTimelineReconstructionDraft(props.selectedChat, currentChatUserId.value, id), '重建状态已采用')
  reconstructTargetId.value = ''
  reconstructionDraft.value = null
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay timeline-overlay" @click.self="close">
    <div class="timeline-modal">
      <div class="timeline-header">
        <div class="timeline-close" @click="close">‹</div>
        <div><h3>时间线与存档</h3><p>{{ selectedChat?.name }} · 当前：{{ active?.name }}</p></div>
        <div class="timeline-import" title="导入" @click="importInput?.click()">⇩</div><div class="timeline-add" @click="tab === 'checkpoints' ? openCreateCheckpoint() : openCreateTimeline()">＋</div>
        <input ref="importInput" class="hidden-import" type="file" accept=".json,.nrt-timeline.json" @change="importBundle">
      </div>

      <div class="timeline-tabs">
        <div :class="{ active: tab === 'timelines' }" @click="tab = 'timelines'">时间线</div>
        <div :class="{ active: tab === 'checkpoints' }" @click="tab = 'checkpoints'">存档</div>
        <div :class="{ active: tab === 'trash' }" @click="tab = 'trash'">最近删除</div>
        <div :class="{ active: tab === 'settings' }" @click="tab = 'settings'">设置</div>
      </div>

      <div class="timeline-body">
        <template v-if="tab === 'timelines'">
          <div class="timeline-quick-actions">
            <div class="soft-action" @click="openCreateTimeline()"><span>＋</span><div><b>从当前进度分支</b><small>保留此刻完整剧情状态</small></div></div>
            <div class="soft-action" @click="openCreateTimeline(true)"><span>↺</span><div><b>空白重开</b><small>保留角色基础设定</small></div></div>
          </div>
          <div v-for="item in timelines" :key="item.id" class="timeline-card" :class="{ current: item.id === manager.activeTimelineId }">
            <div class="timeline-card-main" @click="item.id !== manager.activeTimelineId && activateTimeline(item.id)">
              <span class="timeline-dot"></span>
              <div class="timeline-copy">
                <div class="timeline-name"><b>{{ item.name }}</b><i v-if="item.id === manager.activeTimelineId">当前</i><i v-if="item.favorite">收藏</i><i v-if="item.needsReview" class="review">状态待确认</i></div>
                <p>{{ item.note || (item.parentTimelineId ? '从其他时间线分出' : '角色的起始时间线') }}</p>
                <small>{{ item.messageCount }} 条消息 · {{ item.relationshipLabel }} · {{ formatTime(item.updatedAt) }}</small>
              </div>
            </div>
            <div class="timeline-actions">
              <div @click="openRenameTimeline(item)">编辑</div>
              <div @click="item.favorite = !item.favorite; persist()">{{ item.favorite ? '取消收藏' : '收藏' }}</div>
              <div @click="duplicateTimeline(selectedChat, currentChatUserId, item.id).then(() => { persist(); notify('已创建副本') })">复制</div>
              <div @click="exportItem('timeline', item)">导出</div>
              <div v-if="item.needsReview" @click="reconstructTargetId = item.id; reconstructionDraft = item.reconstructionDraft || null">重建</div>
              <div class="danger-text" @click="askDelete('timeline', item)">删除</div>
            </div>
          </div>
        </template>

        <template v-else-if="tab === 'checkpoints'">
          <div v-if="!checkpoints.length" class="timeline-empty"><b>还没有存档</b><p>存档会固定保存某一刻；恢复时可以开新时间线，也可以回退当前时间线。</p><div class="primary-soft-btn" @click="openCreateCheckpoint()">创建存档</div></div>
          <div v-for="item in checkpoints" :key="item.id" class="timeline-card checkpoint-card">
            <div class="timeline-card-main">
              <span class="checkpoint-icon">◇</span>
              <div class="timeline-copy">
                <div class="timeline-name"><b>{{ item.name }}</b><i v-if="item.locked">已锁定</i><i v-if="item.favorite">收藏</i></div>
                <p>{{ item.note || manager.timelines.find(line => line.id === item.timelineId)?.name || '时间线存档' }}</p>
                <small>{{ formatTime(item.createdAt) }}<template v-if="item.tags.length"> · {{ item.tags.join(' / ') }}</template></small>
              </div>
            </div>
            <div class="timeline-actions">
              <div @click="restoreTargetId = item.id">恢复</div>
              <div @click="openEditCheckpoint(item)">编辑</div>
              <div @click="updateCheckpointMeta(selectedChat, item.id, { favorite: !item.favorite }); persist()">{{ item.favorite ? '取消收藏' : '收藏' }}</div>
              <div @click="updateCheckpointMeta(selectedChat, item.id, { locked: !item.locked }); persist()">{{ item.locked ? '解锁' : '锁定' }}</div>
              <div @click="exportItem('checkpoint', item)">导出</div>
              <div class="danger-text" :class="{ disabled: item.locked }" @click="!item.locked && askDelete('checkpoint', item)">删除</div>
            </div>
          </div>
        </template>

        <template v-else-if="tab === 'trash'">
          <div v-if="!manager.trash.length" class="timeline-empty"><b>最近删除为空</b><p>选择“移入最近删除”的时间线和存档会出现在这里。</p></div>
          <div v-for="item in manager.trash" :key="item.id" class="timeline-card trash-card">
            <div class="timeline-card-main"><span class="checkpoint-icon">×</span><div class="timeline-copy"><div class="timeline-name"><b>{{ item.name }}</b><i>{{ item.kind === 'timeline' ? '时间线' : '存档' }}</i></div><p>删除于 {{ formatTime(item.deletedAt) }}</p><small>{{ item.expiresAt ? `${formatTime(item.expiresAt)} 后清理` : '永久保留，直到手动清理' }}</small></div></div>
            <div class="timeline-actions"><div @click="run(() => restoreTrashItem(selectedChat, currentChatUserId, item.id), '已恢复')">恢复</div><div class="danger-text" @click="run(() => permanentlyDeleteTrashItem(selectedChat, currentChatUserId, item.id), '已永久删除')">永久删除</div></div>
          </div>
        </template>

        <template v-else>
          <div class="glass-panel timeline-settings">
            <div class="glass-list-item"><div><div class="item-label">回退前安全存档</div><div class="setting-desc">覆盖恢复前自动保存当前状态</div></div><label class="switch"><input v-model="manager.settings.autoSafetyCheckpoint" type="checkbox" @change="persist"><span class="slider"></span></label></div>
            <div class="glass-list-item"><div><div class="item-label">默认删除方式</div><div class="setting-desc">删除确认时仍可临时更改</div></div><div class="segmented"><span :class="{ active: manager.settings.deleteMode === 'trash' }" @click="manager.settings.deleteMode = 'trash'; persist()">最近删除</span><span :class="{ active: manager.settings.deleteMode === 'permanent' }" @click="manager.settings.deleteMode = 'permanent'; persist()">永久</span></div></div>
            <div class="glass-list-item setting-column"><div><div class="item-label">最近删除保留时间</div><div class="setting-desc">到期后自动永久清理</div></div><div class="choice-row"><span v-for="choice in [{v:7,l:'7天'},{v:30,l:'30天'},{v:90,l:'90天'},{v:-1,l:'永久'}]" :key="choice.v" :class="{ active: manager.settings.retentionDays === choice.v }" @click="setRetention(choice.v as TimelineRetention)">{{ choice.l }}</span></div></div>
            <div class="glass-list-item setting-column"><div><div class="item-label">角色设定修改范围</div><div class="setting-desc">编辑人设、头像、声音或世界书时使用</div></div><div class="choice-row"><span :class="{ active: manager.settings.roleEditScope === 'current' }" @click="manager.settings.roleEditScope = 'current'; persist()">当前时间线</span><span :class="{ active: manager.settings.roleEditScope === 'all' }" @click="manager.settings.roleEditScope = 'all'; persist()">全部时间线</span></div></div>
          </div>
          <div class="timeline-note">未激活时间线会完全冻结。聊天、长期记忆、关系、朋友圈、钱包和群聊剧情均随当前时间线切换。</div>
        </template>
      </div>

      <div v-if="toast" class="timeline-toast">{{ toast }}</div>
      <div v-if="busy" class="timeline-busy"><span></span></div>
    </div>

    <div v-if="showEditor" class="nested-overlay" @click.self="showEditor = false">
      <div class="custom-confirm-modal timeline-editor">
        <div class="confirm-title">{{ editorMode === 'rename' ? '编辑信息' : (editorKind === 'timeline' ? (editorBlank ? '空白重开' : '创建时间线') : '创建存档') }}</div>
        <div class="editor-field"><label>名称</label><input v-model="editorName" maxlength="40" placeholder="输入名称"></div>
        <div class="editor-field"><label>备注</label><textarea v-model="editorNote" maxlength="200" placeholder="记录这条路线的重要信息"></textarea></div>
        <div class="editor-field"><label>标签</label><input v-model="editorTags" maxlength="80" placeholder="用逗号分隔"></div>
        <div v-if="editorForkMessageId !== null" class="editor-tip">将从所选消息结束处保存状态，之后发生的内容不会进入新路线。</div>
        <div v-if="editorBlank" class="editor-tip">角色基础设定会保留；消息、记忆、关系和跨应用剧情会重新开始。</div>
        <div class="confirm-actions"><div class="confirm-btn cancel" @click="showEditor = false">取消</div><div class="confirm-btn" @click="saveEditor">确认</div></div>
      </div>
    </div>

    <div v-if="deleteTarget" class="nested-overlay" @click.self="deleteTarget = null">
      <div class="custom-confirm-modal">
        <div class="confirm-title">删除“{{ deleteTarget.name }}”</div>
        <div class="delete-choice" :class="{ active: deleteMode === 'trash' }" @click="deleteMode = 'trash'"><span></span><div><b>移入最近删除</b><small>可以在保留期内恢复</small></div></div>
        <div class="delete-choice" :class="{ active: deleteMode === 'permanent' }" @click="deleteMode = 'permanent'"><span></span><div><b>永久删除</b><small>相关消息、记忆和剧情状态无法恢复</small></div></div>
        <div class="confirm-actions"><div class="confirm-btn cancel" @click="deleteTarget = null">取消</div><div class="confirm-btn danger" @click="confirmDelete">确认删除</div></div>
      </div>
    </div>

    <div v-if="restoreTargetId" class="nested-overlay" @click.self="restoreTargetId = ''">
      <div class="custom-confirm-modal">
        <div class="confirm-title">恢复存档</div>
        <div class="confirm-desc">选择如何使用这份存档。覆盖恢复前会按照设置创建安全存档。</div>
        <div class="restore-actions"><div @click="restoreCheckpointWith('branch')"><b>开启新时间线</b><small>保留当前路线</small></div><div @click="restoreCheckpointWith('replace')"><b>回退当前时间线</b><small>恢复为存档状态</small></div></div>
        <div class="confirm-actions"><div class="confirm-btn cancel full" @click="restoreTargetId = ''">取消</div></div>
      </div>
    </div>

    <div v-if="reconstructTargetId" class="nested-overlay" @click.self="reconstructTargetId = ''; reconstructionDraft = null">
      <div class="custom-confirm-modal reconstruction-modal">
        <div class="confirm-title">重建历史状态</div>
        <template v-if="!reconstructionDraft">
          <div class="confirm-desc">模型将读取分支点之前的历史消息，生成关系、钱包和社交状态草稿。此操作可能产生 API 费用，生成后需由你确认才会采用。</div>
          <div class="confirm-actions"><div class="confirm-btn cancel" @click="reconstructTargetId = ''">取消</div><div class="confirm-btn" @click="generateReconstruction">生成草稿</div></div>
        </template>
        <template v-else>
          <div class="reconstruction-list"><p><b>关系阶段</b>{{ reconstructionDraft.relationshipStage }}</p><p><b>关系与事件</b>{{ reconstructionDraft.relationshipSummary }}</p><p><b>钱包</b>{{ reconstructionDraft.walletSummary }}</p><p><b>社交</b>{{ reconstructionDraft.socialSummary }}</p><p v-if="reconstructionDraft.uncertain?.length"><b>无法确定</b>{{ reconstructionDraft.uncertain.join('、') }}</p></div>
          <div class="confirm-actions"><div class="confirm-btn cancel" @click="reconstructTargetId = ''; reconstructionDraft = null">暂不采用</div><div class="confirm-btn" @click="acceptReconstruction">确认采用</div></div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';
.timeline-overlay{z-index:12000;padding:0;background:rgba(18,18,24,.36);backdrop-filter:blur(10px)}
.timeline-modal{width:min(100%,520px);height:min(92vh,760px);background:var(--bg-primary,#f6f6f8);border-radius:22px 22px 0 0;position:absolute;bottom:0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -20px 60px rgba(0,0,0,.16)}
.timeline-header{display:flex;align-items:center;gap:12px;padding:18px 18px 12px;background:var(--bg-primary,#f6f6f8)}
.timeline-header h3{font-size:18px;margin:0;color:var(--text-primary,#222)}.timeline-header p{font-size:11px;margin:3px 0 0;color:var(--text-tertiary,#999)}
.timeline-close,.timeline-add,.timeline-import{width:34px;height:34px;border-radius:12px;background:var(--glass-bg,rgba(255,255,255,.8));display:flex;align-items:center;justify-content:center;font-size:25px;color:var(--text-secondary,#666);cursor:pointer}.timeline-import{margin-left:auto;font-size:18px}.timeline-add{font-size:22px}.hidden-import{display:none}
.timeline-tabs{display:grid;grid-template-columns:repeat(4,1fr);padding:0 16px 12px;gap:5px}.timeline-tabs div{padding:9px 3px;text-align:center;font-size:12px;color:var(--text-tertiary,#888);border-radius:10px;cursor:pointer}.timeline-tabs .active{background:var(--glass-bg,rgba(255,255,255,.88));color:var(--text-primary,#222);font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.05)}
.timeline-body{flex:1;overflow:auto;padding:2px 16px 28px}.timeline-quick-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0 14px}.soft-action{display:flex;gap:9px;align-items:center;padding:13px;background:var(--glass-bg,rgba(255,255,255,.72));border:1px solid var(--border-color,rgba(0,0,0,.05));border-radius:15px;cursor:pointer}.soft-action>span{font-size:21px;color:#8f7cff}.soft-action b{font-size:12px;color:var(--text-primary,#333);display:block}.soft-action small{font-size:9px;color:var(--text-tertiary,#999)}
.timeline-card{background:var(--glass-bg,rgba(255,255,255,.78));border:1px solid var(--border-color,rgba(0,0,0,.05));border-radius:16px;margin-bottom:10px;overflow:hidden}.timeline-card.current{border-color:rgba(143,124,255,.38);box-shadow:0 7px 24px rgba(143,124,255,.08)}.timeline-card-main{display:flex;gap:12px;padding:14px;cursor:pointer}.timeline-dot{width:11px;height:11px;border:2px solid #aaa;border-radius:50%;margin-top:5px;flex:none}.current .timeline-dot{border-color:#8f7cff;background:#8f7cff;box-shadow:0 0 0 4px rgba(143,124,255,.12)}.checkpoint-icon{width:24px;font-size:23px;color:#8f7cff;flex:none;text-align:center}.timeline-copy{min-width:0;flex:1}.timeline-name{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.timeline-name b{font-size:14px;color:var(--text-primary,#222)}.timeline-name i{font-style:normal;font-size:9px;padding:2px 6px;border-radius:8px;background:rgba(143,124,255,.1);color:#7561dc}.timeline-name i.review{background:rgba(255,166,0,.12);color:#c78000}.timeline-copy p{font-size:11px;color:var(--text-secondary,#777);margin:5px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.timeline-copy small{font-size:9px;color:var(--text-tertiary,#aaa)}
.timeline-actions{display:flex;border-top:1px solid var(--border-color,rgba(0,0,0,.05));overflow:auto}.timeline-actions div{flex:1;min-width:54px;text-align:center;padding:9px 5px;font-size:10px;color:var(--text-secondary,#666);cursor:pointer}.timeline-actions .danger-text{color:#e05b63}.timeline-actions .disabled{opacity:.35;pointer-events:none}
.timeline-empty{text-align:center;padding:60px 25px;color:var(--text-secondary,#777)}.timeline-empty b{font-size:15px;color:var(--text-primary,#333)}.timeline-empty p{font-size:11px;line-height:1.6}.primary-soft-btn{display:inline-block;margin-top:10px;padding:10px 22px;border-radius:12px;background:#8f7cff;color:white;font-size:12px;cursor:pointer}
.timeline-settings{margin-top:8px}.setting-desc{font-size:9px;color:var(--text-tertiary,#999);margin-top:3px}.setting-column{align-items:flex-start!important;flex-direction:column;gap:12px}.segmented,.choice-row{display:flex;gap:5px;background:rgba(127,127,127,.08);padding:3px;border-radius:10px}.segmented span,.choice-row span{padding:6px 10px;border-radius:8px;font-size:10px;color:var(--text-secondary,#777);cursor:pointer}.segmented span.active,.choice-row span.active{background:var(--glass-bg,#fff);color:#7561dc;box-shadow:0 2px 8px rgba(0,0,0,.06)}.timeline-note{font-size:10px;line-height:1.6;color:var(--text-tertiary,#999);padding:15px}
.timeline-toast{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);padding:9px 15px;border-radius:14px;background:rgba(30,30,34,.86);color:#fff;font-size:11px;z-index:8}.timeline-busy{position:absolute;inset:0;background:rgba(255,255,255,.16);z-index:7}.timeline-busy span{position:absolute;left:50%;top:50%;width:24px;height:24px;border:2px solid rgba(143,124,255,.2);border-top-color:#8f7cff;border-radius:50%;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.nested-overlay{position:fixed;inset:0;background:rgba(0,0,0,.24);display:flex;align-items:center;justify-content:center;z-index:13000;backdrop-filter:blur(6px)}.timeline-editor{width:min(86vw,360px)}.editor-field{text-align:left;margin:13px 0}.editor-field label{display:block;font-size:10px;color:var(--text-tertiary,#888);margin-bottom:6px}.editor-field input,.editor-field textarea{box-sizing:border-box;width:100%;border:1px solid var(--border-color,rgba(0,0,0,.08));background:var(--input-bg,rgba(127,127,127,.06));border-radius:12px;padding:10px 12px;color:var(--text-primary,#222);font:inherit;outline:none}.editor-field textarea{height:74px;resize:none}.editor-field input:focus,.editor-field textarea:focus{border-color:rgba(143,124,255,.55);box-shadow:0 0 0 3px rgba(143,124,255,.08)}.editor-tip{font-size:10px;line-height:1.55;color:var(--text-tertiary,#888);text-align:left;background:rgba(143,124,255,.07);padding:9px 11px;border-radius:10px;margin-bottom:12px}
.delete-choice{display:flex;text-align:left;gap:10px;padding:12px;border:1px solid var(--border-color,rgba(0,0,0,.08));border-radius:13px;margin:9px 0;cursor:pointer}.delete-choice>span{width:12px;height:12px;border:2px solid #aaa;border-radius:50%;margin-top:2px}.delete-choice.active{border-color:rgba(143,124,255,.5);background:rgba(143,124,255,.05)}.delete-choice.active>span{border-color:#8f7cff;background:#8f7cff}.delete-choice b,.restore-actions b{font-size:12px;color:var(--text-primary,#333);display:block}.delete-choice small,.restore-actions small{font-size:9px;color:var(--text-tertiary,#999)}.restore-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:16px 0}.restore-actions>div{padding:13px;border:1px solid var(--border-color,rgba(0,0,0,.08));border-radius:13px;cursor:pointer}.confirm-btn.full{width:100%}
.reconstruction-modal{max-height:80vh;overflow:auto}.reconstruction-list{text-align:left}.reconstruction-list p{font-size:10px;line-height:1.6;padding:8px 10px;margin:7px 0;background:rgba(127,127,127,.06);border-radius:10px;color:var(--text-secondary,#666)}.reconstruction-list b{display:block;font-size:11px;color:var(--text-primary,#333);margin-bottom:2px}
@media(min-width:600px){.timeline-modal{position:relative;bottom:auto;border-radius:22px;height:min(86vh,760px)}}
</style>
