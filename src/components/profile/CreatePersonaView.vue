/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  newUserId: string
  newNetworkName: string
  newUserName: string
  newUserAvatar: string
  newUserDetail: string
  isBoundToAccount?: boolean
  isEditingPersona?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:newUserId', val: string): void
  (e: 'update:newNetworkName', val: string): void
  (e: 'update:newUserName', val: string): void
  (e: 'update:newUserDetail', val: string): void
  (e: 'back'): void
  (e: 'save'): void
  (e: 'openUploadModal'): void
  (e: 'bindAccount'): void
  (e: 'unbindAccount'): void
}>()

const updateNetworkName = (e: Event) => {
  emit('update:newNetworkName', (e.target as HTMLInputElement).value)
}

const updateName = (e: Event) => {
  emit('update:newUserName', (e.target as HTMLInputElement).value)
}

const updateDetail = (e: Event) => {
  emit('update:newUserDetail', (e.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="view-container full-height create-persona-view">
    <!-- 极简操作按钮悬浮层 -->
    <!-- 顶部导航风格操作区 -->
    <header class="persona-nav-header">
      <div class="nav-btn cancel-btn" @click="emit('back')">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        <span>返回</span>
      </div>
      <div class="nav-btn save-btn" :class="{ disabled: !newUserName.trim() }" @click="emit('save')">
        <span>保存档案</span>
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
      </div>
    </header>
    
    <main class="persona-card-container">
      <!-- 核心：名片式个人档案卡 -->
      <div class="id-card">
        <!-- 卡片顶边装饰线 -->
        <div class="card-accent-line"></div>
        
        <div class="card-header-area">
          <!-- 左侧：姓名与简要标签 -->
          <div class="card-title-area">
            <!-- 网名输入区：当前人设绑定的网名 -->
            <div>
              <div class="card-label" style="margin-bottom: 4px;">NETWORK NAME / 网名</div>
              <input 
                type="text" 
                :value="newNetworkName"
                @input="updateNetworkName"
                class="signature-input network-input" 
                placeholder="您的全局网名" 
                maxlength="20"
              />
              <div class="signature-line subtle-line"></div>
            </div>

            <!-- 真名输入区：当前人设的专属称呼 -->
            <div style="margin-top: 12px;">
              <div class="card-label" style="margin-bottom: 4px;">REAL NAME / 真名</div>
              <input 
                type="text" 
                :value="newUserName"
                @input="updateName"
                class="signature-input" 
                placeholder="您的专属称呼" 
                maxlength="20"
              />
              <div class="signature-line"></div>
            </div>
            
            <!-- 聊天账号 ID 仅作展示；人设内部 ID 不暴露给用户 -->
            <div style="margin-top: 12px; position: relative;">
              <div class="card-label" style="margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                <span>CHAT ID / 聊天账号</span>
                <!-- 账号绑定操作区移到这里 -->
                <div v-if="isEditingPersona" class="bind-action-inline">
                  <div v-if="isBoundToAccount" class="bind-badge bound" @click="emit('unbindAccount')">
                    <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
                    <span>已绑定</span>
                  </div>
                  <div v-else class="bind-badge unbound" @click="emit('bindAccount')">
                    <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                    <span>去绑定</span>
                  </div>
                </div>
              </div>
              <input 
                type="text" 
                :value="newUserId"
                class="id-input" 
                placeholder="当前聊天账号 ID"
                maxlength="20"
                readonly
                aria-readonly="true"
              />
              <div class="signature-line" style="height: 1px; opacity: 0.5;"></div>
            </div>
          </div>

          <!-- 右侧：拍立得风格头像框 -->
          <div class="polaroid-avatar-wrap" @click="emit('openUploadModal')">
            <div class="polaroid-inner" :class="{ 'has-img': newUserAvatar }" :style="newUserAvatar ? { backgroundImage: `url(${newUserAvatar})` } : {}">
              <div class="empty-avatar-icon" v-if="!newUserAvatar">
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="#cccccc" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              </div>
            </div>
            <div class="polaroid-caption" v-if="!newUserAvatar">Upload</div>
          </div>
        </div>

        <!-- 卡片主体：手账横线纹理的详细人设区 -->
        <div class="card-body-area">
          <div class="section-title">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
            <span>PROFILE DETAILS</span>
          </div>
          <div class="notebook-textarea-wrap">
            <textarea 
              :value="newUserDetail"
              @input="updateDetail"
              class="notebook-textarea" 
              placeholder="在此录入详细的背景、喜好或专属设定..."
            ></textarea>
          </div>
        </div>
        
      </div>
    </main>
  </div>
</template>

<style scoped>
.full-height { height: 100%; z-index: 10; background-color: var(--sys-bg-primary); }

.create-persona-view { 
  background-color: var(--sys-bg-primary);
  background-image: linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, .3) 25%, rgba(255, 255, 255, .3) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .3) 75%, rgba(255, 255, 255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255, 255, 255, .3) 25%, rgba(255, 255, 255, .3) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .3) 75%, rgba(255, 255, 255, .3) 76%, transparent 77%, transparent);
  background-size: 40px 40px;
  z-index: 30; 
  display: flex;
  flex-direction: column;
}

.persona-nav-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  padding-top: calc(16px + env(safe-area-inset-top, 20px));
  position: relative;
  z-index: 10;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all 0.2s ease;
}

.nav-btn.cancel-btn {
  background: rgba(255, 255, 255, 0.5);
  color: #666;
  border: 1px solid rgba(0, 0, 0, 0.05);
}
.nav-btn.cancel-btn:active { background: rgba(255, 255, 255, 0.8); }

.nav-btn.save-btn {
  background: rgba(26, 26, 26, 0.85);
  color: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.nav-btn.save-btn:active { transform: translateY(1px); box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
.nav-btn.disabled { opacity: 0.4; pointer-events: none; }

.persona-card-container {
  flex: 1;
  padding: 10px 24px 60px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow-y: auto;
}

.id-card {
  width: 100%;
  max-width: 400px;
  background: var(--sys-bg-secondary);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04);
  border: 1px solid rgba(0,0,0,0.04);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card-accent-line {
  height: 6px;
  width: 100%;
  background: linear-gradient(90deg, #2b2d30, #4a4d52);
}

.card-header-area {
  padding: 24px 24px 20px;
  display: flex;
  gap: 20px;
  align-items: center;
  border-bottom: 1px dashed #e8e8e8;
}

.polaroid-avatar-wrap {
  width: 86px;
  background: #fff;
  padding: 6px 6px 20px 6px;
  border: 1px solid #eaeaea;
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: rotate(2deg);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.polaroid-avatar-wrap:hover { 
  transform: rotate(0deg) scale(1.05); 
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}

.polaroid-inner {
  width: 72px;
  height: 72px;
  background-color: #ececec;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
}
.polaroid-caption {
  font-family: monospace;
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 6px;
  letter-spacing: 1px;
}

.card-title-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-bottom: 10px;
}

.card-label {
  font-family: -apple-system, sans-serif;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-tertiary);
  letter-spacing: 1.5px;
  margin-bottom: 8px;
}

.signature-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  padding: 0;
  margin-bottom: 4px;
  font-family: "PingFang SC", sans-serif;
}
.signature-input.network-input {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}
.signature-input::placeholder {
  color: #d0d0d0;
  font-weight: 400;
}
.id-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  font-weight: 500;
  color: #444;
  padding: 0;
  margin-bottom: 4px;
  font-family: monospace;
}
.id-input::placeholder {
  color: #dfdfdf;
}
.signature-line {
  height: 1.5px;
  width: 100%;
  background: #1a1a1a;
}
.signature-line.subtle-line {
  height: 1px;
  opacity: 0.6;
  margin-bottom: 8px;
}

.bind-action-inline {
  display: inline-flex;
  align-items: center;
}

.bind-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bind-badge.bound {
  background: #f0f0f0;
  color: #666;
  border: 1px solid #e0e0e0;
}
.bind-badge.bound:hover {
  background: #ffe5e5;
  color: #ff3b30;
  border-color: #ffcccc;
}
.bind-badge.bound:hover span {
  display: none;
}
.bind-badge.bound:hover::after {
  content: '解除绑定';
}

.bind-badge.unbound {
  background: transparent;
  color: #111;
  border: 1px dashed #ccc;
}
.bind-badge.unbound:hover {
  background: #111;
  color: #fff;
  border-color: #111;
}

.card-body-area {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  margin-bottom: 16px;
}

.notebook-textarea-wrap {
  flex: 1;
  position: relative;
  background-image: repeating-linear-gradient(transparent, transparent 29px, #e8e8e8 29px, #e8e8e8 30px);
  background-attachment: local;
  padding-top: 2px;
}

.notebook-textarea {
  width: 100%;
  min-height: 200px;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 30px;
  color: var(--text-primary);
  padding: 0;
  font-family: inherit;
}
.notebook-textarea::placeholder {
  color: #cccccc;
}

</style>
