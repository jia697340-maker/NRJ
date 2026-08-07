/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import ConsolePanel from './advanced_settings/ConsolePanel.vue'
import PromptPanel from './advanced_settings/PromptPanel.vue'
import CotPanel from './advanced_settings/CotPanel.vue'
import StoragePanel from './advanced_settings/StoragePanel.vue'
import PluginPanel from './advanced_settings/PluginPanel.vue'
import { useAdvancedSettingsModals } from '../composables/useAdvancedSettingsModals'

const emit = defineEmits(['close'])

const activeTab = ref('home')

const tabs = [
  { id: 'console', name: '控制台', en: 'Console', desc: '应用运行日志与调试' },
  { id: 'prompt', name: '全局提示词', en: 'Prompt', desc: '底层人设与格式规则' },
  { id: 'cot', name: '思维链', en: 'Chain of Thought', desc: '控制模型内心活动' },
  { id: 'storage', name: '存储', en: 'Storage', desc: '空间管理与数据持久化' },
  { id: 'plugin', name: '插件', en: 'Plugins', desc: '扩展应用功能' },
  { id: 'updater', name: '更新日志和更新', en: 'Changelog', desc: '查看更新日志与检查更新' },
  { id: 'tutorial', name: '使用教程', en: 'Tutorials', desc: '查看或下载使用教程' }
]

const handleBack = () => {
  if (activeTab.value === 'home') {
    emit('close')
  } else {
    activeTab.value = 'home'
  }
}

const {
  confirmModal,
  showConfirm,
  closeConfirmModal,
  handleConfirm
} = useAdvancedSettingsModals()
</script>

<template>
  <div class="gu-root">
    <!-- 卷首：头部 -->
    <div class="gu-header">
      <div class="gu-back" @click="handleBack">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </div>
      
      <div class="gu-title-area">
        <div class="gu-title-text">{{ activeTab === 'home' ? '高级设置' : tabs.find(t => t.id === activeTab)?.name }}</div>
        <div class="gu-seal" v-if="activeTab === 'home'">御</div>
        <div class="gu-seal" v-else>{{ tabs.find(t => t.id === activeTab)?.name.charAt(0) }}</div>
      </div>
      
      <!-- 右侧留白平衡 -->
      <div class="gu-placeholder"></div>
      
      <!-- 极浅的花体英文背景 -->
      <div class="gu-title-watermark">
        {{ activeTab === 'home' ? 'Advanced Settings' : tabs.find(t => t.id === activeTab)?.en }}
      </div>
    </div>

    <!-- 界栏分割 -->
    <div class="gu-divider-top"></div>

    <div class="gu-content-wrapper">
      <div class="gu-content">
        <!-- 目录：主页 -->
        <div v-if="activeTab === 'home'" class="gu-catalog">
          <div 
            v-for="(tab, index) in tabs" 
            :key="tab.id"
            class="gu-catalog-item"
            @click="activeTab = tab.id"
          >
            <div class="gu-catalog-left">
              <span class="gu-catalog-num">〇{{ index + 1 }}</span>
              <div class="gu-catalog-info">
                <div class="gu-catalog-name">{{ tab.name }}</div>
                <div class="gu-catalog-desc">{{ tab.desc }}</div>
              </div>
            </div>
            <div class="gu-catalog-right">
              <span class="gu-catalog-mark">「 详情 」</span>
            </div>
          </div>
        </div>

        <!-- 各个分页 -->
        <ConsolePanel v-if="activeTab === 'console'" />
        <PromptPanel v-if="activeTab === 'prompt'" :showConfirm="showConfirm" />
        <CotPanel v-if="activeTab === 'cot'" :showConfirm="showConfirm" />
        <StoragePanel v-if="activeTab === 'storage'" :showConfirm="showConfirm" />
        <PluginPanel v-if="activeTab === 'plugin'" />

        <div v-if="['updater', 'tutorial', 'about'].includes(activeTab)" class="gu-empty">
          <span>暂无内容卷宗</span>
        </div>
      </div>
    </div>

    <!-- 弹窗 -->
    <Transition name="fade">
      <div class="gu-modal-overlay" v-if="confirmModal.visible" @click.self="closeConfirmModal">
        <div class="gu-modal">
          <div class="gu-modal-header">
            <h3 :class="{'gu-danger-text': confirmModal.type === 'danger'}">{{ confirmModal.title }}</h3>
          </div>
          <div class="gu-modal-body">
            <div class="gu-modal-msg">{{ confirmModal.message }}</div>
          </div>
          <div class="gu-modal-footer">
            <button v-if="confirmModal.showCancel" class="gu-btn gu-btn-cancel" @click="closeConfirmModal">取消</button>
            <button class="gu-btn gu-btn-primary" :class="{'gu-btn-danger': confirmModal.type === 'danger'}" @click="handleConfirm">
              {{ confirmModal.type === 'danger' ? '确认执行' : '确定' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 极简古风：白纸、浓墨、淡墨、朱砂 */
.gu-root {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background-color: #FFFFFF;
  color: #1A1A1A;
  display: flex;
  flex-direction: column;
  z-index: 50;
  animation: appOpen 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

@keyframes appOpen {
  from { transform: scale(0.98); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* 卷首 */
.gu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 50px 20px 20px 20px;
  position: relative;
}

.gu-back {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  color: #1A1A1A;
  cursor: pointer;
  z-index: 2;
}

.gu-title-area {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  z-index: 2;
}

.gu-title-text {
  font-family: "STSong", "SimSun", "Songti SC", "Noto Serif SC", serif;
  font-size: 22px;
  font-weight: bold;
  letter-spacing: 4px;
  color: #1A1A1A;
}

.gu-seal {
  width: 16px;
  height: 16px;
  background-color: #BE2A2A;
  color: #FFFFFF;
  font-family: "STFangsong", "FangSong", "SimSun", serif;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  margin-top: 2px;
}

.gu-placeholder {
  width: 40px;
}

/* 英文花体水印底纹 */
.gu-title-watermark {
  position: absolute;
  top: 40px;
  right: 20px;
  font-family: "Brush Script MT", "Snell Roundhand", cursive, serif;
  font-size: 36px;
  color: #000000;
  opacity: 0.03;
  pointer-events: none;
  z-index: 1;
}

/* 顶部界栏 */
.gu-divider-top {
  height: 1px;
  background-color: #E5E5E5;
  margin: 0 20px;
}

.gu-content-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
}

.gu-content {
  padding-top: 10px;
  padding-bottom: 40px;
}

/* 目录列表 */
.gu-catalog {
  display: flex;
  flex-direction: column;
}

.gu-catalog-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 0;
  border-bottom: 1px solid #F0F0F0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.gu-catalog-item:active {
  background-color: #FAFAFA;
}

.gu-catalog-left {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.gu-catalog-num {
  font-family: "STSong", "SimSun", serif;
  font-size: 14px;
  color: #999999;
  margin-top: 2px;
}

.gu-catalog-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gu-catalog-name {
  font-family: "STSong", "SimSun", "Songti SC", serif;
  font-size: 18px;
  font-weight: bold;
  color: #1A1A1A;
  letter-spacing: 2px;
}

.gu-catalog-desc {
  font-size: 13px;
  color: #666666;
  letter-spacing: 0.5px;
}

.gu-catalog-mark {
  font-family: "STSong", "SimSun", serif;
  font-size: 14px;
  color: #CCCCCC;
}

.gu-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-family: "STSong", "SimSun", serif;
  font-size: 16px;
  color: #999999;
  letter-spacing: 2px;
}

/* 极简弹窗 */
.gu-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gu-modal {
  background: #FFFFFF;
  width: 85%;
  max-width: 340px;
  border: 1px solid #E5E5E5;
  box-shadow: 0 10px 40px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
}

.gu-modal-header {
  padding: 24px 24px 16px 24px;
  text-align: center;
}

.gu-modal-header h3 {
  margin: 0;
  font-family: "STSong", "SimSun", serif;
  font-size: 18px;
  font-weight: bold;
  color: #1A1A1A;
  letter-spacing: 2px;
}

.gu-danger-text {
  color: #BE2A2A !important;
}

.gu-modal-body {
  padding: 0 24px 24px 24px;
  text-align: center;
}

.gu-modal-msg {
  font-size: 14px;
  color: #666666;
  line-height: 1.6;
  white-space: pre-wrap;
}

.gu-modal-footer {
  display: flex;
  border-top: 1px solid #F0F0F0;
}

.gu-btn {
  flex: 1;
  padding: 16px 0;
  background: transparent;
  border: none;
  font-size: 15px;
  cursor: pointer;
  font-family: "STSong", "SimSun", serif;
  letter-spacing: 2px;
  transition: background-color 0.2s;
}

.gu-btn:active {
  background-color: #FAFAFA;
}

.gu-btn-cancel {
  color: #999999;
  border-right: 1px solid #F0F0F0;
}

.gu-btn-primary {
  color: #1A1A1A;
  font-weight: bold;
}

.gu-btn-danger {
  color: #BE2A2A;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
