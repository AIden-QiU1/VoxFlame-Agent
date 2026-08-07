#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_ENV="$REPO_ROOT/backend/.env"

VOX_TENCENT_SECRET_ID=''
VOX_TENCENT_SECRET_KEY=''
VOX_ENV_TMP=''

cleanup() {
  unset VOX_TENCENT_SECRET_ID VOX_TENCENT_SECRET_KEY
  if [[ -n "$VOX_ENV_TMP" && -f "$VOX_ENV_TMP" ]]; then
    rm -f -- "$VOX_ENV_TMP"
  fi
}

trap cleanup EXIT

printf '腾讯云短信凭据安全保存\n'
printf '输入内容不会显示，也不会进入 shell 历史。\n\n'

read -r -s -p '粘贴 SecretId，然后按回车：' VOX_TENCENT_SECRET_ID
printf '\n'
read -r -s -p '粘贴 SecretKey，然后按回车：' VOX_TENCENT_SECRET_KEY
printf '\n'

if [[ "$VOX_TENCENT_SECRET_ID" != AKID* || ${#VOX_TENCENT_SECRET_ID} -lt 20 ]]; then
  printf 'SecretId 格式不正确：应以 AKID 开头。\n' >&2
  exit 1
fi

if [[ ${#VOX_TENCENT_SECRET_KEY} -lt 20 ]]; then
  printf 'SecretKey 格式不正确：长度过短。\n' >&2
  exit 1
fi

umask 077
VOX_ENV_TMP="$(mktemp "$REPO_ROOT/backend/.env.sms.XXXXXX")"

if [[ -f "$BACKEND_ENV" ]]; then
  awk '
    !/^TENCENTCLOUD_SECRET_ID=/ &&
    !/^TENCENTCLOUD_SECRET_KEY=/ &&
    !/^TENCENT_SMS_SDK_APP_ID=/ &&
    !/^TENCENT_SMS_SIGN_NAME=/ &&
    !/^TENCENT_SMS_TEMPLATE_ID=/ &&
    !/^PHONE_AUTH_ENABLED=/ &&
    !/^TENCENT_SMS_DRY_RUN=/
  ' "$BACKEND_ENV" > "$VOX_ENV_TMP"
fi

{
  printf '\n'
  printf 'TENCENTCLOUD_SECRET_ID=%s\n' "$VOX_TENCENT_SECRET_ID"
  printf 'TENCENTCLOUD_SECRET_KEY=%s\n' "$VOX_TENCENT_SECRET_KEY"
  printf 'TENCENT_SMS_SDK_APP_ID=1401169029\n'
  printf 'TENCENT_SMS_SIGN_NAME=上海生声不息科技有限公司\n'
  printf 'TENCENT_SMS_TEMPLATE_ID=2702800\n'
  printf 'PHONE_AUTH_ENABLED=0\n'
  printf 'TENCENT_SMS_DRY_RUN=1\n'
} >> "$VOX_ENV_TMP"

mv -- "$VOX_ENV_TMP" "$BACKEND_ENV"
VOX_ENV_TMP=''
chmod 600 "$BACKEND_ENV"

printf '\n已保存到 backend/.env。\n'
printf '当前保持 PHONE_AUTH_ENABLED=0、TENCENT_SMS_DRY_RUN=1，不会发送真实短信。\n'
