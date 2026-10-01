# API Reference (Frontend → Backend Data Flows)

Rentauto's frontend talks to Supabase exclusively via the typed client at
`@/integrations/supabase/client`. There is no custom REST layer — reads use
`supabase.from(...)` with RLS, and privileged operations call Edge Functions.

## Auth / Profile
- **Authority:** shared GROUPE TAKATAK Supabase Auth; Rentauto does not own an independent identity system.
- **Default sign up / log in:** TAKATAK phone OTP via `supabase.auth.signInWithOtp({ phone })` + `verifyOtp({ phone, token, type: "sms" })`.
- **Existing account compatibility:** `signInWithPassword` and Google OAuth remain available for existing shared TAKATAK identities.
- **Master identity:** `public.master_identities`, linked from shared `public.profiles`; verified phone or verified email may satisfy identity verification.
- **Rentauto projection:** `public.source_profiles` with `sourceApplication = 'RENTAUTO'`, then `rentauto.accounts` + `rentauto.account_roles`.
- **Isolation:** Rentauto receives the minimum identity projection it needs. Driver documents, vehicle records, GPS, trips, incidents, and Stripe operational data remain Rentauto-specific.
- Hook: `AuthContext` + `useAuth()`; bootstrap authority: `rentauto-bootstrap-account`.

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
