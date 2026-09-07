# إضافات تحكم الأنيميشن — 2026-08-27

## بدون تغيير قاعدة المشروع
- لم يتم حذف أو استبدال أي Animation أو Match Logic أو Player/Team data.
- التعديل محصور في Main Referee Call Panel لإظهار أدوات التحكم الموجودة أصلاً في الـ reducer في نافذة حكم رئيسي واحدة.

## Team Call
أضيفت في نافذة Main Referee:
- CALL BLUE / CALL RED
- CONFIRM
- REPLAY
- RECALL
- START TEAM CALL
- READY / CONFIRM GREETING
- WAITING
- TV / GO LIVE
- STOP TEAM CALL

## Player Change — Par Équipe
أضيفت اختصارات:
- CHANGE BLUE PLAYER
- CHANGE RED PLAYER
- CLEAR CHANGE ANIMATION

هذه الأزرار تستعمل نفس `REQUEST_SUBSTITUTION` و `CONFIRM_SUBSTITUTION` والـ `PlayerChangeAnimation` الموجودة في المشروع؛ لم يتم إنشاء قاعدة بيانات جديدة ولم تتغير بيانات اللاعبين أو منطق المباراة.

## التوافق
- Public Display يبقى للعرض فقط.
- Main Referee هو مكان التحكم.
- لا يتم إعادة تحميل الصفحة بين مراحل الأنيميشن.
- لا يتم تعديل السكور أو المؤقت عند استخدام أدوات العرض نفسها.
