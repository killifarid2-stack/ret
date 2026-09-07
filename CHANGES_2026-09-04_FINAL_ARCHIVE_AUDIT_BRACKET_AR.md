# WAB-TKD — Final Archive / Bracket / Audit Integration — 2026-09-04

تم تنفيذ المرحلة الأخيرة بشكل إضافي فوق المشروع الموجود بدون حذف HOME أو الأنيميشنات الأصلية.

## 1. Archive موحّد
- إضافة طبقة `tournament_archive_nodes` لتجميع Tournament → Gender → Age → Weight عبر الأجهزة.
- استمرار local-first مع مزامنة Supabase عند توفر الاتصال.
- الحفاظ على السجلات القديمة وعدم إجراء migration هدّام.

## 2. Category / Players Cloud
- مزامنة بيانات اللاعبين مع `age_group`, `gender`, `weight_category` إضافة إلى الاسم والنادي والجنسية والرقم والصورة.
- مزامنة كتالوج Age / Weight الموجود أصلًا.

## 3. Bracket
- المباريات الجديدة التي تنشأ من Category Browser تحمل `match_stage` وبيانات `bracket.stage/slot` صريحة بدل الاعتماد على العرض فقط.
- Winner Path يبقى data-driven من سجلات المباريات.

## 4. Audit Trail
- رفع الحد المحلي إلى 500 حدث.
- كل حدث يمكن أن يحمل tournamentId / matchId / category.
- إضافة cloud mirror إلى `audit_log`.
- إضافة مزامنة cloud → local.
- إضافة export مخصص لسجل العمليات.

## 5. Backup
- إضافة `tournament_archive_nodes` و`audit_log` إلى النسخة الاحتياطية.
- إضافة custom Age Catalog إلى local backup/restore.

## 6. App bootstrap
- عند تشغيل التطبيق تتم محاولة مزامنة Archive وAudit تلقائيًا.

## ملاحظة
لم يتم تشغيل build/e2e في هذه المرحلة. هذه الحزمة تمثل التعديلات البرمجية المطلوبة، مع الحفاظ على المكونات والأصول الموجودة.
