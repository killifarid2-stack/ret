// MULTI-MAT CONTROL ROOM
// =======================
// See DOCUMENTATION.md §8 for the full bilingual write-up of the two
// supported modes and the design decision behind this file.
//
// This module has two independent pieces:
//   1. Mat-mode SETTINGS (per-device, localStorage) — which UI this
//      Electron instance shows: plain single-mat operation (default,
//      unchanged from before), or the extra Control Room screen.
//   2. Live-status HEARTBEAT (Supabase, cross-device) — a best-effort
//      "what is each mat doing right now" broadcast, written by whichever
//      instance is currently operating a given mat, read by any Control
//      Room window watching the tournament. Never a source of truth for
//      results (see the migration file's comment) — purely a live display.

import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { MatchState } from '@/types/tkd';
import { registerMatHeartbeat, fetchMatRegistry } from '@/lib/mat-registry';

// ---------------------------------------------------------------------
// 1. Settings (per device)
// ---------------------------------------------------------------------

export type MatControlMode = 'single' | 'control_room';

const MODE_KEY = 'kyorugi_mat_control_mode_v1';
const COUNT_KEY = 'kyorugi_mat_count_v1';
const ASSIGNED_MAT_KEY = 'wab-tkd-assigned-mat-v1';
const DEVICE_NAME_KEY = 'wab-tkd-mat-device-name-v1';

export function getMatControlMode(): MatControlMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'control_room' ? 'control_room' : 'single';
  } catch {
    return 'single';
  }
}

export function setMatControlMode(mode: MatControlMode): void {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* best-effort */ }
}

/** How many mat slots the Control Room dashboard should show (organizer-configured, default 4). */
export function getMatCount(): number {
  try {
    const n = parseInt(localStorage.getItem(COUNT_KEY) || '4', 10);
    return Number.isFinite(n) && n > 0 && n <= 32 ? n : 4;
  } catch {
    return 4;
  }
}

export function setMatCount(n: number): void {
  try { localStorage.setItem(COUNT_KEY, String(Math.max(1, Math.min(32, Math.floor(n))))); } catch { /* best-effort */ }
}

export function getAssignedMatNumber(): number | null {
  try {
    const raw = localStorage.getItem(ASSIGNED_MAT_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 && n <= 32 ? n : null;
  } catch { return null; }
}

export function setAssignedMatNumber(n: number | null): void {
  try {
    if (!n) localStorage.removeItem(ASSIGNED_MAT_KEY);
    else localStorage.setItem(ASSIGNED_MAT_KEY, String(Math.max(1, Math.min(32, Math.floor(n)))));
  } catch { /* best-effort */ }
}

export function getMatDeviceName(): string {
  try { return localStorage.getItem(DEVICE_NAME_KEY) || ''; } catch { return ''; }
}

export function setMatDeviceName(name: string): void {
  try { localStorage.setItem(DEVICE_NAME_KEY, name.trim().slice(0, 80)); } catch { /* best-effort */ }
}

// ---------------------------------------------------------------------
// 2. Live heartbeat (cross-device, via Supabase)
// ---------------------------------------------------------------------

export type MatDisplayStatus = 'idle' | 'waiting' | 'running' | 'paused' | 'finished';

export interface MatLiveStatus {
  mat_number: number;
  device_name?: string | null;
  status: MatDisplayStatus;
  competition_name: string | null;
  match_number: number | null;
  chung_name: string | null;
  hong_name: string | null;
  chung_nationality?: string | null;
  hong_nationality?: string | null;
  chung_club?: string | null;
  hong_club?: string | null;
  chung_player_number?: number | null;
  hong_player_number?: number | null;
  weight_category?: string | null;
  match_stage?: string | null;
  age_group?: string | null;
  gender?: string | null;
  team_chung?: string | null;
  team_hong?: string | null;
  chung_score: number | null;
  hong_score: number | null;
  current_round: number | null;
  tournament_id: string | null;
  updated_at: string;
  online?: boolean;
  locked?: boolean;
  lock_reason?: string | null;
}

// A heartbeat older than this is treated as "unknown" rather than trusted —
// the instance that wrote it may have been closed, crashed, or lost network
// without ever getting a chance to write a final 'idle'/'finished' row.
const STALE_MS = 30 * 1000;

function toDisplayStatus(status: MatchState['status']): MatDisplayStatus {
  if (status === 'finished') return 'finished';
  if (status === 'waiting') return 'waiting';
  if (status === 'paused' || status === 'timeout' || status === 'rest' || status === 'kyeshi' || status === 'ivr' || status === 'doctor') return 'paused';
  return 'running'; // 'fighting'
}

/**
 * Best-effort heartbeat write — called periodically by the operator
 * instance currently running a match on this mat (see OperatorScreen.tsx).
 * Silently no-ops when Supabase isn't configured or the write fails,
 * exactly like session-recovery's snapshot save: never fatal to live
 * match operation.
 */
export async function pushMatHeartbeat(state: MatchState): Promise<void> {
  if (!isSupabaseConfigured || !state.matNumber) return;
  try {
    await registerMatHeartbeat(state.matNumber, getMatDeviceName() || null);
    await (supabase as any).from('mat_live_status').upsert({
      mat_number: state.matNumber,
      device_name: getMatDeviceName() || null,
      status: toDisplayStatus(state.status),
      competition_name: state.competitionName || null,
      match_number: state.matchNumber || null,
      chung_name: state.chung?.player?.name || null,
      hong_name: state.hong?.player?.name || null,
      chung_nationality: state.chung?.player?.nationality || null,
      hong_nationality: state.hong?.player?.nationality || null,
      chung_club: state.chung?.player?.club || null,
      hong_club: state.hong?.player?.club || null,
      chung_player_number: state.chung?.player?.playerNumber ?? null,
      hong_player_number: state.hong?.player?.playerNumber ?? null,
      weight_category: state.weightCategory || null,
      match_stage: state.matchStage || null,
      age_group: state.ageGroup || null,
      gender: state.gender || null,
      team_chung: state.teamNames?.chung || null,
      team_hong: state.teamNames?.hong || null,
      chung_score: state.chung?.totalScore ?? null,
      hong_score: state.hong?.totalScore ?? null,
      current_round: state.currentRound ?? null,
      tournament_id: state.tournamentId || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'mat_number' });
  } catch {
    // Offline/unreachable — Control Room will just show this mat as stale
    // until connectivity returns. Never blocks the operator.
  }
}

/** Clears this mat's heartbeat back to idle once a match is reset — otherwise a finished/paused status would linger and mislead the Control Room. */
export async function clearMatHeartbeat(matNumber: number): Promise<void> {
  if (!isSupabaseConfigured || !matNumber) return;
  try {
    await (supabase as any).from('mat_live_status').upsert({
      mat_number: matNumber,
      device_name: getMatDeviceName() || null,
      status: 'idle',
      competition_name: null, match_number: null, chung_name: null, hong_name: null,
      chung_nationality: null, hong_nationality: null, chung_club: null, hong_club: null,
      chung_player_number: null, hong_player_number: null, weight_category: null, match_stage: null,
      age_group: null, gender: null,
      team_chung: null, team_hong: null,
      chung_score: null, hong_score: null, current_round: null, tournament_id: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'mat_number' });
  } catch { /* best-effort */ }
}

/** Reads every mat's current heartbeat, marking stale rows as 'idle' rather than trusting old data (see STALE_MS above). Returns [] when Supabase isn't configured — callers should show a "no cloud connection" message, same as everywhere else in the app. */
export async function fetchAllMatStatuses(): Promise<MatLiveStatus[]> {
  if (!isSupabaseConfigured) return fetchMatRegistry() as Promise<MatLiveStatus[]>;
  try {
    const [{ data, error }, registry] = await Promise.all([
      (supabase as any).from('mat_live_status').select('*').order('mat_number', { ascending: true }),
      fetchMatRegistry(),
    ]);
    if (error || !data) return [];
    const now = Date.now();
    const liveRows = (data as MatLiveStatus[]).map(row => {
      const age = now - new Date(row.updated_at).getTime();
      if (age > STALE_MS && row.status !== 'idle') return { ...row, status: 'idle' as MatDisplayStatus };
      return row;
    });
    const byMat = new Map(liveRows.map(row => [row.mat_number, row]));
    for (const r of registry) {
      const current = byMat.get(r.mat_number);
      const age = now - new Date(r.updated_at).getTime();
      const online = age <= STALE_MS;
      byMat.set(r.mat_number, { ...(current || { mat_number: r.mat_number, status: 'idle', competition_name: null, match_number: null, chung_name: null, hong_name: null, chung_score: null, hong_score: null, current_round: null, tournament_id: null, updated_at: r.updated_at }), online, locked: r.locked, lock_reason: r.lock_reason, device_name: r.device_name || current?.device_name, status: online ? (current?.status || 'idle') : 'idle' });
    }
    return Array.from(byMat.values()).sort((a,b)=>a.mat_number-b.mat_number);
  } catch {
    return [];
  }
}
