import { supabaseAdmin, supabase } from '../config/supabase.js';
import { DB_TABLES } from '../config/constants.js';
import { logger } from '../utils/logger.js';

// In-memory fallback cache for development/demo when Supabase credentials aren't live
const memoryUsers = new Map();

export class UserService {
  static getClient() {
    return supabaseAdmin || supabase;
  }

  static async syncUser({ id, email, fullName, phone, avatarUrl, role = 'rider' }) {
    const client = this.getClient();
    const effectiveEmail = email || `${id.replace(/[^a-zA-Z0-9_-]/g, '_')}@uberclone.local`;
    const userData = {
      id,
      email: effectiveEmail,
      full_name: fullName || 'Uber User',
      phone: phone || null,
      avatar_url: avatarUrl || null,
      role: role || 'rider',
      updated_at: new Date().toISOString()
    };

    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.USERS)
        .upsert(userData, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        logger.error('Error syncing user with Supabase:', error);
        throw new Error(`Failed to sync user: ${error.message}`);
      }
      return data;
    }

    // In-memory fallback
    const existing = memoryUsers.get(id) || {
      rating: 5.0,
      total_ratings: 0,
      is_active: true,
      created_at: new Date().toISOString()
    };
    const saved = { ...existing, ...userData };
    memoryUsers.set(id, saved);
    return saved;
  }

  static async getUserById(userId) {
    const client = this.getClient();
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.USERS)
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching user by ID:', error);
        throw new Error(error.message);
      }
      return data;
    }

    return memoryUsers.get(userId) || null;
  }

  static async updateProfile(userId, updateData) {
    const client = this.getClient();
    const payload = {};

    if (updateData.fullName) payload.full_name = updateData.fullName;
    if (updateData.phone) payload.phone = updateData.phone;
    if (updateData.avatarUrl !== undefined) payload.avatar_url = updateData.avatarUrl;
    if (updateData.emergencyContactName) payload.emergency_contact_name = updateData.emergencyContactName;
    if (updateData.emergencyContactPhone) payload.emergency_contact_phone = updateData.emergencyContactPhone;
    payload.updated_at = new Date().toISOString();

    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.USERS)
        .update(payload)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating user profile:', error);
        throw new Error(error.message);
      }
      return data;
    }

    const current = memoryUsers.get(userId) || { id: userId, email: `${userId}@example.com` };
    const updated = { ...current, ...payload };
    memoryUsers.set(userId, updated);
    return updated;
  }
}
