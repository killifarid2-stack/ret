// PAR ÉQUIPE — MATCH SAVE WINDOW
// ================================
// A dedicated, multi-slot save/restore system for Par Équipe (team) matches
// ONLY. This is deliberately separate from session-recovery.ts (the
// single-slot, silent crash-recovery snapshot used for ALL match types) —
// mixing the two would risk losing team-roster/round-progress ordering, and
// the spec explicitly forbids Individual and Par Équipe sharing one flow.
//
// - session-recovery.ts  -> automatic, single "last state", any match type,
//                           used to survive a power loss / crash.
// - par-equipe-save.ts   -> explicit "SAVE MATCH" button + a browsable list
//                           of named saves, Par Équipe only, so the main
//                           referee can deliberately pause a team match and
//                           come back to it later (possibly after running
//                           other matches on the same mat in between).
//
// Individual matches and V35 logic are never touched by this file.

import { MatchState } from '@/types/tkd';
import { logAudit } from '@/lib/audit-log';

const STORE_KEY = 'kyorugi_par_equipe_saves_v1';
const SAFE_SNAPSHOT_KEY = 'kyorugi_par_equipe_safe_snapshot_v1';
const HISTORY_KEY = 'kyorugi_par_equipe_save_history_v1';
const FINAL_KEY = 'kyorugi_par_equipe_final_snapshot_v1';
const MAX_HISTORY = 12;

export type ParEquipeSaveStatus = 'in_progress' | 'completed' | 'cancelled';
export type ParEquipeLifecycle = 'DRAFT' | 'READY' | 'CALLING' | 'IN_PROGRESS' | 'PAUSED' | 'WAITING_CONFIRMATION' | 'COMPLETED' | 'ARCHIVED' | 'CANCELLED';

export interface ParEquipeSafeSnapshot {
  schemaVersion: 1;
  matchId: string;
  savedAt: number;
  reason: 'referee_safe' | 'round_complete' | 'match_complete' | 'match_ready';
  state: MatchState;
}


export interface ParEquipeSaveVersion {
  versionId: string;
  saveId: string;
  matchId: string;
  savedAt: number;
  lifecycle: ParEquipeLifecycle;
  state: MatchState;
}

export interface ParEquipeFinalSnapshot {
  schemaVersion: 1;
  matchId: string;
  savedAt: number;
  state: MatchState;
}

function readHistory(): ParEquipeSaveVersion[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeHistory(list: ParEquipeSaveVersion[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY))); } catch {}
}

function writeFinalSnapshot(snapshot: ParEquipeFinalSnapshot | null) {
  try {
    if (!snapshot) localStorage.removeItem(FINAL_KEY);
    else localStorage.setItem(FINAL_KEY, JSON.stringify(snapshot));
  } catch {}
}

export function getParEquipeLifecycle(state: MatchState): ParEquipeLifecycle {
  if (state.status === 'finished') return state.awaitingTeamReveal ? 'IN_PROGRESS' : 'COMPLETED';
  if (state.callAnimation || state.singlePlayerCall || state.matchupAnimation || state.autoCallSequence?.active) {
    return state.teamCallStatus?.hong === 'calling' || state.teamCallStatus?.chung === 'calling' || state.playerCallStatus?.hong === 'called' || state.playerCallStatus?.chung === 'called' ? 'CALLING' : 'WAITING_CONFIRMATION';
  }
  if (state.status === 'fighting' || state.status === 'rest' || state.status === 'kyeshi' || state.status === 'ivr' || state.status === 'doctor') return 'IN_PROGRESS';
  if (state.status === 'paused') return 'PAUSED';
  if (state.status === 'waiting') return state.currentRound <= 1 && !state.events?.length ? 'READY' : 'DRAFT';
  return 'DRAFT';
}

export function getParEquipeSaveHistory(matchId?: string): ParEquipeSaveVersion[] {
  const list = readHistory().sort((a,b) => b.savedAt-a.savedAt);
  return matchId ? list.filter(v => v.matchId === matchId) : list;
}

export function getParEquipeFinalSnapshot(matchId?: string): ParEquipeFinalSnapshot | null {
  try {
    const raw = localStorage.getItem(FINAL_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ParEquipeFinalSnapshot;
    if (!s?.state || !isParEquipeMatch(s.state)) return null;
    return matchId && s.matchId !== matchId ? null : s;
  } catch { return null; }
}

export function hasActiveDifferentParEquipeMatch(state: MatchState): boolean {
  if (!isParEquipeMatch(state)) return false;
  const active = state.status !== 'waiting' || (state.events?.length ?? 0) > 0 || state.currentRound > 1 || !!state.callAnimation || !!state.singlePlayerCall || !!state.matchupAnimation || !!state.autoCallSequence?.active;
  return active;
}

export function cancelParEquipeMatch(state: MatchState): ParEquipeSavedMatch | null {
  if (!isParEquipeMatch(state)) return null;
  const rec = saveParEquipeMatch(state);
  if (!rec) return null;
  const next = readStore().map(r => r.matchId === state.id ? { ...r, status: 'cancelled' as const } : r);
  writeStore(next);
  clearParEquipeSafeSnapshot(state.id);
  logAudit('par_equipe_match_cancelled', `${state.competitionName || 'Par Équipe'} — ${state.id}`);
  return { ...rec, status: 'cancelled', lifecycle: 'CANCELLED' };
}

export function finalizeParEquipeMatch(state: MatchState): ParEquipeSavedMatch | null {
  if (!isParEquipeMatch(state)) return null;
  const rec = saveParEquipeMatch(state);
  if (!rec) return null;
  const final: ParEquipeFinalSnapshot = { schemaVersion: 1, matchId: state.id, savedAt: Date.now(), state: structuredClone(state) };
  writeFinalSnapshot(final);
  const next = readStore().map(r => r.matchId === state.id ? { ...r, status: 'completed' as const, state: structuredClone(state), savedAt: final.savedAt } : r);
  writeStore(next);
  clearParEquipeSafeSnapshot(state.id);
  logAudit('par_equipe_match_finalized', `${state.competitionName || 'Par Équipe'} — ${state.id}`);
  return { ...rec, status: 'completed', state: structuredClone(state), savedAt: final.savedAt };
}

export interface ParEquipeSavedMatch {
  schemaVersion: 3;
  saveId: string;      // stable per save "slot" — re-saving the same match updates this record instead of duplicating it (spec §16)
  matchId: string;      // state.id — identifies which live match this slot tracks
  versionId: string;    // bumped on every save, for display/debugging only
  savedAt: number;       // Date.now()
  status: ParEquipeSaveStatus;
  lifecycle: ParEquipeLifecycle;
  state: MatchState;     // full snapshot — teams, rosters, order, scores, warnings, penalties, timer, round, events, etc.
}

function readStore(): ParEquipeSavedMatch[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(records: ParEquipeSavedMatch[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(records));
  } catch {
    // best-effort, same as session-recovery.ts — never fatal to live match operation
  }
}

function makeId(): string {
  return `pe_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Only meaningful for Par Équipe matches (spec §10). Callers should guard
 * with this before showing the SAVE MATCH button / running auto-save.
 */
export function isParEquipeMatch(state: MatchState): boolean {
  return state.config?.competitionMode === 'par_equipe';
}

/**
 * Save (or update) the current Par Équipe match state as one slot.
 * Re-saving the same live match (same state.id) updates its existing slot
 * in place rather than creating a duplicate — protects against a referee
 * pressing SAVE MATCH repeatedly (spec §16, "no dozens of identical
 * copies"). Never called for a match that isn't Par Équipe.
 */

function writeSafeSnapshot(snapshot: ParEquipeSafeSnapshot | null): void {
  try {
    if (!snapshot) localStorage.removeItem(SAFE_SNAPSHOT_KEY);
    else localStorage.setItem(SAFE_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Best effort only. Never interrupt a live bout because local storage is unavailable/full.
  }
}

export function saveParEquipeSafeSnapshot(
  state: MatchState,
  reason: ParEquipeSafeSnapshot['reason'] = 'referee_safe',
): ParEquipeSafeSnapshot | null {
  if (!isParEquipeMatch(state)) return null;
  const snapshot: ParEquipeSafeSnapshot = {
    schemaVersion: 1,
    matchId: state.id,
    savedAt: Date.now(),
    reason,
    state: structuredClone(state),
  };
  writeSafeSnapshot(snapshot);
  return snapshot;
}

export function loadParEquipeSafeSnapshot(matchId?: string): ParEquipeSafeSnapshot | null {
  try {
    const raw = localStorage.getItem(SAFE_SNAPSHOT_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as ParEquipeSafeSnapshot;
    if (!snapshot?.state || snapshot.state.config?.competitionMode !== 'par_equipe') return null;
    if (matchId && snapshot.matchId !== matchId) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export function clearParEquipeSafeSnapshot(matchId?: string): void {
  const current = loadParEquipeSafeSnapshot();
  if (!current || !matchId || current.matchId === matchId) writeSafeSnapshot(null);
}

export function saveParEquipeMatch(state: MatchState): ParEquipeSavedMatch | null {
  if (!isParEquipeMatch(state)) return null;
  const records = readStore();
  const existing = records.find((r) => r.matchId === state.id);
  const record: ParEquipeSavedMatch = {
    schemaVersion: 3,
    saveId: existing?.saveId ?? makeId(),
    matchId: state.id,
    versionId: makeId(),
    savedAt: Date.now(),
    status: state.status === 'finished' ? 'completed' : 'in_progress',
    lifecycle: getParEquipeLifecycle(state),
    state: structuredClone(state),
  };
  const next = existing
    ? records.map((r) => (r.saveId === existing.saveId ? record : r))
    : [...records, record];
  writeStore(next);
  const history = readHistory();
  history.unshift({ versionId: record.versionId, saveId: record.saveId, matchId: record.matchId, savedAt: record.savedAt, lifecycle: getParEquipeLifecycle(state), state: structuredClone(state) });
  writeHistory(history);
  logAudit(existing ? 'par_equipe_match_saved' : 'par_equipe_match_created', `${state.competitionName || 'Par Équipe'} — match ${state.matchNumber ?? '—'} — ${record.versionId}`);
  return record;
}

export function listParEquipeSavedMatches(): ParEquipeSavedMatch[] {
  return readStore().sort((a, b) => b.savedAt - a.savedAt);
}

export function getParEquipeSavedMatch(saveId: string): ParEquipeSavedMatch | null {
  return readStore().find((r) => r.saveId === saveId) ?? null;
}

export function deleteParEquipeSavedMatch(saveId: string): void {
  writeStore(readStore().filter((r) => r.saveId !== saveId));
  logAudit('par_equipe_save_deleted', saveId);
}

/**
 * Marks a slot COMPLETED once the match finishes fully (spec §11) so it
 * stops being offered as a resumable "in progress" save. The record itself
 * is kept (archived) rather than deleted, per spec §11/§12.
 */
export function markParEquipeMatchCompleted(state: MatchState): void {
  if (!isParEquipeMatch(state)) return;
  finalizeParEquipeMatch(state);
}

/** Small summary used to render a row in the SAVED MATCHES list (spec §7). */

export interface ParEquipeArchiveExport {
  schemaVersion: 1;
  exportedAt: string;
  match: ParEquipeSavedMatch | null;
  safeSnapshot: ParEquipeSafeSnapshot | null;
  finalSnapshot: ParEquipeFinalSnapshot | null;
  history: ParEquipeSaveVersion[];
}

/** Build a self-contained, read-only archive for one Par Équipe match. */
export function buildParEquipeArchiveExport(matchId: string): ParEquipeArchiveExport | null {
  const match = readStore().find(r => r.matchId === matchId) ?? null;
  if (match && !isParEquipeMatch(match.state)) return null;
  const safeSnapshot = loadParEquipeSafeSnapshot(matchId);
  const finalSnapshot = getParEquipeFinalSnapshot(matchId);
  const history = getParEquipeSaveHistory(matchId);
  if (!match && !safeSnapshot && !finalSnapshot && history.length === 0) return null;
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    match: match ? structuredClone(match) : null,
    safeSnapshot: safeSnapshot ? structuredClone(safeSnapshot) : null,
    finalSnapshot: finalSnapshot ? structuredClone(finalSnapshot) : null,
    history: structuredClone(history),
  };
}

/** Returns true when a newer saved version exists than the selected version. */
export function hasNewerParEquipeVersion(saveId: string): boolean {
  const selected = getParEquipeSavedMatch(saveId);
  if (!selected) return false;
  const safe = loadParEquipeSafeSnapshot(selected.matchId);
  return !!safe && safe.savedAt > selected.savedAt;
}

/** Remove stale history entries while always preserving the active slot and final snapshot. */
export function pruneParEquipeHistory(matchId?: string, keepPerMatch = MAX_HISTORY): number {
  const history = readHistory();
  const grouped = new Map<string, ParEquipeSaveVersion[]>();
  for (const item of history) {
    if (matchId && item.matchId !== matchId) continue;
    const list = grouped.get(item.matchId) ?? [];
    list.push(item);
    grouped.set(item.matchId, list);
  }
  let removed = 0;
  const targetIds = new Set(grouped.keys());
  const next = history.filter(item => {
    if (!targetIds.has(item.matchId)) return true;
    const items = grouped.get(item.matchId)!;
    const index = items.findIndex(x => x.versionId === item.versionId);
    if (index < keepPerMatch) return true;
    removed++;
    return false;
  });
  if (removed) {
    writeHistory(next);
    logAudit('par_equipe_history_pruned', `${removed} stale snapshot version(s)${matchId ? ` — ${matchId}` : ''}`);
  }
  return removed;
}

export interface ParEquipeSaveSummary {
  saveId: string;
  tournament?: string;
  teamRed: string;
  teamBlue: string;
  matchNumber?: number;
  mat?: number;
  progress: string;   // "3 / 5"
  score: string;      // "2–1"
  status: ParEquipeSaveStatus;
  savedAt: number;
}

export function summarizeParEquipeSave(rec: ParEquipeSavedMatch): ParEquipeSaveSummary {
  const s = rec.state;
  const totalRounds = Math.max(
    s.teamRoster?.hong?.length ?? 0,
    s.teamRoster?.chung?.length ?? 0,
    s.config?.rounds ?? 0,
  );
  const completedRounds = s.roundWinners?.length ?? 0;
  return {
    saveId: rec.saveId,
    tournament: s.competitionName,
    teamRed: s.teamNames?.hong || s.hong.player.name || '—',
    teamBlue: s.teamNames?.chung || s.chung.player.name || '—',
    matchNumber: s.matchNumber,
    mat: s.matNumber,
    progress: totalRounds ? `${completedRounds} / ${totalRounds}` : `${completedRounds}`,
    score: `${s.hong.totalScore}–${s.chung.totalScore}`,
    status: rec.status,
    savedAt: rec.savedAt,
  };
}
