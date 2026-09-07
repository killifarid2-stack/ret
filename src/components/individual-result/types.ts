export type Corner = "blue" | "red";

export interface Competitor {
  name: string;
  country: string;
  flag: string; // local asset key/code only; rendered through FlagImage
  club: string;
  corner: Corner;
  title?: string;
  number?: string;
}

export interface RoundResult {
  round: number;
  winner?: Corner | 'draw';
  blue: number;
  red: number;
  warnings?: number;
  method?: string;
  decisionType?: string;
  decisionLabel?: string;
  tiebreakDetails?: { aiWinner?: string; aiConfidence?: number; aiScore?: { blue?: number; red?: number }; reason?: string; winningCriterion?: string };
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
  tournament?: string;
  category: string;
  stage: string;
  date: string;
  time: string;
  ring: string | number;
  winner: Competitor;
  score: { blue: number; red: number };
  rounds: RoundResult[];
  stats: MatchStats;
  resultMethod?: string;
  decisiveRound?: number;
  resultRound?: number;
  resultStatus?: string;
  refereeConfirmed?: boolean;
  goldenPointWin?: boolean;
  goldenRound?: number;
  display?: { showFlag: boolean; showClub: boolean; showPhoto: boolean; showStage: boolean; showWeight: boolean };
}
