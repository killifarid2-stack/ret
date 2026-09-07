# WAB-TKD — Final Security & Release Status — 2026-09-05

## تم تنفيذه

- إضافة `20260905100000_strict_production_rls.sql`.
- إغلاق DML المجهول على الجداول القابلة للكتابة.
- الكتابة الإنتاجية تتطلب Supabase Auth حقيقياً + `app_metadata.role` موثوقاً.
- Anonymous Auth أصبح opt-in للتطوير فقط.
- إضافة توثيق إعداد Production Security.
- Security audit أصبح يفشل إذا لم توجد طبقة strict RLS النهائية.
- Production Release Check: PASS.
- Production structure check: PASS (21 migrations).
- MAT configuration: PASS.
- لا توجد صور بديلة أو assets مولدة.

## ما لا يمكن إثباته داخل بيئة البناء الحالية

- اتصال فعلي بمشروع Supabase الإنتاجي.
- تشغيل migration على PostgreSQL حقيقي.
- تسجيل دخول مستخدم Auth حقيقي وإصدار JWT مع `app_metadata.role`.
- اختبار شاشة HDMI/TV وجهازين فعليين.
- اختبار Playwright كامل لأن dependencies/lockfile غير مكتملين في الحزمة الحالية.

## شرط النشر

قبل Production يجب:

1. نشر migrations على Supabase.
2. إنشاء مستخدمي Auth الحقيقيين.
3. ضبط `app_metadata.role` عبر trusted backend/service-role فقط.
4. عدم وضع service-role key داخل Electron/renderer.
5. إبقاء `VITE_SUPABASE_ALLOW_ANONYMOUS=false` أو غير مضبوط.
6. تنفيذ smoke test على جهاز المشغل والشاشة العامة.
