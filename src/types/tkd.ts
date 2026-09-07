// ===== Core TKD Types =====

export type PlayerColor = 'chung' | 'hong';

export type ScoreType = 
  | 'punch'          // 1 point - trunk punch
  | 'trunk_kick'     // 2 points - trunk kick
  | 'head_kick'      // 3 points - head kick
  | 'turning_kick'   // 4 points - turning/spinning trunk kick
  | 'turning_head'   // 6 points - turning/spinning head kick
  | 'manual'         // 1 point - referee correction / not attributed to any technique
  | 'gamjeom'        // 1 point to opponent
  | 'warning';        // administrative warning: 0 live-score points

export const SCORE_VALUES: Record<ScoreType, number> = {
  punch: 1,
  trunk_kick: 2,
  head_kick: 3,
  turning_kick: 4,
  turning_head: 6,
  manual: 1,
  gamjeom: 1,
  warning: 0,
};

export const SCORE_LABELS: Record<ScoreType, string> = {
  punch: 'Punch',
  trunk_kick: 'Trunk Kick',
  head_kick: 'Head Kick',
  turning_kick: 'Turning Kick',
  turning_head: 'Turning Head',
  manual: 'Manual Point',
  gamjeom: 'Gam-jeom',
  warning: 'Warning',
};

export interface Player {
  id: string;
  name: string;
  nationality: string;
  club?: string;
  weight?: number;
  category?: string;
  seedNumber?: number;   // Seed Number (بذرة اللاعب)
  playerNumber?: number; // رقم اللاعب (bib/ID number)
  photo?: string;        // optional player photo, stored as a base64 data URL
  photoUrl?: string;     // صورة اللاعب (اختياري)
  // Par Équipe only: when this Player entry represents a TEAM (not an
  // individual competitor), this holds the team's club/federation logo.
  // Kept as a separate field from photo/photoUrl so the two concepts (team
  // logo vs. individual player photo) are never mixed up in the UI or data.
  teamLogo?: string;
  // Par Équipe only: the smaller secondary club/academy badge, shown
  // alongside teamLogo (the team's own, more prominent logo) — mirrors
  // matches.club_logos but lives on the team entry itself so it survives
  // across tournament reloads and match restarts, not just one live match.
  clubLogo?: string;
}

export interface ScoreEvent {
  id: string;
  round: number;
  player: PlayerColor;
  type: ScoreType;
  points: number;
  time: number; // seconds remaining
  timestamp: number;
  addedBy: 'operator' | 'judge' | 'pss';
  judgeId?: string;
  approved?: boolean;
  /** Optional referee-correction metadata. If true, the event happened in the final 10 seconds even though it was entered after the round ended. */
  correctionCriticalLast10?: boolean;
  /** Optional number of warnings represented by this correction event (1 or 2). */
  warningCount?: 1 | 2;
}

export interface RoundScore {
  attack: number;
  gamjeom: number;
  total: number;
}

export interface MatchPlayer {
  player: Player;
  color: PlayerColor;
  scores: RoundScore[];
  totalScore: number;
  gamjeomCount: number;
  ivrQuota: number;
}

export type MatchStatus = 
  | 'waiting'     // Before match starts
  | 'fighting'    // Round in progress (Shijak)
  | 'paused'      // Kal-lyeo
  | 'timeout'     // Time out
  | 'rest'        // Rest between rounds
  | 'kyeshi'      // Injury time
  | 'ivr'         // Video replay in progress
  | 'doctor'      // Doctor call
  | 'finished';   // Match complete

export type WinMethod = 
  | 'PTF'   // Final Score
  | 'PTG'   // Point Gap
  | 'RSC'   // Referee Stop Contest
  | 'KO'    // Knockout
  | 'DSQ'   // Disqualification (10 gamjeom)
  | 'WDR'   // Withdrawal
  | 'GDP'   // Win by golden points
  | 'SUP'   // Win by superiority
  | 'PUN'   // Referee Punitive Declaration
  | 'DQB'   // Disqualification for unsportsmanlike behavior

export interface MatchResult {
  winner: PlayerColor;
  method: WinMethod;
  finalScore: { chung: number; hong: number };
}

export interface MatchConfig {
  rounds: number;        // Default: 3
  roundTime: number;     // seconds (e.g., 120 = 2:00)
  restTime: number;      // seconds (e.g., 60 = 1:00)
  kyeshiTime: number;    // seconds (e.g., 60)
  kyeshiResetsEachTime: boolean; // true: every Kyeshi call gets the full kyeshiTime from settings. false (default): cumulative — each round shares one kyeshiTime budget, so a second Kyeshi call in the same round continues with whatever budget is left.
  autoCallStageSeconds: number; // legacy team-call auto stage duration (seconds).
  playerCallBlueSeconds: number; // Player Call BLUE dwell time before automatic RED hand-off.
  playerCallRedSeconds: number; // Player Call RED dwell time before the referee WAIT/READY stop.
  playerCallReadyDelaySeconds: number; // Delay after RED READY before the MATCHUP / start-match screen appears.
  playerCallGoLiveDelaySeconds: number; // Delay after TV / GO LIVE before the Player Call overlay is removed from the public display.
  teamCallBlueSeconds: number; // Team Call BLUE dwell time before automatic RED hand-off.
  teamCallRedSeconds: number; // Team Call RED dwell time before the WAITING/HOLD stop.
  teamCallReadyDelaySeconds: number; // Delay from READY to MATCH/START MATCH.
  teamCallGoLiveDelaySeconds: number; // Delay after TV / GO LIVE before the Team Call overlay is removed.
  teamCallAutoEnabled: boolean; // Enables automatic BLUE → RED timing in the Team Call controls.
  gamjeomLimit: number;  // Default: 10
  enforceGamjeomLimit: boolean; // If false, reaching gamjeomLimit does NOT end the round/match (useful for par équipe)
  pointGap: number;      // Current WT 2026 default: 15 — set to 0 to disable PTG
  pointCeiling: number;  // Default: 0 (disabled)
  ivrQuota: number;      // Legacy — used as fallback for both coaches.
  ivrQuotaChung?: number; // Per-coach override for CHUNG's video replay cards
  ivrQuotaHong?: number;  // Per-coach override for HONG's video replay cards
  goldenRound: boolean;  // 4th round on tie
  classification: '1v1' | 'team' | 'para';
  judgeCount: number;    // 1-4 side judges
  scoreResetPerRound: boolean; // Reset displayed/live score to 0 each round (false for par équipe)
  warningResetPerRound: boolean; // Reset administrative warning/gam-jeom counter each round (false for cumulative team rules)
  competitionMode: 'knockout' | 'friendly' | 'league' | 'par_equipe' | 'super_fight';
  ptgDisplayDuration: number;  // seconds — how long the PTG flash animation plays before round winner is announced
  // When true, a side judge's score request is applied to the scoreboard
  // the instant it arrives — no weighted vote, no referee accept/reject
  // notification. When false (default — matches the existing behavior),
  // every judge score goes through the normal majority-vote/approval flow.
  // Toggleable live from the Operator screen, not just at match setup, so
  // the referee can switch modes mid-tournament as needed.
  autoApproveJudgeScores: boolean;
  // Team-call animation (Par Équipe): whether every player's photo shows
  // already on the team-identity screen (both squads at once), or only
  // later when that specific player is individually called up. Persisted
  // per-match/tournament like every other rule, not just kept in memory.
  showRosterPhotosInTeamCall: boolean;
  // Par Équipe: controls whether a mid-round player change uses the cinematic
  // OUT → IN animation. OFF = direct live replacement with no clock pause.
  playerChangeAnimation: boolean;
  // Penalty scheme (WT rules changed over time):
  // 'binary' = two levels (Kyong-go warning +1, Gam-jeom deduction +2) — the
  //   classic/original system, still used by some federations/legacy rules.
  // 'single' = one level only (Gam-jeom +1 to opponent) — matches the
  //   current official WT rule as of the latest rule revision.
  // Admin-configurable per match/tournament, defaults to 'binary' so existing
  // saved matches/tournaments keep behaving exactly as before.
  penaltyScheme: 'binary' | 'single';
  // Critical last-10-seconds penalty rule, shared by 1v1 and Par Équipe.
  last10SecondsRuleEnabled: boolean;
  last10SecondsGamjeomPoints: 1 | 2;
  // Turning-head scoring value. Kept configurable per tournament/match so legacy 5-point rules remain intact.
  turningHeadPoints: 5 | 6;
  // Par Équipe format rules (optional; 'custom' preserves the existing flexible roster behavior).
  parEquipeRosterFormat: 'custom' | '4+1' | '5+1';
  parEquipeTagSeconds: number;
  parEquipeWeightLimitEnabled: boolean;
  parEquipeWeightLimit: number;
  // Super Fight / direct-final tournament structure.
  superFightStructure: 'independent_finals' | 'mini_knockout';
  superFightIndependentSecondMatchMedal: 'gold_silver' | 'bronze_third';
  superFightAvoidSameClub: boolean;
  superFightSeparateAgeGroups: boolean;
  // Smart Matchmaker: allow a category containing one athlete to merge into the nearest populated weight category.
  allowSoloPlayerMerge: boolean;
  // Individual-match round-tie review. Kept in MatchConfig so it persists with saved tournaments/matches.
  roundTieWooSeGirokEnabled?: boolean;
  roundTieAiAnalysisEnabled?: boolean;
  roundTieRefereeMajorityEnabled?: boolean;
  roundTieBroadcastAnimationEnabled?: boolean;
  // How long the decided-round result stays on the public screen before the
  // official rest clock starts. The rest clock is held during this reveal.
  roundResultRevealSeconds?: number;
  // Practice/Training Mode: when true, the match runs exactly as normal
  // but (1) a visible "TRAINING" watermark shows on the operator + public
  // screens so nobody mistakes it for an official bout, and (2) the match
  // is never written to the official archive — no saved-match record, no
  // tournament placement/medal, no club-standings update. Meant for new
  // referees to practice on the real UI without polluting real results.
  trainingMode?: boolean;
  // Par Équipe setup extras (WAB-TKD spec §35) — piggybacked on this
  // already-freeform, already-persisted config object instead of adding
  // dedicated `matches` table columns. Optional, read nowhere by the
  // scoring/judging engine, so Individual matches and V35 are unaffected.
  division?: string;
  coachNames?: { chung?: string; hong?: string };
}


export const DEFAULT_CONFIG: MatchConfig = {
  rounds: 3,
  roundTime: 120,
  restTime: 60,
  kyeshiTime: 60,
  kyeshiResetsEachTime: false,
  autoCallStageSeconds: 3,
  playerCallBlueSeconds: 3,
  playerCallRedSeconds: 3,
  playerCallReadyDelaySeconds: 3,
  playerCallGoLiveDelaySeconds: 3,
  teamCallBlueSeconds: 3,
  teamCallRedSeconds: 3,
  teamCallReadyDelaySeconds: 3,
  teamCallGoLiveDelaySeconds: 2,
  teamCallAutoEnabled: true,
  gamjeomLimit: 10,
  enforceGamjeomLimit: true,
  pointGap: 15,
  pointCeiling: 0,
  ivrQuota: 1,
  goldenRound: true,
  classification: '1v1',
  judgeCount: 3,
  scoreResetPerRound: true,
  warningResetPerRound: true,
  competitionMode: 'knockout',
  ptgDisplayDuration: 5,
  autoApproveJudgeScores: false,
  showRosterPhotosInTeamCall: false,
  playerChangeAnimation: true,
  penaltyScheme: 'binary',
  last10SecondsRuleEnabled: true,
  last10SecondsGamjeomPoints: 2,
  turningHeadPoints: 6,
  parEquipeRosterFormat: 'custom',
  parEquipeTagSeconds: 5,
  parEquipeWeightLimitEnabled: false,
  parEquipeWeightLimit: 0,
  superFightStructure: 'independent_finals',
  superFightIndependentSecondMatchMedal: 'gold_silver',
  superFightAvoidSameClub: true,
  superFightSeparateAgeGroups: true,
  allowSoloPlayerMerge: true,
  roundTieWooSeGirokEnabled: true,
  roundTieAiAnalysisEnabled: true,
  roundTieRefereeMajorityEnabled: true,
  roundTieBroadcastAnimationEnabled: true,
  roundResultRevealSeconds: 2,
  trainingMode: false,
};

export interface RoundWinner {
  round: number;
  winner: PlayerColor | 'draw';
  method: 'score' | 'ptg' | 'ai' | 'superiority' | 'gamjeom' | 'draw';
  chungScore: number;
  hongScore: number;
  // Present when a tied round is analyzed by the AI. It is kept on the
  // round record so the Main Referee, result view, PDF and audit/history
  // screens can review exactly why the AI recommended a side (or why it
  // could not separate the athletes).
  tiebreakDetails?: {
    reason: string;
    winningCriterion: string;
    aiWinner: PlayerColor | 'referee_decision';
    aiConfidence?: number;
    aiScore?: { chung: number; hong: number };
    dataCoverage?: string[];
    chungHeadKicks: number;
    hongHeadKicks: number;
    chungTrunkKicks: number;
    hongTrunkKicks: number;
    chungPunches: number;
    hongPunches: number;
    chungSpinningKicks: number;
    hongSpinningKicks: number;
    chungValidHits: number;
    hongValidHits: number;
    chungPenalties: number;
    hongPenalties: number;
    chungActivity?: number;
    hongActivity?: number;
    chungEffectivePoints?: number;
    hongEffectivePoints?: number;
    chungPssHits?: number;
    hongPssHits?: number;
    chungTurningPoints?: number;
    hongTurningPoints?: number;
    playerReasons?: { chung: string; hong: string };
  };
  aiRecommendation?: PlayerColor | 'unable';
  aiConfidence?: number;
  aiReason?: string;
  refereeVotes?: { left?: PlayerColor; center?: PlayerColor; right?: PlayerColor };
  finalDecision?: PlayerColor;
  decisionType?: 'AI_RECOMMENDATION' | 'WOOSE_GIROK';
}

export type MatchStage =
  | 'qualification'   // التصفيات / الإقصائيات
  | 'round_of_32'
  | 'round_of_16'
  | 'quarterfinal'    // ربع النهائي
  | 'semifinal'       // نصف النهائي
  | 'bronze'          // تحديد المركز الثالث
  | 'final';          // النهائي

// ===== Public display visibility toggles (Admin panel controls what the
// audience screen / scoreboard shows) =====
export interface DisplayConfig {
  showFlag: boolean;    // nationality flag image
  showClub: boolean;    // club name text
  showPhoto: boolean;   // uploaded player photo (falls back to flag when off)
  showStage: boolean;   // match stage badge (quarterfinal, final, ...)
  showWeight: boolean;  // weight category badge
  // Individual 1v1 Winner Result cinematic controls.
  winnerAnimationEnabled: boolean;
  winnerAnimationDurationSeconds: number;
}

export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  showFlag: true,
  showClub: true,
  showPhoto: true,
  showStage: true,
  showWeight: true,
  winnerAnimationEnabled: true,
  winnerAnimationDurationSeconds: 3,
};

// ===== Call-screen visibility toggles (Admin panel controls what the
// call/summon cinematic shows on the audience screen — separate from the
// live-scoreboard DisplayConfig above, since the call screen has its own
// set of elements: team logo, club logo, roster, player photo, etc.) =====
export interface CallDisplayConfig {
  showTeamLogo: boolean;      // team photo/logo frame (phase 'team')
  showClubLogo: boolean;      // club logo badge (phase 'team')
  showTeamCountry: boolean;   // team's country flag + code (phase 'team')
  showRosterList: boolean;    // the team's player name list (phase 'team')
  showRosterPhotos: boolean;  // photos+flags strip for the extra roster players (phase 'team')
  showTournamentName: boolean; // tournament name shown at the top of the call cinematic
  showPlayerPhoto: boolean;   // individual player's photo (phase 'player')
  showPlayerFlag: boolean;    // individual player's nationality flag (phase 'player')
  showPlayerNumbers: boolean; // bib number / team roster number (phase 'player')
  showCategory: boolean;      // weight/category badge (phase 'player')
  showGender: boolean;        // gender badge (phase 'player')
  // Admin toggle for how strong the glow/light effects are on the call
  // cinematic (Player Call, Round Call Preview) — 'broadcast' is the full
  // strength used by default, 'subtle' halves glow/particle intensity for
  // light-sensitive athletes or smaller/dimmer screens.
  lightIntensity: 'broadcast' | 'subtle';
  nameFormat: 'full' | 'initial' | 'large-initial' | 'stacked';
  // Seconds the call frame stays frozen on screen after the referee presses
  // READY/CONFIRM before handing off to the live match. Every hand-off site
  // (single player call, team call, Par Équipe call) reads this same value.
  readyHoldSeconds: number;
}

export const DEFAULT_CALL_DISPLAY_CONFIG: CallDisplayConfig = {
  showTeamLogo: true,
  showClubLogo: true,
  showTeamCountry: true,
  showRosterList: true,
  showRosterPhotos: false,
  showTournamentName: true,
  showPlayerPhoto: true,
  showPlayerFlag: true,
  showPlayerNumbers: true,
  showCategory: true,
  showGender: true,
  lightIntensity: 'broadcast',
  nameFormat: 'full',
  readyHoldSeconds: 3,
};

// One row of a league (round-robin) standings table — a lighter mirror of
// TournamentManager's own LeagueStanding, without the full Player object,
// since only display fields need to cross the broadcast channel to the
// public screen.
export interface LeagueStandingEntry {
  name: string;
  nationality?: string;
  club?: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
}

export const MATCH_STAGE_LABELS: Record<MatchStage, { en: string; ar: string }> = {
  qualification: { en: 'Qualification', ar: 'إقصائيات' },
  round_of_32: { en: 'Round of 32', ar: 'دور الـ32' },
  round_of_16: { en: 'Round of 16', ar: 'دور الـ16' },
  quarterfinal: { en: 'Quarterfinal', ar: 'ربع النهائي' },
  semifinal: { en: 'Semifinal', ar: 'نصف النهائي' },
  bronze: { en: 'Bronze Medal Match', ar: 'مباراة تحديد المركز الثالث' },
  final: { en: 'Final', ar: 'النهائي' },
};

// Short badge label for MatchConfig.competitionMode — shown on the call-up
// screen and live scoreboard so the audience/officials can see at a glance
// whether this bout is part of a knockout tournament, a league/round-robin,
// a friendly, or a Par Équipe (team) match.
export const COMPETITION_MODE_LABELS: Record<'knockout' | 'friendly' | 'league' | 'par_equipe', { en: string; ar: string }> = {
  knockout: { en: 'Tournament', ar: 'بطولة' },
  league: { en: 'League', ar: 'دوري' },
  friendly: { en: 'Friendly', ar: 'ودية' },
  par_equipe: { en: 'Par Équipe', ar: 'بار إيكيب' },
};

// Par Équipe "call" cinematic shown on the public screen — two phases:
// first the team identity (logo + name), then the specific player who is
// about to fight (photo + name + numbers + category). `mode: 'call'`
// (before the very first bout) plays both phases in sequence; `mode:
// 'change'` (mid-tournament substitution) starts directly on 'player'
// since the team side is already known/displayed.
export type BroadcastAnimationState =
  | 'IDLE'
  | 'CALLING_TEAM'
  | 'TEAM_CALLED'
  | 'CALLING_PLAYER'
  | 'PLAYER_CALLED'
  | 'SHOWING_MATCHUP'
  | 'MATCH_READY';

export type BroadcastAnimationKind = 'TEAM_CALL' | 'SINGLE_PLAYER_CALL' | 'MATCHUP';

export interface BroadcastAnimationController {
  state: BroadcastAnimationState;
  activeAnimation?: BroadcastAnimationKind;
  animationId?: string;
  commandId?: string;
  lastCommand?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface CallPlayerSelection {
  name: string;
  nationality?: string;
  playerNumber?: number;
  seedNumber?: number;
  photo?: string;
  category?: string;
  teamName?: string;
  teamLogo?: string;
  clubName?: string;
  clubLogo?: string;
  country?: string;
  // In Par Équipe rotation mode, number of consecutive rounds assigned to this athlete.
  rounds?: number;
}

export interface CallAnimation {
  phase: 'team' | 'player';
  side: PlayerColor;
  // Full team identity is carried into the player call as well, so the
  // audience never loses the relationship between athlete, team and club.
  teamName?: string;
  clubName?: string;
  teamLogo?: string;
  clubLogo?: string;
  teamCountry?: string;
  // phase 'team': team identity + the full roster list (names/nationality/
  // numbers only — NO photos at this phase, by design) sorted ascending by
  // playerNumber (falling back to seedNumber, then roster order) so the
  // audience sees "this is the team, these are its players" before any
  // individual is announced.
  teamCategory?: string; // الفئة/الوزن — نفس فئة المباراة، تبان مرة وحدة فوق لائحة الروستر
  ageGroup?: string;
  animationId?: string;
  roster?: { name: string; nationality: string; rounds?: number; playerNumber?: number; seedNumber?: number; photo?: string; roundScores?: { round: number; score: number; opponentScore: number; winner: PlayerColor | 'draw'; gamjeom?: number }[] }[];
  // phase 'player':
  playerName?: string;
  playerPhoto?: string;
  playerNationality?: string;
  playerNumber?: number;
  seedNumber?: number; // التصنيف — seed/ranking, carried through so the call
  // overlay (and the voice announcer) can show it even for a mid-match
  // substitution, not just the very first call.
  teamPlayerNumber?: number; // اللاعب رقم كم فالفريق (roster position)
  category?: string; // الفئة/الوزن
  gender?: 'male' | 'female'; // جنس اللاعب (من فئة المباراة)
  tournamentName?: string;
  // True only when this 'player' phase was triggered by a mid-match
  // substitution (CONFIRM_SUBSTITUTION), not a fresh first-entrance call —
  // lets the same shared overlay show a distinguishing "PLAYER CHANGE"
  // label so the audience/judges immediately understand this is a swap,
  // not the match starting over.
  isSubstitution?: boolean;
  // Captured from the OUTGOING player right before CONFIRM_SUBSTITUTION
  // overwrites them — lets the substitution overlay show a proper
  // "X → Y" swap (who's leaving, who's coming in) instead of just
  // announcing the new player the same way a fresh call would.
  outgoingName?: string;
  outgoingPhoto?: string;
  outgoingNationality?: string;
  // When the operator triggers a chained call (e.g. chung's call auto-follows
  // into hong's right after), the reducer should carry the queued side over
  // from the dispatched START_CALL_ANIMATION action so the overlay can show
  // a "NEXT: <SIDE>" indicator while the first side's call is still playing.
  // NOTE: this field must be populated by the reducer that handles
  // START_CALL_ANIMATION (not included in this file) — see the operator's
  // `queueNext` param on that action.
  queueNext?: PlayerColor;
  // Explicit Main Referee team call. When true, the cinematic ends as a
  // TEAM_CALLED state and never auto-advances into a player call.
  manualTeamCall?: boolean;
  ts: number;
}

// SINGLE PLAYER CALL — one player at a time, chosen explicitly by the Main
// Referee from that corner's roster (or the currently-assigned player for a
// non-team match). Never a matchup, never a team, never two players.
export interface SinglePlayerCall {
  side: PlayerColor;
  animationId: string;      // unique per CALL/REPLAY — guards against duplicate/overlapping triggers
  status: 'calling' | 'called' | 'ready'; // CALLING_PLAYER -> CALLED -> ✓ READY
  ts: number;                // when the current animation started (also used by REPLAY to restart it)
  // Fully dynamic — every field pulled from the player/team/club/country data
  // at call time. No static/placeholder content.
  playerName: string;
  playerPhoto?: string;
  playerNumber?: number;
  seedNumber?: number;
  category?: string;
  teamName?: string;
  teamLogo?: string;
  clubName?: string;
  clubLogo?: string;
  country?: string;
  matNumber?: number;
}

// MATCHUP — the final "RED PLAYER vs BLUE PLAYER" cinematic shown once both
// competitors are set, right before MATCH READY / START MATCH.
export interface MatchupAnimation {
  animationId: string;
  status: 'showing' | 'ready';
  ts: number;
}

export interface MatchState {
  id: string;
  config: MatchConfig;
  status: MatchStatus;
  // Wall-clock timestamps for the actual bout lifecycle. These are persisted with the match result
  // so the public result screen never invents a new time when it re-renders.
  startedAt?: number;
  finishedAt?: number;
  currentRound: number;
  timeRemaining: number;    // seconds
  chung: MatchPlayer;
  hong: MatchPlayer;
  events: ScoreEvent[];
  result?: MatchResult;
  /** Explicit Main Referee confirmation gate. A finished result is not official/public until confirmed. */
  resultConfirmed?: boolean;
  aiRecommendation?: PlayerColor | 'unable';
  aiConfidence?: number;
  aiReason?: string;
  competitionName?: string;
  matchNumber?: number;
  weightCategory?: string;
  ageGroup?: string;
  gender?: 'male' | 'female';
  matchStage?: MatchStage; // إقصائيات / ربع نهائي / نصف نهائي / نهائي...
  matNumber?: number;      // رقم البساط (Mat/Court number)
  tournamentId?: string;   // linked tournament (Supabase id) when started from a bracket
  bracketMatchId?: string; // which bracket slot this match came from — used to advance the winner and jump to the next match
  ivrRequestedBy?: PlayerColor; // who requested the current video-replay challenge
  roundWinners: RoundWinner[];
  awaitingRoundStart: boolean; // After rest, waiting for operator to press Shijak
  kyeshiUsedThisRound: number; // cumulative kyeshi seconds used in current round
  preKyeshiTimeRemaining?: number; // fight-clock timeRemaining saved when Kyeshi starts, restored when Kyeshi ends so the match resumes exactly where it stopped
  isGoldenRound: boolean;      // sudden-death golden point round
  pendingRoundDecision?: boolean; // round ended in a draw; awaiting referee's manual winner selection
  pendingTeamFinalDecision?: boolean; // Par Équipe final is tied; awaiting Main Referee final team decision
  // Shared public/operator hold so the result reveal and rest timer stay synchronized.
  roundDecisionRevealUntil?: number;
  roundTieReview?: { phase: 'ai' | 'summons' | 'countdown' | 'voting' | 'result'; countdownStep?: 0 | 1 | 2 | 3; votes: { left?: PlayerColor; center?: PlayerColor; right?: PlayerColor }; judgeNames?: { left?: string; center?: string; right?: string }; judgePhotos?: { left?: string; center?: string; right?: string }; ts: number };
  // Individual-match referee correction mode. This is deliberately disabled for Par Équipe.
  // It lets the referee amend a previous round after the clock has already ended, without
  // starting the timer or replaying any round-start animation.
  roundCorrection?: { active: boolean; targetRound: number; originalRound: number; ts: number };
  roundCorrectionReview?: { targetRound: number; ts: number; nextAction: 'REST' | 'WINNER' }; // after correction: show 00:00 LIVE/REST, then restart break before next round/winner
  ptgActive?: boolean;         // PTG triggered this round; locked until referee confirms or next round starts
  ptgWinner?: PlayerColor;     // player who won the round via PTG
  ptgValueAtTrigger?: number;  // the point-gap value in effect when PTG triggered
  ivrLog?: IvrLogEntry[];      // history of every rejected IVR (card withdrawn)
  ivrAnimation?: { decision: 'accepted' | 'rejected'; side: PlayerColor; ts: number };
  koAnimation?: { side: PlayerColor; ts: number };
  // Manually triggered by the operator via the "Golden Point" button that
  // appears once a rest period ends — fires the golden-point cinematic on
  // the public screen (spinning +1 gold coin) independently of the
  // automatic isGoldenRound trigger.
  goldenPointAnimation?: { ts: number };
  // Par Équipe (team mode): either a pre-assigned roster where a different
  // player from each team plays each round ("rotation"), or a single pair
  // of players who can be manually swapped mid-match ("substitution").
  teamMode?: 'rotation' | 'substitution';
  // `rounds` = how many consecutive rounds THIS player plays before the next
  // roster entry is called in. Defaults to 1 when omitted (legacy behavior:
  // one player per round).
  teamRoster?: { chung: { name: string; nationality: string; rounds?: number; playerNumber?: number; seedNumber?: number; photo?: string; roundScores?: { round: number; score: number; opponentScore: number; winner: PlayerColor | 'draw'; gamjeom?: number }[] }[]; hong: { name: string; nationality: string; rounds?: number; playerNumber?: number; seedNumber?: number; photo?: string; roundScores?: { round: number; score: number; opponentScore: number; winner: PlayerColor | 'draw'; gamjeom?: number }[] }[] };
  // MVP ("أفضل لاعب في المباراة") — broadcast card the referee can reveal
  // once the match has a result. Computed from teamRoster[].roundScores
  // (per-player points already tracked round-by-round) so it works for
  // BOTH Par Équipe sub-modes (rotation AND substitution), never invented:
  // if there's no teamRoster (e.g. an individual, non-team match) this
  // stays undefined and no MVP button/overlay is shown.
  mvpReveal?: {
    best?: { side: PlayerColor; name: string; photo?: string; nationality?: string; playerNumber?: number; points: number; gamjeom: number };
    fairPlay?: { side: PlayerColor; name: string; photo?: string; nationality?: string; playerNumber?: number; points: number; gamjeom: number };
    ts: number;
  };
  // Pool MVP ("أفضل لاعب في البولة") — like mvpReveal but tournament-wide:
  // totals accumulated across every match a player played in this
  // tournament (see supabase `pool_player_stats` table + the
  // `increment_pool_player_stats` RPC), not just the current match.
  // Filled asynchronously (OperatorScreen queries Supabase, then
  // dispatches SET_POOL_MVP with the result) since the reducer itself
  // stays synchronous/pure like everywhere else in this file.
  poolMvpReveal?: {
    best?: { teamName: string; name: string; photo?: string; nationality?: string; playerNumber?: number; points: number; gamjeom: number; matchesPlayed: number };
    fairPlay?: { teamName: string; name: string; photo?: string; nationality?: string; playerNumber?: number; points: number; gamjeom: number; matchesPlayed: number };
    ts: number;
  };
  clubNames?: { chung?: string; hong?: string }; // club/academy names displayed beside team identity
  teamNames?: { chung: string; hong: string }; // the two team names (not player names) for Par Équipe
  teamLogos?: { chung?: string; hong?: string }; // club logo, for Par Équipe
  clubLogos?: { chung?: string; hong?: string }; // the two CLUB logos — distinct from the team's own logo (e.g. a team competing under a club/academy banner)
  teamCountry?: { chung?: string; hong?: string }; // the country each team represents (flag shown alongside team logo/name)
  // Par Équipe "rotation" — once every roster player on both sides has
  // played all of their allotted rounds, the match freezes here (status
  // 'finished', but no `result` yet) instead of auto-declaring a winner.
  // The operator must press "Reveal Winner" (dispatch REVEAL_TEAM_RESULT)
  // to compute the winner from the accumulated point totals and broadcast
  // it to the public screen.
  awaitingTeamReveal?: boolean;
  teamResultRevealed?: boolean;
  // Team/substitution feature (Par Équipe): pressing "Substitute" while the
  // round is running just raises this flag — a small banner reminds the
  // referee to pause the round before the swap actually happens. Once
  // paused, the operator gets the full-screen name-entry prompt.
  // When true, the Public Display shows a full-screen "calling" announcement
  // (CHUNG vs HONG, name in their side color) instead of the real scoreboard.
  // Every new match starts with this on — the referee dismisses it with a
  // "Match Ready" button once the athletes are actually on the mat, for any
  // match type (tournament, friendly, or Par Équipe).
  callScreenActive?: boolean;
  connectedJudgeCount?: number; // synced from the Operator screen's Supabase Presence count, for the calling screen
  eventLocation?: string; // e.g. "New York - USA" — shown on the calling screen
  eventDate?: string;     // e.g. "July 15-20, 2027" — shown on the calling screen
  // Par Équipe setup extras (WAB-TKD spec §35): a free-text sub-category
  // below age/weight (e.g. "Cadet Team Division B"), and each team's coach
  // name. Optional and additive — no existing match type reads these, so
  // Individual/V35 scoring is completely unaffected either way.
  division?: string;
  coachNames?: { chung?: string; hong?: string };
  pendingSubstitution?: { side: PlayerColor; ts: number; resumeStatus?: MatchStatus };
  // Exact cinematic from the supplied Par Équipe PLAYER CHANGE project.
  // This exists only for teamMode='substitution' and carries both the
  // outgoing and incoming athlete so the audience sees a real swap.
  substitutionAnimation?: {
    side: PlayerColor;
    oldPlayer: { name: string; photo?: string; nationality?: string; playerNumber?: number; seedNumber?: number };
    newPlayer: { name: string; photo?: string; nationality?: string; playerNumber?: number; seedNumber?: number };
    ts: number;
  };
  // Two-phase "call up"/"change player" cinematic (team logo+name, then
  // player photo+name+numbers+category). See CallAnimation above.
  callAnimation?: CallAnimation;
  // Main Referee manual preview/jump control for the exact Player Call cinematic.
  // Undefined means normal live state-machine derivation; when set, the public
  // display renders that exact cinematic stage without changing match scoring.
  playerCallPreviewState?: 'intro' | 'showRound' | 'showRedPlayer' | 'showBluePlayer' | 'showBothPlayers' | 'ready';
  // Between rounds in Par Équipe, show a short VS preview of the two athletes
  // who will play the upcoming round, then call them individually. This keeps
  // team identity calls exclusive to the first match entrance.
  roundCallPreview?: {
    round: number;
    ts: number;
    chung: { name: string; nationality: string; playerNumber?: number; seedNumber?: number; photo?: string };
    hong: { name: string; nationality: string; playerNumber?: number; seedNumber?: number; photo?: string };
  };
  pendingRoundStartAfterCall?: boolean;
  // When a full "call" (mode: 'call') is triggered for one side with the
  // other side queued to follow, this holds the queued side — consumed
  // (and cleared) automatically once the current side's cinematic finishes,
  // so CHUNG and HONG are always announced one after another, never both
  // at once.
  callAnimationQueue?: PlayerColor;
  // Initial Par Équipe entrance: announce BOTH team identities first, then
  // the two athletes. This is deliberately different from inter-round calls.
  callSequence?: { first: PlayerColor; second: PlayerColor; stage: 'team-second' | 'player-first' | 'player-second' };
  // Bumped by REPLAY_CALL_ANIMATION to restart the currently-visible team/
  // player call cinematic on the public screen WITHOUT touching any match
  // data (score/timer/round/winner/player selection) — the overlay keys off
  // this value the same way it keys off callAnimation.ts.
  callAnimationReplayTs?: number;
  // Round-start intro: played on the public display when the Main Referee
  // presses START ROUND. Clicking anywhere or letting the video end skips
  // it; the match then resumes the exact command that was requested.
  roundStartIntro?: { active: boolean; ts: number; next: 'START' | 'NEXT_ROUND' };

  // ===== SINGLE PLAYER CALL (independent of Par Équipe / team roster) =====
  // Lets the Main Referee call up exactly ONE named player at any time —
  // never a team, never both corners, never a matchup. Works for any match
  // type (1v1 or team). Only the Operator (Main Referee) screen may ever
  // dispatch the actions that touch this field; Broadcast/Public Scoreboard
  // only ever read it.
  singlePlayerCall?: SinglePlayerCall;

  // ===== MATCHUP (SHOW MATCHUP) — final RED vs BLUE reveal =====
  // Triggered manually by the Main Referee after both corners' players are
  // set/called. Purely a display event — carries no match-affecting data,
  // it just reads the current chung/hong player identity dynamically.
  matchupAnimation?: MatchupAnimation;
  testMode?: boolean;          // Equipment/software test mode — scoring during this doesn't count
  testModeSnapshot?: MatchState; // state to restore when test mode is exited
  displayConfig?: DisplayConfig; // Admin-controlled show/hide of flag/club/photo/stage/weight on the public screen
  callDisplayConfig?: CallDisplayConfig; // Admin-controlled show/hide of elements on the call/summon cinematic (Par Équipe)
  // League (round-robin) standings table — computed on the Operator screen
  // whenever a league tournament is loaded (see OperatorScreen's refBracket
  // effect), broadcast here so the public screen can show it on demand.
  leagueStandings?: LeagueStandingEntry[];
  showStandings?: boolean; // operator-toggled — shows the standings table on the audience screen
  // When false, the Public Scoreboard (real second display, the /scoreboard
  // web route, and the Operator's mini-preview) all show the standby
  // splash-banner image instead of any match content — no matter whether
  // the call-up screen or a live bout is technically active underneath.
  // The operator flips this on with the "Start Broadcast" control once
  // everything (names, tournament settings) is ready. Defaults to false on
  // a fresh app launch and persists across RESET (new match) so the
  // audience screen doesn't drop back to the splash between every bout.
  publicBroadcastLive?: boolean;

  // ===== Broadcast command/animation controller =====
  // Single source of truth mirrored to the public window. Only the Main
  // Referee dispatches commands that mutate these fields.
  animationController?: BroadcastAnimationController;
  teamCallStatus: { chung: 'idle' | 'calling' | 'called' | 'ready'; hong: 'idle' | 'calling' | 'called' | 'ready' };
  playerCallStatus: { chung: 'waiting' | 'calling' | 'called' | 'ready'; hong: 'waiting' | 'calling' | 'called' | 'ready' };
  teamCallShowPlayers: boolean;
  selectedCallPlayers?: { chung?: CallPlayerSelection; hong?: CallPlayerSelection };

  // ===== Automatic Call Flow (Main Referee is control, Public Display is
  // output only — see AUTOMATIC CALL FLOW spec). Started explicitly by the
  // Main Referee via START_AUTO_CALL_SEQUENCE. Each stage below still stops
  // and waits for an explicit referee CONFIRM before continuing — this
  // field only tracks WHICH stage is currently waiting so the panel can
  // auto-fire the *next* stage's call the instant the referee confirms the
  // current one. It never skips a confirmation and never auto-starts the
  // match itself.
  autoCallSequence?: AutoCallSequence;
  // Prevent a restored Par Équipe/session snapshot from auto-starting the call flow.
  // A new match is armed for automatic call flow; restored matches require the referee to continue.
  callFlowAutoStartBlocked?: boolean;
}

export type AutoCallSequenceStage =
  | 'TEAM_HONG'
  | 'TEAM_CHUNG'
  // Both teams have been called and confirmed — the flow pauses here on
  // an explicit "WAITING FOR GREETING" stop (courtesy bow between both
  // teams) before player calling begins. Requires its own referee CONFIRM,
  // same as every other stop in the sequence.
  | 'GREETING'
  | 'PLAYER_HONG'
  | 'PLAYER_CHUNG'
  | 'MATCHUP_DELAY'
  | 'MATCHUP'
  | 'DONE';

export interface AutoCallSequence {
  active: boolean;
  stage: AutoCallSequenceStage;
  startedAt: number;
  mode?: 'full' | 'teams' | 'players';
  // Wall-clock time (Date.now()) when the current TEAM_CHUNG stage should
  // auto-advance to TEAM_HONG. Used by a dedicated interval instead of a
  // useEffect keyed to callAnimation fields, which could silently stop
  // firing (stuck on BLUE forever) if any of those fields didn't change
  // exactly the way the effect's dependency array expected.
  stageEndsAt?: number;
}

export interface IvrLogEntry {
  id: string;
  timestamp: number;
  matchNumber?: number;
  competitionName?: string;
  side: PlayerColor;
  playerName: string;
  coachName?: string;
  reason: string;
  remainingCards: number;
}

// ===== Judge Types =====
export interface Judge {
  id: string;
  name: string;
  position: number; // 1-4
  connected: boolean;
  connectionMethod: 'link' | 'camera';
}

export interface ScoreApprovalRequest {
  id: string;
  event: ScoreEvent;
  requestedBy: string;
  votes: Record<string, 'approve' | 'reject'>;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}

export interface IVRRequest {
  id: string;
  requestedBy: PlayerColor;
  round: number;
  time: number;
  votes: Record<string, { action: 'add' | 'remove'; points?: number; type?: ScoreType; target?: PlayerColor; decision: 'accept' | 'reject' }>;
  status: 'pending' | 'accepted' | 'rejected';
  result?: { action: 'add' | 'remove'; player: PlayerColor; type: ScoreType; points: number };
}

// ===== Tournament Types =====
export type TournamentFormat = 'knockout' | 'round_robin';

export interface Tournament {
  id: string;
  name: string;
  date: string;
  location: string;
  format: TournamentFormat;
  categories: TournamentCategory[];
  status: 'draft' | 'active' | 'completed';
}

export interface TournamentCategory {
  id: string;
  name: string;
  gender: 'male' | 'female';
  ageGroup: string;
  weightMin: number;
  weightMax: number;
  players: Player[];
  bracket?: BracketMatch[];
}

export interface BracketMatch {
  id: string;
  round: number;       // bracket round (1 = first round, etc.)
  position: number;    // position in the round
  player1?: Player;
  player2?: Player;
  isBye: boolean;
  winner?: PlayerColor;
  matchState?: MatchState;
  nextMatchId?: string;
}

export interface Club {
  id: string;
  name: string;
  country: string;
  players: Player[];
  points: number;
}
