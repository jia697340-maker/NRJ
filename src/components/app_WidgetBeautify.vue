<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { defineAsyncComponent, reactive, ref } from 'vue'
import type { WidgetType } from '../composables/useDesktopLayout'
import WidgetSizeControls from './WidgetSizeControls.vue'
const WidgetSourceEditor = defineAsyncComponent(() => import('./WidgetSourceEditor.vue'))

const emit = defineEmits<{ close: []; 'add-widget': [widgetType: WidgetType, widthUnits: number, heightUnits: number] }>()
const sizeByType = reactive<Record<WidgetType, { width: number; height: number }>>({
  'about-us-widget': { width: 4, height: 3 },
  'profile-card-widget': { width: 4, height: 3 },
  'circle-avatar-widget': { width: 2, height: 2 },
  'dual-frame': { width: 2, height: 2 },
  'folder-widget': { width: 2, height: 2 },
  'moment-card': { width: 4, height: 2 },
  'dual-avatar': { width: 2, height: 2 },
  'rectangle-image': { width: 2, height: 1 },
  'custom-image': { width: 2, height: 2 }
})
const activeSourceType = ref<WidgetType | null>(null)
const add = (widgetType: WidgetType, widthUnits: number, heightUnits: number) => emit('add-widget', widgetType, widthUnits, heightUnits)
const openSource = (widgetType: WidgetType) => { activeSourceType.value = widgetType }
</script>

<template>
  <div class="app-widget-beautify">
    <header class="header"><small>WIDGET STORE</small><h2>小组件美化</h2><p>添加后回到桌面，长按并拖动到喜欢的位置。</p></header>
    <main class="content">
      <article class="widget-card">
        <div class="preview about-us-preview">
          <div class="preview-au-header">
            <div class="preview-au-left">
              <div class="preview-au-avatar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#b3bac5">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </div>
              <b class="preview-au-title">标题占位</b>
            </div>
            <div class="preview-au-icons">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="11" cy="11" r="7"/>
                <line x1="16.5" y1="16.5" x2="21.5" y2="21.5"/>
              </svg>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
          </div>
          <div class="preview-au-tags">
            <span>#标签一</span>
            <span>#标签二</span>
          </div>
          <div class="preview-au-stage">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" ry="4"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <small>图片占位</small>
          </div>
          <div class="preview-au-slogan">☆⁺底部签名占位文案⁺☆</div>
        </div>
        <div class="details">
          <div>
            <h3>拍立得相框小组件</h3>
            <p>通透悬浮情感卡片，包含头像标、标题、胶囊标签、白底圆角大相框与底部签名</p>
          </div>
          <span class="size-label">{{ sizeByType['about-us-widget'].width }} × {{ sizeByType['about-us-widget'].height }}</span>
        </div>
        <WidgetSizeControls v-model:width="sizeByType['about-us-widget'].width" v-model:height="sizeByType['about-us-widget'].height" />
        <button type="button" class="source-button" @click="openSource('about-us-widget')">查看并编辑完整源码</button>
        <button type="button" class="add-button" @click="add('about-us-widget', sizeByType['about-us-widget'].width, sizeByType['about-us-widget'].height)">添加到桌面</button>
      </article>

      <article class="widget-card">
        <div class="preview profile-card-preview">
          <div class="preview-pc-cover">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z"/>
            </svg>
            <span>更换背景</span>
          </div>
          <div class="preview-pc-body">
            <div class="preview-pc-avatar">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#94a3b8">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <div class="preview-pc-info">
              <b class="preview-pc-name">名片昵称</b>
              <span class="preview-pc-handle">@用户名或状态</span>
              <span class="preview-pc-bio">个性签名</span>
              <div class="preview-pc-location">
                <svg viewBox="0 0 24 24" width="9" height="9" fill="#94a3b8">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                <span>城市</span>
              </div>
            </div>
          </div>
        </div>
        <div class="details">
          <div>
            <h3>社交名片小组件</h3>
            <p>半屏长款大画幅档案卡，背景与白底 5:5 比例，居中悬浮头像与大气文案</p>
          </div>
          <span class="size-label">{{ sizeByType['profile-card-widget'].width }} × {{ sizeByType['profile-card-widget'].height }}</span>
        </div>
        <WidgetSizeControls v-model:width="sizeByType['profile-card-widget'].width" v-model:height="sizeByType['profile-card-widget'].height" />
        <button type="button" class="source-button" @click="openSource('profile-card-widget')">查看并编辑完整源码</button>
        <button type="button" class="add-button" @click="add('profile-card-widget', sizeByType['profile-card-widget'].width, sizeByType['profile-card-widget'].height)">添加到桌面</button>
      </article>

      <article class="widget-card">
        <div class="preview circle-avatar-preview">
          <div class="preview-ca-avatar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#a0a0a5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>头像占位</span>
          </div>
          <div class="preview-ca-title">主文案占位</div>
          <div class="preview-ca-box"><span>胶囊占位</span></div>
        </div>
        <div class="details"><div><h3>圆形头像卡片小组件</h3><p>纯净悬浮，圆形头像、主文案与底部圆角标签自由编辑</p></div><span class="size-label">{{ sizeByType['circle-avatar-widget'].width }} × {{ sizeByType['circle-avatar-widget'].height }}</span></div>
        <WidgetSizeControls v-model:width="sizeByType['circle-avatar-widget'].width" v-model:height="sizeByType['circle-avatar-widget'].height" />
        <button type="button" class="source-button" @click="openSource('circle-avatar-widget')">查看并编辑完整源码</button>
        <button type="button" class="add-button" @click="add('circle-avatar-widget', sizeByType['circle-avatar-widget'].width, sizeByType['circle-avatar-widget'].height)">添加到桌面</button>
      </article>

      <article class="widget-card">
        <div class="preview dual-frame-preview">
          <div class="preview-df-title">선택해 주십시오.</div>
          <div class="preview-df-cards">
            <div class="preview-df-card">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#a0a0a5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <span>图片 1</span>
            </div>
            <div class="preview-df-card">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#a0a0a5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <span>图片 2</span>
            </div>
          </div>
          <div class="preview-df-pill"><span>사용</span></div>
        </div>
        <div class="details"><div><h3>双格相框小组件</h3><p>无边框纯净悬浮，双图卡片、标题与胶囊按钮文案自由编辑</p></div><span class="size-label">{{ sizeByType['dual-frame'].width }} × {{ sizeByType['dual-frame'].height }}</span></div>
        <WidgetSizeControls v-model:width="sizeByType['dual-frame'].width" v-model:height="sizeByType['dual-frame'].height" />
        <button type="button" class="source-button" @click="openSource('dual-frame')">查看并编辑完整源码</button>
        <button type="button" class="add-button" @click="add('dual-frame', sizeByType['dual-frame'].width, sizeByType['dual-frame'].height)">添加到桌面</button>
      </article>

      <article class="widget-card">
        <div class="preview folder-card-preview">
          <div class="preview-folder-tab">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="#a8a29e">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
          <div class="preview-folder-body">
            <div class="preview-folder-window">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <span>相框占位</span>
            </div>
          </div>
        </div>
        <div class="details"><div><h3>文件夹相框小组件</h3><p>细长拍立得相框与爱心标签，内嵌横版视窗</p></div></div>
        <div class="size-picker" aria-label="文件夹小组件尺寸">
          <button type="button" :class="{active:sizeByType['folder-widget'].width===2 && sizeByType['folder-widget'].height===1}" @click="sizeByType['folder-widget']={width:2,height:1}"><b>宽卡片</b><small>2 × 1</small></button>
          <button type="button" :class="{active:sizeByType['folder-widget'].width===2 && sizeByType['folder-widget'].height===2}" @click="sizeByType['folder-widget']={width:2,height:2}"><b>大号居中</b><small>2 × 2</small></button>
        </div>
        <WidgetSizeControls v-model:width="sizeByType['folder-widget'].width" v-model:height="sizeByType['folder-widget'].height" />
        <button type="button" class="source-button" @click="openSource('folder-widget')">查看并编辑完整源码</button>
        <button type="button" class="add-button" @click="add('folder-widget', sizeByType['folder-widget'].width, sizeByType['folder-widget'].height)">添加到桌面</button>
      </article>

      <article class="widget-card">
        <div class="preview moment-preview"><div class="moment-images"><i></i><i></i></div><div class="moment-body"><b>My Moment</b><span>This is a custom moment...</span><em></em></div></div>
        <div class="details"><div><h3>Moment 文案卡片</h3><p>图片、头像、文字、背景与进度均可单独编辑</p></div><span class="size-label">{{ sizeByType['moment-card'].width }} × {{ sizeByType['moment-card'].height }}</span></div>
        <WidgetSizeControls v-model:width="sizeByType['moment-card'].width" v-model:height="sizeByType['moment-card'].height" />
        <button type="button" class="source-button" @click="openSource('moment-card')">查看并编辑完整源码</button>
        <button type="button" class="add-button" @click="add('moment-card',sizeByType['moment-card'].width,sizeByType['moment-card'].height)">添加到桌面</button>
      </article>
      <article class="widget-card">
        <div class="preview avatar-preview"><div><i></i><small>@UserA</small></div><div><i></i><small>@UserB</small></div><b>Custom&nbsp;&nbsp;Slogan</b></div>
        <div class="details"><div><h3>双头像小组件</h3><p>两张头像、两个昵称和底部文案独立编辑</p></div><span class="size-label">{{ sizeByType['dual-avatar'].width }} × {{ sizeByType['dual-avatar'].height }}</span></div>
        <WidgetSizeControls v-model:width="sizeByType['dual-avatar'].width" v-model:height="sizeByType['dual-avatar'].height" />
        <button type="button" class="source-button" @click="openSource('dual-avatar')">查看并编辑完整源码</button>
        <button type="button" class="add-button" @click="add('dual-avatar',sizeByType['dual-avatar'].width,sizeByType['dual-avatar'].height)">添加到桌面</button>
      </article>
      <article class="widget-card">
        <div class="preview rectangle-image-preview">
          <div class="preview-rect-box">
            <span>＋</span>
            <small>添加长方形图片</small>
          </div>
        </div>
        <div class="details">
          <div>
            <h3>长方形图片小组件</h3>
            <p>圆角横版长方形图片，不附加卡片背景或装饰</p>
          </div>
        </div>
        <div class="size-picker" aria-label="长方形图片小组件尺寸">
          <button type="button" :class="{ active: sizeByType['rectangle-image'].width===2 && sizeByType['rectangle-image'].height===1 }" @click="sizeByType['rectangle-image']={width:2,height:1}">
            <b>标准长条</b><small>2 × 1</small>
          </button>
          <button type="button" :class="{ active: sizeByType['rectangle-image'].width===4 && sizeByType['rectangle-image'].height===2 }" @click="sizeByType['rectangle-image']={width:4,height:2}">
            <b>大横幅</b><small>4 × 2</small>
          </button>
        </div>
        <WidgetSizeControls v-model:width="sizeByType['rectangle-image'].width" v-model:height="sizeByType['rectangle-image'].height" />
        <button type="button" class="source-button" @click="openSource('rectangle-image')">查看并编辑完整源码</button>
        <button type="button" class="add-button" @click="add('rectangle-image', sizeByType['rectangle-image'].width, sizeByType['rectangle-image'].height)">
          添加到桌面
        </button>
      </article>

      <article class="widget-card">
        <div class="preview image-preview"><span>＋</span><small>添加图片</small></div>
        <div class="details"><div><h3>自定义图片小组件</h3><p>圆角正方形图片，不附加卡片背景或装饰</p></div></div>
        <div class="size-picker" aria-label="图片小组件尺寸"><button type="button" :class="{active:sizeByType['custom-image'].width===1 && sizeByType['custom-image'].height===1}" @click="sizeByType['custom-image']={width:1,height:1}"><b>小方块</b><small>1 × 1</small></button><button type="button" :class="{active:sizeByType['custom-image'].width===2 && sizeByType['custom-image'].height===2}" @click="sizeByType['custom-image']={width:2,height:2}"><b>大方块</b><small>2 × 2</small></button></div>
        <WidgetSizeControls v-model:width="sizeByType['custom-image'].width" v-model:height="sizeByType['custom-image'].height" />
        <button type="button" class="source-button" @click="openSource('custom-image')">查看并编辑完整源码</button>
        <button type="button" class="add-button" @click="add('custom-image',sizeByType['custom-image'].width,sizeByType['custom-image'].height)">添加到桌面</button>
      </article>
      <p class="store-note">每种小组件都可以重复添加；每个实例的图片、文字和设置互不影响。</p>
    </main>
    <div class="home-indicator-area" aria-label="返回桌面" @click="emit('close')"><div class="home-indicator"></div></div>
    <WidgetSourceEditor
      v-if="activeSourceType"
      :widget-type="activeSourceType"
      :initial-width="sizeByType[activeSourceType].width"
      :initial-height="sizeByType[activeSourceType].height"
      @update-size="(width,height)=>{ if(activeSourceType) sizeByType[activeSourceType]={width,height} }"
      @close="activeSourceType=null"
    />
  </div>
</template>

<style scoped>
.app-widget-beautify{position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;background:var(--sys-bg-primary,#fff);color:var(--text-primary,#000);animation:appOpen .3s cubic-bezier(.2,.8,.2,1)}
.header{flex:0 0 auto;padding:max(42px,calc(env(safe-area-inset-top) + 28px)) 20px 16px;text-align:left;border-bottom:1px solid var(--border-color,#eee)}.header small{color:var(--text-secondary);font-size:10px;font-weight:700;letter-spacing:.12em}.header h2{margin:4px 0 5px;font-size:21px;font-weight:650}.header p{margin:0;color:var(--text-secondary);font-size:12px;line-height:1.5}
.content{flex:1;overflow-y:auto;padding:16px 16px 58px;box-sizing:border-box;overscroll-behavior:contain}.widget-card{max-width:430px;margin:0 auto 14px;padding:14px;border:1px solid var(--border-color);border-radius:22px;background:var(--sys-bg-secondary);box-shadow:0 4px 14px color-mix(in srgb,var(--shadow-color) 55%,transparent)}.preview{height:132px;margin-bottom:13px;overflow:hidden;border-radius:17px}.moment-preview{background:var(--card-bg-solid)}.moment-images{display:grid;grid-template-columns:1fr 1fr;height:60px}.moment-images i:first-child{background:#e4e6e8}.moment-images i:last-child{background:#d2d5d8}.moment-body{padding:10px 12px;display:flex;flex-direction:column;align-items:flex-end}.moment-body b{font-size:10px}.moment-body span{align-self:flex-start;margin-top:7px;font-size:9px;color:var(--text-secondary)}.moment-body em{align-self:stretch;height:3px;margin-top:9px;border-radius:2px;background:var(--border-color)}
.about-us-preview{position:relative;width:200px;height:185px;margin:4px auto 10px;background:transparent;display:flex;flex-direction:column;justify-content:space-between;user-select:none;box-sizing:border-box;padding:2px}
.preview-au-header{display:flex;align-items:center;justify-content:space-between;width:100%}
.preview-au-left{display:flex;align-items:center;gap:6px}
.preview-au-avatar{width:24px;height:24px;border-radius:50%;background:#fcecee;display:flex;align-items:center;justify-content:center;overflow:hidden}
.preview-au-title{font-size:13px;font-weight:800;color:var(--text-primary)}
.preview-au-icons{display:flex;align-items:center;gap:6px;color:var(--text-primary);opacity:.85}
.preview-au-tags{display:flex;align-items:center;gap:6px;margin:2px 0}
.preview-au-tags span{padding:2px 8px;border-radius:12px;border:1px solid var(--border-color);font-size:8.5px;color:var(--text-secondary);font-weight:600}
.preview-au-stage{flex:1;margin:4px 0;background:#fff;border-radius:18px;box-shadow:0 4px 14px rgba(0,0,0,.08);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:1px dashed #e2e8f0;color:#94a3b8}
.preview-au-stage small{font-size:8.5px;font-weight:500}
.preview-au-slogan{text-align:center;font-size:9px;font-weight:700;color:var(--text-primary);letter-spacing:.2px}

.profile-card-preview{position:relative;width:200px;height:180px;margin:4px auto 10px;border-radius:24px;overflow:hidden;background:#fff;border:1px solid rgba(0,0,0,.06);box-shadow:0 4px 14px rgba(0,0,0,.06);display:flex;flex-direction:column;user-select:none}
.preview-pc-cover{width:100%;height:56%;background:linear-gradient(135deg,#dbeafe 0%,#cbd5e1 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:#64748b}
.preview-pc-cover span{font-size:9px;font-weight:500}
.preview-pc-body{flex:1;background:#fff;margin-top:-16px;border-top-left-radius:20px;border-top-right-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px 8px 8px;position:relative}
.preview-pc-avatar{position:absolute;top:0;left:50%;transform:translate(-50%,-80%);width:46px;height:46px;border-radius:50%;background:#fff;padding:2px;box-shadow:0 2px 8px rgba(0,0,0,.1);display:flex;align-items:center;justify-content:center;box-sizing:border-box}
.preview-pc-info{width:100%;display:flex;flex-direction:column;align-items:center;gap:2px;margin-top:8px}
.preview-pc-name{font-size:11px;font-weight:750;color:#0f172a;line-height:1.2}
.preview-pc-handle{font-size:8.5px;color:#94a3b8;line-height:1.1}
.preview-pc-bio{font-size:9px;color:#334155;font-weight:600;margin-top:1px;line-height:1.1}
.preview-pc-location{display:inline-flex;align-items:center;gap:2px;font-size:8.5px;color:#64748b;font-weight:600;margin-top:2px}

.circle-avatar-preview{position:relative;width:140px;height:120px;margin:6px auto 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:transparent;user-select:none}
.preview-ca-avatar{width:52px;height:52px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.06);box-shadow:0 3px 8px rgba(0,0,0,.05);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#94a3b8}
.preview-ca-avatar span{font-size:7.5px;color:#8e8e93}
.preview-ca-title{font-size:11px;font-weight:600;color:var(--text-primary);line-height:1.2;text-align:center}
.preview-ca-box{width:88%;height:22px;border-radius:7px;background:#fff;border:1px solid rgba(0,0,0,.08);box-shadow:0 1px 4px rgba(0,0,0,.03);display:flex;align-items:center;justify-content:center}
.preview-ca-box span{font-size:9.5px;font-weight:500;color:var(--text-secondary)}

.dual-frame-preview{position:relative;width:150px;height:120px;margin:6px auto 10px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;background:transparent;user-select:none}
.preview-df-title{font-size:11px;font-weight:500;color:var(--text-primary);line-height:1}
.preview-df-cards{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0}
.preview-df-card{aspect-ratio:1/1;background:#fff;border-radius:10px;border:1px solid rgba(0,0,0,.04);box-shadow:0 3px 8px rgba(0,0,0,.05);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#94a3b8}
.preview-df-card span{font-size:8.5px;color:#8e8e93}
.preview-df-pill{width:75%;height:22px;border-radius:9999px;border:1px solid rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center}
.preview-df-pill span{font-size:9.5px;color:var(--text-secondary)}
.folder-card-preview{position:relative;width:160px;height:116px;margin:8px auto;filter:drop-shadow(0 4px 10px rgba(0,0,0,.06));display:flex;flex-direction:column}
.preview-folder-tab{position:absolute;top:0;left:0;height:22px;width:56px;background:#fff;border-top-left-radius:11px;border-top-right-radius:11px;border:1px solid rgba(0,0,0,.08);border-bottom:none;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
.preview-folder-tab::after{content:'';position:absolute;bottom:0;right:-10px;width:10px;height:10px;background:transparent;border-bottom-left-radius:10px;box-shadow:-3px 3px 0 0 #fff}
.preview-folder-body{position:absolute;top:14px;left:0;right:0;bottom:0;background:#fff;border-radius:14px;border-top-left-radius:3px;border:1px solid rgba(0,0,0,.08);padding:6px;box-sizing:border-box}
.preview-folder-window{width:100%;height:100%;background:#f8f9fc;border-radius:10px;border:1px solid rgba(0,0,0,.04);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:#94a3b8}
.preview-folder-window span{font-size:10px;font-weight:500}
.avatar-preview{position:relative;display:flex;align-items:center;justify-content:center;gap:22px;background:transparent}.avatar-preview>div{display:flex;flex-direction:column;align-items:center;gap:6px}.avatar-preview i{width:54px;height:54px;border-radius:50%;background:#d7dadd}.avatar-preview div:nth-child(2) i{background:#c6cacf}.avatar-preview small{font-size:10px}.avatar-preview>b{position:absolute;bottom:12px;font:10px "Courier New",monospace}
.rectangle-image-preview{position:relative;display:flex;align-items:center;justify-content:center;background:transparent}
.preview-rect-box{width:200px;height:84px;border-radius:14px;border:1px dashed var(--border-color);background:color-mix(in srgb,var(--card-bg-solid) 45%,transparent);color:var(--text-secondary);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}
.preview-rect-box span{font-size:24px;font-weight:300;line-height:1}
.preview-rect-box small{font-size:10px}
.image-preview{width:132px;margin-left:auto;margin-right:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border:1px dashed var(--border-color);border-radius:22%;background:color-mix(in srgb,var(--card-bg-solid) 45%,transparent);color:var(--text-secondary)}.image-preview span{font-size:28px;font-weight:300}.image-preview small{font-size:10px}
.details{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.details h3{margin:0;font-size:15px}.details p{margin:5px 0 0;color:var(--text-secondary);font-size:11px;line-height:1.5}.size-label{flex:0 0 auto;padding:4px 8px;border-radius:9px;background:var(--card-bg-solid);color:var(--text-secondary);font-size:10px}.size-picker{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.size-picker button{min-height:48px;border:1px solid var(--border-color);border-radius:13px;background:var(--card-bg-solid);color:var(--text-primary);font:inherit}.size-picker button.active{border-color:var(--text-primary);box-shadow:inset 0 0 0 1px var(--text-primary)}.size-picker b,.size-picker small{display:block}.size-picker b{font-size:12px}.size-picker small{margin-top:2px;color:var(--text-secondary);font-size:9px}.source-button{width:100%;height:34px;margin-top:10px;border:1px solid var(--border-color);border-radius:11px;background:var(--card-bg-solid);color:var(--text-primary);font:inherit;font-size:10px}.source-button:active{transform:scale(.988)}.add-button{width:100%;height:42px;margin-top:8px;border:0;border-radius:14px;background:var(--text-primary);color:var(--sys-bg-primary);font:inherit;font-size:13px;font-weight:650}.add-button:active{transform:scale(.985)}.store-note{max-width:400px;margin:18px auto;color:var(--text-secondary);font-size:11px;line-height:1.55;text-align:center}
.home-indicator-area{position:absolute;z-index:60;bottom:0;width:100%;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:linear-gradient(transparent,var(--sys-bg-primary) 45%)}.home-indicator{width:134px;height:5px;border-radius:10px;background:var(--text-primary);opacity:.8}@keyframes appOpen{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
</style>
