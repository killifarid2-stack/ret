# WAB-TKD — Final Deep Rule Audit — 2026-09-05

## Scope
Deep static/source audit of the current release, with focus on current 2026 Kyorugi rules, Golden Round, PTG, Gam-jeom/PUN, scoring defaults, Par Équipe isolation, result persistence, public read-only behavior, recovery, archive/report consistency, and production security.

## Changes applied
- Current 2026 default turning-head score set to **6** (configurable legacy 5 remains selectable).
- Current 2026 default point-gap set to **15** (configurable/off remains available).
- Ten-Gam-jeom individual termination now records **PUN** instead of incorrectly labeling it PTG.
- Added `DQB` to `WinMethod` and winner-animation method labels.
- PTG check is excluded from Par Équipe's individual match engine path.
- Added regression coverage for the 10-Gam-jeom PUN path.

## Verified
- TypeScript: `tsc --noEmit` PASS.
- Final production audit PASS.
- Final feature audit PASS.
- Production release check PASS.
- Security audit PASS (strict final RLS migration present).
- Mat configuration PASS.
- No real credentials are bundled.

## Deployment-only requirement
`production:env-check` intentionally fails without real deployment environment variables:
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
This is a deployment gate, not a source-code defect. Real credentials must be injected only in the deployment/CI environment and must never be committed to this ZIP.

## Rule references checked
- WT Competition Rules & Interpretation in force Jan. 1, 2026.
- WT/USA Taekwondo April 2026 rule update: point gap raised from 12 to 15 and last-10-seconds passive Gam-jeom awards 2 points while counting as one Gam-jeom.

## Not silently changed
- HOME structure.
- Original supplied animation assets.
- Main Referee as the sole broadcast controller.
- Public/Broadcast read-only architecture.
- User-configurable legacy scoring options.
- Par Équipe's separate workflow.
