import { PromoService } from '../services/promo.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export class PromoController {
  static async validatePromo(req, res, next) {
    try {
      const { code, rideFare } = req.body;
      const result = await PromoService.validatePromo(code, rideFare);

      if (!result.valid) {
        return ApiResponse.badRequest(res, result.message);
      }

      return ApiResponse.success(res, result, 'Promo code applied successfully');
    } catch (err) {
      next(err);
    }
  }

  static async createPromo(req, res, next) {
    try {
      const promo = await PromoService.createPromo(req.body);
      return ApiResponse.created(res, promo, 'Promo code created successfully');
    } catch (err) {
      next(err);
    }
  }
}
