import { MatchState, PlayerColor, ScoreEvent } from '@/types/tkd';

export type TiebreakWinner = PlayerColor | 'referee_decision';

export interface TiebreakerResult {
  winner: TiebreakWinner;
  winningCriterion: string;
  reason: string;
  chungAdvantage: number;
  hongAdvantage: number;
  confidence: number;
  aiScore: { chung: number; hong: number };
  round?: number;
  dataCoverage: string[];
  details: {
    chungHeadKicks: number; hongHeadKicks: number;
    chungTrunkKicks: number; hongTrunkKicks: number;
    chungPunches: number; hongPunches: number;
    chungSpinningKicks: number; hongSpinningKicks: number;
    chungValidHits: number; hongValidHits: number;
    chungPenalties: number; hongPenalties: number;
    chungActivity: number; hongActivity: number;
    chungEffectivePoints: number; hongEffectivePoints: number;
    chungPssHits: number; hongPssHits: number;
    chungTurningPoints: number; hongTurningPoints: number;
    playerReasons: { chung: string; hong: string };
  };
  json: { winner: 'Blue' | 'Red' | 'Unable_To_Determine'; winning_criterion: string; reason: string; confidence: number; ai_score: { Blue: number; Red: number }; };
}

const TECHNICAL_TYPES = new Set(['punch', 'trunk_kick', 'head_kick', 'turning_kick', 'turning_head']);

/**
 * Local, deterministic AI-style evidence model. It uses only real ScoreEvent
 * data already recorded for the round. It never invents attempts/success-rate
 * data that the match engine does not actually store and it never awards the
 * round: the result is a recommendation for the referee.
 */
export function analyzeTiebreaker(state: MatchState, round?: number): TiebreakerResult {
  const targetRound = round || state.currentRound;
  const events = state.events.filter(e => e.round === targetRound);
  const by = (p: PlayerColor) => events.filter(e => e.player === p);
  const c = by('chung'), h = by('hong');
  const count = (xs: ScoreEvent[], type: string) => xs.filter(e => e.type === type).length;
  const points = (xs: ScoreEvent[], type: string) => xs.filter(e => e.type === type).reduce((s, e) => s + Math.max(0, e.points), 0);
  const pssHits = (xs: ScoreEvent[]) => xs.filter(e => e.addedBy === 'pss' && TECHNICAL_TYPES.has(e.type)).length;

  // World Taekwondo Article 15.5 hierarchy for a tied round in Best-of-3:
  // 1) most points from turning/spinning kicks;
  // 2) if technical score is tied, compare higher-value techniques in order
  //    Head → Trunk → Punch → Gam-jeom;
  // 3) if still tied, higher PSS-registered hit count;
  // 4) if still tied, referee/judges decide superiority.
  // The app therefore never substitutes generic "activity", attempts, or a
  // made-up attack-quality score for an official WT criterion.
  const details = {
    chungHeadKicks: count(c, 'head_kick') + count(c, 'turning_head'),
    hongHeadKicks: count(h, 'head_kick') + count(h, 'turning_head'),
    chungTrunkKicks: count(c, 'trunk_kick') + count(c, 'turning_kick'),
    hongTrunkKicks: count(h, 'trunk_kick') + count(h, 'turning_kick'),
    chungPunches: count(c, 'punch'), hongPunches: count(h, 'punch'),
    chungSpinningKicks: count(c, 'turning_head') + count(c, 'turning_kick'),
    hongSpinningKicks: count(h, 'turning_head') + count(h, 'turning_kick'),
    chungTurningPoints: points(c, 'turning_kick') + points(c, 'turning_head'),
    hongTurningPoints: points(h, 'turning_kick') + points(h, 'turning_head'),
    chungValidHits: c.filter(e => TECHNICAL_TYPES.has(e.type)).length,
    hongValidHits: h.filter(e => TECHNICAL_TYPES.has(e.type)).length,
    chungPenalties: count(c, 'gamjeom'), hongPenalties: count(h, 'gamjeom'),
    chungActivity: c.filter(e => TECHNICAL_TYPES.has(e.type) || e.type === 'gamjeom').length,
    hongActivity: h.filter(e => TECHNICAL_TYPES.has(e.type) || e.type === 'gamjeom').length,
    chungEffectivePoints: c.filter(e => TECHNICAL_TYPES.has(e.type)).reduce((s,e) => s + Math.max(0,e.points),0),
    hongEffectivePoints: h.filter(e => TECHNICAL_TYPES.has(e.type)).reduce((s,e) => s + Math.max(0,e.points),0),
    chungPssHits: pssHits(c),
    hongPssHits: pssHits(h),
  };

  const blueTurning = details.chungTurningPoints;
  const redTurning = details.hongTurningPoints;
  const blueHead = points(c, 'head_kick');
  const redHead = points(h, 'head_kick');
  const blueTrunk = points(c, 'trunk_kick');
  const redTrunk = points(h, 'trunk_kick');
  const bluePunch = points(c, 'punch');
  const redPunch = points(h, 'punch');
  const blueGamjeom = points(c, 'gamjeom');
  const redGamjeom = points(h, 'gamjeom');

  let winner: TiebreakWinner = 'referee_decision';
  let winningCriterion = 'Referee/judges superiority required';
  let confidence = 0;

  const decide = (blueValue: number, redValue: number, criterion: string, conf: number) => {
    if (blueValue === redValue || winner !== 'referee_decision') return;
    winner = blueValue > redValue ? 'chung' : 'hong';
    winningCriterion = criterion;
    confidence = conf;
  };

  decide(blueTurning, redTurning, 'WT 15.5.1 — Most points scored by turning/spinning kick', 96);
  if ((winner as string) === 'referee_decision') decide(blueHead, redHead, 'WT 15.5.2 — Higher-value technique: HEAD', 93);
  if ((winner as string) === 'referee_decision') decide(blueTrunk, redTrunk, 'WT 15.5.2 — Higher-value technique: TRUNK', 90);
  if ((winner as string) === 'referee_decision') decide(bluePunch, redPunch, 'WT 15.5.2 — Higher-value technique: PUNCH', 88);
  if ((winner as string) === 'referee_decision') decide(redGamjeom, blueGamjeom, 'WT 15.5.2 — Higher-value technique: GAM-JEOM', 86);
  if ((winner as string) === 'referee_decision') decide(details.chungPssHits, details.hongPssHits, 'WT 15.5.3 — Higher PSS-registered hit count', 82);

  const evidence = [
    ['turning/spinning points', blueTurning, redTurning],
    ['head technique points', blueHead, redHead],
    ['trunk technique points', blueTrunk, redTrunk],
    ['punch points', bluePunch, redPunch],
    ['gam-jeom points received by opponent', redGamjeom, blueGamjeom],
    ['PSS-registered hits', details.chungPssHits, details.hongPssHits],
  ] as const;

  const reason = winner === 'referee_decision'
    ? `Round ${targetRound}: all available WT superiority criteria are tied. ${details.chungPssHits + details.hongPssHits === 0 ? 'No PSS hit events were recorded, so the system cannot invent a PSS advantage.' : 'PSS hit counts are also tied.'} Referee/judges must determine superiority from the content of the round.`
    : `Round ${targetRound}: ${winner === 'chung' ? 'BLUE' : 'RED'} is recommended by the strict WT tied-round hierarchy at ${winningCriterion}. The AI is only a decision-support recommendation; the referee remains final authority.`;

  const sideReason = (side: PlayerColor) => {
    const prefix = side === 'chung' ? 'BLUE' : 'RED';
    const other = side === 'chung' ? 'RED' : 'BLUE';
    const vals = side === 'chung'
      ? { turning: blueTurning, head: blueHead, trunk: blueTrunk, punch: bluePunch, gam: redGamjeom, pss: details.chungPssHits }
      : { turning: redTurning, head: redHead, trunk: redTrunk, punch: redPunch, gam: blueGamjeom, pss: details.hongPssHits };
    const opp = side === 'chung'
      ? { turning: redTurning, head: redHead, trunk: redTrunk, punch: redPunch, gam: blueGamjeom, pss: details.hongPssHits }
      : { turning: blueTurning, head: blueHead, trunk: blueTrunk, punch: bluePunch, gam: redGamjeom, pss: details.chungPssHits };
    const reasons: string[] = [];
    if (vals.turning !== opp.turning) reasons.push(`turning/spinning points ${vals.turning} vs ${opp.turning}`);
    else if (vals.head !== opp.head) reasons.push(`head technique points ${vals.head} vs ${opp.head}`);
    else if (vals.trunk !== opp.trunk) reasons.push(`trunk technique points ${vals.trunk} vs ${opp.trunk}`);
    else if (vals.punch !== opp.punch) reasons.push(`punch points ${vals.punch} vs ${opp.punch}`);
    else if (vals.gam !== opp.gam) reasons.push(`Gam-jeom superiority ${vals.gam} vs ${opp.gam}`);
    else if (vals.pss !== opp.pss) reasons.push(`PSS-registered hits ${vals.pss} vs ${opp.pss}`);
    return reasons.length ? `${prefix}: ${reasons[0]}.` : `${prefix}: no measurable advantage under the WT tied-round hierarchy over ${other}.`;
  };

  const playerReasons = { chung: sideReason('chung'), hong: sideReason('hong') };
  const fullDetails = { ...details, playerReasons };
  const winnerValue = winner as string;
  const blueScore = winnerValue === 'chung' ? 100 : winnerValue === 'hong' ? 0 : 50;
  const redScore = 100 - blueScore;
  const dataCount = evidence.reduce((sum, [,a,b]) => sum + Math.max(0,a,b), 0);
  if (winnerValue === 'referee_decision') confidence = dataCount ? 40 : 0;

  const json = {
    winner: winnerValue === 'chung' ? 'Blue' as const : winnerValue === 'hong' ? 'Red' as const : 'Unable_To_Determine' as const,
    winning_criterion: winningCriterion,
    reason, confidence, ai_score: { Blue: blueScore, Red: redScore },
  };

  return {
    winner,
    winningCriterion,
    reason,
    chungAdvantage: blueTurning + blueHead + blueTrunk + bluePunch,
    hongAdvantage: redTurning + redHead + redTrunk + redPunch,
    confidence,
    aiScore: { chung: blueScore, hong: redScore },
    round: targetRound,
    dataCoverage: evidence.map(([label]) => label),
    details: fullDetails,
    json,
  };
}
