# API Reference (Frontend → Backend Data Flows)

Rentauto's frontend talks to Supabase exclusively via the typed client at
`@/integrations/supabase/client`. There is no custom REST layer — reads use
`supabase.from(...)` with RLS, and privileged operations call Edge Functions.

## Auth / Profile
- **Sign up / log in:** `supabase.auth.signUp`, `signInWithPassword`, `signInWithOAuth({ provider: 'google' })`.
- **Profile row:** `public.profiles` (auto-created by `handle_new_user` trigger).
- **Role:** `public.user_roles` (`guest` default; `host`/`admin` granted via RBAC).
- Hook: `AuthContext` + `useAuth()`.

## Explore / Search
- Table: `public.cars` joined with `car_photos`, `provinces`, `vehicle_tracking_devices`.
- Filters: province, city, dates (intersect `availability_blocks`), make/model, price.
- File: `src/pages/Explore.tsx`.

## Car Listing
- Hook: `use-car-listing.ts` — fetches `cars`, `car_photos`, `car_features`,
  `host` profile, reviews aggregate, availability windows.
- File: `src/pages/CarListing.tsx`.

## Quote
- Edge Function: **`quote-trip`** (see `EDGE_FUNCTIONS.md`).
- Hook: `use-trip-quote.ts` (debounced on date/extras change).
- Returns line items, taxes (GST/QST), protection cost, totals.

## Checkout
- Edge Function: **`create-checkout-session`** — creates Stripe Checkout
  session and flips trip to `pending_payment`.
- Stripe webhook flips to `confirmed` on `checkout.session.completed`.
- File: `src/pages/Checkout.tsx`.

## Trips Dashboard
- Tables: `trips`, `cars`, `trip_events`, `trip_incidents`.
- Guests see their `trips.guest_id` rows; hosts see `cars.host_id` rows
  (enforced by RLS).
- File: `src/pages/Trips.tsx`, `src/pages/TripDetail.tsx`.

## Check-in
- Edge Function: **`trip-transition`** with `action: "check_in"`.
- Writes `trip_events`, uploads pickup photos to `trip-photos` bucket, sets
  `trips.status = active`, opens `trip_tracking_sessions` row.
- File: `src/pages/TripCheckIn.tsx`.

## Check-out
- Edge Function: **`trip-transition`** with `action: "check_out"`.
- Closes tracking session, records dropoff photos + mileage + fuel,
  sets `trips.status = completed`.
- File: `src/pages/TripCheckOut.tsx`.

## Incidents
- Table: `trip_incidents` (type, severity, description, photos).
- File: `src/pages/ReportIssue.tsx`.

## Host Dashboard
- Cards, bookings, payouts, Stripe Connect status.
- Hook: `use-stripe-connect.ts`.
- File: `src/pages/HostDashboard.tsx`, `HostCars.tsx`, `HostCarEdit.tsx`.

## Admin Dashboard
- Aggregate counts, active sessions, pending check-ins, open incidents,
  LC1 launch checklist.
- File: `src/pages/AdminPanel.tsx`, `src/pages/AdminLaunchChecklist.tsx`.
