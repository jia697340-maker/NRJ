/* WARNING: 本项目专属“粘人精”，严禁出现违规英文或拼音命名！ */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { musicCommentsDevPlugin } from './scripts/vite-music-comments-plugin.mjs'
import { musicQrDevPlugin } from './scripts/vite-music-qr-plugin.mjs'

const widgetCompilerPlugin = (): Plugin => {
  const compilerPath = resolve('node_modules/@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js')
  const publicPath = '/widget-runtime/vue-compiler-sfc.js'
  return {
    name: 'widget-runtime-compiler',
    configureServer(server) {
      server.middlewares.use(publicPath, (_request, response) => {
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        response.end(readFileSync(compilerPath))
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: publicPath.slice(1), source: readFileSync(compilerPath) })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), musicCommentsDevPlugin(), musicQrDevPlugin(), widgetCompilerPlugin()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/vue/') || id.includes('/node_modules/@vue/')) return 'vue-core'
          if (id.includes('/node_modules/@codemirror/') || id.includes('/node_modules/codemirror/')) return 'code-editor'
          if (id.includes('/node_modules/esbuild-wasm/')) return 'widget-script-compiler'
          if (id.includes('/node_modules/')) return 'vendor'
        }
      }
    }
  },
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
