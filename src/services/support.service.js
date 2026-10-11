import crypto from 'crypto';
import { supabaseAdmin, supabase } from '../config/supabase.js';
import { TICKET_STATUS, DB_TABLES } from '../config/constants.js';

const memoryTickets = new Map();

export class SupportService {
  static getClient() {
    return supabaseAdmin || supabase;
  }

  static async createTicket(userId, ticketData) {
    const payload = {
      user_id: userId,
      ride_id: ticketData.rideId || null,
      category: ticketData.category,
      subject: ticketData.subject,
      description: ticketData.description,
      priority: ticketData.priority || 'MEDIUM',
      status: TICKET_STATUS.OPEN,
      created_at: new Date().toISOString()
    };

    const client = this.getClient();
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.SUPPORT_TICKETS)
        .insert(payload)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }

    const id = crypto.randomUUID();
    const saved = { id, ...payload };
    memoryTickets.set(id, saved);
    return saved;
  }

  static async getUserTickets(userId) {
    const client = this.getClient();
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.SUPPORT_TICKETS)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    }

    return Array.from(memoryTickets.values()).filter((t) => t.user_id === userId);
  }

  static async updateTicketStatus(ticketId, status, adminNotes = '') {
    const updates = {
      status,
      admin_notes: adminNotes || null,
      updated_at: new Date().toISOString()
    };

    if (status === TICKET_STATUS.RESOLVED || status === TICKET_STATUS.CLOSED) {
      updates.resolved_at = new Date().toISOString();
    }

    const client = this.getClient();
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.SUPPORT_TICKETS)
        .update(updates)
        .eq('id', ticketId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }

    const ticket = memoryTickets.get(ticketId);
    if (ticket) {
      Object.assign(ticket, updates);
      return ticket;
    }
    return null;
  }
}
