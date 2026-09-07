# Local Animation Assets — 2026-09-04

تم توحيد ملفات الصور التي تستعملها أنيميشينات العرض داخل `src/assets/animations/`.

المسارات تشمل:
- `player-call/` — صور Player Call والخلفية والكؤوس والشعارات.
- `player-call-exact/` — نسخة Player Call الدقيقة، medal، app icon، الصور والشعارات.
- `kyeshi/` — صورة Kyeshi Call.
- `woose-girok/` — صورة Woose-girok.

جميع هذه الملفات تدخل في Vite bundle عبر imports، ولا تعتمد الأنيميشينات على `/public/...` لهذه الصور.

## Flags
الأعلام المستخدمة في العرض تُحل أولاً من `src/assets/flags/` بصيغة SVG قابلة للتكبير بدون فقدان جودة.
تم إلغاء fallback إلى `flagcdn.com` من مسار العرض حتى لا تظهر صور مكسورة أو تتوقف الأعلام عند انقطاع الإنترنت.

إذا لم يكن علم ISO موجوداً محلياً، يعرض النظام fallback النصي بدلاً من تحميل صورة خارجية.
