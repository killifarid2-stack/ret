import { describe, expect, it } from 'vitest';
import { createInitialMatchState } from '@/lib/match-engine';
import { matchReducer } from './MatchContext';

describe('match lock', () => {
  it('allows setup player edits before a match starts', () => {
    const state = createInitialMatchState();
    const next = matchReducer(state, {
      type: 'SET_PLAYER', color: 'hong', name: 'RED ATHLETE', nationality: 'MAR',
    });
    expect(next.hong.player.name).toBe('RED ATHLETE');
  });

  it('blocks generic player edits after scoring has started', () => {
    let state = createInitialMatchState();
    state = matchReducer(state, { type: 'START' });
    state = { ...state, events: [{ id: 'e1', round: 1, player: 'hong', type: 'punch', points: 1, time: 100, timestamp: Date.now(), addedBy: 'operator', approved: true }] as any };
    const next = matchReducer(state, {
      type: 'SET_PLAYER', color: 'hong', name: 'SHOULD NOT CHANGE', nationality: 'MAR',
    });
    expect(next.hong.player.name).not.toBe('SHOULD NOT CHANGE');
  });
});
