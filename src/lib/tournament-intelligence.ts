import { PlayerColor, ScoreEvent, MatchResult } from '@/types/tkd';

export type IntelligencePlayer = {
  id: string;
  name: string;
  nationality?: string;
  club?: string;
  team?: string;
  color?: PlayerColor;
};

export type PlayerPerformance = IntelligencePlayer & {
  matches: number;
  wins: number;
  losses: number;
  rounds: number;
  roundWins: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  hits: number;
  headHits: number;
  bodyHits: number;
  warnings: number;
  penalties: number;
  fairPlay: number;
  scoringEfficiency: number;
  consistency: number;
  opponentStrength: number;
  performanceScore: number;
  contributionScore: number;
};

const clamp = (n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));

export function scoreMatchPlayer(events: ScoreEvent[], color: PlayerColor, opponent: PlayerColor, result?: MatchResult): PlayerPerformance {
  const own = events.filter(e=>e.player===color);
  const opp = events.filter(e=>e.player===opponent);
  const pointsFor = own.reduce((s,e)=>s+Math.max(0,e.points),0);
  const pointsAgainst = opp.reduce((s,e)=>s+Math.max(0,e.points),0);
  const hits = own.filter(e=>e.type!=='gamjeom').length;
  const headHits = own.filter(e=>e.type==='head_kick'||e.type==='turning_head').length;
  const bodyHits = own.filter(e=>e.type==='trunk_kick'||e.type==='turning_kick').length;
  const warnings = own.filter(e=>e.type==='gamjeom').length;
  const rounds = new Set(own.map(e=>e.round)).size || 1;
  const pointDiff = pointsFor-pointsAgainst;
  const win = result?.winner===color;
  const loss = result ? result.winner!==color : false;
  const efficiency = hits ? clamp((pointsFor/(hits*5))*100) : 0;
  const consistency = clamp(100-Math.abs(pointDiff)/(Math.max(1,pointsFor+pointsAgainst))*100);
  const fairPlay = clamp(100-warnings*8);
  const opponentStrength = clamp(50 + Math.min(35, Math.abs(pointsAgainst)*1.5));
  const roundWins = win ? Math.max(1,Math.ceil(rounds*.6)) : Math.floor(rounds*.4);
  const roundPerformance = clamp((roundWins/rounds)*100);
  const pointPerformance = clamp(50+pointDiff*3);
  const performanceScore = Math.round(clamp(
    (win?100:55)*.30 + roundPerformance*.20 + pointPerformance*.15 + efficiency*.10 + opponentStrength*.10 + clamp(hits*8)*.05 + fairPlay*.05 + consistency*.05
  )*100)/100;
  const contributionScore = Math.round(clamp(
    performanceScore*.35 + roundPerformance*.20 + pointPerformance*.15 + opponentStrength*.10 + efficiency*.10 + fairPlay*.05 + consistency*.05
  )*100)/100;
  return {id:'',name:'',matches:1,wins:win?1:0,losses:loss?1:0,rounds,roundWins,pointsFor,pointsAgainst,pointDiff,hits,headHits,bodyHits,warnings,penalties:warnings,fairPlay,scoringEfficiency:efficiency,consistency,opponentStrength,performanceScore,contributionScore};
}

export function calculateMvp(players: PlayerPerformance[]) {
  if(!players.length) return null;
  const sorted=[...players].sort((a,b)=>b.performanceScore-a.performanceScore);
  const best=sorted[0];
  const gap=sorted[1] ? best.performanceScore-sorted[1].performanceScore : 10;
  const confidence=clamp(65+gap*5);
  return {player:best, score:best.performanceScore, confidence:Math.round(confidence), reason:`Highest weighted performance across match result, round performance, scoring efficiency, opponent strength, hits, fair play and consistency.`};
}

export function aggregatePlayers(rows: PlayerPerformance[]): PlayerPerformance[] {
  const map=new Map<string,PlayerPerformance>();
  for(const r of rows){ const id=r.id||r.name; const prev=map.get(id); if(!prev){map.set(id,{...r});continue;} const total=prev.matches+r.matches; map.set(id,{...prev,matches:total,wins:prev.wins+r.wins,losses:prev.losses+r.losses,rounds:prev.rounds+r.rounds,roundWins:prev.roundWins+r.roundWins,pointsFor:prev.pointsFor+r.pointsFor,pointsAgainst:prev.pointsAgainst+r.pointsAgainst,pointDiff:prev.pointDiff+r.pointDiff,hits:prev.hits+r.hits,headHits:prev.headHits+r.headHits,bodyHits:prev.bodyHits+r.bodyHits,warnings:prev.warnings+r.warnings,penalties:prev.penalties+r.penalties,fairPlay:(prev.fairPlay+r.fairPlay)/2,scoringEfficiency:(prev.scoringEfficiency+r.scoringEfficiency)/2,consistency:(prev.consistency+r.consistency)/2,opponentStrength:(prev.opponentStrength+r.opponentStrength)/2,performanceScore:(prev.performanceScore+r.performanceScore)/2,contributionScore:(prev.contributionScore+r.contributionScore)/2}); }
  return [...map.values()].map(r=>({...r,performanceScore:Math.round(r.performanceScore*100)/100,contributionScore:Math.round(r.contributionScore*100)/100}));
}

export type TournamentAward = {key:string; title:string; winner:string; score:number; reason:string};
export function buildAwards(players: PlayerPerformance[]): TournamentAward[] {
  if(!players.length) return [];
  const by=(fn:(p:PlayerPerformance)=>number)=>[...players].sort((a,b)=>fn(b)-fn(a))[0];
  const mvp=by(p=>p.performanceScore), clean=by(p=>p.fairPlay), scorer=by(p=>p.pointsFor), hitter=by(p=>p.hits);
  const teams=new Map<string,PlayerPerformance[]>(); players.forEach(p=>{const k=p.team||p.club||'Independent';teams.set(k,[...(teams.get(k)||[]),p]);});
  let bestTeam='—', bestTeamScore=-1; teams.forEach((rows,team)=>{const s=rows.reduce((a,p)=>a+p.performanceScore,0)/rows.length;if(s>bestTeamScore){bestTeamScore=s;bestTeam=team;}});
  const cleanTeams=[...teams.entries()].map(([team,rows])=>({team,score:rows.reduce((a,p)=>a+p.fairPlay,0)/rows.length})).sort((a,b)=>b.score-a.score);
  const cleanestTeam=cleanTeams[0] || {team:'—',score:0};
  const teamMatchMvp=by(p=>p.contributionScore);
  return [
    {key:'tournament_mvp',title:'TOURNAMENT MVP',winner:mvp.name,score:mvp.performanceScore,reason:'Highest overall Player Performance Score.'},
    {key:'best_player',title:'BEST PLAYER',winner:mvp.name,score:mvp.performanceScore,reason:'Best weighted tournament performance.'},
    {key:'best_team',title:'BEST TEAM',winner:bestTeam,score:Math.round(bestTeamScore*100)/100,reason:'Highest average team performance.'},
    {key:'team_match_mvp',title:'TEAM MATCH MVP',winner:teamMatchMvp.name,score:teamMatchMvp.contributionScore,reason:'Highest contribution score across completed performances.'},
    {key:'fair_play',title:'FAIR PLAY AWARD',winner:clean.name,score:clean.fairPlay,reason:'Highest Fair Play Score.'},
    {key:'cleanest_player',title:'CLEANEST PLAYER',winner:clean.name,score:clean.fairPlay,reason:'Lowest disciplinary burden represented by the highest Fair Play Score.'},
    {key:'cleanest_team',title:'CLEANEST TEAM',winner:cleanestTeam.team,score:Math.round(cleanestTeam.score*100)/100,reason:'Highest average Fair Play Score.'},
    {key:'top_scorer',title:'TOP SCORER',winner:scorer.name,score:scorer.pointsFor,reason:'Most points scored.'},
    {key:'top_hitter',title:'TOP HITTER',winner:hitter.name,score:hitter.hits,reason:'Most recorded scoring hits.'},
  ];
}

const PERF_KEY='wab-tkd-performance-ledger-v1';
export function recordMatchPerformance(matchId:string, rows:PlayerPerformance[]) {
  try {
    const ledger=JSON.parse(localStorage.getItem(PERF_KEY)||'{}');
    ledger[matchId]=rows;
    localStorage.setItem(PERF_KEY,JSON.stringify(ledger));
  } catch {}
}
export function getTournamentPerformanceRows(): PlayerPerformance[] {
  try {
    const ledger=JSON.parse(localStorage.getItem(PERF_KEY)||'{}');
    return aggregatePlayers(Object.values(ledger).flat() as PlayerPerformance[]);
  } catch { return []; }
}
export function clearTournamentPerformanceLedger(){localStorage.removeItem(PERF_KEY);}
