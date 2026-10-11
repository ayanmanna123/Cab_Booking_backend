import { createClient } from '@supabase/supabase-js';
import { ENV } from './env.js';

let supabaseClient = null;
let supabaseAdminClient = null;

const isValidUrl = (url) => {
  try {
    return Boolean(new URL(url));
  } catch {
    return false;
  }
};

if (ENV.SUPABASE_URL && isValidUrl(ENV.SUPABASE_URL) && ENV.SUPABASE_ANON_KEY) {
  try {
    supabaseClient = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
    
    // Service role client bypasses RLS for administrative and server-to-server operations
    const serviceKey = ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY;
    supabaseAdminClient = createClient(ENV.SUPABASE_URL, serviceKey);

    console.log('✅ Supabase client initialized successfully.');
  } catch (err) {
    console.warn('⚠️ Supabase client initialization warning:', err.message);
  }
} else {
  console.warn('ℹ️ Running in Supabase Mock/Placeholder mode. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env for live database.');
}

export const supabase = supabaseClient;
export const supabaseAdmin = supabaseAdminClient || supabaseClient;
