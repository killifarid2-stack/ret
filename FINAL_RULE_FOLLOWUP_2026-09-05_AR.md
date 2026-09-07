# FINAL RULE FOLLOW-UP — 2026-09-05

## Applied corrections

1. Turning Head fallback is centralized on `DEFAULT_CONFIG.turningHeadPoints`.
   - Default is 6.
   - Operator, Judge, Admin, MatchContext, and Match Engine no longer fall back independently to 5.
   - Existing tournaments/matches may still explicitly select 5 or 6; stored configuration remains authoritative.
2. `SCORE_VALUES.turning_head` and its type documentation are aligned to the 2026 default of 6.
3. Historical League Medal Points gap wording was removed from continuation/placement documentation. The implemented finalization path remains authoritative; legacy records without club metadata are intentionally not backfilled.
4. Package scripts remain explicit for test/build/E2E/QA/release verification.

## Verification limitation

A clean `npm install --no-audit --no-fund` was attempted in this Linux inspection environment but exceeded the environment execution timeout. Therefore this environment cannot honestly certify a Windows Electron GUI/package run. The source-level corrections and static repository checks can be reviewed, while the final Windows `npm run qa` and `npm run electron:build` must be executed on a Windows CI/PC with dependencies installed.
