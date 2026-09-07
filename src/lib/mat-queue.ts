import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

export interface MatQueuedMatch {
  mat_number: number;
  tournament_id: string;
  bracket_match_id: string;
  match_number: number;
  player1: any;
  player2: any;
  round?: number;
  total_rounds?: number;
  status: 'queued' | 'claimed' | 'started' | 'cancelled';
  queued_at: string;
  claimed_at?: string | null;
}

const KEY = 'wab-tkd-mat-queue-v1';
const loadLocal = (): MatQueuedMatch[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const saveLocal = (v: MatQueuedMatch[]) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* best effort */ } };

export async function queueMatchForMat(item: Omit<MatQueuedMatch, 'queued_at' | 'status'>): Promise<boolean> {
  const { isMatLocked } = await import('@/lib/mat-registry');
  if (await isMatLocked(item.mat_number)) return false;
  const row: MatQueuedMatch = { ...item, status: 'queued', queued_at: new Date().toISOString(), claimed_at: null };
  if (isSupabaseConfigured) {
    try { const { error } = await (supabase as any).from('mat_match_queue').upsert(row, { onConflict: 'mat_number' }); if (!error) return true; } catch { /* local fallback */ }
  }
  saveLocal([...loadLocal().filter(x => x.mat_number !== row.mat_number), row]);
  return true;
}

export async function getQueuedMatchForMat(matNumber: number): Promise<MatQueuedMatch | null> {
  if (isSupabaseConfigured) {
    try { const { data, error } = await (supabase as any).from('mat_match_queue').select('*').eq('mat_number', matNumber).maybeSingle(); if (!error && data && ['queued','claimed'].includes(data.status)) return data as MatQueuedMatch; } catch { /* local fallback */ }
  }
  return loadLocal().find(x => x.mat_number === matNumber && ['queued','claimed'].includes(x.status)) || null;
}

export async function claimQueuedMatch(matNumber: number): Promise<MatQueuedMatch | null> {
  const { isMatLocked } = await import('@/lib/mat-registry');
  if (await isMatLocked(matNumber)) return null;
  const current = await getQueuedMatchForMat(matNumber); if (!current) return null;
  const claimed = { ...current, status: 'claimed' as const, claimed_at: new Date().toISOString() };
  if (isSupabaseConfigured) {
    try { const { error } = await (supabase as any).from('mat_match_queue').update({ status: 'claimed', claimed_at: claimed.claimed_at }).eq('mat_number', matNumber).eq('status', 'queued'); if (!error) return claimed; } catch { /* local fallback */ }
  }
  saveLocal(loadLocal().map(x => x.mat_number === matNumber ? claimed : x)); return claimed;
}

export async function clearQueuedMatch(matNumber: number): Promise<void> {
  if (isSupabaseConfigured) { try { await (supabase as any).from('mat_match_queue').delete().eq('mat_number', matNumber); } catch { /* local fallback */ } }
  saveLocal(loadLocal().filter(x => x.mat_number !== matNumber));
}

export async function listQueuedMatches(): Promise<MatQueuedMatch[]> {
  if (isSupabaseConfigured) { try { const { data, error } = await (supabase as any).from('mat_match_queue').select('*').order('mat_number', { ascending: true }); if (!error && data) return data as MatQueuedMatch[]; } catch { /* local fallback */ } }
  return loadLocal();
}

export async function reassignQueuedMatch(fromMat: number, toMat: number): Promise<boolean> {
  if (fromMat === toMat) return true;
  const current = await getQueuedMatchForMat(fromMat);
  if (!current) return false;
  const target = await getQueuedMatchForMat(toMat);
  if (target) return false;
  const { isMatLocked } = await import('@/lib/mat-registry');
  if (await isMatLocked(toMat)) return false;
  const moved = { ...current, mat_number: toMat, queued_at: new Date().toISOString(), claimed_at: null, status: 'queued' as const };
  if (isSupabaseConfigured) {
    try {
      const { error: insertError } = await (supabase as any).from('mat_match_queue').upsert(moved, { onConflict: 'mat_number' });
      if (!insertError) { await (supabase as any).from('mat_match_queue').delete().eq('mat_number', fromMat); return true; }
    } catch {}
  }
  saveLocal([...loadLocal().filter(x => x.mat_number !== fromMat && x.mat_number !== toMat), moved]);
  return true;
}
