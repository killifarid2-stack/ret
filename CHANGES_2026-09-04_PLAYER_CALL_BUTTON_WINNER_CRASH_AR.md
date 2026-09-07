# WAB-TKD — Player Call Button + Winner Animation Crash — 2026-09-04

## المشكلة المُبلَّغ عنها
1. زر "استدعاء اللاعبين" (Player Call) بجانب NEXT MATCH في OperatorScreen لا يفعل شيئًا عند الضغط — لا تغيير، لا أنيميشن.
2. عند نهاية مباراة فردية، تظهر شاشة خطأ (ErrorBoundary) على شاشة الجمهور بدل أنيميشن الفوز.

## السبب الجذري
1. **زر Player Call:** الـ reducer الخاص بـ `START_PLAYER_CALL_SEQUENCE` (في `src/context/MatchContext.tsx`) يحتوي على حارس صامت:
   ```ts
   if (!name) return state;
   ```
   إذا لم يكن للاعب الزاوية الزرقاء (chung) اسم محدد بعد (لا roster entry، لا selectedCallPlayers، لا player.name)، الحدث يُلغى بصمت تام — بدون أي رسالة، بدون أنيميشن، وكأن الزر معطل. هذا بالضبط ما وصفته.

2. **خطأ نهاية المباراة:** في `src/components/individual-result/IndividualWinnerAnimation.tsx`، السطر:
   ```ts
   const rounds = state.roundWinners.slice()...
   ```
   كان يفترض أن `state.roundWinners` مصفوفة دائمًا. في بعض مسارات إنهاء المباراة (تصحيح يدوي، انسحاب/walkover، إنهاء قبل اكتمال كل الجولات) قد تكون `roundWinners` غير معرّفة، فيرمي `.slice()` استثناء أثناء الـ render، فيلتقطه `ErrorBoundary` ويعرض شاشة الخطأ بدل الأنيميشن.

## الإصلاح
- `src/components/OperatorScreen.tsx`: قبل إرسال `START_PLAYER_CALL_SEQUENCE`، تحقق الآن من وجود اسم للاعب chung. إن لم يوجد، يظهر `toast.error(...)` برسالة واضحة بالعربية بدل الفشل الصامت. لا تغيير في منطق الأنيميشن أو التسلسل نفسه.
- `src/components/individual-result/IndividualWinnerAnimation.tsx`:
  - حارس جديد: `if (!win || !win.player) return null;` بدل الانهيار إذا لم يكن الفائز معرّفًا.
  - `state.roundWinners` أصبحت `(state.roundWinners || [])` — لا مزيد من الانهيار إذا كانت غير معرّفة.

## ما لم يتغيّر
- منطق START_PLAYER_CALL_SEQUENCE نفسه (الـ reducer) لم يُعدَّل — فقط أضفنا تحققًا واجهيًا قبل استدعائه، حسب قاعدة "لا ألمس الأنظمة غير المطلوبة".
- مسار Par Équipe / TeamWinnerScreen لم يُلمس إطلاقًا.
- تصميم أنيميشن الفوز (winner-reveal-cinematic) والـ Player Call الأصلي لم يتغيّر — فقط الحراسة ضد الحالات الناقصة.
- بيانات المباريات، النقاط، المؤقت: لم تُمس.

## ملاحظة مهمة يجب التحقق منها من طرفك
السببان أعلاه يعالجان "الأعراض" (لا تعطّل ولا شاشة سوداء) لكن السبب الحقيقي غالبًا هو: **لاعب الزاوية الزرقاء (chung) لا يملك اسمًا محفوظًا في هذه المباراة عند الضغط على استدعاء اللاعبين**. تحقق من أنك تحدد/تحفظ اللاعبين (Player Picker) قبل الضغط على "استدعاء اللاعبين" — الآن سيظهر لك تنبيه واضح بدل الصمت لو نسيت هذه الخطوة.
