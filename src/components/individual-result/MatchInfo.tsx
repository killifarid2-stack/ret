import { Hash, CalendarDays, Clock, Globe } from "lucide-react";
import type { ReactNode } from "react";
import type { RoundResult } from "./types";
import { WarningsPanel } from "./WarningsPanel";
import { useI18n } from "@/lib/i18n";

interface MatchInfoProps {
  matchId: string | number;
  date: string;
  time: string;
  ring: string | number;
  rounds?: RoundResult[];
  totalWarnings?: number;
  warningLimitPerRound?: number;
}

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 odd:bg-[oklch(1_0_0/0.04)]">
      <span className="flex items-center gap-2 font-display text-[0.68rem] font-bold uppercase tracking-[0.16em] text-foreground/75 xl:text-sm">
        <span className="text-gold">{icon}</span>
        {label}
      </span>
      <span className="font-display text-sm font-black tracking-wide text-foreground xl:text-lg">
        {value}
      </span>
    </div>
  );
}

export function MatchInfo({
  matchId,
  date,
  time,
  ring,
  rounds = [],
  totalWarnings = 0,
  warningLimitPerRound = 5,
}: MatchInfoProps) {
  const { t } = useI18n();
  return (
    <section
      className="clip-angled panel-glass animate-rise-in px-3 py-3"
      style={{ animationDelay: "250ms" }}
    >
      <h3 className="text-center font-display text-sm font-black uppercase tracking-[0.24em] text-gold drop-shadow-[0_0_12px_color-mix(in_oklab,var(--gold)_60%,transparent)] xl:text-xl">
        {t("matchInformationLabel")}
      </h3>
      <div className="mx-auto mt-1 h-px w-2/3 bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
      <div className="mt-2 space-y-0.5">
        <Row icon={<Hash size={14} />} label={t("matchIdLabel")} value={matchId} />
        <Row icon={<CalendarDays size={14} />} label={t("dateLabel")} value={date} />
        <Row icon={<Clock size={14} />} label={t("timeLabel")} value={time} />
        <Row icon={<Globe size={14} />} label={t("matLabel")} value={ring} />
      </div>

      <div className="mt-3 border-t border-gold/25 pt-2">
        <WarningsPanel
          rounds={rounds}
          total={totalWarnings}
          limit={warningLimitPerRound}
          compact
        />
      </div>
    </section>
  );
}
