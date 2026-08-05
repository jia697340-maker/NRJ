<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed } from 'vue'
import type { WorldBook } from '../../../store'

const props = defineProps<{
  show: boolean
  activeBook: WorldBook | null
  tagModalState: {
    newTagsInput: string
    selectedIndices: Set<number>
    errorMsg: string
  }
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'update:newTagsInput', value: string): void
  (e: 'addTags', activeBook: WorldBook | null): void
  (e: 'toggleTagSelect', index: number): void
  (e: 'deleteSelectedTags', activeBook: WorldBook | null): void
  (e: 'clearAllTags', activeBook: WorldBook | null): void
}>()

const inputValue = computed({
  get: () => props.tagModalState.newTagsInput,
  set: (val) => emit('update:newTagsInput', val)
})

const close = () => {
  emit('update:show', false)
}
</script>

<template>
  <transition name="fade">
    <div v-if="show" class="modal-mask clean-mask" @click="close">
      <div class="modal-box clean-box tag-manager-panel" @click.stop>
        <div class="panel-header">
          <div class="panel-title">管理标签</div>
          <div class="panel-close" @click="close">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>
        
        <div class="panel-body">
          <div class="t-input-group">
            <div class="t-input-row">
              <input 
                v-model="inputValue" 
                class="t-input" 
                placeholder="输入新标签..." 
                @input="tagModalState.errorMsg = ''" 
                @keydown.enter="emit('addTags', activeBook)"
              />
              <button class="t-add-btn" @click="emit('addTags', activeBook)" :disabled="!inputValue.trim()">添加</button>
            </div>
            <div v-if="tagModalState.errorMsg" class="t-error-msg">{{ tagModalState.errorMsg }}</div>
          </div>

          <div class="t-list-header" v-if="activeBook?.tags?.length">
            <div class="t-list-title">已有标签</div>
            <div class="t-list-actions">
              <span v-if="tagModalState.selectedIndices.size > 0" class="t-action-link danger" @click="emit('deleteSelectedTags', activeBook)">删除选中 ({{tagModalState.selectedIndices.size}})</span>
              <span class="t-action-divider" v-if="tagModalState.selectedIndices.size > 0">|</span>
              <span class="t-action-link" @click="emit('clearAllTags', activeBook)">清空全部</span>
            </div>
          </div>

          <div class="t-list-container">
            <div v-if="!activeBook?.tags?.length" class="t-empty-state">暂无标签</div>
            <div v-else class="t-tags-wrap">
              <div 
                v-for="(tag, index) in activeBook.tags" 
                :key="index"
                class="t-tag-item"
                :class="{ 'is-active': tagModalState.selectedIndices.has(index) }"
                @click="emit('toggleTagSelect', index)"
              >
                {{ tag }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped src="./WorldBookModals.css"></style>
