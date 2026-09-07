import fs from 'node:fs';
import path from 'node:path';

const required = [
  'package.json', 'vercel.json', '.env.example', 'mat-config.example.json',
  'scripts/production-check.mjs', 'scripts/release-check.mjs',
  'docs/PRODUCTION_DEPLOYMENT_AR.md', 'docs/MULTI_PC_SETUP_AR.md', 'docs/BACKUP_RECOVERY_AR.md'
];
const missing = required.filter((p) => !fs.existsSync(path.resolve(p)));
const checks = [
  ['result gate', 'src/context/MatchContext.tsx', /CONFIRM_FINAL_RESULT/],
  ['public result gate', 'src/components/PublicScoreboard.tsx', /resultConfirmed/],
  ['canonical bracket', 'src/lib/category-library.ts', /loadCanonicalBracket/],
  ['archive index', 'src/lib/tournament-archive-index.ts', /syncTournamentArchiveIndexToCloud/],
  ['audit trail', 'src/lib/audit-log.ts', /logAudit/],
  ['backup tables', 'src/lib/backup.ts', /tournament_archive_nodes.*audit_log/s],
  ['session recovery', 'src/lib/session-recovery.ts', /loadRecoverableSession/],
  ['substitution timing', 'src/context/MatchContext.tsx', /resumeStatus/],
  ['offline queue processor', 'src/lib/offline-sync.ts', /processPendingSyncActions/],
];
for (const [name, file, pattern] of checks) {
  if (!fs.existsSync(file) || !pattern.test(fs.readFileSync(file, 'utf8'))) {
    console.error(`PRODUCTION RELEASE CHECK: FAIL — missing ${name}`); process.exit(5);
  }
}
if (missing.length) {
  console.error('PRODUCTION RELEASE CHECK: FAIL');
  missing.forEach((p) => console.error(`Missing: ${p}`));
  process.exit(1);
}
console.log('PRODUCTION RELEASE CHECK: PASS');
console.log('Deployment must be executed against the real Vercel/Supabase environment.');
