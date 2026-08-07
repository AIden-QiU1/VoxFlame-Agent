#!/usr/bin/env bash

set -euo pipefail

config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/voxflame"
token_file="$config_dir/expo-token"

umask 077
mkdir -p "$config_dir"

read -r -s -p "Expo Personal Access Token: " expo_token
printf '\n'

expo_token="${expo_token//$'\r'/}"
expo_token="${expo_token//$'\n'/}"

if [ "${#expo_token}" -lt 20 ]; then
  echo "保存失败：Token 为空或长度不正确。" >&2
  exit 1
fi

printf '%s\n' "$expo_token" > "$token_file"
chmod 600 "$token_file"

echo "Expo Token 已安全保存到 $token_file"
echo "以后重新 SSH、重开终端或重启服务器后，项目 EAS 命令会自动读取它。"
