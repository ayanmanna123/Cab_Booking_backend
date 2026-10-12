-- ==============================================================================
-- MIGRATION: Add UPI Payment & Driver Payout Columns
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Add UPI ID and payout method to Driver Profiles table
ALTER TABLE public.cb_driver_profiles 
ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS payout_method VARCHAR(50) DEFAULT 'UPI';

-- 2. Add driver UPI and UTR tracking to Rides table
ALTER TABLE public.cb_rides 
ADD COLUMN IF NOT EXISTS driver_upi_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'UNPAID',
ADD COLUMN IF NOT EXISTS upi_utr_number VARCHAR(100);

-- 3. Add UPI details and transaction UTR reference to Payments table
ALTER TABLE public.cb_payments 
ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS payer_upi_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS utr_number VARCHAR(100);

-- 4. Create index for fast lookups by Driver UPI ID
CREATE INDEX IF NOT EXISTS idx_cb_driver_profiles_upi ON public.cb_driver_profiles(upi_id);
CREATE INDEX IF NOT EXISTS idx_cb_payments_utr ON public.cb_payments(utr_number);
