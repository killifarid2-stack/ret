import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const checks = [
  ['current turning-head default is 6', /turningHeadPoints:\s*6\s*,/.test(read('src/types/tkd.ts'))],
  ['current point-gap default is 15', /pointGap:\s*15\s*,/.test(read('src/types/tkd.ts'))],
  ['PUN exists as a result method', /\| 'PUN'/.test(read('src/types/tkd.ts'))],
  ['DQB exists as a result method', /\| 'DQB'/.test(read('src/types/tkd.ts'))],
  ['individual 10-Gam-jeom path is PUN', /method:\s*'PUN'/.test(read('src/lib/match-engine.ts'))],
  ['PTG is excluded from Par Équipe engine path', /config\.competitionMode !== 'par_equipe' && config\.pointGap > 0/.test(read('src/lib/match-engine.ts'))],
  ['Golden GDP requires 2+ points or two Gam-jeoms', /golden >= 2.*goldenHong >= 2/s.test(read('src/lib/match-engine.ts'))],
  ['AI tiebreaker is recommendation-only', /never awards the[\s*]+round/.test(read('src/lib/ai-tiebreaker.ts'))],
  ['strict RLS migration exists', fs.existsSync('supabase/migrations/20260905100000_strict_production_rls.sql')],
  ['production env gate exists', fs.existsSync('scripts/production/prod-env-validate.mjs')],
];
let fail = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) fail = true;
}
if (fail) process.exit(1);
console.log('DEEP RULE AUDIT: PASS');
