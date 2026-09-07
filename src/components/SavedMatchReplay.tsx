import React, { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, X, ChevronLeft, ChevronRight, Activity, Video } from 'lucide-react';
import { formatVideoTimecode, getEventVideoTimecode } from '@/lib/video-replay';

interface Props { record: any; onClose: () => void; }

const LABELS: Record<string,string> = {
  punch:'PUNCH', trunk_kick:'TRUNK KICK', head_kick:'HEAD KICK', turning_kick:'TURNING KICK',
  turning_head:'TURNING HEAD', manual:'MANUAL POINT', gamjeom:'GAM-JEOM', warning:'WARNING'
};

export default function SavedMatchReplay({ record, onClose }: Props) {
  const events = useMemo(() => Array.isArray(record?.score_events) ? record.score_events : Array.isArray(record?.replay_timeline) ? record.replay_timeline : [], [record]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (index >= events.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setIndex(v => Math.min(events.length - 1, v + 1)), 850);
    return () => window.clearTimeout(timer);
  }, [playing, index, events.length]);

  const visible = index >= 0 ? events.slice(0, index + 1) : [];
  const blueScore = visible.reduce((n:any,e:any) => n + (e.player === 'chung' ? Number(e.points || 0) : e.player === 'hong' && e.type === 'gamjeom' ? Number(e.points || 0) : 0), 0);
  const redScore = visible.reduce((n:any,e:any) => n + (e.player === 'hong' ? Number(e.points || 0) : e.player === 'chung' && e.type === 'gamjeom' ? Number(e.points || 0) : 0), 0);
  const current = index >= 0 ? events[index] : null;
  const blueName = record?.chung_name || 'CHUNG';
  const redName = record?.hong_name || 'HONG';
  const videoUrl = record?.video_replay?.sourceUrl || null;
  const currentVideoTimecode = getEventVideoTimecode(current);
  const openVideo = () => {
    if (!videoUrl) return;
    const t = currentVideoTimecode ?? 0;
    window.open(`${videoUrl}#t=${Math.max(0, Math.floor(t))}`, '_blank', 'noopener,noreferrer');
  };

  return <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4" onMouseDown={onClose}>
    <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-3xl border-2 border-[hsl(var(--gold))]/35 bg-[#070b12] shadow-[0_35px_120px_rgba(0,0,0,.8)]" onMouseDown={e=>e.stopPropagation()}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div><div className="text-[9px] font-black tracking-[.28em] text-[hsl(var(--gold))]">POINT REPLAY · ARCHIVED MATCH</div><div className="mt-1 text-lg font-display font-black text-white">MATCH #{record?.match_number ?? '—'} · {blueName} <span className="text-white/30">VS</span> {redName}</div></div>
        <button onClick={onClose} className="rounded-lg border border-white/15 bg-white/5 p-2 text-white/70 hover:text-white"><X size={16}/></button>
      </div>
      <div className="grid grid-cols-3 gap-3 p-5">
        <div className="rounded-2xl border border-[hsl(var(--chung))]/40 bg-[hsl(var(--chung))]/[.06] p-4 text-center"><div className="text-[9px] font-black tracking-widest text-[hsl(var(--chung))]">BLUE · CHUNG</div><div className="mt-2 text-5xl font-display font-black text-white tabular-nums">{blueScore}</div></div>
        <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4 text-center"><div className="text-[9px] font-black tracking-widest text-white/40">R{current?.round ?? '—'} · {current ? LABELS[current.type] || String(current.type).toUpperCase() : 'READY'}</div><div className="mt-3 text-xl font-black text-[hsl(var(--gold))]">{current ? `${current.time ?? 0}s` : 'START'}</div><div className="mt-1 text-[8px] text-white/35">EVENT {Math.max(0,index+1)} / {events.length}</div></div>
        <div className="rounded-2xl border border-[hsl(var(--hong))]/40 bg-[hsl(var(--hong))]/[.06] p-4 text-center"><div className="text-[9px] font-black tracking-widest text-[hsl(var(--hong))]">RED · HONG</div><div className="mt-2 text-5xl font-display font-black text-white tabular-nums">{redScore}</div></div>
      </div>
      <div className="px-5 pb-5">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3 max-h-[38vh] overflow-y-auto">
          {events.length === 0 ? <div className="py-10 text-center text-sm text-white/35">NO POINT EVENTS WERE RECORDED FOR THIS MATCH.</div> : <div className="space-y-1.5">{events.map((e:any,i:number)=>{
            const active=i===index; const blue=e.player==='chung';
            return <button key={e.id||i} onClick={()=>{setPlaying(false);setIndex(i)}} className={`w-full grid grid-cols-[54px_1fr_auto_auto] items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all ${active?'border-[hsl(var(--gold))]/55 bg-[hsl(var(--gold))]/10':'border-white/7 bg-white/[.02] hover:bg-white/[.05]'}`}>
              <span className="text-[8px] font-mono text-white/35">R{e.round} · {e.time ?? 0}s</span><span className={`text-[10px] font-black ${blue?'text-[hsl(var(--chung))]':'text-[hsl(var(--hong))]'}`}>{blue?blueName:redName}</span><span className="text-[8px] font-black text-white/55">{LABELS[e.type]||String(e.type||'EVENT').toUpperCase()}</span><span className="text-[10px] font-display font-black text-[hsl(var(--gold))]">+{e.points ?? 0}</span>
            </button>})}</div>}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {videoUrl && <button onClick={openVideo} disabled={!videoUrl} className="rounded-xl border border-[hsl(var(--gold))]/30 bg-[hsl(var(--gold))]/10 px-4 py-2.5 text-xs font-black text-[hsl(var(--gold))]"><Video size={13} className="inline me-1"/> OPEN CAMERA {currentVideoTimecode != null ? `@ ${formatVideoTimecode(currentVideoTimecode)}` : ''}</button>}
          <button onClick={()=>{setPlaying(false);setIndex(-1)}} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-black text-white/70"><RotateCcw size={13} className="inline me-1"/>RESET</button>
          <button onClick={()=>setIndex(v=>Math.max(-1,v-1))} disabled={index<0} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-black text-white/70 disabled:opacity-30"><ChevronLeft size={13} className="inline"/> PREV</button>
          <button onClick={()=>setPlaying(v=>!v)} disabled={events.length===0} className="rounded-xl border-2 border-[hsl(var(--gold))]/45 bg-[hsl(var(--gold))]/10 px-7 py-2.5 text-xs font-black text-[hsl(var(--gold))] disabled:opacity-30">{playing?<><Pause size={13} className="inline me-1"/>PAUSE</>:<><Play size={13} className="inline me-1"/>PLAY REPLAY</>}</button>
          <button onClick={()=>setIndex(v=>Math.min(events.length-1,v+1))} disabled={index>=events.length-1} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-black text-white/70 disabled:opacity-30">NEXT <ChevronRight size={13} className="inline"/></button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-[8px] text-white/30"><Activity size={11}/> Saved replay contains round, exact remaining time, scoring method, source (operator/judge/PSS), corrections and every recorded event.</div>
      </div>
    </div>
  </div>;
}
