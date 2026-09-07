// WARNING PENALTY SYSTEM
// =======================
// A WARNING is administrative: it does not touch the live gamjeom/scoring
// system inside a match (see match-engine.ts — that stays untouched). A
// warning instead deducts configurable points from a player/team/club's
// TOURNAMENT/CLUB total, independent of match score. Recorded by the Main
// Referee (or Admin), always with a reason, always audited.

import { logAudit } from './audit-log';

export interface WarningReasonConfig {
  id: string;
  label: string;      // English
  labelAr: string;     // Arabic
  penaltyPoints: number; // points deducted from the club/team tournament total
}

export interface WarningRecord {
  id: string;
  ts: string; // ISO timestamp
  reasonId: string;
  reasonLabel: string; // snapshot of the reason's label at time of recording (reasons can be edited/removed later)
  penaltyPoints: number; // snapshot of the point value at time of recording — editing a reason later never rewrites history
  playerName?: string;
  teamName?: string;
  club?: string;
  matchNumber?: number;
  competitionName?: string;
  tournamentId?: string;
  operator?: string;
}

const REASONS_KEY = 'kyorugi_warning_reasons_v1';
const RECORDS_KEY = 'kyorugi_warning_records_v1';

const DEFAULT_REASONS: WarningReasonConfig[] = [
  { id: 'late_weigh_in', label: 'Late weigh-in', labelAr: 'التأخر عن الوزن', penaltyPoints: 2 },
  { id: 'unsporting_conduct', label: 'Unsporting conduct', labelAr: 'سلوك غير رياضي', penaltyPoints: 5 },
  { id: 'coach_misconduct', label: 'Coach misconduct', labelAr: 'مخالفة من المدرب', penaltyPoints: 5 },
  { id: 'equipment_violation', label: 'Equipment violation', labelAr: 'مخالفة في المعدات', penaltyPoints: 1 },
  { id: 'no_show', label: 'No-show / forfeit', labelAr: 'الغياب عن المباراة', penaltyPoints: 10 },
];

export function getWarningReasons(): WarningReasonConfig[] {
  try {
    const raw = localStorage.getItem(REASONS_KEY);
    if (!raw) return DEFAULT_REASONS;
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length > 0 ? list : DEFAULT_REASONS;
  } catch {
    return DEFAULT_REASONS;
  }
}

export function saveWarningReasons(reasons: WarningReasonConfig[]) {
  try {
    localStorage.setItem(REASONS_KEY, JSON.stringify(reasons));
    logAudit('warning_reasons_updated', `${reasons.length} reason(s) configured`);
  } catch { /* best-effort */ }
}

export function getWarningRecords(): WarningRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordWarning(input: Omit<WarningRecord, 'id' | 'ts'>): WarningRecord {
  const entry: WarningRecord = { ...input, id: crypto.randomUUID(), ts: new Date().toISOString() };
  try {
    const list = getWarningRecords();
    list.unshift(entry);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(list.slice(0, 1000)));
  } catch { /* best-effort */ }
  logAudit(
    'warning_recorded',
    `${entry.reasonLabel} (-${entry.penaltyPoints}pt) — ${entry.club || entry.teamName || entry.playerName || 'unknown'}${entry.matchNumber ? ` — match #${entry.matchNumber}` : ''}`,
  );
  return entry;
}

export function deleteWarning(id: string) {
  try {
    const list = getWarningRecords().filter((w) => w.id !== id);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(list));
    logAudit('warning_deleted', id);
  } catch { /* best-effort */ }
}

/** Total penalty points a given club has accumulated (all warnings, all time/tournaments). */
export function getClubPenaltyTotal(club: string): number {
  return getWarningRecords()
    .filter((w) => (w.club || w.teamName || '').trim().toLowerCase() === club.trim().toLowerCase())
    .reduce((sum, w) => sum + w.penaltyPoints, 0);
}
