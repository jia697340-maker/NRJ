/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { MusicPlaylist, MusicTrack } from '../../types/music'
import { useMusicPlayer } from '../../composables/useMusicPlayer'
import { useMusicLibrary } from '../../composables/useMusicLibrary'

const emit = defineEmits<{ (e: 'openSources'): void; (e: 'openPlaylist', playlist: MusicPlaylist): void; (e: 'requestPublicPlaylist', playlist: MusicPlaylist): void; (e: 'openCollection', mode: 'playlists' | 'charts'): void }>()
const { playTrack, playTracks } = useMusicPlayer()
const { searchResult, homeSections, history, sourceConfigs, isSearching, isLoadingHome, homeLoadError, searchAll, loadHome, toggleLikeTrack, setMessage } = useMusicLibrary()
const searchQuery = ref('')
const hasSearched = ref(false)
const hasConfiguredOnlineSource = computed(() => sourceConfigs.value.some(source => source.enabled && source.kind !== 'local' && Boolean(source.apiBase?.trim())))

const quickCategories = [
  { id: 'recommend', name: '每日推荐' }, { id: 'radio', name: '私人漫游' },
  { id: 'playlists', name: '歌单广场' }, { id: 'charts', name: '排行榜' }
]

const submitSearch = () => { if (!searchQuery.value.trim()) return; hasSearched.value = true; void searchAll(searchQuery.value) }
const handleQuick = (id: string) => {
  if (id === 'recommend') { void loadHome().then(() => setMessage('首页内容已刷新')); return }
  if (id === 'radio' && history.value.length) { void playTracks([...history.value].sort(() => Math.random() - .5)); return }
  if (!homeSections.value.length) emit('openSources')
  else if (id === 'charts' || id === 'playlists') emit('openCollection', id)
  else setMessage('积累播放历史后即可开始私人漫游')
}
const handleTrack = (track: MusicTrack) => {
  void playTrack(track)
}
const handlePlaylist = (playlist: MusicPlaylist) => {
  const source = sourceConfigs.value.find(item => item.id === playlist.sourceId)
  if (source?.kind === 'meting' && !source.enabled) emit('requestPublicPlaylist', playlist)
  else emit('openPlaylist', playlist)
}
onMounted(() => { void loadHome() })
</script>

<template>
  <div class="home-tab-view">
    <!-- 顶部搜索栏与菜单 -->
    <div class="home-top-bar">
      <div class="search-input-box">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input v-model="searchQuery" type="search" placeholder="搜索可完整播放的歌曲..." class="search-native-input" @keyup.enter="submitSearch" />
      </div>
      <button class="icon-voice-btn" title="搜索" @click="submitSearch">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/>
        </svg>
      </button>
    </div>

    <div v-if="isSearching" class="banner-carousel"><div class="banner-card"><div class="banner-tag">搜索中</div><div class="banner-content"><div class="banner-title">正在查找完整歌曲</div><div class="banner-desc">试听、官网外链与不可播放结果不会显示</div></div></div></div>

    <div v-else-if="searchResult.tracks.length" class="section-container search-section">
      <div class="section-header"><div class="section-title">搜索结果</div><div class="section-more">{{ searchResult.tracks.length }} 首</div></div>
      <div class="song-list-group">
        <div v-for="track in searchResult.tracks" :key="track.id" class="song-row-item" @click="handleTrack(track)">
          <div class="song-cover-thumb" :style="track.coverUrl ? { backgroundImage: `url(${track.coverUrl})`, backgroundSize: 'cover' } : {}"><span v-if="!track.coverUrl">{{ String(track.sourceId).slice(0,1).toUpperCase() }}</span></div>
          <div class="song-meta-info"><div class="song-name">{{ track.title }} <i v-if="track.requiresVip">VIP</i></div><div class="song-sub">{{ track.artist }} · {{ track.album }} · {{ track.reason || track.sourceId }}</div></div>
          <button class="song-play-btn" title="播放完整歌曲"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></button>
          <button class="song-play-btn" title="收藏" @click.stop="toggleLikeTrack(track)">♡</button>
        </div>
      </div>
    </div>

    <div v-else-if="hasSearched && !searchResult.tracks.length" class="section-container empty-source-card" @click="emit('openSources')"><div class="section-title">{{ hasConfiguredOnlineSource ? '没有找到可完整播放的结果' : '还没有连接在线音乐服务' }}</div><div class="empty-source-text">{{ hasConfiguredOnlineSource ? '当前服务没有返回可完整播放的音源，请检查服务状态。' : '搜索需要一个音乐数据服务；登录不是搜索前提，连接服务后即可免登录搜索和播放公开可用曲目。' }}</div><div class="section-more">打开来源管理 ›</div></div>

    <!-- 四大金刚快捷入口 -->
    <div class="quick-circles-row">
      <div class="circle-item" v-for="(cat, idx) in quickCategories" :key="cat.id" @click="handleQuick(cat.id)">
        <div class="circle-icon-box">
          <svg v-if="idx === 0" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <svg v-else-if="idx === 1" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
          <svg v-else-if="idx === 2" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </div>
        <div class="circle-name">{{ cat.name }}</div>
      </div>
    </div>

    <div v-if="isLoadingHome" class="section-container"><div class="section-header"><div class="section-title">正在载入首页</div></div></div>
    <div v-else-if="homeLoadError && homeSections.length" class="home-status-row">
      <span>{{ homeLoadError }}</span>
      <button type="button" @click="loadHome">重试</button>
    </div>
    <template v-for="section in homeSections" :key="section.id">
      <div v-if="section.tracks?.length" class="section-container">
        <div class="section-header"><div class="section-title">{{ section.title }}</div><div class="section-more" @click="playTracks(section.tracks)">播放全部</div></div>
        <div class="song-list-group">
          <div v-for="track in section.tracks.slice(0, 12)" :key="track.id" class="song-row-item" @click="handleTrack(track)">
            <div class="song-cover-thumb" :style="track.coverUrl ? { backgroundImage: `url(${track.coverUrl})`, backgroundSize: 'cover' } : {}"></div>
            <div class="song-meta-info"><div class="song-name">{{ track.title }}</div><div class="song-sub">{{ track.artist }} · {{ track.album }}</div></div>
            <button class="song-play-btn" title="播放"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></button>
            <button class="song-play-btn" title="收藏" @click.stop="toggleLikeTrack(track)">♡</button>
          </div>
        </div>
      </div>
      <div v-if="section.playlists?.length" class="section-container">
        <div class="section-header"><div class="section-title">{{ section.title }}</div><div class="section-more">{{ section.subtitle || '实时内容' }}</div></div>
        <div class="playlist-grid">
          <div class="grid-card" v-for="pl in section.playlists.slice(0, 6)" :key="`${pl.sourceId}:${pl.id}`" @click="handlePlaylist(pl)">
          <div class="grid-cover" :style="pl.coverUrl ? { backgroundImage: `url(${pl.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}">
            <div class="grid-play-count">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <span>{{ pl.playCount || pl.trackCount }}</span>
            </div>
            <div v-if="!pl.coverUrl" class="cover-center-symbol">
              <svg viewBox="0 0 40 40" width="24" height="24" stroke="rgba(255,255,255,0.7)" stroke-width="2" fill="none">
                <line x1="20" y1="6" x2="20" y2="34"/>
                <line x1="8" y1="16" x2="32" y2="16"/>
              </svg>
            </div>
          </div>
          <div class="grid-title">{{ pl.name }}</div>
        </div>
      </div>
      </div>
    </template>
    <div v-if="!hasSearched && !isLoadingHome && !homeSections.length && !searchResult.tracks.length" class="section-container empty-source-card">
      <div class="section-title">首页推荐暂时没有载入</div>
      <div class="empty-source-text">{{ homeLoadError || (hasConfiguredOnlineSource ? '音乐服务已配置，但暂时没有返回首页内容。' : '还没有连接可用的在线音乐服务。') }}</div>
      <div class="empty-actions">
        <button type="button" @click="loadHome">重新载入</button>
        <button type="button" @click="emit('openSources')">来源管理</button>
      </div>
    </div>

    <div class="bottom-spacer"></div>
  </div>
</template>

<style scoped>
.home-tab-view {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--music-bg, #ffffff);
  color: var(--music-text, #1a1a1e);
  position: relative;
  -webkit-overflow-scrolling: touch;
}

.home-top-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--music-glass-bg, rgba(255, 255, 255, 0.94));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--music-divider, rgba(0, 0, 0, 0.05));
}

.search-input-box {
  flex: 1;
  height: 38px;
  background: var(--music-pill-bg, #f0f2f5);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  border-radius: 20px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 8px;
  color: var(--music-text-sub, #8e8e93);
}

.search-native-input {
  appearance: none;
  -webkit-appearance: none;
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--music-text, #1c1c1e);
  font-size: 13px;
}

.search-native-input::placeholder {
  color: var(--music-text-sub, #8e8e93);
}

.icon-voice-btn {
  background: none;
  border: none;
  color: var(--music-text-sub, #666666);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

/* Banner */
.banner-carousel {
  display: flex;
  gap: 12px;
  padding: 12px 16px 16px 16px;
  overflow-x: auto;
  scrollbar-width: none;
}

.banner-carousel::-webkit-scrollbar {
  display: none;
}

.banner-card {
  flex: 0 0 280px;
  height: 120px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  padding: 14px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  box-shadow: var(--music-card-shadow, 0 4px 14px rgba(0, 0, 0, 0.04));
}

.is-dark .banner-card {
  background: linear-gradient(135deg, #38383e 0%, #1c1c1f 100%);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}

.banner-tag {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.08);
  color: var(--music-text, #333333);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  font-weight: 500;
}

.is-dark .banner-tag {
  background: rgba(255, 255, 255, 0.14);
  color: #e5e5ea;
  border-color: rgba(255, 255, 255, 0.1);
}

.banner-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--music-text, #111111);
  margin-bottom: 4px;
}

.banner-desc {
  font-size: 11px;
  color: var(--music-text-sub, #666666);
}

/* 快捷金刚区 */
.quick-circles-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 4px 12px 16px 12px;
}

.circle-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.circle-icon-box {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--music-pill-bg, #f0f2f5);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--music-text, #1c1c1e);
  transition: transform 0.2s;
}

.circle-item:active .circle-icon-box {
  transform: scale(0.92);
}

.circle-name {
  font-size: 12px;
  color: var(--music-text, #444444);
}

/* 板块 */
.section-container {
  padding: 10px 16px 16px 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--music-text, #111111);
}

.section-more {
  font-size: 12px;
  color: var(--music-text-sub, #8e8e93);
  cursor: pointer;
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.grid-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
}

.grid-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  background: linear-gradient(135deg, #f0f2f5 0%, #e2e4e8 100%);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-center-symbol svg {
  stroke: #4a4a50;
}

.is-dark .grid-cover {
  background: linear-gradient(135deg, #333338 0%, #1a1a1c 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.is-dark .cover-center-symbol svg {
  stroke: rgba(255, 255, 255, 0.7);
}

.grid-play-count {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.45);
  padding: 1px 5px;
  border-radius: 10px;
}

.grid-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--music-text, #222222);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 歌曲列表 */
.song-list-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.song-row-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--music-pill-bg, #f7f8fa);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.05));
  cursor: pointer;
  transition: background 0.2s;
}

.song-row-item:active {
  background: var(--music-btn-active, rgba(0, 0, 0, 0.08));
}

.song-cover-thumb {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  background: #2b2b2f;
  border: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.is-dark .song-cover-thumb {
  background: #1c1c1f;
  border-color: rgba(255, 255, 255, 0.1);
}

.song-meta-info {
  flex: 1;
  min-width: 0;
}

.song-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--music-text, #111111);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-sub {
  font-size: 11px;
  color: var(--music-text-sub, #8e8e93);
}

.song-play-btn {
  background: none;
  border: none;
  color: var(--music-text-sub, #666666);
  padding: 6px;
  cursor: pointer;
}

.bottom-spacer {
  height: 110px;
}

.search-native-input::-webkit-search-cancel-button { display: none; }

.song-name i { display:inline-flex;margin-left:4px;padding:1px 4px;border:1px solid var(--music-card-border);border-radius:4px;color:var(--music-text-sub);font-size:8px;font-style:normal;vertical-align:2px; }
.empty-source-card { padding:18px;border:1px solid var(--music-card-border);border-radius:16px;background:var(--music-secondary-bg);cursor:pointer; }
.empty-source-text { margin:8px 0 12px;color:var(--music-text-sub);font-size:12px;line-height:1.6; }
.home-status-row { margin:0 16px 8px;padding:9px 11px;border-radius:10px;background:var(--music-pill-bg);color:var(--music-text-sub);font-size:11px;display:flex;align-items:center;justify-content:space-between;gap:12px; }
.home-status-row button,.empty-actions button { border:0;border-radius:999px;padding:6px 11px;background:var(--music-text);color:var(--music-bg);font-size:11px;cursor:pointer; }
.empty-actions { display:flex;gap:8px; }
.empty-actions button + button { background:var(--music-pill-bg);color:var(--music-text);border:1px solid var(--music-card-border); }
</style>
