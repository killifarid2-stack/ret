// Match Replay — point-by-point playback of an already-scored match, for
// training review or dispute resolution. Reads only data that already
// exists on MatchState (state.events, state.roundWinners) — no new
// reducer/state changes, so it works for any match, live or finished.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import type { MatchState, PlayerColor } from '@/types/tkd';
import { formatTime, computeReplayTimeline } from '@/lib/match-engine';

const TECHNIQUE_LABEL: Record<string, string> = {
  punch: 'Punch',
  trunk_kick: 'Trunk kick',
  head_kick: 'Head kick',
  turning_kick: 'Turning kick',
  turning_head: 'Turning head kick',
  manual: 'Manual correction',
  gamjeom: 'Gam-jeom (penalty)',
  warning: 'Warning',
};

interface Props {
  state: MatchState;
  onClose: () => void;
}

export default function MatchReplay({ state, onClose }: Props) {
  // Chronological across the whole match, with the exact running score at
  // each step — computed once by the shared match-engine helper (same
  // scoring semantics as addScore(): gamjeom credits the OPPONENT, warning
  // changes no score) so this view can never drift from the real logic.
  const timeline = useMemo(() => computeReplayTimeline(state), [state.events]);
  const events = useMemo(() => timeline.map(s => s.event), [timeline]);

  const [index, setIndex] = useState(events.length > 0 ? 0 : -1);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = window.setInterval(() => {
      setIndex(i => {
        if (i >= events.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, 1400);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [playing, events.length]);

  // Cumulative score at the current index — read straight from the
  // pre-computed timeline instead of re-deriving it here.
  const cumulative: Record<PlayerColor, number> = index >= 0
    ? { chung: timeline[index].chungScore, hong: timeline[index].hongScore }
    : { chung: 0, hong: 0 };

  const current = index >= 0 ? events[index] : undefined;
  const decisionForCurrentRound = current ? state.roundWinners.find(r => r.round === current.round && r.decisionType) : undefined;

  if (events.length === 0) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
        <div className="panel p-6 max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <div className="text-sm text-[hsl(var(--muted-foreground))]">لا توجد نقط مسجلة بعد فهاد الماتش لإعادة عرضها.</div>
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-[hsl(var(--secondary))] text-sm">إغلاق</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4">
      <div className="panel w-full max-w-2xl p-5 relative">
        <button onClick={onClose} className="absolute top-3 left-3 p-1.5 rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/70">
          <X size={16} />
        </button>
        <div className="text-center mb-4">
          <div className="text-xs tracking-widest text-[hsl(var(--muted-foreground))]">MATCH REPLAY</div>
          <div className="text-sm font-bold">{state.competitionName || 'WAB-TKD'} — {t_matchLabel(state)}</div>
        </div>

        {/* Scoreboard at current point */}
        <div className="grid grid-cols-3 items-center gap-3 mb-4">
          <div className="text-center">
            <div className="text-xs text-[hsl(var(--info))] font-bold">{state.chung.player.name || 'CHUNG'}</div>
            <div className="text-5xl font-black text-[hsl(var(--info))]">{cumulative.chung}</div>
          </div>
          <div className="text-center text-xs text-[hsl(var(--muted-foreground))]">
            ROUND {current?.round ?? 1}
            <div className="text-lg font-mono">{current ? formatTime(current.time) : '--:--'}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[hsl(var(--destructive))] font-bold">{state.hong.player.name || 'HONG'}</div>
            <div className="text-5xl font-black text-[hsl(var(--destructive))]">{cumulative.hong}</div>
          </div>
        </div>

        {/* Current event card */}
        <div className={`rounded-xl border-2 p-3 mb-4 text-center ${current?.player === 'chung' ? 'border-[hsl(var(--info))] bg-[hsl(var(--info))]/10' : 'border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10'}`}>
          {current && (
            <>
              <div className="text-xs font-bold">{current.player === 'chung' ? 'BLUE' : 'RED'} — {TECHNIQUE_LABEL[current.type] || current.type}</div>
              <div className="text-[11px] text-[hsl(var(--muted-foreground))]">+{current.points} {current.type === 'gamjeom' ? '(للخصم)' : ''}</div>
            </>
          )}
          {decisionForCurrentRound && (
            <div className="text-[10px] mt-1 text-[hsl(var(--gold))]">
              {decisionForCurrentRound.decisionType === 'WOOSE_GIROK' ? 'Woo-Se-Girok decision this round' : 'AI tie-break decision this round'}
            </div>
          )}
        </div>

        {/* Timeline scrubber */}
        <input
          type="range" min={0} max={events.length - 1} value={index}
          onChange={e => { setPlaying(false); setIndex(Number(e.target.value)); }}
          className="w-full mb-1 accent-primary"
        />
        <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))] mb-4">
          <span>{index + 1} / {events.length}</span>
          <span>{playing ? 'PLAYING' : 'PAUSED'}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => { setPlaying(false); setIndex(0); }} title="من البداية"
            className="p-2 rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/70"><RotateCcw size={16} /></button>
          <button onClick={() => { setPlaying(false); setIndex(i => Math.max(0, i - 1)); }} title="السابق"
            className="p-2 rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/70"><SkipBack size={16} /></button>
          <button onClick={() => setPlaying(p => !p)} title={playing ? 'إيقاف' : 'تشغيل'}
            className="p-3 rounded-full bg-[hsl(var(--gold))] text-black hover:opacity-90">
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button onClick={() => { setPlaying(false); setIndex(i => Math.min(events.length - 1, i + 1)); }} title="التالي"
            className="p-2 rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/70"><SkipForward size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function t_matchLabel(state: MatchState): string {
  return `#${state.matchNumber || '—'} • ${state.weightCategory || ''}`;
}
