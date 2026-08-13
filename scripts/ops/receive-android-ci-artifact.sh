#!/usr/bin/env bash
set -euo pipefail

RELEASE_DIR="${VOXFLAME_ANDROID_RELEASE_DIR:-/srv/voxflame/android}"
PUBLIC_URL="${VOXFLAME_ANDROID_DOWNLOAD_URL:-https://voxember.com/download/android}"
PUBLISH_SCRIPT="${VOXFLAME_ANDROID_PUBLISH_SCRIPT:-/usr/local/libexec/voxflame-publish-android-artifact}"

if [[ ! -x "$PUBLISH_SCRIPT" ]]; then
  echo "Android artifact publisher is not installed" >&2
  exit 1
fi

mkdir -p "$RELEASE_DIR/.incoming"
stage_dir="$(mktemp -d "$RELEASE_DIR/.incoming/receive-XXXXXX")"
archive_path="$stage_dir/artifact.tar"
cleanup() {
  rm -rf "$stage_dir"
}
trap cleanup EXIT

dd of="$archive_path" status=none
archive_entries="$(tar -tf "$archive_path" | sort)"
expected_entries=$'VoxFlame-Android.apk\nVoxFlame-Android.json'
if [[ "$archive_entries" != "$expected_entries" ]]; then
  echo "Unexpected Android artifact archive contents" >&2
  exit 1
fi
if tar -tvf "$archive_path" | awk '$1 !~ /^-/ { exit 1 }'; then
  :
else
  echo "Android artifact archive must contain regular files only" >&2
  exit 1
fi

tar --extract --no-same-owner --no-same-permissions \
  --file "$archive_path" --directory "$stage_dir"
for artifact_path in \
  "$stage_dir/VoxFlame-Android.apk" \
  "$stage_dir/VoxFlame-Android.json"; do
  if [[ ! -f "$artifact_path" || -L "$artifact_path" ]]; then
    echo "Android artifact archive contains an invalid file" >&2
    exit 1
  fi
done
bash "$PUBLISH_SCRIPT" \
  "$stage_dir/VoxFlame-Android.apk" \
  "$stage_dir/VoxFlame-Android.json" \
  "$RELEASE_DIR" \
  "$PUBLIC_URL"
