<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GroupMemberItemViewModel, GroupUserPermissions } from '../../../types/groupManagement'
import GroupMemberBadge from './GroupMemberBadge.vue'

const props = defineProps<{
  visible: boolean
  members: GroupMemberItemViewModel[]
  permissions: GroupUserPermissions
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'selectMember', member: GroupMemberItemViewModel): void
  (e: 'addMembers'): void
}>()

const activeTab = ref<'all' | 'admins' | 'members' | 'muted'>('all')
const searchKeyword = ref('')

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'admins', label: '管理' },
  { key: 'members', label: '成员' },
  { key: 'muted', label: '禁言中' }
]

const filteredMembers = computed(() => {
  let list = props.members

  // 分类筛选
  if (activeTab.value === 'admins') {
    list = list.filter(m => m.role === 'owner' || m.role === 'admin')
  } else if (activeTab.value === 'members') {
    list = list.filter(m => m.role === 'member')
  } else if (activeTab.value === 'muted') {
    list = list.filter(m => m.isMuted)
  }

  // 搜索关键词筛选
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    list = list.filter(m =>
      m.name.toLowerCase().includes(kw) ||
      m.nickname.toLowerCase().includes(kw) ||
      m.levelTitle.toLowerCase().includes(kw)
    )
  }

  return list
})
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" @click.self="emit('close')">
    <div class="custom-confirm-modal group-member-list-modal">
      <div class="modal-top-bar">
        <div class="modal-title">群成员 ({{ members.length }})</div>
        <div class="modal-top-actions">
          <button v-if="permissions.canManageMembers" class="add-member-action-btn" @click="emit('addMembers')">
            + 添加
          </button>
          <button class="modal-close-icon-btn" title="关闭" @click="emit('close')">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- 搜索框 -->
      <div class="member-search-box">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="#95a5a6" stroke-width="2" fill="none">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          v-model="searchKeyword"
          type="text"
          class="search-input"
          placeholder="搜索群昵称/头衔"
        />
        <span v-if="searchKeyword" class="clear-search-btn" @click="searchKeyword = ''">×</span>
      </div>

      <!-- 标签筛选栏 -->
      <div class="member-filter-tabs">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          class="filter-tab-item"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key as any"
        >
          {{ tab.label }}
          <span v-if="tab.key === 'muted'" class="muted-count-tag">
            {{ members.filter(m => m.isMuted).length }}
          </span>
        </div>
      </div>

      <!-- 成员列表 -->
      <div v-if="filteredMembers.length" class="member-scroll-list">
        <div
          v-for="member in filteredMembers"
          :key="member.id"
          class="member-list-row"
          @click="emit('selectMember', member)"
        >
          <div class="avatar-cell">
            <div class="member-avatar-mini" :style="member.avatarUrl ? { backgroundImage: `url(${member.avatarUrl})` } : {}">
              <span v-if="!member.avatarUrl">{{ member.avatarText }}</span>
            </div>
            <span v-if="member.isMuted" class="mute-dot" title="禁言中"></span>
          </div>

          <div class="member-info-cell">
            <div class="name-badge-row">
              <span class="member-name-text">{{ member.nickname }}</span>
              <GroupMemberBadge
                :badge-type="member.badgeType"
                :level="member.level"
                :level-title="member.levelTitle"
                :role="member.role"
              />
            </div>
            <div class="member-sub-desc">
              <span v-if="member.isMuted" class="muted-desc">禁言剩余：{{ member.muteRemainingText }}</span>
              <span v-else class="points-desc">积分 {{ member.points }} · 进度 {{ member.pointsProgress }}%</span>
            </div>
          </div>

          <div class="member-action-arrow">
            <span class="arrow">›</span>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-members">
        <span>未找到匹配的群成员</span>
      </div>

      <div class="modal-bottom-actions">
        <button class="modal-primary-btn" @click="emit('close')">完成</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.group-member-list-modal {
  max-width: 380px;
  width: 92%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  padding: 18px;
  background: var(--sys-bg-secondary, #ffffff);
  border-radius: 16px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #2c3e50);
}

.modal-top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-close-icon-btn {
  background: transparent;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary, #95a5a6);
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.modal-close-icon-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-primary, #2c3e50);
}

.modal-bottom-actions {
  display: flex;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.modal-primary-btn {
  width: 100%;
  height: 40px;
  background: var(--text-primary, #2c3e50);
  color: var(--sys-bg-primary, #ffffff);
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, transform 0.1s;
}

.modal-primary-btn:active {
  opacity: 0.85;
  transform: scale(0.99);
}

.modal-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.add-member-action-btn {
  background: #27ae60;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.member-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f1f2f6;
  border-radius: 8px;
  padding: 6px 10px;
  margin-bottom: 10px;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 12.5px;
  color: #2c3e50;
}

.clear-search-btn {
  color: #95a5a6;
  font-size: 14px;
  cursor: pointer;
}

.member-filter-tabs {
  display: flex;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 3px;
  margin-bottom: 10px;
}

.filter-tab-item {
  flex: 1;
  text-align: center;
  font-size: 12px;
  padding: 6px 0;
  color: #7f8c8d;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.filter-tab-item.active {
  background: #ffffff;
  color: #2c3e50;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.muted-count-tag {
  background: #ff4d4f;
  color: #fff;
  font-size: 9px;
  padding: 0 4px;
  border-radius: 10px;
  line-height: 1.3;
}

.member-scroll-list {
  flex: 1;
  overflow-y: auto;
  max-height: 50vh;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.member-list-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: #fdfdfd;
  border: 0.5px solid #f0f0f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.member-list-row:active {
  background: #f8f9fa;
}

.avatar-cell {
  position: relative;
}

.member-avatar-mini {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #dfe6e9;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
}

.mute-dot {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e74c3c;
  border: 1px solid #fff;
}

.member-info-cell {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.name-badge-row {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.member-name-text {
  font-size: 13.5px;
  font-weight: 600;
  color: #2c3e50;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-sub-desc {
  font-size: 11px;
}

.points-desc {
  color: #95a5a6;
}

.muted-desc {
  color: #e74c3c;
  font-weight: 500;
}

.arrow {
  color: #bdc3c7;
  font-size: 14px;
}

.empty-members {
  padding: 30px 0;
  text-align: center;
  font-size: 13px;
  color: #95a5a6;
}
</style>
