/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { useMusicPlayer } from '../../composables/useMusicPlayer'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits(['close'])
const { playlist, currentTrack, playTrack, removeFromQueue, clearQueue } = useMusicPlayer()
</script>

<template>
  <div class="drawer-mask" v-if="visible" @click="emit('close')">
    <div class="drawer-sheet" @click.stop="">
      <div class="drawer-header">
        <div class="header-left">
          <span class="drawer-title">当前播放列表</span>
          <span class="drawer-count">({{ playlist.length }})</span>
        </div>
        <button v-if="playlist.length" class="drawer-clear-btn" @click="clearQueue">清空</button>
        <button class="drawer-close-btn" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="drawer-list">
        <div
          v-for="item in playlist"
          :key="item.id"
          class="track-list-item"
          :class="{ active: currentTrack?.id === item.id }"
          @click="playTrack(item)"
        >
          <div class="play-state-indicator">
            <svg v-if="currentTrack?.id === item.id" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4"/>
            </svg>
          </div>
          <div class="item-title">{{ item.title }}</div>
          <div class="item-artist">- {{ item.artist }}</div>
          <button class="item-remove" title="从队列移除" @click.stop="removeFromQueue(playlist.indexOf(item))">×</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drawer-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 60;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.is-dark .drawer-mask {
  background: rgba(0, 0, 0, 0.65);
}

.drawer-sheet {
  background: var(--music-card-bg, #ffffff);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  border-top: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
}

.is-dark .drawer-sheet {
  background: #202024;
  border-top-color: rgba(255, 255, 255, 0.12);
  box-shadow: none;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--music-divider, rgba(0, 0, 0, 0.06));
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.drawer-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--music-text, #111111);
}

.is-dark .drawer-title {
  color: #ffffff;
}

.drawer-count {
  font-size: 12px;
  color: var(--music-text-sub, #8e8e93);
}

.drawer-close-btn {
  background: none;
  border: none;
  color: var(--music-text-sub, #8e8e93);
  padding: 4px;
  cursor: pointer;
}
.drawer-clear-btn{margin-left:auto;margin-right:8px;padding:5px 9px;border:1px solid var(--music-card-border);border-radius:8px;background:var(--music-pill-bg);color:var(--music-text-sub);font-size:10px}.item-remove{margin-left:auto;width:26px;height:26px;border:0;border-radius:50%;background:var(--music-pill-bg);color:var(--music-text-sub);font-size:16px}

.drawer-list {
  overflow-y: auto;
  padding: 8px 16px 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.track-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  cursor: pointer;
  color: var(--music-text, #333333);
  font-size: 14px;
}

.is-dark .track-list-item {
  color: #d1d1d6;
}

.track-list-item.active {
  color: var(--music-text, #111111);
  font-weight: 700;
}

.is-dark .track-list-item.active {
  color: #ffffff;
}

.play-state-indicator {
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--music-text, #111111);
}

.is-dark .play-state-indicator {
  color: #ffffff;
}

.item-title {
  max-width: 60%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-artist {
  font-size: 12px;
  color: var(--music-text-sub, #8e8e93);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
