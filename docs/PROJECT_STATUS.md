# RENTAUTO.CA — PROJECT STATUS
Last reconciled: 2026-10-14 (UTC). Live GitHub evidence takes precedence over this snapshot.

## Source of truth
- Repository: https://github.com/takatakca/rentautoca
- Default branch: `main`.
- Last verified baseline SHA before this continuity update: `98969f648124fac7eb4dc54e14158451246bf72a`.
- Production: `https://rentauto.ca`, MochaHost Passenger, `/home/bolonca/rentauto_node`.
- GitHub Actions `Rentauto CI` + `Deploy rentauto.ca to MochaHost` both **succeeded** for baseline `98969f648124fac7eb4dc54e14158451246bf72a` (runs 38608642413, 38608765943).
- Shared identity and operational backend: Supabase project `pcjfahhlozsseqqevimi`. Cross-product data stays TAKATAK-owned; Rentauto has its own schema and UI.

## Verified implemented
- React/Vite frontend, account/role flows, host listings, trip/booking/checkout interfaces, Stripe/Connect Edge source, GPS/tracking interfaces, incidents/cancellations and admin workflow code.
- Production artifacts are built off-server, stored immutably as `releases/<sha>` and activated via `CURRENT`, Passenger restart, exact SHA health verification, and rollback to `PREVIOUS`.
- Canonical SEO and noindex for private routes; tested CI. On 2026-10-14 the deployed baseline matched the expected Git SHA.

## Verified unresolved
- **Issue #39 (P0 integration architecture):** the repository's legacy outbox migration targets obsolete `public.trips`/`public.user_roles` and overwrites shared `public.handle_new_user`. The live project has `rentauto.trips` and `rentauto.account_roles`; `public.integration_outbox`, its three related RPCs, and `takatak-sync-outbox` Edge Function are absent. Do not apply old migration.
- Production already has `rentauto.sync_takatak_marketplace_order_trigger` and `public.bootstrap_rentauto_account_authorized_impl` for direct TAKATAK projections. New sync must not duplicate or defeat those mechanisms.
- Live read-only snapshot of production on 2026-10-14: **0** `rentauto.accounts`, **0** `rentauto.trips`, **0** RENTAUTO `public.source_profiles`, **0** RENTAUTO `public.source_marketplace_orders`. No real host/guest rental acceptance was demonstrated.
- Existing Edge Functions are deployed, but deployment does not certify runtime secrets, SMS, Stripe configuration or an end-to-end transaction.
- LC1 checklist includes real host, guest, payment, webhook, GPS, return, review, refunds and operational approval; not yet evidenced complete.

## Definition of done
All approved requirements implemented, CI green, backend contracts deployed and verified, production exact revision verified, privacy/security controls reviewed, and LC1 acceptance recorded. No unsupported claim of complete/GA status.
