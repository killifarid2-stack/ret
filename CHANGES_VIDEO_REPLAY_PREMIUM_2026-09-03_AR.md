# تحسين VIDEO REPLAY — 2026-09-03

- تم تحسين Animation الخاص بـ VIDEO REPLAY داخل Public Display.
- يستخدم نفس Assets الأصلية الموجودة في `src/assets/hit-stats/`.
- BLUE requester يستخدم `video-replay-available-blue.png`.
- RED requester يستخدم `video-replay-unavailable-red.png`.
- لون الإضاءة والكاميرا مشتق ديناميكيًا من جانب الطالب `BLUE/RED`.
- تم الحفاظ على قرار `accepted/rejected` وO/X بدون تغيير في منطق المباراة.
- تمت إضافة طبقات سينمائية: rings، scanlines، light sweep، camera pulse/float، request badge، decision core، وresult strip.
- تم توسيع مدة العرض إلى 4.6 ثانية لتحسين وضوح الـbroadcast.
- لا توجد state/reducer/database changes في هذا التعديل.
- لم يتم تغيير KO / Winner / Player Call / Team Call.
