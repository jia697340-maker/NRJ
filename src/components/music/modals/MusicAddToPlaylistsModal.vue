/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MusicPlaylist, MusicTrack } from '../../../types/music'
import { musicTrackKey } from '../../../types/music'

const props = defineProps<{ visible: boolean; track: MusicTrack | null; playlists: MusicPlaylist[]; playlistTracks: Record<string, MusicTrack[]> }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'add', playlistIds: string[], track: MusicTrack): void }>()
const selected = ref<string[]>([])
const query = ref('')
const filtered = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  return normalized ? props.playlists.filter(item => item.name.toLowerCase().includes(normalized)) : props.playlists
})
const containsTrack = (playlistId: string) => props.track ? (props.playlistTracks[playlistId] || []).some(item => musicTrackKey(item) === musicTrackKey(props.track!)) : false
const addablePlaylists = computed(() => props.playlists.filter(item => !containsTrack(item.id)))
const allSelected = computed(() => addablePlaylists.value.length > 0 && addablePlaylists.value.every(item => selected.value.includes(item.id)))
watch(() => props.visible, visible => {
  if (!visible) return
  query.value = ''
  selected.value = []
})
const toggle = (id: string) => { if (!containsTrack(id)) selected.value = selected.value.includes(id) ? selected.value.filter(item => item !== id) : [...selected.value, id] }
const toggleAll = () => { selected.value = allSelected.value ? [] : addablePlaylists.value.map(item => item.id) }
const submit = () => { if (props.track && selected.value.length) emit('add', selected.value, props.track) }
</script>

<template>
  <div v-if="visible" class="add-mask" @click.self="emit('close')">
    <section class="add-sheet" role="dialog" aria-modal="true" aria-label="添加到歌单">
      <header><div><strong>添加到歌单</strong><small>{{ track ? `${track.title} · 已选择 ${selected.length} 个` : '请选择歌曲' }}</small></div><button aria-label="关闭" @click="emit('close')">×</button></header>
      <div class="add-tools"><div class="search-box"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16" y1="16" x2="21" y2="21"/></svg><input v-model="query" placeholder="搜索我的歌单" /></div><button class="all-button" :class="{ active: allSelected }" @click="toggleAll">{{ allSelected ? '取消全选' : '全选' }}</button></div>
      <div class="playlist-options">
        <div v-if="!playlists.length" class="empty-state"><strong>还没有自己的歌单</strong><span>请先到“我的”页面创建歌单。</span></div>
        <button v-for="playlist in filtered" :key="playlist.id" class="playlist-option" :class="{ existing: containsTrack(playlist.id) }" @click="toggle(playlist.id)">
          <span class="cover" :style="playlist.coverUrl ? { backgroundImage: `url(${playlist.coverUrl})` } : {}"><i v-if="!playlist.coverUrl">单</i></span>
          <span class="meta"><b>{{ playlist.name }}</b><small>{{ playlist.trackCount }} 首<span v-if="containsTrack(playlist.id)"> · 已在歌单中</span></small></span>
          <i class="check" :class="{ active: selected.includes(playlist.id) || containsTrack(playlist.id) }"><svg v-if="selected.includes(playlist.id) || containsTrack(playlist.id)" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="5 12 10 17 19 7"/></svg></i>
        </button>
        <div v-if="playlists.length && !filtered.length" class="empty-state"><span>没有匹配的歌单</span></div>
      </div>
      <footer><button class="cancel" @click="emit('close')">取消</button><button class="submit" :disabled="!selected.length || !track" @click="submit">添加到 {{ selected.length }} 个歌单</button></footer>
    </section>
  </div>
</template>

<style scoped>
.add-mask{position:absolute;inset:0;z-index:93;display:flex;align-items:flex-end;background:rgba(0,0,0,.42);backdrop-filter:blur(8px)}.add-sheet{width:100%;height:min(72%,620px);display:flex;flex-direction:column;border:1px solid var(--music-card-border);border-radius:20px 20px 0 0;background:var(--music-card-bg);color:var(--music-text)}header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid var(--music-divider)}header>div{min-width:0}header strong,header small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}header strong{font-size:16px}header small{margin-top:3px;color:var(--music-text-sub);font-size:10px}header button{width:32px;height:32px;flex:0 0 auto;border:0;border-radius:50%;background:var(--music-pill-bg);color:var(--music-text);font-size:21px}.add-tools{display:flex;gap:8px;padding:11px 16px}.search-box{height:36px;min-width:0;flex:1;display:flex;align-items:center;gap:7px;padding:0 10px;border:1px solid var(--music-card-border);border-radius:11px;background:var(--music-secondary-bg);color:var(--music-text-sub)}.search-box input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--music-text);font-size:11px}.all-button{height:36px;flex:0 0 auto;padding:0 12px;border:1px solid var(--music-card-border);border-radius:11px;background:var(--music-pill-bg);color:var(--music-text);font-size:10px}.all-button.active{background:var(--music-text);color:var(--music-bg)}.playlist-options{min-height:0;overflow:auto;padding:0 16px 10px}.playlist-option{width:100%;min-width:0;display:flex;align-items:center;gap:10px;padding:7px 0;border:0;border-bottom:1px solid var(--music-divider);background:transparent;color:var(--music-text);text-align:left}.playlist-option.existing{opacity:.62}.cover{width:43px;height:43px;flex:0 0 auto;display:grid;place-items:center;border:1px solid var(--music-card-border);border-radius:9px;background:var(--music-secondary-bg) center/cover no-repeat}.cover i{font-style:normal;font-size:9px}.meta{min-width:0;flex:1}.meta b,.meta small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.meta b{font-size:12px}.meta small{margin-top:4px;color:var(--music-text-sub);font-size:9px}.check{width:20px;height:20px;flex:0 0 auto;display:grid;place-items:center;box-sizing:border-box;border:1px solid var(--music-card-border);border-radius:6px;color:var(--music-bg)}.check.active{border-color:var(--music-text);background:var(--music-text)}.empty-state{display:flex;min-height:110px;align-items:center;justify-content:center;flex-direction:column;gap:6px;color:var(--music-text-sub);font-size:10px;text-align:center}.empty-state strong{color:var(--music-text);font-size:12px}footer{display:grid;grid-template-columns:1fr 1.7fr;gap:8px;padding:10px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--music-divider)}footer button{height:40px;border:0;border-radius:12px;font-size:11px;font-weight:700}.cancel{background:var(--music-pill-bg);color:var(--music-text)}.submit{background:var(--music-text);color:var(--music-bg)}.submit:disabled{opacity:.45}@media(max-width:340px){.add-tools,.playlist-options,footer{padding-left:12px;padding-right:12px}.all-button{padding:0 9px}}
</style>
