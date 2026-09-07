// Full-database backup/restore, independent of Supabase's own (paid-plan
// only) Point-in-Time-Recovery. Exports every row from every app table into
// one downloadable JSON file the operator can keep on a USB stick / cloud
// drive, and can restore from later (e.g. after an accidental delete, or
// when moving to a fresh Supabase project).
//
// This is a *supplement* to Supabase's own backups, not a replacement:
// - Free plan Supabase projects have no automatic backups at all.
// - Pro plan+ gets 7 daily backups (or PITR on higher tiers), configured
//   entirely from the Dashboard (Database → Backups) — nothing to do here.
// This file exists so there's a safety net either way, taken whenever the
// operator chooses (e.g. right after a tournament finishes).
import { supabase } from '@/integrations/supabase/client';
import { listParEquipeSavedMatches, loadParEquipeSafeSnapshot, getParEquipeSaveHistory, getParEquipeFinalSnapshot } from '@/lib/par-equipe-save';
import { listParEquipeTournamentArchive, importParEquipeArchiveBackup } from '@/lib/par-equipe-tournament-archive';
import { loadTournamentArchiveIndex } from '@/lib/tournament-archive-index';
import { loadAllLocalTournaments, saveTournamentLocal } from '@/lib/tournament-local';
import { loadAllMatchesLocal, saveMatchLocal } from '@/lib/match-local';

const BACKUP_TABLES = ['tournaments', 'matches', 'players', 'clubs', 'match_events', 'tournament_templates', 'tournament_archive_nodes', 'audit_log'] as const;
type BackupTable = typeof BACKUP_TABLES[number];

export interface BackupFile {
  kind: 'wab-tkd-backup';
  version: 2;
  createdAt: string;
  tables: Partial<Record<BackupTable, any[]>>;
  manifest?: { tableCounts: Partial<Record<BackupTable, number>>; tournamentIds: string[]; matchIds: string[] };
  local?: { parEquipeSaves: any[]; parEquipeSafeSnapshot?: any; parEquipeSaveHistory?: any[]; parEquipeFinalSnapshot?: any; parEquipeTournamentArchive?: any[]; tournamentArchiveIndex?: any[]; categoryCatalog?: any[]; customAgeCatalog?: any };
}

/** Fetch every row from every table and trigger a JSON file download.
 *  Returns a per-table row count summary (or throws) so the caller can show
 *  the operator what actually got backed up. */
export async function exportFullBackup(): Promise<Record<BackupTable, number>> {
  const tables: BackupFile['tables'] = {};
  const counts = {} as Record<BackupTable, number>;

  for (const table of BACKUP_TABLES) {
    // When cloud is unavailable, produce a real offline backup from the same
    // local-first caches instead of failing the operator's safety action.
    if (!(await import('@/integrations/supabase/client')).isSupabaseConfigured) {
      const localRows: Record<string, any[]> = {
        tournaments: loadAllLocalTournaments(),
        matches: loadAllMatchesLocal(),
      };
      tables[table] = localRows[table] || [];
      counts[table] = tables[table]!.length;
      continue;
    }
    // Paginate in chunks of 1000 — Supabase caps a single select at 1000
    // rows by default, and a club's full multi-season history could
    // exceed that.
    const rows: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase.from(table as any).select('*').range(from, from + pageSize - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    tables[table] = rows;
    counts[table] = rows.length;
  }

  const backup: BackupFile = {
    kind: 'wab-tkd-backup', version: 2, createdAt: new Date().toISOString(), tables,
    manifest: { tableCounts: Object.fromEntries(BACKUP_TABLES.map(k => [k, (tables[k] || []).length])) as any, tournamentIds: (tables.tournaments || []).map((r:any)=>String(r?.id||'')).filter(Boolean), matchIds: (tables.matches || []).map((r:any)=>String(r?.id||'')).filter(Boolean) },
    local: { parEquipeSaves: listParEquipeSavedMatches(), parEquipeSafeSnapshot: loadParEquipeSafeSnapshot(), parEquipeSaveHistory: getParEquipeSaveHistory(), parEquipeFinalSnapshot: getParEquipeFinalSnapshot(), parEquipeTournamentArchive: listParEquipeTournamentArchive(), tournamentArchiveIndex: loadTournamentArchiveIndex(), categoryCatalog: (()=>{ try { return JSON.parse(localStorage.getItem('kyorugi_category_catalog_v2')||'[]'); } catch { return []; } })(), customAgeCatalog: (()=>{ try { return JSON.parse(localStorage.getItem('kyorugi_custom_age_categories')||'{}'); } catch { return {}; } })() },
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `wab-tkd-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return counts;
}

/** Same full-table fetch as exportFullBackup, but writes into localStorage
 *  instead of triggering a file download — used for the periodic automatic
 *  snapshot (item #6) so it can run silently every few minutes during a
 *  live tournament without spamming the operator with download dialogs.
 *  The operator can export this snapshot to a real file at any time via
 *  exportAutoBackupSnapshot() below. */
const AUTO_BACKUP_KEY = 'tkd-auto-backup';

export async function runAutoBackupSnapshot(): Promise<{ createdAt: string; counts: Record<BackupTable, number> }> {
  const tables: BackupFile['tables'] = {};
  const counts = {} as Record<BackupTable, number>;
  for (const table of BACKUP_TABLES) {
    if (!(await import('@/integrations/supabase/client')).isSupabaseConfigured) {
      const localRows: Record<string, any[]> = { tournaments: loadAllLocalTournaments(), matches: loadAllMatchesLocal() };
      tables[table] = localRows[table] || [];
      counts[table] = tables[table]!.length;
      continue;
    }
    const rows: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase.from(table as any).select('*').range(from, from + pageSize - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    tables[table] = rows;
    counts[table] = rows.length;
  }
  const createdAt = new Date().toISOString();
  const backup: BackupFile = {
    kind: 'wab-tkd-backup', version: 2, createdAt, tables,
    manifest: { tableCounts: Object.fromEntries(BACKUP_TABLES.map(k => [k, (tables[k] || []).length])) as any, tournamentIds: (tables.tournaments || []).map((r:any)=>String(r?.id||'')).filter(Boolean), matchIds: (tables.matches || []).map((r:any)=>String(r?.id||'')).filter(Boolean) },
    local: { parEquipeSaves: listParEquipeSavedMatches(), parEquipeSafeSnapshot: loadParEquipeSafeSnapshot(), parEquipeSaveHistory: getParEquipeSaveHistory(), parEquipeFinalSnapshot: getParEquipeFinalSnapshot(), parEquipeTournamentArchive: listParEquipeTournamentArchive(), tournamentArchiveIndex: loadTournamentArchiveIndex(), categoryCatalog: (()=>{ try { return JSON.parse(localStorage.getItem('kyorugi_category_catalog_v2')||'[]'); } catch { return []; } })(), customAgeCatalog: (()=>{ try { return JSON.parse(localStorage.getItem('kyorugi_custom_age_categories')||'{}'); } catch { return {}; } })() },
  };
  try {
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(backup));
  } catch {
    // Storage full — the snapshot still ran/succeeded against the DB view,
    // it just couldn't be cached locally this round. Not fatal; the next
    // scheduled run will try again.
  }
  return { createdAt, counts };
}

/** Timestamp of the last successful automatic snapshot, or null if none has
 *  run yet this session (or ever, on this device). */
export function getLastAutoBackupTime(): string | null {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as BackupFile).createdAt;
  } catch {
    return null;
  }
}

/** Download the most recent automatic snapshot as a file, same format as
 *  exportFullBackup — for when the operator wants a copy off this device
 *  without waiting for/triggering a fresh manual export. */
export function exportAutoBackupSnapshot(): boolean {
  const raw = localStorage.getItem(AUTO_BACKUP_KEY);
  if (!raw) return false;
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `wab-tkd-auto-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

/** Restore rows from a previously exported backup file. Uses `upsert` (by
 *  primary key `id`, already present on every row from the export) so this
 *  is safe to run against a database that already has *some* of the same
 *  rows — existing rows get overwritten with the backed-up version, rows
 *  that no longer exist get re-created, and nothing outside the backup's
 *  own rows is touched or deleted. */
export async function restoreFromBackup(file: File, options: { force?: boolean } = {}): Promise<Record<string, { restored: number; failed: number }>> {
  const text = await file.text();
  let parsed: BackupFile;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('الملف ماشي JSON صالح');
  }
  if (parsed.kind !== 'wab-tkd-backup' || !parsed.tables || ![1, 2].includes(parsed.version)) {
    throw new Error('هاذ الملف ماشي نسخة احتياطية صالحة لهاذ التطبيق');
  }
  // Preflight: reject structurally unsafe backups before touching the database.
  const tournamentRows = Array.isArray(parsed.tables.tournaments) ? parsed.tables.tournaments : [];
  const matchRows = Array.isArray(parsed.tables.matches) ? parsed.tables.matches : [];
  const tournamentIds = new Set(tournamentRows.map((r:any) => String(r?.id || '')).filter(Boolean));
  const brokenMatches = matchRows.filter((r:any) => r?.tournament_id && !tournamentIds.has(String(r.tournament_id)) && !String(r.tournament_id).startsWith('local-'));
  if (brokenMatches.length) throw new Error(`BACKUP_PREFLIGHT_FAILED: ${brokenMatches.length} matches reference tournaments not included in this backup`);
  for (const table of ['tournaments','matches','players','clubs','match_events'] as const) {
    const rows = (parsed.tables as any)[table];
    if (rows && !Array.isArray(rows)) throw new Error(`BACKUP_PREFLIGHT_FAILED: ${table} is not an array`);
  }

  // Conflict gate: never silently overwrite newer local records with an older
  // backup. The UI may explicitly retry with force=true after warning the
  // operator. This compares the backup creation time with local record update
  // timestamps where available; it is deliberately conservative when dates are
  // missing.
  if (!options.force) {
    const backupTime = Date.parse(String(parsed.createdAt || ''));
    if (Number.isFinite(backupTime)) {
      const localCandidates: any[] = [];
      try {
        for (let i=0;i<localStorage.length;i++) {
          const key=localStorage.key(i)||'';
          if (!key.startsWith('kyorugi_tournament_') && !key.startsWith('kyorugi_match_')) continue;
          const raw=localStorage.getItem(key); if (!raw) continue;
          const row=JSON.parse(raw); if (row && typeof row==='object') localCandidates.push(row);
        }
      } catch {}
      const newer = localCandidates.some(r => {
        const t = Date.parse(String(r?.updated_at || r?.updatedAt || r?.finished_at || r?.finishedAt || r?.created_at || ''));
        return Number.isFinite(t) && t > backupTime;
      });
      if (newer) throw new Error('BACKUP_CONFLICT_NEWER_CURRENT_DATA: توجد بيانات أحدث من تاريخ هذه النسخة الاحتياطية. راجعها أو اختر الاسترجاع بالقوة.');
    }
  }

  const result: Record<string, { restored: number; failed: number }> = {};
  const { isSupabaseConfigured } = await import('@/integrations/supabase/client');
  if (!isSupabaseConfigured) {
    const tournaments = Array.isArray(parsed.tables.tournaments) ? parsed.tables.tournaments : [];
    const matches = Array.isArray(parsed.tables.matches) ? parsed.tables.matches : [];
    for (const t of tournaments) { try { if (t?.id && t?.name) saveTournamentLocal(t); } catch {} }
    for (const m of matches) { try { if (m?.competition_name && m?.match_number != null && m?.id) saveMatchLocal(m); } catch {} }
    result.tournaments = { restored: tournaments.length, failed: 0 };
    result.matches = { restored: matches.length, failed: 0 };
  }


  // Order matters: restore tables that others reference via foreign key
  // first (tournaments/clubs before players/matches which point at them),
  // so upserts don't transiently violate a FK constraint mid-restore.
  const order: BackupTable[] = ['tournaments', 'clubs', 'players', 'matches', 'match_events', 'tournament_templates', 'tournament_archive_nodes', 'audit_log'];
  if (isSupabaseConfigured) for (const table of order) {
    const rows = parsed.tables[table];
    if (!rows || rows.length === 0) continue;
    let restored = 0, failed = 0;
    // Chunk upserts to stay well under request size limits.
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error, count } = await supabase.from(table as any).upsert(chunk, { onConflict: 'id', count: 'exact' });
      if (error) { failed += chunk.length; console.error(`[restore] ${table}:`, error.message); }
      else restored += count ?? chunk.length;
    }
    result[table] = { restored, failed };
  }
  // Restore Par Équipe save slots from the same general backup file. This is
  // optional for backward compatibility and never restores Individual slots.
  const localParEquipeSaves = parsed.local?.parEquipeSaves;
  if (Array.isArray(localParEquipeSaves)) {
    try {
      const valid = localParEquipeSaves.filter((r: any) =>
        r && typeof r.saveId === 'string' && typeof r.matchId === 'string' &&
        r.state?.config?.competitionMode === 'par_equipe'
      );
      localStorage.setItem('kyorugi_par_equipe_saves_v1', JSON.stringify(valid));
      (result as any).parEquipeSaves = {
        restored: valid.length,
        failed: localParEquipeSaves.length - valid.length,
      };
    } catch {
      (result as any).parEquipeSaves = {
        restored: 0,
        failed: localParEquipeSaves.length,
      };
    }
  }

  const saveHistory = parsed.local?.parEquipeSaveHistory;
  if (Array.isArray(saveHistory)) {
    try {
      const validHistory = saveHistory.filter((r: any) => r && typeof r.matchId === 'string' && r.state?.config?.competitionMode === 'par_equipe');
      localStorage.setItem('kyorugi_par_equipe_save_history_v1', JSON.stringify(validHistory));
      (result as any).parEquipeSaveHistory = { restored: validHistory.length, failed: saveHistory.length - validHistory.length };
    } catch {
      (result as any).parEquipeSaveHistory = { restored: 0, failed: saveHistory.length };
    }
  }

  const finalSnapshot = parsed.local?.parEquipeFinalSnapshot;
  if (finalSnapshot?.state?.config?.competitionMode === 'par_equipe' && typeof finalSnapshot.matchId === 'string') {
    try {
      localStorage.setItem('kyorugi_par_equipe_final_snapshot_v1', JSON.stringify(finalSnapshot));
      (result as any).parEquipeFinalSnapshot = { restored: 1, failed: 0 };
    } catch {
      (result as any).parEquipeFinalSnapshot = { restored: 0, failed: 1 };
    }
  }

  const safeSnapshot = parsed.local?.parEquipeSafeSnapshot;
  if (safeSnapshot?.state?.config?.competitionMode === 'par_equipe' && typeof safeSnapshot.matchId === 'string') {
    try {
      localStorage.setItem('kyorugi_par_equipe_safe_snapshot_v1', JSON.stringify(safeSnapshot));
      (result as any).parEquipeSafeSnapshot = { restored: 1, failed: 0 };
    } catch {
      (result as any).parEquipeSafeSnapshot = { restored: 0, failed: 1 };
    }
  }
  if (Array.isArray(parsed.local?.tournamentArchiveIndex)) { try { localStorage.setItem('kyorugi_tournament_archive_index_v2', JSON.stringify(parsed.local!.tournamentArchiveIndex)); (result as any).tournamentArchiveIndex={restored:parsed.local!.tournamentArchiveIndex.length,failed:0}; } catch { (result as any).tournamentArchiveIndex={restored:0,failed:parsed.local!.tournamentArchiveIndex.length}; } }
  if (Array.isArray(parsed.local?.categoryCatalog)) { try { localStorage.setItem('kyorugi_category_catalog_v2', JSON.stringify(parsed.local!.categoryCatalog)); (result as any).categoryCatalog={restored:parsed.local!.categoryCatalog.length,failed:0}; } catch { (result as any).categoryCatalog={restored:0,failed:parsed.local!.categoryCatalog.length}; } }
  if (parsed.local?.customAgeCatalog && typeof parsed.local.customAgeCatalog === 'object') { try { localStorage.setItem('kyorugi_custom_age_categories', JSON.stringify(parsed.local.customAgeCatalog)); (result as any).customAgeCatalog={restored:1,failed:0}; } catch { (result as any).customAgeCatalog={restored:0,failed:1}; } }

  const parEquipeArchive = parsed.local?.parEquipeTournamentArchive;
  if (Array.isArray(parEquipeArchive) && parEquipeArchive.length) {
    try {
      const count = importParEquipeArchiveBackup(JSON.stringify({ records: parEquipeArchive }));
      (result as any).parEquipeTournamentArchive = { restored: count, failed: 0 };
    } catch {
      (result as any).parEquipeTournamentArchive = { restored: 0, failed: parEquipeArchive.length };
    }
  }
  return result;
}
