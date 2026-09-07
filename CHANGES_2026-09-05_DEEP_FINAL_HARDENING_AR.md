# WAB-TKD — Deep Final Hardening — 2026-09-05

تم تنفيذ مراجعة عميقة بدون تشغيل التطبيق أو الاختبارات.

## 1. Par Équipe — إصلاح مسار بدء المباراة
- أصبح حفظ Archive عملية غير حاجزة لفتح Operator.
- أي فشل في كتابة Archive لا يمنع فتح المباراة الحية.
- تمت إضافة catch حول مسار بدء Par Équipe حتى لا يؤدي خطأ في البيانات/التخزين إلى انهيار الصفحة.
- التحقق من الفريقين والـrosters يبقى إلزاميًا.

## 2. Individual — إعداد مستقل للنقاط والإنذارات
أضيف إلى MatchConfig:
- `scoreResetPerRound`: هل تعاد النقاط إلى صفر في كل جولة؟
- `warningResetPerRound`: هل تعاد عدادات التحذيرات/Gam-jeom إلى صفر في كل جولة؟

القيم الافتراضية للمباريات الفردية: كلاهما `true`.

Par Équipe يبدأ افتراضيًا بـ:
- `scoreResetPerRound = false`
- `warningResetPerRound = false`

وبذلك تبقى نقاط الفريق والإنذارات المتراكمة فعالة بين الجولات.

## 3. Admin + Tournament + Par Équipe Settings
تمت إضافة خيار واضح:
`Warnings reset each round`

- ON: يبدأ عداد التحذيرات من صفر في الجولة الجديدة.
- OFF: تبقى التحذيرات/Gam-jeom سارية في الجولة التالية.

الخيار محفوظ ضمن MatchConfig ويُمرر إلى Tournament/Par Équipe.

## 4. Gam-jeom Limit
عند اختيار عدم تصفير التحذيرات، أصبح فحص الحد يعتمد على المجموع التراكمي حتى الجولة الحالية بدل عداد الجولة فقط.

## 5. إزالة Demo Data من الطبقات التشغيلية
- Final Operations لم يعد يولد مباريات/بطولات تجريبية عند غياب البيانات.
- Player Call data أصبح utility-only ولا يحتوي لاعبًا تجريبيًا.
- Broadcast-new أصبح type-only؛ البيانات الحية تأتي من MatchState.
- `feature-complete` لم يعد يخمن المباراة التالية عند advanceWinner؛ الانتقال الحقيقي مسؤولية الـcanonical bracket.

## 6. مصدر الحقيقة
تم تقليل خطر وجود Match/Bracket logic بديل:
- TournamentManager/Operator = canonical tournament progression.
- Archive/Operations = عرض/تخزين تشغيلي، وليس محرك نتائج بديل.

## 7. Static verification
TypeScript `--noEmit`: PASS.
لم يتم تشغيل Build/E2E/Lint بناءً على طلب العمل بدون تجربة.
