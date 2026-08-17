/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import { globalSettings } from '../store/global'
import MusicMineTab from './music/MusicMineTab.vue'
import MusicHomeTab from './music/MusicHomeTab.vue'
import MusicPlayerView from './music/MusicPlayerView.vue'
import MusicMiniPlayer from './music/MusicMiniPlayer.vue'
import MusicTabBar from './music/MusicTabBar.vue'
import MusicDrawerModal from './music/MusicDrawerModal.vue'
import MusicSourceModal from './music/modals/MusicSourceModal.vue'
import MusicDataModal from './music/modals/MusicDataModal.vue'
import MusicPlaybackSettingsModal from './music/modals/MusicPlaybackSettingsModal.vue'
import { useMusicLibrary } from '../composables/useMusicLibrary'

const emit = defineEmits(['close'])

const activeTab = ref<'home' | 'listen' | 'mine'>('mine')
const isFullPlayerOpen = ref<boolean>(false)
const isPlaylistDrawerOpen = ref<boolean>(false)
const isSourceModalOpen = ref(false)
const isDataModalOpen = ref(false)
const isPlaybackSettingsOpen = ref(false)
const { libraryMessage } = useMusicLibrary()

const handleBack = () => {
  if (isFullPlayerOpen.value) {
    isFullPlayerOpen.value = false
  } else {
    emit('close')
  }
}
</script>

<template>
  <div class="music-app-root" :class="{ 'is-dark': globalSettings.darkMode, 'is-light': !globalSettings.darkMode }">
    <!-- 主视图路由切换 -->
    <div class="music-main-viewport">
      <MusicMineTab
        v-if="activeTab === 'mine'"
        @openDrawer="isPlaylistDrawerOpen = true"
        @openSettings="activeTab = 'mine'"
        @openSources="isSourceModalOpen = true"
        @openData="isDataModalOpen = true"
      />
      <MusicHomeTab
        v-else-if="activeTab === 'home'"
        @openSources="isSourceModalOpen = true"
      />
      <div v-else class="listen-together-wrapper">
        <MusicPlayerView
          @collapse="activeTab = 'mine'"
          @openPlaylistDrawer="isPlaylistDrawerOpen = true"
          @openPlaybackSettings="isPlaybackSettingsOpen = true"
        />
      </div>
    </div>

    <!-- 底部悬浮 Mini 播放器 (当不在听歌全屏页时显示) -->
    <MusicMiniPlayer
      v-if="activeTab !== 'listen' && !isFullPlayerOpen"
      @openFullPlayer="isFullPlayerOpen = true"
      @openPlaylistDrawer="isPlaylistDrawerOpen = true"
    />

    <!-- 三栏底部导航栏 (当不在全屏播放模式时显示) -->
    <MusicTabBar
      v-if="!isFullPlayerOpen"
      :activeTab="activeTab"
      @update:activeTab="(tab) => activeTab = tab"
    />

    <!-- 全屏黑胶播放器弹出层 (无摆臂) -->
    <transition name="slide-up">
      <MusicPlayerView
        v-if="isFullPlayerOpen"
        @collapse="isFullPlayerOpen = false"
        @openPlaylistDrawer="isPlaylistDrawerOpen = true"
        @openPlaybackSettings="isPlaybackSettingsOpen = true"
      />
    </transition>

    <!-- 播放列表抽屉弹窗 -->
    <MusicDrawerModal
      :visible="isPlaylistDrawerOpen"
      @close="isPlaylistDrawerOpen = false"
    />
    <MusicSourceModal :visible="isSourceModalOpen" @close="isSourceModalOpen = false" @closeApp="handleBack" />
    <MusicDataModal :visible="isDataModalOpen" @close="isDataModalOpen = false" />
    <MusicPlaybackSettingsModal :visible="isPlaybackSettingsOpen" @close="isPlaybackSettingsOpen = false" />
    <transition name="music-toast"><div v-if="libraryMessage" class="music-toast">{{ libraryMessage }}</div></transition>
  </div>
</template>

<style scoped>
.music-app-root {
  --music-bg: #ffffff;
  --music-secondary-bg: #f5f6fa;
  --music-card-bg: #ffffff;
  --music-card-border: rgba(0, 0, 0, 0.08);
  --music-card-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  --music-text: #1a1a1e;
  --music-text-sub: #8e8e93;
  --music-text-muted: #aeaeb2;
  --music-glass-bg: rgba(255, 255, 255, 0.94);
  --music-btn-active: rgba(0, 0, 0, 0.06);
  --music-divider: rgba(0, 0, 0, 0.08);
  --music-pill-bg: #f0f2f5;

  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--music-bg);
  color: var(--music-text);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  transition: background-color 0.25s ease, color 0.25s ease;
}

.music-app-root.is-dark {
  --music-bg: #1e1e22;
  --music-secondary-bg: #2b2b2f;
  --music-card-bg: #2b2b2f;
  --music-card-border: rgba(255, 255, 255, 0.1);
  --music-card-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  --music-text: #ffffff;
  --music-text-sub: #a1a1a6;
  --music-text-muted: #71717a;
  --music-glass-bg: rgba(30, 30, 34, 0.94);
  --music-btn-active: rgba(255, 255, 255, 0.1);
  --music-divider: rgba(255, 255, 255, 0.1);
  --music-pill-bg: rgba(255, 255, 255, 0.08);
}

.music-main-viewport {
  flex: 1;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.listen-together-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

/* 向上滑入过渡 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.28s cubic-bezier(0.25, 1, 0.5, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

.music-toast { position:absolute;z-index:120;left:50%;bottom:112px;max-width:calc(100% - 48px);padding:9px 14px;border:1px solid var(--music-card-border);border-radius:999px;transform:translateX(-50%);background:var(--music-glass-bg);box-shadow:0 8px 24px rgba(0,0,0,.14);color:var(--music-text);font-size:11px;text-align:center;backdrop-filter:blur(14px); }
.music-toast-enter-active,.music-toast-leave-active{transition:.2s}.music-toast-enter-from,.music-toast-leave-to{opacity:0;transform:translate(-50%,8px)}
</style>
