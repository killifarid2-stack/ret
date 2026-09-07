import { ChampionshipMedal } from "./ChampionshipMedal";
import { ArenaBackground } from "./ArenaBackground";
import { MatchHeader } from "./MatchHeader";
import { WinnerBanner } from "./WinnerBanner";
import { CompetitorCard } from "./CompetitorCard";
import { RoundResultCard } from "./RoundResultCard";
import { MatchInfo } from "./MatchInfo";
import { MatchStatistics } from "./MatchStatistics";
import { TournamentBranding } from "./TournamentBranding";
import type { MatchData } from "./types";
import { useI18n } from "@/lib/i18n";
import koBlue from "@/assets/ko/ko-blue.png";
import koRed from "@/assets/ko/ko-red.png";

function InfoTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="clip-angled panel-glass px-3 py-2 text-center">
      <div className="font-display text-[0.58rem] font-bold uppercase tracking-[0.22em] text-gold xl:text-[0.7rem]">{label}</div>
      <div className="mt-0.5 font-display text-sm font-black uppercase tracking-wide text-foreground xl:text-xl">{value}</div>
    </div>
  );
}

/**
 * Full-bleed public result composition.
 * The 16:9 design is scaled to the actual public window; 1280x720 is therefore
 * a true edge-to-edge broadcast frame with no letterbox gaps.
 */
const DESIGN_W = 1920;
const DESIGN_H = 1080;

export function MatchResultScreen({ match, playerPhoto }: { match: MatchData; playerPhoto?: string }) {
  const { t, lang } = useI18n();
  const corner = match.winner.corner;
  const tournament = match.tournament || "WAB-TKD CHAMPIONSHIP";
  const category = match.category || "—";
  const method = (match.resultMethod || "PTF").toUpperCase();
  const resultRound = match.resultRound || match.decisiveRound || match.rounds.length || 1;
  const isKo = method === 'KO';
  const isGoldenPoint = !!match.goldenPointWin;
  // Strict asset rule: only the real player asset passed by MatchState is used.
  // Never substitute a placeholder, generated image, or generic player artwork.
  const winnerPhoto = match.display?.showPhoto === false ? undefined : playerPhoto;
  const showFlag = match.display?.showFlag !== false;
  const showClub = match.display?.showClub !== false;
  const showStage = match.display?.showStage !== false;
  const showWeight = match.display?.showWeight !== false;
  const roundWins = match.rounds.reduce((acc, r) => {
    if (r.winner === 'blue' || (!r.winner && r.blue > r.red)) acc.blue += 1;
    else if (r.winner === 'red' || (!r.winner && r.red > r.blue)) acc.red += 1;
    return acc;
  }, { blue: 0, red: 0 });
  const hasWooDecision = match.rounds.some((r:any) => String(r.decisionType || '').toUpperCase() === 'WOOSE_GIROK' || String(r.decisionLabel || '').toUpperCase().includes('WOO-SE-GIROK'));
  const hasAiDecision = match.rounds.some((r:any) => String(r.decisionType || '').toUpperCase().includes('AI'));
  const finalDecisionLabel = method === 'PTG' ? 'ENDED BY POINT GAP' : hasWooDecision ? 'ENDED BY WOO-SE-GIROK DECISION' : hasAiDecision ? 'ENDED BY AI-ASSISTED DECISION' : (method === 'SUP' || method === 'PTF') ? 'ENDED BY DECISION' : method;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black" dir={lang === "ar" ? "rtl" : "ltr"}>
      <ArenaBackground />

      <div
        className="absolute left-1/2 top-1/2 origin-center"
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: "translate(-50%, -50%) scale(var(--wab-broadcast-fit-scale, 1))",
          background: "radial-gradient(circle at 50% 38%, oklch(0.17 0.035 265 / .52), transparent 58%), oklch(0.055 0.018 265)",
        }}
      >
        <div className="flex h-full w-full flex-col gap-4 px-7 py-5">
          {/* Tournament is deliberately above category and match title. */}
          <MatchHeader tournament={tournament} category={category} stage={match.stage} matchId={match.matchId} showStage={showStage} showWeight={showWeight} />

          <div className="grid min-h-0 flex-1 grid-cols-[500px_minmax(0,1fr)_300px] gap-5">
            {/* Champion portrait + medal lane. The medal is visually above the round cards, never over them. */}
            <section className="relative min-h-0 overflow-visible">
              <div className="relative h-full overflow-visible">
                <div className="clip-angled panel-glass absolute inset-0 overflow-hidden" style={{ boxShadow: "inset 0 0 0 2px color-mix(in oklab,var(--gold) 78%,transparent), inset 0 0 70px color-mix(in oklab,var(--teamblue-bright) 25%,transparent), 0 0 45px color-mix(in oklab,var(--gold) 20%,transparent)" }}>
                  {winnerPhoto ? (
                    <img src={winnerPhoto} alt={match.winner.name} className="absolute inset-0 h-full w-full object-cover object-top" />
                  ) : (
                    <div className="absolute inset-0 bg-black/20" aria-label="Winner photo asset unavailable" />
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,oklch(.04_.02_265/.18)_58%,oklch(.04_.02_265/.98)_100%)]" />
                  <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-20 text-center">
                    <div className="font-display text-sm font-black uppercase tracking-[.42em] text-gold">{t("championLabel")}</div>
                    <div className="text-metal mt-1 font-display text-5xl font-black italic uppercase leading-none">{match.winner.name}</div>
                    <div className="mt-2 font-display text-sm uppercase tracking-[.25em] text-white/75">{match.winner.country}{showClub ? ` · ${match.winner.club}` : ""}</div>
                  </div>
                  <div className="pointer-events-none absolute inset-0 clip-angled" style={{ boxShadow: "inset 0 0 0 3px color-mix(in oklab,var(--gold) 75%,transparent), inset 0 0 30px color-mix(in oklab,var(--gold-bright) 18%,transparent)" }} />
                </div>

                <div className="pointer-events-none absolute -right-20 -top-16 z-30 h-[330px] w-[250px] overflow-visible">
                  <ChampionshipMedal width={250} className="animate-medal-hang" />
                </div>
              </div>
            </section>

            {/* Main winner area */}
            <section className="flex min-h-0 flex-col gap-3">
              <div className="clip-angled panel-glass shrink-0 px-5 py-4" style={{ boxShadow: "inset 0 0 0 2px color-mix(in oklab,var(--gold) 72%,transparent), 0 0 45px color-mix(in oklab,var(--gold) 18%,transparent)" }}>
                <div className="text-center font-display text-sm font-black uppercase tracking-[.38em] text-gold">{t("match")} {match.matchId} · {t("finalResultLabel")}</div>
                <div className="mt-3"><WinnerBanner score={match.score} winnerCorner={corner} /></div>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border-2 border-[hsl(var(--gold))]/40 bg-black/30 px-4 py-3">
                  <div className="text-center"><div className="text-[9px] font-black tracking-[.2em] text-teamblue-bright">BLUE ROUND WINS</div><div className="font-display text-3xl font-black text-teamblue-bright">{roundWins.blue}</div></div>
                  <div className="text-center"><div className="text-[8px] font-black tracking-[.25em] text-white/40">ROUND SCORE</div><div className="font-display text-2xl font-black text-white">{roundWins.blue} — {roundWins.red}</div></div>
                  <div className="text-center"><div className="text-[9px] font-black tracking-[.2em] text-teamred-bright">RED ROUND WINS</div><div className="font-display text-3xl font-black text-teamred-bright">{roundWins.red}</div></div>
                </div>
                <div className={`mt-2 rounded-xl border-2 px-4 py-2.5 text-center ${method === 'PTG' ? 'border-yellow-300/65 bg-yellow-400/10 shadow-[0_0_28px_rgba(250,204,21,.16)]' : method === 'SUP' || method === 'PTF' ? 'border-cyan-300/45 bg-cyan-400/10' : 'border-white/15 bg-black/20'}`}>
                  <div className="font-display text-[9px] font-black tracking-[.28em] text-white/45">MATCH END REASON</div>
                  <div className="mt-1 font-display text-lg font-black tracking-[.12em] text-white">{finalDecisionLabel}</div>
                </div>
              </div>

              <CompetitorCard competitor={match.winner} showFlag={showFlag} showClub={showClub} />

              <div className={`clip-angled shrink-0 px-4 py-2 text-center border ${isGoldenPoint ? 'border-yellow-300/80 bg-yellow-400/10 shadow-[0_0_42px_rgba(250,204,21,.30)]' : isKo ? 'border-red-400/60 bg-red-500/10 shadow-[0_0_32px_rgba(248,113,113,.22)]' : 'border-[hsl(var(--gold))]/30 bg-black/20'}`} data-result-method={method} data-golden-point={isGoldenPoint ? 'true' : 'false'}>
                <div className="text-[9px] font-black uppercase tracking-[.24em] text-white/45">{t("matchEndResultConfirmed")}</div>
                <div className="mt-1 flex items-center justify-center gap-3">
                  {isKo && <img src={match.winner.corner === 'blue' ? koBlue : koRed} alt="KO" className="h-14 w-28 object-contain" />}
                  <span className={`font-display text-2xl font-black uppercase tracking-[.18em] ${isGoldenPoint ? 'text-yellow-200' : isKo ? 'text-red-300' : 'text-[hsl(var(--gold))]'}`}>{isGoldenPoint ? t('goldenPointLabel') : method}</span>
                  <span className="text-sm font-black text-white/75">{t("round")} {resultRound}</span>
                </div>
                {isGoldenPoint && (
                  <div className="mt-1 font-display text-[11px] font-black uppercase tracking-[.34em] text-yellow-100/90">{t("goldenRoundSuddenDeath")}</div>
                )}
              </div>

              <div className="clip-angled panel-glass shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2" data-result-method={method}>
                <div className="font-display text-xs font-black uppercase tracking-[.2em] text-gold">{t("resultMethodLabel")}</div>
                {isKo ? <img src={match.winner.corner === 'blue' ? koBlue : koRed} alt="KO" className="h-12 w-24 object-contain" /> : <div className={`text-center font-display text-sm font-black uppercase ${isGoldenPoint ? 'text-yellow-200' : 'text-gold'}`}>{isGoldenPoint ? t('goldenPointLabel') : method}</div>}
                <div className="text-right font-display text-xs font-black uppercase tracking-[.16em] text-foreground/80">{isGoldenPoint ? `${t("goldenRoundLabel")} ${resultRound}` : `${t("round")} ${resultRound}`}</div>
              </div>

              {/* Round frames: larger, true rectangular cards with a visible breathing gap.
                  Fixed height prevents flex stretching while giving each round its full visual weight. */}
              <div className="grid shrink-0 grid-cols-3 gap-8 min-h-[340px] h-[340px]">
                {match.rounds.slice(0, 3).map((r, i) => (
                  <RoundResultCard key={r.round} result={r} perspective={corner} index={i} decisive={i === Math.min(match.rounds.length - 1, 2)} />
                ))}
              </div>

              <div className="grid grid-cols-5 gap-3">
                {showWeight && <InfoTile label={t("categoryLabel")} value={category} />}
                {showStage && <InfoTile label={t("stageLabel")} value={match.stage} />}
                <InfoTile label={t("dateLabel")} value={match.date} />
                <InfoTile label={t("matLabel")} value={match.ring} />
                <InfoTile label={t("methodLabel")} value={match.resultMethod || "PTF"} />
              </div>
            </section>

            {/* Match information stays isolated in its own frame. */}
            <section className="min-h-0">
              <MatchInfo matchId={match.matchId} date={match.date} time={match.time} ring={match.ring} rounds={match.rounds} totalWarnings={match.stats.warnings} warningLimitPerRound={match.stats.warningLimitPerRound ?? 5} />
            </section>
          </div>

          <MatchStatistics stats={match.stats} corner={corner} rounds={match.rounds} />
          <TournamentBranding />
        </div>
      </div>
    </main>
  );
}
