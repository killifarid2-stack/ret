import { describe, expect, it } from 'vitest';
import { computeRefereePerformance } from './referee-performance';

describe('referee performance', () => {
  it('ranks only saved officiating evidence and does not invent accuracy', () => {
    const rows: any[] = [
      { id: '1', status: 'finished', referee_name: 'Judge A', referee_decision: [{ refereeVotes: { left: 'chung', center: 'chung' } }] },
      { id: '2', status: 'finished', referee_name: 'Judge A', referee_decision: [] },
      { id: '3', status: 'finished', referee_name: 'Judge B', referee_decision: [] },
    ];
    const result = computeRefereePerformance(rows);
    expect(result[0].name).toBe('Judge A');
    expect(result[0].matches).toBe(2);
    expect(result[0].voteParticipations).toBe(2);
    expect(result[0].score).toBeGreaterThan(result[1].score);
    expect(result[0].confidence).toBeGreaterThan(0);
  });
});
