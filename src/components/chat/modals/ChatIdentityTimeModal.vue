<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  clockInputToTimestamp,
  normalizeIdentityClock,
  toClockInputValue,
  type IdentityClockMode,
  type IdentityClockSnapshot
} from '../../../services/conversationTime'
import { useTimezone } from '../../../composables/useTimezone'

const props = defineProps<{
  visible: boolean
  title: string
  owner: any
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', clock: IdentityClockSnapshot): void
  (e: 'select-timezone'): void
}>()

const { getTimezoneLabel } = useTimezone()
const selectedMode = ref<IdentityClockMode>('system')
const selectedTimezone = ref('')
const customValue = ref('')
const validationError = ref('')

watch(() => props.visible, visible => {
  if (!visible) return
  const clock = normalizeIdentityClock(props.owner)
  selectedMode.value = clock.clockMode
  selectedTimezone.value = clock.timezone
  customValue.value = toClockInputValue(clock)
  validationError.value = ''
}, { immediate: true })

watch(() => props.owner?.timezone, timezone => {
  if (timezone) selectedTimezone.value = timezone
})

const timezoneLabel = computed(() => getTimezoneLabel(selectedTimezone.value) || selectedTimezone.value || '未选择')

const close = () => emit('update:visible', false)

const save = () => {
  const current = normalizeIdentityClock(props.owner)
  const now = Date.now()
  let anchorTime = current.clockMode === 'custom'
    ? current.clockAnchorTimeAt + (now - current.clockAnchorRealAt)
    : now
  if (selectedMode.value === 'custom') {
    anchorTime = clockInputToTimestamp(customValue.value)
    if (!Number.isFinite(anchorTime)) {
      validationError.value = '请选择完整的日期和时间'
      return
    }
  }
  emit('save', {
    clockMode: selectedMode.value,
    timezone: selectedTimezone.value || current.timezone,
    clockAnchorRealAt: now,
    clockAnchorTimeAt: anchorTime
  })
  close()
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" @click.self="close">
    <div class="wb-modal-content identity-time-modal">
      <div class="wb-modal-header">
        <div class="wb-modal-header-info">
          <div class="wb-modal-title">{{ title }}</div>
          <div class="wb-modal-subtitle">此身份的时间独立于聊天中的其他人</div>
        </div>
        <button class="wb-modal-close" type="button" aria-label="关闭" @click="close">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="wb-modal-body">
        <div class="clock-mode-group">
          <!-- 跟随设备 -->
          <div
            class="clock-card"
            :class="{ active: selectedMode === 'system' }"
            @click="selectedMode = 'system'"
          >
            <div class="clock-card-content">
              <div class="clock-card-title">跟随设备</div>
              <div class="clock-card-desc">使用当前设备系统时间并持续流逝</div>
            </div>
            <div class="custom-radio-indicator" :class="{ checked: selectedMode === 'system' }">
              <div class="inner-dot"></div>
            </div>
          </div>

          <!-- 按地区时间 -->
          <div
            class="clock-card-wrap"
            :class="{ active: selectedMode === 'timezone' }"
          >
            <div
              class="clock-card"
              :class="{ active: selectedMode === 'timezone' }"
              @click="selectedMode = 'timezone'"
            >
              <div class="clock-card-content">
                <div class="clock-card-title">按地区时间</div>
                <div class="clock-card-desc">按选定地区时区同步流动</div>
              </div>
              <div class="custom-radio-indicator" :class="{ checked: selectedMode === 'timezone' }">
                <div class="inner-dot"></div>
              </div>
            </div>

            <!-- 内嵌地区切换栏 -->
            <div
              v-if="selectedMode === 'timezone'"
              class="timezone-chip-bar"
              @click="emit('select-timezone')"
            >
              <div class="tz-info">
                <svg class="tz-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  <path d="M2 12h20"/>
                </svg>
                <span class="tz-name">{{ timezoneLabel }}</span>
              </div>
              <div class="tz-action-btn">
                <span>更换地区</span>
                <svg class="tz-arrow" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>
          </div>

          <!-- 自定义当前时间 -->
          <div
            class="clock-card-wrap"
            :class="{ active: selectedMode === 'custom' }"
          >
            <div
              class="clock-card"
              :class="{ active: selectedMode === 'custom' }"
              @click="selectedMode = 'custom'"
            >
              <div class="clock-card-content">
                <div class="clock-card-title">自定义当前时间</div>
                <div class="clock-card-desc">设定起点后仍会按正常速度流逝</div>
              </div>
              <div class="custom-radio-indicator" :class="{ checked: selectedMode === 'custom' }">
                <div class="inner-dot"></div>
              </div>
            </div>

            <!-- 内嵌时间设定面板 -->
            <div v-if="selectedMode === 'custom'" class="custom-time-panel">
              <div class="custom-input-wrap">
                <input
                  v-model="customValue"
                  class="custom-time-input"
                  type="datetime-local"
                  @input="validationError = ''"
                >
              </div>
              <div v-if="validationError" class="editor-error">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                <span>{{ validationError }}</span>
              </div>
              <div class="custom-tip">仅调整此身份的基准时间，角色不会察觉设置发生变化</div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-cancel" @click="close">取消</button>
        <button type="button" class="btn-save" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wb-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.48);
  z-index: 10020;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.wb-modal-content {
  width: 90%;
  max-width: 380px;
  max-height: 85vh;
  background: var(--sys-bg-primary, #ffffff);
  color: var(--text-primary, #1e293b);
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.16), 0 0 1px 1px rgba(0, 0, 0, 0.04);
  border: 1px solid color-mix(in srgb, var(--border-color, #e2e8f0) 60%, transparent);
  animation: scaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes scaleUp {
  from {
    transform: scale(0.96) translateY(6px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

/* 顶部标题栏 */
.wb-modal-header {
  padding: 18px 20px 14px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
}

.wb-modal-header-info {
  flex: 1;
  padding-right: 12px;
}

.wb-modal-title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary, #0f172a);
}

.wb-modal-subtitle {
  margin-top: 3px;
  color: var(--text-tertiary, #94a3b8);
  font-size: 12px;
  line-height: 1.4;
}

.wb-modal-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary, #94a3b8);
  cursor: pointer;
  transition: all 0.18s ease;
  margin-top: -2px;
  padding: 0;
}

.wb-modal-close:hover {
  background: color-mix(in srgb, var(--text-primary, #0f172a) 6%, transparent);
  color: var(--text-primary, #0f172a);
}

/* 选项内容区 */
.wb-modal-body {
  padding: 0 18px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.clock-mode-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 卡片外层与卡片本身 */
.clock-card-wrap {
  border-radius: 14px;
  border: 1.5px solid var(--border-color, #e2e8f0);
  background: var(--sys-bg-secondary, #f8fafc);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.clock-card-wrap.active {
  border-color: var(--theme-color, #3b82f6);
  background: color-mix(in srgb, var(--theme-color, #3b82f6) 3%, var(--sys-bg-secondary, #f8fafc));
  box-shadow: 0 4px 14px -2px color-mix(in srgb, var(--theme-color, #3b82f6) 12%, transparent);
}

.clock-card {
  padding: 13px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  border-radius: 14px;
  border: 1.5px solid var(--border-color, #e2e8f0);
  background: var(--sys-bg-secondary, #f8fafc);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}

/* 当卡片在 wrap 内部时取消其独立边框 */
.clock-card-wrap .clock-card {
  border: none;
  background: transparent;
  border-radius: 0;
}

.clock-card:not(.clock-card-wrap .clock-card).active {
  border-color: var(--theme-color, #3b82f6);
  background: color-mix(in srgb, var(--theme-color, #3b82f6) 4%, var(--sys-bg-secondary, #f8fafc));
  box-shadow: 0 4px 14px -2px color-mix(in srgb, var(--theme-color, #3b82f6) 12%, transparent);
}

.clock-card:hover {
  background: color-mix(in srgb, var(--theme-color, #3b82f6) 3%, var(--sys-bg-secondary, #f8fafc));
}

.clock-card-content {
  flex: 1;
}

.clock-card-title {
  font-size: 14.5px;
  font-weight: 550;
  color: var(--text-primary, #1e293b);
  line-height: 1.3;
}

.clock-card-desc {
  margin-top: 3px;
  color: var(--text-tertiary, #64748b);
  font-size: 12px;
  line-height: 1.35;
}

/* 精致单选圆圈 */
.custom-radio-indicator {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  border-radius: 50%;
  border: 1.8px solid var(--border-color, #cbd5e1);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  background: var(--sys-bg-primary, #ffffff);
}

.custom-radio-indicator.checked {
  border-color: var(--theme-color, #3b82f6);
  background: var(--theme-color, #3b82f6);
}

.inner-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ffffff;
  transform: scale(0);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.custom-radio-indicator.checked .inner-dot {
  transform: scale(1);
}

/* 地区切换栏（胶囊内嵌样式） */
.timezone-chip-bar {
  margin: 0 12px 12px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: color-mix(in srgb, var(--theme-color, #3b82f6) 8%, var(--sys-bg-primary, #ffffff));
  border: 1px solid color-mix(in srgb, var(--theme-color, #3b82f6) 18%, transparent);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.timezone-chip-bar:hover {
  background: color-mix(in srgb, var(--theme-color, #3b82f6) 12%, var(--sys-bg-primary, #ffffff));
  border-color: var(--theme-color, #3b82f6);
}

.tz-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tz-icon {
  color: var(--theme-color, #3b82f6);
  flex-shrink: 0;
}

.tz-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tz-action-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 550;
  color: var(--theme-color, #3b82f6);
  flex-shrink: 0;
}

.tz-arrow {
  transition: transform 0.15s ease;
}

.timezone-chip-bar:hover .tz-arrow {
  transform: translateX(2px);
}

/* 自定义时间面板 */
.custom-time-panel {
  padding: 0 12px 13px;
}

.custom-input-wrap {
  position: relative;
}

.custom-time-input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #cbd5e1);
  border-radius: 10px;
  outline: none;
  background: var(--sys-bg-primary, #ffffff);
  color: var(--text-primary, #1e293b);
  font: inherit;
  font-size: 13.5px;
  font-weight: 500;
  color-scheme: light dark;
  transition: all 0.2s ease;
}

.custom-time-input:focus {
  border-color: var(--theme-color, #3b82f6);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-color, #3b82f6) 16%, transparent);
}

.editor-error {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  color: #ef4444;
  font-size: 11.5px;
}

.custom-tip {
  margin-top: 7px;
  color: var(--text-tertiary, #94a3b8);
  font-size: 11px;
  line-height: 1.45;
}

/* 底部操作按钮 */
.modal-footer {
  padding: 12px 18px 16px;
  display: flex;
  gap: 10px;
  background: var(--sys-bg-primary, #ffffff);
}

.btn-cancel,
.btn-save {
  flex: 1;
  height: 40px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 550;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  border: none;
  outline: none;
  user-select: none;
}

.btn-cancel {
  background: var(--sys-bg-secondary, #f1f5f9);
  color: var(--text-secondary, #64748b);
}

.btn-cancel:hover {
  background: color-mix(in srgb, var(--text-primary, #0f172a) 8%, var(--sys-bg-secondary, #f1f5f9));
  color: var(--text-primary, #0f172a);
}

.btn-cancel:active {
  transform: scale(0.98);
}

.btn-save {
  background: var(--theme-color, #3b82f6);
  color: #ffffff;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-color, #3b82f6) 30%, transparent);
}

.btn-save:hover {
  filter: brightness(1.06);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-color, #3b82f6) 40%, transparent);
}

.btn-save:active {
  transform: scale(0.98);
}
</style>
