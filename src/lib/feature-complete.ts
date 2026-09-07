export type MatchLifecycle = 'READY'|'LIVE'|'PAUSED'|'COMPLETED'|'CANCELLED';
export type MatAssignment = { mat:number; weight:string; enabled:boolean };
export type TournamentMatch = { id:string; number:number; mat?:number; category:string; weight:string; round:string; blue:string; red:string; status:MatchLifecycle; winner?:string; scheduledAt?:string };

const MATCHES='wab-tkd-feature-matches-v1';
const MAT_RULES='wab-tkd-mat-weight-rules-v1';
const LOCKS='wab-tkd-tournament-locks-v1';

export function loadFeatureMatches():TournamentMatch[]{try{return JSON.parse(localStorage.getItem(MATCHES)||'[]')}catch{return[]}}
export function saveFeatureMatches(rows:TournamentMatch[]){localStorage.setItem(MATCHES,JSON.stringify(rows))}
export function loadMatRules():MatAssignment[]{try{return JSON.parse(localStorage.getItem(MAT_RULES)||'[]')}catch{return[]}}
export function saveMatRules(rows:MatAssignment[]){localStorage.setItem(MAT_RULES,JSON.stringify(rows))}
export function eligibleMats(weight:string,rules=loadMatRules()){const configured=rules.filter(r=>r.enabled&&r.weight===weight).map(r=>r.mat);return configured.length?configured:[...new Set(rules.filter(r=>r.enabled).map(r=>r.mat))]}
export function canAssignMatch(match:TournamentMatch,mat:number,rules=loadMatRules()){return eligibleMats(match.weight,rules).includes(mat)}
export function advanceWinner(matches:TournamentMatch[],matchId:string,winner:string){
  // Canonical bracket progression lives in TournamentManager/OperatorScreen.
  // This helper is retained only for legacy exports: it marks the supplied row
  // completed and never guesses a next match.
  const current=matches.find(m=>m.id===matchId);
  if(!current)return matches;
  current.winner=winner; current.status='COMPLETED';
  return [...matches];
}
export function lockTournament(reason:string){localStorage.setItem(LOCKS,JSON.stringify({locked:true,reason,at:new Date().toISOString()}))}
export function unlockTournament(){localStorage.removeItem(LOCKS)}
export function tournamentLock(){try{return JSON.parse(localStorage.getItem(LOCKS)||'null')}catch{return null}}
export function buildTournamentPackage(data:Record<string,unknown>){return {format:'WAB-TKD-TOURNAMENT-PACKAGE',version:1,exportedAt:new Date().toISOString(),...data}}
export function downloadJson(filename:string,data:unknown){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
