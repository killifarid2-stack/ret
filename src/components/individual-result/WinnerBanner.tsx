import type { Corner } from "./types";
import { useCountUp } from "./useCountUp";
import { useI18n } from "@/lib/i18n";

interface WinnerBannerProps {
  score: { blue: number; red: number };
  winnerCorner: Corner;
  label?: string;
}

function ScoreBox({ value, corner, winner }: { value: number; corner: Corner; winner: boolean }) {
  const count = Math.round(useCountUp(value, 800, 500));
  return (
    <div
      className="clip-angled relative flex w-[4.5rem] items-center justify-center py-2 xl:w-24"
      style={{
        background: corner === "blue" ? "var(--gradient-blue)" : "var(--gradient-red)",
        boxShadow: winner
          ? corner === "blue"
            ? "var(--shadow-blue)"
            : "0 0 26px color-mix(in oklab, var(--teamred-bright) 45%, transparent)"
          : "none",
      }}
    >
      <span className="font-display text-4xl font-black italic text-foreground drop-shadow-[0_3px_8px_oklch(0_0_0/0.7)] xl:text-5xl">
        {count}
      </span>
    </div>
  );
}

export function WinnerBanner({ score, winnerCorner, label }: WinnerBannerProps) {
  const { t } = useI18n();
  const displayLabel = label ?? t("finalWinnerLabel");
  return (
    <div className="animate-rise-in flex items-stretch gap-2">
      <div
        className="clip-angled gold-sheen animate-glow-pulse relative flex flex-1 items-center justify-center py-2 xl:py-3"
        style={{ background: "var(--gradient-gold)" }}
      >
        <span className="font-display text-3xl font-black italic tracking-tight text-[oklch(0.14_0.03_265)] xl:text-4xl 2xl:text-5xl">
          {displayLabel}
        </span>
      </div>
      <ScoreBox value={score.blue} corner="blue" winner={winnerCorner === "blue"} />
      <ScoreBox value={score.red} corner="red" winner={winnerCorner === "red"} />
    </div>
  );
}
