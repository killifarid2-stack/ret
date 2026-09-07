import { describe, it, expect } from 'vitest';
import { createInitialMatchState, addScore, endRound, startNextRound } from './match-engine';
import { MatchConfig } from '@/types/tkd';

// Regression coverage for the reported bug: with rounds=2 configured, the
// match used to end after just ONE round win (Math.ceil(2/2) === 1). It
// must now require BOTH rounds to be played, and — on a 1-1 split — move
// to a decisive round (golden point, or a full extra round when
// goldenRound is disabled).

function playRoundWinner(state: any, winner: 'chung' | 'hong') {
  // Score a single 2-point trunk-kick hit for the winner, then end the round.
  let s = addScore(state, winner, 'trunk_kick');
  return endRound(s);
}

// Mirrors what the MatchContext 'START_NEXT_ROUND' reducer action does on
// top of the lib's startNextRound() (which does NOT itself advance
// currentRound — that increment lives in the reducer).
function advanceToNextRound(state: any) {
  return startNextRound({ ...state, currentRound: state.currentRound + 1 });
}

describe('Par Équipe / individual round-majority fix', () => {
  it('rounds=2 + goldenRound: does NOT end after round 1', () => {
    let state = createInitialMatchState({ rounds: 2, goldenRound: true } as Partial<MatchConfig>);
    state = playRoundWinner(state, 'chung');
    expect(state.result).toBeUndefined();
    expect(state.status).toBe('rest');
  });

  it('rounds=2 + goldenRound: sweeping both rounds decides it (2-0)', () => {
    let state = createInitialMatchState({ rounds: 2, goldenRound: true } as Partial<MatchConfig>);
    state = playRoundWinner(state, 'chung');
    state = advanceToNextRound(state);
    state = playRoundWinner(state, 'chung');
    expect(state.result?.winner).toBe('chung');
    expect(state.status).toBe('finished');
  });

  it('rounds=2 + goldenRound: 1-1 split triggers a golden (sudden-death) round', () => {
    let state = createInitialMatchState({ rounds: 2, goldenRound: true } as Partial<MatchConfig>);
    state = playRoundWinner(state, 'chung');
    state = advanceToNextRound(state);
    state = playRoundWinner(state, 'hong');
    expect(state.result).toBeUndefined();
    expect(state.isGoldenRound).toBe(true);
    // Golden round follows WT: one point does not end; 2+ points are decisive.
    state = advanceToNextRound(state);
    state = addScore(state, 'hong', 'punch');
    expect(state.result).toBeUndefined();
    state = addScore(state, 'hong', 'punch');
    expect(state.result?.winner).toBe('hong');
    expect(state.status).toBe('finished');
  });

  it('rounds=2 + goldenRound DISABLED: 1-1 split plays a full extra round instead', () => {
    let state = createInitialMatchState({ rounds: 2, goldenRound: false } as Partial<MatchConfig>);
    state = playRoundWinner(state, 'chung');
    state = advanceToNextRound(state);
    state = playRoundWinner(state, 'hong');
    expect(state.result).toBeUndefined();
    expect(state.isGoldenRound).toBeFalsy();
    expect(state.status).toBe('rest'); // ready to fight a full 3rd round
    state = advanceToNextRound(state);
    state = playRoundWinner(state, 'hong'); // hong wins the extra round outright
    expect(state.result?.winner).toBe('hong');
    expect(state.status).toBe('finished');
  });

  it('rounds=3 (default/odd): unchanged classic best-of-3 behavior', () => {
    let state = createInitialMatchState({ rounds: 3, goldenRound: true } as Partial<MatchConfig>);
    state = playRoundWinner(state, 'chung');
    state = advanceToNextRound(state);
    state = playRoundWinner(state, 'chung'); // 2-0 — decided before round 3
    expect(state.result?.winner).toBe('chung');
    expect(state.status).toBe('finished');
  });

  it('rounds=3: 1-1 split after round 2 must still play round 3 (no early golden round)', () => {
    let state = createInitialMatchState({ rounds: 3, goldenRound: true } as Partial<MatchConfig>);
    state = playRoundWinner(state, 'chung');
    state = advanceToNextRound(state);
    state = playRoundWinner(state, 'hong');
    // 1-1 after round 2: round 3 is regulation and must still be fought —
    // only a 1-1 split AFTER round 3 goes to a golden round.
    expect(state.isGoldenRound).toBeFalsy();
    expect(state.result).toBeUndefined();
    expect(state.status).toBe('rest');
  });
});
