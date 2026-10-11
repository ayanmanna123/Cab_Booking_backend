import { DriverService } from '../services/driver.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export class DriverController {
  static async registerDriver(req, res, next) {
    try {
      const driver = await DriverService.registerDriver(req.user.id, req.body);
      return ApiResponse.created(res, driver, 'Driver registered successfully');
    } catch (err) {
      next(err);
    }
  }

  static async getMyProfile(req, res, next) {
    try {
      const driver = await DriverService.getDriverByUserId(req.user.id);
      if (!driver) {
        return ApiResponse.notFound(res, 'Driver profile not registered for this account');
      }
      return ApiResponse.success(res, driver, 'Driver profile fetched');
    } catch (err) {
      next(err);
    }
  }

  static async updateLocation(req, res, next) {
    try {
      const driver = await DriverService.getDriverByUserId(req.user.id);
      if (!driver) {
        return ApiResponse.notFound(res, 'Driver profile not found');
      }

      const updated = await DriverService.updateLocation(driver.id, req.body);
      return ApiResponse.success(res, updated, 'Location updated successfully');
    } catch (err) {
      next(err);
    }
  }

  static async toggleOnlineStatus(req, res, next) {
    try {
      const driver = await DriverService.getDriverByUserId(req.user.id);
      if (!driver) {
        return ApiResponse.notFound(res, 'Driver profile not found');
      }

      const updated = await DriverService.toggleOnlineStatus(driver.id, req.body.isOnline);
      return ApiResponse.success(res, updated, `Driver is now ${req.body.isOnline ? 'ONLINE' : 'OFFLINE'}`);
    } catch (err) {
      next(err);
    }
  }

  static async getNearbyDrivers(req, res, next) {
    try {
      const { latitude, longitude, vehicleType, radiusKm } = req.query;
      const lat = Number(latitude) || 37.7749;
      const lng = Number(longitude) || -122.4194;
      const drivers = await DriverService.getNearbyDrivers({
        latitude: lat,
        longitude: lng,
        vehicleType,
        radiusKm: radiusKm ? Number(radiusKm) : 15
      });
      return ApiResponse.success(res, drivers || [], 'Nearby drivers retrieved');
    } catch (err) {
      next(err);
    }
  }

  static async getDashboard(req, res, next) {
    try {
      const driver = await DriverService.getDriverByUserId(req.user.id);
      if (!driver) {
        return ApiResponse.notFound(res, 'Driver profile not found');
      }

      const dashboard = await DriverService.getDriverDashboard(driver.id);
      return ApiResponse.success(res, dashboard, 'Driver dashboard statistics fetched');
    } catch (err) {
      next(err);
    }
  }
}
