import fs from 'node:fs';
import path from 'node:path';

// كل عنصر: [المسار, الاسم بالعربي، هل إلزامي]
const items = [
  ['mat-config.example.json', 'Device Registry — قالب إعداد كل MAT', true],
  ['supabase/migrations/20260820160000_add_mat_registry.sql', 'Device Registry — جدول قاعدة البيانات', true],
  ['supabase/migrations/20260820150000_add_mat_device_name.sql', 'Device Registry — اسم الجهاز لكل Mat', true],
  ['supabase/migrations/20260820100000_add_mat_live_status.sql', 'Public Display — حالة البث المباشر لكل Mat', true],
  ['supabase/migrations/20260820130000_add_mat_match_queue.sql', 'Public Display — طابور المباريات', true],
  ['DUAL_SCREEN.ar.md', 'إعداد Public Display (شاشة العرض العام)', true],
  ['release-readiness/DEPLOYMENT_HANDOFF.md', 'Production Environment Handoff', true],
  ['docs/production/PRODUCTION_RUNBOOK_AR.md', 'Production Migration Runbook', true],
  ['docs/BACKUP_RECOVERY_AR.md', 'Production Backup + Recovery', true],
  ['release-readiness/backup-manifest.json', 'Backup Manifest', true],
  ['release-readiness/dry-run-plan.json', 'Real Device Dry-Run — خطة التنفيذ', true],
  ['scenarios/TOURNAMENT_DAY_SCENARIOS_AR.md', 'سيناريوهات يوم البطولة (انقطاع شبكة/كهرباء، Save/Restore)', true],
  ['supabase/migrations/20260820170000_add_tournament_operations.sql', 'Conflict Protection + إدارة عمليات البطولة أثناء التشغيل', true],
  ['release-manifest.json', 'Release Manifest', true],
];

let missing = [];
for (const [file, label, required] of items) {
  const exists = fs.existsSync(path.resolve(file));
  console.log(`${exists ? '✅' : '❌'} ${label} (${file})`);
  if (!exists && required) missing.push(file);
}

// عناصر تحتاج تأكيد يدوي لأنها سلوك تشغيلي وليست ملفات فقط (Roles، Conflict Protection الفعلي)
console.log('\n— يحتاج تأكيد يدوي قبل الإطلاق (وليس فحص ملفات فقط):');
console.log('  • أدوار Admin / Supervisor / Referee: تأكد من ضبط الصلاحيات الفعلية داخل Supabase (RLS) لكل دور.');
console.log('  • Conflict Protection أثناء التشغيل: جرّب فتح نفس المباراة من جهازين في نفس الوقت وتأكد من ظهور رسالة القفل (lease).');
console.log('  • Save/Restore Recovery: نفّذ اختبار فعلي (أوقف التطبيق أثناء مباراة وأعد فتحه) وتأكد من استرجاع الحالة.');

if (missing.length) {
  console.error(`\nGO-LIVE CHECK: FAIL — ${missing.length} عنصر ناقص`);
  process.exit(1);
}
console.log('\nGO-LIVE CHECK: PASS');
