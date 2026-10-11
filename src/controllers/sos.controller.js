import { SosService } from '../services/sos.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export class SosController {
  static async triggerSos(req, res, next) {
    try {
      const alert = await SosService.triggerSos({
        userId: req.user.id,
        ...req.body
      });
      return ApiResponse.created(res, alert, 'Emergency SOS triggered! Authorities and contacts alerted.');
    } catch (err) {
      next(err);
    }
  }

  static async resolveSos(req, res, next) {
    try {
      const { alertId, notes } = req.body;
      const resolved = await SosService.resolveSos(alertId, notes);
      return ApiResponse.success(res, resolved, 'Emergency SOS alert resolved');
    } catch (err) {
      next(err);
    }
  }

  static async getActiveAlerts(req, res, next) {
    try {
      const alerts = await SosService.getActiveAlerts();
      return ApiResponse.success(res, alerts, 'Active SOS alerts fetched');
    } catch (err) {
      next(err);
    }
  }
}
