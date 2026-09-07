# WAB-TKD — تحكم أنيميشن فوز المباراة الفردية — 2026-09-05

تمت إضافة طبقة تحكم مستقلة للـ Individual 1v1 Winner Result بدون تغيير مسار Par Équipe.

## السلوك

- عند تأكيد نتيجة مباراة فردية:
  - إذا كان `Play Winner Intro Animation` مفعلاً، يظهر الـ cinematic intro لمدة محددة.
  - القيمة الافتراضية: **3 ثوانٍ**.
  - بعد انتهاء المدة، يتم تركيب `MatchResultScreen` من جديد، لذلك تبدأ حركات شاشة النتيجة النهائية من بدايتها ولا تكون قد استهلكت وقتها أثناء الـ intro.
- إذا تم إيقاف `Play Winner Intro Animation`:
  - لا يظهر الـ intro.
  - تظهر شاشة Winner Result النهائية مباشرة.
- مدة الـ intro قابلة للضبط من 0 إلى 10 ثوانٍ بخطوة 0.5 ثانية.
- قيمة 0 ثانية تعني الانتقال المباشر للنتيجة حتى مع بقاء الخيار مفعلاً.

## مكان التحكم

Admin → Public Display → Individual Winner Animation

الخيارات:
1. Play Winner Intro Animation
2. Intro Duration

الإعدادات محفوظة في `localStorage` تحت مفتاح:
`wab-tkd-winner-animation-settings-v1`

كما تدخل إلى `DisplayConfig` حتى تبقى متوافقة مع MatchState وتنتقل مع Reset للمباراة التالية.

## العزل

- Winner Result يبقى على Public Display فقط.
- لا توجد طبقة ثانية فوق Operator/Referee.
- Par Équipe لا يستخدم هذا الـ intro.
- بيانات اللاعب، الدولة، العلم، النادي، النتائج والجولات تستمر في القراءة من MatchState الحقيقي.

## الملفات

- `src/components/individual-result/IndividualWinnerAnimation.tsx`
- `src/components/AdminPanel.tsx`
- `src/components/individual-result/ChampionshipMedal.tsx` (إعادة استخدام، بدون تعديل)
- `src/types/tkd.ts`
- `src/lib/match-engine.ts`
- `src/lib/winner-animation-settings.ts`
- `src/lib/i18n.ts`
- `src/index.css`

## التحقق

تم تشغيل:
`tsc --noEmit`

والفحص TypeScript مرّ بدون أخطاء.
