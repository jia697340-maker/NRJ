/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    isFollowing?: boolean
    isSelf?: boolean
    size?: 'sm' | 'md'
  }>(),
  {
    isFollowing: false,
    isSelf: false,
    size: 'sm'
  }
)

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'edit-profile'): void
}>()

const buttonText = computed(() => {
  if (props.isSelf) return '编辑资料'
  return props.isFollowing ? '已关注' : '关注'
})

const buttonClass = computed(() => {
  if (props.isSelf) return 'btn-self'
  return props.isFollowing ? 'btn-following' : 'btn-follow'
})
</script>

<template>
  <button
    class="forum-follow-btn"
    :class="[buttonClass, `size-${size}`]"
    type="button"
    @click.stop="isSelf ? emit('edit-profile') : emit('toggle')"
  >
    {{ buttonText }}
  </button>
</template>

<style scoped>
.forum-follow-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
  white-space: nowrap;
}

.forum-follow-btn:active {
  transform: scale(0.94);
}

/* 尺寸规范 */
.size-sm {
  padding: 4px 14px;
  font-size: 12px;
  height: 28px;
}

.size-md {
  padding: 6px 18px;
  font-size: 13px;
  height: 34px;
}

/* 未关注状态：实心质感 */
.btn-follow {
  background: var(--text-primary, #111111);
  color: var(--sys-bg-secondary, #ffffff);
}

/* 已关注状态：轻量边框胶囊 */
.btn-following {
  background: transparent;
  border-color: var(--border-color, rgba(0, 0, 0, 0.15));
  color: var(--text-secondary, #666666);
}

/* 编辑资料按钮 */
.btn-self {
  background: var(--sys-bg-tertiary, #f0f0f0);
  border-color: transparent;
  color: var(--text-primary, #333333);
}
</style>
