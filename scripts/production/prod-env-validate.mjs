import fs from 'node:fs';

// Usage:
//   node scripts/production/prod-env-validate.mjs [env-file]
// If no file is supplied and .env is absent, CI/process environment variables
// are validated. This keeps real credentials out of the distributable source ZIP.
const file = process.argv[2] || (fs.existsSync('.env') ? '.env' : null);
const text = file ? fs.readFileSync(file, 'utf8') : '';
const get = (key) => {
  const processValue = process.env[key];
  if (processValue) return processValue.trim();
  if (!text) return '';
  const m = text.match(new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_PUBLISHABLE_KEY');
const allowAnon = get('VITE_SUPABASE_ALLOW_ANONYMOUS').toLowerCase();
const bad = (v) => !v || /placeholder|your[_-]?project|example\.supabase/i.test(v);
if (bad(url) || bad(key)) {
  console.error('PRODUCTION ENV CHECK FAILED: real VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required');
  process.exit(2);
}
if (!/^https:\/\/[^\s]+\.supabase\.co(?:\/.*)?$/i.test(url)) {
  console.error('PRODUCTION ENV CHECK FAILED: VITE_SUPABASE_URL is not a valid Supabase HTTPS URL');
  process.exit(3);
}
if (/service[_-]?role/i.test(key) || /service[_-]?role/i.test(text)) {
  console.error('PRODUCTION ENV CHECK FAILED: service-role secret detected');
  process.exit(4);
}
if (allowAnon === 'true') {
  console.error('PRODUCTION ENV CHECK FAILED: VITE_SUPABASE_ALLOW_ANONYMOUS must be false/omitted in production');
  process.exit(5);
}
console.log(`Production env: PASS (${file || 'process environment'})`);
