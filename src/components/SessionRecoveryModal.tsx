import React from 'react';
import { RotateCcw, PlusCircle, AlertTriangle } from 'lucide-react';
import { useMatch } from '@/context/MatchContext';

/**
 * POWER FAILURE / CRASH RECOVERY PROMPT.
 *
 * Shown once, on launch, only when MatchContext found a saved snapshot of
 * an in-progress match (see session-recovery.ts). Mounted once near the
 * root (App.tsx) so it appears regardless of which route the app opens on.
 *
 * "RESTORE MATCH" hands the exact saved MatchState back to the reducer via
 * SET_STATE — round, score, warnings/penalties, and the timer all resume
 * from precisely where they were. The time the computer was OFF is never
 * counted (see session-recovery.ts doc comment: timeRemaining is restored
 * as-is, never recomputed from wall-clock).
 *
 * "START NEW MATCH" discards the saved snapshot and leaves the app on its
 * normal fresh/'waiting' state — no destructive action beyond clearing the
 * one recovery snapshot itself.
 */
export default function SessionRecoveryModal() {
  const { recoverableSession, recoveryRestored, restoreSession, finishRecoveryReady, dismissRecoverableSession } = useMatch();
  if (!recoverableSession) return null;

  const { state } = recoverableSession;
  const redName = state.hong?.player?.name || 'RED';
  const blueName = state.chung?.player?.name || 'BLUE';
  const mins = Math.floor((state.timeRemaining ?? 0) / 60);
  const secs = Math.floor((state.timeRemaining ?? 0) % 60);
  const clock = `${mins}:${String(secs).padStart(2, '0')}`;
  const isParEquipe = state.config?.competitionMode === 'par_equipe';
  const totalProgress = Math.max(
    state.teamRoster?.hong?.length ?? 0,
    state.teamRoster?.chung?.length ?? 0,
    state.config?.rounds ?? 0,
  );
  const progress = totalProgress ? `${state.roundWinners?.length ?? 0} / ${totalProgress}` : `${state.roundWinners?.length ?? 0}`;

  // Was the app interrupted mid-way through the pre-match Automatic Call
  // Flow (Team Call / Player Call / Matchup)? Surface exactly which stop
  // point it was waiting on so the referee knows restoring will pick the
  // greeting/confirmation back up at the same point, not skip it.
  const callFlowStage = state.teamCallStatus?.hong === 'calling' ? 'TEAM CALL — RED — awaiting confirmation'
    : state.teamCallStatus?.chung === 'calling' ? 'TEAM CALL — BLUE — awaiting confirmation'
    : state.playerCallStatus?.hong === 'called' ? 'PLAYER CALL — RED — awaiting confirmation'
    : state.playerCallStatus?.chung === 'called' ? 'PLAYER CALL — BLUE — awaiting confirmation'
    : state.matchupAnimation?.status === 'showing' ? 'MATCHUP — awaiting confirmation'
    : null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(4,5,8,.86)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl border-2 p-6"
        style={{ borderColor: '#f2c14e', background: 'linear-gradient(160deg,#131318,#08080a)', boxShadow: '0 0 60px rgba(242,193,78,.25)' }}
      >
        <div className="flex items-center gap-2 mb-3" style={{ color: '#f2c14e' }}>
          <AlertTriangle size={20} />
          <span className="font-display font-black tracking-wide text-sm uppercase">
            {isParEquipe ? 'PAR ÉQUIPE MATCH RECOVERY — استرجاع مباراة الفرق' : 'PREVIOUS SESSION FOUND — تم العثور على جلسة سابقة'}
          </span>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/40 p-3 mb-4 text-white/90 text-sm space-y-1">
          <div className="flex justify-between"><span className="opacity-60">Match / المباراة</span><span className="font-bold">#{state.matchNumber ?? '—'}</span></div>
          {isParEquipe && <div className="flex justify-between"><span className="opacity-60">Teams / الفرق</span><span className="font-bold text-right">{state.teamNames?.hong || redName} vs {state.teamNames?.chung || blueName}</span></div>}
          {isParEquipe && <div className="flex justify-between"><span className="opacity-60">Progress / التقدم</span><span className="font-bold">{progress}</span></div>}
          <div className="flex justify-between"><span className="opacity-60">Round / الشوط</span><span className="font-bold">{state.currentRound}</span></div>
          <div className="flex justify-between"><span className="opacity-60">Clock / الوقت</span><span className="font-bold">{clock}</span></div>
          <div className="flex justify-between"><span className="text-red-400">RED</span><span className="font-bold">{redName} — {state.hong?.totalScore ?? 0}</span></div>
          <div className="flex justify-between"><span className="text-blue-400">BLUE</span><span className="font-bold">{blueName} — {state.chung?.totalScore ?? 0}</span></div>
          {callFlowStage && (
            <div className="flex justify-between pt-1 mt-1 border-t border-white/10">
              <span className="opacity-60">Call flow / تدفق الاستدعاء</span>
              <span className="font-bold" style={{ color: '#39ff6a' }}>{callFlowStage}</span>
            </div>
          )}
        </div>

        <p className="text-white/60 text-xs mb-4 leading-relaxed">
          {isParEquipe ? 'The application appears to have closed unexpectedly during this Par Équipe match.' : 'The application appears to have closed unexpectedly during this match.'} You can restore it from the last safe saved point (the clock will not count the time the computer was off), or start a new match instead.
          <br />
          يبدو أن التطبيق أُغلق بشكل غير متوقع أثناء هذه المباراة. يمكنك استرجاعها من آخر نقطة آمنة محفوظة (لن يُحتسب وقت
          توقف الجهاز)، أو بدء مباراة جديدة.
        </p>

        {recoveryRestored ? (
          <div className="rounded-xl border-2 border-[#39ff6a]/40 bg-[#39ff6a]/10 p-4 text-center">
            <div className="font-display font-black text-base tracking-wide text-[#39ff6a]">MATCH RESTORED</div>
            <div className="mt-1 text-xs text-white/65">The saved state is loaded. Nothing will start automatically.</div>
            <div className="mt-1 text-[11px] text-white/45">The Main Referee must press READY / continue manually.</div>
            <button
              type="button"
              onClick={finishRecoveryReady}
              className="mt-3 w-full rounded-lg py-2.5 font-display font-black text-sm uppercase tracking-wide"
              style={{ background: '#39ff6a', color: '#050505' }}
            >
              READY
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={restoreSession}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 font-display font-black text-sm uppercase tracking-wide"
              style={{ background: '#f2c14e', color: '#050505' }}
            >
              <RotateCcw size={16} /> Restore Match
            </button>
            <button
              type="button"
              onClick={dismissRecoverableSession}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 font-display font-black text-sm uppercase tracking-wide border border-white/20 text-white/80"
            >
              <PlusCircle size={16} /> Start New Match
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
