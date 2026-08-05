<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import type { WorldBook, WorldBookEntry } from '../../../store'

const props = defineProps<{
  showVisualSettings: boolean
  showBookSettings: boolean
  showEntrySettings: boolean
  activeBook: WorldBook | null
  activeEntry: WorldBookEntry | null
}>()

const emit = defineEmits<{
  (e: 'update:showVisualSettings', value: boolean): void
  (e: 'update:showBookSettings', value: boolean): void
  (e: 'update:showEntrySettings', value: boolean): void
  (e: 'openCoverModal'): void
  (e: 'openBgModal'): void
  (e: 'updateEntry'): void
  (e: 'markBookUpdated'): void
}>()
</script>

<template>
  <!-- Visual Settings Modal -->
  <transition name="fade">
    <div v-if="showVisualSettings" class="settings-modal-mask" @click="emit('update:showVisualSettings', false)">
      <div class="settings-modal" @click.stop>
        <div class="modal-header">
          <span>外观设置</span>
          <div class="close-modal" @click="emit('update:showVisualSettings', false)">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>
        <div class="modal-body" v-if="activeBook">
          <div class="s-block">
            <div class="s-title">封面与背景</div>
            <div class="visual-btn-group">
              <div class="v-btn" @click="emit('openCoverModal')">更换封面</div>
              <div class="v-btn" @click="emit('openBgModal')">更换背景</div>
            </div>
          </div>
          
          <div class="s-block">
            <div class="s-title">背景模糊程度</div>
            <div class="s-slider-box">
              <div class="s-label-mini">模糊值: {{ activeBook.bgBlur ?? 40 }}px</div>
              <input type="range" min="0" max="100" v-model.number="activeBook.bgBlur" @change="emit('markBookUpdated')" class="s-slider">
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>

  <!-- Attributes Settings Modal -->
  <transition name="fade">
    <div v-if="showBookSettings" class="settings-modal-mask" @click="emit('update:showBookSettings', false)">
      <div class="settings-modal" @click.stop>
        <div class="modal-header">
          <span>属性设置</span>
          <div class="close-modal" @click="emit('update:showBookSettings', false)">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>
        <div class="modal-body" v-if="activeBook">
          <div class="s-row flex-col-start">
            <div class="s-row-header">
              <div class="s-label-wrap">
                <span class="s-label">整书启用状态</span>
                <span class="s-desc">开启后整本书籍的设定内容将参与角色上下文</span>
              </div>
              <div class="s-toggle" :class="{on: activeBook.enabled}" @click="activeBook.enabled = !activeBook.enabled; emit('markBookUpdated')"><div class="s-dot"></div></div>
            </div>
          </div>
          
          <div class="s-block">
            <div class="s-title-wrap">
              <div class="s-title">全局位置深度</div>
            </div>
            <div class="s-seg">
              <div class="seg-item" :class="{active: activeBook.globalPosition==='front'}" @click="activeBook.globalPosition='front';emit('markBookUpdated')">前置</div>
              <div class="seg-item" :class="{active: activeBook.globalPosition==='middle'}" @click="activeBook.globalPosition='middle';emit('markBookUpdated')">居中</div>
              <div class="seg-item" :class="{active: activeBook.globalPosition==='back'}" @click="activeBook.globalPosition='back';emit('markBookUpdated')">后置</div>
              <div class="seg-item" :class="{active: activeBook.globalPosition==='custom'}" @click="activeBook.globalPosition='custom';emit('markBookUpdated')">自定</div>
            </div>
            <div v-if="activeBook.globalPosition==='custom'" class="s-slider-box">
              <div class="s-val-row">
                <span class="s-label-mini mb-0">深度值:</span>
                <div class="s-val-input-group">
                  <input type="number" min="0" v-model.number="activeBook.globalDepth" class="s-val-input" @change="emit('markBookUpdated')" />
                  <button class="s-reset-btn" @click="activeBook.globalDepth = 0; emit('markBookUpdated')">重置</button>
                </div>
              </div>
              <input type="range" min="0" max="20" v-model.number="activeBook.globalDepth" class="s-slider" @change="emit('markBookUpdated')">
              <div class="s-desc mt-2">数值越大，注入记忆的位置越深（越不容易被遗忘）。</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>

  <!-- Entry Settings Modal -->
  <transition name="fade">
    <div v-if="showEntrySettings" class="settings-modal-mask" @click="emit('update:showEntrySettings', false)">
      <div class="settings-modal" @click.stop>
        <div class="modal-header">
          <span>条目属性设置</span>
          <div class="close-modal" @click="emit('update:showEntrySettings', false)">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>
        <div class="modal-body" v-if="activeEntry">
          <!-- 状态 -->
          <div class="s-row flex-col-start">
            <div class="s-row-header">
              <div class="s-label-wrap">
                <span class="s-label">条目状态</span>
                <span class="s-desc">控制该条目是否参与角色记忆</span>
              </div>
              <div class="s-toggle" :class="{on: activeEntry.enabled}" @click="activeEntry.enabled = !activeEntry.enabled; emit('updateEntry')"><div class="s-dot"></div></div>
            </div>
          </div>

          <!-- 触发方式 -->
          <div class="s-row flex-col-start">
            <div class="s-row-header">
              <div class="s-label-wrap">
                <span class="s-label">触发方式</span>
                <span class="s-desc" v-if="activeEntry.light === 'blue'">始终将此条目注入记忆</span>
                <span class="s-desc" v-else>仅在遇到指定关键词时注入记忆</span>
              </div>
              <div class="s-seg" style="margin-bottom: 0; width: 140px;">
                <div class="seg-item" :class="{active: activeEntry.light==='blue'}" @click="activeEntry.light='blue';emit('updateEntry')">全局</div>
                <div class="seg-item" :class="{active: activeEntry.light==='green'}" @click="activeEntry.light='green';emit('updateEntry')">条件</div>
              </div>
            </div>
            <div v-if="activeEntry.light === 'green'" class="mt-2 w-full">
              <input v-model="activeEntry.keywords" class="fancy-input small-input" placeholder="输入触发词，多个用逗号分隔" @input="emit('updateEntry')"/>
            </div>
          </div>

          <!-- 独立参数 -->
          <div class="s-row flex-col-start" style="margin-bottom: 0;">
            <div class="s-row-header">
              <div class="s-label-wrap">
                <span class="s-label">独立参数</span>
                <span class="s-desc">开启后可覆盖书籍的默认位置与深度</span>
              </div>
              <div class="s-toggle" :class="{on: activeEntry.overrideSettings}" @click="activeEntry.overrideSettings = !activeEntry.overrideSettings; emit('updateEntry')"><div class="s-dot"></div></div>
            </div>
            <div v-if="activeEntry.overrideSettings" class="mt-4 w-full" style="padding-top: 16px; border-top: 1px dashed var(--border-color);">
              <div class="s-title">位置与深度</div>
              <div class="s-seg">
                <div class="seg-item" :class="{active: activeEntry.position==='front'}" @click="activeEntry.position='front';emit('updateEntry')">前置</div>
                <div class="seg-item" :class="{active: activeEntry.position==='middle'}" @click="activeEntry.position='middle';emit('updateEntry')">居中</div>
                <div class="seg-item" :class="{active: activeEntry.position==='back'}" @click="activeEntry.position='back';emit('updateEntry')">后置</div>
                <div class="seg-item" :class="{active: activeEntry.position==='custom'}" @click="activeEntry.position='custom';emit('updateEntry')">自定</div>
              </div>
              <div v-if="activeEntry.position==='custom'" class="s-slider-box mb-0">
                <div class="s-val-row">
                  <span class="s-label-mini mb-0">深度:</span>
                  <div class="s-val-input-group">
                    <input type="number" min="0" v-model.number="activeEntry.depth" class="s-val-input" @change="emit('updateEntry')" />
                    <button class="s-reset-btn" @click="activeEntry.depth = 0; emit('updateEntry')">重置</button>
                  </div>
                </div>
                <input type="range" min="0" max="20" v-model.number="activeEntry.depth" class="s-slider" @change="emit('updateEntry')">
                <div class="s-desc mt-2">数值越大，注入记忆的位置越深（越不容易被遗忘）。</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped src="./WorldBookModals.css"></style>
