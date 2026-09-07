# WAB-TKD — Broadcast Viewport Engine

تمت إضافة نظام مركزي لقياس شاشة الجمهور وتوحيد مساحة جميع الأنيميشنات.

## ماذا يفعل؟
- يقرأ `window.innerWidth / innerHeight` من نافذة Public Display نفسها.
- يعيد الحساب عند تغيير الحجم، fullscreen، orientation أو نقل نافذة البث بين الشاشات.
- يعرّف 1920×1080 كـ broadcast design canvas موحد.
- يحسب FIT scale للحفاظ على كامل الإطار بدون قص أو تشويه.
- يضيف Safe Area موحدة للحدود والإطارات.
- يمنع overflow/scrollbars من طبقات البث.
- يعزل طبقات الأنيميشن عن واجهة Operator.

## الأنيميشنات التي تستفيد من العقد الموحد
- Individual Player Call
- Matchup / VS
- Player Change
- Next Match
- Team Call / Par Équipe broadcast layer
- باقي طبقات Public Display التي تستخدم fullscreen fixed layers
- Mat Announcer / Upcoming عبر نفس Public Display viewport

## مبدأ التشغيل
شاشة Operator لا تحدد قياس الأنيميشن. القياس يؤخذ من نافذة Public Display التي فتحها Electron على الشاشة الثانية.
