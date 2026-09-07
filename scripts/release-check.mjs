import fs from 'node:fs';
import { execSync } from 'node:child_process';

const required = ['package.json', 'vite.config.ts', 'src', 'supabase/migrations', '.env.example', 'vercel.json'];
const missing = required.filter((p) => !fs.existsSync(p));
if (missing.length) {
  console.error('RELEASE CHECK FAILED: missing', missing.join(', '));
  process.exit(1);
}

const env = fs.readFileSync('.env.example', 'utf8');
if (!env.includes('VITE_SUPABASE_URL') || !env.includes('VITE_SUPABASE_PUBLISHABLE_KEY')) {
  console.error('RELEASE CHECK FAILED: production env template is incomplete');
  process.exit(1);
}

console.log('WAB-TKD release structure: PASS');
try {
  execSync('npm run lint', { stdio: 'inherit' });
  console.log('Lint: PASS');
} catch {
  console.error('Lint: FAIL');
  process.exit(2);
}
