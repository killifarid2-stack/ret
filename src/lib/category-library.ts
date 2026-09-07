// ===== Category Library =====
//
// Lets an organizer drill down GENDER → AGE GROUP → WEIGHT CATEGORY and,
// inside a chosen weight, see every match already saved there and add new
// ones with a single "Generate" click (only player/team names are typed —
// tournament name, gender, age group and weight are filled automatically
// from the selected category).
//
// Every match created this way — Individual (1v1) or Par Équipe (team) —
// is attached to ONE canonical "category tournament" per gender+age+weight
// combo, so it always lives inside a Tournament record (never an orphan
// match), and the same bucket is reused every time that combo is picked
// again instead of forking a new tournament per session.
//
// Follows the exact local-first-then-best-effort-cloud-sync pattern already
// used by tournament-local.ts / match-local.ts / TournamentManager, so the
// feature keeps working offline and never blocks on the network.

import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { AGE_GROUPS, getWeightCategories } from '@/lib/tkd-data';
import {
  saveTournamentLocal,
  loadTournamentLocal,
  loadAllLocalTournaments,
  isLocalTournamentId,
  LocalTournamentRecord,
} from '@/lib/tournament-local';
import { saveMatchLocal, loadAllMatchesLocal, LocalMatchRecord } from '@/lib/match-local';
import { registerTournamentArchiveCategory, syncTournamentArchiveIndexToCloud } from '@/lib/tournament-archive-index';

const CUSTOM_WEIGHTS_KEY = 'kyorugi_custom_weight_categories';
const CUSTOM_AGES_KEY = 'kyorugi_custom_age_categories';
const CATEGORY_PLAYERS_PREFIX = 'kyorugi_category_players_';
const CATEGORY_CATALOG_KEY = 'kyorugi_category_catalog_v2';

export { AGE_GROUPS };
export interface CategoryAge { value: string; label: string; }

function loadCustomAgesMap(): Record<string, CategoryAge[]> {
  try { return JSON.parse(localStorage.getItem(CUSTOM_AGES_KEY) || '{}'); } catch { return {}; }
}

export function addCustomAgeCategory(gender: string, age: string): void {
  const value = age.trim();
  if (!value) return;
  const map = loadCustomAgesMap();
  const list = map[gender] || [];
  if (!list.some(a => a.value === value)) {
    map[gender] = [...list, { value, label: value }];
    try { localStorage.setItem(CUSTOM_AGES_KEY, JSON.stringify(map)); } catch {}
  }
  void syncCategoryCatalogToCloud({ gender, ageGroup: value });
  void syncTournamentArchiveIndexToCloud();
}

export function getAllAgeCategories(gender: string): CategoryAge[] {
  const custom = loadCustomAgesMap()[gender] || [];
  const merged = AGE_GROUPS.map(a => ({ value: a.value, label: a.label }));
  for (const a of custom) if (!merged.some(x => x.value === a.value)) merged.push(a);
  return merged;
}

export interface CategoryPlayer { id: string; name: string; club?: string; nationality?: string; number?: number | string; photo?: string; }
export function loadCategoryPlayers(tournamentId: string): CategoryPlayer[] {
  try { return JSON.parse(localStorage.getItem(CATEGORY_PLAYERS_PREFIX + tournamentId) || '[]'); } catch { return []; }
}
export function saveCategoryPlayers(tournamentId: string, players: CategoryPlayer[]): void {
  // Cloud `players.id` is UUID-backed. Give locally-created roster entries a
  // stable UUID before persistence so an offline roster can be promoted to
  // cloud later without silently dropping those players.
  const normalized = players.map(p => ({
    ...p,
    id: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(p.id || ''))
      ? p.id
      : (globalThis.crypto?.randomUUID?.() ?? `p-${Date.now()}-${Math.random().toString(36).slice(2,8)}`),
  }));
  try { localStorage.setItem(CATEGORY_PLAYERS_PREFIX + tournamentId, JSON.stringify(normalized)); } catch {}
  const t = loadTournamentLocal(tournamentId);
  if (t) saveTournamentLocal({ ...t, players: normalized });
  void syncCategoryPlayersToCloud(tournamentId, normalized);
}

function catalogLoad(): Array<{gender:string; ageGroup:string; weightCategory?:string}> {
  try { return JSON.parse(localStorage.getItem(CATEGORY_CATALOG_KEY) || '[]'); } catch { return []; }
}
function catalogSave(rows: Array<{gender:string; ageGroup:string; weightCategory?:string}>) {
  try { localStorage.setItem(CATEGORY_CATALOG_KEY, JSON.stringify(rows)); } catch {}
}

/** Best-effort cross-device catalog using the existing tournament_templates table; no schema migration is required. */
export async function syncCategoryCatalogFromCloud(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data, error } = await supabase.from('tournament_templates').select('gender,age_group,weight_category,extra').eq('extra->>categoryCatalog', 'true');
    if (error) throw error;
    const rows = catalogLoad();
    for (const r of data || []) {
      if (!r.gender || !r.age_group) continue;
      if (!rows.some(x => x.gender===r.gender && x.ageGroup===r.age_group && (x.weightCategory||'')===(r.weight_category||''))) rows.push({gender:r.gender, ageGroup:r.age_group, weightCategory:r.weight_category || undefined});
    }
    catalogSave(rows);
    const ages=loadCustomAgesMap(); const weights=loadCustomWeightsMap();
    for (const r of rows) {
      if (!AGE_GROUPS.some(a=>a.value===r.ageGroup)) { const list=ages[r.gender]||[]; if(!list.some(a=>a.value===r.ageGroup)) ages[r.gender]=[...list,{value:r.ageGroup,label:r.ageGroup}]; }
      if (r.weightCategory) { const k=customWeightsKey(r.gender,r.ageGroup); const list=weights[k]||[]; if(!list.includes(r.weightCategory)) weights[k]=[...list,r.weightCategory]; }
    }
    try { localStorage.setItem(CUSTOM_AGES_KEY, JSON.stringify(ages)); localStorage.setItem(CUSTOM_WEIGHTS_KEY, JSON.stringify(weights)); } catch {}
  } catch (e) { console.warn('syncCategoryCatalogFromCloud failed', e); }
}

async function syncCategoryCatalogToCloud(row: {gender:string;ageGroup:string;weightCategory?:string}) {
  if (!isSupabaseConfigured) return;
  try {
    const existing=catalogLoad(); if(!existing.some(x=>x.gender===row.gender&&x.ageGroup===row.ageGroup&&(x.weightCategory||'')===(row.weightCategory||''))) catalogSave([...existing,row]);
    const { data: existingRemote } = await supabase.from('tournament_templates')
      .select('id').eq('name','WAB-TKD CATEGORY CATALOG').eq('gender',row.gender).eq('age_group',row.ageGroup)
      .eq('weight_category',row.weightCategory || null).eq('extra->>categoryCatalog','true').limit(1);
    if (!existingRemote?.length) {
      await supabase.from('tournament_templates').insert({ name:'WAB-TKD CATEGORY CATALOG', gender:row.gender, age_group:row.ageGroup, weight_category:row.weightCategory || null, extra:{categoryCatalog:true, version:2} });
    }
  } catch (e) { console.warn('syncCategoryCatalogToCloud failed', e); }
}

async function syncCategoryPlayersToCloud(tournamentId:string, players:CategoryPlayer[]) {
  if (!isSupabaseConfigured || isLocalTournamentId(tournamentId)) return;
  try {
    const t = loadTournamentLocal(tournamentId);
    const rows=players.filter(p=>p.name).map(p=>({
      id:p.id,name:p.name,club:p.club||'',nationality:p.nationality||'',photo:p.photo||null,
      player_number:p.number??null,tournament_id:tournamentId,
      age_group:t?.age_group||'senior',gender:t?.gender||'male',weight_category:t?.weight_category||''
    }));
    const valid=rows.filter(r=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.id));
    if (valid.length) await supabase.from('players').upsert(valid as any,{onConflict:'id'});
  } catch (e) { console.warn('syncCategoryPlayersToCloud failed', e); }
}

function customWeightsKey(gender: string, ageGroup: string) {
  return `${ageGroup}_${gender}`;
}

function loadCustomWeightsMap(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_WEIGHTS_KEY) || '{}');
  } catch {
    return {};
  }
}

/** Organizer-added weight category, e.g. a class not in the standard preset list. Persists locally and is offered again for the same gender+age combo. */
export function addCustomWeightCategory(gender: string, ageGroup: string, weight: string): void {
  const trimmed = weight.trim();
  if (!trimmed) return;
  const map = loadCustomWeightsMap();
  const k = customWeightsKey(gender, ageGroup);
  const list = map[k] || [];
  if (!list.includes(trimmed)) {
    map[k] = [...list, trimmed];
    try { localStorage.setItem(CUSTOM_WEIGHTS_KEY, JSON.stringify(map)); } catch { /* localStorage unavailable */ }
  }
  void syncCategoryCatalogToCloud({ gender, ageGroup, weightCategory: trimmed });
  void syncTournamentArchiveIndexToCloud();
}

/** Preset weight categories for this gender/age, plus any custom ones the organizer previously added. */
export function getAllWeightCategories(gender: string, ageGroup: string): string[] {
  const preset = getWeightCategories(ageGroup, gender);
  const custom = loadCustomWeightsMap()[customWeightsKey(gender, ageGroup)] || [];
  const merged = [...preset];
  for (const w of custom) if (!merged.includes(w)) merged.push(w);
  return merged;
}

export interface CategoryBucket {
  gender: string;
  ageGroup: string;
  weightCategory: string;
}

function bucketName(b: CategoryBucket): string {
  const ageLabel = AGE_GROUPS.find(a => a.value === b.ageGroup)?.label || b.ageGroup;
  const genderLabel = b.gender === 'male' ? 'Male' : 'Female';
  return `${genderLabel} · ${ageLabel} · ${b.weightCategory}`.replace(/\s+/g, ' ').trim();
}

export interface CategoryTournamentRef {
  id: string;
  name: string;
}

/**
 * Finds the one tournament that represents this exact gender+age+weight
 * bucket, creating it (local-first, then best-effort cloud) the first time
 * that combination is opened. Every later "Generate match" call for the
 * same bucket reuses this same tournament id.
 */
export async function getOrCreateCategoryTournament(bucket: CategoryBucket): Promise<CategoryTournamentRef | null> {
  const name = bucketName(bucket);
  registerTournamentArchiveCategory({ tournamentName: name, gender: bucket.gender, ageGroup: bucket.ageGroup, weightCategory: bucket.weightCategory, format: 'knockout' });

  // 1) Already-known local bucket (works offline, and is checked first so a
  //    previously-offline-created bucket is never forked into a duplicate).
  const localMatch = loadAllLocalTournaments().find(
    t => t.gender === bucket.gender && t.age_group === bucket.ageGroup && t.weight_category === bucket.weightCategory,
  );

  // 2) Ask the cloud, if configured — it is the source of truth once reachable.
  if (isSupabaseConfigured) {
    try {
      const { data: existing, error: findErr } = await supabase
        .from('tournaments')
        .select('id, name, status')
        .eq('gender', bucket.gender)
        .eq('age_group', bucket.ageGroup)
        .eq('weight_category', bucket.weightCategory)
        .limit(1)
        .maybeSingle();
      if (findErr) throw findErr;
      if (existing) {
        saveTournamentLocal({
          id: existing.id, name: existing.name, status: (existing as any).status, gender: bucket.gender, weight_category: bucket.weightCategory,
          age_group: bucket.ageGroup, format: 'knockout',
          bracket_data: (localMatch as any)?.bracket_data ?? null,
          players: Array.isArray((localMatch as any)?.players) ? (localMatch as any).players : (Array.isArray((localMatch as any)?.bracket_data?.rosterSnapshot) ? (localMatch as any).bracket_data.rosterSnapshot : undefined),
          display_colors: (localMatch as any)?.display_colors,
          created_at: (localMatch as any)?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        return existing;
      }

      // Nothing in the cloud yet. If we already have a local-only copy,
      // promote it to the cloud instead of creating a second bucket.
      if (localMatch && isLocalTournamentId(localMatch.id)) {
        const { data: promoted, error: promoteErr } = await supabase
          .from('tournaments')
          .insert({ name: localMatch.name || name, gender: bucket.gender, age_group: bucket.ageGroup, weight_category: bucket.weightCategory, format: 'knockout', status: 'active' })
          .select('id, name, status')
          .single();
        if (promoteErr) throw promoteErr;
        if (promoted) {
          saveTournamentLocal({
            id: promoted.id, name: promoted.name, status: (promoted as any).status, gender: bucket.gender, weight_category: bucket.weightCategory,
            age_group: bucket.ageGroup, format: 'knockout', bracket_data: (localMatch as any)?.bracket_data ?? null,
            players: Array.isArray((localMatch as any)?.players) ? (localMatch as any).players : (Array.isArray((localMatch as any)?.bracket_data?.rosterSnapshot) ? (localMatch as any).bracket_data.rosterSnapshot : undefined),
            display_colors: (localMatch as any)?.display_colors,
            created_at: (localMatch as any)?.created_at || new Date().toISOString(), updated_at: new Date().toISOString(),
          });
          return promoted;
        }
      }

      const { data: created, error: createErr } = await supabase
        .from('tournaments')
        .insert({ name, gender: bucket.gender, age_group: bucket.ageGroup, weight_category: bucket.weightCategory, format: 'knockout', status: 'active' })
        .select('id, name, status')
        .single();
      if (createErr) throw createErr;
      if (created) {
        saveTournamentLocal({
          id: created.id, name: created.name, status: (created as any).status, gender: bucket.gender, weight_category: bucket.weightCategory,
          age_group: bucket.ageGroup, format: 'knockout', bracket_data: (localMatch as any)?.bracket_data ?? null,
          players: Array.isArray((localMatch as any)?.players) ? (localMatch as any).players : (Array.isArray((localMatch as any)?.bracket_data?.rosterSnapshot) ? (localMatch as any).bracket_data.rosterSnapshot : undefined),
          display_colors: (localMatch as any)?.display_colors,
          created_at: (localMatch as any)?.created_at || new Date().toISOString(), updated_at: new Date().toISOString(),
        });
        return created;
      }
    } catch (e) {
      console.warn('getOrCreateCategoryTournament: cloud unavailable, using local bucket', e);
    }
  }

  // 3) Fully offline fallback.
  if (localMatch) return { id: localMatch.id, name: localMatch.name };
  const id = `local-${(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)}`;
  const rec: LocalTournamentRecord = {
    id, name, gender: bucket.gender, weight_category: bucket.weightCategory, age_group: bucket.ageGroup,
    format: 'knockout', bracket_data: null, created_at: new Date().toISOString(),
  };
  saveTournamentLocal(rec);
  return { id, name };
}

/** Read the actual TournamentManager bracket when one exists. This keeps the
 * archive view on the canonical nextMatchId/winner graph instead of building a
 * second, approximate bracket from match names. */
export async function loadCanonicalBracket(tournamentId: string): Promise<any[] | null> {
  try {
    const local = loadTournamentLocal(tournamentId);
    if (local?.bracket_data?.bracket) return local.bracket_data.bracket;
    if (!isSupabaseConfigured || isLocalTournamentId(tournamentId)) return null;
    const { data, error } = await supabase.from('tournaments').select('bracket_data').eq('id', tournamentId).maybeSingle();
    if (error) throw error;
    return (data?.bracket_data as any)?.bracket || null;
  } catch (e) {
    console.warn('loadCanonicalBracket failed', e);
    return null;
  }
}

export interface CategoryMatchSummary {
  id: string;
  matchNumber: number | null;
  chungName: string;
  hongName: string;
  status: string | null;
  winner: string | null;
  classification: '1v1' | 'team';
  stage?: string | null;
  chungScore?: number | null;
  hongScore?: number | null;
  winMethod?: string | null;
  resultRound?: number | null;
  statistics?: any;
  roundsData?: any;
  roundWinners?: any;
  replayTimeline?: any[];
  replayAvailable?: boolean;
  replaySummary?: { totalEvents: number; scoringEvents: number; rounds: number };
}

/** Every match already saved under this category tournament — cloud rows first, plus any purely-local ones the cloud hasn't seen yet. */
export async function listCategoryMatches(tournamentId: string): Promise<CategoryMatchSummary[]> {
  const localAll: LocalMatchRecord[] = loadAllMatchesLocal().filter(m => m.tournament_id === tournamentId);
  const localTournament = loadTournamentLocal(tournamentId);
  const embeddedRecords = Array.isArray((localTournament as any)?.bracket_data?.matchRecords) ? (localTournament as any).bracket_data.matchRecords : [];
  let cloud: CategoryMatchSummary[] = [];

  if (isSupabaseConfigured && !isLocalTournamentId(tournamentId)) {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('id, match_number, chung_name, hong_name, status, winner, config, match_stage, chung_score, hong_score, win_method, round_winners, rounds_data, created_at, updated_at')
        .eq('tournament_id', tournamentId)
        .order('match_number', { ascending: true });
      if (error) throw error;
      cloud = (data || []).map(m => {
        // `result_round` and `statistics` are NOT real columns on the
        // `matches` table (confirmed against the generated Supabase types —
        // selecting them made Postgrest reject the whole query, which was
        // silently swallowed below and meant NO cloud match ever loaded for
        // any category). Derive the decisive round from round_winners
        // instead, and leave statistics unset for cloud rows (per-hit-type
        // breakdowns just aren't stored server-side yet).
        const roundWinners = Array.isArray(m.round_winners) ? m.round_winners as any[] : [];
        const derivedResultRound = roundWinners.length ? Number((roundWinners[roundWinners.length - 1] as any)?.round) || null : null;
        return {
          id: m.id,
          matchNumber: m.match_number,
          chungName: m.chung_name || '',
          hongName: m.hong_name || '',
          status: m.status,
          winner: m.winner,
          classification: ((m.config as any)?.classification === 'team' ? 'team' : '1v1') as '1v1' | 'team',
          stage: m.match_stage || null, chungScore: m.chung_score ?? null, hongScore: m.hong_score ?? null,
          winMethod: m.win_method || null, resultRound: derivedResultRound, statistics: null,
          roundsData: m.rounds_data || null, roundWinners: m.round_winners || null,
          replayTimeline: [], replayAvailable: false, replaySummary: { totalEvents: 0, scoringEvents: 0, rounds: Array.isArray(m.rounds_data) ? m.rounds_data.length : 0 },
          savedAt: (m as any).created_at || null, updatedAt: (m as any).updated_at || (m as any).created_at || null,
        };
      });
    } catch (e) {
      console.warn('listCategoryMatches: cloud fetch failed, showing local cache only', e);
    }
  }

  const localById = new Map(localAll.map(m => [m.id, m]));
  const merged = cloud.map(c => {
    const local = localById.get(c.id);
    if (!local) return c;
    const lt = Date.parse(String(local.updated_at || local.saved_at || '')) || 0;
    const ct = Date.parse(String((c as any).updatedAt || (c as any).savedAt || '')) || 0;
    if (lt > ct) return {
      ...c,
      matchNumber: local.match_number, chungName: local.chung_name || '', hongName: local.hong_name || '', status: local.status,
      winner: local.winner, classification: ((local.competition_mode || (local as any).config?.classification) === 'team' ? 'team' : '1v1') as 'team'|'1v1',
      stage: local.match_stage || null, chungScore: local.chung_score ?? null, hongScore: local.hong_score ?? null,
      winMethod: local.win_method || null, resultRound: local.result_round ?? null, statistics: local.statistics || null,
      roundsData: local.rounds_data || null, roundWinners: local.round_winners || null,
      replayTimeline: Array.isArray(local.score_events) ? local.score_events : [], replayAvailable: Array.isArray(local.score_events) && local.score_events.length > 0,
      replaySummary: { totalEvents: Array.isArray(local.score_events) ? local.score_events.length : 0, scoringEvents: Array.isArray(local.score_events) ? local.score_events.filter((e:any)=>e?.type !== 'warning').length : 0, rounds: Array.isArray(local.rounds_data) ? local.rounds_data.length : 0 },
      updatedAt: local.updated_at || local.saved_at || null,
    };
    return c;
  });
  const seen = new Set(cloud.map(c => c.id));
  const localOnly: CategoryMatchSummary[] = [...localAll, ...embeddedRecords]
    .filter((m:any, idx, arr) => {
      const id = String(m?.match_id || m?.id || `embedded-${m?.match_number ?? idx}`);
      return arr.findIndex((x:any) => String(x?.match_id || x?.id || `embedded-${x?.match_number ?? idx}`) === id) === idx;
    })
    .filter((m:any) => !seen.has(String(m?.id || m?.match_id)))
    .map((m:any) => ({
      id: m.id, matchNumber: m.match_number, chungName: m.chung_name || '', hongName: m.hong_name || '', status: m.status,
      winner: m.winner, classification: (m.competition_mode === 'par_equipe' ? 'team' : '1v1') as '1v1' | 'team',
      stage: m.match_stage || null, chungScore: m.chung_score ?? null, hongScore: m.hong_score ?? null, winMethod: m.win_method || null,
      resultRound: m.result_round ?? null, statistics: m.statistics || null, roundsData: m.rounds_data || null, roundWinners: m.round_winners || null,
      replayTimeline: Array.isArray(m.score_events) ? m.score_events : [],
      replayAvailable: Array.isArray(m.score_events) && m.score_events.length > 0,
      replaySummary: { totalEvents: Array.isArray(m.score_events) ? m.score_events.length : 0, scoringEvents: Array.isArray(m.score_events) ? m.score_events.filter((e:any)=>e?.type && !['warning'].includes(e.type)).length : 0, rounds: Array.isArray(m.rounds_data) ? m.rounds_data.length : 0 },
    }));
  return [...merged, ...localOnly].sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0));
}


export interface CategoryStatistics {
  players: number;
  matches: number;
  finished: number;
  remaining: number;
  live: number;
  wins: { chung: number; hong: number };
  methods: Record<string, number>;
  headPoints: { chung: number; hong: number };
  trunkPoints: { chung: number; hong: number };
  totalPoints: { chung: number; hong: number };
  gamjeom: { chung: number; hong: number };
  knockdowns: { chung: number; hong: number };
  aiRounds: number;
  wooSeGirokRounds: number;
  playerStats: Record<string, { name: string; matches: number; wins: number; losses: number; points: number; pointsAgainst: number; headPoints: number; trunkPoints: number; gamjeom: number; knockdowns: number; methods: Record<string, number> }>;
}

function numberFrom(...values: any[]): number {
  for (const v of values) if (typeof v === 'number' && Number.isFinite(v)) return v;
  return 0;
}

export function buildCategoryStatistics(rows: CategoryMatchSummary[], roster: CategoryPlayer[] = []): CategoryStatistics {
  const stats: CategoryStatistics = {
    players: roster.length, matches: rows.length, finished: rows.filter(m => m.status === 'finished').length,
    remaining: rows.filter(m => m.status !== 'finished').length,
    live: rows.filter(m => ['fighting','rest','paused','kyeshi','ivr','doctor'].includes(String(m.status))).length,
    wins: { chung: 0, hong: 0 }, methods: {}, headPoints: { chung: 0, hong: 0 }, trunkPoints: { chung: 0, hong: 0 },
    totalPoints: { chung: 0, hong: 0 }, gamjeom: { chung: 0, hong: 0 }, knockdowns: { chung: 0, hong: 0 }, aiRounds: 0, wooSeGirokRounds: 0, playerStats: {},
  };
  const ensure = (name: string) => stats.playerStats[name] ||= { name, matches: 0, wins: 0, losses: 0, points: 0, pointsAgainst: 0, headPoints: 0, trunkPoints: 0, gamjeom: 0, knockdowns: 0, methods: {} };
  for (const m of rows) {
    const c = m.chungName || 'CHUNG'; const h = m.hongName || 'HONG';
    const cs = ensure(c), hs = ensure(h); cs.matches++; hs.matches++;
    if (m.winner === 'chung') { stats.wins.chung++; cs.wins++; hs.losses++; }
    if (m.winner === 'hong') { stats.wins.hong++; hs.wins++; cs.losses++; }
    if (m.winMethod) stats.methods[m.winMethod] = (stats.methods[m.winMethod] || 0) + 1;
    const cScore = numberFrom(m.chungScore, m.statistics?.chung?.points), hScore = numberFrom(m.hongScore, m.statistics?.hong?.points);
    stats.totalPoints.chung += cScore; stats.totalPoints.hong += hScore; cs.points += cScore; hs.points += hScore; cs.pointsAgainst += hScore; hs.pointsAgainst += cScore;
    const ch = numberFrom(m.statistics?.chung?.headPoints, m.chungScore && m.statistics?.chung?.head_points), hh = numberFrom(m.statistics?.hong?.headPoints, m.statistics?.hong?.head_points);
    const ct = numberFrom(m.statistics?.chung?.trunkPoints, m.statistics?.chung?.trunk_points), ht = numberFrom(m.statistics?.hong?.trunkPoints, m.statistics?.hong?.trunk_points);
    stats.headPoints.chung += ch; stats.headPoints.hong += hh; stats.trunkPoints.chung += ct; stats.trunkPoints.hong += ht; cs.headPoints += ch; hs.headPoints += hh; cs.trunkPoints += ct; hs.trunkPoints += ht;
    const cg = numberFrom(m.statistics?.chung?.gamjeom, m.statistics?.chung?.penalties), hg = numberFrom(m.statistics?.hong?.gamjeom, m.statistics?.hong?.penalties);
    stats.gamjeom.chung += cg; stats.gamjeom.hong += hg; cs.gamjeom += cg; hs.gamjeom += hg;
    const ck = numberFrom(m.statistics?.chung?.knockdowns, m.statistics?.chung?.knockdown), hk = numberFrom(m.statistics?.hong?.knockdowns, m.statistics?.hong?.knockdown);
    stats.knockdowns.chung += ck; stats.knockdowns.hong += hk; cs.knockdowns += ck; hs.knockdowns += hk;
    if (Array.isArray(m.roundWinners)) for (const r of m.roundWinners) { if (r?.aiScore || r?.tiebreakDetails?.aiScore || r?.aiConfidence != null) stats.aiRounds++; if (r?.decisionType === 'woo-se-girok' || r?.wooSeGirok || r?.tiebreakDetails?.winningCriterion) stats.wooSeGirokRounds++; }
  }
  for (const p of roster) if (p.name) ensure(p.name);
  return stats;
}

export interface VisualBracketMatch {
  id: string;
  stage: string;
  slot: number;
  player1: string;
  player2: string;
  winner: string | null;
  matchId?: string;
  status: 'DONE'|'LIVE'|'NEXT'|'EMPTY';
}

function bracketSize(n:number){ let x=1; while(x<Math.max(2,n)) x*=2; return x; }
function bracketStage(size:number, round:number){ const fromEnd=Math.log2(size)-round; if(fromEnd===0)return 'FINAL'; if(fromEnd===1)return 'SEMIFINAL'; if(fromEnd===2)return 'QUARTERFINAL'; if(fromEnd===3)return 'ROUND OF 16'; return 'QUALIFICATION'; }

/** Builds a deterministic, data-driven bracket from the saved roster and match records. Winners feed the next slot; unfinished slots remain explicit placeholders. */
export function buildVisualBracket(roster: CategoryPlayer[], matches: CategoryMatchSummary[]): VisualBracketMatch[][] {
  const size=bracketSize(roster.filter(p=>p.name).length);
  const entrants=roster.filter(p=>p.name).map(p=>p.name);
  const rounds=Math.log2(size);
  const out: VisualBracketMatch[][]=[];
  let current:Array<[string,string]>=[];
  for(let i=0;i<size;i+=2) current.push([entrants[i]||'BYE',entrants[i+1]||'BYE']);
  for(let r=1;r<=rounds;r++){
    const stage=bracketStage(size,r); const source=matches.filter(m=>String(m.stage||'').toLowerCase().includes(stage.toLowerCase().replace('ROUND OF 16','16').replace('QUARTERFINAL','quarter').replace('SEMIFINAL','semi').replace('QUALIFICATION','qual')));
    const col:VisualBracketMatch[]=[];
    for(let i=0;i<current.length;i++){
      const pair=current[i]; const candidate=source[i] || matches.filter(m=>Number(m.resultRound)===r)[i];
      const winner=candidate?.winner==='chung'?candidate.chungName:candidate?.winner==='hong'?candidate.hongName:null;
      const p1=pair[0]; const p2=pair[1];
      col.push({id:`visual-${r}-${i}`,stage,slot:i,player1:p1,player2:p2,winner,status:candidate?.status==='finished'?'DONE':candidate&&['fighting','rest','paused'].includes(String(candidate.status))?'LIVE':candidate?'NEXT':'EMPTY',matchId:candidate?.id});
    }
    out.push(col);
    if(col.length>1){ const next:Array<[string,string]>=[]; for(let i=0;i<col.length;i+=2){ const a=col[i],b=col[i+1]; next.push([a.winner||`WINNER M${a.slot+1}`,b.winner||`WINNER M${b.slot+1}`]); } current=next; }
  }
  return out;
}

export interface QuickAddMatchInput {
  gender: string;
  ageGroup: string;
  weightCategory: string;
  classification: '1v1' | 'team';
  chungName: string; // Individual: player name · Par Équipe: team/club name
  hongName: string;
  chungNationality?: string;
  hongNationality?: string;
}

export interface QuickAddMatchResult {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
}

/**
 * The one-click "Generate" action: only names are supplied by the caller —
 * tournament, gender, age group and weight are taken from the already-
 * selected category bucket and filled in automatically. Works the same way
 * for an Individual (1v1) match and a Par Équipe (team) match; both always
 * end up saved inside a Tournament record, never floating unattached.
 */
export async function quickAddMatch(input: QuickAddMatchInput): Promise<QuickAddMatchResult | null> {
  const chungName = input.chungName.trim();
  const hongName = input.hongName.trim();
  if (!chungName || !hongName) return null;

  const tournament = await getOrCreateCategoryTournament({
    gender: input.gender, ageGroup: input.ageGroup, weightCategory: input.weightCategory,
  });
  if (!tournament) return null;

  const existing = await listCategoryMatches(tournament.id);
  const nextMatchNumber = existing.length > 0 ? Math.max(...existing.map(m => m.matchNumber ?? 0)) + 1 : 1;
  const namedEntrants = loadCategoryPlayers(tournament.id).filter(p=>p.name).length;
  const totalEntrants = Math.max(2, namedEntrants || existing.length + 2);
  const pow2 = Math.pow(2, Math.ceil(Math.log2(totalEntrants)));
  const rounds = Math.max(1, Math.log2(pow2));
  const roundIndex = Math.min(rounds, Math.max(1, existing.length + 1));
  const stage = roundIndex === rounds ? 'FINAL' : roundIndex === rounds - 1 ? 'SEMIFINAL' : roundIndex === rounds - 2 ? 'QUARTERFINAL' : roundIndex === rounds - 3 ? 'ROUND OF 16' : 'QUALIFICATION';
  const bracketSlot = existing.filter(m => m.stage === stage).length;
  const competitionMode = input.classification === 'team' ? 'par_equipe' : 'knockout';

  const localFallback = (matchId: string) => {
    saveMatchLocal({
      id: matchId, competition_name: tournament.name, match_number: nextMatchNumber,
      weight_category: input.weightCategory, gender: input.gender, age_group: input.ageGroup,
      match_stage: stage, chung_name: chungName, hong_name: hongName,
      chung_nationality: input.chungNationality || null, hong_nationality: input.hongNationality || null,
      status: 'waiting', winner: null, tournament_id: tournament.id, competition_mode: competitionMode,
    });
  };

  if (isSupabaseConfigured && !isLocalTournamentId(tournament.id)) {
    try {
      const { data, error } = await supabase
        .from('matches')
        .insert({
          tournament_id: tournament.id,
          match_number: nextMatchNumber,
          competition_name: tournament.name,
          weight_category: input.weightCategory,
          gender: input.gender,
          age_group: input.ageGroup,
          chung_name: chungName,
          hong_name: hongName,
          chung_nationality: input.chungNationality || '',
          hong_nationality: input.hongNationality || '',
          status: 'waiting',
          competition_mode: competitionMode,
          config: { classification: input.classification, bracket: { stage, slot: bracketSlot, source: 'category-library-v3' } },
          match_stage: stage,
        })
        .select('id')
        .single();
      if (error) throw error;
      if (data) {
        localFallback(data.id);
        return { matchId: data.id, tournamentId: tournament.id, tournamentName: tournament.name };
      }
    } catch (e) {
      console.warn('quickAddMatch: cloud insert failed, match kept locally only', e);
    }
  }

  const localId = `local-match-${(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)}`;
  localFallback(localId);
  return { matchId: localId, tournamentId: tournament.id, tournamentName: tournament.name };
}

// ===== Category status overview =====
//
// The organizer wants ONE screen that shows every GENDER × AGE GROUP ×
// WEIGHT category at once, each with a glowing status circle, instead of
// drilling down (gender → age → weight) just to find out a category's
// status. Every bucket already IS its own `tournaments` row (see
// getOrCreateCategoryTournament above), so this does not need a new table
// or a schema migration — it only needs to enumerate the *known* weight
// list per gender+age, look up whichever of those already have a
// tournament bucket + matches, and derive a status from the matches.
//
// Status is derived, never stored, so it can never drift out of sync with
// the underlying matches:
//   - 'not_started' — no bucket yet, or a bucket with zero matches.
//   - 'ready'       — matches exist, none has started fighting yet.
//   - 'in_progress' — at least one match is live (fighting/rest), or the
//                      category is partially finished.
//   - 'finished'    — a bucket has matches and every one is finished.
// There is no automatic 'problem' state (nothing in the current match/
// tournament data model marks a category as suspended) — this is called
// out explicitly rather than guessed at.

export type CategoryStatus = 'not_started' | 'ready' | 'in_progress' | 'finished' | 'suspended';

export interface CategoryOverviewBucket extends CategoryBucket {
  tournamentId: string | null;
  status: CategoryStatus;
  totalMatches: number;
  finishedMatches: number;
  remainingMatches: number;
  playerCount: number;
  clubCount: number;
  hasBracket: boolean;
  currentStage: string;
  tournamentName: string;
}

export interface CategoryOverviewGroup {
  gender: 'male' | 'female';
  ageGroup: string;
  ageLabel: string;
  buckets: CategoryOverviewBucket[];
}

function scheduledPlayerCount(rows: any[]): number {
  if (!Array.isArray(rows)) return 0;
  const ids = new Set<string>();
  for (const m of rows) {
    for (const p of [m?.player1, m?.player2]) {
      const key = p?.id || p?.name;
      if (key) ids.add(String(key));
    }
  }
  return ids.size;
}

function deriveStatus(matchStatuses: (string | null)[]): { status: CategoryStatus; finished: number } {
  const total = matchStatuses.length;
  const finished = matchStatuses.filter((s) => s === 'finished').length;
  if (total === 0) return { status: 'not_started', finished: 0 };
  if (finished === total) return { status: 'finished', finished };
  const live = matchStatuses.some((s) => s === 'fighting' || s === 'rest');
  if (live || finished > 0) return { status: 'in_progress', finished };
  return { status: 'ready', finished };
}

/**
 * Every gender × age-group × weight-category combination (preset + any
 * custom ones an organizer added before), each annotated with its current
 * status. Only 2 bulk queries against the cloud regardless of how many
 * categories exist (all tournaments, then all their matches), plus the
 * local cache as an offline fallback — never one query per category.
 */
export async function listCategoryOverview(): Promise<CategoryOverviewGroup[]> {
  const genders: Array<'male' | 'female'> = ['male', 'female'];

  // 1) All known buckets (cloud tournaments first, local-only ones filled in
  // after so an offline-created bucket is never missing from the overview).
  type BucketRow = { id: string; name?: string; gender: string; age_group: string; weight_category: string; status?: string | null; bracket_data?: any };
  let cloudTournaments: BucketRow[] = [];
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, gender, age_group, weight_category, status, bracket_data');
      if (error) throw error;
      cloudTournaments = (data || []) as BucketRow[];
    } catch (e) {
      console.warn('listCategoryOverview: cloud tournaments fetch failed, using local cache only', e);
    }
  }
  const localTournaments = loadAllLocalTournaments();
  const bucketByKey = new Map<string, BucketRow>(); // "gender|age|weight" -> canonical tournament bucket
  for (const t of cloudTournaments) {
    if (t.gender && t.age_group && t.weight_category) {
      bucketByKey.set(`${t.gender}|${t.age_group}|${t.weight_category}`, t);
    }
  }
  for (const t of localTournaments) {
    const key = `${t.gender}|${t.age_group}|${t.weight_category}`;
    if (t.gender && t.age_group && t.weight_category && !bucketByKey.has(key)) {
      bucketByKey.set(key, { id: t.id, name: t.name, gender: t.gender, age_group: t.age_group, weight_category: t.weight_category, status: (t as any).status, bracket_data: (t as any).bracket_data });
    }
  }

  // 2) Match statuses for every known bucket, fetched in one bulk call.
  const tournamentIds = [...bucketByKey.values()].map((b) => b.id).filter((id) => !isLocalTournamentId(id));
  const statusesByTournamentId = new Map<string, (string | null)[]>();
  const cloudMatchIdsByTournamentId = new Map<string, Set<string>>();
  const playersByTournamentId = new Map<string, Set<string>>();
  const clubsByTournamentId = new Map<string, Set<string>>();
  if (isSupabaseConfigured && tournamentIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('id, tournament_id, status, chung_name, hong_name, chung_club, hong_club')
        .in('tournament_id', tournamentIds);
      if (error) throw error;
      for (const row of data || []) {
        const ids = cloudMatchIdsByTournamentId.get(row.tournament_id as string) || new Set<string>();
        if (row.id) ids.add(String(row.id));
        cloudMatchIdsByTournamentId.set(row.tournament_id as string, ids);
        const list = statusesByTournamentId.get(row.tournament_id as string) || [];
        list.push(row.status as string | null);
        statusesByTournamentId.set(row.tournament_id as string, list);
        const names = playersByTournamentId.get(row.tournament_id as string) || new Set<string>();
        if (row.chung_name) names.add(String(row.chung_name));
        if (row.hong_name) names.add(String(row.hong_name));
        playersByTournamentId.set(row.tournament_id as string, names);
        const clubs = clubsByTournamentId.get(row.tournament_id as string) || new Set<string>();
        if (row.chung_club) clubs.add(String(row.chung_club).trim().toLowerCase());
        if (row.hong_club) clubs.add(String(row.hong_club).trim().toLowerCase());
        clubsByTournamentId.set(row.tournament_id as string, clubs);
      }
    } catch (e) {
      console.warn('listCategoryOverview: cloud matches fetch failed, falling back to local match cache', e);
    }
  }
  // Cloud roster hydration: registered players are stored separately from
  // the tournament row. Without this query a cloud-saved category correctly
  // had its bracket/matches but the archive still showed PLAYERS = 0.
  if (isSupabaseConfigured && tournamentIds.length > 0) {
    try {
      const { data: playerRows, error } = await supabase
        .from('players').select('id,name,club,tournament_id').in('tournament_id', tournamentIds);
      if (!error) {
        for (const row of playerRows || []) {
          const names = playersByTournamentId.get(row.tournament_id as string) || new Set<string>();
          if (row.id || row.name) names.add(String(row.id || row.name));
          playersByTournamentId.set(row.tournament_id as string, names);
          const clubs = clubsByTournamentId.get(row.tournament_id as string) || new Set<string>();
          if (row.club) clubs.add(String(row.club).trim().toLowerCase());
          clubsByTournamentId.set(row.tournament_id as string, clubs);
        }
      }
    } catch (e) {
      console.warn('listCategoryOverview: cloud player roster fetch failed; using matches/local roster', e);
    }
  }

  // Offline / local-only matches: this cache only ever holds 'finished' or
  // 'cancelled' rows (see match-local.ts), so it can only ever push a
  // bucket towards 'finished', never fabricate a live/in-progress state.
  const localMatches = loadAllMatchesLocal();
  for (const [key, bucket] of bucketByKey) {
    const tournamentId = bucket.id;
    const localTournament = loadTournamentLocal(tournamentId);
    if (Array.isArray(localTournament?.players) && localTournament!.players.length) {
      const names = playersByTournamentId.get(tournamentId) || new Set<string>();
      const clubs = clubsByTournamentId.get(tournamentId) || new Set<string>();
      for (const p of localTournament!.players as any[]) {
        if (p?.id || p?.name) names.add(String(p.id || p.name));
        if (p?.club) clubs.add(String(p.club).trim().toLowerCase());
      }
      playersByTournamentId.set(tournamentId, names);
      clubsByTournamentId.set(tournamentId, clubs);
    }
    const cloudMatchIds = cloudMatchIdsByTournamentId.get(tournamentId) || new Set<string>();
    const forThisBucket = localMatches.filter((m) => m.tournament_id === tournamentId && !cloudMatchIds.has(String(m.match_id || m.id)));
    if (forThisBucket.length > 0) {
      const current = statusesByTournamentId.get(tournamentId) || [];
      statusesByTournamentId.set(tournamentId, [...current, ...forThisBucket.map((m) => m.status)]);
      const names = playersByTournamentId.get(tournamentId) || new Set<string>();
      for (const m of forThisBucket) { if (m.chung_name) names.add(String(m.chung_name)); if (m.hong_name) names.add(String(m.hong_name)); }
      playersByTournamentId.set(tournamentId, names);
      const clubs = clubsByTournamentId.get(tournamentId) || new Set<string>();
      for (const m of forThisBucket) { if (m.chung_club) clubs.add(String(m.chung_club).trim().toLowerCase()); if (m.hong_club) clubs.add(String(m.hong_club).trim().toLowerCase()); }
      clubsByTournamentId.set(tournamentId, clubs);
    }
  }

  // 3) Build the full grid: every preset+custom weight for every age group
  // and gender, whether or not it has a bucket yet ('not_started' if not).
  const groups: CategoryOverviewGroup[] = [];
  for (const gender of genders) {
    for (const age of getAllAgeCategories(gender)) {
      const weights = getAllWeightCategories(gender, age.value);
      if (weights.length === 0) continue;
      const buckets: CategoryOverviewBucket[] = weights.map((weightCategory) => {
        const key = `${gender}|${age.value}|${weightCategory}`;
        const bucketRecord = bucketByKey.get(key);
        const tournamentId = bucketRecord?.id || null;
        const statuses = tournamentId ? statusesByTournamentId.get(tournamentId) || [] : [];
        const localTournament = tournamentId ? loadTournamentLocal(tournamentId) : null;
        const savedPlayers = tournamentId
          ? (loadCategoryPlayers(tournamentId).length ? loadCategoryPlayers(tournamentId) : (Array.isArray(localTournament?.players) ? localTournament!.players : []))
          : [];
        const rosterIds = new Set<string>();
        for (const p of savedPlayers) if (p?.id || p?.name) rosterIds.add(String(p.id || p.name));
        const observedNames = playersByTournamentId.get(tournamentId || '') || new Set<string>();
        const observedClubs = clubsByTournamentId.get(tournamentId || '') || new Set<string>();
        for (const p of savedPlayers) { if (p?.club) observedClubs.add(String(p.club).trim().toLowerCase()); }
        const derived = deriveStatus(statuses);
        const bracketData = bucketRecord?.bracket_data || {};
        const bracketList = bracketData.mode === 'league' ? (bracketData.league || []) : (bracketData.bracket || []);
        const scheduled = Array.isArray(bracketList) ? bracketList.filter((m:any) => m && !m.isBye && m.player1 && m.player2) : [];
        const hasPlayers = savedPlayers.length > 0 || (playersByTournamentId.get(tournamentId || '')?.size || 0) > 0 || scheduledPlayerCount(scheduled) > 0;
        const finished = derived.finished;
        const totalMatches = Math.max(statuses.length, scheduled.length);
        const remainingMatches = Math.max(0, totalMatches - finished);
        const status = bucketRecord?.status === 'suspended' ? 'suspended' : (totalMatches > 0 && finished >= totalMatches ? 'finished' : (statuses.some(s => s === 'fighting' || s === 'rest') || finished > 0 ? 'in_progress' : hasPlayers ? 'ready' : 'not_started'));
        const stageSet = new Set(scheduled.map((m:any) => String(m.stage || m.round || '')).filter(Boolean));
        const currentStage = status === 'finished' ? 'FINISHED' : status === 'in_progress' ? (stageSet.size ? Array.from(stageSet).slice(-1)[0] : 'IN PROGRESS') : status === 'suspended' ? 'SUSPENDED' : 'NOT STARTED';
        const playerCount = Math.max(rosterIds.size, observedNames.size, scheduledPlayerCount(scheduled));
        const clubCount = observedClubs.size + [...scheduled.reduce((set:any, m:any) => { for (const p of [m?.player1,m?.player2]) if (p?.club) set.add(String(p.club).trim().toLowerCase()); return set; }, new Set<string>())].filter((c:string)=>!observedClubs.has(c)).length;
        return {
          gender, ageGroup: age.value, weightCategory,
          tournamentId, status, totalMatches, finishedMatches: finished, remainingMatches, playerCount, clubCount, hasBracket: scheduled.length > 0, currentStage, tournamentName: bucketRecord?.name || `${age.label} · ${weightCategory}`, 
        };
      });
      groups.push({ gender, ageGroup: age.value, ageLabel: age.label, buckets });
    }
  }
  return groups;
}


/** Explicit organizer-controlled suspension flag for a category bucket.
 * The archive never guesses this state from missing data; it is only shown
 * when the tournament/category is explicitly marked suspended.
 */
export async function setCategorySuspended(tournamentId: string, suspended: boolean): Promise<void> {
  const local = loadTournamentLocal(tournamentId);
  if (local) {
    saveTournamentLocal({ ...local, status: suspended ? 'suspended' : 'active' } as any);
  }
  if (isSupabaseConfigured && !isLocalTournamentId(tournamentId)) {
    try {
      const { error } = await supabase.from('tournaments').update({ status: suspended ? 'suspended' : 'active' }).eq('id', tournamentId);
      if (error) throw error;
    } catch (e) {
      console.warn('setCategorySuspended: cloud update failed; local status kept', e);
    }
  }
}
