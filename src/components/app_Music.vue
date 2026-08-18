/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { globalSettings } from '../store/global'
import MusicMineTab from './music/MusicMineTab.vue'
import MusicHomeTab from './music/MusicHomeTab.vue'
import MusicPlayerView from './music/MusicPlayerView.vue'
import MusicMiniPlayer from './music/MusicMiniPlayer.vue'
import MusicTabBar from './music/MusicTabBar.vue'
import MusicDrawerModal from './music/MusicDrawerModal.vue'
import MusicSourceModal from './music/modals/MusicSourceModal.vue'
import MusicDataModal from './music/modals/MusicDataModal.vue'
import MusicHistoryModal from './music/modals/MusicHistoryModal.vue'
import MusicPlaybackSettingsModal from './music/modals/MusicPlaybackSettingsModal.vue'
import MusicPrivacyModal from './music/modals/MusicPrivacyModal.vue'
import MusicPlaylistCollectionModal from './music/modals/MusicPlaylistCollectionModal.vue'
import MusicPlaylistDetailModal from './music/modals/MusicPlaylistDetailModal.vue'
import { useMusicLibrary } from '../composables/useMusicLibrary'
import { useMusicPlayer } from '../composables/useMusicPlayer'
import type { MusicPlaylist, MusicTrack } from '../types/music'

const emit = defineEmits(['close'])

const activeTab = ref<'home' | 'listen' | 'mine'>('home')
const isFullPlayerOpen = ref<boolean>(false)
const isPlaylistDrawerOpen = ref<boolean>(false)
const isSourceModalOpen = ref(false)
const isDataModalOpen = ref(false)
const isHistoryModalOpen = ref(false)
const historyModalTab = ref<'records' | 'edit'>('records')
const isPlaybackSettingsOpen = ref(false)
const privacyModalMode = ref<'closed' | 'management' | 'public-consent'>('closed')
const isCollectionOpen = ref(false)
const collectionMode = ref<'playlists' | 'charts'>('playlists')
const isPlaylistDetailOpen = ref(false)
const selectedPlaylist = ref<MusicPlaylist | null>(null)
const pendingPublicPlaylist = ref<MusicPlaylist | null>(null)
const selectedPlaylistTracks = ref<MusicTrack[]>([])
const isPlaylistLoading = ref(false)
const playlistError = ref('')
const { libraryMessage, homeSections, sourceConfigs, privacyPreferences, loadPlaylist, setAnonymousPublicSources, clearOnlineAccountData } = useMusicLibrary()
const { playTracks } = useMusicPlayer()
const handlePrivacyChoice = async (allowed: boolean) => {
  await setAnonymousPublicSources(allowed)
  privacyModalMode.value = 'closed'
  const playlist = pendingPublicPlaylist.value
  pendingPublicPlaylist.value = null
  if (allowed && playlist) await openPlaylist(playlist)
}
const openPrivacy = (mode: 'management' | 'public-consent' = 'management') => {
  if (mode === 'management') pendingPublicPlaylist.value = null
  privacyModalMode.value = mode
}
const closePrivacy = () => { pendingPublicPlaylist.value = null; privacyModalMode.value = 'closed' }
const allHomePlaylists = computed(() => {
  const seen = new Set<string>()
  return homeSections.value.flatMap(section => section.playlists || []).filter(item => {
    const key = `${item.sourceId}:${item.id}`
    if (seen.has(key)) return false
    seen.add(key); return true
  })
})
const collectionPlaylists = computed(() => collectionMode.value === 'charts'
  ? [...allHomePlaylists.value].sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
  : allHomePlaylists.value)
const openCollection = (mode: 'playlists' | 'charts') => { collectionMode.value = mode; isCollectionOpen.value = true }
const requestPublicPlaylist = (playlist: MusicPlaylist) => {
  pendingPublicPlaylist.value = playlist
  privacyModalMode.value = 'public-consent'
}
const openPlaylist = async (playlist: MusicPlaylist) => {
  const source = sourceConfigs.value.find(item => item.id === playlist.sourceId)
  if (source?.kind === 'meting' && !source.enabled) {
    requestPublicPlaylist(playlist)
    return
  }
  isCollectionOpen.value = false; selectedPlaylist.value = playlist; selectedPlaylistTracks.value = []
  playlistError.value = ''; isPlaylistLoading.value = true; isPlaylistDetailOpen.value = true
  try { selectedPlaylistTracks.value = (await loadPlaylist(playlist)).tracks }
  catch (error) { playlistError.value = error instanceof Error ? error.message : '歌单读取失败' }
  finally { isPlaylistLoading.value = false }
}
const openHistoryModal = (tab: 'records' | 'edit' = 'records') => {
  historyModalTab.value = tab
  isHistoryModalOpen.value = true
}

const playSelected = (index = 0) => { if (selectedPlaylistTracks.value.length) void playTracks(selectedPlaylistTracks.value, index) }

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
      <KeepAlive>
        <MusicMineTab
          v-if="activeTab === 'mine'"
          @close="handleBack"
          @openDrawer="isPlaylistDrawerOpen = true"
          @openSettings="activeTab = 'mine'"
          @openSources="isSourceModalOpen = true"
          @openData="isDataModalOpen = true"
          @openHistory="openHistoryModal"
        />
        <MusicHomeTab
          v-else-if="activeTab === 'home'"
          @close="handleBack"
          @openSources="isSourceModalOpen = true"
          @openPlaylist="openPlaylist"
          @requestPublicPlaylist="requestPublicPlaylist"
          @openCollection="openCollection"
        />
        <div v-else class="listen-together-wrapper">
          <MusicPlayerView
            @collapse="activeTab = 'mine'"
            @openPlaylistDrawer="isPlaylistDrawerOpen = true"
            @openPlaybackSettings="isPlaybackSettingsOpen = true"
          />
        </div>
      </KeepAlive>
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
    <MusicSourceModal :visible="isSourceModalOpen" @close="isSourceModalOpen = false" @closeApp="handleBack" @openPrivacy="openPrivacy" />
    <MusicDataModal :visible="isDataModalOpen" @close="isDataModalOpen = false" />
    <MusicHistoryModal :visible="isHistoryModalOpen" :defaultTab="historyModalTab" @close="isHistoryModalOpen = false" />
    <MusicPlaybackSettingsModal :visible="isPlaybackSettingsOpen" @close="isPlaybackSettingsOpen = false" />
    <MusicPrivacyModal :visible="privacyModalMode !== 'closed'" :mode="privacyModalMode === 'closed' ? 'management' : privacyModalMode" :anonymousAllowed="privacyPreferences.allowAnonymousPublicSources" @choose="handlePrivacyChoice" @close="closePrivacy" @clearAccounts="clearOnlineAccountData" />
    <MusicPlaylistCollectionModal :visible="isCollectionOpen" :title="collectionMode === 'charts' ? '排行榜' : '歌单广场'" :subtitle="collectionMode === 'charts' ? '按当前热门播放量排序' : '来自已启用音乐来源的推荐歌单'" :playlists="collectionPlaylists" @close="isCollectionOpen = false" @select="openPlaylist" />
    <MusicPlaylistDetailModal :visible="isPlaylistDetailOpen" :playlist="selectedPlaylist" :tracks="selectedPlaylistTracks" :loading="isPlaylistLoading" :error="playlistError" @close="isPlaylistDetailOpen = false" @playAll="playSelected(0)" @play="(_track, index) => playSelected(index)" />
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
