<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChatState } from '../../../composables/useChatState'
import {
  bubbleWorkshopState,
  getAllBubblePresets,
  getBubblePreset,
  setChatBubblePreset,
  setGlobalBubblePreset,
  type BubblePreset
} from '../../../services/bubbleWorkshop'

const emit = defineEmits<{ close: [] }>()
const { selectedChat } = useChatState()
const scope = ref<'chat' | 'global'>('chat')
const currentAssignment = computed(() => selectedChat.value ? bubbleWorkshopState.chatPresetIds[String(selectedChat.value.id)] : '')
const selectedId = ref(currentAssignment.value || bubbleWorkshopState.globalPresetId || '')
const presets = computed(() => getAllBubblePresets())
const selectedPreset = computed(() => getBubblePreset(selectedId.value))
const followsGlobal = computed(() => !currentAssignment.value)

const chooseScope = (value: 'chat' | 'global') => {
  scope.value = value
  selectedId.value = value === 'global'
    ? bubbleWorkshopState.globalPresetId
    : (currentAssignment.value || bubbleWorkshopState.globalPresetId)
}

const apply = () => {
  if (scope.value === 'global') setGlobalBubblePreset(selectedId.value || null)
  else if (selectedChat.value) setChatBubblePreset(selectedChat.value.id, selectedId.value || null)
  emit('close')
}

const followGlobal = () => {
  if (selectedChat.value) setChatBubblePreset(selectedChat.value.id, null)
  emit('close')
}

const miniStyle = (preset: BubblePreset, target: 'self' | 'other') => {
  const value = preset[target]
  return {
    color: value.textColor,
    background: value.gradientEnd ? `linear-gradient(${value.gradientAngle}deg,${value.background},${value.gradientEnd})` : value.background,
    border: value.borderStyle === 'none' ? 'none' : `${value.borderWidth}px ${value.borderStyle} ${value.borderColor}`,
    borderRadius: target === 'self' ? `${value.radius}px ${value.corner}px ${value.radius}px ${value.radius}px` : `${value.corner}px ${value.radius}px ${value.radius}px ${value.radius}px`,
    boxShadow: `0 ${value.shadowY}px ${value.shadowBlur}px ${value.shadowColor}`
  }
}
</script>

<template>
  <div class="bpm-page">
    <header class="bpm-header">
      <button class="bpm-back" aria-label="返回" @click="emit('close')"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg></button>
      <div><strong>气泡样式</strong><small>{{ selectedPreset.name }}</small></div>
      <button class="bpm-apply" @click="apply">应用</button>
    </header>

    <main class="bpm-body">
      <section class="bpm-section">
        <div class="bpm-section-title"><strong>应用范围</strong><small>当前聊天可覆盖全局设置</small></div>
        <div class="bpm-scope">
          <button :class="{ active: scope === 'chat' }" @click="chooseScope('chat')"><span>当前聊天</span><small>{{ followsGlobal ? '目前跟随全局' : '已有专属样式' }}</small></button>
          <button :class="{ active: scope === 'global' }" @click="chooseScope('global')"><span>全局默认</span><small>用于未单独设置的聊天</small></button>
        </div>
        <button v-if="scope === 'chat' && !followsGlobal" class="bpm-follow" @click="followGlobal">恢复跟随全局气泡</button>
      </section>

      <section class="bpm-section">
        <div class="bpm-section-title"><strong>我的气泡</strong><small>{{ presets.length }} 个作品</small></div>
        <div v-if="presets.length" class="bpm-grid">
          <button v-for="preset in presets" :key="preset.id" class="bpm-card" :class="{ active: selectedId === preset.id }" @click="selectedId = preset.id">
            <span class="bpm-preview">
              <i :style="miniStyle(preset, 'other')">你好呀</i>
              <i :style="miniStyle(preset, 'self')">在这里</i>
            </span>
            <span class="bpm-card-name"><strong>{{ preset.name }}</strong><small>{{ preset.source === 'imported' ? '导入的作品' : '我的创作' }}</small></span>
            <i class="bpm-check"><svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10" /></svg></i>
          </button>
        </div>
        <div v-else class="bpm-empty"><strong>还没有气泡作品</strong><span>在气泡工坊创作或导入后，会显示在这里。</span></div>
      </section>

      <section class="bpm-system-row">
        <div><strong>恢复系统气泡</strong><small>清除当前范围的作品效果，不会生成预设。</small></div>
        <button :class="{ active: !selectedId }" @click="selectedId = ''">选择</button>
      </section>

      <p class="bpm-tip">气泡工坊中的保存作品和导入方案会自动同步到这里。</p>
    </main>
  </div>
</template>

<style scoped>
.bpm-page{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;background:var(--sys-bg-primary,#f7f8fa);color:var(--text-primary,#282828)}.bpm-page *{box-sizing:border-box}.bpm-page button{border:0;font:inherit}.bpm-header{height:calc(60px + env(safe-area-inset-top,0px));flex:0 0 calc(60px + env(safe-area-inset-top,0px));display:grid;grid-template-columns:42px minmax(0,1fr) 56px;align-items:end;gap:5px;padding:env(safe-area-inset-top,0px) 12px 10px;border-bottom:1px solid var(--border-color,#e7e7e7);background:color-mix(in srgb,var(--sys-bg-primary,#fff) 92%,transparent);backdrop-filter:blur(14px)}.bpm-header>div{min-width:0;text-align:center}.bpm-header strong,.bpm-header small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bpm-header strong{font-size:17px;font-weight:600}.bpm-header small{margin-top:2px;color:var(--text-tertiary,#888);font-size:11px}.bpm-back{width:36px;height:36px;display:grid;place-items:center;border-radius:10px;background:transparent;color:var(--text-secondary,#666);cursor:pointer}.bpm-back svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.bpm-apply{height:36px;padding:0 13px;border-radius:10px;background:var(--theme-color,#4f7cff);color:#fff;cursor:pointer;font-size:13px;font-weight:650}.bpm-body{min-height:0;flex:1;overflow-y:auto;padding:18px 15px calc(30px + env(safe-area-inset-bottom,0px))}.bpm-section,.bpm-system-row,.bpm-tip{max-width:620px;margin-left:auto;margin-right:auto}.bpm-section{margin-bottom:22px}.bpm-section-title{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:0 3px 10px}.bpm-section-title strong{font-size:15px}.bpm-section-title small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-tertiary,#888);font-size:12px}.bpm-scope{display:grid;grid-template-columns:1fr 1fr;gap:9px}.bpm-scope button{min-width:0;min-height:68px;padding:12px 13px;border:1px solid var(--border-color,#e3e6eb);border-radius:13px;background:var(--sys-bg-secondary,#fff);color:var(--text-primary,#333);text-align:left;cursor:pointer}.bpm-scope button.active{border-color:color-mix(in srgb,var(--theme-color,#4f7cff) 58%,var(--border-color));background:color-mix(in srgb,var(--theme-color,#4f7cff) 7%,var(--sys-bg-secondary,#fff))}.bpm-scope span,.bpm-scope small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bpm-scope span{font-size:14px;font-weight:600}.bpm-scope small{margin-top:6px;color:var(--text-tertiary,#888);font-size:11px}.bpm-follow{width:100%;height:38px;margin-top:9px;border:1px solid var(--border-color,#e3e6eb)!important;border-radius:10px;background:transparent;color:var(--theme-color,#4f7cff);cursor:pointer;font-size:13px}.bpm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.bpm-card{min-width:0;padding:10px;border:1px solid var(--border-color,#e3e6eb);border-radius:14px;background:var(--sys-bg-secondary,#fff);color:var(--text-primary,#333);cursor:pointer;text-align:left;position:relative}.bpm-card.active{border-color:color-mix(in srgb,var(--theme-color,#4f7cff) 62%,var(--border-color));box-shadow:0 0 0 1px color-mix(in srgb,var(--theme-color,#4f7cff) 14%,transparent)}.bpm-preview{height:86px;display:flex;flex-direction:column;justify-content:center;gap:8px;padding:11px;border-radius:10px;background:var(--sys-bg-primary,#f3f5f7);overflow:hidden}.bpm-preview i{max-width:82%;padding:7px 10px;font-size:11px;font-style:normal;line-height:1.35;white-space:nowrap}.bpm-preview i:first-child{align-self:flex-start}.bpm-preview i:last-child{align-self:flex-end}.bpm-card-name{min-width:0;display:block;padding:9px 27px 1px 2px}.bpm-card-name strong,.bpm-card-name small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bpm-card-name strong{font-size:13px}.bpm-card-name small{margin-top:4px;color:var(--text-tertiary,#888);font-size:11px}.bpm-check{position:absolute;right:11px;bottom:12px;width:18px;height:18px;display:none;place-items:center;border-radius:50%;background:var(--theme-color,#4f7cff);color:#fff}.bpm-card.active .bpm-check{display:grid}.bpm-check svg{width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}.bpm-empty{padding:25px 18px;border:1px dashed var(--border-color,#dfe3e8);border-radius:13px;text-align:center}.bpm-empty strong,.bpm-empty span{display:block}.bpm-empty strong{font-size:14px}.bpm-empty span{margin-top:6px;color:var(--text-tertiary,#888);font-size:12px;line-height:1.5}.bpm-system-row{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--border-color,#e3e6eb);border-radius:13px;background:var(--sys-bg-secondary,#fff)}.bpm-system-row>div{min-width:0;flex:1}.bpm-system-row strong,.bpm-system-row small{display:block}.bpm-system-row strong{font-size:14px}.bpm-system-row small{margin-top:5px;color:var(--text-tertiary,#888);font-size:11px;line-height:1.45}.bpm-system-row button{height:34px;flex:0 0 auto;padding:0 12px;border:1px solid var(--border-color,#e3e6eb);border-radius:9px;background:var(--sys-bg-primary,#f5f6f8);color:var(--text-secondary,#666);cursor:pointer;font-size:12px}.bpm-system-row button.active{border-color:var(--theme-color,#4f7cff);color:var(--theme-color,#4f7cff)}.bpm-tip{margin-top:14px;color:var(--text-tertiary,#888);font-size:12px;line-height:1.6;text-align:center}@media(max-width:360px){.bpm-body{padding-left:10px;padding-right:10px}.bpm-scope,.bpm-grid{gap:6px}.bpm-scope button{padding-left:10px;padding-right:10px}.bpm-card{padding:8px}.bpm-preview{height:78px;padding:9px}.bpm-section-title small{max-width:155px}.bpm-system-row{padding:12px}}@media(max-width:320px){.bpm-header{grid-template-columns:36px minmax(0,1fr) 52px;padding-left:7px;padding-right:7px}.bpm-header strong{font-size:16px}.bpm-grid{grid-template-columns:1fr}.bpm-preview{height:82px}}
</style>
