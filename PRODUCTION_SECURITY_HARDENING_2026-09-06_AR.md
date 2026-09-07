# WAB-TKD — Production Security Hardening — 2026-09-06

تم تطبيق hardening داخل نفس المشروع: عزل Electron sandbox، التحقق من IPC sender، CSP، ASAR integrity + Electron Fuses، إزالة Google Fonts الخارجية من Player Call، والتحقق من payloads وrate limiting في Local Wi‑Fi، وتحويل PINs المحلية إلى PBKDF2 salted hashes مع migration للبيانات القديمة.

ملاحظة: قيم bootstrap القديمة محفوظة فقط كجسر توافق محلي للنسخ الموجودة مسبقاً؛ يجب في بيئة البطولة إنشاء مستخدمين مسمّين وتغيير PINs. لا توجد أسرار Supabase إنتاجية داخل المستودع.

قبل التوزيع النهائي على Windows يجب تشغيل `npm install` ثم `npm run build` و`npm run test` و`npm run test:e2e` و`npm run electron:build`.
