import { describe, expect, it } from 'vitest';
import { matchReducer } from './MatchContext';

const base: any = {
  id: 'pe-1', status: 'fighting', currentRound: 1, timeRemaining: 90, events: [],
  teamMode: 'substitution', config: { competitionMode: 'par_equipe', playerChangeAnimation: true },
  chung: { player: { name: 'Blue A', nationality: 'MA' }, totalScore: 0, gamjeomCount: 0, color: 'chung', ivrQuota: 0 },
  hong: { player: { name: 'Red A', nationality: 'MA' }, totalScore: 0, gamjeomCount: 0, color: 'hong', ivrQuota: 0 },
};

describe('Par Équipe player-change timing', () => {
  it('pauses during cinematic and resumes fighting after it clears', () => {
    const paused: any = matchReducer(base, { type: 'REQUEST_SUBSTITUTION', side: 'hong' });
    expect(paused.status).toBe('paused');
    expect(paused.pendingSubstitution.resumeStatus).toBe('fighting');

    const animated: any = matchReducer(paused, { type: 'CONFIRM_SUBSTITUTION', side: 'hong', name: 'Red B', photo: undefined, nationality: 'MA' });
    expect(animated.status).toBe('paused');
    expect(animated.substitutionAnimation?.newPlayer.name).toBe('Red B');

    const resumed: any = matchReducer(animated, { type: 'CLEAR_SUBSTITUTION_ANIMATION' });
    expect(resumed.status).toBe('fighting');
    expect(resumed.pendingSubstitution).toBeUndefined();
  });

  it('changes immediately with no pause when animation is OFF', () => {
    const off = { ...base, config: { ...base.config, playerChangeAnimation: false } };
    const pending: any = matchReducer(off, { type: 'REQUEST_SUBSTITUTION', side: 'hong' });
    expect(pending.status).toBe('fighting');
    const changed: any = matchReducer(pending, { type: 'CONFIRM_SUBSTITUTION', side: 'hong', name: 'Red C', photo: undefined, nationality: 'MA' });
    expect(changed.status).toBe('fighting');
    expect(changed.hong.player.name).toBe('Red C');
    expect(changed.substitutionAnimation).toBeUndefined();
  });
});
