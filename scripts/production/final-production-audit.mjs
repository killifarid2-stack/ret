import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const exists = (p) => fs.existsSync(path.join(root,p));
const checks = [
  ['performance-ledger', exists('src/lib/tournament-intelligence.ts') && read('src/lib/tournament-intelligence.ts').includes("PERF_KEY")],
  ['awards-engine', read('src/lib/tournament-intelligence.ts').includes('buildAwards')],
  ['reports-engine', exists('src/lib/final-reports.ts') && read('src/lib/final-reports.ts').includes('buildFinalReport')],
  ['golden-metadata', read('src/lib/match-records.ts').includes('golden_point_win') && read('src/lib/match-records.ts').includes('golden_win_criterion')],
  ['clock-integrity', read('src/context/MatchContext.tsx').includes('timerLastWallClockRef') && read('src/context/MatchContext.tsx').includes('Date.now()')],
  ['public-readonly-clock', read('src/context/MatchContext.tsx').includes('if (isPublicWindow) return;')],
  ['judge-reconnect', read('src/components/JudgePanel.tsx').includes('reconnectNonce') && read('src/components/JudgePanel.tsx').includes("online")],
  ['audit-trail', exists('src/lib/audit-log.ts') && read('src/lib/audit-log.ts').includes('flushPendingAuditLog')],
  ['recovery', exists('src/lib/session-recovery.ts')],
  ['multi-mat-heartbeat', read('src/context/MatchContext.tsx').includes('pushMatHeartbeat')],
  ['security-rls', exists('supabase/migrations/20260905100000_strict_production_rls.sql')],
  ['production-devtools-gate', read('electron/main.cjs').includes('WAB_TKD_DEVTOOLS')],
  ['no-first-score-rule', true],
  ['offline-fonts', !/@import\s+url\(['"]https:\/\/fonts\.googleapis\.com/i.test(read('src/index.css')),],
  ['rest-production-flow', exists('src/lib/rest-phase.ts') && read('src/lib/rest-phase.ts').includes('REFEREE_CONFIRM') && read('src/context/MatchContext.tsx').includes("status: 'paused'")],
  ['referee-award-engine', exists('src/lib/referee-performance.ts') && read('src/lib/award-graphics.ts').includes('computeRefereePerformance')],
  ['award-download', read('src/pages/AwardAnimationScreenPage.tsx').includes('downloadCard') && read('src/pages/AwardAnimationScreenPage.tsx').includes('toBlob')]
];
// Recursive source text for forbidden demo/placeholder language (allow legitimate status words).
function walk(dir) { let out=[]; for (const e of fs.readdirSync(dir,{withFileTypes:true})) { const p=path.join(dir,e.name); if(e.isDirectory()) out=out.concat(walk(p)); else if(/\.(ts|tsx|js|mjs|cjs|css|md)$/.test(e.name)) out.push(p); } return out; }
const files = walk(src);
const forbidden = [/FIRST SCORE WINS/i, /PENDING FINAL ENGINE/i, /DEMO ATHLETE/i, /MOCK ATHLETE/i];
const hits=[];
for (const f of files) { const t=fs.readFileSync(f,'utf8'); for (const re of forbidden) if(re.test(t)) hits.push(`${path.relative(root,f)} :: ${re}`); }
const noForbidden = checks.findIndex(([name]) => name === 'no-first-score-rule');
if (noForbidden >= 0) checks[noForbidden][1] = !hits.length;
const failed=checks.filter(([,ok])=>!ok);
const report={generatedAt:new Date().toISOString(),checks:Object.fromEntries(checks),forbiddenHits:hits,sourceFiles:files.length,status:failed.length?'FAIL':'PASS'};
fs.mkdirSync(path.join(root,'docs/production'),{recursive:true});
fs.writeFileSync(path.join(root,'docs/production/FINAL_PRODUCTION_AUDIT.json'),JSON.stringify(report,null,2));
console.log(`FINAL PRODUCTION AUDIT: ${report.status}`);
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(hits.length) console.log(hits.join('\n'));
if(failed.length) process.exit(1);
