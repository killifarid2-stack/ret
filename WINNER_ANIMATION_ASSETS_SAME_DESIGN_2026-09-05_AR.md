# WAB-TKD — Winner Animation: Same Project Assets / Typography — 2026-09-05

تم تحديث الـ Individual Winner Intro داخل المشروع الحالي ليستخدم نفس موارد التصميم الموجودة فعلياً داخل المشروع، بدلاً من رسم/استبدال هوية بصرية جديدة.

## الأصول المستخدمة
- `src/assets/app-icon.png` — هوية WAB-TKD في شريط الـ Broadcast.
- `src/assets/medal.png` — ميدالية WAB-TKD الأصلية المستخدمة كـ artwork رئيسي في الـ Intro.
- `MatchState.player.photo / photoUrl` — صورة اللاعب الفعلية.
- `MatchState.clubLogos[side] / player.clubLogo` — شعار النادي الفعلي عند توفره.
- `src/assets/flags/*.svg` عبر `getFlagUrl()` — العلم المحلي المتوفر في المشروع، بدون CDN خارجي.
- `ArenaBackground` — خلفية الـ Broadcast الموجودة أصلاً في المشروع.

## الخطوط
الـ Intro يستعمل نفس stack الخاص بالمشروع:
- Orbitron
- Cairo
- Rajdhani

ولا يوجد خط جديد خاص بالـ Winner Intro.

## السلوك
- Intro افتراضياً 3 ثوانٍ.
- مدة الـ Intro مرتبطة بـ `--winner-intro-duration` حتى لا تنتهي الحركة بصرياً قبل المدة المحددة.
- الإعداد OFF أو duration=0 ينتقل مباشرة إلى Winner Result النهائي.
- الـ Intro طبقة Public Display معزولة فقط.
- Par Équipe لا يتأثر.
- بعد الـ Intro يعاد تركيب `MatchResultScreen` لتبدأ حركات النتيجة النهائية من الصفر.

## التحقق
- `tsc --noEmit` نجح بدون أخطاء بعد التعديل.
