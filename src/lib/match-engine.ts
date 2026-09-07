import { 
  MatchState, MatchConfig, PlayerColor, ScoreType, ScoreEvent, 
  SCORE_VALUES, MatchResult, WinMethod, DEFAULT_CONFIG, RoundScore, RoundWinner,
  DisplayConfig, DEFAULT_DISPLAY_CONFIG
} from '@/types/tkd';
import { analyzeTiebreaker } from '@/lib/ai-tiebreaker';
import { getWinnerAnimationSettings } from '@/lib/winner-animation-settings';

export function createInitialMatchState(config: Partial<MatchConfig> = {}, displayConfig?: DisplayConfig, publicBroadcastLive?: boolean): MatchState {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  // Always allocate one extra round slot beyond the configured count. A
  // decisive extra round can be needed even when goldenRound is disabled
  // (an even round count like 2, tied 1-1, falls through to a full extra
  // round rather than sudden death — see finalizeRoundResult) — so the
  // buffer slot can no longer be gated on goldenRound alone, or that extra
  // round has nowhere to record its score.
  const emptyRounds = (): RoundScore[] => 
    Array.from({ length: fullConfig.rounds + 1 }, () => ({
      attack: 0, gamjeom: 0, total: 0,
    }));

  const winnerAnimationSettings = getWinnerAnimationSettings();

  return {
    id: crypto.randomUUID(),
    config: fullConfig,
    status: 'waiting',
    startedAt: undefined,
    finishedAt: undefined,
    currentRound: 1,
    timeRemaining: fullConfig.roundTime,
    chung: {
      player: { id: '', name: 'CHUNG', nationality: '' },
      color: 'chung',
      scores: emptyRounds(),
      totalScore: 0,
      gamjeomCount: 0,
      ivrQuota: fullConfig.ivrQuotaChung ?? fullConfig.ivrQuota,
    },
    hong: {
      player: { id: '', name: 'HONG', nationality: '' },
      color: 'hong',
      scores: emptyRounds(),
      totalScore: 0,
      gamjeomCount: 0,
      ivrQuota: fullConfig.ivrQuotaHong ?? fullConfig.ivrQuota,
    },
    events: [],
    roundWinners: [],
    awaitingRoundStart: false,
    kyeshiUsedThisRound: 0,
    isGoldenRound: false,
    callScreenActive: true,
    displayConfig: {
      ...DEFAULT_DISPLAY_CONFIG,
      ...displayConfig,
      winnerAnimationEnabled: displayConfig?.winnerAnimationEnabled ?? winnerAnimationSettings.enabled,
      winnerAnimationDurationSeconds: displayConfig?.winnerAnimationDurationSeconds ?? winnerAnimationSettings.durationSeconds,
    },
    publicBroadcastLive: publicBroadcastLive ?? false,
    animationController: { state: 'IDLE', activeAnimation: undefined },
    teamCallStatus: { chung: 'idle', hong: 'idle' },
    playerCallStatus: { chung: 'waiting', hong: 'waiting' },
    teamCallShowPlayers: true,
    selectedCallPlayers: undefined,
    callFlowAutoStartBlocked: false,
  };
}

// Get current round score for display (resets per round unless par_equipe)
export function getCurrentRoundScore(state: MatchState, color: PlayerColor): number {
  const roundIdx = state.currentRound - 1;
  return state[color].scores[roundIdx]?.total || 0;
}

// ===== Par Équipe "rotation" helpers =====
// Each roster entry can play more than one consecutive round (entry.rounds,
// default 1). These helpers turn a 0-based match-round index into "which
// roster entry is on the mat" and "how many total rounds this whole roster
// needs to play", so the match keeps rotating through every player instead
// of ending early on a best-of-N round majority.
type RosterEntry = { name: string; nationality: string; rounds?: number; playerNumber?: number; seedNumber?: number; photo?: string };

export function getRotationTotalRounds(roster?: RosterEntry[]): number {
  if (!roster || roster.length === 0) return 0;
  return roster.reduce((sum, p) => sum + Math.max(1, p.rounds ?? 1), 0);
}

export function getRotationEntryForRound(roster: RosterEntry[] | undefined, roundIdx: number): RosterEntry | undefined {
  if (!roster || roster.length === 0) return undefined;
  let cursor = 0;
  for (const entry of roster) {
    cursor += Math.max(1, entry.rounds ?? 1);
    if (roundIdx < cursor) return entry;
  }
  // Fix: finalizeRoundResult() (below) always plays out the operator's
  // configured config.rounds in full, regardless of how many rounds the
  // roster itself adds up to — that's intentional (spec: never end the
  // match short just because the Admin roster editor defaults every
  // player to 1 round). This function used to return undefined once the
  // roster's own round total was used up, which — combined with that
  // behavior — meant any match where config.rounds ran longer than the
  // roster's total showed "TBD"/no player for the remaining rounds instead
  // of a real athlete, even though the match kept advancing. Falling back
  // to the last roster entry keeps the last athlete on the mat for any
  // extra rounds, matching what finalizeRoundResult's own comment already
  // documented as the expected behavior.
  return roster[roster.length - 1];
}

export function addScore(
  state: MatchState,
  player: PlayerColor,
  type: ScoreType,
  addedBy: ScoreEvent['addedBy'] = 'operator',
  judgeId?: string
): MatchState {
  // The turning-head button is configurable per match/tournament (5 or 6).
  // All other score types keep the existing SCORE_VALUES mapping.
  const points = type === 'turning_head'
    ? (state.config.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints)
    : SCORE_VALUES[type];
  const roundIdx = state.currentRound - 1;
  const newState = structuredClone(state);

  const event: ScoreEvent = {
    id: crypto.randomUUID(),
    round: state.currentRound,
    player,
    type,
    points,
    time: state.timeRemaining,
    timestamp: Date.now(),
    addedBy,
    judgeId,
    approved: addedBy === 'operator',
  };

  newState.events.push(event);

  if (type === 'warning') {
    // WARNING is administrative only: record it, but never alter the live score.
    // This applies to both 1v1 and Par Équipe.
  } else if (type === 'gamjeom') {
    const opponent = player === 'chung' ? 'hong' : 'chung';
    newState[player].scores[roundIdx].gamjeom += 1;
    // gamjeomCount tracks CURRENT round only (resets each round) — EXCEPT
    // in Par Équipe (scoreResetPerRound === false), where warnings must
    // accumulate across the whole team match, exactly like points do.
    newState[player].gamjeomCount = newState.config.warningResetPerRound === false
      ? newState[player].scores.slice(0, roundIdx + 1).reduce((sum, r) => sum + (r?.gamjeom || 0), 0)
      : newState[player].scores[roundIdx].gamjeom;
    newState[opponent].scores[roundIdx].attack += points;
    newState[opponent].scores[roundIdx].total += points;
    newState[opponent].totalScore += points;
  } else {
    newState[player].scores[roundIdx].attack += points;
    newState[player].scores[roundIdx].total += points;
    newState[player].totalScore += points;
  }

  // ===== GOLDEN ROUND (World Taekwondo Article 15.3) =====
  // A golden round is NOT won by the first single point. The contestant wins
  // as soon as they score 2+ points, or the opponent receives 2 Gam-jeoms.
  // One Gam-jeom therefore does not finish the contest.
  if (newState.isGoldenRound) {
    const golden = newState.chung.scores[roundIdx]?.total || 0;
    const goldenHong = newState.hong.scores[roundIdx]?.total || 0;
    const chungGoldenGam = newState.chung.scores[roundIdx]?.gamjeom || 0;
    const hongGoldenGam = newState.hong.scores[roundIdx]?.gamjeom || 0;
    const winner: PlayerColor | undefined =
      golden >= 2 ? 'chung' : goldenHong >= 2 ? 'hong' :
      hongGoldenGam >= 2 ? 'chung' : chungGoldenGam >= 2 ? 'hong' : undefined;

    if (winner) {
      newState.result = {
        winner,
        method: 'GDP',
        // Regulation-round scores remain in round history, but the official
        // golden-round result score is the score earned in the golden round.
        finalScore: { chung: golden, hong: goldenHong },
      };
      newState.status = 'finished';
      newState.finishedAt = Date.now();
      newState.resultConfirmed = false;
      const goldenRoundWinner: RoundWinner = {
        round: newState.currentRound,
        winner,
        method: 'score',
        chungScore: golden,
        hongScore: goldenHong,
      };
      newState.roundWinners = [...newState.roundWinners.filter(r => r.round !== goldenRoundWinner.round), goldenRoundWinner];
      return newState;
    }
    return newState;
  }

  // Check win conditions
  return checkWinConditions(newState);
}

export function removeLastScore(state: MatchState, player: PlayerColor): MatchState {
  const newState = structuredClone(state);
  const lastEvent = [...newState.events]
    .reverse()
    .find(e => e.player === player && e.round === state.currentRound);
  
  if (!lastEvent) return state;

  const roundIdx = state.currentRound - 1;
  newState.events = newState.events.filter(e => e.id !== lastEvent.id);

  if (lastEvent.type === 'gamjeom') {
    const opponent = player === 'chung' ? 'hong' : 'chung';
    newState[player].scores[roundIdx].gamjeom -= 1;
    newState[player].gamjeomCount = newState.config.warningResetPerRound === false
      ? newState[player].scores.slice(0, roundIdx + 1).reduce((sum, r) => sum + (r?.gamjeom || 0), 0)
      : newState[player].scores[roundIdx].gamjeom;
    newState[opponent].scores[roundIdx].attack -= lastEvent.points;
    newState[opponent].scores[roundIdx].total -= lastEvent.points;
    newState[opponent].totalScore -= lastEvent.points;
  } else {
    newState[player].scores[roundIdx].attack -= lastEvent.points;
    newState[player].scores[roundIdx].total -= lastEvent.points;
    newState[player].totalScore -= lastEvent.points;
  }

  return newState;
}

function checkWinConditions(state: MatchState): MatchState {
  const newState = structuredClone(state);
  const { config, chung, hong } = newState;
  const roundIdx = newState.currentRound - 1;

  // If PTG already triggered this round, do not re-trigger. Locked until referee confirms.
  if (newState.ptgActive) return newState;

  // Ten Gam-jeoms are a PUN (referee punitive declaration) in current WT rules,
  // not a point-gap victory. Keep the legacy enforceGamjeomLimit switch for
  // tournaments that intentionally disable this rule, and keep Par Équipe on
  // its separate team-competition path.
  const chungRoundGam = chung.scores[roundIdx]?.gamjeom || 0;
  const hongRoundGam = hong.scores[roundIdx]?.gamjeom || 0;
  const chungLimitGam = config.warningResetPerRound === false
    ? chung.scores.slice(0, roundIdx + 1).reduce((sum, r) => sum + (r?.gamjeom || 0), 0)
    : chungRoundGam;
  const hongLimitGam = config.warningResetPerRound === false
    ? hong.scores.slice(0, roundIdx + 1).reduce((sum, r) => sum + (r?.gamjeom || 0), 0)
    : hongRoundGam;
  if (config.competitionMode !== 'par_equipe' && config.enforceGamjeomLimit !== false && (chungLimitGam >= config.gamjeomLimit || hongLimitGam >= config.gamjeomLimit)) {
    const winner: PlayerColor = chungLimitGam >= config.gamjeomLimit ? 'hong' : 'chung';
    newState.result = {
      winner,
      method: 'PUN',
      finalScore: { chung: chung.totalScore, hong: hong.totalScore },
    };
    newState.status = 'finished';
    newState.finishedAt = Date.now();
    newState.resultConfirmed = false;
    return newState;
  }

  // Point gap per round. Current 2026 WT updates raised the threshold to 15.
  // Team competitions use their own Article 22 scoring path, so PTG is not
  // applied here for Par Équipe.
  if (config.competitionMode !== 'par_equipe' && config.pointGap > 0) {
    const chungRound = chung.scores[roundIdx]?.total || 0;
    const hongRound = hong.scores[roundIdx]?.total || 0;
    const diff = Math.abs(chungRound - hongRound);
    if (diff >= config.pointGap) {
      newState.ptgActive = true;
      newState.ptgWinner = chungRound > hongRound ? 'chung' : 'hong';
      newState.ptgValueAtTrigger = config.pointGap;
      newState.status = 'paused';
      return newState;
    }
  }

  // Point ceiling PER ROUND — an absolute score threshold: first player to
  // reach it wins the round outright, regardless of the gap to the opponent.
  if (config.pointCeiling > 0) {
    const chungRound = chung.scores[roundIdx]?.total || 0;
    const hongRound = hong.scores[roundIdx]?.total || 0;
    if (chungRound >= config.pointCeiling || hongRound >= config.pointCeiling) {
      newState.ptgActive = true;
      newState.ptgWinner = chungRound >= config.pointCeiling ? 'chung' : 'hong';
      newState.ptgValueAtTrigger = config.pointCeiling;
      newState.status = 'paused';
      return newState;
    }
  }

  return newState;
}

export function endRound(state: MatchState, method: 'score' | 'ptg' = 'score'): MatchState {
  const newState = structuredClone(state);
  const roundIdx = newState.currentRound - 1;
  
  const chungRoundScore = newState.chung.scores[roundIdx]?.total || 0;
  const hongRoundScore = newState.hong.scores[roundIdx]?.total || 0;

  // ===== GOLDEN ROUND EXPIRY — World Taekwondo Article 15.4 =====
  // If nobody reaches 2 points and neither side receives 2 Gam-jeoms, apply
  // the official superiority hierarchy in order:
  // 1) punch point in the golden round;
  // 2) PSS-registered hits in the golden round;
  // 3) rounds won in the first three regulation rounds;
  // 4) fewer Gam-jeoms across all four rounds;
  // 5) referee/judges superiority.
  if (newState.isGoldenRound && newState.config.goldenRound) {
    const roundEvents = newState.events.filter(e => e.round === newState.currentRound);
    const punchPoints = {
      chung: roundEvents.filter(e => e.player === 'chung' && e.type === 'punch').reduce((n,e)=>n+Math.max(0,e.points),0),
      hong: roundEvents.filter(e => e.player === 'hong' && e.type === 'punch').reduce((n,e)=>n+Math.max(0,e.points),0),
    };
    const pssHits = {
      chung: roundEvents.filter(e => e.player === 'chung' && e.addedBy === 'pss' && e.type !== 'gamjeom' && e.type !== 'warning').length,
      hong: roundEvents.filter(e => e.player === 'hong' && e.addedBy === 'pss' && e.type !== 'gamjeom' && e.type !== 'warning').length,
    };
    const regulationWins = {
      chung: newState.roundWinners.filter(r => r.round <= newState.config.rounds && r.winner === 'chung').length,
      hong: newState.roundWinners.filter(r => r.round <= newState.config.rounds && r.winner === 'hong').length,
    };
    const totalGam = {
      chung: newState.chung.scores.slice(0, newState.currentRound).reduce((n,r)=>n+(r?.gamjeom||0),0),
      hong: newState.hong.scores.slice(0, newState.currentRound).reduce((n,r)=>n+(r?.gamjeom||0),0),
    };
    const pick = (a:number,b:number): PlayerColor | undefined => a === b ? undefined : a > b ? 'chung' : 'hong';
    const fewer = (a:number,b:number): PlayerColor | undefined => a === b ? undefined : a < b ? 'chung' : 'hong';
    const superiorityWinner =
      pick(punchPoints.chung,punchPoints.hong) ??
      pick(pssHits.chung,pssHits.hong) ??
      pick(regulationWins.chung,regulationWins.hong) ??
      fewer(totalGam.chung,totalGam.hong);

    if (superiorityWinner) {
      newState.result = {
        winner: superiorityWinner,
        method: 'SUP',
        finalScore: { chung: newState.chung.scores[roundIdx]?.total || 0, hong: newState.hong.scores[roundIdx]?.total || 0 },
      };
      newState.status = 'finished';
      newState.finishedAt = Date.now();
      newState.resultConfirmed = false;
      newState.awaitingRoundStart = false;
      newState.roundWinners = [...newState.roundWinners.filter(r => r.round !== newState.currentRound), {
        round: newState.currentRound,
        winner: superiorityWinner,
        method: 'superiority',
        chungScore: chungRoundScore,
        hongScore: hongRoundScore,
      }];
      return newState;
    }
    newState.status = 'paused';
    newState.pendingRoundDecision = true;
    newState.roundWinners = [...newState.roundWinners.filter(r => r.round !== newState.currentRound), {
      round: newState.currentRound,
      winner: 'draw',
      method: 'draw',
      chungScore: chungRoundScore,
      hongScore: hongRoundScore,
    }];
    return newState;
  }
  
  // Determine round winner
  let roundWinner: PlayerColor | 'draw' = 'draw';
  if (chungRoundScore > hongRoundScore) roundWinner = 'chung';
  else if (hongRoundScore > chungRoundScore) roundWinner = 'hong';
  let tiebreakMethod: 'score' | 'gamjeom' | 'draw' = roundWinner === 'draw' ? 'draw' : 'score';

  // A tied round is always routed through the same Woose Girok / superiority
  // decision flow for INDIVIDUAL matches. The AI does not silently award the
  // round: it analyzes the strict hierarchy, shows its recommendation and
  // evidence, then the Main Referee confirms the winner. Par Équipe keeps its
  // own team-match rules and never enters this individual flow.
  const usesIndividualRoundTiebreaker = newState.config.competitionMode !== 'par_equipe';
  let tiebreakAnalysis: ReturnType<typeof analyzeTiebreaker> | undefined;
  if (roundWinner === 'draw' && usesIndividualRoundTiebreaker && newState.config.roundTieAiAnalysisEnabled !== false) {
    tiebreakAnalysis = analyzeTiebreaker(newState, newState.currentRound);
  }

  // Record the tied round immediately so the Main Referee UI can render the
  // Korean-count / Woose Girok animation and the AI evidence without starting
  // rest or another round first.
  const rw: RoundWinner = {
    round: newState.currentRound,
    winner: roundWinner,
    method: roundWinner === 'draw' ? 'draw' : method,
    chungScore: chungRoundScore,
    hongScore: hongRoundScore,
    tiebreakDetails: tiebreakAnalysis ? {
      reason: tiebreakAnalysis.reason,
      winningCriterion: tiebreakAnalysis.winningCriterion,
      aiWinner: tiebreakAnalysis.winner,
      aiConfidence: tiebreakAnalysis.confidence,
      aiScore: tiebreakAnalysis.aiScore,
      dataCoverage: tiebreakAnalysis.dataCoverage,
      chungHeadKicks: tiebreakAnalysis.details.chungHeadKicks,
      hongHeadKicks: tiebreakAnalysis.details.hongHeadKicks,
      chungTrunkKicks: tiebreakAnalysis.details.chungTrunkKicks,
      hongTrunkKicks: tiebreakAnalysis.details.hongTrunkKicks,
      chungPunches: tiebreakAnalysis.details.chungPunches,
      hongPunches: tiebreakAnalysis.details.hongPunches,
      chungSpinningKicks: tiebreakAnalysis.details.chungSpinningKicks,
      hongSpinningKicks: tiebreakAnalysis.details.hongSpinningKicks,
      chungValidHits: tiebreakAnalysis.details.chungValidHits,
      hongValidHits: tiebreakAnalysis.details.hongValidHits,
      chungPenalties: tiebreakAnalysis.details.chungPenalties,
      hongPenalties: tiebreakAnalysis.details.hongPenalties,
      chungActivity: tiebreakAnalysis.details.chungActivity,
      hongActivity: tiebreakAnalysis.details.hongActivity,
      chungEffectivePoints: tiebreakAnalysis.details.chungEffectivePoints,
      hongEffectivePoints: tiebreakAnalysis.details.hongEffectivePoints,
      chungPssHits: tiebreakAnalysis.details.chungPssHits,
      hongPssHits: tiebreakAnalysis.details.hongPssHits,
      chungTurningPoints: tiebreakAnalysis.details.chungTurningPoints,
      hongTurningPoints: tiebreakAnalysis.details.hongTurningPoints,
      playerReasons: tiebreakAnalysis.details.playerReasons,
    } : undefined,
  };
  newState.roundWinners = [...newState.roundWinners.filter(r => r.round !== rw.round), rw];
  if (roundWinner === 'draw' && usesIndividualRoundTiebreaker) {
    newState.aiRecommendation = tiebreakAnalysis?.winner === 'chung' ? 'chung' : tiebreakAnalysis?.winner === 'hong' ? 'hong' : 'unable';
    newState.aiConfidence = tiebreakAnalysis?.confidence ?? 0;
    newState.aiReason = tiebreakAnalysis?.reason;
    newState.roundTieReview = { phase: 'ai', votes: {}, ts: Date.now() };
  }

  // Keep an athlete-level round history for Par Équipe broadcasts. Team
  // totals alone cannot tell the audience which player scored in R1/R2/R3,
  // especially when the roster rotates.
  if (newState.teamRoster) {
    (['chung', 'hong'] as PlayerColor[]).forEach((side) => {
      const entry = newState.teamRoster?.[side]?.find(p => p.name === newState[side].player.name);
      if (!entry) return;
      const list = entry.roundScores ? [...entry.roundScores] : [];
      const item = {
        round: rw.round,
        score: side === 'chung' ? rw.chungScore : rw.hongScore,
        opponentScore: side === 'chung' ? rw.hongScore : rw.chungScore,
        winner: rw.winner,
        // Warnings (gam-jeom) THIS player personally received this round —
        // feeds the "fair play" (cleanest athlete) MVP calculation. Read
        // from the round's own score row, not the running gamjeomCount
        // (which in Par Équipe accumulates across the whole match).
        gamjeom: newState[side].scores[roundIdx]?.gamjeom || 0,
      };
      const idx = list.findIndex(x => x.round === rw.round);
      if (idx >= 0) list[idx] = item; else list.push(item);
      entry.roundScores = list.sort((a, b) => a.round - b.round);
    });
  }

  // A drawn round always needs the referee to pick a winner before we can
  // check whether the match is decided (World Taekwondo: every round must
  // have a winner — round ties are broken by the referee, never left open).
  if (roundWinner === 'draw') {
    newState.status = 'paused';
    newState.pendingRoundDecision = true;
    return newState;
  }

  return finalizeRoundResult(newState);
}

/**
 * World Taekwondo Best-of-N rule, applied after every completed round:
 * the moment a competitor has won the majority of rounds (2 of 3), the
 * match ends IMMEDIATELY — the deciding round is never started, even if
 * rounds numerically remain. Only called once a round has a real winner
 * (draws must be resolved first). Shared by endRound and resolveDrawRound
 * so a referee's manual tie-break decision is checked the same way.
 */
function finalizeRoundResult(newState: MatchState): MatchState {
  // Par Équipe (BOTH "rotation" and "substitution" sub-modes): the match is
  // never decided by round majority — every round is played out by whoever
  // is on the mat for that team, regardless of who is ahead after any given
  // round. Once the configured number of rounds is over, freeze the match
  // (status 'finished', no `result` yet) and wait for the operator to
  // manually reveal the team winner (by total point difference). This used
  // to only apply when teamMode === 'rotation' — in 'substitution' mode
  // (dynamic player changes, no fixed rounds-per-player) it silently fell
  // through to the individual best-of-N majority logic below, so the match
  // could end and declare an individual "winner" after just 1-2 rounds
  // instead of playing through every configured round and deciding by team
  // total score, exactly like rotation mode does.
  if (newState.config.competitionMode === 'par_equipe') {
    // Par Équipe (BOTH "rotation" and "substitution" sub-modes): total
    // rounds is always config.rounds — the fixed round count the operator
    // configured for the match, exactly like any individual match. The
    // roster's per-player `rounds` field only decides WHICH athlete is on
    // the mat for a given round (rotation mode); it must never cut the
    // match short. Previously, rotation mode derived totalRounds from the
    // roster itself (Math.min of each side's summed player.rounds), which
    // defaults to 1 round per player whenever the operator adds an athlete
    // without setting a custom round count (the Admin roster editor has no
    // per-player rounds field) — a team with one athlete per side would
    // then see the match end after round 1, instead of playing out every
    // configured round and deciding the team winner by total point score.
    // getRotationEntryForRound() already handles a roster shorter than
    // config.rounds gracefully: once a side's roster is exhausted it simply
    // keeps the last athlete on the mat for the remaining rounds, rather
    // than leaving the slot empty — so using config.rounds here is always
    // safe, even for a single-athlete-per-side roster.
    const totalRounds = newState.config.rounds;
    if (totalRounds > 0 && newState.currentRound >= totalRounds) {
      newState.status = 'finished';
      newState.awaitingTeamReveal = true;
      return newState;
    }
    newState.status = 'rest';
    newState.timeRemaining = newState.config.restTime;
    return newState;
  }

  // Majority formula: floor(rounds/2) + 1 — the smallest number of round
  // wins that can no longer be caught up by the opponent, for ANY
  // configured round count (odd or even). For the classic 3-round match
  // this is 2 (identical to the old Math.ceil(3/2) formula — no change in
  // behavior there). For an even round count like 2, this is now 2 instead
  // of 1: winning the very first round must NOT end the match — every
  // competitor must fight at least `rounds` rounds before a result is
  // possible, exactly as configured by the operator. (Previously
  // Math.ceil(rounds/2) gave 1 for rounds=2, so a single round win ended
  // the match immediately — the reported bug.)
  const winsNeeded = Math.floor(newState.config.rounds / 2) + 1;
  const chungWins = newState.roundWinners.filter(r => r.winner === 'chung').length;
  const hongWins = newState.roundWinners.filter(r => r.winner === 'hong').length;

  if (chungWins >= winsNeeded) {
    newState.result = { winner: 'chung', method: 'PTF', finalScore: { chung: newState.chung.totalScore, hong: newState.hong.totalScore } };
    newState.status = 'finished';
    return newState;
  }
  if (hongWins >= winsNeeded) {
    newState.result = { winner: 'hong', method: 'PTF', finalScore: { chung: newState.chung.totalScore, hong: newState.hong.totalScore } };
    newState.status = 'finished';
    return newState;
  }

  // Nobody has clinched the majority yet.
  const remainingRounds = newState.config.rounds - newState.currentRound;

  // Case 1 — every configured round has now been played and it's still
  // tied (only mathematically possible with an EVEN round count, e.g. 1-1
  // after both rounds of a 2-round match): the match needs one extra
  // decisive round beyond what was configured. Per the operator's
  // goldenRound setting this is either a golden-point (sudden death, first
  // score wins — existing addScore() handling) or a full extra round
  // (played normally; whoever wins it will naturally clear winsNeeded via
  // the checks above once IT finishes).
  if (remainingRounds <= 0 && chungWins === hongWins) {
    newState.status = 'rest';
    newState.timeRemaining = newState.config.restTime;
    if (newState.config.goldenRound) {
      newState.isGoldenRound = true;
      newState.kyeshiUsedThisRound = 0;
    }
    return newState;
  }

  // Case 2 — For the standard WT 3-round format, a golden round is
  // available only AFTER all three regulation rounds are completed and tied.
  // Never convert a 1-1 state into a golden round while round 3 remains.
  // This guard intentionally does nothing here; the normal final-round flow
  // above continues into round 3.

  if (remainingRounds < 0) {
    // Defensive fallback only — an extra round was already played and
    // it's somehow still undecided (shouldn't normally happen: a played
    // round always produces a winner via score/gamjeom tiebreak or
    // referee decision, which would have cleared winsNeeded above). Fall
    // back to total-score tiebreak rather than looping forever.
    const winner: PlayerColor = newState.chung.totalScore >= newState.hong.totalScore ? 'chung' : 'hong';
    newState.result = { winner, method: 'PTF', finalScore: { chung: newState.chung.totalScore, hong: newState.hong.totalScore } };
    newState.status = 'finished';
    return newState;
  }

  // Still undecided with more configured rounds left → move to rest
  // before the next (normal) round.
  newState.status = 'rest';
  newState.timeRemaining = newState.config.restTime;
  return newState;
}

/** Referee resolves a tied round mid-match, then checks Best-of-N completion. */
export function resolveDrawRound(state: MatchState, winner: PlayerColor, decisionType: 'AI_RECOMMENDATION' | 'WOOSE_GIROK' = 'WOOSE_GIROK', votes?: { left?: PlayerColor; center?: PlayerColor; right?: PlayerColor }): MatchState {
  const ns = structuredClone(state);
  const target = ns.roundWinners.find(r => r.round === ns.currentRound);
  if (target) {
    target.winner = winner;
    target.method = 'superiority';
    target.finalDecision = winner;
    target.decisionType = decisionType;
    target.refereeVotes = votes;
    if (ns.teamRoster) {
      (['chung', 'hong'] as PlayerColor[]).forEach((side) => {
        const entry = ns.teamRoster?.[side]?.find(p => p.name === ns[side].player.name);
        const row = entry?.roundScores?.find(r => r.round === target.round);
        if (row) row.winner = winner;
      });
    }
  }
  ns.pendingRoundDecision = false;
  ns.roundTieReview = { phase: 'result', votes: votes || {}, judgeNames: ns.roundTieReview?.judgeNames, judgePhotos: ns.roundTieReview?.judgePhotos, ts: Date.now() };
  ns.roundDecisionRevealUntil = Date.now() + Math.max(0, Number(ns.config.roundResultRevealSeconds ?? 2)) * 1000;
  return finalizeRoundResult(ns);
}

export function startNextRound(state: MatchState): MatchState {
  // Defense in depth: the match is already decided (e.g. 2-0) — refuse to
  // start another round even if something still calls this (Next Round
  // must also be disabled in the UI once state.result is set).
  if (state.result) return state;

  const newState = structuredClone(state);
  // Golden round = 60s sudden death; otherwise standard round time
  newState.timeRemaining = newState.isGoldenRound ? 60 : newState.config.roundTime;
  newState.status = 'fighting';
  newState.awaitingRoundStart = false;
  // Clear the previous WOO-SE-GIROK result when the next round actually starts.
  newState.roundTieReview = undefined;
  newState.kyeshiUsedThisRound = 0;
  // Reset round-level gamjeom counters — but in Par Équipe
  // (scoreResetPerRound === false) warnings accumulate across the whole
  // match just like points, so leave the running total untouched.
  if (newState.config.warningResetPerRound !== false) {
    newState.chung.gamjeomCount = 0;
    newState.hong.gamjeomCount = 0;
  }
  return newState;
}

/**
 * "أفضل لاعب في المباراة" (Match MVP) — the referee reveals this once the
 * match has finished. Built entirely from teamRoster[].roundScores, which
 * endRound() already fills in round-by-round for whichever roster player
 * was actually on the mat that round — so this works identically for both
 * Par Équipe sub-modes (rotation: many players, each with fixed rounds; or
 * substitution: dynamic swaps) without needing a separate data model.
 *
 * `best` = highest total points scored across the whole match (every hit's
 * point value, summed from every round that player played).
 * `fairPlay` = fewest total warnings (gam-jeom) received, among players who
 * actually played at least one round — rewards clean technique, not just
 * "never called up". Ties on points/warnings keep whoever appears first in
 * the roster (stable, deterministic — never random).
 *
 * Returns undefined if there's no teamRoster at all (e.g. an individual
 * match) — nothing is invented for match types that don't track this.
 */
export function computeMvp(state: MatchState): MatchState['mvpReveal'] {
  if (!state.teamRoster) return undefined;
  type Row = { side: PlayerColor; name: string; photo?: string; nationality?: string; playerNumber?: number; points: number; gamjeom: number };
  const rows: Row[] = [];
  (['chung', 'hong'] as PlayerColor[]).forEach((side) => {
    (state.teamRoster?.[side] || []).forEach((entry) => {
      if (!entry.roundScores || entry.roundScores.length === 0) return; // never played — excluded
      const points = entry.roundScores.reduce((sum, r) => sum + (r.score || 0), 0);
      const gamjeom = entry.roundScores.reduce((sum, r) => sum + (r.gamjeom || 0), 0);
      rows.push({ side, name: entry.name, photo: entry.photo, nationality: entry.nationality, playerNumber: entry.playerNumber, points, gamjeom });
    });
  });
  if (rows.length === 0) return undefined;
  const best = [...rows].sort((a, b) => b.points - a.points || a.gamjeom - b.gamjeom)[0];
  const fairPlay = [...rows].sort((a, b) => a.gamjeom - b.gamjeom || b.points - a.points)[0];
  return { best, fairPlay, ts: Date.now() };
}

/**
 * "أفضل لاعب في البولة" (Pool MVP) — per-player totals for ONE finished
 * match, ready to be sent (one row per roster player who actually played)
 * to the `increment_pool_player_stats` RPC so a tournament-wide table can
 * accumulate them match over match. Reuses the exact same points/gamjeom
 * aggregation as computeMvp() so a single match's contribution to the pool
 * total always matches what that match's own MVP card showed — never a
 * separately-invented number. Returns [] when there's no teamRoster (an
 * individual match has no "pool" to contribute to).
 */
export function buildPoolStatsIncrements(state: MatchState): {
  teamName: string; playerName: string; nationality?: string; playerNumber?: number; photo?: string; points: number; gamjeom: number;
}[] {
  if (!state.teamRoster) return [];
  const out: ReturnType<typeof buildPoolStatsIncrements> = [];
  (['chung', 'hong'] as PlayerColor[]).forEach((side) => {
    const teamName = state.teamNames?.[side] || (side === 'chung' ? 'BLUE TEAM' : 'RED TEAM');
    (state.teamRoster?.[side] || []).forEach((entry) => {
      if (!entry.roundScores || entry.roundScores.length === 0) return; // never played — excluded
      const points = entry.roundScores.reduce((sum, r) => sum + (r.score || 0), 0);
      const gamjeom = entry.roundScores.reduce((sum, r) => sum + (r.gamjeom || 0), 0);
      out.push({ teamName, playerName: entry.name, nationality: entry.nationality, playerNumber: entry.playerNumber, photo: entry.photo, points, gamjeom });
    });
  });
  return out;
}

/**
 * Given the raw rows fetched from `pool_player_stats` for a tournament,
 * pick the pool-wide best player (most total points across every match
 * they played in this tournament) and the pool-wide fair-play player
 * (fewest total warnings, among those who actually played). Same
 * tie-break rules as computeMvp() — deterministic, never random.
 */
export function pickPoolMvp<T extends { player_name: string; team_name: string; total_points: number; total_gamjeom: number; matches_played: number; nationality?: string | null; player_number?: number | null; photo?: string | null }>(
  rows: T[]
): { best?: T; fairPlay?: T } {
  const played = rows.filter(r => r.matches_played > 0);
  if (played.length === 0) return {};
  const best = [...played].sort((a, b) => b.total_points - a.total_points || a.total_gamjeom - b.total_gamjeom)[0];
  const fairPlay = [...played].sort((a, b) => a.total_gamjeom - b.total_gamjeom || b.total_points - a.total_points)[0];
  return { best, fairPlay };
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.max(0, seconds) % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function generateBracket(players: { id: string; name: string; nationality: string }[]): {
  matches: Array<{
    id: string;
    round: number;
    position: number;
    player1?: typeof players[0];
    player2?: typeof players[0];
    isBye: boolean;
    nextMatchId?: string;
  }>;
  totalRounds: number;
} {
  const n = players.length;
  let size = 1;
  while (size < n) size *= 2;
  const totalRounds = Math.log2(size);
  
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  while (shuffled.length < size) shuffled.push(undefined as any);
  
  const matches: Array<{
    id: string; round: number; position: number;
    player1?: typeof players[0]; player2?: typeof players[0];
    isBye: boolean; nextMatchId?: string;
  }> = [];
  
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = size / Math.pow(2, round);
    for (let pos = 0; pos < matchesInRound; pos++) {
      const match: typeof matches[0] = { id: crypto.randomUUID(), round, position: pos, isBye: false };
      if (round === 1) {
        const p1 = shuffled[pos * 2];
        const p2 = shuffled[pos * 2 + 1];
        match.player1 = p1 || undefined;
        match.player2 = p2 || undefined;
        match.isBye = !p1 || !p2;
      }
      matches.push(match);
    }
  }
  
  for (let round = 1; round < totalRounds; round++) {
    const currentRoundMatches = matches.filter(m => m.round === round);
    const nextRoundMatches = matches.filter(m => m.round === round + 1);
    currentRoundMatches.forEach((m, idx) => {
      m.nextMatchId = nextRoundMatches[Math.floor(idx / 2)]?.id;
    });
  }
  
  return { matches, totalRounds };
}

// ─────────────────────────────────────────────────────────────────────────
// Highlight Reel Markers — auto-detect the moments a video editor cares
// about (high-value scoring techniques + tie-break decisions) from data
// already tracked on MatchState (state.events, state.roundWinners), and
// export them as a timestamped list. No new state/reducer changes needed:
// this reads existing data only, so it works for any match already played
// or in progress.
// ─────────────────────────────────────────────────────────────────────────

export interface HighlightMarker {
  round: number;
  /** Round clock remaining, formatted mm:ss — matches what's burned into
   *  the on-screen timer in the recorded footage, so an editor can search
   *  the video for this exact displayed time instead of guessing an offset. */
  clockLabel: string;
  player: PlayerColor;
  type: ScoreType;
  points: number;
  label: string;
}

const HIGHLIGHT_TYPE_LABELS: Partial<Record<ScoreType, string>> = {
  head_kick: 'Head kick',
  turning_kick: 'Turning kick',
  turning_head: 'Turning head kick',
};

/** Minimum point value considered "highlight-worthy" — head kick (3) and up. */
const HIGHLIGHT_MIN_POINTS = 3;

export function computeHighlightMarkers(state: MatchState): HighlightMarker[] {
  const markers: HighlightMarker[] = [];

  for (const ev of state.events) {
    const label = HIGHLIGHT_TYPE_LABELS[ev.type];
    if (!label) continue;
    if (ev.points < HIGHLIGHT_MIN_POINTS) continue;
    markers.push({
      round: ev.round,
      clockLabel: formatTime(Math.max(0, ev.time)),
      player: ev.player,
      type: ev.type,
      points: ev.points,
      label,
    });
  }

  for (const rw of state.roundWinners) {
    if (!rw.decisionType) continue;
    const winnerSide = rw.finalDecision || (rw.winner !== 'draw' ? rw.winner : undefined);
    if (!winnerSide) continue;
    const decisionLabel = rw.decisionType === 'WOOSE_GIROK' ? 'Woo-Se-Girok decision' : 'AI tie-break decision';
    markers.push({
      round: rw.round,
      clockLabel: '0:00',
      player: winnerSide,
      type: 'manual',
      points: 0,
      label: decisionLabel,
    });
  }

  // Chronological within each round: latest round clock time (start of
  // round) first is confusing for editors — sort by round, then by
  // descending clock (since roundTime counts down, an earlier real-time
  // event has a HIGHER time-remaining value).
  return markers.sort((a, b) => a.round - b.round || parseClockToSeconds(b.clockLabel) - parseClockToSeconds(a.clockLabel));
}

function parseClockToSeconds(clock: string): number {
  const [m, s] = clock.split(':').map(Number);
  return (m || 0) * 60 + (s || 0);
}

/** Downloads the highlight markers as a CSV file, ready to hand to a video
 *  editor (or import into any editing software's marker list). */
export function exportHighlightMarkersCsv(state: MatchState, matchLabel?: string): boolean {
  const markers = computeHighlightMarkers(state);
  if (markers.length === 0) return false;
  const header = 'Round,Clock,Side,Technique,Points,Note';
  const rows = markers.map(m =>
    [m.round, m.clockLabel, m.player === 'chung' ? 'BLUE' : 'RED', m.label, m.points, ''].join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeLabel = (matchLabel || 'match').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `highlights-${safeLabel}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// Match Replay — a read-only, point-by-point timeline built from the same
// state.events log used everywhere else (highlight markers, PDF export).
// Mirrors addScore()'s exact scoring semantics (gamjeom credits the
// OPPONENT, warning changes no score) so the running totals shown during
// replay always match the real final score — but never mutates state,
// so it's safe to compute at any time, including mid-match.
// ─────────────────────────────────────────────────────────────────────────

export interface ReplayStep {
  event: ScoreEvent;
  /** Cumulative score for each side immediately AFTER this event. */
  chungScore: number;
  hongScore: number;
}

export function computeReplayTimeline(state: MatchState): ReplayStep[] {
  const sorted = [...state.events].sort((a, b) => a.round - b.round || a.timestamp - b.timestamp);
  let chung = 0, hong = 0;
  return sorted.map(event => {
    if (event.type === 'warning') {
      // no score change
    } else if (event.type === 'gamjeom') {
      if (event.player === 'chung') hong += event.points; else chung += event.points;
    } else {
      if (event.player === 'chung') chung += event.points; else hong += event.points;
    }
    return { event, chungScore: chung, hongScore: hong };
  });
}
