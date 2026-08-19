/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import localforage from 'localforage'
import AvatarUploadModal from '../AvatarUploadModal.vue'
import MusicProfileEditModal from './modals/MusicProfileEditModal.vue'
import { horizontalCards, useMusicPlayer } from '../../composables/useMusicPlayer'
import { useMusicLibrary } from '../../composables/useMusicLibrary'

const { playTracks } = useMusicPlayer()
const {
  likedTracks,
  localTracks,
  history,
  customPlaylists,
  playlistTracks,
  sourceConfigs,
  accountProfiles,
  customTrackCount,
  customTotalMinutes,
  customNickname,
  customVipLabel,
  customSignature,
  refreshProfiles
} = useMusicLibrary()

const activeSubTab = ref<'music' | 'podcast' | 'notes'>('music')

const emit = defineEmits(['close', 'openDrawer', 'openSettings', 'openSources', 'openData', 'openHistory'])

// 自定义音乐头像状态与持久化（localforage IndexedDB 存储）
const customAvatar = ref<string | null>(null)
const avatarModalVisible = ref(false)
const profileEditModalVisible = ref(false)

const store = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'avatars'
})

const enabledSourceCount = computed(() => sourceConfigs.value.filter(item => item.enabled).length)
const primaryProfile = computed(() => accountProfiles.value[0] || null)
const displayNickname = computed(() => customNickname.value ?? primaryProfile.value?.nickname ?? '我的音乐')
const displayVipLabel = computed(() => customVipLabel.value ?? primaryProfile.value?.vipLabel ?? 'SVIP')
const displaySignature = computed(() => customSignature.value ?? primaryProfile.value?.signature ?? 'Unified Music Library')
const displayTrackCount = computed(() => customTrackCount.value !== null ? customTrackCount.value : history.value.length)
const displayTotalMinutes = computed(() => customTotalMinutes.value !== null ? customTotalMinutes.value : Math.round(history.value.reduce((sum, item) => sum + (item.duration || 0) * (item.playCount || 1), 0) / 60))
const libraryPlaylists = computed(() => [
  { id: 'liked', sourceId: 'local', name: '我喜欢的音乐', trackCount: likedTracks.value.length, playCount: 0 },
  { id: 'local', sourceId: 'local', name: '本地音乐', trackCount: localTracks.value.length, playCount: 0 },
  { id: 'history', sourceId: 'local', name: '最近播放', trackCount: history.value.length, playCount: 0 },
  ...customPlaylists.value
])

const handleOpenTrack = (playlistName: string) => {
  const playlist = libraryPlaylists.value.find(item => item.name === playlistName)
  if (!playlist) return
  const tracks = playlist.id === 'liked' ? likedTracks.value : playlist.id === 'local' ? localTracks.value : playlist.id === 'history' ? history.value : playlistTracks[playlist.id] || []
  if (tracks.length) void playTracks(tracks)
}
const handleCard = (name: string) => {
  if (name === '本地音乐') { if (localTracks.value.length) void playTracks(localTracks.value); else emit('openData'); return }
  if (name === '音乐统计') { emit('openData'); return }
  if (name === '每日推荐' || name === '私人漫游' || name === '排行榜') { emit('openSources'); return }
  handleOpenTrack(name)
}

const openAvatarModal = () => {
  avatarModalVisible.value = true
}

const handleAvatarSaved = async (url: string | null) => {
  try {
    customAvatar.value = url
    if (url) {
      await store.setItem('avatar-music-user', url)
    } else {
      await store.removeItem('avatar-music-user')
    }
  } catch (e) {
    console.error('Failed to save music avatar', e)
  }
}

onMounted(async () => {
  void refreshProfiles()
  try {
    const saved = await store.getItem<string>('avatar-music-user')
    if (saved) customAvatar.value = saved
  } catch (e) {
    console.error('Failed to load music avatar from localforage', e)
  }
})
</script>

<template>
  <div class="mine-tab-view">
    <!-- 顶部导航栏 -->
    <div class="mine-top-bar">
      <button class="icon-btn" title="来源" @click="emit('openSources')">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      <div class="status-badge" @click="emit('openSources')">
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>{{ enabledSourceCount }} 个来源</span>
      </div>

      <button class="icon-btn" title="曲库工具" @click="emit('openData')">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <circle cx="12" cy="5" r="2"></circle>
          <circle cx="12" cy="12" r="2"></circle>
          <circle cx="12" cy="19" r="2"></circle>
        </svg>
      </button>
    </div>

    <!-- 用户信息卡片区 (1:1 复刻设计) -->
    <div class="user-profile-section">
      <!-- 带有花边天使光环的头像 -->
      <div class="avatar-wrapper" @click="openAvatarModal" title="点击更换头像">
        <div class="halo-circle">
          <svg class="halo-crown" viewBox="0 0 100 40" fill="none" stroke="currentColor" stroke-width="2">
            <ellipse cx="50" cy="20" rx="42" ry="12" stroke-dasharray="3 3"/>
          </svg>
        </div>
        <div class="lace-border">
          <div class="avatar-inner">
            <img v-if="customAvatar || primaryProfile?.avatarUrl" class="avatar-photo" :src="customAvatar || primaryProfile?.avatarUrl || ''" alt="音乐头像" />
            <svg v-else viewBox="0 0 100 100" class="avatar-svg" fill="none">
              <circle cx="50" cy="50" r="48" class="avatar-circle-outer" stroke-width="1.5"/>
              <circle cx="50" cy="50" r="32" class="avatar-circle-mid"/>
              <path d="M50 25 C62 25 72 35 72 48 C72 60 62 70 50 70 C38 70 28 60 28 48 C28 35 38 25 50 25 Z" class="avatar-shape-inner"/>
              <circle cx="50" cy="50" r="8" class="avatar-center-dot"/>
              <line x1="50" y1="15" x2="50" y2="85" class="avatar-crossline" stroke-width="1"/>
              <line x1="15" y1="50" x2="85" y2="50" class="avatar-crossline" stroke-width="1"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- 用户名称与 VIP 徽章 -->
      <div class="user-name-row clickable-name" title="点击修改名字与资料" @click="profileEditModalVisible = true">
        <span class="user-nickname">{{ displayNickname }}</span>
        <div class="vip-badge">
          <svg class="vip-record-icon" viewBox="0 0 24 24" width="14" height="14" fill="#000">
            <circle cx="12" cy="12" r="10" fill="#222"/>
            <circle cx="12" cy="12" r="4" fill="#d4af37"/>
            <circle cx="12" cy="12" r="1.5" fill="#fff"/>
          </svg>
          <span class="vip-text">{{ displayVipLabel }}</span>
        </div>
        <svg class="edit-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </div>

      <!-- 优雅副标题与艺术签名 -->
      <div class="motto-text clickable-motto" title="点击修改个性签名" @click="profileEditModalVisible = true">{{ displaySignature }}</div>
      <div class="signature-cursive">{{ primaryProfile ? `${primaryProfile.sourceId} · Lv.${primaryProfile.level || 0}` : 'listen in your own way' }}</div>

      <!-- 社交统计数据栏 -->
      <div class="stats-row">
        <div class="stat-item"><span class="stat-num">{{ likedTracks.length }}</span><span class="stat-label">喜欢</span></div>
        <div class="stat-item" style="cursor: pointer;" @click="emit('openData')"><span class="stat-num">{{ localTracks.length }}</span><span class="stat-label">本地</span></div>
        <div class="stat-item clickable-stat" title="查看歌曲记录 / 自定义首数" @click="emit('openHistory', 'records')"><span class="stat-level">{{ displayTrackCount }}首</span></div>
        <div class="stat-item clickable-stat" title="修改累计分钟 / 重置" @click="emit('openHistory', 'edit')"><span class="stat-num">{{ displayTotalMinutes }}</span><span class="stat-label">分钟</span></div>
      </div>
    </div>

    <!-- 五联快捷功能胶囊栏 -->
    <div class="quick-nav-pills">
      <div class="pill-item" @click="history.length && playTracks(history)">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <polyline points="12 7 12 12 15 15" stroke="currentColor" stroke-width="1.8" fill="none"/>
        </svg>
        <span>最近</span>
      </div>
      <div class="pill-item" @click="emit('openData')">
        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="1.8" fill="none">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
        <span>本地</span>
      </div>
      <div class="pill-item" @click="emit('openSources')">
        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="1.8" fill="none">
          <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>
        </svg>
        <span>来源</span>
      </div>
      <div class="pill-item" @click="likedTracks.length && playTracks(likedTracks)">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <span>收藏</span>
      </div>
      <div class="pill-item grid-icon" @click="emit('openData')">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
          <rect x="3" y="3" width="7" height="7" rx="1.5"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5"/>
        </svg>
      </div>
    </div>

    <!-- 蕾丝花边分割卡片流 -->
    <div class="lace-divider-bar"></div>

    <!-- 横向滑动推荐画卷卡片 -->
    <div class="horizontal-scroll-section">
      <div class="h-card" v-for="c in horizontalCards" :key="c.id" @click="handleCard(c.name)">
        <div class="h-card-img">
          <div class="cross-pattern">
            <svg viewBox="0 0 60 60" width="36" height="36" class="card-cross-icon" stroke-width="2.5" fill="none">
              <line x1="30" y1="8" x2="30" y2="52"/>
              <line x1="14" y1="24" x2="46" y2="24"/>
            </svg>
          </div>
        </div>
        <div class="h-card-title">{{ c.name }}</div>
      </div>
    </div>

    <!-- Tab 切换栏：音乐 / 播客 / 笔记 -->
    <div class="sub-tab-bar">
      <div class="sub-tab-items">
        <button
          class="sub-tab-btn"
          :class="{ active: activeSubTab === 'music' }"
          @click="activeSubTab = 'music'"
        >
          音乐
          <div class="tab-indicator" v-if="activeSubTab === 'music'"></div>
        </button>
        <button
          class="sub-tab-btn"
          :class="{ active: activeSubTab === 'podcast' }"
          @click="activeSubTab = 'podcast'"
        >
          播客
          <div class="tab-indicator" v-if="activeSubTab === 'podcast'"></div>
        </button>
        <button
          class="sub-tab-btn"
          :class="{ active: activeSubTab === 'notes' }"
          @click="activeSubTab = 'notes'"
        >
          笔记
          <div class="tab-indicator" v-if="activeSubTab === 'notes'"></div>
        </button>
      </div>
    </div>

    <!-- 歌单工具栏：近期、创建 7、批量操作 -->
    <div v-if="activeSubTab === 'music'" class="sub-content">
      <div class="playlist-tool-row">
        <div class="tool-left">
          <div class="tool-lock-tag">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>近期</span>
          </div>
          <div class="tool-create-title">创建 <span class="badge-sub">7</span></div>
        </div>

        <div class="tool-right">
          <button class="tool-action-btn" title="批量导入" @click="emit('openData')">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
              <polyline points="9 10 4 15 9 20"/>
              <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
            </svg>
          </button>
          <button class="tool-action-btn" title="更多" @click="emit('openData')">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <circle cx="12" cy="5" r="1.8"/>
              <circle cx="12" cy="12" r="1.8"/>
              <circle cx="12" cy="19" r="1.8"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- 蕾丝暗纹艺术字 -->
      <div class="art-bg-text">with your soft lips</div>

      <!-- 歌单列表 -->
      <div class="playlist-list-container">
        <div
          class="playlist-item-card"
          v-for="pl in libraryPlaylists"
          :key="pl.id"
          @click="handleOpenTrack(pl.name)"
        >
          <div class="playlist-cover-box">
            <svg viewBox="0 0 60 60" width="32" height="32" class="playlist-cross-icon" stroke-width="2" fill="none">
              <line x1="30" y1="12" x2="30" y2="48"/>
              <line x1="16" y1="24" x2="44" y2="24"/>
            </svg>
          </div>

          <div class="playlist-info">
            <div class="playlist-name">{{ pl.name }}</div>
            <div class="playlist-meta">{{ pl.trackCount }}首 · {{ pl.playCount }}次播放</div>
          </div>

          <button class="item-more-btn" title="歌单工具" @click.stop="emit('openData')">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <circle cx="12" cy="5" r="1.8"/>
              <circle cx="12" cy="12" r="1.8"/>
              <circle cx="12" cy="19" r="1.8"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="activeSubTab === 'podcast'" class="sub-empty-card" @click="emit('openSources')"><strong>播客与电台来源</strong><span>通过来源管理连接播客目录或私人曲库。歌曲与播客会保持独立播放队列。</span><b>打开来源管理 ›</b></div>
    <div v-else class="playlist-list-container notes-list">
      <div v-if="!history.length" class="sub-empty-card"><strong>还没有听歌记录</strong><span>开始播放后，这里会按最近时间保存歌曲与播放次数。</span></div>
      <div v-for="track in history.slice(0, 30)" :key="track.id" class="playlist-item-card" @click="playTracks([track])"><div class="playlist-cover-box"></div><div class="playlist-info"><div class="playlist-name">{{ track.title }}</div><div class="playlist-meta">{{ track.artist }} · 播放 {{ track.playCount || 1 }} 次</div></div></div>
    </div>

    <!-- 底部占位以防 Mini 播放器遮挡 -->
    <div class="bottom-spacer"></div>

    <AvatarUploadModal
      v-model:visible="avatarModalVisible"
      :current-avatar="customAvatar || primaryProfile?.avatarUrl"
      shape="circle"
      title="更换音乐头像"
      @saved="handleAvatarSaved"
    />

    <MusicProfileEditModal
      :visible="profileEditModalVisible"
      :defaultNickname="primaryProfile?.nickname"
      :defaultVipLabel="primaryProfile?.vipLabel"
      :defaultSignature="primaryProfile?.signature"
      @close="profileEditModalVisible = false"
    />
  </div>
</template>

<style scoped>
.mine-tab-view {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--music-bg, #ffffff);
  color: var(--music-text, #1a1a1e);
  position: relative;
  -webkit-overflow-scrolling: touch;
}

/* 顶部操作条 */
.mine-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--music-glass-bg, rgba(255, 255, 255, 0.94));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--music-divider, rgba(0, 0, 0, 0.05));
}

.icon-btn {
  background: none;
  border: none;
  color: var(--music-text-sub, #666666);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.2s;
}

.icon-btn:active {
  background: var(--music-btn-active, rgba(0, 0, 0, 0.06));
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--music-text, #333333);
  padding: 5px 14px;
  border-radius: 20px;
  background: var(--music-pill-bg, #f0f2f5);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  cursor: pointer;
}

/* 用户主信息区域 */
.user-profile-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 16px 14px 16px;
  text-align: center;
}

.avatar-wrapper {
  position: relative;
  width: 90px;
  height: 90px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.avatar-wrapper:hover {
  transform: scale(1.04);
}

.avatar-wrapper:active {
  transform: scale(0.96);
}

.halo-circle {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  width: 70px;
  height: 24px;
  pointer-events: none;
  color: var(--music-text-muted, #999999);
}

.lace-border {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  padding: 4px;
  border: 2px dashed var(--music-text-muted, rgba(0, 0, 0, 0.25));
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.08) 100%);
}

.is-dark .lace-border {
  border-color: rgba(255, 255, 255, 0.55);
  box-shadow: 0 0 16px rgba(255, 255, 255, 0.15);
  background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.4) 100%);
}

.avatar-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
}
.avatar-photo{width:100%;height:100%;display:block;border-radius:50%;object-fit:cover}

.avatar-svg {
  width: 100%;
  height: 100%;
}

.avatar-circle-outer {
  fill: #f0f2f5;
  stroke: rgba(0, 0, 0, 0.15);
}

.avatar-circle-mid {
  fill: #e2e4e9;
}

.avatar-shape-inner {
  fill: #3a3a3e;
}

.avatar-center-dot {
  fill: #1c1c1e;
  opacity: 0.9;
}

.avatar-crossline {
  stroke: rgba(0, 0, 0, 0.15);
}

.is-dark .avatar-circle-outer {
  fill: #1a1a1c;
  stroke: rgba(255, 255, 255, 0.4);
}

.is-dark .avatar-circle-mid {
  fill: #242428;
}

.is-dark .avatar-shape-inner {
  fill: #323238;
}

.is-dark .avatar-center-dot {
  fill: #ffffff;
  opacity: 0.85;
}

.is-dark .avatar-crossline {
  stroke: rgba(255, 255, 255, 0.15);
}

.user-name-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 4px;
}

.clickable-name {
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 8px;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.clickable-name:hover {
  background: var(--music-pill-bg, rgba(0, 0, 0, 0.04));
}

.clickable-name:active {
  transform: scale(0.97);
}

.edit-icon {
  color: var(--music-text-muted, #999999);
  opacity: 0.6;
  margin-left: -2px;
  transition: opacity 0.2s, color 0.2s;
}

.clickable-name:hover .edit-icon {
  opacity: 1;
  color: var(--music-text, #111111);
}

.clickable-motto {
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.clickable-motto:hover {
  opacity: 0.8;
}

.user-nickname {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--music-text, #111111);
}

.vip-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  background: #18181b;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.vip-text {
  font-size: 10px;
  font-weight: 700;
  color: #e5e5ea;
  letter-spacing: 0.5px;
}

.motto-text {
  font-size: 12px;
  font-family: 'Times New Roman', Georgia, serif;
  font-style: italic;
  letter-spacing: 1px;
  color: var(--music-text-sub, #666666);
  margin-bottom: 2px;
}

.signature-cursive {
  font-size: 20px;
  font-family: 'Brush Script MT', 'Times New Roman', cursive, serif;
  font-style: italic;
  color: var(--music-text-muted, rgba(0, 0, 0, 0.35));
  margin-bottom: 12px;
  user-select: none;
}

.stats-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  font-size: 13px;
  color: var(--music-text-sub, #8e8e93);
}

.stat-item {
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.clickable-stat {
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.clickable-stat:active {
  transform: scale(0.95);
  opacity: 0.8;
}

.stat-num {
  font-weight: 600;
  color: var(--music-text, #1c1c1e);
}

.stat-label {
  font-size: 12px;
  color: var(--music-text-sub, #8e8e93);
}

.stat-level {
  font-weight: 700;
  font-size: 12px;
  color: #ffffff;
  background: #18181b;
  padding: 1px 7px;
  border-radius: 8px;
}

.is-dark .stat-level {
  color: #e5e5ea;
  background: rgba(255, 255, 255, 0.12);
}

/* 快捷胶囊 */
.quick-nav-pills {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  margin-bottom: 16px;
  gap: 8px;
}

.pill-item {
  flex: 1;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: var(--music-pill-bg, #f4f5f8);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--music-text, #333333);
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.pill-item:active {
  background: var(--music-btn-active, rgba(0, 0, 0, 0.08));
}

.pill-item.grid-icon {
  flex: 0 0 38px;
}

/* 蕾丝装饰分隔线 */
.lace-divider-bar {
  height: 6px;
  margin: 0 16px 14px 16px;
  border-bottom: 1px dashed var(--music-divider, rgba(0, 0, 0, 0.12));
}

/* 横向滑动卡片 */
.horizontal-scroll-section {
  display: flex;
  gap: 12px;
  padding: 0 16px 16px 16px;
  overflow-x: auto;
  scrollbar-width: none;
}

.horizontal-scroll-section::-webkit-scrollbar {
  display: none;
}

.h-card {
  flex: 0 0 94px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

.h-card-img {
  width: 94px;
  height: 94px;
  border-radius: 8px;
  background: linear-gradient(135deg, #f0f2f5 0%, #e2e4e9 100%);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
  box-shadow: var(--music-card-shadow, 0 2px 8px rgba(0, 0, 0, 0.04));
}

.card-cross-icon {
  stroke: #4a4a50;
}

.is-dark .h-card-img {
  background: radial-gradient(circle at center, #3f3f46 0%, #1c1c1e 100%);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.is-dark .card-cross-icon {
  stroke: rgba(255, 255, 255, 0.85);
}

.h-card-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--music-text, #333333);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 分类 Tab */
.sub-tab-bar {
  padding: 0 16px;
  margin-bottom: 12px;
}

.sub-tab-items {
  display: flex;
  align-items: center;
  gap: 28px;
  border-bottom: 1px solid var(--music-divider, rgba(0, 0, 0, 0.08));
  padding-bottom: 6px;
}

.sub-tab-btn {
  background: none;
  border: none;
  font-size: 16px;
  font-weight: 600;
  color: var(--music-text-sub, #8e8e93);
  cursor: pointer;
  padding: 4px 0;
  position: relative;
  transition: color 0.2s;
}

.sub-tab-btn.active {
  color: var(--music-text, #111111);
}

.tab-indicator {
  position: absolute;
  bottom: -7px;
  left: 0;
  right: 0;
  height: 2.5px;
  background: var(--music-text, #111111);
  border-radius: 2px;
}

/* 歌单工具行 */
.playlist-tool-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  margin-bottom: 10px;
}

.tool-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tool-lock-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--music-text-sub, #8e8e93);
}

.tool-create-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--music-text, #1c1c1e);
}

.badge-sub {
  font-size: 11px;
  color: var(--music-text-sub, #8e8e93);
}

.tool-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-action-btn {
  background: none;
  border: none;
  color: var(--music-text-sub, #8e8e93);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.art-bg-text {
  padding: 0 16px;
  font-size: 19px;
  font-family: 'Brush Script MT', 'Times New Roman', cursive, serif;
  font-style: italic;
  color: var(--music-text-muted, rgba(0, 0, 0, 0.18));
  margin-bottom: 6px;
  user-select: none;
}

/* 歌单列表 */
.playlist-list-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 16px;
}

.playlist-item-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  cursor: pointer;
}

.playlist-cover-box {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  background: linear-gradient(135deg, #f0f2f5 0%, #e2e4e8 100%);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.playlist-cross-icon {
  stroke: #4a4a50;
}

.is-dark .playlist-cover-box {
  background: linear-gradient(135deg, #38383c 0%, #1f1f22 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.is-dark .playlist-cross-icon {
  stroke: rgba(255, 255, 255, 0.75);
}

.playlist-info {
  flex: 1;
  min-width: 0;
}

.playlist-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--music-text, #111111);
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-meta {
  font-size: 11px;
  color: var(--music-text-sub, #8e8e93);
}

.item-more-btn {
  background: none;
  border: none;
  color: var(--music-text-sub, #71717a);
  padding: 6px;
  cursor: pointer;
}

.bottom-spacer {
  height: 110px;
}
.sub-empty-card{margin:18px 20px;padding:18px;border:1px solid var(--music-card-border);border-radius:16px;background:var(--music-secondary-bg);display:flex;flex-direction:column;gap:7px}.sub-empty-card strong{font-size:14px}.sub-empty-card span{color:var(--music-text-sub);font-size:11px;line-height:1.55}.sub-empty-card b{margin-top:3px;color:var(--music-text);font-size:10px}.notes-list{padding-top:14px}
</style>
