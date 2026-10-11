import { Server } from 'socket.io';
import { SOCKET_EVENTS } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import { DriverService } from '../services/driver.service.js';

let io = null;
const userSockets = new Map(); // userId -> socketId
const driverSockets = new Map(); // driverId -> socketId

export function initSocketServer(httpServer, clientUrl = '*') {
  io = new Server(httpServer, {
    cors: {
      origin: clientUrl || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 Socket connected: ${socket.id}`);

    // Join Rider Room
    socket.on(SOCKET_EVENTS.JOIN_USER_ROOM, ({ userId }) => {
      if (userId) {
        socket.join(`user:${userId}`);
        userSockets.set(userId, socket.id);
        logger.debug(`User joined private room: user:${userId}`);
      }
    });

    // Join Driver Room & Driver Dispatch Pool
    socket.on(SOCKET_EVENTS.JOIN_DRIVER_ROOM, ({ driverId }) => {
      if (driverId) {
        socket.join(`driver:${driverId}`);
        socket.join('drivers_pool');
        driverSockets.set(driverId, socket.id);
        logger.debug(`Driver joined dispatch pool: driver:${driverId}`);
      }
    });

    // Live GPS Location Updates from Driver App
    socket.on(
      SOCKET_EVENTS.DRIVER_LOCATION_UPDATE,
      async ({ driverId, latitude, longitude, heading = 0, activeRideId = null }) => {
        try {
          if (driverId && latitude && longitude) {
            // Update in database / store
            await DriverService.updateLocation(driverId, { latitude, longitude, heading });

            // If driver has an ongoing ride, broadcast position directly to the rider
            if (activeRideId) {
              io.to(`ride:${activeRideId}`).emit(SOCKET_EVENTS.RIDE_TRACK_LOCATION, {
                driverId,
                latitude,
                longitude,
                heading,
                timestamp: Date.now()
              });
            }
          }
        } catch (err) {
          logger.error('Error handling driver location update:', err.message);
        }
      }
    );

    // Join Specific Active Ride Room (for both Rider and Driver)
    socket.on('ride:join_room', ({ rideId }) => {
      if (rideId) {
        socket.join(`ride:${rideId}`);
        logger.debug(`Socket joined ride room: ride:${rideId}`);
      }
    });

    // Leave Ride Room
    socket.on('ride:leave_room', ({ rideId }) => {
      if (rideId) {
        socket.leave(`ride:${rideId}`);
      }
    });

    // Disconnect Cleanup
    socket.on('disconnect', () => {
      for (const [userId, sockId] of userSockets.entries()) {
        if (sockId === socket.id) userSockets.delete(userId);
      }
      for (const [driverId, sockId] of driverSockets.entries()) {
        if (sockId === socket.id) driverSockets.delete(driverId);
      }
      logger.info(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  return io;
}

export function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

export function emitToDriver(driverId, event, data) {
  if (io) {
    io.to(`driver:${driverId}`).emit(event, data);
  }
}

export function broadcastToDrivers(event, data) {
  if (io) {
    io.to('drivers_pool').emit(event, data);
  }
}

export function broadcastToAll(event, data) {
  if (io) {
    io.emit(event, data);
  }
}
