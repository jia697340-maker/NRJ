/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { useChatTokenStats } from '../../../composables/useChatTokenStats'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const { tokenStats, getTokenPercentage } = useChatTokenStats()

const closeModal = () => {
  emit('update:visible', false)
}
</script>

<template>
  <div v-if="visible && tokenStats" class="wb-modal-overlay" style="z-index: 10000;" @click.self="closeModal">
    <div class="custom-confirm-modal" style="width: 90%; max-width: 360px; background: var(--sys-bg-primary);">
      <div class="confirm-title" style="margin-bottom: 8px;">上下文用量估算</div>
      
      <div style="padding: 16px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 20px;">
          <div>
            <div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 4px;">当前总条数</div>
            <div style="font-size: 24px; font-weight: 800; font-family: monospace; color: var(--text-primary);">{{ tokenStats.totalMsgCount }}<span style="font-size: 12px; font-weight: normal; margin-left: 4px;">条</span></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 4px;">预估总 Tokens</div>
            <div style="font-size: 24px; font-weight: 800; font-family: monospace; color: var(--text-primary);">{{ tokenStats.totalTokens }}<span style="font-size: 12px; font-weight: normal; margin-left: 4px;">T</span></div>
          </div>
        </div>

        <!-- 彩色条形图 -->
        <div style="height: 12px; border-radius: 6px; overflow: hidden; display: flex; margin-bottom: 16px; background: rgba(0,0,0,0.05);">
          <div v-if="tokenStats.systemTokens > 0" :style="{ width: getTokenPercentage(tokenStats.systemTokens, tokenStats.totalTokens) + '%', background: '#FF6B6B' }"></div>
          <div v-if="tokenStats.worldBookTokens > 0" :style="{ width: getTokenPercentage(tokenStats.worldBookTokens, tokenStats.totalTokens) + '%', background: '#339AF0' }"></div>
          <div v-if="tokenStats.memoryTokens > 0" :style="{ width: getTokenPercentage(tokenStats.memoryTokens, tokenStats.totalTokens) + '%', background: '#FCC419' }"></div>
          <div v-if="tokenStats.historyTokens > 0" :style="{ width: getTokenPercentage(tokenStats.historyTokens, tokenStats.totalTokens) + '%', background: '#51CF66' }"></div>
        </div>

        <!-- 分类列表 -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <div style="width: 10px; height: 10px; border-radius: 3px; background: #FF6B6B;"></div>
              <span style="color: var(--text-secondary);">人设与系统</span>
            </div>
            <div style="font-family: monospace; font-weight: 600;">{{ tokenStats.systemTokens }} <span style="font-weight: normal; color: var(--text-tertiary); font-size: 11px;">({{ getTokenPercentage(tokenStats.systemTokens, tokenStats.totalTokens) }}%)</span></div>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <div style="width: 10px; height: 10px; border-radius: 3px; background: #339AF0;"></div>
              <span style="color: var(--text-secondary);">世界设定</span>
            </div>
            <div style="font-family: monospace; font-weight: 600;">{{ tokenStats.worldBookTokens }} <span style="font-weight: normal; color: var(--text-tertiary); font-size: 11px;">({{ getTokenPercentage(tokenStats.worldBookTokens, tokenStats.totalTokens) }}%)</span></div>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <div style="width: 10px; height: 10px; border-radius: 3px; background: #FCC419;"></div>
              <span style="color: var(--text-secondary);">长效记忆</span>
            </div>
            <div style="font-family: monospace; font-weight: 600;">{{ tokenStats.memoryTokens }} <span style="font-weight: normal; color: var(--text-tertiary); font-size: 11px;">({{ getTokenPercentage(tokenStats.memoryTokens, tokenStats.totalTokens) }}%)</span></div>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <div style="width: 10px; height: 10px; border-radius: 3px; background: #51CF66;"></div>
              <span style="color: var(--text-secondary);">历史对话</span>
            </div>
            <div style="font-family: monospace; font-weight: 600;">{{ tokenStats.historyTokens }} <span style="font-weight: normal; color: var(--text-tertiary); font-size: 11px;">({{ getTokenPercentage(tokenStats.historyTokens, tokenStats.totalTokens) }}%)</span></div>
          </div>
        </div>

        <div style="margin-top: 20px; font-size: 11px; color: var(--text-tertiary); line-height: 1.5; background: rgba(0,0,0,0.02); padding: 10px; border-radius: 6px;">
          * 预估值为本地粗略测算(仅统计文本)，不包含图片识别额外消耗，具体花费请以模型平台最终计费为准。<br/>
          * 当前上下文中包含的有效历史消息为 <b style="color: var(--text-primary);">{{ tokenStats.activeMsgCount }}</b> 条 (已截取)。
        </div>
      </div>
      
      <div class="confirm-actions">
        <div class="confirm-btn cancel" style="border-right: none; color: var(--theme-color, #1890ff); font-weight: bold;" @click="closeModal">确定</div>
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

.custom-confirm-modal {
  background: var(--sys-bg-secondary);
  width: 80%;
  max-width: 320px;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  animation: modalScaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modalScaleIn {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.confirm-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  margin-top: 24px;
}

.confirm-actions {
  display: flex;
  border-top: 1px solid var(--border-color);
}

.confirm-btn {
  flex: 1;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.confirm-btn:active {
  background: var(--sys-bg-primary);
}

.confirm-btn.cancel {
  color: var(--text-primary);
  border-right: 1px solid var(--border-color);
}
</style>
