/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

document.title = 'Clingy OS'
createApp(App).mount('#app')

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('PWA service worker registration failed:', error))
  })
} else if ('serviceWorker' in navigator) {
  // A service worker must not cache Vite's dev HTML or module graph: doing so
  // leaves stale HMR clients in the browser and breaks the dev WebSocket.
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch((error) => console.warn('Failed to remove development service workers:', error))
}
