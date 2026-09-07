# WAB-TKD v47 — هذا التسليم / This Delivery

## ✅ تم إصلاحه (Fixed)

### 1. ADMIN و TOURNAMENT كانوا يفتحون مباشرة على مباراة Par Équipe
**السبب:** حالة المباراة (match state) مشتركة عبر كل التطبيق. إذا كانت آخر
مباراة تم العمل عليها (أو استرجاعها) من نوع Par Équipe، كان AdminPanel و
TournamentManager يعرضون واجهة الفريق مباشرة عند فتحهما من HOME، لأنهما لا
يفعلان شيئًا سوى عرض `state.config` كما هو.

**الإصلاح:** أزرار "Admin" و"Tournament" في شاشة HOME فقط (وليس بطاقة "Par
Équipe" المخصصة، ولا استرجاع المباريات المحفوظة) تعيد الآن `competitionMode`
إلى الوضع الافتراضي قبل الدخول — إذا كان عالقًا على `par_equipe`. أي دخول
حقيقي لمباراة Par Équipe (عبر بطاقتها الخاصة أو SAVED MATCHES) يبقى يعمل بلا
أي تغيير.
**الملف:** `src/pages/Index.tsx`

**Root cause:** the match state is a single object shared across the whole
app. If the last match anyone worked on (or recovered) was Par Équipe,
AdminPanel/TournamentManager — which just render whatever `state.config`
currently is — opened straight into team mode from HOME.
**Fix:** HOME's Admin/Tournament cards only now reset `competitionMode` back
to default before navigating, if and only if it was stuck on `par_equipe`.
The dedicated Par Équipe card and Saved-Matches restore are untouched.

### 2. دمج التعديلين المرسلين (par-equipe-setup + player-search-fix)
كانا فرعين منفصلين عن نفس القاعدة: `par-equipe-setup` هو النسخة الأكمل
(تحتوي حقول Division/Coach + بحث اللاعب PlayerPicker معًا)، بينما
`player-search-fix` نسخة أقدم بها PlayerPicker فقط بدون حقول Division/Coach.
تم اعتماد `par-equipe-setup` كأساس (يحتوي كل شيء) بدل دمج يدوي قد يفقد ميزة.
**الملفات:** `types/tkd.ts`, `context/MatchContext.tsx`, `lib/i18n.ts`,
`components/AdminPanel.tsx`, `components/PublicScoreboard.tsx`,
`components/PlayerPicker.tsx` (جديد)

**Merge note:** the two uploads were divergent forks of the same base;
`par-equipe-setup` was the superset (Division/Coach fields **and**
PlayerPicker search), `player-search-fix` was an older snapshot missing the
Division/Coach fields. Took `par-equipe-setup` as-is rather than a manual
field-by-field merge, to avoid silently dropping something.

### 3. Tournament Wall — التنقل لنوافذ أخرى
فحصت الكود ووجدت أن هذا **تم إصلاحه فعلاً في جلسة سابقة** — الصفحة تحتوي
الآن `<TopNav />` كاملة (Admin/Operator/Scoreboard/Tournament/...) بدل أن
تكون شاشة مغلقة بلا رجوع. لا حاجة لأي تعديل إضافي هنا.
**Already fixed in a prior session** — `TournamentWallPage.tsx` renders the
full `<TopNav />`, confirmed working, no change needed.

## ⏳ لم يُحل بعد — يحتاج تفاصيل منك (Needs more detail from you)

### "الأزرق يصبح أحمر في كل الأنيميشنات"
فحصت خريطة الألوان (`hong` = RED, `chung` = BLUE) في كل من:
`TeamCallOverlay.tsx`, `SinglePlayerCallOverlay.tsx`, `MatchupOverlay.tsx`,
`MainRefereeCallPanel.tsx`, `match-engine.ts` — كلها متسقة، لا يوجد تبديل
بالخطأ. الشيء الوحيد الذي يبدّل الألوان هو ميزة **"Reverse Screen"
(SWAP_SIDES)** الموجودة أصلاً وتعمل كما هو مقصود (لتصحيح خطأ تحكيم بوضع لاعب
في الزاوية الخطأ).

I checked the RED/BLUE color mapping everywhere it's used and it's
consistent — the only place colors swap is the existing, working "Reverse
Screen" feature. I don't want to guess-patch something that isn't
demonstrably broken.

**بحاجة لـ:** خطوات دقيقة (أي زر بالضبط، في أي أنيميشن، هل بعد الضغط على
Reverse Screen أو تلقائيًا؟) أو تسجيل شاشة قصير.
**Need:** exact repro steps or a short screen recording.

### بگين آخرين مذكورين في نص سابق (round advancement / تسجيل البطولات)
لم يصلاني وصف كافٍ لهما بعد — نفس الأمر، بحاجة لخطوات دقيقة لإعادة إنتاج
المشكلة قبل أي محاولة إصلاح حتى لا نخاطر بكسر V35.
