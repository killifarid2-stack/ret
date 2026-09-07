export type Player = {
  name: string;
  photo: string;
  teamName: string;
  clubName: string;
  teamLogo: string;
  clubLogo: string;
  country: string;
  /** ISO 3166-1 alpha-2 code (e.g. "tr") OR a full image URL. Empty = derive from country. */
  flag: string;
  weight: string;
  ageGroup?: string;
  gender?: string;
  ranking: string;
  seed: number;
  previousScore: string;
  /** Win probability shown on the broadcast card, 0-100. */
  winRate: number;
};

export type UpcomingRound = {
  round: number;
  /** Stage label, e.g. "SEMI-FINAL", "QUARTER-FINAL", "FINAL". */
  roundStage: string;
  category: string;
  weightCategory: string;
  eventDate: string;
  eventLocation: string;
  /** Current mat/court number, when known. Omit to hide the badge entirely. */
  matNumber?: number;
  matchNumber?: number;
  tournamentType?: string;
  gender?: string;
  ageGroup?: string;
  division?: string;
  redPlayer: Player;
  bluePlayer: Player;
};

/** The ordered broadcast animation states. */
export type BroadcastState =
  | "intro"
  | "showRound"
  | "showRedPlayer"
  | "showBluePlayer"
  | "showBothPlayers"
  | "ready";

export const BROADCAST_SEQUENCE: BroadcastState[] = [
  "intro",
  "showRound",
  "showBluePlayer",
  "showRedPlayer",
  "showBothPlayers",
  "ready",
];

export type Side = "red" | "blue";
