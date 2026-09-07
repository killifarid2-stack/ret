import { MatchState, PlayerColor } from '@/types/tkd';
import { LocalMatchRecord, loadMatchesLocal, saveMatchLocal } from '@/lib/match-local';
import { loadTournamentLocal, saveTournamentLocal, isLocalTournamentId } from '@/lib/tournament-local';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/audit-log';

export interface SavedMatchRecord extends LocalMatchRecord {
  match_id: string;
  tournament_id: string | null;
  tournament_name: string;
  tournament_type: string;
  age_category: string | null;
  stage: string | null;
  round: number;
  winner: string | null;
  loser?: string | null;
  winner_side?: string | null;
  status: 'COMPLETED' | 'VOID' | 'finished' | 'cancelled';
  lifecycle_status?: 'COMPLETED' | 'VOID';
  started_at?: string | null;
  finished_at: string;
  saved_at: string;
  duration_seconds?: number | null;
  score_events: any[];
  statistics: any;
  golden_point_win?: boolean;
  golden_round?: number | null;
  golden_win_criterion?: string | null;
  mvp_reveal?: (MatchState['mvpReveal'] & { best?: MatchState['mvpReveal']['best'] & { seedNumber?:number; club?:string }; fairPlay?: MatchState['mvpReveal']['fairPlay'] & { seedNumber?:number; club?:string } }) | null;
  replay_timeline?: any[];
  video_replay?: { sourceUrl?: string | null; sourceId?: string | null; durationSeconds?: number | null; attachedAt?: string | null } | null;
  replay_summary?: { totalEvents:number; scoringEvents:number; rounds:number; durationSeconds:number };
}

function matchDuration(state: MatchState): number {
  const total = Math.max(0, state.config.roundTime * state.config.rounds);
  const remaining = Math.max(0, state.timeRemaining);
  return Math.max(0, total - remaining);
}

function typeLabel(state: MatchState): string {
  if (state.config.competitionMode === 'par_equipe') return 'PAR_EQUIPE';
  if (state.config.competitionMode === 'league') return 'LEAGUE';
  if (state.config.competitionMode === 'friendly') return '1V1';
  if (state.config.competitionMode === 'super_fight') return 'SUPER_FIGHT';
  return state.config.competitionMode === 'knockout' ? 'KNOCKOUT' : 'TOURNAMENT';
}

export function buildSavedMatchRecord(state: MatchState): SavedMatchRecord {
  if (!state.result || state.status !== 'finished') throw new Error('MATCH_NOT_FINISHED');
  if (!state.competitionName || !state.tournamentId || !state.matchNumber) throw new Error('MATCH_DATA_INCOMPLETE');
  if (!state.weightCategory || !state.ageGroup || !state.gender) throw new Error('CATEGORY_DATA_INCOMPLETE');
  if (!state.resultConfirmed) throw new Error('RESULT_NOT_CONFIRMED');

  const winner = state.result.winner;
  const isGoldenResult = Boolean(state.isGoldenRound && (state.result.method === 'GDP' || state.result.method === 'SUP'));
  const resultChungScore = Number(state.result.finalScore?.chung ?? state.chung.totalScore);
  const resultHongScore = Number(state.result.finalScore?.hong ?? state.hong.totalScore);
  if (isGoldenResult) {
    const idx = Math.max(0, state.currentRound - 1);
    const goldenChung = Number(state.chung.scores[idx]?.total || 0);
    const goldenHong = Number(state.hong.scores[idx]?.total || 0);
    if (resultChungScore !== goldenChung || resultHongScore !== goldenHong) throw new Error('GOLDEN_RESULT_SCORE_MISMATCH');
  }

  const loser: PlayerColor = winner === 'chung' ? 'hong' : 'chung';
  const now = new Date().toISOString();
  const head = new Set(['head_kick', 'turning_head']);
  const trunk = new Set(['punch', 'trunk_kick', 'turning_kick']);
  const sum = (side: PlayerColor, set: Set<string>) => state.events.filter(e => e.player === side && set.has(e.type)).reduce((n,e)=>n+e.points,0);
  const stats = {
    chung: { matches: 1, wins: winner === 'chung' ? 1 : 0, losses: winner === 'chung' ? 0 : 1, points: state.chung.totalScore, scoreAgainst: state.hong.totalScore, warnings: state.chung.gamjeomCount, penalties: state.chung.gamjeomCount, headPoints: sum('chung', head), trunkPoints: sum('chung', trunk) },
    hong: { matches: 1, wins: winner === 'hong' ? 1 : 0, losses: winner === 'hong' ? 0 : 1, points: state.hong.totalScore, scoreAgainst: state.chung.totalScore, warnings: state.hong.gamjeomCount, penalties: state.hong.gamjeomCount, headPoints: sum('hong', head), trunkPoints: sum('hong', trunk) },
  };
  const replayTimeline = Array.isArray(state.events) ? state.events.map((e:any) => ({
    id: e.id, round: e.round, player: e.player, type: e.type, points: e.points, time: e.time, timestamp: e.timestamp,
    addedBy: e.addedBy, judgeId: e.judgeId, approved: e.approved, correctionCriticalLast10: e.correctionCriticalLast10, warningCount: e.warningCount,
  })) : [];
  const replaySummary = {
    totalEvents: replayTimeline.length,
    scoringEvents: replayTimeline.filter((e:any) => e.type !== 'warning').length,
    rounds: Array.isArray(state.roundWinners) ? state.roundWinners.length : 0,
    durationSeconds: matchDuration(state),
  };
  return {
    id: state.id,
    match_id: state.id,
    tournament_id: state.tournamentId,
    tournament_name: state.competitionName,
    tournament_type: typeLabel(state),
    competition_name: state.competitionName,
    match_number: state.matchNumber,
    mat_number: state.matNumber ?? null,
    weight_category: state.weightCategory,
    gender: state.gender,
    age_group: state.ageGroup,
    age_category: state.ageGroup,
    match_stage: state.matchStage || null,
    stage: state.matchStage || null,
    round: state.currentRound,
    chung_name: state.chung.player.name,
    hong_name: state.hong.player.name,
    chung_nationality: state.chung.player.nationality,
    hong_nationality: state.hong.player.nationality,
    chung_club: state.chung.player.club || null,
    hong_club: state.hong.player.club || null,
    chung_score: state.chung.totalScore,
    hong_score: state.hong.totalScore,
    result_chung_score: resultChungScore,
    result_hong_score: resultHongScore,
    chung_gamjeom: state.chung.gamjeomCount,
    hong_gamjeom: state.hong.gamjeomCount,
    chung_head_points: sum('chung', head),
    chung_trunk_points: sum('chung', trunk),
    hong_head_points: sum('hong', head),
    hong_trunk_points: sum('hong', trunk),
    status: 'finished',
    lifecycle_status: 'COMPLETED',
    winner,
    loser,
    winner_side: winner,
    win_method: state.result.method,
    golden_point_win: Boolean(state.isGoldenRound && state.result && state.result.method === 'GDP'),
    golden_round: state.isGoldenRound ? state.currentRound : null,
    golden_win_criterion: state.isGoldenRound ? (state.result.method === 'GDP' ? 'GOLDEN_POINTS' : state.result.method === 'SUP' ? 'SUPERIORITY' : state.result.method) : null,
    started_at: state.startedAt ? new Date(state.startedAt).toISOString() : null,
    finished_at: state.finishedAt ? new Date(state.finishedAt).toISOString() : now,
    saved_at: now,
    duration_seconds: matchDuration(state),
    result_round: state.result?.method === 'KO' ? state.currentRound : ([...(state.roundWinners || [])].reverse().find((r:any) => r.winner === winner)?.round ?? state.currentRound),
    animation_state: state.animationController || null,
    referee_decision: (state.roundWinners || []).map((r:any) => ({ round: r.round, decisionType: r.decisionType, finalDecision: r.finalDecision, refereeVotes: r.refereeVotes, method: r.method })),
    referee_name: (() => { try { return localStorage.getItem('tkd-referee-name') || null; } catch { return null; } })(),
    ai_score: (() => { const r = [...(state.roundWinners || [])].reverse().find((x:any) => (x as any).aiScore || x.tiebreakDetails?.aiScore); const a = (r as any)?.aiScore || r?.tiebreakDetails?.aiScore; return a ? { chung: a.chung, hong: a.hong } : null; })(),
    ai_confidence: (() => { const r = [...(state.roundWinners || [])].reverse().find((x:any) => (x as any).aiConfidence != null || x.tiebreakDetails?.aiConfidence != null); return (r as any)?.aiConfidence ?? r?.tiebreakDetails?.aiConfidence ?? null; })(),
    timer_state: { currentRound: state.currentRound, timeRemaining: state.timeRemaining, status: state.status },
    rounds_data: state.chung.scores.slice(0, state.config.rounds).map((s,i)=>({ round:i+1, chung:s.total, hong:state.hong.scores[i]?.total || 0 })),
    round_winners: state.roundWinners,
    score_events: state.events,
    replay_timeline: replayTimeline,
    video_replay: null,
    replay_summary: replaySummary,
    statistics: { ...stats, matchRuntime: { status: state.status, startedAt: state.startedAt ?? null, finishedAt: state.finishedAt ?? now, timer: { currentRound: state.currentRound, timeRemaining: state.timeRemaining }, animationState: state.animationController || null, result: state.result || null, resultRound: state.result?.method === 'KO' ? state.currentRound : ([...(state.roundWinners || [])].reverse().find((r:any) => r.winner === winner)?.round ?? state.currentRound) }, matchStateSnapshot: { id: state.id, startedAt: state.startedAt ?? null, finishedAt: state.finishedAt ?? null, config: state.config, status: state.status, currentRound: state.currentRound, timeRemaining: state.timeRemaining, result: state.result || null, tournamentId: state.tournamentId || null, competitionName: state.competitionName || null, matchNumber: state.matchNumber || null, weightCategory: state.weightCategory || null, ageGroup: state.ageGroup || null, gender: state.gender || null, matchStage: state.matchStage || null, matNumber: state.matNumber ?? null, roundWinners: state.roundWinners || [], animationController: state.animationController || null, playerCallStatus: state.playerCallStatus || null, teamCallStatus: state.teamCallStatus || null, selectedCallPlayers: state.selectedCallPlayers || null, singlePlayerCall: state.singlePlayerCall || null, matchupAnimation: state.matchupAnimation || null, teamMode: state.teamMode || null, teamNames: state.teamNames || null, teamRoster: state.teamRoster || null }, roundDecisionHistory: state.roundWinners || [], aiHistory: (state.roundWinners || []).filter((r:any) => r.aiScore || r.aiConfidence != null || r.tiebreakDetails).map((r:any) => ({ round: r.round, aiScore: r.aiScore || r.tiebreakDetails?.aiScore, aiConfidence: r.aiConfidence ?? r.tiebreakDetails?.aiConfidence, reason: r.aiReason || r.tiebreakDetails?.reason, winningCriterion: r.tiebreakDetails?.winningCriterion, finalDecision: r.finalDecision, decisionType: r.decisionType })), refereeDecisionHistory: (state.roundWinners || []).map((r:any) => ({ round: r.round, finalDecision: r.finalDecision, refereeVotes: r.refereeVotes, decisionType: r.decisionType, method: r.method })) },
    mvp_reveal: state.mvpReveal ? {
      ...state.mvpReveal,
      best: state.mvpReveal.best ? { ...state.mvpReveal.best, seedNumber: state.teamRoster?.[state.mvpReveal.best.side]?.find((p:any)=>p.name===state.mvpReveal!.best!.name)?.seedNumber, club: state.clubNames?.[state.mvpReveal.best.side] } : undefined,
      fairPlay: state.mvpReveal.fairPlay ? { ...state.mvpReveal.fairPlay, seedNumber: state.teamRoster?.[state.mvpReveal.fairPlay.side]?.find((p:any)=>p.name===state.mvpReveal!.fairPlay!.name)?.seedNumber, club: state.clubNames?.[state.mvpReveal.fairPlay.side] } : undefined,
    } : null,
    competition_mode: state.config.competitionMode || null,
    team_names: state.teamNames || null,
    team_logos: state.teamLogos || null,
    club_logos: state.clubLogos || null,
    team_country: state.teamCountry || null,
    team_roster: state.teamRoster || null,
    player_ids: { chung: state.chung.player.id, hong: state.hong.player.id },
    team_ids: undefined,
    club_ids: undefined,
  };
}

export function getSavedMatchesForTournament(tournamentId: string, competitionName?: string, tournament?: any): SavedMatchRecord[] {
  const rows = competitionName ? loadMatchesLocal(competitionName) : [];
  const local = rows.filter(r => r.tournament_id === tournamentId && (r.status === 'COMPLETED' || r.status === 'finished')) as SavedMatchRecord[];
  const embedded = Array.isArray(tournament?.bracket_data?.matchRecords) ? tournament.bracket_data.matchRecords.filter((r:any) => (r?.tournament_id === tournamentId || !r?.tournament_id) && (r?.status === 'COMPLETED' || r?.status === 'finished')) : [];
  const byId = new Map<string, SavedMatchRecord>();
  for (const r of [...embedded, ...local]) {
    const key = String(r.match_id || r.id || `${r.tournament_id || tournamentId}|${r.match_number || ''}`);
    const prev = byId.get(key);
    if (!prev || (Date.parse(String(r.updated_at || r.saved_at || '')) || 0) >= (Date.parse(String(prev.updated_at || prev.saved_at || '')) || 0)) byId.set(key, r as SavedMatchRecord);
  }
  return [...byId.values()].sort((a,b) => Number(a.match_number||0) - Number(b.match_number||0));
}

export function getTournamentMatchSummary(tournament: any) {
  if (!tournament) {
    return { total: 0, completed: 0, remaining: 0, players: 0, clubCount: 0, status: 'EMPTY' as const, currentStage: 'QUALIFICATION', semifinal: false, final: false, scheduled: [], completedIds: new Set<string>(), playerStats: {}, clubStats: {}, tournamentStats: { totalMatches: 0, completedMatches: 0, remainingMatches: 0, scheduledMatches: 0, liveMatches: 0 }, ranking: [], matchMvp: [] };
  }
  const bd = tournament?.bracket_data || {};
  const all = bd.mode === 'league' ? (bd.league || []) : (bd.bracket || []);
  const scheduled = all.filter((m:any)=>m && !m.isBye && m.player1 && m.player2);
  const matches = getSavedMatchesForTournament(tournament.id, tournament.name, tournament);
  const completedIds = new Set(matches.map(m=>m.match_id || m.id));
  const completed = completedIds.size;
  const total = Math.max(scheduled.length, Number(bd.totalMatches || 0), completed);
  const remaining = Math.max(0, total - completed);
  const started = completed > 0;
  const semifinal = matches.some(m => String(m.stage || m.match_stage || '').toLowerCase().includes('semi')) || scheduled.some((m:any) => String(m.stage || '').toLowerCase().includes('semi'));
  const final = matches.some(m => String(m.stage || m.match_stage || '').toLowerCase() === 'final' || String(m.stage || m.match_stage || '').toLowerCase().includes('final')) || scheduled.some((m:any) => String(m.stage || '').toLowerCase() === 'final');
  // Registered roster is the authoritative player count. Completed matches
  // are only a historical subset and must not be used to decide whether the
  // weight has players. Include bracket entrants as a fallback for older
  // saves that did not embed the roster.
  const roster = Array.isArray(tournament.players) ? tournament.players.filter((p:any) => p?.name || p?.id) : (Array.isArray(bd.rosterSnapshot) ? bd.rosterSnapshot.filter((p:any)=>p?.name || p?.id) : []);
  const scheduledPlayers = new Map<string, any>();
  for (const m of scheduled) for (const p of [m?.player1, m?.player2]) {
    const key = p?.id || p?.name;
    if (key) scheduledPlayers.set(String(key), p);
  }
  const players = Math.max(roster.length, scheduledPlayers.size);
  const playerStats: Record<string, any> = {};
  const clubStats: Record<string, any> = {};
  for (const m of matches) {
    for (const side of ['chung','hong'] as const) {
      const name = side === 'chung' ? m.chung_name : m.hong_name;
      const club = side === 'chung' ? m.chung_club : m.hong_club;
      const score = Number(side === 'chung' ? m.chung_score : m.hong_score) || 0;
      const against = Number(side === 'chung' ? m.hong_score : m.chung_score) || 0;
      const win = m.winner === side;
      const key = name || side;
      const p = playerStats[key] || { player: key, matches:0, wins:0, losses:0, points:0, scoreAgainst:0, warnings:0, penalties:0, winRate:0 };
      p.matches++; if(win) p.wins++; else p.losses++; p.points += score; p.scoreAgainst += against; p.warnings += Number(side === 'chung' ? m.chung_gamjeom : m.hong_gamjeom) || 0; p.penalties += Number(side === 'chung' ? m.chung_gamjeom : m.hong_gamjeom) || 0; p.winRate = p.matches ? Math.round((p.wins/p.matches)*10000)/100 : 0; playerStats[key]=p;
      if (club) { const c=clubStats[club] || { club, matches:0, wins:0, losses:0, points:0, tournamentPoints:0 }; c.matches++; if(win){c.wins++; c.tournamentPoints++;} else c.losses++; c.points += score; clubStats[club]=c; }
    }
  }
  const playerDirectory = new Map<string, any>();
  for (const p of roster) if (p?.name) playerDirectory.set(String(p.name), p);
  for (const p of scheduledPlayers.values()) if (p?.name && !playerDirectory.has(String(p.name))) playerDirectory.set(String(p.name), p);

  // Club count means registered clubs in the weight, not only clubs that
  // already won a match. This makes the archive useful before the first bout.
  const registeredClubs = new Set<string>();
  for (const p of roster) if (p?.club) registeredClubs.add(String(p.club).trim().toLowerCase());
  for (const p of scheduledPlayers.values()) if (p?.club) registeredClubs.add(String(p.club).trim().toLowerCase());
  const rankings = Object.values(playerStats).sort((a:any,b:any)=>b.wins-a.wins || (b.points-b.scoreAgainst)-(a.points-a.scoreAgainst) || b.points-a.points).map((p:any,i)=>({
    rank:i+1, ...p, ...(() => { const meta=playerDirectory.get(String(p.player)); return { id:meta?.id, photo:meta?.photo, nationality:meta?.nationality || meta?.country, playerNumber:meta?.playerNumber ?? meta?.player_number, seedNumber:meta?.seedNumber ?? meta?.seed_number, club:meta?.club || p.club }; })()
  }));
  const matchMvp = matches.map((m:any) => ({ matchId:m.match_id || m.id, matchNumber:m.match_number, stage:m.stage || m.match_stage || '', winner:m.winner, loser:m.loser, score:{chung:Number(m.chung_score)||0,hong:Number(m.hong_score)||0}, players:{chung:{name:m.chung_name,photo:playerDirectory.get(String(m.chung_name))?.photo,nationality:m.chung_nationality,club:m.chung_club},hong:{name:m.hong_name,photo:playerDirectory.get(String(m.hong_name))?.photo,nationality:m.hong_nationality,club:m.hong_club}}, best:m.mvp_reveal?.best || null, fairPlay:m.mvp_reveal?.fairPlay || null }));
  const completionPercent = total > 0 ? Math.round((completed / total) * 10000) / 100 : 0;
  const tournamentStats = { totalMatches: total, completedMatches: completed, remainingMatches: remaining, scheduledMatches: Math.max(0,total-completed), liveMatches: 0, completionPercent, playerCount: players, clubCount: Math.max(Object.keys(clubStats).length, registeredClubs.size) };
  const ranking = rankings;
  const currentStage = (() => {
    if (total > 0 && completed >= total) return 'FINAL';
    const playable = scheduled.filter((m:any) => m && !m.isBye && m.player1 && m.player2 && !m.winner);
    const liveStage = playable.find((m:any) => ['live','fighting','rest'].includes(String(m.status||'').toLowerCase()))?.stage;
    if (liveStage) return String(liveStage).toUpperCase();
    const nextStage = playable[0]?.stage;
    if (nextStage) return String(nextStage).toUpperCase();
    if (final && completed > 0) return 'FINAL';
    if (semifinal && completed > 0) return 'SEMIFINAL';
    return started ? 'IN PROGRESS' : 'QUALIFICATION';
  })();
  let status: 'EMPTY'|'NOT_STARTED'|'IN_PROGRESS'|'SEMIFINAL'|'FINAL'|'FINISHED' = players === 0 ? 'EMPTY' : 'NOT_STARTED';
  if (total > 0 && completed >= total) status = 'FINISHED';
  else if (/^FINAL/.test(currentStage)) status = 'FINAL';
  else if (/SEMIFINAL|FINAL/.test(currentStage)) status = 'SEMIFINAL';
  else if (started) status = 'IN_PROGRESS';
  const matchRows = [
    ...scheduled.map((m:any) => ({
      id: m.id, matchNumber: m.position != null ? m.position + 1 : m.matchNumber ?? null, round: m.round ?? 1, stage: m.stage || '',
      player1: m.player1 || null, player2: m.player2 || null, winner: (m.winner || matches.find((x:any)=>String(x.match_id||x.id)===String(m.id))?.winner || null),
      status: (m.winner || matches.find((x:any)=>String(x.match_id||x.id)===String(m.id))) ? 'COMPLETED' : (m.status || 'READY'),
      completed: !!(m.winner || matches.find((x:any)=>String(x.match_id||x.id)===String(m.id))), score: matches.find((x:any)=>String(x.match_id||x.id)===String(m.id)) ? `${matches.find((x:any)=>String(x.match_id||x.id)===String(m.id))?.chung_score ?? 0}-${matches.find((x:any)=>String(x.match_id||x.id)===String(m.id))?.hong_score ?? 0}` : (m.score || null),
      completedRecord: matches.find((x:any)=>String(x.match_id||x.id)===String(m.id)) || null,
      replayAvailable: !!matches.find((x:any)=>String(x.match_id||x.id)===String(m.id))?.score_events?.length,
      replayEvents: matches.find((x:any)=>String(x.match_id||x.id)===String(m.id))?.score_events || [],
    })),
    ...matches.filter((m:any)=>!scheduled.some((s:any)=>String(s.id)===String(m.match_id||m.id))).map((m:any)=>({
      id:m.match_id||m.id, matchNumber:m.match_number, round:m.round||1, stage:m.stage||m.match_stage||'', player1:{name:m.chung_name,club:m.chung_club,nationality:m.chung_nationality}, player2:{name:m.hong_name,club:m.hong_club,nationality:m.hong_nationality}, winner:m.winner, status:'COMPLETED', completed:true, score:`${m.chung_score ?? 0}-${m.hong_score ?? 0}`, completedRecord:m, replayAvailable:Array.isArray(m.score_events) && m.score_events.length>0, replayEvents:Array.isArray(m.score_events)?m.score_events:[]
    }))
  ].sort((a:any,b:any)=>Number(a.matchNumber||0)-Number(b.matchNumber||0));
  return { total, completed, remaining, completionPercent, players, clubCount: Math.max(Object.keys(clubStats).length, registeredClubs.size), status, currentStage, semifinal, final, scheduled, matchRows, completedIds, playerStats, clubStats, tournamentStats, ranking, matchMvp };
}

export function getRoundSummary(tournament: any) {
  if (!tournament) return new Map<string, { total:number; completed:number; remaining:number; status:string }>();
  const matches = getSavedMatchesForTournament(tournament.id, tournament.name, tournament);
  const byRound = new Map<string, { total:number; completed:number; remaining:number; status:string }>();
  const scheduled = tournament?.bracket_data?.mode === 'league' ? (tournament.bracket_data.league || []) : (tournament?.bracket_data?.bracket || []);
  for (const m of scheduled) {
    if (!m || m.isBye || !m.player1 || !m.player2) continue;
    const r = String(m.round ?? m.stage ?? 1);
    const x = byRound.get(r) || { total:0, completed:0, remaining:0, status:'NOT_STARTED' };
    x.total++;
    byRound.set(r,x);
  }
  for (const m of matches) {
    const r = String(m.round ?? 1);
    const x = byRound.get(r) || { total:0, completed:0, remaining:0, status:'NOT_STARTED' };
    x.completed++;
    byRound.set(r,x);
  }
  for (const x of byRound.values()) {
    x.remaining = Math.max(0, x.total-x.completed);
    x.status = x.total > 0 && x.completed >= x.total ? 'FINISHED' : x.completed > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
  }
  return byRound;
}

export async function persistSavedMatch(state: MatchState): Promise<{ record: SavedMatchRecord; alreadySaved: boolean }> {
  const record = buildSavedMatchRecord(state);
  const existing = loadMatchesLocal(record.competition_name).find(r => (r.match_id || r.id) === record.match_id || r.match_number === record.match_number && r.tournament_id === record.tournament_id);
  if (existing?.status === 'finished' || existing?.status === 'COMPLETED') return { record: existing as SavedMatchRecord, alreadySaved: true };
  saveMatchLocal(record);

  if (record.tournament_id) {
    const updateTournament = (t:any) => {
      if (!t) return t;
      const bd = { ...(t.bracket_data || {}) };
      const list = Array.isArray(bd.matchRecords) ? bd.matchRecords.filter((m:any)=>m.match_id !== record.match_id) : [];
      bd.matchRecords = [record, ...list];
      const summary = getTournamentMatchSummary({ ...t, bracket_data: bd });
      bd.matchSummary = { total: summary.total, completed: summary.completed, remaining: summary.remaining, status: summary.status };
      bd.statistics = { playerStats: summary.playerStats, clubStats: summary.clubStats, tournamentStats: summary.tournamentStats, ranking: summary.ranking };
      return { ...t, bracket_data: bd };
    };
    if (isLocalTournamentId(record.tournament_id)) {
      const t = loadTournamentLocal(record.tournament_id);
      if (t) saveTournamentLocal(updateTournament(t));
    } else {
      try {
        const { data: t } = await supabase.from('tournaments').select('*').eq('id', record.tournament_id).single();
        if (t) await supabase.from('tournaments').update({ bracket_data: updateTournament(t).bracket_data }).eq('id', record.tournament_id);
      } catch { /* local record remains the durable fallback */ }
      try {
        await supabase.from('matches').upsert({
          id: record.match_id,
          competition_name: record.competition_name,
          match_number: record.match_number,
          mat_number: record.mat_number,
          weight_category: record.weight_category,
          gender: record.gender,
          age_group: record.age_group,
          match_stage: record.match_stage,
          chung_name: record.chung_name,
          hong_name: record.hong_name,
          chung_nationality: record.chung_nationality,
          hong_nationality: record.hong_nationality,
          chung_score: record.chung_score,
          hong_score: record.hong_score,
          result_chung_score: record.result_chung_score,
          result_hong_score: record.result_hong_score,
          golden_point_win: record.golden_point_win,
          golden_round: record.golden_round,
          golden_win_criterion: record.golden_win_criterion,
          chung_gamjeom: record.chung_gamjeom,
          hong_gamjeom: record.hong_gamjeom,
          chung_head_points: record.chung_head_points,
          chung_trunk_points: record.chung_trunk_points,
          hong_head_points: record.hong_head_points,
          hong_trunk_points: record.hong_trunk_points,
          winner: record.winner,
          win_method: record.win_method,
          rounds_data: record.rounds_data,
          round_winners: record.round_winners,
          statistics: record.statistics,
          status: 'finished',
          finished_at: record.finished_at,
          config: state.config as any,
          tournament_id: record.tournament_id,
          competition_mode: record.competition_mode,
          team_names: record.team_names,
          team_logos: record.team_logos,
          club_logos: record.club_logos,
          team_country: record.team_country,
          team_roster: record.team_roster,
          mvp_reveal: record.mvp_reveal,
        } as any, { onConflict: 'id' });
      } catch { /* local + tournament bracket_data remain durable */ }
    }
  }
  logAudit('match_saved', `Match #${record.match_number} — ${record.competition_name}`);
  return { record, alreadySaved: false };
}
