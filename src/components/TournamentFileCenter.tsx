import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Folder, Users, PlayCircle, Trophy, CheckCircle2, ChevronDown, ChevronRight, RotateCcw, CircleDot, Plus, BarChart3, Crown, Medal, Maximize, X, ListOrdered, Swords, ShieldCheck } from 'lucide-react';
import { getTournamentMatchSummary, getRoundSummary } from '@/lib/match-records';
import { AGE_GROUPS, GENDERS, getWeightCategories } from '@/lib/tkd-data';
import { getAllAgeCategories, getAllWeightCategories, syncCategoryCatalogFromCloud } from '@/lib/category-library';
import SavedMatchReplay from './SavedMatchReplay';

interface Props { tournaments: any[]; onOpen: (t:any)=>void; onStart?: (t:any)=>void; activeMatch?: any; onAutoFill?: (ctx:{tournamentName:string; gender:'male'|'female'; ageGroup:string; weight:string; record?:any})=>void; }

type Status = 'EMPTY'|'NOT_STARTED'|'IN_PROGRESS'|'SEMIFINAL'|'FINAL'|'FINISHED';

const STAGE_META = [
  { key:'QUALIFICATION', label:'QUALIFICATION', ar:'التأهيل', cls:'border-sky-400/35 bg-sky-400/10 text-sky-300', dot:'bg-sky-300' },
  { key:'ROUND OF 16', label:'ROUND OF 16', ar:'دور 16', cls:'border-cyan-400/35 bg-cyan-400/10 text-cyan-300', dot:'bg-cyan-300' },
  { key:'QUARTERFINAL', label:'QUARTERFINAL', ar:'ربع النهائي', cls:'border-violet-400/35 bg-violet-400/10 text-violet-300', dot:'bg-violet-300' },
  { key:'SEMIFINAL', label:'SEMIFINAL', ar:'نصف النهائي', cls:'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300', dot:'bg-fuchsia-300' },
  { key:'FINAL', label:'FINAL', ar:'النهائي', cls:'border-[hsl(var(--gold))]/55 bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))]', dot:'bg-[hsl(var(--gold))]' },
] as const;
function stageForRound(round:number,total:number){
  const fromEnd=total-round;
  if(fromEnd===0)return 'FINAL';
  if(fromEnd===1)return 'SEMIFINAL';
  if(fromEnd===2)return 'QUARTERFINAL';
  if(fromEnd===3)return 'ROUND OF 16';
  return 'QUALIFICATION';
}
function roadmap(total:number, completedByRound:Map<string,any>){
  const rows:Array<{key:string;label:string;status:'DONE'|'LIVE'|'NEXT'}>=[];
  for(let r=1;r<=Math.max(1,total);r++){
    const key=stageForRound(r,total); const x=completedByRound.get(String(r));
    const done=!!x && x.total>0 && x.completed>=x.total;
    const live=!!x && x.completed>0 && !done;
    if(!rows.some(v=>v.key===key)) rows.push({key,label:key,status:done?'DONE':live?'LIVE':'NEXT'});
  }
  return rows;
}

const statusMeta: Record<Status,{en:string;ar:string;cls:string;dot:string}> = {
  EMPTY:{en:'EMPTY',ar:'فارغ',cls:'text-white/40 border-white/10 bg-white/5',dot:'bg-white/25'},
  NOT_STARTED:{en:'NOT STARTED • ADD PLAYERS',ar:'لم تبدأ • يمكن إضافة لاعبين',cls:'text-sky-300 border-sky-400/30 bg-sky-400/10',dot:'bg-sky-300'},
  IN_PROGRESS:{en:'STARTED • CONTINUE',ar:'بدأت • يمكن إكمالها',cls:'text-amber-300 border-amber-400/30 bg-amber-400/10',dot:'bg-amber-300'},
  SEMIFINAL:{en:'SEMIFINAL STARTED',ar:'بدأ نصف النهائي',cls:'text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-400/10',dot:'bg-fuchsia-300'},
  FINAL:{en:'FINAL',ar:'النهائي',cls:'text-violet-200 border-violet-400/55 bg-violet-500/10',dot:'bg-violet-300'},
  FINISHED:{en:'FINISHED',ar:'انتهت',cls:'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',dot:'bg-emerald-300'},
};

function WeightCard({
  t, gender, ageGroup, weight, tournamentName, onOpen, onStart, onAutoFill, activeMatch, onViewDetails, expanded, setExpanded,
}: {
  t: any | null;
  gender: 'male' | 'female';
  ageGroup: string;
  weight: string;
  onOpen: (t: any) => void;
  onStart?: (t: any) => void;
  onAutoFill?: (ctx:{tournamentName:string; gender:'male'|'female'; ageGroup:string; weight:string; record?:any})=>void;
  onViewDetails: (ctx:{tournamentName:string; gender:'male'|'female'; ageGroup:string; weight:string; record:any})=>void;
  tournamentName: string;
  activeMatch?: any;
  expanded: string | null;
  setExpanded: (v: string | null) => void;
}) {
  const hasRecord = !!t;
  const summary = hasRecord ? getTournamentMatchSummary(t) : { status: 'EMPTY' as Status, players: 0, total: 0, completed: 0, remaining: 0, clubCount: 0, currentStage: 'QUALIFICATION', semifinal: false, final: false, scheduled: [], completedIds: new Set<string>(), playerStats: {}, clubStats: {}, tournamentStats: { totalMatches: 0, completedMatches: 0, remainingMatches: 0, scheduledMatches: 0, liveMatches: 0 }, ranking: [], matchMvp: [] };
  const rounds = hasRecord ? getRoundSummary(t) : new Map();
  const key = `${gender}|${ageGroup}|${weight}`;
  const isExp = expanded === key;
  const activeForThisWeight = !!activeMatch && String(activeMatch.tournamentId || '') === String(t?.id || '') && String(activeMatch.weightCategory || '').toUpperCase().includes(String(weight).toUpperCase().replace(/^M |^F /,'')) && ['fighting','rest','paused','finished','ivr','kyeshi','doctor'].includes(String(activeMatch.status || '').toLowerCase());
  const effectiveSummary = activeForThisWeight && summary.status !== 'FINISHED' ? { ...summary, status: 'IN_PROGRESS' as Status, currentStage: activeMatch.matchStage || summary.currentStage } : summary;
  const meta = statusMeta[effectiveSummary.status];
  return <div className={`rounded-2xl border-2 overflow-hidden ${meta.cls} shadow-[0_0_24px_rgba(255,255,255,.035)] hover:shadow-[0_0_34px_rgba(242,193,78,.10)] transition-shadow`}>
    <button onClick={()=>setExpanded(isExp ? null : key)} className="w-full text-left p-3 hover:bg-white/[.03]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot} ${effectiveSummary.status==='IN_PROGRESS'||effectiveSummary.status==='SEMIFINAL'?'animate-pulse':''}`} />
          <div className="min-w-0">
            <div className="font-black text-sm truncate">{weight}</div>
            <div className="text-[9px] opacity-70 mt-1 flex flex-wrap gap-2">
              <span className="flex items-center gap-1"><Users size={10}/>{summary.players} PLAYERS</span>
              <span>{summary.clubCount} CLUBS</span><span>TOTAL {summary.total}</span><span>COMPLETED {summary.completed}</span><span>REMAINING {summary.remaining}</span><span>{(effectiveSummary as any).completionPercent ?? 0}% DONE</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0"><span className="px-2 py-1 rounded-md border text-[8px] font-black">{meta.en}</span><span className="px-2 py-1 rounded-md border border-white/10 bg-white/5 text-[8px] font-black text-white/55">{(effectiveSummary as any).currentStage || 'QUALIFICATION'}</span>{isExp?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</div>
      </div>
    </button>
    {isExp && <div className="border-t border-white/10 p-3 space-y-3 bg-black/10">
      {hasRecord ? <>
        <div className="flex gap-2 flex-wrap">
          {effectiveSummary.status!=='FINISHED' && <button onClick={()=>onOpen(t)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black ${effectiveSummary.status==='NOT_STARTED' ? 'bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))] border border-[hsl(var(--gold))]/30' : 'bg-amber-400/10 text-amber-300 border border-amber-400/30'}`}><PlayCircle size={11} className="inline me-1"/>{effectiveSummary.status==='NOT_STARTED' ? 'OPEN WEIGHT' : 'CONTINUE WEIGHT'}</button>}
          {effectiveSummary.status==='NOT_STARTED' && summary.total > 0 && onStart && <button onClick={()=>onStart(t)} className="px-3 py-1.5 rounded-lg border-2 border-emerald-400/40 bg-emerald-400/10 text-emerald-200 text-[10px] font-black shadow-[0_0_18px_rgba(52,211,153,.10)]"><PlayCircle size={11} className="inline me-1"/>START FIRST MATCH</button>}
          {effectiveSummary.status==='IN_PROGRESS' && onStart && <button onClick={()=>onStart(t)} className="px-3 py-1.5 rounded-lg border-2 border-amber-400/40 bg-amber-400/10 text-amber-200 text-[10px] font-black"><PlayCircle size={11} className="inline me-1"/>START NEXT MATCH</button>}
          {effectiveSummary.status==='SEMIFINAL' && onStart && <button onClick={()=>onStart(t)} className="px-3 py-1.5 rounded-lg border-2 border-fuchsia-400/45 bg-fuchsia-400/10 text-fuchsia-200 text-[10px] font-black"><PlayCircle size={11} className="inline me-1"/>START SEMIFINAL</button>}
          {effectiveSummary.status==='FINAL' && onStart && <button onClick={()=>onStart(t)} className="px-3 py-1.5 rounded-lg border-2 border-violet-400/50 bg-violet-500/10 text-violet-200 text-[10px] font-black"><Crown size={11} className="inline me-1"/>START FINAL</button>}
          {effectiveSummary.status==='FINISHED' && <div className="px-3 py-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[.05] text-emerald-300 text-[10px] font-black">✓ FINISHED · OLD MATCHES LOCKED</div>}
          <button onClick={()=>onViewDetails({tournamentName,gender,ageGroup,weight,record:t})} className="px-3 py-1.5 rounded-lg border-2 border-violet-400/50 bg-violet-400/10 text-violet-200 text-[10px] font-black shadow-[0_0_18px_rgba(167,139,250,.12)]"><Maximize size={11} className="inline me-1"/>VIEW ALL</button>
          {effectiveSummary.status==='NOT_STARTED' && <button onClick={()=>onAutoFill?.({tournamentName,gender,ageGroup,weight,record:t})} className="px-3 py-1.5 rounded-lg bg-sky-400/10 text-sky-300 text-[10px] font-black border border-sky-400/20 shadow-[0_0_18px_rgba(51,162,255,.10)]"><Plus size={11} className="inline me-1"/>ADD PLAYERS / AUTO-FILL</button>}
          {effectiveSummary.status==='NOT_STARTED' && <span className="px-3 py-1.5 rounded-lg bg-sky-400/10 text-sky-300 text-[10px] font-black">✓ PLAYERS CAN BE ADDED</span>}
          {effectiveSummary.status==='IN_PROGRESS' && <span className="px-3 py-1.5 rounded-lg bg-amber-400/10 text-amber-300 text-[10px] font-black"><RotateCcw size={11} className="inline me-1"/>CONTINUE THIS WEIGHT</span>}
          {effectiveSummary.status==='SEMIFINAL' && <span className="px-3 py-1.5 rounded-lg bg-fuchsia-400/10 text-fuchsia-300 text-[10px] font-black"><Trophy size={11} className="inline me-1"/>SEMIFINAL IN PROGRESS</span>}
          {effectiveSummary.status==='FINAL' && <span className="px-3 py-1.5 rounded-lg border-2 border-violet-400/45 bg-violet-500/10 text-violet-200 text-[10px] font-black shadow-[0_0_24px_rgba(167,139,250,.16)]"><Crown size={11} className="inline me-1"/>FINAL IN PROGRESS</span>}
          {effectiveSummary.status==='FINISHED' && <div className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-[hsl(var(--gold))]/55 bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] text-[10px] font-black shadow-[0_0_26px_rgba(242,193,78,.18)]"><Trophy size={16}/><span>🏆 FINISHED · CHAMPION DECIDED</span></div>}
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center gap-2 text-[10px] font-black text-[hsl(var(--gold))] mb-3"><Trophy size={13}/> TOURNAMENT ROADMAP</div>
          <div className="grid grid-cols-5 gap-2">
            {roadmap(Math.max(1,...Array.from(rounds.keys()).map(Number)),rounds).map((stage)=><div key={stage.key} className={`rounded-lg border p-2 text-center ${STAGE_META.find(x=>x.key===stage.key)?.cls||'border-white/10 bg-white/5 text-white/50'}`}>
              <div className="text-[8px] font-black">{stage.label}</div><div className="text-[7px] mt-1 opacity-75">{stage.status}</div>
            </div>)}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {Array.from(rounds.entries()).map(([round,r]: any)=><div key={round} className={`rounded-lg border p-3 bg-white/[.02] ${STAGE_META.find(x=>x.key===stageForRound(Number(round),Math.max(1,...Array.from(rounds.keys()).map(Number))))?.cls||'border-white/10'}`}><div className="text-[10px] font-black">{stageForRound(Number(round),Math.max(1,...Array.from(rounds.keys()).map(Number)))}</div><div className="text-[8px] text-white/55 mt-1">TOTAL {r.total} • COMPLETED {r.completed} • REMAINING {r.remaining}</div><div className="text-[8px] mt-1 font-black">ROUND {round} · {r.status}</div></div>)}
        </div>
        <div className="rounded-xl border border-[hsl(var(--gold))]/20 bg-[hsl(var(--gold))]/[.035] p-3">
          <div className="flex items-center gap-2 text-[10px] font-black text-[hsl(var(--gold))] mb-3"><BarChart3 size={13}/> WEIGHT STATISTICS</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="rounded-lg bg-black/20 p-2"><div className="text-[8px] text-white/45">PLAYERS</div><div className="text-lg font-black">{summary.players}</div></div>
            <div className="rounded-lg bg-black/20 p-2"><div className="text-[8px] text-white/45">MATCHES</div><div className="text-lg font-black">{summary.total}</div></div>
            <div className="rounded-lg bg-black/20 p-2"><div className="text-[8px] text-white/45">PLAYED</div><div className="text-lg font-black text-emerald-300">{summary.completed}</div></div>
            <div className="rounded-lg bg-black/20 p-2"><div className="text-[8px] text-white/45">REMAINING</div><div className="text-lg font-black text-amber-300">{summary.remaining}</div></div>
          </div>
          {(() => { const ranked:any[] = summary.ranking || []; const best=ranked[0]; const clean=[...ranked].sort((a,b)=>(a.penalties-b.penalties)||(b.wins-a.wins)||((b.points-b.scoreAgainst)-(a.points-a.scoreAgainst)))[0]; const clubs=Object.values(summary.clubStats||{}).sort((a:any,b:any)=>b.tournamentPoints-a.tournamentPoints||b.points-a.points) as any[]; const bestClub=clubs[0]; return <div className="space-y-3"><div className="grid md:grid-cols-3 gap-2">
            <div className="rounded-lg border border-[hsl(var(--gold))]/25 bg-black/20 p-3"><div className="text-[8px] text-[hsl(var(--gold))]"><Crown size={11} className="inline me-1"/>BEST PLAYER</div><div className="font-black mt-1">{best?.player||'—'}</div><div className="text-[8px] text-white/45 mt-1">W {best?.wins||0} · PTS {best?.points||0} · WR {best?.winRate||0}%</div></div>
            <div className="rounded-lg border border-emerald-400/20 bg-black/20 p-3"><div className="text-[8px] text-emerald-300"><Medal size={11} className="inline me-1"/>CLEANEST PLAYER</div><div className="font-black mt-1">{clean?.player||'—'}</div><div className="text-[8px] text-white/45 mt-1">PEN {clean?.penalties||0} · W {clean?.wins||0}</div></div>
            <div className="rounded-lg border border-violet-400/20 bg-black/20 p-3"><div className="text-[8px] text-violet-300">BEST CLUB</div><div className="font-black mt-1">{bestClub?.club||'—'}</div><div className="text-[8px] text-white/45 mt-1">W {bestClub?.wins||0} · PTS {bestClub?.points||0}</div></div>
          </div><div className="rounded-lg border border-white/10 bg-black/20 p-3"><div className="text-[8px] font-black text-white/55 mb-2">BEST PLAYER · EACH COMPLETED MATCH</div><div className="space-y-1.5 max-h-40 overflow-y-auto">{(summary.matchMvp||[]).map((m:any)=><div key={m.matchId} className="flex items-center justify-between gap-2 rounded-md bg-white/[.025] px-2 py-1.5"><div className="text-[8px] text-white/60">MATCH #{m.matchNumber} · {m.stage||'—'}</div><div className="text-[9px] font-black text-[hsl(var(--gold))]">{m.best?.name||'NOT RECORDED'}</div></div>)}</div></div></div> })()}
        </div>
      </> : <div className="rounded-xl border border-sky-400/20 bg-sky-400/[.035] p-4 text-center"><div className="text-[10px] text-white/55">NO PLAYERS YET / لا يوجد لاعبون بعد</div><button onClick={()=>onAutoFill?.({tournamentName,gender,ageGroup,weight})} className="mt-3 px-5 py-2 rounded-xl bg-sky-400 text-black text-[10px] font-black shadow-[0_0_24px_rgba(56,189,248,.22)]"><Plus size={13} className="inline me-1"/>AUTO-FILL INFO + ADD PLAYERS</button></div>}
    </div>}
  </div>;
}
function ageFolderMeta(weights:any[], records:Map<string,any>, gender:string, age:string){
  const states=weights.map(w=>getTournamentMatchSummary(records.get(`${gender}|${age}|${w}`) || null).status);
  const empty=states.filter(x=>x==='EMPTY').length;
  const active=states.filter(x=>x!=='EMPTY').length;
  if(active===0) return {label:'ALL EMPTY', ar:'فارغة بالكامل', cls:'border-white/15 bg-white/[.03] text-white/50', glow:'shadow-[0_0_22px_rgba(255,255,255,.03)]'};
  if(empty===0) return {label:'ALL WEIGHTS ACTIVE', ar:'كل الأوزان فيها مباريات/بيانات', cls:'border-emerald-400/35 bg-emerald-400/[.06] text-emerald-300', glow:'shadow-[0_0_28px_rgba(52,211,153,.10)]'};
  return {label:`MIXED · ${active} ACTIVE / ${empty} EMPTY`, ar:`مختلطة · ${active} نشطة / ${empty} فارغة`, cls:'border-amber-400/35 bg-amber-400/[.055] text-amber-300', glow:'shadow-[0_0_28px_rgba(251,191,36,.10)]'};
}

export default function TournamentFileCenter({ tournaments, onOpen, onStart, onAutoFill, activeMatch }: Props) {
  useEffect(() => { void syncCategoryCatalogFromCloud(); }, []);
  const [open, setOpen] = useState(true);
  const [expandedTournament, setExpandedTournament] = useState<string|null>(null);
  const [expandedGender, setExpandedGender] = useState<string|null>(null);
  const [expandedAge, setExpandedAge] = useState<string|null>(null);
  const [expandedWeight, setExpandedWeight] = useState<string|null>(null);
  const [details, setDetails] = useState<{tournamentName:string; gender:'male'|'female'; ageGroup:string; weight:string; record:any}|null>(null);
  const [replayRecord, setReplayRecord] = useState<any|null>(null);

  // A tournament is one file. Its saved category records are indexed under
  // that file, but the browser always exposes the complete standard tree:
  // Tournament -> Gender -> Age -> Weight. Empty folders are intentional and
  // do not create fake database/local records.
  const tree = useMemo(() => {
    const root = new Map<string, any[]>();
    for (const t of tournaments) {
      const key = String(t.name || t.id || 'UNTITLED TOURNAMENT');
      if (!root.has(key)) root.set(key, []);
      root.get(key)!.push(t);
    }
    return root;
  }, [tournaments]);

  return <section className="panel p-4 mt-4">
    <button className="w-full flex items-center justify-between" onClick={()=>setOpen(v=>!v)}>
      <span className="flex items-center gap-2 font-display text-sm font-black text-[hsl(var(--gold))]"><FolderOpen size={16}/> TOURNAMENT FILE CENTER</span>
      {open?<ChevronDown size={15}/>:<ChevronRight size={15}/>} 
    </button>

    {open && <div className="mt-4 space-y-3">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center gap-2 text-[10px] font-black tracking-[.16em] text-[hsl(var(--gold))]"><FolderOpen size={13}/> CATEGORY MAP · GENDER · AGE · WEIGHT</div>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {GENDERS.flatMap(g => getAllAgeCategories(g.value)).filter((age,i,arr)=>arr.findIndex(x=>x.value===age.value)===i).map(age => {
            const maleWeights=getAllWeightCategories('male',age.value).length;
            const femaleWeights=getAllWeightCategories('female',age.value).length;
            return <div key={age.value} className="rounded-xl border border-white/10 bg-white/[.025] p-2.5">
              <div className="flex items-center gap-1.5 text-[9px] font-black text-white"><Users size={11} className="text-cyan-300"/>{age.label}</div>
              <div className="mt-1.5 flex items-center gap-2 text-[7px] font-black"><span className="text-sky-300">♂ {maleWeights} WEIGHTS</span><span className="text-pink-300">♀ {femaleWeights} WEIGHTS</span></div>
              <div className="mt-1 text-[7px] text-white/35">⚖ {maleWeights+femaleWeights} total weight folders</div>
            </div>;
          })}
        </div>
      </div>
      {Array.from(tree.entries()).map(([tournamentName, items])=>{
        const tournamentOpen = expandedTournament===tournamentName;
        const savedByKey = new Map<string, any>();
        items.forEach(t => savedByKey.set(`${t.gender}|${t.age_group}|${t.weight_category}`, t));
        const activeWeights = items.filter(t=>['IN_PROGRESS','SEMIFINAL'].includes(getTournamentMatchSummary(t).status));
        const totalFolders = GENDERS.reduce((n,g)=>n + getAllAgeCategories(g.value).reduce((a,age)=>a + getAllWeightCategories(g.value,age.value).length,0),0);
        return <div key={tournamentName} className="rounded-2xl border border-[hsl(var(--gold))]/20 bg-black/15 overflow-hidden">
          <button onClick={()=>setExpandedTournament(tournamentOpen?null:tournamentName)} className="w-full p-4 text-left hover:bg-white/[.025]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0"><Folder size={19} className="text-[hsl(var(--gold))] shrink-0"/><div className="min-w-0"><div className="font-display font-black text-sm text-[hsl(var(--gold))] truncate">{tournamentName}</div><div className="text-[9px] text-white/45 mt-1">{totalFolders} CATEGORY FOLDERS • {items.length} SAVED</div></div></div>
              {tournamentOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>} 
            </div>
          </button>

          {tournamentOpen && <div className="border-t border-white/10 p-3 space-y-3">
            {(() => { const agg=items.map((x:any)=>getTournamentMatchSummary(x)).reduce((a:any,s:any)=>({matches:a.matches+s.total,finished:a.finished+s.completed,players:a.players+s.players,remaining:a.remaining+s.remaining,live:a.live+(['IN_PROGRESS','SEMIFINAL'].includes(s.status)?1:0)}),{matches:0,finished:0,players:0,remaining:0,live:0}); return <div className="rounded-xl border border-[hsl(var(--gold))]/20 bg-[hsl(var(--gold))]/[.025] p-3"><div className="text-[9px] font-black tracking-[.16em] text-[hsl(var(--gold))]">TOURNAMENT TOTALS · ALL GENDERS / AGES / WEIGHTS</div><div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-[8px]"><div>PLAYERS <b>{agg.players}</b></div><div>MATCHES <b>{agg.matches}</b></div><div>FINISHED <b className="text-emerald-300">{agg.finished}</b></div><div>REMAINING <b className="text-amber-300">{agg.remaining}</b></div><div>ACTIVE WEIGHTS <b className="text-sky-300">{agg.live}</b></div></div></div>; })()}
            {activeWeights.length>0 && <div className="rounded-xl border border-amber-400/20 bg-amber-400/[.035] p-3">
              <div className="flex items-center gap-2 text-[10px] font-black text-amber-300 mb-2"><CircleDot size={12}/> CONTINUE / IN PROGRESS WEIGHTS</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{activeWeights.map(t=>{const s=getTournamentMatchSummary(t);return <button key={t.id} onClick={()=>onOpen(t)} className="text-left rounded-lg border border-amber-400/20 bg-black/20 p-2 hover:bg-amber-400/10"><div className="text-[10px] font-black">{t.gender?.toUpperCase()} · {t.age_group} · {t.weight_category}</div><div className="text-[8px] text-amber-200/70 mt-1">{s.completed}/{s.total} COMPLETED · {s.remaining} REMAINING</div></button>})}</div>
            </div>}

            {GENDERS.map(g=>{
              const gKey=`${tournamentName}|${g.value}`; const gOpen=expandedGender===gKey;
              return <div key={gKey} className="rounded-xl border border-white/10 bg-white/[.015] overflow-hidden">
                <button onClick={()=>setExpandedGender(gOpen?null:gKey)} className="w-full p-3 flex items-center justify-between text-left"><span className={`font-black text-xs flex items-center gap-1 ${g.value==='male'?'text-sky-300':'text-pink-300'}`}><Users size={12}/>{g.value==='male'?'♂ MALE':'♀ FEMALE'}</span>{gOpen?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button>
                {gOpen && <div className="border-t border-white/10 p-3 space-y-2">
                  {getAllAgeCategories(g.value).map(age=>{
                    const aKey=`${gKey}|${age.value}`; const aOpen=expandedAge===aKey;
                    const weights=getAllWeightCategories(g.value,age.value);
                    return <div key={aKey} className="rounded-lg border border-white/10 overflow-hidden">
                      {(() => { const fm=ageFolderMeta(weights,savedByKey,g.value,age.value); return <button onClick={()=>setExpandedAge(aOpen?null:aKey)} className={`w-full p-3 flex items-center justify-between text-left border-l-2 ${fm.cls} ${fm.glow}`}>
                        <span className="min-w-0"><span className="text-[10px] font-black text-white/85">{age.label}</span><span className={`ml-2 inline-flex px-2 py-0.5 rounded-full border text-[7px] font-black ${fm.cls}`}>{fm.label}</span></span>{aOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</button>; })()}
                      {aOpen && <div className="border-t border-white/10 p-2 grid gap-2">
                        {weights.map(weight=>{
                          const rec=savedByKey.get(`${g.value}|${age.value}|${weight}`) || null;
                          return <WeightCard key={`${g.value}-${age.value}-${weight}`} t={rec} gender={g.value as 'male'|'female'} ageGroup={age.value} weight={weight} tournamentName={tournamentName} onOpen={onOpen} onStart={onStart} onAutoFill={onAutoFill} activeMatch={activeMatch} onViewDetails={setDetails} expanded={expandedWeight} setExpanded={setExpandedWeight}/>;
                        })}
                      </div>}
                    </div>;
                  })}
                </div>}
              </div>;
            })}
          </div>}
        </div>;
      })}
    </div>}

    {details && (() => {
      const summary = getTournamentMatchSummary(details.record);
      const rounds = getRoundSummary(details.record);
      const ranking:any[] = summary.ranking || [];
      const clubs:any[] = Object.values(summary.clubStats || {}).sort((a:any,b:any) => b.tournamentPoints-a.tournamentPoints || b.points-a.points);
      const clean = [...ranking].sort((a,b)=>(a.penalties-b.penalties)||(b.wins-a.wins)||(b.points-b.scoreAgainst-(a.points-a.scoreAgainst)))[0];
      const players:any[] = Array.isArray(details.record.players) ? details.record.players : [];
      const status = statusMeta[summary.status as Status];
      return <div className="fixed inset-0 z-[500] bg-[#05070b]/95 backdrop-blur-xl overflow-y-auto" onMouseDown={()=>setDetails(null)}>
        <div className="min-h-screen w-full p-4 md:p-6 lg:p-8" onMouseDown={e=>e.stopPropagation()}>
          <div className="mx-auto w-full max-w-[1800px]">
            <div className="relative overflow-hidden rounded-3xl border-2 border-[hsl(var(--gold))]/35 bg-[radial-gradient(circle_at_15%_0%,rgba(242,193,78,.13),transparent_30%),radial-gradient(circle_at_90%_20%,rgba(51,162,255,.09),transparent_28%),linear-gradient(145deg,#0b0f17,#05070b)] p-5 md:p-7 shadow-[0_0_100px_rgba(242,193,78,.12)]">
              <div className="pointer-events-none absolute -top-24 left-1/3 h-64 w-64 rounded-full bg-[hsl(var(--gold))]/10 blur-3xl"/>
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[9px] font-black tracking-[.35em] text-[hsl(var(--gold))]">TOURNAMENT FILE · FULL WEIGHT VIEW</div>
                  <h2 className="mt-2 text-2xl md:text-4xl font-black tracking-tight text-white">{details.tournamentName}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black text-white/65">
                    <span className="rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5">{details.gender === 'male' ? '♂ MALE' : '♀ FEMALE'}</span>
                    <span className="rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5">{details.ageGroup}</span>
                    <span className="rounded-lg border-2 border-[hsl(var(--gold))]/35 bg-[hsl(var(--gold))]/10 px-3 py-1.5 text-[hsl(var(--gold))]">{details.weight}</span>
                    <span className={`rounded-lg border px-3 py-1.5 ${status.cls}`}>{status.en}</span>
                  </div>
                </div>
                <button onClick={()=>setDetails(null)} className="rounded-xl border-2 border-white/15 bg-white/[.04] px-4 py-2.5 text-[10px] font-black text-white/80 hover:border-[hsl(var(--gold))]/50"><X size={15} className="inline me-1"/>CLOSE</button>
              </div>

              <div className="relative mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[['PLAYERS',summary.players,Users],['CLUBS',summary.clubCount,Folder],['TOTAL MATCHES',summary.total,Swords],['PLAYED',summary.completed,CheckCircle2],['REMAINING',summary.remaining,RotateCcw],['PROGRESS',`${(summary as any).completionPercent ?? 0}%`,BarChart3]].map(([label,value,Icon]:any)=><div key={label} className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner"><div className="flex items-center gap-2 text-[9px] font-black tracking-[.16em] text-white/45"><Icon size={13}/>{label}</div><div className="mt-2 text-3xl md:text-4xl font-black tabular-nums">{value}</div></div>)}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 rounded-2xl border border-[hsl(var(--gold))]/20 bg-[#0a0d13] p-4 md:p-5">
                <div className="flex items-center gap-2 text-[11px] font-black tracking-[.18em] text-[hsl(var(--gold))]"><Trophy size={14}/> TOURNAMENT ROADMAP</div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">
                  {STAGE_META.map((meta,i)=>{
                    const roundRows=Array.from(rounds.entries()).map(([r,v]:any)=>({r:Number(r),...v}));
                    const row=roundRows.find(x=>stageForRound(x.r,Math.max(1,...roundRows.map(y=>y.r)))===meta.key);
                    const active=summary.status==='FINISHED' ? meta.key==='FINAL' : row && (row.completed>0 || row.remaining>0);
                    const done=!!row && row.total>0 && row.completed>=row.total;
                    return <div key={meta.key} className={`rounded-xl border-2 p-3 text-center ${meta.cls} ${active?'shadow-[0_0_24px_rgba(255,255,255,.07)]':''}`}><div className="text-[9px] font-black">{meta.label}</div><div className="mt-1 text-[8px] opacity-70">{done?'DONE':active?'ACTIVE':'NEXT'}</div></div>
                  })}
                </div>
                <div className="mt-4 space-y-2">
                  {Array.from(rounds.entries()).map(([round,r]:any)=>{const totalRounds=Math.max(1,...Array.from(rounds.keys()).map(Number)); const stage=stageForRound(Number(round),totalRounds); const meta=STAGE_META.find(x=>x.key===stage); return <div key={round} className={`rounded-xl border p-3 bg-white/[.02] ${meta?.cls||'border-white/10'}`}><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-black text-[10px]">{stage} · ROUND {round}</div><div className="text-[8px] font-black text-white/55">TOTAL {r.total} · DONE {r.completed} · LEFT {r.remaining}</div></div></div>})}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-[#0a0d13] p-4 md:p-5">
                <div className="flex items-center gap-2 text-[11px] font-black tracking-[.18em] text-emerald-300"><ShieldCheck size={14}/> WEIGHT HIGHLIGHTS</div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-[hsl(var(--gold))]/25 bg-[hsl(var(--gold))]/[.05] p-3"><div className="text-[8px] text-[hsl(var(--gold))]">BEST PLAYER</div><div className="mt-1 font-black">{ranking[0]?.player || '—'}</div><div className="mt-1 text-[8px] text-white/50">W {ranking[0]?.wins||0} · PTS {ranking[0]?.points||0} · WR {ranking[0]?.winRate||0}%</div></div>
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[.03] p-3"><div className="text-[8px] text-emerald-300">CLEANEST PLAYER</div><div className="mt-1 font-black">{clean?.player || '—'}</div><div className="mt-1 text-[8px] text-white/50">PEN {clean?.penalties||0} · W {clean?.wins||0}</div></div>
                  <div className="rounded-xl border border-violet-400/20 bg-violet-400/[.03] p-3"><div className="text-[8px] text-violet-300">BEST CLUB</div><div className="mt-1 font-black">{clubs[0]?.club || '—'}</div><div className="mt-1 text-[8px] text-white/50">W {clubs[0]?.wins||0} · PTS {clubs[0]?.points||0}</div></div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-[#0a0d13] p-4 md:p-5">
                <div className="flex items-center gap-2 text-[11px] font-black tracking-[.18em] text-white/75"><ListOrdered size={14}/> PLAYER RANKING</div>
                <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-[9px]"><thead className="text-white/35"><tr><th className="p-2">#</th><th className="p-2">PLAYER</th><th className="p-2">MATCHES</th><th className="p-2">W</th><th className="p-2">L</th><th className="p-2">PTS</th><th className="p-2">WR</th></tr></thead><tbody>{ranking.map((r:any)=><tr key={r.player} className="border-t border-white/5"><td className="p-2 font-black text-[hsl(var(--gold))]">{r.rank}</td><td className="p-2 font-black text-white">{r.player}</td><td className="p-2">{r.matches}</td><td className="p-2 text-emerald-300">{r.wins}</td><td className="p-2 text-red-300">{r.losses}</td><td className="p-2 font-black">{r.points}</td><td className="p-2">{r.winRate}%</td></tr>)}</tbody></table>{ranking.length===0&&<div className="p-6 text-center text-[9px] text-white/35">NO COMPLETED MATCH DATA YET</div>}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0a0d13] p-4 md:p-5">
                <div className="flex items-center gap-2 text-[11px] font-black tracking-[.18em] text-white/75"><Folder size={14}/> CLUB RANKING</div>
                <div className="mt-3 space-y-2">{clubs.map((c:any,i)=><div key={c.club} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[.02] p-3"><div><span className="mr-2 font-black text-[hsl(var(--gold))]">#{i+1}</span><span className="font-black text-[10px]">{c.club}</span></div><div className="text-[8px] text-white/50">W {c.wins} · PTS {c.points} · TOURNAMENT {c.tournamentPoints}</div></div>)}{clubs.length===0&&<div className="p-6 text-center text-[9px] text-white/35">NO CLUB DATA YET</div>}</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[hsl(var(--gold))]/20 bg-[#0a0d13] p-4 md:p-5">
              <div className="flex items-center gap-2 text-[11px] font-black tracking-[.18em] text-[hsl(var(--gold))]"><Medal size={14}/> COMPLETED MATCHES · BEST PLAYER</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {(summary.matchMvp||[]).map((m:any)=><div key={m.matchId} className="rounded-xl border border-white/10 bg-white/[.025] p-3"><div className="flex items-center justify-between gap-2"><span className="text-[8px] font-black text-white/45">MATCH #{m.matchNumber}</span><span className="text-[8px] font-black text-white/45">{m.stage||'—'}</span></div><div className="mt-2 text-[11px] font-black text-[hsl(var(--gold))]">{m.best?.name || 'NOT RECORDED'}</div><div className="mt-1 text-[8px] text-white/45">{m.best?.club || 'Club —'} · Seed {m.best?.seedNumber ?? '—'} · {m.best?.side ? String(m.best.side).toUpperCase() : '—'}</div><div className="mt-2 text-[8px] text-white/45">FAIR PLAY: {m.fairPlay?.name || '—'}</div></div>)}
                {(!summary.matchMvp || summary.matchMvp.length===0) && <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-white/10 p-6 text-center text-[9px] text-white/35">NO COMPLETED MATCHES / لا توجد مباريات مكتملة بعد</div>}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-[#0a0d13] p-4 md:p-5">
              <div className="flex items-center gap-2 text-[11px] font-black tracking-[.18em] text-white/75"><Swords size={14}/> MATCH ARCHIVE · COMPLETED / REMAINING / REPLAY</div>
              <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-2">
                {(summary.matchRows||[]).map((m:any)=>{
                  const rec=m.completedRecord; const done=!!m.completed;
                  const p1=m.player1?.name || 'CHUNG'; const p2=m.player2?.name || 'HONG';
                  const score=rec ? `${rec.chung_score ?? 0} — ${rec.hong_score ?? 0}` : (m.score || '—');
                  const stage=String(m.stage||'QUALIFICATION').toUpperCase();
                  const stageClass=stage.includes('FINAL') && !stage.includes('SEMIFINAL') ? 'border-violet-400/50 bg-violet-500/10 text-violet-200' : stage.includes('SEMIFINAL') ? 'border-fuchsia-400/45 bg-fuchsia-400/10 text-fuchsia-200' : stage.includes('QUARTER') ? 'border-violet-400/30 bg-violet-400/[.06] text-violet-300' : 'border-white/10 bg-white/[.02] text-white/55';
                  return <div key={m.id} className={`rounded-xl border-2 p-3 ${done?'border-emerald-400/25 bg-emerald-400/[.025]':'border-amber-400/25 bg-amber-400/[.025]'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[8px] font-black text-white/45">MATCH #{m.matchNumber ?? '—'} · R{m.round ?? '—'}</span><span className={`rounded-md border px-2 py-1 text-[7px] font-black ${stageClass}`}>{stage}</span><span className={`rounded-md border px-2 py-1 text-[7px] font-black ${done?'border-emerald-400/25 bg-emerald-400/10 text-emerald-300':'border-amber-400/25 bg-amber-400/10 text-amber-300'}`}>{done?'COMPLETED':'REMAINING'}</span></div>
                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="text-center"><div className="text-[10px] font-black text-[hsl(var(--chung))]">{p1}</div>{rec?.chung_club && <div className="mt-1 text-[7px] text-white/40">{rec.chung_club}</div>}</div>
                      <div className="text-center font-display text-lg font-black text-white">{score}</div>
                      <div className="text-center"><div className="text-[10px] font-black text-[hsl(var(--hong))]">{p2}</div>{rec?.hong_club && <div className="mt-1 text-[7px] text-white/40">{rec.hong_club}</div>}</div>
                    </div>
                    {done && rec && <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-1.5 text-[7px]">
                      <span className="rounded-md border border-white/8 bg-black/20 px-2 py-1 text-white/55">WINNER: <b className="text-white">{rec.winner==='chung'?'BLUE':'RED'}</b></span>
                      <span className="rounded-md border border-white/8 bg-black/20 px-2 py-1 text-white/55">METHOD: <b className="text-white">{rec.win_method||'—'}</b></span>
                      <span className="rounded-md border border-white/8 bg-black/20 px-2 py-1 text-white/55">HEAD: <b className="text-white">{(rec.chung_head_points||0)+(rec.hong_head_points||0)}</b></span>
                      <span className="rounded-md border border-white/8 bg-black/20 px-2 py-1 text-white/55">GAM-JEOM: <b className="text-white">{(rec.chung_gamjeom||0)+(rec.hong_gamjeom||0)}</b></span>
                      <span className="rounded-md border border-white/8 bg-black/20 px-2 py-1 text-white/55">ROUND: <b className="text-white">R{rec.result_round ?? rec.round ?? '—'}</b></span>
                      <span className="rounded-md border border-white/8 bg-black/20 px-2 py-1 text-white/55">DURATION: <b className="text-white">{rec.duration_seconds ?? '—'}s</b></span>
                      <span className="rounded-md border border-white/8 bg-black/20 px-2 py-1 text-white/55">AI: <b className="text-white">{rec.ai_confidence != null ? `${rec.ai_confidence}%` : '—'}</b></span>
                    </div>}
                    {done && rec && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[7px]"><span className="text-emerald-300/80">✓ RESULT SAVED</span><span className="text-cyan-200/80">POINT REPLAY: {Array.isArray(rec.score_events)?rec.score_events.length:0} EVENTS</span><span className="text-white/35">R1/R2/R3 + DECISIONS + AI/WOO-SE-GIROK PRESERVED</span><button type="button" onClick={()=>setReplayRecord(rec)} className="rounded-md border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-[7px] font-black text-cyan-200 hover:bg-cyan-400/15">▶ WATCH POINT REPLAY</button></div>}
                  </div>;
                })}
                {(!summary.matchRows || summary.matchRows.length===0) && <div className="xl:col-span-2 py-6 text-center text-[9px] text-white/35">NO MATCHES SCHEDULED YET</div>}
              </div>
            </div>
            {players.length>0 && <div className="mt-4 rounded-2xl border border-white/10 bg-[#0a0d13] p-4 md:p-5"><div className="flex items-center gap-2 text-[11px] font-black tracking-[.18em] text-white/75"><Users size={14}/> PLAYER DIRECTORY · SAVED DATA</div><div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">{players.map((pl:any,i:number)=><div key={pl.id||`${pl.name}-${i}`} className="rounded-xl border border-white/8 bg-white/[.02] p-3">{pl.photo?<img src={pl.photo} alt="" className="mb-2 h-10 w-10 rounded-full object-cover border border-white/10"/>:null}<div className="text-[10px] font-black">{pl.name||'PLAYER'}</div><div className="mt-1 text-[8px] text-white/45">{pl.club||'Club —'} · {pl.nationality||pl.country||'Country —'}</div><div className="mt-1 text-[8px] text-white/45">NO. {pl.playerNumber??'—'} · SEED {pl.seedNumber??'—'}</div></div>)}</div></div>}
          </div>
        </div>
      </div>;
    })()}

    {replayRecord && <SavedMatchReplay record={replayRecord} onClose={()=>setReplayRecord(null)} />}
  </section>;
}
