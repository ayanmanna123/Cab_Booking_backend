import { ApiResponse } from '../utils/apiResponse.js';

export const validateRequest = (schema, source = 'body') => {
  return async (req, res, next) => {
    try {
      const dataToValidate = req[source];
      const parsed = await schema.parseAsync(dataToValidate);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err.errors) {
        const formattedErrors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return ApiResponse.badRequest(res, 'Validation failed', formattedErrors);
      }
      return ApiResponse.badRequest(res, err.message || 'Invalid request payload');
    }
  };
};
