<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed } from 'vue'
import type { GroupBadgeType } from '../../../types/groupManagement'

const props = withDefaults(
  defineProps<{
    badgeType?: GroupBadgeType
    level?: number
    levelTitle?: string
    role?: string
    specialTitle?: string
    showLevel?: boolean
    showRoleText?: boolean
  }>(),
  {
    showLevel: true
  }
)

// 判断是否拥有专属头衔
const isSpecial = computed(() => {
  return props.badgeType === 'special' || Boolean(props.specialTitle && props.specialTitle.trim())
})

// 计算徽章的样式类别
const computedBadgeClass = computed(() => {
  if (isSpecial.value) return 'badge-special'
  if (props.role === 'owner' || props.badgeType === 'owner') return 'badge-owner'
  if (props.role === 'admin' || props.badgeType === 'admin') return 'badge-admin'
  return 'badge-member'
})

// 是否需要显示 LV 等级（当开启 showLevel 时，所有角色和头衔都显示 LV）
const shouldShowLevel = computed(() => {
  return props.showLevel !== false && typeof props.level === 'number'
})

// 计算徽章显示的文本
const displayText = computed(() => {
  // 1. 如果有专属头衔，优先显示专属头衔
  if (isSpecial.value) {
    return props.specialTitle || props.levelTitle || '头衔'
  }
  // 2. 如果是群主，显示群主
  if (props.role === 'owner' || props.badgeType === 'owner') {
    return '群主'
  }
  // 3. 如果是管理员，显示管理员
  if (props.role === 'admin' || props.badgeType === 'admin') {
    return '管理员'
  }
  // 4. 普通成员：显示段位名称（如“潜水”）
  return props.levelTitle || '成员'
})
</script>

<template>
  <span
    class="group-member-badge"
    :class="[
      computedBadgeClass,
      { 'has-level': shouldShowLevel }
    ]"
  >
    <span v-if="shouldShowLevel" class="badge-level">LV{{ level }}</span>
    <span class="badge-title">{{ displayText }}</span>
  </span>
</template>

<style scoped>
.group-member-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  line-height: 1.2;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 500;
  vertical-align: middle;
  user-select: none;
  white-space: nowrap;
  letter-spacing: 0.2px;
}

/* 群主：金黄色/橙金风格 (严格参照参考图1) */
.badge-owner {
  background-color: #fff4e5;
  color: #d35400;
  border: 0.5px solid rgba(211, 84, 0, 0.2);
}

/* 管理员：淡青蓝/天蓝风格 (严格参照参考图2) */
.badge-admin {
  background-color: #e8f4fd;
  color: #2980b9;
  border: 0.5px solid rgba(41, 128, 185, 0.2);
}

/* 普通成员：中性浅灰阶 (严格参照参考图3) */
.badge-member {
  background-color: #f2f3f5;
  color: #7f8c8d;
  border: 0.5px solid rgba(127, 140, 141, 0.15);
}

/* 特殊/有头衔成员：典雅浅紫 (严格参照参考图4，无渐变) */
.badge-special {
  background-color: #f4effa;
  color: #8e44ad;
  border: 0.5px solid rgba(142, 68, 173, 0.2);
}

.badge-level {
  font-size: 9.5px;
  font-weight: 700;
}

.badge-title {
  font-size: 10px;
}
</style>
