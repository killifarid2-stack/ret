import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

const KEY = 'kyorugi_audit_log';
const MAX_ENTRIES = 500;
const PENDING_KEY = 'kyorugi_audit_pending_cloud_v1';

export interface AuditEntry {
  id?: string;
  ts: string;
  action: string;
  details: string;
  actor?: string;
  tournamentId?: string;
  matchId?: string;
  category?: string;
}

export function getAuditActor(): string {
  try { return localStorage.getItem('kyorugi_audit_actor') || ''; } catch { return ''; }
}

export function setAuditActor(name: string) {
  try { localStorage.setItem('kyorugi_audit_actor', name); } catch {}
}

/** Local-first audit with a best-effort cloud mirror. The local log remains
 * the source of truth when offline; the cloud copy becomes available to the
 * final archive when the audit_log migration/table is deployed. */
function readPending(): AuditEntry[] {
  try { const raw = localStorage.getItem(PENDING_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function writePending(entries: AuditEntry[]) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES))); } catch {}
}

export async function flushPendingAuditLog(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const pending = readPending();
  if (!pending.length) return 0;
  const rows = pending.map(entry => ({
    id: entry.id, ts: entry.ts, action: entry.action, details: entry.details,
    actor: entry.actor || null, tournament_id: entry.tournamentId || null,
    match_id: entry.matchId || null, category: entry.category || null,
  }));
  try {
    const { error } = await supabase.from('audit_log' as any).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
    writePending([]);
    return rows.length;
  } catch (e) {
    console.warn('flushPendingAuditLog failed', e);
    return 0;
  }
}

export function logAudit(action: string, details: string | unknown, meta: Partial<AuditEntry> = {}) {
  // Backward-compatible normalizer: older Operations pages passed a metadata
  // object as the second argument. Keep those pages safe while preserving a
  // structured representation in the audit trail.
  const normalizedDetails = typeof details === 'string' ? details : JSON.stringify(details ?? {});
  const entry: AuditEntry = { id: globalThis.crypto?.randomUUID?.(), ts: new Date().toISOString(), action, details: normalizedDetails, actor: getAuditActor() || undefined, ...meta };
  try {
    const raw = localStorage.getItem(KEY);
    const list: AuditEntry[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(KEY, JSON.stringify([entry, ...list].slice(0, MAX_ENTRIES)));
  } catch {}
  if (isSupabaseConfigured) {
    void supabase.from('audit_log' as any).insert({
      id: entry.id, ts: entry.ts, action: entry.action, details: entry.details,
      actor: entry.actor || null, tournament_id: entry.tournamentId || null,
      match_id: entry.matchId || null, category: entry.category || null,
    }).then(({ error }) => {
      if (error) {
        console.warn('audit cloud mirror failed', error.message);
        writePending([entry, ...readPending()]);
      }
    });
  }
}

export async function syncAuditLogFromCloud(): Promise<void> {
  if (!isSupabaseConfigured) return;
  await flushPendingAuditLog();
  try {
    const { data, error } = await supabase.from('audit_log' as any)
      .select('id,ts,action,details,actor,tournament_id,match_id,category')
      .order('ts', { ascending: false }).limit(MAX_ENTRIES);
    if (error) throw error;
    if (!data?.length) return;
    const cloud = data.map((r: any) => ({ id:r.id, ts:r.ts, action:r.action, details:r.details, actor:r.actor||undefined, tournamentId:r.tournament_id||undefined, matchId:r.match_id||undefined, category:r.category||undefined }));
    const local = getAuditLog(); const map = new Map<string, AuditEntry>();
    [...cloud, ...local].forEach(e => map.set(e.id || `${e.ts}|${e.action}|${e.details}`, e));
    const merged = [...map.values()].sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0, MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch (e) { console.warn('syncAuditLogFromCloud failed', e); }
}

export function getAuditLog(): AuditEntry[] {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export function exportAuditLog(): boolean {
  const rows = getAuditLog();
  const blob = new Blob([JSON.stringify({ kind:'wab-tkd-audit-log', version:3, exportedAt:new Date().toISOString(), entries:rows }, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=`wab-tkd-audit-log-${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); return true;
}

export function clearAuditLog() {
  try { localStorage.removeItem(KEY); } catch {}
}
