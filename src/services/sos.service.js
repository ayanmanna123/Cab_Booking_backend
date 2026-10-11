import crypto from 'crypto';
import { supabaseAdmin, supabase } from '../config/supabase.js';
import { SOS_STATUS, SOCKET_EVENTS, DB_TABLES } from '../config/constants.js';
import { broadcastToAll } from '../sockets/socketManager.js';
import { logger } from '../utils/logger.js';

const memorySos = new Map();

export class SosService {
  static getClient() {
    return supabaseAdmin || supabase;
  }

  static async triggerSos({ userId, rideId, latitude, longitude, notes = '' }) {
    logger.warn(`🚨 EMERGENCY SOS TRIGGERED by user ${userId} at [${latitude}, ${longitude}]!`);

    const payload = {
      user_id: userId,
      ride_id: rideId || null,
      current_latitude: latitude,
      current_longitude: longitude,
      status: SOS_STATUS.TRIGGERED,
      notes: notes || 'Emergency SOS triggered from rider app',
      created_at: new Date().toISOString()
    };

    const client = this.getClient();
    let alertRecord = null;

    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.EMERGENCY_SOS_ALERTS)
        .insert(payload)
        .select(`*, ${DB_TABLES.USERS}(full_name, phone, emergency_contact_name, emergency_contact_phone)`)
        .single();

      if (error) throw new Error(error.message);
      alertRecord = data;
    } else {
      const id = crypto.randomUUID();
      alertRecord = { id, ...payload };
      memorySos.set(id, alertRecord);
    }

    // Broadcast urgent SOS alert across socket channels
    broadcastToAll(SOCKET_EVENTS.SOS_ALERT_BROADCAST, {
      alert: alertRecord,
      timestamp: new Date().toISOString()
    });

    return alertRecord;
  }

  static async resolveSos(alertId, notes = '') {
    const updates = {
      status: SOS_STATUS.RESOLVED,
      notes: notes || 'Resolved by emergency dispatch',
      resolved_at: new Date().toISOString()
    };

    const client = this.getClient();
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.EMERGENCY_SOS_ALERTS)
        .update(updates)
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }

    const alert = memorySos.get(alertId);
    if (alert) {
      Object.assign(alert, updates);
      return alert;
    }
    return null;
  }

  static async getActiveAlerts() {
    const client = this.getClient();
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.EMERGENCY_SOS_ALERTS)
        .select(`*, ${DB_TABLES.USERS}(full_name, phone, emergency_contact_name, emergency_contact_phone)`)
        .eq('status', SOS_STATUS.TRIGGERED)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    }

    return Array.from(memorySos.values()).filter((a) => a.status === SOS_STATUS.TRIGGERED);
  }
}
