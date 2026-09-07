// POWER FAILURE / CRASH RECOVERY
// ================================
// Periodically mirrors the live MatchState to localStorage so that if the
// app/computer is killed mid-match (power loss, crash, forced close), the
// next launch can offer to restore exactly where things left off.
//
// TIMER SAFETY: MatchState.timeRemaining is stored as-is (seconds
// remaining), never as a wall-clock deadline. Restoring the snapshot
// therefore resumes the clock from the exact second it was at when the
// snapshot was taken — the period the computer was OFF is never counted,
// because we never recompute elapsed time from `Date.now()`. The clock only
// starts ticking again once the operator explicitly resumes/restarts it via
// the existing TICK interval (see MatchContext), same as a normal PAUSE.
//
// Only the operator/main window ever writes a snapshot (see the
// `isPublicWindow` guard at the call site in MatchContext.tsx) — the public
// scoreboard window must never become a second, competing writer.

import { MatchState } from '@/types/tkd';
import { isParEquipeMatch, loadParEquipeSafeSnapshot } from '@/lib/par-equipe-save';

const SNAPSHOT_KEY = 'kyorugi_session_snapshot_v1';

// Ignore anything older than this — a week-old abandoned match should not
// resurrect itself and surprise an operator starting a brand new session.
const MAX_SNAPSHOT_AGE_MS = 48 * 60 * 60 * 1000; // 48h

export interface SessionSnapshot {
  state: MatchState;
  savedAt: number; // Date.now() wall-clock ms, used only for staleness — never for timer math.
}

export function saveSessionSnapshot(state: MatchState): void {
  try {
    const snapshot: SessionSnapshot = { state, savedAt: Date.now() };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage full/unavailable — recovery is best-effort, never fatal to live match operation.
  }
}

export function clearSessionSnapshot(): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Reads the last snapshot, if any, and only returns it when it's both
 * fresh enough AND actually represents match progress worth offering to
 * restore (a brand-new, untouched 'waiting' match with zero score events
 * isn't worth interrupting the operator's next launch for).
 */
function hasRecoverableProgress(state: MatchState): boolean {
  const hasCallFlowProgress =
    state.teamCallStatus?.hong !== 'idle' || state.teamCallStatus?.chung !== 'idle' ||
    state.playerCallStatus?.hong !== 'waiting' || state.playerCallStatus?.chung !== 'waiting' ||
    !!state.matchupAnimation || !!state.autoCallSequence?.active;
  return state.status !== 'waiting'
    || (state.events?.length ?? 0) > 0
    || state.currentRound > 1
    || hasCallFlowProgress;
}

function isParEquipeSafeState(state: MatchState): boolean {
  if (!isParEquipeMatch(state)) return true;
  if (state.status === 'rest' || state.status === 'paused' || state.status === 'finished') return true;
  if (state.callFlowAutoStartBlocked) return true;
  if (state.matchupAnimation?.status === 'ready') return true;
  // Manual/referee-confirmation stop points are intentionally recoverable.
  if (state.teamCallStatus?.hong === 'calling' || state.teamCallStatus?.chung === 'calling') return true;
  if (state.playerCallStatus?.hong === 'called' || state.playerCallStatus?.chung === 'called') return true;
  return !state.callAnimation && !state.singlePlayerCall && !state.matchupAnimation && !state.autoCallSequence?.active;
}

export function loadRecoverableSession(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const snapshot: SessionSnapshot = JSON.parse(raw);
    if (!snapshot?.state) return null;
    if (Date.now() - snapshot.savedAt > MAX_SNAPSHOT_AGE_MS) {
      clearSessionSnapshot();
      return null;
    }
    let { state } = snapshot;
    // Par Équipe has an additional SAFE SNAPSHOT layer. If the last mirror
    // was captured while an animation was actually playing (or another
    // transient state was in flight), prefer the last referee-safe snapshot
    // so recovery never resumes from a half-finished cinematic/transition.
    // If the only safe snapshot is a brand-new untouched match, keep the
    // current mirror instead — otherwise a power cut during the very first
    // Team Call could look like there was no recoverable progress at all.
    if (isParEquipeMatch(state)) {
      const safe = loadParEquipeSafeSnapshot();
      const currentSafe = isParEquipeSafeState(state);
      if (!currentSafe && safe && safe.matchId === state.id && hasRecoverableProgress(safe.state)) {
        state = safe.state;
      }
    }
    // A match that's still 'waiting' can nonetheless represent real,
    // interruptible progress: the Team Call / Player Call / Matchup
    // sequence all happen BEFORE status flips off 'waiting' (see the
    // AUTOMATIC CALL FLOW spec §15 — power loss during any of those stages
    // must still restore to the exact same WAITING FOR REFEREE
    // CONFIRMATION point, not be silently discarded as "nothing happened yet").
    const hasProgress = hasRecoverableProgress(state);
    if (!hasProgress) return null;
    return state === snapshot.state ? snapshot : { ...snapshot, state: structuredClone(state) };
  } catch {
    return null;
  }
}
