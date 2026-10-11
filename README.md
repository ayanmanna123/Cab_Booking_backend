# 🚖 Uber Clone / Cab Booking - Backend API Server

A high-performance, enterprise-grade backend architecture for a full-stack ride-hailing application built with **Node.js**, **Express.js**, **Supabase (PostgreSQL)**, **Socket.io (WebSockets)**, and **Stripe**.

---

## 🏗️ Architecture & File Structure

```
Cab_Booking_backend/
├── .env.example                  # Environment variables template
├── .gitignore                    # Git ignore file
├── package.json                  # Dependencies & scripts
├── README.md                     # Architecture & API documentation
├── supabase/
│   ├── schema.sql                # Complete PostgreSQL schema (tables, enums, triggers, indexes)
│   └── seed.sql                  # Initial vehicle categories & promo codes
└── src/
    ├── config/
    │   ├── constants.js          # Roles, statuses, vehicle tiers & socket event names
    │   ├── env.js                # Environment configuration loader
    │   ├── stripe.js             # Stripe SDK initialization
    │   └── supabase.js           # Supabase client & Admin client
    ├── controllers/
    │   ├── auth.controller.js    # Clerk sync, profile updates
    │   ├── driver.controller.js  # Vehicle registration, GPS updates, driver dashboard
    │   ├── fare.controller.js    # Multi-tier ride pricing and route estimates
    │   ├── payment.controller.js # Stripe PaymentIntents & receipts
    │   ├── promo.controller.js   # Coupon validation & management
    │   ├── review.controller.js  # 5-star ratings & reviews
    │   ├── ride.controller.js    # Ride booking, lifecycle & history
    │   ├── sos.controller.js     # Emergency SOS alert system
    │   └── support.controller.js # Help desk ticketing system
    ├── middlewares/
    │   ├── auth.middleware.js    # Clerk & Supabase JWT authorization
    │   ├── error.middleware.js   # Global error handling
    │   ├── rateLimit.middleware.js # API rate protection
    │   ├── role.middleware.js    # Role-based access control (rider/driver/admin)
    │   └── validate.middleware.js# Zod schema validation
    ├── routes/
    │   ├── auth.routes.js        # /api/v1/auth
    │   ├── driver.routes.js      # /api/v1/drivers
    │   ├── fare.routes.js        # /api/v1/fares
    │   ├── payment.routes.js     # /api/v1/payments
    │   ├── promo.routes.js       # /api/v1/promos
    │   ├── review.routes.js      # /api/v1/reviews
    │   ├── ride.routes.js        # /api/v1/rides
    │   ├── sos.routes.js         # /api/v1/sos
    │   ├── support.routes.js     # /api/v1/support
    │   └── index.js              # Aggregated router & /api/v1/health
    ├── services/
    │   ├── driver.service.js     # Driver dispatch logic
    │   ├── fare.service.js       # Haversine distance, duration & fare logic
    │   ├── payment.service.js    # Stripe processing logic
    │   ├── promo.service.js      # Promo discounts & limits
    │   ├── review.service.js     # Review aggregations
    │   ├── ride.service.js       # End-to-end ride state machine & OTP
    │   ├── sos.service.js        # SOS broadcasting logic
    │   ├── support.service.js    # Support tickets logic
    │   └── user.service.js       # User profile operations
    ├── sockets/
    │   └── socketManager.js      # Socket.io live tracking & driver dispatch pool
    ├── utils/
    │   ├── apiResponse.js        # Standardized JSON response formatting
    │   ├── fareCalculator.js     # Dynamic surge & tier calculations
    │   ├── geoUtils.js           # Haversine formula & spatial filters
    │   └── logger.js             # Formatted console logger
    ├── validations/
    │   ├── auth.validation.js
    │   ├── driver.validation.js
    │   ├── payment.validation.js
    │   ├── promo.validation.js
    │   ├── review.validation.js
    │   ├── ride.validation.js
    │   ├── sos.validation.js
    │   └── support.validation.js
    ├── app.js                    # Express app configuration & middleware pipeline
    └── server.js                 # HTTP & WebSocket server bootstrap
```

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
cd Cab_Booking_backend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

| Key | Description |
|---|---|
| `PORT` | Server listening port (default: `5000`) |
| `CLIENT_URL` | Frontend URL for CORS (default: `http://localhost:3000`) |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_ANON_KEY` | Supabase Anon Public Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key |
| `CLERK_SECRET_KEY` | Clerk Backend Secret Key |
| `STRIPE_SECRET_KEY` | Stripe Secret API Key |

### 3. Setup Supabase Database
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open the **SQL Editor**.
3. Copy and run the contents of [`supabase/schema.sql`](file:///c:/Users/manna/Coding/Internship/Cab_Booking/Cab_Booking_backend/supabase/schema.sql).
   - Creates the custom enums: `user_role`, `ride_status`, `payment_status`, `payment_method_type`, `sos_status`, etc.
   - Creates 9 normalized tables prefixed with `cb_`:
     - `cb_users`
     - `cb_vehicle_types`
     - `cb_driver_profiles`
     - `cb_promo_codes`
     - `cb_rides`
     - `cb_payments`
     - `cb_reviews`
     - `cb_emergency_sos_alerts`
     - `cb_support_tickets`
   - Adds automated `updated_at` triggers and the `calculate_distance_km` Haversine function.
4. Run the contents of [`supabase/seed.sql`](file:///c:/Users/manna/Coding/Internship/Cab_Booking/Cab_Booking_backend/supabase/seed.sql) to add vehicle tiers (UberX, Comfort, UberXL, Black) and initial promo codes.

### 4. Start Development Server
```bash
npm run dev
```

---

## 📡 API Endpoints Overview

All endpoints are prefixed with `/api/v1`.

### 1. Authentication & Users (`/api/v1/auth`)
- `POST /api/v1/auth/sync`: Sync authenticated user from Clerk/frontend into Supabase.
- `GET /api/v1/auth/me`: Fetch current authenticated profile.
- `PATCH /api/v1/auth/profile`: Update user profile (phone number, avatar, emergency contacts).

### 2. Ride Management (`/api/v1/rides`)
- `POST /api/v1/rides/request`: Request a ride with pickup, dropoff, multi-stops, and vehicle tier.
- `GET /api/v1/rides/active`: Fetch current in-progress ride for rider or driver.
- `GET /api/v1/rides/:rideId`: Fetch ride details and route coordinates.
- `POST /api/v1/rides/:rideId/accept`: Driver accepts an offered ride request.
- `PATCH /api/v1/rides/:rideId/status`: Update status (`ARRIVING`, `ARRIVED`, `IN_PROGRESS` with OTP, `COMPLETED`).
- `POST /api/v1/rides/:rideId/cancel`: Cancel ride with cancellation reason.
- `GET /api/v1/rides/history/rider`: Paginated trip history for rider.
- `GET /api/v1/rides/history/driver`: Paginated ride history for driver.

### 3. Fare Calculation & Tiers (`/api/v1/fares`)
- `GET /api/v1/fares/vehicles`: Retrieve all active vehicle categories and rate cards.
- `POST /api/v1/fares/estimate`: Estimate route distance, duration, and fares across all vehicle tiers.
- `POST /api/v1/fares/route`: Retrieve Leaflet & OpenStreetMap (OSRM) turn-by-turn polyline coordinates for map drawing.

### 4. Driver Dashboard (`/api/v1/drivers`)
- `POST /api/v1/drivers/register`: Register driver vehicle specs (make, model, year, license plate, color).
- `GET /api/v1/drivers/me`: Retrieve current driver's profile.
- `PATCH /api/v1/drivers/location`: Update driver live GPS coordinates & heading.
- `PATCH /api/v1/drivers/status`: Toggle driver Online/Offline status.
- `GET /api/v1/drivers/nearby`: Query available drivers near a latitude/longitude radius.
- `GET /api/v1/drivers/dashboard`: Driver statistics, completed rides, ratings, and total earnings.

### 5. Payments & Receipts (`/api/v1/payments`)
- `POST /api/v1/payments/create-intent`: Create Stripe PaymentIntent for completed ride.
- `POST /api/v1/payments/confirm`: Confirm payment transaction and update ride payment status.
- `GET /api/v1/payments/receipt/:rideId`: Fetch digital ride receipt breakdown.

### 6. Ratings & Reviews (`/api/v1/reviews`)
- `POST /api/v1/reviews`: Submit 1-5 star review and feedback comment.
- `GET /api/v1/reviews/user/:userId`: Fetch reviews received by a driver or rider.

### 7. Promo Codes (`/api/v1/promos`)
- `POST /api/v1/promos/validate`: Check discount percentage and validity for a ride.
- `POST /api/v1/promos`: Create a new promotional campaign (Admin).

### 8. Emergency SOS (`/api/v1/sos`)
- `POST /api/v1/sos/trigger`: Trigger high-priority emergency broadcast with live GPS.
- `GET /api/v1/sos/active`: List open emergency alerts (Admin).
- `POST /api/v1/sos/resolve`: Resolve an active SOS alert (Admin).

### 9. Help & Support Tickets (`/api/v1/support`)
- `POST /api/v1/support/tickets`: Submit support ticket (Payment issue, lost item, driver behavior, etc.).
- `GET /api/v1/support/my-tickets`: Retrieve tickets submitted by current user.
- `PATCH /api/v1/support/tickets/:ticketId`: Update ticket status and admin response.

---

## ⚡ Real-Time WebSockets (Socket.io)

Connect to `ws://localhost:5000` with the following events:

| Event | Direction | Payload | Description |
|---|---|---|---|
| `join:user` | Client ➔ Server | `{ userId }` | Joins private user notification room |
| `join:driver` | Client ➔ Server | `{ driverId }` | Joins driver dispatch pool |
| `driver:location_update` | Client ➔ Server | `{ driverId, latitude, longitude, heading, activeRideId }` | Streams live GPS position |
| `ride:track_location` | Server ➔ Client | `{ driverId, latitude, longitude, heading }` | Streams car marker to rider's live map |
| `ride:new_offer` | Server ➔ Drivers | `{ rideId, pickupAddress, dropoffAddress, estimatedFare }` | Pushes ride request popup to nearby drivers |
| `ride:accepted` | Server ➔ Rider | `{ ride, message }` | Notifies rider that a driver has accepted |
| `sos:alert_broadcast` | Server ➔ All | `{ alert, timestamp }` | Critical emergency alert broadcast |
