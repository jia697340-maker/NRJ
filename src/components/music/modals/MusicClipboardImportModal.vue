/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import { useMusicClipboard, type ClipboardParseResult } from '../../../composables/useMusicClipboard'
import { useMusicLibrary } from '../../../composables/useMusicLibrary'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'imported'): void
}>()

const { isReading, parseResult, parseError, readAndParseClipboard, parseManualText, reset } = useMusicClipboard()
const { importPlaylistLink, createPlaylist, playlistTracks, importLibraryBackup, setMessage } = useMusicLibrary()

const manualInput = ref('')
const isImporting = ref(false)
const showManualArea = ref(false)

const handleQuickRead = async () => {
  try {
    await readAndParseClipboard()
  } catch {
    // 错误已记录在 parseError
  }
}

const handleManualParse = () => {
  if (!manualInput.value.trim()) return
  try {
    parseManualText(manualInput.value)
  } catch {
    // 错误已在 parseError
  }
}

const handleConfirmImport = async () => {
  if (!parseResult.value) return
  isImporting.value = true

  try {
    const res = parseResult.value

    if (res.type === 'netease-playlist' && res.rawId) {
      // 导入网易云歌单
      await importPlaylistLink(`https://music.163.com/playlist?id=${res.rawId}`)
      emit('imported')
      handleClose()
      return
    }

    if (res.type === 'netease-song' && res.rawId) {
      // 导入网易云单曲并创建临时单曲歌单
      const playlist = createPlaylist(res.title ? `${res.title} · 单曲` : '剪贴板识别歌曲')
      const track = {
        id: `netease:${res.rawId}`,
        sourceId: 'netease',
        sourceTrackId: res.rawId,
        neteaseTrackId: res.rawId,
        title: res.tracks[0]?.title || res.title,
        artist: res.tracks[0]?.artist || '未知歌手',
        album: '剪贴板导入',
        duration: 0,
        available: true,
        playbackType: 'full' as const
      }
      playlistTracks[playlist.id] = [track]
      playlist.trackCount = 1
      setMessage(`已导入单曲并创建歌单：${playlist.name}`)
      emit('imported')
      handleClose()
      return
    }

    if (res.type === 'text-list' || res.type === 'm3u' || res.type === 'json') {
      if (res.tracks.length > 0) {
        const playlist = createPlaylist(res.title || '剪贴板导入歌单')
        const formattedTracks = res.tracks.map((t, idx) => ({
          id: `clipboard:${Date.now()}:${idx}`,
          sourceId: 'local',
          sourceTrackId: t.sourceTrackId || `clip-${Date.now()}-${idx}`,
          title: t.title,
          artist: t.artist,
          album: t.album || '剪贴板导入',
          audioUrl: t.audioUrl,
          duration: 0,
          available: true,
          playbackType: 'full' as const
        }))
        playlistTracks[playlist.id] = formattedTracks
        playlist.trackCount = formattedTracks.length
        setMessage(`已成功创建歌单「${playlist.name}」并导入 ${formattedTracks.length} 首歌曲`)
        emit('imported')
        handleClose()
        return
      }
    }

    setMessage('未检测到可直接导入的曲目')
  } catch (err: any) {
    setMessage(err instanceof Error ? err.message : '歌单导入失败')
  } finally {
    isImporting.value = false
  }
}

const handleClose = () => {
  reset()
  manualInput.value = ''
  showManualArea.value = false
  emit('close')
}
</script>

<template>
  <div v-if="visible" class="clipboard-modal-mask" @click="handleClose">
    <section class="clipboard-modal-sheet" @click.stop>
      <!-- 头部 -->
      <header class="modal-header">
        <div class="header-titles">
          <div class="title-row">
            <span class="main-title">智能识别歌单</span>
            <span class="privacy-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.2" fill="none">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              端侧隐私保护
            </span>
          </div>
          <div class="sub-title">一键读取剪贴板中的歌单链接、分享文案或歌曲清单</div>
        </div>
        <button class="close-btn" @click="handleClose">×</button>
      </header>

      <!-- 内容区 -->
      <div class="modal-body">
        <!-- 隐私安全保障卡片 -->
        <div class="privacy-notice-card">
          <div class="privacy-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div class="privacy-content">
            <strong>隐私安全承诺</strong>
            <span>读取与解析全程仅在您的浏览器本地内存中进行，绝不上传任何无关剪贴板内容，识别完成后即刻脱敏销毁。</span>
          </div>
        </div>

        <!-- 一键读取主触发区 -->
        <div class="action-section">
          <button
            class="primary-read-btn"
            :disabled="isReading || isImporting"
            @click="handleQuickRead"
          >
            <svg v-if="!isReading" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            </svg>
            <span v-else class="loading-spinner"></span>
            <span>{{ isReading ? '正在端侧读取剪贴板...' : '一键读取并识别剪贴板' }}</span>
          </button>
        </div>

        <!-- 错误提示 -->
        <div v-if="parseError" class="error-banner">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{{ parseError }}</span>
        </div>

        <!-- 识别结果展示与确认卡片 -->
        <div v-if="parseResult" class="result-card">
          <div class="result-header">
            <div class="result-tag">{{ parseResult.type === 'netease-playlist' ? '网易云歌单' : parseResult.type === 'netease-song' ? '单曲链接' : '歌曲清单' }}</div>
            <div class="result-status">已识别</div>
          </div>

          <div class="result-name">{{ parseResult.title }}</div>
          <div v-if="parseResult.description" class="result-desc">{{ parseResult.description }}</div>

          <!-- 预览曲目列表（如果有） -->
          <div v-if="parseResult.tracks.length > 0" class="preview-tracks-box">
            <div class="preview-label">识别到的曲目预览 (共 {{ parseResult.tracks.length }} 首)：</div>
            <div class="track-scroll-list">
              <div
                v-for="(track, idx) in parseResult.tracks.slice(0, 15)"
                :key="idx"
                class="track-preview-item"
              >
                <span class="track-idx">{{ idx + 1 }}.</span>
                <span class="track-t">{{ track.title }}</span>
                <span class="track-a">- {{ track.artist }}</span>
              </div>
              <div v-if="parseResult.tracks.length > 15" class="more-tracks-tip">
                ... 还有 {{ parseResult.tracks.length - 15 }} 首曲目
              </div>
            </div>
          </div>

          <!-- 安全预览已脱敏文本 -->
          <div class="snippet-preview">
            <small>剪贴板特征来源预览：{{ parseResult.rawTextPreview }}</small>
          </div>

          <!-- 导入确认按钮 -->
          <button
            class="confirm-import-btn"
            :disabled="isImporting"
            @click="handleConfirmImport"
          >
            {{ isImporting ? '正在导入中...' : '确认导入该歌单' }}
          </button>
        </div>

        <!-- 手动输入备用折叠区 -->
        <div class="manual-toggle-row">
          <button class="toggle-text-btn" @click="showManualArea = !showManualArea">
            {{ showManualArea ? '收起手动粘贴' : '剪贴板权限受限？点击手动粘贴' }}
          </button>
        </div>

        <div v-if="showManualArea" class="manual-input-box">
          <textarea
            v-model="manualInput"
            class="manual-textarea"
            rows="3"
            placeholder="粘贴音乐链接、分享文案或每行一首歌曲（如：晴天 - 周杰伦）"
          ></textarea>
          <button class="manual-parse-btn" :disabled="!manualInput.trim()" @click="handleManualParse">
            解析文本
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.clipboard-modal-mask {
  position: absolute;
  inset: 0;
  z-index: 85;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
}

.clipboard-modal-sheet {
  width: 100%;
  max-height: 82%;
  border: 1px solid var(--music-card-border);
  border-radius: 20px 20px 0 0;
  background: var(--music-card-bg);
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.14);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 18px 14px;
  border-bottom: 1px solid var(--music-divider);
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.main-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--music-text);
}

.privacy-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  font-size: 10px;
  font-weight: 600;
}

.sub-title {
  margin-top: 4px;
  color: var(--music-text-sub);
  font-size: 11px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: var(--music-pill-bg);
  color: var(--music-text);
  font-size: 20px;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.modal-body {
  max-height: 64vh;
  overflow-y: auto;
  padding: 14px 16px calc(24px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.privacy-notice-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--music-secondary-bg);
  border: 1px solid var(--music-card-border);
}

.privacy-icon {
  color: #10b981;
  margin-top: 1px;
  flex-shrink: 0;
}

.privacy-content strong {
  display: block;
  font-size: 12px;
  color: var(--music-text);
  margin-bottom: 2px;
}

.privacy-content span {
  display: block;
  font-size: 10px;
  color: var(--music-text-sub);
  line-height: 1.45;
}

.action-section {
  margin-top: 2px;
}

.primary-read-btn {
  width: 100%;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: var(--music-text);
  color: var(--music-bg);
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: opacity 0.2s;
}

.primary-read-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  font-size: 11px;
}

.result-card {
  padding: 14px;
  border-radius: 14px;
  background: var(--music-secondary-bg);
  border: 1px solid var(--music-card-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.result-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--music-pill-bg);
  color: var(--music-text);
}

.result-status {
  font-size: 10px;
  color: #10b981;
  font-weight: 600;
}

.result-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--music-text);
}

.result-desc {
  font-size: 11px;
  color: var(--music-text-sub);
}

.preview-tracks-box {
  margin-top: 4px;
  border-top: 1px solid var(--music-divider);
  padding-top: 8px;
}

.preview-label {
  font-size: 11px;
  color: var(--music-text-sub);
  margin-bottom: 6px;
}

.track-scroll-list {
  max-height: 120px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.track-preview-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--music-text);
}

.track-idx {
  color: var(--music-text-sub);
  width: 16px;
}

.track-t {
  font-weight: 500;
}

.track-a {
  color: var(--music-text-sub);
}

.more-tracks-tip {
  font-size: 10px;
  color: var(--music-text-sub);
  padding-top: 2px;
}

.snippet-preview {
  margin-top: 4px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--music-pill-bg);
  color: var(--music-text-sub);
  font-size: 10px;
  word-break: break-all;
}

.confirm-import-btn {
  margin-top: 6px;
  height: 38px;
  border: 0;
  border-radius: 10px;
  background: #10b981;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.confirm-import-btn:disabled {
  opacity: 0.6;
}

.manual-toggle-row {
  text-align: center;
  margin-top: 4px;
}

.toggle-text-btn {
  background: none;
  border: 0;
  color: var(--music-text-sub);
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
}

.manual-input-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.manual-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--music-card-border);
  border-radius: 10px;
  background: var(--music-secondary-bg);
  color: var(--music-text);
  font-size: 11px;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
}

.manual-parse-btn {
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: var(--music-pill-bg);
  color: var(--music-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
</style>
