import { logAudit } from './audit-log';

/**
 * Cross-window/device guard for the same live match.
 * It is intentionally small and local: Supabase remains the source of truth,
 * while this guard prevents two operator windows on the same station from
 * accidentally controlling the same match at once.
 */
export interface MatchControlLease {
  matchId: string;
  matNumber?: number;
  ownerId: string;
  acquiredAt: number;
  expiresAt: number;
}

const KEY = 'wab-tkd-match-control-leases-v1';
const DEFAULT_TTL = 45_000;

function read(): Record<string, MatchControlLease> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function write(v: Record<string, MatchControlLease>) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
}
function cleanup(now = Date.now()) {
  const map = read();
  let changed = false;
  for (const [id, lease] of Object.entries(map)) {
    if (!lease || lease.expiresAt <= now) { delete map[id]; changed = true; }
  }
  if (changed) write(map);
  return map;
}

export function makeControlOwnerId(prefix = 'operator') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

export function acquireMatchLease(matchId: string, ownerId: string, matNumber?: number, ttlMs = DEFAULT_TTL): { ok: boolean; lease?: MatchControlLease; conflict?: MatchControlLease } {
  if (!matchId || !ownerId) return { ok: false };
  const map = cleanup();
  const existing = map[matchId];
  if (existing && existing.ownerId !== ownerId) {
    logAudit('match_control_conflict', `Match ${matchId} already controlled by ${existing.ownerId}`);
    return { ok: false, conflict: existing };
  }
  const now = Date.now();
  const lease: MatchControlLease = { matchId, matNumber, ownerId, acquiredAt: existing?.acquiredAt ?? now, expiresAt: now + ttlMs };
  map[matchId] = lease;
  write(map);
  return { ok: true, lease };
}

export function renewMatchLease(matchId: string, ownerId: string, ttlMs = DEFAULT_TTL): boolean {
  const map = cleanup();
  const lease = map[matchId];
  if (!lease || lease.ownerId !== ownerId) return false;
  lease.expiresAt = Date.now() + ttlMs;
  write(map);
  return true;
}

export function releaseMatchLease(matchId: string, ownerId: string): boolean {
  const map = cleanup();
  const lease = map[matchId];
  if (!lease || lease.ownerId !== ownerId) return false;
  delete map[matchId];
  write(map);
  logAudit('match_control_released', `Match ${matchId}`);
  return true;
}

export function getMatchLease(matchId: string): MatchControlLease | null {
  return cleanup()[matchId] || null;
}

export function clearExpiredMatchLeases(): number {
  const before = Object.keys(read()).length;
  const after = Object.keys(cleanup()).length;
  return before - after;
}
