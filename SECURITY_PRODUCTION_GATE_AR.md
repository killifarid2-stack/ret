# بوابة أمان الإنتاج — WAB-TKD

## تم إغلاقه في التطبيق
- Local Wi-Fi Judge/Viewer pairing يحتاج token عشوائي جديد عند كل تشغيل.
- مقارنة token تستخدم timing-safe comparison.
- مهلة مصادقة 10 ثوانٍ للاتصالات المحلية غير الموثقة.
- حد WebSocket للرسالة 64KB.
- يمنع انتحال Judge ID عبر استبدال الاتصال القديم وإغلاقه.
- Public/Operator Electron windows تمنع navigation والنوافذ الخارجية غير المصرح بها.

## يتطلب إعداداً خارج الكود
Supabase لا يمكن إعطاؤه RBAC حقيقياً من localStorage/PIN أو من anon key. قبل بطولة إنتاجية يجب تشغيل Supabase Auth حقيقي (أو Backend/RPC موثوق) وربط RLS بالأدوار/claims، ثم اختبار allow/deny لكل دور.

لا توجد صور بديلة أو مفاتيح service-role داخل التطبيق.
