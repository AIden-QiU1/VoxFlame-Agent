#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPOSITORY="${VOXFLAME_GITHUB_REPOSITORY:-AIden-QiU1/VoxFlame-Agent}"
ENVIRONMENT="production"
EXPO_TOKEN_PATH="${XDG_CONFIG_HOME:-$HOME/.config}/voxflame/expo-token"
DEPLOY_KEY_PATH="${XDG_CONFIG_HOME:-$HOME/.config}/voxflame/github-android-deploy-key"
DEPLOY_HOST="${VOXFLAME_DEPLOY_HOST:-voxember.com}"
DEPLOY_USER="${VOXFLAME_DEPLOY_USER:-voxflame-release}"
DEPLOY_PORT="${VOXFLAME_DEPLOY_PORT:-22}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is not installed" >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi
if [[ ! -s "$EXPO_TOKEN_PATH" ]]; then
  echo "Expo token is missing. Run: npm run eas:save-token" >&2
  exit 1
fi
if [[ ! -s "$DEPLOY_KEY_PATH" ]]; then
  echo "Android deploy key is missing: $DEPLOY_KEY_PATH" >&2
  exit 1
fi

known_hosts="$(ssh-keyscan -p "$DEPLOY_PORT" -H "$DEPLOY_HOST" 2>/dev/null)"
if [[ -z "$known_hosts" ]]; then
  echo "Could not read the SSH host key for $DEPLOY_HOST:$DEPLOY_PORT" >&2
  exit 1
fi

printf '{}\n' | gh api --method PUT \
  "repos/$REPOSITORY/environments/$ENVIRONMENT" \
  --input - >/dev/null

gh secret set EXPO_TOKEN --repo "$REPOSITORY" --env "$ENVIRONMENT" \
  < "$EXPO_TOKEN_PATH"
gh secret set DEPLOY_SSH_KEY --repo "$REPOSITORY" --env "$ENVIRONMENT" \
  < "$DEPLOY_KEY_PATH"
printf '%s\n' "$DEPLOY_HOST" \
  | gh secret set DEPLOY_HOST --repo "$REPOSITORY" --env "$ENVIRONMENT"
printf '%s\n' "$DEPLOY_USER" \
  | gh secret set DEPLOY_USER --repo "$REPOSITORY" --env "$ENVIRONMENT"
printf '%s\n' "$DEPLOY_PORT" \
  | gh secret set DEPLOY_PORT --repo "$REPOSITORY" --env "$ENVIRONMENT"
printf '%s\n' "$known_hosts" \
  | gh secret set DEPLOY_KNOWN_HOSTS --repo "$REPOSITORY" --env "$ENVIRONMENT"
if ! gh api --method PATCH \
  "repos/$REPOSITORY/actions/variables/ANDROID_AUTO_RELEASE_ENABLED" \
  -f name=ANDROID_AUTO_RELEASE_ENABLED -f value=true >/dev/null 2>&1; then
  gh api --method POST "repos/$REPOSITORY/actions/variables" \
    -f name=ANDROID_AUTO_RELEASE_ENABLED -f value=true >/dev/null
fi

echo "GitHub production environment configured for Android release."
echo "Repository:  $REPOSITORY"
echo "Deploy host: $DEPLOY_HOST:$DEPLOY_PORT"
echo "Deploy user: $DEPLOY_USER"
echo "Auto release: enabled"
echo "Workflow:    $ROOT_DIR/.github/workflows/android-preview-release.yml"
