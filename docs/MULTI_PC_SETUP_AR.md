# WAB-TKD — Multi-PC Production Setup

كل كمبيوتر بساط يستخدم قاعدة البيانات المركزية نفسها، لكن له هوية جهاز مستقلة.

## لكل جهاز
- `deviceName`
- `matNumber` مثل `MAT-01`
- `role`: CONTROL / PUBLIC / HYBRID
- Production URL

## قاعدة مهمة
لا تعتمد على اسم الكمبيوتر وحده. هوية البساط يجب أن تكون محفوظة في إعدادات الجهاز، وعند بدء التطبيق يتم التحقق من وجود Mat Registry وعدم وجود جهاز آخر بنفس الـMat في حالة ACTIVE.

## تشغيل عدة أجهزة
MAT-01 → PC-01
MAT-02 → PC-02
MAT-03 → PC-03
...

كلها تتصل بنفس Production Database، بينما Public Display وTournament Wall يقرآن الحالة المشتركة ولا يملكان أوامر التحكم.

## عند تغيير جهاز
1. إيقاف الجهاز القديم.
2. تحرير الـlease إن أمكن.
3. تسجيل الجهاز الجديد بنفس MAT.
4. تنفيذ smoke check.
