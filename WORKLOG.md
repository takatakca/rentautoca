# Work log

Newest first, one line per piece of work. Rule: `AGENTS.md` › Work log rule.
Format: `YYYY-MM-DD | agent | branch → PR | status | what | next step`

- 2026-10-15 | ChatGPT | main | done (CI/deploy pending) | Verified TAKATAK receiver source, hardened undeployed Rentauto outbox sender against redirect/off-domain/false 2xx acknowledgements, unit tests, all five handoff files | Verify new commit CI and frontend deploy, continue staging-scoped outbox reconciliation #39

- 2026-10-15 | ChatGPT | main | done (CI pending) | Add fail-closed shared-Supabase migration safety check to CI; synchronize five handoff docs | Check new CI and deploy, resolve SSH #40 with operator, continue reconciliation #39

- 2026-10-14 | ChatGPT | main | blocked: hosting SSH exec issue #40 | Feature/fix CI green at 32d615164bf09f0c6778bccb7b6c340fd0f2972b; deploy failed before activation; last live 98969f648124 | Fix MochaHost remote command permissions, deploy latest SHA; independently continue issue #39

- 2026-10-14 | ChatGPT | main | done (CI/deploy pending) | Added bounded retry and SHA-256 validation for intermittent MochaHost upload failures | Verify live revision after CI and deploy; operator intervention if SSH exec remains unavailable

- 2026-10-14 | ChatGPT | main | done (CI/deploy pending) | Updated TAKATAK direct projection and schema compatibility documentation after live readback | Continue #39 only after receiver contract validation

- 2026-10-14 | ChatGPT | main | done (CI/deploy pending) | Corrected misleading cross-border data geography and retention statements in privacy copy; added tests | Verify CI/deploy; continue integration #39

- 2026-10-14 | ChatGPT | main | done (CI/deploy pending) | Hardened OAuth/login redirect parser against backslash and malformed URL redirect attacks; added tests | Verify CI/deploy then continue #39

- 2026-10-14 | ChatGPT | main | done (CI/deploy pending) | Fixed live account_roles auth lookup and per-product private-route gate, added regression tests | Verify latest release SHA, continue #39 and LC1

- 2026-10-14 | ChatGPT | main | done | Established canonical five-file agent handoff and CI continuity tests; audited actual shared TAKATAK schema | Continue #39 with isolated rentauto-schema implementation; do not run stale migration

- 2026-10-14 | ChatGPT | main → direct commit | done (CI/deploy succeeded, SHA 98969f648124fac7eb4dc54e14158451246bf72a) | Prevent prune from deleting active or PREVIOUS MochaHost Passenger release; add regression coverage | Verify production health SHA after CI and deploy

- 2026-10-14 | ChatGPT | main → direct commit | done (CI passed; release pipeline triggered) | Added SEO noindex for private, saved-concierge, and unknown routes; corrected MochaHost release-pointer and TAKATAK architecture docs | Review GitHub CI/deploy statuses; validate complete LC1 rental journey separately
- 2026-10-08 | claude (owner setup) | default branch | done | Added the work log rule, this log and the stop reminder | every agent follows AGENTS.md › Work log rule
