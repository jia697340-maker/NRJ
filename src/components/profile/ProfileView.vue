/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { useChatState } from '../../composables/useChatState'

const { myProfile, saveMyProfile } = useChatState()

const props = defineProps<{
  activePersona: any
  activePersonaIndex: number
  personas: any[]
}>()

const emit = defineEmits<{
  (e: 'prevPersona'): void
  (e: 'nextPersona'): void
  (e: 'openCustomTextEdit'): void
  (e: 'openCreateOptions'): void
  (e: 'openPersonaLibrary'): void
  (e: 'openChatAppearance'): void
  (e: 'openNotificationSettings'): void
  (e: 'handleLogout'): void
}>()
</script>

<template>
  <div class="view-container with-tabbar">
    <main class="profile-main custom-profile">
      <div class="profile-card-wrapper">
        <!-- 左侧星星按钮 -->
        <div 
          class="star-nav-btn left" 
          :class="{ disabled: activePersonaIndex === 0 }"
          @click="emit('prevPersona')"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </div>

        <div class="profile-card">
          
          <div class="profile-content-area" v-if="!activePersona.isCreate">
            <div class="profile-avatar-wrap">
              <div class="mood-bubble" title="设置此状态后，AI 角色将能在对话中感知到你的心情或正在做的事">
                <input 
                  type="text" 
                  class="mood-input" 
                  placeholder="我的公开状态(AI可见)..." 
                  v-model="myProfile.statusText" 
                  @blur="saveMyProfile" 
                  @change="saveMyProfile" 
                  @keyup.enter="($event.target as HTMLInputElement).blur()"
                />
                <div class="mood-tail"></div>
              </div>
              <div 
                class="profile-avatar-large"
                :style="activePersona.avatar ? { backgroundImage: `url(${activePersona.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}"
              >
              </div>
            </div>
            <div class="profile-name-custom">{{ activePersona.name || activePersona.networkName || '未命名' }}</div>
            <div class="profile-signature" @click="emit('openCustomTextEdit')" style="cursor: pointer;">
              <div class="sig-icon">#</div>
              <div class="sig-text">{{ activePersona.customText || '点击设置自定义文案...' }}</div>
            </div>
          </div>

          <!-- 新建人设引导态 -->
          <div class="profile-create-area" v-else @click="emit('openCreateOptions')">
            <div class="create-dashed-circle">
              <svg viewBox="0 0 24 24" width="32" height="32" stroke="#bbbbbb" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            <div class="create-text">新建专属人设</div>
          </div>
        </div>

        <!-- 右侧星星按钮 -->
        <div 
          class="star-nav-btn right" 
          :class="{ disabled: activePersonaIndex === personas.length - 1 }"
          @click="emit('nextPersona')"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </div>
      </div>

      <div class="profile-settings-area">
        <!-- 组 1：账号与人设 -->
        <div class="setting-group">
          <div class="setting-group-title">账号与人设</div>
          <div class="setting-card">
            <div class="setting-item" @click="emit('openCreateOptions')">
              <span class="setting-text">新建人设</span>
              <svg class="arrow-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
            <div class="setting-item" @click="emit('openPersonaLibrary')">
              <span class="setting-text">人设库</span>
              <svg class="arrow-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        </div>

        <!-- 组 2：聊天偏好 -->
        <div class="setting-group">
          <div class="setting-group-title">聊天偏好</div>
          <div class="setting-card">
            <div class="setting-item" @click="emit('openChatAppearance')">
              <span class="setting-text">聊天外观</span>
              <svg class="arrow-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
            <div class="setting-item">
              <span class="setting-text">聊天设置</span>
              <svg class="arrow-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
            <div class="setting-item" @click="emit('openNotificationSettings')">
              <span class="setting-text">通知偏好</span>
              <svg class="arrow-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
            <div class="setting-item">
              <span class="setting-text">记录清理</span>
              <svg class="arrow-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        </div>

        <!-- 组 3：账号操作 -->
        <div class="setting-group">
          <div class="setting-group-title">账号操作</div>
          <div class="setting-card">
            <div class="setting-item" @click="emit('handleLogout')">
              <span class="setting-text" style="color: #ff3b30;">退出登录 / 切换账号</span>
            </div>
          </div>
        </div>

      </div>
    </main>
  </div>
</template>

<style scoped>
.view-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; z-index: 1; }
.with-tabbar { height: 100%; padding-bottom: 90px; }

.profile-main { 
  flex: 1; 
  overflow-y: auto; 
  overflow-x: hidden;
  display: flex; 
  flex-direction: column; 
}
.custom-profile { 
  padding: 16px; 
  padding-top: calc(16px + env(safe-area-inset-top, 40px));
  background: transparent; 
  overflow-x: hidden;
  width: 100%;
}

.profile-card-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}

.star-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.3s;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.star-nav-btn.left {
  left: 20px;
}
.star-nav-btn.right {
  right: 20px;
}
.star-nav-btn:not(.disabled):hover {
  color: var(--text-primary);
  transform: translateY(-50%) scale(1.1);
}
.star-nav-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.profile-card {
  width: calc(100% - 50px);
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 20px;
  position: relative;
}

.profile-content-area {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 2;
  margin-top: 60px; 
}

.mood-bubble {
  position: absolute;
  top: -42px;
  background: var(--sys-bg-secondary);
  border-radius: 20px;
  padding: 6px 14px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
  z-index: 10;
}

.mood-input {
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  width: 100%;
}

.mood-input::placeholder {
  color: var(--text-tertiary);
}

.mood-tail {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 8px;
  height: 8px;
  background: var(--sys-bg-secondary);
  border-right: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
}

.profile-create-area {
  width: 100%;
  height: 202px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  margin-top: 20px;
  gap: 16px;
  cursor: pointer;
}

.create-dashed-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px dashed var(--border-color);
  background: rgba(255,255,255,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.profile-create-area:hover .create-dashed-circle {
  background: var(--sys-bg-primary);
  border-color: var(--text-tertiary);
}

.create-text {
  font-size: 15px;
  color: var(--text-tertiary);
  font-weight: 500;
  letter-spacing: 1px;
}

.profile-avatar-wrap {
  display: flex;
  justify-content: center;
  position: relative;
  z-index: 2;
}

.profile-avatar-large {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  background: #e8e8e8;
  border: 4px solid #ffffff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
}

.profile-name-custom {
  margin-top: 10px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 1px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.profile-signature {
  margin-top: 14px;
  background: var(--sys-bg-primary);
  border-radius: 24px;
  padding: 6px 24px 6px 6px;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
  justify-content: center;
}

.sig-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #555555;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}

.sig-text {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  letter-spacing: 0.5px;
}

.profile-settings-area {
  width: 100%;
  padding: 40px 32px 60px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-group-title {
  font-size: 13px;
  color: var(--text-tertiary);
  font-weight: 600;
  padding-left: 10px;
  border-left: 4px solid #e0e0e0;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
  line-height: 1.2;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
}

.setting-card {
  background: var(--sys-bg-primary);
  border-radius: 12px;
  padding: 0 16px;
  overflow: hidden;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  cursor: pointer;
  background: transparent;
  transition: opacity 0.2s;
  border-bottom: 1px solid var(--border-color);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item:active {
  opacity: 0.5;
}

.setting-text {
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 500;
  letter-spacing: 0.5px;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
}

.arrow-icon {
  color: #cccccc;
}
</style>
