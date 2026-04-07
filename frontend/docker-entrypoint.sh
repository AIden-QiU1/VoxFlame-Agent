#!/bin/sh
set -e

# Frontend entrypoint script
# Supports HTTP on port 3000

echo "Starting VoxFlame Frontend..."
echo "HTTP will be available on port 3000"

# Start Next.js standalone server on an internal port.
INTERNAL_PORT="${INTERNAL_PORT:-3100}"
HOSTNAME=127.0.0.1 PORT="${INTERNAL_PORT}" node server.js 2>&1 | tee -a /app/logs/frontend.log &

# Start the public proxy on port 3000 so the app and LiveKit signaling share one origin.
PORT="${PORT:-3000}" INTERNAL_PORT="${INTERNAL_PORT}" node /app/proxy-server.cjs 2>&1 | tee -a /app/logs/frontend-proxy.log &

# Wait for any background process
wait
