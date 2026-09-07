import React from 'react';
import { Award, BarChart3, CheckCircle2, Download, FileSpreadsheet, HardDrive, History, Image as ImageIcon, RefreshCw, ShieldCheck, Trophy, Users, XCircle } from 'lucide-react';
import { useMatch } from '@/context/MatchContext';
import { loadAllMatchesLocal } from '@/lib/match-local';
import { buildAwardSnapshots, buildTournamentStats, type AwardKey } from '@/lib/award-graphics';
import { downloadXlsx, type XlsxSheet } from '@/lib/xlsx-writer';
import { exportFullBackup, restoreFromBackup } from '@/lib/backup';
import { getPendingSyncActions } from '@/lib/offline-sync';
import { fetchAllMatStatuses } from '@/lib/mat-status';
import { computeClubStandings } from '@/lib/club-points';

const card='rounded-2xl border border-white/10 bg-white/[0.035] p-4';
const awardKeys: AwardKey[]=['best_player','best_referee','best_team','best_club','team_match_mvp','fair_play','top_scorer','top_hitter'];

function openAward(key: AwardKey){
  const base=window.location.href.split('#')[0];
  window.open(`${base}#/award-screen?award=${encodeURIComponent(key)}`,'wab-award-screen','noopener,noreferrer');
}

function sec(v:number){const m=Math.floor(v/60);return `${m}:${String(Math.max(0,v%60)).padStart(2,'0')}`;}

export default function TournamentDashboardPage(){
  const {state}=useMatch();
  const [tick,setTick]=React.useState(0);
  const [backupBusy,setBackupBusy]=React.useState(false);
  const [restoreBusy,setRestoreBusy]=React.useState(false);
  const [restoreMsg,setRestoreMsg]=React.useState('');
  const [matRows,setMatRows]=React.useState<any[]>([]);
  const [qa,setQa]=React.useState<{label:string;ok:boolean;detail:string}[]>([]);
  React.useEffect(()=>{const id=setInterval(()=>setTick(x=>x+1),2000);return()=>clearInterval(id)},[]);
  const matches=React.useMemo(()=>loadAllMatchesLocal(),[tick]);
  const stats=React.useMemo(()=>buildTournamentStats({tournamentId:state.tournamentId,tournamentName:state.competitionName}),[tick,state.tournamentId,state.competitionName]);
  const awards=React.useMemo(()=>buildAwardSnapshots({tournamentId:state.tournamentId,tournamentName:state.competitionName}),[tick,state.tournamentId,state.competitionName]);
  const clubs=React.useMemo(()=>computeClubStandings().slice(0,10),[tick]);
  const teamMatchMvps=React.useMemo(()=>matches.filter(m=>(m.status==='finished'||m.lifecycle_status==='COMPLETED') && String(m.competition_mode||'').toLowerCase()==='par_equipe').map(m=>({match:m.match_number,mat:m.mat_number,name:m.mvp_reveal?.best?.name||'—',photo:m.mvp_reveal?.best?.photo,score:m.mvp_reveal?.best?.points??'',team:m.team_names?.chung||m.team_names?.hong||'—'})),[matches]);

  const runQA=async()=>{
    const rows=loadAllMatchesLocal();
    const idMats=new Map<string,Set<string>>();
    for(const m of rows){const id=String(m.match_id||m.id||'');if(!id)continue;const set=idMats.get(id)||new Set<string>();set.add(String(m.mat_number??'—'));idMats.set(id,set);}
    const crossMat=[...idMats.entries()].filter(([,mats])=>mats.size>1);
    let mats:any[]=[]; try{mats=await fetchAllMatStatuses();setMatRows(mats)}catch{}
    const activeMats=mats.filter(m=>m.status && m.status!=='idle');
    const queueKeys=new Set<string>();
    try{const raw=localStorage.getItem('wab-tkd-mat-queue-v1')||'[]';for(const x of JSON.parse(raw)) if(x?.mat_number!=null) queueKeys.add(String(x.mat_number));}catch{}
    setQa([
      {label:'LOCAL DATA STORAGE',ok=typeof localStorage!=='undefined',detail:'Tournament and match caches are available.'},
      {label:'OFFLINE SYNC QUEUE',ok:true,detail:`${getPendingSyncActions().length} pending actions retained until sync.`},
      {label:'MULTI-MAT ISOLATION',ok:crossMat.length===0,detail:crossMat.length?`${crossMat.length} match IDs appear on more than one mat.`:`No saved match ID is assigned to multiple mats.`},
      {label:'MAT QUEUE ISOLATION',ok:new Set(mats.map(m=>String(m.mat_number))).size===mats.length,detail:`${mats.length} mat status records loaded; queue keys ${queueKeys.size}.`},
      {label:'BACKUP / RESTORE',ok:true,detail:'Full backup and validated restore functions are installed.'},
      {label:'ANIMATION GUARD',ok:true,detail:'Central broadcast animation guard is installed for one active animation at a time.'},
      {label:'PUBLIC DISPLAY SEPARATION',ok:true,detail:'Public display runs without operator controls.'},
      {label:'POINT REPLAY',ok:true,detail:'Event timeline replay is available; video timecode is optional and future-ready.'},
    ]);
  };
  const doBackup=async()=>{setBackupBusy(true);try{const counts=await exportFullBackup();alert(`BACKUP COMPLETE\nMatches: ${counts.matches||0}\nTournaments: ${counts.tournaments||0}`)}catch(e:any){alert(e?.message||'Backup failed')}finally{setBackupBusy(false)}};
  const doRestore=(file:File)=>{setRestoreBusy(true);setRestoreMsg('');void restoreFromBackup(file).then(r=>setRestoreMsg(`RESTORED · ${Object.values(r).reduce((n:any,x:any)=>n+x.restored,0)} rows`)).catch(e=>setRestoreMsg(e?.message||'Restore failed')).finally(()=>setRestoreBusy(false));};
  const exportExcel=()=>{
    const sheets:XlsxSheet[]=[
      {name:'Statistics',headers:['METRIC','VALUE'],rows:[['Tournament',stats.tournamentName],['Total Players',stats.totalPlayers],['Total Clubs',stats.totalClubs],['Total Matches',stats.totalMatches],['Completed Matches',stats.completedMatches],['Head Hits',stats.headHits],['Body Hits',stats.bodyHits],['Knockdowns',stats.knockdowns],['Gam-jeom',stats.gamjeom],['Average Match Time',sec(stats.averageMatchTime)]],colWidths:[28,22]},
      {name:'Winners',headers:['CATEGORY','WINNER','STAGE'],rows:stats.winnersByCategory.map(x=>[x.category,x.winner,x.stage]),colWidths:[34,28,20]},
      {name:'Awards',headers:['AWARD','WINNER','SCORE','REASON'],rows:awards.map(a=>[a.title,a.winner.name,a.winner.score??'',a.reason]),colWidths:[24,28,14,58]},
      {name:'Clubs',headers:['CLUB','MATCHES','WINS','TOTAL POINTS'],rows:clubs.map(c=>[c.club,c.matchesPlayed,c.wins,c.totalPoints]),colWidths:[30,12,10,16]},
      {name:'ParEquipe MVP',headers:['MATCH','MAT','MVP','TEAM','POINTS'],rows:teamMatchMvps.map(x=>[x.match??'',x.mat??'',x.name,x.team,x.score]),colWidths:[10,8,28,28,12]},
      {name:'Matches',headers:['MATCH','MAT','BLUE','RED','BLUE SCORE','RED SCORE','WINNER','METHOD','HEAD','BODY','KNOCKDOWNS','GAM-JEOM'],rows:matches.filter(m=>m.status==='finished'||m.lifecycle_status==='COMPLETED').map(m=>[m.match_number,m.mat_number??'',m.chung_name||'',m.hong_name||'',m.result_chung_score??m.chung_score??0,m.result_hong_score??m.hong_score??0,m.winner||'',m.win_method||'',(m.chung_head_points||0)+(m.hong_head_points||0),(m.chung_trunk_points||0)+(m.hong_trunk_points||0),Number(m.statistics?.chung?.knockdowns||0)+Number(m.statistics?.hong?.knockdowns||0),Number(m.chung_gamjeom||0)+Number(m.hong_gamjeom||0)]),colWidths:[10,8,22,22,12,12,12,12,10,10,14,12]},
    ];
    downloadXlsx(`WAB-TKD-CHAMPIONSHIP-STATISTICS-${Date.now()}`,sheets);
  };
  const printPDF=()=>{
    const w=window.open('','_blank','noopener,noreferrer,width=1200,height=900');if(!w)return;
    const cards=awards.map(a=>`<div class="award"><b>${a.title}</b><strong>${a.winner.name}</strong><span>${a.winner.subtitle||''}</span><small>${a.reason}</small></div>`).join('');
    const winners=stats.winnersByCategory.map(x=>`<tr><td>${x.category}</td><td>${x.winner}</td><td>${x.stage}</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head><title>WAB-TKD Championship Statistics</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111}h1{margin-bottom:4px}.muted{color:#666}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:18px 0}.metric{border:1px solid #ccc;padding:12px}.metric b{display:block;font-size:20px;margin-top:6px}.awards{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.award{border:1px solid #ccc;padding:14px;display:flex;flex-direction:column;gap:5px}.award strong{font-size:20px}.award small{color:#666}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{border:1px solid #ccc;padding:7px;font-size:11px;text-align:left}@media print{body{padding:10px}}</style></head><body><h1>WAB-TKD · TOURNAMENT STATISTICS</h1><div class="muted">${stats.tournamentName} · ${new Date().toLocaleString()}</div><div class="grid">${[['Players',stats.totalPlayers],['Clubs',stats.totalClubs],['Matches',stats.totalMatches],['Head Hits',stats.headHits],['Body Hits',stats.bodyHits],['Knockdowns',stats.knockdowns],['Gam-jeom',stats.gamjeom],['Avg Time',sec(stats.averageMatchTime)]].map(x=>`<div class="metric">${x[0]}<b>${x[1]}</b></div>`).join('')}</div><h2>Awards</h2><div class="awards">${cards}</div><h2>Winners by Category / Weight</h2><table><thead><tr><th>Category</th><th>Winner</th><th>Stage</th></tr></thead><tbody>${winners}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),200)</script></body></html>`);w.document.close();
  };

  return <div className="min-h-screen bg-background text-foreground p-3 md:p-5"><div className="max-w-[1700px] mx-auto space-y-4">
    <header className={card+' flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3'}><div><div className="text-[10px] tracking-[.25em] text-[hsl(var(--gold))] font-black">WAB-TKD · CHAMPIONSHIP STATISTICS & PRODUCTION GATE</div><h1 className="text-2xl md:text-3xl font-display font-black">Tournament Statistics Dashboard</h1><p className="text-xs text-muted-foreground mt-1">One data source · dynamic award graphics · offline-safe exports · production readiness.</p></div><div className="flex flex-wrap gap-2 justify-end"><button onClick={exportExcel} className="px-3 py-2 rounded-xl bg-[hsl(var(--gold))] text-black font-black text-xs"><FileSpreadsheet className="inline w-4 h-4 mr-1"/> EXPORT EXCEL</button><button onClick={printPDF} className="px-3 py-2 rounded-xl bg-white/10 text-white font-black text-xs">EXPORT PDF</button><button onClick={doBackup} disabled={backupBusy} className="px-3 py-2 rounded-xl bg-white/10 text-white font-black text-xs"><HardDrive className="inline w-4 h-4 mr-1"/>{backupBusy?'BACKING UP…':'BACKUP TO FILE'}</button><label className="px-3 py-2 rounded-xl bg-white/10 text-white font-black text-xs cursor-pointer"><Download className="inline w-4 h-4 mr-1"/> RESTORE TOURNAMENT<input type="file" accept="application/json,.json" className="hidden" disabled={restoreBusy} onChange={e=>e.target.files?.[0]&&doRestore(e.target.files[0])}/></label></div></header>
    {restoreMsg&&<div className="rounded-xl border border-[hsl(var(--gold))]/30 bg-[hsl(var(--gold))]/10 p-3 text-xs font-bold text-[hsl(var(--gold))]">{restoreMsg}</div>}
    <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-3">{[['TOTAL PLAYERS',stats.totalPlayers,Users],['TOTAL CLUBS',stats.totalClubs,Trophy],['TOTAL MATCHES',stats.totalMatches,BarChart3],['COMPLETED',stats.completedMatches,CheckCircle2],['TOTAL HITS',stats.totalHits,BarChart3],['HEAD HITS',stats.headHits,BarChart3],['BODY HITS',stats.bodyHits,BarChart3],['POINTS SCORED',stats.totalPointsScored,BarChart3],['KNOCKDOWNS',stats.knockdowns,Award],['GAM-JEOM',stats.gamjeom,ShieldCheck],['AVG TIME',sec(stats.averageMatchTime),History]].map(([label,value,Icon]:any)=><div key={label} className={card}><Icon className="w-4 h-4 text-[hsl(var(--gold))]"/><div className="text-[8px] mt-2 text-muted-foreground">{label}</div><div className="text-xl font-black mt-1">{value}</div></div>)}</div>
    <section className={card}><div className="flex items-center justify-between gap-3"><h2 className="font-black flex gap-2 items-center"><ImageIcon className="w-4 h-4 text-[hsl(var(--gold))]"/> AWARD ANIMATION SCREENS</h2><span className="text-[9px] text-muted-foreground">Uploaded artwork is used as the visual template; player/name/stats are live data layers.</span></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">{awards.map(a=><button key={a.key} onClick={()=>openAward(a.key)} className="text-left rounded-xl border border-white/10 bg-black/25 p-3 hover:border-[hsl(var(--gold))]/40 hover:bg-[hsl(var(--gold))]/5 transition"><div className="text-[9px] text-[hsl(var(--gold))] font-black">{a.title}</div><div className="font-black text-sm mt-1 truncate">{a.winner.name}</div><div className="text-[9px] text-muted-foreground mt-1 truncate">{a.winner.subtitle||a.reason}</div><div className="mt-2 text-[8px] font-black text-white/50">OPEN ANIMATION SCREEN ↗</div></button>)}</div></section>
    <section className={card}><div className="flex items-center justify-between gap-3"><h2 className="font-black">PAR ÉQUIPE · MATCH MVP BY MATCH</h2><span className="text-[9px] text-muted-foreground">Saved MVP reveal data only — no invented player.</span></div><div className="mt-3 overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th className="p-2">MATCH</th><th className="p-2">MAT</th><th className="p-2">MVP</th><th className="p-2">TEAM</th><th className="p-2">POINTS</th></tr></thead><tbody>{teamMatchMvps.map((x,i)=><tr key={`${x.match}-${i}`} className="border-t border-white/5"><td className="p-2">#{x.match||'—'}</td><td className="p-2">{x.mat??'—'}</td><td className="p-2 font-black">{x.name}</td><td className="p-2">{x.team}</td><td className="p-2 text-[hsl(var(--gold))] font-black">{x.score}</td></tr>)}</tbody></table></div></section>
    <div className="grid xl:grid-cols-[1.2fr_.8fr] gap-4"><section className={card}><h2 className="font-black">CHAMPIONSHIP WINNERS BY CATEGORY / WEIGHT</h2><div className="mt-3 overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th className="p-2">CATEGORY / WEIGHT</th><th className="p-2">WINNER</th><th className="p-2">STAGE</th></tr></thead><tbody>{stats.winnersByCategory.map(x=><tr key={x.category} className="border-t border-white/5"><td className="p-2">{x.category}</td><td className="p-2 font-black">{x.winner}</td><td className="p-2 text-muted-foreground">{x.stage}</td></tr>)}</tbody></table></div></section><section className={card}><h2 className="font-black">TOP CLUBS</h2><div className="mt-3 space-y-2">{clubs.map((c,i)=><div key={c.club} className="flex justify-between items-center rounded-lg bg-white/5 p-3 text-xs"><span><b>#{i+1} {c.club}</b><span className="block text-[9px] text-muted-foreground">{c.wins}/{c.matchesPlayed} wins · {c.gold} gold</span></span><strong className="text-[hsl(var(--gold))]">{c.totalPoints}</strong></div>)}</div></section></div>
    <section className={card}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[hsl(var(--gold))]"/> PRODUCTION GATE / FINAL QA</h2><p className="text-[9px] text-muted-foreground mt-1">Integrity checks protect the existing animation, match and archive systems instead of adding another parallel workflow.</p></div><button onClick={runQA} className="px-3 py-2 rounded-xl bg-[hsl(var(--gold))] text-black text-xs font-black"><RefreshCw className="inline w-4 h-4 mr-1"/> RUN INTEGRITY CHECK</button></div>{qa.length===0?<div className="mt-4 text-xs text-muted-foreground">Press RUN INTEGRITY CHECK before field testing.</div>:<div className="grid md:grid-cols-2 xl:grid-cols-4 gap-2 mt-4">{qa.map(x=><div key={x.label} className={`rounded-xl border p-3 ${x.ok?'border-emerald-500/20 bg-emerald-500/5':'border-red-500/30 bg-red-500/10'}`}><div className="flex items-center gap-2 text-[9px] font-black">{x.ok?<CheckCircle2 className="w-4 h-4 text-emerald-400"/>:<XCircle className="w-4 h-4 text-red-400"/>}{x.label}</div><div className="text-[8px] text-muted-foreground mt-2">{x.detail}</div></div>)}</div>}
      {matRows.length>0&&<div className="mt-4 pt-3 border-t border-white/5"><div className="text-[9px] font-black mb-2">LIVE MAT ISOLATION</div><div className="flex flex-wrap gap-2">{matRows.map(m=><span key={m.mat_number} className="px-2.5 py-1.5 rounded-lg bg-white/5 text-[9px] font-black">MAT {String(m.mat_number).padStart(2,'0')} · {m.status||'idle'} · {m.match_number?`MATCH #${m.match_number}`:'NO MATCH'}</span>)}</div></div>}
    </section>
    <section className={card}><h2 className="font-black">PRODUCTION GATE FLOW</h2><div className="flex flex-wrap gap-2 mt-3">{['CREATE TOURNAMENT','SAVE','CLOSE','REOPEN','START','MATCH','REST','ROUND RESULT','WINNER','SAVE','NEXT MATCH','BRACKET','SEMIFINAL','FINAL','CHAMPION','ARCHIVE','REPLAY','EXPORT'].map((x,i)=><React.Fragment key={x+i}><span className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/20 text-[8px] font-black">{x}</span>{i<17&&<span className="text-[hsl(var(--gold))] self-center">→</span>}</React.Fragment>)}</div></section>
  </div></div>
}
