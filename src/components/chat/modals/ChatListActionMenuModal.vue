/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  activeMenuChat: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toggle-unread', chat: any): void
  (e: 'toggle-pin', chat: any): void
  (e: 'enter-multi-select'): void
  (e: 'delete', chat: any): void
}>()
</script>

<template>
  <div class="canvas-modal-overlay action-menu-overlay" @click.self="emit('close')" @contextmenu.prevent>
    <div class="action-menu-content">
      <div class="action-menu-header">
        <div class="am-avatar" :style="activeMenuChat.avatarUrl ? { backgroundImage: `url(${activeMenuChat.avatarUrl})` } : {}">{{ activeMenuChat.avatarUrl ? '' : activeMenuChat.avatarText }}</div>
        <div class="am-name">{{ activeMenuChat.name }}</div>
      </div>
      <div class="action-menu-list">
        <div class="am-item" @click="emit('toggle-unread', activeMenuChat)">
          <span>{{ activeMenuChat.unread > 0 ? '标为已读' : '标为未读' }}</span>
        </div>
        <div class="am-item" @click="emit('toggle-pin', activeMenuChat)">
          <span>{{ activeMenuChat.isPinned ? '取消置顶' : '置顶聊天' }}</span>
        </div>
        <div class="am-item" @click="emit('enter-multi-select')">
          <span>多选</span>
        </div>
        <div class="am-item danger" @click="emit('delete', activeMenuChat)">
          <span>删除角色</span>
        </div>
      </div>
      <div class="am-cancel" @click="emit('close')">取消</div>
    </div>
  </div>
</template>

<style scoped>
.action-menu-overlay {
  background: rgba(0,0,0,0.4);
  align-items: flex-end;
  padding-bottom: 24px;
  z-index: 9999;
}
.action-menu-content {
  width: 90%;
  background: var(--sys-bg-primary);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
}
.action-menu-header {
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  background: var(--sys-bg-secondary);
}
.am-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--sys-bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--text-secondary);
  background-size: cover;
  background-position: center;
  margin-bottom: 8px;
}
.am-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}
.action-menu-list {
  background: var(--sys-bg-secondary);
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}
.am-item {
  padding: 16px;
  text-align: center;
  font-size: 16px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
}
.am-item:active {
  background: var(--sys-bg-primary);
}
.am-item.danger {
  color: #ff3b30;
}
.am-cancel {
  background: var(--sys-bg-secondary);
  padding: 16px;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
}
.am-cancel:active {
  background: var(--sys-bg-primary);
}
.canvas-modal-overlay {
  z-index: 9999;
}
</style>
