#!/usr/bin/env sh
set -eu

/usr/local/searxng/entrypoint.sh &
SEARXNG_PID=$!

cleanup() {
  kill "$SEARXNG_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT
python3 /usr/local/searxng/gateway.py
