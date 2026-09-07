import { loadAllMatchesLocal, type LocalMatchRecord } from '@/lib/match-local';
import { loadAllLocalTournaments } from '@/lib/tournament-local';
import { computeClubStandings } from '@/lib/club-points';
import { scoreMatchPlayer, aggregatePlayers, type PlayerPerformance } from '@/lib/tournament-intelligence';
import { computeRefereePerformance } from '@/lib/referee-performance';

export type AwardKey =
  | 'best_player'
  | 'best_referee'
  | 'best_team'
  | 'best_club'
  | 'team_match_mvp'
  | 'fair_play'
  | 'top_scorer'
  | 'top_hitter'
  | 'champion'
  | 'tournament_stats';

export interface AwardPerson {
  name: string;
  photo?: string;
  nationality?: string;
  club?: string;
  team?: string;
  score?: number;
  subtitle?: string;
  stats?: Record<string, string | number>;
}

export interface TournamentStatsSnapshot {
  tournamentName: string;
  totalPlayers: number;
  totalClubs: number;
  totalMatches: number;
  completedMatches: number;
  headHits: number;
  bodyHits: number;
  totalHits: number;
  totalPointsScored: number;
  knockdowns: number;
  gamjeom: number;
  averageMatchTime: number;
  mostSuccessfulPlayer?: AwardPerson;
  bestClub?: AwardPerson;
  winnersByCategory: { category: string; winner: string; stage: string }[];
}

export interface AwardSnapshot {
  key: AwardKey;
  title: string;
  winner: AwardPerson;
  reason: string;
  tournamentName: string;
  template: string;
}

const TEMPLATE = {
  bestPlayer: new URL('../assets/award-templates/b17bbfb2-21b7-42c6-9146-1be32e45e749.webp', import.meta.url).href,
  fairPlay: new URL('../assets/award-templates/797900f7-61ea-4a42-89a7-278cbb33f40c.webp', import.meta.url).href,
  bestReferee: new URL('../assets/award-templates/fde98bff-4d7e-4d70-ae69-3ddb03577f14.webp', import.meta.url).href,
  bestClub: new URL('../assets/award-templates/b9381441-e4c3-401b-9d5b-7dc4a923d328.webp', import.meta.url).href,
  bestClubVertical: new URL('../assets/award-templates/664b758f-b508-4f08-b15d-a1ca6f1d5ca5.webp', import.meta.url).href,
  mvp: new URL('../assets/award-templates/20e44c14-0f75-4117-a9e3-5c4229d84c45.webp', import.meta.url).href,
  bestPlayerVertical: new URL('../assets/award-templates/28c8e6be-538d-40ea-a3cf-5205ec20b39e.webp', import.meta.url).href,
  stats: new URL('../assets/award-templates/c21308b4-457c-4da2-ae4b-92a556760c00.webp', import.meta.url).href,
};

// Keep the original uploaded artwork as reference assets. The screen never
// writes text into the image; names, photos and numbers are DOM layers above it.
export const AWARD_TEMPLATES = TEMPLATE;

function resultScore(m: LocalMatchRecord, side: 'chung' | 'hong') {
  return Number((side === 'chung' ? m.result_chung_score : m.result_hong_score) ?? (side === 'chung' ? m.chung_score : m.hong_score) ?? 0);
}

function completed(rows: LocalMatchRecord[]) {
  return rows.filter(m => m.status === 'finished' || m.lifecycle_status === 'COMPLETED');
}

function playerDirectory(rows: LocalMatchRecord[]) {
  const map = new Map<string, any>();
  for (const t of loadAllLocalTournaments()) {
    for (const p of Array.isArray(t.players) ? t.players : []) if (p?.name) map.set(String(p.name), p);
    const roster = t.bracket_data?.rosterSnapshot;
    for (const p of Array.isArray(roster) ? roster : []) if (p?.name && !map.has(String(p.name))) map.set(String(p.name), p);
  }
  for (const m of rows) {
    for (const side of ['chung', 'hong'] as const) {
      const name = side === 'chung' ? m.chung_name : m.hong_name;
      if (!name) continue;
      const meta = m.mvp_reveal?.best?.name === name ? m.mvp_reveal.best : m.mvp_reveal?.fairPlay?.name === name ? m.mvp_reveal.fairPlay : undefined;
      if (meta) map.set(String(name), { ...(map.get(String(name)) || {}), ...meta });
      for (const p of (m.team_roster?.[side] || [])) if (p?.name === name) map.set(String(name), { ...(map.get(String(name)) || {}), ...p });
    }
  }
  return map;
}

function buildPerformances(rows: LocalMatchRecord[]) {
  const directory = playerDirectory(rows);
  const perMatch: PlayerPerformance[] = [];
  for (const m of rows) {
    const events = Array.isArray(m.score_events) ? m.score_events : [];
    if (!events.length && !m.winner) continue;
    for (const side of ['chung', 'hong'] as const) {
      const opponent = side === 'chung' ? 'hong' : 'chung';
      const raw = scoreMatchPlayer(events as any, side as any, opponent as any, {
        winner: m.winner as any,
        method: m.win_method as any,
        finalScore: { chung: resultScore(m, 'chung'), hong: resultScore(m, 'hong') },
      } as any);
      const name = side === 'chung' ? m.chung_name : m.hong_name;
      const meta = directory.get(String(name)) || {};
      const points = resultScore(m, side);
      const warnings = Number(side === 'chung' ? m.chung_gamjeom : m.hong_gamjeom) || 0;
      const knockdowns = Number(m.statistics?.[side]?.knockdowns ?? m.statistics?.[side]?.knockdown ?? 0);
      perMatch.push({ ...raw, id: String(m.player_ids?.[side] || name || side), name: name || side.toUpperCase(), club: meta.club || (side === 'chung' ? m.chung_club : m.hong_club) || undefined, team: m.team_names?.[side] || undefined, nationality: meta.nationality || (side === 'chung' ? m.chung_nationality : m.hong_nationality) || undefined, pointsFor: points, warnings, penalties: warnings, hits: Array.isArray(events) ? events.filter((e:any) => e?.player === side && e?.type !== 'gamjeom' && e?.type !== 'warning').length : raw.hits, headHits: Array.isArray(events) ? events.filter((e:any) => e?.player === side && ['head_kick','turning_head'].includes(e?.type)).length : raw.headHits, bodyHits: Array.isArray(events) ? events.filter((e:any) => e?.player === side && ['trunk_kick','turning_kick','punch'].includes(e?.type)).length : raw.bodyHits, fairPlay: Math.max(0, 100 - warnings * 8 - knockdowns * 0), });
    }
  }
  return { directory, rows: aggregatePlayers(perMatch) };
}

export function buildTournamentStats(input?: { tournamentId?: string | null; tournamentName?: string | null }): TournamentStatsSnapshot {
  let rows = completed(loadAllMatchesLocal());
  if (input?.tournamentId) rows = rows.filter(m => String(m.tournament_id || '') === String(input.tournamentId));
  else if (input?.tournamentName) rows = rows.filter(m => String(m.tournament_name || m.competition_name || '') === String(input.tournamentName));
  const directory = playerDirectory(rows);
  const players = new Set<string>();
  const clubs = new Set<string>();
  let headHits = 0, bodyHits = 0, totalHits = 0, totalPointsScored = 0, knockdowns = 0, gamjeom = 0, totalTime = 0;
  for (const m of rows) {
    if (m.chung_name) players.add(m.chung_name); if (m.hong_name) players.add(m.hong_name);
    if (m.chung_club) clubs.add(m.chung_club); if (m.hong_club) clubs.add(m.hong_club);
    if (m.team_names?.chung) clubs.add(m.team_names.chung); if (m.team_names?.hong) clubs.add(m.team_names.hong);
    const events = Array.isArray(m.score_events) ? m.score_events : [];
    headHits += events.filter((e:any) => ['head_kick','turning_head'].includes(e?.type)).length;
    bodyHits += events.filter((e:any) => ['trunk_kick','turning_kick','punch'].includes(e?.type)).length;
    totalHits += events.filter((e:any) => e?.type && e.type !== 'gamjeom' && e.type !== 'warning').length;
    totalPointsScored += resultScore(m, 'chung') + resultScore(m, 'hong');
    knockdowns += Number(m.statistics?.chung?.knockdowns ?? m.statistics?.chung?.knockdown ?? 0) + Number(m.statistics?.hong?.knockdowns ?? m.statistics?.hong?.knockdown ?? 0);
    gamjeom += Number(m.chung_gamjeom || 0) + Number(m.hong_gamjeom || 0);
    totalTime += Number(m.duration_seconds || 0);
  }
  const performances = buildPerformances(rows).rows;
  const best = [...performances].sort((a,b) => b.wins - a.wins || b.performanceScore - a.performanceScore || b.pointDiff - a.pointDiff)[0];
  const clubRows = computeClubStandings();
  const bestClub = clubRows[0];
  const winners = new Map<string, { winner: string; stage: string; match: LocalMatchRecord }>();
  for (const m of rows) {
    if (!m.winner) continue;
    const category = [m.gender, m.age_group, m.weight_category].filter(Boolean).join(' • ') || 'OPEN';
    const stage = String(m.match_stage || '').toLowerCase();
    const existing = winners.get(category);
    const priority = stage.includes('final') ? 3 : stage.includes('semi') ? 2 : 1;
    const oldPriority = existing ? (String(existing.stage).includes('final') ? 3 : String(existing.stage).includes('semi') ? 2 : 1) : 0;
    if (!existing || priority >= oldPriority) winners.set(category, { winner: m.winner === 'chung' ? String(m.chung_name || '—') : String(m.hong_name || '—'), stage: m.match_stage || 'LATEST RESULT', match: m });
  }
  return {
    tournamentName: input?.tournamentName || rows[0]?.tournament_name || rows[0]?.competition_name || 'WAB-TKD',
    totalPlayers: players.size,
    totalClubs: clubs.size,
    totalMatches: rows.length,
    completedMatches: rows.length,
    headHits,
    bodyHits,
    totalHits,
    totalPointsScored,
    knockdowns,
    gamjeom,
    averageMatchTime: rows.length ? Math.round(totalTime / rows.length) : 0,
    mostSuccessfulPlayer: best ? { name: best.name, photo: directory.get(best.name)?.photo, club: best.club, score: best.performanceScore, subtitle: `${best.wins}/${best.matches} WINS`, stats: { 'MATCHES': best.matches, 'WINS': best.wins, 'WIN RATE': `${best.matches ? Math.round(best.wins / best.matches * 100) : 0}%`, 'POINTS': best.pointsFor, 'DIFF': best.pointDiff } } : undefined,
    bestClub: bestClub ? { name: bestClub.club, score: bestClub.totalPoints, subtitle: `${bestClub.wins} WINS`, stats: { 'MATCHES': bestClub.matchesPlayed, 'WINS': bestClub.wins, 'TOTAL POINTS': bestClub.totalPoints, 'GOLD': bestClub.gold } } : undefined,
    winnersByCategory: [...winners.entries()].map(([category, x]) => ({ category, winner: x.winner, stage: x.stage })),
  };
}

export function buildAwardSnapshots(input?: { tournamentId?: string | null; tournamentName?: string | null }): AwardSnapshot[] {
  let rows = completed(loadAllMatchesLocal());
  if (input?.tournamentId) rows = rows.filter(m => String(m.tournament_id || '') === String(input.tournamentId));
  else if (input?.tournamentName) rows = rows.filter(m => String(m.tournament_name || m.competition_name || '') === String(input.tournamentName));
  const { directory, rows: players } = buildPerformances(rows);
  const bestPlayer = [...players].sort((a,b) => b.performanceScore-a.performanceScore)[0];
  const fair = [...players].sort((a,b) => b.fairPlay-a.fairPlay || b.wins-a.wins)[0];
  const scorer = [...players].sort((a,b) => b.pointsFor-a.pointsFor)[0];
  const hitter = [...players].sort((a,b) => b.hits-a.hits)[0];
  const teamMap = new Map<string, { matches:number; wins:number; points:number }>();
  for (const m of rows) for (const side of ['chung','hong'] as const) {
    const team = m.team_names?.[side] || (side === 'chung' ? m.chung_club : m.hong_club) || 'Independent';
    const x = teamMap.get(team) || { matches:0,wins:0,points:0 }; x.matches++; x.points += resultScore(m,side); if (m.winner===side) x.wins++; teamMap.set(team,x);
  }
  const bestTeam = [...teamMap.entries()].map(([name,x])=>({name,...x,rate:x.matches?x.wins/x.matches:0})).sort((a,b)=>b.wins-a.wins||b.rate-a.rate||b.points-a.points)[0];
  const bestClub = computeClubStandings()[0];
  const refereeRanking = computeRefereePerformance(rows);
  const bestRef = refereeRanking[0];
  const tournamentName = input?.tournamentName || rows[0]?.tournament_name || rows[0]?.competition_name || 'WAB-TKD';
  const person = (p:any):AwardPerson => ({ name:p?.name||'—', photo:directory.get(p?.name)?.photo, nationality:p?.nationality, club:p?.club, team:p?.team, score:p?.performanceScore, subtitle:p?.club || p?.team, stats:{ 'MATCHES':p?.matches||0, 'WINS':p?.wins||0, 'WIN RATE':p?.matches?`${Math.round(p.wins/p.matches*100)}%`:'0%', 'POINT DIFF':p?.pointDiff||0, 'HEAD HITS':p?.headHits||0, 'BODY HITS':p?.bodyHits||0, 'FAIR PLAY':Math.round(p?.fairPlay||0) } });
  return [
    {key:'best_player',title:'BEST PLAYER',winner:person(bestPlayer),reason:'Highest Player Performance Score across the completed tournament.',tournamentName,template:TEMPLATE.bestPlayer},
    {key:'best_referee',title:'BEST REFEREE',winner:{name:bestRef?.name||'NO REFEREE DATA',score:bestRef?.score||0,subtitle:bestRef?`${bestRef.matches} MATCHES · CONFIDENCE ${bestRef.confidence}%`:'Enter the main referee name during matches',stats:bestRef?{'MATCHES':bestRef.matches,'DECISIONS':bestRef.recordedDecisions,'VOTE ENTRIES':bestRef.voteParticipations,'SCORE':bestRef.score}:{}},reason:'Highest evidence-based officiating activity score from the saved tournament record. Decision accuracy is never invented when correction/protest outcomes are unavailable.',tournamentName,template:TEMPLATE.bestReferee},
    {key:'best_team',title:'BEST TEAM',winner:{name:bestTeam?.name||'—',score:bestTeam?Math.round(bestTeam.rate*100):0,subtitle:bestTeam?`${bestTeam.wins}/${bestTeam.matches} WINS`:undefined,stats:bestTeam?{'MATCHES':bestTeam.matches,'WINS':bestTeam.wins,'WIN RATE':`${Math.round(bestTeam.rate*100)}%`,'POINTS':bestTeam.points}:{}},reason:'Best team result by wins, then win rate and points.',tournamentName,template:TEMPLATE.bestClub},
    {key:'best_club',title:'BEST CLUB',winner:{name:bestClub?.club||'—',score:bestClub?.totalPoints||0,subtitle:bestClub?`${bestClub.wins} WINS`:undefined,stats:bestClub?{'MATCHES':bestClub.matchesPlayed,'WINS':bestClub.wins,'TOTAL':bestClub.totalPoints,'GOLD':bestClub.gold}:{}},reason:'Highest official club standing total from the existing club-points engine.',tournamentName,template:TEMPLATE.bestClub},
    {key:'team_match_mvp',title:'PAR ÉQUIPE · MATCH MVP',winner:person([...players].sort((a,b)=>b.contributionScore-a.contributionScore)[0]),reason:'Highest Team Contribution Score among saved team-match performances.',tournamentName,template:TEMPLATE.mvp},
    {key:'fair_play',title:'BEST FAIR PLAY',winner:person(fair),reason:'Highest Fair Play Score with disciplinary events accounted for.',tournamentName,template:TEMPLATE.fairPlay},
    {key:'top_scorer',title:'TOP SCORER',winner:person(scorer),reason:'Most recorded points scored.',tournamentName,template:TEMPLATE.bestPlayer},
    {key:'top_hitter',title:'TOP HITTER',winner:person(hitter),reason:'Most recorded scoring hits.',tournamentName,template:TEMPLATE.mvp},
  ];
}

export function getAwardSnapshot(key: AwardKey, input?: { tournamentId?: string|null; tournamentName?: string|null }) {
  return buildAwardSnapshots(input).find(x=>x.key===key) || buildAwardSnapshots(input)[0] || null;
}
