# WAB-TKD — Production Runbook

## 1. قبل النشر
- انسخ `.env.example` إلى ملف البيئة المحلي وأدخل القيم الحقيقية خارج المستودع.
- طبّق migrations على قاعدة Production.
- أنشئ أول Backup.
- أنشئ أجهزة MAT وعرّف `deviceId` و`matNumber` لكل حاسوب.
- أنشئ حسابات REFEREE / SUPERVISOR / ADMIN.

## 2. الفحص
```bash
npm install
npm run production:check
npm run mat:check
npm run release:verify
npm run production:release-check
```

## 3. النشر
- أنشئ Vercel Project أو اربط المستودع.
- أضف Environment Variables في Production فقط.
- نفّذ Deploy.
- لا تضع مفاتيح سرية داخل `src/` أو ملفات ZIP.

## 4. Multi-Mat
كل جهاز يملك هوية مستقلة:
`MAT-01`, `MAT-02`, ...
ولا يجوز لجهازين امتلاك نفس Match Lease.

## 5. Recovery
في حالة انقطاع الشبكة أو الكهرباء:
1. أوقف التقدم إذا كانت الحالة غير آمنة.
2. استعمل آخر Safe Snapshot.
3. بعد عودة الاتصال نفّذ Sync.
4. لا تعتمد نتيجة متعارضة تلقائيًا.

## 6. نهاية البطولة
- Finalize Tournament.
- إنشاء Final Snapshot.
- Export Package.
- Backup Database.
- أرشفة النسخة النهائية.
