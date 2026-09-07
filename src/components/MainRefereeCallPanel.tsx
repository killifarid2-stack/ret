import React, { useEffect, useState } from 'react';
import {
  Radio, RotateCcw, X, ShieldCheck, PlayCircle,
  UserRound, Users, CheckCircle2, Save, Eye, Play, Maximize, Minimize, Swords, Timer, Activity,
} from 'lucide-react';
import { MatchState, PlayerColor } from '@/types/tkd';
import { soundSettings } from '@/lib/sounds';
import { nameFormatLabels } from '@/lib/playerName';

interface Props {
  state: MatchState;
  dispatch: React.Dispatch<any>;
  modal?: boolean;
  onClose?: () => void;
  openControlsOnMount?: boolean;
  openTeamControlsOnMount?: boolean;
}

function isAnimationBusy(state: MatchState) {
  return !!state.singlePlayerCall?.status && state.singlePlayerCall.status === 'calling'
    || !!state.matchupAnimation?.status && state.matchupAnimation.status === 'showing';
}

export default function MainRefereeCallPanel({ state, dispatch, modal = false, onClose, openControlsOnMount = false, openTeamControlsOnMount = false }: Props) {
  // The Main Referee call-control window belongs exclusively to Par Équipe.
  // 1v1 uses the dedicated yellow Player Call trigger in the match header.
  // Keep the boolean before hooks, but return only after all hooks so React's
  // hook order remains stable when the competition type changes.
  const isParEquipe = state.config?.competitionMode === 'par_equipe';
  const [muted, setMuted] = useState(() => soundSettings.isMuted());
  const [controlsOpen, setControlsOpen] = useState(openControlsOnMount);
  const [teamControlsOpen, setTeamControlsOpen] = useState(openTeamControlsOnMount);
  const [playerCallSaved, setPlayerCallSaved] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  // The panel stays mounted between clicks on the header launchers (only the
  // outer `mainRefereeToolsOpen` flag toggles the mount). Re-clicking "TEAM
  // CALL" while the panel is already open only changes this prop, not the
  // mount — without this effect the team controls section never opened.
  useEffect(() => {
    if (openTeamControlsOnMount) { setTeamControlsOpen(true); setControlsOpen(true); }
  }, [openTeamControlsOnMount]);

  const busy = isAnimationBusy(state);
  const playerCall = state.singlePlayerCall;
  const playerStatuses = state.playerCallStatus || { chung: 'waiting', hong: 'waiting' };
  const playerSelected = state.selectedCallPlayers || {};
  const playerAutoActive = !!state.autoCallSequence?.active && (
    state.autoCallSequence?.mode === 'players' || state.autoCallSequence?.mode === 'full'
  );
  const playerBusy = !!playerCall || playerAutoActive;
  const playerCount = isParEquipe
    ? (Array.isArray(state.teamRoster?.chung) ? state.teamRoster.chung.length : 0) + (Array.isArray(state.teamRoster?.hong) ? state.teamRoster.hong.length : 0)
    : [state.chung?.player?.name, state.hong?.player?.name].filter(Boolean).length;

  useEffect(() => soundSettings.subscribe((s) => setMuted(s.muted)), []);


  const savePlayerCall = () => {
    try {
      localStorage.setItem('wab-player-call-control-snapshot', JSON.stringify({
        savedAt: new Date().toISOString(),
        competitionName: state.competitionName,
        matchNumber: state.matchNumber,
        weightCategory: state.weightCategory,
        ageGroup: state.ageGroup,
        gender: state.gender,
        division: state.division,
        eventDate: state.eventDate,
        eventLocation: state.eventLocation,
        blue: state.chung.player,
        red: state.hong.player,
      }));
    } catch {}
    setPlayerCallSaved(true);
    window.setTimeout(() => setPlayerCallSaved(false), 1600);
  };

  const confirmPlayerReadyAndGoLive = (side: PlayerColor) => {
    dispatch({ type: 'MARK_SINGLE_PLAYER_READY', side });
    // BLUE confirmation only marks BLUE ready. The final RED READY is the
    // public READY stop: keep that frame for the configured hold time
    // (readyHoldSeconds, default 3s), then go LIVE.
    if (side !== 'hong') return;
    const holdMs = (state.callDisplayConfig?.readyHoldSeconds ?? 3) * 1000;
    window.setTimeout(() => {
      dispatch({ type: 'GO_LIVE_BROADCAST' });
    }, holdMs);
  };

  const resetPlayerCall = () => {
    dispatch({ type: 'STOP_BROADCAST_ANIMATION' });
    dispatch({ type: 'SET_PLAYER_CALL_PREVIEW_STATE', state: undefined });
  };

  const startPlayerPreview = (stage: 'intro' | 'showRound' | 'showRedPlayer' | 'showBluePlayer' | 'showBothPlayers' | 'ready') => {
    if (!state.singlePlayerCall) dispatch({ type: 'START_PLAYER_CALL_SEQUENCE' });
    window.setTimeout(() => dispatch({ type: 'SET_PLAYER_CALL_PREVIEW_STATE', state: stage }), 60);
  };

  const nextTeamStage = () => {
    const stage = state.autoCallSequence?.stage;
    if (stage === 'TEAM_CHUNG') return dispatch({ type: 'JUMP_TEAM_CALL_STAGE', stage: 'red' });
    if (stage === 'TEAM_HONG') return dispatch({ type: 'JUMP_TEAM_CALL_STAGE', stage: 'waiting' });
    if (stage === 'GREETING') {
      const delay = Math.max(0.5, Number(state.config.teamCallReadyDelaySeconds ?? 3)) * 1000;
      window.setTimeout(() => dispatch({ type: 'JUMP_TEAM_CALL_STAGE', stage: 'ready' }), delay);
      return;
    }
    if (stage === 'DONE') return dispatch({ type: 'JUMP_TEAM_CALL_STAGE', stage: 'live' });
    return dispatch({ type: 'JUMP_TEAM_CALL_STAGE', stage: 'blue' });
  };

  const playerStageButtons: Array<{
    stage: 'intro' | 'showRound' | 'showRedPlayer' | 'showBluePlayer' | 'showBothPlayers' | 'ready';
    label: string;
    color: string;
  }> = [
    { stage: 'intro', label: 'INTRO', color: '#f2c14e' },
    { stage: 'showRound', label: 'NEXT ROUND', color: '#f2c14e' },
    { stage: 'showBluePlayer', label: 'BLUE PLAYER', color: '#33a2ff' },
    { stage: 'showRedPlayer', label: 'RED PLAYER', color: '#ff2b39' },
    { stage: 'showBothPlayers', label: 'BOTH PLAYERS / VS', color: '#f2c14e' },
    { stage: 'ready', label: 'READY', color: '#39ff6a' },
  ];

  return (
    <section dir="ltr" className={`${modal ? 'fixed inset-0 z-[260] m-0 min-h-screen w-full overflow-y-auto rounded-none p-3 md:p-5 lg:p-7' : fullScreen ? 'fixed inset-0 z-[480] m-0 min-h-screen w-full overflow-y-auto rounded-none p-4 md:p-6 lg:p-8' : 'mt-3 w-full rounded-2xl p-4'} relative overflow-hidden border-2 border-[hsl(var(--gold))]/30 bg-[radial-gradient(circle_at_10%_0%,rgba(242,193,78,.10),transparent_28%),radial-gradient(circle_at_92%_8%,rgba(51,162,255,.08),transparent_25%),linear-gradient(145deg,#090c12,#05070b)] shadow-[0_0_70px_rgba(242,193,78,.10)]`}>
      <div className="pointer-events-none absolute -top-28 left-1/4 h-72 w-72 rounded-full bg-[hsl(var(--gold))]/10 blur-3xl"/>
      <div className="pointer-events-none absolute -bottom-32 right-1/4 h-80 w-80 rounded-full bg-[hsl(var(--chung))]/[.06] blur-3xl"/>
      <div className="relative">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="flex items-center gap-2">
          <Radio size={17} className="text-[hsl(var(--gold))]" />
          <div>
            <h3 className="font-display font-black text-sm tracking-wide">PLAYER CALL — MAIN REFEREE</h3>
            <p className="text-[10px] text-muted-foreground">INDIVIDUAL + PAR ÉQUIPE · Player Call is controlled only by Main Referee.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isParEquipe && (
            <button
              type="button"
              onClick={() => setControlsOpen(true)}
              className="rounded-xl border-2 border-[#33a2ff] bg-[#33a2ff]/10 px-4 py-2 text-[11px] font-black tracking-wide text-[#33a2ff] transition hover:bg-[#33a2ff]/20"
            >
              <UserRound size={14} className="inline me-1" /> PLAYER CALL CONTROLS
            </button>
          )}
          {isParEquipe && <button
            type="button"
            onClick={() => setTeamControlsOpen(true)}
            className="rounded-xl border-2 border-[#f2c14e] bg-[#f2c14e]/10 px-4 py-2 text-[11px] font-black tracking-wide text-[#f2c14e] transition hover:bg-[#f2c14e]/20"
          >
            <Users size={14} className="inline me-1" /> TEAM CALL CONTROLS
          </button>}
          <button type="button" onClick={() => setFullScreen(v => !v)} className="rounded-xl border-2 border-[hsl(var(--gold))]/55 bg-[hsl(var(--gold))]/10 px-4 py-2 text-[10px] font-black text-[hsl(var(--gold))] shadow-[0_0_20px_hsl(var(--gold)/.12)] hover:bg-[hsl(var(--gold))]/20">
            {fullScreen ? <Minimize size={14} className="inline me-1"/> : <Maximize size={14} className="inline me-1"/>}
            {fullScreen ? 'EXIT FULL SCREEN' : 'FULL SCREEN MAIN REFEREE'}
          </button>
          {modal && onClose && (
            <button type="button" onClick={onClose} className="rounded-xl border-2 border-white/20 bg-white/5 px-4 py-2 text-[10px] font-black text-white/80 hover:bg-white/10">
              <X size={14} className="inline me-1"/> CLOSE TOOLS
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {[
          ['PLAYERS', playerCount, Users, 'text-white'],
          ['MATCH', state.matchNumber || '---', Swords, 'text-[hsl(var(--gold))]'],
          ['ROUND', `${state.currentRound}/${state.config.rounds}`, Activity, 'text-[hsl(var(--chung))]'],
          ['TIME', `${Math.floor(Math.max(0,state.timeRemaining)/60)}:${String(Math.max(0,state.timeRemaining)%60).padStart(2,'0')}`, Timer, 'text-amber-300'],
          ['STATUS', state.status?.toUpperCase() || 'READY', Radio, state.status === 'fighting' ? 'text-emerald-300' : 'text-[hsl(var(--gold))]'],
          ['WEIGHT', state.weightCategory || '---', ShieldCheck, 'text-white'],
        ].map(([label,value,Icon,cls]:any)=><div key={label} className="rounded-xl border border-white/10 bg-black/30 p-3 shadow-inner"><div className={`flex items-center gap-1.5 text-[8px] font-black tracking-[.16em] ${cls}`}><Icon size={12}/>{label}</div><div className="mt-1 truncate text-sm md:text-base font-black text-white">{value}</div></div>)}
      </div>

      {controlsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-0 backdrop-blur-xl" onMouseDown={() => setControlsOpen(false)}>
          <div className="h-full max-h-none w-full max-w-none overflow-y-auto rounded-none border-0 border-t-2 border-[#33a2ff]/40 bg-[radial-gradient(circle_at_15%_0%,rgba(51,162,255,.08),transparent_30%),#06080c] p-4 md:p-6 lg:p-8 shadow-[0_0_100px_rgba(51,162,255,.12)]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <div className="font-display text-sm font-black tracking-wide text-[#33a2ff]">PLAYER CALL CONTROLS · استدعاء اللاعبين</div>
                <div className="text-[9px] text-white/45">All Player Call controls are kept together. No Team Call animation is used.</div>
              </div>
              <button type="button" onClick={() => setControlsOpen(false)} className="rounded-full border-2 border-white/15 px-3 py-1.5 text-[10px] font-black text-white/70 hover:border-white/30">CLOSE · إغلاق</button>
            </div>

            {/* Par Équipe substitution shortcuts — the existing substitution dialog remains unchanged. */}
            {(state.teamMode === 'substitution' || state.config?.competitionMode === 'par_equipe') && (
              <div className="mb-3 rounded-xl border border-[#ffb020]/30 bg-[#ffb020]/[.035] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 font-display text-xs font-black tracking-[.12em] text-[#ffb020]">
                      <UserRound size={14} /> PLAYER CHANGE — MAIN REFEREE
                    </div>
                    <div className="mt-1 text-[9px] text-white/45">
                      Opens the existing player-change selection. The original substitution animation and match logic are untouched.
                    </div>
                  </div>
                  {state.substitutionAnimation && (
                    <span className="text-[8px] font-black uppercase tracking-[.14em] text-[#39ff6a]">ANIMATION ACTIVE</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['chung', 'hong'] as PlayerColor[]).map((side) => {
                    const blue = side === 'chung';
                    const accent = blue ? '#33a2ff' : '#ff2b39';
                    return (
                      <button
                        key={side}
                        type="button"
                        disabled={!!state.pendingSubstitution || !!state.substitutionAnimation}
                        onClick={() => dispatch({ type: 'REQUEST_SUBSTITUTION', side })}
                        className="rounded-full border-2 px-4 py-1.5 text-[10px] font-black disabled:opacity-30"
                        style={{ borderColor: `${accent}88`, color: accent, background: `${accent}10` }}
                      >
                        <UserRound size={12} className="inline me-1" /> CHANGE {blue ? 'BLUE' : 'RED'} PLAYER
                      </button>
                    );
                  })}
                  {state.substitutionAnimation && (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'CLEAR_SUBSTITUTION_ANIMATION' })}
                      className="rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-black text-white/70"
                    >
                      <RotateCcw size={12} className="inline me-1" /> CLEAR CHANGE ANIMATION
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="mb-3 rounded-xl border border-[#33a2ff]/25 bg-[#33a2ff]/5 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 font-display text-xs font-black tracking-[.12em] text-[#33a2ff]"><UserRound size={14} /> PLAYER CALL — 1V1 / PAR ÉQUIPE</div>
                  <div className="mt-1 text-[9px] text-white/45">Exact Player Call animation · same transitions, timing and stages.</div>
                </div>
                {playerCallSaved && <span className="text-[9px] font-black text-[#39ff6a]">✓ SAVED</span>}
              </div>

              <div className="mb-3 rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="mb-2 text-[9px] font-black tracking-[.18em] text-[#f2c14e]">AUTO PLAYER CALL TIMING · التحكم في التوقيت</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                  {([
                    ['playerCallBlueSeconds', 'BLUE · seconds', state.config.playerCallBlueSeconds ?? 3],
                    ['playerCallRedSeconds', 'RED · seconds', state.config.playerCallRedSeconds ?? 3],
                    ['playerCallReadyDelaySeconds', 'READY → MATCHUP · seconds', state.config.playerCallReadyDelaySeconds ?? 3],
                    ['playerCallGoLiveDelaySeconds', 'TV → LIVE · seconds', state.config.playerCallGoLiveDelaySeconds ?? 3],
                  ] as const).map(([key, label, value]) => (
                    <label key={String(key)} className="rounded-md border border-white/10 bg-white/[.03] p-2">
                      <span className="mb-1 block text-[8px] font-black uppercase tracking-[.12em] text-white/45">{label}</span>
                      <input
                        type="number"
                        min={0.5}
                        max={30}
                        step={0.5}
                        value={Number(value)}
                        onChange={(e) => dispatch({ type: 'UPDATE_CONFIG', config: { [key]: Math.max(0.5, Math.min(30, Number(e.target.value) || 0.5)) } })}
                        className="w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-center text-sm font-black text-white outline-none focus:border-[#f2c14e]"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-2 text-[8px] leading-relaxed text-white/40">BLUE runs for the selected time → RED runs for the selected time → WAIT FOR REFEREE. After RED READY, MATCHUP appears after the selected delay. TV → LIVE uses its own delay, then removes the call overlay from the public display without touching the live score/timer.
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                <button type="button" onClick={savePlayerCall} className="rounded-md border px-2.5 py-1.5 text-[9px] font-black" style={{ borderColor:'#f2c14e', color:'#f2c14e', background:'#f2c14e12' }}><Save size={11} className="inline me-1"/>SAVE</button>
                <button type="button" onClick={resetPlayerCall} className="rounded-md border border-white/20 px-2.5 py-1.5 text-[9px] font-black text-white/70"><RotateCcw size={11} className="inline me-1"/>RESET</button>
                <button type="button" onClick={() => startPlayerPreview('intro')} className="rounded-md border border-[#33a2ff]/60 px-2.5 py-1.5 text-[9px] font-black text-[#33a2ff]"><Eye size={11} className="inline me-1"/>PREVIEW</button>
                <button type="button" onClick={() => dispatch({ type: 'START_PLAYER_CALL_SEQUENCE' })} disabled={busy || playerBusy} className="rounded-md border-2 border-[#39ff6a]/70 bg-[#39ff6a]/10 px-2.5 py-1.5 text-[9px] font-black text-[#39ff6a] disabled:opacity-30"><Play size={11} className="inline me-1"/>PLAY</button>
                <button type="button" disabled={playerStatuses.chung !== 'ready' || playerStatuses.hong !== 'called'} onClick={() => confirmPlayerReadyAndGoLive('hong')} className="rounded-md border border-[#39ff6a]/60 px-2.5 py-1.5 text-[9px] font-black text-[#39ff6a] disabled:opacity-30"><ShieldCheck size={11} className="inline me-1"/>PLAYER READY / CONFIRM</button>
                <button type="button" onClick={() => dispatch({ type: 'REPLAY_SINGLE_PLAYER_CALL' })} disabled={!playerCall || playerCall.status === 'calling'} className="rounded-md border border-white/20 px-2.5 py-1.5 text-[9px] font-black text-white/70 disabled:opacity-30"><RotateCcw size={11} className="inline me-1"/>REPLAY</button>
                <button type="button" onClick={() => dispatch({ type: 'STOP_BROADCAST_ANIMATION' })} disabled={!playerCall && !state.callAnimation} className="rounded-md border border-red-500/50 bg-red-500/10 px-2.5 py-1.5 text-[9px] font-black text-red-300 disabled:opacity-30"><X size={11} className="inline me-1"/>STOP</button>
              </div>

              <div className="mb-3 rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="mb-2 text-[9px] font-black tracking-[.18em] text-white/40">ANIMATION STAGES — EXACT PLAYER CALL</div>
                <div className="flex flex-wrap gap-1.5">
                  {playerStageButtons.map((b) => (
                    <button key={b.stage} type="button" onClick={() => startPlayerPreview(b.stage)} className="rounded-md border px-2.5 py-1.5 text-[8px] font-black uppercase" style={{ borderColor: `${b.color}66`, color: b.color, background: state.playerCallPreviewState === b.stage ? `${b.color}18` : 'transparent' }}>{b.label}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(['chung', 'hong'] as PlayerColor[]).map((side) => {
                  const blue = side === 'chung';
                  const accent = blue ? 'hsl(var(--chung))' : 'hsl(var(--hong))';
                  const selected = playerSelected[side];
                  // 1v1 Player Call is always callable. Use the live match
                  // player when present; otherwise use the corner fallback so
                  // the referee is never forced to type a name just to launch
                  // the original cinematic.
                  const currentName = selected?.name || state[side].player?.name || (blue ? 'CHUNG (청)' : 'HONG (홍)');
                  const status = playerStatuses[side];
                  return (
                    <div key={side} className="rounded-lg border p-2.5" style={{ borderColor: `${accent}55`, background: `${accent}08` }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[9px] font-black tracking-[.18em]" style={{ color: accent }}>{blue ? 'BLUE PLAYER' : 'RED PLAYER'}</div>
                          <div className="truncate text-xs font-bold text-white/90">{currentName}</div>
                          <div className="text-[9px] font-black" style={{ color: status === 'called' || status === 'ready' ? '#39ff6a' : status === 'calling' ? accent : '#ffffff66' }}>{status.toUpperCase()}</div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {status !== 'calling' && status !== 'called' && status !== 'ready' && (
                            <button type="button" disabled={busy || playerBusy || (side === 'hong' && playerStatuses.chung === 'waiting')} onClick={() => dispatch({
                              type: 'CALL_SINGLE_PLAYER', side,
                              playerName: currentName,
                              playerPhoto: selected?.photo || state[side].player?.photoUrl || state[side].player?.photo,
                              playerNumber: selected?.playerNumber ?? state[side].player?.playerNumber,
                              seedNumber: selected?.seedNumber ?? state[side].player?.seedNumber,
                              category: selected?.category || state.weightCategory || state[side].player?.category,
                              teamName: selected?.teamName || state.teamNames?.[side],
                              teamLogo: selected?.teamLogo || state.teamLogos?.[side],
                              clubName: selected?.clubName || state.clubNames?.[side] || state[side].player?.club,
                              clubLogo: selected?.clubLogo || state.clubLogos?.[side],
                              country: selected?.country || selected?.nationality || state[side].player?.nationality,
                            })} className="rounded-full px-2.5 py-1 text-[9px] font-black text-black disabled:opacity-30" style={{ background: accent }}>CALL {blue ? 'BLUE' : 'RED'}</button>
                          )}
                          {status === 'called' && <button type="button" onClick={() => confirmPlayerReadyAndGoLive(side)} className="rounded-full border border-[#39ff6a]/60 px-2.5 py-1 text-[9px] font-black text-[#39ff6a]"><CheckCircle2 size={11} className="inline me-1" /> CONFIRM</button>}
                          {(status === 'called' || status === 'ready') && <button type="button" disabled={playerBusy} onClick={() => dispatch({ type: 'REPLAY_SINGLE_PLAYER_CALL' })} className="rounded-full border border-white/20 px-2.5 py-1 text-[9px] font-black text-white/70 disabled:opacity-30"><RotateCcw size={11} className="inline me-1" /> REPLAY</button>}
                          {(status === 'called' || status === 'ready') && selected?.name && <button type="button" disabled={playerBusy} onClick={() => dispatch({ type: 'RECALL_SINGLE_PLAYER_CALL', side })} className="rounded-full border border-white/20 px-2.5 py-1 text-[9px] font-black text-white/70 disabled:opacity-30">RECALL</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy || playerBusy} onClick={() => dispatch({ type: 'START_PLAYER_CALL_SEQUENCE' })} className="rounded-xl border-2 border-[#ffd866] bg-[#ffd866] px-5 py-2.5 text-[10px] font-black text-black shadow-[0_0_24px_rgba(255,216,102,.28)] transition hover:brightness-110 active:scale-95 disabled:opacity-30"><PlayCircle size={12} className="inline me-1" /> START PLAYER CALL</button>
                <button type="button" disabled={!playerCall || playerCall.status !== 'called'} onClick={() => playerCall && confirmPlayerReadyAndGoLive(playerCall.side)} className="rounded-full border-2 border-[#39ff6a] px-3 py-1.5 text-[10px] font-black text-[#39ff6a] disabled:opacity-30"><ShieldCheck size={12} className="inline me-1" /> PLAYER READY / CONFIRM</button>
                <button type="button" disabled={!playerCall || playerCall.status === 'calling'} onClick={() => dispatch({ type: 'REPLAY_SINGLE_PLAYER_CALL' })} className="rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-black text-white/70 disabled:opacity-30"><RotateCcw size={12} className="inline me-1" /> REPLAY PLAYER CALL</button>
                <button type="button" disabled={!playerCall && !state.matchupAnimation} onClick={() => {
                  const delay = Math.max(0.5, Number(state.config.playerCallGoLiveDelaySeconds ?? 3)) * 1000;
                  window.setTimeout(() => dispatch({ type: 'GO_LIVE_BROADCAST' }), delay);
                }} className="rounded-full border-2 border-[#ffd866] bg-[#ffd866]/10 px-3 py-1.5 text-[10px] font-black text-[#ffd866] disabled:opacity-30"><Eye size={12} className="inline me-1" /> TV / GO LIVE</button>
                {playerCall && <button type="button" onClick={() => dispatch({ type: 'RECALL_SINGLE_PLAYER_CALL', side: playerCall.side })} className="rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-black text-white/70">RECALL PLAYER</button>}
                {playerBusy && <button type="button" onClick={() => dispatch({ type: 'STOP_BROADCAST_ANIMATION' })} className="rounded-full border-2 border-red-500/60 bg-red-500/10 px-3 py-1.5 text-[10px] font-black text-red-300"><X size={12} className="inline me-1" /> STOP PLAYER CALL</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {isParEquipe && teamControlsOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/92 p-0 backdrop-blur-xl" onMouseDown={() => setTeamControlsOpen(false)}>
          <div className="h-full max-h-none w-full max-w-none overflow-y-auto rounded-none border-0 border-t-2 border-[#f2c14e]/45 bg-[radial-gradient(circle_at_85%_0%,rgba(242,193,78,.09),transparent_30%),#06080c] p-4 md:p-6 lg:p-8 shadow-[0_0_110px_rgba(242,193,78,.12)]" onMouseDown={(e) => e.stopPropagation()}>
            {(() => {
              const auto = state.config.teamCallAutoEnabled !== false;
              const stage = state.autoCallSequence?.mode === 'teams' ? state.autoCallSequence.stage : undefined;
              const remaining = state.autoCallSequence?.stageEndsAt ? Math.max(0, (state.autoCallSequence.stageEndsAt - Date.now()) / 1000) : 0;
              const statusBlue = state.teamCallStatus?.chung || 'idle';
              const statusRed = state.teamCallStatus?.hong || 'idle';
              const timing = [
                ['teamCallBlueSeconds', 'BLUE TEAM', state.config.teamCallBlueSeconds ?? 3],
                ['teamCallRedSeconds', 'RED TEAM', state.config.teamCallRedSeconds ?? 3],
                ['teamCallReadyDelaySeconds', 'READY → MATCH', state.config.teamCallReadyDelaySeconds ?? 3],
                ['teamCallGoLiveDelaySeconds', 'TV → LIVE', state.config.teamCallGoLiveDelaySeconds ?? 2],
              ] as const;
              return <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <div className="font-display text-lg font-black tracking-[.08em] text-[#f2c14e]">TEAM CALL CONTROLS · استدعاء الفرق</div>
                    <div className="mt-1 text-[10px] text-white/45">Dedicated Main Referee window · Team Call only · Public Display remains read-only.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[9px] font-black text-white/55">STAGE: {stage || 'STANDBY'}</span>
                    <span className={`rounded-md border px-2 py-1 text-[9px] font-black ${auto ? 'border-[#39ff6a]/40 text-[#39ff6a]' : 'border-red-500/40 text-red-300'}`}>{auto ? 'AUTO ON' : 'AUTO OFF'}</span>
                    <button type="button" onClick={() => setTeamControlsOpen(false)} className="rounded-full border-2 border-white/15 px-3 py-1.5 text-[10px] font-black text-white/70 hover:border-white/30">CLOSE · إغلاق</button>
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {(['chung', 'hong'] as PlayerColor[]).map((side) => {
                    const blue = side === 'chung';
                    const accent = blue ? '#33a2ff' : '#ff2b39';
                    const status = blue ? statusBlue : statusRed;
                    const teamName = state.teamNames?.[side] || (blue ? 'BLUE TEAM' : 'RED TEAM');
                    return <div key={side} className="rounded-xl border p-3" style={{ borderColor: `${accent}55`, background: `${accent}08` }}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div><div className="text-[10px] font-black tracking-[.18em]" style={{color:accent}}>{blue ? 'BLUE TEAM' : 'RED TEAM'}</div><div className="text-sm font-black text-white/90">{teamName}</div><div className="text-[9px] font-black uppercase" style={{color: status === 'calling' ? accent : status === 'called' || status === 'ready' ? '#39ff6a' : '#ffffff66'}}>{status}</div></div>
                        <div className="flex items-center gap-2">
                          {status === 'calling' && <span className="rounded-full border border-[#39ff6a]/40 bg-[#39ff6a]/10 px-3 py-1.5 text-[9px] font-black text-[#39ff6a]">CALLING</span>}
                          {(status === 'called' || status === 'ready') && <span className="rounded-full border border-white/15 bg-white/[.03] px-3 py-1.5 text-[9px] font-black text-white/60">{status.toUpperCase()}</span>}
                        </div>
                      </div>
                    </div>;
                  })}
                </div>

                <div className="mb-3 rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="mb-2 flex items-center justify-between"><div className="text-[10px] font-black tracking-[.18em] text-[#f2c14e]">TEAM CALL TIMING · ⏱ CONTROL</div><div className="text-[10px] font-black text-white/60">{remaining > 0 ? `${remaining.toFixed(1)}s` : '—'}</div></div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {timing.map(([key,label,value]) => <label key={key} className="rounded-lg border border-white/10 bg-white/[.03] p-2"><span className="mb-1 block text-[8px] font-black uppercase tracking-[.12em] text-white/45">{label}</span><input type="number" min={0.5} max={30} step={0.5} value={Number(value)} onChange={(e)=>dispatch({type:'UPDATE_CONFIG',config:{[key]:Math.max(0.5,Math.min(30,Number(e.target.value)||0.5))}})} className="w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-center text-sm font-black text-white outline-none focus:border-[#f2c14e]" /></label>)}
                  </div>
                </div>

                <div className="mb-3 rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="mb-2 text-[10px] font-black tracking-[.18em] text-[#f2c14e]">PLAYER NAME FORMAT · ALL ANIMATIONS + LIVE</div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(nameFormatLabels) as Array<keyof typeof nameFormatLabels>).map((format) => {
                      const active = (state.callDisplayConfig?.nameFormat || 'full') === format;
                      return (
                        <button
                          key={format}
                          type="button"
                          onClick={() => dispatch({ type: 'SET_CALL_DISPLAY_CONFIG', callDisplayConfig: { nameFormat: format } })}
                          className="rounded-md border px-3 py-2 text-[9px] font-black transition"
                          style={{
                            borderColor: active ? '#f2c14e' : 'rgba(255,255,255,.12)',
                            color: active ? '#f2c14e' : 'rgba(255,255,255,.65)',
                            background: active ? 'rgba(242,193,78,.10)' : 'rgba(255,255,255,.025)',
                          }}
                        >
                          {nameFormatLabels[format]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-3 rounded-xl border border-[#f2c14e]/20 bg-black/35 p-3">
                  <div className="mb-2 text-[9px] font-black uppercase tracking-[.16em] text-white/40">TEAM CALL COMMAND BAR</div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={()=>dispatch({type:'START_TEAM_CALL_SEQUENCE'})} disabled={busy || playerBusy || state.config?.competitionMode !== 'par_equipe'} className="rounded-full border-2 border-[#ffd866] bg-[#ffd866] px-4 py-2 text-[10px] font-black text-black disabled:opacity-30">START TEAM CALL</button>
                    <button type="button" onClick={()=>dispatch({type:'UPDATE_CONFIG',config:{teamCallAutoEnabled:!auto}})} className={`rounded-full border-2 px-4 py-2 text-[10px] font-black ${auto?'border-[#39ff6a]/60 text-[#39ff6a]':'border-red-500/60 text-red-300'}`}>AUTO {auto ? 'ON' : 'OFF'}</button>
                    <button type="button" onClick={()=>dispatch({type:'SET_CALL_CONTROL_WAITING'})} className="rounded-full border border-white/20 px-3 py-2 text-[10px] font-black text-white/70">AWAITING / HOLD</button>
                    <button type="button" onClick={()=>dispatch({type:'CALL_TEAM', side:'chung'})} disabled={!!state.callAnimation || busy || playerBusy || state.config?.competitionMode !== 'par_equipe'} className="rounded-full border-2 border-[#33a2ff]/70 bg-[#33a2ff]/10 px-3 py-2 text-[10px] font-black text-[#33a2ff] disabled:opacity-30">BLUE TEAM</button>
                    <button type="button" onClick={()=>dispatch({type:'CALL_TEAM', side:'hong'})} disabled={!!state.callAnimation || busy || playerBusy || state.config?.competitionMode !== 'par_equipe'} className="rounded-full border-2 border-[#ff2b39]/70 bg-[#ff2b39]/10 px-3 py-2 text-[10px] font-black text-[#ff5360] disabled:opacity-30">RED TEAM</button>
                    <button type="button" onClick={()=>dispatch({type:'SET_CALL_CONTROL_WAITING'})} className="rounded-full border border-white/20 px-3 py-2 text-[10px] font-black text-white/70">WAITING</button>
                    <button type="button" onClick={()=>{
                      dispatch({type:'COMPLETE_GREETING_WAIT'});
                      window.setTimeout(()=>{
                        dispatch({type:'GO_LIVE_BROADCAST'});
                        dispatch({type:'SET_CALL_SCREEN',active:false});
                      },3000);
                    }} className="rounded-full border-2 border-[#39ff6a]/60 px-3 py-2 text-[10px] font-black text-[#39ff6a]">READY</button>
                    <button type="button" onClick={nextTeamStage} className="rounded-full border border-white/20 px-3 py-2 text-[10px] font-black text-white/75">NEXT STAGE</button>
                    <button type="button" onClick={()=>{const delay=Math.max(0.5,Number(state.config.teamCallGoLiveDelaySeconds??2))*1000; window.setTimeout(()=>dispatch({type:'GO_LIVE_BROADCAST'}),delay)}} className="rounded-full border-2 border-[#ffd866] bg-[#ffd866]/10 px-3 py-2 text-[10px] font-black text-[#ffd866]">TV / GO LIVE</button>
                    <button type="button" onClick={()=>{dispatch({type:'CANCEL_TEAM_CALL'});}} className="rounded-full border-2 border-red-500/70 bg-red-500/10 px-3 py-2 text-[10px] font-black text-red-300">CANCEL TEAM CALL</button>
                    <button type="button" onClick={()=>dispatch({type:'STOP_BROADCAST_ANIMATION'})} className="rounded-full border-2 border-red-500/60 bg-red-500/10 px-3 py-2 text-[10px] font-black text-red-300">STOP</button>
                    <button type="button" onClick={()=>dispatch({type:'SET_CALL_CONTROL_WAITING'})} className="rounded-full border border-white/20 px-3 py-2 text-[10px] font-black text-white/70">RESET / STANDBY</button>
                  </div>
                </div>
              </>;
            })()}
          </div>
        </div>
      )}
      </div>
    </section>
  );
}
