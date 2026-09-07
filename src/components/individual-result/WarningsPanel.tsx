import { AlertTriangle } from "lucide-react";
import type { RoundResult } from "./types";

interface WarningsPanelProps {
  rounds: RoundResult[];
  total: number;
  limit?: number;
  compact?: boolean;
}

function Pips({ count, limit }: { count: number; limit: number }) {
  return (
    <span className="flex gap-[3px]">
      {Array.from({ length: limit }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i < count
              ? "bg-gold shadow-[0_0_6px_var(--gold)]"
              : "bg-foreground/20"
          }`}
        />
      ))}
    </span>
  );
}

export function WarningsPanel({ rounds, total, limit = 5, compact = false }: WarningsPanelProps) {
  return (
    <div className={compact ? "" : "rounded-sm border border-gold/25 p-2"}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-display text-[0.68rem] font-bold uppercase tracking-[0.18em] text-foreground/80 xl:text-sm">
          <AlertTriangle size={14} className="text-gold" />
          Warnings
        </span>
        <span className="font-display text-lg font-black italic leading-none text-foreground xl:text-2xl">
          {total}
          <span className="ml-1 text-[0.6rem] font-bold not-italic text-foreground/60">
            / {rounds.length * limit}
          </span>
        </span>
      </div>
      <div className="mt-2 space-y-1">
        {rounds.map((r) => {
          const w = r.warnings ?? 0;
          const over = w >= limit;
          return (
            <div key={r.round} className="flex items-center justify-between gap-2">
              <span className="font-display text-[0.6rem] uppercase tracking-[0.2em] text-foreground/65 xl:text-[0.7rem]">
                Round {r.round}
              </span>
              <span className="flex items-center gap-2">
                <Pips count={Math.min(w, limit)} limit={limit} />
                <span
                  className={`font-display text-[0.7rem] font-black ${over ? "text-teamred-bright" : "text-foreground/85"}`}
                >
                  {w}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
