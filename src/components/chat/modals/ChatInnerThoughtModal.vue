<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useChatState } from '../../../composables/useChatState'
import { useChatSettingsSave } from '../../../composables/useChatSettingsSave'
import TextEditModal from '../../TextEditModal.vue'
import LongTextEditModal from '../../LongTextEditModal.vue'

const props = defineProps<{ visible: boolean; chat?: any }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'save'): void }>()
const { selectedChat, mockChats } = useChatState()
const { saveCurrentChat } = useChatSettingsSave()
const activeChat = computed(() => props.chat || selectedChat.value)
const persist = () => props.chat ? emit('save') : saveCurrentChat()

const isGroup = computed(() => activeChat.value?.chatType === 'group')
const selectedMemberId = ref<string | null>(null)

const groupMembers = computed(() => {
  if (!isGroup.value) return []
  return activeChat.value?.memberIds?.map((id: string) => {
    return mockChats.value.find(c => c.chatType !== 'group' && String(c.characterEntityId || c.id) === id)
  }).filter(Boolean) || []
})

const currentThoughtsArray = computed(() => {
  if (!activeChat.value) return []
  if (isGroup.value) {
    if (selectedMemberId.value) {
      return activeChat.value.memberInnerThoughts?.[selectedMemberId.value] || []
    }
    return []
  }
  return activeChat.value.innerThoughts || []
})

const realDaysKnown = computed(() => {
  const messages = activeChat.value?.messages
  if (!messages?.length) return 1
  const firstTime = messages[0].id > 1000000000000 ? messages[0].id : Date.now()
  return Math.floor(Math.max(0, Date.now() - firstTime) / (1000 * 60 * 60 * 24)) + 1
})

const daysKnown = computed(() => {
  const offset = activeChat.value?.daysOffset || 0
  return realDaysKnown.value + offset
})

const showDaysEditModal = ref(false)

const handleDaysSaved = (newVal: string) => {
  const num = parseInt(newVal, 10)
  if (!isNaN(num) && activeChat.value) {
    activeChat.value.daysOffset = num - realDaysKnown.value
    persist()
  }
}

const currentIndex = ref(0)
const currentThought = computed(() => currentThoughtsArray.value[currentIndex.value] ?? null)
const thoughtCount = computed(() => currentThoughtsArray.value.length)

const showContentEditModal = ref(false)

const handleContentSaved = (newVal: string) => {
  const arr = isGroup.value ? activeChat.value?.memberInnerThoughts?.[selectedMemberId.value!] : activeChat.value?.innerThoughts
  if (arr && currentThought.value) {
    arr[currentIndex.value].content = newVal
    persist()
  }
}

const effectiveAvatarUrl = computed(() => {
  if (isGroup.value && selectedMemberId.value) {
    const member = groupMembers.value.find(m => String(m.characterEntityId || m.id) === selectedMemberId.value)
    return member?.avatarUrl || ''
  }
  return currentThought.value?.senderAvatar || activeChat.value?.avatarUrl
})
const effectiveAvatarText = computed(() => {
  if (isGroup.value && selectedMemberId.value) {
    const member = groupMembers.value.find(m => String(m.characterEntityId || m.id) === selectedMemberId.value)
    return member?.name?.charAt(0) || '?'
  }
  return currentThought.value?.senderName?.charAt(0) || activeChat.value?.avatarText || '?'
})

const effectiveName = computed(() => {
  if (isGroup.value && selectedMemberId.value) {
    const member = groupMembers.value.find(m => String(m.characterEntityId || m.id) === selectedMemberId.value)
    return activeChat.value?.memberNicknames?.[selectedMemberId.value] || member?.name || '群成员'
  }
  return currentThought.value?.senderName || activeChat.value?.remark || activeChat.value?.name
})
const hasPrevious = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value < thoughtCount.value - 1)

const nextThought = () => { if (hasNext.value) currentIndex.value++ }
const prevThought = () => { if (hasPrevious.value) currentIndex.value-- }

const isManageMode = ref(false)
const selectedThoughts = ref<Set<string | number>>(new Set())

const isAllSelected = computed(() => thoughtCount.value > 0 && selectedThoughts.value.size === thoughtCount.value)

const toggleSelect = (idx: string | number) => {
  if (selectedThoughts.value.has(idx)) {
    selectedThoughts.value.delete(idx)
  } else {
    selectedThoughts.value.add(idx)
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedThoughts.value.clear()
  } else {
    selectedThoughts.value = new Set(currentThoughtsArray.value.map((_: any, i: number) => i) || [])
  }
}

const executeDelete = (indexes: number[]) => {
  if (!activeChat.value) return
  
  const arr = isGroup.value ? activeChat.value.memberInnerThoughts?.[selectedMemberId.value!] : activeChat.value.innerThoughts
  if (!arr) return
  
  const sorted = [...indexes].sort((a, b) => b - a)
  for (const idx of sorted) {
    arr.splice(idx, 1)
  }
  
  if (currentIndex.value >= (arr.length || 0)) {
    currentIndex.value = Math.max(0, (arr.length || 0) - 1)
  }
  
  selectedThoughts.value.clear()
  persist()
  
  if (arr.length === 0) {
    isManageMode.value = false
  }
}

const deleteCurrent = () => executeDelete([currentIndex.value])
const deleteSelected = () => executeDelete(Array.from(selectedThoughts.value, value => Number(value)))

watch(() => props.visible, (visible) => {
  if (visible) {
    currentIndex.value = 0
    isManageMode.value = false
    selectedThoughts.value.clear()
    selectedMemberId.value = null
  }
})
</script>

<template>
  <transition name="elegant-fade">
    <div v-if="visible" class="elegant-overlay" @click="emit('close')" @touchmove.prevent>
      <div class="modal-shell" @click.stop>
        
        <!-- 绝对定位的右上角关闭按钮 -->
        <button class="top-close-btn" @click="emit('close')" aria-label="关闭">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <!-- 群聊成员选择视图 -->
        <div v-if="isGroup && !selectedMemberId" class="group-member-selection-card">
          <div class="selection-header">查看谁的心声？</div>
          <div class="selection-grid">
            <div v-for="member in groupMembers" :key="member.id" class="member-item" @click="selectedMemberId = String(member.characterEntityId || member.id); currentIndex = 0">
              <div class="stamp-bg selection-stamp">
                <div class="stamp-inner selection-stamp-inner">
                  <img v-if="member.avatarUrl" :src="member.avatarUrl" class="avatar-img" />
                  <div v-else class="avatar-text-fallback">{{ member.name?.charAt(0) || '?' }}</div>
                </div>
              </div>
              <div class="member-name">{{ activeChat?.memberNicknames?.[String(member.characterEntityId || member.id)] || member.name }}</div>
            </div>
          </div>
        </div>

        <template v-else>
        <!-- 头像节点提取到了外部，作为 shell 的绝对定位层 -->
        <!-- 头像节点提取到了外部，作为 shell 的绝对定位层 -->
        <div v-if="activeChat" class="avatar-wrapper-outer">
          <svg class="paperclip-svg" viewBox="0 0 1280 1280" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="metal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#b3b3b3" />
                <stop offset="30%" stop-color="#eeeeee" />
                <stop offset="70%" stop-color="#888888" />
                <stop offset="100%" stop-color="#555555" />
              </linearGradient>
            </defs>
            <g transform="translate(0,1280) scale(0.1,-0.1)" fill="url(#metal-grad)" stroke="none">
              <path d="M2800 12679 c-282 -20 -586 -121 -833 -277 -380 -238 -672 -558 -857 -937 -111 -225 -159 -393 -181 -624 -26 -272 40 -576 179 -821 48 -85 5566 -8598 5733 -8845 271 -400 570 -673 934 -852 584 -286 1260 -251 1968 103 169 85 240 128 382 234 621 461 981 960 1103 1530 24 115 26 144 27 355 0 248 -7 299 -66 522 -54 206 -165 461 -292 669 -30 49 -391 607 -803 1239 -413 633 -1395 2142 -2183 3355 -1045 1607 -1447 2218 -1483 2252 -189 182 -538 23 -540 -246 0 -42 6 -78 20 -108 18 -41 1534 -2376 3684 -5676 406 -623 758 -1168 783 -1211 105 -183 195 -407 232 -581 14 -66 18 -128 17 -280 0 -177 -3 -204 -26 -290 -49 -181 -135 -350 -268 -528 -129 -174 -415 -434 -640 -584 -165 -109 -437 -233 -630 -287 -207 -57 -465 -72 -643 -37 -361 70 -687 301 -969 686 -94 128 -5754 8862 -5792 8938 -20 39 -48 111 -63 159 -23 78 -26 104 -26 233 0 188 25 289 118 475 177 354 508 655 846 769 222 74 491 75 708 1 167 -56 342 -177 451 -310 77 -93 4329 -6652 4396 -6780 163 -310 158 -541 -16 -715 -98 -98 -320 -237 -450 -282 -218 -75 -444 16 -625 252 -23 30 -644 987 -1380 2125 -1519 2350 -1500 2322 -1551 2363 -111 92 -296 81 -411 -23 -96 -86 -137 -220 -101 -327 16 -44 2808 -4374 2907 -4508 201 -269 455 -442 731 -497 98 -19 301 -19 411 1 257 46 571 203 801 400 265 226 418 544 418 864 0 229 -81 515 -210 744 -70 123 -4301 6647 -4371 6738 -229 302 -568 512 -950 590 -89 18 -311 42 -364 38 -11 0 -67 -4 -125 -9z"/>
            </g>
          </svg>
          <div class="stamp-bg">
            <div class="stamp-inner">
              <img v-if="effectiveAvatarUrl" :src="effectiveAvatarUrl" class="avatar-img" />
              <div v-else class="avatar-text-fallback">{{ effectiveAvatarText }}</div>
            </div>
          </div>
        </div>

        <article class="thought-card">
          <div class="scrollable-content">
            <header v-if="activeChat" class="profile-header">
              <div class="profile-info">
                <div class="char-name">{{ effectiveName }}</div>
                <div class="char-signature clickable-days" @click="showDaysEditModal = true" title="点击修改天数">
                  相识第 {{ daysKnown }} 天
                </div>
              </div>
            </header>

            <main class="thought-content-area">
              <template v-if="!isManageMode">
                <div v-if="currentThought" class="text-content">{{ currentThought.content }}</div>
                <div v-else class="empty-thought-state">当前还没有任何心声</div>
              </template>
              <template v-else>
                <div v-if="thoughtCount > 0" class="thought-list">
                  <div v-for="(t, idx) in currentThoughtsArray" :key="t.id || idx" class="thought-list-item" @click="toggleSelect(idx)">
                    <div class="checkbox" :class="{ 'is-checked': selectedThoughts.has(idx) }">
                      <svg v-if="selectedThoughts.has(idx)" viewBox="0 0 24 24" width="14" height="14" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div class="thought-list-text">{{ t.content }}</div>
                  </div>
                </div>
                <div v-else class="empty-thought-state">没有可管理的心声</div>
              </template>
            </main>
          </div>
        </article>

        <!-- All system controls live outside the card so custom HTML themes can place them freely. -->
        <nav class="external-controls" aria-label="心声操作">
          <template v-if="!isManageMode">
            <div class="action-group">
              <button v-if="isGroup" class="external-button icon-button" @click="selectedMemberId = null" title="返回">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button class="external-button icon-button" :disabled="thoughtCount === 0" @click="isManageMode = true" title="管理心声">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              </button>
              <button class="external-button icon-button" :disabled="thoughtCount === 0" @click="showContentEditModal = true" title="编辑内容">
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button class="external-button icon-button" :disabled="thoughtCount === 0" @click="deleteCurrent" title="删除当前">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>

            <div class="action-group" v-if="thoughtCount > 0">
              <button class="external-button icon-button" :disabled="!hasPrevious" aria-label="上一条心声" @click="prevThought">
                <svg viewBox="0 0 24 24" width="19" height="19" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <span class="page-number">{{ currentIndex + 1 }} / {{ thoughtCount }}</span>
              <button class="external-button icon-button" :disabled="!hasNext" aria-label="下一条心声" @click="nextThought">
                <svg viewBox="0 0 24 24" width="19" height="19" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </template>

          <template v-else>
            <div class="action-group">
               <button class="external-button text-button" @click="toggleSelectAll">{{ isAllSelected ? '取消全选' : '全选' }}</button>
               <button class="external-button text-button" style="color: #ff8e8e;" :disabled="selectedThoughts.size === 0" @click="deleteSelected">删除 ({{ selectedThoughts.size }})</button>
            </div>
            <div class="action-group">
              <button class="external-button text-button primary-text-btn" @click="isManageMode = false">完成</button>
            </div>
          </template>
        </nav>
        </template>
      </div>
    </div>
  </transition>

  <!-- 天数修改弹窗 -->
  <TextEditModal
    v-if="activeChat"
    v-model:visible="showDaysEditModal"
    title="修改相识天数"
    :current-text="String(daysKnown)"
    :default-text="String(realDaysKnown)"
    placeholder="请输入整数"
    @saved="handleDaysSaved"
  />

  <!-- 内容编辑弹窗 -->
  <LongTextEditModal
    v-if="activeChat && currentThought"
    v-model:visible="showContentEditModal"
    title="编辑心声"
    :current-text="currentThought.content"
    :default-text="currentThought.content"
    placeholder="输入心声内容..."
    @saved="handleContentSaved"
  />
</template>

<style scoped>
.elegant-fade-enter-active, .elegant-fade-leave-active { transition: opacity .25s ease; }
.elegant-fade-enter-from, .elegant-fade-leave-to { opacity: 0; }

.elegant-overlay {
  position: absolute;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(26, 26, 28, .54);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.modal-shell {
  position: relative;
  height: 82vh;
  max-height: 800px;
  aspect-ratio: 9 / 16;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-left: 10px; /* 让整个结构稍微往右靠一点，留出左侧空间给悬空头像 */
}
.thought-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 恢复日记本卡片内部溢出隐藏，避免影响滚动和背景 */
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 16px 42px rgba(0, 0, 0, .22), inset 0 0 1px 1px rgba(0, 0, 0, 0.05);
}

/* 提取到最外层的头像样式，利用绝对定位破除任何容器束缚 */
.avatar-wrapper-outer {
  position: absolute;
  left: -25px; 
  top: 15px;
  width: 90px; 
  height: 90px;
  display: grid;
  place-items: center;
  transform: rotate(10deg);
  z-index: 100; /* 绝对在最高层级 */
}
.stamp-bg {
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(255,255,255,0) 3px, #fff 3.5px);
  background-size: 10px 10px;
  background-position: -5px -5px;
  display: grid;
  place-items: center;
  filter: drop-shadow(-2px 4px 6px rgba(0, 0, 0, .2));
}
.stamp-inner {
  width: 80px;
  height: 80px;
  background: #fff;
  display: grid;
  place-items: center;
  padding: 4px;
  box-sizing: border-box;
}
.paperclip-svg { 
  position: absolute; 
  top: -24px; /* 往上提，使其明显超出横线 */
  left: 50%; /* 居中定位起点 */
  transform: translateX(-50%) rotate(20deg); /* 居中对齐，并保持一个自然的小幅度倾斜，避免太死板 */
  width: 32px; /* 稍微放大一点点让金属质感更好展示 */
  height: 32px; 
  z-index: 2; 
  filter: drop-shadow(2px 3px 4px rgba(0,0,0,0.35)) drop-shadow(0px 1px 1px rgba(255,255,255,0.4)); /* 增强阴影深度并模拟边缘高光 */
  pointer-events: none; 
}
.scrollable-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: visible;
  scrollbar-width: none;
  padding: 24px 24px;
  background-image: repeating-linear-gradient(
    transparent,
    transparent 31px,
    #e4e4e4 31px,
    #e4e4e4 32px
  );
  background-attachment: local;
  background-position: 0 -2px;
}
.scrollable-content::-webkit-scrollbar { display: none; }
.profile-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-text-fallback { color: #999; font: 28px "STKaiti", "KaiTi", serif; }
.profile-info { display: grid; gap: 6px; margin-left: 62px; /* 根据左侧抽出的头像大小进行避让 */ }
.char-name { color: #333; font: 600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.char-signature { color: #888; font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: .5px; }
.clickable-days { cursor: pointer; text-decoration: underline dashed rgba(136, 136, 136, 0.4); text-underline-offset: 3px; transition: color 0.2s; }
.clickable-days:hover { color: #555; text-decoration-color: rgba(85, 85, 85, 0.6); }
.thought-content-area { min-height: 136px; margin-top: 56px; margin-bottom: 22px; }
.text-content { color: #404040; white-space: pre-wrap; text-align: justify; letter-spacing: 1px; font: 15px/32px "STKaiti", "KaiTi", "Songti SC", Georgia, serif; }
.empty-thought-state { display: grid; min-height: 136px; place-items: center; color: #a0a0a0; font: 16px "STKaiti", "KaiTi", serif; }

/* 列表管理样式 */
.thought-list { display: flex; flex-direction: column; gap: 12px; padding-bottom: 20px; }
.thought-list-item { display: flex; gap: 12px; padding: 12px; background: rgba(0, 0, 0, 0.03); border-radius: 12px; cursor: pointer; transition: background 0.2s; }
.thought-list-item:active { background: rgba(0, 0, 0, 0.06); }
.checkbox { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid #ccc; display: grid; place-items: center; flex-shrink: 0; margin-top: 2px; transition: all 0.2s; }
.checkbox.is-checked { background: #333; border-color: #333; }
.thought-list-text { color: #404040; font: 14px/24px "STKaiti", "KaiTi", "Songti SC", Georgia, serif; text-align: justify; white-space: pre-wrap; word-break: break-all; }

/* 外部控制区样式重构：取消绝对定位，改用自然间距排列防止重叠 */
.external-controls { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; min-height: 38px; padding: 0 2px; }
.action-group { display: flex; align-items: center; gap: 6px; }
.external-button { display: grid; place-items: center; border: 0; color: #fff; background: rgba(255, 255, 255, .14); cursor: pointer; transition: background .18s ease, transform .18s ease; }
.external-button:hover:not(:disabled) { background: rgba(255, 255, 255, .25); }
.external-button:active:not(:disabled) { transform: scale(.95); }
.external-button:disabled { opacity: .35; cursor: default; }
.icon-button { width: 34px; height: 34px; border-radius: 50%; }
.text-button { padding: 0 12px; height: 32px; border-radius: 16px; font-size: 13px; letter-spacing: 1px; }
.primary-text-btn { background: rgba(255, 255, 255, 0.25); font-weight: 500; }
.page-number { min-width: 44px; color: rgba(255, 255, 255, .92); text-align: center; font: 14px Georgia, serif; letter-spacing: .5px; }

/* 右上角关闭按钮 */
.top-close-btn { position: absolute; top: -38px; right: 0; width: 34px; height: 34px; border: 0; border-radius: 50%; background: rgba(255, 255, 255, 0.14); color: #fff; display: grid; place-items: center; cursor: pointer; transition: background 0.18s ease, transform 0.18s ease; z-index: 100; }
.top-close-btn:hover { background: rgba(255, 255, 255, 0.25); }
.top-close-btn:active { transform: scale(0.95); }

/* 群聊成员选择视图 */
.group-member-selection-card { flex: 1; display: flex; flex-direction: column; gap: 40px; justify-content: center; padding: 24px 0; }
.selection-header { font-size: 19px; font-weight: 600; color: #fff; text-align: center; letter-spacing: 1px; text-shadow: 0 2px 8px rgba(0,0,0,0.5); }
.selection-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px 16px; overflow-y: auto; scrollbar-width: none; padding-bottom: 24px; }
.selection-grid::-webkit-scrollbar { display: none; }
.member-item { display: flex; flex-direction: column; align-items: center; gap: 12px; cursor: pointer; transition: transform 0.2s; }
.member-item:active { transform: scale(0.95); }
.selection-stamp { width: 70px; height: 70px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3)); transform: rotate(0deg); transition: transform 0.3s; }
.member-item:hover .selection-stamp { transform: rotate(5deg) scale(1.05); }
.selection-stamp-inner { width: 62px; height: 62px; }
.member-name { font-size: 14px; color: rgba(255,255,255,0.95); text-align: center; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; overflow: hidden; word-break: break-all; width: 100%; text-shadow: 0 1px 4px rgba(0,0,0,0.5); }
</style>
