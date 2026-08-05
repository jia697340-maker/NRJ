/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import { useTimezone } from '../../../composables/useTimezone'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', timezoneId: string): void
}>()

const {
  timezoneSearch,
  activeTimezoneTab,
  filteredTimezoneGroups,
  timezoneTabs,
  searchResultList,
  selectTimezoneTab
} = useTimezone()

const closeModal = () => {
  emit('update:visible', false)
}

const onSelect = (tzId: string) => {
  emit('select', tzId)
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" @click.self="closeModal">
    <div class="wb-modal-content">
      <div class="wb-modal-header">
        <div class="wb-modal-title">选择时区</div>
        <div class="wb-modal-close" @click="closeModal">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="#333" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </div>
      </div>
      <div style="padding: 12px; border-bottom: 1px solid var(--border-color);">
        <input type="text" class="form-input" v-model="timezoneSearch" placeholder="搜索城市、国家 (如: 北京, 中国, 东京)..." style="margin-bottom: 0;" />
      </div>
      <div class="wb-modal-body" style="padding: 0; display: flex; height: 400px;">
        <!-- 如果有搜索词，直接展示平铺列表 -->
        <div v-if="timezoneSearch" class="timezone-list" style="flex: 1; overflow-y: auto;">
          <div 
            v-for="tz in searchResultList" 
            :key="tz.id"
            class="timezone-item"
            @click="onSelect(tz.id)"
          >
            <div style="font-weight: 500; display: flex; align-items: center; justify-content: space-between;">
              <span>{{ tz.cityInfo }}</span>
              <span style="font-size: 12px; font-weight: normal; color: var(--text-tertiary);">{{ tz.offset }}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 2px; font-family: monospace;">{{ tz.region }} ({{ tz.id }})</div>
          </div>
          <div v-if="searchResultList.length === 0" style="padding: 20px; text-align: center; color: var(--text-tertiary); font-size: 12px;">未找到匹配的时区</div>
        </div>
        
        <!-- 如果没有搜索词，展示 Tab 左右布局 -->
        <template v-else>
          <!-- 左侧 Tabs -->
          <div class="timezone-tabs-left">
            <div 
              v-for="tab in timezoneTabs" 
              :key="tab"
              class="timezone-tab-item"
              :class="{ active: activeTimezoneTab === tab }"
              @click="selectTimezoneTab(tab)"
            >
              {{ tab }}
            </div>
          </div>
          <!-- 右侧内容 -->
          <div class="timezone-list" style="flex: 1; overflow-y: auto;">
            <div v-if="activeTimezoneTab === '本地'" class="timezone-item" style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;" @click="onSelect(Intl.DateTimeFormat().resolvedOptions().timeZone)">
              <svg viewBox="0 0 24 24" width="48" height="48" stroke="var(--theme-color, #1890ff)" stroke-width="1.5" fill="none" style="margin-bottom: 12px; opacity: 0.8;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <div style="font-size: 16px; font-weight: 600; color: var(--theme-color, #1890ff); margin-bottom: 8px;">使用本地设备时间</div>
              <div style="font-size: 13px; color: var(--text-tertiary);">当前设备时区: <br/><span style="font-family: monospace; font-size: 12px;">{{ Intl.DateTimeFormat().resolvedOptions().timeZone }}</span></div>
            </div>

            <template v-else>
              <div 
                v-for="tz in filteredTimezoneGroups.find(g => g.region === activeTimezoneTab)?.items || []" 
                :key="tz.id"
                class="timezone-item"
                @click="onSelect(tz.id)"
              >
                <div style="font-weight: 500; display: flex; align-items: center; justify-content: space-between;">
                  <span>{{ tz.cityInfo }}</span>
                  <span style="font-size: 12px; font-weight: normal; color: var(--text-tertiary);">{{ tz.offset }}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 2px; font-family: monospace;">{{ tz.region }} ({{ tz.id }})</div>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wb-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wb-modal-content {
  background: var(--sys-bg-secondary);
  width: 85%;
  max-width: 400px;
  max-height: 80vh;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wb-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.wb-modal-title {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
}

.wb-modal-close {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 50%;
  transition: background 0.2s;
}

.wb-modal-close:hover {
  background: var(--sys-bg-primary);
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--sys-bg-primary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.timezone-list {
  flex: 1;
  overflow-y: auto;
}

.timezone-item {
  padding: 12px 16px;
  font-size: 14px;
  color: var(--text-primary);
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background 0.2s;
}
.is-dark .timezone-item {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.timezone-item:hover {
  background: var(--sys-bg-primary);
}

.timezone-tabs-left {
  width: 90px;
  background: var(--sys-bg-secondary);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.is-dark .timezone-tabs-left {
  background: rgba(0,0,0,0.2);
}

.timezone-tab-item {
  padding: 14px 8px;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 3px solid transparent;
  user-select: none;
}

.timezone-tab-item:hover {
  background: rgba(0,0,0,0.02);
}
.is-dark .timezone-tab-item:hover {
  background: rgba(255,255,255,0.05);
}

.timezone-tab-item.active {
  background: var(--sys-bg-primary);
  color: var(--theme-color, #1890ff);
  font-weight: 600;
  border-left-color: var(--theme-color, #1890ff);
}
</style>
