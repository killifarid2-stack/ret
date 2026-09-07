import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMatch } from '@/context/MatchContext';
import { MATCH_STAGE_LABELS, MatchStage } from '@/types/tkd';
import { loadMatchesLocal } from '@/lib/match-local';

interface Row {
  id: string;
  match_number: number;
  weight_category: string | null;
  gender: string | null;
  age_group: string | null;
  match_stage: string | null;
  chung_name: string | null;
  hong_name: string | null;
  chung_score?: number | null;
  hong_score?: number | null;
  status: string | null;
  winner: string | null;
}

type BarState = 'finished_chung' | 'finished_hong' | 'cancelled' | 'current' | 'next' | 'upcoming';

/**
 * Sticky bar shown at the top of the Referee/Operator screen — the
 * "Tournament Bracket Strip". Lists every match tied to the current
 * competition (state.competitionName), highlighting the currently loaded
 * match. Auto-refreshes every 8s, merging Supabase with a local cache so it
 * keeps working even when the cloud is unreachable.
 *
 * Color coding:
 *   - current  -> green   (this IS the loaded match, live or temporarily paused)
 *   - next     -> yellow  (the next not-yet-played match right after the current one)
 *   - finished -> the WINNER's color (blue for chung, red for hong) — not a neutral green
 *   - cancelled -> red, struck through
 *   - upcoming (further out / TBD) -> neutral gray
 */
interface TournamentBarProps {
  onSelectFinishedMatch?: (matchNumber: number) => void;
}

export default function TournamentBar({ onSelectFinishedMatch }: TournamentBarProps) {
  const { state } = useMatch();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const comp = state.competitionName || '';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!comp) { setRows([]); return; }
      const localRows = loadMatchesLocal(comp);
      let cloudRows: Row[] = [];
      try {
        const { data } = await supabase
          .from('matches')
          .select('id, match_number, weight_category, gender, age_group, match_stage, chung_name, hong_name, chung_score, hong_score, status, winner')
          .eq('competition_name', comp)
          .order('match_number', { ascending: true })
          .limit(50);
        cloudRows = (data as any) || [];
      } catch { /* offline/unconfigured — local cache still works */ }
      // Cloud row wins over a local one for the same match number (it may
      // have richer data once synced), local fills in whatever's missing.
      const merged = [...cloudRows, ...localRows.filter(l => !cloudRows.some(c => c.match_number === l.match_number))];
      if (!cancelled) setRows(merged as Row[]);
    };
    load();
    // Real-time: refresh the instant any match for this competition is
    // inserted/updated in Supabase (e.g. another mat/device finishing a
    // match), instead of waiting for the next poll.
    const channel = supabase
      .channel(`matches-strip-${comp}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `competition_name=eq.${comp}` }, () => load())
      .subscribe();
    // Polling stays on as a fallback for when Realtime itself can't connect
    // (same root cause as the rest of the cloud features — see the banner).
    const iv = setInterval(load, 8000);
    return () => { cancelled = true; clearInterval(iv); supabase.removeChannel(channel); };
  }, [comp]);

  if (!comp || rows.length === 0) return null;

  const PAUSED_LIVE_STATUSES = new Set(['paused', 'kyeshi', 'doctor', 'rest', 'ivr']);
  // The "next" match is the first not-yet-played (not finished/cancelled)
  // match with a higher number than the one currently loaded.
  const nextMatchNumber = rows.find(r => r.match_number > (state.matchNumber || 0) && r.status !== 'finished' && r.status !== 'cancelled')?.match_number;

  return (
    <div className="w-full border-b border-border bg-secondary/40 backdrop-blur px-3 py-1.5 overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold pr-2 border-r border-border flex items-center gap-1">
          {comp}
        </span>
        {state.tournamentId && (
          <button
            onClick={() => navigate('/tournament', { state: { continueTournamentId: state.tournamentId } })}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/25 transition-colors shrink-0"
            title="عرض شجرة التأهل الكاملة"
          >
            <Trophy size={11} /> Bracket
          </button>
        )}
        {rows.map(r => {
          const isLoaded = r.match_number === state.matchNumber;
          let bar: BarState;
          if (r.status === 'cancelled') bar = 'cancelled';
          else if (r.status === 'finished') bar = r.winner === 'hong' ? 'finished_hong' : 'finished_chung';
          else if (isLoaded) bar = 'current';
          else if (r.match_number === nextMatchNumber) bar = 'next';
          else bar = 'upcoming';

          const styles: Record<BarState, { pill: string; dot: string; label: string }> = {
            finished_chung: { pill: 'bg-[hsl(var(--chung))]/25 text-[hsl(var(--chung))] border border-[hsl(var(--chung))]/50', dot: 'bg-[hsl(var(--chung))]', label: 'Finished — Blue won' },
            finished_hong: { pill: 'bg-[hsl(var(--hong))]/25 text-[hsl(var(--hong))] border border-[hsl(var(--hong))]/50', dot: 'bg-[hsl(var(--hong))]', label: 'Finished — Red won' },
            cancelled: { pill: 'bg-red-500/15 text-red-400 line-through decoration-red-500/60', dot: 'bg-red-500', label: 'Cancelled' },
            current: { pill: 'bg-emerald-500/20 text-emerald-300 font-bold border-2 border-emerald-500', dot: isLoaded && PAUSED_LIVE_STATUSES.has(state.status) ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse', label: 'Current' },
            next: { pill: 'bg-yellow-500/15 text-yellow-300 border-2 border-yellow-400', dot: 'bg-yellow-400', label: 'Next' },
            upcoming: { pill: 'bg-background text-foreground', dot: 'bg-slate-400', label: 'Upcoming (TBD)' },
          };
          const s = styles[bar];
          const genderLabel = r.gender === 'male' ? 'M' : r.gender === 'female' ? 'F' : '';
          const stageLabel = r.match_stage ? (MATCH_STAGE_LABELS[r.match_stage as MatchStage]?.en || r.match_stage) : '';
          const scoreLabel = r.status === 'finished' && r.chung_score != null && r.hong_score != null ? `${r.chung_score}-${r.hong_score}` : '';

          return (
            <div
              key={r.id}
              onClick={() => { if (r.status === 'finished' && onSelectFinishedMatch) onSelectFinishedMatch(r.match_number); }}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] whitespace-nowrap ${s.pill} ${r.status === 'finished' && onSelectFinishedMatch ? 'cursor-pointer hover:brightness-125' : ''}`}
              title={`${r.chung_name || 'CHUNG'} vs ${r.hong_name || 'HONG'} — ${s.label}${scoreLabel ? ' (' + scoreLabel + ')' : ''}${stageLabel ? ' — ' + stageLabel : ''}${r.status === 'finished' ? ' — click for full result' : ''}`}
            >
              <span className="font-bold">#{r.match_number}</span>
              {(genderLabel || r.weight_category) && (
                <span className="opacity-70">{genderLabel}{genderLabel && r.weight_category ? ' ' : ''}{r.weight_category}</span>
              )}
              {r.age_group && <span className="opacity-50 uppercase text-[10px]">{r.age_group}</span>}
              {stageLabel && <span className="px-1 rounded bg-black/20 opacity-80 text-[10px]">{stageLabel}</span>}
              {scoreLabel && <span className="opacity-90 font-mono text-[10px]">{scoreLabel}</span>}
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
