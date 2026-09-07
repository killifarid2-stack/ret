import { beforeEach, describe, expect, it } from 'vitest';
import { loadRecoverableSession, saveSessionSnapshot } from './session-recovery';
import { saveParEquipeSafeSnapshot } from './par-equipe-save';

function baseState(overrides: any = {}): any {
  return {
    id: 'match-1',
    config: { competitionMode: 'par_equipe', rounds: 5 },
    status: 'waiting',
    currentRound: 1,
    timeRemaining: 120,
    chung: { player: { name: 'Blue', nationality: 'MA' }, totalScore: 0, gamjeomCount: 0 },
    hong: { player: { name: 'Red', nationality: 'MA' }, totalScore: 0, gamjeomCount: 0 },
    events: [{ id: 'e1', player: 'hong', type: 'punch', points: 1 }],
    roundWinners: [],
    teamCallStatus: { chung: 'called', hong: 'called' },
    playerCallStatus: { chung: 'waiting', hong: 'waiting' },
    ...overrides,
  };
}

describe('Par Équipe recovery safety', () => {
  beforeEach(() => localStorage.clear());

  it('prefers the last safe snapshot over a transient player-call state', () => {
    const safe = baseState({ currentRound: 1, matchupAnimation: { animationId: 'safe', status: 'ready', ts: 1 } });
    saveParEquipeSafeSnapshot(safe, 'match_ready');

    const transient = baseState({
      currentRound: 2,
      singlePlayerCall: { side: 'hong', status: 'calling', animationId: 'live', ts: 2, playerName: 'Red' },
      playerCallStatus: { chung: 'waiting', hong: 'calling' },
    });
    saveSessionSnapshot(transient);

    const recovered = loadRecoverableSession();
    expect(recovered?.state.matchupAnimation?.status).toBe('ready');
    expect(recovered?.state.currentRound).toBe(1);
  });
});
