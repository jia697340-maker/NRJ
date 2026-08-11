/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { createApp } from 'vue'
import '../src/style.css'
import App from '../src/App.vue'
import { showNotification } from '../src/composables/chatState/notifications'

createApp(App).mount('#app')
window.setTimeout(() => {
  showNotification('林知遥', null, '林', '我不是要催你，只是刚才真的有一点难过。', {
    chatId: 'render_character',
    deliveryId: 'render_important_delivery',
    important: true,
    persistent: true
  })
}, 500)

