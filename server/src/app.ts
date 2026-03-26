import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { registerSocketEvents } from './events/socket.events';

const PORT = process.env.PORT || 3000;

// Resolve project root — works for both ts-node (src/) and compiled (dist/server/src/)
const projectRoot = __dirname.includes('dist')
  ? path.resolve(__dirname, '..', '..', '..')   // dist/server/src → project root
  : path.resolve(__dirname, '..', '..');         // server/src → project root

const clientDir = path.join(projectRoot, 'client');

const app = express();
const server = http.createServer(app);

// Socket.io with CORS for production & development
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Serve static client files
app.use(express.static(clientDir));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Serve client for all non-API routes (SPA)
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Register socket events
registerSocketEvents(io);

// Start server (no MongoDB needed — using in-memory storage)
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║         🃏  UNO Multiplayer Server  🃏       ║
  ║──────────────────────────────────────────────║
  ║  Server running on http://localhost:${PORT}     ║
  ║  Open in multiple tabs to play!              ║
  ╚══════════════════════════════════════════════╝
  `);
});
