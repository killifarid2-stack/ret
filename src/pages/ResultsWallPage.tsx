import React, { useEffect, useState } from 'react';
import { Radio, Clock3, Trophy, MapPin, Scale, UsersRound } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { getCountryFlag } from '@/lib/flags';
import { loadAllMatchesLocal } from '@/lib/match-local';
import { getMatCount } from '@/lib/mat-status';
import { listQueuedMatches, MatQueuedMatch } from '@/lib/mat-queue';
import { formatTime } from '@/lib/match-engine';
import { MatchState } from '@/types/tkd';
import appIconUrl from '@/assets/app-icon.png';

interface RoundWinner { round: number; chungScore: number; hongScore: number; method?: string; }
interface ResultRow {
  id: string; competition_name: string | null; match_number: number | null; mat_number: number | null;
  weight_category: string | null; gender: string | null; age_group?: string | null; match_stage: string | null;
  tournament_id?: string | null; event_location?: string | null; chung_name: string | null; hong_name: string | null;
  chung_nationality: string | null; hong_nationality: string | null; chung_score: number | null; hong_score: number | null;
  chung_gamjeom: number | null; hong_gamjeom: number | null; finished_at: string | null; round_winners: RoundWinner[] | null;
  config: { rounds?: number } | null;
}

function stageLabel(m: ResultRow) {
  return [m.match_stage, m.gender ? m.gender.toUpperCase() : null, m.age_group || null, m.weight_category || null].filter(Boolean).join(' · ');
}
function roundScore(m: ResultRow, round: number) {
  const rw = m.round_winners?.find(r => r.round === round); return rw ? { c: rw.chungScore, h: rw.hongScore } : { c: null, h: null };
}
function goldenRoundScore(m: ResultRow) {
  const regulation = m.config?.rounds ?? 3; const rw = m.round_winners?.find(r => r.round > regulation); return rw ? { c: rw.chungScore, h: rw.hongScore } : { c: null, h: null };
}
function Cell({ value }: { value: number | null }) { return <td className="w-10 text-center text-sm font-bold text-white/85">{value ?? ''}</td>; }

function RoundCell({ value, winner }: { value: number | null; winner?: boolean }) {
  return <td className="w-10 text-center text-sm font-bold text-white/85">
    <span className={winner ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/30 ring-1 ring-white/20' : ''}>{value ?? ''}</span>
  </td>;
}

function ResultCard({ m, index }: { m: ResultRow; index: number }) {
  const time = m.finished_at ? new Date(m.finished_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  const gr = goldenRoundScore(m);
  return <div className="flex items-stretch gap-2">
    <div className="w-8 shrink-0 flex items-start justify-center pt-1"><span className="text-2xl font-black text-[hsl(var(--gold))] leading-none">{index}</span></div>
    <div className="flex flex-1 min-w-0 rounded-lg overflow-hidden border border-white/10 bg-white/[0.02] shadow-[0_6px_24px_rgba(0,0,0,.18)]">
      <div className="w-[74px] shrink-0 flex flex-col items-center justify-center gap-1 bg-white/5 border-e border-white/10 px-1">
        <span className="text-sm font-black text-[hsl(var(--gold))]">{time}</span><span className="text-2xl font-black text-white leading-none">{m.match_number ?? '—'}</span>
        {m.mat_number != null && <span className="text-[9px] text-white/35">MAT {m.mat_number}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between bg-[#3a3a3a] px-3 py-1.5 gap-2">
          <span className="text-[12px] font-bold text-white/90 truncate">{stageLabel(m) || 'MATCH RESULT'}</span>
          <table className="shrink-0"><tbody><tr className="text-[9px] font-black text-white/55"><td className="w-10 text-center">R1</td><td className="w-10 text-center">R2</td><td className="w-10 text-center">R3</td><td className="w-10 text-center">GR</td><td className="w-12 text-center">TOTAL</td><td className="w-10 text-center">GJ</td></tr></tbody></table>
        </div>
        {(['chung', 'hong'] as const).map(side => {
          const blue = side === 'chung'; const name = blue ? m.chung_name : m.hong_name; const nat = blue ? m.chung_nationality : m.hong_nationality;
          const total = blue ? m.chung_score : m.hong_score; const gj = blue ? m.chung_gamjeom : m.hong_gamjeom;
          const r1 = roundScore(m, 1), r2 = roundScore(m, 2), r3 = roundScore(m, 3);
          return <div key={side} className={`flex items-center justify-between px-3 py-2 ${blue ? 'bg-[#2467d6]/80' : 'bg-[#d33a45]/80'}`}>
            <div className="flex items-center gap-2 min-w-0"><span className="text-base">{getCountryFlag(nat || '')}</span><span className="text-sm font-bold text-white truncate">{name || '—'}</span></div>
            <table className="shrink-0"><tbody><tr>
              <RoundCell value={r1[blue ? 'c' : 'h']} winner={r1.c != null && r1.h != null && (blue ? r1.c > r1.h : r1.h > r1.c)} />
              <RoundCell value={r2[blue ? 'c' : 'h']} winner={r2.c != null && r2.h != null && (blue ? r2.c > r2.h : r2.h > r2.c)} />
              <RoundCell value={r3[blue ? 'c' : 'h']} winner={r3.c != null && r3.h != null && (blue ? r3.c > r3.h : r3.h > r3.c)} />
              <Cell value={blue ? gr.c : gr.h} /><td className="w-12 text-center text-base font-black text-white">{total ?? 0}</td><Cell value={gj} />
            </tr></tbody></table>
          </div>;
        })}
      </div>
    </div>
  </div>;
}

function liveStageLabel(s: MatchState) {
  return [s.matchStage, s.gender ? s.gender.toUpperCase() : null, s.ageGroup || null, s.weightCategory || null].filter(Boolean).join(' · ');
}

function liveStatusLabel(s: MatchState) {
  if (s.isGoldenRound) return 'GOLDEN POINT — النقطة الذهبية';
  switch (s.status) {
    case 'fighting': return `ROUND ${s.currentRound} — FIGHTING`;
    case 'rest': return 'REST — استراحة';
    case 'paused': return 'PAUSED — توقف';
    case 'kyeshi': return 'INJURY TIME — كيشي';
    case 'ivr': return 'VIDEO REPLAY — إعادة فيديو';
    case 'doctor': return 'DOCTOR CALL — استدعاء الطبيب';
    case 'waiting': return 'ABOUT TO START — على وشك البدء';
    default: return String(s.status).toUpperCase();
  }
}

// A live match is only shown once real players are assigned AND it hasn't
// finished — a bare "waiting" slot with no names yet is not a live match.
function isDisplayableLive(s: MatchState | undefined): s is MatchState {
  if (!s) return false;
  if (s.status === 'finished') return false;
  return !!(s.chung?.player?.name || s.hong?.player?.name);
}

function LiveMatchCard({ s }: { s: MatchState }) {
  const rounds = Array.from({ length: s.config?.rounds || 3 }, (_, i) => i + 1);
  const fighting = s.status === 'fighting';
  return (
    <div className="rounded-lg overflow-hidden border-2 border-[#ff3b3b]/50 bg-white/[0.02] shadow-[0_0_28px_rgba(255,59,59,.18)]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[.04]">
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest ${fighting ? 'bg-[#ff3b3b] text-white animate-pulse' : 'bg-[hsl(var(--gold))] text-black'}`}>
          <Radio size={10} /> LIVE
        </span>
        <span className="text-2xl font-black text-[hsl(var(--gold))] leading-none">{s.matNumber ?? '—'}</span>
        <span className="text-[10px] font-black tracking-widest text-white/60">MAT {String(s.matNumber ?? '—').padStart(2, '0')}</span>
        <span className="ms-auto text-[10px] font-black text-white/50">#{s.matchNumber ?? '—'}</span>
        <span className="text-sm font-black font-display text-[hsl(var(--gold))]">{formatTime(s.timeRemaining)}</span>
      </div>
      <div className="px-3 py-1.5 bg-[#3a3a3a] flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-white/85 truncate">{liveStageLabel(s) || 'MATCH'}</span>
        <span className="text-[10px] font-black text-[hsl(var(--gold))] shrink-0">{liveStatusLabel(s)}</span>
      </div>
      {(['chung', 'hong'] as const).map(side => {
        const blue = side === 'chung';
        const p = s[side];
        return (
          <div key={side} className={`flex items-center justify-between px-3 py-2 ${blue ? 'bg-[#2467d6]/80' : 'bg-[#d33a45]/80'}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">{getCountryFlag(p.player?.nationality || '')}</span>
              <span className="text-sm font-bold text-white truncate">{p.player?.name || '—'}</span>
            </div>
            <table className="shrink-0"><tbody><tr>
              {rounds.map(r => (
                <td key={r} className={`w-9 text-center text-sm font-bold ${r === s.currentRound ? 'text-white' : 'text-white/60'}`}>
                  {p.scores?.[r - 1]?.total ?? ''}
                </td>
              ))}
              <td className="w-12 text-center text-base font-black text-white">{p.totalScore ?? 0}</td>
              <td className="w-9 text-center text-sm font-bold text-white/70">{p.gamjeomCount ?? 0}</td>
            </tr></tbody></table>
          </div>
        );
      })}
    </div>
  );
}

function NextMatchCard({ q }: { q: MatQueuedMatch }) {
  const p1 = q.player1 || {}, p2 = q.player2 || {};
  return <div className="p-3">
    <div className="flex items-center justify-between gap-2 mb-2"><span className="text-[10px] font-black text-white/40">MATCH {q.match_number}</span><span className="text-[10px] text-[hsl(var(--gold))]">{q.round ? `R${q.round}` : 'NEXT'}</span></div>
    <div className="rounded-md overflow-hidden border border-white/10">
      <div className="flex items-center gap-2 px-3 py-2" style={{background:'rgba(36,103,214,.7)'}}><span>{getCountryFlag(p1.nationality || '')}</span><span className="font-bold text-sm text-white truncate">{p1.name || '—'}</span></div>
      <div className="px-3 py-1 text-center text-[9px] font-black text-white/30 bg-black">VS</div>
      <div className="flex items-center gap-2 px-3 py-2" style={{background:'rgba(211,58,69,.7)'}}><span>{getCountryFlag(p2.nationality || '')}</span><span className="font-bold text-sm text-white truncate">{p2.name || '—'}</span></div>
    </div>
  </div>;
}

export default function ResultsWallPage() {
  const [results, setResults] = useState<ResultRow[]>([]); const [queue, setQueue] = useState<MatQueuedMatch[]>([]);
  const [matCount, setMatCount] = useState(getMatCount()); const [clock, setClock] = useState(new Date());
  const [competitionName, setCompetitionName] = useState(''); const [eventLocation, setEventLocation] = useState('');
  const [liveByMat, setLiveByMat] = useState<Record<number, MatchState>>({});

  useEffect(() => {
    const load = async () => {
      let cloudRows: ResultRow[] = [];
      try { const { data } = await supabase.from('matches').select('*').eq('status', 'finished').order('finished_at', { ascending: false }).limit(60); cloudRows = (data as unknown as ResultRow[]) || []; } catch {}
      const localRows = loadAllMatchesLocal().filter((r: any) => r.status === 'finished') as unknown as ResultRow[];
      const merged = [...cloudRows, ...localRows.filter(l => !cloudRows.some(c => c.match_number === l.match_number && c.id === l.id))].sort((a,b) => new Date(b.finished_at || 0).getTime() - new Date(a.finished_at || 0).getTime());
      setResults(merged);
      const first = merged[0]; if (first?.competition_name) setCompetitionName(first.competition_name); if (first?.event_location) setEventLocation(first.event_location);
      setQueue(await listQueuedMatches()); setMatCount(getMatCount());
    };
    load(); const i = setInterval(load, 4000); const c = setInterval(() => setClock(new Date()), 1000); return () => { clearInterval(i); clearInterval(c); };
  }, []);

  // LIVE match state, per mat — every operator/mat broadcasts its full
  // MatchState on the shared 'match-sync' realtime channel on every change
  // (score, timer tick, round, status…), so this arrives essentially every
  // second without any polling delay. Keyed by matNumber so several mats
  // running simultaneously each get their own live card; a finished match
  // is dropped from the live map (it will show up in RESULTS instead once
  // the periodic `load()` above picks it up).
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase.channel('match-sync')
      .on('broadcast', { event: 'match-state' }, (payload) => {
        const s = payload.payload as MatchState | undefined;
        if (!s || s.matNumber == null) return;
        setLiveByMat(prev => {
          if (s.status === 'finished') {
            if (!(s.matNumber! in prev)) return prev;
            const next = { ...prev }; delete next[s.matNumber!]; return next;
          }
          return { ...prev, [s.matNumber!]: s };
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const queuedByMat = React.useMemo(() => new Map(queue.map(q => [q.mat_number, q])), [queue]);
  const mats = Array.from({ length: matCount }, (_, i) => i + 1);
  const liveMats = mats.filter(m => isDisplayableLive(liveByMat[m]));
  const summary = results[0];

  return <div className="min-h-screen bg-black text-white" dir="ltr">
    
    <header className="px-5 pt-4 pb-3 border-b border-white/10 flex items-center justify-between gap-5">
      <div className="flex items-center gap-3 min-w-0"><img src={appIconUrl} alt="" className="w-11 h-11 rounded-full" /><div className="min-w-0"><div className="text-[11px] text-[hsl(var(--gold))] font-black tracking-[0.3em]">WAB-TKD · RESULTS WALL</div><h1 className="text-3xl font-black tracking-tight truncate">{competitionName || 'WAB-TKD TOURNAMENT'}</h1></div></div>
      <div className="text-right shrink-0"><div className="text-2xl font-black font-display">{clock.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</div><div className="text-[10px] text-white/45">{clock.toLocaleDateString([], { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' })}</div></div>
    </header>

    <div className="px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-2 border-b border-white/10">
      <div className="rounded-md border border-white/10 bg-white/[.025] px-3 py-2"><div className="text-[9px] text-white/35 flex items-center gap-1"><Trophy size={10}/> TOURNAMENT</div><div className="text-xs font-bold truncate">{competitionName || '—'}</div></div>
      <div className="rounded-md border border-white/10 bg-white/[.025] px-3 py-2"><div className="text-[9px] text-white/35 flex items-center gap-1"><UsersRound size={10}/> CATEGORY</div><div className="text-xs font-bold truncate">{summary ? [summary.gender?.toUpperCase(), summary.age_group, summary.weight_category].filter(Boolean).join(' · ') : '—'}</div></div>
      <div className="rounded-md border border-white/10 bg-white/[.025] px-3 py-2"><div className="text-[9px] text-white/35 flex items-center gap-1"><Scale size={10}/> LATEST STAGE</div><div className="text-xs font-bold truncate">{summary?.match_stage || '—'}</div></div>
      <div className="rounded-md border border-white/10 bg-white/[.025] px-3 py-2"><div className="text-[9px] text-white/35 flex items-center gap-1"><MapPin size={10}/> LOCATION</div><div className="text-xs font-bold truncate">{eventLocation || '—'}</div></div>
    </div>

    <main className="p-5 flex flex-col gap-6">
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center gap-1 rounded-full bg-[#ff3b3b] px-2 py-0.5 text-[10px] font-black tracking-widest text-white animate-pulse"><Radio size={10} /> LIVE</span>
          <div className="text-xs font-black tracking-[0.25em] text-[hsl(var(--gold))]">LIVE NOW — مباشر الآن</div>
        </div>
        {liveMats.length === 0
          ? <div className="py-10 text-center text-white/30 font-bold border border-white/10 rounded-lg">NO MATCH CURRENTLY ON THE MAT</div>
          : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">{liveMats.map(m => <LiveMatchCard key={m} s={liveByMat[m]} />)}</div>}
      </section>
      <section>
        <div className="text-xs font-black tracking-[0.25em] text-[hsl(var(--gold))] mb-2">RESULTS — النتائج</div>
        {results.length === 0
          ? <div className="py-16 text-center text-white/30 font-bold border border-white/10 rounded-lg">NO RESULTS YET</div>
          : <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3">{results.slice(0, 20).map((m, i) => <ResultCard key={m.id} m={m} index={i + 1} />)}</div>}
      </section>
      <section>
        <div className="text-xs font-black tracking-[0.25em] text-[hsl(var(--gold))] mb-2">NEXT ON EACH MAT — القادم على كل بساط</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">{mats.map(mat => { const q = queuedByMat.get(mat); return <div key={mat} className="rounded-lg overflow-hidden border border-white/10 bg-white/[.02]"><div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[.03]"><span className="text-2xl font-black text-[hsl(var(--gold))]">{mat}</span><span className="text-[10px] font-black tracking-widest text-white/60">MAT {String(mat).padStart(2,'0')}</span>{q&&<span className="ms-auto rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black text-white/80">MATCH #{q.match_number??'—'}</span>}</div>{q ? <NextMatchCard q={q} /> : <div className="py-12 text-center text-[11px] text-white/25 font-black">NOTHING QUEUED</div>}</div>; })}</div>
      </section>
    </main>
    <footer className="px-5 pb-4 flex items-center justify-center gap-5 text-[9px] text-white/30"><span><Radio size={10} className="inline"/> READ-ONLY TOURNAMENT RESULTS</span><span><Clock3 size={10} className="inline"/> AUTO REFRESH 4s</span></footer>
  </div>;
}
