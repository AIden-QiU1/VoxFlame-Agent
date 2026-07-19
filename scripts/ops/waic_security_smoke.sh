#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-voxember.com}"
ORIGIN_IP="${VOXFLAME_ORIGIN_IP:-111.230.35.89}"

echo "== DNS A =="
dig +short "$DOMAIN" A || true

echo
echo "== DNS CAA =="
dig +short "$DOMAIN" CAA || true

echo
echo "== DNSSEC DNSKEY =="
dig +dnssec +short "$DOMAIN" DNSKEY || true

echo
echo "== HTTPS headers =="
curl -I --noproxy '*' --max-time 10 "https://${DOMAIN}" || true

echo
echo "== API health headers =="
curl -I --noproxy '*' --max-time 10 "https://${DOMAIN}/api/rtc/health" || true

echo
echo "== Direct origin HTTPS should be blocked after EdgeOne origin protection =="
curl -I --noproxy '*' --connect-timeout 5 --max-time 10 \
  --resolve "${DOMAIN}:443:${ORIGIN_IP}" "https://${DOMAIN}" || true

echo
echo "== Public service ports should be blocked =="
for port in 3000 3001 7880 7881 8081; do
  curl -sS --noproxy '*' --connect-timeout 3 --max-time 5 -o /dev/null \
    -w "${ORIGIN_IP}:${port} %{http_code}\n" "http://${ORIGIN_IP}:${port}/" || true
done
