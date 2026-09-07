import { describe, expect, it } from 'vitest';
import { endRound } from './match-engine';
import type { MatchState } from '@/types/tkd';

function state(mode: 'friendly' | 'league' | 'knockout' | 'par_equipe'): MatchState {
  return {
    config: { competitionMode: mode, rounds: 3 } as any,
    currentRound: 1,
    status: 'live',
    chung: { player: { name: 'Blue' }, scores: [{ total: 0, gamjeom: 0 }] },
    hong: { player: { name: 'Red' }, scores: [{ total: 0, gamjeom: 0 }] },
    events: [
      { id: 'b1', player: 'chung', type: 'head_kick', points: 3, round: 1, timestamp: 1 },
      { id: 'r1', player: 'hong', type: 'trunk_kick', points: 2, round: 1, timestamp: 2 },
    ],
    roundWinners: [],
  } as any;
}

describe('AI round tie-break competition scope', () => {
  it.each(['friendly', 'league', 'knockout'] as const)('applies to %s', (mode) => {
    const s = state(mode);
    s.chung.scores[0].total = 3;
    s.hong.scores[0].total = 3;
    const out = endRound(s);
    expect(out.roundWinners[0].winner).toBe('draw');
    expect(out.pendingRoundDecision).toBe(true);
    expect(out.aiRecommendation).toBe('chung');
  });

  it('does not apply the individual AI tie-breaker to Par Équipe', () => {
    const s = state('par_equipe');
    s.chung.scores[0].total = 3;
    s.hong.scores[0].total = 3;
    const out = endRound(s);
    expect(out.roundWinners[0].winner).toBe('draw');
    expect(out.pendingRoundDecision).toBe(true);
  });
});
