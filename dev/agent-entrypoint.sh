#!/bin/sh
set -eu

if command -v multica >/dev/null 2>&1 \
  && command -v codex >/dev/null 2>&1 \
  && multica auth status >/dev/null 2>&1; then
  exec multica daemon start \
    --foreground \
    --workspaces-root /workspace \
    --max-concurrent-tasks 1 \
    --no-auto-update
fi

exec sleep infinity
