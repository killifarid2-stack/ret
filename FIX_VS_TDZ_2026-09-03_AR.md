# إصلاح خطأ VS في المباراة الفردية — 2026-09-03

## المشكلة
عند تشغيل أنيميشن VS / MATCHUP في المباراة الفردية كان التطبيق يتوقف برسالة:
`Cannot access 'Ke' before initialization`

## الإصلاح
- عزل MatchupOverlay عن مكوّن PlayerName لتجنب سلسلة تهيئة modules غير ضرورية أثناء تحميل شاشة VS.
- استخدام `formatPlayerName` مباشرة داخل الأنيميشن بدلاً من استيراد مكوّن JSX إضافي.
- تحويل MatchState و MatchupAnimation إلى type-only imports حتى لا تدخل الأنواع في runtime module graph.
- لم يتم تغيير منطق المباراة، التسجيل، Winner، Player Call، Par Équipe أو قاعدة البيانات.
