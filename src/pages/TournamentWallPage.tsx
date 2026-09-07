import React, { useEffect, useState } from 'react';
import { Radio, Clock3, MapPin, Trophy } from 'lucide-react';
import { fetchAllMatStatuses, getMatCount, MatLiveStatus } from '@/lib/mat-status';
import { listQueuedMatches, MatQueuedMatch } from '@/lib/mat-queue';
import { getCountryFlag } from '@/lib/flags';

const statusText: Record<string, { en: string; ar: string }> = {
  idle:{en:'AVAILABLE',ar:'متاح'}, waiting:{en:'READY',ar:'جاهز'}, running:{en:'LIVE',ar:'مباشر'}, paused:{en:'PAUSED',ar:'متوقف'}, finished:{en:'FINISHED',ar:'انتهت'}
};

function PlayerLine({ name, nationality, color }: { name?: string|null; nationality?: string|null; color:'blue'|'red' }) {
  if (!name) return null;
  return <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${color==='blue'?'bg-blue-700/25':'bg-red-700/25'} border ${color==='blue'?'border-blue-500/20':'border-red-500/20'}`}>
    <span className={`w-2.5 h-8 rounded-full ${color==='blue'?'bg-blue-500':'bg-red-500'}`} />
    <div className="text-2xl font-black tracking-tight flex-1">{name}</div>
    <div className="text-xl">{getCountryFlag(nationality || '')}</div>
  </div>;
}

export default function TournamentWallPage() {
  const [mats, setMats] = useState<MatLiveStatus[]>([]);
  const [queue, setQueue] = useState<MatQueuedMatch[]>([]);
  const [matCount, setMatCount] = useState(getMatCount());
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const load = async () => { setMats(await fetchAllMatStatuses()); setQueue(await listQueuedMatches()); setMatCount(getMatCount()); };
    load(); const i=setInterval(load,3000); const c=setInterval(()=>setClock(new Date()),1000);
    return()=>{clearInterval(i);clearInterval(c)};
  },[]);
  const byMat=React.useMemo(()=>new Map(mats.map(m=>[m.mat_number,m])),[mats]);
  const queuedByMat=React.useMemo(()=>new Map(queue.map(q=>[q.mat_number,q])),[queue]);
  const activeTournament=React.useMemo(()=>mats.find(m=>m.competition_name)?.competition_name || 'WAB-TKD TOURNAMENT',[mats]);
  return <div className="min-h-screen bg-black text-white" dir="ltr">
    {/* Was previously a dead-end full-screen display with zero way back to
        any other screen once opened (no TopNav rendered at all) — the
        Central Read-Only Display intent is preserved (this page still has
        no referee/scoring controls), but the operator can now navigate
        away to Admin/Operator/Scoreboard/etc. like every other screen. */}
    <div className="border-b border-white/10 bg-black/60">
      
    </div>
    <div className="p-5">
    <header className="flex items-center justify-between mb-5 border-b border-white/10 pb-4">
      <div><div className="text-[11px] text-[hsl(var(--gold))] font-black tracking-[0.25em]">WAB-TKD · TOURNAMENT WALL</div><h1 className="text-3xl font-black tracking-tight">{activeTournament}</h1><div className="text-xs text-white/50 mt-1">LIVE MAT SCHEDULE · NEXT MATCH · OFFICIAL MAT ASSIGNMENT</div></div>
      <div className="text-right"><div className="text-2xl font-display font-black">{clock.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div><div className="text-[10px] text-white/40">{mats.filter(m=>m.status==='running').length} LIVE · {mats.filter(m=>m.status==='idle').length} AVAILABLE</div></div>
    </header>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({length:matCount},(_,i)=>i+1).map(mat=>{ const live=byMat.get(mat); const q=queuedByMat.get(mat); const status=live?.status||'idle'; return <section key={mat} className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] shadow-2xl">
        <div className="px-4 py-3 flex items-center justify-between bg-white/[0.04]"><div className="flex items-center gap-2 text-[hsl(var(--gold))] font-black text-lg"><MapPin size={16}/> MAT {String(mat).padStart(2,'0')}</div><div className="text-[10px] font-black">{live?.locked?'LOCKED':live?.online===false?'OFFLINE':statusText[status]?.en||status}</div></div>
        {live?.competition_name && <div className="px-4 pt-3 text-[10px] text-white/50">{live.competition_name} · Match {live.match_number ?? '—'} · {live.weight_category || '—'} · {live.match_stage || ''}</div>}
        <div className="p-4 space-y-2">
          {live?.chung_name || live?.hong_name ? <><PlayerLine name={live.chung_name} nationality={live.chung_nationality} color="blue"/><div className="flex items-center justify-center text-[10px] font-black text-white/30">VS · R{live.current_round||1} · {live.chung_score??0} — {live.hong_score??0}</div><PlayerLine name={live.hong_name} nationality={live.hong_nationality} color="red"/></> : <div className="py-8 text-center text-white/30 font-bold">MAT AVAILABLE</div>}
          {q && <div className="mt-3 rounded-xl border border-[hsl(var(--gold))]/30 bg-[hsl(var(--gold))]/5 p-3"><div className="text-[9px] text-[hsl(var(--gold))] font-black mb-2">NEXT ON MAT {mat} · MATCH {q.match_number}</div><div className="text-sm font-bold text-blue-300">BLUE · {q.player1?.name} {getCountryFlag(q.player1?.nationality||'')}</div><div className="text-sm font-bold text-red-300 mt-1">RED · {q.player2?.name} {getCountryFlag(q.player2?.nationality||'')}</div><div className="text-[9px] text-white/40 mt-2">{q.round ? `ROUND ${q.round}` : ''} · {q.player1?.category || q.player2?.category || ''}</div></div>}
          {live?.device_name && <div className="text-[8px] text-white/30 pt-1">🖥 {live.device_name}</div>}
        </div>
      </section>})}
    </div>
    <footer className="mt-5 flex items-center justify-center gap-4 text-[9px] text-white/30"><span><Radio size={10} className="inline"/> CENTRAL READ-ONLY DISPLAY</span><span><Clock3 size={10} className="inline"/> AUTO REFRESH 3s</span><span><Trophy size={10} className="inline"/> MAIN REFEREE CONTROLS STAY HIDDEN</span></footer>
    </div>
  </div>;
}
