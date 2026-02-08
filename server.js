const { createServer: createHttpServer } = require('http');
const { createServer: createHttpsServer } = require('https');
// WHATWG URL used instead of deprecated url.parse()
const next = require('next');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const { GeminiLiveProxy } = require('./server/gemini-live-proxy');

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3003;

// Use HTTPS if certs exist (needed for mic access on mobile via LAN)
const certDir = path.join(__dirname, '.cert');
const hasCerts = fs.existsSync(path.join(certDir, 'cert.pem')) && fs.existsSync(path.join(certDir, 'key.pem'));
const useHttps = hasCerts;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const requestHandler = async (req, res) => {
    try {
      const reqUrl = new URL(req.url, `http://${req.headers.host}`);
      const parsedUrl = { pathname: reqUrl.pathname, query: Object.fromEntries(reqUrl.searchParams) };
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  };

  const server = useHttps
    ? createHttpsServer(
        {
          key: fs.readFileSync(path.join(certDir, 'key.pem')),
          cert: fs.readFileSync(path.join(certDir, 'cert.pem')),
        },
        requestHandler
      )
    : createHttpServer(requestHandler);

  // WebSocket server for Gemini Live API proxy
  const MAX_WS_CONNECTIONS = 5;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1048576 });

  // Origin validation: only allow local, LAN, and known tunnel origins
  function isAllowedOrigin(origin) {
    if (!origin) return true; // Allow connections with no Origin header (e.g., server-to-server)
    try {
      const url = new URL(origin);
      const host = url.hostname;
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === getLanIp() ||
        host.endsWith('.share.zrok.io') ||
        host.endsWith('.ngrok-free.dev')
      ) {
        return true;
      }
    } catch {
      // Malformed origin
    }
    return false;
  }

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);

    if (pathname === '/ws/gemini-live') {
      // W-S3: Origin validation
      const origin = request.headers.origin;
      if (!isAllowedOrigin(origin)) {
        console.warn(`[WS] Rejected connection from disallowed origin: ${origin}`);
        socket.destroy();
        return;
      }

      // W-S5: Connection rate limiting
      if (wss.clients.size >= MAX_WS_CONNECTIONS) {
        console.warn(`[WS] Rejected connection: max connections (${MAX_WS_CONNECTIONS}) reached`);
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // Non-matching paths fall through to Next.js (HMR, etc.)
  });

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected to /ws/gemini-live');
    const proxy = new GeminiLiveProxy(ws);

    // Ping every 5s to keep connection alive through tunnels/proxies
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) ws.ping();
    }, 5000);

    ws.on('message', (data) => {
      proxy.handleClientMessage(data);
    });

    ws.on('close', (code, reason) => {
      clearInterval(pingInterval);
      console.log(`[WS] Client disconnected (code: ${code}, reason: ${reason || 'none'})`);
      proxy.disconnect();
    });

    ws.on('error', (err) => {
      clearInterval(pingInterval);
      console.error('[WS] WebSocket error:', err);
      proxy.disconnect();
    });

    // Connect to Gemini in the background — setup_complete flows via proxy callbacks
    proxy.connect().catch((err) => {
      console.error('[WS] Failed to connect to Gemini:', err);
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
        ws.close();
      }
    });
  });

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      const proto = useHttps ? 'https' : 'http';
      const wsProto = useHttps ? 'wss' : 'ws';
      const lanIp = getLanIp();
      console.log(`> Ready on ${proto}://${hostname}:${port}`);
      console.log(`> Network: ${proto}://${lanIp}:${port}`);
      console.log(`> WebSocket: ${wsProto}://${hostname}:${port}/ws/gemini-live`);
      if (useHttps) {
        console.log(`> HTTPS enabled (certs from .cert/)`);
        console.log(`> Open on your phone: ${proto}://${lanIp}:${port}`);
      }
    });
});
