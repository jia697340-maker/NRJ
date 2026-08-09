# FLUX 独立代理

这是一个运行在免费 `workers.dev` 域名上的 Cloudflare Module Worker。客户端自行提供 BFL API Key（BYOK），Worker 不保存、不记录密钥，也不需要配置服务端 BFL 密钥。

## 接口

### `GET /health`

返回服务健康状态。

### `POST /v1/generate`

请求头：

```http
Content-Type: application/json
X-BFL-Key: 你的_BFL_API_KEY
```

请求体示例：

```json
{
  "model": "flux-2-pro-preview",
  "prompt": "一只坐在窗边的橘猫，电影光效",
  "width": 1024,
  "height": 1024,
  "safety_tolerance": 2,
  "output_format": "webp",
  "seed": 42,
  "disable_pup": false,
  "input_image": "https://example.com/reference.webp"
}
```

约束：

- `model` 仅支持 `flux-2-pro-preview`、`flux-2-pro`、`flux-2-max`。
- `prompt` 必填、不能为空，最多 10,000 个字符。
- `width`、`height` 默认均为 1024；必须不小于 64、是 16 的倍数，且总像素不超过 400 万。
- `safety_tolerance` 为 0–5 的整数，默认 2。
- `output_format` 为 `jpeg`、`png` 或 `webp`，默认 `jpeg`。
- 参考图使用 BFL 字段 `input_image`、`input_image_2` … `input_image_8`，最多 8 张；支持无凭据的 HTTPS 地址和 `data:image/...;base64,...`。
- 整个请求体上限为 12 MiB。

Worker 会在同一次请求中提交任务、按退避策略轮询，最多等待约 90 秒。任务 Ready 后立即从 BFL 临时 delivery 地址下载并流式返回图片。响应头可能包含：

- `X-BFL-Task-Id`
- `X-BFL-Cost`
- `X-BFL-Input-MP`
- `X-BFL-Output-MP`

所有错误均为中文 JSON。客户端取消请求时，上游请求和轮询也会中止。

## 本地开发

需要 Node.js，然后在本目录运行：

```bash
npx wrangler@latest dev --var ENVIRONMENT:development
```

开发模式下，即使配置了来源白名单，也额外允许 `http://localhost:*`、`http://127.0.0.1:*` 和 `http://[::1]:*`。

## CORS

生产环境通过 `ALLOWED_ORIGINS` 配置逗号分隔的完整 Origin：

```text
https://app.example.com,https://admin.example.com
```

建议在 Cloudflare Dashboard 的 Worker 设置中添加该环境变量。也可以部署时传入：

```bash
npx wrangler@latest deploy \
  --var ENVIRONMENT:production \
  --var ALLOWED_ORIGINS:https://app.example.com,https://admin.example.com
```

规则：

- 配置后只允许精确匹配的来源。
- 未配置或配置为 `*` 时返回 `Access-Control-Allow-Origin: *`。
- 代理从不返回 `Access-Control-Allow-Credentials`，因此通配来源不会携带浏览器凭据。
- 非浏览器请求没有 `Origin` 时不受 CORS 白名单影响。

## 部署到免费 workers.dev

首次使用先登录，然后部署：

```bash
npx wrangler@latest login
npx wrangler@latest deploy
```

`wrangler.jsonc` 已启用 `workers_dev`，部署后会得到类似
`https://clingy-flux-proxy.<你的子域>.workers.dev` 的地址。这里没有创建自定义域名、KV、R2 或其他付费资源。

## BYOK 与安全说明

浏览器每次调用都通过 `X-BFL-Key` 提供自己的 BFL Key；Worker 只在当前请求内将它转发给 BFL 提交和轮询接口。源码没有任何密钥日志。

轮询地址、重定向地址和图片 delivery 地址都必须是 HTTPS、标准 443 端口且主机名严格位于 `*.bfl.ai`，避免利用上游返回地址实施 SSRF。生产使用时仍建议在 Cloudflare 中配置来源白名单、速率限制和滥用防护。
