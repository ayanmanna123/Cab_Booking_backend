-- ==============================================================================
-- CAB BOOKING / UBER CLONE - INITIAL SEED DATA
-- Run this in Supabase SQL Editor after running schema.sql
-- ==============================================================================

-- 1. Seed Vehicle Types / Categories
INSERT INTO public.vehicle_types (id, name, description, capacity, base_fare, per_km_rate, per_minute_rate, minimum_fare, cancellation_fee, image_url)
VALUES 
    ('economy', 'UberX', 'Affordable, everyday reliable rides', 4, 2.50, 1.30, 0.25, 5.00, 3.00, 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=200'),
    ('comfort', 'Uber Comfort', 'Newer cars with extra legroom & top-rated drivers', 4, 4.00, 1.75, 0.35, 7.50, 4.50, 'https://images.unsplash.com/photo-1550355291-bbee04a92027?w=200'),
    ('xl', 'UberXL', 'Spacious SUVs and vans for groups up to 6', 6, 5.50, 2.20, 0.45, 10.00, 5.00, 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=200'),
    ('black', 'Uber Black', 'Premium luxury rides with professional chauffeured cars', 4, 8.00, 3.50, 0.65, 15.00, 8.00, 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=200')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    base_fare = EXCLUDED.base_fare,
    per_km_rate = EXCLUDED.per_km_rate,
    per_minute_rate = EXCLUDED.per_minute_rate;

-- 2. Seed Promo Codes
INSERT INTO public.promo_codes (code, description, discount_percentage, max_discount_amount, min_ride_fare, valid_from, valid_until, usage_limit, times_used, is_active)
VALUES
    ('WELCOME50', '50% off on your first ride up to $10', 50.00, 10.00, 5.00, NOW(), NOW() + INTERVAL '1 year', 5000, 0, TRUE),
    ('UBER20', '20% off weekend special up to $15', 20.00, 15.00, 12.00, NOW(), NOW() + INTERVAL '6 months', 2000, 0, TRUE),
    ('FREERIDE', '100% off promotional ride up to $25', 100.00, 25.00, 10.00, NOW(), NOW() + INTERVAL '3 months', 500, 0, TRUE)
ON CONFLICT (code) DO NOTHING;
