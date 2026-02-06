const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { GeminiLiveProxy } = require('./server/gemini-live-proxy');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3003;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // WebSocket server for Gemini Live API proxy
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url, true);

    if (pathname === '/ws/gemini-live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      // Let Next.js handle its own WebSocket upgrades (HMR)
      socket.destroy();
    }
  });

  wss.on('connection', async (ws) => {
    console.log('[WS] Client connected to /ws/gemini-live');
    const proxy = new GeminiLiveProxy(ws);

    try {
      await proxy.connect();
    } catch (err) {
      console.error('[WS] Failed to connect to Gemini:', err);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
      ws.close();
      return;
    }

    ws.on('message', (data) => {
      proxy.handleClientMessage(data);
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
      proxy.disconnect();
    });

    ws.on('error', (err) => {
      console.error('[WS] WebSocket error:', err);
      proxy.disconnect();
    });
  });

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Network: http://192.168.4.228:${port}`);
      console.log(`> WebSocket: ws://${hostname}:${port}/ws/gemini-live`);
    });
});
