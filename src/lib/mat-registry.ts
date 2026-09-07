import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

export interface MatRegistryState {
  mat_number: number;
  device_name: string | null;
  online: boolean;
  locked: boolean;
  lock_reason: string | null;
  updated_at: string;
}

const KEY = 'wab-tkd-mat-registry-v1';
const loadLocal = (): MatRegistryState[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const saveLocal = (v: MatRegistryState[]) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };

export async function registerMatHeartbeat(matNumber: number, deviceName?: string | null): Promise<void> {
  if (!matNumber) return;
  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    try {
      await (supabase as any).from('mat_registry').upsert({ mat_number: matNumber, device_name: deviceName || null, online: true, updated_at: now }, { onConflict: 'mat_number' });
      return;
    } catch {}
  }
  const current = loadLocal();
  const old = current.find(x => x.mat_number === matNumber);
  saveLocal([...current.filter(x => x.mat_number !== matNumber), { mat_number: matNumber, device_name: deviceName || old?.device_name || null, online: true, locked: old?.locked || false, lock_reason: old?.lock_reason || null, updated_at: now }]);
}

export async function fetchMatRegistry(): Promise<MatRegistryState[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase as any).from('mat_registry').select('*').order('mat_number', { ascending: true });
      if (!error && data) return data as MatRegistryState[];
    } catch {}
  }
  return loadLocal();
}

export async function getMatRegistryState(matNumber: number): Promise<MatRegistryState | null> {
  const all = await fetchMatRegistry();
  return all.find(x => x.mat_number === matNumber) || null;
}

export async function setMatLocked(matNumber: number, locked: boolean, reason = ''): Promise<boolean> {
  const now = new Date().toISOString();
  const payload = { mat_number: matNumber, locked, lock_reason: locked ? reason.trim().slice(0, 160) || 'Locked by supervisor' : null, updated_at: now };
  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase as any).from('mat_registry').upsert(payload, { onConflict: 'mat_number' });
      if (!error) return true;
    } catch {}
  }
  const current = loadLocal();
  const old = current.find(x => x.mat_number === matNumber);
  saveLocal([...current.filter(x => x.mat_number !== matNumber), { mat_number: matNumber, device_name: old?.device_name || null, online: old?.online || false, locked, lock_reason: payload.lock_reason, updated_at: now }]);
  return true;
}

export async function isMatLocked(matNumber: number): Promise<boolean> {
  const row = await getMatRegistryState(matNumber);
  return !!row?.locked;
}

export async function setMatOnline(matNumber: number, online: boolean): Promise<void> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured) { try { await (supabase as any).from('mat_registry').upsert({ mat_number: matNumber, online, updated_at: now }, { onConflict: 'mat_number' }); return; } catch {} }
  const current = loadLocal(); const old=current.find(x=>x.mat_number===matNumber); saveLocal([...current.filter(x=>x.mat_number!==matNumber), { mat_number:matNumber, device_name:old?.device_name||null, online, locked:old?.locked||false, lock_reason:old?.lock_reason||null, updated_at:now }]);
}
