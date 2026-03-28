#!/bin/bash
set -euo pipefail

APP_DIR="${1:-/app}"
PACKAGE_BASE_URL="${TEN_PACKAGE_BASE_URL:-https://rte-store.s3.amazonaws.com/ten-packages}"

download_and_extract() {
  local package_type="$1"
  local package_name="$2"
  local package_version="$3"
  local package_hash="$4"
  local target_dir="$APP_DIR/ten_packages/${package_type}/${package_name}"
  local archive_path="/tmp/${package_type}-${package_name}-${package_version}.tpkg"
  local download_url="${PACKAGE_BASE_URL}/${package_type}-${package_name}-${package_version}${package_hash}.tpkg"

  echo "[install_locked_ten_packages] ${package_type}/${package_name}@${package_version}"
  rm -rf "$target_dir"
  mkdir -p "$target_dir"

  curl -fL \
    --retry 8 \
    --retry-all-errors \
    --retry-delay 2 \
    --connect-timeout 10 \
    --max-time 300 \
    "$download_url" \
    -o "$archive_path"

  tar -xzf "$archive_path" -C "$target_dir"
  rm -f "$archive_path"
}

mkdir -p \
  "$APP_DIR/ten_packages/system" \
  "$APP_DIR/ten_packages/extension" \
  "$APP_DIR/ten_packages/addon_loader"

download_and_extract "system" "ten_runtime" "0.11.57" "634b25b9aabb609c8a00b2a7fd5e94d17059203c7e33c10cf5ad8e2cf4011181"
download_and_extract "system" "ten_runtime_go" "0.11.57" "e150302f7b7a1c4e8499846a1027d2ec2a701bedf7c4f524b813dc3210fd582d"
download_and_extract "system" "ten_runtime_python" "0.11.57" "aa58cccfde5e26dcd3133f03154605c12ac12e4ca0693cfe3fe01e71707a0a4b"
download_and_extract "addon_loader" "python_addon_loader" "0.11.57" "f0409a97dd65704b83dd284496c9e43fb41997dee4c505febc0cd730dc33e09e"
download_and_extract "system" "ten_ai_base" "0.7.35" "c0559982cec45471511446cb7224b945ad614f269c9e0d3c199959bf9ede752f"
download_and_extract "system" "agora_rtc_sdk" "4.4.32-141" "ce8f50da194f74610735c74450c5c04bbee7f56959431d628349082b90742eb8"
download_and_extract "extension" "agora_rtc" "0.23.9-t1" "6f08c87c362d30bbfd831899435fec06982a2924bd9cc0f5cb7e936974bf5731"
download_and_extract "extension" "agora_rtm" "0.11.2" "f4291c7513398626f3e579767397a6cb3dcca489c10750f77db04b95d8c932a1"
