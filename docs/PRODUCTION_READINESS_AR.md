# WAB-TKD — Production Readiness

## 1. Environment
- انسخ `.env.example` إلى إعدادات البيئة الخاصة بالـProduction.
- ضع فقط `VITE_SUPABASE_URL` و`VITE_SUPABASE_PUBLISHABLE_KEY` في بيئة الواجهة.
- لا تضع service-role key أو أي secret في Vite client.

## 2. Database
- طبّق جميع ملفات `supabase/migrations` على قاعدة Production بالترتيب.
- خذ نسخة احتياطية قبل أول نشر Production.
- تحقّق من RLS والصلاحيات قبل فتح النظام للحكام.

## 3. Multi-Mat
كل جهاز يجب أن يملك:
- MAT NUMBER
- DEVICE NAME
- اتصال قاعدة البيانات نفسه
- شاشة Control أو Public بحسب دوره

## 4. Release
التسلسل:
1. `npm run lint`
2. `npm run test`
3. `npm run build`
4. `npm run test:e2e` عند توفر Playwright browsers
5. تطبيق migrations
6. نشر Preview
7. Smoke test
8. نشر Production

## 5. Recovery
احتفظ بنسخة من:
- Tournament export
- Final snapshots
- Database backup
- Release ZIP

## 6. Security
- لا تضع أسرارًا في `.env` المرفوع للمستودع.
- استخدم Supabase RLS.
- العمليات الحساسة تحتاج Supervisor/Admin.
- لا تسمح لـPublic Display بتغيير حالة المباراة.
