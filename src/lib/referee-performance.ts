import type { LocalMatchRecord } from '@/lib/match-local';

export interface RefereePerformance {
  name: string;
  matches: number;
  recordedDecisions: number;
  voteParticipations: number;
  score: number;
  confidence: number;
}

/**
 * Evidence-only referee ranking. We deliberately do not invent decision
 * accuracy when the archive does not contain an official correction/protest
 * outcome. The score measures the quality/completeness of recorded officiating
 * activity and is presented with a confidence value.
 */
export function computeRefereePerformance(rows: LocalMatchRecord[]): RefereePerformance[] {
  const map = new Map<string, Omit<RefereePerformance, 'score' | 'confidence'>>();
  for (const match of rows) {
    if (match.status !== 'finished' && match.lifecycle_status !== 'COMPLETED') continue;
    const name = String(match.referee_name || '').trim();
    if (!name) continue;
    const current = map.get(name) || { name, matches: 0, recordedDecisions: 0, voteParticipations: 0 };
    current.matches += 1;
    const decisions = Array.isArray(match.referee_decision) ? match.referee_decision : [];
    current.recordedDecisions += decisions.length;
    current.voteParticipations += decisions.reduce((n: number, d: any) => n + (d?.refereeVotes ? Object.keys(d.refereeVotes).filter(k => d.refereeVotes[k]).length : 0), 0);
    map.set(name, current);
  }

  const rowsOut = [...map.values()];
  const maxMatches = Math.max(1, ...rowsOut.map(x => x.matches));
  const maxDecisions = Math.max(1, ...rowsOut.map(x => x.recordedDecisions));
  const maxVotes = Math.max(1, ...rowsOut.map(x => x.voteParticipations));
  return rowsOut.map(x => {
    const activity = (x.matches / maxMatches) * 50;
    const decisions = (x.recordedDecisions / maxDecisions) * 30;
    const votes = (x.voteParticipations / maxVotes) * 20;
    const confidence = Math.min(100, x.matches * 15 + x.recordedDecisions * 5 + x.voteParticipations * 2);
    return { ...x, score: Math.round((activity + decisions + votes) * 10) / 10, confidence };
  }).sort((a, b) => b.score - a.score || b.matches - a.matches || b.recordedDecisions - a.recordedDecisions);
}
