import { LeagueStandingEntry } from '@/types/tkd';

// Minimal shape needed to compute standings — matches both TournamentManager's
// own LeagueMatch (player1/player2 are full Player objects) and the lighter
// normalized shape OperatorScreen loads for the referee strip.
export interface LeagueStandingInput {
  player1: { id: string; name: string; nationality?: string; club?: string };
  player2: { id: string; name: string; nationality?: string; club?: string };
  winner?: string;
  score?: string;
}

/**
 * Same win/diff/head-to-head tiebreak logic as TournamentManager's local
 * computeLeagueStandings, but returns the lighter LeagueStandingEntry shape
 * (name/nationality/club instead of a full Player) so it can be broadcast
 * to the public screen without dragging photos/ids across the wire.
 */
export function computeLeagueStandingsDisplay(matches: LeagueStandingInput[]): LeagueStandingEntry[] {
  const byId = new Map<string, LeagueStandingEntry & { id: string }>();
  const get = (p: LeagueStandingInput['player1']) => {
    if (!byId.has(p.id)) byId.set(p.id, { id: p.id, name: p.name, nationality: p.nationality, club: p.club, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0 });
    return byId.get(p.id)!;
  };
  for (const m of matches) {
    if (!m.winner || !m.score) continue; // not played yet
    const [s1, s2] = m.score.split('-').map(Number);
    const chungScore = Number.isFinite(s1) ? s1 : 0;
    const hongScore = Number.isFinite(s2) ? s2 : 0;
    const st1 = get(m.player1);
    const st2 = get(m.player2);
    st1.played++; st2.played++;
    st1.pointsFor += chungScore; st1.pointsAgainst += hongScore;
    st2.pointsFor += hongScore; st2.pointsAgainst += chungScore;
    if (m.winner === 'chung') { st1.wins++; st2.losses++; } else { st2.wins++; st1.losses++; }
  }
  for (const st of byId.values()) st.diff = st.pointsFor - st.pointsAgainst;
  const standings = Array.from(byId.values());
  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.diff !== a.diff) return b.diff - a.diff;
    const h2h = matches.find(m =>
      (m.player1.id === a.id && m.player2.id === b.id) ||
      (m.player1.id === b.id && m.player2.id === a.id)
    );
    if (h2h && h2h.winner) {
      const aWonH2h = (h2h.player1.id === a.id && h2h.winner === 'chung') || (h2h.player2.id === a.id && h2h.winner === 'hong');
      if (aWonH2h) return -1;
      return 1;
    }
    return 0;
  });
  return standings.map(({ id, ...rest }) => rest);
}
