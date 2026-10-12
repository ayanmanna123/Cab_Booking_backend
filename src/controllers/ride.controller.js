import { RideService } from '../services/ride.service.js';
import { DriverService } from '../services/driver.service.js';
import { FareService } from '../services/fare.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export class RideController {
  /**
   * Estimate fare across all vehicle tiers
   */
  static async estimateFare(req, res, next) {
    try {
      const estimate = await FareService.estimateFares(req.body);
      return ApiResponse.success(res, estimate, 'Fare estimates calculated');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Request / create a ride
   */
  static async requestRide(req, res, next) {
    try {
      const ride = await RideService.requestRide(req.user.id, req.body);
      return ApiResponse.created(res, ride, 'Ride requested successfully. Searching for nearby drivers.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get details of a ride
   */
  static async getRideDetails(req, res, next) {
    try {
      const { rideId } = req.params;
      const ride = await RideService.getRideById(rideId, req.user.id, req.user.role);
      if (!ride) {
        return ApiResponse.notFound(res, 'Ride not found');
      }
      return ApiResponse.success(res, ride, 'Ride details fetched');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get active ongoing ride for authenticated user or driver
   */
  static async getActiveRide(req, res, next) {
    try {
      if (req.user.role === 'driver') {
        const driver = await DriverService.getDriverByUserId(req.user.id);
        if (driver) {
          const activeRide = await RideService.getActiveRideForDriver(driver.id);
          return ApiResponse.success(res, activeRide, 'Active ride for driver fetched');
        }
      }

      // Check if user has an active ride as rider
      const activeRide = await RideService.getActiveRideForUser(req.user.id);
      return ApiResponse.success(res, activeRide, 'Active ride for user fetched');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Accept a ride as driver
   */
  static async acceptRide(req, res, next) {
    try {
      const { rideId } = req.params;
      let driver = await DriverService.getDriverByUserId(req.user.id);
      if (!driver) {
        driver = await DriverService.getDriverById(req.user.id);
      }
      if (!driver) {
        driver = await DriverService.registerDriver(req.user.id, {
          fullName: req.user.fullName || req.headers['x-user-name'] || 'Driver Partner',
          phone: req.user.phone || req.headers['x-user-phone'] || '+91 98765 43210',
          vehicleMake: 'Toyota',
          vehicleModel: 'Camry',
          licensePlate: `MH ${Math.floor(10 + Math.random() * 89)} CZ ${Math.floor(1000 + Math.random() * 8999)}`,
          vehicleColor: 'Silver Metallic',
          vehicleTypeId: 'economy'
        });
      }

      const acceptedRide = await RideService.acceptRide(rideId, driver.id);
      return ApiResponse.success(res, acceptedRide, 'Ride accepted successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Reject a ride as driver
   */
  static async rejectRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const driver = await DriverService.getDriverByUserId(req.user.id);
      const driverId = driver ? driver.id : req.user.id;
      const result = await RideService.rejectRide(rideId, driverId);
      return ApiResponse.success(res, result, 'Ride rejected');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Mark arrival at pickup location
   */
  static async arriveRide(req, res, next) {
    try {
      const { rideId } = req.params;
      let driver = await DriverService.getDriverByUserId(req.user.id);
      if (!driver) {
        driver = await DriverService.getDriverById(req.user.id);
      }
      if (!driver) {
        driver = await DriverService.registerDriver(req.user.id, {
          fullName: req.user.fullName || req.headers['x-user-name'] || 'Driver Partner'
        });
      }

      const updatedRide = await RideService.arriveRide(rideId, driver.id);
      return ApiResponse.success(res, updatedRide, 'Marked arrived at pickup location');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Verify passenger PIN and start trip
   */
  static async verifyPin(req, res, next) {
    try {
      const { rideId } = req.params;
      const { pin, otp } = req.body;
      const submittedPin = pin || otp;

      if (!submittedPin) {
        return ApiResponse.badRequest(res, 'Ride PIN is required to start the trip');
      }

      let driver = await DriverService.getDriverByUserId(req.user.id);
      if (!driver) {
        driver = await DriverService.getDriverById(req.user.id);
      }
      if (!driver) {
        driver = await DriverService.registerDriver(req.user.id, {
          fullName: req.user.fullName || req.headers['x-user-name'] || 'Driver Partner'
        });
      }

      const updatedRide = await RideService.verifyPinAndStartTrip(rideId, driver.id, submittedPin);
      return ApiResponse.success(res, updatedRide, 'PIN verified successfully. Trip started.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Complete the ride
   */
  static async completeRide(req, res, next) {
    try {
      const { rideId } = req.params;
      let driver = await DriverService.getDriverByUserId(req.user.id);
      if (!driver) {
        driver = await DriverService.getDriverById(req.user.id);
      }
      if (!driver) {
        driver = await DriverService.registerDriver(req.user.id, {
          fullName: req.user.fullName || req.headers['x-user-name'] || 'Driver Partner'
        });
      }

      const completedRide = await RideService.completeRide(rideId, driver.id);
      return ApiResponse.success(res, completedRide, 'Ride completed successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update ride status (generic)
   */
  static async updateRideStatus(req, res, next) {
    try {
      const { rideId } = req.params;
      const { status, otp, pin } = req.body;

      let driverId = null;
      if (req.user.role === 'driver') {
        const driver = await DriverService.getDriverByUserId(req.user.id);
        driverId = driver?.id;
      }

      const updatedRide = await RideService.updateRideStatus(rideId, status, {
        otp: otp || pin,
        driverId
      });
      return ApiResponse.success(res, updatedRide, `Ride status updated to ${status}`);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cancel a ride
   */
  static async cancelRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const { reason } = req.body;
      const cancelled = await RideService.cancelRide(rideId, req.user.role, reason, req.user.id);
      return ApiResponse.success(res, cancelled, 'Ride cancelled successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Unified ride history endpoint
   */
  static async getRideHistory(req, res, next) {
    try {
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;

      if (req.user.role === 'driver') {
        const driver = await DriverService.getDriverByUserId(req.user.id);
        if (driver) {
          const history = await RideService.getDriverHistory(driver.id, limit, offset);
          return ApiResponse.success(res, history, 'Driver ride history retrieved');
        }
      }

      const history = await RideService.getRiderHistory(req.user.id, limit, offset);
      return ApiResponse.success(res, history, 'Rider ride history retrieved');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Dedicated rider history
   */
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

  /**
   * Dedicated driver history
   */
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
