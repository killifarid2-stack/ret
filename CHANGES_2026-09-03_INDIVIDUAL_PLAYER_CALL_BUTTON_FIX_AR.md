# إصلاح زر استدعاء اللاعبين — Individual 1v1 — 2026-09-03

## المشكلة
زر «استدعاء اللاعبين» في المباراة الفردية 1v1 كان يمكن أن يرسل أمر الاستدعاء دون أن يظهر الـExact Player Call على Public Display، خصوصاً عندما تكون حالة `teamMode` القديمة أو حالة MATCHUP عالقة من مرحلة سابقة.

## الإصلاح
- تم اعتماد `competitionMode === 'par_equipe'` فقط لتحديد فصل Par Équipe عن Individual 1v1 في Public Display وExact Player Call.
- تم منع حالة `teamMode` القديمة من تحويل مباراة فردية إلى Renderer خاص بـPar Équipe.
- عند الضغط على «استدعاء اللاعبين» في Individual 1v1، يتم تنظيف MATCHUP/Call visual state القديم فقط ثم تشغيل `START_PLAYER_CALL_SEQUENCE`.
- بيانات المباراة واللاعبين والنتيجة والمؤقت وقاعدة البيانات لا يتم حذفها أو تعديلها.
- زر الإلغاء الحالي يبقى عبر `SET_CALL_CONTROL_WAITING` ويخفي الـAnimation فقط.
- لم يتم تعديل Scoring Engine أو Match Engine أو Tournament Engine أو Save/Restore.

## تدفق الأنيميشن
Individual 1v1:
`CALL PLAYER → BLUE PLAYER → RED PLAYER → MATCHUP → READY → LIVE`

Par Équipe:
يبقى معزولاً ولا يتأثر بهذا الإصلاح.

## ملفات التعديل
- `src/components/OperatorScreen.tsx` — زر الاستدعاء موجود أصلاً ويستمر في استخدام Main Referee/Operator control.
- `src/context/MatchContext.tsx` — إصلاح بدء Player Call وعدم توقفه بسبب MATCHUP قديم.
- `src/components/PublicScoreboard.tsx` — عزل Renderer الفردي عن `teamMode` القديم.
- `src/components/player-call/ExactPlayerCallV515.tsx` — عزل Exact Player Call عن `teamMode` القديم.

## التحقق
تم إجراء فحص ثابت لمسارات Action/Renderer والـguards. لم أتمكن من تشغيل `tsc`/`vite build` داخل بيئة التسليم لأن dependencies غير موجودة، ومحاولة تثبيتها انتهت بمهلة زمنية.
