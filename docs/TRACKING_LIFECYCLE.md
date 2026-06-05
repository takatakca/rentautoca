# Tracking Lifecycle (Privacy by Design)

Rentauto's tracking architecture is gated on trip state. A vehicle's device
can be powered and pinging 24/7, but the platform only **stores and exposes**
location while a trip is `active`.

## Rules

1. Before check-in → **no location data is stored**, even if the device sends pings.
2. At check-in → `trip-transition` opens a `trip_tracking_sessions` row
   (`status = active`, `started_at = now()`).
3. While active → `tracking-ingest` accepts pings, validates the shared
   secret, looks up the device's active session, and inserts
   `trip_tracking_pings`.
4. At check-out → `trip-transition` closes the session
   (`status = ended`, `ended_at = now()`).
5. After check-out → further pings from that device are **dropped** until
   another trip becomes active.

## Privacy rules

- Guest sees a **tracking disclosure** card on the car listing and at checkout.
- Host can see live location of vehicle **only during active trips on their
  own cars** (RLS on `trip_tracking_sessions` + `trip_tracking_pings`).
- Guest can see their **own** trip location while active (helpful for
  finding the car / proof of route).
- Admin can see active sessions for support but not historical pings without
  an audit-logged query.
- Pings older than retention window can be purged by a scheduled job
  (recommend 90 days).

## Tables involved

| Table | Purpose |
|---|---|
| `vehicle_tracking_devices` | Device ↔ car mapping, provider, last seen |
| `trip_tracking_sessions` | One row per active/closed trip session |
| `trip_tracking_pings` | Append-only location pings (RLS scoped) |

## Realtime

`LiveLocationCard` subscribes to:

```ts
supabase
  .channel(`trip-${tripId}-loc`)
  .on('postgres_changes',
      { event: 'INSERT', schema: 'public',
        table: 'trip_tracking_pings',
        filter: `session_id=eq.${sessionId}` },
      handler)
  .subscribe()
```

Make sure `ALTER PUBLICATION supabase_realtime ADD TABLE
public.trip_tracking_pings;` has been applied in migrations.
