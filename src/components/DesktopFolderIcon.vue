<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed } from 'vue'
import type { DesktopFolderEntry } from '../composables/useDesktopLayout'

interface AppInfo {
  id: string
  name: string
  icon: string
  color: string
  customImage?: string | null
}

const props = defineProps<{
  folder: DesktopFolderEntry
  appsById: Record<string, AppInfo>
  editing?: boolean
  badge?: number
}>()

const previewApps = computed(() => props.folder.appIds.slice(0, 4).map(id => props.appsById[id]).filter(Boolean))
</script>

<template>
  <div class="folder-icon-wrapper" :class="{ editing }">
    <div class="folder-preview-wrap">
      <div class="folder-preview">
        <div v-for="app in previewApps" :key="app.id" class="mini-icon" :style="app.customImage ? { backgroundImage: `url(${app.customImage})` } : {}">
          <div v-if="!app.customImage" v-html="app.icon"></div>
        </div>
        <div v-for="emptyIndex in Math.max(0, 4 - previewApps.length)" :key="`empty-${emptyIndex}`" class="mini-icon empty-slot"><span v-if="emptyIndex === 1">＋</span></div>
      </div>
      <div v-if="badge && badge > 0" class="folder-badge">{{ badge > 99 ? '99+' : badge }}</div>
    </div>
    <span class="folder-name">{{ folder.name }}</span>
  </div>
</template>

<style scoped>
.folder-icon-wrapper { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; user-select: none; -webkit-user-select: none; }
.folder-preview-wrap { position: relative; }
.folder-preview { width: 14.5vw; aspect-ratio: 1; padding: 2.1vw; border-radius: 22%; display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(2, 1fr); gap: 1.1vw; background: rgba(238, 245, 250, .72); border: 1px solid rgba(255,255,255,.38); box-shadow: 0 .5vh 1.5vh var(--shadow-color); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); transform: translateZ(0); }
.mini-icon { min-width: 0; min-height: 0; overflow: hidden; border-radius: 28%; display: flex; align-items: center; justify-content: center; background: var(--card-bg-solid); background-size: cover; background-position: center; color: var(--text-primary); }
.mini-icon :deep(.text-icon) { font-size: clamp(7px, 2.4vw, 13px); font-weight: 600; }
.empty-slot { color: rgba(80, 120, 160, .62); background: rgba(150, 190, 230, .22); font-size: 3.5vw; }
.folder-name { margin-top: .7vh; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); font-size: calc(9.5px + .4vw); font-weight: 500; text-shadow: var(--icon-text-shadow); }
.folder-badge { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: #fff; background: #ff3b30; font-size: 11px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,.2); }
.editing { animation: folder-wiggle .17s ease-in-out infinite alternate; }
@keyframes folder-wiggle { from { transform: rotate(-1deg); } to { transform: rotate(1deg); } }
@media (min-width: 768px) {
  .folder-preview { width: 64px; padding: 9px; gap: 5px; border-radius: 14px; }
  .mini-icon :deep(.text-icon) { font-size: 11px; }
  .empty-slot { font-size: 16px; }
  .folder-name { margin-top: 8px; font-size: 13px; }
}
@media (prefers-reduced-motion: reduce) { .editing { animation: none; } }
</style>
