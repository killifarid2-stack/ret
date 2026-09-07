# إصلاحات WOO-SE-GIROK / Player Call / Replay / KO — 2026-09-01

- إصلاح ظهور زر WOO-SE-GIROK عند تعادل الجولة في Individual Match؛ لا يعتمد ظهوره على قيمة config غير موجودة في المباريات القديمة.
- إضافة زر AI TIEBREAKER وإعادة تحليل الجولة من بيانات ScoreEvent الحقيقية.
- إبقاء تحليل AI توصية فقط؛ القرار النهائي يبقى للحكم الرئيسي.
- إضافة إطارين مباشرين لاختيار BLUE / RED كفائز للجولة داخل مرحلة WOO-SE-GIROK، مع إبقاء تصويت الحكام وتأكيد الحكم الرئيسي.
- إعادة أنيميشن WinnerAnimation المرجعي إلى PublicScoreboard.
- إزالة مسار MatchResultScreen غير المكتمل الذي كان يرسل stats غير موجودة ويتسبب في الخطأ: Cannot read properties of undefined (reading 'warnings').
- إتاحة Player Call في Individual Match من Main Referee، مع زر PLAYER CALL CONTROLS واضح.
- استخدام SinglePlayerCallOverlay المرجعي للمباراة الفردية.
- في Video Replay أصبحت صورة الكاميرا الزرقاء/الحمراء هي العنصر المرئي بدلاً من أذرع قرار الحكام.
- أذرع القرار بقيت مخصصة لـ WOO-SE-GIROK.
- إزالة أيقونة البرق من أنيميشن KO والاعتماد على شعارات KO الزرقاء/الحمراء الموجودة في assets.
- تشديد منع التمدد الأفقي الذي كان يسبب فراغاً/شريطاً أسود جانبياً.
- إصلاح import في ExactPlayerCallBroadcast إلى lib/player-call/types.
