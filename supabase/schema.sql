-- ==============================================================================
-- CAB BOOKING / UBER CLONE - COMPREHENSIVE SUPABASE POSTGRESQL SCHEMA
-- Designed for Enterprise Full-Stack Scalability
-- Compatible with Supabase SQL Editor and Direct Postgres Connections
-- ==============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- ENUMS
-- ==============================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('rider', 'driver', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ride_status AS ENUM (
        'REQUESTED',
        'SEARCHING',
        'ACCEPTED',
        'ARRIVING',
        'ARRIVED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'PENDING',
        'PROCESSING',
        'SUCCEEDED',
        'FAILED',
        'REFUNDED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM ('card', 'stripe', 'cash', 'wallet');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sos_status AS ENUM ('TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ticket_category AS ENUM (
        'PAYMENT_ISSUE',
        'LOST_ITEM',
        'DRIVER_BEHAVIOR',
        'APP_BUG',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 1. USERS TABLE
-- Stores both riders and driver accounts (syncs seamlessly with Clerk or Supabase Auth)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY, -- Supports Clerk user_xxx ID or Supabase UUID
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'rider',
    stripe_customer_id TEXT,
    rating NUMERIC(3, 2) DEFAULT 5.00 CHECK (rating >= 1.00 AND rating <= 5.00),
    total_ratings INT DEFAULT 0,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. VEHICLE TYPES / TIERS TABLE
-- Defines vehicle tiers (UberX, Comfort, UberXL, Black, etc.) & fare formulas
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_types (
    id TEXT PRIMARY KEY, -- e.g. 'economy', 'comfort', 'xl', 'black'
    name TEXT NOT NULL,
    description TEXT,
    capacity INT NOT NULL DEFAULT 4,
    base_fare NUMERIC(10, 2) NOT NULL DEFAULT 2.50,
    per_km_rate NUMERIC(10, 2) NOT NULL DEFAULT 1.50,
    per_minute_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.35,
    minimum_fare NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    cancellation_fee NUMERIC(10, 2) NOT NULL DEFAULT 3.00,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. DRIVER PROFILES TABLE
-- Dedicated details for registered drivers, vehicle specs, and live coordinates
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.driver_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    vehicle_type_id TEXT NOT NULL REFERENCES public.vehicle_types(id),
    vehicle_make TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    vehicle_year INT NOT NULL,
    license_plate TEXT UNIQUE NOT NULL,
    vehicle_color TEXT NOT NULL,
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION,
    heading DOUBLE PRECISION DEFAULT 0.0,
    is_online BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    rating NUMERIC(3, 2) DEFAULT 5.00 CHECK (rating >= 1.00 AND rating <= 5.00),
    total_rides INT DEFAULT 0,
    total_earnings NUMERIC(12, 2) DEFAULT 0.00,
    stripe_account_id TEXT, -- Stripe Connect account for payouts
    last_location_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. PROMO CODES TABLE
-- Discounts and promotional campaigns
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_percentage NUMERIC(5, 2) NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
    max_discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
    min_ride_fare NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,
    usage_limit INT DEFAULT 1000,
    times_used INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. RIDES TABLE
-- Central ride entity tracking lifecycle, routing, coordinates, multi-stops, and pricing
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id TEXT NOT NULL REFERENCES public.users(id),
    driver_id UUID REFERENCES public.driver_profiles(id),
    vehicle_type_id TEXT NOT NULL REFERENCES public.vehicle_types(id),
    status ride_status NOT NULL DEFAULT 'REQUESTED',
    
    pickup_address TEXT NOT NULL,
    pickup_latitude DOUBLE PRECISION NOT NULL,
    pickup_longitude DOUBLE PRECISION NOT NULL,
    
    dropoff_address TEXT NOT NULL,
    dropoff_latitude DOUBLE PRECISION NOT NULL,
    dropoff_longitude DOUBLE PRECISION NOT NULL,
    
    stops JSONB DEFAULT '[]'::jsonb, -- Array of [{address, lat, lng, stop_order}]
    
    distance_km NUMERIC(8, 2) NOT NULL,
    duration_min INT NOT NULL,
    base_fare NUMERIC(10, 2) NOT NULL,
    distance_fare NUMERIC(10, 2) NOT NULL,
    time_fare NUMERIC(10, 2) NOT NULL,
    surge_multiplier NUMERIC(3, 2) DEFAULT 1.00,
    estimated_fare NUMERIC(10, 2) NOT NULL,
    promo_code_id UUID REFERENCES public.promo_codes(id),
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    final_fare NUMERIC(10, 2),
    
    otp VARCHAR(6), -- 4 or 6 digit ride start OTP
    cancellation_reason TEXT,
    cancelled_by TEXT, -- 'rider' | 'driver' | 'system'
    cancellation_fee NUMERIC(10, 2) DEFAULT 0.00,
    
    accepted_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. PAYMENTS TABLE
-- Stripe integration tracking payment intents, charges, fees, and receipts
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
    rider_id TEXT NOT NULL REFERENCES public.users(id),
    driver_id UUID REFERENCES public.driver_profiles(id),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method payment_method_type NOT NULL DEFAULT 'stripe',
    status payment_status NOT NULL DEFAULT 'PENDING',
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_charge_id TEXT,
    receipt_url TEXT,
    platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    driver_earnings NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. REVIEWS & RATINGS TABLE
-- Two-way ratings: rider rates driver, and driver rates rider
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
    reviewer_id TEXT NOT NULL REFERENCES public.users(id),
    reviewee_id TEXT NOT NULL REFERENCES public.users(id),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8. EMERGENCY SOS ALERTS TABLE
-- Instant security feature broadcasting location and notifying emergency response
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.emergency_sos_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES public.rides(id),
    user_id TEXT NOT NULL REFERENCES public.users(id),
    current_latitude DOUBLE PRECISION NOT NULL,
    current_longitude DOUBLE PRECISION NOT NULL,
    status sos_status NOT NULL DEFAULT 'TRIGGERED',
    notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. SUPPORT TICKETS TABLE
-- Help center and customer support management
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id),
    ride_id UUID REFERENCES public.rides(id),
    category ticket_category NOT NULL DEFAULT 'OTHER',
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status ticket_status NOT NULL DEFAULT 'OPEN',
    priority ticket_priority NOT NULL DEFAULT 'MEDIUM',
    admin_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

CREATE INDEX IF NOT EXISTS idx_driver_profiles_location 
ON public.driver_profiles(is_online, is_available, current_latitude, current_longitude);

CREATE INDEX IF NOT EXISTS idx_rides_rider_id ON public.rides(rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON public.rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON public.rides(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_ride_id ON public.payments(ride_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON public.payments(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_reviews_ride_id ON public.reviews(ride_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON public.reviews(reviewee_id);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_sos_status ON public.emergency_sos_alerts(status);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.support_tickets(user_id);

-- ==============================================================================
-- AUTOMATIC UPDATED_AT TRIGGER FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_users_timestamp
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE OR REPLACE TRIGGER set_driver_profiles_timestamp
    BEFORE UPDATE ON public.driver_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE OR REPLACE TRIGGER set_rides_timestamp
    BEFORE UPDATE ON public.rides
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE OR REPLACE TRIGGER set_payments_timestamp
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE OR REPLACE TRIGGER set_support_tickets_timestamp
    BEFORE UPDATE ON public.support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

-- ==============================================================================
-- HAVERSINE DISTANCE SQL HELPER (Returns distance in Kilometers)
-- Useful for SQL-side spatial lookups
-- ==============================================================================
CREATE OR REPLACE FUNCTION calculate_distance_km(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    r DOUBLE PRECISION := 6371; -- Earth radius in KM
    dlat DOUBLE PRECISION;
    dlon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat / 2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2)^2;
    c := 2 * atan2(sqrt(a), sqrt(1 - a));
    RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
