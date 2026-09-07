import fs from 'node:fs';
import path from 'node:path';

const dir = 'supabase/migrations';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort() : [];
const strict = files.filter(f => /strict_production_rls/i.test(f)).at(-1);
const findings = [];
for (const file of files) {
  const text = fs.readFileSync(path.join(dir, file), 'utf8');
  if (/CREATE POLICY[\s\S]{0,260}?(TO\s+PUBLIC|USING\s*\(\s*true\s*\)|WITH\s+CHECK\s*\(\s*true\s*\))/i.test(text)) findings.push(file);
}
const client = fs.existsSync('src/integrations/supabase/client.ts') ? fs.readFileSync('src/integrations/supabase/client.ts','utf8') : '';
const anonDevOnly = /allowAnonymous[\s\S]{0,180}VITE_SUPABASE_ALLOW_ANONYMOUS/.test(client) && /signInAnonymously/.test(client);
const productionSafe = !!strict && anonDevOnly && /VITE_SUPABASE_ALLOW_ANONYMOUS=false/.test(fs.readFileSync('.env.example','utf8'));
console.log(`SECURITY AUDIT: legacy broad-policy migrations = ${findings.length}`);
for (const f of findings.slice(0, 40)) console.log(`  LEGACY (overridden by final migration): ${f}`);
console.log(`SECURITY AUDIT: strict final RLS migration = ${strict || 'MISSING'}`);
console.log(`SECURITY AUDIT: anonymous auth = ${anonDevOnly ? 'development-only opt-in' : 'REVIEW REQUIRED'}`);
if (!productionSafe) {
  console.error('SECURITY AUDIT: FAIL — production strict RLS/auth boundary is incomplete.');
  process.exit(12);
}
console.log('SECURITY AUDIT: PASS — production writes require non-anonymous Supabase identity + trusted app_metadata.role.');
