/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'
import type { MusicQuality } from '../../../types/music'
import { useMusicPlayer } from '../../../composables/useMusicPlayer'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { volume, preferredQuality, sleepEndsAt, setVolume, setQuality, setSleepTimer } = useMusicPlayer()
const qualities: Array<{ id: MusicQuality; name: string; desc: string }> = [
  { id: 'standard', name: '标准', desc: '省流' }, { id: 'higher', name: '较高', desc: '192k' },
  { id: 'exhigh', name: '极高', desc: '320k' }, { id: 'lossless', name: '无损', desc: 'FLAC' }, { id: 'hires', name: 'Hi-Res', desc: '最高可用' }
]
const timers = [{ value: 0, label: '关闭' }, { value: 15, label: '15 分钟' }, { value: 30, label: '30 分钟' }, { value: 60, label: '1 小时' }]
const sleepText = computed(() => sleepEndsAt.value > Date.now() ? `将在 ${Math.max(1, Math.ceil((sleepEndsAt.value - Date.now()) / 60000))} 分钟后停止` : '未设置定时停止')
</script>

<template>
  <div v-if="visible" class="playback-mask" @click="emit('close')">
    <section class="playback-sheet" @click.stop>
      <header><div><strong>播放设置</strong><small>音质、音量与定时停止</small></div><button @click="emit('close')">×</button></header>
      <div class="playback-body">
        <div class="setting-block"><div class="setting-title"><span>音量</span><b>{{ Math.round(volume * 100) }}%</b></div><input class="volume-slider" type="range" min="0" max="1" step="0.01" :value="volume" @input="setVolume(Number(($event.target as HTMLInputElement).value))" /></div>
        <div class="setting-block"><div class="setting-title"><span>在线音质</span><b>不可用时自动降级</b></div><div class="quality-grid"><button v-for="item in qualities" :key="item.id" :class="{ active: preferredQuality === item.id }" @click="setQuality(item.id)"><strong>{{ item.name }}</strong><small>{{ item.desc }}</small></button></div></div>
        <div class="setting-block"><div class="setting-title"><span>定时停止</span><b>{{ sleepText }}</b></div><div class="timer-row"><button v-for="item in timers" :key="item.value" @click="setSleepTimer(item.value)">{{ item.label }}</button></div></div>
        <div class="setting-note">平台最终返回的音质取决于账号权益、歌曲版权和来源能力；播放器不会伪造无损标识。</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.playback-mask{position:absolute;inset:0;z-index:82;display:flex;align-items:flex-end;background:rgba(0,0,0,.42);backdrop-filter:blur(8px)}.playback-sheet{width:100%;border:1px solid var(--music-card-border);border-radius:20px 20px 0 0;background:var(--music-card-bg)}header{display:flex;align-items:center;justify-content:space-between;padding:18px;border-bottom:1px solid var(--music-divider)}header strong{display:block;font-size:17px}header small{display:block;margin-top:4px;color:var(--music-text-sub);font-size:11px}header button{width:32px;height:32px;border:0;border-radius:50%;background:var(--music-pill-bg);color:var(--music-text);font-size:22px}.playback-body{padding:14px 16px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px}.setting-block{padding:13px;border:1px solid var(--music-card-border);border-radius:14px;background:var(--music-secondary-bg)}.setting-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.setting-title span{font-size:13px;font-weight:750}.setting-title b{color:var(--music-text-sub);font-size:9px;font-weight:500}.volume-slider{width:100%;height:4px;margin:5px 0;appearance:none;border:0;border-radius:999px;background:var(--music-text-muted);outline:0}.volume-slider::-webkit-slider-thumb{width:17px;height:17px;appearance:none;border:3px solid var(--music-card-bg);border-radius:50%;background:var(--music-text);box-shadow:0 1px 5px rgba(0,0,0,.2)}.quality-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.quality-grid button,.timer-row button{padding:9px 3px;border:1px solid var(--music-card-border);border-radius:10px;background:var(--music-card-bg);color:var(--music-text)}.quality-grid button.active{background:var(--music-text);color:var(--music-bg)}.quality-grid strong,.quality-grid small{display:block}.quality-grid strong{font-size:10px}.quality-grid small{margin-top:3px;font-size:8px;opacity:.6}.timer-row{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.timer-row button{font-size:10px}.setting-note{color:var(--music-text-sub);font-size:9px;line-height:1.6}
</style>
