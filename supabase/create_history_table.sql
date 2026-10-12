-- ==============================================================================
-- CAB BOOKING / UBER CLONE - RIDE HISTORY TABLE MIGRATION
-- Table name: public.cb_ride_history
-- Purpose: Dedicated standalone table for completed and running ride history
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create cb_ride_history table
CREATE TABLE IF NOT EXISTS public.cb_ride_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id TEXT NOT NULL,
    rider_id TEXT NOT NULL,
    rider_name TEXT,
    rider_phone TEXT,
    driver_id TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    driver_avatar TEXT,
    driver_rating NUMERIC(3, 2) DEFAULT 4.90,
    vehicle_type_id TEXT,
    vehicle_name TEXT,
    vehicle_model TEXT,
    vehicle_plate TEXT,
    status TEXT NOT NULL DEFAULT 'REQUESTED',
    
    pickup_address TEXT NOT NULL,
    pickup_latitude DOUBLE PRECISION,
    pickup_longitude DOUBLE PRECISION,
    
    dropoff_address TEXT NOT NULL,
    dropoff_latitude DOUBLE PRECISION,
    dropoff_longitude DOUBLE PRECISION,
    
    stops JSONB DEFAULT '[]'::jsonb,
    
    distance_km NUMERIC(8, 2) DEFAULT 0.00,
    duration_min INT DEFAULT 0,
    base_fare NUMERIC(10, 2) DEFAULT 0.00,
    distance_fare NUMERIC(10, 2) DEFAULT 0.00,
    time_fare NUMERIC(10, 2) DEFAULT 0.00,
    surge_multiplier NUMERIC(3, 2) DEFAULT 1.00,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    final_fare NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    
    otp VARCHAR(6),
    payment_method TEXT DEFAULT 'cash',
    payment_status TEXT DEFAULT 'PENDING',
    receipt_url TEXT,
    
    cancellation_reason TEXT,
    cancelled_by TEXT,
    
    accepted_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning fast searches and queries
CREATE INDEX IF NOT EXISTS idx_cb_ride_history_rider_id ON public.cb_ride_history(rider_id);
CREATE INDEX IF NOT EXISTS idx_cb_ride_history_driver_id ON public.cb_ride_history(driver_id);
CREATE INDEX IF NOT EXISTS idx_cb_ride_history_status ON public.cb_ride_history(status);
CREATE INDEX IF NOT EXISTS idx_cb_ride_history_ride_id ON public.cb_ride_history(ride_id);
CREATE INDEX IF NOT EXISTS idx_cb_ride_history_created_at ON public.cb_ride_history(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.cb_ride_history ENABLE ROW LEVEL SECURITY;

-- Allow public read access (or authenticated users access)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow select for all users" ON public.cb_ride_history;
    CREATE POLICY "Allow select for all users" ON public.cb_ride_history FOR SELECT USING (true);
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- Allow service role and authenticated users insert and update access
DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow insert for all users" ON public.cb_ride_history;
    CREATE POLICY "Allow insert for all users" ON public.cb_ride_history FOR INSERT WITH CHECK (true);
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow update for all users" ON public.cb_ride_history;
    CREATE POLICY "Allow update for all users" ON public.cb_ride_history FOR UPDATE USING (true);
EXCEPTION
    WHEN undefined_object THEN null;
END $$;
