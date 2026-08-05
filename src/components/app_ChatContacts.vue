/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatState } from '../composables/useChatState'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { mockChats, switchChat } = useChatState()

const searchQuery = ref('')

// 将现有的聊天列表映射并分组为联系人格式 (此处简单示例，将非系统通知都分到 "A-Z" 中的首字母，暂时统一放在 "我的角色" 分组)
const groupedContacts = computed(() => {
  const filtered = mockChats.value.filter(chat => 
    chat.id !== 1 && // 排除系统通知
    chat.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )

  if (filtered.length === 0) return []

  // 简单粗暴全部放在 "我的角色" 分组，以后可以根据需求扩展拼音首字母排序
  return [
    {
      letter: '我的专属角色',
      items: filtered
    }
  ]
})

const handleContactClick = (contact: any) => {
  switchChat(contact.id)
  emit('close') // 点击后跳转并关闭联系人视图回到主视图（消息列表会自动显示聊天室）
}
</script>

<template>
  <div class="view-container with-tabbar">
    <header class="navbar glass-header">
      <div class="nav-left" style="width: auto; flex: 1;">
        <span class="title-fancy" @click="emit('close')">
          <span class="en">Contacts</span>
        </span>
      </div>
      <div class="nav-center"></div>
      <div class="nav-right">
      </div>
    </header>

    <main class="contacts-main">
      <div class="contacts-search">
        <div class="search-bar-cool">
          <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" class="search-input" v-model="searchQuery" placeholder="搜索联系人..." />
        </div>
      </div>

      <div class="contacts-actions">
        <div class="contact-action-item">
          <div class="action-icon-wrap" style="background: var(--sys-bg-primary);">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#555555" stroke-width="2" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle></svg>
          </div>
          <span class="action-text">新的朋友</span>
        </div>
        <div class="contact-action-item">
          <div class="action-icon-wrap" style="background: var(--sys-bg-primary);">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#555555" stroke-width="2" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <span class="action-text">群聊</span>
        </div>
        <div class="contact-action-item">
          <div class="action-icon-wrap" style="background: var(--sys-bg-primary);">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#555555" stroke-width="2" fill="none"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
          </div>
          <span class="action-text">标签</span>
        </div>
      </div>

      <div class="contacts-list">
        <div v-for="group in groupedContacts" :key="group.letter" class="contact-group">
          <div class="group-letter">{{ group.letter }}</div>
          <div v-for="contact in group.items" :key="contact.id" class="contact-item" @click="handleContactClick(contact)">
            <div class="contact-avatar" :style="contact.avatarUrl ? { backgroundImage: `url(${contact.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : {}">{{ contact.avatarUrl ? '' : (contact.avatarText || '伴') }}</div>
            <div class="contact-info">
              <span class="contact-name">{{ contact.name }}</span>
            </div>
          </div>
        </div>
        
        <div v-if="groupedContacts.length === 0" style="text-align: center; padding: 40px 20px; color: var(--text-tertiary); font-size: 13px;">
          暂无联系人数据
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.view-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; z-index: 1; }
.with-tabbar { height: 100%; padding-bottom: 90px; }

/* 玻璃态 */
.glass-header { background: var(--sys-bg-secondary); border-bottom: 1px solid var(--border-color)eee; z-index: 20; }

/* ================= 顶栏 ================= */
.navbar { height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; padding-top: env(safe-area-inset-top, 20px); flex-shrink: 0; }
.nav-left, .nav-right { width: 60px; display: flex; align-items: center; }
.nav-right { justify-content: flex-end; }
.nav-center { flex: 1; display: flex; align-items: center; justify-content: center; }

/* 高级整洁标题样式 */
.title-fancy { display: flex; align-items: baseline; gap: 5px; cursor: pointer; user-select: none; }
.title-fancy .en { font-size: 22px; font-weight: 600; color: var(--text-primary); letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; }

.icon-btn { color: var(--text-primary); display: flex; align-items: center; justify-content: center; cursor: pointer; }

/* ================= 联系人视图 (Contacts) ================= */
.contacts-main { flex: 1; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; }
.contacts-search { padding: 12px 20px; background: var(--sys-bg-secondary); }
.search-bar-cool { height: 36px; border-radius: 8px; background: var(--sys-bg-primary); display: flex; align-items: center; padding: 0 12px; gap: 8px; }
.search-bar-cool .search-icon { color: var(--text-tertiary); }
.search-bar-cool .search-input { flex: 1; background: transparent; border: none; outline: none; font-size: 14px; color: var(--text-primary); }
.search-bar-cool .search-input::placeholder { color: var(--text-tertiary); }

.contacts-actions { padding: 8px 20px 16px; display: flex; flex-direction: column; gap: 16px; border-bottom: 8px solid #f5f5f5; }
.contact-action-item { display: flex; align-items: center; gap: 16px; cursor: pointer; }
.action-icon-wrap { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #e0e0e0; box-shadow: inset 0 2px 4px rgba(255,255,255,0.8), 0 2px 6px rgba(0,0,0,0.02); }
.action-text { font-size: 15px; font-weight: 500; color: #1a1a1a; }

.contacts-list { display: flex; flex-direction: column; }
.contact-group { display: flex; flex-direction: column; }
.group-letter { padding: 6px 20px; font-size: 12px; font-weight: 600; color: var(--text-tertiary); background: var(--sys-bg-primary); position: sticky; top: 0; z-index: 10; border-top: 1px solid var(--border-color)eee; border-bottom: 1px solid var(--border-color)eee; }
.contact-item { display: flex; align-items: center; gap: 16px; padding: 12px 20px; cursor: pointer; transition: background 0.2s; background: var(--sys-bg-secondary); }
.contact-item:hover { background: #f8f8f8; }
.contact-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--sys-bg-primary); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600; color: var(--text-primary); flex-shrink: 0; border: 2px solid transparent; background-clip: padding-box; box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #e1e1e1; margin: 2px; }
.contact-info { flex: 1; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: -12px; display: flex; align-items: center; margin-left: 4px; }
.contact-group .contact-item:last-child .contact-info { border-bottom: none; }
.contact-name { font-size: 15px; color: #1a1a1a; font-weight: 500; }
</style>
