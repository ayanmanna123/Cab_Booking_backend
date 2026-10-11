import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { DB_TABLES } from '../config/constants.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.unauthorized(res, 'Authentication token missing or invalid');
    }

    const token = authHeader.split(' ')[1];

    let userId = null;
    let userEmail = null;
    let userRole = 'rider';

    // 1. Attempt decoding JWT (Clerk, Supabase, or Custom JWT)
    try {
      const decoded = jwt.decode(token);
      if (decoded) {
        userId = decoded.sub || decoded.id || decoded.user_id;
        userEmail = decoded.email || (decoded.user_metadata && decoded.user_metadata.email) || null;
        userRole = decoded.role || (decoded.user_metadata && decoded.user_metadata.role) || 'rider';
      }
    } catch (e) {
      // ignore decode failure, will try direct token matching
    }

    // Fallback: If token is a test user token (e.g. Bearer test-user-123 or rider_xxx)
    if (!userId && token) {
      userId = token;
      userEmail = `${token}@uberclone.local`;
    }

    if (!userId) {
      return ApiResponse.unauthorized(res, 'Unable to extract valid user from token');
    }

    // 2. Fetch or sync user from Supabase database if available
    let dbUser = null;
    const client = supabaseAdmin || supabase;
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.USERS)
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        dbUser = data;
        userRole = data.role;
      } else {
        // Auto-provision user in cb_users to satisfy foreign key constraints
        const sanitizedEmail = userEmail || `${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}@uberclone.local`;
        const { data: createdUser, error: createErr } = await client
          .from(DB_TABLES.USERS)
          .upsert({
            id: userId,
            email: sanitizedEmail,
            full_name: 'Uber Rider',
            role: userRole || 'rider',
            rating: 5.0,
            is_active: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' })
          .select()
          .maybeSingle();

        if (!createErr && createdUser) {
          dbUser = createdUser;
        }
      }
    }

    // Attach user profile to request
    req.user = {
      id: userId,
      email: dbUser?.email || userEmail,
      fullName: dbUser?.full_name || 'Uber Rider',
      role: dbUser?.role || userRole,
      phone: dbUser?.phone || null,
      rating: dbUser?.rating || 5.0,
      avatarUrl: dbUser?.avatar_url || null,
      rawDbUser: dbUser
    };

    next();
  } catch (error) {
    return ApiResponse.unauthorized(res, `Authentication error: ${error.message}`);
  }
};
