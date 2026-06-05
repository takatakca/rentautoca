# Launch Candidate 1 (LC1) Runbook

The goal of LC1 is to validate the **entire real-world rental loop** with
real money, a real car, and two real humans — before any further feature
development or React Native work.

Definition of Done: one real host lists a real car, one real guest books
it, pays via Stripe, checks in, GPS records the trip, checks out, and
leaves a review.

Track progress live at **`/admin/launch-checklist`**.

---

## 0. Pre-flight (1 hour)

- [ ] All required env vars set (frontend + Edge Function secrets)
- [ ] `STRIPE_WEBHOOK_SECRET` matches the active endpoint (live mode)
- [ ] `PUBLIC_APP_URL` matches deployed domain
- [ ] Legal pages reachable: `/terms`, `/privacy`, `/insurance`,
      `/cancellation-policy`
- [ ] Auth → Site URL + redirect URLs include deployed domain

## 1. Host setup (30 min) — Account A

- [ ] Sign up at `/signup`
- [ ] Complete profile (name, phone, photo)
- [ ] `/become-host` → complete host onboarding ≥ required threshold
- [ ] Complete Stripe Connect onboarding (real bank info)
- [ ] `stripe-status` reports `charges_enabled && payouts_enabled`
- [ ] Add real car at `/host/cars`
- [ ] Upload 5+ photos
- [ ] Set daily rate, mileage limits, extras
- [ ] Set pickup location (real province/city)
- [ ] Publish (status `active`)

## 2. Guest setup (15 min) — Account B (different email + device)

- [ ] Sign up at `/signup`
- [ ] Complete profile + ID verification

## 3. Stripe test-mode validation (15 min)

- [ ] Book the host's car with test card `4242 4242 4242 4242`
- [ ] Trip flips `pending_payment → confirmed`
- [ ] `availability_blocks` row exists for the date range
- [ ] Repeat with decline card `4000 0000 0000 0002` → trip → `draft`
- [ ] Repeat with 3DS card `4000 0025 0000 3155` → trip → `confirmed`

## 4. Live $1 booking (30 min)

- [ ] Switch Stripe to Live mode (already required for Connect payouts)
- [ ] Temporarily set car `daily_rate_cents = 100`
- [ ] Guest books 1 day with a real card
- [ ] Webhook fires; trip `confirmed`; bank captures $1
- [ ] (After test) Refund from Stripe Dashboard

## 5. Check-in (real meeting) (30 min)

- [ ] Guest at pickup → `/trips/:id` → "Check in"
- [ ] Take 4 pickup photos (front, back, dashboard, fuel)
- [ ] Enter odometer + fuel level
- [ ] Submit → trip `active`
- [ ] `trip_tracking_sessions` row inserted (`status = active`)

## 6. Tracking (during trip)

- [ ] Provider posts to `tracking-ingest` with shared secret
- [ ] `LiveLocationCard` on `TripDetail` updates in realtime
- [ ] Drive ≥ 5 km → verify multiple pings stored
- [ ] Stop the device temporarily → no pings stored; no errors

## 7. Check-out (real return) (30 min)

- [ ] Guest at dropoff → `/trips/:id` → "Check out"
- [ ] Take 4 dropoff photos
- [ ] Enter final odometer + fuel level
- [ ] Submit → trip `completed`
- [ ] Tracking session closes (`status = ended`)
- [ ] Provider sends one more ping → `tracking-ingest` returns
      `stored: false` (privacy gate)

## 8. Review (15 min)

- [ ] Guest leaves review (rating + text)
- [ ] Review appears on car listing
- [ ] Host can respond

## 9. Failure paths (1 hour)

- [ ] Cancel pre-pickup (Flexible policy) → full refund
- [ ] Cancel within 24h (Standard policy) → 50% refund
- [ ] Host cancels → guest refund + 20% credit
- [ ] Incident report (`/trips/:id/report-issue`) → row in `trip_incidents`
- [ ] Admin sees incident in `/admin`

## 10. Launch approval

- [ ] All boxes above checked
- [ ] No P0/P1 bugs open
- [ ] Founder + ops sign-off recorded
- [ ] **LC1 PASSED → proceed to GA**
