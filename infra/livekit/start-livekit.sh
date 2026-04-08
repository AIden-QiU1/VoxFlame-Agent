#!/bin/sh
set -eu

CONFIG_SOURCE=/etc/livekit/livekit.yaml
RUNTIME_DIR=/tmp/livekit
RUNTIME_CONFIG="$RUNTIME_DIR/livekit.yaml"

mkdir -p "$RUNTIME_DIR"
cp "$CONFIG_SOURCE" "$RUNTIME_CONFIG"

if [ -n "${VOXFLAME_PUBLIC_HOST:-}" ]; then
  CERT_BASE="/var/lib/caddy/caddy/certificates/acme-v02.api.letsencrypt.org-directory/${VOXFLAME_PUBLIC_HOST}"
  CERT_FILE="${CERT_BASE}/${VOXFLAME_PUBLIC_HOST}.crt"
  KEY_FILE="${CERT_BASE}/${VOXFLAME_PUBLIC_HOST}.key"
  TURN_UDP_PORT="${VOXFLAME_LIVEKIT_TURN_UDP_PORT:-443}"
  TURN_TLS_ENABLED="${VOXFLAME_LIVEKIT_TURN_TLS_ENABLED:-0}"
  TURN_TLS_PORT="${VOXFLAME_LIVEKIT_TURN_TLS_PORT:-5349}"
  TURN_DOMAIN="${VOXFLAME_LIVEKIT_TURN_DOMAIN:-${VOXFLAME_PUBLIC_HOST:-}}"

  cat >> "$RUNTIME_CONFIG" <<EOF

turn:
  enabled: true
  udp_port: ${TURN_UDP_PORT}
EOF

  if [ "$TURN_TLS_ENABLED" = "1" ] || [ "$TURN_TLS_ENABLED" = "true" ] || [ "$TURN_TLS_ENABLED" = "yes" ]; then
    if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
      cat >> "$RUNTIME_CONFIG" <<EOF
  domain: ${TURN_DOMAIN}
  cert_file: ${CERT_FILE}
  key_file: ${KEY_FILE}
  tls_port: ${TURN_TLS_PORT}
EOF
      echo "[livekit] TURN enabled for ${TURN_DOMAIN} (udp:${TURN_UDP_PORT}, tls:${TURN_TLS_PORT})"
    else
      echo "[livekit] TURN TLS requested but certificate not found for ${TURN_DOMAIN}, continuing with TURN/UDP only on ${TURN_UDP_PORT}"
    fi
  else
    echo "[livekit] TURN/UDP enabled for ${VOXFLAME_PUBLIC_HOST} on ${TURN_UDP_PORT} (TURN/TLS disabled)"
  fi
fi

if [ "${LIVEKIT_SERVER_DEV_MODE:-1}" = "1" ]; then
  exec /livekit-server --config "$RUNTIME_CONFIG" --bind 0.0.0.0 --dev
fi

exec /livekit-server --config "$RUNTIME_CONFIG" --bind 0.0.0.0
