import { loadAllLocalTournaments } from '@/lib/tournament-local';
import { loadAllMatchesLocal } from '@/lib/match-local';

const KEY = 'kyorugi_tournament_archive_index_v2';

export interface TournamentArchiveIndex {
  tournamentName: string;
  formats: string[];
  genders: Record<string, { ages: Record<string, { weights: string[]; weightStatuses?: Record<string,string>; status?: string }> }>;
  updatedAt: string;
}

export function rebuildTournamentArchiveIndex(): TournamentArchiveIndex[] {
  const map = new Map<string, TournamentArchiveIndex>();
  for (const t of loadAllLocalTournaments()) {
    const name = String(t.name || 'UNTITLED TOURNAMENT').trim() || 'UNTITLED TOURNAMENT';
    const localMatches = loadAllMatchesLocal().filter(m => m.tournament_id === t.id);
    const tournamentStatus = String(t.status || '').toLowerCase();
    const status = localMatches.some(m => ['fighting','rest','paused'].includes(String(m.status).toLowerCase())) ? 'LIVE'
      : localMatches.length && localMatches.every(m => String(m.status).toLowerCase() === 'finished') ? 'FINISHED'
      : localMatches.length ? 'READY'
      : tournamentStatus === 'suspended' ? 'SUSPENDED' : 'NOT_STARTED';
    const entry = map.get(name) || { tournamentName: name, formats: [], genders: {}, updatedAt: new Date().toISOString() };
    if (t.format && !entry.formats.includes(t.format)) entry.formats.push(t.format);
    const g = entry.genders[t.gender] ||= { ages: {} };
    const a = g.ages[t.age_group] ||= { weights: [], weightStatuses: {} };
    a.weightStatuses ||= {};
    const prev = a.status;
    if (status === 'LIVE' || !prev || prev === 'NOT_STARTED' || (prev === 'READY' && status === 'FINISHED')) a.status = status;
    if (t.weight_category && !a.weights.includes(t.weight_category)) a.weights.push(t.weight_category);
    if (t.weight_category) a.weightStatuses[t.weight_category] = status;
    entry.updatedAt = new Date().toISOString();
    map.set(name, entry);
  }
  const rows = [...map.values()].sort((a,b)=>a.tournamentName.localeCompare(b.tournamentName));
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch {}
  return rows;
}

export function loadTournamentArchiveIndex(): TournamentArchiveIndex[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return rebuildTournamentArchiveIndex();
}

export function registerTournamentArchiveCategory(input: { tournamentName:string; gender:string; ageGroup:string; weightCategory:string; format?:string }): void {
  const rows = loadTournamentArchiveIndex();
  let entry = rows.find(r=>r.tournamentName===input.tournamentName);
  if (!entry) { entry={tournamentName:input.tournamentName,formats:[],genders:{},updatedAt:new Date().toISOString()}; rows.push(entry); }
  if(input.format && !entry.formats.includes(input.format)) entry.formats.push(input.format);
  const g=entry.genders[input.gender] ||= {ages:{}};
  const a=g.ages[input.ageGroup] ||= {weights:[],weightStatuses:{}};
  a.weightStatuses ||= {};
  if(input.weightCategory && !a.weights.includes(input.weightCategory)) a.weights.push(input.weightCategory);
  if(input.weightCategory && !a.weightStatuses[input.weightCategory]) a.weightStatuses[input.weightCategory] = 'NOT_STARTED';
  entry.updatedAt=new Date().toISOString();
  try { localStorage.setItem(KEY,JSON.stringify(rows)); } catch {}
}

/** Synchronize the unified Tournament → Gender → Age → Weight index to the
 * additive archive table. This deliberately keeps the existing local index
 * and category tournaments intact, while giving connected devices a shared
 * parent/category catalog. */
export async function syncTournamentArchiveIndexToCloud(): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import('@/integrations/supabase/client');
    if (!isSupabaseConfigured) return;
    const rows = loadTournamentArchiveIndex();
    const payload: any[] = [];
    for (const t of rows) {
      for (const [gender, g] of Object.entries(t.genders)) {
        for (const [ageGroup, a] of Object.entries(g.ages)) {
          for (const weightCategory of a.weights) {
            payload.push({
              tournament_key: t.tournamentName.trim().toLowerCase().replace(/\s+/g, '-'),
              tournament_name: t.tournamentName,
              gender, age_group: ageGroup, weight_category: weightCategory,
              format: t.formats[0] || 'knockout',
              status: a.weightStatuses?.[weightCategory] || 'NOT_STARTED',
              parent_key: t.tournamentName,
              metadata: { formats: t.formats, source: 'wab-tkd-archive-v3' },
              updated_at: new Date().toISOString(),
            });
          }
        }
      }
    }
    if (payload.length) {
      const { error } = await supabase.from('tournament_archive_nodes' as any).upsert(payload, { onConflict: 'tournament_key,gender,age_group,weight_category' });
      if (error) console.warn('syncTournamentArchiveIndexToCloud failed', error.message);
    }
  } catch (e) { console.warn('syncTournamentArchiveIndexToCloud failed', e); }
}

export async function syncTournamentArchiveIndexFromCloud(): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import('@/integrations/supabase/client');
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.from('tournament_archive_nodes' as any)
      .select('tournament_name,gender,age_group,weight_category,format,status,updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const rows = loadTournamentArchiveIndex();
    for (const n0 of data || []) {
      // `tournament_archive_nodes` predates the last `supabase gen types` run,
      // so the generated client types don't know its shape (table itself is
      // real — see migrations/20260904210000_add_archive_and_audit_layers.sql).
      const n = n0 as any;
      if (!n.tournament_name || !n.gender || !n.age_group || !n.weight_category) continue;
      let t = rows.find(x => x.tournamentName === n.tournament_name);
      if (!t) { t = { tournamentName:n.tournament_name, formats:[], genders:{}, updatedAt:n.updated_at || new Date().toISOString() }; rows.push(t); }
      if (n.format && !t.formats.includes(n.format)) t.formats.push(n.format);
      const g = t.genders[n.gender] ||= { ages:{} };
      const a = g.ages[n.age_group] ||= { weights:[] };
      if (n.status) a.status = n.status;
      if (!a.weights.includes(n.weight_category)) a.weights.push(n.weight_category);
      if (n.status && !a.weightStatuses[n.weight_category]) a.weightStatuses[n.weight_category] = n.status;
      t.updatedAt = n.updated_at || t.updatedAt;
    }
    try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch {}
  } catch (e) { console.warn('syncTournamentArchiveIndexFromCloud failed', e); }
}
