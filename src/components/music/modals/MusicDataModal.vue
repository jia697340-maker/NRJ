/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMusicLibrary } from '../../../composables/useMusicLibrary'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()
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
  <div v-if="visible" class="data-mask" @click="emit('close')">
    <section class="data-sheet" @click.stop>
      <header class="data-header"><div><div class="data-title">曲库工具</div><div class="data-subtitle">本地音乐、歌单与备份</div></div><button class="data-close" @click="emit('close')">×</button></header>
      <div class="data-body">
        <div class="stats-grid"><div><strong>{{ history.length }}</strong><small>听过歌曲</small></div><div><strong>{{ totalMinutes }}</strong><small>累计分钟</small></div><div><strong>{{ likedTracks.length }}</strong><small>喜欢</small></div><div><strong>{{ localTracks.length }}</strong><small>本地</small></div></div>
        <div class="top-artist">最常听的歌手 <strong>{{ topArtist }}</strong></div>
        <button class="data-card" :disabled="busy" @click="selectAudio"><span class="data-icon">入</span><span><strong>导入本地音乐</strong><small>支持多选音频，并可同时选择同名 LRC 歌词</small></span><b>›</b></button>
        <input ref="audioInput" class="hidden-input" type="file" accept="audio/*,.flac,.m4a,.aac,.ogg,.opus,.wav,.lrc,.txt" multiple @change="handleAudio" />
        <div class="create-card"><div class="data-icon">单</div><input v-model="playlistName" class="data-input" placeholder="新歌单名称" @keyup.enter="handleCreate" /><button class="create-btn" @click="handleCreate">创建</button></div>
        <div class="create-card"><div class="data-icon">链</div><input v-model="playlistLink" class="data-input" placeholder="粘贴网易云歌单链接" @keyup.enter="handleLink" /><button class="create-btn" :disabled="busy" @click="handleLink">导入</button></div>
        <button class="data-card" :disabled="busy" @click="playlistInput?.click()"><span class="data-icon">表</span><span><strong>导入歌单文件</strong><small>支持 M3U、M3U8，以及本应用 JSON 音乐备份</small></span><b>›</b></button>
        <input ref="playlistInput" class="hidden-input" type="file" accept=".m3u,.m3u8,.json,text/plain,application/json" @change="handlePlaylistFile" />
        <button class="data-card" @click="exportLibrary"><span class="data-icon">出</span><span><strong>导出音乐资料</strong><small>导出收藏、历史、歌单与来源设置，不含账号凭证</small></span><b>›</b></button>
        <button class="data-card" :disabled="busy" @click="backupInput?.click()"><span class="data-icon">合</span><span><strong>合并音乐备份</strong><small>保留现有数据并合并导入 JSON 备份</small></span><b>›</b></button>
        <input ref="backupInput" class="hidden-input" type="file" accept="application/json,.json" @change="handleBackup" />
        <div class="data-note">本地音频保存在浏览器 IndexedDB 中，不写入普通 localStorage。清除站点数据会同时删除本地曲库副本。</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.data-mask{position:absolute;inset:0;z-index:81;display:flex;align-items:flex-end;background:rgba(0,0,0,.42);backdrop-filter:blur(8px)}.data-sheet{width:100%;max-height:78%;border:1px solid var(--music-card-border);border-radius:20px 20px 0 0;background:var(--music-card-bg);box-shadow:0 -8px 30px rgba(0,0,0,.12)}.data-header{display:flex;align-items:center;justify-content:space-between;padding:19px 18px 14px;border-bottom:1px solid var(--music-divider)}.data-title{font-size:17px;font-weight:750}.data-subtitle{margin-top:4px;color:var(--music-text-sub);font-size:11px}.data-close{width:32px;height:32px;border:0;border-radius:50%;background:var(--music-pill-bg);color:var(--music-text);font-size:22px}.data-body{max-height:62vh;overflow:auto;padding:14px 16px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px}.data-card,.create-card{width:100%;min-height:64px;padding:12px;display:flex;align-items:center;gap:11px;border:1px solid var(--music-card-border);border-radius:14px;background:var(--music-secondary-bg);color:var(--music-text);text-align:left}.data-card span:nth-child(2){min-width:0;flex:1}.data-card strong{display:block;font-size:13px}.data-card small{display:block;margin-top:4px;color:var(--music-text-sub);font-size:10px;line-height:1.4}.data-card b{color:var(--music-text-sub);font-size:21px;font-weight:400}.data-icon{width:34px;height:34px;flex:0 0 auto;display:grid;place-items:center;border:1px solid var(--music-card-border);border-radius:10px;background:var(--music-card-bg);font-size:12px;font-weight:800}.hidden-input{display:none}.data-input{min-width:0;flex:1;height:36px;padding:0 11px;border:1px solid var(--music-card-border);border-radius:10px;outline:0;background:var(--music-card-bg);color:var(--music-text);font:inherit;font-size:12px}.create-btn{height:36px;padding:0 14px;border:0;border-radius:10px;background:var(--music-text);color:var(--music-bg);font-weight:700}.data-note{padding:5px 3px;color:var(--music-text-sub);font-size:10px;line-height:1.6}.data-card:disabled{opacity:.5}.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.stats-grid div{padding:10px 3px;border:1px solid var(--music-card-border);border-radius:12px;background:var(--music-secondary-bg);text-align:center}.stats-grid strong,.stats-grid small{display:block}.stats-grid strong{font-size:15px}.stats-grid small{margin-top:3px;color:var(--music-text-sub);font-size:8px}.top-artist{padding:10px 12px;border:1px solid var(--music-card-border);border-radius:12px;background:var(--music-secondary-bg);color:var(--music-text-sub);font-size:10px}.top-artist strong{float:right;color:var(--music-text);font-size:11px}
</style>
