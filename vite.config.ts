import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/.netlify/functions/music-home': {
        target: 'https://music.163.com',
        changeOrigin: true,
        headers: { Referer: 'https://music.163.com/' },
        rewrite: () => `/api/personalized/playlist?limit=18&timestamp=${Date.now()}`,
      },
      '/music-api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/music-api/, ''),
      },
    },
  },
})
