// MATCH LOCK — protects finished matches from accidental edits/deletion.
//
// Rule: any match with status === 'finished' is LOCKED by default, the
// instant it finishes — no separate "lock" action needed. To delete or
// otherwise edit a finished match's saved record, an operator must first
// explicitly UNLOCK it (an authorized, deliberate action), which is
// audit-logged like every other sensitive action in this app (see
// audit-log.ts — reused here, not a second logger). Locking back is also
// explicit and audited.
//
// This only gates the local UI paths that can mutate a finished match's
// record (ResultView's delete actions today). It does not change scoring,
// judging, or any V38 match logic.

import { logAudit } from './audit-log';

const KEY = 'kyorugi_match_unlocked';

function readUnlocked(): Record<string, { at: string; reason?: string }> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeUnlocked(map: Record<string, { at: string; reason?: string }>) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* best-effort */ }
}

/** A match is locked unless it has been explicitly, currently unlocked. */
export function isMatchLocked(matchId: string): boolean {
  const map = readUnlocked();
  return !map[matchId];
}

export function unlockMatch(matchId: string, label: string, reason?: string) {
  const map = readUnlocked();
  map[matchId] = { at: new Date().toISOString(), reason };
  writeUnlocked(map);
  logAudit('match_unlocked', `${label}${reason ? ` — ${reason}` : ''}`);
}

/** Re-lock a match that was previously unlocked (e.g. after the correction is done). */
export function lockMatch(matchId: string, label: string) {
  const map = readUnlocked();
  if (!map[matchId]) return;
  delete map[matchId];
  writeUnlocked(map);
  logAudit('match_relocked', label);
}

export function logMatchDeleted(label: string, count = 1) {
  logAudit('match_deleted', count > 1 ? `${count} matches — ${label}` : label);
}
