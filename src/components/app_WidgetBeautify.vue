<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { ref } from 'vue'
import type { WidgetType } from '../composables/useDesktopLayout'

const emit = defineEmits<{ close: []; 'add-widget': [widgetType: WidgetType, widthUnits: number, heightUnits: number] }>()
const imageSize = ref<1 | 2>(2)
const folderSize = ref<'wide' | 'large'>('large')
const add = (widgetType: WidgetType, widthUnits: number, heightUnits: number) => emit('add-widget', widgetType, widthUnits, heightUnits)
</script>

<template>
  <div class="app-widget-beautify">
    <header class="header"><small>WIDGET STORE</small><h2>小组件美化</h2><p>添加后回到桌面，长按并拖动到喜欢的位置。</p></header>
    <main class="content">
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
          <button type="button" :class="{active:folderSize==='wide'}" @click="folderSize='wide'"><b>宽卡片</b><small>2 × 1</small></button>
          <button type="button" :class="{active:folderSize==='large'}" @click="folderSize='large'"><b>大号居中</b><small>2 × 2</small></button>
        </div>
        <button type="button" class="add-button" @click="add('folder-widget', 2, folderSize === 'wide' ? 1 : 2)">添加到桌面</button>
      </article>

      <article class="widget-card">
        <div class="preview moment-preview"><div class="moment-images"><i></i><i></i></div><div class="moment-body"><b>My Moment</b><span>This is a custom moment...</span><em></em></div></div>
        <div class="details"><div><h3>Moment 文案卡片</h3><p>图片、头像、文字、背景与进度均可单独编辑</p></div><span class="size-label">4 × 2</span></div>
        <button type="button" class="add-button" @click="add('moment-card',4,2)">添加到桌面</button>
      </article>
      <article class="widget-card">
        <div class="preview avatar-preview"><div><i></i><small>@UserA</small></div><div><i></i><small>@UserB</small></div><b>Custom&nbsp;&nbsp;Slogan</b></div>
        <div class="details"><div><h3>双头像小组件</h3><p>两张头像、两个昵称和底部文案独立编辑</p></div><span class="size-label">2 × 2</span></div>
        <button type="button" class="add-button" @click="add('dual-avatar',2,2)">添加到桌面</button>
      </article>
      <article class="widget-card">
        <div class="preview image-preview"><span>＋</span><small>添加图片</small></div>
        <div class="details"><div><h3>自定义图片小组件</h3><p>圆角正方形图片，不附加卡片背景或装饰</p></div></div>
        <div class="size-picker" aria-label="图片小组件尺寸"><button type="button" :class="{active:imageSize===1}" @click="imageSize=1"><b>小方块</b><small>1 × 1</small></button><button type="button" :class="{active:imageSize===2}" @click="imageSize=2"><b>大方块</b><small>2 × 2</small></button></div>
        <button type="button" class="add-button" @click="add('custom-image',imageSize,imageSize)">添加到桌面</button>
      </article>
      <p class="store-note">每种小组件都可以重复添加；每个实例的图片、文字和设置互不影响。</p>
    </main>
    <div class="home-indicator-area" aria-label="返回桌面" @click="emit('close')"><div class="home-indicator"></div></div>
  </div>
</template>

<style scoped>
.app-widget-beautify{position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;background:var(--sys-bg-primary,#fff);color:var(--text-primary,#000);animation:appOpen .3s cubic-bezier(.2,.8,.2,1)}
.header{flex:0 0 auto;padding:max(42px,calc(env(safe-area-inset-top) + 28px)) 20px 16px;text-align:left;border-bottom:1px solid var(--border-color,#eee)}.header small{color:var(--text-secondary);font-size:10px;font-weight:700;letter-spacing:.12em}.header h2{margin:4px 0 5px;font-size:21px;font-weight:650}.header p{margin:0;color:var(--text-secondary);font-size:12px;line-height:1.5}
.content{flex:1;overflow-y:auto;padding:16px 16px 58px;box-sizing:border-box;overscroll-behavior:contain}.widget-card{max-width:430px;margin:0 auto 14px;padding:14px;border:1px solid var(--border-color);border-radius:22px;background:var(--sys-bg-secondary);box-shadow:0 4px 14px color-mix(in srgb,var(--shadow-color) 55%,transparent)}.preview{height:132px;margin-bottom:13px;overflow:hidden;border-radius:17px}.moment-preview{background:var(--card-bg-solid)}.moment-images{display:grid;grid-template-columns:1fr 1fr;height:60px}.moment-images i:first-child{background:#e4e6e8}.moment-images i:last-child{background:#d2d5d8}.moment-body{padding:10px 12px;display:flex;flex-direction:column;align-items:flex-end}.moment-body b{font-size:10px}.moment-body span{align-self:flex-start;margin-top:7px;font-size:9px;color:var(--text-secondary)}.moment-body em{align-self:stretch;height:3px;margin-top:9px;border-radius:2px;background:var(--border-color)}
.folder-card-preview{position:relative;width:160px;height:116px;margin:8px auto;filter:drop-shadow(0 4px 10px rgba(0,0,0,.06));display:flex;flex-direction:column}
.preview-folder-tab{position:absolute;top:0;left:0;height:22px;width:56px;background:#fff;border-top-left-radius:11px;border-top-right-radius:11px;border:1px solid rgba(0,0,0,.08);border-bottom:none;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
.preview-folder-tab::after{content:'';position:absolute;bottom:0;right:-10px;width:10px;height:10px;background:transparent;border-bottom-left-radius:10px;box-shadow:-3px 3px 0 0 #fff}
.preview-folder-body{position:absolute;top:14px;left:0;right:0;bottom:0;background:#fff;border-radius:14px;border-top-left-radius:3px;border:1px solid rgba(0,0,0,.08);padding:6px;box-sizing:border-box}
.preview-folder-window{width:100%;height:100%;background:#f8f9fc;border-radius:10px;border:1px solid rgba(0,0,0,.04);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:#94a3b8}
.preview-folder-window span{font-size:10px;font-weight:500}
.avatar-preview{position:relative;display:flex;align-items:center;justify-content:center;gap:22px;background:transparent}.avatar-preview>div{display:flex;flex-direction:column;align-items:center;gap:6px}.avatar-preview i{width:54px;height:54px;border-radius:50%;background:#d7dadd}.avatar-preview div:nth-child(2) i{background:#c6cacf}.avatar-preview small{font-size:10px}.avatar-preview>b{position:absolute;bottom:12px;font:10px "Courier New",monospace}
.image-preview{width:132px;margin-left:auto;margin-right:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border:1px dashed var(--border-color);border-radius:22%;background:color-mix(in srgb,var(--card-bg-solid) 45%,transparent);color:var(--text-secondary)}.image-preview span{font-size:28px;font-weight:300}.image-preview small{font-size:10px}
.details{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.details h3{margin:0;font-size:15px}.details p{margin:5px 0 0;color:var(--text-secondary);font-size:11px;line-height:1.5}.size-label{flex:0 0 auto;padding:4px 8px;border-radius:9px;background:var(--card-bg-solid);color:var(--text-secondary);font-size:10px}.size-picker{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.size-picker button{min-height:48px;border:1px solid var(--border-color);border-radius:13px;background:var(--card-bg-solid);color:var(--text-primary);font:inherit}.size-picker button.active{border-color:var(--text-primary);box-shadow:inset 0 0 0 1px var(--text-primary)}.size-picker b,.size-picker small{display:block}.size-picker b{font-size:12px}.size-picker small{margin-top:2px;color:var(--text-secondary);font-size:9px}.add-button{width:100%;height:42px;margin-top:13px;border:0;border-radius:14px;background:var(--text-primary);color:var(--sys-bg-primary);font:inherit;font-size:13px;font-weight:650}.add-button:active{transform:scale(.985)}.store-note{max-width:400px;margin:18px auto;color:var(--text-secondary);font-size:11px;line-height:1.55;text-align:center}
.home-indicator-area{position:absolute;z-index:60;bottom:0;width:100%;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:linear-gradient(transparent,var(--sys-bg-primary) 45%)}.home-indicator{width:134px;height:5px;border-radius:10px;background:var(--text-primary);opacity:.8}@keyframes appOpen{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
</style>
