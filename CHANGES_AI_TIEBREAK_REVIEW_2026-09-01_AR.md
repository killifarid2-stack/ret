# WAB-TKD — AI Tiebreaker / WOO-SE-GIROK / Broadcast Review

تم تعديل المشروع الحالي مع الحفاظ على منطق التسجيل والأنيميشنات الأصلية الأخرى.

## 1. AI Tiebreaker
- زر **AI TIEBREAKER** أصبح ظاهرًا في واجهة الحكم الرئيسي حتى أثناء المباراة.
- بجانبه زر **NEXT MATCH**.
- أثناء القتال، AI Tiebreaker يعمل كتحليل استشاري فقط ولا يحسم الجولة.
- عند انتهاء جولة بالتعادل، يصبح مسار القرار مفتوحًا ويظهر:
  - AI TIEBREAKER
  - WOO-SE-GIROK
  - BLUE — ROUND WINNER
  - RED — ROUND WINNER
- إذا لم يستطع AI تحديد الأفضلية، يبقى **UNABLE TO DETERMINE / REFEREE DECISION REQUIRED** ولا يتم الحسم تلقائيًا.
- أضيف تفسير مستقل لـ BLUE وتفسير مستقل لـ RED، مع بيان واضح من يستحق الجولة حسب الأدلة المسجلة عندما تكون الأدلة كافية.

## 2. WOO-SE-GIROK
- يبقى مخصصًا لتعادل الجولة الفردية.
- يستخدم أنيميشن/صور أذرع الحكام الموجودة في المشروع.
- أزرار قرار BLUE/RED متاحة في شاشة قرار التعادل ولا تختفي بسبب فتح تحليل AI.
- القرار المسجل يحدد لاحقًا هل كان **AI_RECOMMENDATION** أو **WOOSE_GIROK**.

## 3. REST / ROUND DECISION
- أثناء REST بعد جولة تم حسمها بسبب التعادل، يظهر بجانب معلومات الجولة وسم واضح:
  - `AI DECISION`
  - أو `WOO-SE-GIROK`

## 4. VIDEO REPLAY
- لا توجد أزرار اختيار فائز أو WOO-SE-GIROK داخل Video Replay.
- طلب Video Replay يعرض كاميرا BLUE أو RED حسب اللاعب الذي طلب المراجعة.
- تم تقوية الحركة والإضاءة حول صورة الكاميرا مع شارة `BLUE REQUEST` / `RED REQUEST`.

## 5. Winner animation
- تم حذف WinnerAnimation الفردي من شاشة النتيجة لتجنب التداخل/التكرار الذي ظهر في صورة النتيجة الثالثة.
- بقية أنيميشنات الاستدعاء والمباراة لم يتم استبدالها.

## 6. Main Referee / Public Display preview
- تم عزل Public Scoreboard المصغر داخل نافذة المعاينة الخاصة بالحكم الرئيسي.
- العناصر fixed داخل المعاينة أصبحت محلية للنافذة، لذلك لا يمكن للـ Public Display أو أنيميشناته أن تتمدد خارج نافذة المعاينة وتغطي واجهة الحكم الرئيسي.

## 7. Team Call / Player Call
- لم يتم ربط AI Tiebreaker أو WOO-SE-GIROK مع Player Call.
- **PLAYER CALL CONTROLS** يبقى خاصًا بـ Par Équipe كما في التعديل السابق.
- Team Call له مساره المنفصل وزر الإلغاء المنفصل.
