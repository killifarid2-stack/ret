import type { Corner } from "./types";
import { useCountUp } from "./useCountUp";

interface WinnerBannerProps {
  score: { blue: number; red: number };
  winnerCorner: Corner;
  label?: string;
  tournamentName?: string;
  meta?: Array<{ label: string; value: string }>;
}

function ScoreBox({ value, corner, winner }: { value: number; corner: Corner; winner: boolean }) {
  const count = Math.round(useCountUp(value, 800, 500));
  return (
    <div
      className="clip-angled relative flex w-[4.5rem] items-center justify-center py-2 xl:w-32"
      style={{
        background: corner === "blue" ? "var(--gradient-blue)" : "var(--gradient-red)",
        boxShadow: winner
          ? corner === "blue"
            ? "var(--shadow-blue)"
            : "0 0 26px color-mix(in oklab, var(--teamred-bright) 45%, transparent)"
          : "none",
      }}
    >
      <span className="font-display text-4xl font-black italic text-foreground drop-shadow-[0_3px_8px_oklch(0_0_0/0.7)] xl:text-7xl">
        {count}
      </span>
    </div>
  );
}

export function WinnerBanner({ score, winnerCorner, label = "WINNER", tournamentName, meta = [] }: WinnerBannerProps) {
  return (
    <div className="animate-rise-in w-full">
      {(tournamentName || meta.length > 0) && (
        <div className="mb-3 text-center">
          {tournamentName && (
            <div className="mb-2 font-display text-2xl font-black uppercase tracking-[0.12em] text-[#fff1bd] xl:text-5xl" style={{ textShadow: '0 0 26px rgba(255,216,102,.30)' }}>
              {tournamentName}
            </div>
          )}
          {meta.length > 0 && (
            <div className="flex w-full flex-wrap items-stretch justify-center gap-2">
              {meta.map((item) => (
                <div key={`${item.label}-${item.value}`} className="min-w-[120px] flex-1 rounded-lg border border-[#ffd866]/30 bg-black/45 px-3 py-2 text-center shadow-[inset_0_0_18px_rgba(255,216,102,.05)]">
                  <div className="font-display text-[9px] font-black uppercase tracking-[0.14em] text-[#ffd866] xl:text-[11px]">{item.label}</div>
                  <div className="mt-0.5 truncate font-display text-[11px] font-black uppercase tracking-[0.06em] text-white xl:text-sm">{item.value || '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex items-stretch gap-2">
      <div
        className="clip-angled gold-sheen animate-glow-pulse relative flex flex-1 items-center justify-center py-2 xl:py-3"
        style={{ background: "var(--gradient-gold)" }}
      >
        <span className="font-display text-4xl font-black italic tracking-tight text-[oklch(0.14_0.03_265)] xl:text-7xl">
          {label}
        </span>
      </div>
      <ScoreBox value={score.blue} corner="blue" winner={winnerCorner === "blue"} />
      <ScoreBox value={score.red} corner="red" winner={winnerCorner === "red"} />
      </div>
    </div>
  );
}
