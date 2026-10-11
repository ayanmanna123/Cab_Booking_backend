import { RideService } from '../services/ride.service.js';
import { DriverService } from '../services/driver.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export class RideController {
  static async requestRide(req, res, next) {
    try {
      const ride = await RideService.requestRide(req.user.id, req.body);
      return ApiResponse.created(res, ride, 'Ride requested successfully. Searching for nearby drivers.');
    } catch (err) {
      next(err);
    }
  }

  static async getRideDetails(req, res, next) {
    try {
      const { rideId } = req.params;
      const ride = await RideService.getRideById(rideId);
      if (!ride) {
        return ApiResponse.notFound(res, 'Ride not found');
      }
      return ApiResponse.success(res, ride, 'Ride details fetched');
    } catch (err) {
      next(err);
    }
  }

  static async getActiveRide(req, res, next) {
    try {
      if (req.user.role === 'driver') {
        const driver = await DriverService.getDriverByUserId(req.user.id);
        if (driver) {
          const activeRide = await RideService.getActiveRideForDriver(driver.id);
          return ApiResponse.success(res, activeRide, 'Active ride for driver fetched');
        }
      }

      const activeRide = await RideService.getActiveRideForUser(req.user.id);
      return ApiResponse.success(res, activeRide, 'Active ride for user fetched');
    } catch (err) {
      next(err);
    }
  }

  static async acceptRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const driver = await DriverService.getDriverByUserId(req.user.id);
      if (!driver) {
        return ApiResponse.forbidden(res, 'Only registered drivers can accept ride requests');
      }

      const acceptedRide = await RideService.acceptRide(rideId, driver.id);
      return ApiResponse.success(res, acceptedRide, 'Ride accepted successfully');
    } catch (err) {
      next(err);
    }
  }

  static async updateRideStatus(req, res, next) {
    try {
      const { rideId } = req.params;
      const { status, otp } = req.body;

      let driverId = null;
      if (req.user.role === 'driver') {
        const driver = await DriverService.getDriverByUserId(req.user.id);
        driverId = driver?.id;
      }

      const updatedRide = await RideService.updateRideStatus(rideId, status, { otp, driverId });
      return ApiResponse.success(res, updatedRide, `Ride status updated to ${status}`);
    } catch (err) {
      next(err);
    }
  }

  static async cancelRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const { reason } = req.body;
      const cancelled = await RideService.cancelRide(rideId, req.user.role, reason);
      return ApiResponse.success(res, cancelled, 'Ride cancelled successfully');
    } catch (err) {
      next(err);
    }
  }

  static async getRiderHistory(req, res, next) {
    try {
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;
      const history = await RideService.getRiderHistory(req.user.id, limit, offset);
      return ApiResponse.success(res, history, 'Rider ride history retrieved');
    } catch (err) {
      next(err);
    }
  }

  static async getDriverHistory(req, res, next) {
    try {
      const driver = await DriverService.getDriverByUserId(req.user.id);
      if (!driver) {
        return ApiResponse.forbidden(res, 'Driver profile required to access driver history');
      }

      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;
      const history = await RideService.getDriverHistory(driver.id, limit, offset);
      return ApiResponse.success(res, history, 'Driver ride history retrieved');
    } catch (err) {
      next(err);
    }
  }
}
