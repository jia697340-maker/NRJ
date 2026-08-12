/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { chatSettings } from '../../../store'

const props = defineProps<{
  selectedChat: any
  currentChatWallpaper: string | null
  matchSearch: (...keywords: (string | undefined | null)[]) => boolean
}>()

const emit = defineEmits<{
  (e: 'show-transfer-preview'): void
  (e: 'show-bubble-beautify-modal'): void
  (e: 'show-avatar-display-modal'): void
  (e: 'show-name-display-modal'): void
  (e: 'show-time-display-modal'): void
  (e: 'trigger-wallpaper-upload'): void
  (e: 'clear-wallpaper'): void
  (e: 'save'): void
}>()

const handleSave = () => {
  emit('save')
}
</script>

<template>
  <div class="role-edit-section">
    <div class="glass-panel" v-show="matchSearch('红包与转账气泡风格')">
      <div class="glass-list-item" v-show="matchSearch('红包与转账气泡风格')" @click="emit('show-transfer-preview')">
        <div class="item-label">红包与转账气泡风格</div>
        <div class="item-value"><span class="item-value-text">{{ chatSettings.transferStyle === 'glass' ? '现代毛玻璃流体' : (chatSettings.transferStyle === 'ticket' ? '立式票据凭证' : '仿微信') }}</span><span class="arrow">></span></div>
      </div>
    </div>
      
    <div class="glass-panel" v-show="matchSearch('气泡美化', '思维链美化')">
      <div class="glass-list-item" v-show="matchSearch('气泡美化')" @click="emit('show-bubble-beautify-modal')">
        <div class="item-label">气泡美化</div>
        <div class="item-value">
          <span class="item-value-text">设置颜色与背景图</span>
          <span class="arrow">></span>
        </div>
      </div>
      
      <div class="glass-list-item" style="flex-direction: column; align-items: flex-start; padding: 12px 16px;" v-show="matchSearch('思维链美化')">
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <div class="item-label">思维链与正文合并</div>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" :checked="chatSettings.cotInSameBubble" @change="(e) => { chatSettings.cotInSameBubble = (e.target as HTMLInputElement).checked; handleSave(); }">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px; line-height: 1.4;">
          关闭时，思考过程将独立显示为简洁的虚线区块
        </div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('对话头像显示', '对话昵称显示', '对话时间显示')">
      <div class="glass-list-item" v-show="matchSearch('对话头像显示')" @click="emit('show-avatar-display-modal')">
        <div class="item-label">对话头像显示</div>
        <div class="item-value">
          <span class="item-value-text">
            {{ chatSettings.avatarDisplayStyle === 'user_only' ? '只显示用户头像' : (chatSettings.avatarDisplayStyle === 'character_only' ? '只显示角色头像' : (chatSettings.avatarDisplayStyle === 'none' ? '不显示双方头像' : '都显示双方头像')) }}
          </span>
          <span class="arrow">></span>
        </div>
      </div>

      <div class="glass-list-item" v-show="matchSearch('对话昵称显示')" @click="emit('show-name-display-modal')">
        <div class="item-label">对话昵称显示</div>
        <div class="item-value">
          <span class="item-value-text">
            {{ chatSettings.nameDisplayStyle === 'user_only' ? '只显示用户昵称' : (chatSettings.nameDisplayStyle === 'character_only' ? '只显示角色昵称' : (chatSettings.nameDisplayStyle === 'none' ? '不显示双方昵称' : '都显示双方昵称')) }}
          </span>
          <span class="arrow">></span>
        </div>
      </div>

      <div class="glass-list-item" v-show="matchSearch('对话时间显示')" @click="emit('show-time-display-modal')">
        <div class="item-label">对话时间显示</div>
        <div class="item-value">
          <span class="item-value-text">
            {{ chatSettings.timeDisplayStyle === 'none' ? '不显示' : (chatSettings.timeDisplayStyle === 'hm' ? '时分' : '时分秒') }}
          </span>
          <span class="arrow">></span>
        </div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('显示回复耗时', '显示系统内部旁白', '系统旁白')">
      <div class="glass-list-item" v-show="matchSearch('显示回复耗时')">
        <div class="item-label">显示回复耗时</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" :checked="selectedChat.showCostTime !== false" @change="(e) => { selectedChat.showCostTime = (e.target as HTMLInputElement).checked; handleSave(); }">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <div class="glass-list-item" style="flex-direction: column; align-items: flex-start; padding: 12px 16px;" v-show="matchSearch('显示系统内部旁白', '系统旁白')">
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <div class="item-label">显示系统内部旁白</div>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="chatSettings.showSystemNarration">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px; line-height: 1.4;">
          朋友圈读取、通话衔接等内部上下文默认隐藏
        </div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('专属聊天背景', '清除背景')">
      <div class="glass-list-item" v-show="matchSearch('专属聊天背景')" @click="emit('trigger-wallpaper-upload')">
        <div class="item-label">专属聊天背景</div>
        <div class="item-value">
          <span class="item-value-text" :style="{ color: currentChatWallpaper ? 'var(--text-primary)' : 'var(--text-tertiary)' }">{{ currentChatWallpaper ? '已设置' : '未设置' }}</span>
          <span class="arrow">></span>
        </div>
      </div>
      <div v-if="currentChatWallpaper" class="glass-list-item" v-show="matchSearch('清除背景')" @click="emit('clear-wallpaper')">
        <div class="item-label" style="color: #FF4D4F; width: 100%; text-align: center;">清除背景</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './ChatSettingsStyles.css';
</style>
