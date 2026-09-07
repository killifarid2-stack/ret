# WOO-SE-GIROK — Final Applied Integration — 2026-08-30

تم تطبيق التعديلات مباشرة على المشروع الحالي.

## WOO-SE-GIROK
- استخدام asset الذراعين الموجود `src/assets/woose-girok-arms.png` فقط.
- وضع WOO-SE-GIROK بصرياً بين الذراعين.
- وضع HANA / DUL / SET والعد في الفراغ المركزي بين الذراعين.
- `START COUNTDOWN` زر مستقل في Main Referee.
- لا يبدأ العد بمجرد فتح WOO-SE-GIROK.

## Judges
- 3 بطاقات: Side Judge / Center-Mat Referee / Side Judge.
- اسم الحكم يتم أخذه من الحكام المتصلين عند فتح WOO-SE-GIROK مع fallback واضح.
- قرار كل حكم BLUE أو RED فقط.
- عرض القرار والاسم والدور في Main Referee وPublic Display.
- استخدام asset الذراعين الموجود في بطاقات القرار بدون إنشاء صور جديدة.

## Final result
- حساب Majority 2-1 أو Unanimous 3-0.
- Public Display يعرض إطار نتيجة كبير مع الفائز ونتيجة التصويت وقرار الحكام.
- استخدام ذراع الفائز الموجود في المشروع.
- تصحيح خطأ سابق كان يعتمد على تصويت Center فقط بدلاً من الأغلبية.
- بعد اعتماد القرار يبقى عرض النتيجة أثناء REST أو نتيجة المباراة، ثم يتم تنظيف WOO-SE-GIROK عند بدء الجولة التالية.

## Round-end notification
- استبدال إشعار الجولة الكبير بإشعار صغير أعلى الوسط في Main Referee.
- الإشعار يعمل مع العد الحالي 5 ثوانٍ ثم يختفي تلقائياً.
- لا يغطي عناصر التحكم.

## Rest / match flow
- بعد اعتماد قرار الجولة يستمر `finalizeRoundResult` الحالي ويبدأ REST تلقائياً إذا كانت هناك جولة تالية.
- الجولة الأخيرة تنتقل إلى نتيجة المباراة بدون REST.

## Constraints
- لا توجد صور جديدة.
- لم يتم استخدام image generation.
- لم يتم حذف Animations أخرى.
- Par Équipe يبقى خارج مسار WOO-SE-GIROK الفردي.
- Public Display يبقى للعرض فقط ولا يحتوي أزرار تحكم.

## Verification
- `tsc --noEmit` نجح بدون أخطاء.
- تعذر تشغيل Vite build لأن تثبيت dependencies في البيئة انتهى بمهلة، لذلك لا يوجد ادعاء بأن production build تم بنجاح.
