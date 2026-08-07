#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_ENV="$REPO_ROOT/backend/.env"

VOX_HOOK_SECRET=''
VOX_ENV_TMP=''

cleanup() {
  unset VOX_HOOK_SECRET
  if [[ -n "$VOX_ENV_TMP" && -f "$VOX_ENV_TMP" ]]; then
    rm -f -- "$VOX_ENV_TMP"
  fi
}

trap cleanup EXIT

printf 'Supabase Send SMS Hook 密钥安全保存\n'
printf '输入内容不会显示，也不会进入 shell 历史。\n\n'
read -r -s -p '粘贴 Hook Secret（v1,whsec_ 开头），然后按回车：' VOX_HOOK_SECRET
printf '\n'

if [[ "$VOX_HOOK_SECRET" != v1,whsec_* || ${#VOX_HOOK_SECRET} -lt 30 ]]; then
  printf 'Hook Secret 格式不正确：应以 v1,whsec_ 开头。\n' >&2
  exit 1
fi

umask 077
VOX_ENV_TMP="$(mktemp "$REPO_ROOT/backend/.env.hook.XXXXXX")"

if [[ -f "$BACKEND_ENV" ]]; then
  awk '!/^SUPABASE_SEND_SMS_HOOK_SECRET=/' "$BACKEND_ENV" > "$VOX_ENV_TMP"
fi

printf '\nSUPABASE_SEND_SMS_HOOK_SECRET=%s\n' "$VOX_HOOK_SECRET" >> "$VOX_ENV_TMP"
mv -- "$VOX_ENV_TMP" "$BACKEND_ENV"
VOX_ENV_TMP=''
chmod 600 "$BACKEND_ENV"

printf '\n已保存到 backend/.env；没有开启真实短信发送。\n'
