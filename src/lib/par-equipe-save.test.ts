import { beforeEach, describe, expect, it } from 'vitest';
import {
  getParEquipeSavedMatch,
  isParEquipeMatch,
  listParEquipeSavedMatches,
  loadParEquipeSafeSnapshot,
  saveParEquipeMatch,
  saveParEquipeSafeSnapshot,
} from './par-equipe-save';

function makeState(overrides: any = {}): any {
  return {
    id: 'match-1',
    config: { competitionMode: 'par_equipe', rounds: 5 },
    status: 'waiting',
    currentRound: 1,
    timeRemaining: 120,
    chung: { player: { name: 'Blue 1', nationality: 'MA' }, totalScore: 0, gamjeomCount: 0 },
    hong: { player: { name: 'Red 1', nationality: 'MA' }, totalScore: 0, gamjeomCount: 0 },
    events: [],
    roundWinners: [],
    teamNames: { chung: 'BLUE TEAM', hong: 'RED TEAM' },
    teamRoster: { chung: [{ name: 'Blue 1', nationality: 'MA' }], hong: [{ name: 'Red 1', nationality: 'MA' }] },
    ...overrides,
  };
}

describe('Par Équipe save + safe snapshot', () => {
  beforeEach(() => localStorage.clear());

  it('never saves an Individual match', () => {
    const state = makeState({ config: { competitionMode: 'individual', rounds: 3 } });
    expect(isParEquipeMatch(state)).toBe(false);
    expect(saveParEquipeMatch(state)).toBeNull();
    expect(listParEquipeSavedMatches()).toHaveLength(0);
  });

  it('updates one save slot instead of duplicating the same match', () => {
    const first = saveParEquipeMatch(makeState({ currentRound: 1 }))!;
    const second = saveParEquipeMatch(makeState({ currentRound: 2 }))!;
    expect(second.saveId).toBe(first.saveId);
    expect(listParEquipeSavedMatches()).toHaveLength(1);
    expect(getParEquipeSavedMatch(first.saveId)?.state.currentRound).toBe(2);
  });

  it('stores and reloads a separate safe snapshot', () => {
    const state = makeState({ currentRound: 3, status: 'paused' });
    saveParEquipeSafeSnapshot(state, 'round_complete');
    const safe = loadParEquipeSafeSnapshot('match-1');
    expect(safe?.matchId).toBe('match-1');
    expect(safe?.reason).toBe('round_complete');
    expect(safe?.state.currentRound).toBe(3);
  });
});
