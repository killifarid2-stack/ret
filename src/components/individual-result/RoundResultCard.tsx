import { MedalDisc } from "./MedalImage";
import type { RoundResult, Corner } from "./types";
import { useI18n } from "@/lib/i18n";

interface RoundResultCardProps {
  result: RoundResult;
  perspective: Corner;
  index?: number;
  decisive?: boolean;
}

export function RoundResultCard({
  result,
  perspective,
  index = 0,
  decisive = false,
}: RoundResultCardProps) {
  const { t } = useI18n();
  const roundWinner: Corner | "draw" = result.winner || (result.blue === result.red ? "draw" : result.blue > result.red ? "blue" : "red");
  const own = perspective === "blue" ? result.blue : result.red;
  const opp = perspective === "blue" ? result.red : result.blue;
  const won = own > opp;
  const method = result.method || (own > opp ? "score" : own < opp ? "loss" : "draw");
  const methodLabel = method === 'score' ? 'POINT GAP' : method === 'gamjeom' ? 'GAM-JEOM ADVANTAGE' : method === 'superiority' ? 'JUDGES DECISION' : method === 'draw' ? 'DRAW' : String(method).toUpperCase();
  const decision = result.decisionLabel || result.decisionType;

  const isBlue = roundWinner === "blue";
  const isDraw = roundWinner === "draw";
  const accent = isBlue ? "var(--teamblue-bright)" : isDraw ? "var(--gold)" : "var(--teamred-bright)";
  const accentDeep = isBlue ? "var(--teamblue-deep)" : isDraw ? "var(--gold)" : "var(--teamred-deep)";
  const intensity = decisive ? 1.35 : 1;

  const winScoreClass = isDraw ? "text-foreground" : isBlue ? "text-teamblue-bright" : "text-teamred-bright";
  const loseScoreClass = "text-foreground/45";

  return (
    <div
      className="clip-angled animate-rise-in relative overflow-hidden px-4 py-4 text-center xl:px-6 xl:py-5"
      style={{
        animationDelay: `${300 + index * 130}ms`,
        background: `linear-gradient(160deg, color-mix(in oklab, ${accentDeep} 55%, oklch(0.12 0.03 265)) , oklch(0.1 0.025 265 / 0.95))`,
        border: `1px solid color-mix(in oklab, ${accent} ${Math.round(60 * intensity)}%, transparent)`,
        boxShadow: `0 0 ${Math.round(26 * intensity)}px color-mix(in oklab, ${accent} ${Math.round(38 * intensity)}%, transparent), inset 0 0 ${Math.round(30 * intensity)}px color-mix(in oklab, ${accent} ${Math.round(18 * intensity)}%, transparent)`,
      }}
    >
      {/* neon inner edge */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${accent} 35%, transparent)`,
        }}
      />
      {/* metallic sheen / energy flowing around the border */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="animate-energy-flow absolute inset-y-0 w-1/2"
          style={{
            background: `linear-gradient(100deg, transparent, color-mix(in oklab, ${accent} 30%, transparent), transparent)`,
          }}
        />
      </div>
      {/* light streaks */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background: `repeating-linear-gradient(118deg, color-mix(in oklab, ${accent} 30%, transparent) 0 1px, transparent 1px 18px)`,
        }}
      />
      {/* energy particles */}
      <div className="pointer-events-none absolute inset-0">
        {[14, 38, 62, 86].map((left, i) => (
          <span
            key={left}
            className="animate-spark-rise absolute bottom-2 h-[3px] w-[3px] rounded-full"
            style={{
              left: `${left}%`,
              background: accent,
              boxShadow: `0 0 8px ${accent}`,
              animationDelay: `${i * 0.7}s`,
            }}
          />
        ))}
      </div>

      <div className="relative">
        <div className="font-display text-xs font-bold uppercase tracking-[0.22em] text-foreground/85 xl:text-xl">
          {t("round")} {result.round}{isDraw ? " · " + t("drawLabel") : ""}
        </div>
        <div
          className="mt-1 h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent, color-mix(in oklab, ${accent} 80%, transparent), transparent)`,
          }}
        />

        <div className="mt-1 flex items-end justify-start gap-3">
          <span
            className="font-display text-sm font-black uppercase tracking-[0.1em] xl:text-2xl"
            style={{
              color: accent,
              textShadow: `0 0 14px color-mix(in oklab, ${accent} 65%, transparent)`,
            }}
          >
            {isDraw ? t("drawLabel") : t("winnerLabel")}
          </span>
          <MedalDisc
            size={decisive ? 96 : 86}
            material={won ? "gold" : "silver"}
            aura={accent}
            alt={`${t("round")} ${result.round} ${won ? t("gold") : t("silver")} medal`}
            className="animate-glow-pulse"
          />
        </div>

        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="rounded-md border border-white/15 bg-black/25 px-2 py-1 text-[9px] font-black tracking-[.16em] text-white/75">{decision || methodLabel}</span>
          {decision === 'AI_RECOMMENDATION' && <span className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2 py-1 text-[9px] font-black tracking-[.12em] text-cyan-200">AI</span>}
          {decision === 'WOOSE_GIROK' && <span className="rounded-md border border-[hsl(var(--gold)/.5)] bg-[hsl(var(--gold)/.08)] px-2 py-1 text-[9px] font-black tracking-[.12em] text-[hsl(var(--gold))]">WOO-SE-GIROK</span>}
        </div>

        {(isDraw || decision) && (
          <div className={`mt-2 rounded-lg border px-2.5 py-2 text-[8px] ${isDraw ? 'border-[hsl(var(--gold))]/35 bg-[hsl(var(--gold))]/[.05]' : 'border-white/10 bg-black/20'}`}>
            <div className="flex items-center justify-between gap-2 font-black uppercase tracking-[.12em]">
              <span className="text-[hsl(var(--gold))]">{t("roundDecisionLabel")}</span>
              <span className={isBlue ? 'text-teamblue-bright' : isDraw ? 'text-[hsl(var(--gold))]' : 'text-teamred-bright'}>{isDraw ? t("drawTieReviewLabel") : `${isBlue ? t("blue") : t("red")} ${t("winLabel")}`}</span>
            </div>
            <div className="mt-1 text-white/60">{t("methodLabel")}: <b className="text-white/80">{decision || methodLabel}</b></div>
            {result.tiebreakDetails?.winningCriterion && <div className="mt-1 truncate text-white/50">{t("reasonLabel")}: {result.tiebreakDetails.winningCriterion}</div>}
            {result.tiebreakDetails?.reason && <div className="mt-1 truncate text-white/50">{result.tiebreakDetails.reason}</div>}
          </div>
        )}

        {result.tiebreakDetails && (
          <div className="mt-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-[8px] text-white/55">
            <div className="flex items-center justify-center gap-2 font-black tracking-[.12em]">
              <span className="text-cyan-200">AI {result.tiebreakDetails.aiWinner || 'REVIEW'}</span>
              {result.tiebreakDetails.aiConfidence != null && <span>CONF {result.tiebreakDetails.aiConfidence}%</span>}
            </div>
            {result.tiebreakDetails.aiScore && (
              <div className="mt-0.5 font-mono text-white/70">BLUE {result.tiebreakDetails.aiScore.blue ?? '—'} — RED {result.tiebreakDetails.aiScore.red ?? '—'}</div>
            )}
            {result.tiebreakDetails.winningCriterion && <div className="mt-0.5 truncate">{result.tiebreakDetails.winningCriterion}</div>}
          </div>
        )}

        <div className="mt-1 flex items-baseline justify-center gap-2 font-display font-black italic">
          <span
            className={`${isBlue ? winScoreClass : loseScoreClass} ${isBlue ? "text-4xl xl:text-6xl" : "text-2xl xl:text-4xl"}`}
            style={
              isBlue
                ? { textShadow: "0 0 20px color-mix(in oklab, var(--teamblue-bright) 70%, transparent)" }
                : undefined
            }
          >
            {result.blue}
          </span>
          <span className="text-xl text-foreground/45 xl:text-3xl">-</span>
          <span
            className={`${!isBlue ? winScoreClass : loseScoreClass} ${!isBlue ? "text-4xl xl:text-6xl" : "text-2xl xl:text-4xl"}`}
            style={
              !isBlue
                ? { textShadow: "0 0 20px color-mix(in oklab, var(--teamred-bright) 70%, transparent)" }
                : undefined
            }
          >
            {result.red}
          </span>
        </div>
        <span className="sr-only">
          {won ? "Won" : "Lost"} by the featured competitor
        </span>
      </div>
    </div>
  );
}
