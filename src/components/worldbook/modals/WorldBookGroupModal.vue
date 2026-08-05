<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed } from 'vue'
import type { WorldBookGroup } from '../../../store'

const props = defineProps<{
  show: boolean
  worldBookGroups: WorldBookGroup[]
  groupModalState: {
    newGroupName: string
    editGroupId: string | null
    editGroupName: string
    isManageMode: boolean
    selectedGroups: Set<string>
  }
  isAllGroupsSelected: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'update:newGroupName', value: string): void
  (e: 'update:editGroupName', value: string): void
  (e: 'update:editGroupId', value: string | null): void
  (e: 'toggleGroupManageMode'): void
  (e: 'toggleGroupSelect', id: string): void
  (e: 'toggleSelectAllGroups'): void
  (e: 'deleteSelectedGroups'): void
  (e: 'addGroup'): void
  (e: 'startEditGroup', group: WorldBookGroup): void
  (e: 'saveEditGroup'): void
  (e: 'deleteGroup', id: string): void
}>()

const newGroupName = computed({
  get: () => props.groupModalState.newGroupName,
  set: (val) => emit('update:newGroupName', val)
})

const editGroupName = computed({
  get: () => props.groupModalState.editGroupName,
  set: (val) => emit('update:editGroupName', val)
})

const close = () => {
  emit('update:show', false)
}
</script>

<template>
  <transition name="fade">
    <div v-if="show" class="modal-mask clean-mask" @click="close">
      <div class="modal-box clean-box tag-manager-panel" style="max-height: 80vh; overflow: hidden; position: relative;" @click.stop>
        <div class="panel-header">
          <div class="panel-title">分组管理</div>
          <div style="display: flex; gap: 12px; align-items: center;">
            <div v-if="worldBookGroups.length > 0" class="btn-settings" style="margin: 0; padding: 4px 10px; font-size: 12px; background: rgba(0,0,0,0.05);" @click="emit('toggleGroupManageMode')">
              {{ groupModalState.isManageMode ? '完成' : '批量管理' }}
            </div>
            <div class="panel-close" @click="close">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
          </div>
        </div>
        
        <div class="panel-body" style="overflow-y: auto; padding-bottom: 80px;">
          <div class="t-input-group" v-if="!groupModalState.isManageMode">
            <div class="t-input-row">
              <input v-model="newGroupName" class="t-input" placeholder="新建分组名称..." @keydown.enter="emit('addGroup')"/>
              <button class="t-add-btn" @click="emit('addGroup')" :disabled="!newGroupName.trim()">添加</button>
            </div>
          </div>

          <div class="t-list-header mt-4" v-if="worldBookGroups.length > 0">
            <div class="t-list-title">已有分组 ({{ worldBookGroups.length }})</div>
          </div>

          <div class="t-list-container mt-2">
            <div v-if="worldBookGroups.length === 0" class="t-empty-state">暂无自定义分组</div>
            <div class="group-list" v-else>
              <div 
                v-for="grp in worldBookGroups" 
                :key="grp.id" 
                class="group-list-item"
                :class="{ 'is-selected': groupModalState.selectedGroups.has(grp.id) }"
                @click="groupModalState.isManageMode && emit('toggleGroupSelect', grp.id)"
                :style="groupModalState.isManageMode ? 'cursor: pointer;' : ''"
              >
                <div v-if="groupModalState.isManageMode" class="ch-checkbox">
                  <div class="ch-chk-inner" :class="{ checked: groupModalState.selectedGroups.has(grp.id) }">
                    <svg v-if="groupModalState.selectedGroups.has(grp.id)" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                </div>
                
                <div v-if="!groupModalState.isManageMode && groupModalState.editGroupId === grp.id" style="flex: 1; display: flex; gap: 8px;">
                  <input v-model="editGroupName" class="t-input small-input" style="flex: 1;" @keydown.enter="emit('saveEditGroup')" autofocus />
                  <div class="btn-icon mini-icon text-green" @click="emit('saveEditGroup')">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <div class="btn-icon mini-icon text-gray" @click="emit('update:editGroupId', null)">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </div>
                </div>
                <template v-else>
                  <div class="group-name-text" style="flex: 1;">{{ grp.name }}</div>
                  <div class="group-actions" v-if="!groupModalState.isManageMode">
                    <div class="btn-icon mini-icon text-blue" @click="emit('startEditGroup', grp)">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </div>
                    <div class="btn-icon mini-icon text-red" @click="emit('deleteGroup', grp.id)">
                      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <transition name="slide-up">
          <div v-if="groupModalState.isManageMode" class="manage-bottom-bar" style="position: absolute; border-radius: 0 0 16px 16px;">
            <div class="manage-btn" @click="emit('toggleSelectAllGroups')">
              {{ isAllGroupsSelected ? '取消全选' : '全选' }}
            </div>
            <div class="manage-btn danger" :class="{ disabled: groupModalState.selectedGroups.size === 0 }" @click="emit('deleteSelectedGroups')">
              删除 ({{ groupModalState.selectedGroups.size }})
            </div>
          </div>
        </transition>
      </div>
    </div>
  </transition>
</template>

<style scoped src="./WorldBookModals.css"></style>
