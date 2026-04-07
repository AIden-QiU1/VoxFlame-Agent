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

  if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    cat >> "$RUNTIME_CONFIG" <<EOF

turn:
  enabled: true
  domain: ${VOXFLAME_PUBLIC_HOST}
  cert_file: ${CERT_FILE}
  key_file: ${KEY_FILE}
  udp_port: ${LIVEKIT_TURN_UDP_PORT:-3478}
  tls_port: ${LIVEKIT_TURN_TLS_PORT:-5349}
EOF
    echo "[livekit] TURN enabled for ${VOXFLAME_PUBLIC_HOST} (udp:${LIVEKIT_TURN_UDP_PORT:-3478}, tls:${LIVEKIT_TURN_TLS_PORT:-5349})"
  else
    echo "[livekit] TURN certificate not found for ${VOXFLAME_PUBLIC_HOST}, starting without TURN"
  fi
fi

if [ "${LIVEKIT_SERVER_DEV_MODE:-1}" = "1" ]; then
  exec /livekit-server --config "$RUNTIME_CONFIG" --bind 0.0.0.0 --dev
fi

exec /livekit-server --config "$RUNTIME_CONFIG" --bind 0.0.0.0
