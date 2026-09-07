# WAB-TKD — تطوير منطقة LOGIN — 2026-09-04

تم تطوير منطقة تسجيل الدخول/تغيير الدور في `src/components/RoleSwitcher.tsx` مع CSS مخصص داخل `src/index.css`.

## الجديد
- واجهة Login احترافية كبيرة متوافقة مع هوية WAB-TKD.
- شعار التطبيق من `src/assets/app-icon.png`.
- مؤشر `SYSTEM READY` وحالة `SECURE SESSION` والوقت الحي.
- اختيار واضح بين REFEREE / SUPERVISOR / ADMIN مع وصف الصلاحيات.
- تحديد الدور الحالي بإطار وإضاءة خاصة.
- حقل اسم المشغل مع تركيز تلقائي.
- PIN رقمي مع إظهار/إخفاء.
- لوحة أرقام سريعة لإدخال PIN من الفأرة/شاشة اللمس.
- زر CLEAR.
- Enter لإرسال الدخول.
- تصميم responsive للشاشات الصغيرة.
- تحسين زر LOGIN نفسه في TopNav مع مؤشر حالة.
- الإبقاء على منطق المصادقة الحالي، الـPINs، audit log، auto-lock وتبديل الأدوار دون تغيير في قواعد الصلاحيات.
- إزالة عرض الـPINs الافتراضية من واجهة المستخدم حتى لا تظهر معلومات الدخول على الشاشة.

## عدم التغيير
- لا تغيير في Match Engine أو scoring أو tournament data أو Par Équipe أو animations.
- لا تغيير في آلية `AccessControlContext` أو مفاتيح localStorage الحالية.
