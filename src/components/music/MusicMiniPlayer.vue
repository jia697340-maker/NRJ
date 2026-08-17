/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { useMusicPlayer } from '../../composables/useMusicPlayer'

const { currentTrack, isPlaying, isBuffering, togglePlay } = useMusicPlayer()
const emit = defineEmits(['openFullPlayer', 'openPlaylistDrawer'])
</script>

<template>
  <div class="mini-player-bar" @click="emit('openFullPlayer')">
    <!-- 左侧微型旋转黑胶封面 -->
    <div class="mini-disc-box" :class="{ 'is-rotating': isPlaying }" :style="currentTrack?.coverUrl ? { backgroundImage: `url(${currentTrack.coverUrl})`, backgroundSize: 'cover' } : {}">
      <div class="mini-disc-groove"></div>
      <div class="mini-disc-center">
        <svg viewBox="0 0 40 40" width="100%" height="100%" fill="none">
          <circle cx="20" cy="20" r="18" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
          <line x1="20" y1="6" x2="20" y2="34" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
          <line x1="6" y1="20" x2="34" y2="20" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
        </svg>
      </div>
    </div>

    <!-- 中间曲目与歌手信息 -->
    <div class="mini-meta-info">
      <span class="mini-track-title">{{ isBuffering ? '正在缓冲…' : (currentTrack?.title || '未在播放') }}</span>
      <span class="mini-track-divider">-</span>
      <span class="mini-artist-name">{{ currentTrack?.artist || '独奏' }}</span>
    </div>

    <!-- 右侧播放/暂停与列表按钮 -->
    <div class="mini-action-group" @click.stop="">
      <button class="mini-play-btn" @click="togglePlay" :title="isPlaying ? '暂停' : '播放'">
        <svg v-if="isPlaying" viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none">
          <line x1="10" y1="4" x2="10" y2="20"></line>
          <line x1="14" y1="4" x2="14" y2="20"></line>
          <circle cx="12" cy="12" r="11" stroke-width="1.2"></circle>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none">
          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
          <circle cx="12" cy="12" r="11" stroke-width="1.2"></circle>
        </svg>
      </button>

      <button class="mini-list-btn" @click="emit('openPlaylistDrawer')" title="播放列表">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.mini-player-bar {
  position: absolute;
  bottom: 58px;
  left: 12px;
  right: 12px;
  height: 48px;
  background: var(--music-glass-bg, rgba(255, 255, 255, 0.94));
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  border-radius: 24px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  padding: 0 12px 0 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  z-index: 40;
  transition: transform 0.2s, background 0.25s, border-color 0.25s;
}

.is-dark .mini-player-bar {
  background: rgba(30, 30, 34, 0.96);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.mini-player-bar:active {
  transform: scale(0.99);
}

.mini-disc-box {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #252529;
  border: 2px solid #3a3a42;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.mini-disc-box.is-rotating {
  animation: mini-rotate 18s linear infinite;
}

@keyframes mini-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.mini-disc-center {
  width: 60%;
  height: 60%;
  border-radius: 50%;
  background: #3a3a40;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-meta-info {
  flex: 1;
  min-width: 0;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-track-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--music-text, #111111);
  overflow: hidden;
  text-overflow: ellipsis;
}

.is-dark .mini-track-title {
  color: #ffffff;
}

.mini-track-divider {
  font-size: 12px;
  color: var(--music-text-muted, #71717a);
}

.mini-artist-name {
  font-size: 12px;
  color: var(--music-text-sub, #666666);
  overflow: hidden;
  text-overflow: ellipsis;
}

.is-dark .mini-artist-name {
  color: #a1a1a6;
}

.mini-action-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mini-play-btn,
.mini-list-btn {
  background: none;
  border: none;
  color: var(--music-text, #1c1c1e);
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.is-dark .mini-play-btn,
.is-dark .mini-list-btn {
  color: #e5e5ea;
}
</style>
