const http = require('http');
const net = require('net');

const publicPort = Number(process.env.PORT || 3000);
const internalPort = Number(process.env.INTERNAL_PORT || 3100);
const appTarget = new URL(`http://127.0.0.1:${internalPort}`);
const rtcTarget = new URL(
  process.env.LIVEKIT_SIGNAL_PROXY_TARGET || 'http://livekit-server:7880',
);

function isRtcPath(url = '/') {
  return url === '/rtc' || url.startsWith('/rtc?') || url.startsWith('/rtc/');
}

function getTarget(url) {
  return isRtcPath(url) ? rtcTarget : appTarget;
}

function getForwardedHeader(req, name, fallback = '') {
  const value = req.headers[name];
  if (Array.isArray(value)) {
    return value[0] || fallback;
  }
  return value || fallback;
}

function proxyHttp(req, res) {
  const target = getTarget(req.url);
  const isRtcRequest = isRtcPath(req.url);
  const forwardedHost = getForwardedHeader(req, 'x-forwarded-host', req.headers.host || '');
  const forwardedProto = getForwardedHeader(req, 'x-forwarded-proto', 'http');
  const headers = {
    ...req.headers,
    host: isRtcRequest ? target.host : forwardedHost || target.host,
    'x-forwarded-host': forwardedHost,
    'x-forwarded-proto': forwardedProto,
  };

  const upstream = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path: req.url,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', (error) => {
    console.error('[frontend-proxy] http proxy error:', error.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    }
    res.end('Bad Gateway');
  });

  req.pipe(upstream);
}

function proxyUpgrade(req, socket, head) {
  const target = getTarget(req.url);
  const isRtcRequest = isRtcPath(req.url);
  const forwardedHost = getForwardedHeader(req, 'x-forwarded-host', req.headers.host || '');
  const forwardedProto = getForwardedHeader(
    req,
    'x-forwarded-proto',
    req.headers.upgrade ? 'wss' : 'ws',
  );
  const upstream = net.connect(Number(target.port), target.hostname, () => {
    const headerLines = Object.entries({
      ...req.headers,
      host: isRtcRequest ? target.host : forwardedHost || target.host,
      connection: req.headers.connection || 'Upgrade',
      upgrade: req.headers.upgrade || 'websocket',
      'x-forwarded-host': forwardedHost,
      'x-forwarded-proto': forwardedProto,
    }).map(([key, value]) => `${key}: ${value}`);

    upstream.write(
      `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headerLines.join('\r\n')}\r\n\r\n`,
    );

    if (head?.length) {
      upstream.write(head);
    }

    socket.pipe(upstream);
    upstream.pipe(socket);
  });

  upstream.on('error', (error) => {
    console.error('[frontend-proxy] upgrade proxy error:', error.message);
    socket.destroy();
  });
}

const server = http.createServer(proxyHttp);
server.on('upgrade', proxyUpgrade);

server.listen(publicPort, '0.0.0.0', () => {
  console.log(
    `[frontend-proxy] listening on :${publicPort}, appTarget=${appTarget.href}, rtcTarget=${rtcTarget.href}`,
  );
});
