import React, {useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Folder, FolderOpen, Trophy, GitBranch, Search, Users, Scale, Archive, Upload, PlayCircle, Plus, Cloud, CloudDownload } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { getCountryFlag } from '@/lib/flags';
import { loadMatchesLocal } from '@/lib/match-local';
import { listParEquipeTournamentArchive, ParEquipeTournamentArchiveRecord, exportParEquipeArchiveBackup, importParEquipeArchiveBackup, generateParEquipeMatch } from '@/lib/par-equipe-tournament-archive';
import { exportFullBackup, restoreFromBackup } from '@/lib/backup';
import { AGE_GROUPS, GENDERS, getWeightCategories } from '@/lib/tkd-data';
import { getAllAgeCategories, getAllWeightCategories, syncCategoryCatalogFromCloud } from '@/lib/category-library';
import { toast } from 'sonner';

function ageLabel(v: string | undefined, ar: boolean) {
  if (!v) return ar ? 'فئة عمرية غير محددة' : 'Age group not set';
  const m: Record<string, string> = {
    kids: ar ? 'صغار' : 'Kids', cadet: ar ? 'كاديت' : 'Cadet', junior: ar ? 'جونيور' : 'Junior',
    senior: ar ? 'كبار' : 'Senior', u21: 'U21', veteran: ar ? 'قدامى' : 'Veteran'
  };
  return m[v] || v;
}
function genderLabel(v: string | undefined, ar: boolean) {
  return v === 'female' ? (ar ? 'إناث' : 'Female') : v === 'male' ? (ar ? 'ذكور' : 'Male') : (ar ? 'الجنس غير محدد' : 'Gender not set');
}

function TeamCard({ team, ar }: { team: any; ar: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2 mb-2">
        {team.teamLogo && <img src={team.teamLogo} alt="" className="w-9 h-9 rounded-lg object-cover" />}
        {team.clubLogo && <img src={team.clubLogo} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10" />}
        <div className="min-w-0">
          <div className="font-bold text-sm truncate">{team.name}</div>
          <div className="text-[10px] text-white/45 truncate">{[team.club, team.country && `${getCountryFlag(team.country)} ${team.country}`].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <div className="space-y-1">
        {(team.roster || []).map((p: any, i: number) => (
          <div key={p.id || `${p.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-white/[.025] px-2 py-1.5 text-[11px]">
            <span className="w-4 text-white/30">{i + 1}</span>
            {p.photo && <img src={p.photo} alt="" className="w-5 h-5 rounded-full object-cover" />}
            <span className="truncate flex-1 font-semibold">{p.name}</span>
            {p.nationality && <span>{getCountryFlag(p.nationality)}</span>}
            {p.playerNumber != null && <span className="text-white/40">#{p.playerNumber}</span>}
            {p.seedNumber != null && <span className="text-yellow-300/70">S{p.seedNumber}</span>}
            {p.rounds != null && <span className="text-white/35">R{p.rounds}</span>}
          </div>
        ))}
        {!team.roster?.length && <div className="text-[10px] text-white/35">{ar ? 'لاعبون غير مسجلين' : 'No players recorded'}</div>}
      </div>
    </div>
  );
}

function WeightFolder({ rec, ar, open, onToggle }: { rec: ParEquipeTournamentArchiveRecord; ar: boolean; open: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  const remainingMatches = rec.matches.filter(m => m.status !== 'COMPLETED');
  const teamPlayerCount = rec.teams.reduce((n,t)=>n+(t.roster?.length||0),0);
  const hasLive = rec.matches.some(m=>['LIVE','IN_PROGRESS','FIGHTING','REST'].includes(String(m.status).toUpperCase()));
  const status: 'NOT_STARTED'|'READY'|'LIVE'|'FINISHED' = rec.matches.length === 0 ? (teamPlayerCount > 0 ? 'READY' : 'NOT_STARTED') : (remainingMatches.length === 0 ? 'FINISHED' : hasLive || rec.matches.some(m=>m.status==='COMPLETED') ? 'LIVE' : 'READY');
  const statusMeta = { NOT_STARTED:{label:'NOT STARTED',cls:'border-white/10',glow:''}, READY:{label:'READY / PARTIAL',cls:'border-yellow-300/35',glow:'shadow-[0_0_22px_rgba(253,224,71,.10)]'}, LIVE:{label:'LIVE',cls:'border-sky-400/45',glow:'shadow-[0_0_26px_rgba(56,189,248,.14)]'}, FINISHED:{label:'FINISHED',cls:'border-emerald-400/40',glow:'shadow-[0_0_24px_rgba(52,211,153,.12)]'} }[status];
  const localMatches:any[] = loadMatchesLocal(rec.tournamentName).filter((m:any)=>m.tournament_id===rec.tournamentId && (m.competition_mode==='par_equipe' || m.team_names));
  const completedCount = rec.matches.filter(m=>m.status==='COMPLETED').length;
  const totalCount = rec.matches.length;
  const stageForRound=(round:number)=>{const max=Math.max(1,...rec.matches.map(m=>Number(m.round)||1));const fromEnd=max-round;if(fromEnd===0)return 'FINAL';if(fromEnd===1)return 'SEMIFINAL';if(fromEnd===2)return 'QUARTERFINAL';if(fromEnd===3)return 'ROUND OF 16';return 'QUALIFICATION';};
  const stages=['QUALIFICATION','ROUND OF 16','QUARTERFINAL','SEMIFINAL','FINAL'];
  const completedStageIndexes=rec.matches.filter(m=>m.status==='COMPLETED').map(m=>stages.indexOf(stageForRound(Number(m.round)||1))).filter(i=>i>=0);
  const stageIndex=completedCount===0 ? -1 : Math.max(...completedStageIndexes);
  const currentStage=completedCount>=totalCount && totalCount>0 ? 'FINAL' : stageIndex<0 ? 'QUALIFICATION' : stages[Math.min(stages.length-1, stageIndex)];
  const mvpRows=localMatches.filter(m=>m.mvp_reveal?.best).map(m=>({m,b:m.mvp_reveal.best}));
  const mvpCount=new Map<string,any>();
  for(const row of mvpRows){const key=row.b.name;const x=mvpCount.get(key)||{name:key,points:0,mvps:0,photo:row.b.photo,nationality:row.b.nationality,playerNumber:row.b.playerNumber,seedNumber:row.b.seedNumber,club:row.b.club,team:row.m.team_names?.[row.b.side]};x.points+=Number(row.b.points)||0;x.mvps++;mvpCount.set(key,x);}
  const bestPlayer=[...mvpCount.values()].sort((a,b)=>b.mvps-a.mvps||b.points-a.points)[0];
  const cleanRows=localMatches.filter(m=>m.mvp_reveal?.fairPlay).map(m=>m.mvp_reveal.fairPlay);
  const cleanMap=new Map<string,any>(); for(const b of cleanRows){const x=cleanMap.get(b.name)||{...b,mvps:0,gamjeom:0};x.mvps++;x.gamjeom+=Number(b.gamjeom)||0;cleanMap.set(b.name,x);} const cleanPlayer=[...cleanMap.values()].sort((a,b)=>a.gamjeom-b.gamjeom||b.mvps-a.mvps)[0];
  const playerRank=new Map<string,any>();
  for(const m of localMatches){ for(const side of ['chung','hong']){ const name=m[side+'_name']; if(!name) continue; const x=playerRank.get(name)||{name,matches:0,wins:0,points:0,photo:m[side+'_name']===name?m.mvp_reveal?.best?.name===name?m.mvp_reveal?.best?.photo:undefined:undefined,club:m[side+'_club']}; x.matches++; if(m.winner===side)x.wins++; x.points+=Number(m[side+'_score'])||0; x.club=x.club||m[side+'_club']; playerRank.set(name,x); }}
  const playerRanking=[...playerRank.values()].sort((a,b)=>b.wins-a.wins||b.points-a.points);
  return (
    <div className={`rounded-xl border-2 ${statusMeta.cls} ${statusMeta.glow} overflow-hidden bg-black/10 transition-all`}>
      <button onClick={onToggle} className="w-full px-3 py-2.5 flex items-center gap-2 text-start hover:bg-white/[.03]">
        {open ? <FolderOpen size={13} className="text-yellow-300" /> : <Folder size={13} className="text-yellow-300" />}
        <Scale size={12} className="text-white/40" />
        <span className="text-[11px] font-bold flex-1">{rec.weightCategory || (ar ? 'كل الأوزان' : 'All weights')}</span>
        <span className="text-[9px] text-white/35">{rec.teams.length} {ar ? 'فرق' : 'teams'} · {teamPlayerCount} {ar ? 'لاعب' : 'players'} · {rec.matches.length} {ar ? 'مباراة' : 'matches'}</span><span className={`rounded-md border px-2 py-1 text-[8px] font-black ${status==='LIVE'?'border-sky-400/40 bg-sky-400/10 text-sky-300':status==='FINISHED'?'border-emerald-400/35 bg-emerald-400/10 text-emerald-300':status==='READY'?'border-yellow-300/35 bg-yellow-300/10 text-yellow-300':'border-white/10 text-white/35'}`}>{statusMeta.label}</span><span className={`rounded-md border px-2 py-1 text-[8px] font-black ${currentStage==='FINAL'?'border-violet-400/55 bg-violet-500/10 text-violet-200':currentStage==='SEMIFINAL'?'border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200':currentStage==='QUARTERFINAL'?'border-violet-400/35 bg-violet-400/[.06] text-violet-300':'border-yellow-300/25 bg-yellow-300/5 text-yellow-300'}`}>{currentStage}</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="p-3 pt-1 border-t border-white/5">
          <div className="flex flex-wrap gap-2 text-[9px] text-white/45 mb-3">
            <span>📅 {rec.eventDate || '—'}</span><span>📍 {rec.eventLocation || '—'}</span>
            {rec.division && <span>◈ {rec.division}</span>}<span><GitBranch size={10} className="inline" /> {rec.playMode || '—'}</span>
            {rec.displayColors && <span className="flex items-center gap-1.5 ml-auto" title="Saved tournament colors"><span className="text-[8px] font-black text-white/35">COLORS</span><i className="w-3 h-3 rounded-full border border-white/20" style={{background:rec.displayColors.redColor}}/><i className="w-3 h-3 rounded-full border border-white/20" style={{background:rec.displayColors.blueColor}}/><i className="w-2.5 h-2.5 rounded-full border border-white/15" style={{background:rec.displayColors.titleColor}}/></span>}
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-black text-yellow-300"><Trophy size={13}/> {completedCount>=totalCount && totalCount>0 ? '🏆 FINISHED · CHAMPION DECIDED' : 'TOURNAMENT ROADMAP'}</div>
            <div className="grid grid-cols-5 gap-1.5">{stages.map((st,i)=>{const cls=st==='FINAL'?'border-violet-400/55 bg-violet-500/10 text-violet-200':st==='SEMIFINAL'?'border-fuchsia-400/45 bg-fuchsia-400/10 text-fuchsia-200':st==='QUARTERFINAL'?'border-violet-400/30 bg-violet-400/[.06] text-violet-300':'border-white/10 bg-white/[.02] text-white/35'; return <div key={st} className={`rounded-lg border p-2 text-center text-[7px] font-black ${cls} ${i<=stageIndex?'shadow-[0_0_18px_rgba(255,255,255,.06)]':''}`}>{st}<div className="mt-1 opacity-70">{i<stageIndex?'DONE':i===stageIndex?'ACTIVE':'NEXT'}</div></div>})}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2"><div className="rounded-lg bg-black/20 p-2"><div className="text-[7px] text-white/40">PLAYERS</div><div className="font-black">{rec.teams.reduce((n,t)=>n+(t.roster?.length||0),0)}</div></div><div className="rounded-lg bg-black/20 p-2"><div className="text-[7px] text-white/40">MATCHES</div><div className="font-black">{totalCount}</div></div><div className="rounded-lg bg-black/20 p-2"><div className="text-[7px] text-white/40">PLAYED</div><div className="font-black text-emerald-300">{completedCount}</div></div><div className="rounded-lg bg-black/20 p-2"><div className="text-[7px] text-white/40">REMAINING</div><div className="font-black text-amber-300">{remainingMatches.length}</div></div></div>
            <div className="grid md:grid-cols-2 gap-2"><div className="rounded-lg border border-yellow-300/20 bg-yellow-300/[.03] p-2.5"><div className="text-[8px] text-yellow-300">BEST PLAYER · CURRENT WEIGHT</div><div className="font-black text-sm mt-1">{bestPlayer?.name||'—'}</div><div className="text-[8px] text-white/45 mt-1">MVP {bestPlayer?.mvps||0} · PTS {bestPlayer?.points||0} · TEAM {bestPlayer?.team||'—'} · CLUB {bestPlayer?.club||'—'}</div></div><div className="rounded-lg border border-emerald-300/20 bg-emerald-300/[.03] p-2.5"><div className="text-[8px] text-emerald-300">CLEAN PLAYER</div><div className="font-black text-sm mt-1">{cleanPlayer?.name||'—'}</div><div className="text-[8px] text-white/45 mt-1">GAM-JEOM {cleanPlayer?.gamjeom||0} · MATCH MVP/FAIR PLAY {cleanPlayer?.mvps||0}</div></div></div>
            <div className="rounded-lg border border-white/10 p-2"><div className="text-[8px] font-black text-white/55 mb-1.5">BEST PLAYER · EVERY COMPLETED MATCH</div>{mvpRows.length===0?<div className="text-[8px] text-white/30">MVP data will appear after the match MVP is recorded.</div>:<div className="space-y-1.5 max-h-40 overflow-y-auto">{mvpRows.map(({m,b}:any)=><div key={m.id} className="flex items-center gap-2 rounded-md bg-black/20 p-1.5">{b.photo?<img src={b.photo} alt="" className="w-7 h-7 rounded-full object-cover"/>:<div className="w-7 h-7 rounded-full bg-yellow-300/10 text-yellow-300 text-[7px] flex items-center justify-center font-black">MVP</div>}<div className="min-w-0 flex-1"><div className="text-[8px] font-black">#{m.match_number||'—'} · {b.name}</div><div className="text-[7px] text-white/40">{b.club||'—'} · #{b.playerNumber??'—'} · SEED {b.seedNumber??'—'} · {b.points||0} pts</div></div></div>)}</div>}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 mb-3">
            <div className="text-[9px] font-black tracking-[.18em] text-white/55 mb-2">PLAYER RANKING · ALL COMPLETED TEAM MATCHES</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">{playerRanking.map((p:any,i:number)=><div key={p.name} className="rounded-lg border border-white/5 bg-white/[.02] p-2 flex items-center gap-2">{p.photo?<img src={p.photo} alt="" className="h-8 w-8 rounded-full object-cover"/>:<div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-[7px]">#{i+1}</div>}<div className="min-w-0 flex-1"><div className="text-[9px] font-black truncate">#{i+1} · {p.name}</div><div className="text-[7px] text-white/40">{p.club||'—'} · W {p.wins} · PTS {p.points}</div></div></div>)}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 mb-3">
            <div className="text-[9px] font-black tracking-[.18em] text-white/55 mb-2">MATCH DETAILS · COMPLETED / REMAINING</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">{rec.matches.map((m:any)=><div key={m.id} className={`rounded-lg border p-2 ${m.status==='COMPLETED'?'border-emerald-400/20 bg-emerald-400/[.025]':'border-amber-400/20 bg-amber-400/[.025]'}`}><div className="flex items-center justify-between text-[7px] font-black text-white/45"><span>#{m.matchNumber||'—'} · {stageForRound(Number(m.round)||1)}</span><span>{m.status==='COMPLETED'?'DONE':'REMAINING'}</span></div><div className="mt-1 text-[9px] font-black">{m.team1||'TEAM 1'} <span className="text-white/30 mx-1">VS</span> {m.team2||'TEAM 2'}</div><div className="mt-1 text-[7px] text-white/40">{m.score||'—'} · WINNER {m.winner||'—'}</div></div>)}</div>
          </div>
          <div className="grid md:grid-cols-2 gap-2">{rec.teams.map(t => <TeamCard key={t.id || t.name} team={t} ar={ar} />)}</div>
          {remainingMatches.length > 0 && (
            <div className="mt-3 rounded-lg bg-[hsl(var(--primary))]/5 border border-[hsl(var(--primary))]/20 p-2">
              <div className="text-[9px] font-black text-[hsl(var(--primary))] mb-1.5 flex items-center gap-1">
                <PlayCircle size={11} /> {ar ? `استكمال المباريات المتبقية في هذا الوزن (${remainingMatches.length})` : `Continue remaining matches for this weight (${remainingMatches.length})`}
              </div>
              <div className="space-y-1">
                {remainingMatches.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-2 text-[9px] text-white/70 px-2 py-1.5 rounded bg-black/20">
                    <span>#{m.matchNumber || '—'} · {m.team1 || '—'} vs {m.team2 || '—'} {m.matNumber ? `· MAT ${m.matNumber}` : ''}</span>
                    <button
                      onClick={() => navigate('/admin', { state: {
                        parEquipeContinue: {
                          tournamentId: rec.tournamentId, tournamentName: rec.tournamentName,
                          ageGroup: rec.ageGroup, gender: rec.gender, weightCategory: rec.weightCategory,
                          matchId: m.id, team1: m.team1, team2: m.team2, matchNumber: m.matchNumber,
                        },
                      } })}
                      className="shrink-0 px-2 py-1 rounded-full bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-black"
                    >
                      {ar ? 'فتح في Admin' : 'Open in Admin'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {rec.matches.length > 0 && (
            <div className="mt-3 rounded-lg bg-white/[.02] border border-white/10 p-2">
              <div className="text-[9px] font-black text-yellow-300 mb-1">{ar ? 'الشجرة / المباريات' : 'BRACKET / MATCHES'}</div>
              <div className="grid sm:grid-cols-2 gap-1">
                {rec.matches.map(m => <div key={m.id} className="text-[9px] text-white/55 px-2 py-1 rounded bg-black/20">#{m.matchNumber || '—'} · R{m.round || '—'} · MAT {m.matNumber || '—'} · {m.team1 || '—'} vs {m.team2 || '—'} {m.status === 'COMPLETED' ? '✓' : ''}</div>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ParEquipeTournamentArchive({ onAddMatch }: { onAddMatch?: () => void } = {}) {
  useEffect(() => { void syncCategoryCatalogFromCloud(); }, []);
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [open, setOpen] = useState(false);
  const [expandedTournament, setExpandedTournament] = useState<string | null>(null);
  const [expandedGender, setExpandedGender] = useState<string | null>(null);
  const [expandedAge, setExpandedAge] = useState<string | null>(null);
  const [expandedWeight, setExpandedWeight] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const importInputRef = useRef<HTMLInputElement>(null);
  const cloudRestoreInputRef = useRef<HTMLInputElement>(null);
  const [cloudBusy, setCloudBusy] = useState(false);

  // --- "+ إضافة مباراة" generator: gender → age group → weight, then just
  // the two team names. Auto-fills tournament/gender/age/weight from the
  // selection above; writes both a real Tournament record and this Par
  // Équipe archive record from the same source, per request.
  const [genOpen, setGenOpen] = useState(false);
  const [genTournament, setGenTournament] = useState('');
  const [genGender, setGenGender] = useState<'male' | 'female'>('male');
  const [genAge, setGenAge] = useState('senior');
  const [genWeight, setGenWeight] = useState('');
  const [genTeam1, setGenTeam1] = useState('');
  const [genTeam2, setGenTeam2] = useState('');
  const genWeightOptions = React.useMemo(() => getWeightCategories(genAge, genGender), [genAge, genGender]);

  const handleGenerate = () => {
    const rec = generateParEquipeMatch({
      tournamentName: genTournament, gender: genGender, ageGroup: genAge,
      weightCategory: genWeight, team1: genTeam1, team2: genTeam2,
    });
    if (!rec) {
      toast.error(ar ? 'أدخل اسم البطولة، الوزن، واسمي الفريقين' : 'Enter tournament name, weight, and both team names');
      return;
    }
    toast.success(ar ? 'تم إنشاء المباراة وحفظها في Par Équipe والبطولة' : 'Match created and saved in both Par Équipe and Tournament');
    setGenTeam1(''); setGenTeam2('');
    setRefreshTick(v => v + 1);
    setOpen(true);
  };

  const records = React.useMemo(() => {
    const all = listParEquipeTournamentArchive();
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(r => [r.tournamentName, r.ageGroup, r.gender, r.weightCategory, r.division, r.eventLocation, ...r.teams.flatMap(t => [t.name, t.club, t.country, ...(t.roster || []).map((p: any) => `${p.name} ${p.nationality || ''} ${p.playerNumber ?? ''} ${p.seedNumber ?? ''}`)])].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [query, open, refreshTick]);

  const tournaments = React.useMemo(() => {
    const map = new Map<string, ParEquipeTournamentArchiveRecord[]>();
    records.forEach(r => { const a = map.get(r.tournamentName) || []; a.push(r); map.set(r.tournamentName, a); });
    return Array.from(map.entries());
  }, [records]);

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const count = importParEquipeArchiveBackup(String(reader.result || ''));
        setRefreshTick(v => v + 1);
        toast.success(ar ? `تم استيراد ${count} سجل` : `Imported ${count} record(s)`);
      } catch {
        toast.error(ar ? 'تعذّرت قراءة ملف النسخة الاحتياطية' : 'Could not read this backup file');
      }
    };
    reader.readAsText(file);
  };

  const handleCloudBackup = async () => {
    setCloudBusy(true);
    try {
      await exportFullBackup();
      toast.success(ar ? 'تم تنزيل نسخة احتياطية كاملة (كل البطولات + Par Équipe)' : 'Full backup downloaded (all tournaments + Par Équipe)');
    } catch (e: any) {
      toast.error(ar ? `فشلت النسخة الاحتياطية: ${e?.message || ''}` : `Backup failed: ${e?.message || ''}`);
    } finally {
      setCloudBusy(false);
    }
  };
  const handleCloudRestore = async (file: File) => {
    setCloudBusy(true);
    try {
      const result = await restoreFromBackup(file);
      setRefreshTick(v => v + 1);
      toast.success(ar ? 'تم الاسترجاع بنجاح' : 'Restored successfully');
      console.log('[restore]', result);
    } catch (e: any) {
      toast.error(ar ? `فشل الاسترجاع: ${e?.message || ''}` : `Restore failed: ${e?.message || ''}`);
    } finally {
      setCloudBusy(false);
    }
  };

  return (
    <div className="panel p-4 mb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button onClick={() => setOpen(v => !v)} className="flex-1 flex items-center justify-between text-xs font-display font-bold text-[hsl(var(--primary))]">
          <span className="flex items-center gap-1"><Trophy size={12} />{ar ? 'أرشيف بطولات Par Équipe' : 'Par Équipe Tournament Archive'}</span>
        </button>
        <button onClick={() => { setGenOpen(v => !v); onAddMatch?.(); }} title={ar ? 'إضافة مباراة' : 'Add match'}
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-[hsl(var(--primary))]/15 hover:bg-[hsl(var(--primary))]/25 text-[10px] font-bold text-[hsl(var(--primary))]">
          <Plus size={11} /> {ar ? 'إضافة مباراة' : 'Add Match'}
        </button>
        <button onClick={exportParEquipeArchiveBackup} title={ar ? 'نسخة احتياطية' : 'Backup'}
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white/70">
          <Archive size={11} /> {ar ? 'نسخة احتياطية' : 'Backup'}
        </button>
        <button onClick={() => importInputRef.current?.click()} title={ar ? 'استيراد نسخة احتياطية' : 'Import backup'}
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white/70">
          <Upload size={11} /> {ar ? 'استيراد' : 'Import'}
        </button>
        <button onClick={handleCloudBackup} disabled={cloudBusy} title={ar ? 'نسخة احتياطية كاملة (سحابة) — كل البطولات + Par Équipe' : 'Full backup (cloud) — all tournaments + Par Équipe'}
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white/70 disabled:opacity-40">
          <Cloud size={11} /> {cloudBusy ? (ar ? 'جاري...' : '...') : (ar ? 'نسخة كاملة (سحابة)' : 'Full backup (cloud)')}
        </button>
        <button onClick={() => cloudRestoreInputRef.current?.click()} disabled={cloudBusy} title={ar ? 'استرجاع نسخة احتياطية كاملة' : 'Restore full backup'}
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white/70 disabled:opacity-40">
          <CloudDownload size={11} /> {ar ? 'استرجاع (سحابة)' : 'Restore (cloud)'}
        </button>
        <input ref={importInputRef} type="file" accept="application/json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleImportFile(f); }} />
        <input ref={cloudRestoreInputRef} type="file" accept="application/json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleCloudRestore(f); }} />
        <button onClick={() => setOpen(v => !v)} className="shrink-0">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">{ar ? 'البطولة ← الجنس ← الفئة السنية ← الوزن ← الفرق واللاعبون ← الشجرة والمباريات. طبقة إضافية فوق الحفظ الحالي.' : 'Tournament → gender → age group → weight → teams and players → bracket and matches. Additive layer; existing match storage remains untouched.'}</p>

      {genOpen && (
        <div id="parequipe-add-match" className="mt-3 rounded-xl border border-[hsl(var(--primary))]/25 bg-[hsl(var(--primary))]/5 p-3 space-y-2">
          <div className="text-[10px] font-black text-[hsl(var(--primary))]">{ar ? 'إضافة مباراة جديدة — اختر الجنس ثم الفئة ثم الوزن، وأدخل اسمي الفريقين فقط' : 'Add new match — pick gender, then age, then weight, then just the two team names'}</div>
          <input value={genTournament} onChange={e => setGenTournament(e.target.value)} placeholder={ar ? 'اسم البطولة' : 'Tournament name'}
            className="w-full rounded-lg bg-black/20 border border-white/10 px-2.5 py-1.5 text-xs outline-none" />
          <div className="grid grid-cols-3 gap-2">
            <select value={genGender} onChange={e => setGenGender(e.target.value as 'male' | 'female')} className="rounded-lg bg-black/20 border border-white/10 px-2 py-1.5 text-xs">
              {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
            <select value={genAge} onChange={e => setGenAge(e.target.value)} className="rounded-lg bg-black/20 border border-white/10 px-2 py-1.5 text-xs">
              {AGE_GROUPS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            <select value={genWeight} onChange={e => setGenWeight(e.target.value)} className="rounded-lg bg-black/20 border border-white/10 px-2 py-1.5 text-xs">
              <option value="">{ar ? 'اختر الوزن' : 'Select weight'}</option>
              {genWeightOptions.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={genTeam1} onChange={e => setGenTeam1(e.target.value)} placeholder={ar ? 'اسم الفريق 1 (Chung)' : 'Team 1 name (Chung)'}
              className="rounded-lg bg-black/20 border border-white/10 px-2.5 py-1.5 text-xs outline-none" />
            <input value={genTeam2} onChange={e => setGenTeam2(e.target.value)} placeholder={ar ? 'اسم الفريق 2 (Hong)' : 'Team 2 name (Hong)'}
              className="rounded-lg bg-black/20 border border-white/10 px-2.5 py-1.5 text-xs outline-none" />
          </div>
          <button onClick={handleGenerate} className="w-full rounded-lg bg-[hsl(var(--primary))] text-black font-black text-xs py-2">
            {ar ? 'توليد Generate' : 'Generate'}
          </button>
        </div>
      )}
      {open && <>
        <div className="mt-3 relative"><Search size={13} className="absolute start-3 top-1/2 -translate-y-1/2 text-white/35" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? 'بحث عن بطولة، فريق، لاعب، فئة أو وزن…' : 'Search tournament, team, player, category or weight…'} className="w-full rounded-lg bg-white/[.03] border border-white/10 px-8 py-2 text-xs outline-none" /></div>
        {tournaments.length === 0 ? <div className="mt-3 py-6 text-center text-xs text-white/35">{ar ? 'لا توجد سجلات منظمة بعد.' : 'No structured records yet.'}</div> :
          <div className="mt-3 space-y-2">
            {tournaments.map(([name, rows]) => {
              const tOpen = expandedTournament === name;
              const savedByKey = new Map<string, ParEquipeTournamentArchiveRecord>();
              rows.forEach(r => savedByKey.set(`${r.gender || 'unknown'}|${r.ageGroup || 'unknown'}|${r.weightCategory || ''}`, r));
              const playerCount = rows.reduce((n, r) => n + r.teams.reduce((x, t) => x + (t.roster?.length || 0), 0), 0);
              const totalFolders = GENDERS.reduce((n,g)=>n + getAllAgeCategories(g.value).reduce((a,age)=>a + getAllWeightCategories(g.value,age.value).length,0),0);
              return <div key={name} className="rounded-xl border border-white/10 overflow-hidden">
                <button onClick={() => setExpandedTournament(tOpen ? null : name)} className="w-full flex items-center gap-2 px-3 py-3 bg-white/[.02] text-start">
                  {tOpen ? <FolderOpen size={15} className="text-yellow-300" /> : <Folder size={15} className="text-yellow-300" />}
                  <Trophy size={13} className="text-yellow-300/70" /><span className="font-black text-xs truncate flex-1">{name}</span>
                  <span className="text-[9px] text-white/35">{totalFolders} {ar ? 'مجلدات فئات' : 'category folders'} · {rows.length} {ar ? 'محفوظ' : 'saved'} · {playerCount} {ar ? 'لاعب' : 'players'}</span>
                  {tOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {tOpen && <div className="p-2 space-y-2">
                  {GENDERS.map(g => {
                    const gKey = `${name}|${g.value}`; const gOpen = expandedGender === gKey;
                    return <div key={gKey} className="rounded-xl border border-white/10 overflow-hidden">
                      <button onClick={() => setExpandedGender(gOpen ? null : gKey)} className="w-full px-3 py-2.5 flex items-center gap-2 text-start bg-white/[.015]">
                        {gOpen ? <FolderOpen size={13} className="text-blue-300" /> : <Folder size={13} className="text-blue-300" />}
                        <span className="font-black text-[11px] flex-1">{genderLabel(g.value, ar)}</span><span className="text-[9px] text-white/35">{getAllAgeCategories(g.value).length} {ar ? 'فئات سنية' : 'age groups'}</span>{gOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                      {gOpen && <div className="p-2 space-y-2">
                        {getAllAgeCategories(g.value).map(age => {
                          const aKey = `${gKey}|${age.value}`; const aOpen = expandedAge === aKey;
                          const weights = getAllWeightCategories(g.value, age.value);
                          return <div key={aKey} className="rounded-xl border border-white/10 overflow-hidden">
                            <button onClick={() => setExpandedAge(aOpen ? null : aKey)} className="w-full px-3 py-2 flex items-center gap-2 text-start">
                              {aOpen ? <FolderOpen size={12} className="text-cyan-300" /> : <Folder size={12} className="text-cyan-300" />}<Users size={11} className="text-white/35" />
                              <span className="font-bold text-[11px] flex-1">{ageLabel(age.value, ar)}</span><span className="text-[9px] text-white/35">{weights.length} {ar ? 'أوزان' : 'weights'}</span>{aOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                            {aOpen && <div className="p-2 space-y-1">
                              {weights.map(weight => {
                                const rec = savedByKey.get(`${g.value}|${age.value}|${weight}`);
                                if (!rec) return <div key={`${g.value}-${age.value}-${weight}`} className="rounded-xl border border-white/10 overflow-hidden bg-black/10 px-3 py-2.5 flex items-center gap-2 text-[10px] text-white/35"><Folder size={13} className="text-yellow-300/50" /><Scale size={12} /><span className="flex-1">{weight}</span><span>{ar ? 'فارغ' : 'EMPTY'}</span></div>;
                                const wKey = `${aKey}|${rec.id}`;
                                return <WeightFolder key={rec.id} rec={rec} ar={ar} open={expandedWeight === wKey} onToggle={() => setExpandedWeight(expandedWeight === wKey ? null : wKey)} />;
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
      </>}
    </div>
  );
}
