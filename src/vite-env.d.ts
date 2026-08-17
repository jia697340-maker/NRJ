/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MUSIC_ACCOUNT_API_BASE?: string
  readonly VITE_PUBLIC_MUSIC_API_BASE?: string
}

declare module 'png-chunks-extract'
declare module 'png-chunk-text'
declare module 'utf8'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
