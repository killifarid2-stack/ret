import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Loader2, PauseCircle, PlayCircle } from 'lucide-react';
import CategoryMatchBrowser from './CategoryMatchBrowser';
import {
  listCategoryOverview,
  CategoryOverviewGroup,
  CategoryOverviewBucket,
  CategoryStatus,
  setCategorySuspended,
} from '@/lib/category-library';

interface Props {
  onClose: () => void;
  onMatchCreated?: (result: { matchId: string; tournamentId: string; tournamentName: string }) => void;
}

// Single archive screen: TOURNAMENT → GENDER → AGE CATEGORY → every WEIGHT
// category shown at once, each as a glowing status circle. No need to open
// a weight just to see whether it's finished — the whole board is visible
// in one glance, exactly like a real ring-side category board. Tapping a
// circle opens that category's own match list (reusing CategoryMatchBrowser).
//
// Status colors:
//   grey    = not started (no matches yet)
//   gold    = ready (matches queued, none started fighting)
//   blue    = in progress (live, or partially finished) — pulses
//   green   = finished (every match in the category is done)
// There is currently no automatic "problem/suspended" detection — nothing
// in the match/tournament data marks a category that way yet.

const STATUS_META: Record<CategoryStatus, { color: string; glow: string; label: string; pulse?: boolean }> = {
  not_started: { color: '#5b6472', glow: 'none', label: 'NOT STARTED' },
  ready: { color: '#f2c14e', glow: '0 0 10px rgba(242,193,78,.85)', label: 'READY' },
  in_progress: { color: '#33a2ff', glow: '0 0 12px rgba(51,162,255,.9)', label: 'LIVE', pulse: true },
  finished: { color: '#3ddc84', glow: '0 0 8px rgba(61,220,132,.7)', label: 'FINISHED' },
  suspended: { color: '#ff4d4f', glow: '0 0 14px rgba(255,77,79,.9)', label: 'SUSPENDED', pulse: true },
};

function StatusCircle({ bucket, onClick }: { bucket: CategoryOverviewBucket; onClick: () => void }) {
  const meta = STATUS_META[bucket.status];
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${bucket.weightCategory} — ${meta.label} · ${bucket.playerCount} players · ${bucket.finishedMatches}/${bucket.totalMatches} finished · ${bucket.remainingMatches} remaining · ${bucket.hasBracket ? 'BRACKET' : 'NO BRACKET'} · ${bucket.currentStage}`}
      className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 hover:bg-white/5 transition-colors"
    >
      <span
        className={`block h-3.5 w-3.5 rounded-full border border-black/30 ${meta.pulse ? 'category-status-pulse' : ''}`}
        style={{ background: meta.color, boxShadow: meta.glow }}
      />
      <span className="font-display text-[10px] font-black tracking-wide text-white/80">{bucket.weightCategory}</span>
      <span className="max-w-[90px] truncate text-[6px] uppercase tracking-wider text-white/20">{bucket.tournamentName}</span>
      <span className="text-[8px] uppercase tracking-wider text-white/40">{meta.label}</span>
      <span className="text-[7px] text-white/30">{bucket.playerCount}P · {bucket.clubCount}C · {bucket.finishedMatches}/{bucket.totalMatches} · {bucket.remainingMatches} LEFT · {bucket.hasBracket ? 'BRACKET' : 'NO TREE'}</span>
    </button>
  );
}

function ageStatus(groups: CategoryOverviewGroup[]): CategoryStatus {
  const buckets = groups.flatMap(g => g.buckets);
  if (buckets.some(b => b.status === 'suspended')) return 'suspended';
  const active = buckets.filter(b => b.totalMatches > 0 || b.playerCount > 0);
  if (!active.length) return 'not_started';
  if (active.some(b => b.status === 'in_progress')) return 'in_progress';
  if (active.every(b => b.status === 'finished')) return 'finished';
  return 'ready';
}

function GenderBlock({ label, color, groups, onPick, onSuspend, busyBucket }: {
  label: string;
  color: string;
  groups: CategoryOverviewGroup[];
  onPick: (b: CategoryOverviewBucket) => void;
  onSuspend: (b: CategoryOverviewBucket) => void;
  busyBucket: string | null;
}) {
  if (groups.every((g) => g.buckets.length === 0)) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <h4 className="font-display text-xs font-black tracking-[.18em] text-white/85">{label}</h4>
      </div>
      <div className="space-y-3">
        {groups.filter((g) => g.buckets.length > 0).map((g) => (
          <div key={g.ageGroup} className="rounded-xl border-2 p-2 transition-all" style={{ borderColor: `${STATUS_META[ageStatus([g])].color}66`, boxShadow: `0 0 18px ${STATUS_META[ageStatus([g])].color}22` }}>
            <div className="mb-1 flex items-center justify-between gap-2"><div className="text-[10px] font-black uppercase tracking-widest text-white/70">{g.ageLabel}</div><span className="text-[8px] font-black uppercase tracking-widest" style={{color: STATUS_META[ageStatus([g])].color}}>{STATUS_META[ageStatus([g])].label}</span></div>
            <div className="mb-2 text-[8px] text-white/35">{g.buckets.filter(b=>b.tournamentId).length}/{g.buckets.length} WEIGHTS POPULATED · {g.buckets.reduce((n,b)=>n+b.playerCount,0)} PLAYERS · {g.buckets.reduce((n,b)=>n+b.clubCount,0)} CLUBS · {g.buckets.reduce((n,b)=>n+b.totalMatches,0)} MATCHES</div>
            <div className="flex flex-wrap gap-1 rounded-lg border border-white/5 bg-black/20 p-2">
              {g.buckets.map((b) => (
                <div key={b.weightCategory} className="relative group">
                  <StatusCircle bucket={b} onClick={() => onPick(b)} />
                  {b.tournamentId && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onSuspend(b); }} title={b.status === 'suspended' ? 'Resume weight' : 'Suspend weight'} className="absolute right-0 top-0 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-white/70 hover:text-white">
                      {busyBucket === `${b.gender}|${b.ageGroup}|${b.weightCategory}` ? <Loader2 size={10} className="animate-spin" /> : b.status === 'suspended' ? <PlayCircle size={11} /> : <PauseCircle size={11} />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CategoryStatusArchive({ onClose, onMatchCreated }: Props) {
  const [groups, setGroups] = useState<CategoryOverviewGroup[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [openBucket, setOpenBucket] = useState<CategoryOverviewBucket | null>(null);
  const [busyBucket, setBusyBucket] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setGroups(await listCategoryOverview());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSuspend = async (bucket: CategoryOverviewBucket) => {
    if (!bucket.tournamentId) return;
    const suspended = bucket.status === 'suspended';
    setBusyBucket(`${bucket.gender}|${bucket.ageGroup}|${bucket.weightCategory}`);
    try {
      await setCategorySuspended(bucket.tournamentId, !suspended);
      await load();
    } finally {
      setBusyBucket(null);
    }
  };

  const maleGroups = (groups || []).filter((g) => g.gender === 'male');
  const femaleGroups = (groups || []).filter((g) => g.gender === 'female');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl border border-primary/30 bg-[#0c0c14] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h5 className="font-display font-black text-sm tracking-wide text-primary">أرشيف الفئات — كل الأوزان دفعة واحدة</h5>
            <p className="text-[10px] text-white/40">TOURNAMENT → GENDER → AGE → WEIGHT · اضغط على أي وزن للدخول إليه مباشرة</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={load} disabled={loading} className="text-white/50 hover:text-white/80 disabled:opacity-40">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
            <button type="button" onClick={onClose} className="text-white/60"><X size={16} /></button>
          </div>
        </div>

        {loading && !groups && (
          <div className="flex items-center justify-center gap-2 py-10 text-white/50 text-sm">
            <Loader2 size={16} className="animate-spin" /> جارٍ التحميل...
          </div>
        )}

        {groups && (
          <div className="space-y-3">
            <GenderBlock label="MEN" color="#33a2ff" groups={maleGroups} onPick={setOpenBucket} onSuspend={handleSuspend} busyBucket={busyBucket} />
            <GenderBlock label="WOMEN" color="#ff5577" groups={femaleGroups} onPick={setOpenBucket} onSuspend={handleSuspend} busyBucket={busyBucket} />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-2 text-[9px] text-white/40">
          {(Object.keys(STATUS_META) as CategoryStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[s].color }} /> {STATUS_META[s].label}
            </span>
          ))}
        </div>
      </div>

      {openBucket && (
        <CategoryMatchBrowser
          onClose={() => { setOpenBucket(null); load(); }}
          onMatchCreated={onMatchCreated}
          initialBucket={{ gender: openBucket.gender as 'male' | 'female', ageGroup: openBucket.ageGroup, weightCategory: openBucket.weightCategory }}
        />
      )}
    </div>
  );
}
