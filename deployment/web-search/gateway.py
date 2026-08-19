"""Authenticated, CORS-enabled gateway for the app's private SearXNG instance."""
from __future__ import annotations

import hmac
import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT") or os.environ.get("GATEWAY_PORT") or "10000")
ACCESS_TOKEN = os.environ.get("SEARCH_ACCESS_TOKEN", "").strip()
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*").strip() or "*"
SEARXNG_URL = "http://127.0.0.1:8080/search"
RATE_LIMIT = 30
RATE_WINDOW_SECONDS = 60
request_times: dict[str, deque[float]] = defaultdict(deque)
rate_lock = threading.Lock()


def authorized(header: str | None) -> bool:
    if len(ACCESS_TOKEN) < 8:
        return False
    supplied = (header or "").removeprefix("Bearer ").strip()
    return hmac.compare_digest(supplied, ACCESS_TOKEN)


def rate_limited(client_ip: str) -> bool:
    now = time.monotonic()
    with rate_lock:
        entries = request_times[client_ip]
        while entries and now - entries[0] > RATE_WINDOW_SECONDS:
            entries.popleft()
        if len(entries) >= RATE_LIMIT:
            return True
        entries.append(now)
        return False


class GatewayHandler(BaseHTTPRequestHandler):
    server_version = "NianrenjinSearchGateway/1.0"

    def _headers(self, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def _json(self, status: int, payload: dict) -> None:
        self._headers(status)
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._headers(204)

    def do_GET(self) -> None:  # noqa: N802
        if self.path.rstrip("/") == "/ready":
            self._json(200, {"ok": True})
            return
        if self.path.rstrip("/") != "/health":
            self._json(404, {"error": "Not found"})
            return
        if not authorized(self.headers.get("Authorization")):
            status = 503 if len(ACCESS_TOKEN) < 8 else 401
            self._json(status, {"error": "访问密码未配置或不正确"})
            return
        self._json(200, {"ok": True, "provider": "SearXNG"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path.rstrip("/") != "/api/search":
            self._json(404, {"error": "Not found"})
            return
        if not authorized(self.headers.get("Authorization")):
            self._json(401, {"error": "访问密码不正确"})
            return
        client_ip = self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()
        if rate_limited(client_ip):
            self._json(429, {"error": "搜索过于频繁，请稍后再试"})
            return
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 16_384)
            body = json.loads(self.rfile.read(length) or b"{}")
            query = str(body.get("query", "")).strip()[:400]
            max_results = max(1, min(10, int(body.get("maxResults", 5))))
            if not query:
                self._json(400, {"error": "搜索词不能为空"})
                return
            payload = urllib.parse.urlencode({
                "q": query,
                "format": "json",
                "language": "auto",
                "safesearch": "1",
            }).encode("utf-8")
            request = urllib.request.Request(SEARXNG_URL, data=payload, method="POST")
            request.add_header("Content-Type", "application/x-www-form-urlencoded")
            with urllib.request.urlopen(request, timeout=20) as response:
                search_data = json.loads(response.read(2_000_000))
            results = []
            for item in search_data.get("results", []):
                url = str(item.get("url", "")).strip()
                if not url.startswith(("http://", "https://")):
                    continue
                results.append({
                    "title": str(item.get("title") or url)[:240],
                    "url": url,
                    "snippet": str(item.get("content") or "")[:1200],
                })
                if len(results) >= max_results:
                    break
            self._json(200, {"provider": "SearXNG", "queries": [query], "results": results})
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"error": "请求格式不正确"})
        except urllib.error.HTTPError as error:
            self._json(502, {"error": f"搜索引擎返回错误 ({error.code})"})
        except Exception as error:  # Keep upstream details out of the public response.
            print(f"search gateway error: {type(error).__name__}: {error}", flush=True)
            self._json(502, {"error": "搜索引擎暂时不可用，请稍后重试"})

    def log_message(self, format_string: str, *args) -> None:
        print(f"{self.address_string()} - {format_string % args}", flush=True)


if __name__ == "__main__":
    print(f"search gateway listening on 0.0.0.0:{PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), GatewayHandler).serve_forever()
