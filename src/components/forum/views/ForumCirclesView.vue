/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ForumCircle } from '../../../types/forum'
import ForumHeader from '../components/ForumHeader.vue'
import ForumEmptyState from '../components/ForumEmptyState.vue'
import ForumCircleCreateModal from '../modals/ForumCircleCreateModal.vue'

const props = defineProps<{
  circles: ForumCircle[]
  activeAccountId: string
  memberships: Array<{ circleId: string; accountId: string; role: string }>
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'open', circle: ForumCircle): void
  (e: 'join', id: string): void
  (e: 'create', value: Pick<ForumCircle, 'name'|'avatar'|'description'|'contentScope'|'tags'|'joinMode'|'anonymousMode'|'contentPermissions'|'mediaPermissions'|'searchable'|'isPublic'>): void
  (e: 'delete-circles', circleIds: string[]): void
}>()

const mode = ref<'mine' | 'discover'>('mine')
const creating = ref(false)
const isSelecting = ref(false)
const selectedCircleIds = ref<string[]>([])
const showDeleteConfirm = ref(false)


const mine = computed(() => new Set(props.memberships.filter(item => item.accountId === props.activeAccountId && !['pending', 'banned'].includes(item.role)).map(item => item.circleId)))
const display = computed(() => mode.value === 'mine' ? props.circles.filter(item => mine.value.has(item.id)) : props.circles.filter(item => item.searchable && !mine.value.has(item.id)))

const allDisplayedSelected = computed(() => display.value.length > 0 && display.value.every(circle => selectedCircleIds.value.includes(circle.id)))

const enterSelection = () => {
  isSelecting.value = true
  selectedCircleIds.value = []
  creating.value = false
}

const exitSelection = () => {
  isSelecting.value = false
  selectedCircleIds.value = []
  showDeleteConfirm.value = false
}

const toggleCircle = (circleId: string) => {
  selectedCircleIds.value = selectedCircleIds.value.includes(circleId)
    ? selectedCircleIds.value.filter(id => id !== circleId)
    : [...selectedCircleIds.value, circleId]
}

const toggleSelectAll = () => {
  const displayedIds = display.value.map(circle => circle.id)
  if (allDisplayedSelected.value) {
    selectedCircleIds.value = selectedCircleIds.value.filter(id => !displayedIds.includes(id))
  } else {
    selectedCircleIds.value = [...new Set([...selectedCircleIds.value, ...displayedIds])]
  }
}

const handleCircleClick = (circle: ForumCircle) => {
  if (isSelecting.value) {
    toggleCircle(circle.id)
    return
  }
  emit('open', circle)
}

const confirmDelete = () => {
  if (!selectedCircleIds.value.length) return
  emit('delete-circles', [...selectedCircleIds.value])
  exitSelection()
}


watch(mode, () => {
  if (isSelecting.value) selectedCircleIds.value = []
})

watch(() => props.circles.map(c => c.id), circleIds => {
  const existingIds = new Set(circleIds)
  selectedCircleIds.value = selectedCircleIds.value.filter(id => existingIds.has(id))
})
</script>

<template>
  <div class="circles-view">
    <ForumHeader :title="isSelecting ? `已选 ${selectedCircleIds.length} 个圈子` : '圈子'" :show-back="!isSelecting" @back="emit('back')">
      <template v-if="isSelecting" #left>
        <button class="head-text-btn" type="button" @click="exitSelection">取消</button>
      </template>
      <template #right>
        <template v-if="isSelecting">
          <button class="head-text-btn" type="button" :disabled="display.length === 0" @click="toggleSelectAll">
            {{ allDisplayedSelected ? '取消全选' : '全选' }}
          </button>
        </template>
        <template v-else>
          <div class="header-right-actions">
            <button v-if="mode === 'mine' && display.length > 0" class="manage-btn" type="button" aria-label="批量管理圈子" title="批量管理圈子" @click="enterSelection">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3"></rect>
                <path d="m7.5 12 3 3 6-7"></path>
              </svg>
            </button>
            <button class="head-text-btn" type="button" @click="creating = !creating">{{ creating ? '取消' : '创建' }}</button>
          </div>
        </template>
      </template>
    </ForumHeader>

    <div v-if="!isSelecting" class="segment">
      <button :class="{ active: mode === 'mine' }" type="button" @click="mode = 'mine'">我的圈子</button>
      <button :class="{ active: mode === 'discover' }" type="button" @click="mode = 'discover'">发现</button>
    </div>

    <div class="circle-scroll">
      <div
        v-for="circle in display"
        :key="circle.id"
        class="circle-row"
        :class="{ 'is-selecting': isSelecting, 'is-selected': selectedCircleIds.includes(circle.id) }"
        role="button"
        tabindex="0"
        @click="handleCircleClick(circle)"
        @keyup.enter="handleCircleClick(circle)"
      >
        <span v-if="isSelecting" class="circle-selection-checkbox" aria-hidden="true">
          <svg v-if="selectedCircleIds.includes(circle.id)" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"></path></svg>
        </span>
        <span class="circle-avatar"><img v-if="circle.avatar.includes(':')" :src="circle.avatar"/><template v-else>{{ circle.avatar || circle.name.slice(0, 1) }}</template></span>
        <span class="circle-copy">
          <b>{{ circle.name }}</b>
          <small>{{ circle.description || '暂无简介' }}</small>
          <em>{{ circle.memberCount }} 人 · {{ circle.tags.slice(0, 2).join(' / ') || '综合' }}</em>
        </span>
        <template v-if="!isSelecting">
          <button v-if="mode === 'discover'" class="join-btn" type="button" @click.stop="emit('join', circle.id)">加入</button>
          <i v-else>›</i>
        </template>
      </div>
      <ForumEmptyState
        v-if="!display.length"
        :title="mode === 'mine' ? '还没有加入圈子' : '暂无可发现圈子'"
        :description="mode === 'mine' ? '创建或加入一个感兴趣的圈子吧' : '隐藏圈和邀请圈不会出现在这里'"
      />
    </div>

    <!-- 底部操作栏 -->
    <transition name="slide-up">
      <div v-if="isSelecting" class="selection-toolbar">
        <div class="toolbar-info">
          <span class="info-label">已选择</span>
          <strong class="info-count">{{ selectedCircleIds.length }}</strong>
          <span class="info-unit">个圈子</span>
        </div>
        <div class="toolbar-actions">
          <button
            class="delete-btn"
            type="button"
            :disabled="selectedCircleIds.length === 0"
            @click="showDeleteConfirm = true"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            <span>删除 / 退出所选{{ selectedCircleIds.length > 0 ? ` (${selectedCircleIds.length})` : '' }}</span>
          </button>
        </div>
      </div>
    </transition>

    <!-- 自定义确认弹窗 -->
    <div v-if="showDeleteConfirm" class="delete-confirm-overlay" @click.self="showDeleteConfirm = false">
      <section role="alertdialog" aria-modal="true" aria-labelledby="circle-delete-title">
        <h2 id="circle-delete-title">确定移除所选的 {{ selectedCircleIds.length }} 个圈子？</h2>
        <p>自建的圈子将被解散并清理圈内内容，已加入的圈子将自动退出。</p>
        <div>
          <button type="button" @click="showDeleteConfirm = false">取消</button>
          <button class="danger" type="button" @click="confirmDelete">确定移除</button>
        </div>
      </section>
    </div>
    <ForumCircleCreateModal :visible="creating" @close="creating=false" @create="value=>{emit('create',value);creating=false}"/>
  </div>
</template>

<style scoped>
.circles-view {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--sys-bg-primary, #f5f5f7);
}

.header-right-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.manage-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-primary, #333333);
  cursor: pointer;
}

.manage-btn:active {
  background: var(--sys-bg-tertiary, #f0f0f0);
  transform: scale(0.92);
}

.head-text-btn {
  border: 0;
  background: transparent;
  color: var(--accent-color, #2b7de9);
  font: inherit;
  font-size: 13px;
  padding: 6px 4px;
  cursor: pointer;
  white-space: nowrap;
}

.head-text-btn:disabled {
  opacity: 0.4;
}

.segment {
  display: flex;
  gap: 3px;
  padding: 7px 12px;
  background: var(--sys-bg-secondary, #fff);
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.segment button {
  flex: 1;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary, #777);
  font-size: 13px;
  cursor: pointer;
}

.segment button.active {
  background: var(--sys-bg-tertiary, #f0f1f3);
  color: var(--text-primary, #222);
  font-weight: 600;
}

.create-strip {
  display: grid;
  grid-template-columns: minmax(72px, 0.7fr) minmax(90px, 1.3fr) auto;
  gap: 7px;
  padding: 9px 12px;
  background: var(--sys-bg-secondary, #fff);
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.create-strip input {
  min-width: 0;
  height: 32px;
  border: 1px solid var(--border-color, #e5e5e5);
  border-radius: 8px;
  background: var(--sys-bg-primary, #f7f7f8);
  padding: 0 8px;
  color: var(--text-primary, #222);
  font: inherit;
  font-size: 12px;
  outline: 0;
}

.create-strip button {
  border: 0;
  border-radius: 8px;
  background: var(--accent-color, #2b7de9);
  color: #fff;
  padding: 0 10px;
  font-size: 12px;
  cursor: pointer;
}

.create-strip button:disabled {
  opacity: 0.35;
}

.circle-scroll {
  flex: 1;
  overflow: auto;
  background: var(--sys-bg-secondary, #fff);
}

.circle-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 11px;
  padding: 12px 16px;
  border: 0;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.055));
  background: transparent;
  text-align: left;
  color: var(--text-primary, #222);
  cursor: pointer;
  box-sizing: border-box;
  transition: background-color 0.15s ease;
}

.circle-row.is-selecting {
  user-select: none;
}

.circle-row.is-selected {
  background: color-mix(in srgb, var(--accent-color, #2b7de9) 8%, var(--sys-bg-secondary, #ffffff));
}

.circle-selection-checkbox {
  display: inline-flex;
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1.8px solid var(--border-color, #c0c4cc);
  border-radius: 50%;
  background: var(--sys-bg-secondary, #fff);
  color: #fff;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.circle-row.is-selected .circle-selection-checkbox {
  border-color: var(--accent-color, #2b7de9);
  background: var(--accent-color, #2b7de9);
  transform: scale(1.05);
  box-shadow: 0 2px 6px rgba(43, 125, 233, 0.28);
}

.circle-avatar {
  display: flex;
  overflow: hidden;
  flex: 0 0 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--sys-bg-tertiary, #eceef1);
  font-size: 15px;
  font-weight: 650;
}
.circle-avatar img{width:100%;height:100%;object-fit:cover}

.circle-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.circle-copy b {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.circle-copy small {
  font-size: 12px;
  color: var(--text-secondary, #777);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.circle-copy em {
  font-size: 10.5px;
  color: var(--text-tertiary, #999);
  font-style: normal;
}

.circle-row > i {
  flex-shrink: 0;
  color: var(--text-tertiary, #aaa);
  font-size: 20px;
  font-style: normal;
}

.join-btn {
  flex: 0 0 auto;
  height: 27px;
  border: 1px solid var(--accent-color, #2b7de9);
  border-radius: 999px;
  background: transparent;
  color: var(--accent-color, #2b7de9);
  padding: 0 11px;
  font-size: 12px;
  cursor: pointer;
}

.selection-toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 56px;
  padding: 8px 16px calc(8px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  background: var(--sys-bg-secondary, #ffffff);
  box-shadow: 0 -4px 18px rgba(0, 0, 0, 0.05);
  z-index: 50;
}

.toolbar-info {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: var(--text-secondary, #666666);
  font-size: 13px;
}

.info-label {
  font-size: 13px;
}

.info-count {
  font-size: 16px;
  font-weight: 700;
  color: var(--accent-color, #2b7de9);
}

.info-unit {
  font-size: 13px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  background: #e04b4b;
  color: #ffffff;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 8px rgba(224, 75, 75, 0.25);
}

.delete-btn:active:not(:disabled) {
  transform: scale(0.96);
  background: #c93b3b;
}

.delete-btn:disabled {
  opacity: 0.4;
  box-shadow: none;
  cursor: not-allowed;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.delete-confirm-overlay {
  position: absolute;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.34);
}

.delete-confirm-overlay section {
  width: min(100%, 320px);
  box-sizing: border-box;
  border-radius: 16px;
  background: var(--sys-bg-secondary, #fff);
  padding: 20px;
  text-align: center;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18);
}

.delete-confirm-overlay h2 {
  margin: 0;
  color: var(--text-primary, #222);
  font-size: 16px;
}

.delete-confirm-overlay p {
  margin: 10px 0 18px;
  color: var(--text-secondary, #777);
  font-size: 12px;
  line-height: 1.55;
}

.delete-confirm-overlay section div {
  display: flex;
  gap: 10px;
}

.delete-confirm-overlay button {
  flex: 1;
  height: 38px;
  border: 0;
  border-radius: 10px;
  background: var(--sys-bg-tertiary, #f0f0f0);
  color: var(--text-primary, #333);
  font-size: 13px;
  cursor: pointer;
}

.delete-confirm-overlay button.danger {
  background: #d94b4b;
  color: #fff;
}

@media (max-width: 340px) {
  .create-strip {
    grid-template-columns: 1fr auto;
  }
  .create-strip input:nth-child(2) {
    grid-column: 1/2;
  }
  .circle-row {
    padding-left: 12px;
    padding-right: 12px;
  }
}
</style>
