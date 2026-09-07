WAB-TKD — STATUS + CONTINUATION PROMPT (updated again)
=======================================================
BASE PROJECT: wav (WAB-TKD-v38-main-referee-master-controls)
Verified this session: npm run build + npx tsc --noEmit, both passing with
zero errors, after every change below.

CRITICAL RULE (unchanged): DO NOT TOUCH ANYTHING THAT WAS NOT DISCUSSED.

Full bilingual (AR+EN) write-up of everything below: see DOCUMENTATION.md
at the project root — written LAST, after all of Part A/B, as intended.


==================================================
NEW THIS SESSION
==================================================

1. GREETING STAGE (cosmetic, display-only)
   - TeamCallOverlay.tsx / SinglePlayerCallOverlay.tsx: added a
     locally-timed "TEAM GREETING" / "PLAYER GREETING" banner stage
     between "calling" and "awaiting referee confirmation". Purely a
     display sequencing hook (useGreetingStage) — never touches
     teamCallStatus/playerCallStatus, never dispatches, cannot delay or
     skip a real confirmation. Satisfies the master prompt's §4/§6
     GREETING step visually without any state-shape risk.

2. MATCH LOCK (B2 — done)
   - New src/lib/match-lock.ts: any match with status 'finished' is
     locked by default the instant it finishes. Deleting/editing requires
     an explicit unlock (optional reason, audit-logged via the existing
     audit-log.ts — no second logger).
   - ResultView.tsx: per-row 🔒/🔓 toggle, per-row delete (didn't exist
     before — only bulk "Remove All" did), bulk delete now skips locked
     rows instead of deleting everything unconditionally.

3. MEDAL / TOURNAMENT-PLACEMENT POINTS (B1 — done for bracket mode)
   - New src/lib/tournament-placements.ts: the moment a bracket-mode
     tournament's FINAL match gets a winner (OperatorScreen.tsx's
     existing bracket-advance effect — nextMatchId empty is already that
     exact signal), records gold (winner's club), silver (loser's club),
     and double-bronze (both semifinal losers' clubs, standard WT rule —
     this app has no separate 3rd-place playoff). Never recorded twice,
     never backfilled for tournaments finished before this file existed.
   - club-points.ts: ClubPointsConfig extended with
     pointsPerGold/Silver/Bronze (defaults 10/6/3); computeClubStandings()
     now adds gold/silver/bronze/medalPoints per club.
   - ClubPointsPage.tsx (/club-points): medal point config inputs +
     🥇🥈🥉/medal-pts columns added to the standings table.
   - TournamentManager.tsx: the previously-dead `clubStandings` state
     (declared, rendered in a "Club Rankings" panel, but NEVER populated
     beyond 0 — confirmed by grep, no code anywhere wrote to it or to the
     `clubs` table's gold/silver/bronze/points columns despite the
     columns existing in the DB schema) is now synced from
     computeClubMedalTotals(currentTournamentId) whenever the tournament
     or its bracket changes, and the real counts are also written back to
     the `clubs` Supabase table (by club name; never invents/removes a
     club row, only updates medal counts on ones that already exist via
     the "add club" flow or player registration).
   - CLOSED: League medal points are implemented and finalized by TournamentManager.tsx; legacy records without club metadata are intentionally not backfilled.
     (round-robin) mode has no single "final match" event to hook into,
     so it does not get automatic medal records. Needs a product decision
     ("when is a league considered done?") before it can be wired safely.


==================================================
PART A — PREVIOUSLY DONE (still verified working)
==================================================
A1. HOME / NAVIGATION — unchanged, preserved.
A2. Animation integration (TeamCallOverlay, SinglePlayerCallOverlay,
    MatchupOverlay, WinnerAnimation) — ported from the 3 reference
    projects, wired to live match data.
A3. Main Referee / Admin / Tournament Manager / Operator screen.
A4. audit-log.ts, backup.ts, idempotency-guard.ts, league-standings.ts,
    match-local.ts/tournament-local.ts, electron/main.cjs+preload.cjs.
A5. Power failure / timer recovery (session-recovery.ts,
    SessionRecoveryModal).
A6. Warning Penalty system (warning-penalty.ts).
A7/A8. Club/Team win-points engine + /club-points route — now extended
    with medal points, see "NEW THIS SESSION" #3 above.
A9. AUTOMATIC CALL FLOW (Team Call / Player Call / Matchup, referee
    confirmation gates, auto-sequence, recovery extension) — implemented
    in a previous session, re-verified clean this session, now extended
    with the cosmetic GREETING stage (#1 above).


==================================================
PART B — REMAINING WORK
==================================================
B1. MEDAL POINTS — DONE for both bracket AND league mode now (see below).
B2. MATCH LOCK — DONE (see above).
B3. MULTI-COURT / MULTI-MAT ISOLATION — DONE this session (see below), both
    options (أ) and (ب) implemented, selectable per-device.
B4. ELECTRON WINDOWS PACKAGING — main.cjs/preload.cjs already have the
    single-instance-lock fix + production-server launch flow. Final
    `npm run electron:build` + manual verification on a real Windows
    machine is still needed and CANNOT be done inside this sandbox (no
    Windows GUI here).
B5. DOCUMENTATION — DONE this session: see DOCUMENTATION.md (bilingual
    AR+EN), covering tournament types, club points (win+medal+penalty),
    warning penalty, Automatic Call Flow, Match Lock, medal points
    (bracket AND league), Multi-Mat (both modes), and the still-unverified
    Windows packaging.


==================================================
THIS SESSION — B1 (league) and B3 (Multi-Mat) resolved
==================================================

LEAGUE MEDAL POINTS (closes the B1 gap):
- TournamentManager.tsx: new per-tournament setting (visible only in
  league mode) — "When is the league finished?" — manual (default) or
  auto. Saved in bracket_data.leagueMedalTrigger.
- Manual: "End League & Award Medals" button appears once every match has
  a winner; taps recordPlacements() (same function Bracket uses — no
  duplicate system) with the top 3 from computeLeagueStandings().
- Auto: an effect fires the same recordPlacements() call automatically
  the moment the league becomes complete, only for tournaments where the
  organizer explicitly chose 'auto'.
- hasPlacementRecord() guards both paths — never double-recorded.
- tournament-placements.ts itself: placement calculation remains unchanged (the historical gap is closed by the finalization path
  note now points to this DOCUMENTATION.md §7.1 instead).

MULTI-MAT (closes B3 — both (أ) and (ب) implemented, per user's explicit
answer: "both, referee chooses, single-mat still works"):
- New src/lib/mat-status.ts: per-device mode setting (single/control_room,
  localStorage) + a best-effort live-status heartbeat (Supabase table
  mat_live_status, new migration 20260820100000_add_mat_live_status.sql).
- AdminPanel.tsx: new "Multi-Mat" settings panel — mode dropdown + mat
  count field, both documented inline (AR+EN) in the UI itself.
- MatchContext.tsx: new throttled (8s) heartbeat-push effect, guarded
  exactly like the existing session-recovery snapshot (never runs on the
  public window, no-ops when matNumber unset or Supabase unreachable).
- TopNav.tsx: MAT NN badge now shown on every screen when matNumber is
  set (this was the (أ) checklist item — "every screen clearly shows the
  current mat number" — previously only visible inside an Admin input
  field). Control Room nav link only appears when this device's mode is
  set to control_room.
- New src/pages/ControlRoomPage.tsx (/control-room): side-by-side live
  status cards for every configured mat, "Control this mat" switches this
  window to operate that mat.
- IMPORTANT DESIGN DECISION (see DOCUMENTATION.md §8.3 for the full
  bilingual reasoning): this is a "watch every mat + switch which one this
  window controls" design, NOT a MatchContext rewrite into a mat-keyed
  concurrent state map. Every mat still has exactly one Electron process
  actually operating it at any moment — this satisfies the original
  prompt's own wording ("switch between mats to control each one
  individually") without the large, untestable-in-this-sandbox rewrite
  risk that a literal same-window-simultaneous-scoring implementation
  would have carried.
- Migration 20260820100000_add_mat_live_status.sql still needs to be
  applied to the real Supabase project before Control Room can see other
  devices' status — not run here (no live DB connection in this sandbox).
- npm run build + npx tsc --noEmit both verified clean after every change
  in this session.




==================================================
NON-DESTRUCTIVE RULE — still applies to all remaining work
==================================================
Inspect existing files first, confirm build + tsc stay clean after each
change, never touch anything not mentioned in PART B without asking
first. In particular: do NOT implement Multi-Mat (B3) without the user
picking (a) or (b) above first.
