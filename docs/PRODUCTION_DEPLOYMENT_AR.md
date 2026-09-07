# WAB-TKD — Production Deployment

## الهدف
تحويل نسخة Production Ready إلى بيئة البطولة الفعلية دون تغيير V35 أو Individual أو Par Équipe.

## التسلسل الإجباري
1. إنشاء نسخة احتياطية من قاعدة البيانات الحالية.
2. ضبط Production Environment Variables.
3. تطبيق migrations بالترتيب.
4. تشغيل `npm run production:check`.
5. تشغيل `npm run lint` و`npm run test` و`npm run build`.
6. نشر Preview.
7. Smoke test للـMain Referee وPublic Display وPar Équipe وMulti-Mat.
8. اعتماد Supervisor.
9. نشر Production.
10. إنشاء Production Manifest وBackup Package.

## Vercel
- اربط المستودع بالمشروع.
- ضع فقط `VITE_SUPABASE_URL` و`VITE_SUPABASE_PUBLISHABLE_KEY` في Environment Variables.
- لا تضع service-role key في Vite أو المتصفح.
- Production وPreview يجب أن يستخدما إعدادات منفصلة عند الحاجة.

## Rollback
احتفظ بآخر نسخة Production ناجحة + database backup + tournament snapshot قبل أي migration حساسة.
