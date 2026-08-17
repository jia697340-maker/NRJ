/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { useMusicPlayer } from '../../composables/useMusicPlayer'
import { useMusicLibrary } from '../../composables/useMusicLibrary'

const {
  currentTrack,
  isPlaying,
  isBuffering,
  playbackError,
  currentTime,
  isLikedCurrent,
  playMode,
  isLyricMode,
  progressPercent,
  currentLyricIndex,
  togglePlay,
  nextTrack,
  prevTrack,
  seek,
  toggleMode,
  toggleLike,
  formatTime
} = useMusicPlayer()

const emit = defineEmits(['collapse', 'openPlaylistDrawer', 'openPlaybackSettings'])
const { setMessage } = useMusicLibrary()

const handleSeek = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const clickX = e.clientX - rect.left
  const ratio = Math.max(0, Math.min(1, clickX / rect.width))
  if (currentTrack.value) {
    seek(ratio * currentTrack.value.duration)
  }
}

const toggleLyricView = () => {
  isLyricMode.value = !isLyricMode.value
}

const shareCurrent = async () => {
  if (!currentTrack.value) return
  const data = { title: currentTrack.value.title, text: `${currentTrack.value.title} - ${currentTrack.value.artist}`, url: currentTrack.value.externalUrl || window.location.href }
  if (navigator.share) { try { await navigator.share(data) } catch { return } }
  else { await navigator.clipboard?.writeText(`${data.text}\n${data.url}`); setMessage('歌曲信息已复制') }
}
</script>

<template>
  <div class="player-full-view">
    <!-- 顶部操作栏 -->
    <div class="player-header">
      <button class="header-action-btn" title="收起" @click="emit('collapse')">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <div class="header-track-info">
        <div class="track-title">{{ currentTrack?.title || '未在播放' }}</div>
        <div class="track-artist">{{ currentTrack?.artist || '独奏' }}</div>
      </div>

      <button class="header-action-btn" title="分享" @click="shareCurrent">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
      </button>
    </div>

    <!-- 中央核心：无摆臂经典纯黑胶唱片 / 歌词模式切换 -->
    <div class="center-content-area" @click="toggleLyricView">
      <!-- 黑胶唱片模式 (无摆臂，纯圆盘与同心纹) -->
      <div class="disc-wrapper" v-if="!isLyricMode">
          <div class="vinyl-record" :class="{ 'is-rotating': isPlaying }">
          <!-- 黑胶外圈光泽纹理 -->
          <div class="vinyl-groove groove-1"></div>
          <div class="vinyl-groove groove-2"></div>
          <div class="vinyl-groove groove-3"></div>

          <!-- 黑胶中心贴纸/封面 -->
          <div class="vinyl-center-art" :style="currentTrack?.coverUrl ? { backgroundImage: `url(${currentTrack.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}">
            <div class="art-inner-pattern">
              <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none">
                <circle cx="50" cy="50" r="46" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
                <circle cx="50" cy="50" r="28" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
                <line x1="50" y1="18" x2="50" y2="82" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
                <line x1="18" y1="50" x2="82" y2="50" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
              </svg>
            </div>
            <!-- 中心转轴小孔 -->
            <div class="spindle-hole"></div>
          </div>
        </div>
      </div>

      <!-- 歌词展示模式 -->
      <div class="lyrics-wrapper" v-else>
        <div class="lyrics-scroll-box">
          <div
            v-for="(lyric, idx) in currentTrack?.lyrics || []"
            :key="idx"
            class="lyric-line"
            :class="{ active: currentLyricIndex === idx }"
          >
            <span>{{ lyric.text }}</span><small v-if="lyric.translation">{{ lyric.translation }}</small>
          </div>
        </div>
      </div>
    </div>

    <div v-if="playbackError" class="playback-message">{{ playbackError }}</div>
    <div v-else-if="isBuffering" class="playback-message">正在缓冲音频…</div>

    <!-- 下方交互功能栏 (喜欢、评论、音效、更多) -->
    <div class="player-action-bar">
      <button class="interact-btn" :class="{ liked: isLikedCurrent }" @click="toggleLike">
        <svg viewBox="0 0 24 24" width="22" height="22" :fill="isLikedCurrent ? '#e5e5ea' : 'none'" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </button>

      <button class="interact-btn" title="评论" @click="setMessage('该来源暂未提供评论，歌曲播放不受影响')">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
      </button>

      <button class="interact-btn" title="音效" @click="emit('openPlaybackSettings')">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none">
          <line x1="4" y1="21" x2="4" y2="14"></line>
          <line x1="4" y1="10" x2="4" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12" y2="3"></line>
          <line x1="20" y1="21" x2="20" y2="16"></line>
          <line x1="20" y1="12" x2="20" y2="3"></line>
          <line x1="1" y1="14" x2="7" y2="14"></line>
          <line x1="9" y1="8" x2="15" y2="8"></line>
          <line x1="17" y1="16" x2="23" y2="16"></line>
        </svg>
      </button>

      <button class="interact-btn" title="更多设置" @click="emit('openPlaybackSettings')">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <circle cx="12" cy="5" r="2"></circle>
          <circle cx="12" cy="12" r="2"></circle>
          <circle cx="12" cy="19" r="2"></circle>
        </svg>
      </button>
    </div>

    <!-- 进度条区域 -->
    <div class="progress-bar-container">
      <span class="time-label">{{ formatTime(currentTime) }}</span>
      <div class="progress-track" @click="handleSeek">
        <div class="progress-filled" :style="{ width: `${progressPercent}%` }">
          <div class="progress-thumb"></div>
        </div>
      </div>
      <span class="time-label">{{ formatTime(currentTrack?.duration || 0) }}</span>
    </div>

    <!-- 主播放控制器 -->
    <div class="main-controls-bar">
      <!-- 播放模式 -->
      <button class="ctrl-btn-sub" @click="toggleMode" :title="playMode">
        <svg v-if="playMode === 'loop'" viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none">
          <polyline points="17 1 21 5 17 9"></polyline>
          <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
          <polyline points="7 23 3 19 7 15"></polyline>
          <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
        </svg>
        <svg v-else-if="playMode === 'single'" viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none">
          <polyline points="17 1 21 5 17 9"></polyline>
          <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
          <polyline points="7 23 3 19 7 15"></polyline>
          <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none">
          <polyline points="16 3 21 3 21 8"></polyline>
          <line x1="4" y1="20" x2="21" y2="3"></line>
          <polyline points="21 16 21 21 16 21"></polyline>
          <line x1="15" y1="15" x2="21" y2="21"></line>
          <line x1="4" y1="4" x2="9" y2="9"></line>
        </svg>
      </button>

      <!-- 上一首 -->
      <button class="ctrl-btn-medium" @click="prevTrack" title="上一首">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <polygon points="19 20 9 12 19 4 19 20"/>
          <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- 中央大播放/暂停按键 -->
      <button class="ctrl-btn-play" @click="togglePlay" :title="isPlaying ? '暂停' : '播放'">
        <svg v-if="isPlaying" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1.5"/>
          <rect x="14" y="4" width="4" height="16" rx="1.5"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
          <polygon points="6 4 20 12 6 20 6 4"/>
        </svg>
      </button>

      <!-- 下一首 -->
      <button class="ctrl-btn-medium" @click="nextTrack" title="下一首">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <polygon points="5 4 15 12 5 20 5 4"/>
          <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- 播放列表抽屉 -->
      <button class="ctrl-btn-sub" @click="emit('openPlaylistDrawer')" title="播放列表">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none">
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
.player-full-view {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at center top, #ffffff 0%, #ebeef5 100%);
  color: #1c1c1e;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  z-index: 50;
  padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0;
  box-sizing: border-box;
  transition: background 0.3s;
}

.is-dark .player-full-view {
  background: radial-gradient(circle at center top, #2e2e34 0%, #151518 100%);
  color: #f2f2f5;
}

/* 顶部 */
.player-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  height: 56px;
}

.header-action-btn {
  background: none;
  border: none;
  color: #555555;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.is-dark .header-action-btn {
  color: #c7c7cc;
}

.header-track-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 0;
  padding: 0 8px;
}

.track-title {
  font-size: 16px;
  font-weight: 700;
  color: #111111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.is-dark .track-title {
  color: #ffffff;
}

.track-artist {
  font-size: 12px;
  color: #777777;
  margin-top: 2px;
}

.is-dark .track-artist {
  color: #8e8e93;
}

/* 中央区域 */
.center-content-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

/* 黑胶唱片 (无摆臂) */
.disc-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.vinyl-record {
  width: min(72vw, 290px);
  height: min(72vw, 290px);
  border-radius: 50%;
  background: radial-gradient(circle, #252528 0%, #111113 60%, #000000 100%);
  border: 7px solid #222226;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.28), inset 0 0 10px rgba(255, 255, 255, 0.1);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s;
}

.is-dark .vinyl-record {
  background: radial-gradient(circle, #18181b 0%, #0d0d0f 60%, #000000 100%);
  border-color: #1c1c1f;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), inset 0 0 10px rgba(255, 255, 255, 0.08);
}

.vinyl-record.is-rotating {
  animation: disc-rotate 22s linear infinite;
}

@keyframes disc-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.vinyl-groove {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  pointer-events: none;
}

.groove-1 {
  width: 86%;
  height: 86%;
}

.groove-2 {
  width: 72%;
  height: 72%;
}

.groove-3 {
  width: 58%;
  height: 58%;
}

.vinyl-center-art {
  width: 42%;
  height: 42%;
  border-radius: 50%;
  background: linear-gradient(135deg, #3a3a40 0%, #1c1c1f 100%);
  border: 3px solid #111113;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.art-inner-pattern {
  width: 100%;
  height: 100%;
}

.spindle-hole {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #000000;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

/* 歌词 */
.lyrics-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 24px;
}

.lyrics-scroll-box {
  display: flex;
  flex-direction: column;
  gap: 18px;
  text-align: center;
}

.lyric-line {
  font-size: 15px;
  color: #8e8e93;
  transition: all 0.3s;
}

.is-dark .lyric-line {
  color: #71717a;
}

.lyric-line.active {
  font-size: 18px;
  font-weight: 700;
  color: #111111;
  transform: scale(1.06);
}

.lyric-line small { display:block;margin-top:5px;color:inherit;font-size:11px;font-weight:400;opacity:.66; }
.playback-message { margin:-2px 28px 8px;padding:8px 11px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.68);font-size:10px;line-height:1.45;text-align:center; }

.is-dark .lyric-line.active {
  color: #ffffff;
}

/* 互动栏 */
.player-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 8px 32px;
}

.interact-btn {
  background: none;
  border: none;
  color: #71717a;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.is-dark .interact-btn {
  color: #8e8e93;
}

.interact-btn.liked {
  color: #111111;
}

.is-dark .interact-btn.liked {
  color: #ffffff;
}

/* 进度条 */
.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 24px;
}

.time-label {
  font-size: 11px;
  color: #8e8e93;
  font-family: monospace;
  width: 34px;
}

.progress-track {
  flex: 1;
  height: 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  position: relative;
  cursor: pointer;
}

.is-dark .progress-track {
  background: rgba(255, 255, 255, 0.15);
}

.progress-filled {
  height: 100%;
  background: #111111;
  border-radius: 2px;
  position: relative;
}

.is-dark .progress-filled {
  background: #ffffff;
}

.progress-thumb {
  position: absolute;
  right: -5px;
  top: -4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #111111;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.2);
}

.is-dark .progress-thumb {
  background: #ffffff;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.5);
}

/* 主控制器 */
.main-controls-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 12px 24px 28px 24px;
}

.ctrl-btn-sub {
  background: none;
  border: none;
  color: #71717a;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.is-dark .ctrl-btn-sub {
  color: #8e8e93;
}

.ctrl-btn-medium {
  background: none;
  border: none;
  color: #111111;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.is-dark .ctrl-btn-medium {
  color: #ffffff;
}

.ctrl-btn-play {
  background: #111111;
  border: none;
  color: #ffffff;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15);
  transition: transform 0.15s;
}

.is-dark .ctrl-btn-play {
  background: #ffffff;
  color: #121214;
  box-shadow: 0 6px 18px rgba(255, 255, 255, 0.15);
}

.ctrl-btn-play:active {
  transform: scale(0.92);
}
</style>
