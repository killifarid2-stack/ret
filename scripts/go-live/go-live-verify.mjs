import { execSync } from 'node:child_process';

function run(cmd) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

try {
  run('node scripts/go-live/go-live-check.mjs');
  run('node scripts/go-live/go-live-plan.mjs');
  run('npm run production:final-check');
  run('npm run build');
  console.log('\nGO-LIVE VERIFY: PASS — المشروع جاهز تقنياً. يبقى التنفيذ الفعلي (نسخ احتياطي حقيقي + تجربة على الأجهزة).');
} catch (e) {
  console.error('\nGO-LIVE VERIFY: FAIL');
  process.exit(1);
}
