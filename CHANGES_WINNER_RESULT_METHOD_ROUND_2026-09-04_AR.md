# تحديث Winner Result — 2026-09-04

- ربط شاشة Winner Result بنتيجة المباراة الفعلية من MatchState.
- إظهار الفائز RED/BLUE والنتيجة النهائية.
- إظهار طريقة الحسم: KO, WDR, PTF, PTG, RSC, DSQ, SUP, PUN.
- عند KO يظهر شعار KO حسب لون الفائز، مع رقم الجولة التي حدث فيها KO.
- عرض Round Decisions والجولة التي حُسمت فيها النتيجة.
- عرض AI / WOO-SE-GIROK في بطاقات الجولات عندما تكون بيانات القرار موجودة.
- الاحتفاظ بإحصائيات الضربات والتحذيرات وربطها بشاشة النتيجة.
- Winner Result يبقى Individual-only ولا يغيّر Team Winner path.
- Public/Broadcast يستخدم نفس MatchState النهائي، ولا يتم إنشاء نتيجة مستقلة عن المباراة.
