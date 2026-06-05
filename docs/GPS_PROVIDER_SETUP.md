# GPS Provider Setup

Rentauto's `tracking-ingest` Edge Function is provider-agnostic. Any
provider that can POST JSON with a shared-secret header will work.

## Required secret

- `TRACKING_PROVIDER_SECRET` — long random string. Provider must send it
  as `x-tracking-secret` on every request.

## Registering a device

Insert into `public.vehicle_tracking_devices`:

```sql
INSERT INTO public.vehicle_tracking_devices
  (car_id, provider, external_device_id, status)
VALUES
  ('<car uuid>', 'bouncie', '<provider device id>', 'active');
```

This can also be done from `/host/cars/:id/edit` → Tracking section
(admin/internal tooling).

## Webhook contract

`POST https://<project-ref>.functions.supabase.co/tracking-ingest`

Headers:
```
content-type: application/json
x-tracking-secret: <TRACKING_PROVIDER_SECRET>
```

Body:
```json
{
  "device_id": "<provider device id>",
  "lat": 45.5017,
  "lng": -73.5673,
  "speed_kmh": 42,
  "heading": 180,
  "recorded_at": "2026-06-05T18:30:00Z"
}
```

## Behavior

1. Function looks up device by `provider + external_device_id`.
2. Finds the row in `trip_tracking_sessions` with `car_id = device.car_id`
   AND `status = 'active'`.
3. If none → returns `200 { stored: false, reason: "no_active_session" }`
   (provider should NOT retry — this is intentional).
4. If active → inserts `trip_tracking_pings` row and bumps
   `vehicle_tracking_devices.last_seen_at`.
5. Realtime subscribers (`LiveLocationCard`) receive the new ping.

## Provider notes

### Bouncie
- Use the Bouncie webhook URL field in the developer dashboard.
- Bouncie sends `vin` and `imei` — map `external_device_id = imei`.
- Translate Bouncie's payload to the contract above (small adapter inside
  the function if needed).

### Geotab
- Geotab's MyGeotab API supports periodic ExceptionRule webhooks or
  pull-based via a small worker. Recommended: small Cloud Run worker that
  polls and posts to `tracking-ingest`.

### Teltonika (FMB-series)
- Raw Codec 8 over TCP — not directly compatible. Use a translator service
  (e.g. Traccar) that decodes and forwards JSON.

## Privacy

The function will refuse to store pings unless there's an active trip
session. This is the core privacy guarantee of the platform — do not bypass.
