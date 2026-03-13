#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_block_check() {
  local label="$1"
  local pattern="$2"
  shift 2

  local output=""
  local status=0

  set +e
  output="$(rg -n --color=never -F "${pattern}" "$@" 2>&1)"
  status=$?
  set -e

  if [[ ${status} -eq 0 ]]; then
    echo "Governance guard failed: ${label}" >&2
    echo "${output}" >&2
    exit 1
  fi

  if [[ ${status} -ne 1 ]]; then
    echo "${output}" >&2
    exit "${status}"
  fi
}

cd "${ROOT_DIR}"

legacy_code_globs=(
  "frontend/src"
  "backend/src"
  "--glob=!backend/src/controllers/agent.controller.ts"
  "--glob=!backend/src/controllers/session.controller.ts"
  "--glob=!backend/src/index.ts"
)

run_block_check \
  "legacy /api/session/start usage outside compat shell" \
  "/api/session/start" \
  "${legacy_code_globs[@]}"

run_block_check \
  "legacy /api/session/stop usage outside compat shell" \
  "/api/session/stop" \
  "${legacy_code_globs[@]}"

run_block_check \
  "legacy /api/session/reload-hotwords usage outside compat shell" \
  "/api/session/reload-hotwords" \
  "${legacy_code_globs[@]}"

run_block_check \
  "legacy /api/agent/session/log usage outside compat shell" \
  "/api/agent/session/log" \
  "${legacy_code_globs[@]}"

run_block_check \
  "legacy /api/agent/session/history usage outside compat shell" \
  "/api/agent/session/history" \
  "${legacy_code_globs[@]}"

run_block_check \
  "legacy /api/agent/tool/log usage outside compat shell" \
  "/api/agent/tool/log" \
  "${legacy_code_globs[@]}"

run_block_check \
  "legacy /api/agent/tool/execute usage outside compat shell" \
  "/api/agent/tool/execute" \
  "${legacy_code_globs[@]}"

run_block_check \
  "fragmented /api/memory/user usage outside unified profile path" \
  "/api/memory/user/" \
  "frontend/src"

run_block_check \
  "fragmented /api/memory/hotwords usage outside unified profile path" \
  "/api/memory/hotwords/" \
  "frontend/src"

run_block_check \
  "fragmented /api/memory/stats usage outside unified profile path" \
  "/api/memory/stats/" \
  "frontend/src"

run_block_check \
  "legacy /chat route usage outside compat redirect (double-quoted)" \
  "\"/chat\"" \
  "frontend/src" \
  "--glob=!frontend/src/app/chat/page.tsx"

run_block_check \
  "legacy /chat route usage outside compat redirect (single-quoted)" \
  "'/chat'" \
  "frontend/src" \
  "--glob=!frontend/src/app/chat/page.tsx"

run_block_check \
  "legacy /chat route usage outside compat redirect (template string)" \
  '`/chat`' \
  "frontend/src" \
  "--glob=!frontend/src/app/chat/page.tsx"

run_block_check \
  "legacy /ranyan route usage outside compat redirect (double-quoted)" \
  "\"/ranyan\"" \
  "frontend/src" \
  "--glob=!frontend/src/app/ranyan/page.tsx"

run_block_check \
  "legacy /ranyan route usage outside compat redirect (single-quoted)" \
  "'/ranyan'" \
  "frontend/src" \
  "--glob=!frontend/src/app/ranyan/page.tsx"

run_block_check \
  "legacy /ranyan route usage outside compat redirect (template string)" \
  '`/ranyan`' \
  "frontend/src" \
  "--glob=!frontend/src/app/ranyan/page.tsx"

echo "AI governance guard passed."
