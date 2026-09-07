import { useI18n } from "@/lib/i18n";
interface MatchHeaderProps {
  tournament?: string;
  category: string;
  stage: string;
  matchId: string | number;
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="leading-none">
      <div
        className={`font-display font-black italic tracking-tight text-metal ${compact ? "text-2xl" : "text-3xl xl:text-5xl"}`}
      >
        WAB-TKD
      </div>
      <div className="mt-1 h-[3px] w-full bg-gradient-to-r from-teamred via-gold to-transparent" />
      <div className="mt-1 font-display text-[0.55rem] font-bold uppercase tracking-[0.14em] text-gold xl:text-[0.68rem]">
        World Association of
        <br />
        Budo - Taekwondo
      </div>
    </div>
  );
}

export function MatchHeader({ tournament, category, stage, matchId, showStage = true, showWeight = true }: MatchHeaderProps & { showStage?: boolean; showWeight?: boolean }) {
  const { t } = useI18n();
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {/* app icon slot (top-left) */}
        <div
          aria-label="App icon"
          className="clip-angled grid h-12 w-12 shrink-0 place-items-center border border-gold/50 bg-[oklch(0.12_0.03_265/0.85)] xl:h-16 xl:w-16"
        >
          <span className="font-display text-lg font-black italic text-gold xl:text-2xl">W</span>
        </div>
        <Wordmark />
      </div>

      <div className="animate-rise-in flex-1 text-center">
        {tournament ? (
          <div className="mx-auto mb-2 inline-block clip-angled px-8 py-1.5 font-display text-xl font-black uppercase tracking-[0.34em] text-gold drop-shadow-[0_0_18px_color-mix(in_oklab,var(--gold)_60%,transparent)] xl:text-4xl"
            style={{ background: "linear-gradient(90deg, transparent, color-mix(in oklab, var(--gold) 14%, transparent), transparent)" }}>
            {tournament}
          </div>
        ) : null}
        <h2 className="font-display text-lg font-black uppercase tracking-[0.24em] text-foreground xl:text-3xl">
          {showWeight ? category : ""}
        </h2>
        <p className="font-display text-sm font-black uppercase tracking-[0.32em] text-gold xl:text-xl">
          {showStage ? stage : ""}
        </p>
        <h1 className="text-metal font-display text-5xl font-black italic uppercase tracking-tight xl:text-8xl">
          {t("match")} {matchId} {t("resultLabel")}
        </h1>
        <div className="mx-auto mt-1 h-px w-2/3 bg-gradient-to-r from-transparent via-gold to-transparent shadow-[0_0_18px_var(--gold)]" />
      </div>

      <div className="flex flex-col items-center">
        <div className="clip-angled panel-glass gold-sheen px-3 py-2 text-center">
          <div className="font-display text-xl font-black italic tracking-tight text-gold xl:text-3xl">
            WAB-TKD
          </div>
          <div className="font-display text-[0.5rem] font-bold uppercase tracking-[0.12em] text-foreground/70 xl:text-[0.6rem]">
            World Association of Budo - Taekwondo
          </div>
        </div>
      </div>
    </header>
  );
}
