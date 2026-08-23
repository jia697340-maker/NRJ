/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string
    name?: string
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    verified?: boolean
    clickable?: boolean
  }>(),
  {
    src: '',
    name: '友',
    size: 'md',
    verified: false,
    clickable: false
  }
)

const emit = defineEmits<{
  (e: 'click'): void
}>()

const fallbackText = computed(() => {
  if (!props.name) return '友'
  return props.name.trim().slice(0, 1)
})

const sizeClass = computed(() => `avatar-${props.size}`)
</script>

<template>
  <div
    class="forum-avatar-wrapper"
    :class="[sizeClass, { 'is-clickable': clickable }]"
    @click="clickable && emit('click')"
  >
    <div
      v-if="src"
      class="forum-avatar-img"
      :style="{ backgroundImage: `url(${src})` }"
    ></div>
    <div v-else class="forum-avatar-fallback">
      {{ fallbackText }}
    </div>
    <span v-if="verified" class="forum-avatar-badge" title="已认证">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
    </span>
  </div>
</template>

<style scoped>
.forum-avatar-wrapper {
  position: relative;
  flex-shrink: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  background-color: var(--sys-bg-tertiary, #f0f0f0);
}

.forum-avatar-wrapper.is-clickable {
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.forum-avatar-wrapper.is-clickable:active {
  transform: scale(0.94);
  opacity: 0.9;
}

.forum-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
}

.forum-avatar-fallback {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--text-secondary, #666);
  background: var(--sys-bg-tertiary, #e4e7eb);
}

/* 尺寸规范 */
.avatar-xs {
  width: 24px;
  height: 24px;
  font-size: 11px;
}

.avatar-sm {
  width: 34px;
  height: 34px;
  font-size: 13px;
}

.avatar-md {
  width: 42px;
  height: 42px;
  font-size: 15px;
}

.avatar-lg {
  width: 58px;
  height: 58px;
  font-size: 20px;
}

.avatar-xl {
  width: 76px;
  height: 76px;
  font-size: 26px;
}

.forum-avatar-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #2b7de9;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--sys-bg-secondary, #ffffff);
}

.avatar-xl .forum-avatar-badge {
  width: 22px;
  height: 22px;
  bottom: 0px;
  right: 0px;
}

.avatar-xl .forum-avatar-badge svg {
  width: 14px;
  height: 14px;
}

.forum-avatar-badge svg {
  width: 10px;
  height: 10px;
}
</style>
