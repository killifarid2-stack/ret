import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const files=['src/lib/i18n.ts','src/components/OperatorScreen.tsx','src/pages/TournamentFinalizationPage.tsx','src/lib/tournament-intelligence.ts','src/lib/final-reports.ts','src/lib/match-records.ts'];
const forbidden=['FIRST SCORE WINS','first point wins','PENDING FINAL ENGINE'];
let failed=[];
for(const f of files){const text=fs.readFileSync(path.join(root,f),'utf8');for(const x of forbidden)if(text.toLowerCase().includes(x.toLowerCase()))failed.push(`${f}: ${x}`)}
for(const f of files)if(!fs.existsSync(path.join(root,f)))failed.push(`missing: ${f}`);
if(failed.length){console.error(failed.join('\n'));process.exit(1)}
console.log('FINAL FEATURE AUDIT: PASS');
