import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import cron from 'node-cron';
import app from './app';
import { socketService } from './services/socket.service';
import { processOverdueInvoices } from './jobs/overdue-invoices.job';

const PORT = process.env.PORT || 3000;

// Create HTTP server from Express app
const server = http.createServer(app);

// Initialize Socket.io on the HTTP server
socketService.initialize(server);

// Schedule overdue invoices cron job — runs daily at midnight
cron.schedule('0 0 * * *', () => {
  processOverdueInvoices().catch((err) => {
    console.error('[CronJob] Overdue invoices job failed:', err);
  });
});

server.listen(PORT, () => {
  console.log(`[EduNest] Server running at http://localhost:${PORT}`);
  console.log(`[EduNest] Health check: http://localhost:${PORT}/health`);
  console.log(`[EduNest] Socket.io ready for connections`);
  console.log(`[EduNest] Cron jobs initialized (overdue invoices: daily at midnight)`);
});
