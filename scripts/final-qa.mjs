import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/components/individual-result/IndividualWinnerAnimation.tsx',
  'src/components/individual-result/MatchResultScreen.tsx',
  'src/components/MainRefereeCallPanel.tsx',
  'src/components/SinglePlayerCallOverlay.tsx',
  'src/components/MatchupOverlay.tsx',
  'src/components/player-call/player-change-animation.tsx',
  'src/components/player-call/player-change-modal.tsx',
  'src/components/MatchReplay.tsx',
  'src/components/PublicScoreboard.tsx',
  'src/components/OperatorScreen.tsx',
  'src/context/MatchContext.tsx',
  'src/lib/ai-tiebreaker.ts',
  'src/lib/par-equipe-tournament-archive.ts',
  'src/lib/par-equipe-save.ts',
  'src/lib/mat-conflict.ts',
  'src/lib/qa-center.ts',
  'src/assets/woose-girok-arms.png',
  'src/assets/judge-decision/red-arm.png',
  'src/assets/judge-decision/blue-arm.png',
  'public/woose-girok/woose-girok-arms.png',
];
const checks = [];
for (const rel of requiredFiles) checks.push({name:`FILE ${rel}`, ok:fs.existsSync(path.join(root,rel))});
const read = rel => fs.readFileSync(path.join(root,rel),'utf8');
const ctx = read('src/context/MatchContext.tsx');
const pub = read('src/components/PublicScoreboard.tsx');
const op = read('src/components/OperatorScreen.tsx');
const winner = read('src/components/individual-result/IndividualWinnerAnimation.tsx');
const change = read('src/components/player-call/player-change-animation.tsx');
const assertions = [
 ['INDIVIDUAL WINNER wired to public match-end', pub.includes('IndividualWinnerAnimation') && pub.includes("currentFrame === 'match_end'")],
 ['WOO-SE-GIROK operator control exists', op.includes('WOO-SE-GIROK') && op.includes('RESOLVE_DRAW_ROUND')],
 ['WOO-SE-GIROK public mirror exists', pub.includes('WOO-SE-GIROK') && pub.includes("phase === 'summons'") && pub.includes("phase === 'voting'") && pub.includes("phase === 'result'")],
 ['Tie decision persistence is represented in match state', ctx.includes('RESOLVE_DRAW_ROUND') && ctx.includes('roundTieReview')],
 ['Player Call replay command exists', ctx.includes('REPLAY_SINGLE_PLAYER_CALL')],
 ['Matchup replay command exists', ctx.includes('REPLAY_MATCHUP')],
 ['Team Call replay command exists', ctx.includes('REPLAY_TEAM_CALL')],
 ['Substitution animation has RED/BLUE side handling', change.includes('side') && change.includes('activeSide')],
 ['Video Replay uses side-specific assets', pub.includes('video-replay-available-blue.png') && pub.includes('video-replay-unavailable-red.png')],
 ['Main Referee WATCH REPLAY exists', op.includes('WATCH REPLAY')],
];
for (const [name,ok] of assertions) checks.push({name,ok});
const failed = checks.filter(x=>!x.ok);
console.log(`FINAL QA STATIC CHECKS: ${checks.length - failed.length}/${checks.length} PASS`);
for (const c of checks) console.log(`${c.ok?'PASS':'FAIL'}  ${c.name}`);
if (failed.length) process.exit(1);
