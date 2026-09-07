# WAB-TKD — 2026-09-07 — 91 Repository Production Hardening

## Source
تمت مراجعة مستودع GitHub العام `killifarid2-stack/ret` باعتباره نسخة 91 المرجعية. المستودع نفسه يحتوي React/Vite/TypeScript وElectron وSupabase وQA/Production scripts، مع وجود أنظمة Multi-Mat وOffline Sync وBackup/Restore وAward/Statistics بالفعل.

## ما تم إغلاقه في نسخة العمل

### 1. Offline Runtime
- إزالة Google Fonts runtime import من `src/index.css`.
- الخطوط تبقى من `@fontsource` المحلية الموجودة في `src/main.tsx`.
- reverse geocoding للموقع بقي optional ولا يمنع البطولة عند Offline.
- Production Asset Audit أصبح يفحص external asset refs وremote font refs.

### 2. Rest / Inter-Round Flow
- إضافة `src/lib/rest-phase.ts`.
- المراحل المرئية:
  - REST / RECOVER
  - NEXT ROUND PREPARATION
  - GET READY FOR NEXT ROUND
  - WAITING FOR REFEREE CONFIRMATION
- عند 00:00 لا يوجد Auto Start؛ الـ reducer ينقل الحالة إلى paused/awaiting confirmation.
- Public Display يوضح صراحة أن الجولة لا تبدأ تلقائيًا.

### 3. Best Referee
- إضافة `src/lib/referee-performance.ts`.
- الترتيب يعتمد فقط على البيانات المسجلة:
  - المباريات التي أدارها الحكم
  - القرارات المسجلة
  - إدخالات تصويت الحكام
  - Evidence confidence
- لا يتم اختراع Decision Accuracy عندما لا توجد بيانات اعتراض/تصحيح رسمية.

### 4. Award Screens
- شاشة Award Animation تستخدم Template الصورة كخلفية ثابتة، والبيانات كـ DOM layers.
- إضافة زر DOWNLOAD CARD.
- التصدير يقوم بتركيب Template + صورة اللاعب + الاسم + الإحصائيات في PNG.
- Best Player / Best Referee / Best Team / Best Club / Team Match MVP / Fair Play / Top Scorer / Top Hitter ما زالت ديناميكية.

### 5. Tournament Statistics
- تصحيح Head Hits / Body Hits لتكون **عدد الأحداث المسجلة** وليس مجموع نقاطها.
- إضافة Total Hits وPoints Scored إلى Dashboard.
- Match MVP لكل مباراة Par Équipe يبقى مبنيًا فقط على `mvp_reveal` المحفوظ.

### 6. QA / Production Gate
- إضافة Rest / Awards Production Flow إلى QA matrix.
- Production audit أصبح يفحص:
  - Offline fonts
  - Rest production flow
  - Referee award engine
  - Award download

## Verification
تم تشغيل:

- `node scripts/production/asset-audit.mjs` → PASS
- `node scripts/production/final-production-audit.mjs` → PASS
- `node scripts/production/final-feature-audit.mjs` → PASS

ملاحظة: البيئة الحالية لا تحتوي executables الخاصة بـ TypeScript/Vite/Vitest داخل `node_modules/.bin`، لذلك لم يتم الادعاء بأن `npm test` أو `npm run build` نجحا. هذه الخطوة تحتاج تثبيت dependencies في بيئة التطوير.

## مهم
لم يتم حذف Team Call أو Match Engine أو Supabase أو Multi-Mat أو Backup/Restore. التعديلات هنا Hardening/Integration وليست إعادة بناء للمشروع.
