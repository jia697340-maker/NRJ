/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { watch, onMounted, onUnmounted } from 'vue'
import { bubbleSettings } from '../store'
import localforage from 'localforage'

export function useBubbleBeautify() {
  const styleId = 'clingy-bubble-beautify-style'
  
  const updateStyle = async () => {
    let styleEl = document.getElementById(styleId) as HTMLStyleElement
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }

    let selfBgImageUrl = ''
    if (bubbleSettings.selfBgImageId) {
      try {
        const base64 = await localforage.getItem<string>(bubbleSettings.selfBgImageId)
        if (base64) selfBgImageUrl = `url(${base64})`
      } catch (e) {
        console.error('获取自己气泡背景图失败', e)
      }
    }

    let otherBgImageUrl = ''
    if (bubbleSettings.otherBgImageId) {
      try {
        const base64 = await localforage.getItem<string>(bubbleSettings.otherBgImageId)
        if (base64) otherBgImageUrl = `url(${base64})`
      } catch (e) {
        console.error('获取对方气泡背景图失败', e)
      }
    }

    // 如果是默认预设，则不注入任何基础覆盖样式，保护原有的虚线边框等精美样式
    if (bubbleSettings.preset === 'default') {
      styleEl.innerHTML = ''
      return
    }

    // 动态生成 CSS
    const css = `
      /* 自己气泡基础样式 */
      .bubble.bubble-right {
        background-color: ${bubbleSettings.selfBgColor} !important;
        color: ${bubbleSettings.selfTextColor} !important;
        border-radius: ${bubbleSettings.selfRadius} !important;
        border: none !important;
        box-shadow: none !important;
        overflow: hidden;
        position: relative;
      }
      
      /* 自己气泡背景图图层 */
      ${selfBgImageUrl ? `
      .bubble.bubble-right::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background-image: ${selfBgImageUrl};
        background-size: ${bubbleSettings.selfBgSize};
        background-position: center;
        background-repeat: no-repeat;
        opacity: ${bubbleSettings.selfBgOpacity};
        pointer-events: none;
        z-index: 0;
      }
      .bubble.bubble-right > * {
        position: relative;
        z-index: 1;
      }
      ` : ''}

      /* 对方气泡基础样式 */
      .bubble.bubble-left {
        background-color: ${bubbleSettings.otherBgColor} !important;
        color: ${bubbleSettings.otherTextColor} !important;
        border-radius: ${bubbleSettings.otherRadius} !important;
        border: none !important;
        box-shadow: none !important;
        overflow: hidden;
        position: relative;
      }

      /* 对方气泡背景图图层 */
      ${otherBgImageUrl ? `
      .bubble.bubble-left::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background-image: ${otherBgImageUrl};
        background-size: ${bubbleSettings.otherBgSize};
        background-position: center;
        background-repeat: no-repeat;
        opacity: ${bubbleSettings.otherBgOpacity};
        pointer-events: none;
        z-index: 0;
      }
      .bubble.bubble-left > * {
        position: relative;
        z-index: 1;
      }
      ` : ''}

      /* 用户自定义 CSS 代码 */
      ${bubbleSettings.customCss || ''}
    `
    styleEl.innerHTML = css
  }

  onMounted(() => {
    updateStyle()
  })

  // 监听 bubbleSettings 变化实时更新样式
  watch(bubbleSettings, () => {
    updateStyle()
  }, { deep: true })

  onUnmounted(() => {
    const styleEl = document.getElementById(styleId)
    if (styleEl) {
      styleEl.remove()
    }
  })
}
