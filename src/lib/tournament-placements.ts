// TOURNAMENT PLACEMENTS — closes the gap documented at the bottom of
// club-points.ts: a persisted "who got gold/silver/bronze, for which
// club" record per finished tournament, so medal points can be added to
// the club/team points engine without guessing or backfilling anything.
//
// Populated automatically, exactly once per tournament, the moment its
// FINAL bracket match gets a winner (see OperatorScreen.tsx's existing
// bracket-advance effect, which already detects "this was the final
// match" — nextMatchId is empty). Bronze follows the standard WT
// double-bronze rule: both semifinal losers get bronze (no separate
// 3rd-place playoff exists in this app's bracket model). League mode has
// no single-elimination "final", so it is intentionally NOT covered here
// — the historical gap is closed by the finalization path in TournamentManager.tsx.
//
// Never backfilled for tournaments that finished before this file
// existed — those simply have no placement record, same policy already
// used for chung_club/hong_club on old matches (see match-local.ts).

import { logAudit } from './audit-log';

const KEY = 'kyorugi_tournament_placements_v1';

export type Medal = 'gold' | 'silver' | 'bronze';

export interface PlacementRecord {
  tournamentId: string;
  tournamentName: string;
  weightCategory?: string | null;
  ageGroup?: string | null;
  gender?: string | null;
  recordedAt: string;
  medals: { club: string; medal: Medal; playerName: string }[];
}

function readAll(): PlacementRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(list: PlacementRecord[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 500))); } catch { /* best-effort */ }
}

export function getPlacementRecords(): PlacementRecord[] {
  return readAll();
}

export function hasPlacementRecord(tournamentId: string): boolean {
  return readAll().some(r => r.tournamentId === tournamentId);
}

/**
 * Records gold/silver/(one or two) bronze for one finished bracket, once.
 * A club-less medal (player has no `club` set) is still recorded under an
 * empty string — the caller/aggregator is responsible for deciding
 * whether to show/count "no club" entries; never invented here.
 */
export function recordPlacements(rec: Omit<PlacementRecord, 'recordedAt'>) {
  if (hasPlacementRecord(rec.tournamentId)) return; // never double-record
  const list = readAll();
  list.unshift({ ...rec, recordedAt: new Date().toISOString() });
  writeAll(list);
  logAudit('tournament_placements_recorded', `${rec.tournamentName}: ${rec.medals.map(m => `${m.medal}=${m.playerName}`).join(', ')}`);
}

export interface ClubMedalTotals {
  club: string;
  gold: number;
  silver: number;
  bronze: number;
}

export function computeClubMedalTotals(filterTournamentId?: string): ClubMedalTotals[] {
  const table = new Map<string, ClubMedalTotals>();
  const get = (club: string) => {
    const key = club.trim();
    if (!table.has(key)) table.set(key, { club: key, gold: 0, silver: 0, bronze: 0 });
    return table.get(key)!;
  };
  for (const rec of readAll()) {
    if (filterTournamentId && rec.tournamentId !== filterTournamentId) continue;
    for (const m of rec.medals) {
      if (!m.club) continue;
      get(m.club)[m.medal]++;
    }
  }
  return Array.from(table.values());
}

/**
 * League mode (round-robin) has no single-elimination "final match" event
 * to hook into here the way bracket mode does, so this file itself never
 * calls recordPlacements() for a league. That does NOT mean league
 * tournaments go without medal points, though: TournamentManager.tsx
 * calls recordPlacements() directly for league mode once the organizer's
 * chosen leagueMedalTrigger fires — either manually (an explicit "End
 * League & Award Medals" button) or automatically the instant every
 * match has a winner, per their per-tournament setting. hasPlacementRecord()
 * guards both bracket and league paths identically, so neither can ever
 * double-record. See DOCUMENTATION.md §7.1 for the full write-up (this
 * was historically listed as an unsolved gap; it is closed in
 * TournamentManager.tsx without needing any change to this file).
 */
