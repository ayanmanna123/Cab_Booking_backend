import http from 'http';
import app from './app.js';
import { ENV } from './config/env.js';
import { initSocketServer } from './sockets/socketManager.js';
import { logger } from './utils/logger.js';

const server = http.createServer(app);

// Initialize Socket.io real-time engine
initSocketServer(server, ENV.CLIENT_URL);

// Start HTTP + WebSocket Server
server.listen(ENV.PORT, () => {
  logger.info(`=======================================================`);
  logger.info(`🚀 Cab Booking / Uber Clone Backend Server is RUNNING`);
  logger.info(`📡 Port: ${ENV.PORT}`);
  logger.info(`🌍 Environment: ${ENV.NODE_ENV}`);
  logger.info(`🔗 Base URL: http://localhost:${ENV.PORT}`);
  logger.info(`🏥 Health Check: http://localhost:${ENV.PORT}/api/v1/health`);
  logger.info(`⚡ WebSockets: ws://localhost:${ENV.PORT}`);
  logger.info(`=======================================================`);
});

// Graceful shutdown handling
const handleGracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP & WebSocket server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forcefully terminating process after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
