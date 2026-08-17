# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## Netlify 发布

项目根目录的 `netlify.toml` 已配置网页目录和函数目录。网易云、QQ音乐和B站扫码函数会和网页在同一次 Netlify 部署中自动发布，不需要单独服务器或数据库。

1. 把仓库连接到 Netlify，构建设置保持根目录不变。
2. 确认 Build command 为 `npm run build`、Publish directory 为 `dist`。
3. 在环境变量中按需设置 `MUSIC_SESSION_TTL_DAYS=90`；不设置时默认 90 天。
4. 推送生产分支，等待 Netlify 构建完成。
5. 上线后访问 `/.netlify/functions/music-qr`，GET 返回 405 即表示函数已经部署；随后在“音乐来源”中选择平台扫码测试。

本地测试扫码函数逻辑：`npm run test:music-qr`。完整的 Netlify 本地环境可使用 `npx netlify dev`。
