# WAB-TKD — Backup & Recovery

## قبل البطولة
احتفظ بـ:
- Production application release ZIP
- Database backup
- Migrations manifest
- `.env.example` فقط، وليس الأسرار
- Tournament template

## أثناء البطولة
- Safe Snapshot لكل مباراة.
- Tournament export دوري.
- Final snapshot بعد كل مباراة مكتملة.
- مراقبة Offline Queue.

## عند الانقطاع
1. لا تبدأ مباراة جديدة على جهاز بديل قبل معرفة آخر Snapshot.
2. استرجع آخر حالة آمنة.
3. لا تحتسب مدة انقطاع الجهاز ضمن Timer.
4. سجل عملية Recovery في Audit Log.

## بعد البطولة
أنشئ حزمة تحتوي على:
- Final database backup
- Tournament export
- Final snapshots
- Rankings
- Awards
- Audit log
- Production manifest
