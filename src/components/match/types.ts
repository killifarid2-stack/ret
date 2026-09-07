export type Corner = "blue" | "red";

export interface Competitor {
  name: string;
  country: string;
  flag: string; // emoji or image url
  club: string;
  corner: Corner;
  title?: string;
  number?: string;
}

export interface RoundResult {
  round: number;
  blue: number;
  red: number;
  warnings?: number;
}

export interface MatchStats {
  headHits: number;
  bodyHits: number;
  totalHits: { blue: number; red: number };
  warnings: number;
  warningLimitPerRound?: number;
}

export interface MatchData {
  matchId: string | number;
  category: string;
  stage: string;
  date: string;
  time: string;
  ring: string | number;
  winner: Competitor;
  score: { blue: number; red: number };
  rounds: RoundResult[];
  stats: MatchStats;
}
