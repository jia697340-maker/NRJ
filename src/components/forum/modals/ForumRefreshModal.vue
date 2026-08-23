<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WorldBook } from '../../../store'

const props = defineProps<{
  visible: boolean
  books: WorldBook[]
  initialBookIds: string[]
  busy?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', bookIds: string[]): void
}>()

const selectedIds = ref<string[]>([])
const selectableIds = computed(() => props.books.map(book => book.id))
const allSelected = computed(() => selectableIds.value.length > 0 && selectableIds.value.every(id => selectedIds.value.includes(id)))

watch(() => props.visible, visible => {
  if (!visible) return
  const available = new Set(selectableIds.value)
  selectedIds.value = props.initialBookIds.filter(id => available.has(id))
})

const toggleAll = () => {
  selectedIds.value = allSelected.value ? [] : [...selectableIds.value]
}

const toggleBook = (bookId: string) => {
  selectedIds.value = selectedIds.value.includes(bookId)
    ? selectedIds.value.filter(id => id !== bookId)
    : [...selectedIds.value, bookId]
}
</script>

<template>
  <div v-if="visible" class="refresh-overlay" @click.self="!busy && emit('close')">
    <section class="refresh-sheet" role="dialog" aria-modal="true" aria-labelledby="forum-refresh-title">
      <header>
        <div>
          <h2 id="forum-refresh-title">刷新推荐内容</h2>
          <p>可选择本次生成参考的世界书</p>
        </div>
        <button type="button" aria-label="关闭" :disabled="busy" @click="emit('close')">×</button>
      </header>

      <div class="selection-head">
        <span>世界书</span>
        <button v-if="books.length" type="button" :disabled="busy" @click="toggleAll">{{ allSelected ? '取消全选' : '全选' }}</button>
      </div>

      <div v-if="books.length" class="book-list">
        <button
          v-for="book in books"
          :key="book.id"
          class="book-row"
          :class="{ selected: selectedIds.includes(book.id) }"
          type="button"
          :disabled="busy"
          @click="toggleBook(book.id)"
        >
          <span class="book-mark" :style="{ background: book.coverColor || 'var(--sys-bg-tertiary,#eceef1)' }">{{ book.title.trim().slice(0, 1) || '书' }}</span>
          <span class="book-copy">
            <b>{{ book.title || '未命名世界书' }}</b>
            <small>{{ book.entries.filter(entry => entry.enabled).length }} 个可用条目</small>
          </span>
          <i aria-hidden="true">✓</i>
        </button>
      </div>
      <p v-else class="empty-note">暂无可用世界书，不选择也可以正常刷新。</p>

      <p class="context-note">世界书只提供背景事实，不会要求每条帖子都提及。</p>
      <footer>
        <button class="cancel" type="button" :disabled="busy" @click="emit('close')">取消</button>
        <button class="confirm" type="button" :disabled="busy" @click="emit('confirm', selectedIds)">{{ busy ? '刷新中…' : '开始刷新' }}</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.refresh-overlay{position:absolute;inset:0;z-index:520;display:flex;align-items:flex-end;background:rgba(0,0,0,.32)}
.refresh-sheet{box-sizing:border-box;width:100%;max-height:min(76%,560px);display:flex;flex-direction:column;border-radius:16px 16px 0 0;background:var(--sys-bg-secondary,#fff);padding:5px 16px calc(10px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 28px rgba(0,0,0,.08)}
.refresh-sheet header{display:flex;flex:0 0 auto;align-items:center;justify-content:space-between;gap:12px;min-height:54px;border-bottom:1px solid var(--border-color,rgba(0,0,0,.06))}
.refresh-sheet header>div{min-width:0;flex:1}.refresh-sheet h2{margin:0;color:var(--text-primary,#222);font-size:14px;font-weight:650;line-height:1.35}.refresh-sheet header p{margin:2px 0 0;overflow:hidden;color:var(--text-tertiary,#999);font-size:10.5px;line-height:1.35;white-space:nowrap;text-overflow:ellipsis}
.refresh-sheet header>button{flex:0 0 30px;width:30px;height:30px;border:0;border-radius:50%;background:transparent;color:var(--text-secondary,#777);font:inherit;font-size:20px;line-height:1}.refresh-sheet button:disabled{opacity:.45}
.selection-head{display:flex;flex:0 0 auto;align-items:center;justify-content:space-between;gap:8px;padding:10px 1px 6px;color:var(--text-tertiary,#999);font-size:10.5px;font-weight:650}.selection-head button{border:0;background:transparent;color:var(--accent-color,#2b7de9);padding:3px 0;font:inherit;font-size:11px}
.book-list{min-height:0;overflow-y:auto;border-top:1px solid var(--border-color,rgba(0,0,0,.045));border-bottom:1px solid var(--border-color,rgba(0,0,0,.045))}.book-row{display:flex;width:100%;min-height:48px;box-sizing:border-box;align-items:center;gap:10px;border:0;border-bottom:1px solid var(--border-color,rgba(0,0,0,.045));background:transparent;padding:6px 1px;color:var(--text-primary,#222);text-align:left}.book-row:last-child{border-bottom:0}.book-mark{display:flex;flex:0 0 32px;height:32px;align-items:center;justify-content:center;border-radius:8px;color:rgba(25,25,25,.72);font-size:12px;font-weight:650}.book-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}.book-copy b{overflow:hidden;font-size:12.5px;font-weight:570;white-space:nowrap;text-overflow:ellipsis}.book-copy small{overflow:hidden;color:var(--text-tertiary,#999);font-size:10px;white-space:nowrap;text-overflow:ellipsis}.book-row>i{display:flex;flex:0 0 18px;width:18px;height:18px;align-items:center;justify-content:center;border:1px solid #c8ccd2;border-radius:5px;color:transparent;font-size:11px;font-style:normal}.book-row.selected>i{border-color:var(--accent-color,#576b95);background:var(--accent-color,#576b95);color:#fff}
.empty-note{flex:1;margin:0;padding:28px 8px;text-align:center;color:var(--text-tertiary,#999);font-size:11.5px;line-height:1.5}.context-note{flex:0 0 auto;margin:8px 0 9px;color:var(--text-tertiary,#999);font-size:10.5px;line-height:1.45}
.refresh-sheet footer{display:grid;grid-template-columns:minmax(0,.72fr) minmax(0,1.28fr);flex:0 0 auto;gap:8px}.refresh-sheet footer button{height:36px;border:0;border-radius:9px;font:inherit;font-size:12.5px}.refresh-sheet footer .cancel{background:var(--sys-bg-tertiary,#eef0f2);color:var(--text-secondary,#666)}.refresh-sheet footer .confirm{background:var(--accent-color,#576b95);color:#fff;font-weight:570}
@media(max-width:340px){.refresh-sheet{padding-left:12px;padding-right:12px}.refresh-sheet header{min-height:50px}.book-row{min-height:45px}.context-note{margin-top:7px;margin-bottom:8px}.refresh-sheet footer button{height:34px}}
</style>
