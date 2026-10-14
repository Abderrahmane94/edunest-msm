import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app';
import { socketService } from './services/socket.service';

const PORT = process.env.PORT || 3000;

// Create HTTP server from Express app
const server = http.createServer(app);

// Initialize Socket.io on the HTTP server
socketService.initialize(server);

server.listen(PORT, () => {
  console.log(`[Kiddoo] Server running at http://localhost:${PORT}`);
  console.log(`[Kiddoo] Health check: http://localhost:${PORT}/health`);
  console.log(`[Kiddoo] Socket.io ready for connections`);
});
