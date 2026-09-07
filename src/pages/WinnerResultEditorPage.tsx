import { useMemo, useState } from 'react';
import { useMatch } from '@/context/MatchContext';
import type { PlayerColor, RoundWinner } from '@/types/tkd';

const inputClass = 'w-full rounded-lg border border-gold/25 bg-black/45 px-3 py-2 text-sm font-display text-white outline-none focus:border-gold/70';

export default function WinnerResultEditorPage() {
  const { state, dispatch } = useMatch();
  const [tournament, setTournament] = useState(state.competitionName || '');
  const [category, setCategory] = useState(state.weightCategory || '');
  const [matchId, setMatchId] = useState(String(state.matchNumber ?? ''));
  const [winner, setWinner] = useState<PlayerColor>(state.result?.winner || 'chung');
  const [rounds, setRounds] = useState(() => (state.roundWinners?.length ? state.roundWinners.slice(0, 3) : [1,2,3].map(round => ({ round, winner: 'draw' as const, method: 'draw' as const, blue: 0, red: 0 }))));

  const score = useMemo(() => ({
    blue: rounds.reduce((n, r) => n + Number((r as any).chungScore ?? (r as any).blue ?? 0), 0),
    red: rounds.reduce((n, r) => n + Number((r as any).hongScore ?? (r as any).red ?? 0), 0),
  }), [rounds]);

  function apply() {
    const normalized: RoundWinner[] = rounds.map((r) => {
      const blue = Number(r.chungScore ?? (r as any).blue ?? 0);
      const red = Number(r.hongScore ?? (r as any).red ?? 0);
      return {
        ...r,
        round: r.round,
        chungScore: blue,
        hongScore: red,
        winner: blue === red ? 'draw' : blue > red ? 'chung' : 'hong',
        method: r.method || (blue === red ? 'draw' : 'score'),
      };
    });

    const next = structuredClone(state);
    next.competitionName = tournament.trim() || undefined;
    next.weightCategory = category.trim() || undefined;
    next.matchNumber = matchId.trim() ? Number(matchId) || state.matchNumber : undefined;
    next.roundWinners = normalized;
    next.chung.totalScore = score.blue;
    next.hong.totalScore = score.red;
    next.result = {
      winner,
      method: state.result?.method || 'PTF',
      finalScore: { chung: score.blue, hong: score.red },
    };
    next.status = 'finished';

    // The editor now writes directly into MatchState. Public Winner Animation
    // therefore reads exactly the same state as Main Referee, with no second
    // broadcast-data store or display-only override.
    dispatch({ type: 'SET_STATE', state: next });
  }

  function clear() {
    dispatch({ type: 'SET_STATE', state: { ...state, result: undefined, status: 'waiting' } });
  }

  return <main className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#1b2034,#05060b_65%)] p-6 text-white">
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <div className="font-display text-xs font-bold uppercase tracking-[.35em] text-gold">WAB-TKD · PUBLIC BROADCAST</div>
        <h1 className="mt-2 font-display text-4xl font-black italic uppercase">Winner Result Editor</h1>
        <p className="mt-2 text-sm text-white/55">هذه الصفحة تعدّل MatchState نفسه. لا توجد بيانات Broadcast منفصلة أو Override للنتيجة.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="clip-angled panel-glass p-5">
          <h2 className="font-display text-lg font-black uppercase tracking-widest text-gold">Match Information</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-xs font-bold uppercase tracking-widest text-white/60">Tournament<input className={inputClass} value={tournament} onChange={e=>setTournament(e.target.value)} /></label>
            <label className="text-xs font-bold uppercase tracking-widest text-white/60">Category<input className={inputClass} placeholder="WEIGHT CATEGORY" value={category} onChange={e=>setCategory(e.target.value)} /></label>
            <label className="text-xs font-bold uppercase tracking-widest text-white/60">Match Number<input className={inputClass} value={matchId} onChange={e=>setMatchId(e.target.value)} /></label>
            <label className="text-xs font-bold uppercase tracking-widest text-white/60">Winner<select className={inputClass} value={winner} onChange={e=>setWinner(e.target.value as PlayerColor)}><option value="chung">BLUE</option><option value="hong">RED</option></select></label>
          </div>
        </section>

        <section className="clip-angled panel-glass p-5">
          <h2 className="font-display text-lg font-black uppercase tracking-widest text-gold">Round Results</h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {rounds.map((r,i)=>{ const blue=Number(r.chungScore ?? (r as any).blue ?? 0); const red=Number(r.hongScore ?? (r as any).red ?? 0); return <div key={r.round} className="rounded-lg border border-gold/15 bg-black/25 p-3"><div className="mb-2 text-center font-display text-xs font-bold text-gold">ROUND {r.round}</div><input aria-label={`round ${r.round} blue`} type="number" min="0" className={inputClass} value={blue} onChange={e=>setRounds(rs=>rs.map((x,j)=>j===i?{...x,chungScore:Number(e.target.value)}:x))}/><div className="my-1 text-center text-xs text-blue-300">BLUE</div><input aria-label={`round ${r.round} red`} type="number" min="0" className={inputClass} value={red} onChange={e=>setRounds(rs=>rs.map((x,j)=>j===i?{...x,hongScore:Number(e.target.value)}:x))}/><div className="mt-1 text-center text-xs text-red-300">RED</div></div> })}
          </div>
          <div className="mt-4 text-center font-display text-2xl font-black italic">TOTAL <span className="text-blue-300">{score.blue}</span> — <span className="text-red-300">{score.red}</span></div>
        </section>
      </div>

      <div className="mt-5 flex gap-3">
        <button onClick={apply} className="clip-angled gold-sheen flex-1 bg-gradient-to-r from-yellow-600 via-yellow-300 to-yellow-600 px-5 py-4 font-display text-lg font-black uppercase tracking-widest text-black shadow-[0_0_35px_rgba(255,200,50,.25)]">APPLY TO MATCH STATE</button>
        <button onClick={clear} className="clip-angled border border-white/15 bg-white/5 px-6 py-4 font-display text-sm font-bold uppercase tracking-widest text-white/70">CLEAR RESULT</button>
      </div>
    </div>
  </main>;
}
