import { PaymentService } from '../services/payment.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export class PaymentController {
  static async createPaymentIntent(req, res, next) {
    try {
      const result = await PaymentService.createPaymentIntent({
        rideId: req.body.rideId,
        riderId: req.user.id,
        paymentMethod: req.body.paymentMethod
      });
      return ApiResponse.success(res, result, 'Payment intent created successfully');
    } catch (err) {
      next(err);
    }
  }

  static async confirmPayment(req, res, next) {
    try {
      const payment = await PaymentService.confirmPayment(req.body);
      return ApiResponse.success(res, payment, 'Payment confirmed successfully');
    } catch (err) {
      next(err);
    }
  }

  static async getReceipt(req, res, next) {
    try {
      const { rideId } = req.params;
      const receipt = await PaymentService.getRideReceipt(rideId);
      if (!receipt) {
        return ApiResponse.notFound(res, 'Receipt not found for this ride');
      }
      return ApiResponse.success(res, receipt, 'Ride receipt fetched');
    } catch (err) {
      next(err);
    }
  }
}
