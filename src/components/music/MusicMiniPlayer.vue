/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { useMusicPlayer } from '../../composables/useMusicPlayer'

const { currentTrack, isPlaying, isBuffering, togglePlay } = useMusicPlayer()
const emit = defineEmits(['openFullPlayer', 'openPlaylistDrawer'])
</script>

<template>
  <div class="mini-player-bar" @click="emit('openFullPlayer')">
    <!-- 左侧微型旋转黑胶封面 -->
    <div class="mini-disc-box" :class="{ 'is-rotating': isPlaying }">
      <div v-if="currentTrack?.coverUrl" class="mini-disc-cover" :style="{ backgroundImage: `url(${currentTrack.coverUrl})` }"></div>
      <div v-else class="mini-disc-placeholder">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" fill="currentColor" />
          <circle cx="18" cy="16" r="3" fill="currentColor" />
        </svg>
      </div>
      <!-- 黑胶中心金属轴孔光泽 -->
      <div class="mini-disc-pin"></div>
    </div>

    <!-- 中间曲目与歌手信息 -->
    <div class="mini-meta-info">
      <div class="mini-track-row">
        <span class="mini-track-title">{{ isBuffering ? '正在缓冲…' : (currentTrack?.title || '暂无播放歌曲') }}</span>
      </div>
      <div class="mini-artist-row">
        <span class="mini-artist-name">{{ currentTrack?.artist || '点击选择歌曲' }}</span>
      </div>
    </div>

    <!-- 右侧操作按钮组 -->
    <div class="mini-action-group" @click.stop="">
      <!-- 播放/暂停精致圆钮 -->
      <button class="mini-play-btn" @click="togglePlay" :title="isPlaying ? '暂停' : '播放'" :class="{ 'is-active': isPlaying }">
        <svg v-if="isPlaying" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <rect x="5.5" y="4" width="4" height="16" rx="2" />
          <rect x="14.5" y="4" width="4" height="16" rx="2" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="icon-play">
          <path d="M7 4.72a1.2 1.2 0 0 1 1.83-1.02l11.4 7.28a1.2 1.2 0 0 1 0 2.04l-11.4 7.28A1.2 1.2 0 0 1 7 19.28V4.72z" />
        </svg>
      </button>

      <!-- 播放列表按钮 -->
      <button class="mini-list-btn" @click="emit('openPlaylistDrawer')" title="播放列表">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="16" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
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
  height: 52px;
  background: var(--music-glass-bg, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  border-radius: 26px;
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  display: flex;
  align-items: center;
  padding: 0 10px 0 7px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  z-index: 40;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s, box-shadow 0.25s;
  user-select: none;
}

.is-dark .mini-player-bar {
  background: rgba(28, 28, 32, 0.88);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(255, 255, 255, 0.05);
}

.mini-player-bar:hover {
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.12);
}

.mini-player-bar:active {
  transform: scale(0.985);
}

/* 黑胶唱片封面 */
.mini-disc-box {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: radial-gradient(circle, #2a2a2e 0%, #151518 70%, #0d0d0f 100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
}

.mini-disc-box.is-rotating {
  animation: mini-rotate 20s linear infinite;
}

@keyframes mini-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.mini-disc-cover {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
}

.mini-disc-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
}

.mini-disc-pin {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle, #ffffff 10%, #71717a 60%, #27272a 100%);
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

/* 歌曲元数据 */
.mini-meta-info {
  flex: 1;
  min-width: 0;
  padding: 0 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}

.mini-track-row,
.mini-artist-row {
  display: flex;
  align-items: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.mini-track-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--music-text, #18181b);
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.2px;
}

.is-dark .mini-track-title {
  color: #f4f4f5;
}

.mini-artist-name {
  font-size: 11.5px;
  font-weight: 400;
  color: var(--music-text-sub, #71717a);
  overflow: hidden;
  text-overflow: ellipsis;
}

.is-dark .mini-artist-name {
  color: #a1a1aa;
}

/* 右侧控制按钮组 */
.mini-action-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 精致播放暂停圆形按钮 */
.mini-play-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--music-accent, #3b82f6);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(59, 130, 246, 0.35);
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s, box-shadow 0.2s;
  padding: 0;
}

.mini-play-btn:hover {
  transform: scale(1.06);
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.45);
}

.mini-play-btn:active {
  transform: scale(0.92);
}

.mini-play-btn .icon-play {
  margin-left: 2px; /* 视觉居中微调 */
}

/* 列表抽屉按钮 */
.mini-list-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.04);
  color: var(--music-text, #3f3f46);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s, transform 0.18s, color 0.2s;
  padding: 0;
}

.is-dark .mini-list-btn {
  background: rgba(255, 255, 255, 0.08);
  color: #d4d4d8;
}

.mini-list-btn:hover {
  background: rgba(0, 0, 0, 0.08);
  transform: scale(1.05);
}

.is-dark .mini-list-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

.mini-list-btn:active {
  transform: scale(0.92);
}
</style>
