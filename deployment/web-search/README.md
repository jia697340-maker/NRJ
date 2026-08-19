# 自建联网服务

这个目录提供带访问密码的 SearXNG 搜索网关，供“粘人精”的自建联网模式使用。

## 手机一键部署

1. 在聊天扩展栏第二页打开“联网搜索”。
2. 选择“自建联网服务”并打开“手机部署指引”。
3. 点击“前往 Render 部署”，登录 Render 后确认创建免费 Web Service。
4. Render 要求填写 `SEARCH_ACCESS_TOKEN` 时，设置一个至少 8 位且只有自己知道的访问密码。
5. 部署完成后复制 Render 提供的 `https://...onrender.com` 地址。
6. 回到应用，粘贴服务地址与相同的访问密码，然后点击“测试连接”。

免费 Render 服务闲置后会休眠，第一次搜索可能需要等待约一分钟唤醒。

## Docker

在本目录执行：

```bash
docker build -t nianrenjin-web-search .
docker run -d --name nianrenjin-web-search -p 10000:10000 -e SEARCH_ACCESS_TOKEN=请替换为至少8位的密码 nianrenjin-web-search
```

随后把 `http://设备地址:10000` 和同一访问密码填入应用。公开部署时必须配置 HTTPS。
