#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
frontend_src="$repo_root/frontend/src"
mobile_src="$repo_root/apps/mobile-workbench"

raw_error_pattern='return error\.message|payload\?\.error|error\.error[[:space:]]*\|\||event\.reason[[:space:]]*\|\||instanceof Error[[:space:]]*\?[[:space:]]*[^:\n]*\.message|set(Error|Message|Status|LastError)\([^)]*(error|err)[^)]*\.message|(description|message|error):[[:space:]]*(error|err)[^,}]*\.message'

if rg -n \
  --glob '!**/*.test.*' \
  --glob '!lib/ui/product-message.ts' \
  "$raw_error_pattern" \
  "$frontend_src" \
  "$mobile_src/App.tsx" \
  "$mobile_src/src"; then
  echo 'Frontend product-message check failed: raw diagnostics can reach user-facing state.' >&2
  exit 1
fi

echo 'Frontend product-message check passed.'
