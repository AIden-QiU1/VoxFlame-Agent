#!/bin/bash
# 生成自签名 SSL 证书（用于开发环境）
# 生产环境请使用 Let's Encrypt 或其他受信任的 CA

CERT_DIR="/home/ubuntu/VoxFlame-Agent/nginx/ssl"

mkdir -p "$CERT_DIR"

if [ -f "$CERT_DIR/cert.pem" ] && [ -f "$CERT_DIR/key.pem" ]; then
    echo "SSL 证书已存在，跳过生成"
    exit 0
fi

echo "正在生成自签名 SSL 证书..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/key.pem" \
    -out "$CERT_DIR/cert.pem" \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=VoxFlame/OU=Development/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"

chmod 600 "$CERT_DIR/key.pem"
chmod 644 "$CERT_DIR/cert.pem"

echo "SSL 证书生成完成！"
echo "证书位置: $CERT_DIR/"
echo ""
echo "⚠️  注意：这是自签名证书，浏览器会显示安全警告。"
echo "   生产环境请使用 Let's Encrypt 或其他受信任的 CA。"
