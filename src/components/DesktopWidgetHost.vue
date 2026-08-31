<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { DesktopWidgetEntry } from '../composables/useDesktopLayout'
import { useWidgetSourceRuntime } from '../services/widgetSourceRuntime'
import DualAvatarWidget from './DualAvatarWidget.vue'
import MomentCard from './MomentCard.vue'
import CustomImageWidget from './CustomImageWidget.vue'
import FolderImageWidget from './FolderImageWidget.vue'
import DualFrameWidget from './DualFrameWidget.vue'
import CircleAvatarWidget from './CircleAvatarWidget.vue'
import RectangleImageWidget from './RectangleImageWidget.vue'
import ProfileCardWidget from './ProfileCardWidget.vue'
import AboutUsWidget from './AboutUsWidget.vue'
import WidgetSourceRenderer from './WidgetSourceRenderer.vue'

const props = defineProps<{ entry: DesktopWidgetEntry; editing?: boolean; hideDelete?: boolean }>()
defineEmits<{ delete: []; resize: [] }>()
const { overrides, loadWidgetSources } = useWidgetSourceRuntime()
const customSource = computed(() => overrides[props.entry.widgetType]?.source ?? '')
onMounted(loadWidgetSources)
</script>

<template>
  <div class="widget-host" :class="{ editing }" :data-widget-size="`${entry.widthUnits}x${entry.heightUnits}`">
    <button v-if="editing && !hideDelete" type="button" class="delete-widget" aria-label="删除小组件" @pointerdown.stop @click.stop="$emit('delete')">−</button>
    <button v-if="editing && !hideDelete" type="button" class="resize-widget" aria-label="调整小组件尺寸" @pointerdown.stop @click.stop="$emit('resize')">{{ entry.widthUnits }}×{{ entry.heightUnits }}</button>
    <WidgetSourceRenderer v-if="customSource" :widget-type="entry.widgetType" :source="customSource" :instance-id="entry.id" :editing="editing" :width-units="entry.widthUnits" :height-units="entry.heightUnits" />
    <MomentCard v-else-if="entry.widgetType === 'moment-card'" :instance-id="entry.id" :editing="editing" />
    <DualAvatarWidget v-else-if="entry.widgetType === 'dual-avatar'" :instance-id="entry.id" :editing="editing" />
    <FolderImageWidget v-else-if="entry.widgetType === 'folder-widget'" :instance-id="entry.id" :editing="editing" />
    <DualFrameWidget v-else-if="entry.widgetType === 'dual-frame'" :instance-id="entry.id" :editing="editing" />
    <CircleAvatarWidget v-else-if="entry.widgetType === 'circle-avatar-widget'" :instance-id="entry.id" :editing="editing" />
    <RectangleImageWidget v-else-if="entry.widgetType === 'rectangle-image'" :instance-id="entry.id" :editing="editing" />
    <ProfileCardWidget v-else-if="entry.widgetType === 'profile-card-widget'" :instance-id="entry.id" :editing="editing" />
    <AboutUsWidget v-else-if="entry.widgetType === 'about-us-widget'" :instance-id="entry.id" :editing="editing" />
    <CustomImageWidget v-else :instance-id="entry.id" :editing="editing" />
  </div>
</template>

<style scoped>
.widget-host { position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; user-select: none; -webkit-user-select: none; }
.widget-host.editing { animation: widget-wiggle .18s ease-in-out infinite alternate; }
.delete-widget { position: absolute; z-index: 25; top: -9px; left: -9px; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; background: rgba(88,88,92,.94); box-shadow: 0 2px 7px rgba(0,0,0,.24); font-size: 21px; line-height: 1; }
.resize-widget { position:absolute;z-index:25;top:-9px;right:-7px;height:23px;min-width:34px;padding:0 7px;border:0;border-radius:999px;background:rgba(88,88,92,.94);box-shadow:0 2px 7px rgba(0,0,0,.24);color:#fff;font:inherit;font-size:9px;line-height:23px;white-space:nowrap; }
@keyframes widget-wiggle { from { transform: rotate(-.35deg); } to { transform: rotate(.35deg); } }
@media (prefers-reduced-motion: reduce) { .widget-host.editing { animation: none; } }
</style>
