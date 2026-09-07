# KYESHI CALL — 2026-08-29

تم دمج الصورة المرفوعة من المستخدم في أنيميشن KYESHI داخل شاشة الجمهور.

## السلوك
- لا يتم تغيير منطق KYESHI أو عداده.
- عند `status === 'kyeshi'` تظهر طبقة سينمائية كاملة الشاشة.
- العداد الحقيقي `timeRemaining` من MatchContext يظهر داخل الأنيميشن.
- عند انتهاء/إنهاء KYESHI تختفي الطبقة ويعود العرض الطبيعي تلقائياً.

## العناصر البصرية
- صورة KYESHI المرفوعة: `public/kyeshi/kyeshi-call.png`
- توهج ذهبي وأبيض.
- طاقة زرقاء جانبية خفيفة.
- حلقات ذهبية دوارة.
- Light Beams وEnergy Streaks.
- Particles وScan Lines.
- إطار زوايا احترافي.
- عنوان `KYESHI` و`INJURY TIME • OFFICIAL HOLD`.
- `TIME REMAINING` مع العداد الحي.

## الملفات
- `src/components/KyeshiCallAnimation.tsx`
- `src/components/PublicScoreboard.tsx`
- `src/index.css`
- `public/kyeshi/kyeshi-call.png`

الأنيميشن مخصص لشاشة الجمهور ولا يغير نقاط المباراة أو قواعد KYESHI أو منطق الاستئناف.
