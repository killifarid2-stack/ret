import React, { useRef, useState } from 'react';
import { useAccessControl } from '@/context/AccessControlContext';
import { Save, ListChecks, RotateCcw, X, CheckCircle2, Download, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { MatchState } from '@/types/tkd';
import { logAudit } from '@/lib/audit-log';
import {
  isParEquipeMatch,
  saveParEquipeMatch,
  saveParEquipeSafeSnapshot,
  listParEquipeSavedMatches,
  getParEquipeSavedMatch,
  deleteParEquipeSavedMatch,
  summarizeParEquipeSave,
  ParEquipeSaveSummary,
  getParEquipeSaveHistory,
  getParEquipeFinalSnapshot,
  loadParEquipeSafeSnapshot,
  getParEquipeLifecycle,
  cancelParEquipeMatch,
  buildParEquipeArchiveExport,
  hasNewerParEquipeVersion,
  pruneParEquipeHistory,
} from '@/lib/par-equipe-save';
import { syncParEquipeTournamentArchive, saveParEquipeTournamentArchiveSnapshot, buildParEquipeArchiveTeams } from '@/lib/par-equipe-tournament-archive';
import { loadTournamentLocal } from '@/lib/tournament-local';

interface Props {
  state: MatchState;
  dispatch: React.Dispatch<any>;
}

// PAR ÉQUIPE — MATCH SAVE WINDOW
// Dedicated to the Par Équipe section only (see MainRefereeCallPanel), and
// never rendered for Individual matches (spec §1, §10, §17). Public Display
// never gets Save/Restore controls (spec §14–15) — this component is only
// ever mounted inside the Main Referee panel.
export default function ParEquipeSaveMatch({ state, dispatch }: Props) {
  const { canRestore, canExport } = useAccessControl();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showList, setShowList] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [restoredNotice, setRestoredNotice] = useState<ParEquipeSaveSummary | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [lastSaveAt, setLastSaveAt] = useState<number | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const restoreInFlightRef = useRef(false);
  // Hooks must run unconditionally on every render (competitionMode can, in
  // principle, differ between renders while a new match is being set up) —
  // so the Par Équipe gate is applied after all hooks, not before.
  const saves = React.useMemo(() => listParEquipeSavedMatches(), [showList, listVersion]);

  if (!isParEquipeMatch(state)) return null;

  const totalRounds = Math.max(
    state.teamRoster?.hong?.length ?? 0,
    state.teamRoster?.chung?.length ?? 0,
    state.config?.rounds ?? 0,
  );
  const completedRounds = state.roundWinners?.length ?? 0;

  const handleSaveTournamentArchive = () => {
    if (!state.tournamentId) {
      const teams = [
        { id: 'chung', name: state.teamNames?.chung || state.chung.player.name || '—', photo: state.teamLogos?.chung, clubPhoto: state.clubLogos?.chung, club: state.clubNames?.chung, country: state.teamCountry?.chung, players: state.teamRoster?.chung || [] },
        { id: 'hong', name: state.teamNames?.hong || state.hong.player.name || '—', photo: state.teamLogos?.hong, clubPhoto: state.clubLogos?.hong, club: state.clubNames?.hong, country: state.teamCountry?.hong, players: state.teamRoster?.hong || [] },
      ];
      saveParEquipeTournamentArchiveSnapshot({ tournamentName: state.competitionName || 'Par Équipe Tournament', ageGroup: state.ageGroup, gender: state.gender, weightCategory: state.weightCategory, division: state.config?.division, eventDate: state.eventDate, eventLocation: state.eventLocation, format: 'par_equipe', playMode: state.teamMode, teams: buildParEquipeArchiveTeams({teams}), matches: [{id: state.id, matchNumber: state.matchNumber, round: state.currentRound, matNumber: state.matNumber, team1: teams[0].name, team2: teams[1].name, status: state.status === 'finished' ? 'COMPLETED' : 'IN_PROGRESS', score: `${state.chung.totalScore}-${state.hong.totalScore}`, weightCategory: state.weightCategory, ageGroup: state.ageGroup, gender: state.gender, tournamentId: state.tournamentId || undefined}]});
    } else {
      syncParEquipeTournamentArchive(state.tournamentId);
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2200);
    logAudit('par_equipe_tournament_archive_saved', `${state.competitionName || 'Par Équipe'} — ${state.tournamentId || state.id}`);
  };

  const handleSave = () => {
    const saved = saveParEquipeMatch(state);
    saveParEquipeSafeSnapshot(state, 'referee_safe');
    setLastSaveAt(saved?.savedAt ?? Date.now());
    setListVersion((v) => v + 1);
    setShowSaveModal(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2200);
  };

  const handleRestore = (saveId: string) => {
    if (!canRestore) { window.alert('SUPERVISOR or ADMIN permission required for RESTORE.'); return; }
    if (restoreInFlightRef.current) return;
    const rec = getParEquipeSavedMatch(saveId);
    if (!rec || !isParEquipeMatch(rec.state)) return;

    const currentHasProgress = state.status !== 'waiting'
      || (state.events?.length ?? 0) > 0
      || state.currentRound > 1
      || !!state.callAnimation
      || !!state.singlePlayerCall
      || !!state.matchupAnimation
      || !!state.autoCallSequence?.active
      || state.teamCallStatus?.hong !== 'idle'
      || state.teamCallStatus?.chung !== 'idle';
    const replacingDifferentMatch = state.id !== rec.matchId && currentHasProgress;

    if (replacingDifferentMatch && !window.confirm(
      'Another Par Équipe match currently has progress. Replace the current match with this saved match?'
    )) return;
    if (hasNewerParEquipeVersion(saveId) && !window.confirm(
      'A newer snapshot version exists for this match. Restore this selected version anyway?'
    )) return;
    if (rec.status === 'completed' && !window.confirm(
      'This match already finished with a final result. Restore the archived state anyway?'
    )) return;

    restoreInFlightRef.current = true;
    try {
      // Spec §9: never auto-start the match or any animation on restore —
      // RESTORE_STATE blocks the automatic call-flow bootstrap and leaves
      // the referee in control.
      dispatch({ type: 'RESTORE_STATE', state: rec.state });
      logAudit('par_equipe_match_restored', `${rec.state.competitionName || 'Par Équipe'} — ${rec.matchId}`);
      setShowList(false);
      setRestoredNotice(summarizeParEquipeSave(rec));
    } finally {
      window.setTimeout(() => { restoreInFlightRef.current = false; }, 250);
    }
  };

  const handleExport = () => {
    if (!canExport) return;
    const archive = buildParEquipeArchiveExport(state.id);
    if (!archive) return;
    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `par-equipe-${state.matchNumber ?? state.id}-archive.json`;
    a.click();
    URL.revokeObjectURL(url);
    logAudit('par_equipe_archive_exported', `${state.competitionName || 'Par Équipe'} — ${state.id}`);
  };

  const handlePruneHistory = () => {
    if (!canRestore) { window.alert('SUPERVISOR or ADMIN permission required for history cleanup.'); return; }
    const removed = pruneParEquipeHistory(state.id, 8);
    setListVersion((v) => v + 1);
    if (removed > 0) setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1800);
  };

  const handleDelete = (saveId: string) => {
    if (!canRestore) { window.alert('SUPERVISOR or ADMIN permission required for DELETE.'); return; }
    deleteParEquipeSavedMatch(saveId);
    setListVersion((v) => v + 1);
  };

  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
        aria-expanded={expanded}
        title="اضغط لإظهار/إخفاء أدوات حفظ مباراة بار إيكيب — Click to show/hide Par Équipe save tools"
      >
        <div className="flex items-center gap-2">
          <Save size={15} className="text-primary" />
          <div className="text-start">
            <h4 className="font-display font-black text-xs tracking-wide">PAR ÉQUIPE MATCH SAVE</h4>
            {expanded && (
              <p className="text-[10px] text-muted-foreground">Save or resume this team match — never affects Individual matches.</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!expanded && justSaved && (
            <span className="flex items-center gap-1 text-[10px] font-black text-[#39ff6a]">
              <CheckCircle2 size={12} /> SAVED
            </span>
          )}
          {!expanded && saves.length > 0 && (
            <span className="text-[10px] font-bold text-white/50">({saves.length} saved)</span>
          )}
          {expanded ? <ChevronUp size={14} className="text-white/60" /> : <ChevronDown size={14} className="text-white/60" />}
        </div>
      </button>

      {expanded && (<>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSaveTournamentArchive}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-yellow-400/15 text-yellow-300 border border-yellow-400/40"
          title="Save the complete Par Équipe tournament archive"
        >
          <Save size={12} /> SAVE TOURNAMENT
        </button>
        <button
          type="button"
          onClick={() => setShowSaveModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-primary/15 text-primary border border-primary/30"
        >
          <Save size={12} /> SAVE MATCH
        </button>
        <button
          type="button"
          onClick={() => setShowRecovery(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-white/5 text-white/80 border border-white/15"
        >
          RECOVERY
        </button>
        <button
          type="button"
          onClick={() => setShowList(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-white/5 text-white/80 border border-white/15"
        >
          <ListChecks size={12} /> SAVED MATCHES{saves.length ? ` (${saves.length})` : ''}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={!canExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-white/5 text-white/80 border border-white/15"
          title="Export a self-contained Par Équipe archive"
        >
          <Download size={12} /> EXPORT
        </button>
        <span className="text-[9px] text-white/45">{lastSaveAt ? `AUTO/SAVE ${new Date(lastSaveAt).toLocaleTimeString()}` : 'READY'}</span>
        {justSaved && (
          <span className="flex items-center gap-1 text-[10px] font-black text-[#39ff6a]">
            <CheckCircle2 size={12} /> SAVED
          </span>
        )}
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-primary/30 bg-[#0c0c14] p-4">
            <h5 className="mb-3 font-display font-black text-sm tracking-wide text-primary">SAVE PAR ÉQUIPE MATCH</h5>
            <div className="space-y-1.5 text-xs text-white/80">
              <Row label="Tournament" value={state.competitionName || '—'} />
              <Row label="Team Red" value={state.teamNames?.hong || state.hong.player.name || '—'} />
              <Row label="Team Blue" value={state.teamNames?.chung || state.chung.player.name || '—'} />
              <Row label="Match" value={state.matchNumber ? `Match ${state.matchNumber}` : '—'} />
              <Row label="Mat" value={state.matNumber ? `Mat ${state.matNumber}` : '—'} />
              <Row label="Progress" value={totalRounds ? `${completedRounds} / ${totalRounds}` : `${completedRounds}`} />
              <Row label="Status" value={state.status === 'finished' ? 'COMPLETED' : state.status.toUpperCase()} />
              <Row label="Current Player" value={state.hong?.player?.name && state.chung?.player?.name ? `${state.hong.player.name} vs ${state.chung.player.name}` : '—'} />
              <Row label="Current Round" value={`${state.currentRound}`} />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 rounded-lg bg-primary py-2 text-xs font-black text-black"
              >
                SAVE
              </button>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="flex-1 rounded-lg border border-white/15 py-2 text-xs font-black text-white/70"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecovery && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-primary/30 bg-[#0c0c14] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h5 className="font-display font-black text-sm tracking-wide text-primary">PAR ÉQUIPE RECOVERY CENTER</h5>
              <button type="button" onClick={() => setShowRecovery(false)} className="text-white/60"><X size={16} /></button>
            </div>
            <div className="space-y-2 text-[10px] text-white/65">
              <Row label="Lifecycle" value={getParEquipeLifecycle(state)} />
              <Row label="Last Save" value={lastSaveAt ? new Date(lastSaveAt).toLocaleString() : '—'} />
              <Row label="Safe Snapshot" value={state.id && loadParEquipeSafeSnapshot(state.id) ? new Date(loadParEquipeSafeSnapshot(state.id)!.savedAt).toLocaleString() : '—'} />
              <Row label="Final Snapshot" value={getParEquipeFinalSnapshot(state.id) ? 'AVAILABLE' : '—'} />
              <Row label="History Versions" value={`${getParEquipeSaveHistory(state.id).length}`} />
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2 text-[10px] text-white/50">
              Recovery is read-only here. Restore always remains a referee-controlled action and never auto-starts the match.
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={handlePruneHistory} disabled={!canRestore} className="flex-1 rounded-lg border border-white/10 py-2 text-[10px] font-black text-white/60">
                <ShieldCheck size={12} className="mr-1 inline" /> CLEAN HISTORY
              </button>
              <button type="button" onClick={() => setShowRecovery(false)} className="flex-1 rounded-lg bg-primary py-2 text-[10px] font-black text-black">CLOSE</button>
            </div>
          </div>
        </div>
      )}

      {showList && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border border-primary/30 bg-[#0c0c14] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h5 className="font-display font-black text-sm tracking-wide text-primary">SAVED MATCHES</h5>
              <button type="button" onClick={() => setShowList(false)} className="text-white/60">
                <X size={16} />
              </button>
            </div>
            {saves.length === 0 && (
              <p className="text-xs text-white/50">No saved Par Équipe matches yet.</p>
            )}
            <div className="space-y-2">
              {saves.map((rec) => {
                const s = summarizeParEquipeSave(rec);
                return (
                  <div key={s.saveId} className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white/90">{s.tournament || 'Untitled tournament'}</span>
                      <span
                        className={`text-[9px] font-black uppercase tracking-wide ${
                          s.status === 'completed' ? 'text-white/40' : 'text-[#39ff6a]'
                        }`}
                      >
                        {s.status === 'completed' ? 'COMPLETED' : 'IN PROGRESS'}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/70">{s.teamRed} vs {s.teamBlue}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white/50">
                      {s.matchNumber && <span>Match {s.matchNumber}</span>}
                      {s.mat && <span>Mat {s.mat}</span>}
                      <span>Progress {s.progress}</span>
                      <span>Score {s.score}</span>
                      <span>Saved {new Date(s.savedAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleRestore(s.saveId)}
                        disabled={!canRestore}
                        className="flex items-center gap-1 rounded-lg bg-primary/20 border border-primary/40 px-2.5 py-1 text-[10px] font-black text-primary"
                      >
                        <RotateCcw size={11} /> RESTORE MATCH
                      </button>
                      {s.status === 'in_progress' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm('Cancel this Par Équipe saved match? It will remain archived as CANCELLED.')) return;
                            const rec = getParEquipeSavedMatch(s.saveId);
                            if (rec) cancelParEquipeMatch(rec.state);
                            setListVersion((v) => v + 1);
                          }}
                          className="rounded-lg border border-red-500/20 px-2.5 py-1 text-[10px] font-black text-red-300/70"
                        >
                          CANCEL MATCH
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(s.saveId)}
                        disabled={!canRestore}
                        className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-black text-white/50"
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {restoredNotice && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#39ff6a]/40 bg-[#0c0c14] p-5 text-center">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-[#39ff6a]" />
            <h5 className="font-display font-black text-sm tracking-wide text-white">MATCH RESTORED</h5>
            <p className="mt-1 text-[11px] text-white/60">
              {restoredNotice.teamRed} vs {restoredNotice.teamBlue} — progress {restoredNotice.progress}
            </p>
            <p className="mt-1 text-[10px] text-white/40">
              Nothing has started automatically. Continue from the call/match controls above when ready.
            </p>
            <button
              type="button"
              onClick={() => setRestoredNotice(null)}
              className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-black text-black"
            >
              READY
            </button>
          </div>
        </div>
      )}
      </>)}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-1">
      <span className="text-white/40">{label}</span>
      <span className="font-bold text-white/90">{value}</span>
    </div>
  );
}
