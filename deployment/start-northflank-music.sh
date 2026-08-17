#!/bin/sh
set -eu

cleanup() {
  trap - EXIT INT TERM
  kill "${gateway_pid:-}" "${public_pid:-}" "${auth_pid:-}" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(
  cd /tmp/music-public
  MUSIC_API_PORT=8081 exec /usr/local/bin/go-music-api
) &
public_pid=$!

(
  cd /tmp/music-auth
  MUSIC_API_PORT=8082 exec /usr/local/bin/go-music-api
) &
auth_pid=$!

node /app/music-gateway/src/server.mjs &
gateway_pid=$!

while kill -0 "$gateway_pid" "$public_pid" "$auth_pid" 2>/dev/null; do
  sleep 2
done

echo "A music backend process stopped unexpectedly." >&2
exit 1
