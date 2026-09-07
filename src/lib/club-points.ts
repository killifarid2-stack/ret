// CENTRALIZED CLUB / TEAM POINTS ENGINE
// =======================================
// Combines, per club:
//   + match win points (configurable value per win)
//   − warning penalty deductions (see warning-penalty.ts)
//
// Data sources (both already exist, nothing invented):
//   - Individual matches: LocalMatchRecord.chung_club / hong_club
//     (added alongside this feature — see match-local.ts; matches saved
//     BEFORE this field existed won't have a club and are simply skipped,
//     never guessed).
//   - Par Équipe matches: LocalMatchRecord.team_names (chung/hong) — a
//     team's name already doubles as its club identity in this app,
//     consistent with how TeamCallOverlay/AdminPanel treat it.
//
// Medal points (gold/silver/bronze) depend on tournament placement data
// that isn't centrally computed yet elsewhere in the app (only per-match
// results are cached locally) — NOT included here. See
// CLUB_POINTS_KNOWN_GAPS at the bottom of this file for exactly what that
// would need before it can be added honestly instead of guessed.

import { loadAllMatchesLocal } from './match-local';
import { getWarningRecords } from './warning-penalty';
import { computeClubMedalTotals } from './tournament-placements';

const CONFIG_KEY = 'kyorugi_club_points_config_v1';

export interface ClubPointsConfig {
  pointsPerWin: number;
  pointsPerGold: number;
  pointsPerSilver: number;
  pointsPerBronze: number;
}

const DEFAULT_CONFIG: ClubPointsConfig = { pointsPerWin: 3, pointsPerGold: 10, pointsPerSilver: 6, pointsPerBronze: 3 };

export function getClubPointsConfig(): ClubPointsConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveClubPointsConfig(config: ClubPointsConfig) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch { /* best-effort */ }
}

export interface ClubStanding {
  club: string;
  wins: number;
  matchesPlayed: number;
  winPoints: number;
  gold: number;
  silver: number;
  bronze: number;
  medalPoints: number;
  penaltyPoints: number;
  totalPoints: number;
}

export function computeClubStandings(): ClubStanding[] {
  const { pointsPerWin, pointsPerGold, pointsPerSilver, pointsPerBronze } = getClubPointsConfig();
  const matches = loadAllMatchesLocal().filter((m) => m.status === 'finished');
  const table = new Map<string, ClubStanding>();

  const get = (club: string) => {
    const key = club.trim();
    if (!table.has(key)) table.set(key, { club: key, wins: 0, matchesPlayed: 0, winPoints: 0, gold: 0, silver: 0, bronze: 0, medalPoints: 0, penaltyPoints: 0, totalPoints: 0 });
    return table.get(key)!;
  };

  for (const m of matches) {
    // Par Équipe: team_names IS the club identity. Individual: fall back
    // to the per-side chung_club/hong_club captured at save time.
    const chungClub = m.team_names?.chung || m.chung_club;
    const hongClub = m.team_names?.hong || m.hong_club;
    if (chungClub) get(chungClub).matchesPlayed++;
    if (hongClub) get(hongClub).matchesPlayed++;
    const winnerClub = m.winner === 'chung' ? chungClub : m.winner === 'hong' ? hongClub : null;
    if (winnerClub) get(winnerClub).wins++;
  }

  for (const st of table.values()) st.winPoints = st.wins * pointsPerWin;

  // Medal points — see tournament-placements.ts (B1): populated
  // automatically the moment a bracket's final match gets a winner.
  // Tournaments finished before that store existed simply have no
  // record here and contribute 0 medal points — never backfilled/guessed.
  for (const m of computeClubMedalTotals()) {
    if (!m.club) continue;
    const st = get(m.club);
    st.gold += m.gold; st.silver += m.silver; st.bronze += m.bronze;
  }

  for (const w of getWarningRecords()) {
    const key = (w.club || w.teamName || '').trim();
    if (!key) continue;
    get(key).penaltyPoints += w.penaltyPoints;
  }

  for (const st of table.values()) {
    st.medalPoints = st.gold * pointsPerGold + st.silver * pointsPerSilver + st.bronze * pointsPerBronze;
    st.totalPoints = st.winPoints + st.medalPoints - st.penaltyPoints;
  }

  return Array.from(table.values()).sort((a, b) => b.totalPoints - a.totalPoints);
}

/**
 * Data-integrity policy:
 * - Completed knockout brackets receive a single persisted placement record.
 * - Completed round-robin leagues receive a single persisted placement record
 *   through TournamentManager's explicit/automatic league-finalization path.
 * - Matches saved before club capture existed remain excluded when their club
 *   is unknown; the app never invents a club retroactively.
 * - Warning deductions remain separate administrative records and are applied
 *   only to the named club/team.
 *
 * This is deliberate: the club-points page is a configurable tournament
 * standings system, not a hard-coded replacement for a federation's event
 * scoring policy. The organizer controls points-per-win and medal values.
 */
