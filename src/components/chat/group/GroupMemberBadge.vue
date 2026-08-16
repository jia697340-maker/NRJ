<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import type { GroupBadgeType } from '../../../types/groupManagement'

defineProps<{
  badgeType: GroupBadgeType
  level?: number
  levelTitle?: string
  role?: string
  showRoleText?: boolean
}>()
</script>

<template>
  <span
    class="group-member-badge"
    :class="[
      `badge-${badgeType}`,
      { 'has-level': typeof level === 'number' }
    ]"
  >
    <span v-if="typeof level === 'number'" class="badge-level">LV{{ level }}</span>
    <span v-if="levelTitle" class="badge-title">{{ levelTitle }}</span>
    <span v-else-if="showRoleText && role" class="badge-title">
      {{ role === 'owner' ? '群主' : (role === 'admin' ? '管理员' : '成员') }}
    </span>
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
