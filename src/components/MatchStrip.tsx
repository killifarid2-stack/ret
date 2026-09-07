import React from 'react';

export interface MatchStripPlayer {
  name: string;
  nationality?: string;
}

export interface MatchStripMatch {
  id: string;
  round?: number;
  player1?: MatchStripPlayer;
  player2?: MatchStripPlayer;
  isBye?: boolean;
  winner?: string; // 'chung' | 'hong' | player id — anything truthy means decided
}

interface Props {
  matches: MatchStripMatch[];
  /** bracketMatchId of the match currently loaded on the Operator screen, if any. */
  currentMatchId?: string | null;
  /** Called when a "ready" (undecided, both players known) match is tapped. Omit to make the strip read-only (e.g. for the referee view). */
  onStart?: (match: MatchStripMatch, index: number) => void;
}

export default function MatchStrip({ matches, currentMatchId, onStart }: Props) {
  if (!matches || matches.length === 0) return null;
  const playedCount = matches.filter(m => m.winner).length;

  return (
    <div className="mb-3">
      <div className="text-[10px] text-[hsl(var(--muted-foreground))] mb-1.5 font-semibold">
        {playedCount} / {matches.length} matches played
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {matches.map((m, i) => {
          const isCurrent = !!currentMatchId && m.id === currentMatchId;
          const isFinished = !!m.winner;
          const ready = !isFinished && !!(m.player1 && m.player2 && !m.isBye);
          const clickable = ready && !!onStart;

          // NOTE: "ready" (upcoming/remaining) matches are intentionally kept
          // GRAY, never blue — blue is reserved for a match the chung player
          // won, so the two states must never look alike at a glance.
          const colorClasses = isCurrent
            ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold))]/15 border-2'
            : isFinished
              ? (m.winner === 'chung'
                  ? 'border-[hsl(var(--chung))]/60 bg-[hsl(var(--chung))]/10'
                  : 'border-[hsl(var(--hong))]/60 bg-[hsl(var(--hong))]/10')
              : ready
                ? 'border-[hsl(var(--gold))]/40 bg-[hsl(215_16%_47%)]/15'
                : 'border-gray-500/50 bg-gray-500/10 opacity-60';

          const Wrapper = clickable ? 'button' : 'div';
          return (
            <Wrapper key={m.id}
              {...(clickable ? { onClick: () => onStart!(m, i) } : {})}
              className={`shrink-0 w-36 text-left p-2 rounded-lg border transition-colors ${colorClasses} ${clickable ? 'hover:brightness-125 cursor-pointer' : 'cursor-default'}`}>
              <div className="text-[10px] font-bold text-[hsl(var(--gold))] mb-1 flex items-center justify-between">
                <span>Match {i + 1}{m.round !== undefined ? ` · R${m.round}` : ''}</span>
                {isCurrent && <span className="text-[8px] uppercase">Now</span>}
                {!isCurrent && !isFinished && ready && <span className="text-[8px] uppercase text-[hsl(var(--gold))]/80">Ready</span>}
              </div>
              <div className={`text-[10px] truncate font-semibold ${isFinished && m.winner === 'chung' ? 'text-[hsl(var(--chung))] font-bold' : 'text-[hsl(var(--chung))]'}`}>
                {m.player1 ? m.player1.name : (m.isBye && !m.player2 ? 'BYE' : 'TBD')}
              </div>
              <div className="text-center text-[9px] text-[hsl(var(--muted-foreground))]">vs</div>
              <div className={`text-[10px] truncate font-semibold ${isFinished && m.winner === 'hong' ? 'text-[hsl(var(--hong))] font-bold' : 'text-[hsl(var(--hong))]'}`}>
                {m.player2 ? m.player2.name : (m.isBye ? 'BYE' : 'TBD')}
              </div>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
