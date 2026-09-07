import React, { createContext, useContext, useReducer, useRef, useEffect } from 'react';
import { 
  MatchState, MatchConfig, PlayerColor, ScoreType, ScoreEvent,
  Judge, ScoreApprovalRequest, IVRRequest, DEFAULT_CONFIG, RoundWinner, MatchStage,
  DisplayConfig, CallAnimation, CallDisplayConfig, LeagueStandingEntry, SCORE_VALUES,
  CallPlayerSelection, BroadcastAnimationController, AutoCallSequenceStage
} from '@/types/tkd';
import { 
  createInitialMatchState, addScore, removeLastScore, endRound, startNextRound, resolveDrawRound,
  getRotationEntryForRound, computeMvp
} from '@/lib/match-engine';
import {
  saveSessionSnapshot, clearSessionSnapshot, loadRecoverableSession, SessionSnapshot,
} from '@/lib/session-recovery';
import {
  saveParEquipeMatch, markParEquipeMatchCompleted, isParEquipeMatch, saveParEquipeSafeSnapshot,
} from '@/lib/par-equipe-save';
import { pushMatHeartbeat } from '@/lib/mat-status';

type MatchAction =
  | { type: 'INIT_MATCH'; config?: Partial<MatchConfig> }
  // Live rule tweak that doesn't reset the match in progress — currently
  // only used for the judge-score auto-approve toggle, but written
  // generically over Partial<MatchConfig> in case future live-toggleable
  // settings are added.
  | { type: 'UPDATE_CONFIG'; config: Partial<MatchConfig> }
  | { type: 'SET_PLAYER'; color: PlayerColor; name: string; nationality: string; club?: string; seedNumber?: number; playerNumber?: number; photoUrl?: string }
  | { type: 'SET_MATCH_INFO'; competitionName?: string; matchNumber?: number; weightCategory?: string; ageGroup?: string; gender?: 'male' | 'female'; matchStage?: MatchStage; matNumber?: number; tournamentId?: string; bracketMatchId?: string; teamNames?: { chung: string; hong: string }; clubNames?: { chung?: string; hong?: string }; teamLogos?: { chung?: string; hong?: string }; clubLogos?: { chung?: string; hong?: string }; teamCountry?: { chung?: string; hong?: string }; eventLocation?: string; eventDate?: string; division?: string; coachNames?: { chung?: string; hong?: string } }
  | { type: 'START' }
  | { type: 'START_ROUND_INTRO'; next: 'START' | 'NEXT_ROUND' }
  | { type: 'FINISH_ROUND_INTRO' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'TICK' }
  | { type: 'ADD_SCORE'; player: PlayerColor; scoreType: ScoreType; addedBy?: ScoreEvent['addedBy']; judgeId?: string }
  | { type: 'REMOVE_SCORE'; player: PlayerColor }
  | { type: 'END_ROUND' }
  | { type: 'START_ROUND_CORRECTION'; targetRound: number }
  | { type: 'CORRECTION_ADD_SCORE'; targetRound: number; player: PlayerColor; scoreType: ScoreType }
  | { type: 'CORRECTION_ADD_WARNING'; targetRound: number; player: PlayerColor; warningCount: 1 | 2; criticalLast10: boolean }
  | { type: 'SHOW_UPDATED_ROUND_RESULT' }
  | { type: 'CANCEL_ROUND_CORRECTION' }
  | { type: 'START_CORRECTION_REST' }
  | { type: 'START_NEXT_ROUND' }
  | { type: 'PREPARE_NEXT_ROUND_CALL' }
  | { type: 'START_ROUND_PLAYER_CALL' }
  | { type: 'START_REST' }
  | { type: 'SET_STATUS'; status: MatchState['status']; ivrRequestedBy?: PlayerColor }
  | { type: 'SET_KYESHI' }
  | { type: 'RESUME_FROM_KYESHI'; resumeTime?: number }
  | { type: 'DOCTOR_CALL' }
  | { type: 'FINISH'; winner: PlayerColor; method: any }
  | { type: 'CONFIRM_FINAL_RESULT' }
  | { type: 'RESET' }
  | { type: 'SET_STATE'; state: MatchState }
  | { type: 'RESTORE_STATE'; state: MatchState }
  | { type: 'SET_ROUND_WINNER'; roundWinner: RoundWinner }
  | { type: 'RESOLVE_DRAW_ROUND'; winner: PlayerColor; decisionType?: 'AI_RECOMMENDATION' | 'WOOSE_GIROK'; votes?: { left?: PlayerColor; center?: PlayerColor; right?: PlayerColor } }
  | { type: 'SET_TIE_REVIEW_PHASE'; phase: 'ai' | 'summons' | 'countdown' | 'voting' | 'result'; countdownStep?: 0 | 1 | 2 | 3; judgeNames?: { left?: string; center?: string; right?: string } }
  | { type: 'SET_TIE_REVIEW_VOTE'; judge: 'left' | 'center' | 'right'; winner: PlayerColor }
  | { type: 'SET_TIE_REVIEW_JUDGES'; judgeNames?: { left?: string; center?: string; right?: string }; judgePhotos?: { left?: string; center?: string; right?: string } }
  | { type: 'CONFIRM_AI_TIE_DECISION'; winner: PlayerColor }
  | { type: 'AWAITING_ROUND_START' }
  | { type: 'CONFIRM_PTG' }
  | { type: 'SKIP_PTG' }
  | { type: 'DECREMENT_IVR'; player: PlayerColor; reason?: string; coachName?: string }
  | { type: 'IVR_ANIMATE'; decision: 'accepted' | 'rejected'; side: PlayerColor }
  | { type: 'CLEAR_IVR_ANIMATE' }
  | { type: 'KO_ANIMATE'; side: PlayerColor }
  | { type: 'CLEAR_KO_ANIMATE' }
  | { type: 'GOLDEN_POINT_ANIMATE' }
  | { type: 'CLEAR_GOLDEN_POINT_ANIMATE' }
  | { type: 'SET_TEAM_ROSTER'; teamMode: 'rotation' | 'substitution'; roster?: { chung: { name: string; nationality: string; rounds?: number; playerNumber?: number; seedNumber?: number; photo?: string; roundScores?: { round: number; score: number; opponentScore: number; winner: PlayerColor | 'draw' }[] }[]; hong: { name: string; nationality: string; rounds?: number; playerNumber?: number; seedNumber?: number; photo?: string; roundScores?: { round: number; score: number; opponentScore: number; winner: PlayerColor | 'draw' }[] }[] } }
  | { type: 'REVEAL_TEAM_RESULT' }
  | { type: 'RESOLVE_TEAM_FINAL_DECISION'; winner: PlayerColor }
  | { type: 'REVEAL_MVP' }
  | { type: 'CLEAR_MVP' }
  | { type: 'SET_POOL_MVP'; poolMvpReveal: MatchState['poolMvpReveal'] }
  | { type: 'CLEAR_POOL_MVP' }
  | { type: 'REQUEST_SUBSTITUTION'; side: PlayerColor }
  | { type: 'CANCEL_SUBSTITUTION' }
  | { type: 'CONFIRM_SUBSTITUTION'; side: PlayerColor; name: string; photo?: string; nationality?: string; playerNumber?: number; seedNumber?: number }
  | { type: 'CLEAR_SUBSTITUTION_ANIMATION' }
  | { type: 'SWAP_SIDES' }
  | { type: 'ENTER_TEST_MODE' }
  | { type: 'EXIT_TEST_MODE' }
  | { type: 'SET_DISPLAY_CONFIG'; displayConfig: Partial<DisplayConfig> }
  | { type: 'SET_CALL_DISPLAY_CONFIG'; callDisplayConfig: Partial<CallDisplayConfig> }
  | { type: 'SET_LEAGUE_STANDINGS'; standings: LeagueStandingEntry[] | undefined }
  | { type: 'SET_SHOW_STANDINGS'; show: boolean }
  | { type: 'SET_BROADCAST_LIVE'; live: boolean }
  | { type: 'SET_CALL_SCREEN'; active: boolean }
  | { type: 'SET_CONNECTED_JUDGES'; count: number }
  // Main Referee-only broadcast commands.
  | { type: 'SET_TEAM_CALL_SHOW_PLAYERS'; show: boolean }
  | { type: 'SELECT_CALL_PLAYER'; side: PlayerColor; player: CallPlayerSelection }
  | { type: 'CLEAR_CALL_PLAYER_SELECTION'; side: PlayerColor }
  | { type: 'CALL_TEAM'; side: PlayerColor }
  | { type: 'COMPLETE_TEAM_CALL'; side: PlayerColor; animationId?: string }
  | { type: 'REPLAY_TEAM_CALL'; side: PlayerColor }
  | { type: 'RECALL_TEAM_CALL'; side: PlayerColor }
  | { type: 'CANCEL_TEAM_CALL' }
  | { type: 'SET_CALL_CONTROL_WAITING' }
  | { type: 'JUMP_TEAM_CALL_STAGE'; stage: 'intro' | 'blue' | 'red' | 'waiting' | 'ready' | 'live' }
  | { type: 'COMPLETE_SINGLE_PLAYER_CALL'; animationId: string }
  | { type: 'START_CALL_ANIMATION'; side: PlayerColor; mode: 'call' | 'change'; queueNext?: PlayerColor }
  | { type: 'ADVANCE_CALL_ANIMATION' }
  | { type: 'CLEAR_CALL_ANIMATION' }
  // Replays the currently-showing team/player call cinematic on the public
  // screen from the top, without touching score/timer/round/winner/player
  // selection — Main Referee only.
  | { type: 'REPLAY_CALL_ANIMATION' }
  // ===== SINGLE PLAYER CALL — Main Referee only =====
  | { type: 'CALL_SINGLE_PLAYER'; side: PlayerColor; playerName?: string; playerPhoto?: string; playerNumber?: number; seedNumber?: number; category?: string; teamName?: string; teamLogo?: string; clubName?: string; clubLogo?: string; country?: string }
  | { type: 'MARK_SINGLE_PLAYER_READY'; side: PlayerColor }
  | { type: 'REPLAY_SINGLE_PLAYER_CALL' }
  | { type: 'SET_PLAYER_CALL_PREVIEW_STATE'; state: MatchState['playerCallPreviewState'] }
  | { type: 'RECALL_SINGLE_PLAYER_CALL'; side: PlayerColor }
  | { type: 'RECALL_ROUND_PLAYER_CALL'; side: PlayerColor }
  | { type: 'CLEAR_SINGLE_PLAYER_CALL' }
  // ===== MATCHUP (SHOW MATCHUP) — Main Referee only =====
  | { type: 'SHOW_MATCHUP' }
  | { type: 'MARK_MATCHUP_READY' }
  | { type: 'REPLAY_MATCHUP' }
  | { type: 'CLEAR_MATCHUP' }
  | { type: 'STOP_BROADCAST_ANIMATION' }
  | { type: 'GO_LIVE_BROADCAST' }
  // ===== AUTOMATIC CALL FLOW — Main Referee only. Starts the Team Call →
  // Player Call → Matchup sequence; each stage still stops and waits for an
  // explicit COMPLETE_TEAM_CALL / MARK_SINGLE_PLAYER_READY / MARK_MATCHUP_READY
  // from the referee before the next stage auto-starts. See AutoCallSequence. =====
  | { type: 'START_AUTO_CALL_SEQUENCE' }
  | { type: 'START_TEAM_CALL_SEQUENCE' }
  | { type: 'START_PLAYER_CALL_SEQUENCE' }
  | { type: 'CANCEL_AUTO_CALL_SEQUENCE' }
  | { type: 'COMPLETE_GREETING_WAIT' }
  // Par Équipe only: calls the upcoming round's BLUE then RED player using
  // the modern player-call animation (never the legacy team-style call),
  // by starting a mini auto-sequence at the PLAYER_CHUNG stage.
  | { type: 'CALL_NEXT_ROUND_PLAYERS' }
  | { type: 'AUTO_SHOW_MATCHUP_AFTER_DELAY' };

function buildPlayerCallPhase(state: MatchState, side: PlayerColor, isSubstitution = false): CallAnimation {
  const player = state[side].player;
  const roster = state.teamRoster?.[side];
  // Roster position: which numbered player in the team's roster this is
  // (matched by name — the roster itself has no stable per-entry id).
  const teamPlayerNumber = roster ? (roster.findIndex(p => p.name === player.name) + 1) || undefined : undefined;
  return {
    phase: 'player',
    side,
    teamName: state.teamNames?.[side],
    clubName: state.clubNames?.[side] || player.club,
    teamLogo: state.teamLogos?.[side] || player.teamLogo,
    clubLogo: state.clubLogos?.[side] || player.clubLogo,
    teamCountry: state.teamCountry?.[side] || player.nationality,
    playerName: player.name,
    playerPhoto: player.photoUrl || player.photo,
    playerNationality: player.nationality,
    playerNumber: player.playerNumber,
    seedNumber: player.seedNumber,
    teamPlayerNumber,
    category: state.weightCategory || player.category,
    gender: state.gender,
    tournamentName: state.competitionName,
    isSubstitution,
    ts: Date.now(),
  };
}

// Sorted (ascending, by bib/player number — falling back to seed number,
// then original roster order) roster summary shown on the "team" phase of
// the call cinematic. Deliberately excludes photos: at this phase only the
// team identity + its player list are revealed, individual photos only
// appear once the "player" phase for that specific athlete starts.
function buildTeamRosterList(state: MatchState, side: PlayerColor): CallAnimation['roster'] {
  const roster = state.teamRoster?.[side];
  if (!roster || roster.length === 0) return undefined;
  return roster
    .map(p => ({ name: p.name, nationality: p.nationality, rounds: Math.max(1, p.rounds || 1), playerNumber: p.playerNumber, seedNumber: p.seedNumber, photo: p.photo, roundScores: p.roundScores }))
    .sort((a, b) => {
      const an = a.playerNumber ?? a.seedNumber;
      const bn = b.playerNumber ?? b.seedNumber;
      if (an == null && bn == null) return 0;
      if (an == null) return 1;
      if (bn == null) return -1;
      return an - bn;
    });
}

function buildTeamCallPhase(state: MatchState, side: PlayerColor, manualTeamCall = true): CallAnimation {
  const defaultTeamName = side === 'chung' ? 'CHUNG TEAM (청)' : 'HONG TEAM (홍)';
  const defaultClubName = side === 'chung' ? 'CHUNG CLUB' : 'HONG CLUB';
  return {
    phase: 'team',
    side,
    // No team/club info entered anywhere: fall back to a demo identity so
    // the Team Call can still be triggered and previewed, exactly like the
    // individual Player Call already does.
    teamName: state.teamNames?.[side] || state[side].player.name || defaultTeamName,
    clubName: state.clubNames?.[side] || state[side].player.club || defaultClubName,
    teamLogo: state.teamLogos?.[side] || state[side].player.teamLogo,
    teamCountry: state.teamCountry?.[side] || state[side].player.nationality,
    teamCategory: state.weightCategory,
    clubLogo: state.clubLogos?.[side] || state[side].player.clubLogo,
    roster: state.teamCallShowPlayers !== false ? buildTeamRosterList(state, side) : undefined,
    tournamentName: state.competitionName,
    manualTeamCall,
    ts: Date.now(),
  };
}

function makeAnimationController(
  state: MatchState,
  patch: Partial<BroadcastAnimationController> & Pick<BroadcastAnimationController, 'state'>,
  command: string,
): BroadcastAnimationController {
  const now = Date.now();
  return {
    ...(state.animationController || {}),
    ...patch,
    commandId: `cmd-${now}-${Math.random().toString(36).slice(2, 8)}`,
    lastCommand: command,
    startedAt: patch.state === 'IDLE' || patch.state === 'TEAM_CALLED' || patch.state === 'PLAYER_CALLED'
      ? state.animationController?.startedAt
      : now,
  };
}

// ===== AUTOMATIC CALL FLOW — internal helper =====
// Invoked from inside COMPLETE_TEAM_CALL / MARK_SINGLE_PLAYER_READY /
// MARK_MATCHUP_READY, AFTER that action's own confirmation patch has
// already been applied to `state`. If an auto sequence is active and was
// waiting on exactly the stage that was just confirmed by the referee, this
// fires the NEXT stage's call automatically and advances
// autoCallSequence.stage. It never skips a confirmation — the next stage
// still stops and waits for its own explicit referee CONFIRM/READY press —
// and it never starts the match itself (see spec §9/§14/§21).
function autoAdvanceCallSequence(state: MatchState, justConfirmed: AutoCallSequenceStage): Partial<MatchState> {
  const seq = state.autoCallSequence;
  if (!seq || !seq.active || seq.stage !== justConfirmed) return {};

  // BLUE (chung) always goes first — in the team call AND in the player
  // call — RED (hong) always follows. This stage fires once BLUE's team
  // call has been confirmed, and starts RED's team call.
  if (justConfirmed === 'TEAM_CHUNG') {
    const animationId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      callScreenActive: true,
      callAnimation: { ...buildTeamCallPhase(state, 'hong', true), ts: Date.now() },
      teamCallStatus: { ...state.teamCallStatus, hong: 'calling' as const },
      animationController: makeAnimationController(state, { state: 'CALLING_TEAM', activeAnimation: 'TEAM_CALL', animationId }, 'AUTO:CALL_TEAM:hong'),
      autoCallSequence: { ...seq, stage: 'TEAM_HONG', stageEndsAt: state.config.teamCallAutoEnabled === false ? undefined : Date.now() + Math.max(0.5, state.config.teamCallRedSeconds ?? 3) * 1000 },
    };
  }

  if (justConfirmed === 'TEAM_HONG') {
    // The exact Team Call cinematic has a final WAITING/CONFIRM stop after
    // RED. Keep the team-only flow there; it must never jump into player call.
    return { autoCallSequence: { ...seq, stage: 'GREETING' } };
  }

  if (justConfirmed === 'GREETING') {
    // Greeting confirmed by the referee. For Par Équipe, use the roster
    // entry assigned to the current round; for a normal 1v1 match, use the
    // already-selected corner player. BLUE (chung) is called first.
    const chungRosterEntry = getRotationEntryForRound(state.teamRoster?.chung, state.currentRound - 1);
    const chungPlayer = state.chung.player;
    const chungName = chungRosterEntry?.name || chungPlayer?.name || 'CHUNG (청)';
    const animationId = `spc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const selection: CallPlayerSelection = {
      name: chungName,
      nationality: chungRosterEntry?.nationality || chungPlayer.nationality,
      playerNumber: chungRosterEntry?.playerNumber ?? chungPlayer.playerNumber,
      seedNumber: chungRosterEntry?.seedNumber ?? chungPlayer.seedNumber,
      photo: chungRosterEntry?.photo || chungPlayer.photoUrl || chungPlayer.photo,
      category: state.weightCategory || chungPlayer.category,
      teamName: state.teamNames?.chung,
      teamLogo: state.teamLogos?.chung || chungPlayer.teamLogo,
      clubName: state.clubNames?.chung || chungPlayer.club || 'CHUNG CLUB',
      clubLogo: state.clubLogos?.chung || chungPlayer.clubLogo,
      country: chungRosterEntry?.nationality || chungPlayer.nationality,
      rounds: chungRosterEntry?.rounds ?? 1,
    };
    return {
      selectedCallPlayers: { ...(state.selectedCallPlayers || {}), chung: selection },
      playerCallStatus: { ...state.playerCallStatus, chung: 'calling' as const },
      singlePlayerCall: {
        side: 'chung', animationId, status: 'calling', ts: Date.now(),
        playerName: selection.name, playerPhoto: selection.photo, playerNumber: selection.playerNumber,
        seedNumber: selection.seedNumber, category: selection.category, teamName: selection.teamName,
        teamLogo: selection.teamLogo, clubName: selection.clubName, clubLogo: selection.clubLogo,
        country: selection.country,
      },
      animationController: makeAnimationController(state, { state: 'CALLING_PLAYER', activeAnimation: 'SINGLE_PLAYER_CALL', animationId }, 'AUTO:CALL_SINGLE_PLAYER:chung'),
      autoCallSequence: { ...seq, stage: 'PLAYER_CHUNG', stageEndsAt: Date.now() + Math.max(0.5, state.config.playerCallBlueSeconds ?? 3) * 1000 },
    };
  }

  if (justConfirmed === 'PLAYER_CHUNG') {
    const hongRosterEntry = getRotationEntryForRound(state.teamRoster?.hong, state.currentRound - 1);
    const hongPlayer = state.hong.player;
    const hongName = hongRosterEntry?.name || hongPlayer?.name || 'HONG (홍)';
    const animationId = `spc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const selection: CallPlayerSelection = {
      name: hongName,
      nationality: hongRosterEntry?.nationality || hongPlayer.nationality,
      playerNumber: hongRosterEntry?.playerNumber ?? hongPlayer.playerNumber,
      seedNumber: hongRosterEntry?.seedNumber ?? hongPlayer.seedNumber,
      photo: hongRosterEntry?.photo || hongPlayer.photoUrl || hongPlayer.photo,
      category: state.weightCategory || hongPlayer.category,
      teamName: state.teamNames?.hong,
      teamLogo: state.teamLogos?.hong || hongPlayer.teamLogo,
      clubName: state.clubNames?.hong || hongPlayer.club || 'HONG CLUB',
      clubLogo: state.clubLogos?.hong || hongPlayer.clubLogo,
      country: hongRosterEntry?.nationality || hongPlayer.nationality,
      rounds: hongRosterEntry?.rounds ?? 1,
    };
    return {
      selectedCallPlayers: { ...(state.selectedCallPlayers || {}), hong: selection },
      playerCallStatus: { ...state.playerCallStatus, hong: 'calling' as const },
      singlePlayerCall: {
        side: 'hong', animationId, status: 'calling', ts: Date.now(),
        playerName: selection.name, playerPhoto: selection.photo, playerNumber: selection.playerNumber,
        seedNumber: selection.seedNumber, category: selection.category, teamName: selection.teamName,
        teamLogo: selection.teamLogo, clubName: selection.clubName, clubLogo: selection.clubLogo,
        country: selection.country,
      },
      animationController: makeAnimationController(state, { state: 'CALLING_PLAYER', activeAnimation: 'SINGLE_PLAYER_CALL', animationId }, 'AUTO:CALL_SINGLE_PLAYER:hong'),
      autoCallSequence: {
        ...seq,
        stage: 'PLAYER_HONG',
        stageEndsAt: Date.now() + Math.max(0.5, state.config.playerCallRedSeconds ?? 3) * 1000,
      },
    };
  }

  if (justConfirmed === 'PLAYER_HONG') {
    // Both players called+ready. Auto-show Matchup (mirrors SHOW_MATCHUP's
    // own guard exactly, so it can never show an invalid/incomplete matchup).
    if (!state.selectedCallPlayers?.hong?.name || !state.selectedCallPlayers?.chung?.name) {
      return { autoCallSequence: { ...seq, active: false } };
    }
    const redStatus = state.playerCallStatus?.hong;
    const blueStatus = state.playerCallStatus?.chung;
    if (!['called', 'ready'].includes(redStatus) || !['called', 'ready'].includes(blueStatus)) {
      return { autoCallSequence: { ...seq, active: false } };
    }
    const animationId = `mu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      matchupAnimation: { animationId, status: 'showing', ts: Date.now() },
      animationController: makeAnimationController(state, { state: 'SHOWING_MATCHUP', activeAnimation: 'MATCHUP', animationId }, 'AUTO:SHOW_MATCHUP'),
      autoCallSequence: { ...seq, stage: 'MATCHUP' },
    };
  }

  if (justConfirmed === 'MATCHUP') {
    // Sequence complete. MATCH READY is already surfaced by the existing
    // UI — the match itself is never auto-started (§9/§21).
    return { autoCallSequence: { ...seq, active: false, stage: 'DONE' } };
  }

  return {};
}

// Par Équipe: can the operator manually change the player on `side` right
// Manual player changes belong exclusively to Par Équipe's
// "mid-match substitution" mode. In the fixed-rounds mode the roster
// schedule is authoritative and the active player changes automatically at
// the configured round boundary.
export function canManuallyChangePlayer(state: MatchState, side: PlayerColor): boolean {
  if (state.callScreenActive) return false;
  if (state.teamMode !== 'substitution') return false;
  const betweenRounds = state.status === 'waiting' || state.status === 'rest'
    || (state.status === 'paused' && !!state.awaitingRoundStart);
  const midFight = state.status === 'fighting' || state.status === 'kyeshi';
  return betweenRounds || midFight;
}

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case 'INIT_MATCH':
      return createInitialMatchState(action.config);
    case 'UPDATE_CONFIG': {
      const nextConfig = { ...state.config, ...action.config };
      let autoCallSequence = state.autoCallSequence;
      if (state.autoCallSequence?.mode === 'teams' && state.autoCallSequence.active && (action.config.teamCallAutoEnabled !== undefined)) {
        if (action.config.teamCallAutoEnabled === false) {
          autoCallSequence = { ...state.autoCallSequence, stageEndsAt: undefined };
        } else if (action.config.teamCallAutoEnabled === true && ['TEAM_CHUNG', 'TEAM_HONG'].includes(state.autoCallSequence.stage)) {
          const seconds = state.autoCallSequence.stage === 'TEAM_CHUNG' ? nextConfig.teamCallBlueSeconds : nextConfig.teamCallRedSeconds;
          autoCallSequence = { ...state.autoCallSequence, stageEndsAt: Date.now() + Math.max(0.5, seconds ?? 3) * 1000 };
        }
      }
      return { ...state, config: nextConfig, autoCallSequence };
    }
    case 'SET_PLAYER': {
      // MATCH LOCK: once a bout has actually started (or has recorded score
      // events), roster identity cannot be silently changed through the
      // generic setup action. Par Équipe substitutions use their dedicated
      // REQUEST_SUBSTITUTION/CONFIRM_SUBSTITUTION path and remain allowed.
      const matchHasStarted = state.status === 'fighting' || state.status === 'rest' || state.status === 'kyeshi' || state.status === 'finished' || (state.events?.length ?? 0) > 0;
      if (matchHasStarted) return state;
      const newState = structuredClone(state);
      const existing = newState[action.color].player;
      newState[action.color].player = {
        id: existing?.id || crypto.randomUUID(),
        name: action.name,
        nationality: action.nationality,
        club: action.club !== undefined ? action.club : existing?.club,
        seedNumber: action.seedNumber !== undefined ? action.seedNumber : existing?.seedNumber,
        playerNumber: action.playerNumber !== undefined ? action.playerNumber : existing?.playerNumber,
        photoUrl: action.photoUrl !== undefined ? action.photoUrl : existing?.photoUrl,
      };
      return newState;
    }
    case 'SET_MATCH_INFO': {
      const newState = structuredClone(state);
      if (action.competitionName !== undefined) newState.competitionName = action.competitionName;
      if (action.matchNumber !== undefined) newState.matchNumber = action.matchNumber;
      if (action.weightCategory !== undefined) newState.weightCategory = action.weightCategory;
      if (action.ageGroup !== undefined) newState.ageGroup = action.ageGroup;
      if (action.gender !== undefined) newState.gender = action.gender;
      if (action.matchStage !== undefined) newState.matchStage = action.matchStage;
      if (action.matNumber !== undefined) newState.matNumber = action.matNumber;
      if (action.tournamentId !== undefined) newState.tournamentId = action.tournamentId;
      if (action.bracketMatchId !== undefined) newState.bracketMatchId = action.bracketMatchId;
      if (action.teamNames !== undefined) newState.teamNames = action.teamNames;
      if (action.clubNames !== undefined) newState.clubNames = action.clubNames;
      if (action.teamLogos !== undefined) newState.teamLogos = action.teamLogos;
      if (action.clubLogos !== undefined) newState.clubLogos = action.clubLogos;
      if (action.teamCountry !== undefined) newState.teamCountry = action.teamCountry;
      if (action.eventLocation !== undefined) newState.eventLocation = action.eventLocation;
      if (action.eventDate !== undefined) newState.eventDate = action.eventDate;
      if (action.division !== undefined) newState.division = action.division;
      if (action.coachNames !== undefined) newState.coachNames = action.coachNames;
      return newState;
    }
    case 'START':
      // SHIJAK / START is a hard visual hand-off from Player Call to LIVE.
      // Clear only call/animation state; scoring, roster, timer setup and
      // tournament data remain untouched.
      return {
        ...state,
        status: 'fighting',
        // Capture the real first SHIJAK time once. Repeated round starts/resumes
        // must not overwrite the original match start timestamp.
        startedAt: state.startedAt ?? Date.now(),
        finishedAt: undefined,
        awaitingRoundStart: false,
        callScreenActive: false,
        callAnimation: undefined,
        singlePlayerCall: undefined,
        matchupAnimation: undefined,
        callAnimationQueue: undefined,
        callSequence: undefined,
        playerCallPreviewState: undefined,
        autoCallSequence: state.autoCallSequence ? { ...state.autoCallSequence, active: false } : state.autoCallSequence,
        playerCallStatus: { chung: 'waiting', hong: 'waiting' },
        animationController: { ...(state.animationController || {}), state: 'IDLE', activeAnimation: undefined, lastCommand: 'START_MATCH_CLEAR_CALL', completedAt: Date.now() },
      };
    case 'START_ROUND_INTRO':
      return { ...state, roundStartIntro: { active: true, ts: Date.now(), next: action.next } };
    case 'FINISH_ROUND_INTRO': {
      if (!state.roundStartIntro?.active) return state;
      const next = state.roundStartIntro.next;
      const cleared = { ...state, roundStartIntro: { ...state.roundStartIntro, active: false } };
      if (next === 'NEXT_ROUND') {
        const prepared = matchReducer(cleared, { type: 'PREPARE_NEXT_ROUND_CALL' });
        // If this is a normal non-team match, there is no player-call preview;
        // start the round immediately. Team matches keep the existing player
        // call cinematic, which now starts only after the intro.
        if (!prepared.roundCallPreview) return matchReducer(cleared, { type: 'START_NEXT_ROUND' });
        return prepared;
      }
      // next === 'START' — the very first Shijak press of the match. The
      // intro used to just clear its own "active" flag and stop there, so
      // the match stayed stuck on "waiting" forever after the intro played —
      // Shijak looked like it "did an intro" and nothing else. Actually
      // start the fight now that the intro is done.
      return matchReducer(cleared, { type: 'START' });
    }
    case 'PAUSE':
      return { ...state, status: 'paused' };
    case 'RESUME':
      return { ...state, status: 'fighting', awaitingRoundStart: false, callScreenActive: false };
    case 'TICK': {
      if (state.status !== 'fighting' && state.status !== 'rest' && state.status !== 'kyeshi') return state;
      // A decided tied-round result is shown first. During that short reveal
      // the official rest clock must not lose seconds. Once the reveal ends,
      // the next tick clears the hold and the rest countdown begins.
      if (state.status === 'rest' && state.roundDecisionRevealUntil) {
        if (Date.now() < state.roundDecisionRevealUntil) return state;
        return { ...state, roundDecisionRevealUntil: undefined };
      }
      const newTime = state.timeRemaining - 1;
      if (state.status === 'kyeshi') {
        const used = (state.kyeshiUsedThisRound || 0) + 1;
        if (newTime <= 0) {
          // Kyeshi budget ran out on its own — same fix as RESUME_FROM_KYESHI:
          // put the real fight-clock time back instead of leaving 0.
          return { ...state, timeRemaining: state.preKyeshiTimeRemaining ?? 0, status: 'paused', kyeshiUsedThisRound: used, preKyeshiTimeRemaining: undefined };
        }
        return { ...state, timeRemaining: newTime, kyeshiUsedThisRound: used };
      }
      if (newTime <= 0) {
        if (state.status === 'fighting') {
          return endRound({ ...state, timeRemaining: 0 });
        }
        if (state.status === 'rest') {
          const ns = structuredClone(state);
          ns.timeRemaining = 0;
          // If a corrected round changed the match outcome, the public
          // display must first complete the renewed break. Only then do we
          // publish the corrected winner to the audience.
          if (ns.roundCorrectionReview?.nextAction === 'WINNER') {
            const winner = ns.roundWinners.reduce<'chung' | 'hong' | undefined>((acc, r) => {
              if (acc) return acc;
              const wins = ns.roundWinners.filter(x => x.winner === r.winner && x.winner !== 'draw').length;
              const majority = Math.floor(ns.config.rounds / 2) + 1;
              return wins >= majority ? r.winner as 'chung' | 'hong' : undefined;
            }, undefined);
            if (winner) {
              ns.result = { winner, method: 'PTF', finalScore: { chung: ns.chung.totalScore, hong: ns.hong.totalScore } } as any;
              ns.status = 'finished';
              ns.awaitingRoundStart = false;
              ns.roundCorrectionReview = undefined;
              return ns;
            }
          }
          ns.status = 'paused';
          ns.awaitingRoundStart = true;
          ns.roundCorrectionReview = undefined;
          return ns;
        }
      }
      return { ...state, timeRemaining: newTime };
    }
    case 'ADD_SCORE':
      return addScore(state, action.player, action.scoreType, action.addedBy || 'operator', action.judgeId);
    case 'REMOVE_SCORE':
      return removeLastScore(state, action.player);
    case 'START_ROUND_CORRECTION': {
      if (state.config.competitionMode === 'par_equipe') return state;
      const targetRound = Math.max(1, Math.min(action.targetRound, state.config.rounds));
      return { ...state, status: 'paused', timeRemaining: 0, roundCorrection: { active: true, targetRound, originalRound: state.currentRound, ts: Date.now() }, roundCorrectionReview: undefined };
    }
    case 'CORRECTION_ADD_WARNING': {
      // Individual matches only. Par Équipe keeps its own team-match flow.
      if (state.config.competitionMode === 'par_equipe') return state;
      if (!state.roundCorrection?.active || state.roundCorrection.targetRound !== action.targetRound) return state;
      const ns = structuredClone(state);
      const count = action.warningCount === 2 ? 2 : 1;
      const criticalPoints = Number(ns.config.last10SecondsGamjeomPoints ?? 2);
      // A late correction is still entered against the historical round.
      // It never restarts the clock. When the referee confirms that the
      // warning happened in the final 10 seconds, the configured 1/2-point
      // consequence is also recorded as a real scoring event for the opponent.
      for (let i = 0; i < count; i++) {
        ns.events.push({
          id: crypto.randomUUID(),
          round: action.targetRound,
          player: action.player,
          type: 'warning',
          points: 0,
          time: action.criticalLast10 ? 10 : 0,
          timestamp: Date.now(),
          addedBy: 'operator',
          judgeId: 'ROUND_CORRECTION',
          approved: true,
          correctionCriticalLast10: action.criticalLast10,
          warningCount: 1,
        });
      }
      if (action.criticalLast10) {
        const opponent: PlayerColor = action.player === 'chung' ? 'hong' : 'chung';
        const pointsToAward = count === 2 ? Math.max(2, criticalPoints) : Math.max(1, criticalPoints - 1);
        // Keep the existing score-event model: each point is an ordinary
        // opponent point so all existing statistics/recalculation paths see it.
        for (let i = 0; i < pointsToAward; i++) {
          ns.events.push({
            id: crypto.randomUUID(),
            round: action.targetRound,
            player: opponent,
            type: 'manual',
            points: 1,
            time: 10,
            timestamp: Date.now(),
            addedBy: 'operator',
            judgeId: 'ROUND_CORRECTION_LAST10',
            approved: true,
          });
        }
      }
      // Rebuild round scores/winner immediately so the correction preview is
      // truthful before SHOW UPDATED RESULT is pressed.
      const empty = () => Array.from({ length: ns.config.rounds + 1 }, () => ({ attack: 0, gamjeom: 0, total: 0 }));
      const scores = { chung: empty(), hong: empty() };
      const totals = { chung: 0, hong: 0 };
      for (const e of ns.events) {
        const idx = e.round - 1;
        if (idx < 0 || idx >= scores.chung.length) continue;
        if (e.type === 'warning') continue;
        if (e.type === 'gamjeom') {
          scores[e.player][idx].gamjeom += 1;
          const opponent = e.player === 'chung' ? 'hong' : 'chung';
          scores[opponent][idx].attack += e.points;
          scores[opponent][idx].total += e.points;
          totals[opponent] += e.points;
        } else {
          scores[e.player][idx].attack += e.points;
          scores[e.player][idx].total += e.points;
          totals[e.player] += e.points;
        }
      }
      ns.chung.scores = scores.chung;
      ns.hong.scores = scores.hong;
      ns.chung.totalScore = totals.chung;
      ns.hong.totalScore = totals.hong;
      ns.chung.gamjeomCount = scores.chung[action.targetRound - 1]?.gamjeom || 0;
      ns.hong.gamjeomCount = scores.hong[action.targetRound - 1]?.gamjeom || 0;
      const idx = action.targetRound - 1;
      const cs = scores.chung[idx]?.total || 0;
      const hs = scores.hong[idx]?.total || 0;
      let winner: PlayerColor | 'draw' = cs > hs ? 'chung' : hs > cs ? 'hong' : 'draw';
      const cg = scores.chung[idx]?.gamjeom || 0;
      const hg = scores.hong[idx]?.gamjeom || 0;
      let method: RoundWinner['method'] = winner === 'draw' ? 'draw' : 'score';
      if (winner === 'draw' && cg < hg) { winner = 'chung'; method = 'gamjeom'; }
      else if (winner === 'draw' && hg < cg) { winner = 'hong'; method = 'gamjeom'; }
      ns.roundWinners = [...ns.roundWinners.filter(r => r.round !== action.targetRound), { round: action.targetRound, winner, method, chungScore: cs, hongScore: hs }].sort((a,b)=>a.round-b.round);
      return ns;
    }
    case 'CORRECTION_ADD_SCORE': {
      if (state.config.competitionMode === 'par_equipe') return state;
      if (!state.roundCorrection?.active || state.roundCorrection.targetRound !== action.targetRound) return state;
      const ns = structuredClone(state);
      const roundIdx = action.targetRound - 1;
      const points = action.scoreType === 'turning_head' ? (ns.config.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints) : SCORE_VALUES[action.scoreType];
      ns.events.push({ id: crypto.randomUUID(), round: action.targetRound, player: action.player, type: action.scoreType, points, time: 0, timestamp: Date.now(), addedBy: 'operator', judgeId: 'ROUND_CORRECTION', approved: true });
      const empty = () => Array.from({ length: ns.config.rounds + 1 }, () => ({ attack: 0, gamjeom: 0, total: 0 }));
      const scores = { chung: empty(), hong: empty() };
      const totals = { chung: 0, hong: 0 };
      for (const e of ns.events) {
        const idx = e.round - 1; if (idx < 0 || idx >= scores.chung.length) continue;
        if (e.type === 'warning') {
          continue;
        }
        if (e.type === 'gamjeom') {
          scores[e.player][idx].gamjeom += 1;
          const opponent = e.player === 'chung' ? 'hong' : 'chung';
          scores[opponent][idx].attack += e.points; scores[opponent][idx].total += e.points; totals[opponent] += e.points;
        } else {
          scores[e.player][idx].attack += e.points; scores[e.player][idx].total += e.points; totals[e.player] += e.points;
        }
      }
      ns.chung.scores = scores.chung; ns.hong.scores = scores.hong;
      ns.chung.totalScore = totals.chung; ns.hong.totalScore = totals.hong;
      ns.chung.gamjeomCount = scores.chung[roundIdx]?.gamjeom || 0; ns.hong.gamjeomCount = scores.hong[roundIdx]?.gamjeom || 0;
      const cs = ns.chung.scores[roundIdx]?.total || 0, hs = ns.hong.scores[roundIdx]?.total || 0;
      let winner: PlayerColor | 'draw' = cs > hs ? 'chung' : hs > cs ? 'hong' : 'draw';
      const cg = ns.chung.scores[roundIdx]?.gamjeom || 0, hg = ns.hong.scores[roundIdx]?.gamjeom || 0;
      let method: RoundWinner['method'] = winner === 'draw' ? 'draw' : 'score';
      if (winner === 'draw' && cg < hg) { winner = 'chung'; method = 'gamjeom'; }
      else if (winner === 'draw' && hg < cg) { winner = 'hong'; method = 'gamjeom'; }
      ns.roundWinners = [...ns.roundWinners.filter(r => r.round !== action.targetRound), { round: action.targetRound, winner, method, chungScore: cs, hongScore: hs }].sort((a,b)=>a.round-b.round);
      return ns;
    }
    case 'SHOW_UPDATED_ROUND_RESULT': {
      const correction = state.roundCorrection; if (!correction?.active) return state;
      const target = correction.targetRound, rw = state.roundWinners.find(r => r.round === target); if (!rw) return state;
      const ns = structuredClone(state);
      const wins = { chung: 0, hong: 0 };
      for (const r of ns.roundWinners) { if (r.winner === 'chung') wins.chung++; if (r.winner === 'hong') wins.hong++; }
      const majority = Math.floor(ns.config.rounds / 2) + 1;
      const winner: PlayerColor | undefined = wins.chung >= majority ? 'chung' : wins.hong >= majority ? 'hong' : undefined;
      ns.roundCorrectionReview = { targetRound: target, ts: Date.now(), nextAction: winner ? 'WINNER' : 'REST' };
      ns.roundCorrection = undefined;
      // Never jump directly to the winner after a correction. The audience
      // must return to the LIVE MATCH / REST frame with 00:00 first. The
      // referee explicitly restarts the break, and only when that break ends
      // may the corrected winner be revealed.
      ns.result = undefined;
      // The correction is confirmed at the public 00:00 review screen;
      // immediately restart the official break instead of requiring a
      // second START BREAK button press.
      ns.status = 'rest';
      ns.awaitingRoundStart = false;
      ns.timeRemaining = ns.config.restTime;
      if (!winner) {
        ns.currentRound = Math.min(ns.config.rounds, Math.max(correction.originalRound, target + 1));
      }
      return ns;
    }
    case 'START_CORRECTION_REST': {
      if (!state.roundCorrectionReview) return state;
      return { ...state, status: 'rest', timeRemaining: state.config.restTime, awaitingRoundStart: false };
    }
    case 'CANCEL_ROUND_CORRECTION':
      return { ...state, roundCorrection: undefined, roundCorrectionReview: undefined };
    case 'END_ROUND':
      return endRound(state);
    case 'PREPARE_NEXT_ROUND_CALL': {
      // Par Équipe inter-round cinematic: do NOT advance the clock yet.
      // First show the exact two athletes assigned to the upcoming round,
      // then announce each athlete individually. The real round starts only
      // after both player-call phases finish.
      //
      // IMPORTANT: this used to silently do nothing (leaving the operator
      // stuck on "Start Round" with no visible error) whenever teamRoster
      // was missing, or whenever a specific round's roster entry wasn't
      // found. That happened for the second/later match in a tournament
      // session if the roster wasn't re-confirmed for that match. It must
      // NEVER block round progression — if roster data for the upcoming
      // round is unavailable, fall back to the currently assigned player
      // instead of freezing the match.
      if (state.result) return state;
      const nextRound = state.currentRound + 1;
      const currentChungFallback = {
        name: state.chung.player.name,
        nationality: state.chung.player.nationality,
        playerNumber: state.chung.player.playerNumber,
        seedNumber: state.chung.player.seedNumber,
        photo: state.chung.player.photoUrl || state.chung.player.photo,
      };
      const currentHongFallback = {
        name: state.hong.player.name,
        nationality: state.hong.player.nationality,
        playerNumber: state.hong.player.playerNumber,
        seedNumber: state.hong.player.seedNumber,
        photo: state.hong.player.photoUrl || state.hong.player.photo,
      };
      const nextChung = (state.teamMode === 'rotation' && state.teamRoster?.chung)
        ? (getRotationEntryForRound(state.teamRoster.chung, nextRound - 1) || currentChungFallback)
        : currentChungFallback;
      const nextHong = (state.teamMode === 'rotation' && state.teamRoster?.hong)
        ? (getRotationEntryForRound(state.teamRoster.hong, nextRound - 1) || currentHongFallback)
        : currentHongFallback;
      if (!nextChung || !nextHong) return { ...state, roundCallPreview: undefined, callAnimation: undefined, callAnimationQueue: undefined, callSequence: undefined };
      return {
        ...state,
        roundCallPreview: {
          round: nextRound,
          ts: Date.now(),
          chung: {
            name: nextChung.name,
            nationality: nextChung.nationality,
            playerNumber: nextChung.playerNumber,
            seedNumber: nextChung.seedNumber,
            photo: nextChung.photo,
          },
          hong: {
            name: nextHong.name,
            nationality: nextHong.nationality,
            playerNumber: nextHong.playerNumber,
            seedNumber: nextHong.seedNumber,
            photo: nextHong.photo,
          },
        },
        pendingRoundStartAfterCall: true,
      };
    }
    case 'START_ROUND_PLAYER_CALL': {
      if (!state.roundCallPreview || state.callAnimation) return state;
      const ns = structuredClone(state);
      const preview = ns.roundCallPreview;
      const side = 'chung' as PlayerColor;
      const next = preview.chung;
      const roster = ns.teamRoster?.[side];
      const teamPlayerNumber = roster ? (roster.findIndex(p => p.name === next.name) + 1) || undefined : undefined;
      ns.selectedCallPlayers = {
        ...(ns.selectedCallPlayers || {}),
        chung: {
          name: next.name, nationality: next.nationality, country: next.nationality,
          playerNumber: next.playerNumber, seedNumber: next.seedNumber, photo: next.photo,
          category: ns.weightCategory, teamName: ns.teamNames?.[side], teamLogo: ns.teamLogos?.[side],
          clubName: ns.clubNames?.[side] || ns[side].player.club, clubLogo: ns.clubLogos?.[side],
          rounds: ns.teamRoster?.[side]?.find(p => p.name === next.name)?.rounds ?? 1,
        },
      };
      ns.playerCallStatus = { ...ns.playerCallStatus, chung: 'calling' as const };
      // Keep roundCallPreview until both player announcements finish so the
      // queued RED player can be read from the exact same preview data.
      ns.callAnimationQueue = 'hong';
      ns.callAnimation = {
        phase: 'player',
        side,
        teamName: ns.teamNames?.[side],
        clubName: ns.clubNames?.[side] || ns[side].player.club,
        teamLogo: ns.teamLogos?.[side],
        clubLogo: ns.clubLogos?.[side],
        teamCountry: ns.teamCountry?.[side] || next.nationality,
        playerName: next.name,
        playerPhoto: next.photo,
        playerNationality: next.nationality,
        playerNumber: next.playerNumber,
        seedNumber: next.seedNumber,
        teamPlayerNumber,
        category: ns.weightCategory,
        gender: ns.gender,
        tournamentName: ns.competitionName,
        ts: Date.now(),
      };
      return ns;
    }
    case 'START_NEXT_ROUND': {
      // Best-of-3 safety: once a competitor has won the majority of rounds
      // (e.g. 2-0), the match is over — never start another round even if
      // this is somehow dispatched again (the button is also disabled).
      if (state.result) return state;
      const ns = structuredClone(state);
      ns.currentRound += 1;
      ns.timeRemaining = ns.isGoldenRound ? 60 : ns.config.roundTime;
      ns.status = 'fighting';
      ns.awaitingRoundStart = false;
      ns.kyeshiUsedThisRound = 0;
      // Reset round-level gamjeom counters — but in Par Équipe
      // (scoreResetPerRound === false) warnings accumulate across the
      // whole match just like points, so leave the running total untouched.
      if (ns.config.warningResetPerRound !== false) {
        ns.chung.gamjeomCount = 0;
        ns.hong.gamjeomCount = 0;
      }
      // Clear PTG lock for the new round
      ns.ptgActive = false;
      ns.ptgWinner = undefined;
      ns.ptgValueAtTrigger = undefined;
      // Par Équipe "rotation" mode: a different pre-assigned player from
      // each team's roster plays each round (score keeps accumulating for
      // the team regardless of who's currently on the mat).
      if (ns.teamMode === 'rotation' && ns.teamRoster) {
        // Rotation is round-bound: the athlete changes only when the next
        // round actually starts. The player-call cinematic is prepared during
        // the rest/awaiting phase, but the live player is swapped here, at the
        // exact round boundary, immediately before the fight timer resumes.
        const idx = ns.currentRound - 1;
        const nextChung = getRotationEntryForRound(ns.teamRoster.chung, idx);
        const nextHong = getRotationEntryForRound(ns.teamRoster.hong, idx);
        if (nextChung) ns.chung.player = { ...ns.chung.player, name: nextChung.name, nationality: nextChung.nationality, playerNumber: nextChung.playerNumber, seedNumber: nextChung.seedNumber, photoUrl: nextChung.photo };
        if (nextHong) ns.hong.player = { ...ns.hong.player, name: nextHong.name, nationality: nextHong.nationality, playerNumber: nextHong.playerNumber, seedNumber: nextHong.seedNumber, photoUrl: nextHong.photo };
      }
      return ns;
    }
    case 'START_REST':
      return { ...state, status: 'rest', timeRemaining: state.config.restTime };
    case 'SET_STATUS':
      return {
        ...state,
        status: action.status,
        ivrRequestedBy: action.status === 'ivr' ? (action.ivrRequestedBy ?? state.ivrRequestedBy) : state.ivrRequestedBy,
      };
    case 'SET_KYESHI': {
      // Cumulative kyeshi budget per round by default, unless the operator
      // has turned on "reset each time" in Admin settings — then every
      // Kyeshi call gets the full config.kyeshiTime again instead of sharing
      // one budget across the round.
      if (state.config.kyeshiResetsEachTime) {
        return { ...state, status: 'kyeshi', timeRemaining: state.config.kyeshiTime, kyeshiUsedThisRound: 0, preKyeshiTimeRemaining: state.timeRemaining };
      }
      const used = state.kyeshiUsedThisRound || 0;
      const remaining = Math.max(0, state.config.kyeshiTime - used);
      if (remaining <= 0) return state; // No budget left this round
      // Save the real fight-clock time before overwriting timeRemaining with
      // the kyeshi countdown, so RESUME_FROM_KYESHI can put it back exactly
      // where the match stopped instead of leaving whatever kyeshi time was
      // left over.
      return { ...state, status: 'kyeshi', timeRemaining: remaining, preKyeshiTimeRemaining: state.timeRemaining };
    }
    case 'RESUME_FROM_KYESHI': {
      if (state.status !== 'kyeshi') return state;
      return {
        ...state,
        status: 'paused',
        // Explicit resumeTime (from the "Resume (saved)" button, which passes
        // the operator's own savedTime) always wins. With no resumeTime this
        // is the "Continue Current" button — it deliberately keeps whatever
        // time is left on the kyeshi clock, so state.timeRemaining is correct
        // here and must NOT be replaced by preKyeshiTimeRemaining.
        timeRemaining: action.resumeTime ?? state.timeRemaining,
        preKyeshiTimeRemaining: undefined,
      };
    }
    case 'DOCTOR_CALL':
      return { ...state, status: 'doctor' };
    case 'FINISH': {
      const newState = structuredClone(state);
      newState.status = 'finished';
      newState.finishedAt = Date.now();
      newState.result = {
        winner: action.winner,
        method: action.method,
        finalScore: { chung: state.chung.totalScore, hong: state.hong.totalScore },
      };
      newState.resultConfirmed = false;
      return newState;
    }
    case 'CONFIRM_FINAL_RESULT': {
      if (state.status !== 'finished' || !state.result) return state;
      return { ...state, resultConfirmed: true, awaitingTeamReveal: false, pendingRoundDecision: false };
    }
    case 'RESET':
      // Carry the Admin's show/hide preferences, and whether the public
      // screen has already been switched on, over into the next match —
      // both are session-level settings, not something tied to a single
      // bout. Otherwise the audience screen would drop back to the splash
      // banner between every match.
      return createInitialMatchState(state.config, state.displayConfig, state.publicBroadcastLive);
    case 'SET_DISPLAY_CONFIG':
      return { ...state, displayConfig: { ...(state.displayConfig || {} as DisplayConfig), ...action.displayConfig } };
    case 'SET_CALL_DISPLAY_CONFIG':
      return { ...state, callDisplayConfig: { ...(state.callDisplayConfig || {} as CallDisplayConfig), ...action.callDisplayConfig } };
    case 'SET_LEAGUE_STANDINGS':
      return { ...state, leagueStandings: action.standings };
    case 'SET_SHOW_STANDINGS':
      return { ...state, showStandings: action.show };
    case 'SET_BROADCAST_LIVE':
      return { ...state, publicBroadcastLive: action.live };
    case 'SET_CALL_SCREEN':
      return { ...state, callScreenActive: action.active };
    case 'SET_CONNECTED_JUDGES':
      return { ...state, connectedJudgeCount: action.count };
    case 'SET_TEAM_CALL_SHOW_PLAYERS':
      return { ...state, teamCallShowPlayers: action.show };

    case 'SELECT_CALL_PLAYER': {
      const selected = { ...(state.selectedCallPlayers || {}), [action.side]: action.player };
      return { ...state, selectedCallPlayers: selected };
    }

    case 'CLEAR_CALL_PLAYER_SELECTION': {
      const selected = { ...(state.selectedCallPlayers || {}) };
      delete selected[action.side];
      return { ...state, selectedCallPlayers: selected };
    }

    case 'CALL_TEAM': {
      if (action.side === 'hong' && state.teamCallStatus?.chung !== 'called' && state.teamCallStatus?.chung !== 'ready') return state;
      // Main Referee only command: never overlap an active broadcast animation.
      if (state.callAnimation || state.teamCallStatus?.[action.side] === 'calling' || state.singlePlayerCall?.status === 'calling' || state.matchupAnimation?.status === 'showing') {
        return state;
      }
      const animationId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ns = {
        ...state,
        callScreenActive: true,
        callAnimation: { ...buildTeamCallPhase(state, action.side, true), ts: Date.now() },
        teamCallStatus: { ...state.teamCallStatus, [action.side]: 'calling' as const },
        animationController: makeAnimationController(state, {
          state: 'CALLING_TEAM',
          activeAnimation: 'TEAM_CALL',
          animationId,
        }, `CALL_TEAM:${action.side}`),
      };
      // Keep the same stable id in the payload so replay/complete guards can
      // identify the exact invocation.
      ns.callAnimation = { ...ns.callAnimation, ts: Date.now() };
      return ns;
    }

    case 'COMPLETE_TEAM_CALL': {
      // Explicit Main Referee confirmation only — see AUTOMATIC CALL FLOW
      // §3/§9: this is the "WAIT FOR REFEREE CONFIRMATION" stop point and is
      // NEVER fired by a timer. The referee must press CONFIRM.
      if (!state.callAnimation || state.callAnimation.phase !== 'team' || !state.callAnimation.manualTeamCall) return state;
      if (action.animationId && state.animationController?.animationId && action.animationId !== state.animationController.animationId) return state;
      const confirmed: MatchState = {
        ...state,
        callAnimation: undefined,
        teamCallStatus: { ...state.teamCallStatus, [action.side]: 'called' as const },
        animationController: {
          ...(state.animationController || {}),
          state: 'TEAM_CALLED',
          activeAnimation: 'TEAM_CALL',
          completedAt: Date.now(),
          lastCommand: `TEAM_CALLED:${action.side}`,
        },
      };
      const autoPatch = autoAdvanceCallSequence(confirmed, action.side === 'hong' ? 'TEAM_HONG' : 'TEAM_CHUNG');
      return { ...confirmed, ...autoPatch };
    }

    case 'REPLAY_TEAM_CALL': {
      if (state.callAnimation || state.singlePlayerCall?.status === 'calling' || state.matchupAnimation?.status === 'showing') return state;
      if (state.teamCallStatus?.[action.side] !== 'called') return state;
      const animationId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        ...state,
        callScreenActive: true,
        callAnimation: buildTeamCallPhase(state, action.side, true),
        teamCallStatus: { ...state.teamCallStatus, [action.side]: 'calling' as const },
        animationController: makeAnimationController(state, {
          state: 'CALLING_TEAM',
          activeAnimation: 'TEAM_CALL',
          animationId,
        }, `REPLAY_TEAM_CALL:${action.side}`),
      };
    }

    case 'CANCEL_TEAM_CALL': {
      // Team-call-only cancel: never clears an active Player Call or Matchup.
      // This action is intentionally scoped to the Team Call cinematic.
      if (state.callAnimation?.phase !== 'team') {
        return {
          ...state,
          autoCallSequence: state.autoCallSequence ? { ...state.autoCallSequence, active: false } : state.autoCallSequence,
        };
      }
      const cancelledSide = state.callAnimation.side;
      return {
        ...state,
        callAnimation: undefined,
        callScreenActive: false,
        teamCallStatus: { ...state.teamCallStatus, [cancelledSide]: 'idle' as const },
        autoCallSequence: state.autoCallSequence ? { ...state.autoCallSequence, active: false } : state.autoCallSequence,
        animationController: {
          ...(state.animationController || {}),
          state: 'IDLE',
          activeAnimation: undefined,
          lastCommand: 'TEAM_CALL_CANCELLED',
          completedAt: Date.now(),
        },
      };
    }

    case 'RECALL_TEAM_CALL': {
      // Main Referee recovery control: from the AWAITING/confirmation point
      // the referee may recall either corner without restarting the intro,
      // round, score, or the whole automatic sequence. Manual recall takes
      // control of the call flow so no automatic stage can jump over it.
      if (state.singlePlayerCall?.status === 'calling' || state.matchupAnimation?.status === 'showing') return state;
      const animationId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        ...state,
        callScreenActive: true,
        callAnimation: { ...buildTeamCallPhase(state, action.side, true), ts: Date.now() },
        teamCallStatus: { ...state.teamCallStatus, [action.side]: 'calling' as const },
        autoCallSequence: state.autoCallSequence ? { ...state.autoCallSequence, active: false } : state.autoCallSequence,
        animationController: makeAnimationController(state, {
          state: 'CALLING_TEAM',
          activeAnimation: 'TEAM_CALL',
          animationId,
        }, `RECALL_TEAM_CALL:${action.side}`),
      };
    }

    case 'SET_CALL_CONTROL_WAITING': {
      // CANCEL CALL: immediately remove every individual-call visual from the
      // Public Display. Keep match/player/score/database state intact.
      return {
        ...state,
        callScreenActive: false,
        callAnimation: undefined,
        singlePlayerCall: undefined,
        matchupAnimation: undefined,
        callAnimationQueue: undefined,
        callSequence: undefined,
        playerCallPreviewState: undefined,
        autoCallSequence: state.autoCallSequence ? { ...state.autoCallSequence, active: false } : state.autoCallSequence,
        playerCallStatus: { chung: 'waiting', hong: 'waiting' },
        animationController: { ...(state.animationController || {}), state: 'IDLE', activeAnimation: undefined, lastCommand: 'CALL_CONTROL_WAITING', completedAt: Date.now() },
      };
    }

    case 'COMPLETE_SINGLE_PLAYER_CALL': {
      const call = state.singlePlayerCall;
      if (!call || call.animationId !== action.animationId || call.status !== 'calling') return state;
      const completed: MatchState = {
        ...state,
        singlePlayerCall: { ...call, status: 'called' },
        playerCallStatus: { ...state.playerCallStatus, [call.side]: 'called' as const },
        animationController: {
          ...(state.animationController || {}),
          state: 'PLAYER_CALLED',
          activeAnimation: 'SINGLE_PLAYER_CALL',
          animationId: call.animationId,
          completedAt: Date.now(),
          lastCommand: 'PLAYER_CALLED',
        },
      };
      // AUTO PLAYER CALL: BLUE automatically hands off to RED after its
      // configured dwell. RED deliberately stops at WAITING FOR REFEREE;
      // it never auto-confirms READY.
      if (completed.autoCallSequence?.active && completed.autoCallSequence.stage === 'PLAYER_CHUNG') {
        const autoPatch = autoAdvanceCallSequence(completed, 'PLAYER_CHUNG');
        return { ...completed, ...autoPatch };
      }
      return completed;
    }

    case 'START_CALL_ANIMATION': {
      // Blue is always first for the legacy/manual team-call entry too.
      // Red can only be started after Blue has been called/confirmed.
      if (action.side === 'hong' && state.teamCallStatus?.chung !== 'called' && state.teamCallStatus?.chung !== 'ready') return state;
      if (state.callAnimation || state.singlePlayerCall?.status === 'calling' || state.matchupAnimation?.status === 'showing') return state;
      const ns = structuredClone(state);
      ns.callAnimationQueue = action.queueNext;
      ns.callSequence = undefined;
      if (action.mode === 'call') {
        const second = action.queueNext || (action.side === 'chung' ? 'hong' : 'chung');
        ns.callSequence = action.queueNext ? { first: action.side, second, stage: 'team-second' } : undefined;
        ns.animationController = makeAnimationController(state, {
          state: 'CALLING_TEAM',
          activeAnimation: 'TEAM_CALL',
          animationId: `legacy-team-${Date.now()}`,
        }, `START_CALL_ANIMATION:${action.side}`);
        ns.callAnimation = {
          phase: 'team',
          side: action.side,
          teamName: ns.teamNames?.[action.side],
          clubName: ns.clubNames?.[action.side] || ns[action.side].player.club,
          teamLogo: ns.teamLogos?.[action.side],
          teamCountry: ns.teamCountry?.[action.side],
          teamCategory: ns.weightCategory,
          clubLogo: ns.clubLogos?.[action.side],
          roster: buildTeamRosterList(ns, action.side),
          tournamentName: ns.competitionName,
          manualTeamCall: false,
          ts: Date.now(),
        };
      } else {
        ns.callAnimation = buildPlayerCallPhase(ns, action.side);
      }
      return ns;
    }
    case 'ADVANCE_CALL_ANIMATION': {
      if (!state.callAnimation) return state;
      const ns = structuredClone(state);
      const seq = ns.callSequence;
      if (seq && ns.callAnimation.phase === 'team') {
        if (seq.stage === 'team-second') {
          // Team identity #2 — BEFORE either individual athlete is shown.
          ns.callAnimation = {
            phase: 'team',
            side: seq.second,
            teamName: ns.teamNames?.[seq.second],
            clubName: ns.clubNames?.[seq.second] || ns[seq.second].player.club,
            teamLogo: ns.teamLogos?.[seq.second],
            teamCountry: ns.teamCountry?.[seq.second],
            teamCategory: ns.weightCategory,
            clubLogo: ns.clubLogos?.[seq.second],
            roster: buildTeamRosterList(ns, seq.second),
            tournamentName: ns.competitionName,
            ts: Date.now(),
          };
          ns.callSequence.stage = 'player-first';
          return ns;
        }
      }
      if (seq && ns.callAnimation.phase === 'team' && seq.stage === 'player-first') {
        ns.callAnimation = buildPlayerCallPhase(ns, seq.first);
        return ns;
      }
      if (seq && ns.callAnimation.phase === 'player' && seq.stage === 'player-second') {
        ns.callAnimation = buildPlayerCallPhase(ns, seq.second);
        return ns;
      }
      // Inter-round / legacy call: team -> that player's card.
      if (ns.callAnimation.phase === 'team') {
        ns.callAnimation = buildPlayerCallPhase(ns, ns.callAnimation.side);
      }
      return ns;
    }
    case 'CLEAR_CALL_ANIMATION': {
      // Initial team-vs-team entrance sequence is completed only after both
      // team identities AND both individual athletes have been shown.
      if (state.callSequence) {
        const seq = state.callSequence;
        if (state.callAnimation?.phase === 'player' && seq.stage === 'player-first') {
          const ns = structuredClone(state);
          ns.callSequence.stage = 'player-second';
          ns.callAnimation = buildPlayerCallPhase(ns, seq.second);
          ns.callAnimationQueue = undefined;
          return ns;
        }
        if (state.callAnimation?.phase === 'player' && seq.stage === 'player-second') {
          return { ...state, callAnimation: undefined, callAnimationQueue: undefined, callSequence: undefined };
        }
        // Team phases are advanced by ADVANCE_CALL_ANIMATION, not cleared by
        // the normal player timer.
        return state;
      }
      // If a second side is queued, announce that player next. Team identity
      // is intentionally NOT shown here for inter-round/change-player calls.
      if (state.callAnimationQueue) {
        const ns = structuredClone(state);
        if (state.callAnimation?.phase === 'player') {
          ns.playerCallStatus = { ...ns.playerCallStatus, [state.callAnimation.side]: 'ready' as const };
        }
        const side = ns.callAnimationQueue!;
        ns.callAnimationQueue = undefined;
        const previewPlayer = state.pendingRoundStartAfterCall && state.roundCallPreview
          ? state.roundCallPreview[side]
          : undefined;
        const queuedName = previewPlayer?.name || ns[side].player.name;
        const queuedPhoto = previewPlayer?.photo || ns[side].player.photoUrl || ns[side].player.photo;
        const queuedNationality = previewPlayer?.nationality || ns[side].player.nationality;
        ns.selectedCallPlayers = {
          ...(ns.selectedCallPlayers || {}),
          [side]: {
            name: queuedName, nationality: queuedNationality, country: queuedNationality,
            playerNumber: previewPlayer?.playerNumber ?? ns[side].player.playerNumber,
            seedNumber: previewPlayer?.seedNumber ?? ns[side].player.seedNumber, photo: queuedPhoto,
            category: ns.weightCategory, teamName: ns.teamNames?.[side], teamLogo: ns.teamLogos?.[side],
            clubName: ns.clubNames?.[side] || ns[side].player.club, clubLogo: ns.clubLogos?.[side],
            rounds: ns.teamRoster?.[side]?.find(p => p.name === queuedName)?.rounds ?? 1,
          },
        };
        ns.playerCallStatus = { ...ns.playerCallStatus, [side]: 'calling' as const };
        ns.callAnimation = {
          phase: 'player',
          side,
          teamName: ns.teamNames?.[side],
          clubName: ns.clubNames?.[side] || ns[side].player.club,
          teamLogo: ns.teamLogos?.[side] || ns[side].player.teamLogo,
          clubLogo: ns.clubLogos?.[side] || ns[side].player.clubLogo,
          teamCountry: ns.teamCountry?.[side] || ns[side].player.nationality,
          playerName: previewPlayer?.name || ns[side].player.name,
          playerPhoto: previewPlayer?.photo || ns[side].player.photoUrl || ns[side].player.photo,
          playerNationality: previewPlayer?.nationality || ns[side].player.nationality,
          playerNumber: previewPlayer?.playerNumber ?? ns[side].player.playerNumber,
          seedNumber: previewPlayer?.seedNumber ?? ns[side].player.seedNumber,
          teamPlayerNumber: ns.teamRoster?.[side]
            ? ((ns.teamRoster![side].findIndex(p => p.name === (previewPlayer?.name || ns[side].player.name)) + 1) || undefined)
            : undefined,
          category: ns.weightCategory,
          gender: ns.gender,
          tournamentName: ns.competitionName,
          ts: Date.now(),
        };
        return ns;
      }
      if (state.pendingRoundStartAfterCall) {
        const ns = structuredClone(state);
        if (state.callAnimation?.phase === 'player') {
          ns.playerCallStatus = { ...ns.playerCallStatus, [state.callAnimation.side]: 'ready' as const };
        }
        ns.pendingRoundStartAfterCall = false;
        ns.roundCallPreview = undefined;
        ns.callAnimation = undefined;
        return matchReducer(ns, { type: 'START_NEXT_ROUND' });
      }
      return { ...state, callAnimation: undefined, animationController: { ...(state.animationController || {}), state: 'PLAYER_CALLED', activeAnimation: 'SINGLE_PLAYER_CALL', completedAt: Date.now(), lastCommand: 'CALL_ANIMATION_COMPLETED' } };
    }
    case 'SET_STATE':
      return action.state;
    case 'RESTORE_STATE':
      // Restores are deliberately non-automatic: never let the automatic
      // call-flow bootstrap jump past the referee's safe recovery point.
      return { ...structuredClone(action.state), callFlowAutoStartBlocked: true, autoCallSequence: action.state.autoCallSequence ? { ...action.state.autoCallSequence, active: false } : action.state.autoCallSequence };
    case 'SET_ROUND_WINNER': {
      const ns = structuredClone(state);
      ns.roundWinners = [...ns.roundWinners.filter(r => r.round !== action.roundWinner.round), action.roundWinner];
      return ns;
    }
    case 'AWAITING_ROUND_START':
      return { ...state, awaitingRoundStart: true, status: 'paused' };
    case 'SET_TIE_REVIEW_PHASE':
      if (!state.pendingRoundDecision) return state;
      return { ...state, roundTieReview: { phase: action.phase, countdownStep: action.countdownStep, votes: state.roundTieReview?.votes || {}, judgeNames: action.judgeNames || state.roundTieReview?.judgeNames, judgePhotos: state.roundTieReview?.judgePhotos, ts: Date.now() } };
    case 'SET_TIE_REVIEW_JUDGES': {
      if (!state.pendingRoundDecision) return state;
      return { ...state, roundTieReview: { phase: state.roundTieReview?.phase || 'summons', countdownStep: state.roundTieReview?.countdownStep, votes: state.roundTieReview?.votes || {}, judgeNames: action.judgeNames || state.roundTieReview?.judgeNames, judgePhotos: action.judgePhotos || state.roundTieReview?.judgePhotos, ts: Date.now() } };
    }
    case 'SET_TIE_REVIEW_VOTE': {
      if (!state.pendingRoundDecision || state.roundTieReview?.phase !== 'voting') return state;
      const votes = { ...(state.roundTieReview?.votes || {}), [action.judge]: action.winner };
      return { ...state, roundTieReview: { phase: 'voting', votes, judgeNames: state.roundTieReview?.judgeNames, judgePhotos: state.roundTieReview?.judgePhotos, ts: Date.now() } };
    }
    case 'CONFIRM_AI_TIE_DECISION': {
      if (!state.pendingRoundDecision || state.config.competitionMode === 'par_equipe') return state;
      return resolveDrawRound(state, action.winner, 'AI_RECOMMENDATION', state.roundTieReview?.votes);
    }
    case 'RESOLVE_DRAW_ROUND':
      return resolveDrawRound(state, action.winner, action.decisionType || 'WOOSE_GIROK', action.votes || state.roundTieReview?.votes);
    case 'CONFIRM_PTG': {
      // Referee confirms PTG → actually end the round with 'ptg' method, then clear flags.
      const ns = endRound(structuredClone(state), 'ptg');
      ns.ptgActive = false;
      ns.ptgWinner = undefined;
      ns.ptgValueAtTrigger = undefined;
      return ns;
    }
    case 'SKIP_PTG': {
      // Skipping PTG means bypassing the PTG confirmation UI, not continuing
      // the same round. The round ends using the normal result calculation
      // and the official rest period starts immediately.
      const ns = endRound(structuredClone(state));
      ns.ptgActive = false;
      ns.ptgWinner = undefined;
      ns.ptgValueAtTrigger = undefined;
      return ns;
    }
    case 'DECREMENT_IVR': {
      const ns = structuredClone(state);
      const p = ns[action.player];
      p.ivrQuota = Math.max(0, (p.ivrQuota || 0) - 1);
      const entry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        matchNumber: ns.matchNumber,
        competitionName: ns.competitionName,
        side: action.player,
        playerName: p.player.name || action.player,
        coachName: action.coachName,
        reason: action.reason || 'Referee rejected video replay challenge',
        remainingCards: p.ivrQuota,
      };
      ns.ivrLog = [...(ns.ivrLog || []), entry];
      ns.ivrAnimation = { decision: 'rejected', side: action.player, ts: Date.now() };
      // Persist to localStorage for cross-match Admin history
      try {
        const key = 'tkd-ivr-log';
        const prev = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify([...prev, entry].slice(-500)));
      } catch {}
      return ns;
    }
    case 'IVR_ANIMATE':
      return { ...state, ivrAnimation: { decision: action.decision, side: action.side, ts: Date.now() } };
    case 'CLEAR_IVR_ANIMATE':
      return { ...state, ivrAnimation: undefined };
    case 'KO_ANIMATE':
      return { ...state, koAnimation: { side: action.side, ts: Date.now() } };
    case 'CLEAR_KO_ANIMATE':
      return { ...state, koAnimation: undefined };
    case 'GOLDEN_POINT_ANIMATE':
      return { ...state, goldenPointAnimation: { ts: Date.now() } };
    case 'CLEAR_GOLDEN_POINT_ANIMATE':
      return { ...state, goldenPointAnimation: undefined };

    // Replays whichever call is currently on screen (team/player OR single
    // player) by bumping its ts — read by the overlays as their restart key.
    // Never touches score/timer/round/winner/player selection.
    case 'REPLAY_CALL_ANIMATION': {
      if (!state.callAnimation) return state;
      return { ...state, callAnimation: { ...state.callAnimation, ts: Date.now() } };
    }

    // ===== SINGLE PLAYER CALL =====
    case 'CALL_SINGLE_PLAYER': {
      // BLUE is always the first player call. A fresh RED call is rejected
      // until BLUE has been confirmed READY. Recall actions use separate
      // reducer cases and therefore remain independent.
      if (action.side === 'hong' && state.playerCallStatus?.chung !== 'ready') return state;
      // A single-player call is always one athlete, selected explicitly by
      // the Main Referee. Never overlap team/matchup animations.
      if (state.callAnimation || state.singlePlayerCall?.status === 'calling' || state.matchupAnimation?.status === 'showing') return state;
      const animationId = `spc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // NORMAL 1v1 Player Call must never require manual name entry. Resolve
      // the athlete from the live match first; if the match was created
      // without player metadata, use the official corner fallback used by
      // the cinematic. This keeps the animation callable for an empty match
      // while still using real player data whenever it exists.
      const fallbackName = action.side === 'chung' ? 'CHUNG (청)' : 'HONG (홍)';
      const resolvedName = action.playerName?.trim()
        || state.selectedCallPlayers?.[action.side]?.name?.trim()
        || state[action.side]?.player?.name?.trim()
        || fallbackName;
      const selected = { ...(state.selectedCallPlayers || {}), [action.side]: {
        name: resolvedName,
        photo: action.playerPhoto,
        playerNumber: action.playerNumber,
        seedNumber: action.seedNumber,
        category: action.category,
        teamName: action.teamName,
        teamLogo: action.teamLogo,
        clubName: action.clubName,
        clubLogo: action.clubLogo,
        country: action.country,
        nationality: action.country,
        rounds: state.teamRoster?.[action.side]?.find(p => p.name === action.playerName)?.rounds ?? 1,
      } };
      return {
        ...state,
        selectedCallPlayers: selected,
        playerCallStatus: { ...state.playerCallStatus, [action.side]: 'calling' as const },
        singlePlayerCall: {
          side: action.side,
          animationId,
          status: 'calling',
          ts: Date.now(),
          playerName: resolvedName,
          playerPhoto: action.playerPhoto,
          playerNumber: action.playerNumber,
          seedNumber: action.seedNumber,
          category: action.category,
          teamName: action.teamName,
          teamLogo: action.teamLogo,
          clubName: action.clubName,
          clubLogo: action.clubLogo,
          country: action.country,
          matNumber: state.matNumber,
        },
        animationController: makeAnimationController(state, {
          state: 'CALLING_PLAYER',
          activeAnimation: 'SINGLE_PLAYER_CALL',
          animationId,
        }, `CALL_SINGLE_PLAYER:${action.side}`),
      };
    }
    case 'MARK_SINGLE_PLAYER_READY': {
      // Explicit Main Referee confirmation ("WAIT FOR REFEREE" → CONFIRM) —
      // never fired automatically. See AUTOMATIC CALL FLOW §6/§9.
      const side = action.side;
      if (state.playerCallStatus?.[side] !== 'called') return state;
      const active = state.singlePlayerCall?.side === side ? state.singlePlayerCall : undefined;
      const confirmed: MatchState = {
        ...state,
        playerCallPreviewState: undefined,
        singlePlayerCall: active ? { ...active, status: 'ready' } : state.singlePlayerCall,
        playerCallStatus: { ...state.playerCallStatus, [side]: 'ready' as const },
        animationController: {
          ...(state.animationController || {}),
          state: 'PLAYER_CALLED',
          activeAnimation: 'SINGLE_PLAYER_CALL',
          animationId: active?.animationId || state.animationController?.animationId,
          lastCommand: `PLAYER_READY:${side}`,
        },
      };
      // READY is the final call-screen stop. The UI schedules the exact
      // 3-second READY hold and then sends GO_LIVE_BROADCAST. Do not create
      // a MATCHUP stage here: READY must remain the only public frame during
      // the hand-off, then the live match appears cleanly.
      if (side === 'hong') {
        return {
          ...confirmed,
          autoCallSequence: confirmed.autoCallSequence
            ? { ...confirmed.autoCallSequence, active: false, stage: 'DONE', stageEndsAt: undefined }
            : confirmed.autoCallSequence,
        };
      }
      const autoPatch = autoAdvanceCallSequence(confirmed, 'PLAYER_CHUNG');
      return { ...confirmed, ...autoPatch };
    }
    case 'SET_PLAYER_CALL_PREVIEW_STATE':
      return { ...state, playerCallPreviewState: action.state };

    case 'REPLAY_SINGLE_PLAYER_CALL': {
      // Replay never changes score/timer/round/winner/player selection.
      if (!state.singlePlayerCall || state.singlePlayerCall.status === 'calling') return state;
      const animationId = `spc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        ...state,
        singlePlayerCall: { ...state.singlePlayerCall, animationId, status: 'calling', ts: Date.now() },
        playerCallStatus: { ...state.playerCallStatus, [state.singlePlayerCall.side]: 'calling' as const },
        animationController: makeAnimationController(state, {
          state: 'CALLING_PLAYER',
          activeAnimation: 'SINGLE_PLAYER_CALL',
          animationId,
        }, 'REPLAY_SINGLE_PLAYER_CALL'),
      };
    }
    case 'RECALL_SINGLE_PLAYER_CALL': {
      // Referee may recall either corner independently from the AWAITING/READY stop.
      // This does not reset the round, score, timer, or the other player's selection.
      const side = action.side;
      const selected = state.selectedCallPlayers?.[side];
      if (!selected?.name) return state;
      const animationId = `spc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const call = {
        side,
        animationId,
        status: 'calling' as const,
        ts: Date.now(),
        playerName: selected.name,
        playerPhoto: selected.photo,
        playerNumber: selected.playerNumber,
        seedNumber: selected.seedNumber,
        category: selected.category,
        teamName: selected.teamName,
        teamLogo: selected.teamLogo,
        clubName: selected.clubName,
        clubLogo: selected.clubLogo,
        country: selected.country || selected.nationality,
        matNumber: state.matNumber,
      };
      return {
        ...state,
        singlePlayerCall: call,
        playerCallStatus: { ...state.playerCallStatus, [side]: 'calling' as const },
        animationController: makeAnimationController(state, {
          state: 'CALLING_PLAYER',
          activeAnimation: 'SINGLE_PLAYER_CALL',
          animationId,
        }, `RECALL_SINGLE_PLAYER_CALL:${side}`),
      };
    }
    case 'RECALL_ROUND_PLAYER_CALL': {
      // During the round-bound AWAITING stop the referee may choose either
      // corner, even if the other corner was shown most recently. This is
      // recall-only: it never changes round, score, clock or roster assignment.
      const side = action.side;
      if (!state.pendingRoundStartAfterCall) return state;
      const selected = state.selectedCallPlayers?.[side];
      if (!selected?.name) return state;

      const animationId = `round-spc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const current = state.callAnimation?.phase === 'player' ? state.callAnimation : undefined;
      const callAnimation: CallAnimation = {
        ...(current || {}),
        phase: 'player',
        side,
        animationId,
        ts: Date.now(),
        playerName: selected.name,
        playerPhoto: selected.photo,
        playerNumber: selected.playerNumber,
        seedNumber: selected.seedNumber,
        category: selected.category,
        teamName: selected.teamName,
        teamLogo: selected.teamLogo,
        clubName: selected.clubName,
        clubLogo: selected.clubLogo,
        teamCountry: selected.country || selected.nationality,
        playerNationality: selected.country || selected.nationality,
        tournamentName: state.competitionName,
      };

      return {
        ...state,
        callAnimation,
        playerCallStatus: { ...state.playerCallStatus, [side]: 'calling' as const },
        animationController: makeAnimationController(state, {
          state: 'CALLING_PLAYER',
          activeAnimation: 'SINGLE_PLAYER_CALL',
          animationId,
        }, `RECALL_ROUND_PLAYER_CALL:${side}`),
      };
    }

    case 'CLEAR_SINGLE_PLAYER_CALL':
      return { ...state, playerCallPreviewState: undefined, singlePlayerCall: undefined, playerCallStatus: { ...state.playerCallStatus, ...(state.singlePlayerCall ? { [state.singlePlayerCall.side]: 'waiting' as const } : {}) }, animationController: { ...(state.animationController || {}), state: 'IDLE', activeAnimation: undefined, lastCommand: 'CLEAR_SINGLE_PLAYER_CALL' } };
    case 'GO_LIVE_BROADCAST': {
      // TV / GO LIVE hand-off: remove only the public call/matchup overlays.
      // Match score, timer, players, teams, selected players and tournament
      // data remain untouched; the live scoreboard becomes visible immediately.
      return {
        ...state,
        callAnimation: undefined,
        singlePlayerCall: undefined,
        playerCallPreviewState: undefined,
        matchupAnimation: undefined,
        callSequence: undefined,
        callAnimationQueue: undefined,
        callScreenActive: false,
        autoCallSequence: state.autoCallSequence ? { ...state.autoCallSequence, active: false } : state.autoCallSequence,
        animationController: {
          ...(state.animationController || {}),
          state: 'IDLE',
          activeAnimation: undefined,
          lastCommand: 'GO_LIVE_BROADCAST',
          completedAt: Date.now(),
        },
      };
    }

    case 'STOP_BROADCAST_ANIMATION': {
      const teamSide = state.callAnimation?.phase === 'team' ? state.callAnimation.side : undefined;
      const playerSide = state.singlePlayerCall?.side;
      return {
        ...state,
        callAnimation: undefined,
        singlePlayerCall: undefined,
        playerCallPreviewState: undefined,
        matchupAnimation: undefined,
        callSequence: undefined,
        callAnimationQueue: undefined,
        callScreenActive: false,
        teamCallStatus: teamSide ? { ...state.teamCallStatus, [teamSide]: 'idle' as const } : state.teamCallStatus,
        playerCallStatus: playerSide ? { ...state.playerCallStatus, [playerSide]: 'waiting' as const } : state.playerCallStatus,
        // An emergency STOP always hands full control back to the referee —
        // never silently resume auto-advancing after an operator-initiated
        // stop (spec §9/§14: no accidental auto-continue).
        autoCallSequence: state.autoCallSequence ? { ...state.autoCallSequence, active: false } : state.autoCallSequence,
        animationController: {
          ...(state.animationController || {}),
          state: 'IDLE',
          activeAnimation: undefined,
          animationId: undefined,
          completedAt: undefined,
          lastCommand: 'STOP_BROADCAST_ANIMATION',
        },
      };
    }

    case 'JUMP_TEAM_CALL_STAGE': {
      const stage = action.stage;
      if (stage === 'intro' || stage === 'waiting') {
        return {
          ...state,
          callAnimation: undefined,
          callScreenActive: true,
          teamCallStatus: { chung: 'called', hong: 'called' },
          autoCallSequence: { active: true, stage: 'GREETING', startedAt: Date.now(), mode: 'teams' },
          animationController: { ...(state.animationController || {}), state: 'TEAM_CALLED', activeAnimation: 'TEAM_CALL', lastCommand: `TEAM_CALL_JUMP:${stage}`, completedAt: Date.now() },
        };
      }
      if (stage === 'blue' || stage === 'red') {
        const side: PlayerColor = stage === 'blue' ? 'chung' : 'hong';
        const animationId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return {
          ...state,
          callScreenActive: true,
          callAnimation: { ...buildTeamCallPhase(state, side, true), ts: Date.now() },
          teamCallStatus: { ...state.teamCallStatus, ...(stage === 'red' ? { chung: 'called' as const } : {}), [side]: 'calling' as const },
          autoCallSequence: { active: true, stage: stage === 'blue' ? 'TEAM_CHUNG' : 'TEAM_HONG', startedAt: Date.now(), mode: 'teams', stageEndsAt: state.config.teamCallAutoEnabled === false ? undefined : Date.now() + Math.max(0.5, stage === 'blue' ? state.config.teamCallBlueSeconds ?? 3 : state.config.teamCallRedSeconds ?? 3) * 1000 },
          animationController: makeAnimationController(state, { state: 'CALLING_TEAM', activeAnimation: 'TEAM_CALL', animationId }, `TEAM_CALL_JUMP:${stage}`),
        };
      }
      if (stage === 'ready') {
        return {
          ...state,
          callAnimation: undefined,
          callScreenActive: true,
          teamCallStatus: { chung: 'ready', hong: 'ready' },
          autoCallSequence: { active: true, stage: 'GREETING', startedAt: Date.now(), mode: 'teams' },
          animationController: { ...(state.animationController || {}), state: 'MATCH_READY', activeAnimation: 'TEAM_CALL', lastCommand: 'TEAM_CALL_JUMP:ready', completedAt: Date.now() },
        };
      }
      return {
        ...state,
        callAnimation: undefined,
        singlePlayerCall: undefined,
        matchupAnimation: undefined,
        callScreenActive: false,
        autoCallSequence: state.autoCallSequence ? { ...state.autoCallSequence, active: false, stage: 'DONE' } : state.autoCallSequence,
        animationController: { ...(state.animationController || {}), state: 'IDLE', activeAnimation: undefined, lastCommand: 'TEAM_CALL_JUMP:live', completedAt: Date.now() },
      };
    }

    // ===== MATCHUP (SHOW MATCHUP) =====
    case 'SHOW_MATCHUP': {
      if (state.matchupAnimation?.status === 'showing') return state;
      if (state.callAnimation || state.singlePlayerCall?.status === 'calling') return state;
      if (!state.selectedCallPlayers?.hong?.name || !state.selectedCallPlayers?.chung?.name) return state;
      const redPlayerStatus = state.playerCallStatus?.hong;
      const bluePlayerStatus = state.playerCallStatus?.chung;
      if (!['called', 'ready'].includes(redPlayerStatus) || !['called', 'ready'].includes(bluePlayerStatus)) return state;
      const animationId = `mu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        ...state,
        matchupAnimation: { animationId, status: 'showing', ts: Date.now() },
        animationController: makeAnimationController(state, {
          state: 'SHOWING_MATCHUP',
          activeAnimation: 'MATCHUP',
          animationId,
        }, 'SHOW_MATCHUP'),
      };
    }
    case 'MARK_MATCHUP_READY': {
      // Final explicit Main Referee confirmation of the automatic call
      // flow — the match itself is still never auto-started (§9/§21).
      if (!state.matchupAnimation || state.matchupAnimation.status !== 'showing') return state;
      if (state.playerCallStatus?.hong !== 'ready' || state.playerCallStatus?.chung !== 'ready') return state;
      const confirmed: MatchState = {
        ...state,
        matchupAnimation: { ...state.matchupAnimation, status: 'ready' },
        animationController: {
          ...(state.animationController || {}),
          state: 'MATCH_READY',
          activeAnimation: 'MATCHUP',
          lastCommand: 'MATCH_READY',
        },
      };
      const autoPatch = autoAdvanceCallSequence(confirmed, 'MATCHUP');
      return { ...confirmed, ...autoPatch };
    }
    case 'REPLAY_MATCHUP': {
      if (!state.matchupAnimation || state.matchupAnimation.status === 'showing') return state;
      const animationId = `mu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        ...state,
        matchupAnimation: { ...state.matchupAnimation, animationId, status: 'showing', ts: Date.now() },
        animationController: makeAnimationController(state, {
          state: 'SHOWING_MATCHUP',
          activeAnimation: 'MATCHUP',
          animationId,
        }, 'REPLAY_MATCHUP'),
      };
    }
    case 'CLEAR_MATCHUP':
      return { ...state, matchupAnimation: undefined, animationController: { ...(state.animationController || {}), state: 'IDLE', activeAnimation: undefined, lastCommand: 'CLEAR_MATCHUP' } };

    // ===== AUTOMATIC CALL FLOW =====
    case 'START_TEAM_CALL_SEQUENCE': {
      if (!isParEquipeMatch(state)) return state;
      if (state.callAnimation || state.singlePlayerCall?.status === 'calling' || state.matchupAnimation?.status === 'showing') return state;
      const animationId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return { ...state, callScreenActive: true, callAnimation: { ...buildTeamCallPhase(state, 'chung', true), ts: Date.now() }, teamCallStatus: { ...state.teamCallStatus, chung: 'calling' as const }, animationController: makeAnimationController(state, { state: 'CALLING_TEAM', activeAnimation: 'TEAM_CALL', animationId }, 'AUTO_TEAMS:CALL_TEAM:chung'), autoCallSequence: { active: true, stage: 'TEAM_CHUNG', startedAt: Date.now(), mode: 'teams', stageEndsAt: state.config.teamCallAutoEnabled === false ? undefined : Date.now() + Math.max(0.5, state.config.teamCallBlueSeconds ?? 3) * 1000 } };
    }

    case 'START_PLAYER_CALL_SEQUENCE': {
      // Main Referee direct Player Call works for BOTH 1v1 and Par Équipe.
      // IMPORTANT: a stale TEAM_CALL/callAnimation from a previous stage must
      // never block a normal 1v1 Player Call. In 1v1 we own the public overlay
      // here, so clear only stale call-visual state before starting the player
      // cinematic; match/score/timer/database state is untouched.
      // Do not let a stale MATCHUP marker make the Individual Player Call
      // button appear to do nothing. A new explicit Player Call owns the
      // public call layer and clears only stale call visuals.
      if (state.singlePlayerCall?.status === 'calling') return state;

      const isPar = isParEquipeMatch(state);
      const isFirstEntrance = state.status === 'waiting' && state.currentRound === 1;
      const roundIdx = isFirstEntrance ? state.currentRound - 1 : state.currentRound;
      const rosterEntry = isPar ? getRotationEntryForRound(state.teamRoster?.chung, roundIdx) : undefined;
      const player = state.chung.player;
      const selected = state.selectedCallPlayers?.chung;
      // No player info entered anywhere: fall back to a demo identity so the
      // Player Call can still be triggered and previewed (name, club, photo).
      const name = rosterEntry?.name || selected?.name || player?.name || 'CHUNG (청)';

      const selection: CallPlayerSelection = {
        name,
        nationality: rosterEntry?.nationality || selected?.nationality || selected?.country || player.nationality,
        playerNumber: rosterEntry?.playerNumber ?? selected?.playerNumber ?? player.playerNumber,
        seedNumber: rosterEntry?.seedNumber ?? selected?.seedNumber ?? player.seedNumber,
        photo: rosterEntry?.photo || selected?.photo || player.photoUrl || player.photo,
        category: selected?.category || state.weightCategory || player.category,
        teamName: selected?.teamName || state.teamNames?.chung,
        teamLogo: selected?.teamLogo || state.teamLogos?.chung || player.teamLogo,
        clubName: selected?.clubName || state.clubNames?.chung || player.club || 'CHUNG CLUB',
        clubLogo: selected?.clubLogo || state.clubLogos?.chung || player.clubLogo,
        country: rosterEntry?.nationality || selected?.country || selected?.nationality || player.nationality || state.teamCountry?.chung,
        rounds: rosterEntry?.rounds ?? 1,
      };
      const animationId = `spc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        ...state,
        // A 1v1 Player Call must own the public call layer even if a previous
        // team/legacy call left a stale visual marker behind.
        callAnimation: undefined,
        callSequence: undefined,
        callAnimationQueue: undefined,
        playerCallPreviewState: undefined,
        matchupAnimation: undefined,
        callScreenActive: true,
        selectedCallPlayers: { ...(state.selectedCallPlayers || {}), chung: selection },
        playerCallStatus: { ...state.playerCallStatus, chung: 'calling' as const },
        singlePlayerCall: {
          side: 'chung', animationId, status: 'calling', ts: Date.now(),
          playerName: selection.name, playerPhoto: selection.photo, playerNumber: selection.playerNumber,
          seedNumber: selection.seedNumber, category: selection.category, teamName: selection.teamName,
          teamLogo: selection.teamLogo, clubName: selection.clubName, clubLogo: selection.clubLogo,
          country: selection.country,
        },
        animationController: makeAnimationController(state, {
          state: 'CALLING_PLAYER', activeAnimation: 'SINGLE_PLAYER_CALL', animationId,
        }, 'MAIN_REFEREE:START_PLAYER_CALL'),
        autoCallSequence: { active: true, stage: 'PLAYER_CHUNG', startedAt: Date.now(), mode: 'players', stageEndsAt: Date.now() + Math.max(0.5, state.config.playerCallBlueSeconds ?? 3) * 1000 },
      };
    }

    case 'START_AUTO_CALL_SEQUENCE': {
      // Main Referee only. Never interrupt an active broadcast.
      if (state.callAnimation || state.teamCallStatus?.chung === 'calling' || state.singlePlayerCall?.status === 'calling' || state.matchupAnimation?.status === 'showing') {
        return state;
      }

      // NORMAL 1v1: there is no team-call stage. Start the BLUE player's
      // player-call animation directly, then wait for referee confirmation;
      // confirmation advances to RED, then to MATCHUP.
      if (!isParEquipeMatch(state)) {
        const selected = state.selectedCallPlayers?.chung;
        const player = state.chung.player;
        const name = selected?.name || player?.name || 'CHUNG (청)';
        const animationId = `spc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const selection: CallPlayerSelection = {
          name,
          nationality: selected?.nationality || selected?.country || player.nationality,
          playerNumber: selected?.playerNumber ?? player.playerNumber,
          seedNumber: selected?.seedNumber ?? player.seedNumber,
          photo: selected?.photo || player.photoUrl || player.photo,
          category: selected?.category || state.weightCategory || player.category,
          teamName: selected?.teamName || state.teamNames?.chung,
          teamLogo: selected?.teamLogo || state.teamLogos?.chung || player.teamLogo,
          clubName: selected?.clubName || state.clubNames?.chung || player.club || 'CHUNG CLUB',
          clubLogo: selected?.clubLogo || state.clubLogos?.chung || player.clubLogo,
          country: selected?.country || selected?.nationality || player.nationality || state.teamCountry?.chung,
          rounds: 1,
        };
        return {
          ...state,
          callScreenActive: true,
          selectedCallPlayers: { ...(state.selectedCallPlayers || {}), chung: selection },
          playerCallStatus: { ...state.playerCallStatus, chung: 'calling' as const },
          singlePlayerCall: {
            side: 'chung', animationId, status: 'calling', ts: Date.now(),
            playerName: selection.name, playerPhoto: selection.photo, playerNumber: selection.playerNumber,
            seedNumber: selection.seedNumber, category: selection.category, teamName: selection.teamName,
            teamLogo: selection.teamLogo, clubName: selection.clubName, clubLogo: selection.clubLogo,
            country: selection.country,
          },
          animationController: makeAnimationController(state, {
            state: 'CALLING_PLAYER', activeAnimation: 'SINGLE_PLAYER_CALL', animationId,
          }, 'AUTO:CALL_SINGLE_PLAYER:chung'),
          autoCallSequence: { active: true, stage: 'PLAYER_CHUNG', startedAt: Date.now(), mode: 'full', stageEndsAt: Date.now() + Math.max(0.5, state.config.playerCallBlueSeconds ?? 3) * 1000 },
        };
      }

      // PAR ÉQUIPE now starts directly with the Player Call animation.
      // Team Call was removed from the public/referee workflow.
      const isFirstEntrance = state.status === 'waiting' && state.currentRound === 1;
      const roundIdx = isFirstEntrance ? state.currentRound - 1 : state.currentRound;
      const rosterEntry = getRotationEntryForRound(state.teamRoster?.chung, roundIdx);
      const player = state.chung.player;
      const name = rosterEntry?.name || state.selectedCallPlayers?.chung?.name || player?.name || 'CHUNG (청)';
      const animationId = `spc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const selection: CallPlayerSelection = {
        name,
        nationality: rosterEntry?.nationality || state.selectedCallPlayers?.chung?.nationality || player.nationality,
        playerNumber: rosterEntry?.playerNumber ?? state.selectedCallPlayers?.chung?.playerNumber ?? player.playerNumber,
        seedNumber: rosterEntry?.seedNumber ?? state.selectedCallPlayers?.chung?.seedNumber ?? player.seedNumber,
        photo: rosterEntry?.photo || state.selectedCallPlayers?.chung?.photo || player.photoUrl || player.photo,
        category: state.selectedCallPlayers?.chung?.category || state.weightCategory || player.category,
        teamName: state.selectedCallPlayers?.chung?.teamName || state.teamNames?.chung,
        teamLogo: state.selectedCallPlayers?.chung?.teamLogo || state.teamLogos?.chung || player.teamLogo,
        clubName: state.selectedCallPlayers?.chung?.clubName || state.clubNames?.chung || player.club || 'CHUNG CLUB',
        clubLogo: state.selectedCallPlayers?.chung?.clubLogo || state.clubLogos?.chung || player.clubLogo,
        country: rosterEntry?.nationality || state.selectedCallPlayers?.chung?.country || player.nationality || state.teamCountry?.chung,
        rounds: rosterEntry?.rounds ?? 1,
      };
      return {
        ...state,
        callScreenActive: true,
        selectedCallPlayers: { ...(state.selectedCallPlayers || {}), chung: selection },
        playerCallStatus: { ...state.playerCallStatus, chung: 'calling' as const },
        singlePlayerCall: {
          side: 'chung', animationId, status: 'calling', ts: Date.now(),
          playerName: selection.name, playerPhoto: selection.photo, playerNumber: selection.playerNumber,
          seedNumber: selection.seedNumber, category: selection.category, teamName: selection.teamName,
          teamLogo: selection.teamLogo, clubName: selection.clubName, clubLogo: selection.clubLogo,
          country: selection.country,
        },
        animationController: makeAnimationController(state, { state: 'CALLING_PLAYER', activeAnimation: 'SINGLE_PLAYER_CALL', animationId }, 'AUTO:CALL_SINGLE_PLAYER:chung'),
        autoCallSequence: { active: true, stage: 'PLAYER_CHUNG', startedAt: Date.now(), mode: 'full', stageEndsAt: Date.now() + Math.max(0.5, state.config.playerCallBlueSeconds ?? 3) * 1000 },
      };
    }
    case 'AUTO_SHOW_MATCHUP_AFTER_DELAY': {
      const seq = state.autoCallSequence;
      if (!seq?.active || seq.stage !== 'MATCHUP_DELAY') return state;
      // Keep the transition referee-safe: this only reveals the matchup
      // screen; the referee still has the final MATCH READY / START control.
      const animationId = `mu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        ...state,
        matchupAnimation: { animationId, status: 'showing', ts: Date.now() },
        animationController: makeAnimationController(state, {
          state: 'SHOWING_MATCHUP',
          activeAnimation: 'MATCHUP',
          animationId,
        }, 'AUTO:SHOW_MATCHUP_AFTER_READY_DELAY'),
        autoCallSequence: { ...seq, stage: 'MATCHUP', stageEndsAt: undefined },
      };
    }

    case 'CANCEL_AUTO_CALL_SEQUENCE':
      // Only stops the automatic hand-off between stages. Never rewinds or
      // clears whatever animation/state is currently on screen — the
      // referee keeps full manual control from this point on.
      if (!state.autoCallSequence) return state;
      return { ...state, autoCallSequence: { ...state.autoCallSequence, active: false } };

    case 'COMPLETE_GREETING_WAIT': {
      // Referee confirms the "waiting for greeting" stop (both teams have
      // bowed/greeted) — advances the auto sequence into the player-call
      // stage. Only meaningful while the sequence is actually paused there.
      if (!state.autoCallSequence?.active || state.autoCallSequence.stage !== 'GREETING') return state;
      if (state.autoCallSequence.mode === 'teams') {
        return { ...state, autoCallSequence: { ...state.autoCallSequence, active: false, stage: 'DONE' }, animationController: { ...(state.animationController || {}), state: 'MATCH_READY', activeAnimation: 'TEAM_CALL', lastCommand: 'TEAM_CALL_READY' } };
      }
      const autoPatch = autoAdvanceCallSequence(state, 'GREETING');
      return { ...state, ...autoPatch };
    }

    case 'CALL_NEXT_ROUND_PLAYERS': {
      // Par Équipe "call next round's players" — replaces the old
      // legacy team-style call (START_CALL_ANIMATION) with the modern
      // player-call animation used everywhere else. Calls BLUE (chung)
      // first; confirming it auto-advances to RED (hong) and then to
      // MATCHUP, by reusing the exact same PLAYER_CHUNG/PLAYER_HONG
      // hand-off as the full automatic call flow (see
      // autoAdvanceCallSequence) — just entered directly at the
      // player-call stage, skipping the team-call/greeting stages since
      // both teams were already called at the start of the match.
      if (state.callAnimation || state.singlePlayerCall?.status === 'calling' || state.matchupAnimation?.status === 'showing') {
        return state;
      }
      // While still 'waiting' before round 1 has ever started, the round
      // about to be called IS round 1 (index 0). Between rounds (status
      // 'rest', or 'paused' awaiting the next round to start), currentRound
      // still holds the round that just finished — so the upcoming round's
      // roster index is currentRound (0-based next round).
      const isFirstEntrance = state.status === 'waiting' && state.currentRound === 1;
      const roundIdx = isFirstEntrance ? state.currentRound - 1 : state.currentRound;
      const chungRosterEntry = getRotationEntryForRound(state.teamRoster?.chung, roundIdx);
      const chungPlayer = state.chung.player;
      const chungName = chungRosterEntry?.name || chungPlayer?.name || 'CHUNG (청)';
      const animationId = `spc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const selection: CallPlayerSelection = {
        name: chungName,
        nationality: chungRosterEntry?.nationality || chungPlayer.nationality,
        playerNumber: chungRosterEntry?.playerNumber ?? chungPlayer.playerNumber,
        seedNumber: chungRosterEntry?.seedNumber ?? chungPlayer.seedNumber,
        photo: chungRosterEntry?.photo || chungPlayer.photoUrl || chungPlayer.photo,
        category: state.weightCategory || chungPlayer.category,
        teamName: state.teamNames?.chung,
        teamLogo: state.teamLogos?.chung || chungPlayer.teamLogo,
        clubName: state.clubNames?.chung || chungPlayer.club || 'CHUNG CLUB',
        clubLogo: state.clubLogos?.chung || chungPlayer.clubLogo,
        country: chungRosterEntry?.nationality || chungPlayer.nationality,
      };
      return {
        ...state,
        selectedCallPlayers: { ...(state.selectedCallPlayers || {}), chung: selection },
        playerCallStatus: { ...state.playerCallStatus, chung: 'calling' as const },
        singlePlayerCall: {
          side: 'chung', animationId, status: 'calling', ts: Date.now(),
          playerName: selection.name, playerPhoto: selection.photo, playerNumber: selection.playerNumber,
          seedNumber: selection.seedNumber, category: selection.category, teamName: selection.teamName,
          teamLogo: selection.teamLogo, clubName: selection.clubName, clubLogo: selection.clubLogo,
          country: selection.country,
        },
        animationController: makeAnimationController(state, { state: 'CALLING_PLAYER', activeAnimation: 'SINGLE_PLAYER_CALL', animationId }, 'CALL_NEXT_ROUND_PLAYERS:chung'),
        autoCallSequence: { active: true, stage: 'PLAYER_CHUNG', startedAt: Date.now(), mode: 'full', stageEndsAt: Date.now() + Math.max(0.5, state.config.playerCallBlueSeconds ?? 3) * 1000 },
      };
    }

    case 'SET_TEAM_ROSTER':
      return { ...state, teamMode: action.teamMode, teamRoster: action.roster };
    case 'RESOLVE_TEAM_FINAL_DECISION': {
      if (!state.pendingTeamFinalDecision || state.config.competitionMode !== 'par_equipe' || state.status !== 'paused') return state;
      const ns = structuredClone(state);
      ns.result = { winner: action.winner, method: 'SUP', finalScore: { chung: ns.chung.totalScore, hong: ns.hong.totalScore } };
      ns.resultConfirmed = false;
      ns.status = 'finished';
      ns.awaitingTeamReveal = false;
      ns.teamResultRevealed = true;
      ns.pendingTeamFinalDecision = false;
      ns.pendingRoundDecision = false;
      ns.roundTieReview = { phase: 'result', votes: ns.roundTieReview?.votes || {}, judgeNames: ns.roundTieReview?.judgeNames, judgePhotos: ns.roundTieReview?.judgePhotos, ts: Date.now() };
      return ns;
    }
    case 'REVEAL_TEAM_RESULT': {
      // Manually triggered by the operator once every configured team
      // round has been played. The selected Par Équipe scoring mode controls
      // how the final winner is determined:
      //   scoreResetPerRound=true  -> most round wins
      //   scoreResetPerRound=false -> highest cumulative team score
      // This is intentionally independent from warningResetPerRound.
      if (!state.awaitingTeamReveal) return state;
      const ns = structuredClone(state);
      let winner: PlayerColor;
      if (ns.config.scoreResetPerRound) {
        const roundWins = {
          chung: ns.roundWinners.filter(r => r.winner === 'chung').length,
          hong: ns.roundWinners.filter(r => r.winner === 'hong').length,
        };
        if (roundWins.chung === roundWins.hong) {
          // A true round-win tie is not silently awarded to either team.
          // Leave the final result pending so the referee can resolve it.
          ns.pendingTeamFinalDecision = true;
          ns.pendingRoundDecision = false;
          ns.roundTieReview = undefined;
          ns.status = 'paused';
          return ns;
        }
        winner = roundWins.chung > roundWins.hong ? 'chung' : 'hong';
      } else {
        winner = ns.chung.totalScore > ns.hong.totalScore ? 'chung' : 'hong';
        if (ns.chung.totalScore === ns.hong.totalScore) {
          ns.pendingTeamFinalDecision = true;
          ns.pendingRoundDecision = false;
          ns.roundTieReview = undefined;
          ns.status = 'paused';
          return ns;
        }
      }
      ns.result = { winner, method: 'PTF', finalScore: { chung: ns.chung.totalScore, hong: ns.hong.totalScore } };
      ns.resultConfirmed = false;
      ns.status = 'finished';
      ns.awaitingTeamReveal = false;
      ns.teamResultRevealed = true;
      return ns;
    }
    case 'REVEAL_MVP': {
      // Referee-only reveal — only makes sense once the match is actually
      // decided (a result exists, individual or team), never mid-fight.
      if (!state.result) return state;
      const mvpReveal = computeMvp(state);
      if (!mvpReveal) return state;
      return { ...state, mvpReveal };
    }
    case 'CLEAR_MVP':
      return { ...state, mvpReveal: undefined };
    case 'SET_POOL_MVP':
      // Data already computed (from a Supabase query OperatorScreen ran
      // async, outside this reducer) — just store it, same as every other
      // "fetched elsewhere, dispatched as a plain value" pattern in this
      // file (e.g. bracket data).
      return { ...state, poolMvpReveal: action.poolMvpReveal };
    case 'CLEAR_POOL_MVP':
      return { ...state, poolMvpReveal: undefined };
    case 'REQUEST_SUBSTITUTION': {
      // Manual substitution is exclusive to Par Équipe's "change players
      // during the match" mode. Rotation mode must never enter this flow.
      if (state.teamMode !== 'substitution') return state;
      // Clock stops the instant the operator presses "Change Player" — not
      // only once the new player is actually confirmed a few seconds later.
      // Previously the timer kept running through the whole substitution
      // flow, silently eating into the round while the swap was being made.
      const cinematic = state.config.playerChangeAnimation !== false;
      const shouldPause = cinematic && (state.status === 'fighting' || state.status === 'kyeshi');
      return { ...state, pendingSubstitution: { side: action.side, ts: Date.now(), resumeStatus: shouldPause ? state.status : undefined }, status: shouldPause ? 'paused' : state.status };
    }
    case 'CANCEL_SUBSTITUTION':
      return { ...state, pendingSubstitution: undefined };
    case 'CONFIRM_SUBSTITUTION': {
      // Defensive guard: this cinematic/action is valid only for Par Équipe
      // manual substitution mode.
      if (state.teamMode !== 'substitution') return state;
      // Capture the OUTGOING player's identity before it's overwritten below
      // — the substitution overlay needs both sides of the swap, not just
      // the incoming player (which would look identical to a fresh call).
      const outgoing = state[action.side].player;
      const ns = structuredClone(state);
      ns[action.side].player = {
        ...ns[action.side].player,
        name: action.name,
        photoUrl: action.photo,
        nationality: action.nationality ?? ns[action.side].player.nationality,
        playerNumber: action.playerNumber ?? ns[action.side].player.playerNumber,
        seedNumber: action.seedNumber ?? ns[action.side].player.seedNumber,
      };
      // Keep pendingSubstitution through the cinematic so CLEAR_SUBSTITUTION_ANIMATION
      // can restore the exact pre-swap fighting state when the animation ends.
      // OFF means a direct live replacement: no cinematic and no clock pause.
      // ON keeps the existing OUT → IN supplied Player Change animation.
      ns.callAnimation = undefined;
      if (ns.config.playerChangeAnimation === false) {
        ns.substitutionAnimation = undefined;
        ns.pendingSubstitution = undefined;
        return ns;
      }
      ns.substitutionAnimation = {
        side: action.side,
        oldPlayer: {
          name: outgoing.name || '',
          photo: outgoing.photoUrl,
          nationality: outgoing.nationality,
          playerNumber: outgoing.playerNumber,
          seedNumber: outgoing.seedNumber,
        },
        newPlayer: {
          name: action.name,
          photo: action.photo,
          nationality: action.nationality ?? ns[action.side].player.nationality,
          playerNumber: action.playerNumber,
          seedNumber: action.seedNumber,
        },
        ts: Date.now(),
      };
      return ns;
    }
    case 'CLEAR_SUBSTITUTION_ANIMATION': {
      const resumeStatus = state.pendingSubstitution?.resumeStatus;
      return {
        ...state,
        substitutionAnimation: undefined,
        pendingSubstitution: undefined,
        status: resumeStatus === 'fighting' ? 'fighting' : state.status,
      };
    }
    case 'SWAP_SIDES': {
      // "Reverse Screen" — fully swaps CHUNG and HONG: player identity,
      // scores, gamjeom count, IVR quota, the score log, round-winner
      // history, and any in-flight PTG/IVR side references. This corrects
      // a referee mis-assigning a competitor to the wrong colored side,
      // without losing any recorded scoring.
      const ns = structuredClone(state);
      const chungColor = ns.chung.color;
      const hongColor = ns.hong.color;
      const chungData = ns.chung;
      const hongData = ns.hong;
      ns.chung = { ...hongData, color: chungColor };
      ns.hong = { ...chungData, color: hongColor };
      ns.events = ns.events.map(e => ({ ...e, player: e.player === 'chung' ? 'hong' : 'chung' }));
      ns.roundWinners = ns.roundWinners.map(r => ({
        ...r,
        winner: r.winner === 'draw' ? 'draw' : r.winner === 'chung' ? 'hong' : 'chung',
      }));
      if (ns.ptgWinner) ns.ptgWinner = ns.ptgWinner === 'chung' ? 'hong' : 'chung';
      if (ns.ivrLog) ns.ivrLog = ns.ivrLog.map(l => ({ ...l, side: l.side === 'chung' ? 'hong' : 'chung' }));
      if (ns.ivrAnimation) ns.ivrAnimation = { ...ns.ivrAnimation, side: ns.ivrAnimation.side === 'chung' ? 'hong' : 'chung' };
      if (ns.koAnimation) ns.koAnimation = { ...ns.koAnimation, side: ns.koAnimation.side === 'chung' ? 'hong' : 'chung' };
      if (ns.result) ns.result = { ...ns.result, winner: ns.result.winner === 'chung' ? 'hong' : 'chung' };
      return ns;
    }
    case 'ENTER_TEST_MODE': {
      if (state.testMode) return state;
      // Snapshot the real match so any scoring done while testing equipment
      // is discarded, never mixed into the actual contest record.
      const snapshot = structuredClone(state);
      return { ...structuredClone(state), testMode: true, testModeSnapshot: snapshot };
    }
    case 'EXIT_TEST_MODE': {
      if (!state.testMode) return state;
      if (state.testModeSnapshot) {
        const restored = structuredClone(state.testModeSnapshot);
        restored.testMode = false;
        restored.testModeSnapshot = undefined;
        return restored;
      }
      return { ...state, testMode: false, testModeSnapshot: undefined };
    }
    default:
      return state;
  }
}

interface MatchContextType {
  state: MatchState;
  dispatch: React.Dispatch<MatchAction>;
  judges: Judge[];
  setJudges: React.Dispatch<React.SetStateAction<Judge[]>>;
  approvalRequests: ScoreApprovalRequest[];
  setApprovalRequests: React.Dispatch<React.SetStateAction<ScoreApprovalRequest[]>>;
  ivrRequests: IVRRequest[];
  setIvrRequests: React.Dispatch<React.SetStateAction<IVRRequest[]>>;
  alertActive: boolean;
  setAlertActive: React.Dispatch<React.SetStateAction<boolean>>;
  /** Power-failure/crash recovery: a previous in-progress session found on
   * launch, or null once there's nothing to offer (already dismissed,
   * already restored, or none existed). See session-recovery.ts. */
  recoverableSession: SessionSnapshot | null;
  recoveryRestored: boolean;
  /** Restores the found session's exact match state (score, round, timer,
   * warnings, etc.) and dismisses the recovery prompt. */
  restoreSession: () => void;
  finishRecoveryReady: () => void;
  /** Declines the found session — discards it and starts fresh (the
   * existing 'waiting' initial state is left untouched). */
  dismissRecoverableSession: () => void;
}

const MatchContext = createContext<MatchContextType | null>(null);

// This window is a secondary "Public Scoreboard" display opened by the
// Electron main process (electron/main.cjs -> openPublicWindow). It never
// owns the match — it only mirrors whatever the operator window broadcasts.
export function isPublicDisplayWindow(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('displayWindow') === 'public';
  } catch {
    return false;
  }
}

export function MatchProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(matchReducer, createInitialMatchState());
  // UI safety: ignore accidental double-clicks on destructive/transition
  // commands. Internal timer/effect dispatches keep using rawDispatch so
  // legitimate TICK and animation deadlines are never throttled.
  const lastCommandRef = useRef<{ key: string; at: number } | null>(null);
  const dispatch = React.useCallback<React.Dispatch<MatchAction>>((action) => {
    const guarded = new Set<string>([
      'START', 'PAUSE', 'RESUME', 'END_ROUND', 'START_NEXT_ROUND', 'FINISH',
      'CONFIRM_FINAL_RESULT', 'RESET', 'SAVE_RESULT', 'NEXT_MATCH',
      'CALL_TEAM', 'CALL_SINGLE_PLAYER', 'SHOW_MATCHUP', 'START_AUTO_CALL_SEQUENCE',
      'START_TEAM_CALL_SEQUENCE', 'START_PLAYER_CALL_SEQUENCE', 'START_MATCH',
      'MARK_SINGLE_PLAYER_READY', 'MARK_MATCHUP_READY', 'REPLAY_SINGLE_PLAYER_CALL',
      'REPLAY_CALL_ANIMATION', 'STOP_BROADCAST_ANIMATION', 'GO_LIVE_BROADCAST',
      'CONFIRM_SUBSTITUTION', 'CLEAR_SUBSTITUTION_ANIMATION', 'RESOLVE_DRAW_ROUND',
    ]);
    const type = action.type as string;
    if (guarded.has(type)) {
      const side = 'side' in action ? String((action as any).side || '') : '';
      const key = `${type}:${side}`;
      const now = Date.now();
      const last = lastCommandRef.current;
      // 450ms is long enough to absorb a double click but short enough not
      // to interfere with deliberate repeated referee actions.
      if (last?.key === key && now - last.at < 450) return;
      lastCommandRef.current = { key, at: now };
    }
    rawDispatch(action);
  }, [rawDispatch]);
  const [judges, setJudges] = React.useState<Judge[]>([]);
  const [approvalRequests, setApprovalRequests] = React.useState<ScoreApprovalRequest[]>([]);
  const [ivrRequests, setIvrRequests] = React.useState<IVRRequest[]>([]);
  const [alertActive, setAlertActive] = React.useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Wall-clock anchor for the match timer. The interval is only a wake-up
  // mechanism; elapsed time is always measured from Date.now() so the timer
  // cannot run faster/slower than real time when the browser/Electron loop
  // is delayed or throttled.
  const timerLastWallClockRef = useRef<number | null>(null);
  const isPublicWindow = React.useMemo(() => isPublicDisplayWindow(), []);
  const autoCallBootstrappedMatchRef = useRef<string | null>(null);

  // ---- Player Call is manual-only ----
  // The public display must never start a call cinematic by itself. The Main
  // Referee explicitly presses START PLAYER CALL / PLAY to begin the sequence.
  useEffect(() => {
    // Intentionally no auto-dispatch here.
  }, [state.id]);

  // ---- Single-player call: "calling" → "called" ----
  // CRITICAL FIX: COMPLETE_SINGLE_PLAYER_CALL exists in the reducer but was
  // never dispatched from anywhere in the app. That left EVERY single-player
  // call stuck at status 'calling' forever — playerCallStatus never reached
  // 'called', so the referee's CONFIRM step (which requires 'called') could
  // never appear and the call animation looked like it "never finishes".
  // This mirrors the existing team-call timer (3s) below it.
  useEffect(() => {
    if (isPublicWindow) return;
    const call = state.singlePlayerCall;
    if (!call || call.status !== 'calling') return;
    const seconds = call.side === 'chung'
      ? Math.max(0.5, state.config.playerCallBlueSeconds ?? 3)
      : Math.max(0.5, state.config.playerCallRedSeconds ?? 3);
    const t = setTimeout(() => dispatch({ type: 'COMPLETE_SINGLE_PLAYER_CALL', animationId: call.animationId }), seconds * 1000);
    return () => clearTimeout(t);
  }, [isPublicWindow, state.singlePlayerCall?.status, state.singlePlayerCall?.animationId]);

  // ---- Auto call sequence: BLUE→RED timed hand-off ----
  // The referee explicitly asked that, ONLY while an AUTO CALL sequence
  // (FULL AUTO / AUTO TEAM CALL / AUTO PLAYER CALL) is running, the BLUE
  // stage advances to RED by itself after its call animation has been
  // showing for config.autoCallStageSeconds, instead of requiring a manual
  // CONFIRM click in between. The final stage (RED) still always stops and
  // waits for the referee's own explicit CONFIRM press — this only removes
  // the BLUE→RED confirm, never the last one. Manual (non-auto-sequence)
  // calls are completely untouched: COMPLETE_TEAM_CALL / MARK_SINGLE_PLAYER_
  // READY still only fire from an explicit dispatch elsewhere too.
  //
  // This used to be a useEffect gated on state.callAnimation?.phase and
  // .manualTeamCall matching exactly — if either of those didn't line up
  // (e.g. some other update touched callAnimation in between), the timer
  // never got (re)scheduled and BLUE just sat there forever with no way
  // forward except a manual CONFIRM click the referee didn't know existed.
  // A plain interval that only reads stageEndsAt (a fixed wall-clock
  // deadline set once when BLUE's stage begins) can't get silently
  // dropped that way.
  useEffect(() => {
    if (isPublicWindow) return;
    const seq = state.autoCallSequence;
    if (!seq?.active || seq.mode !== 'teams' || state.config.teamCallAutoEnabled === false || seq.stage !== 'TEAM_CHUNG' || !seq.stageEndsAt) return;
    const msLeft = seq.stageEndsAt - Date.now();
    const t = setTimeout(() => dispatch({ type: 'COMPLETE_TEAM_CALL', side: 'chung' }), Math.max(0, msLeft));
    return () => clearTimeout(t);
  }, [isPublicWindow, state.autoCallSequence?.active, state.autoCallSequence?.stage, state.autoCallSequence?.stageEndsAt]);

  useEffect(() => {
    if (isPublicWindow) return;
    const seq = state.autoCallSequence;
    if (!seq?.active || seq.mode !== 'teams' || state.config.teamCallAutoEnabled === false || seq.stage !== 'TEAM_HONG' || !seq.stageEndsAt) return;
    const msLeft = seq.stageEndsAt - Date.now();
    const t = setTimeout(() => dispatch({ type: 'COMPLETE_TEAM_CALL', side: 'hong' }), Math.max(0, msLeft));
    return () => clearTimeout(t);
  }, [isPublicWindow, state.autoCallSequence?.active, state.autoCallSequence?.stage, state.autoCallSequence?.stageEndsAt]);

  // AUTO PLAYER CALL: BLUE is timed, then RED is timed, then RED stops on
  // WAITING FOR REFEREE. The timer never presses READY on behalf of the referee.
  useEffect(() => {
    if (isPublicWindow) return;
    const seq = state.autoCallSequence;
    if (!seq?.active || seq.stage !== 'PLAYER_CHUNG' || !seq.stageEndsAt) return;
    const msLeft = seq.stageEndsAt - Date.now();
    const t = setTimeout(() => {
      const activeCall = state.singlePlayerCall;
      if (activeCall?.side === 'chung' && activeCall.status === 'calling') {
        dispatch({ type: 'COMPLETE_SINGLE_PLAYER_CALL', animationId: activeCall.animationId });
      }
    }, Math.max(0, msLeft));
    return () => clearTimeout(t);
  }, [isPublicWindow, state.autoCallSequence?.active, state.autoCallSequence?.stage, state.autoCallSequence?.stageEndsAt, state.singlePlayerCall?.animationId, state.singlePlayerCall?.status]);

  useEffect(() => {
    if (isPublicWindow) return;
    const seq = state.autoCallSequence;
    if (!seq?.active || seq.stage !== 'PLAYER_HONG' || !seq.stageEndsAt) return;
    const msLeft = seq.stageEndsAt - Date.now();
    const t = setTimeout(() => {
      const activeCall = state.singlePlayerCall;
      if (activeCall?.side === 'hong' && activeCall.status === 'calling') {
        dispatch({ type: 'COMPLETE_SINGLE_PLAYER_CALL', animationId: activeCall.animationId });
      }
    }, Math.max(0, msLeft));
    return () => clearTimeout(t);
  }, [isPublicWindow, state.autoCallSequence?.active, state.autoCallSequence?.stage, state.autoCallSequence?.stageEndsAt, state.singlePlayerCall?.animationId, state.singlePlayerCall?.status]);

  // After the referee presses READY on RED, reveal MATCHUP after the
  // configured delay. This never starts the actual match timer.
  useEffect(() => {
    if (isPublicWindow) return;
    const seq = state.autoCallSequence;
    if (!seq?.active || seq.stage !== 'MATCHUP_DELAY' || !seq.stageEndsAt) return;
    const msLeft = seq.stageEndsAt - Date.now();
    const t = setTimeout(() => dispatch({ type: 'AUTO_SHOW_MATCHUP_AFTER_DELAY' }), Math.max(0, msLeft));
    return () => clearTimeout(t);
  }, [isPublicWindow, state.autoCallSequence?.active, state.autoCallSequence?.stage, state.autoCallSequence?.stageEndsAt]);

  // ---- Power failure / crash recovery ----
  // Only the operator/main window ever offers restore — the public window
  // is a pure mirror and must never independently pick up a stale snapshot.
  const [recoverableSession, setRecoverableSession] = React.useState<SessionSnapshot | null>(
    () => (isPublicDisplayWindow() ? null : loadRecoverableSession()),
  );
  const [recoveryRestored, setRecoveryRestored] = React.useState(false);
  const restoreSession = React.useCallback(() => {
    if (!recoverableSession) return;
    dispatch({ type: 'RESTORE_STATE', state: recoverableSession.state });
    clearSessionSnapshot();
    setRecoveryRestored(true);
  }, [recoverableSession]);
  const finishRecoveryReady = React.useCallback(() => {
    setRecoveryRestored(false);
    setRecoverableSession(null);
  }, []);
  const dismissRecoverableSession = React.useCallback(() => {
    clearSessionSnapshot();
    setRecoveryRestored(false);
    setRecoverableSession(null);
  }, []);

  // Mirror the live match to localStorage so a killed app/lost-power event
  // can be recovered on next launch. Deliberately debounced (not on every
  // single TICK) to avoid hammering localStorage once a second during a
  // running match. Never runs on the public window (see module doc in
  // session-recovery.ts) and never while a just-found recoverable session
  // is still awaiting the operator's Restore/New Match choice, so we don't
  // overwrite the very snapshot we're about to offer to restore.
  useEffect(() => {
    if (isPublicWindow || recoverableSession) return;
    if (state.status === 'finished') {
      clearSessionSnapshot();
      return;
    }
    const t = setTimeout(() => saveSessionSnapshot(state), 500);
    return () => clearTimeout(t);
  }, [state, isPublicWindow, recoverableSession]);

  // ---- Par Équipe AUTO SAVE (spec §5) ----
  // Separate from the crash-recovery mirror above: this writes into the
  // named, multi-slot SAVED MATCHES store (par-equipe-save.ts) so a team
  // match the referee stepped away from is resumable later even after
  // other matches ran on this mat in between. Par Équipe only (never
  // Individual — spec §10), never on the public window, and skipped for a
  // still-empty 'waiting' match with no events yet so we don't clutter the
  // saved list with matches nobody has actually started.
  useEffect(() => {
    if (isPublicWindow || !isParEquipeMatch(state)) return;
    if (state.status === 'waiting' && (state.events?.length ?? 0) === 0 && state.currentRound <= 1) return;
    const t = setTimeout(() => {
      if (state.status === 'finished') {
        markParEquipeMatchCompleted(state);
      } else {
        saveParEquipeMatch(state);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [isPublicWindow, state]);

  // ---- Par Équipe SAFE SNAPSHOT ----
  // The normal mirror above is intentionally frequent so a live session is
  // easy to recover, but a power cut during a cinematic can leave that mirror
  // sitting on a transient animation state. SAFE SNAPSHOT only advances at
  // referee-safe boundaries: explicit confirmation points, MATCH READY,
  // between-round pauses, and final completion. If the app dies during an
  // animation, session-recovery.ts will prefer this last safe boundary.
  useEffect(() => {
    if (isPublicWindow || !isParEquipeMatch(state)) return;
    const safe = state.status === 'rest'
      || state.status === 'paused'
      || state.status === 'finished'
      || !!state.callFlowAutoStartBlocked
      || state.matchupAnimation?.status === 'ready'
      || state.teamCallStatus?.hong === 'calling'
      || state.teamCallStatus?.chung === 'calling'
      || state.playerCallStatus?.hong === 'called'
      || state.playerCallStatus?.chung === 'called'
      || (!state.callAnimation && !state.singlePlayerCall && !state.matchupAnimation && !state.autoCallSequence?.active);
    if (!safe) return;
    const reason = state.status === 'finished' ? 'match_complete' as const
      : state.status === 'rest' || state.status === 'paused' ? 'round_complete' as const
      : state.callFlowAutoStartBlocked || state.matchupAnimation?.status === 'ready' ? 'match_ready' as const
      : 'referee_safe' as const;
    const t = setTimeout(() => saveParEquipeSafeSnapshot(state, reason), 80);
    return () => clearTimeout(t);
  }, [isPublicWindow, state]);

  // MULTI-MAT CONTROL ROOM (see mat-status.ts + DOCUMENTATION.md §8): a
  // best-effort, throttled heartbeat of this mat's current status, so a
  // separate Control Room window (if the organizer turned that mode on)
  // can show every mat's live status side-by-side. Never runs on the
  // public window (same guard as the recovery snapshot above), and is a
  // pure broadcast — it never reads anything back into this window's
  // state, so it cannot affect live scoring in any way. No-ops entirely
  // when state.matNumber isn't set (see pushMatHeartbeat) or Supabase
  // isn't configured, exactly like every other optional cloud feature.
  useEffect(() => {
    if (isPublicWindow || !state.matNumber) return;
    pushMatHeartbeat(state);
    const interval = setInterval(() => pushMatHeartbeat(state), 8000);
    return () => clearInterval(interval);
  }, [isPublicWindow, state.matNumber, state.status, state.chung?.totalScore, state.hong?.totalScore, state.currentRound]);

  // The public scoreboard window never runs its own clock — it only mirrors
  // the state pushed from the operator window, so both screens never drift.
  // IMPORTANT: this is a real-time 1:1 clock. setInterval is NOT used as the
  // source of elapsed time; it merely wakes us frequently. Date.now() is the
  // source of truth, so 60 seconds on the match clock always means 60 real
  // seconds, even if the UI thread is delayed/throttled.
  useEffect(() => {
    if (isPublicWindow) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const timerRunning = state.status === 'fighting' || state.status === 'rest' || state.status === 'kyeshi';
    if (!timerRunning) {
      timerLastWallClockRef.current = null;
      return;
    }

    // A new LIVE/REST/KYESHI phase starts from its current displayed value.
    // We never carry elapsed time across PAUSE/RESUME or phase changes.
    timerLastWallClockRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const last = timerLastWallClockRef.current ?? now;
      const elapsedMs = Math.max(0, now - last);
      const wholeSeconds = Math.floor(elapsedMs / 1000);
      if (wholeSeconds <= 0) return;

      // Keep the remainder so 1.2s + 0.8s = exactly 2s instead of losing
      // fractions and gradually drifting the match clock.
      timerLastWallClockRef.current = last + wholeSeconds * 1000;
      for (let i = 0; i < wholeSeconds; i += 1) {
        dispatch({ type: 'TICK' });
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      timerLastWallClockRef.current = null;
    };
  }, [state.status, isPublicWindow]);

  // ---- Operator window: broadcast every match-state change to the public
  // scoreboard window (Electron desktop app only; no-op on the web/PWA). ----
  useEffect(() => {
    if (isPublicWindow) return;
    if (typeof window === 'undefined' || !window.electronAPI) return;
    window.electronAPI.broadcastMatchState(state);
  }, [state, isPublicWindow]);

  // ---- Public scoreboard window: receive state pushed from the operator
  // window and mirror it instantly (time, score, rounds, penalties, names,
  // flags — the whole MatchState). ----
  useEffect(() => {
    if (!isPublicWindow) return;
    if (typeof window === 'undefined' || !window.electronAPI) return;
    const unsubscribe = window.electronAPI.onMatchStateSync((incoming) => {
      dispatch({ type: 'SET_STATE', state: incoming });
    });
    return unsubscribe;
  }, [isPublicWindow]);

  // Between rounds in Par Équipe: show a VS preview of the two athletes
  // assigned to the next round, then start the player-only call sequence.
  // Team identity is deliberately skipped after the first entrance.
  useEffect(() => {
    if (isPublicWindow) return;
    if (!state.roundCallPreview || state.callAnimation) return;
    const t = setTimeout(() => dispatch({ type: 'START_ROUND_PLAYER_CALL' }), 2400);
    return () => clearTimeout(t);
  }, [state.roundCallPreview, state.callAnimation, isPublicWindow]);

  // Two-phase call/change-player cinematic timing — only the operator
  // window (source of truth) schedules these; the public window just
  // mirrors whatever state arrives, same pattern as the match clock above.
  useEffect(() => {
    if (isPublicWindow) return;
    if (!state.callAnimation) return;
    if (state.callAnimation.phase === 'team') {
      // Main Referee team calls (manualTeamCall: true — the only path used
      // by TEAM CALL / the automatic call sequence) never auto-complete on
      // a timer: the cinematic stays on screen as the explicit "WAITING FOR
      // REFEREE CONFIRMATION" stop point (spec §3/§9/§14) until the referee
      // presses CONFIRM (COMPLETE_TEAM_CALL, dispatched from the UI). Only
      // a non-manual team-call phase (not used by any current caller, kept
      // for forward-compat with the round-start call system) still
      // auto-advances on a timer.
      if (state.callAnimation.manualTeamCall) return;
      const holdMs = (state.callDisplayConfig?.readyHoldSeconds ?? 3) * 1000;
      const t = setTimeout(() => dispatch({ type: 'ADVANCE_CALL_ANIMATION' }), holdMs);
      return () => clearTimeout(t);
    }
    // Par Équipe round-bound player calls stop at AWAITING. The Main Referee
    // decides READY/CONTINUE or RECALL; the animation never advances itself.
    if (state.config?.competitionMode === 'par_equipe' && state.pendingRoundStartAfterCall) return;
    const t = setTimeout(() => dispatch({ type: 'CLEAR_CALL_ANIMATION' }), 4000);
    return () => clearTimeout(t);
  }, [state.callAnimation, state.animationController?.animationId, isPublicWindow]);

  // Main Referee owns completion of a single-player call. There is no timer
  // here: the cinematic is an explicit referee-confirmation stop point. The
  // public window only mirrors the source-of-truth state.

  // ---- Automatic GOLDEN POINT cinematic trigger — computed once here (by
  // the operator/source-of-truth window only, same pattern as the call
  // animation above) and mirrored to the public window via state.
  // goldenPointAnimation itself. Previously this was tracked with purely
  // local component state inside PublicScoreboard, which could get stuck
  // on screen forever: if `status` changed again (e.g. the golden round
  // ended because someone scored) before the local 4200ms timer fired,
  // the effect's cleanup only cancelled the pending timeout — it never
  // reset the "show" flag, so the cinematic never disappeared. Centralizing
  // this here means visibility is always driven directly off
  // `state.goldenPointAnimation` (present = show, undefined = hidden), with
  // no separate local timer that can desync from it. ----
  const goldenPrevStatusRef = useRef<string | null>(null);
  const goldenAnnouncedRoundRef = useRef<number | null>(null);
  useEffect(() => {
    if (isPublicWindow) return;
    const prevStatus = goldenPrevStatusRef.current;
    goldenPrevStatusRef.current = state.status;
    if (
      state.status === 'fighting' &&
      prevStatus !== 'fighting' &&
      state.isGoldenRound &&
      goldenAnnouncedRoundRef.current !== state.currentRound
    ) {
      goldenAnnouncedRoundRef.current = state.currentRound;
      dispatch({ type: 'GOLDEN_POINT_ANIMATE' });
      const t = setTimeout(() => dispatch({ type: 'CLEAR_GOLDEN_POINT_ANIMATE' }), 4200);
      // Safety net: if this effect re-runs (status changed again — e.g. the
      // golden round ended early because someone scored) before the timer
      // above fires, clear the timer AND immediately dispatch the clear
      // action so the cinematic can never get stuck on screen. The dispatch
      // is idempotent (a no-op if already cleared).
      return () => {
        clearTimeout(t);
        dispatch({ type: 'CLEAR_GOLDEN_POINT_ANIMATE' });
      };
    }
  }, [state.status, state.isGoldenRound, state.currentRound, isPublicWindow]);

  // Rest-period audio alerts: chime at 30s and 10s remaining, plus final 5s ticks,
  // and a spoken "Call players" announcement the instant rest hits 0.
  const lastRestWarnRef = useRef<number>(-1);
  useEffect(() => {
    // Only the operator window plays these alerts — otherwise the public
    // scoreboard window (mirroring the same state) would fire them too and
    // you'd hear every chime twice.
    if (isPublicWindow) return;
    if (state.status === 'rest') {
      const t = state.timeRemaining;
      if ((t === 30 || t === 10) && lastRestWarnRef.current !== t) {
        lastRestWarnRef.current = t;
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.frequency.value = t === 10 ? 1000 : 700;
          g.gain.value = 0.35;
          osc.connect(g); g.connect(ctx.destination);
          osc.start();
          setTimeout(() => { osc.stop(); ctx.close(); }, 260);
          if (t === 10) {
            setTimeout(() => {
              const c2 = new AudioContext(); const o2 = c2.createOscillator();
              o2.frequency.value = 1000; o2.connect(c2.destination); o2.start();
              setTimeout(() => { o2.stop(); c2.close(); }, 200);
            }, 320);
          }
        } catch {}
      }
      if (t <= 5 && t > 0) {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          osc.frequency.value = 880;
          osc.connect(ctx.destination);
          osc.start();
          setTimeout(() => { osc.stop(); ctx.close(); }, 150);
        } catch {}
      }
      if (t === 0) {
        try {
          const u = new SpeechSynthesisUtterance('Call players. Center of the court.');
          u.rate = 0.95; u.pitch = 1; u.volume = 1;
          window.speechSynthesis?.cancel();
          window.speechSynthesis?.speak(u);
        } catch {}
      }
    } else {
      lastRestWarnRef.current = -1;
    }
  }, [state.status, state.timeRemaining, isPublicWindow]);

  return (
    <MatchContext.Provider value={{
      state, dispatch, judges, setJudges,
      approvalRequests, setApprovalRequests,
      ivrRequests, setIvrRequests,
      alertActive, setAlertActive,
      recoverableSession, recoveryRestored, restoreSession, finishRecoveryReady, dismissRecoverableSession,
    }}>
      {children}
    </MatchContext.Provider>
  );
}

export function useMatch() {
  const ctx = useContext(MatchContext);
  if (!ctx) throw new Error('useMatch must be used within MatchProvider');
  return ctx;
}
