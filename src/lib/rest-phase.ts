export type RestPhase = 'REST' | 'PREPARE' | 'GET_READY' | 'REFEREE_CONFIRM';

/**
 * Broadcast-safe rest phase. The clock remains authoritative in MatchState;
 * this is presentation-only and never starts a round by itself.
 */
export function getRestPhase(timeRemaining: number, status: string, restTime: number): RestPhase {
  if (status !== 'rest' && timeRemaining <= 0) return 'REFEREE_CONFIRM';
  const t = Math.max(0, Number(timeRemaining) || 0);
  const total = Math.max(1, Number(restTime) || 1);
  if (t <= Math.min(5, total)) return 'GET_READY';
  if (t <= Math.min(10, total)) return 'PREPARE';
  return 'REST';
}

export function getRestPhaseLabel(phase: RestPhase, lang: 'ar' | 'en' = 'en'): string {
  if (lang === 'ar') {
    return phase === 'REFEREE_CONFIRM' ? 'بانتظار تأكيد الحكم' :
      phase === 'GET_READY' ? 'استعدوا للجولة القادمة' :
      phase === 'PREPARE' ? 'تحضير الجولة القادمة' : 'وقت الراحة';
  }
  return phase === 'REFEREE_CONFIRM' ? 'WAITING FOR REFEREE CONFIRMATION' :
    phase === 'GET_READY' ? 'GET READY FOR NEXT ROUND' :
    phase === 'PREPARE' ? 'NEXT ROUND PREPARATION' : 'REST / RECOVER';
}
