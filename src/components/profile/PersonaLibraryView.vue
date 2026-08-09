/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  isPersonaManageMode: boolean
  activeGroupId: string | null
  personaGroups: any[]
  validPersonas: any[]
  selectedPersonaIds: number[]
  isAllPersonasSelected: boolean
  currentPersonaId?: number | null
}>()

const emit = defineEmits<{
  (e: 'togglePersonaManageMode'): void
  (e: 'backToProfile'): void
  (e: 'handleGroupTabClick', id: string | null): void
  (e: 'openCreateGroupModal'): void
  (e: 'openEditUserPersona', persona: any): void
  (e: 'toggleSelectAllPersonas'): void
  (e: 'removeFromCurrentGroup'): void
  (e: 'openAddToGroupModal'): void
  (e: 'deleteSelectedPersonas'): void
  (e: 'bindPersonaToAccount', personaId: number): void
  (e: 'unbindPersonaFromAccount', personaId: number): void
}>()

</script>

<template>
  <div class="view-container pure-white-bg">
    <!-- 顶部吸顶区域：包含标题和导航 -->
    <div class="sticky-header-container">
      <!-- 头部操作区 -->
      <div class="pure-header">
        <div class="pure-title">PERSONA</div>
        <div class="pure-actions">
          <div class="pure-icon-btn" @click="emit('togglePersonaManageMode')">
            <svg v-if="!isPersonaManageMode" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
            <span v-else class="manage-done-text">完成</span>
          </div>
          <div class="pure-icon-btn" @click="emit('backToProfile')">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>
      </div>

      <!-- 分组胶囊导航 -->
      <div class="pure-tabs-container">
        <div class="pure-tabs-scroll">
          <div class="pure-pill-tab" :class="{ active: activeGroupId === null }" @click="emit('handleGroupTabClick', null)">全部</div>
          <div 
            v-for="group in personaGroups" 
            :key="group.id" 
            class="pure-pill-tab" 
            :class="{ active: activeGroupId === group.id }"
            @click="emit('handleGroupTabClick', group.id)"
          >{{ group.name }}</div>
        </div>
        <div class="pure-tab-add" @click="emit('openCreateGroupModal')">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
      </div>
    </div>

    <main class="pure-main">
      <!-- 极简无框排版：一行四列，拍立得样式 -->
      <div class="pure-grid">
        <div 
          v-for="persona in validPersonas" 
          :key="persona.id" 
          class="pure-item polaroid-style"
          @click="emit('openEditUserPersona', persona)"
        >
          <!-- 拍立得底层背景(产生堆叠感) -->
          <div class="polaroid-base"></div>
          <!-- 拍立得主相纸 -->
          <div class="polaroid-frame">
            <div class="polaroid-photo" :style="persona.avatar ? { backgroundImage: `url(${persona.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}">
              <!-- 管理模式下的选中小圆圈 -->
              <div class="pure-checkbox-float" v-if="isPersonaManageMode" :class="{ checked: selectedPersonaIds.includes(persona.id) }">
                <svg v-if="selectedPersonaIds.includes(persona.id)" viewBox="0 0 24 24" width="12" height="12" stroke="white" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
            </div>
            <div class="polaroid-caption">
              <span class="pure-name">{{ persona.name || persona.networkName || '未命名' }}</span>
              <div class="pure-status-row" v-if="persona.id === currentPersonaId || persona.boundAccountId">
                <span v-if="persona.id === currentPersonaId" class="status-current">当前</span>
                <span v-if="persona.boundAccountId" class="bound-tag">已绑定</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 底部管理操作栏 (极简风格) -->
    <footer class="pure-manage-bar" v-if="isPersonaManageMode">
      <div class="pmb-left" @click="emit('toggleSelectAllPersonas')">
        <div class="pmb-checkbox" :class="{ checked: isAllPersonasSelected }"></div>
        <span>全选</span>
      </div>
      <div class="pmb-right">
        <div class="pmb-btn" v-if="activeGroupId !== null" :class="{ disabled: selectedPersonaIds.length === 0 }" @click="emit('removeFromCurrentGroup')">移出</div>
        <div class="pmb-btn" :class="{ disabled: selectedPersonaIds.length === 0 }" @click="emit('openAddToGroupModal')">加入</div>
        <div class="pmb-btn del" :class="{ disabled: selectedPersonaIds.length === 0 }" @click="emit('deleteSelectedPersonas')">删除</div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* 绝对纯白无底纹背景 */
.pure-white-bg { 
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%; 
  background-color: #ffffff; 
  z-index: 10; 
  display: flex;
  flex-direction: column;
}

/* 顶部吸顶区域 (带毛玻璃效果) */
.sticky-header-container {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  padding-bottom: 12px;
}

/* 头部操作区 */
.pure-header {
  padding: 20px 24px 12px;
  padding-top: calc(20px + env(safe-area-inset-top, 20px));
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pure-title {
  font-size: 26px;
  font-weight: 900;
  color: #111111;
  letter-spacing: 1.5px;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
  text-transform: uppercase;
}

.pure-actions {
  display: flex;
  gap: 12px;
}

.pure-icon-btn {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: #111111;
  border-radius: 50%;
  transition: all 0.2s;
  background: transparent;
}
.pure-icon-btn:hover { background: rgba(0,0,0,0.04); }
.pure-icon-btn:active { transform: scale(0.92); }

.manage-done-text {
  font-size: 14px;
  font-weight: 700;
  color: #111;
  padding: 4px 8px;
  border-radius: 12px;
  background: rgba(0,0,0,0.06);
}

/* 胶囊导航 */
.pure-tabs-container {
  display: flex;
  align-items: center;
  padding: 0 24px;
}

.pure-tabs-scroll {
  flex: 1;
  display: flex;
  overflow-x: auto;
  gap: 8px; /* 胶囊之间的间距 */
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 4px 0;
}
.pure-tabs-scroll::-webkit-scrollbar { display: none; }

/* 胶囊样式 */
.pure-pill-tab {
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: #666666;
  cursor: pointer;
  padding: 6px 16px;
  border-radius: 20px;
  background: transparent;
  transition: all 0.25s ease;
}

.pure-pill-tab:hover {
  background: rgba(0,0,0,0.03);
}

.pure-pill-tab.active {
  color: #ffffff;
  background: #111111;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}

.pure-tab-add {
  margin-left: 16px;
  color: #111111;
  cursor: pointer;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: rgba(0,0,0,0.04);
  transition: all 0.2s;
}
.pure-tab-add:hover { background: rgba(0,0,0,0.08); }
.pure-tab-add:active { transform: scale(0.9); }

/* 核心布局区域 */
.pure-main {
  flex: 1;
  overflow-y: auto;
  padding: 24px 24px 100px; 
  background-color: transparent; /* 背景色交由父级 pure-white-bg 控制 */
}

/* 一行四列，拍立得排版 */
.pure-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px 12px;
}

/* 拍立得容器 */
.pure-item.polaroid-style {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  background: transparent;
  padding: 0;
  border: none;
  box-shadow: none;
  width: 100%;
}
.pure-item.polaroid-style:active { transform: scale(0.96); transition: transform 0.1s; }

/* 底层叠放效果 */
.polaroid-base {
  position: absolute;
  top: 3px;
  left: 2px;
  width: 100%;
  height: 100%;
  background: #fff;
  border: 1px solid #eaeaea;
  box-shadow: 2px 2px 8px rgba(0,0,0,0.06);
  transform: rotate(4deg);
  z-index: 1;
}

/* 表层拍立得边框 */
.polaroid-frame {
  position: relative;
  width: 100%;
  background: #fff;
  border: 1px solid #eaeaea;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  padding: 6px 6px 14px 6px;
  z-index: 2;
  display: flex;
  flex-direction: column;
}

/* 相片区域 */
.polaroid-photo {
  width: 100%;
  aspect-ratio: 1 / 1;
  background-color: #f5f5f5;
  position: relative;
  overflow: hidden;
}

/* 底部文字留白区 */
.polaroid-caption {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-height: 32px;
  justify-content: center;
}

.pure-name {
  font-size: 12px;
  font-weight: 700;
  color: #333;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
}

.pure-status-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.status-current {
  font-size: 9px;
  color: #666;
  font-weight: 500;
  background: #f0f0f0;
  padding: 2px 4px;
  border-radius: 2px;
}

.bound-tag {
  font-size: 9px;
  color: #999;
  font-weight: 400;
}

/* 管理模式的悬浮复选框 - 调整到相片右上角 */
.pure-checkbox-float {
  position: absolute;
  top: 4px; right: 4px;
  width: 18px; height: 18px;
  border: 1.5px solid #fff;
  border-radius: 50%;
  background: rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center;
  z-index: 3;
}
.pure-checkbox-float.checked {
  background: #111;
  border-color: #111;
}

/* 极简底部管理栏 */
.pure-manage-bar {
  position: fixed; 
  bottom: 0; left: 0; width: 100%; 
  height: 80px;
  padding: 0 24px;
  padding-bottom: env(safe-area-inset-bottom, 20px);
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(10px);
  border-top: 1px solid #f0f0f0;
  display: flex; 
  align-items: center; 
  justify-content: space-between;
  z-index: 30;
}

.pmb-left { 
  display: flex; align-items: center; gap: 8px; 
  font-size: 14px; color: #111111; cursor: pointer; 
}
.pmb-checkbox { 
  width: 18px; height: 18px; border-radius: 50%; border: 1px solid #cccccc; 
}
.pmb-checkbox.checked { 
  background: #111111; border-color: #111111;
}

.pmb-right {
  display: flex; align-items: center; gap: 24px;
}
.pmb-btn {
  font-size: 14px; color: #111111; font-weight: 500; cursor: pointer;
}
.pmb-btn.del { color: #ff3b30; }
.pmb-btn.disabled { color: #cccccc; pointer-events: none; }

</style>
