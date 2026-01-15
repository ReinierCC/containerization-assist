// Simple Express server for build testing
// Demonstrates a minimal Node.js application
const http = require('http');

const PORT = process.env.PORT || 8080;
const APP_NAME = process.env.APP_NAME || 'node-app';
const VERSION = process.env.VERSION || '1.0.0';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', app: APP_NAME, version: VERSION }));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: `Hello from ${APP_NAME}!`, version: VERSION }));
  }
});

server.listen(PORT, () => {
  console.log(`${APP_NAME} v${VERSION} running on port ${PORT}`);
});
