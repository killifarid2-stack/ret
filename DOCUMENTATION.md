# WAB-TKD — دليل النظام / System Documentation
### AR + EN — يغطي كل ما تم تنفيذه فعليًا في هذا المشروع حتى الآن

---

## 1. نظرة عامة / Overview

**AR:** WAB-TKD هو نظام إدارة وتحكيم مباريات التايكوندو (Kyorugi)، مبني فوق النسخة V38 الأصلية،
مع الحفاظ الكامل على منطق التحكيم والتقييم الأصلي (نظام النقاط، gam-jeom، best-of-N، إلخ) دون أي تعديل.
كل ما يلي هو طبقات مضافة **فوق** V38، وليست إعادة بناء له.

**EN:** WAB-TKD is a Taekwondo (Kyorugi) match management and refereeing system built on top of the
original V38 base, with the original judging/scoring logic (point system, gam-jeom, best-of-N, etc.)
fully preserved and untouched. Everything below is a layer added **on top of** V38, not a rewrite of it.

---

## 2. أنواع البطولات / Tournament Types

- **Bracket (خروج مغلوب / single-elimination):** نظام شجرة مباريات كلاسيكي، مع تقدّم تلقائي للفائز
  إلى المباراة التالية عند انتهاء كل مباراة (`OperatorScreen.tsx`، bracket-advance effect).
- **League (دوري / round-robin):** كل لاعب يقابل البقية، ترتيب محسوب حسب الفوز/الفارق/المواجهة المباشرة
  (`computeLeagueStandings`).
- **Par Équipe (فرق):** مباراة بين فريقين، إما `rotation` (لاعب واحد لكل جولة حسب الترتيب المُعد مسبقًا)
  أو `substitution` (تغيير اللاعب يدويًا أثناء المباراة). الفائز يُحدَّد بمجموع النقاط عبر كل الجولات
  المُلعبة، وليس بأفضلية جولة واحدة.

---

## 3. نظام نقاط الأندية / Club Points Engine

**الملف:** `src/lib/club-points.ts` — صفحة الإدارة: `/club-points` (`src/pages/ClubPointsPage.tsx`)

النقاط الكلية لكل نادٍ = نقاط الفوز + نقاط الميداليات − نقاط الخصم (الإنذارات).

| المصدر | AR | EN |
|---|---|---|
| نقاط الفوز | نقطة مُعدّة لكل فوز (`pointsPerWin`)، محسوبة من كل مباراة منتهية (فردية أو فرق) | Configurable points per match win, computed from every finished match |
| نقاط الميداليات | 🥇/🥈/🥉 مُسجَّلة تلقائيًا لحظة تحديد الفائز في نهائي أي بطولة بنظام Bracket | 🥇/🥈/🥉 recorded automatically the instant a bracket-mode final gets a winner |
| خصم الإنذارات | مجموع قيم الإنذارات المسجَّلة ضد النادي | Sum of recorded warning penalty values against the club |

**قيم النقاط قابلة للتعديل بالكامل من صفحة `/club-points`** (نقطة لكل فوز، ولكل ميدالية ذهبية/فضية/برونزية).

### ✅ نمط الدوري (League) — تم حل الثغرة السابقة
كان نظام Bracket فقط هو من يُسجّل الميداليات تلقائيًا (لأن "المباراة النهائية" حدث واضح ومحدد فيه).
نمط الدوري (Round-Robin) ليس له "نهائي" واحد، لذلك أُضيف **إعداد صريح لكل بطولة** (يدوي/تلقائي) —
انظر القسم 7.1 أدناه للتفاصيل الكاملة بالعربية والإنجليزية.

---

## 4. نظام الإنذارات (Warning Penalty) / Warning Penalty System

**الملف:** `src/lib/warning-penalty.ts`

- أسباب إنذار قابلة للتعريف من الإدارة (تسمية عربية + إنجليزية + قيمة خصم بالنقاط لكل سبب).
- كل إنذار مسجَّل يحمل: النادي/الفريق، السبب، القيمة، الوقت.
- **منفصل تمامًا** عن نظام gam-jeom الحيّ أثناء المباراة (`match-engine.ts`) — هذا نظام إداري
  (على مستوى البطولة/النادي)، وليس بديلاً عن التحكيم الحيّ ولم يمسّه بأي شكل.
- كل عملية تسجيل/حذف إنذار مُسجَّلة في سجل التدقيق (`audit-log.ts`).

---

## 5. تدفق النداء الآلي (Automatic Call Flow) / Automatic Call Flow

**الملفات:** `src/context/MatchContext.tsx`, `src/components/MainRefereeCallPanel.tsx`,
`src/components/TeamCallOverlay.tsx`, `src/components/SinglePlayerCallOverlay.tsx`,
`src/components/MatchupOverlay.tsx`

### القاعدة الأساسية / Core Rule
- **Main Referee = مركز التحكم الوحيد.** كل أمر (نداء، تأكيد، متابعة) يصدر من نافذة الحكم الرئيسي فقط.
- **Public Display = شاشة عرض فقط.** لا يوجد بها أي زر تحكم — هي مكوّنات عرض خالصة
  (`TeamCallOverlay` / `SinglePlayerCallOverlay` / `MatchupOverlay`) بدون أي `dispatch` داخلها،
  لذلك هي متزامنة تلقائيًا وبنيويًا مع ما يراه الحكم، دون أي كود إضافي مطلوب لضمان التزامن.

### التسلسل / Sequence
```
MATCH SELECTED → MATCH DATA LOADED
   ↓
TEAM CALL (نداء الفريق) — تلقائي
   ↓  [نقطة توقف حقيقية — لا يوجد مؤقت صامت]
TEAM GREETING (تحية الفريق) — مرحلة بصرية وسيطة
   ↓
WAITING FOR REFEREE CONFIRMATION — بانتظار تأكيد الحكم
   ↓  [الحكم يضغط CONFIRM]
TEAM CALL CONTINUE → (يتكرر للفريق الآخر إن وُجد)
   ↓
PLAYER CALL (نداء اللاعب) — تلقائي
   ↓ [نفس منطق: PLAYER GREETING → WAITING → CONFIRM]
PLAYER CALL CONTINUE → (يتكرر للاعب الآخر)
   ↓
MATCHUP
   ↓ [WAIT / CONFIRM]
MATCH START — **لا يبدأ تلقائيًا أبدًا**، الحكم فقط من يبدأ المباراة الفعلية
```

### الضمانات الأمنية / Safety Guarantees
1. **لا استمرار عرضي (No accidental auto-continue):** كل مرحلة تتجمّد فعليًا حتى يضغط الحكم CONFIRM.
   تم حذف المؤقت الصامت (3 ثوانٍ) الذي كان يُنهي Team Call تلقائيًا قبل هذا العمل — كان هذا الخلل
   الوحيد الذي يخالف القاعدة صراحة.
2. **حماية من الضغط المزدوج (Idempotency):** الضغط على CONFIRM مرتين لا يُنتج أي أثر إضافي — الحارس
   (`if (!state.callAnimation || ...) return state`) يمنع أي تنفيذ مكرر.
3. **RED/BLUE محدَّد بالبيانات الحقيقية دائمًا**، أبدًا بترتيب مصفوفة (`side`/`teamColor`، وليس index).
4. **الاستعادة (Recovery):** انقطاع الجهاز أثناء أي من (Team Call / Player Call / Matchup / بانتظار
   التأكيد) يُستعاد تلقائيًا لنفس المرحلة بالضبط بعد إعادة التشغيل (`session-recovery.ts`)، ولا يتم
   تجاوز تأكيد الحكم أبدًا.
5. **AUTO SEQUENCE اختياري:** زر "START AUTO SEQUENCE" يُسلسل المراحل تلقائيًا (كل مرحلة تُطلق فور
   تأكيد التي قبلها)، لكن **لا يُلغي أي تأكيد مطلوب** — فقط يوفر على الحكم إعادة الضغط يدويًا على "ابدأ"
   لكل مرحلة. زر "STOP" الطارئ يُلغي أي تسلسل آلي جارٍ فورًا.
6. **مباريات الفرق (Par Équipe):** بعد نداء الفريقين، يتوقف التسلسل الآلي ويُعاد التحكم للحكم يدويًا
   لاختيار أي لاعب يدخل — النظام لا "يخمّن" من سيلعب.

### مرحلة "التحية" (Greeting) — طبقة عرض إضافية
مرحلة `TEAM GREETING` / `PLAYER GREETING` هي حاليًا **مرحلة بصرية موقوتة محليًا** (نص/شارة مختلفة على
الشاشة) بين لحظة النداء ولحظة "بانتظار التأكيد" — لا تُغيّر أي حالة تحكم فعلية ولا تُدخل أي `dispatch`
جديد، فهي إضافة آمنة بنسبة 100% (لا يمكنها كسر أو تجاوز أي تأكيد).

---

## 6. قفل المباريات (Match Lock) / Match Lock

**الملف:** `src/lib/match-lock.ts` — مُستخدم في `src/components/ResultView.tsx`

- **كل مباراة بحالة `finished` مقفولة تلقائيًا فور انتهائها** — لا حاجة لأي إجراء إضافي لقفلها.
- لتعديل/حذف سجل مباراة منتهية، يجب فك القفل صراحة أولاً (أيقونة 🔒 في قائمة النتائج)، مع إمكانية
  إدخال سبب اختياري.
- كل عملية فك قفل / إعادة قفل / حذف تُسجَّل في سجل التدقيق (`audit-log.ts`).
- الحذف الجماعي ("Remove All") يتجاوز تلقائيًا أي مباراة مقفولة، ولا يحذفها أبدًا رغمًا.

---

## 7. نقاط الميداليات (Medal / Tournament-Placement Points)

**الملف:** `src/lib/tournament-placements.ts`

- عند تحديد الفائز في **نهائي** أي بطولة بنظام Bracket، يُسجَّل تلقائيًا:
  - 🥇 ذهبية لنادي الفائز
  - 🥈 فضية لنادي الخاسر في النهائي
  - 🥉 برونزية مزدوجة (قاعدة WT القياسية) لناديي خاسري نصف النهائي المُغذّيين للنهائي
- **لا يتم أبدًا** تسجيل ميداليات لبطولة انتهت قبل وجود هذا النظام (لا استرجاع/تخمين للماضي).
- النتائج تُدمَج تلقائيًا في: (أ) صفحة `/club-points`، (ب) قسم "Club Rankings" داخل `TournamentManager`
  (متصل الآن بجدول `clubs` الحقيقي في قاعدة البيانات بدلاً من البقاء عند 0 دائمًا).

### 7.1 نمط الدوري (League) — تم حل الثغرة ✅

**الملفات:** `src/components/TournamentManager.tsx` (منطق الحساب)، `src/lib/tournament-placements.ts` (التخزين، بدون تغيير)

نمط الدوري لا يملك "نهائي" واحد، لذلك أضفنا **إعدادًا لكل بطولة** يختاره الحكم/الإدارة عند إنشاء الدوري:
تظهر القائمة المنسدلة **"متى تنتهي بطولة الدوري؟"** فقط عندما نوع المسابقة = دوري:

| الخيار | AR | EN |
|---|---|---|
| **يدويًا (الافتراضي)** | زر جديد **"إنهاء الدوري وتوزيع الميداليات"** يظهر فقط عندما تكون كل المباريات المجدولة قد لُعبت (`played === total` لكل مباراة). الضغط عليه يأخذ أول 3 مراكز من الترتيب الحيّ (`computeLeagueStandings`) ويسجّلها كـ 🥇🥈🥉 عبر نفس `recordPlacements()` المستخدمة في Bracket — **لا يوجد نظام مزدوج**. لماذا يدوي بالافتراضي؟ لأن التطبيق لا يستطيع تخمين نية المنظّم — قد يريد إضافة مباريات إعادة أو مباراة فاصلة قبل اعتبار الدوري منتهيًا. | A new **"End League & Award Medals"** button appears only once every scheduled match has been played. Tapping it takes the top 3 from the live standings and records them via the exact same `recordPlacements()` Bracket already uses — no duplicate system. Manual is the default because the app cannot guess the organizer's intent (they may want to add a tie-break match first). |
| **تلقائيًا** | تُسجَّل الميداليات فور اكتمال كل المباريات، بدون أي ضغطة زر، بشرط أن الحكم اختار هذا الخيار صراحة لهذه البطولة. | Medals get recorded the instant every match is complete, with no button press, only when the referee/admin explicitly chose this option for this tournament. |

- الإعداد يُحفَظ مع بيانات البطولة (`bracket_data.leagueMedalTrigger`) — يبقى مرتبطًا بتلك البطولة تحديدًا.
- **حماية من التكرار:** كلا الخيارين يتحققان من `hasPlacementRecord(tournamentId)` قبل التسجيل — لا يمكن تسجيل الميداليات مرتين لنفس البطولة، بغضّ النظر عن الخيار المُختار.
- البطولات المحفوظة **قبل** وجود هذا الإعداد تُعامَل تلقائيًا كـ"يدوي" (الخيار الأكثر أمانًا)، ولن تُسجَّل لها ميداليات إلا بضغطة يدوية صريحة.

---

## 8. البساط المتعدد (Multi-Court / Multi-Mat) — ✅ تم تنفيذ الخيارين

`state.matNumber` يُستخدم لوسم كل مباراة محفوظة برقم البساط الخاص بها، تمامًا كما كان. القرار الذي طلبناه
سابقًا كان بين خيار (أ) و(ب) — الجواب كان: **كلاهما**، مع ترك الاختيار للحكم/الإدارة عبر إعداد بسيط في
صفحة `/admin`، وإمكانية العمل ببساط واحد فقط كما كان دائمًا (السلوك الافتراضي، بدون أي تغيير).

**الملفات:** `src/lib/mat-status.ts` (الإعدادات + النبضة الحيّة)، `src/pages/ControlRoomPage.tsx`
(شاشة غرفة التحكم)، `src/components/TopNav.tsx` (شارة رقم البساط + رابط غرفة التحكم)،
`src/context/MatchContext.tsx` (إرسال النبضة الحيّة)، `src/components/AdminPanel.tsx` (زر الإعداد)،
`supabase/migrations/20260820100000_add_mat_live_status.sql` (جدول جديد).

### 8.1 الإعداد: زر "وضع هذا الجهاز" في `/admin`
زر منسدل جديد في صفحة الإدارة، بخيارين:

| الخيار | ماذا يفعل؟ ولماذا؟ |
|---|---|
| **بساط واحد (افتراضي)** | **لا شيء يتغيّر إطلاقًا** — هذا هو الخيار (أ) الأصلي: كل جهاز/نافذة Electron يدير بساطًا واحدًا فقط، بالضبط كما كان قبل هذه الجلسة. هذا الخيار مُفعَّل تلقائيًا لكل جهاز جديد؛ منظّم يدير بساطًا واحدًا فقط لن يرى أي تغيير في الواجهة (لا رابط "غرفة تحكم" ظاهر). |
| **غرفة تحكم مركزية** | يُظهر رابط "غرفة التحكم" في القائمة العلوية على هذا الجهاز فقط، ويفعّل إرسال نبضة حيّة (كل 8 ثوانٍ) لحالة البساط الحالي إلى قاعدة البيانات السحابية، بحيث تظهر حالته في غرفة التحكم على أي جهاز آخر متصل بنفس قاعدة البيانات. |

بجانبه حقل **"عدد البسطات"** (1–32) يحدد كم بطاقة بساط تظهر في شاشة غرفة التحكم — هذا رقم عرض فقط
(كم بساط لديك فعليًا في القاعة)، لا يُنشئ أو يحذف أي بيانات.

### 8.2 شاشة غرفة التحكم — `/control-room`
تعرض بطاقة لكل بساط (١ إلى العدد المُعرَّف)، تُحدَّث تلقائيًا كل 5 ثوانٍ، تُظهر لكل بساط:
اسم اللاعبين، النتيجة الحيّة، الجولة، وحالة نصية ملوّنة (خامل / بانتظار البدء / جارٍ الآن / متوقف
مؤقتًا / انتهت). كل بطاقة تحمل زر **"تحكم بهذا البساط"** — الضغط عليه يجعل **هذه النافذة تحديدًا** تنتقل
لتشغيل ذلك البساط (`/operator` مع `matNumber` المطابق).

### 8.3 ⚠️ توضيح مهم جدًا — ماذا لا تفعل غرفة التحكم (لتفادي أي سوء فهم)
هذا التصميم **قرار هندسي واعٍ**، وليس تنفيذًا جزئيًا للخيار (ب) الأصلي — لتفادي إعادة كتابة `MatchContext`
بالكامل (تحويله من سياق واحد إلى حالة مفهرسة بالبساط)، وهي خطوة كانت ستحمل خطرًا حقيقيًا على استقرار
كل الشاشات الأخرى (Operator/Public/Judge) التي تعتمد عليه اليوم، دون أي طريقة لاختبارها في بيئة بلا واجهة
Electron حقيقية متعددة النوافذ. البديل المُنفَّذ هنا يحقق **بالضبط** ما ورد حرفيًا في الطلب الأصلي:
*"شاشة تحكم مركزية... تعرض حالة كل بساط جنبًا إلى جنب... مع إمكانية **التبديل** بين البسطات للتحكم في كل
واحد **على حدة**"* — أي التبديل المتسلسل، وليس التحكم المتزامن الحقيقي بعدة مباريات من نفس النافذة في نفس
اللحظة. كل بساط لا يزال بحاجة لعملية Electron واحدة تُشغِّله فعليًا (سواء كانت هذه النافذة نفسها بعد
"التبديل" إليه، أو نافذة أخرى مستقلة على جهاز ذلك البساط).

### 8.4 عزل البيانات (Recovery / Backup)
لم يتغيّر شيء هنا: `session-recovery.ts` (استعادة الطاقة) و`backup.ts` لا يزالان يعملان بمعزل تلقائي
بحكم أن كل جهاز/نافذة له `localStorage` خاص به فعليًا — تحقّق فقط، لم يُعَد بناء أي شيء. جدول
`mat_live_status` الجديد هو **بث حالة حيّة فقط للعرض** (best-effort)، وليس مصدرًا للحقيقة — نتائج
المباريات المنتهية لا تزال تُسجَّل تمامًا كما كانت في جدول `matches` (`match-local.ts` /
`OperatorScreen.tsx`)، دون أي تعديل. إذا انقطع الاتصال بالسحابة، غرفة التحكم تعرض رسالة واضحة بدل شاشة
فارغة، وتتوقف النبضة الحيّة بصمت (best-effort) دون أي تأثير على تشغيل المباراة الحيّة نفسها.

### 8.5 ما تبقى قبل الاستخدام الفعلي
- يجب تطبيق ملف الترحيل (migration) `20260820100000_add_mat_live_status.sql` على قاعدة بيانات
  Supabase (نفس الطريقة المستخدمة لكل ملفات الترحيل السابقة في هذا المشروع) — لم يُشغَّل هنا لعدم توفر
  اتصال بقاعدة بيانات حقيقية داخل بيئة التطوير هذه.

---

## EN — Multi-Court / Multi-Mat (✅ both options implemented)

`state.matNumber` still tags every saved record with its mat number, unchanged. The earlier (أ)-vs-(ب)
decision request was answered with: **both**, selectable per-device from `/admin`, with single-mat
operation remaining the untouched default.

**8.1 Setting** — a new "This device's mode" dropdown in `/admin`: **Single mat (default)** changes
nothing at all (identical to option (أ), already true before this session); **Control Room** shows a
"Control Room" nav link on this device only, and starts pushing a live heartbeat (every 8s) of this mat's
status to the cloud so other devices' Control Room can see it. A "Mat count" field (1–32) next to it just
controls how many mat cards the dashboard renders — a display setting, creates/deletes nothing.

**8.2 `/control-room` screen** — one card per mat, auto-refreshing every 5s: player names, live score,
round, and a colored status (Idle / Waiting / Running / Paused / Finished). Each card has a
**"Control this mat"** button that switches *this window* to operate that mat (`/operator` with that
`matNumber` applied).

**8.3 What Control Room deliberately does NOT do** — this is a conscious engineering trade-off, not a
partial implementation of the original option (ب): rewriting `MatchContext` into a mat-keyed state map
would have been a genuinely risky change to every existing screen (Operator/Public/Judge), untestable in
this sandbox (no real multi-window Electron environment here). What's implemented instead delivers
exactly what the original request's own wording asked for: a dashboard showing every mat side-by-side,
"with the ability to **switch** between mats to control each one **individually**" — sequential switching,
not literal simultaneous same-window control of several live matches at once. Every mat still needs
exactly one Electron process actually operating it (this window after switching, or another instance on
that mat's own machine).

**8.4 Data isolation** unchanged — `session-recovery.ts`/`backup.ts` already separate per device via
`localStorage`, verified not rebuilt. The new `mat_live_status` table is a best-effort live-display
broadcast only, never a source of truth — finished-match results are still recorded exactly as before in
`matches`, untouched.

**8.5 Before real use**: the `20260820100000_add_mat_live_status.sql` migration must be applied to the
Supabase project (same process as every other migration in this repo) — not run here, no live database
connection available in this sandbox.

---

## 9. تحقق حزمة Windows (Electron Packaging) — ⏳ غير مُتحقَّق منه هنا

`electron/main.cjs` و`electron/preload.cjs` يتضمنان بالفعل: قفل النسخة الوحيدة (single-instance lock)،
وتشغيل خادم الإنتاج المحلي قبل فتح النافذة، مع تشخيص شاشة بيضاء/سوداء. **لا يمكن التحقق النهائي
(`npm run electron:build` + اختبار يدوي على جهاز Windows حقيقي) من داخل بيئة الحزام الرملي هذه**
(لا توجد واجهة Windows رسومية هنا). يُنصح بتشغيل هذه الخطوة يدويًا على جهاز حقيقي قبل التوزيع النهائي.

---

## 10. قاعدة عدم المساس (Non-Destructive Rule)

كما في كل الجلسات السابقة: لم يُمسّ أي من — HOME، منطق التحكيم/التقييم الأصلي، قواعد المباراة، منطق
البطولة، قاعدة بيانات اللاعبين/الفرق، أو الـAnimations الأصلية — إلا بالقدر الضروري للربط، مع تحقق
`tsc --noEmit` و`npm run build` نظيفين بعد كل تعديل.

## 11. حفظ مباراة Par Équipe (SAVE MATCH) / Par Équipe Match Save

**AR:** أُضيف نظام حفظ/استرجاع مخصص لمباريات **Par Équipe** فقط (لا يظهر أبدًا في Individual):

- زر **SAVE MATCH** داخل لوحة الحكم الرئيسي (`MainRefereeCallPanel`)، يظهر فقط عندما `competitionMode === 'par_equipe'`.
- كل حفظة تخزّن الحالة الكاملة للمباراة (`MatchState`): الفرق، الشعارات، الدول، تشكيلة اللاعبين وترتيبهم، الجولة الحالية، النتائج، الإنذارات، العقوبات، المؤقت، البساط، رقم المباراة، والحالة.
- إعادة الضغط على Save لنفس المباراة يُحدّث نفس السجل بدل إنشاء نسخة مكررة (`saveId` ثابت طالما المباراة قيد التنفيذ).
- قسم **SAVED MATCHES** يعرض كل الحفظات (فريق أحمر/أزرق، التقدّم، النتيجة، الحالة، وقت الحفظ) مع زر **RESTORE MATCH**.
- بعد الاسترجاع تظهر رسالة **MATCH RESTORED / READY** ولا يبدأ أي شيء تلقائيًا — الحكم الرئيسي هو من يقرر المتابعة.
- **Auto Save** صامت يعمل فقط لمباريات Par Équipe (بعد الأحداث المهمة: تغيّر النتيجة، إنذار، عقوبة، انتهاء جولة) — منفصل تمامًا عن آلية استرجاع انقطاع التيار العامة (`session-recovery.ts`) التي تبقى تعمل لكل أنواع المباريات كما هي.
- عند انتهاء المباراة (`status === 'finished'`) تتحوّل الحفظة إلى **COMPLETED** ولا تُستبدل النتيجة النهائية عند الاسترجاع إلا بتأكيد صريح من الحكم.
- الملفات الجديدة: `src/lib/par-equipe-save.ts` (منطق التخزين)، `src/components/ParEquipeSaveMatch.tsx` (الواجهة). لا تعديل على منطق Individual أو V35.

**EN:** A dedicated save/restore system was added for **Par Équipe** matches only (never shown for Individual matches):

- A **SAVE MATCH** button inside the Main Referee panel (`MainRefereeCallPanel`), shown only when `competitionMode === 'par_equipe'`.
- Each save stores the full `MatchState`: teams, logos, countries, player roster and order, current round, scores, warnings, penalties, timer, mat, match number, and status.
- Re-saving the same live match updates its existing slot instead of creating duplicates (a stable `saveId` per match while it's in progress).
- A **SAVED MATCHES** list shows every save (red/blue team, progress, score, status, saved time) with a **RESTORE MATCH** button.
- After restoring, a **MATCH RESTORED / READY** confirmation is shown and nothing starts automatically — the main referee decides how to proceed.
- A silent **Auto Save** runs for Par Équipe matches only (after key events: score change, warning, penalty, round end) — fully separate from the existing power-failure recovery (`session-recovery.ts`), which is unchanged and still covers every match type.
- On finish (`status === 'finished'`) the save is marked **COMPLETED**; restoring over a completed result requires explicit confirmation.
- New files: `src/lib/par-equipe-save.ts` (storage logic), `src/components/ParEquipeSaveMatch.tsx` (UI). No changes to Individual match logic or V35.

---

# WAB-TKD — Added Par Équipe Tournament & Mat Broadcast Layer (AR + EN)

## العربية

هذه الإضافة طبقة مستقلة فوق النظام الحالي. لا تستبدل `teamRoster`/`team_roster` ولا تعيد بناء محرك المباراة، ولا تغيّر منطق `match-engine.ts` أو `OperatorScreen.tsx`.

### 1) أرشيف بطولات Par Équipe
- مكانه داخل نافذة **Par Équipe** الموجودة في Home.
- البنية: **البطولة → الفئة العمرية → الجنس → الوزن → الفرق → اللاعبين**.
- يحفظ اسم البطولة، الفئة، الجنس، الوزن، التاريخ، المكان، وضع Rotation/Substitution، شعارات الفريق والنادي، الدولة، وقائمة اللاعبين.
- لكل لاعب يمكن حفظ الاسم، الرقم، Seed، الصورة وعدد الجولات المخصصة له.
- يُملأ تلقائيًا عند بدء مباراة Par Équipe مباشرة أو عند إنشاء/حفظ بطولة Par Équipe من Tournament Manager.
- يحتوي على بحث سريع، وإظهار الشجرة/المباريات داخل كل فئة.
- التخزين الجديد محلي ومضاف إلى التخزين القديم؛ لا يتم حذف أو إعادة كتابة سجلات SAVE MATCH القديمة.

### 2) تصنيف البطولة
يمكن للبطولة الواحدة أن تظهر في عدة مجلدات تصنيفية مختلفة حسب ما يتم تسجيله فعليًا: عمر + جنس + وزن. هذا يسمح ببطولة واحدة تحتوي مثلًا على Cadet Male -45kg وCadet Female -42kg وJunior Male -55kg دون خلط البيانات.

### 3) فصل لاعبي نفس النادي في الشجرة
عند توليد شجرة Tournament Manager، يتم ترتيب المشاركين مع الحفاظ على Seed قدر الإمكان، ومحاولة إبعاد لاعبي النادي نفسه عن بعضهم في الجولة الأولى عندما تسمح البنية بذلك. هذه المساعدة موجودة في `bracket-seeding.ts` ولا تعدّل `match-engine.ts`.

### 4) شاشة إعلان البساط
الشاشة الجديدة تحاكي لوحة الإعلان الظاهرة في المرجع: 
- رقم البساط.
- المباراة الجارية.
- أزرق/أحمر.
- رقم المباراة والجولة.
- الوزن والفئة العمرية والجنس.
- النادي/الفريق عند توفره.
- قائمة المباريات القادمة.
- تحديث تلقائي كل 2.5 ثانية.
- تعتمد على حالة البساط الحالية وQueue الموجودة أصلًا، مع استخدام نسخة البطولة المحلية لتقديم المباريات القادمة عندما تكون متاحة.

### 5) الشاشة الثانية: جمهور أو إعلان البساط
من نافذة **Public Display** يمكن اختيار:
- **Audience Scoreboard / شاشة الجمهور**: السلوك الحالي كما هو.
- **Mat Announcer / إعلان البساط**: الشاشة الجديدة.

بعد اختيار الشاشة، افتح/اختر الشاشة الخارجية المطلوبة. الاختيار محفوظ محليًا ويُقرأ من نافذة العرض الثانية.

### 6) توزيع الأوزان على الحواسيب/البسطات
تم الحفاظ على نظام `matWeightAssignments` الموجود. شاشة إعلان البساط تستخدم قواعد الوزن المخصصة للبِساط لتصفية المباريات القادمة، بينما تبقى قرارات التشغيل والتحكم في `TournamentControlCenter` كما هي.

### 7) اللغة
الإضافات الجديدة مكتوبة AR + EN وتستخدم نظام I18n الحالي. شاشة إعلان البساط نفسها RTL في العربية وLTR في الإنجليزية.

---

## English

This delivery adds an independent layer on top of the existing Par Équipe and multi-mat system. It does not replace `teamRoster`/`team_roster`, and it does not rebuild the scoring engine or the existing operator save/restore flow.

### 1) Par Équipe Tournament Archive
- Available directly inside the existing **Par Équipe** Home window.
- Hierarchy: **Tournament → Age Group → Gender → Weight → Teams → Players**.
- Stores tournament metadata, category, gender, weight, event date/location, rotation/substitution mode, team/club logos, country, and roster snapshots.
- Player snapshot can include name, number, seed, photo and assigned rounds.
- Filled automatically from the data already entered by the organizer when a direct Par Équipe match starts or when a Par Équipe tournament is generated/saved in Tournament Manager.
- Includes search and a bracket/match review area.
- It is additive local storage; existing SAVE MATCH records are not rewritten or deleted.

### 2) Multiple categories inside one tournament archive
The same tournament name can contain multiple category folders. Each recorded category is separated by age group, gender and weight, so different divisions can coexist without mixing their rosters.

### 3) Same-club bracket separation
Tournament Manager now uses an additive seeding helper before calling the existing bracket generator. It keeps seed information meaningful and attempts to separate athletes from the same club in the first round whenever the bracket structure allows it. `match-engine.ts` remains untouched.

### 4) Mat Announcement Screen
The new second-screen layout is inspired by the supplied tournament broadcast reference:
- Physical mat number.
- Current/live bout.
- Blue and Red sides.
- Match number and round.
- Weight, age group and gender.
- Team/club identity when available.
- Upcoming matches for that mat.
- Automatic refresh every 2.5 seconds.
- Uses the existing live mat heartbeat and queue, plus the local tournament cache when available.

### 5) Second-screen selection
The existing **Public Display** control now lets the operator choose:
- **Audience Scoreboard** — the existing public scoreboard.
- **Mat Announcer** — the new mat announcement screen.

The operator can still select which external monitor is used. The selected broadcast mode is stored locally and read by the Electron public window.

### 6) Weight distribution across mats
The existing `matWeightAssignments` mechanism remains the source for mat category restrictions. The new announcer respects those restrictions when building its upcoming list. Tournament Control Center remains responsible for operational assignment/claiming.

### 7) Language
All newly added UI is bilingual AR + EN and uses the existing I18n provider. The announcer is RTL in Arabic and LTR in English.

### Files added
- `src/lib/par-equipe-tournament-archive.ts`
- `src/lib/broadcast-display.ts`
- `src/lib/bracket-seeding.ts`
- `src/components/MatBroadcastScreen.tsx`

### Existing files extended
- `src/pages/Index.tsx`
- `src/components/TournamentManager.tsx`
- `src/components/ParEquipeTournamentArchive.tsx`
- `src/components/PublicDisplayControl.tsx`
- `src/components/PublicScoreboard.tsx`
- `src/lib/i18n.ts`
- `DOCUMENTATION.md`

## 2026 — Par Équipe Mat Category Routing / توجيه فئات Par Équipe على البسطات

### EN
- Each physical mat can now have an optional category workload plan based on **Age Group + Gender + Weight**.
- The plan is stored locally under `wab-tkd-mat-category-plan-v1` and is additive; the existing `matWeightAssignments` plan remains active and continues to be respected.
- An empty category plan means the mat accepts all categories.
- When a category plan is active, automatic queueing and manual queueing only accept a match whose tournament/category tuple matches one of the selected entries for that mat.
- Mat Announcer reads the same category plan. If a plan is active, upcoming matches may come from multiple saved local tournament categories that match the assigned mat profile; otherwise the previous same-tournament behavior is retained.
- The Mat Announcer now shows Age Group, Gender and Weight separately and localizes those labels in Arabic.
- The first-round same-club helper now repacks the already-generated round-one slots after `generateBracket()` rather than changing `match-engine.ts`. It minimizes same-club first-round pairings while keeping seed order as the primary ordering signal.
- Direct Par Équipe creation from `AdminPanel.tsx` now attaches the archive record to the generated/selected tournament id when available.

### AR
- أصبح لكل بساط فعلي اختيار اختياري لتوزيع الفئات حسب **الفئة العمرية + الجنس + الوزن**.
- يتم حفظ الخطة محليًا تحت `wab-tkd-mat-category-plan-v1` كطبقة إضافية، مع بقاء `matWeightAssignments` الحالي فعالًا كما هو.
- إذا كانت خطة الفئات فارغة فهذا يعني أن البساط يقبل جميع الفئات.
- عند تفعيل خطة الفئات، فإن الحجز التلقائي واليدوي لا يقبلان المباراة إلا إذا كانت فئة البطولة مطابقة لإحدى الفئات المخصصة لذلك البساط.
- شاشة Mat Announcer تقرأ نفس الخطة. عند وجود خطة فعالة يمكنها عرض مباريات قادمة من عدة سجلات/فئات محفوظة إذا كانت مطابقة للبساط، بينما يبقى السلوك السابق (نفس البطولة الحالية) عند عدم وجود خطة.
- أصبحت شاشة الإعلان تعرض الفئة العمرية والجنس والوزن بشكل منفصل، مع ترجمة هذه العناصر إلى العربية.
- أصبح مساعد فصل لاعبي النادي نفسه يعيد توزيع خانات الجولة الأولى بعد استدعاء `generateBracket()` بدل تعديل `match-engine.ts`. الهدف هو تقليل مواجهات النادي نفسه في الجولة الأولى مع إبقاء أولوية الـ Seed.
- عند إنشاء Par Équipe مباشرة من `AdminPanel.tsx` أصبح سجل الأرشيف يرتبط بمعرّف البطولة التي تم اختيارها/إنشاؤها عندما يكون متاحًا.

### Verification / التحقق
- `npx tsc --noEmit` — PASS.
- `npm run build` — لم يكتمل في بيئة التنفيذ لأن تثبيت dependencies لم يكتمل وملف Vite التنفيذي لم يكن متاحًا بعد مهلة npm؛ لم يتم اعتبار ذلك نجاحًا كاذبًا.
- `npm test` — لم يُشغّل لأن حزمة Vitest التنفيذية لم تكتمل في التثبيت نفسه.

## 2026-08 — All Competition Types Mat/Category QA Matrix (AR + EN)

### English
The Mat Category Workload, Mat Announcer, second-screen selection, bracket seeding separation, and tournament-control flow are intended to cover **all four competition modes** exposed by WAB-TKD:

| Mode | Bracket / Match source | Category routing | Mat Announcer upcoming list | Same-club first-round separation |
|---|---|---|---|---|
| Knockout | Knockout bracket | Age + Gender + Weight | Yes | Yes |
| Friendly | Generated bracket | Age + Gender + Weight | Yes | Yes |
| League / Round Robin | League fixture list | Age + Gender + Weight | Yes | N/A (no knockout first round) |
| Par Équipe | Team bracket + team rosters | Age + Gender + Weight | Yes | Yes, at team-slot bracket level |

For League tournaments, the Tournament Control Center now exposes a dedicated **LEAGUE / ROUND ROBIN QUEUE** section, and assigned league matches use the same mat queue and operator hand-off path as bracket matches. Match results are already written back to `bracket_data.league` by the existing Operator result flow.

The Mat Announcer reads both `bracket_data.bracket` and `bracket_data.league`, so a League tournament is not silently omitted from the upcoming-matches display.

### العربية
تم توسيع مسار **توزيع الفئات على البسطات + شاشة Mat Announcer + الشاشة الثانية + التحكم المركزي + فصل لاعبي النادي في الشجرة** ليشمل **أنواع المنافسات الأربعة** الموجودة في WAB-TKD:

| النوع | مصدر المباريات | توزيع البساط | المباريات القادمة في Mat Announcer | فصل النادي في الجولة الأولى |
|---|---|---|---|---|
| Knockout | شجرة إقصائية | العمر + الجنس + الوزن | نعم | نعم |
| Friendly | شجرة يتم إنشاؤها | العمر + الجنس + الوزن | نعم | نعم |
| League / Round Robin | جدول الدوري | العمر + الجنس + الوزن | نعم | لا ينطبق (لا توجد شجرة إقصائية) |
| Par Équipe | شجرة الفرق + التشكيلات | العمر + الجنس + الوزن | نعم | نعم على مستوى خانات الفرق |

بالنسبة إلى League تمت إضافة قسم **LEAGUE / ROUND ROBIN QUEUE** داخل مركز التحكم بالبسطات، وأصبحت مباراة الدوري المسندة تمر عبر نفس طابور البساط ومسار تسليمها إلى المشغل المستخدم للمباريات الإقصائية. نظام المشغل الموجود أصلًا يسجل نتيجة مباراة الدوري داخل `bracket_data.league`.

وأصبحت شاشة Mat Announcer تقرأ كلًا من `bracket_data.bracket` و`bracket_data.league`، لذلك لن تختفي مباريات الدوري من قائمة المباريات القادمة.

### Required end-to-end check / الاختبار الكامل المطلوب

For each mode, verify: create tournament → configure age/gender/weight → generate or load matches → assign one or more mats → verify category routing → queue match → operator claims match → run match → finish match → verify result persistence → verify next match → verify Mat Announcer current/upcoming display → switch Arabic/English → verify second-screen mode.

لكل نوع يجب التحقق من: إنشاء البطولة ← تحديد العمر/الجنس/الوزن ← إنشاء/تحميل المباريات ← توزيع البسطات ← التحقق من الفلترة ← حجز المباراة ← استلام المشغل للمباراة ← تشغيل المباراة ← إنهاء المباراة ← حفظ النتيجة ← الانتقال للمباراة التالية ← التحقق من Mat Announcer الحالية والقادمة ← تبديل العربية/English ← التحقق من نمط الشاشة الثانية.

## v48 — Dynamic External TV Broadcast + Full Par Équipe Tournament SAVE

### External TV / HDMI / Wireless Display
- A newly connected external display no longer opens automatically.
- The operator receives a display-selection prompt and chooses:
  - Live Match — live score, timer, warnings, penalties and match state.
  - Mat Announcer — current match + upcoming matches for a selected mat.
  - Upcoming Matches — upcoming matches only for a selected mat.
- Each external display keeps its own mode and mat assignment.
- Multiple TVs can be used independently, for example TV 1 = Live Match and TV 2 = Mat Announcer / MAT 02.
- The mode can be changed later without disconnecting the TV.
- Disconnecting a TV closes only its external presentation window and does not alter Operator match state.
- HDMI and Wireless Display are handled through Windows/Electron display enumeration; the application does not depend on the physical transport type.

### Par Équipe — Tournament SAVE
- A new yellow `SAVE TOURNAMENT` action is available in the Par Équipe save area.
- This is different from `SAVE MATCH`:
  - `SAVE MATCH` stores the current match state for recovery/resume.
  - `SAVE TOURNAMENT` stores the complete Par Équipe tournament archive.
- The archive contains tournament metadata, age group, gender, weight, teams, team/club logos, country, player roster details, bracket/match records, match number, round, mat, status, winner and score when available.
- Re-saving updates the same archive record instead of intentionally creating a duplicate.
- Tournament Manager continues to populate the archive from existing `teamRosters` and tournament players; no invented data is created.
- Existing `team_roster`, `SAVE MATCH`, V35 and `match-engine.ts` remain separate operational layers.

### Validation
- `npx tsc --noEmit` — PASS.
- `node --check electron/main.cjs` — PASS.
- `node --check electron/preload.cjs` — PASS.
- `npm run build` could not run because the environment has no installed Vite binary.
- `npm ci` timed out in the execution environment; therefore Vitest could not be executed here.
