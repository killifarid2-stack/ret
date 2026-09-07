import { buildAwards, getTournamentPerformanceRows, scoreMatchPlayer, aggregatePlayers } from '@/lib/tournament-intelligence';
import type { LocalMatchRecord } from '@/lib/match-local';
import { downloadXlsx, type XlsxSheet } from '@/lib/xlsx-writer';

export type FinalReportKind = 'FINAL_RESULTS'|'BRACKET_REPORT'|'PLAYER_REPORT'|'TEAM_REPORT'|'CLUB_REPORT'|'RANKING_REPORT'|'FAIR_PLAY_REPORT'|'MATCH_REPORT'|'AWARDS_REPORT';

const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const completed=(matches: LocalMatchRecord[])=>matches.filter(m=>m.status==='finished'||m.lifecycle_status==='COMPLETED');
const resultScore=(m: LocalMatchRecord, side:'chung'|'hong')=>Number((side==='chung'?m.result_chung_score:m.result_hong_score) ?? (side==='chung'?m.chung_score:m.hong_score) ?? 0);

export function buildFinalReport(kind: FinalReportKind, matches: LocalMatchRecord[]) {
  const rows=completed(matches);
  let players=getTournamentPerformanceRows();
  if (!players.length && rows.length) {
    const fallback=rows.flatMap((m:any)=>{
      const events=Array.isArray(m.score_events)?m.score_events:[];
      const make=(side:'chung'|'hong',name:any,club:any)=>{const p=scoreMatchPlayer(events,side,side==='chung'?'hong':'chung', {winner:m.winner,method:m.win_method,finalScore:{chung:Number(m.chung_score)||0,hong:Number(m.hong_score)||0}} as any); return {...p,id:m.player_ids?.[side]||name||side,name:name||side.toUpperCase(),club:club||undefined,team:m.team_names?.[side]||undefined};};
      return [make('chung',m.chung_name,m.chung_club),make('hong',m.hong_name,m.hong_club)];
    });
    players=aggregatePlayers(fallback as any);
  }
  const awards=buildAwards(players);
  const teamMap=new Map<string,{matches:number,wins:number,points:number}>();
  rows.forEach(m=>{
    const sides=[['chung',m.team_names?.chung||m.chung_club||'Independent',Number(m.chung_score)||0],['hong',m.team_names?.hong||m.hong_club||'Independent',Number(m.hong_score)||0]] as const;
    sides.forEach(([side,team,score])=>{const x=teamMap.get(team)||{matches:0,wins:0,points:0};x.matches++;x.points+=score;if(m.winner===side)x.wins++;teamMap.set(team,x);});
  });
  const teams=[...teamMap.entries()].map(([team,v])=>({team,...v,winRate:v.matches?Math.round(v.wins/v.matches*10000)/100:0})).sort((a,b)=>b.wins-a.wins||b.points-a.points);
  const golden=rows.filter(m=>m.golden_point_win || m.golden_round!=null || String(m.win_method||'').toUpperCase().includes('GOLD')).length;
  const summary={matches:rows.length,goldenPointWins:golden,blueWins:rows.filter(m=>m.winner==='chung').length,redWins:rows.filter(m=>m.winner==='hong').length,totalPoints:rows.reduce((n,m)=>n+resultScore(m,'chung')+resultScore(m,'hong'),0)};
  return {kind,generatedAt:new Date().toISOString(),summary, matches:rows, players, teams, awards};
}

export function downloadReport(kind: FinalReportKind, matches: LocalMatchRecord[]) {
  const data=buildFinalReport(kind,matches);
  const headers=['MATCH','BLUE','RED','BLUE SCORE','RED SCORE','WINNER','METHOD','GOLDEN ROUND'];
  const csv='\uFEFF'+[headers,...data.matches.map(m=>[m.match_number,m.chung_name||'CHUNG',m.hong_name||'HONG',resultScore(m,'chung'),resultScore(m,'hong'),m.winner||'',m.win_method||'',m.golden_point_win?'YES':'NO'])].map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`WAB-TKD-${kind}-${Date.now()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);
}

/** Real .xlsx counterpart to downloadReport() above — same underlying data,
 *  but as an actual multi-sheet Excel workbook (Matches + Players + Teams +
 *  Awards, whichever apply to this report kind) instead of a flat CSV. Column
 *  widths are set so match/player names aren't truncated on first open. */
export function downloadReportXlsx(kind: FinalReportKind, matches: LocalMatchRecord[]) {
  const data = buildFinalReport(kind, matches);
  const sheets: XlsxSheet[] = [];

  sheets.push({
    name: 'Matches',
    headers: ['MATCH', 'BLUE', 'RED', 'BLUE SCORE', 'RED SCORE', 'WINNER', 'METHOD', 'GOLDEN ROUND'],
    rows: data.matches.map(m => [
      m.match_number ?? '', m.chung_name || 'CHUNG', m.hong_name || 'HONG',
      resultScore(m, 'chung'), resultScore(m, 'hong'), m.winner || '', m.win_method || '',
      m.golden_point_win ? 'YES' : 'NO',
    ]),
    colWidths: [10, 20, 20, 12, 12, 10, 12, 12],
  });

  if (data.players?.length) {
    sheets.push({
      name: 'Players',
      headers: ['NAME', 'CLUB/TEAM', 'MATCHES', 'WINS', 'LOSSES', 'POINTS', 'POINTS AGAINST'],
      rows: data.players.map((p: any) => [p.name || '', p.club || p.team || '', p.matches ?? 0, p.wins ?? 0, p.losses ?? 0, p.points ?? 0, p.pointsAgainst ?? 0]),
      colWidths: [22, 20, 10, 8, 8, 10, 14],
    });
  }

  if (data.teams?.length) {
    sheets.push({
      name: 'Teams',
      headers: ['TEAM/CLUB', 'MATCHES', 'WINS', 'WIN RATE %', 'POINTS'],
      rows: data.teams.map((t: any) => [t.team || '', t.matches ?? 0, t.wins ?? 0, t.winRate ?? 0, t.points ?? 0]),
      colWidths: [22, 10, 8, 12, 10],
    });
  }

  if (data.awards?.length) {
    sheets.push({
      name: 'Awards',
      headers: ['AWARD', 'WINNER', 'REASON', 'SCORE'],
      rows: data.awards.map((a: any) => [a.title || '', a.winner || '', a.reason || '', a.score ?? '']),
      colWidths: [20, 20, 30, 10],
    });
  }

  downloadXlsx(`WAB-TKD-${kind}-${Date.now()}`, sheets);
}

export function printReport(kind: FinalReportKind, matches: LocalMatchRecord[]) {
  const d=buildFinalReport(kind,matches);
  const title=kind.replaceAll('_',' ');
  const body=kind==='AWARDS_REPORT'
    ? `<h1>${esc(title)}</h1><div class="cards">${d.awards.map((a:any)=>`<div><b>${esc(a.title)}</b><strong>${esc(a.winner)}</strong><span>${esc(a.reason)} · ${a.score}</span></div>`).join('')}</div>`
    : `<h1>${esc(title)}</h1><p>Generated ${esc(d.generatedAt)} · Matches ${d.summary.matches} · Golden Point ${d.summary.goldenPointWins} · Total Points ${d.summary.totalPoints}</p><table><thead><tr>${['Match','Blue','Red','Score','Winner','Method','Golden'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${d.matches.map(m=>`<tr><td>#${esc(m.match_number)}</td><td>${esc(m.chung_name||'CHUNG')}</td><td>${esc(m.hong_name||'HONG')}</td><td>${esc(resultScore(m,'chung'))} – ${esc(resultScore(m,'hong'))}</td><td>${esc(m.winner)}</td><td>${esc(m.win_method)}</td><td>${m.golden_point_win?'YES':'NO'}</td></tr>`).join('')}</tbody></table>`;
  const w=window.open('','_blank','noopener,noreferrer,width=1200,height=900'); if(!w)return;
  w.document.write(`<!doctype html><html><head><title>WAB-TKD ${esc(title)}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{font-size:24px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:12px}th{background:#eee}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.cards div{border:1px solid #ccc;padding:16px;display:flex;flex-direction:column;gap:8px}.cards strong{font-size:18px}@media print{body{padding:12px}}</style></head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),150)</script></body></html>`);w.document.close();
}
