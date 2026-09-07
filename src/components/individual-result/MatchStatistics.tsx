import { WarningsPanel } from "./WarningsPanel";
import { ScoreComparison } from "./ScoreComparison";
import { HitSplitBar } from "./HitSplitBar";
import { HeadGear, ChestGear } from "./Gear";
import { useCountUp } from "./useCountUp";
import type { MatchStats, Corner, RoundResult } from "./types";
import { useI18n } from "@/lib/i18n";

function HitBlock({
  label,
  hits,
  percent,
  icon,
}: {
  label: string;
  hits: number;
  percent: number;
  icon: React.ReactNode;
}) {
  const count = Math.round(useCountUp(hits, 1100, 500));
  const pct = Math.round(useCountUp(percent, 1100, 500));
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <div className="font-display text-[0.72rem] font-bold uppercase tracking-[0.2em] text-foreground/90 xl:text-base">
          {label}
        </div>
        <div className="font-display text-3xl font-black italic leading-none text-foreground xl:text-[2.7rem]">
          {count}
          <span className="ml-2 text-base text-gold xl:text-2xl">{pct}%</span>
        </div>
      </div>
    </div>
  );
}


export function MatchStatistics({
  stats,
  corner = "blue",
  rounds = [],
}: {
  stats: MatchStats;
  corner?: Corner;
  rounds?: RoundResult[];
}) {
  const { t } = useI18n();
  const blueHits = Math.round(useCountUp(stats.totalHits.blue, 1100, 500));
  const redHits = Math.round(useCountUp(stats.totalHits.red, 1100, 500));
  const sum = stats.headHits + stats.bodyHits || 1;
  const headPct = Math.round((stats.headHits / sum) * 100);
  const bodyPct = 100 - headPct;
  const limit = stats.warningLimitPerRound ?? 5;

  return (
    <section
      className="clip-angled panel-glass animate-rise-in grid grid-cols-1 items-center gap-3 px-4 py-3 lg:grid-cols-[1.5fr_1.2fr_1fr] xl:px-7 xl:py-4"
      style={{ animationDelay: "500ms" }}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <HitBlock
            label={t("headHitsLabel")}
            hits={stats.headHits}
            percent={headPct}
            icon={<HeadGear corner={corner} size={54} className="xl:w-[76px]" />}
          />
          <HitBlock
            label={t("bodyHitsLabel")}
            hits={stats.bodyHits}
            percent={bodyPct}
            icon={<ChestGear corner={corner} size={48} className="xl:w-[64px]" />}
          />
        </div>
        <div className="mt-2.5">
          <HitSplitBar head={stats.headHits} body={stats.bodyHits} />
        </div>
      </div>

      <div className="border-gold/20 px-3 lg:border-x">
        <div className="text-center font-display text-[0.72rem] font-bold uppercase tracking-[0.24em] text-foreground/90 xl:text-lg">
          Total Hits
        </div>
        <div className="flex items-center justify-center gap-4 font-display text-[1.7rem] font-black italic xl:text-[2.7rem]">
          <span className="text-teamblue-bright drop-shadow-[0_0_16px_color-mix(in_oklab,var(--teamblue-bright)_65%,transparent)]">
            {blueHits}
          </span>
          <span className="text-foreground/45">|</span>
          <span className="text-teamred-bright drop-shadow-[0_0_16px_color-mix(in_oklab,var(--teamred-bright)_65%,transparent)]">
            {redHits}
          </span>
        </div>
        <div className="mt-1.5">
          <ScoreComparison blue={stats.totalHits.blue} red={stats.totalHits.red} />
        </div>
      </div>


      <div className="min-w-0">
        <WarningsPanel rounds={rounds} total={stats.warnings} limit={limit} />
      </div>
    </section>
  );
}
