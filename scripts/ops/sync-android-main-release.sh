#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_URL="${VOXFLAME_ANDROID_REPOSITORY_URL:-https://github.com/AIden-QiU1/VoxFlame-Agent.git}"
STATE_ROOT="${VOXFLAME_ANDROID_SYNC_STATE_ROOT:-/var/lib/voxflame-android-build}"
REPO_DIR="$STATE_ROOT/repository"
ARTIFACT_ROOT="$STATE_ROOT/artifacts"
LAST_SUCCESS_PATH="$STATE_ROOT/last-successful-main-sha"
LOCK_PATH="$STATE_ROOT/sync.lock"
DEPLOY_KEY_PATH="${VOXFLAME_ANDROID_DEPLOY_KEY:-$STATE_ROOT/secrets/github-android-deploy-key}"
KNOWN_HOSTS_PATH="${VOXFLAME_ANDROID_KNOWN_HOSTS:-$STATE_ROOT/secrets/known_hosts}"
DEPLOY_TARGET="${VOXFLAME_ANDROID_DEPLOY_TARGET:-voxflame-release@127.0.0.1}"
PUBLIC_URL="${VOXFLAME_ANDROID_DOWNLOAD_URL:-https://voxember.com/download/android}"

mkdir -p "$STATE_ROOT" "$ARTIFACT_ROOT"
exec 9>"$LOCK_PATH"
if ! flock -n 9; then
  echo "[voxflame] Android main sync is already running."
  exit 0
fi

retry() {
  local attempt
  for attempt in 1 2 3; do
    if "$@"; then
      return 0
    fi
    echo "[voxflame] Attempt $attempt failed: $*" >&2
  done
  return 1
}

record_synced_sha() {
  local sha="$1"
  local success_tmp="$LAST_SUCCESS_PATH.tmp"
  printf '%s\n' "$sha" > "$success_tmp"
  mv -f "$success_tmp" "$LAST_SUCCESS_PATH"
}

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "[voxflame] Creating the isolated Android release checkout..."
  retry timeout --signal=TERM 10m \
    git clone --filter=blob:none --no-tags "$REPOSITORY_URL" "$REPO_DIR"
fi

echo "[voxflame] Reading origin/main..."
retry timeout --signal=TERM 3m \
  git -C "$REPO_DIR" fetch --no-tags origin main
remote_sha="$(git -C "$REPO_DIR" rev-parse FETCH_HEAD)"
last_success_sha=""
if [[ -f "$LAST_SUCCESS_PATH" ]]; then
  last_success_sha="$(tr -d '\r\n' < "$LAST_SUCCESS_PATH")"
fi

if [[ "$remote_sha" == "$last_success_sha" ]]; then
  echo "[voxflame] Android release already matches origin/main: $remote_sha"
  exit 0
fi

if [[ -n "$last_success_sha" ]] \
  && git -C "$REPO_DIR" cat-file -e "$last_success_sha^{commit}" 2>/dev/null \
  && git -C "$REPO_DIR" diff --quiet "$last_success_sha" "$remote_sha" -- \
    apps/mobile-workbench \
    ':(exclude)apps/mobile-workbench/README.md' \
    ':(exclude,glob)apps/mobile-workbench/**/*.md' \
    scripts/release-android-preview.sh \
    scripts/publish-android-artifact.sh; then
  echo "[voxflame] origin/main has no Android release changes since $last_success_sha."
  record_synced_sha "$remote_sha"
  exit 0
fi

artifact_dir="$ARTIFACT_ROOT/$remote_sha"
apk_path="$artifact_dir/VoxFlame-Android.apk"
metadata_path="$artifact_dir/VoxFlame-Android.json"
mkdir -p "$artifact_dir"

if [[ ! -f "$apk_path" || ! -f "$metadata_path" ]]; then
  echo "[voxflame] Preparing Android release for origin/main $remote_sha..."
  git -C "$REPO_DIR" checkout --detach --force "$remote_sha"
  git -C "$REPO_DIR" clean -ffd --exclude releases/android/.downloads/
  npm --prefix "$REPO_DIR/apps/mobile-workbench" ci --include=dev
  bash "$REPO_DIR/scripts/release-android-preview.sh" \
    build-artifact "$artifact_dir"
fi

echo "[voxflame] Publishing Android artifact for $remote_sha..."
tar -C "$artifact_dir" -cf - VoxFlame-Android.apk VoxFlame-Android.json \
  | ssh -i "$DEPLOY_KEY_PATH" \
    -o BatchMode=yes \
    -o ConnectTimeout=30 \
    -o ConnectionAttempts=3 \
    -o IdentitiesOnly=yes \
    -o ServerAliveInterval=15 \
    -o ServerAliveCountMax=4 \
    -o UserKnownHostsFile="$KNOWN_HOSTS_PATH" \
    "$DEPLOY_TARGET"

headers_path="$artifact_dir/public-headers.txt"
curl --fail --silent --show-error --location --retry 8 --retry-all-errors \
  --connect-timeout 30 --speed-limit 1024 --speed-time 120 \
  --range 0-0 --dump-header "$headers_path" --output /dev/null "$PUBLIC_URL"
grep -iq '^content-type: application/vnd.android.package-archive' "$headers_path"

record_synced_sha "$remote_sha"
echo "[voxflame] Android origin/main release completed: $remote_sha"
