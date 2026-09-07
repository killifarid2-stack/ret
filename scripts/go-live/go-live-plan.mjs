import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('release-readiness');
fs.mkdirSync(outDir, { recursive: true });

const plan = {
  generatedAt: new Date().toISOString(),
  product: 'WAB-TKD',
  phase: 'GO-LIVE',
  steps: [
    { id: 'device-registry', title: 'تسجيل كل جهاز MAT', action: 'انسخ mat-config.example.json إلى mat-config.json على كل جهاز واملأ deviceName / matNumber / role' },
    { id: 'public-display', title: 'إعداد شاشة العرض العام', action: 'افتح tournamentWallUrl على شاشة العرض واختبر التحديث اللحظي من مباراة تجريبية' },
    { id: 'env-handoff', title: 'تسليم بيئة الإنتاج', action: 'راجع release-readiness/DEPLOYMENT_HANDOFF.md وتأكد من متغيرات .env على السيرفر' },
    { id: 'migration-runbook', title: 'تنفيذ ترحيل قاعدة البيانات', action: 'اتبع docs/production/PRODUCTION_RUNBOOK_AR.md بالترتيب دون تخطي أي migration' },
    { id: 'backup-recovery', title: 'نسخ احتياطي واسترجاع', action: 'نفّذ نسخة احتياطية فعلية ثم اختبر الاسترجاع منها قبل يوم البطولة' },
    { id: 'dry-run', title: 'تجربة كاملة على أجهزة حقيقية', action: 'نفّذ سيناريو بطولة كامل من Registration إلى Archive على أجهزة MAT الحقيقية' },
    { id: 'network-power-outage', title: 'اختبار انقطاع الشبكة/الكهرباء', action: 'اقطع الشبكة/الكهرباء أثناء مباراة تجريبية وتأكد من عدم فقدان النتيجة' },
    { id: 'save-restore', title: 'اختبار Save/Restore', action: 'أغلق التطبيق فجأة أثناء مباراة وأعد فتحه، تأكد من استرجاع الحالة كاملة' },
    { id: 'conflict-protection', title: 'اختبار حماية التعارض', action: 'افتح نفس المباراة من جهازين وتأكد من ظهور القفل (lease) لأحدهما' },
    { id: 'roles', title: 'ضبط الأدوار', action: 'تأكد من صلاحيات Admin / Supervisor / Referee كل واحد يرى فقط ما يخصه' },
    { id: 'backup-manifest', title: 'توليد Release/Backup Manifest', action: 'npm run production:backup-manifest' },
  ],
};

fs.writeFileSync(path.join(outDir, 'go-live-plan.json'), JSON.stringify(plan, null, 2));
console.log('Go-Live plan created:', path.join(outDir, 'go-live-plan.json'));
console.log(`عدد الخطوات: ${plan.steps.length}`);
