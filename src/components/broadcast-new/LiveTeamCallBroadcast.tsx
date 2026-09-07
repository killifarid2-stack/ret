import { useEffect, useMemo } from 'react';
import type { MatchState as AppMatchState, PlayerColor } from '@/types/tkd';
import { isPublicDisplayWindow } from '@/context/MatchContext';
import { ArenaBackground } from './ArenaBackground';
import { TeamPanel } from './TeamPanel';
import { CenterMatch } from './CenterMatch';
import type { Team, MatchState as VisualState } from '@/data/match-broadcast-new';
import { ANIMATION_ASSETS } from '@/assets/animations';
import '@/styles/broadcast-new.css';

/**
 * Adapter only — ArenaBackground / TeamPanel / CenterMatch / PlayerName and
 * broadcast-new.css are the uploaded files completely unchanged (only the
 * two broken Lovable asset.json image pointers were swapped for the
 * project's own copies of the same two images, which is a technical
 * necessity, not a design change — everything else, including every class
 * name, layout, and transition, is byte-for-byte what was uploaded).
 * This file's only job is turning live match state into the exact `Team` /
 * `MatchState` shapes those components already expect, so player and team
 * info are real while every animation, timing and button stays exactly as
 * designed.
 */

function buildTeam(state: AppMatchState, side: PlayerColor): Team {
  const p = state[side].player;
  const roster = state.teamRoster?.[side] || [];
  const teamCountry = state.teamCountry?.[side] || p.nationality || '';
  const players = roster.length
    ? roster.map((r, i) => ({
        name: r.name,
        category: state.division || state.weightCategory || p.category || '',
        weight: state.weightCategory || p.category || '',
        ageGroup: state.ageGroup || '',
        gender: state.gender || '',
        nationality: r.nationality || teamCountry,
        countryCode: r.nationality || teamCountry,
        rank: r.seedNumber ? String(r.seedNumber) : '—',
        seed: r.seedNumber ? `SEED ${r.seedNumber}` : `SEED ${i + 1}`,
        playerNumber: r.playerNumber,
        photo: r.photo,
      }))
    : p?.name
      ? [{
          name: p.name,
          category: state.division || state.weightCategory || p.category || '',
          weight: state.weightCategory || p.category || '',
          ageGroup: state.ageGroup || '',
          gender: state.gender || '',
          nationality: p.nationality || teamCountry,
          countryCode: p.nationality || teamCountry,
          rank: 'A',
          seed: p.seedNumber ? `SEED ${p.seedNumber}` : 'SEED 1',
          playerNumber: p.playerNumber,
          photo: p.photoUrl || p.photo,
        }]
      : [];

  const defaultBadge = side === 'chung' ? ANIMATION_ASSETS.exactBlueClub : ANIMATION_ASSETS.exactRedClub;
  return {
    name: state.teamNames?.[side] || (side === 'hong' ? 'HONG' : 'CHUNG'),
    club: state.clubNames?.[side] || p.club || (side === 'hong' ? 'HONG CLUB' : 'CHUNG CLUB'),
    cornerClub: side === 'hong' ? 'HONG / RED CORNER' : 'CHUNG / BLUE CORNER',
    country: teamCountry,
    flag: teamCountry,
    countryCode: teamCountry,
    coach: state.coachNames?.[side] || '',
    rank: '—',
    points: String(state[side].totalScore ?? 0),
    tone: side === 'hong' ? 'red' : 'blue',
    // IMPORTANT: the upper identity is the TEAM logo, while the lower banner
    // is the CLUB logo. Each gets its OWN default badge — neither ever
    // falls back to the other's value, or the two would render as visible
    // duplicates whenever only one of the two was actually configured.
    teamLogo: state.teamLogos?.[side] || defaultBadge,
    clubLogo: state.clubLogos?.[side] || defaultBadge,
    crest: state.teamLogos?.[side] || defaultBadge,
    players,
  };
}

function mapVisualState(state: AppMatchState): VisualState {
  const chung = state.teamCallStatus?.chung ?? 'idle';
  const hong = state.teamCallStatus?.hong ?? 'idle';
  const stage = state.autoCallSequence?.stage;
  if (chung === 'called' && hong === 'called') {
    // Both corners confirmed. Still on the GREETING stop (or the sequence
    // isn't running at all, e.g. a manual call) -> "confirm"; anything past
    // that -> "ready" for Shijak.
    if (state.autoCallSequence?.stage === 'DONE') return 'ready';
    if (!state.autoCallSequence?.active || stage === 'GREETING') return 'confirm';
    return 'ready';
  }
  if (state.callAnimation?.phase === 'team' && state.callAnimation.side === 'hong') return 'red';
  if (state.callAnimation?.phase === 'team' && state.callAnimation.side === 'chung') return 'blue';
  if (chung === 'called' && hong !== 'called') return 'red';
  if (hong === 'called' && chung !== 'called') return 'blue';
  return 'waiting';
}

type Props = { state: AppMatchState; dispatch: React.Dispatch<any>; isMiniPreview?: boolean };

export default function LiveTeamCallBroadcast({ state, dispatch, isMiniPreview = false }: Props) {
  useEffect(() => {
    if (isMiniPreview || typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;
    root.classList.add('team-call-fullscreen-active');
    body.classList.add('team-call-fullscreen-active');
    return () => {
      root.classList.remove('team-call-fullscreen-active');
      body.classList.remove('team-call-fullscreen-active');
    };
  }, [isMiniPreview]);

  const teamsLive = useMemo(() => ({
    red: buildTeam(state, 'hong'),
    blue: buildTeam(state, 'chung'),
  }), [state]);

  const visual = mapVisualState(state);
  const round = state.currentRound || 1;
  // "الأزرار تصبح عند حكم الريسي" — CONFIRM / START MATCH stay wired to the
  // real match actions ONLY when this renders inside the Operator app
  // itself. The public broadcast screen and the operator's own iframe
  // preview both load this exact same component through the '/scoreboard'
  // route (isPublicDisplayWindow() is true for both), so on either of
  // those the buttons stay visually identical — same design, same
  // labels — but do nothing when clicked. The real control now lives
  // only in MainRefereeCallPanel's Team Call section on the Operator
  // screen, which already dispatches the same actions.
  const isPublic = isPublicDisplayWindow();
  const onConfirm = isPublic ? () => {} : () => {
    // READY is a hard hand-off: keep the current call frame visible for the
    // configured hold time (readyHoldSeconds, default 3s), then switch the
    // public display to the live match.
    dispatch({ type: 'COMPLETE_GREETING_WAIT' });
    const holdMs = (state.callDisplayConfig?.readyHoldSeconds ?? 3) * 1000;
    window.setTimeout(() => {
      dispatch({ type: 'GO_LIVE_BROADCAST' });
      dispatch({ type: 'SET_CALL_SCREEN', active: false });
    }, holdMs);
  };
  const onStartMatch = isPublic ? () => {} : () => dispatch({ type: 'SET_CALL_SCREEN', active: false });



  return (
    <div className={`team-call-fullscreen-shell${isMiniPreview ? " team-call-mini-preview" : ""}`} data-team-call-animation="true">
      <ArenaBackground />
      <main className="broadcast broadcast-animation-fullscreen" data-broadcast-animation="true">
        <div className="dashboard">
          <TeamPanel team={teamsLive.red} state={visual} nameFormat={state.callDisplayConfig?.nameFormat === 'initial' ? 'initial' : state.callDisplayConfig?.nameFormat === 'stacked' ? 'stacked' : state.callDisplayConfig?.nameFormat === 'large-initial' ? 'large-initial' : 'full'} />
          <CenterMatch
            state={visual}
            round={round}
            onSelectRound={() => {}}
            onConfirm={onConfirm}
            onStartMatch={onStartMatch}
            matchNumber={state.matchNumber}
            matchClock={state.config.roundTime}
            totalRounds={state.config.rounds}
          />
          <TeamPanel team={teamsLive.blue} state={visual} nameFormat={state.callDisplayConfig?.nameFormat === 'initial' ? 'initial' : state.callDisplayConfig?.nameFormat === 'stacked' ? 'stacked' : state.callDisplayConfig?.nameFormat === 'large-initial' ? 'large-initial' : 'full'} />
        </div>
      </main>
    </div>
  );
}
