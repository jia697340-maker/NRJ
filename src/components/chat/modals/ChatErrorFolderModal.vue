/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  errorMessage: string
  errorDetails: string
  activeErrorTab: 'info' | 'details'
  copyButtonText: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:activeErrorTab', tab: 'info' | 'details'): void
  (e: 'copy'): void
}>()
</script>

<template>
  <transition name="folder-fade">
    <div v-if="visible" class="folder-modal-overlay" @click="emit('close')" @touchmove.prevent>
      <div class="folder-modal-wrapper" @click.stop>
        
        <!-- 左侧文件夹 Tab 索引 -->
        <div class="folder-tabs-sidebar">
          <div class="folder-tab" :class="{ 'is-active': activeErrorTab === 'info' }" @click="emit('update:activeErrorTab', 'info')">
            <span class="folder-tab-text">概览</span>
          </div>
          <div class="folder-tab" :class="{ 'is-active': activeErrorTab === 'details' }" @click="emit('update:activeErrorTab', 'details')">
            <span class="folder-tab-text">详情</span>
          </div>
        </div>

        <!-- 右侧文件夹主页面 -->
        <div class="folder-modal-card">
          <div class="folder-header">
            <div class="folder-title-box">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="#ff3b30" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <h3 class="folder-title">{{ activeErrorTab === 'info' ? '发生了一个错误' : 'Console 调试日志' }}</h3>
            </div>
            <div class="folder-close-icon" @click="emit('close')">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
          </div>

          <div class="folder-body-content">
            <transition name="folder-content-fade" mode="out-in">
              <!-- 概览页 -->
              <div v-if="activeErrorTab === 'info'" class="folder-info-view">
                <div class="folder-paper-bg">
                  <p class="folder-error-msg">{{ errorMessage }}</p>
                </div>
                <div class="folder-tip">您可以切换到左侧「详情」标签查看完整的代码报错，或直接关闭此窗口重试。</div>
              </div>

              <!-- 详情页 -->
              <div v-else class="folder-details-view">
                <div class="folder-code-box">
                  <div class="code-box-header">
                    <span class="mac-dot red"></span>
                    <span class="mac-dot yellow"></span>
                    <span class="mac-dot green"></span>
                    <span class="code-box-title">stack_trace.log</span>
                  </div>
                  <textarea class="folder-error-textarea" readonly :value="errorDetails"></textarea>
                </div>
                <div class="folder-actions-row">
                  <button class="folder-btn primary" @click="emit('copy')">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    {{ copyButtonText }}
                  </button>
                </div>
              </div>
            </transition>
          </div>
        </div>

      </div>
    </div>
  </transition>
</template>

<style scoped>
@import '../ChatRoomView.css';
</style>
