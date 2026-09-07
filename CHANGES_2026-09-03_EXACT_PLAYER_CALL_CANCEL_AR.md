# Exact Player Call — Cancel Button State

- زر الهيدر الفردي يصبح أصفر فقط عندما يكون Individual Player Call Animation فعالاً فعلياً على Public Display.
- الضغط على الزر الأصفر يرسل SET_CALL_CONTROL_WAITING لإلغاء وإخفاء Player Call فوراً.
- لا يتم حذف بيانات اللاعبين أو المباراة أو النتيجة أو المؤقت.
- لا يتأثر Par Équipe.
- لا تُعتبر MATCHUP أو Team Call حالة فعالة لزر Individual Player Call.
