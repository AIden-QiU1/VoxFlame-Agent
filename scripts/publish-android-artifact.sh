#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 || $# -gt 4 ]]; then
  echo "Usage: $0 <apk> <metadata-json> <release-directory> [public-url]" >&2
  exit 1
fi

SOURCE_APK="$1"
SOURCE_METADATA="$2"
RELEASE_DIR="$3"
PUBLIC_URL="${4:-https://voxember.com/download/android}"
APK_PATH="$RELEASE_DIR/VoxFlame-Android.apk"
METADATA_PATH="$RELEASE_DIR/VoxFlame-Android.json"
LOCK_PATH="$RELEASE_DIR/.publish.lock"

for command_name in curl node sha256sum unzip; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
done

if [[ ! -f "$SOURCE_APK" || ! -f "$SOURCE_METADATA" ]]; then
  echo "APK or metadata file is missing" >&2
  exit 1
fi

mkdir -p "$RELEASE_DIR"
exec 9>"$LOCK_PATH"
if ! flock -n 9; then
  echo "Another Android artifact publish is already running." >&2
  exit 1
fi

read_metadata_field() {
  node --input-type=module - "$SOURCE_METADATA" "$1" <<'NODE'
import { readFileSync } from 'node:fs'

const [metadataPath, field] = process.argv.slice(2)
const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
const value = metadata[field]
if (value === undefined || value === null || value === '') {
  throw new Error(`Android artifact metadata field is missing: ${field}`)
}
process.stdout.write(String(value))
NODE
}

build_id="$(read_metadata_field buildId)"
expected_sha256="$(read_metadata_field sha256)"
expected_size="$(read_metadata_field sizeBytes)"
actual_sha256="$(sha256sum "$SOURCE_APK" | awk '{print $1}')"
actual_size="$(stat -c '%s' "$SOURCE_APK")"

if [[ "$actual_sha256" != "$expected_sha256" || "$actual_size" != "$expected_size" ]]; then
  echo "Android artifact integrity check failed" >&2
  exit 1
fi
unzip -tq "$SOURCE_APK" >/dev/null

work_dir="$(mktemp -d "$RELEASE_DIR/.deploy-XXXXXX")"
cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT
cp "$SOURCE_APK" "$work_dir/VoxFlame-Android.apk"
cp "$SOURCE_METADATA" "$work_dir/VoxFlame-Android.json"

current_build_id=""
if [[ -f "$METADATA_PATH" ]]; then
  current_build_id="$(node --input-type=module - "$METADATA_PATH" <<'NODE'
import { readFileSync } from 'node:fs'

const metadata = JSON.parse(readFileSync(process.argv[2], 'utf8'))
process.stdout.write(typeof metadata.buildId === 'string' ? metadata.buildId : '')
NODE
)"
fi

if [[ -n "$current_build_id" && "$current_build_id" != "$build_id" ]]; then
  if [[ -f "$APK_PATH" ]]; then
    cp -f "$APK_PATH" "$RELEASE_DIR/VoxFlame-Android.previous.apk"
  fi
  cp -f "$METADATA_PATH" "$RELEASE_DIR/VoxFlame-Android.previous.json"
fi

mv -f "$work_dir/VoxFlame-Android.apk" "$APK_PATH"
mv -f "$work_dir/VoxFlame-Android.json" "$METADATA_PATH"
chmod 0640 "$APK_PATH" "$METADATA_PATH"

headers_path="$work_dir/headers.txt"
curl --fail --silent --show-error --location \
  --range 0-0 --dump-header "$headers_path" --output /dev/null "$PUBLIC_URL"
if ! grep -iq '^content-type: application/vnd.android.package-archive' "$headers_path"; then
  echo "Unexpected Android download content type at $PUBLIC_URL" >&2
  sed -n '1,40p' "$headers_path" >&2
  exit 1
fi

echo "[voxflame] Android artifact published"
echo "  build:  $build_id"
echo "  sha256: $actual_sha256"
echo "  bytes:  $actual_size"
echo "  url:    $PUBLIC_URL"
