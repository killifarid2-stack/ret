import { describe, expect, it } from 'vitest';
import { generateSuperFightMatches } from './super-fight-matchmaker';

describe('super fight matchmaker', () => {
  const players = [
    { id: '1', name: 'A', club: 'Club A', ageGroup: 'Senior', category: '-68kg' },
    { id: '2', name: 'B', club: 'Club B', ageGroup: 'Senior', category: '-68kg' },
    { id: '3', name: 'C', club: 'Club C', ageGroup: 'Senior', category: '-68kg' },
    { id: '4', name: 'D', club: 'Club D', ageGroup: 'Senior', category: '-68kg' },
    { id: '5', name: 'E', club: 'Club E', ageGroup: 'Cadet', category: '-68kg' },
  ];

  it('never mixes age groups and supports independent finals', () => {
    const result = generateSuperFightMatches(players, { structure: 'independent_finals', independentSecondMatchMedal: 'bronze_third', avoidSameClub: true, separateAgeGroups: true });
    expect(result.matches.filter(m => m.stage === 'independent_final')).toHaveLength(2);
    expect(result.unpaired.map(p => p.id)).toEqual(['5']);
    expect(result.matches[0].target_medal).toBe('gold_silver');
    expect(result.matches[1].target_medal).toBe('bronze_third');
  });

  it('creates two semis, final and bronze for four players', () => {
    const result = generateSuperFightMatches(players.slice(0, 4), { structure: 'mini_knockout', independentSecondMatchMedal: 'gold_silver', avoidSameClub: true, separateAgeGroups: true });
    expect(result.matches.map(m => m.stage)).toEqual(['semi_final', 'semi_final', 'final', 'bronze']);
  });
});
