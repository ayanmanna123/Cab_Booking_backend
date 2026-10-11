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

    // 1. Extract potential custom Clerk / client user headers
    const headerUserId = req.headers['x-user-id'];
    const headerUserEmail = req.headers['x-user-email'];
    const headerUserName = req.headers['x-user-name'];
    const headerUserPhone = req.headers['x-user-phone'];
    const headerUserAvatar = req.headers['x-user-avatar'];

    // 2. Attempt decoding JWT (Clerk, Supabase, or Custom JWT)
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

    // Header userId takes precedence over fallback token strings
    if (headerUserId) {
      userId = headerUserId;
    } else if (!userId && token && token !== 'rider_official_user') {
      userId = token;
      userEmail = `${token}@uberclone.local`;
    } else if (!userId && token === 'rider_official_user') {
      userId = 'rider_official_user';
    }

    if (headerUserEmail) {
      userEmail = headerUserEmail;
    }

    if (!userId) {
      return ApiResponse.unauthorized(res, 'Unable to extract valid user from token');
    }

    // 3. Fetch or sync user from Supabase database if available
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

        // If client sent real user details that differ from DB placeholder, update them
        if (headerUserName || headerUserEmail || headerUserPhone || headerUserAvatar) {
          const updateData = {};
          if (headerUserName && headerUserName !== 'Uber Rider' && dbUser.full_name !== headerUserName) {
            updateData.full_name = headerUserName;
          }
          if (headerUserEmail && !headerUserEmail.endsWith('@uberclone.local') && dbUser.email !== headerUserEmail) {
            updateData.email = headerUserEmail;
          }
          if (headerUserPhone && dbUser.phone !== headerUserPhone) {
            updateData.phone = headerUserPhone;
          }
          if (headerUserAvatar && dbUser.avatar_url !== headerUserAvatar) {
            updateData.avatar_url = headerUserAvatar;
          }

          if (Object.keys(updateData).length > 0) {
            updateData.updated_at = new Date().toISOString();
            const { data: updated } = await client
              .from(DB_TABLES.USERS)
              .update(updateData)
              .eq('id', userId)
              .select()
              .maybeSingle();
            if (updated) dbUser = updated;
          }
        }
      } else {
        // Auto-provision user in cb_users with real profile data
        const effectiveName = headerUserName || 'Uber Rider';
        const sanitizedEmail = userEmail || `${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}@uberclone.local`;
        const { data: createdUser, error: createErr } = await client
          .from(DB_TABLES.USERS)
          .upsert({
            id: userId,
            email: sanitizedEmail,
            full_name: effectiveName,
            phone: headerUserPhone || null,
            avatar_url: headerUserAvatar || null,
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
      fullName: dbUser?.full_name || headerUserName || 'Uber Rider',
      role: dbUser?.role || userRole,
      phone: dbUser?.phone || headerUserPhone || null,
      rating: dbUser?.rating || 5.0,
      avatarUrl: dbUser?.avatar_url || headerUserAvatar || null,
      rawDbUser: dbUser
    };

    next();
  } catch (error) {
    return ApiResponse.unauthorized(res, `Authentication error: ${error.message}`);
  }
};
