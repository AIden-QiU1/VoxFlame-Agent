#!/bin/sh
set -e

# Frontend entrypoint script
# Supports both HTTP (port 3000) and optional HTTPS (port 3443)

echo "Starting VoxFlame Frontend..."
echo "HTTP will be available on port 3000"

# Start HTTP server (always)
node server.js 2>&1 | tee -a /app/logs/frontend.log &

# Optional: Start HTTPS server if certificates are available
if [ -f /app/ssl/cert.pem ] && [ -f /app/ssl/key.pem ]; then
    echo "SSL certificates found, starting HTTPS server on port 3443..."

    # Use a simple HTTPS redirect/proxy with Node.js
    cat > /tmp/https-server.js << 'EOF'
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const options = {
    key: fs.readFileSync('/app/ssl/key.pem'),
    cert: fs.readFileSync('/app/ssl/cert.pem')
};

// HTTPS server that proxies to HTTP backend
const server = https.createServer(options, (req, res) => {
    // Proxy to HTTP server
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: req.url,
        method: req.method,
        headers: req.headers
    };

    const proxy = http.request(options, (backendRes) => {
        // Copy headers
        res.writeHead(backendRes.statusCode, backendRes.headers);
        backendRes.pipe(res);
    });

    proxy.on('error', (err) => {
        console.error('Proxy error:', err.message);
        res.writeHead(502);
        res.end('Bad Gateway');
    });

    req.pipe(proxy);
});

server.listen(3443, '0.0.0.0', () => {
    console.log('HTTPS server running on port 3443');
});
EOF

    node /tmp/https-server.js 2>&1 | tee -a /app/logs/frontend-https.log &
else
    echo "No SSL certificates found, skipping HTTPS server"
    echo "To enable HTTPS, mount certificates to /app/ssl/"
fi

# Wait for any background process
wait
