import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Swords, Users, Loader2, ChevronLeft, RefreshCw, BarChart3, GitBranch, Save, ArrowRight, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AGE_GROUPS } from '@/lib/tkd-data';
import {
  getAllWeightCategories,
  addCustomWeightCategory,
  getOrCreateCategoryTournament,
  listCategoryMatches,
  quickAddMatch,
  loadCategoryPlayers,
  saveCategoryPlayers,
  addCustomAgeCategory,
  getAllAgeCategories,
  CategoryMatchSummary,
  CategoryTournamentRef,
  buildCategoryStatistics,
  buildVisualBracket,
  loadCanonicalBracket,
  syncCategoryCatalogFromCloud,
} from '@/lib/category-library';

interface Props {
  onClose: () => void;
  /** Optional: called with the freshly created match id/tournament id so the
   * host screen can, if it wants to, jump straight into it (e.g. Operator). */
  onMatchCreated?: (result: { matchId: string; tournamentId: string; tournamentName: string }) => void;
  /** Optional: open directly on a known gender+age+weight bucket (skips the
   * gender/age/weight picker steps) — used by the category status overview,
   * where the bucket was already chosen by tapping its status circle. */
  initialBucket?: { gender: 'male' | 'female'; ageGroup: string; weightCategory: string };
}

type Step = 'gender' | 'age' | 'weight' | 'matches';

// GENDER → AGE GROUP → WEIGHT CATEGORY browser. Selecting a weight opens
// that category's own "shelf": every match already saved there, plus a
// one-click Generate that only asks for names — tournament, gender, age
// group and weight are already known from the path taken to get here.
// Used for Individual matches, Par Équipe matches, and Admin-created
// matches alike (all three funnel through the same quickAddMatch helper,
// so every match always lands inside a real Tournament record).
export default function CategoryMatchBrowser({ onClose, onMatchCreated, initialBucket }: Props) {
  const [step, setStep] = useState<Step>(initialBucket ? 'matches' : 'gender');
  const [gender, setGender] = useState<'male' | 'female' | null>(initialBucket?.gender ?? null);
  const [ageGroup, setAgeGroup] = useState<string | null>(initialBucket?.ageGroup ?? null);
  const [weightCategory, setWeightCategory] = useState<string | null>(initialBucket?.weightCategory ?? null);

  const [tournament, setTournament] = useState<CategoryTournamentRef | null>(null);
  const [matches, setMatches] = useState<CategoryMatchSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const [addingWeight, setAddingWeight] = useState(false);
  const [addingAge, setAddingAge] = useState(false);
  const [newAge, setNewAge] = useState('');
  const [players, setPlayers] = useState<any[]>([]);
  const [showPlayers, setShowPlayers] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showBracket, setShowBracket] = useState(false);
  const [canonicalBracket, setCanonicalBracket] = useState<any[] | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [newWeight, setNewWeight] = useState('');

  const [showGenerate, setShowGenerate] = useState(false);
  const [classification, setClassification] = useState<'1v1' | 'team'>('1v1');
  const [chungName, setChungName] = useState('');
  const [hongName, setHongName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loadBucket = async (g: string, a: string, w: string) => {
    setLoading(true);
    try {
      const t = await getOrCreateCategoryTournament({ gender: g, ageGroup: a, weightCategory: w });
      setTournament(t);
      if (t) {
        setMatches(await listCategoryMatches(t.id));
        setPlayers(loadCategoryPlayers(t.id));
        setCanonicalBracket(await loadCanonicalBracket(t.id));
      } else {
        setCanonicalBracket(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void syncCategoryCatalogFromCloud(); }, []);

  useEffect(() => {
    if (gender && ageGroup && weightCategory) {
      loadBucket(gender, ageGroup, weightCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, ageGroup, weightCategory]);

  const weightOptions = gender && ageGroup ? getAllWeightCategories(gender, ageGroup) : [];
  const weightStarted = matches.some(m => ['fighting','rest','finished'].includes(String(m.status)));
  const canEditPlayers = !weightStarted;
  const nextMatch = matches.find(m => m.status !== 'finished');

  const handleAddWeight = () => {
    if (!gender || !ageGroup || !newWeight.trim()) return;
    addCustomWeightCategory(gender, ageGroup, newWeight.trim());
    setWeightCategory(newWeight.trim());
    setNewWeight('');
    setAddingWeight(false);
    setStep('matches');
  };

  const handleGenerate = async () => {
    if (!gender || !ageGroup || !weightCategory) return;
    if (!chungName.trim() || !hongName.trim()) {
      setGenerateError('أدخل اسمي اللاعبين (أو الفريقين) قبل التوليد.');
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    try {
      const result = await quickAddMatch({
        gender, ageGroup, weightCategory, classification, chungName, hongName,
      });
      if (!result) {
        setGenerateError('تعذّر إنشاء المباراة. حاول مجدداً.');
        return;
      }
      setChungName('');
      setHongName('');
      setShowGenerate(false);
      if (tournament) setMatches(await listCategoryMatches(tournament.id));
      onMatchCreated?.(result);
    } finally {
      setGenerating(false);
    }
  };

  const ageLabel = (v: string | null) => AGE_GROUPS.find(a => a.value === v)?.label || v || '';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-primary/30 bg-[#0c0c14] p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step !== 'gender' && (
              <button
                type="button"
                onClick={() => {
                  if (step === 'age') { setStep('gender'); setGender(null); }
                  else if (step === 'weight') { setStep('age'); setAgeGroup(null); }
                  else if (step === 'matches') { setStep('weight'); setWeightCategory(null); setTournament(null); setMatches([]); }
                }}
                className="text-white/50 hover:text-white/80"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <h5 className="font-display font-black text-sm tracking-wide text-primary">مكتبة الفئات والأوزان</h5>
          </div>
          <button type="button" onClick={onClose} className="text-white/60"><X size={16} /></button>
        </div>

        {/* Breadcrumb */}
        <div className="mb-4 flex flex-wrap gap-1 text-[10px] text-white/50">
          {gender && <span className="rounded-full bg-white/5 px-2 py-0.5">{gender === 'male' ? 'ذكور' : 'إناث'}</span>}
          {ageGroup && <span className="rounded-full bg-white/5 px-2 py-0.5">{ageLabel(ageGroup)}</span>}
          {weightCategory && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-primary">{weightCategory}</span>}
        </div>

        {/* Step 1: Gender */}
        {step === 'gender' && (
          <div className="grid grid-cols-2 gap-3">
            {(['male', 'female'] as const).map(g => (
              <button
                key={g}
                type="button"
                onClick={() => { setGender(g); setStep('age'); }}
                className="rounded-xl border border-white/10 bg-white/5 py-6 text-sm font-black text-white/90 hover:border-primary/50 hover:bg-primary/10"
              >
                {g === 'male' ? 'ذكور — Male' : 'إناث — Female'}
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Age group (all categories shown, whether or not they already have data) */}
        {step === 'age' && gender && (
          <>
          <div className="grid grid-cols-2 gap-2">
            {getAllAgeCategories(gender).map(a => (
              <button
                key={a.value}
                type="button"
                onClick={() => { setAgeGroup(a.value); setStep('weight'); }}
                className="rounded-lg border border-white/10 bg-white/5 py-3 px-2 text-xs font-bold text-white/85 hover:border-primary/50 hover:bg-primary/10"
              >
                {a.label}
              </button>
            ))}
          </div>
          {!addingAge ? (
            <button type="button" onClick={() => setAddingAge(true)} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 py-2 text-[11px] font-bold text-white/60 hover:border-primary/40 hover:text-primary">
              <Plus size={13}/> إضافة فئة عمرية جديدة
            </button>
          ) : (
            <div className="mt-3 flex gap-2">
              <input autoFocus value={newAge} onChange={e=>setNewAge(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&gender&&newAge.trim()){addCustomAgeCategory(gender,newAge.trim());setAgeGroup(newAge.trim());setNewAge('');setAddingAge(false);setStep('weight')}}} placeholder="مثال: U23" className="flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs text-white outline-none"/>
              <button type="button" onClick={()=>{if(!gender||!newAge.trim())return;addCustomAgeCategory(gender,newAge.trim());setAgeGroup(newAge.trim());setNewAge('');setAddingAge(false);setStep('weight')}} className="rounded-lg bg-primary px-3 py-2 text-[11px] font-black text-black">إضافة</button>
            </div>
          )}
          </>
        )}

        {/* Step 3: Weight category */}
        {step === 'weight' && gender && ageGroup && (
          <div>
            <div className="grid grid-cols-3 gap-2">
              {weightOptions.map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => { setWeightCategory(w); setStep('matches'); }}
                  className="rounded-lg border border-white/10 bg-white/5 py-2.5 px-1.5 text-[11px] font-bold text-white/85 hover:border-primary/50 hover:bg-primary/10"
                >
                  {w}
                </button>
              ))}
            </div>
            {!addingWeight ? (
              <button
                type="button"
                onClick={() => setAddingWeight(true)}
                className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 py-2 text-[11px] font-bold text-white/60 hover:border-primary/40 hover:text-primary"
              >
                <Plus size={13} /> إضافة وزن جديد
              </button>
            ) : (
              <div className="mt-3 flex gap-2">
                <input
                  autoFocus
                  value={newWeight}
                  onChange={e => setNewWeight(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddWeight(); }}
                  placeholder="مثال: -68kg"
                  className="flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-primary/60"
                />
                <button type="button" onClick={handleAddWeight} className="rounded-lg bg-primary px-3 py-2 text-[11px] font-black text-black">إضافة</button>
                <button type="button" onClick={() => { setAddingWeight(false); setNewWeight(''); }} className="rounded-lg border border-white/15 px-3 py-2 text-[11px] font-black text-white/60">إلغاء</button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Matches inside the chosen weight bucket */}
        {step === 'matches' && gender && ageGroup && weightCategory && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-white/50">
                <Loader2 size={16} className="animate-spin" /> جارٍ التحميل…
              </div>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button type="button" disabled={!canEditPlayers} onClick={()=>setShowPlayers(v=>!v)} className={`rounded-lg border px-2 py-2 text-[10px] font-black ${canEditPlayers ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/10 bg-white/5 text-white/25 cursor-not-allowed'}`}><UserPlus size={13} className="inline mr-1"/> {canEditPlayers ? 'ADD / EDIT PLAYERS' : 'PLAYERS LOCKED'} ({players.length})</button>
                  <button type="button" onClick={()=>setShowBracket(v=>!v)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-black text-white/70"><GitBranch size={13} className="inline mr-1"/> BRACKET / TREE</button>
                  <button type="button" onClick={()=>setShowStats(v=>!v)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-black text-white/70"><BarChart3 size={13} className="inline mr-1"/> STATISTICS</button>
                  <button type="button" onClick={()=>{ if(tournament){ saveCategoryPlayers(tournament.id, players); setSavedNotice(true); setTimeout(()=>setSavedNotice(false),1600); }}} className="rounded-lg border-2 border-emerald-300/60 bg-emerald-400/15 px-2 py-2 text-[10px] font-black text-emerald-200 shadow-[0_0_18px_rgba(52,211,153,.16)]"><Save size={13} className="inline mr-1"/> SAVE</button>
                </div>
                {showPlayers && canEditPlayers && (
                  <div className="mb-3 rounded-xl border border-primary/20 bg-black/20 p-3">
                    <div className="flex items-center justify-between mb-2"><div className="text-[10px] font-black text-primary">PLAYER INFORMATION</div><div className="text-[9px] text-white/40">المعلومات تحفظ مع هذا الوزن</div></div>
                    <div className="space-y-2 max-h-44 overflow-y-auto">
                      {players.map((pl,i)=><div key={pl.id||i} className="grid grid-cols-[1fr_70px_28px] gap-2"><input value={pl.name||''} onChange={e=>setPlayers(xs=>xs.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder="اسم اللاعب" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-white"/><input value={pl.number||''} onChange={e=>setPlayers(xs=>xs.map((x,j)=>j===i?{...x,number:e.target.value}:x))} placeholder="NO" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-white"/><button type="button" onClick={()=>setPlayers(xs=>xs.filter((_,j)=>j!==i))} className="rounded-lg border border-red-400/20 text-red-300">×</button></div>)}
                    </div>
                    <div className="mt-2 flex gap-2"><button type="button" onClick={()=>setPlayers(xs=>[...xs,{id:`p-${Date.now()}-${xs.length}`,name:'',number:''}])} className="flex-1 rounded-lg bg-primary py-2 text-[10px] font-black text-black">+ ADD PLAYER</button><button type="button" onClick={()=>{if(tournament)saveCategoryPlayers(tournament.id,players);setSavedNotice(true);setTimeout(()=>setSavedNotice(false),1600)}} className="flex-1 rounded-lg border border-emerald-400/30 text-emerald-300 py-2 text-[10px] font-black">SAVE PLAYER DATA</button></div>
                  </div>
                )}
                {showStats && (() => {
                  const st = buildCategoryStatistics(matches, players);
                  const methodEntries = Object.entries(st.methods);
                  const ranked = Object.values(st.playerStats).sort((a,b) => (b.wins-a.wins) || (b.points-a.points) || a.name.localeCompare(b.name));
                  return (
                    <div className="mb-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
                      <div className="mb-2 text-[10px] font-black tracking-widest text-primary">WEIGHT STATISTICS · FULL ARCHIVE VIEW</div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[9px]">
                        {([['PLAYERS',st.players],['MATCHES',st.matches],['FINISHED',st.finished],['REMAINING',st.remaining],['LIVE',st.live]] as any[]).map(([k,v])=><div key={k} className="rounded-lg border border-white/10 bg-black/20 p-2"><span className="text-white/40">{k}</span><b className="ml-1 text-white">{v}</b></div>)}
                      </div>
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[9px]">
                        <div>CHUNG WINS <b>{st.wins.chung}</b></div><div>HONG WINS <b>{st.wins.hong}</b></div><div>HEAD PTS <b>{st.headPoints.chung}/{st.headPoints.hong}</b></div><div>BODY PTS <b>{st.trunkPoints.chung}/{st.trunkPoints.hong}</b></div>
                        <div>POINTS <b>{st.totalPoints.chung}/{st.totalPoints.hong}</b></div><div>GAM-JEOM <b>{st.gamjeom.chung}/{st.gamjeom.hong}</b></div><div>KNOCKDOWNS <b>{st.knockdowns.chung}/{st.knockdowns.hong}</b></div><div>AI / WOO-SE-GIROK <b>{st.aiRounds} / {st.wooSeGirokRounds}</b></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">{methodEntries.length ? methodEntries.map(([m,n])=><span key={m} className="rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-[8px] font-black text-white/70">{m}: {n}</span>) : <span className="text-[8px] text-white/30">NO FINISHED METHODS YET</span>}</div>
                      {ranked.length > 0 && <div className="mt-3 overflow-x-auto rounded-lg border border-white/10"><table className="w-full min-w-[620px] text-[8px]"><thead><tr className="border-b border-white/10 text-white/35"><th className="p-2 text-left">PLAYER</th><th>M</th><th>W</th><th>L</th><th>PTS</th><th>HEAD</th><th>BODY</th><th>GJ</th><th>KD</th></tr></thead><tbody>{ranked.map((r,i)=><tr key={r.name} className="border-b border-white/5 text-white/65"><td className="p-2 font-bold text-white/80">{i+1}. {r.name}</td><td>{r.matches}</td><td>{r.wins}</td><td>{r.losses}</td><td>{r.points}</td><td>{r.headPoints}</td><td>{r.trunkPoints}</td><td>{r.gamjeom}</td><td>{r.knockdowns}</td></tr>)}</tbody></table></div>}
                      <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2 text-[8px] text-white/45">ROUNDS / DECISIONS are preserved in each saved match record; open the match result to see every round score, winner, method, referee decision and AI/WOO-SE-GIROK evidence.</div>
                    </div>
                  );
                })()}
                {showBracket && (() => {
                  const canonical = canonicalBracket && canonicalBracket.length > 0 ? canonicalBracket : null;
                  const bracket = canonical ? canonical.map((m:any) => ({
                    id:m.id, stage: m.round === Math.max(...canonical.map((x:any)=>x.round||1)) ? 'FINAL' : m.round === Math.max(...canonical.map((x:any)=>x.round||1))-1 ? 'SEMIFINAL' : m.round === Math.max(...canonical.map((x:any)=>x.round||1))-2 ? 'QUARTERFINAL' : 'ROUND',
                    slot:m.position || 0,
                    player1:m.player1?.name || (m.isBye && !m.player2 ? 'BYE' : 'TBD'),
                    player2:m.player2?.name || (m.isBye ? 'BYE' : 'TBD'),
                    winner:m.winner === 'chung' ? m.player1?.name : m.winner === 'hong' ? m.player2?.name : null,
                    status:m.winner ? 'DONE' : (m.player1 && m.player2 && !m.isBye ? 'NEXT' : 'EMPTY'),
                    matchId:m.id,
                    round:m.round || 1,
                  })).reduce((cols:any[][], m:any) => { (cols[m.round-1] ||= []).push(m); return cols; }, []) : buildVisualBracket(players, matches);
                  const stages = ['QUALIFICATION','ROUND OF 16','QUARTERFINAL','SEMIFINAL','FINAL'];
                  const statusClass = (st:string) => st==='DONE' ? 'text-emerald-300' : st==='LIVE' ? 'text-sky-300' : st==='NEXT' ? 'text-amber-300' : 'text-white/20';
                  return <div className="mb-3 rounded-xl border border-white/10 bg-black/20 p-3 overflow-x-auto">
                    <div className="mb-3 flex items-center justify-between"><div className="text-[10px] font-black text-primary">BRACKET TREE · LIVE WINNER PATH</div><span className="text-[8px] text-white/30">{canonical ? 'CANONICAL TOURNAMENT BRACKET' : 'ARCHIVE VIEW'} · {players.filter((p:any)=>p.name).length} entrants</span></div>
                    {players.filter((p:any)=>p.name).length < 2 ? <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-center text-[9px] text-amber-200">ADD AT LEAST 2 PLAYERS TO BUILD THE BRACKET</div> :
                    <div className="flex min-w-[980px] items-stretch gap-2">{bracket.map((col,ci)=><React.Fragment key={stages[ci]||ci}>
                      <div className="w-[180px] shrink-0 flex flex-col"><div className="mb-2 text-center text-[8px] font-black tracking-widest text-white/50">{stages[ci]||col[0]?.stage}</div><div className="flex flex-1 flex-col justify-around gap-2">
                        {col.map((m:any)=><div key={m.id} className={`rounded-lg border p-2 min-h-[62px] ${m.status==='DONE'?'border-emerald-400/25 bg-emerald-400/[.025]':m.status==='LIVE'?'border-sky-400/30 bg-sky-400/[.03]':m.status==='NEXT'?'border-amber-400/25 bg-amber-400/[.025]':'border-white/10 bg-white/[.02]'}`}>
                          <div className="flex justify-between text-[7px] text-white/30"><span>M{m.slot+1}</span><span className={statusClass(m.status)}>{m.status}</span></div>
                          <div className="mt-1 text-[8px] font-bold truncate">{m.player1}</div><div className="my-0.5 text-[7px] text-white/20">VS</div><div className="text-[8px] font-bold truncate">{m.player2}</div>
                          {m.winner && <div className="mt-1 text-[7px] font-black text-primary truncate">WINNER → {m.winner}</div>}
                        </div>)}
                      </div></div>{ci < bracket.length - 1 && <div className="w-5 shrink-0 self-center text-center text-white/20">→</div>}
                    </React.Fragment>)}</div>}
                  </div>;
                })()}
                {savedNotice && <div className="mb-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[10px] font-black text-emerald-300">✓ تم حفظ معلومات الوزن واللاعبين</div>}

                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] text-white/50">{tournament?.name}</span>
                  <button
                    type="button"
                    onClick={() => tournament && loadBucket(gender, ageGroup, weightCategory)}
                    className="text-white/40 hover:text-white/70"
                    title="تحديث"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>

                {matches.length === 0 && (
                  <p className="mb-3 rounded-lg border border-white/10 bg-white/5 p-3 text-center text-[11px] text-white/45">
                    لا توجد مباريات محفوظة في هذا الوزن بعد.
                  </p>
                )}

                <div className="mb-3 space-y-1.5">
                  {matches.map(m => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        {m.classification === 'team' ? <Users size={13} className="text-white/40" /> : <Swords size={13} className="text-white/40" />}
                        <div className="text-[11px] text-white/85">
                          {m.matchNumber != null && <span className="ml-1 text-white/40">#{m.matchNumber}</span>}
                          {m.chungName} <span className="text-white/30">vs</span> {m.hongName}
                          {m.chungScore != null && <div className="mt-0.5 text-[8px] text-white/35">SCORE {m.chungScore} — {m.hongScore} {m.winMethod ? `· ${m.winMethod}` : ''} {m.resultRound ? `· R${m.resultRound}` : ''}</div>}
                          {m.stage && <div className="text-[7px] uppercase tracking-widest text-primary/50">{m.stage}</div>}
                        </div>
                      </div>
                      <span className={`text-[9px] font-black uppercase ${m.status === 'finished' ? 'text-white/35' : 'text-[#39ff6a]'}`}>
                        {m.status === 'finished' ? 'انتهت' : m.status === 'fighting' ? 'جارية' : 'بالانتظار'}
                      </span>
                    </div>
                  ))}
                </div>

                {showGenerate ? (
                  <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
                    <div className="mb-2 flex gap-2">
                      {(['1v1', 'team'] as const).map(c => (
                        <button key={c} type="button" onClick={() => setClassification(c)} className={`flex-1 rounded-lg border py-1.5 text-[10px] font-black ${classification === c ? 'border-primary bg-primary/20 text-primary' : 'border-white/10 text-white/50'}`}>
                          {c === '1v1' ? 'فردي (1v1)' : 'بار إيكيب (فريق)'}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={chungName} onChange={e => setChungName(e.target.value)} placeholder={classification === 'team' ? 'اسم الفريق الأزرق' : 'اسم اللاعب (تشونغ)'} className="rounded-lg border border-white/15 bg-black/30 px-2.5 py-2 text-[11px] text-white outline-none focus:border-primary/60" />
                      <input value={hongName} onChange={e => setHongName(e.target.value)} placeholder={classification === 'team' ? 'اسم الفريق الأحمر' : 'اسم اللاعب (هونغ)'} className="rounded-lg border border-white/15 bg-black/30 px-2.5 py-2 text-[11px] text-white outline-none focus:border-primary/60" />
                    </div>
                    <p className="mt-2 text-[10px] text-white/40">البطولة، الجنس، الفئة العمرية والوزن تُملأ تلقائياً — فقط أدخل الأسماء.</p>
                    {generateError && <p className="mt-1 text-[10px] font-bold text-red-400">{generateError}</p>}
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={generating} onClick={handleGenerate} className="flex-1 rounded-lg bg-primary py-2 text-xs font-black text-black disabled:opacity-50">{generating ? 'جارٍ التوليد…' : 'GENERATE'}</button>
                      <button type="button" onClick={() => { setShowGenerate(false); setGenerateError(null); }} className="flex-1 rounded-lg border border-white/15 py-2 text-xs font-black text-white/60">إلغاء</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {matches.some(m => m.status !== 'finished') && (
                      <button type="button" onClick={() => { const next = matches.find(m => m.status !== 'finished'); if (!next) return; navigate('/admin', { state: { categoryContinue: { tournamentId: tournament?.id, tournamentName: tournament?.name, gender, ageGroup, weightCategory, matchNumber: next.matchNumber, chungName: next.chungName, hongName: next.hongName, classification: next.classification } } }); }} className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 py-2.5 text-[10px] font-black text-amber-300"><ArrowRight size={14}/> CONTINUE MATCHES / إكمال المباريات</button>
                    )}
                    <button type="button" onClick={() => setShowGenerate(true)} className="flex w-full items-center justify-center gap-1 rounded-lg bg-primary py-2.5 text-xs font-black text-black"><Plus size={14} /> توليد مباراة جديدة في هذا الوزن</button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
