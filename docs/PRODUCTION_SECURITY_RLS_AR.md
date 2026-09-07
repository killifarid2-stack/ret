# WAB-TKD — Production Security / RLS

## الوضع النهائي

الإصدار الإنتاجي لا يعتمد على PIN الموجود في `localStorage` كوسيلة Authorization لقاعدة البيانات.

الكتابة إلى Supabase تتطلب:

1. جلسة Supabase حقيقية `authenticated` وليست Anonymous.
2. JWT يحتوي على `app_metadata.role` موثوقاً بقيمة `REFEREE` أو `SUPERVISOR` أو `ADMIN`.
3. الـrole يجب أن يُضبط من Backend / service-role workflow، وليس من JavaScript داخل المتصفح.

## الشاشة العامة

Public/Broadcast يمكنها القراءة فقط من الجداول المسموح بها، ولا تملك DML على بيانات البطولة.

## التشغيل المحلي

يمكن للتطبيق العمل Local-first عندما لا يكون Supabase configured. Anonymous auth متاح فقط بشكل opt-in للتطوير عبر:

`VITE_SUPABASE_ALLOW_ANONYMOUS=true`

ولا يجب استخدام هذا الخيار في الإنتاج.

## Provisioning

أنشئ المستخدمين عبر Supabase Auth، ثم اضبط `app_metadata.role` من trusted backend/service-role process. لا تضع service-role key داخل Electron/renderer أو `.env` الخاص بالعميل.

## ملاحظة مهمة

PIN المحلي ما زال مفيداً كطبقة UX/operational role داخل التطبيق، لكنه ليس بديلاً عن RLS authorization.
