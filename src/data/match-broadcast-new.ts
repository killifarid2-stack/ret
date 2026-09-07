export type MatchState = "waiting" | "blue" | "red" | "confirm" | "ready";
export type Tone = "red" | "blue";

export type Player = {
  name: string; category: string; weight: string; rank: string; seed: string;
  photo?: string; nationality?: string; countryCode?: string; ageGroup?: string; gender?: string; playerNumber?: number;
};

export type Team = {
  name: string; club: string; cornerClub: string; country: string; flag: string; countryCode: string; coach: string;
  rank: string; points: string; tone: Tone; crest?: string; teamLogo?: string; clubLogo?: string; players: Player[];
};

export type Standing = {
  name: string; countryCode: string; tone: Tone; points: string; rank: string; advanced: string; performance: number; level: string;
};
