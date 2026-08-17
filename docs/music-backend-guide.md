# 音乐服务部署指南

前端 `dist` 可以继续部署到 GitHub Pages、Netlify 或 Cloudflare Pages。所有用户共同使用一套音乐服务，不需要用户填写地址或自行部署。

## 为什么需要隔离网关

上游 `go-music-api` 会把扫码成功后的平台 Cookie 写入全局 `cookies.json`，适合个人使用，不适合直接公开给多用户。本项目附带的 `music-gateway` 位于浏览器和上游服务之间，负责：

- 为每个浏览器签发独立、不可猜测的 HttpOnly 会话 Cookie；
- 只允许当前会话轮询自己创建的二维码；
- 过滤上游响应中的平台 Cookie，不把登录凭证返回网页；
- 按用户加密保存网易云、QQ、酷狗和 Bilibili 等平台凭证；
- 每次请求结束后清空认证上游的全局 Cookie；
- 提供退出并删除当前用户登录凭证的接口；
- 隐藏上游 Cookie 管理接口，并限制登录请求频率。

公开服务必须通过隔离网关访问，不要把两个上游容器的端口暴露到公网。

## 本机完整测试

安装 Docker Desktop 后，在项目根目录运行：

```bash
docker compose -f docker-compose.music.yml up -d --build
```

打开 `http://localhost:8080`。网页、隔离网关和两个内部音乐服务会一起启动。

停止服务：

```bash
docker compose -f docker-compose.music.yml down
```

## 静态网站正式部署

GitHub Pages、Netlify 和 Cloudflare Pages 都只能承载前端静态文件。音乐服务需要部署一次到能够运行 Docker 的服务器，并使用独立 HTTPS 域名，例如 `music.example.com`。

### 1. 准备域名

把 `music.example.com` 的 DNS 记录解析到服务器公网 IP，并确保服务器开放 80、443 端口。

### 2. 配置服务

在服务器项目目录复制配置模板：

```bash
cp .env.music.example .env.music
```

填写：

```text
MUSIC_DOMAIN=music.example.com
MUSIC_ALLOWED_ORIGINS=https://你的站点.pages.dev,https://你的站点.netlify.app,https://用户名.github.io
MUSIC_SESSION_TTL_DAYS=90
```

来源地址必须完整匹配，不能写 `*`，也不要添加末尾斜杠。

### 3. 启动共享音乐服务

```bash
docker compose --env-file .env.music -f docker-compose.music-backend.yml up -d --build
```

Caddy 会自动申请和续期 HTTPS 证书。确认以下地址返回 `{"status":"ok"}`：

```text
https://music.example.com/health
```

### 4. 构建静态前端

在 Netlify 或 Cloudflare Pages 的构建环境变量中配置：

```text
VITE_PUBLIC_MUSIC_API_BASE=https://music.example.com
VITE_MUSIC_OPERATOR_NAME=实际运营者名称
VITE_MUSIC_OPERATOR_CONTACT=有效联系邮箱
VITE_MUSIC_SESSION_RETENTION_DAYS=90
VITE_MUSIC_PRIVACY_URL=https://你的站点/音乐与隐私说明
```

构建命令为 `npm run build`，发布目录为 `dist`。GitHub Pages 也使用相同的构建变量，只是需要在构建工作流中注入。

## 数据保存与备份

音乐平台登录凭证保存在 Docker 卷 `music-session-data` 中。该卷同时保存自动生成的加密密钥和加密后的会话文件：

- 不要公开或提交该卷内容；
- 备份时必须同时备份密钥与加密文件；
- 丢失密钥不会泄露凭证，但所有用户需要重新扫码；
- 用户主动退出、凭证失效或达到配置的未使用期限后，应删除对应凭证。

## 更新与检查

```bash
docker compose --env-file .env.music -f docker-compose.music-backend.yml pull
docker compose --env-file .env.music -f docker-compose.music-backend.yml up -d --build
docker compose --env-file .env.music -f docker-compose.music-backend.yml logs --tail 100 music-gateway
```

网关日志只记录不含查询参数的接口路径，不应记录平台 Cookie、二维码 key 或用户歌单内容。
