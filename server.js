const { createServer: createHttpServer } = require('http');
const { createServer: createHttpsServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { GeminiLiveProxy } = require('./server/gemini-live-proxy');

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
      const parsedUrl = parse(req.url, true);
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
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url, true);

    if (pathname === '/ws/gemini-live') {
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
      console.log(`> Ready on ${proto}://${hostname}:${port}`);
      console.log(`> Network: ${proto}://192.168.4.228:${port}`);
      console.log(`> WebSocket: ${wsProto}://${hostname}:${port}/ws/gemini-live`);
      if (useHttps) {
        console.log(`> HTTPS enabled (certs from .cert/)`);
        console.log(`> Open on your phone: ${proto}://192.168.4.228:${port}`);
      }
    });
});
