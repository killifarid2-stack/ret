import fs from 'node:fs';
import path from 'node:path';

const required = [
  'package.json','vite.config.ts','vercel.json','.env.example','supabase/config.toml',
  'supabase/migrations','scripts/release-check.mjs','scripts/mat-config-check.mjs',
  'docs/PRODUCTION_DEPLOYMENT_AR.md','docs/MULTI_PC_SETUP_AR.md','docs/BACKUP_RECOVERY_AR.md'
];
const missing = required.filter(p => !fs.existsSync(p));
if (missing.length) { console.error('PRODUCTION CHECK FAILED:', missing.join(', ')); process.exit(1); }
const env = fs.readFileSync('.env.example','utf8');
for (const key of ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY']) {
  if (!env.includes(key)) { console.error('Missing env template key:', key); process.exit(2); }
}
if (fs.existsSync('.env')) {
  const text = fs.readFileSync('.env','utf8');
  if (text.includes('service_role') || text.includes('SUPABASE_SERVICE_ROLE')) {
    console.error('PRODUCTION CHECK FAILED: service-role secret detected in .env'); process.exit(3);
  }
}
const migrations = fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
if (!migrations.length) { console.error('PRODUCTION CHECK FAILED: no migrations'); process.exit(4); }
const manifest = { generatedAt:new Date().toISOString(), migrationCount:migrations.length, migrations };
fs.mkdirSync('release', { recursive: true });
fs.writeFileSync('release/production-migration-manifest.json', JSON.stringify(manifest,null,2));
console.log(`Production structure: PASS (${migrations.length} migrations)`);
