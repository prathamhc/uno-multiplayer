"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const socket_events_1 = require("./events/socket.events");
const PORT = process.env.PORT || 3000;
// Resolve project root — works for both ts-node (src/) and compiled (dist/server/src/)
const projectRoot = __dirname.includes('dist')
    ? path_1.default.resolve(__dirname, '..', '..', '..') // dist/server/src → project root
    : path_1.default.resolve(__dirname, '..', '..'); // server/src → project root
const clientDir = path_1.default.join(projectRoot, 'client');
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Socket.io with CORS for production & development
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});
// Serve static client files
app.use(express_1.default.static(clientDir));
app.use(express_1.default.json());
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});
// Serve client for all non-API routes (SPA)
app.get('*', (_req, res) => {
    res.sendFile(path_1.default.join(clientDir, 'index.html'));
});
// Register socket events
(0, socket_events_1.registerSocketEvents)(io);
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
//# sourceMappingURL=app.js.map