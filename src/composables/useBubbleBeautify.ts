/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { watch, onMounted, onUnmounted } from 'vue'
import { selectedChat } from './chatState/state'
import { bubbleWorkshopState, buildBubblePresetCss, getEffectiveBubblePreset, hydrateBubblePresetAssets } from '../services/bubbleWorkshop'

export function useBubbleBeautify() {
  const styleId = 'clingy-bubble-workshop-style'
  
  let renderToken = 0
  const updateStyle = async () => {
    const token = ++renderToken
    const preset = getEffectiveBubblePreset(selectedChat.value?.id)
    await hydrateBubblePresetAssets(preset).catch(() => undefined)
    if (token !== renderToken) return
    let styleEl = document.getElementById(styleId) as HTMLStyleElement
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }

    styleEl.textContent = preset.source === 'system' ? '' : buildBubblePresetCss(preset)
  }

  onMounted(() => {
    void updateStyle()
  })

  watch([bubbleWorkshopState, selectedChat], () => {
    void updateStyle()
  }, { deep: true })

  onUnmounted(() => {
    const styleEl = document.getElementById(styleId)
    if (styleEl) {
      styleEl.remove()
    }
  })
}
