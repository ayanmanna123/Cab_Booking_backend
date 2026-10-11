import { FareService } from '../services/fare.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export class FareController {
  static async getVehicleTypes(req, res, next) {
    try {
      const types = await FareService.getVehicleTypes();
      return ApiResponse.success(res, types, 'Vehicle tiers fetched');
    } catch (err) {
      next(err);
    }
  }

  static async estimateFare(req, res, next) {
    try {
      const estimate = await FareService.estimateFares(req.body);
      return ApiResponse.success(res, estimate, 'Fare estimates calculated');
    } catch (err) {
      next(err);
    }
  }
}
