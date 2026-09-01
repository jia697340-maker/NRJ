/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMusicLibrary } from '../../../composables/useMusicLibrary'
import MusicClipboardImportModal from './MusicClipboardImportModal.vue'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const isClipboardModalOpen = ref(false)
const { history, likedTracks, localTracks, importLocalFiles, importPlaylistLink, importPlaylistFile, exportLibrary, importLibraryBackup, createPlaylist, setMessage } = useMusicLibrary()
const audioInput = ref<HTMLInputElement | null>(null)
const backupInput = ref<HTMLInputElement | null>(null)
const playlistInput = ref<HTMLInputElement | null>(null)
const playlistName = ref('')
const playlistLink = ref('')
const busy = ref(false)
const totalMinutes = computed(() => Math.round(history.value.reduce((sum, item) => sum + (item.duration || 0) * (item.playCount || 1), 0) / 60))
const topArtist = computed(() => {
  const counts = new Map<string, number>()
  history.value.forEach(item => counts.set(item.artist, (counts.get(item.artist) || 0) + (item.playCount || 1)))
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '还没有记录'
})

const selectAudio = () => audioInput.value?.click()
const handleAudio = async (event: Event) => {
  const files = Array.from((event.target as HTMLInputElement).files || [])
  if (!files.length) return
  busy.value = true
  try { await importLocalFiles(files) } catch (error) { setMessage(error instanceof Error ? error.message : '导入失败') }
  finally { busy.value = false; (event.target as HTMLInputElement).value = '' }
}
const handleBackup = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  busy.value = true
  try { await importLibraryBackup(file) } catch (error) { setMessage(error instanceof Error ? error.message : '备份导入失败') }
  finally { busy.value = false; (event.target as HTMLInputElement).value = '' }
}
const handleCreate = () => { if (!playlistName.value.trim()) return; createPlaylist(playlistName.value); playlistName.value = ''; setMessage('歌单已创建') }
const handleLink = async () => { if (!playlistLink.value.trim()) return; busy.value = true; try { await importPlaylistLink(playlistLink.value); playlistLink.value = '' } catch (error) { setMessage(error instanceof Error ? error.message : '歌单链接导入失败') } finally { busy.value = false } }
const handlePlaylistFile = async (event: Event) => { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; busy.value = true; try { await importPlaylistFile(file) } catch (error) { setMessage(error instanceof Error ? error.message : '歌单文件导入失败') } finally { busy.value = false; (event.target as HTMLInputElement).value = '' } }
</script>

<template>
  <div v-if="visible" class="data-mask" @click.self="emit('close')">
    <section class="data-dialog" @click.stop>
      <!-- Header -->
      <header class="dialog-header">
        <div class="header-titles">
          <h3 class="main-title">曲库工具</h3>
          <span class="sub-title">本地音乐、歌单与备份</span>
        </div>
        <button class="close-btn" aria-label="关闭" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>

      <!-- Scrollable Body -->
      <div class="dialog-body">
        <!-- Stats Summary -->
        <div class="stats-grid">
          <div class="stat-card">
            <strong class="stat-num">{{ history.length }}</strong>
            <span class="stat-label">听过歌曲</span>
          </div>
          <div class="stat-card">
            <strong class="stat-num">{{ totalMinutes }}</strong>
            <span class="stat-label">累计分钟</span>
          </div>
          <div class="stat-card">
            <strong class="stat-num">{{ likedTracks.length }}</strong>
            <span class="stat-label">喜欢</span>
          </div>
          <div class="stat-card">
            <strong class="stat-num">{{ localTracks.length }}</strong>
            <span class="stat-label">本地</span>
          </div>
        </div>

        <!-- Top Artist Bar -->
        <div class="top-artist-card">
          <span class="artist-label">最常听的歌手</span>
          <strong class="artist-name">{{ topArtist }}</strong>
        </div>

        <!-- Clipboard Import Entry (No gradient, clean badge) -->
        <button class="action-card highlight-card" @click="isClipboardModalOpen = true">
          <div class="action-icon clip-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            </svg>
          </div>
          <div class="action-texts">
            <div class="card-title-row">
              <strong class="action-title">一键识别剪贴板</strong>
              <span class="safe-badge">隐私保护</span>
            </div>
            <span class="action-desc">智能提取歌单/单曲链接、分享文案或多行歌单清单</span>
          </div>
          <svg class="chevron-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>

        <!-- Import Local Music -->
        <button class="action-card" :disabled="busy" @click="selectAudio">
          <div class="action-icon">入</div>
          <div class="action-texts">
            <strong class="action-title">导入本地音乐</strong>
            <span class="action-desc">支持多选音频，并可同时选择同名 LRC 歌词</span>
          </div>
          <svg class="chevron-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <input ref="audioInput" class="hidden-input" type="file" accept="audio/*,.flac,.m4a,.aac,.ogg,.opus,.wav,.lrc,.txt" multiple @change="handleAudio" />

        <!-- Create Playlist Input Group -->
        <div class="inline-input-card">
          <div class="action-icon">单</div>
          <input v-model="playlistName" class="dialog-input" placeholder="新歌单名称" @keyup.enter="handleCreate" />
          <button class="inline-btn" @click="handleCreate">创建</button>
        </div>

        <!-- Import Playlist Link Group -->
        <div class="inline-input-card">
          <div class="action-icon">链</div>
          <input v-model="playlistLink" class="dialog-input" placeholder="粘贴网易云歌单链接" @keyup.enter="handleLink" />
          <button class="inline-btn" :disabled="busy" @click="handleLink">导入</button>
        </div>

        <!-- Import Playlist File -->
        <button class="action-card" :disabled="busy" @click="playlistInput?.click()">
          <div class="action-icon">表</div>
          <div class="action-texts">
            <strong class="action-title">导入歌单文件</strong>
            <span class="action-desc">支持 M3U、M3U8，以及本应用 JSON 音乐备份</span>
          </div>
          <svg class="chevron-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <input ref="playlistInput" class="hidden-input" type="file" accept=".m3u,.m3u8,.json,text/plain,application/json" @change="handlePlaylistFile" />

        <!-- Export Library -->
        <button class="action-card" @click="exportLibrary">
          <div class="action-icon">出</div>
          <div class="action-texts">
            <strong class="action-title">导出音乐资料</strong>
            <span class="action-desc">导出收藏、历史、歌单与来源设置，不含账号凭证</span>
          </div>
          <svg class="chevron-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>

        <!-- Merge Backup -->
        <button class="action-card" :disabled="busy" @click="backupInput?.click()">
          <div class="action-icon">合</div>
          <div class="action-texts">
            <strong class="action-title">合并音乐备份</strong>
            <span class="action-desc">保留现有数据并合并导入 JSON 备份</span>
          </div>
          <svg class="chevron-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <input ref="backupInput" class="hidden-input" type="file" accept="application/json,.json" @change="handleBackup" />

        <!-- Footer Note -->
        <p class="dialog-note">
          本地音频保存在浏览器 IndexedDB 中，不写入普通 localStorage。清除站点数据会同时删除本地曲库副本。
        </p>
      </div>
    </section>

    <!-- 剪贴板识别确认弹窗 -->
    <MusicClipboardImportModal
      :visible="isClipboardModalOpen"
      @close="isClipboardModalOpen = false"
      @imported="isClipboardModalOpen = false"
    />
  </div>
</template>

<style scoped>
.data-mask {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  animation: fadeInMask 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.data-dialog {
  width: 100%;
  max-width: 440px;
  background-color: var(--music-card-bg, #ffffff);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  border-radius: 24px;
  box-shadow: 0 20px 48px -10px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popInDialog 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 22px 14px;
  border-bottom: 1px solid var(--music-divider, rgba(0, 0, 0, 0.05));
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.main-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--music-text, #1e293b);
}

.sub-title {
  font-size: 11px;
  color: var(--music-text-sub, #64748b);
  font-weight: 400;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  background-color: var(--music-pill-bg, rgba(0, 0, 0, 0.04));
  color: var(--music-text, #334155);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.close-btn:hover {
  background-color: var(--music-card-border, rgba(0, 0, 0, 0.08));
}

.close-btn:active {
  transform: scale(0.92);
}

.dialog-body {
  padding: 16px 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 80vh;
  overflow-y: auto;
  box-sizing: border-box;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.stat-card {
  padding: 10px 4px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  border-radius: 12px;
  background-color: var(--music-secondary-bg, rgba(0, 0, 0, 0.025));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.stat-num {
  font-size: 15px;
  font-weight: 700;
  color: var(--music-text, #0f172a);
  line-height: 1.2;
}

.stat-label {
  font-size: 9px;
  color: var(--music-text-sub, #64748b);
}

.top-artist-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  border-radius: 12px;
  background-color: var(--music-secondary-bg, rgba(0, 0, 0, 0.025));
}

.artist-label {
  font-size: 11px;
  color: var(--music-text-sub, #64748b);
}

.artist-name {
  font-size: 12px;
  font-weight: 650;
  color: var(--music-text, #0f172a);
}

.action-card {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  background-color: var(--music-secondary-bg, rgba(0, 0, 0, 0.025));
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s, border-color 0.15s, transform 0.15s;
}

.action-card:hover {
  background-color: var(--music-card-border, rgba(0, 0, 0, 0.04));
}

.action-card:active:not(:disabled) {
  transform: scale(0.98);
}

.action-card:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.action-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  background-color: var(--music-card-bg, #ffffff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--music-text, #1e293b);
  flex-shrink: 0;
}

.action-texts {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-title {
  font-size: 13px;
  font-weight: 650;
  color: var(--music-text, #1e293b);
}

.action-desc {
  font-size: 10px;
  color: var(--music-text-sub, #64748b);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.safe-badge {
  padding: 1px 6px;
  border-radius: 5px;
  background-color: rgba(16, 185, 129, 0.12);
  color: #059669;
  font-size: 9px;
  font-weight: 600;
}

.chevron-icon {
  color: var(--music-text-sub, #94a3b8);
  flex-shrink: 0;
}

.inline-input-card {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  background-color: var(--music-secondary-bg, rgba(0, 0, 0, 0.025));
  display: flex;
  align-items: center;
  gap: 10px;
}

.dialog-input {
  min-width: 0;
  flex: 1;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.1));
  background-color: var(--music-card-bg, #ffffff);
  color: var(--music-text, #0f172a);
  font-size: 11.5px;
  outline: none;
  transition: border-color 0.15s;
}

.dialog-input:focus {
  border-color: var(--music-text, #0f172a);
}

.inline-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  border: none;
  background-color: var(--music-text, #0f172a);
  color: var(--music-bg, #ffffff);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s, transform 0.15s;
}

.inline-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.inline-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dialog-note {
  margin: 4px 0 0;
  font-size: 9.5px;
  color: var(--music-text-sub, #94a3b8);
  line-height: 1.5;
  text-align: center;
}

.hidden-input {
  display: none;
}

@keyframes fadeInMask {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes popInDialog {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
