import { useEffect, useState } from 'react';
import appIconUrl from '@/assets/app-icon.png';
import medalUrl from '@/assets/medal.png';
import trophyUrl from '@/assets/trophy-wab-tkd-transparent.png';
import { useI18n } from "@/lib/i18n";
import { normalizeWinnerAnimationDurationSeconds, shouldPlayWinnerIntro } from "@/lib/winner-animation-settings";
import FlagImage from "@/components/FlagImage";
import { ArenaBackground } from './ArenaBackground';
import { MatchResultScreen } from './MatchResultScreen';
import { ChampionshipMedal } from './ChampionshipMedal';
import { useBroadcastViewport } from '@/lib/broadcast-viewport';
import type { MatchData } from './types';
import type { MatchState, PlayerColor } from '@/types/tkd';
import koBlueUrl from '@/assets/ko/ko-blue.png';
import koRedUrl from '@/assets/ko/ko-red.png';

/**
 * Public winner animation adapter.
 *
 * Winner display adapter. It maps the single live MatchState into the existing
 * public Winner composition. No generated/replacement artwork or second UI layer
 * is introduced here.
 *
 * The public display gets one isolated 1920x1080 canvas through the shared
 * viewport engine. The operator/referee UI is never rendered inside this
 * layer, so the winner animation cannot overlap it.
 */
export function IndividualWinnerAnimation({ state, winner }: { state: MatchState; winner: PlayerColor }) {
  useBroadcastViewport(true);
  const { t, lang } = useI18n();

  const displayConfig = state.displayConfig;
  const enabled = displayConfig?.winnerAnimationEnabled !== false;
  const durationSeconds = normalizeWinnerAnimationDurationSeconds(displayConfig?.winnerAnimationDurationSeconds, 3);
  const durationMs = durationSeconds * 1000;
  const revealKey = `${state.id}-${state.matchNumber}-${winner}-${state.result?.method ?? 'x'}-${state.finishedAt ?? ''}`;
  const [phase, setPhase] = useState<'intro' | 'result'>(() => shouldPlayWinnerIntro(enabled, durationSeconds) ? 'intro' : 'result');

  useEffect(() => {
    setPhase(shouldPlayWinnerIntro(enabled, durationSeconds) ? 'intro' : 'result');
  }, [revealKey, enabled, durationMs]);

  useEffect(() => {
    if (phase !== 'intro') return;
    const timer = window.setTimeout(() => setPhase('result'), durationMs);
    return () => window.clearTimeout(timer);
  }, [phase, durationMs]);
  // The referee can skip the cinematic intro without changing the official result.
  // This is intentionally a window event so the public layer remains read-only.
  useEffect(() => {
    const skip = () => setPhase('result');
    window.addEventListener('wab-skip-winner-animation', skip);
    return () => window.removeEventListener('wab-skip-winner-animation', skip);
  }, []);
  const win = state[winner];

  if (!win?.player) return null;

  if (phase === 'intro') {
    const isBlueIntro = winner === 'chung';
    const introPhoto = displayConfig?.showPhoto === false ? "" : (win.player.photo || win.player.photoUrl);
    const introClubLogo = displayConfig?.showClub === false ? "" : (state.clubLogos?.[winner] || win.player.clubLogo || "");
    const introDuration = `${durationMs}ms`;
    return (
      <div
        key={`winner-intro-${revealKey}`}
        className="wab-broadcast-layer wab-winner-public-layer winner-reveal-cinematic"
        data-winner-side={isBlueIntro ? 'blue' : 'red'}
        style={{ ['--winner-intro-duration' as any]: introDuration }}
        dir={lang === "ar" ? "rtl" : "ltr"}
        aria-label={t("winnerAnnouncementLabel")}
      >
        <ArenaBackground />
        <div className="winner-reveal-vignette" />
        <div className="winner-reveal-rays" />
        <div className="winner-reveal-scanline" />
        <div className="winner-reveal-topbar">
          <div className="winner-reveal-brand">
            <img src={appIconUrl} alt="WAB-TKD" />
            <div><strong>WAB-TKD</strong><span>WORLD ADVANCED BATTLE TAEKWONDO</span></div>
          </div>
          <div className="winner-reveal-match">MATCH {state.matchNumber ?? '—'} <i>/</i> RESULT</div>
          <div className="winner-reveal-brand winner-reveal-brand-right"><div><strong>{t("publicDisplayOfficial")}</strong><span>{t("officialResultLabel")}</span></div><img src={appIconUrl} alt="" /></div>
        </div>
        <div className="winner-reveal-stage">
          <div className="winner-reveal-medal-art" aria-hidden="true">
            <img src={medalUrl} alt="" data-asset="wab-tkd-medal" />
          </div>
          {introPhoto && (
            <div className="winner-reveal-athlete">
              <img src={introPhoto} alt="" />
            </div>
          )}
          <div className="winner-reveal-copy">
            <div className="winner-reveal-kicker">{t("match")} {state.matchNumber ?? '—'} · {t("finalResultLabel")}</div>
            <div className="winner-reveal-crown" aria-hidden="true"><img src={trophyUrl} alt="" /></div>
            <div className="winner-reveal-title gold-sheen">{t("finalWinnerLabel")}</div>
            <div className="winner-reveal-side">{isBlueIntro ? t("winnerBlueLabel") : t("winnerRedLabel")}</div>
            <div className="winner-reveal-name">{win.player.name}</div>
            <div className="winner-reveal-identity">
              {displayConfig?.showFlag !== false && <FlagImage code={win.player.nationality || ""} size={54} className="winner-reveal-flag" />}
              <span>{win.player.nationality || "—"}</span>
              {displayConfig?.showClub !== false && <><b>•</b><span>{win.player.club || "—"}</span></>}
              {introClubLogo && <img className="winner-reveal-club-logo" src={introClubLogo} alt="" />}
            </div>
          </div>
        </div>
        <div className="winner-reveal-footer">
          <span>{state.competitionName || 'WAB-TKD CHAMPIONSHIP'}</span>
          {displayConfig?.showWeight !== false && <span>{state.weightCategory || win.player.category || "—"}</span>}
          {displayConfig?.showStage !== false && <span>{state.matchStage || t("match")}</span>}
        </div>
      </div>
    );
  }

  const rounds = (state.roundWinners || [])
    .slice()
    .sort((a, b) => a.round - b.round)
    .map((r) => ({
      round: r.round,
      winner: r.winner === 'chung' ? 'blue' : r.winner === 'hong' ? 'red' : 'draw',
      blue: r.chungScore,
      red: r.hongScore,
      warnings: 0,
      method: r.method,
      decisionType: (r as any).decisionType,
      decisionLabel: (r as any).decisionLabel || (r.decisionType === 'WOOSE_GIROK' ? 'Woo-Se-Girok decision' : r.decisionType === 'AI_RECOMMENDATION' ? 'AI tie-break decision' : undefined),
      tiebreakDetails: (r as any).tiebreakDetails,
    }));

  const events = state.events || [];
  const headHits = { blue: 0, red: 0 };
  const bodyHits = { blue: 0, red: 0 };
  const totalHits = { blue: 0, red: 0 };
  let warnings = 0;

  for (const e of events) {
    const side = e.player === 'chung' ? 'blue' : 'red';
    if (e.type === 'head_kick' || e.type === 'turning_head') headHits[side]++;
    if (e.type === 'trunk_kick' || e.type === 'turning_kick' || e.type === 'punch') bodyHits[side]++;
    if (['punch', 'trunk_kick', 'head_kick', 'turning_kick', 'turning_head'].includes(e.type)) totalHits[side]++;
    if (e.type === 'warning') warnings += e.warningCount || 1;
  }

  const isBlue = winner === 'chung';
  const resultMethod = state.result?.method || '—';
  const methodLabels: Record<string, string> = {
    KO: 'KNOCKOUT',
    WDR: 'WALKOVER / WITHDRAWAL',
    PTF: 'POINTS / DECISION',
    PTG: 'POINT GAP',
    RSC: 'REFEREE STOP CONTEST',
    DSQ: 'DISQUALIFICATION',
    SUP: 'SUPERIORITY',
    PUN: 'PUNITIVE DECLARATION',
    DQB: 'DISQUALIFICATION — UNSPORTSMANLIKE BEHAVIOR',
  };
  const methodLabel = methodLabels[resultMethod] || resultMethod;
  const decisiveRound = [...(state.roundWinners || [])].reverse().find((r) => r.winner === winner)?.round;
  const resultRound = resultMethod === 'KO' ? state.currentRound : decisiveRound;
  const decisiveRoundRecord = resultRound != null
    ? (state.roundWinners || []).find((r) => r.round === resultRound)
    : undefined;
  // A SUP result in the extra/final golden round is specifically a Golden Point
  // victory. Keep the official method as SUP for persistence, but expose the
  // golden-round fact to the public winner animation so it can be shown clearly.
  const goldenPointWin = (resultMethod === 'GDP' || resultMethod === 'SUP') && (
    !!state.isGoldenRound ||
    (resultRound != null && resultRound > (state.config.rounds || 3)) ||
    (decisiveRoundRecord?.method === 'score' && resultRound != null && resultRound > (state.config.rounds || 3))
  );
  const tieDecisions = (state.roundWinners || []).filter(
    (r) => r.decisionType || r.method === 'draw' || r.method === 'gamjeom',
  );

  const match: MatchData = {
    // Winner data is read only from the live MatchState. There is no separate
    // broadcast-data override, so Public always mirrors the operator state.
    matchId: String(state.matchNumber ?? '—'),
    category: state.weightCategory || win.player.category || '—',
    tournament: state.competitionName || '—',
    stage: state.matchStage || 'MATCH',
    date: state.eventDate || (state.finishedAt || state.startedAt ? new Date(state.finishedAt || state.startedAt!).toLocaleDateString() : '—'),
    time: state.finishedAt || state.startedAt
      ? new Date(state.finishedAt || state.startedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—',
    ring: state.matNumber ?? '—',
    winner: {
      name: win.player.name,
      country: win.player.nationality || '—',
      flag: win.player.nationality || '',
      club: win.player.club || '—',
      corner: isBlue ? 'blue' : 'red',
      number: win.player.playerNumber != null ? String(win.player.playerNumber) : undefined,
    },
    score: { blue: state.chung.totalScore, red: state.hong.totalScore },
    rounds,
    stats: {
      headHits: headHits.blue + headHits.red,
      bodyHits: bodyHits.blue + bodyHits.red,
      totalHits,
      warnings,
      warningLimitPerRound: 5,
    },
    display: displayConfig,
    resultMethod,
    decisiveRound,
    resultRound,
    resultStatus: 'FINISHED',
    refereeConfirmed: !!state.resultConfirmed,
    goldenPointWin,
    goldenRound: goldenPointWin ? resultRound : undefined,
  };

  // Keep this as the ONLY public result layer. All artwork remains local to the
  // project; live player/tournament data comes from the same MatchState.
  return (
    <div
      key={`winner-${state.id}-${state.matchNumber}-${winner}-${resultMethod}-${resultRound ?? 'x'}`}
      className="wab-broadcast-layer wab-winner-public-layer"
      data-winner-side={isBlue ? 'blue' : 'red'}
      data-result-method={resultMethod}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <MatchResultScreen match={match} playerPhoto={win.player.photo || win.player.photoUrl} />
      {/* The source animation exposes these assets for KO result context; the
          MatchResultScreen remains visually authoritative. Keep preloading
          local files here so a KO reveal never waits on an external request. */}
      <img src={isBlue ? koBlueUrl : koRedUrl} alt="" aria-hidden="true" className="wab-winner-preload" />
      <img src={trophyUrl} alt="" aria-hidden="true" className="wab-winner-preload" />
      {tieDecisions.length > 0 && (
        <span className="sr-only">
          {tieDecisions.map((r) => `Round ${r.round}: ${(r as any).decisionLabel || r.decisionType || r.method}`).join(' · ')}
          {` · ${methodLabel}${goldenPointWin ? ' · GOLDEN POINT' : ''} · ${winner === 'chung' ? 'BLUE' : 'RED'} · ROUND ${resultRound ?? '—'}`}
        </span>
      )}
    </div>
  );
}
