## Phase 6 — Rentauto Master Rental System

This is a large multi-area build. Below is the scoped plan I'll execute. I'll do it in 4 commits/passes so the app stays bootable between steps and MochaHost / server.cjs / auth / Stripe edge functions remain untouched.

### Pass 1 — Database foundation (migration)

New tables (all RLS-enabled):

- `vehicle_tracking_devices` — car_id, provider, device_identifier, status, installed_at, last_seen_at. Host can read/manage own; admin all.
- `trip_tracking_sessions` — trip_id, car_id, guest_id, host_id, status (pending|active|ended), started_at, ended_at, consent_accepted_at. Guest/host of trip + admin can read; guest can start (on own confirmed trip), guest/host can end.
- `vehicle_location_events` — trip_id, car_id, lat, lng, speed_kmh, heading, accuracy_meters, source, recorded_at. Guest/host of trip + admin read; inserts only via service role (edge function).
- `trip_events` — trip_id, actor_user_id, event_type, payload_json. Guest/host/admin read; participants insert.
- `trip_incidents` — trip_id, reporter_user_id, type, description, photo_urls[], status, created_at. Participants read/insert.
- Add `cars.category` (text: economy/suv/luxury/electric/seven_seat), `cars.instant_book` (bool), `cars.tracking_consent_required` (bool default true).
- Extend trip status check / allowed values via comment only (status is text, no check constraint).

Storage bucket `trip-photos` (private) for check-in/out photo uploads with per-trip-folder RLS.

### Pass 2 — Tracking edge function

- `supabase/functions/tracking-ingest/index.ts` (`verify_jwt = false`) — validates `x-provider-secret` against `TRACKING_PROVIDER_SECRET`, resolves device→car→active session, inserts `vehicle_location_events`, bumps `last_seen_at`. Uses service role.
- `supabase/functions/trip-transition/index.ts` — authenticated; enforces state machine (confirmed→check_in_pending→active→check_out_pending→completed, plus cancelled/disputed). Logs to `trip_events`. Starts/ends tracking sessions.

I'll request `TRACKING_PROVIDER_SECRET` secret via add_secret (optional — mock provider works without it in dev).

### Pass 3 — Frontend marketplace polish

- `src/pages/Explore.tsx` — add category chips (Economy/SUV/Luxury/Electric/7-seat/Airport/Monthly), price-range slider, transmission/fuel/seats filters, instant-book badge, total-estimate-for-dates on cards.
- `src/pages/CarListing.tsx` — add sections: FAQ, tracking disclosure, security deposit / age / license / late-return / smoking-pet / mileage policy block. Already has gallery, host, protection, rules, cancellation, reviews skeleton — fill the gaps with new components.
- New components: `src/components/listing/RentalPolicyCard.tsx`, `TrackingDisclosureCard.tsx`, `FAQSection.tsx`, `src/components/explore/CategoryChips.tsx`, `AdvancedFilters.tsx`.

### Pass 4 — Trip lifecycle + tracking UI + dashboards

New routes (all lazy-loaded in `App.tsx`, all `ProtectedRoute`):

- `/trips/:id/check-in` → `CheckIn.tsx` — 8-step wizard, gated by `trip.status === 'confirmed'` and ownership + window. On finish: upload photos to `trip-photos`, call `trip-transition` to start session, set status `active`.
- `/trips/:id/check-out` → `CheckOut.tsx` — mirror flow; computes mileage overage from check-in odometer and writes summary to `pricing_breakdown`. Calls `trip-transition` to end session, status `completed`.
- `/trips/:id/report-issue` → `ReportIssue.tsx` — incident form writes `trip_incidents`.

Live tracking UI:

- `src/components/tracking/LiveLocationCard.tsx` — last known event for active trip; map-iframe placeholder when no `VITE_MAPBOX_TOKEN`, otherwise a static-image map. Polls every 20s.
- Trip detail (`TripDetail.tsx`) — show check-in/out buttons by status, show LiveLocationCard when `active`, show tracking disclosure pre-trip.
- Host dashboard (`HostDashboard.tsx`) — sections: fleet overview, active rentals (with live map per car), upcoming pickups, returns due, tracking-offline warnings, booking requests.
- Admin (`AdminPanel.tsx`) — replace placeholders with real queries: users/hosts/cars/active trips/pending check-ins/active sessions/cars without photos/cars without tracking devices; actions to disable car and toggle device status.

### Constraints honored

- No frontend Stripe package.
- `server.cjs` / `DEPLOY_MOCHAHOST.md` / `package.json start` untouched.
- All new SQL via migration tool; data inserts via insert tool.
- Tracking only writes events while a `trip_tracking_sessions.status='active'` exists — enforced in edge function.
- Mapbox/Geotab/Bouncie: code-ready adapters, but app works without any key (mock provider + placeholder map).
- All components themed with semantic tokens from `index.css`.

### What will NOT be in this phase (called out so expectations are clear)

- Real GPS hardware integration (only mock + webhook endpoint ready).
- Real map tiles unless `VITE_MAPBOX_TOKEN` is set (static placeholder otherwise).
- Real-time push (uses 20s polling; can upgrade to Supabase Realtime later).
- Payments capture/refund automation beyond existing Stripe edge functions.
- Dispute resolution workflow beyond incident logging.

### Deliverable at end

Build verification + a written report covering: tables added, routes added, tracking architecture, what works, what needs provider config, MochaHost status.

---

This is roughly 25–35 file changes plus 1 migration and 2 edge functions. Approve and I'll execute pass-by-pass.
