import { UserService } from '../services/user.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export class AuthController {
  static async syncUser(req, res, next) {
    try {
      const user = await UserService.syncUser(req.body);
      return ApiResponse.success(res, user, 'User synced successfully');
    } catch (err) {
      next(err);
    }
  }

  static async getMe(req, res, next) {
    try {
      const user = await UserService.getUserById(req.user.id);
      return ApiResponse.success(res, user || req.user, 'Current user profile fetched');
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const updated = await UserService.updateProfile(req.user.id, req.body);
      return ApiResponse.success(res, updated, 'Profile updated successfully');
    } catch (err) {
      next(err);
    }
  }
}
