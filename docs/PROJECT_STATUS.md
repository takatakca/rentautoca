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

## Fixed in pending release df6aed6362c8+
- Corrected browser role/membership queries to live `rentauto.account_roles.auth_user_id` and added explicit product membership gating. Verify CI/deploy for the new commit; do not treat this line as production proof.

## Current TAKATAK sync clarification
- The outbox issue #39 must not imply the absence of all sync: `rentauto.project_trip_to_takatak_marketplace_order` and the Rentauto account bootstrap are installed. External network outbox delivery is still absent and the original SQL is incompatible.
- Role compatibility: `rentauto.user_roles` exists as a view of `rentauto.account_roles`; canonical direct reads now use the latter.

## 2026-10-14 latest CI/deploy checkpoint

- Verified main code SHA `32d615164bf09f0c6778bccb7b6c340fd0f2972b` passed CI run 38615508682.
- The associated Deploy workflow 38615701658 failed at authenticated SSH remote exec, before activation. **Latest committed code is not confirmed in production.**
- Last independently confirmed live SHA remains `98969f648124fac7eb4dc54e14158451246bf72a` from successful workflow 38608765943.
- Hosting blocker: issue #40; TAKATAK outbox backend reconciliation: issue #39; LC1 end-to-end still unverified.

## 2026-10-15 continuation
- At start, `main` was `c1028a551b06e907cb81e00785d63f63f003dc44`: GitHub CI succeeded but latest MochaHost deploy failed. No newer production release asserted.
- Added a fail-closed CI migration safety gate: an automatic `supabase db push/migration up/reset` in GitHub Actions is prohibited until the shared-schema rollout is redesigned and reviewed. Existing production database untouched.
- Blockers remain #39, #40, and LC1 acceptance.

## 2026-10-15: cross-repo receiver verified
- Source-side TAKATAK Next.js endpoint `/api/integrations/rentauto/events` validates HMAC-SHA256, timestamp, content length, schema and event ID; responds with `accepted: true` on success. Its production enable flag and actual availability remain unverified.
- Rentauto's undeployed sender hardened: only HTTPS TAKATAK receiver (or explicitly approved origin), no redirects, and a positive receiver receipt required. No database migration or secret deployment performed.
- Last independently confirmed MochaHost deploy before this change: SHA `a0e2d5f2f5634d6f967f08d489e603b1934c1c7d` (run 38841341501 success, exact SHA verification).

## 2026-10-15 isolated outbox staged
- New Rentauto-only SQL staging artifact is versioned, defaults disabled, and never modifies global TAKATAK auth/projection triggers. It is NOT applied in production. The sender now requires fenced lease RPCs and ack; LC1 remains pending.
- Last confirmed production before this change: `548df074d96ade2b5756c431fa597a69d533db56` with CI 38843662002 and Deploy 38843721183 both successful.

## 2026-10-15 SQL execution check
- New CI job boots disposable PostgreSQL 16 and actually runs the staging SQL, role/RLS and outbox leasing checks. No production migrations or data writes. Verify job outcome before claiming passing SQL.
- Last verified deployed SHA prior to this change: `b297e6aebc6f50109d5ff9f8d8e12d621c068c3f` (Deploy 38844285977 success).

## 2026-10-15 outbox kill-switch and identity compatibility
- Scoped SQL now prevents claiming queued events while sync is disabled, not merely creating new events. It also looks up a prior Rentauto source profile by master identity when external user ID has been retained for legacy compatibility. Isolated PG tests cover both cases; live backend remains untouched.
- Previous confirmed deployed SHA `17612acb30f8a77608baebf165cf65cb713607f5` (CI 38844556167, MochaHost 38844631301).

## 2026-10-15 verified SQL failure and correction
- CI 38844815420 exposed a stage-only PL/pgSQL opening delimiter typo in the new outbox claim function. Fixed and added static regression. No production migration occurred; previous confirmed live SHA is `17612acb30f8a77608baebf165cf65cb713607f5`.

## 2026-10-16 — Verified shared TAKATAK database authority
- Read-only live Supabase `pcjfahhlozsseqqevimi` inspection found TAKATAK V1 Prisma migration entries `20261003152000_ahmv_product_catalog` and `20261004190000_community_content_moderation`, both present in `takatakca/takatak-v1/prisma/migrations`. Rentauto tables and master `public.source_profiles`/`public.source_marketplace_orders` are in the same database.
- Live `rentauto.trips` has `trg_sync_takatak_marketplace_order` on INSERT/UPDATE; account bootstrap and trip projection functions have server-restricted execution. Live RENTAUTO accounts/trips/orders count 0; no real LC1 flow can yet be certified.
- **Completed code:** added a CI job using isolated PostgreSQL 16 that executes the ACTUAL SQL defining `rentauto.project_trip_to_takatak_marketplace_order` and its trigger. It checks draft isolation, master identity, status/refund upsert/idempotency and separate guest identities.
- New code remains independent of live production data. **Issue #39:** second HTTP sender/outbox stays uninstalled and disabled because it risks replaying data already projected in the shared database.
- Last verified live web SHA at session start: `fc668ee922d808bc5aec047c3b1f4776c97252ac`, CI 38844933792 and MochaHost run 38845009659 success. New commit SHA is current `main` HEAD; read new CI/deploy separately.

## 2026-10-16 explicit external-sync opt-in
- The undeployed HTTP sender now refuses to run unless server-only `TAKATAK_RENTAUTO_SYNC_INDEPENDENT_STORE_CONFIRMED=true` is explicitly configured after independent datastore verification. A signed URL/runner secret alone is insufficient. Default in shared Supabase deployment: blocked.
- Last verified MochaHost web revision before this change `3a39c9b873ff0e6bf731439293bf4e4acc6e5d99` (run 38943130066). No Supabase production SQL or sender changes were deployed.

## 2026-10-16 CI lint correctness
Fixed CI changed-file lint: prior origin/main...HEAD comparison on push could be empty; use actual push before SHA and PR base. Regression test added. Last live SHA before change: 48bea913cabfac42bcfb2d04bdb80aed41e60933.

## 2026-10-16 lint debt progress
- GitHub full-lint report on SHA `fd0dbd061aa09ded90d6764f985f7f42eb5af9e9` showed 20 errors and 11 warnings, while changed-file gate passed. Started source-level fixes for host forms, comparison, Web Speech, favourites, UI prop types, OAuth sanitization and Tailwind import. Tests and build will validate behavior before deploy.

## 2026-10-16 remaining lint errors addressed
- After `5d172495fecffcd68a06b2e6641f447fecfebadf`, GitHub full lint reported only six errors and 11 Fast Refresh warnings. Updated typed concierge tool results, standard fetch parameters and the generated preview auth broker timer. Verify CI for new SHA; latest confirmed deployed SHA before changes: `5d172495fecffcd68a06b2e6641f447fecfebadf`.
