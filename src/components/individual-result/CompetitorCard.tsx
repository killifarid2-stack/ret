import type { Competitor } from "./types";
import FlagImage from "@/components/FlagImage";

export function CompetitorCard({ competitor, showFlag = true, showClub = true }: { competitor: Competitor; showFlag?: boolean; showClub?: boolean }) {
  const isBlue = competitor.corner === "blue";
  return (
    <div
      className="clip-angled animate-rise-in relative flex items-center gap-3 px-4 py-3 xl:gap-5 xl:px-5 xl:py-4"
      style={{
        background: isBlue ? "var(--gradient-blue)" : "var(--gradient-red)",
        boxShadow: isBlue
          ? "var(--shadow-blue), inset 0 1px 0 oklch(1 0 0 / 0.2)"
          : "0 0 26px color-mix(in oklab, var(--teamred-bright) 40%, transparent), inset 0 1px 0 oklch(1 0 0 / 0.2)",
        border: `1px solid ${isBlue ? "color-mix(in oklab, var(--teamblue-bright) 70%, transparent)" : "color-mix(in oklab, var(--teamred-bright) 70%, transparent)"}`,
      }}
    >
      <span className="gold-sheen absolute inset-0" aria-hidden />
      {showFlag && <FlagImage
        code={competitor.flag || competitor.country}
        size={96}
        className="h-10 w-16 shrink-0 rounded-sm object-cover shadow-[0_4px_14px_oklch(0_0_0/0.6)] ring-1 ring-white/40 xl:h-14 xl:w-24"
      />}
      <div className="relative min-w-0 pl-1 xl:pl-3">
        <div className="font-display text-3xl font-black uppercase leading-none tracking-tight text-foreground drop-shadow-[0_3px_10px_oklch(0_0_0/0.65)] xl:text-4xl 2xl:text-6xl">
          {competitor.name} <span className="text-foreground/90">({competitor.country})</span>
        </div>
        {showClub && <div className="mt-1 truncate font-display text-xs font-bold uppercase tracking-[0.16em] text-gold xl:text-base">{competitor.club}</div>}
      </div>
    </div>
  );
}
