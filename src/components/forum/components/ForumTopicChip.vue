/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
withDefaults(
  defineProps<{
    topic: string
    clickable?: boolean
  }>(),
  {
    topic: '',
    clickable: true
  }
)

const emit = defineEmits<{
  (e: 'click', topic: string): void
}>()
</script>

<template>
  <span
    class="forum-topic-chip"
    :class="{ 'is-clickable': clickable }"
    @click.stop="clickable && emit('click', topic)"
  >
    <span class="hash-tag">#</span>{{ topic }}
  </span>
</template>

<style scoped>
.forum-topic-chip {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--accent-color, #2b7de9);
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(43, 125, 233, 0.08);
  margin-right: 6px;
  margin-bottom: 4px;
  user-select: none;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

.hash-tag {
  font-weight: 700;
  margin-right: 2px;
  opacity: 0.8;
}

.forum-topic-chip.is-clickable {
  cursor: pointer;
}

.forum-topic-chip.is-clickable:hover {
  opacity: 0.85;
}

.forum-topic-chip.is-clickable:active {
  transform: scale(0.96);
}
</style>
