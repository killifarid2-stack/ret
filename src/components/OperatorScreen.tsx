import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { useMatch, canManuallyChangePlayer } from '@/context/MatchContext';
import { getAuditActor, logAudit } from '@/lib/audit-log';
import { formatTime, getCurrentRoundScore, getRotationEntryForRound, buildPoolStatsIncrements, pickPoolMvp, exportHighlightMarkersCsv } from '@/lib/match-engine';
import { toast } from 'sonner';
import { createIdempotencyGuard } from '@/lib/idempotency-guard';
import { PlayerColor, ScoreType, SCORE_LABELS, SCORE_VALUES, MatchStage, MATCH_STAGE_LABELS, DEFAULT_CONFIG } from '@/types/tkd';
import { supabase } from '@/integrations/supabase/client';
import { loadTournamentLocal, loadAllLocalTournaments, saveTournamentLocal, isLocalTournamentId } from '@/lib/tournament-local';
import { syncParEquipeTournamentArchive } from '@/lib/par-equipe-tournament-archive';
import { loadMatchesLocal, saveMatchLocal } from '@/lib/match-local';
import { persistSavedMatch } from '@/lib/match-records';
import { recordPlacements } from '@/lib/tournament-placements';
import { exportMatchPDF } from '@/lib/pdf-export';
import { useI18n } from '@/lib/i18n';
import TournamentBar from './TournamentBar';
import MatchStrip from './MatchStrip';
import { computeLeagueStandingsDisplay } from '@/lib/league-standings';
import PublicScoreboard from './PublicScoreboard';
import { sounds, soundSettings } from '@/lib/sounds';
import FlagImage from './FlagImage';
import {
  Play, Pause, SkipForward, RotateCcw, Video, AlertTriangle, Maximize, Minimize,
  Stethoscope, Minus, Zap, Hand, Target, CircleDot, Brain, ArrowLeftRight,
  Link2, QrCode, FileText, Shield, Monitor, Keyboard, Clock, FastForward,
  MinusCircle, PlusCircle, Settings2, Search, Check, X, FlaskConical, Eye, EyeOff, ClipboardList, Bell, Wifi, WifiOff, Trophy, ListOrdered, Volume2, VolumeX, UserCheck, Film, CheckCircle2, Users
} from 'lucide-react';
import ResultView from './ResultView';
import MatchReplay from './MatchReplay';
import { getChannel, teardownChannel, getConnectionMode, setConnectionMode, ConnectionMode } from '@/lib/localChannel';
import * as localWifi from '@/lib/localWifiCentral';
import { getQueuedMatchForMat, claimQueuedMatch } from '@/lib/mat-queue';
import { getAssignedMatNumber } from '@/lib/mat-status';
import { analyzeTiebreaker } from '@/lib/ai-tiebreaker';
import wooseGirokArms from '@/assets/woose-girok-arms.png';
import wooseGirokArmBlue from '@/assets/judge-decision/blue-arm.png';
import wooseGirokArmRed from '@/assets/judge-decision/red-arm.png';
import koRedLogo from '@/assets/ko/ko-red.png';
import koBlueLogo from '@/assets/ko/ko-blue.png';
import MainRefereeCallPanel from './MainRefereeCallPanel';


import { PunchIcon, TrunkKickIcon, HeadKickIcon, SpinKickIcon } from './ScoreIcons';

const SCORE_ICONS: Record<string, React.ReactNode> = {
  punch: <PunchIcon size={14} />,
  trunk_kick: <TrunkKickIcon size={14} />,
  head_kick: <HeadKickIcon size={14} />,
  turning_kick: <SpinKickIcon size={14} />,
  turning_head: <SpinKickIcon size={14} />,
  manual: <PlusCircle size={14} />,
  gamjeom: <AlertTriangle size={14} />,
};

const DEFAULT_KEY_MAP: Record<string, string> = {
  'chung_punch': 'q', 'chung_trunk_kick': 'w', 'chung_head_kick': 'e',
  'chung_turning_kick': 'r', 'chung_turning_head': 't', 'chung_gamjeom': 'g', 'chung_undo': 'z',
  'hong_punch': 'u', 'hong_trunk_kick': 'i', 'hong_head_kick': 'o',
  'hong_turning_kick': '[', 'hong_turning_head': ']', 'hong_gamjeom': 'h', 'hong_undo': 'x',
  'start_pause': ' ', 'kyeshi': 'k', 'doctor': 'd', 'ivr_chung': 'v', 'ivr_hong': 'n', 'reset': 'escape',
};

const ScoreButton = ({ label, points, onClick, color, type, shortcut }: {
  label: string; points: number; onClick: () => void; color: PlayerColor; type: string; shortcut?: string;
}) => (
  <button onClick={onClick}
    className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all active:scale-95 relative ${
      color === 'chung' ? 'btn-chung' : 'btn-hong'
    }`}>
    {shortcut && <span className="absolute top-0.5 right-1 text-[8px] opacity-40 font-mono">{shortcut.toUpperCase()}</span>}
    <div className="flex items-center justify-center gap-1 text-xs opacity-80">
      {SCORE_ICONS[type]} {label}
    </div>
    <span className="block text-lg font-display">+{points}</span>
  </button>
);

const GamjeomCircles = ({ count, max }: { count: number; max: number }) => {
  const { t } = useI18n();
  return (
  <div className="flex items-center gap-1">
    <span className="text-xs text-[hsl(var(--muted-foreground))] mr-1">{t('gamLabel')}</span>
    {Array.from({ length: Math.min(max, 10) }, (_, i) => (
      <div key={i} className={`w-3 h-3 rounded-full transition-all ${
        i < count ? 'bg-[hsl(var(--warning))] shadow-[0_0_6px_hsl(var(--warning)/0.6)]' : 'bg-[hsl(var(--muted))]'
      }`} />
    ))}
  </div>
  );
};

const RoundWinCircles = ({ color, roundWinners, totalRounds }: { color: PlayerColor; roundWinners: { round: number; winner: string }[]; totalRounds: number }) => (
  <div className="flex gap-1 mt-1">
    {Array.from({ length: totalRounds }, (_, i) => {
      const rw = roundWinners.find(r => r.round === i + 1);
      const won = rw?.winner === color;
      return (
        <div key={i} className={`w-4 h-4 rounded-full transition-all duration-500 ${
          won
            ? color === 'chung'
              ? 'bg-[hsl(var(--chung))] shadow-[0_0_8px_hsl(var(--chung)/0.6)]'
              : 'bg-[hsl(var(--hong))] shadow-[0_0_8px_hsl(var(--hong)/0.6)]'
            : 'bg-[hsl(var(--muted))]'
        }`} />
      );
    })}
  </div>
);

const PlayerPanel = ({ color, keyMap }: { color: PlayerColor; keyMap: Record<string, string> }) => {
  const { state, dispatch } = useMatch();
  const { t } = useI18n();
  const player = state[color];
  const isChung = color === 'chung';
  const roundScore = getCurrentRoundScore(state, color);

  const scoreTypes: { type: ScoreType; label: string; points: number; key: string }[] = [
    { type: 'punch', label: 'Punch', points: 1, key: `${color}_punch` },
    { type: 'trunk_kick', label: 'Body', points: 2, key: `${color}_trunk_kick` },
    { type: 'head_kick', label: 'Head', points: 3, key: `${color}_head_kick` },
    { type: 'turning_kick', label: 'Turn Body', points: 4, key: `${color}_turning_kick` },
    { type: 'turning_head', label: 'Turn Head', points: state.config.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints, key: `${color}_turning_head` },
  ];

  const handleScore = (type: ScoreType) => {
    sounds.scoreSound(type);
    dispatch({ type: 'ADD_SCORE', player: color, scoreType: type });
  };

  return (
    <div className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 ${
      isChung ? 'border-[hsl(var(--chung))]/50 bg-[hsl(var(--chung))]/5' : 'border-[hsl(var(--hong))]/50 bg-[hsl(var(--hong))]/5'
    }`}>
      <div className="text-center">
        <div className={`text-xs font-bold uppercase tracking-wider ${isChung ? 'text-[hsl(var(--chung))]' : 'text-[hsl(var(--hong))]'}`}>
          {isChung ? 'CHUNG (청)' : 'HONG (홍)'}
        </div>
        <div className="text-[hsl(var(--foreground))] font-semibold text-sm mt-1 truncate max-w-[140px] flex items-center gap-1 justify-center">
          <FlagImage code={player.player.nationality} size={32} className="h-5 w-7" />
          {player.player.name || 'Player'}
        </div>
        <div className="text-[hsl(var(--muted-foreground))] text-xs">{player.player.nationality || '---'}</div>
        {player.player.club && <div className="text-[hsl(var(--primary))]/60 text-xs">{player.player.club}</div>}
      </div>

      <div className={`score-display text-6xl ${isChung ? 'text-[hsl(var(--chung))] text-glow-chung' : 'text-[hsl(var(--hong))] text-glow-hong'}`}>
        {state.config.scoreResetPerRound ? roundScore : player.totalScore}
      </div>

      <GamjeomCircles count={player.gamjeomCount} max={Math.min(state.config.gamjeomLimit, 10)} />
      <RoundWinCircles color={color} roundWinners={state.roundWinners} totalRounds={state.config.rounds} />

      <div className="flex gap-2 text-xs">
        {player.scores.slice(0, state.config.rounds).map((s, i) => (
          <div key={i} className={`px-2 py-1 rounded ${
            i === state.currentRound - 1 ? 'bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
          }`}>R{i + 1}: {s.total}</div>
        ))}
      </div>

      {(state.status === 'fighting' || state.status === 'paused') && !state.ptgActive && (
        <div className="grid grid-cols-3 gap-1.5 w-full mt-2">
          {scoreTypes.map(({ type, label, points, key }) => (
            <ScoreButton key={type} label={label} points={points} color={color} type={type}
              shortcut={keyMap[key]} onClick={() => handleScore(type)} />
          ))}
          <button onClick={() => { sounds.gamjeom(); dispatch({ type: 'ADD_SCORE', player: color, scoreType: 'gamjeom' }); }}
            className="px-3 py-2 rounded-lg font-semibold text-sm bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] border border-[hsl(var(--warning))]/30 transition-all active:scale-95 relative">
            <span className="absolute top-0.5 right-1 text-[8px] opacity-40 font-mono">{(keyMap[`${color}_gamjeom`] || '').toUpperCase()}</span>
            <span className="block text-xs">{t('gamjeom')}</span>
            <span className="block text-lg font-display">⚠</span>
          </button>
          <button onClick={() => { sounds.click(); dispatch({ type: 'ADD_SCORE', player: color, scoreType: 'manual' }); }}
            title="Correction point — not attributed to any technique"
            className="px-3 py-2 rounded-lg font-semibold text-sm bg-[hsl(var(--muted-foreground))]/15 text-[hsl(var(--muted-foreground))] border border-[hsl(var(--muted-foreground))]/30 transition-all active:scale-95 relative">
            <div className="flex items-center justify-center gap-1 text-xs opacity-80">
              <PlusCircle size={14} /> Manual
            </div>
            <span className="block text-lg font-display">+1</span>
          </button>
        </div>
      )}
      {(state.status === 'fighting' || state.status === 'paused') && state.ptgActive && (
        <div className="w-full mt-2 text-center text-xs text-[hsl(var(--warning))] font-semibold py-2">
          PTG — awaiting referee confirmation, scoring locked
        </div>
      )}

      <div className="flex items-center gap-2">
        {state.events.filter(e => e.player === color && e.round === state.currentRound).length > 0 && (
          <button onClick={() => {
            const last = [...state.events].reverse().find(e => e.player === color && e.round === state.currentRound);
            if (!last) return;
            const ok = window.confirm(`UNDO LAST ACTION?\n${color.toUpperCase()} · ${last.type} · +${last.points}\nThis will remove only the latest score event.`);
            if (!ok) return;
            dispatch({ type: 'REMOVE_SCORE', player: color });
            logAudit('SAFE_UNDO_SCORE', { matchId: state.id, round: state.currentRound, player: color, scoreType: last.type, points: last.points, user: getAuditActor() || 'operator' });
          }}
            disabled={state.status === 'finished' || state.status === 'rest'}
            title="Safe Undo: removes only the latest score event for this side and records the correction"
            className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors disabled:opacity-30">
            <Minus size={12} /> SAFE UNDO
          </button>
        )}
      </div>
    </div>
  );
};

// Judge decision notification
interface JudgeNotification {
  id: string;
  judgeName: string;
  player: PlayerColor;
  type: ScoreType;
  timestamp: number;
  // Weighted voting: each side judge who has voted = weight 1; the chief
  // referee's own vote (cast via the buttons below) = weight 2. A side
  // wins once its summed weight reaches the majority of (2 + connected
  // judges) — the referee doesn't just unilaterally decide anymore.
  votes: Record<string, { decision: 'approve' | 'reject'; weight: number }>;
}

export default function OperatorScreen() {
  const { state, dispatch, setAlertActive, alertActive } = useMatch();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [roundEndCountdown, setRoundEndCountdown] = useState<number | null>(null);
  const [roundWinner, setRoundWinner] = useState<PlayerColor | null>(null);
  // The referee should always be able to see they're mid-tournament and how
  // many matches have already been played, without needing to flip back to
  // the Tournament screen — same ordered strip, read-only here.
  const [refBracket, setRefBracket] = useState<any[] | null>(null);
  const [connectedJudgeCount, setConnectedJudgeCount] = useState(0);
  const [koAnimation, setKoAnimation] = useState<PlayerColor | null>(null);
  const [showJudgeLink, setShowJudgeLink] = useState(false);
  const [connMode, setConnMode] = useState<ConnectionMode>(() => getConnectionMode());
  const [wifiInfo, setWifiInfo] = useState<{ port: number; ips: string[]; token: string } | null>(null);
  const [wifiJudges, setWifiJudges] = useState<{ id: string; name: string }[]>([]);
  const [wifiStatus, setWifiStatus] = useState<localWifi.WifiServerStatus | null>(null);
  const [wifiRestarting, setWifiRestarting] = useState(false);
  // The two connection modes track presence completely independently
  // (Supabase presence for Internet mode, this computer's own Wi-Fi server
  // for Local Wi-Fi mode) — every place that needs "how many judges are
  // actually connected right now" must read whichever one matches connMode,
  // never connectedJudgeCount alone, or it silently treats Wi-Fi judges as
  // absent (majority-vote math included).
  const activeJudgeCount = connMode === 'wifi' ? wifiJudges.length : connectedJudgeCount;
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [wifiQrDataUrl, setWifiQrDataUrl] = useState<string>('');
  const [sideJudgeQrDataUrl, setSideJudgeQrDataUrl] = useState<string>('');
  const [refereeName, setRefereeName] = useState<string>(() => localStorage.getItem('tkd-referee-name') || 'Referee');
  // --- Duplicate-scoring / stale-closure fix -------------------------------
  // The judge-votes channel subscription effect below used to depend on
  // [state.status, connectedJudgeCount, wifiJudges, connMode, autoApprove].
  // connectedJudgeCount and wifiJudges are BOTH set from *inside* that same
  // effect's own presence-sync handler, so every judge join/leave (or even
  // just a presence heartbeat) changed a dependency, tearing down and
  // re-subscribing the channel. Two compounding problems came from that:
  //   1. Every resubscribe cycle could leave the previous channel object
  //      still joined to the 'judge-votes' topic for a moment (Supabase's
  //      removeChannel() is async; a local Wi-Fi shim re-fetched from cache
  //      also re-attaches listeners) — so a single broadcast from a judge's
  //      phone could reach several still-live handler closures at once,
  //      each independently dispatching ADD_SCORE. Reported symptom matched
  //      exactly: one tap added the score N times, where N tracked how many
  //      resubscribe cycles had piled up since the match started.
  //   2. Each of those stacked closures freezes its OWN snapshot of
  //      `state.config.autoApproveJudgeScores` from the moment IT was
  //      created. If Auto-Approve was ever toggled on and back off again,
  //      an old, still-alive closure from the "on" period keeps applying
  //      scores immediately forever after — which is exactly what made
  //      "Require Approval" appear not to work: a zombie closure from
  //      before the toggle was flipped back was still live and still
  //      auto-approving.
  // Fix: the channel now subscribes exactly once per connMode (its only
  // real dependency — it decides which transport to use) and every
  // handler reads current values through this ref instead of closing over
  // state, so there's nothing left to go stale and nothing that forces a
  // resubscribe on ordinary state changes.
  const liveRef = useRef({
    status: state.status,
    ptgActive: state.ptgActive,
    autoApprove: state.config.autoApproveJudgeScores,
    activeJudgeCount,
    refereeName,
  });
  useEffect(() => {
    liveRef.current = {
      status: state.status,
      ptgActive: state.ptgActive,
      autoApprove: state.config.autoApproveJudgeScores,
      activeJudgeCount,
      refereeName,
    };
  });
  // Belt-and-suspenders idempotency guard: even after the fix above, a
  // single judge vote/request should never be able to add a score twice.
  // Every vote.id that has actually resulted in an ADD_SCORE dispatch gets
  // recorded here first — any further delivery of the same id (duplicate
  // network delivery, a leftover zombie channel that fix #1 didn't quite
  // catch, a judge phone's own retry, React StrictMode's dev-only double
  // effect invocation, etc.) is a no-op. Capped so a whole day-long
  // tournament doesn't grow this unboundedly.
  // Belt-and-suspenders idempotency guard: even after the fix above, a
  // single judge vote/request should never be able to add a score twice.
  // Extracted to src/lib/idempotency-guard.ts (item #11) so the logic
  // itself has unit tests independent of this component.
  const voteGuardRef = useRef(createIdempotencyGuard(500));
  const markVoteProcessed = (id: string): boolean => voteGuardRef.current.markProcessed(id);
  const [mainRefereeFullScreen, setMainRefereeFullScreen] = useState(false);
  const [mainRefereeToolsOpen, setMainRefereeToolsOpen] = useState(false);
  const [mainRefereeTeamToolsOpen, setMainRefereeTeamToolsOpen] = useState(false);
  const toggleMainRefereeFullScreen = async () => {
    const next = !mainRefereeFullScreen;
    setMainRefereeFullScreen(next);
    try {
      if (next && !document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      else if (!next && document.fullscreenElement) await document.exitFullscreen?.();
    } catch { /* CSS fullscreen remains available in Electron/webview */ }
  };
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [showKomz, setShowKomz] = useState<PlayerColor | null>(null);
  // Global mute toggle for this device (Operator tab) — persisted in
  // localStorage via soundSettings, mirrored here just so the icon re-renders.
  const [isMuted, setIsMuted] = useState(() => soundSettings.isMuted());
  useEffect(() => { const unsub = soundSettings.subscribe(s => setIsMuted(s.muted)); return () => { unsub(); }; }, []);
  const [winnerCountdown, setWinnerCountdown] = useState<number | null>(null);
  const [savedMatchId, setSavedMatchId] = useState<string | null>(null);
  const [savingMatch, setSavingMatch] = useState(false);
  const [saveCompletedNotice, setSaveCompletedNotice] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  // Individual 1v1 matches use a broadcast-first finish flow: once the match
  // is finished, the result is presented automatically and then persisted
  // without forcing the operator through an extra SAVE/CONFIRM click.
  // Par Équipe keeps its explicit official confirmation flow.
  const autoFinalizeRef = useRef(false);
  const [poolMvpLoading, setPoolMvpLoading] = useState(false);
  const [showKeyboardMap, setShowKeyboardMap] = useState(false);
  const [showMiniPreview, setShowMiniPreview] = useState(false);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(() => {
    // Remember where the referee last dragged this to, across app restarts.
    try {
      const saved = localStorage.getItem('kyorugi_preview_pos');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  }); // null = default bottom-right corner
  const previewDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  // Preview window width in px — height always follows at 16:9 so the
  // 1920x1080 public screen scales down cleanly with no letterboxing.
  const [previewWidth, setPreviewWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('kyorugi_preview_width'));
      return saved && saved >= 320 && saved <= 1000 ? saved : 520;
    } catch { return 520; }
  });
  const previewResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [savedTime, setSavedTime] = useState<number | null>(null);
  const [girokStage, setGirokStage] = useState(0);
  const [girokOpen, setGirokOpen] = useState(false);
  const [girokCounting, setGirokCounting] = useState(false);
  const [girokVotes, setGirokVotes] = useState<Record<'left'|'center'|'right', PlayerColor | null>>({ left: null, center: null, right: null });
  const [girokJudges, setGirokJudges] = useState<Record<'left'|'center'|'right', {name:string; photo?:string}>>({ left:{name:'Judge 1'}, center:{name:'Center Referee'}, right:{name:'Judge 3'} });
  const [aiTiebreakerOpen, setAiTiebreakerOpen] = useState(false);
  const [manualAiAnalysis, setManualAiAnalysis] = useState<ReturnType<typeof analyzeTiebreaker> | null>(null);
  useEffect(() => {
    if (!mainRefereeFullScreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMainRefereeFullScreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mainRefereeFullScreen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && mainRefereeFullScreen) setMainRefereeFullScreen(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [mainRefereeFullScreen]);

  useEffect(() => {
    const r = state.roundTieReview;
    if (!r) return;
    setGirokStage(r.phase === 'ai' ? 0 : r.phase === 'summons' ? 0 : r.phase === 'countdown' ? (r.countdownStep || 0) : 4);
    setGirokOpen(r.phase !== 'ai');
    setGirokCounting(r.phase === 'countdown');
    setGirokVotes({ left: r.votes?.left || null, center: r.votes?.center || null, right: r.votes?.right || null });
  }, [state.roundTieReview]);

  useEffect(() => {
    const r = state.roundTieReview;
    if (!r) return;
    setGirokJudges({
      left: { name: r.judgeNames?.left || 'Judge 1', photo: r.judgePhotos?.left },
      center: { name: r.judgeNames?.center || 'Center Referee', photo: r.judgePhotos?.center },
      right: { name: r.judgeNames?.right || 'Judge 3', photo: r.judgePhotos?.right },
    });
  }, [state.roundTieReview?.judgeNames, state.roundTieReview?.judgePhotos]);
  const [showMatchSelector, setShowMatchSelector] = useState(false);
  const [showResultView, setShowResultView] = useState(false);
  const [showMatchReplay, setShowMatchReplay] = useState(false);
  const [resultViewFocusMatch, setResultViewFocusMatch] = useState<number | undefined>(undefined);
  const [subInputName, setSubInputName] = useState('');
  const [matchSelectorData, setMatchSelectorData] = useState<any[]>([]);
  const [savedMatchesData, setSavedMatchesData] = useState<any[]>([]);
  const [ivrDecision, setIvrDecision] = useState<'accept' | 'reject' | null>(null);
  const [judgeNotifications, setJudgeNotifications] = useState<JudgeNotification[]>([]);
  const [correctionRound, setCorrectionRound] = useState<number | null>(null);
  const [kyeshiResumeOption, setKyeshiResumeOption] = useState(false);
  const [keyMap, setKeyMap] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('tkd-keymap');
    const map: Record<string, string> = saved ? JSON.parse(saved) : { ...DEFAULT_KEY_MAP };
    // One-time migration: Enter/Return can no longer be assigned to a
    // match action (see handleKeyCapture) — if an older saved config still
    // has it, fall back to that action's default key so the shortcut
    // actually works and the Settings screen doesn't show a dead binding.
    let migrated = false;
    for (const action of Object.keys(map)) {
      if (map[action]?.toLowerCase() === 'enter' || map[action]?.toLowerCase() === 'return') {
        map[action] = DEFAULT_KEY_MAP[action] ?? map[action];
        migrated = true;
      }
    }
    if (migrated) localStorage.setItem('tkd-keymap', JSON.stringify(map));
    return map;
  });
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Save keymap
  useEffect(() => {
    localStorage.setItem('tkd-keymap', JSON.stringify(keyMap));
  }, [keyMap]);

  // Local Network (Wi-Fi) judge connections — fetch this computer's LAN
  // address(es) once so the operator can read them out to judges, and keep
  // the connected-judges list in sync.
  // IMPORTANT: state.connectedJudgeCount (read by the public/audience
  // screen's "Judges Present" indicator) was previously only ever updated
  // from the Supabase Presence 'sync' handler below, which never fires in
  // Wi-Fi mode. That left the audience screen's judges-present counter
  // stuck at 0 (and stuck red) even after a judge successfully connected
  // over local Wi-Fi and the Operator screen itself showed the connection
  // fine (it reads wifiJudges.length, a separate local variable). We now
  // dispatch SET_CONNECTED_JUDGES here too, whenever wifi mode is active,
  // so the audience screen stays in sync regardless of which transport is
  // in use.
  useEffect(() => {
    localWifi.getServerInfo().then(setWifiInfo);
    const judges = localWifi.getConnectedJudges();
    setWifiJudges(judges);
    if (connMode === 'wifi') dispatch({ type: 'SET_CONNECTED_JUDGES', count: judges.length });
    return localWifi.onPresenceChange(() => {
      const updated = localWifi.getConnectedJudges();
      setWifiJudges(updated);
      if (connMode === 'wifi') dispatch({ type: 'SET_CONNECTED_JUDGES', count: updated.length });
    });
  }, [connMode]);

  // Health of the local Wi-Fi server itself (bound & listening / still
  // starting / failed-and-retrying). Previously a bind failure (e.g. the
  // port still held by a just-closed previous instance) failed completely
  // silently — the operator had no way to know judge phones couldn't
  // possibly connect until one of them reported it. Now surfaced live.
  useEffect(() => {
    if (connMode !== 'wifi') return;
    localWifi.getServerStatus().then(s => s && setWifiStatus(s));
    return localWifi.onServerStatusChange(setWifiStatus);
  }, [connMode]);

  // Auto-refresh the displayed IP/QR the instant this computer's own
  // address changes (new network, new DHCP lease, hotspot toggled) — no
  // more relying on the operator noticing and pressing "Re-check" while a
  // judge phone silently can't connect to the now-stale address.
  useEffect(() => {
    if (connMode !== 'wifi') return;
    return localWifi.onServerInfoChange(setWifiInfo);
  }, [connMode]);

  const handleSetConnMode = (mode: ConnectionMode) => {
    setConnectionMode(mode);
    setConnMode(mode);
  };

  // Listen for judge alerts & score requests
  useEffect(() => {
    // `channel` is assigned from the plain getChannel() call first, then
    // chained — NOT `const channel = getChannel(...).on(...)...subscribe()`
    // as one statement. .subscribe() below can fire the 'presence'/'sync'
    // handler synchronously (see localChannel.ts), and that handler reads
    // `channel.presenceState()`; if the whole chain were one statement,
    // that read would land inside `channel`'s own not-yet-initialized
    // temporal dead zone — a "Cannot access 'channel' before
    // initialization" crash, which is exactly what happened here.
    const channel = getChannel('judge-votes');
    channel
      .on('presence', { event: 'sync' }, () => {
        // Presence state is keyed by judgeId; count distinct judges connected
        // (not connections — one judge could theoretically have 2 tabs open,
        // but keying by judgeId keeps the count meaningful either way).
        const n = Object.keys(channel.presenceState()).length;
        setConnectedJudgeCount(n);
        dispatch({ type: 'SET_CONNECTED_JUDGES', count: n });
      })
      .on('broadcast', { event: 'judge-alert' }, () => {
        setAlertActive(true);
        sounds.error();
      })
      .on('broadcast', { event: 'pause-request' }, () => {
        if (liveRef.current.status === 'fighting') {
          dispatch({ type: 'PAUSE' });
          sounds.kallyeo();
        }
      })
      .on('broadcast', { event: 'substitution-request' }, (payload) => {
        // A side judge tapped their team's substitution button (Par Équipe).
        // `side` tells us which team (chung/hong) needs the swap — this
        // opens the same pending-substitution flow the operator's own
        // "Substitute" button uses, so the referee just picks/enters the
        // incoming player's name to complete it. Previously this event was
        // never listened for at all, so the phone button did nothing.
        const side = payload.payload?.side as 'chung' | 'hong' | undefined;
        if (side === 'chung' || side === 'hong') {
          if (liveRef.current.status === 'fighting') dispatch({ type: 'PAUSE' });
          dispatch({ type: 'REQUEST_SUBSTITUTION', side });
          sounds.kallyeo();
        }
      })
      .on('broadcast', { event: 'score-vote-request' }, (payload) => {
        // Show judge score request to operator for accept/reject
        const vote = payload.payload;
        if (vote && vote.status === 'pending') {
          // Auto-approve mode: skip the vote/notification entirely and
          // apply the side judge's score straight away.
          if (liveRef.current.autoApprove) {
            // Idempotency guard: this vote.id may already have been applied
            // by another still-live handler (e.g. right after a connMode
            // switch, before the old channel is fully torn down) — never
            // apply the same judge tap twice.
            if (markVoteProcessed(vote.id)) {
              if (!liveRef.current.ptgActive) {
                dispatch({ type: 'ADD_SCORE', player: vote.player, scoreType: vote.type, addedBy: 'judge', judgeId: vote.judgeName });
                sounds.success();
              }
              getChannel('judge-votes').send({
                type: 'broadcast', event: 'score-vote-result',
                payload: { id: vote.id, status: 'approved', player: vote.player, type: vote.type, judgeName: vote.judgeName, refereeName: liveRef.current.refereeName },
              });
            }
            return;
          }
          setJudgeNotifications(prev => {
            const exists = prev.find(n => n.id === vote.id);
            if (exists) return prev;
            return [...prev, {
              id: vote.id,
              judgeName: vote.judgeName,
              player: vote.player,
              type: vote.type,
              timestamp: vote.timestamp,
              votes: vote.votes || {},
            }];
          });
          sounds.click();
        }
      })
      .on('broadcast', { event: 'score-vote-update' }, (payload) => {
        // A side judge cast/changed their vote — merge it into our local
        // tally for that request. Whoever's vote tips the weighted majority
        // (2 for the referee + 1 per connected judge) resolves it, so this
        // can also happen here even before the referee presses anything.
        const { id, voterId, weight, decision } = (payload.payload || {}) as { id?: string; voterId?: string; weight?: number; decision?: 'approve' | 'reject' };
        if (!id || !voterId) return;
        setJudgeNotifications(prev => prev.map(n => {
          if (n.id !== id) return n;
          const votes: Record<string, { decision: 'approve' | 'reject'; weight: number }> = { ...n.votes, [voterId]: { decision: decision!, weight: weight ?? 0 } };
          const approveW = Object.values(votes).filter(v => v.decision === 'approve').reduce((s, v) => s + v.weight, 0);
          const rejectW = Object.values(votes).filter(v => v.decision === 'reject').reduce((s, v) => s + v.weight, 0);
          const totalW = 2 + liveRef.current.activeJudgeCount;
          const majority = Math.floor(totalW / 2) + 1;
          if (approveW >= majority || rejectW >= majority) {
            const approved = approveW >= majority;
            // Idempotency guard — see comment above. Reaching majority is
            // itself re-computed from scratch on every duplicate delivery
            // of the same update, so without this guard a stacked/zombie
            // handler could dispatch ADD_SCORE again for a request that
            // was already resolved.
            if (markVoteProcessed(id)) {
              if (approved && !liveRef.current.ptgActive) {
                dispatch({ type: 'ADD_SCORE', player: n.player, scoreType: n.type, addedBy: 'judge', judgeId: n.judgeName });
                sounds.success();
              } else if (!approved) {
                sounds.error();
              }
              getChannel('judge-votes').send({
                type: 'broadcast', event: 'score-vote-result',
                payload: { id: n.id, status: approved ? 'approved' : 'rejected', player: n.player, type: n.type, judgeName: n.judgeName, refereeName: liveRef.current.refereeName },
              });
            }
            return null as any; // filtered out below
          }
          return { ...n, votes };
        }).filter(Boolean));
      })
      .subscribe();
    return () => { teardownChannel(channel); };
    // Deliberately just [connMode]: this channel must be re-created when the
    // transport itself changes (Internet <-> local Wi-Fi), but nothing else
    // — every other piece of state the handlers need is read live through
    // `liveRef` above instead of being closed over, specifically so that
    // ordinary state changes (score, judge count, round status, the
    // Auto-Approve toggle, ...) never tear down and re-subscribe this
    // channel. See the long comment above `liveRef` for why that resubscribe
    // churn was the root cause of both the duplicate-scoring bug and
    // "Require Approval" silently not being honored.
  }, [connMode]);

  // Status sounds
  useEffect(() => {
    if (state.status === 'fighting') sounds.shijak();
    if (state.status === 'paused') sounds.kallyeo();
    if (state.status === 'rest') sounds.endRound();
    if (state.status === 'finished') sounds.winner();
    if (state.status === 'doctor') sounds.doctor();
    if (state.status === 'kyeshi') sounds.kyeshi();
    if (state.status === 'ivr') sounds.ivr();
  }, [state.status]);

  // Countdown warning sounds — fire once each when the clock crosses 30s
  // and 10s remaining, and a distinct beep at 0 (time's up). Refs track the
  // last remaining-time we saw so a single crossing only ever beeps once,
  // even though timeRemaining changes every second.
  const last30WarnRef = useRef<string | null>(null);
  const last10WarnRef = useRef<string | null>(null);
  const lastZeroWarnRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.status !== 'fighting') return;
    const key = `${state.currentRound}`;
    if (state.timeRemaining <= 30 && state.timeRemaining > 29 && last30WarnRef.current !== key) {
      last30WarnRef.current = key;
      sounds.countdown();
    }
    if (state.timeRemaining <= 10 && state.timeRemaining > 9 && last10WarnRef.current !== key) {
      last10WarnRef.current = key;
      sounds.gamjeom(); // distinct double-beep so it's not confused with the 30s warning
    }
    if (state.timeRemaining <= 0 && lastZeroWarnRef.current !== key) {
      lastZeroWarnRef.current = key;
      sounds.matchEnd();
    }
  }, [state.timeRemaining, state.status, state.currentRound]);

  // Round end: non-tied rounds keep the existing short winner countdown.
  // Tied rounds are already frozen by the reducer with pendingRoundDecision=true
  // and are handled by the dedicated Woose Girok panel below.
  useEffect(() => {
    if (state.status !== 'rest' || roundEndCountdown !== null || state.pendingRoundDecision) return;
    const rw = state.roundWinners.find(r => r.round === state.currentRound);
    if (rw?.winner === 'chung' || rw?.winner === 'hong') {
      setRoundWinner(rw.winner);
      setRoundEndCountdown(5);
    }
  }, [state.status, state.pendingRoundDecision, state.currentRound, state.roundWinners, roundEndCountdown]);

  const hasTieDecisionContext = (!!state.pendingRoundDecision || !!state.pendingTeamFinalDecision) && !state.result && state.status !== 'fighting';
  // AI analysis button is available during a live tie in both Individual and Par Équipe.
  // It disappears immediately once either side takes the lead.
  const currentRoundScoreBlue = state.chung.scores[state.currentRound - 1]?.total ?? 0;
  const currentRoundScoreRed = state.hong.scores[state.currentRound - 1]?.total ?? 0;
  const isLiveRoundTie = state.status === 'fighting' && !state.result && currentRoundScoreBlue === currentRoundScoreRed;

  // Woose Girok is explicitly triggered by the Main Referee.  It does not
  // auto-start when a round ties, so future broadcast animation stages can
  // be controlled independently without race conditions.
  useEffect(() => {
    if (!hasTieDecisionContext || state.config.competitionMode === 'par_equipe') {
      setGirokOpen(false);
      setGirokStage(0);
      setGirokCounting(false);
      setGirokVotes({ left: null, center: null, right: null });
    }
  }, [hasTieDecisionContext, state.currentRound, state.config.competitionMode]);

  // WOO-SE-GIROK opens the summons scene only. The countdown is a separate
  // operator action so the referee has a clean, deterministic control point.
  const openGirokSummons = useCallback(() => {
    if (!hasTieDecisionContext || state.config.competitionMode === 'par_equipe') return;
    setGirokOpen(true); setGirokCounting(false); setGirokStage(0);
    setGirokVotes({ left: null, center: null, right: null });
    const connected = [...wifiJudges].sort((a,b) => a.id.localeCompare(b.id));
    dispatch({ type: 'SET_TIE_REVIEW_PHASE', phase: 'summons', judgeNames: {
      left: connected.find(j => /judge-1/i.test(j.id))?.name || connected[0]?.name || 'Judge 1',
      center: connected.find(j => /judge-2/i.test(j.id))?.name || connected[1]?.name || 'Center Referee',
      right: connected.find(j => /judge-3/i.test(j.id))?.name || connected[2]?.name || 'Judge 3',
    } });
    sounds.success();
  }, [hasTieDecisionContext, state.config.competitionMode, dispatch]);

  const startGirokCountdown = useCallback(() => {
    if (!girokOpen || girokCounting || !hasTieDecisionContext) return;
    setGirokCounting(true); setGirokStage(1);
    dispatch({ type: 'SET_TIE_REVIEW_PHASE', phase: 'countdown', countdownStep: 1 });
    sounds.countdown();
  }, [girokOpen, girokCounting, hasTieDecisionContext, dispatch]);

  useEffect(() => {
    if (!girokOpen || !girokCounting || !hasTieDecisionContext) return;
    const timers = [
      window.setTimeout(() => { setGirokStage(2); dispatch({ type: 'SET_TIE_REVIEW_PHASE', phase: 'countdown', countdownStep: 2 }); sounds.countdown(); }, 1500),
      window.setTimeout(() => { setGirokStage(3); dispatch({ type: 'SET_TIE_REVIEW_PHASE', phase: 'countdown', countdownStep: 3 }); sounds.countdown(); }, 3000),
      window.setTimeout(() => { setGirokStage(4); setGirokCounting(false); dispatch({ type: 'SET_TIE_REVIEW_PHASE', phase: 'voting' }); sounds.success(); }, 4500),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [girokOpen, girokCounting, hasTieDecisionContext, dispatch]);

  const castGirokVote = useCallback((judge: 'left'|'center'|'right', winner: PlayerColor) => {
    if (girokStage < 4 || !hasTieDecisionContext || state.roundTieReview?.phase !== 'voting') return;
    setGirokVotes(prev => ({ ...prev, [judge]: winner }));
    dispatch({ type: 'SET_TIE_REVIEW_VOTE', judge, winner });
    sounds.click();
  }, [girokStage, hasTieDecisionContext, state.roundTieReview?.phase, dispatch]);

  useEffect(() => {
    if (roundEndCountdown === null) return;
    if (roundEndCountdown <= 0) { setRoundEndCountdown(null); setRoundWinner(null); return; }
    const t = setTimeout(() => setRoundEndCountdown(prev => (prev ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [roundEndCountdown]);

  // Per-device mat assignment: every physical operator computer can be
  // permanently assigned to one mat in Admin. We only fill an empty match
  // state here; an explicitly queued/assigned match remains authoritative.
  useEffect(() => {
    const assigned = getAssignedMatNumber();
    if (assigned && state.matNumber !== assigned) {
      dispatch({ type: 'SET_MATCH_INFO', matNumber: assigned });
    }
  }, [state.matNumber, dispatch]);

  useEffect(() => {
    if (winnerCountdown === null) return;
    if (winnerCountdown <= 0) {
      setWinnerCountdown(null);
      // IMPORTANT: finishing a match is not the same as saving it. Never
      // reset/navigate away before the operator has explicitly saved the
      // finished result. This prevents the post-match 'Home / Retry' failure
      // when the winner screen is still open and the archive write has not
      // happened yet.
      if (savedMatchId !== state.id) {
        toast.info(lang === 'ar' ? 'احفظ المباراة أولاً ثم اضغط متابعة المباراة التالية.' : 'SAVE MATCH first, then continue to the next match.');
        return;
      }
      const tournamentId = state.tournamentId;
      const matNumber = state.matNumber;
      (async () => {
        try {
          const queued = matNumber ? await getQueuedMatchForMat(matNumber) : null;
          const assigned = queued && (!tournamentId || queued.tournament_id === tournamentId) ? await claimQueuedMatch(matNumber!) : null;
          dispatch({ type: 'RESET' });
          if (tournamentId) {
            navigate('/tournament', { state: {
              continueTournamentId: tournamentId,
              autoStartNext: !assigned,
              assignedMatch: assigned || undefined,
              matNumber,
            }});
          }
        } catch (err) {
          console.error('Post-match continue failed:', err);
          toast.error(lang === 'ar' ? 'تعذر الانتقال للمباراة التالية. المباراة محفوظة ويمكنك العودة يدوياً.' : 'Could not open the next match. The result is saved; you can return manually.');
        }
      })();
      return;
    }
    const timer = setTimeout(() => setWinnerCountdown(prev => (prev ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [winnerCountdown, savedMatchId, state.id, state.tournamentId, state.matNumber, dispatch, navigate, lang]);

  // Tournament advancement is intentionally performed only after SAVE MATCH.
  // A finished-but-unsaved match must never mutate the tournament bracket.

  // Load this tournament's bracket/league just so the referee can see the
  // ordered match strip (read-only here — starting matches still happens
  // from the Tournament screen). Re-runs when we enter/leave a tournament
  // match and right after a match finishes, so the "played" count stays
  // current. League round-robin matches have no bracket rounds, so they're
  // normalized into the same MatchStripMatch shape (round omitted).
  //
  // League tournaments also get their standings table computed here and
  // broadcast to the public screen (state.leagueStandings) — recomputed on
  // the same triggers, so a finished match's win/diff updates the table
  // automatically without any separate save step.
  useEffect(() => {
    const tournamentId = state.tournamentId;
    if (!tournamentId) { setRefBracket(null); dispatch({ type: 'SET_LEAGUE_STANDINGS', standings: undefined }); return; }
    const normalize = (bd: any): any[] | null => {
      if (!bd) return null;
      if (bd.mode === 'league' && bd.league) {
        if (bd.league.length > 0) {
          dispatch({ type: 'SET_LEAGUE_STANDINGS', standings: computeLeagueStandingsDisplay(bd.league) });
        }
        return bd.league.map((m: any) => ({ id: m.id, player1: m.player1, player2: m.player2, winner: m.winner }));
      }
      dispatch({ type: 'SET_LEAGUE_STANDINGS', standings: undefined });
      return bd.bracket ?? null;
    };
    (async () => {
      if (isLocalTournamentId(tournamentId)) {
        const rec = loadTournamentLocal(tournamentId);
        setRefBracket(normalize(rec?.bracket_data));
        return;
      }
      try {
        const { data: t } = await supabase.from('tournaments').select('bracket_data').eq('id', tournamentId).single();
        setRefBracket(normalize(t?.bracket_data));
      } catch {
        setRefBracket(null);
      }
    })();
  }, [state.tournamentId, state.status]);

  const advanceTournamentAfterSave = async () => {
    if (!state.tournamentId || !state.bracketMatchId || !state.result) return;
    const tournamentId = state.tournamentId;
    const advance = (bd: any): any => {
      if (!bd) return null;
      if (bd.mode === 'league' && bd.league) {
        const league = bd.league.map((m: any) => ({ ...m }));
        const match = league.find((m: any) => m.id === state.bracketMatchId);
        if (!match || match.winner) return { ...bd, league };
        match.winner = state.result!.winner;
        match.score = `${state.chung.totalScore}-${state.hong.totalScore}`;
        return { ...bd, league };
      }
      if (!bd.bracket) return null;
      const bracket = bd.bracket.map((m: any) => ({ ...m }));
      const match = bracket.find((m: any) => m.id === state.bracketMatchId);
      if (!match || match.winner) return { ...bd, bracket };
      const winnerPlayer = state.result!.winner === 'chung' ? match.player1 : match.player2;
      const loserPlayer = state.result!.winner === 'chung' ? match.player2 : match.player1;
      match.winner = state.result!.winner;
      match.score = `${state.chung.totalScore}-${state.hong.totalScore}`;
      match.status = 'COMPLETED';
      if (match.nextMatchId && winnerPlayer) {
        const nextMatch = bracket.find((m: any) => m.id === match.nextMatchId);
        if (nextMatch) {
          if (!nextMatch.player1) nextMatch.player1 = winnerPlayer;
          else if (!nextMatch.player2) nextMatch.player2 = winnerPlayer;
        }
      }
      if (!match.nextMatchId && winnerPlayer && loserPlayer) {
        const semisFeedingFinal = bracket.filter((m: any) => m.nextMatchId === match.id && m.winner);
        const bronzePlayers = semisFeedingFinal.map((m: any) => (m.winner === 'chung' ? m.player2 : m.player1)).filter(Boolean);
        const medals = [
          { club: (winnerPlayer.club || '').trim(), medal: 'gold' as const, playerName: winnerPlayer.name },
          { club: (loserPlayer.club || '').trim(), medal: 'silver' as const, playerName: loserPlayer.name },
          ...bronzePlayers.map((p: any) => ({ club: (p.club || '').trim(), medal: 'bronze' as const, playerName: p.name })),
        ];
        recordPlacements({ tournamentId, tournamentName: state.competitionName || 'Tournament', weightCategory: state.weightCategory ?? null, ageGroup: state.ageGroup ?? null, gender: state.gender ?? null, medals });
      }
      return { ...bd, bracket };
    };
    if (isLocalTournamentId(tournamentId)) {
      const rec = loadTournamentLocal(tournamentId);
      if (!rec) return;
      const updatedBd = advance(rec.bracket_data);
      if (updatedBd) saveTournamentLocal({ ...rec, bracket_data: updatedBd });
      if (state.config.competitionMode === 'par_equipe') syncParEquipeTournamentArchive(tournamentId);
      return;
    }
    try {
      const { data: t } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();
      const updatedBd = advance(t?.bracket_data);
      if (updatedBd) await supabase.from('tournaments').update({ bracket_data: updatedBd }).eq('id', tournamentId);
      if (state.config.competitionMode === 'par_equipe') syncParEquipeTournamentArchive(tournamentId);
    } catch {
      const rec = loadTournamentLocal(tournamentId);
      if (rec) {
        const updatedBd = advance(rec.bracket_data);
        if (updatedBd) saveTournamentLocal({ ...rec, bracket_data: updatedBd });
      }
    }
  };

  const handleSaveMatch = async () => {
    if (savingMatch) return;
    if (state.status === 'finished' && state.result && !state.resultConfirmed) {
      toast.error(lang === 'ar' ? 'يجب على الحكم الرئيسي تأكيد النتيجة الرسمية أولاً.' : 'MAIN REFEREE must confirm the official result first.');
      return;
    }
    // Practice/Training Mode: the whole scoring flow runs normally, but
    // nothing gets written to the official archive (no saved-match record,
    // no bracket advance, no medal/placement, no club-standings update) —
    // see MatchConfig.trainingMode for the full rationale.
    if (state.config.trainingMode) {
      setSavedMatchId('training-mode');
      setShowSaveConfirm(false);
      toast.success(lang === 'ar' ? '🎓 وضع التدريب — الماتش ماتسجلش فالأرشيف الرسمي' : '🎓 TRAINING MODE — not saved to official archive');
      return;
    }
    setSavingMatch(true);
    try {
      if (state.status !== 'finished' || !state.result) throw new Error('MATCH_NOT_FINISHED');
      if (!state.resultConfirmed) throw new Error('RESULT_NOT_CONFIRMED');
      const result = await persistSavedMatch(state);
      if (!result.alreadySaved) await advanceTournamentAfterSave();
      logAudit(result.alreadySaved ? 'match_save_reconfirmed' : 'official_match_result_saved', `Match #${state.matchNumber ?? '—'} — ${state.result.winner.toUpperCase()} — ${state.result.method}`, { tournamentId: state.tournamentId, matchId: result.record.match_id || result.record.id, category: state.weightCategory });
      setSavedMatchId(result.record.match_id || result.record.id);
      setSaveCompletedNotice(true);
      setShowSaveConfirm(false);
      toast.success(result.alreadySaved ? (lang === 'ar' ? 'المباراة محفوظة بالفعل' : 'MATCH ALREADY SAVED') : (lang === 'ar' ? '✓ تم حفظ المباراة — مكتملة' : '✓ MATCH SAVED — COMPLETED'));
    } catch (e: any) {
      const messages: Record<string,string> = {
        MATCH_NOT_FINISHED: 'The match must be finished before saving.',
        MATCH_DATA_INCOMPLETE: 'Tournament, match number, players/teams, score or winner is missing.',
        CATEGORY_DATA_INCOMPLETE: 'Gender, age category and weight are required before saving.',
        RESULT_NOT_CONFIRMED: 'The Main Referee must confirm the official result before saving.',
      };
      toast.error(lang === 'ar' ? ({ MATCH_NOT_FINISHED: 'يجب إنهاء المباراة قبل حفظها.', MATCH_DATA_INCOMPLETE: 'بيانات البطولة أو رقم المباراة أو اللاعبين/الفرق أو النتيجة أو الفائز ناقصة.', CATEGORY_DATA_INCOMPLETE: 'الجنس والفئة السنية والوزن مطلوبة قبل الحفظ.' } as Record<string,string>)[e?.message] || 'تعذر حفظ المباراة.' : (messages[e?.message] || 'Could not save match.'));
    } finally {
      setSavingMatch(false);
    }
  };

  // INDIVIDUAL MATCH AUTO-FINALIZE: after the match is finished, allow the
  // cinematic result to breathe for three seconds, then confirm and persist
  // the result automatically. Par Équipe keeps the explicit referee flow.
  useEffect(() => {
    const individual = state.config?.competitionMode !== 'par_equipe';
    if (!individual || state.status !== 'finished' || !state.result || state.config?.trainingMode) return;
    if (savedMatchId === state.id || autoFinalizeRef.current) return;
    autoFinalizeRef.current = true;
    const timer = window.setTimeout(() => {
      if (!state.resultConfirmed) {
        dispatch({ type: 'CONFIRM_FINAL_RESULT' });
        logAudit('official_result_auto_confirmed', `Match #${state.matchNumber ?? '—'} — ${state.result?.winner?.toUpperCase?.() || '—'}`, { tournamentId: state.tournamentId, category: state.weightCategory, reason: 'individual-auto-finalize' });
      }
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [state.status, state.result, state.resultConfirmed, state.id, state.config?.competitionMode, state.config?.trainingMode, savedMatchId, dispatch, state.matchNumber, state.tournamentId, state.weightCategory]);

  useEffect(() => {
    if (!autoFinalizeRef.current || state.status !== 'finished' || !state.result || !state.resultConfirmed || savedMatchId === state.id) return;
    void handleSaveMatch();
  }, [state.resultConfirmed, state.status, state.result, state.id, savedMatchId, handleSaveMatch]);

  // Global top-bar SAVE uses the exact same official persistence path as
  // the SAVE MATCH button. It only opens the existing confirmation dialog;
  // the actual write still goes through handleSaveMatch/persistSavedMatch.
  useEffect(() => {
    const onGlobalSave = () => {
      if (state.status === 'finished' && state.result && state.resultConfirmed) {
        setShowSaveConfirm(true);
      } else if (state.status === 'finished' && state.result && !state.resultConfirmed) {
        toast.info(lang === 'ar' ? 'أكد النتيجة الرسمية أولاً من MAIN REFEREE ثم اضغط SAVE.' : 'Confirm the official result from MAIN REFEREE first, then press SAVE.');
      } else {
        toast.info(lang === 'ar' ? 'أكمل المباراة أولاً ثم اضغط SAVE.' : 'Finish the match first, then press SAVE.');
      }
    };
    window.addEventListener('wab-save-match', onGlobalSave);
    return () => window.removeEventListener('wab-save-match', onGlobalSave);
  }, [state.status, state.result, lang]);

  // Match persistence is explicit: FINISHED is not SAVED. The SAVE MATCH
  // action below is the single entry point that persists the record, updates
  // tournament data, advances the bracket, and unlocks NEXT MATCH.

  // Sync state to realtime — ONE persistent channel, subscribed once, reused
  // for every update. Recreating a channel on every state change (which used
  // to happen here, since state changes every second from the timer alone)
  // meant constantly opening and tearing down a Realtime connection — wasteful
  // at best, and a real source of instability/dropped connections for judges
  // (including the standalone Android Side Judge app) at worst.
  const syncChannelRef = useRef<any>(null);
  useEffect(() => {
    const channel = getChannel('match-sync');
    channel.subscribe();
    syncChannelRef.current = channel;
    return () => { teardownChannel(channel); syncChannelRef.current = null; };
    // See the judge-votes effect above — connMode must be a dependency so a
    // mode switch actually reopens this channel on the new transport instead
    // of silently continuing to broadcast match state on the old one.
  }, [connMode]);
  useEffect(() => {
    syncChannelRef.current?.send({ type: 'broadcast', event: 'match-state', payload: state });
  }, [state]);


  // Pool MVP ("أفضل لاعب في البولة") — unlike REVEAL_MVP (pure, synchronous,
  // computed from this match's own state), this needs a Supabase read
  // across every match in the tournament, so it can't live in the reducer.
  // Fetch here, then dispatch the plain result with SET_POOL_MVP.
  const handleRevealPoolMvp = useCallback(async () => {
    if (!state.tournamentId || isLocalTournamentId(state.tournamentId) || poolMvpLoading) return;
    setPoolMvpLoading(true);
    try {
      const { data, error } = await supabase
        .from('pool_player_stats')
        .select('*')
        .eq('tournament_id', state.tournamentId);
      if (error || !data) { toast.error('تعذّر جلب إحصائيات البولة'); return; }
      const { best, fairPlay } = pickPoolMvp(data);
      if (!best && !fairPlay) { toast.error('لا توجد بيانات بولة بعد لهذه البطولة'); return; }
      dispatch({
        type: 'SET_POOL_MVP',
        poolMvpReveal: {
          best: best ? { teamName: best.team_name, name: best.player_name, photo: best.photo || undefined, nationality: best.nationality || undefined, playerNumber: best.player_number ?? undefined, points: best.total_points, gamjeom: best.total_gamjeom, matchesPlayed: best.matches_played } : undefined,
          fairPlay: fairPlay ? { teamName: fairPlay.team_name, name: fairPlay.player_name, photo: fairPlay.photo || undefined, nationality: fairPlay.nationality || undefined, playerNumber: fairPlay.player_number ?? undefined, points: fairPlay.total_points, gamjeom: fairPlay.total_gamjeom, matchesPlayed: fairPlay.matches_played } : undefined,
          ts: Date.now(),
        },
      });
    } finally {
      setPoolMvpLoading(false);
    }
  }, [state.tournamentId, poolMvpLoading, dispatch]);

  // KEYBOARD SHORTCUTS
  useEffect(() => {
    if (editingKey) return;
    const reverseMap: Record<string, string> = {};
    Object.entries(keyMap).forEach(([action, key]) => { const normalized = String(key); reverseMap[normalized.toLowerCase()] = action; });

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      // Enter/Return must never trigger an in-match action (Start/Pause,
      // Kyeshi, Reset...), even if an older saved keyMap in this browser's
      // localStorage still has it assigned from before this fix — it is
      // reserved for the app's opening screen only.
      if (e.key === 'Enter' || e.key === 'Return') return;
      const key = e.key.toLowerCase();
      const action = reverseMap[key];
      if (!action) return;
      e.preventDefault();
      
      const scoreMatch = action.match(/^(chung|hong)_(punch|trunk_kick|head_kick|turning_kick|turning_head|gamjeom)$/);
      if (scoreMatch && state.ptgActive) return;
      if (scoreMatch) {
        const [, player, type] = scoreMatch;
        if (type === 'gamjeom') sounds.gamjeom(); else sounds.scoreSound(type as ScoreType);
        dispatch({ type: 'ADD_SCORE', player: player as PlayerColor, scoreType: type as ScoreType });
        return;
      }
      if (action === 'chung_undo') { dispatch({ type: 'REMOVE_SCORE', player: 'chung' }); return; }
      if (action === 'hong_undo') { dispatch({ type: 'REMOVE_SCORE', player: 'hong' }); return; }
      if (action === 'start_pause') { handleStart(); return; }
      if (action === 'kyeshi') { handleKyeshi(); return; }
      if (action === 'doctor') { dispatch({ type: 'DOCTOR_CALL' }); return; }
      if (action === 'ivr_chung') { handleIVR('chung'); return; }
      if (action === 'ivr_hong') { handleIVR('hong'); return; }
      if (action === 'reset') { dispatch({ type: 'RESET' }); setWinnerCountdown(null); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.status, state.timeRemaining, savedTime, keyMap, editingKey]);

  useEffect(() => {
    if (state.status === 'waiting') autoFinalizeRef.current = false;
  }, [state.status, state.id]);

  const handleStart = () => {
    if (state.status === 'waiting') {
      // Shijak starts the match directly — no per-match intro. The intro
      // video is for app launch only (SplashScreen), not every Shijak press.
      dispatch({ type: 'START' });
    } else if (state.status === 'paused') {
      if (state.awaitingRoundStart) {
        // INTRO is an app-launch experience only. Never replay it between
        // rounds. Normal 1v1 rounds start immediately; Par Équipe keeps its
        // existing inter-round player-call preparation without the intro.
        if (state.config?.competitionMode === 'par_equipe') {
          dispatch({ type: 'PREPARE_NEXT_ROUND_CALL' });
        } else {
          dispatch({ type: 'START_NEXT_ROUND' });
        }
      } else dispatch({ type: 'RESUME' });
    } else if (state.status === 'fighting') dispatch({ type: 'PAUSE' });
  };

  const handleKyeshi = () => {
    if (state.status === 'fighting' || state.status === 'paused') {
      setSavedTime(state.timeRemaining);
    }
    dispatch({ type: 'SET_KYESHI' });
  };

  const handleResumeFromKyeshi = (fromSaved: boolean) => {
    if (fromSaved && savedTime !== null) {
      dispatch({ type: 'RESUME_FROM_KYESHI', resumeTime: savedTime });
    } else {
      dispatch({ type: 'RESUME_FROM_KYESHI' });
    }
    // Always clear savedTime here, including the "Continue Current" path —
    // otherwise a stale savedTime from this Kyeshi lingers and gets reused
    // incorrectly the next time Doctor Call auto-triggers Kyeshi.
    setSavedTime(null);
    setKyeshiResumeOption(false);
  };

  const [ivrRequester, setIvrRequester] = useState<PlayerColor | null>(null);

  const handleIVR = (color: PlayerColor) => {
    if (state[color].ivrQuota > 0) {
      setIvrRequester(color);
      dispatch({ type: 'SET_STATUS', status: 'ivr', ivrRequestedBy: color });
      setIvrDecision(null);
    }
  };

  const handleIVRDecision = (decision: 'accept' | 'reject') => {
    setIvrDecision(decision);
    if (decision === 'accept') {
      sounds.success();
      if (ivrRequester) dispatch({ type: 'IVR_ANIMATE', decision: 'accepted', side: ivrRequester });
    } else {
      sounds.error();
      // Rejected IVR → deduct one video-replay card from the requesting coach + log it.
      if (ivrRequester) dispatch({
        type: 'DECREMENT_IVR',
        player: ivrRequester,
        reason: 'Referee rejected the coach challenge',
      });
    }
    // Broadcast IVR decision to all screens
    (syncChannelRef.current ?? getChannel('match-sync')).send({
      type: 'broadcast',
      event: 'ivr-decision',
      payload: { decision, requester: ivrRequester },
    });
    // Clear animation flag after 3s so it can retrigger next time
    setTimeout(() => dispatch({ type: 'CLEAR_IVR_ANIMATE' }), 3000);
    dispatch({ type: 'SET_STATUS', status: 'paused' });
    setIvrRequester(null);
  };


  const handleKO = (winner: PlayerColor) => {
    // KO animation stores the WINNING side so every screen can render the
    // correct team colour/logo without having to infer the winner again.
    setKoAnimation(winner);
    sounds.ko();
    dispatch({ type: 'KO_ANIMATE', side: winner });
    setTimeout(() => {
      dispatch({ type: 'FINISH', winner, method: 'KO' });
      dispatch({ type: 'CLEAR_KO_ANIMATE' });
      setKoAnimation(null);
    }, 3000);
  };

  // Manually fires the golden-point cinematic on the public screen. The
  // button that calls this only shows up once a rest period has ended
  // (awaitingRoundStart), so the referee can announce the sudden-death
  // point right before pressing Start Round.
  const handleGoldenPoint = () => {
    sounds.success();
    dispatch({ type: 'GOLDEN_POINT_ANIMATE' });
    setTimeout(() => dispatch({ type: 'CLEAR_GOLDEN_POINT_ANIMATE' }), 4200);
  };

  const handleKomz = (player: PlayerColor, level: 1 | 2) => {
    const opponent: PlayerColor = player === 'chung' ? 'hong' : 'chung';
    dispatch({ type: 'ADD_SCORE', player, scoreType: 'gamjeom' });
    // Critical last-10-seconds rule is shared by BOTH 1v1 and Par Équipe.
    // A normal warning remains administrative (0 live-score points).
    // For a Gam-jeom decision, the configured critical value is applied only
    // when the clock is actually inside the final 10 seconds.
    const critical = isLast10Seconds && (state.config.last10SecondsRuleEnabled ?? true);
    const configuredCritical = state.config.last10SecondsGamjeomPoints ?? 2;
    const targetTotal = critical && (state.config.penaltyScheme ?? 'binary') === 'binary'
      ? configuredCritical
      : 1;
    const extra = Math.max(0, targetTotal - 1);
    if (extra > 0) {
      for (let i = 0; i < extra; i++) {
        dispatch({ type: 'ADD_SCORE', player: opponent, scoreType: 'punch' });
      }
    }
    sounds.gamjeom();
    setShowKomz(null);
  };

  const openRoundCorrection = (round: number) => {
    if (state.config.competitionMode === 'par_equipe') return;
    setCorrectionRound(round);
    dispatch({ type: 'START_ROUND_CORRECTION', targetRound: round });
    logAudit('round_correction_opened', `Match #${state.matchNumber ?? '—'} — Round ${round}`, { tournamentId: state.tournamentId, category: state.weightCategory });
  };
  const addCorrectionScore = (player: PlayerColor, scoreType: ScoreType) => {
    if (correctionRound == null) return;
    if (scoreType === 'gamjeom') sounds.gamjeom(); else sounds.scoreSound(scoreType);
    dispatch({ type: 'CORRECTION_ADD_SCORE', targetRound: correctionRound, player, scoreType });
  };
  const addCorrectionWarning = (player: PlayerColor, warningCount: 1 | 2, criticalLast10: boolean) => {
    if (correctionRound == null) return;
    dispatch({ type: 'CORRECTION_ADD_WARNING', targetRound: correctionRound, player, warningCount, criticalLast10 });
  };
  const finishRoundCorrection = () => {
    dispatch({ type: 'SHOW_UPDATED_ROUND_RESULT' });
    logAudit('round_correction_applied', `Match #${state.matchNumber ?? '—'} — Round ${correctionRound ?? '—'}`, { tournamentId: state.tournamentId, category: state.weightCategory });
    setCorrectionRound(null);
  };

  const confirmPlayerChange = (side: PlayerColor, name: string, player?: { photo?: string; nationality?: string; playerNumber?: number; seedNumber?: number }) => {
    dispatch({ type: 'CONFIRM_SUBSTITUTION', side, name, photo: player?.photo, nationality: player?.nationality, playerNumber: player?.playerNumber, seedNumber: player?.seedNumber });
    logAudit('player_change_confirmed', `Match #${state.matchNumber ?? '—'} — ${side.toUpperCase()} → ${name}`, { tournamentId: state.tournamentId, category: state.weightCategory });
  };

  const handleSkipRest = () => {
    if (state.status === 'rest') dispatch({ type: 'AWAITING_ROUND_START' });
  };

  const handleOpenScoreboard = () => {
    window.open('/scoreboard', 'scoreboard', 'popup=true,width=1920,height=1080');
  };

  // Match selector - load matches from DB
  const handleOpenMatchSelector = async () => {
    // Cloud first, but ALWAYS fall back to the local tournament/archive store.
    // This is what keeps NEXT MATCH usable on offline/local tournaments.
    try {
      const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
      const localTournaments = loadAllLocalTournaments();
      const merged = [...(data || []), ...localTournaments].filter((item, index, arr) => arr.findIndex(x => x.id === item.id) === index);
      setMatchSelectorData(error && merged.length === 0 ? localTournaments : merged);
    } catch {
      setMatchSelectorData(loadAllLocalTournaments());
    }
    try {
      const { data: matches, error } = await supabase.from('matches').select('*').order('finished_at', { ascending: false }).limit(100);
      if (!error && matches) setSavedMatchesData(matches);
      else {
        const local = loadAllLocalTournaments().flatMap(t => loadMatchesLocal(t.name));
        setSavedMatchesData(local.slice().sort((a,b) => String(b.finished_at || '').localeCompare(String(a.finished_at || ''))).slice(0,100));
      }
    } catch {
      const local = loadAllLocalTournaments().flatMap(t => loadMatchesLocal(t.name));
      setSavedMatchesData(local.slice().sort((a,b) => String(b.finished_at || '').localeCompare(String(a.finished_at || ''))).slice(0,100));
    }
    setShowMatchSelector(true);
  };

  // Cancel the current in-progress match: archive it as 'cancelled' (so it
  // still shows up in — and can be deleted from — the saved matches list),
  // then reset the board.
  const handleCancelMatch = async () => {
    if (!confirm('Cancel this match? It will be saved as Cancelled.')) return;
    if (state.config.trainingMode) {
      // Training mode never touches the official archive, cancelled or not.
      dispatch({ type: 'RESET' });
      sounds.error();
      return;
    }
    saveMatchLocal({
      id: crypto.randomUUID(),
      competition_name: state.competitionName || '',
      match_number: state.matchNumber || 0,
      weight_category: state.weightCategory || null,
      gender: state.gender || null,
      age_group: state.ageGroup || null,
      match_stage: state.matchStage || null,
      chung_name: state.chung.player.name,
      hong_name: state.hong.player.name,
      chung_club: state.chung.player.club || null,
      hong_club: state.hong.player.club || null,
      chung_score: state.chung.totalScore,
      hong_score: state.hong.totalScore,
      status: 'cancelled',
      winner: null,
    });
    await supabase.from('matches').insert({
      competition_name: state.competitionName || '',
      match_number: state.matchNumber || 0,
      mat_number: state.matNumber || null,
      weight_category: state.weightCategory || '',
      gender: state.gender || null,
      age_group: state.ageGroup || null,
      match_stage: state.matchStage || null,
      chung_name: state.chung.player.name,
      hong_name: state.hong.player.name,
      chung_nationality: state.chung.player.nationality,
      hong_nationality: state.hong.player.nationality,
      chung_score: state.chung.totalScore,
      hong_score: state.hong.totalScore,
      chung_gamjeom: state.chung.gamjeomCount,
      hong_gamjeom: state.hong.gamjeomCount,
      winner: null,
      win_method: 'cancelled',
      rounds_data: state.chung.scores.slice(0, state.config.rounds).map((s, i) => ({
        round: i + 1, chung: s.total, hong: state.hong.scores[i]?.total || 0,
      })) as any,
      status: 'cancelled',
      finished_at: new Date().toISOString(),
      config: state.config as any,
    }).then(() => {}, () => { /* already cached locally above */ });
    dispatch({ type: 'RESET' });
    sounds.error();
  };

  // The referee's vote counts as weight 2 (vs. 1 per side judge) — cast it
  // into the exact same weighted tally judges vote into, rather than
  // unilaterally deciding. If this vote alone reaches majority (e.g. no
  // judges connected), it resolves immediately, same as it always did.
  const castRefereeVote = (notif: JudgeNotification, decision: 'approve' | 'reject') => {
    const votes = { ...notif.votes, referee: { decision, weight: 2 } };
    const approveW = Object.values(votes).filter(v => v.decision === 'approve').reduce((s, v) => s + v.weight, 0);
    const rejectW = Object.values(votes).filter(v => v.decision === 'reject').reduce((s, v) => s + v.weight, 0);
    const totalW = 2 + activeJudgeCount;
    const majority = Math.floor(totalW / 2) + 1;
    getChannel('judge-votes').send({
      type: 'broadcast', event: 'score-vote-update',
      payload: { id: notif.id, voterId: 'referee', weight: 2, decision },
    });
    if (approveW >= majority || rejectW >= majority) {
      const approved = approveW >= majority;
      // Same idempotency guard as the channel handlers: a judge vote and
      // the referee's own click can race and both cross the majority
      // threshold for the same notif.id within the same instant.
      if (markVoteProcessed(notif.id)) {
        if (approved && !state.ptgActive) {
          dispatch({ type: 'ADD_SCORE', player: notif.player, scoreType: notif.type, addedBy: 'judge', judgeId: notif.judgeName });
          sounds.success();
        } else {
          sounds.error();
        }
        getChannel('judge-votes').send({
          type: 'broadcast', event: 'score-vote-result',
          payload: { id: notif.id, status: approved ? 'approved' : 'rejected', player: notif.player, type: notif.type, judgeName: notif.judgeName, refereeName },
        });
      }
      setJudgeNotifications(prev => prev.filter(n => n.id !== notif.id));
    } else {
      // Not decisive alone — leave it pending so judges can still weigh in;
      // update our own copy so the badge shows the referee's vote is in.
      setJudgeNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, votes } : n));
    }
  };
  const handleAcceptJudgeScore = (notif: JudgeNotification) => { if (!state.ptgActive) castRefereeVote(notif, 'approve'); };
  const handleRejectJudgeScore = (notif: JudgeNotification) => castRefereeVote(notif, 'reject');

  const isLast10Seconds = state.timeRemaining <= 10 && state.status === 'fighting';
  const chungRoundWins = state.roundWinners.filter(r => r.winner === 'chung').length;
  const hongRoundWins = state.roundWinners.filter(r => r.winner === 'hong').length;
  const handleSwapPlayers = () => {
    // "Reverse Screen" (KPNP PSS) — swaps everything for the two sides:
    // player identity, scores, gamjeom, IVR quota, and the score log —
    // not just the names, so nothing is left mis-attributed mid-match.
    dispatch({ type: 'SWAP_SIDES' });
  };

  const handleExportPDF = () => {
    if (!state.result) return;
    exportMatchPDF({
      competitionName: state.competitionName || 'WAB-TKD',
      matchNumber: state.matchNumber || 0,
      weightCategory: state.weightCategory || '',
      chungName: state.chung.player.name || 'CHUNG',
      hongName: state.hong.player.name || 'HONG',
      chungNationality: state.chung.player.nationality || '',
      hongNationality: state.hong.player.nationality || '',
      chungScore: state.chung.totalScore,
      hongScore: state.hong.totalScore,
      chungGamjeom: state.chung.gamjeomCount,
      hongGamjeom: state.hong.gamjeomCount,
      winner: state.result.winner,
      winMethod: state.result.method,
      rounds: state.chung.scores.slice(0, state.config.rounds).map((s, i) => {
        const rw = state.roundWinners.find(r => r.round === i + 1);
        const decisionNote = rw?.decisionType === 'WOOSE_GIROK' ? 'Decided by Woo-Se-Girok (3-judge panel)'
          : rw?.decisionType === 'AI_RECOMMENDATION' ? 'Decided by AI tie-break recommendation, confirmed by main referee'
          : undefined;
        return { round: i + 1, chung: s.total, hong: state.hong.scores[i]?.total || 0, decisionNote };
      }),
    });
  };

  const judgeUrl = `${window.location.origin}/judge?match=${state.id}`;

  // Generate QR when panel opens or match id changes
  useEffect(() => {
    if (!showJudgeLink) return;
    QRCode.toDataURL(judgeUrl, { width: 220, margin: 1, color: { dark: '#0b1220', light: '#ffffff' } })
      .then(setQrDataUrl).catch(() => setQrDataUrl(''));
    // Separate QR for the standalone Android "Side Judge" app — it scans a
    // JSON payload with the Supabase connection info, not a page URL, since
    // it's a different app entirely (not a webpage inside this one).
    const sjUrl = import.meta.env.VITE_SUPABASE_URL;
    const sjKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (sjUrl && sjKey) {
      QRCode.toDataURL(JSON.stringify({ url: sjUrl, key: sjKey }), { width: 220, margin: 1, color: { dark: '#0b1220', light: '#ffffff' } })
        .then(setSideJudgeQrDataUrl).catch(() => setSideJudgeQrDataUrl(''));
    }
  }, [showJudgeLink, judgeUrl]);

  // Local-network pairing QR — lets a judge scan instead of typing the
  // computer's IP/port by hand (which is fiddly and error-prone, especially
  // on a shared hotspot where the address can change between matches).
  useEffect(() => {
    if (!showJudgeLink || !wifiInfo || wifiInfo.ips.length === 0) { setWifiQrDataUrl(''); return; }
    QRCode.toDataURL(JSON.stringify({ mode: 'local', host: wifiInfo.ips[0], port: wifiInfo.port, token: wifiInfo.token }), { width: 220, margin: 1, color: { dark: '#0b1220', light: '#ffffff' } })
      .then(setWifiQrDataUrl).catch(() => setWifiQrDataUrl(''));
  }, [showJudgeLink, wifiInfo]);

  // Persist referee name
  useEffect(() => { localStorage.setItem('tkd-referee-name', refereeName); }, [refereeName]);

  const handleKeyCapture = (action: string) => {
    setEditingKey(action);
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      // Enter/Return is reserved for the app's opening screen only (skip
      // splash/intro) — it must never be assignable to an in-match action
      // like Start/Pause, or pressing Enter later would unexpectedly
      // start a match and re-trigger the round-start animation.
      if (e.key === 'Enter' || e.key === 'Return') {
        toast.error(lang === 'ar'
          ? 'زر Enter محجوز لبداية التطبيق فقط، لا يمكن استعماله هنا'
          : 'Enter is reserved for app startup and cannot be assigned here');
        setEditingKey(null);
        window.removeEventListener('keydown', handler);
        return;
      }
      const newKey = e.key === ' ' ? ' ' : e.key.toLowerCase();
      setKeyMap(prev => ({ ...prev, [action]: newKey }));
      setEditingKey(null);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('keydown', handler);
  };

  const KEY_LABELS: Record<string, string> = {
    'chung_punch': '🔵 Punch', 'chung_trunk_kick': '🔵 Body', 'chung_head_kick': '🔵 Head',
    'chung_turning_kick': '🔵 Turn Body', 'chung_turning_head': '🔵 Turn Head', 'chung_gamjeom': '🔵 Gamjeom', 'chung_undo': '🔵 Undo',
    'hong_punch': '🔴 Punch', 'hong_trunk_kick': '🔴 Body', 'hong_head_kick': '🔴 Head',
    'hong_turning_kick': '🔴 Turn Body', 'hong_turning_head': '🔴 Turn Head', 'hong_gamjeom': '🔴 Gamjeom', 'hong_undo': '🔴 Undo',
    'start_pause': '⏯ Start/Pause', 'kyeshi': '⚠ Kyeshi', 'doctor': '🏥 Doctor',
    'ivr_chung': '📹 IVR Blue', 'ivr_hong': '📹 IVR Red', 'reset': '🔄 Reset',
  };

  const displayKey = (key: string) => {
    if (key === ' ') return 'SPACE';
    if (key === 'escape') return 'ESC';
    return key.toUpperCase();
  };

  return (
    <div className={`main-referee-shell min-h-screen w-full max-w-full overflow-x-hidden gradient-dark flex flex-col ${mainRefereeFullScreen ? 'main-referee-shell--fullscreen' : ''}`}>
      {state.config.trainingMode && (
        <div className="w-full py-1 text-center text-[11px] font-black tracking-[0.3em] bg-[hsl(var(--warning))] text-black z-[60] relative">
          🎓 TRAINING MODE — NOT SAVED TO OFFICIAL ARCHIVE — وضع تدريب، ماكيتسجلش فالأرشيف الرسمي
        </div>
      )}
      <TournamentBar onSelectFinishedMatch={(matchNumber) => { setResultViewFocusMatch(matchNumber); setShowResultView(true); }} />
      <div className="w-full p-3 flex flex-col gap-3 flex-1 min-w-0">

        {/* Header */}
        <div className="panel p-3 flex items-center justify-between">
          <div>
            <h1 className="title-power text-sm">{t('operator')}</h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{state.competitionName || 'WAB-TKD'}</p>
          </div>
          <div className="text-center">
            <div className={`text-xs font-bold uppercase ${
              state.status === 'fighting' ? 'text-[hsl(var(--success))]' :
              state.status === 'paused' ? 'text-[hsl(var(--warning))]' :
              state.status === 'doctor' || state.status === 'kyeshi' ? 'text-[hsl(var(--destructive))]' :
              state.status === 'finished' ? 'text-[hsl(var(--gold))]' : 'text-[hsl(var(--muted-foreground))]'
            }`}>
              {state.status === 'fighting' ? t('fighting') : state.status === 'ivr' ? t('ivr') : 
               state.status === 'rest' ? t('rest') : state.status === 'paused' ? (state.awaitingRoundStart ? t('callPlayers') : t('paused')) :
               state.status === 'doctor' ? t('doctor') : state.status === 'kyeshi' ? t('kyeshi') : t(state.status as any)}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">{t('match')} {state.matchNumber || '---'} • {state.weightCategory || '---'}</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] flex items-center justify-center gap-1 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${activeJudgeCount > 0 ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--muted-foreground))]/40'}`} />
              {activeJudgeCount} {activeJudgeCount === 1 ? 'Judge' : 'Judges'} Connected
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {state.config?.competitionMode === 'par_equipe' && (
              <>
                <button
                  type="button"
                  onClick={() => setMainRefereeToolsOpen(true)}
                  className={`main-referee-tools-launcher flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[10px] font-black tracking-wide transition-all ${mainRefereeToolsOpen ? 'is-active' : ''}`}
                  title="PLAYER CALL / PLAYER CHANGE — MAIN REFEREE"
                  aria-label="Open Player Call and Player Change controls"
                  aria-pressed={mainRefereeToolsOpen}
                >
                  <Bell size={14}/>
                  <span className="hidden xl:inline">CALL / CHANGE</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMainRefereeTeamToolsOpen(true); setMainRefereeToolsOpen(true); }}
                  className="main-referee-team-call-launcher flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[10px] font-black tracking-wide transition-all"
                  title="TEAM CALL — MAIN REFEREE"
                  aria-label="Open Team Call controls"
                >
                  <Users size={14}/>
                  <span className="hidden xl:inline">TEAM CALL</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={toggleMainRefereeFullScreen}
              className={`main-referee-fullscreen-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black tracking-wide transition-all ${mainRefereeFullScreen ? 'is-active' : ''}`}
              title={mainRefereeFullScreen ? 'Exit full screen — ESC' : 'Open Main Referee full screen'}
            >
              {mainRefereeFullScreen ? <Minimize size={14}/> : <Maximize size={14}/>}
              {mainRefereeFullScreen ? 'EXIT FULL SCREEN' : 'VIEW ALL / FULL SCREEN'}
            </button>
            {state.config?.competitionMode !== 'par_equipe' && (() => {
              // The yellow state is reserved strictly for the Individual Player
              // Call cinematic being active on the Public Display. Other call
              // layers (MATCHUP / TEAM CALL / legacy markers) must not make this
              // control look active.
              const individualPlayerCallActive = Boolean(
                state.callScreenActive &&
                (state.singlePlayerCall || state.callAnimation?.phase === 'player')
              );

              return (
                <button
                  onClick={() => {
                    if (individualPlayerCallActive) {
                      // CANCEL CALL: stop only the active Individual Player Call
                      // visual. Match/player/score/timer/database data remain intact.
                      // The reducer also clears its timers/sequence state so no
                      // hidden Player Call can continue on the Public Display.
                      dispatch({ type: 'SET_CALL_CONTROL_WAITING' });
                      return;
                    }
                    // 1v1 only: start the exact Player Call cinematic on the
                    // Public Display. Par Équipe remains isolated.
                    // Guard: the reducer silently no-ops when the BLUE
                    // (chung) player has no name yet — previously this made
                    // the button look completely broken (no animation, no
                    // feedback, nothing changes). Surface it instead so the
                    // A call is valid even when the match was created without
                    // athlete metadata. The Player Call engine supplies the
                    // official corner placeholders: BLUE = CHUNG (청), RED = HONG (홍).
                    dispatch({ type: 'START_PLAYER_CALL_SEQUENCE' });
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-black transition-all ${
                    individualPlayerCallActive
                      ? 'bg-[#f2c14e] text-black shadow-[0_0_18px_rgba(242,193,78,.28)] hover:brightness-110'
                      : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                  }`}
                  title={individualPlayerCallActive ? 'إلغاء الاستدعاء — إخفاء الأنيميشن من شاشة الجمهور' : 'بدء استدعاء اللاعبين'}
                  aria-pressed={individualPlayerCallActive}
                >
                  <Bell size={13} />
                  {individualPlayerCallActive ? 'إلغاء الاستدعاء' : 'استدعاء اللاعبين'}
                </button>
              );
            })()}
            <button onClick={handleOpenMatchSelector}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--gold))]/15 border border-[hsl(var(--gold))]/35 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/25 transition-colors text-[10px] font-display font-black" title="NEXT MATCH — select the next bout">
              <SkipForward size={13} /> NEXT MATCH
            </button>
            <button onClick={handleOpenMatchSelector}
              className="p-1.5 rounded-lg bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/30 transition-colors" title={t('selectMatchTitle')}>
              <Search size={14} />
            </button>
            <button onClick={() => setShowResultView(true)}
              className="p-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors" title={t('resultLabel')}>
              <ClipboardList size={14} />
            </button>
            <button onClick={() => {
                const ok = exportHighlightMarkersCsv(state, (state.competitionName || 'match') + '-' + (state.matchNumber || ''));
                if (!ok) toast.info('لا توجد لحظات بارزة (ضربات رأس/قرارات فاصلة) بعد فهاد الماتش');
              }}
              className="p-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              title="تصدير لحظات بارزة (Highlight Markers) — ملف CSV لمونتاج الفيديو">
              <Film size={14} />
            </button>
            <button onClick={() => setShowMatchReplay(true)}
              className="p-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              title="إعادة عرض الماتش نقطة بنقطة (Match Replay)">
              <RotateCcw size={14} />
            </button>
            <button onClick={handleOpenScoreboard}
              className="p-1.5 rounded-lg bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/30 transition-colors" title={t('openScoreboardTitle')}>
              <Monitor size={14} />
            </button>
            <button onClick={() => setShowMiniPreview(s => !s)}
              className={`p-1.5 rounded-lg transition-colors ${
                showMiniPreview
                  ? 'bg-[hsl(var(--info))]/30 text-[hsl(var(--info))]'
                  : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`} title={t('livePreviewTitle')}>
              {showMiniPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button onClick={() => { setShowKeyboardMap(!showKeyboardMap); setShowKeyConfig(false); }}
              className="p-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors" title={t('keyboardShortcutsTitle')}>
              <Keyboard size={14} />
            </button>
            <button onClick={() => soundSettings.toggleMuted()}
              className={`p-1.5 rounded-lg transition-colors ${
                isMuted
                  ? 'bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))]'
                  : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`} title={isMuted ? t('unmuteSounds') : t('muteSounds')}>
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button onClick={() => setShowJudgeLink(!showJudgeLink)}
              className="p-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors" title={t('judgeLinkQrTitle')}>
              <QrCode size={14} />
            </button>
            <button onClick={handleSwapPlayers}
              className="p-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors" title={t('swapPlayers')}>
              <ArrowLeftRight size={14} />
            </button>
            <button onClick={() => dispatch({ type: state.testMode ? 'EXIT_TEST_MODE' : 'ENTER_TEST_MODE' })}
              className={`p-1.5 rounded-lg transition-colors ${
                state.testMode
                  ? 'bg-[hsl(var(--warning))]/30 text-[hsl(var(--warning))]'
                  : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`} title={state.testMode ? t('exitTestMode') : t('enterTestMode')}>
              <FlaskConical size={14} />
            </button>
            <div className="text-right">
              <div className="text-xs text-[hsl(var(--muted-foreground))]">{t('round')}</div>
              <div className="font-display font-bold text-[hsl(var(--primary))] text-lg">{state.currentRound}/{state.config.rounds}</div>
              <div className="mt-0.5 text-[10px] font-mono text-[hsl(var(--gold))]/90" title={t('activePointGapTitle')}>
                PTG: {state.config.pointGap}
              </div>
            </div>
          </div>
        </div>

        {/* Match strip — right below the header, right above the timer, so
            the referee always sees they're mid-tournament and how many
            matches have passed without leaving this screen. */}
        {refBracket && (
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0"><MatchStrip matches={refBracket} currentMatchId={state.bracketMatchId} /></div>
            {/* League standings toggle — only meaningful for round-robin
                tournaments (state.leagueStandings is only populated for
                those). Shows a live points/wins table on the audience
                screen, e.g. between matches, without leaving Operator. */}
            {state.leagueStandings && state.leagueStandings.length > 0 && (
              <button onClick={() => dispatch({ type: 'SET_SHOW_STANDINGS', show: !state.showStandings })}
                title="عرض/إخفاء ترتيب الدوري فشاشة الجمهور"
                className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition ${
                  state.showStandings ? 'bg-[hsl(var(--gold))]/20 border-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                }`}>
                <ListOrdered size={14} /> {state.showStandings ? 'إخفاء الترتيب' : 'الترتيب'}
              </button>
            )}
          </div>
        )}

        {/* Test Mode — equipment/software test; scoring here never touches the real record */}
        {state.testMode && (
          <div className="panel p-3 border-2 border-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10 animate-fade-in flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-black text-[hsl(var(--warning))] font-display font-black text-sm tracking-widest animate-pulse border-2 border-[hsl(var(--warning))]">
              <FlaskConical size={14} className="inline -mt-0.5 me-1" /> {t('testMode')}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">{t('testModeHint')}</div>
          </div>
        )}

        {/* PTG Active — referee confirmation banner (round ends only after confirm) */}
        {state.ptgActive && state.ptgWinner && (
          <div className="panel p-4 border-2 border-[hsl(var(--gold))] bg-[hsl(var(--gold))]/10 animate-fade-in">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-lg bg-black text-[hsl(var(--gold))] font-display font-black text-xl tracking-widest animate-pulse border-2 border-[hsl(var(--gold))]">
                  PTG
                </div>
                <div>
                  <div className="font-display font-black text-sm text-[hsl(var(--gold))]">
                    POINT GAP — Round {state.currentRound} frozen
                  </div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    Rule: gap ≥ {state.ptgValueAtTrigger ?? state.config.pointGap} pts •{' '}
                    Winner:{' '}
                    <span className={state.ptgWinner === 'chung' ? 'text-[hsl(var(--chung))] font-bold' : 'text-[hsl(var(--hong))] font-bold'}>
                      {state.ptgWinner === 'chung'
                        ? (state.chung.player.name || 'CHUNG')
                        : (state.hong.player.name || 'HONG')}
                    </span>
                  </div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                    Timer is paused. Confirm to record the round winner and start rest.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  onClick={() => { sounds.success(); dispatch({ type: 'CONFIRM_PTG' }); }}
                  className="px-4 py-2 rounded-lg bg-[hsl(var(--gold))] text-black font-display font-black text-sm flex items-center gap-2 active:scale-95">
                  <Check size={16} /> CONFIRM PTG &amp; END ROUND
                </button>
                <button
                  onClick={() => dispatch({ type: 'SKIP_PTG' })}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white border border-white/30 font-display font-black text-sm flex items-center gap-2 hover:bg-white/15 active:scale-95"
                  title="Skip PTG and continue the current round">
                  <FastForward size={16} /> SKIP PTG
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Individual round-tie AI analysis + WOO-SE-GIROK. Public display only reads shared state. */}
        {aiTiebreakerOpen && !state.result && (hasTieDecisionContext || isLiveRoundTie) && (() => {
          const tieRound = state.roundWinners.find(r => r.round === state.currentRound);
          const analysis = manualAiAnalysis || (hasTieDecisionContext ? analyzeTiebreaker(state, state.currentRound) : null);
          const details = tieRound?.tiebreakDetails || (state.result as any)?.tiebreakDetails || analysis?.details;
          const aiWinner = tieRound?.tiebreakDetails?.aiWinner || (state.result as any)?.tiebreakDetails?.aiWinner || analysis?.winner;
          const aiLabel = aiWinner === 'chung' ? 'BLUE' : aiWinner === 'hong' ? 'RED' : 'UNABLE TO DETERMINE';
          const votes = state.roundTieReview?.votes || {};
          const blueVotes = Object.values(votes).filter(v => v === 'chung').length;
          const redVotes = Object.values(votes).filter(v => v === 'hong').length;
          const allVoted = blueVotes + redVotes === 3;
          const majority = blueVotes >= 2 ? 'chung' : redVotes >= 2 ? 'hong' : null;
          const stat = (label: string, c?: number, h?: number) => <div className="rounded-lg border border-white/10 bg-black/20 p-2"><div className="text-[8px] text-white/50 uppercase tracking-wider">{label}</div><div className="grid grid-cols-2 gap-2 mt-1 text-xs font-black"><span className="text-[hsl(var(--chung))]">{c ?? '—'}</span><span className="text-[hsl(var(--hong))] text-right">{h ?? '—'}</span></div></div>;
          const JudgeCard = ({ id, role }: { id: 'left'|'center'|'right'; role: string }) => { const selected = votes[id]; const profile = girokJudges[id]; const armSrc = selected === 'chung' ? wooseGirokArmBlue : selected === 'hong' ? wooseGirokArmRed : null; return <div className={`girok-judge-card girok-frame-strong ${id === 'center' ? 'is-center' : ''} ${selected ? (selected === 'chung' ? 'is-voted-chung' : 'is-voted-hong') : ''}`}><div className="girok-judge-photo-wrap">{profile.photo ? <img src={profile.photo} alt="" className="girok-judge-photo"/> : <div className="girok-judge-photo-placeholder">{profile.name.slice(0,1).toUpperCase()}</div>}</div>{armSrc ? <img src={armSrc} alt="" className={`girok-judge-arms-voted ${selected==='chung'?'is-chung-arm':'is-hong-arm'}`}/> : <img src={wooseGirokArms} alt="" className="girok-judge-arms"/>}<div className="relative z-10"><div className="text-sm font-black text-white">{profile.name}</div><div className="text-[9px] tracking-[.2em] text-white/50 mt-1">{role}</div><div className="flex gap-2 mt-4"><button disabled={!!selected} onClick={() => castGirokVote(id,'hong')} className={`flex-1 px-3 py-2.5 rounded-lg border font-display font-black text-[11px] ${selected==='hong'?'bg-[hsl(var(--hong))] text-white':'bg-[hsl(var(--hong))]/15 text-[hsl(var(--hong))] border-[hsl(var(--hong))]/50'}`}>RED</button><button disabled={!!selected} onClick={() => castGirokVote(id,'chung')} className={`flex-1 px-3 py-2.5 rounded-lg border font-display font-black text-[11px] ${selected==='chung'?'bg-[hsl(var(--chung))] text-white':'bg-[hsl(var(--chung))]/15 text-[hsl(var(--chung))] border-[hsl(var(--chung))]/50'}`}>BLUE</button></div><div className="mt-2 text-[8px] font-black text-white/60">{selected ? (selected==='chung'?'DECISION · BLUE':'DECISION · RED') : 'WAITING FOR DECISION'}</div></div></div>; };
          return <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"><div className="w-full max-w-6xl max-h-[92vh] overflow-auto rounded-2xl border-2 border-[hsl(var(--gold))]/60 bg-[#090d14] shadow-2xl">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-center relative text-center"><div><div className="text-[hsl(var(--gold))] text-xs font-black tracking-[.35em]">AI TIEBREAKER</div><div className="text-white/60 text-[9px] tracking-[.25em] mt-1">ROUND {state.currentRound} — TIE / DECISION REQUIRED</div><div className="text-[9px] text-white/35 mt-2">WORLD TAEKWONDO · ARTICLE 15.5 SUPERIORITY ORDER · PSS = KPNP / DAE DO REGISTERED HITS</div></div><button onClick={() => setAiTiebreakerOpen(false)} className="absolute right-4 top-4 rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 hover:text-white" title="Close AI Tiebreaker"><X size={15}/></button></div>
            <div className="p-5"><div className="mb-5 rounded-xl border border-[hsl(var(--gold))]/20 bg-black/20 p-4">
                <div className="text-[10px] tracking-[.3em] text-[hsl(var(--gold))] font-black mb-3">JUDGE SETUP · MAIN REFEREE</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{(['left','center','right'] as const).map((id,i)=><div key={id} className="rounded-lg border border-white/10 p-3 bg-black/20"><div className="text-[9px] text-white/50 mb-2">{i===1?'CENTER / MAT REFEREE':'SIDE JUDGE'}</div><input value={girokJudges[id].name} onChange={e=>setGirokJudges(prev=>({...prev,[id]:{...prev[id],name:e.target.value}}))} onBlur={()=>dispatch({type:'SET_TIE_REVIEW_JUDGES',judgeNames:{left:girokJudges.left.name,center:girokJudges.center.name,right:girokJudges.right.name},judgePhotos:{left:girokJudges.left.photo,center:girokJudges.center.photo,right:girokJudges.right.photo}})} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none" placeholder="Judge name"/><label className="mt-2 block text-[9px] text-white/50 cursor-pointer"><span className="inline-block px-2 py-1 rounded bg-white/5">ADD JUDGE PHOTO</span><input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(!f)return; const reader=new FileReader(); reader.onload=()=>{const photo=String(reader.result); const next={...girokJudges,[id]:{...girokJudges[id],photo}}; setGirokJudges(next); dispatch({type:'SET_TIE_REVIEW_JUDGES',judgeNames:{left:next.left.name,center:next.center.name,right:next.right.name},judgePhotos:{left:next.left.photo,center:next.center.photo,right:next.right.photo}})}; reader.readAsDataURL(f)}}/></label></div>)}</div>
              </div>
              
              <div className="text-center text-4xl font-display font-black"><span className="text-[hsl(var(--chung))]">BLUE {state.chung.scores[state.currentRound-1]?.total ?? 0}</span><span className="text-white/30 mx-5">—</span><span className="text-[hsl(var(--hong))]">{state.hong.scores[state.currentRound-1]?.total ?? 0} RED</span></div>
              {!girokOpen && <><div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2">{stat('TURNING/SPIN POINTS',details?.chungTurningPoints,details?.hongTurningPoints)}{stat('HEAD HITS',details?.chungHeadKicks,details?.hongHeadKicks)}{stat('BODY HITS',details?.chungTrunkKicks,details?.hongTrunkKicks)}{stat('PUNCHES',details?.chungPunches,details?.hongPunches)}{stat('PSS HITS',details?.chungPssHits,details?.hongPssHits)}{stat('PENALTIES',details?.chungPenalties,details?.hongPenalties)}</div><div className="mt-5 rounded-xl border border-[hsl(var(--gold))]/30 bg-[hsl(var(--gold))]/5 p-5 text-center"><div className="text-[10px] tracking-[.3em] text-white/50">AI RECOMMENDATION</div><div className={`text-4xl font-display font-black mt-2 ${aiWinner==='chung'?'text-[hsl(var(--chung))]':aiWinner==='hong'?'text-[hsl(var(--hong))]':'text-white'}`}>{aiLabel}</div><div className="text-white/70 text-sm mt-2">CONFIDENCE {details?.aiConfidence ?? state.aiConfidence ?? 0}%</div><div className="mt-2 text-xs font-black"><span className="text-[hsl(var(--chung))]">BLUE {details?.aiScore?.chung ?? '—'}</span><span className="text-white/30 mx-2">—</span><span className="text-[hsl(var(--hong))]">{details?.aiScore?.hong ?? '—'} RED</span></div><div className="text-white/60 text-xs mt-3 max-w-2xl mx-auto">{details?.reason || state.aiReason || 'No clear advantage.'}</div><div className="mt-5 grid md:grid-cols-2 gap-3 text-left"><div className="rounded-xl border border-[hsl(var(--chung))]/35 bg-[hsl(var(--chung))]/[.06] p-4"><div className="text-[hsl(var(--chung))] text-[10px] font-black tracking-[.2em]">WHY BLUE</div><div className="mt-2 text-xs text-white/75 leading-relaxed">{details?.playerReasons?.chung || 'BLUE has no measurable advantage in the recorded round evidence.'}</div></div><div className="rounded-xl border border-[hsl(var(--hong))]/35 bg-[hsl(var(--hong))]/[.06] p-4"><div className="text-[hsl(var(--hong))] text-[10px] font-black tracking-[.2em]">WHY RED</div><div className="mt-2 text-xs text-white/75 leading-relaxed">{details?.playerReasons?.hong || 'RED has no measurable advantage in the recorded round evidence.'}</div></div></div><div className="mt-4 text-center text-[11px] font-black tracking-[.2em]">AI VERDICT: <span className={aiWinner==='chung'?'text-[hsl(var(--chung))]':aiWinner==='hong'?'text-[hsl(var(--hong))]':'text-white/70'}>{aiWinner==='chung'?'BLUE DESERVES THE ROUND':aiWinner==='hong'?'RED DESERVES THE ROUND':'REFEREE DECISION REQUIRED'}</span></div>{state.pendingRoundDecision && aiWinner && aiWinner !== 'referee_decision' && <button onClick={() => dispatch({type:'CONFIRM_AI_TIE_DECISION',winner:aiWinner})} className="mt-5 px-7 py-3 rounded-xl bg-[hsl(var(--gold))] !text-black font-display font-black">CONFIRM {aiWinner==='chung'?'BLUE':'RED'} AI DECISION</button>}</div><div className="mt-5 text-center"><div className="text-[10px] text-white/50 tracking-[.3em]">REFEREE DECISION REQUIRED</div><div className="mt-3 flex flex-wrap items-center justify-center gap-2">

{state.pendingRoundDecision && <><button disabled={state.config.roundTieWooSeGirokEnabled === false} onClick={openGirokSummons} className="px-9 py-4 rounded-xl bg-[hsl(var(--gold))] text-[#050505] font-display font-black border-2 border-[hsl(var(--gold))] shadow-[0_0_30px_hsl(var(--gold)/.55)] hover:brightness-110 disabled:opacity-30">⚖ WOO-SE-GIROK — 우세기록</button><button onClick={() => { sounds.winner(); dispatch({type:'RESOLVE_DRAW_ROUND',winner:'chung',decisionType:'WOOSE_GIROK',votes:state.roundTieReview?.votes}); setGirokOpen(false); }} className="px-7 py-3 rounded-xl border-2 border-[hsl(var(--chung))] bg-[hsl(var(--chung))]/15 text-[hsl(var(--chung))] font-display font-black">BLUE — ROUND WINNER</button><button onClick={() => { sounds.winner(); dispatch({type:'RESOLVE_DRAW_ROUND',winner:'hong',decisionType:'WOOSE_GIROK',votes:state.roundTieReview?.votes}); setGirokOpen(false); }} className="px-7 py-3 rounded-xl border-2 border-[hsl(var(--hong))] bg-[hsl(var(--hong))]/15 text-[hsl(var(--hong))] font-display font-black">RED — ROUND WINNER</button></>}
</div></div></>}
              {girokOpen && <div className="relative mt-2 min-h-[560px] overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_50%,rgba(255,190,30,.12),transparent_34%),linear-gradient(180deg,#090d14_0%,#030509_100%)] p-6"><div className="absolute inset-0 pointer-events-none"><div className="girok-sweep girok-sweep-one"/><div className="girok-sweep girok-sweep-two"/><div className="girok-particle p1"/><div className="girok-particle p2"/><div className="girok-particle p3"/></div><img src={wooseGirokArms} alt="WOO-SE-GIROK referee arms" className="absolute left-1/2 bottom-[-2%] -translate-x-1/2 w-[96%] max-w-[1500px] h-auto select-none pointer-events-none girok-arms-image"/><div className="relative z-10 text-center girok-center-content"><div className="text-[hsl(var(--gold))] text-[11px] font-black tracking-[.5em]">우세기록</div><div className="girok-gold-title font-display text-4xl md:text-5xl girok-title-between-arms">WOO-SE-GIROK</div>{girokStage===0 && <button onClick={startGirokCountdown} className="mt-12 px-8 py-4 rounded-xl bg-white text-black font-display font-black">START COUNTDOWN</button>}{girokCounting && girokStage>=1 && girokStage<=3 && <div key={girokStage} className="mt-12"><div className="girok-count-number">{girokStage}</div><div className="girok-count-name">{[['',''],['1','HANA — 하나'],['2','DUL — 둘'],['3','SET — 셋']][girokStage][1]}</div></div>}{!girokCounting && girokStage===4 && <><div className="mt-8 text-xs tracking-[.3em] text-[hsl(var(--gold))] font-black">THREE REFEREES</div><div className="grid grid-cols-3 gap-3 mt-5"><JudgeCard id="left" role="SIDE JUDGE"/><JudgeCard id="center" role="CENTER / MAT REFEREE"/><JudgeCard id="right" role="SIDE JUDGE"/></div>{allVoted && <div className={`mt-5 girok-decision-frame relative overflow-hidden p-5 text-center ${majority==='chung'?'is-chung':'is-hong'}`}><img src={majority==='chung'?wooseGirokArmBlue:wooseGirokArmRed} alt="" className="girok-decision-arm"/><div className="relative z-10"><div className="girok-gold-title font-display text-lg md:text-xl">MAJORITY DECISION</div><div className={`mt-3 text-4xl md:text-5xl font-display font-black ${majority==='chung'?'text-[hsl(var(--chung))]':'text-[hsl(var(--hong))]'}`}>{majority==='chung'?'BLUE':'RED'} WINS</div><div className="mt-1 text-2xl font-display font-black text-white/80">{blueVotes} — {redVotes}</div><button onClick={() => { sounds.winner(); dispatch({type:'RESOLVE_DRAW_ROUND',winner:majority!,decisionType:'WOOSE_GIROK',votes}); }} className="mt-5 px-8 py-3 rounded-xl bg-[hsl(var(--gold))] text-black font-display font-black shadow-[0_0_30px_hsl(var(--gold)/.35)]">CENTER REFEREE CONFIRM FINAL DECISION</button></div></div>}</>}</div></div>}
            </div></div></div>;
        })()}

        {/* Substitute Player (Par Équipe) — REQUEST_SUBSTITUTION already
            flips status to 'paused' the instant it's dispatched (whether
            requested between rounds or mid-fight), so pendingSubstitution
            is never seen alongside status 'fighting' — the confirm dialog
            below always has the clock already stopped. */}
        {state.pendingSubstitution && (() => {
          const subSide = state.pendingSubstitution.side;
          const isBlue = subSide === 'chung';
          const accent = isBlue ? '#33a2ff' : '#ff2b39';
          const teamName = state.teamNames?.[subSide] || state[subSide].player.club || (isBlue ? 'BLUE TEAM' : 'RED TEAM');
          const current = state[subSide].player;
          const roster = state.teamRoster?.[subSide] ?? [];
          return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92 p-3 md:p-6 backdrop-blur-xl">
              <div className="relative w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-2xl border-2 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.05),transparent_32%),#070a10] p-4 md:p-6 shadow-[0_30px_120px_rgba(0,0,0,.85)]" style={{ borderColor: `${accent}88`, boxShadow: `0 0 60px ${accent}18, 0 30px 120px rgba(0,0,0,.85)` }}>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <div className="font-display text-2xl md:text-3xl font-black tracking-[.12em]" style={{ color: accent }}>PLAYER CHANGE</div>
                    <div className="mt-1 text-sm font-black text-white">{teamName}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[.22em] text-white/45">SELECT THE ATHLETE WHO WILL ENTER THIS ROUND</div>
                  </div>
                  <div className="rounded-xl border px-4 py-2 text-center" style={{ borderColor: `${accent}55`, background: `${accent}0d` }}>
                    <div className="text-[9px] font-black tracking-[.2em]" style={{ color: accent }}>{isBlue ? 'BLUE' : 'RED'} TEAM</div>
                    <div className="mt-1 text-xs font-black text-white">ROUND {state.currentRound} · {state.weightCategory || '—'}</div>
                  </div>
                </div>

                <div className="mb-5 grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-4">
                  <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                    <div className="mb-3 text-[9px] font-black tracking-[.2em] text-white/45">CURRENT PLAYER · LEAVING</div>
                    <div className="flex items-center gap-4">
                      <div className="h-28 w-24 shrink-0 overflow-hidden rounded-xl border-2 bg-black" style={{ borderColor: `${accent}66` }}>
                        {current.photoUrl || current.photo ? <img src={current.photoUrl || current.photo} alt="" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-3xl font-black text-white/25">?</div>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xl font-black text-white truncate">{current.name || 'CURRENT PLAYER'}</div>
                        <div className="mt-2 text-xs text-white/55">NO. {current.playerNumber || '—'} · {current.nationality || '—'}</div>
                        <div className="mt-3 inline-flex rounded-full border px-3 py-1 text-[9px] font-black tracking-[.16em]" style={{ borderColor: `${accent}66`, color: accent, background: `${accent}10` }}>PLAYER OUT</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-[9px] font-black tracking-[.2em] text-white/45">SELECT NEW PLAYER · ENTERING</div>
                      <span className="text-[9px] font-black" style={{ color: accent }}>{roster.length} PLAYERS</span>
                    </div>
                    {roster.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {roster.map((p, i) => {
                          const isCurrent = p.name === current.name;
                          return (
                            <button key={`${p.name}-${i}`} type="button" disabled={isCurrent || !!state.substitutionAnimation} onClick={() => { confirmPlayerChange(subSide, p.name, p); setSubInputName(''); }} className="group rounded-xl border p-2 text-left transition-all disabled:opacity-25" style={{ borderColor: `${accent}45`, background: `${accent}08` }}>
                              <div className="flex items-center gap-2">
                                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg border bg-black" style={{ borderColor: `${accent}55` }}>
                                  {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-lg font-black text-white/25">{(p.name || '?').slice(0,1)}</div>}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-black text-white">{p.name}</div>
                                  <div className="mt-1 text-[9px] text-white/45">NO. {p.playerNumber || '—'} · {p.nationality || '—'}</div>
                                  <div className="mt-2 text-[8px] font-black tracking-[.12em]" style={{ color: accent }}>{isCurrent ? 'CURRENT' : 'SELECT PLAYER'}</div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-xs text-white/45">No roster players available. Enter the new player's name below.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-2 text-[9px] font-black tracking-[.2em] text-white/45">MANUAL PLAYER ENTRY</div>
                  <input autoFocus value={subInputName} onChange={e => setSubInputName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && subInputName.trim() && state.pendingSubstitution) { const side = state.pendingSubstitution.side; confirmPlayerChange(side, subInputName.trim()); setSubInputName(''); } }} placeholder="NEW PLAYER NAME" className="w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-lg font-black text-white outline-none focus:border-white/35" />
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button onClick={() => { dispatch({ type: 'CANCEL_SUBSTITUTION' }); setSubInputName(''); }} className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-black text-white/70 hover:bg-white/10">CANCEL</button>
                  <button disabled={!subInputName.trim()} onClick={() => { if (!state.pendingSubstitution) return; const side = state.pendingSubstitution.side; confirmPlayerChange(side, subInputName.trim()); setSubInputName(''); }} className="rounded-xl px-6 py-3 text-sm font-black text-black disabled:opacity-30" style={{ background: accent }}>CONFIRM PLAYER CHANGE</button>
                </div>
              </div>
            </div>
          );
        })()}


        {/* Judge Score Notifications */}
        {judgeNotifications.length > 0 && (
          <div className="space-y-2">
            {judgeNotifications.map(notif => (
              <div key={notif.id} className="panel p-3 border-2 border-[hsl(var(--gold))]/50 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[hsl(var(--gold))] font-display text-xs font-bold">📋 Judge Request</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{notif.judgeName}</span>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {(Object.values(notif.votes) as any[]).reduce((s, v) => s + Number(v?.weight || 0), 0)}/{2 + activeJudgeCount} weight
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={notif.player === 'chung' ? 'text-[hsl(var(--chung))]' : 'text-[hsl(var(--hong))]'}>
                      {SCORE_ICONS[notif.type]} {SCORE_LABELS[notif.type]} → {notif.player.toUpperCase()}
                    </span>
                    <button onClick={() => handleAcceptJudgeScore(notif)}
                      className="p-1.5 rounded-lg bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] active:scale-95">
                      <Check size={16} />
                    </button>
                    <button onClick={() => handleRejectJudgeScore(notif)}
                      className="p-1.5 rounded-lg bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] active:scale-95">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Match Selector Modal — with delete + quick-create form */}
        {showMatchSelector && (
          <div className="panel p-4 border-2 border-[hsl(var(--primary))]/30 animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-[hsl(var(--primary))]">🔍 Quick Match / Saved Tournaments</h3>
              <button onClick={() => setShowMatchSelector(false)} className="text-xs text-[hsl(var(--muted-foreground))]">✕</button>
            </div>

            {/* Quick match form */}
            <div className="rounded-lg p-3 bg-[hsl(var(--secondary))]/30 border border-[hsl(var(--gold))]/30">
              <div className="font-display text-[11px] font-bold text-[hsl(var(--gold))] mb-2 tracking-wider">⚡ QUICK MATCH</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder={t('tournamentNamePlaceholder')}
                  defaultValue={state.competitionName || ''}
                  className="col-span-2 px-2 py-1.5 rounded bg-[hsl(var(--background))] text-xs border border-[hsl(var(--border))]"
                  onBlur={e => dispatch({ type: 'SET_MATCH_INFO', competitionName: e.target.value })}
                />
                <input
                  placeholder={t('weightPlaceholder')}
                  defaultValue={state.weightCategory || ''}
                  className="px-2 py-1.5 rounded bg-[hsl(var(--background))] text-xs border border-[hsl(var(--border))]"
                  onBlur={e => dispatch({ type: 'SET_MATCH_INFO', weightCategory: e.target.value })}
                />
                <input
                  placeholder={t('categoryPlaceholder')}
                  defaultValue={state.ageGroup || ''}
                  className="px-2 py-1.5 rounded bg-[hsl(var(--background))] text-xs border border-[hsl(var(--border))]"
                  onBlur={e => dispatch({ type: 'SET_MATCH_INFO', ageGroup: e.target.value })}
                />
                <select
                  defaultValue={state.gender || 'male'}
                  className="px-2 py-1.5 rounded bg-[hsl(var(--background))] text-xs border border-[hsl(var(--border))]"
                  onChange={e => dispatch({ type: 'SET_MATCH_INFO', gender: e.target.value as 'male' | 'female' })}
                >
                  <option value="male">{t('menLabel')}</option>
                  <option value="female">{t('womenLabel')}</option>
                </select>
                <input
                  type="number"
                  placeholder={t('matchNumberPlaceholder')}
                  defaultValue={state.matchNumber || ''}
                  className="px-2 py-1.5 rounded bg-[hsl(var(--background))] text-xs border border-[hsl(var(--border))]"
                  onBlur={e => dispatch({ type: 'SET_MATCH_INFO', matchNumber: parseInt(e.target.value) || 0 })}
                />
                <select
                  defaultValue={state.matchStage || ''}
                  className="col-span-2 px-2 py-1.5 rounded bg-[hsl(var(--background))] text-xs border border-[hsl(var(--border))]"
                  onChange={e => dispatch({ type: 'SET_MATCH_INFO', matchStage: (e.target.value || undefined) as MatchStage | undefined })}
                  title={t('matchStage')}
                >
                  <option value="">{t('matchStage')}…</option>
                  {(Object.keys(MATCH_STAGE_LABELS) as MatchStage[]).map(stage => (
                    <option key={stage} value={stage}>{MATCH_STAGE_LABELS[stage][lang === 'ar' ? 'ar' : 'en']}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder={t('matNumberPlaceholder')}
                  value={state.matNumber || ''}
                  readOnly={!!getAssignedMatNumber()}
                  className="px-2 py-1.5 rounded bg-[hsl(var(--background))] text-xs border border-[hsl(var(--border))] read-only:opacity-60"
                  onChange={e => { if (!getAssignedMatNumber()) dispatch({ type: 'SET_MATCH_INFO', matNumber: parseInt(e.target.value) || undefined }); }}
                  title={getAssignedMatNumber() ? 'Assigned to this computer in Admin' : t('matNumber')}
                />
              </div>
              <button
                onClick={() => { dispatch({ type: 'RESET' }); setShowMatchSelector(false); sounds.success(); }}
                className="w-full mt-2 px-3 py-1.5 rounded bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] font-bold text-xs">
                ✓ Apply &amp; Reset Match
              </button>
            </div>

            {/* Saved tournaments */}
            <div>
              <div className="font-display text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-2 tracking-wider">📚 SAVED TOURNAMENTS</div>
              {matchSelectorData.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-3">{t('noTournamentsYet')}</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {matchSelectorData.map(tn => (
                    <div key={tn.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))]/50">
                      <button onClick={() => {
                        dispatch({ type: 'SET_MATCH_INFO', competitionName: tn.name, weightCategory: tn.weight_category });
                        setShowMatchSelector(false);
                      }}
                        className="flex-1 text-left text-sm hover:text-[hsl(var(--primary))] transition-colors">
                        <div className="font-semibold text-[hsl(var(--foreground))]">{tn.name}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">{tn.gender === 'male' ? 'M' : 'F'} • {tn.weight_category} • {tn.format}</div>
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete tournament "${tn.name}"?`)) return;
                          await supabase.from('tournaments').delete().eq('id', tn.id);
                          setMatchSelectorData(prev => prev.filter(x => x.id !== tn.id));
                          sounds.error();
                        }}
                        className="p-1.5 rounded bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/30"
                        title={t('deleteTournamentTitle')}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Matches — archive of finished AND cancelled matches, all types */}
            <div className="mt-4">
              <div className="font-display text-[11px] font-bold text-[hsl(var(--muted-foreground))] mb-2 tracking-wider">📋 SAVED MATCHES</div>
              {savedMatchesData.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-3">{t('noSavedMatchesYet')}</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {savedMatchesData.map(m => (
                    <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))]/50">
                      <div className="flex-1 text-left text-sm min-w-0">
                        <div className="font-semibold text-[hsl(var(--foreground))] truncate flex items-center gap-1.5">
                          {m.status === 'cancelled' ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))]">{t('cancelledLabel')}</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]">{t('finished')}</span>
                          )}
                          {m.chung_name || '—'} vs {m.hong_name || '—'}
                        </div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                          {m.competition_name} • #{m.match_number} • {m.weight_category}
                          {m.status !== 'cancelled' && <> • {m.chung_score}-{m.hong_score} • {m.winner === 'chung' ? m.chung_name : m.hong_name} won ({m.win_method})</>}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm('Delete this saved match permanently?')) return;
                          await supabase.from('matches').delete().eq('id', m.id);
                          setSavedMatchesData(prev => prev.filter(x => x.id !== m.id));
                          sounds.error();
                        }}
                        className="p-1.5 rounded bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/30 shrink-0"
                        title={t('deleteMatchTitle')}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}


        {/* Keyboard shortcuts panel */}
        {showKeyboardMap && (
          <div className="panel p-3 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <Keyboard size={14} className="text-[hsl(var(--primary))]" />
              <span className="font-display text-xs text-[hsl(var(--primary))] font-bold">{t('keyboardShortcutsTitle')}</span>
              <button onClick={() => setShowKeyConfig(true)} className="ms-auto text-xs px-2 py-1 rounded bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-semibold flex items-center gap-1">
                <Settings2 size={10} /> Customize
              </button>
              <button onClick={() => setShowKeyboardMap(false)} className="text-xs text-[hsl(var(--muted-foreground))]">✕</button>
            </div>
            {!showKeyConfig ? (
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="space-y-1">
                  <div className="font-bold text-[hsl(var(--chung))]">{t('chungBlueLabel')}</div>
                  {['chung_punch', 'chung_trunk_kick', 'chung_head_kick', 'chung_turning_kick', 'chung_turning_head', 'chung_gamjeom', 'chung_undo'].map(k => (
                    <div key={k}><kbd className="px-1 rounded bg-[hsl(var(--secondary))]">{displayKey(keyMap[k])}</kbd> {KEY_LABELS[k]?.replace('🔵 ', '')}</div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-[hsl(var(--hong))]">{t('hongRedLabel')}</div>
                  {['hong_punch', 'hong_trunk_kick', 'hong_head_kick', 'hong_turning_kick', 'hong_turning_head', 'hong_gamjeom', 'hong_undo'].map(k => (
                    <div key={k}><kbd className="px-1 rounded bg-[hsl(var(--secondary))]">{displayKey(keyMap[k])}</kbd> {KEY_LABELS[k]?.replace('🔴 ', '')}</div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-[hsl(var(--gold))]">{t('controlsLabel')}</div>
                  {['start_pause', 'kyeshi', 'doctor', 'ivr_chung', 'ivr_hong', 'reset'].map(k => (
                    <div key={k}><kbd className="px-1 rounded bg-[hsl(var(--secondary))]">{displayKey(keyMap[k])}</kbd> {KEY_LABELS[k]?.replace(/^[^ ]+ /, '')}</div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2">{t('clickKeyToReassign')}</p>
                {Object.entries(KEY_LABELS).map(([action, label]) => (
                  <div key={action} className="flex items-center justify-between text-xs py-1">
                    <span className="text-[hsl(var(--foreground))]">{label}</span>
                    <button onClick={() => handleKeyCapture(action)}
                      className={`px-3 py-1 rounded font-mono text-sm min-w-[60px] text-center transition-all ${
                        editingKey === action 
                          ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] animate-pulse' 
                          : 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--primary))]/20'
                      }`}>
                      {editingKey === action ? '...' : displayKey(keyMap[action] || '')}
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setKeyMap({ ...DEFAULT_KEY_MAP })} className="text-xs px-3 py-1 rounded bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))]">{t('resetDefaultsLabel')}</button>
                  <button onClick={() => setShowKeyConfig(false)} className="text-xs px-3 py-1 rounded bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]">{t('doneLabel')}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Judge Link Panel + QR + Referee name */}
        {showJudgeLink && (
          <div className="panel p-3 animate-fade-in space-y-3">
            <div className="flex items-center gap-2">
              <Link2 size={14} className="text-[hsl(var(--primary))]" />
              <span className="font-display text-xs text-[hsl(var(--primary))] font-bold">{t('judgeConnection')}</span>
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-start">
              {qrDataUrl && (
                <div className="p-2 rounded-lg bg-white flex-shrink-0">
                  <img src={qrDataUrl} alt={t('judgeMatchQrAlt')} className="w-[180px] h-[180px] block" />
                </div>
              )}
              <div className="flex-1 w-full space-y-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('matchLinkLabel')}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input readOnly value={judgeUrl} className="flex-1 px-3 py-1.5 rounded bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] text-xs border border-[hsl(var(--border))]" />
                    <button onClick={() => { navigator.clipboard.writeText(judgeUrl); sounds.click(); }}
                      className="px-3 py-1.5 rounded bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] text-xs font-semibold">
                      {t('copy')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('mainRefereeNameLabel')}</label>
                  <input value={refereeName} onChange={e => setRefereeName(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] text-xs border border-[hsl(var(--border))]" />
                </div>

                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  Judges scan the QR (or open the link) to connect to this exact match. Approve/reject decisions are broadcast with your name.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Side Judge Android app — separate standalone app, connects via
            Supabase directly rather than opening a page inside this app. */}
        {showJudgeLink && (
          <div className="panel p-3 animate-fade-in space-y-3">
            <div className="flex items-center gap-2">
              <QrCode size={14} className="text-[hsl(var(--gold))]" />
              <span className="font-display text-xs text-[hsl(var(--gold))] font-bold">{t('sideJudgeAppConnectionLabel')}</span>
            </div>
            {sideJudgeQrDataUrl ? (
              <div className="flex flex-col md:flex-row gap-3 items-start">
                <div className="p-2 rounded-lg bg-white flex-shrink-0">
                  <img src={sideJudgeQrDataUrl} alt={t('sideJudgeQrAlt')} className="w-[180px] h-[180px] block" />
                </div>
                <div className="flex-1 w-full space-y-2">
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {t('sideJudgeAppInstructions')}
                  </p>
                  <button onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify({ url: import.meta.env.VITE_SUPABASE_URL, key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }));
                      sounds.click();
                    }}
                    className="px-3 py-1.5 rounded bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] text-xs font-semibold">
                    {t('copyConnectionJsonLabel')}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                Cloud sync isn't configured (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing), so there's no
                connection info to encode yet.
              </p>
            )}
          </div>
        )}

        {/* Which transport judge phones connect through. This governs the
            Wi-Fi panel below — Internet mode instead relies on the
            separate in-browser /judge page and Supabase Realtime. */}
        {showJudgeLink && (
          <div className="panel p-3 animate-fade-in space-y-2">
            <span className="font-display text-xs text-[hsl(var(--muted-foreground))] font-bold uppercase tracking-wide">{t('judgeConnectionModeLabel')}</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => handleSetConnMode('internet')}
                className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-semibold ${connMode === 'internet' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'}`}>
                <Link2 size={13} /> Internet
              </button>
              <button onClick={() => handleSetConnMode('wifi')}
                className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-semibold ${connMode === 'wifi' ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'}`}>
                <Wifi size={13} /> Local Wi-Fi
              </button>
            </div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {connMode === 'internet' ? 'Both this computer and every judge phone need internet access.'
                : 'No internet needed — just the same Wi-Fi network or a hotspot from this computer.'}
            </p>
          </div>
        )}

        {/* Whether a side judge's submitted score needs the referee's
            (weighted majority) approval before it counts, or is applied
            the instant the judge presses it. Live-toggleable — doesn't
            reset or pause the match. */}
        {showJudgeLink && (
          <div className="panel p-3 animate-fade-in space-y-2">
            <span className="font-display text-xs text-[hsl(var(--muted-foreground))] font-bold uppercase tracking-wide">{t('sideJudgeScoresLabel')}</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => dispatch({ type: 'UPDATE_CONFIG', config: { autoApproveJudgeScores: false } })}
                className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-semibold ${!state.config.autoApproveJudgeScores ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'}`}>
                <Shield size={13} /> Require Approval
              </button>
              <button
                onClick={() => dispatch({ type: 'UPDATE_CONFIG', config: { autoApproveJudgeScores: true } })}
                className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-semibold ${state.config.autoApproveJudgeScores ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'}`}>
                <FastForward size={13} /> Auto-Approve
              </button>
            </div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {state.config.autoApproveJudgeScores
                ? 'A judge\'s score is added to the scoreboard the instant they submit it — no vote, no notification.'
                : 'A judge\'s score needs the weighted majority (referee + connected judges) to approve it, same as today.'}
            </p>
          </div>
        )}

        {/* Local Network (Wi-Fi) judge connections — offline, no internet.
            Judges just type this computer's address into their phone, or
            scan the QR code below. */}
        {showJudgeLink && connMode === 'wifi' && (
          <div className="panel p-3 animate-fade-in space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Wifi size={14} className="text-[hsl(var(--success))]" />
              <span className="font-display text-xs text-[hsl(var(--success))] font-bold">{t('localNetworkJudgeConnLabel')}</span>
              {wifiStatus && (
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  wifiStatus.state === 'listening' ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]'
                  : wifiStatus.state === 'error' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    wifiStatus.state === 'listening' ? 'bg-[hsl(var(--success))]' : wifiStatus.state === 'error' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'
                  }`} />
                  {wifiStatus.state === 'listening' ? 'Server ready' : wifiStatus.state === 'error' ? 'Server error — retrying' : 'Starting…'}
                </span>
              )}
              {wifiStatus?.state === 'error' && (
                <button
                  onClick={async () => {
                    setWifiRestarting(true);
                    sounds.click();
                    await localWifi.restartServer();
                    setWifiInfo(await localWifi.getServerInfo());
                    setWifiRestarting(false);
                  }}
                  disabled={wifiRestarting}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-semibold hover:bg-red-500/25 disabled:opacity-50"
                >
                  <FastForward size={10} /> {wifiRestarting ? 'Restarting…' : 'Restart connection'}
                </button>
              )}
            </div>
            {wifiStatus?.state === 'error' && wifiStatus.error && (
              <p className="text-[10px] text-red-400">{wifiStatus.error}</p>
            )}
            {!wifiInfo || wifiInfo.ips.length === 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  No Wi-Fi network detected on this computer yet. This computer isn't an access point by itself — it needs to
                  either join the venue's Wi-Fi, or turn ON its own mobile hotspot (its Wi-Fi radio then broadcasts a network
                  judge phones can join directly, with zero internet). Judge phones never need internet either way — only a
                  network in common with this computer.
                </p>
                <div className="flex gap-2">
                  {(window as any).electronAPI && (
                    <button onClick={async () => { await localWifi.openHotspotSettings(); sounds.click(); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] text-xs font-semibold">
                      <Wifi size={12} /> Open Hotspot Settings
                    </button>
                  )}
                  <button onClick={async () => { setWifiInfo(await localWifi.getServerInfo()); sounds.click(); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] text-xs font-semibold">
                    <FastForward size={12} /> Re-check
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  On each judge's phone: open the Side Judge app, choose "Local Network", then either scan the QR code
                  below or type in the address manually and tap Connect.
                </p>
                <div className="flex flex-col md:flex-row gap-3 items-start">
                  {wifiQrDataUrl && (
                    <div className="p-2 rounded-lg bg-white flex-shrink-0">
                      <img src={wifiQrDataUrl} alt={t('localNetworkPairingQrAlt')} className="w-[140px] h-[140px] block" />
                    </div>
                  )}
                  <div className="flex-1 w-full space-y-1">
                    {wifiInfo.ips.map(ip => (
                      <div key={ip} className="px-3 py-2 rounded bg-[hsl(var(--secondary))] text-center">
                        <span className="font-mono text-sm font-bold text-[hsl(var(--success))]">{ip}:{wifiInfo.port}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="px-3 py-2 rounded bg-amber-500/10 border border-amber-500/25">
                  <div className="text-[10px] text-amber-300 font-semibold mb-1">PAIRING TOKEN</div>
                  <div className="font-mono text-xs break-all text-amber-200 select-all">{wifiInfo.token}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">This token changes every time WAB-TKD starts. Use the QR code or enter it in the Side Judge app.</div>
                </div>
                {wifiInfo.ips.length > 1 && (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    Multiple network adapters detected — the QR/first address is used; if it doesn't connect, try another one from the list manually.
                  </p>
                )}
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  This address updates automatically if the network changes (new Wi-Fi, new DHCP lease, hotspot toggled) — no need to refresh manually.
                </p>
                {wifiJudges.length > 0 && (
                  <div className="space-y-1.5">
                    {wifiJudges.map(j => (
                      <div key={j.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))]" />
                        <span className="text-xs text-[hsl(var(--success))] font-semibold">{j.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Timer + Controls */}
        <div className="panel p-4 flex flex-col items-center">
          {state.config.goldenRound && state.isGoldenRound && state.status !== 'rest' && (
            <div className="flex items-center gap-1.5 mb-2 px-4 py-1.5 rounded-full bg-[hsl(var(--gold))]/20 border-2 border-[hsl(var(--gold))] animate-pulse">
              <Trophy size={14} className="text-[hsl(var(--gold))]" />
              <span className="font-display font-black text-sm text-[hsl(var(--gold))] tracking-widest uppercase">
                Golden Point — 2 Points / 2 Gam-jeoms
              </span>
            </div>
          )}
          <div className={`timer-display text-5xl ${
            state.timeRemaining <= 10 && state.status === 'fighting' ? 'text-[hsl(var(--destructive))] animate-pulse' :
            state.status === 'rest' ? 'text-[hsl(var(--info))]' : 'text-[hsl(var(--foreground))]'
          }`}>{formatTime(state.timeRemaining)}</div>

          {state.config.goldenRound && state.status === 'paused' && state.awaitingRoundStart && state.isGoldenRound && (
            <button onClick={handleGoldenPoint}
              className="flex items-center gap-1.5 mt-2 px-4 py-1.5 rounded-full bg-[hsl(var(--gold))]/20 border-2 border-[hsl(var(--gold))] text-[hsl(var(--gold))] font-display font-black text-sm tracking-widest hover:bg-[hsl(var(--gold))]/30 transition-colors">
              <Trophy size={14} /> {t('goldenPointButton')}
            </button>
          )}

          {/* Manual escape hatch for the golden-point cinematic on the public
              screen — visible any time it's currently playing (automatic
              "round starts" trigger or the manual button above), so the
              referee can dismiss it immediately instead of waiting out the
              full ~4s, or if it ever needs to be cut short. */}
          {state.config.goldenRound && !!state.goldenPointAnimation && (
            <button onClick={() => dispatch({ type: 'CLEAR_GOLDEN_POINT_ANIMATE' })}
              className="flex items-center gap-1.5 mt-2 px-4 py-1.5 rounded-full bg-[hsl(var(--muted))] border-2 border-[hsl(var(--gold))]/60 text-[hsl(var(--gold))] font-display font-black text-sm tracking-widest hover:bg-[hsl(var(--muted))]/70 transition-colors">
              <X size={14} /> {t('endGoldenPointAnimation')}
            </button>
          )}

          {state.status === 'paused' && !state.awaitingRoundStart && (
            <div className="flex items-center gap-2 mt-1 px-4 py-1.5 rounded-lg bg-[hsl(var(--warning))]/20 border border-[hsl(var(--warning))]/40">
              <Clock size={14} className="text-[hsl(var(--warning))]" />
              <span className="text-sm font-display font-bold text-[hsl(var(--warning))]">{t('paused')}</span>
            </div>
          )}

          {state.status === 'kyeshi' && savedTime !== null && (
            <div className="flex items-center gap-2 mt-1">
              <Clock size={12} className="text-[hsl(var(--warning))]" />
              <span className="text-xs text-[hsl(var(--warning))] font-display">Match time saved: {formatTime(savedTime)}</span>
            </div>
          )}

          {isLast10Seconds && (
            <div className="text-xs text-[hsl(var(--destructive))] font-display font-bold animate-pulse mt-1">
              ⚡ {t('last10sec')}
            </div>
          )}

          <div className="flex items-center gap-3 mt-3">
            {(state.status === 'waiting' || state.status === 'paused') && (
              <button onClick={handleStart} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] font-semibold text-sm">
                <Play size={16} /> {state.status === 'waiting' ? t('shijak') : state.awaitingRoundStart ? `${t('startRound')} ${state.currentRound + 1}` : t('resume')}
              </button>
            )}
            {canManuallyChangePlayer(state, 'hong') && (
              <button onClick={() => dispatch({ type: 'REQUEST_SUBSTITUTION', side: 'hong' })} disabled={!!state.pendingSubstitution}
                title="Change RED player mid-round"
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[hsl(var(--hong))]/15 text-[hsl(var(--hong))] font-semibold text-sm border border-[hsl(var(--hong))]/40 disabled:opacity-30">
                <UserCheck size={14} /> تغيير لاعب أحمر
              </button>
            )}
            {state.status === 'fighting' && (
              <>
              <button onClick={() => { if (window.confirm(lang === 'ar' ? 'إيقاف المباراة فورًا؟' : 'Emergency pause the match now?')) { logAudit('emergency_pause', 'Emergency match pause'); dispatch({ type: 'PAUSE' }); } }} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[hsl(var(--destructive))]/25 text-[hsl(var(--destructive))] font-black text-sm border border-[hsl(var(--destructive))]/50">
                <AlertTriangle size={16} /> EMERGENCY PAUSE
              </button>
              <button onClick={() => dispatch({ type: 'PAUSE' })} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] font-semibold text-sm">
                <Pause size={16} /> {t('kallyeo')}
              </button>
              </>
            )}
            {isLiveRoundTie && (
              <button onClick={() => { setManualAiAnalysis(analyzeTiebreaker(state, state.currentRound)); setAiTiebreakerOpen(true); }}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))] font-display font-black text-sm border border-[hsl(var(--gold))]/40 hover:bg-[hsl(var(--gold))]/25 transition-colors animate-pulse"
                title="Analyze the tied current round with AI">
                🤖 AI TIE ANALYSIS
              </button>
            )}
            {state.status === 'kyeshi' && (
              <div className="flex gap-2">
                <button onClick={() => handleResumeFromKyeshi(true)} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] font-semibold text-sm">
                  <Play size={16} /> Resume ({savedTime !== null ? formatTime(savedTime) : ''})
                </button>
                <button onClick={() => handleResumeFromKyeshi(false)} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-semibold text-xs">
                  <SkipForward size={14} /> Continue Current
                </button>
              </div>
            )}
            {(state.status === 'doctor' || state.status === 'ivr') && state.status !== 'ivr' && (
              <button onClick={() => {
                // KPNP PSS behavior: ending a Doctor call automatically starts
                // Kyeshi (injury time), rather than dropping straight back to
                // Time Out — the referee then ends Kyeshi when ready.
                const used = state.kyeshiUsedThisRound || 0;
                const kyeshiRemaining = Math.max(0, state.config.kyeshiTime - used);
                if (kyeshiRemaining > 0) {
                  dispatch({ type: 'SET_KYESHI' });
                } else if (savedTime !== null) {
                  dispatch({ type: 'SET_STATE', state: { ...state, status: 'paused', timeRemaining: savedTime } });
                  setSavedTime(null);
                } else dispatch({ type: 'RESUME' });
              }} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] font-semibold text-sm animate-pulse">
                <Play size={16} /> {t('resume')}
              </button>
            )}
            <button onClick={handleKyeshi}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] font-semibold text-sm">
              <AlertTriangle size={14} /> {t('kyeshi')}
            </button>
            <button onClick={() => { if (state.status === 'fighting' || state.status === 'paused') setSavedTime(state.timeRemaining); dispatch({ type: 'DOCTOR_CALL' }); }}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] font-semibold text-sm">
              <Stethoscope size={14} /> {t('doctor')}
            </button>
            {canManuallyChangePlayer(state, 'chung') && (
              <button onClick={() => dispatch({ type: 'REQUEST_SUBSTITUTION', side: 'chung' })} disabled={!!state.pendingSubstitution}
                title="Change BLUE player mid-round"
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[hsl(var(--chung))]/15 text-[hsl(var(--chung))] font-semibold text-sm border border-[hsl(var(--chung))]/40 disabled:opacity-30">
                <UserCheck size={14} /> تغيير لاعب أزرق
              </button>
            )}
            {state.pendingRoundDecision && !state.result && state.config.competitionMode !== 'par_equipe' && (
              <button onClick={() => { setManualAiAnalysis(null); setAiTiebreakerOpen(true); }}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[hsl(var(--gold))] text-[#050505] font-display font-black text-sm border-2 border-[hsl(var(--gold))] shadow-[0_0_22px_hsl(var(--gold)/.45)] hover:brightness-110">
                <Brain size={15} /> AI TIEBREAKER
              </button>
            )}
            {state.status === 'rest' && state.roundCorrectionReview && state.timeRemaining === 0 && (
              <button onClick={() => dispatch({ type: 'START_CORRECTION_REST' })}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] border border-[hsl(var(--gold))]/50 font-display font-black text-sm">
                <Clock size={14} /> START BREAK AGAIN
              </button>
            )}
            {state.status === 'rest' && !state.roundCorrectionReview && (
              <button onClick={handleSkipRest}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[hsl(var(--info))]/20 text-[hsl(var(--info))] font-semibold text-sm">
                <FastForward size={14} /> Skip Rest
              </button>
            )}
            {state.config.competitionMode !== 'par_equipe' && state.status === 'rest' && !state.pendingRoundDecision && state.roundWinners.length > 0 && !state.roundCorrection?.active && (
              <button onClick={() => openRoundCorrection(state.roundWinners[state.roundWinners.length - 1]?.round || 1)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))] font-semibold text-sm border border-[hsl(var(--gold))]/35">
                <RotateCcw size={14} /> تصحيح جولة
              </button>
            )}
          </div>

          {state.roundCorrectionReview && !state.roundCorrection?.active && (
            <div className="mt-3 w-full rounded-2xl border border-[hsl(var(--gold))]/40 bg-[hsl(var(--gold))]/[.06] p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-black text-[hsl(var(--gold))]">ROUND CORRECTION APPLIED · REST RESET</div>
                  <div className="text-[10px] text-white/55 mt-1">Public Display is back on LIVE MATCH / REST at 00:00. Press START BREAK AGAIN to restart the official break. The corrected winner is shown only after that break finishes.</div>
                </div>
                {state.status === 'rest' && state.timeRemaining === 0 && (
                  <button onClick={() => dispatch({ type: 'START_CORRECTION_REST' })} className="px-4 py-2 rounded-xl bg-[hsl(var(--gold))] text-black font-black text-xs">START BREAK AGAIN</button>
                )}
              </div>
            </div>
          )}

          {state.roundCorrection?.active && correctionRound !== null && state.config.competitionMode !== 'par_equipe' && (
            <div className="mt-3 w-full rounded-2xl border-2 border-[hsl(var(--gold))]/50 bg-black/70 p-4 shadow-[0_0_35px_rgba(242,193,78,.12)]">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-sm font-black text-[hsl(var(--gold))]">تصحيح جولة — ROUND {correctionRound}</div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))]">التعديل لا يشغل الوقت ولا يبدأ جولة جديدة. ويمكن تسجيل مخالفة حدثت في آخر 10 ثوانٍ حتى لو لم يتوقف الوقت؛ لا يلزم تحديد الثانية الدقيقة.</div>
                </div>
                <button onClick={() => { dispatch({ type: 'CANCEL_ROUND_CORRECTION' }); setCorrectionRound(null); }} className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white/60"><X size={14}/></button>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {state.roundWinners.map(r => (
                  <button key={r.round} onClick={() => openRoundCorrection(r.round)} className={`rounded-lg border px-3 py-1.5 text-xs font-black ${correctionRound === r.round ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]' : 'border-white/15 text-white/70'}`}>R{r.round}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(['chung','hong'] as PlayerColor[]).map(player => {
                  const accent = player === 'chung' ? 'hsl(var(--chung))' : 'hsl(var(--hong))';
                  const name = state[player].player.name || (player === 'chung' ? 'BLUE' : 'RED');
                  return <div key={player} className="rounded-xl border p-3" style={{ borderColor: `${accent}55` }}>
                    <div className="text-center font-black text-sm mb-2" style={{ color: accent }}>{name}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['punch','trunk_kick','head_kick','turning_kick','turning_head','manual'] as ScoreType[]).map(type => {
                        const pts = type === 'turning_head' ? (state.config.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints) : SCORE_VALUES[type];
                        return <button key={type} onClick={() => addCorrectionScore(player,type)} className="rounded-lg border border-white/10 bg-white/[.04] px-2 py-2 text-[10px] font-black text-white hover:bg-white/[.08]">+{pts}</button>;
                      })}
                      <button onClick={() => addCorrectionScore(player,'gamjeom')} className="rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 px-2 py-2 text-[10px] font-black text-[hsl(var(--warning))]">GAM-JEOM +1</button>
                      <button onClick={() => addCorrectionWarning(player,1,false)} className="rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 px-2 py-2 text-[10px] font-black text-[hsl(var(--warning))]">إنذار ×1</button>
                      <button onClick={() => addCorrectionWarning(player,2,true)} className="rounded-lg border border-[hsl(var(--destructive))]/40 bg-[hsl(var(--destructive))]/10 px-2 py-2 text-[10px] font-black text-[hsl(var(--destructive))]">إنذار ×2 · آخر 10ث</button>
                    </div>
                  </div>;
                })}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] p-3">
                <div className="text-sm font-black">النتيجة الجديدة: {state.chung.scores[correctionRound-1]?.total || 0} - {state.hong.scores[correctionRound-1]?.total || 0}</div>
                <button onClick={finishRoundCorrection} className="rounded-xl bg-[hsl(var(--gold))] px-4 py-2 text-xs font-black text-black">إظهار النتيجة الجديدة</button>
              </div>
            </div>
          )}

          {/* Komz Penalty Buttons */}
          <div className="flex gap-2 mt-2">
            <button onClick={() => setShowKomz(showKomz === 'chung' ? null : 'chung')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] font-semibold text-xs border border-[hsl(var(--warning))]/30">
              <Shield size={12} /> {t('komz')} → {t('blue')}
            </button>
            <button onClick={() => setShowKomz(showKomz === 'hong' ? null : 'hong')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] font-semibold text-xs border border-[hsl(var(--warning))]/30">
              <Shield size={12} /> {t('komz')} → {t('red')}
            </button>
          </div>

          {/* Komz decision panel */}
          {showKomz && (
            <div className="mt-2 p-3 rounded-lg border-2 border-[hsl(var(--warning))]/50 bg-[hsl(var(--warning))]/10 w-full max-w-md animate-fade-in">
              <div className="text-center font-display text-sm text-[hsl(var(--warning))] mb-2">
                {isLast10Seconds ? `⚡ ${t('criticalDecisionMode')}` : t('komz')} — {showKomz.toUpperCase()} {t('penalties')}
              </div>
              <div className="flex gap-2 justify-center">
                {(state.config.penaltyScheme ?? 'binary') === 'single' ? (
                  <button onClick={() => handleKomz(showKomz, 1)}
                    className="px-4 py-2 rounded-lg bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] font-semibold text-sm border border-[hsl(var(--destructive))]/40 active:scale-95">
                    {t('komzSingle')}
                  </button>
                ) : (
                  <>
                    <button onClick={() => handleKomz(showKomz, 1)}
                      className="px-4 py-2 rounded-lg bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] font-semibold text-sm border border-[hsl(var(--warning))]/40 active:scale-95">
                      {t('komz1')}
                    </button>
                    {isLast10Seconds && (state.config.last10SecondsRuleEnabled ?? true) && (state.config.last10SecondsGamjeomPoints ?? 2) > 1 && (
                      <button onClick={() => handleKomz(showKomz, 2)}
                        className="px-4 py-2 rounded-lg bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] font-semibold text-sm border border-[hsl(var(--destructive))]/40 active:scale-95 animate-pulse">
                        {t('komz2')}
                      </button>
                    )}
                  </>
                )}
              </div>
              <button onClick={() => setShowKomz(null)} className="w-full text-xs text-[hsl(var(--muted-foreground))] mt-2">{t('cancel')}</button>
            </div>
          )}

          {/* IVR / Video Replay coach cards — one chip per remaining challenge; deducted on reject */}
          <div className="flex items-center gap-3 mt-2">
            {(['chung', 'hong'] as PlayerColor[]).map(color => {
              const quota = state[color].ivrQuota;
              const total = state.config.ivrQuota;
              const isChung = color === 'chung';
              return (
                <button key={color} onClick={() => handleIVR(color)} disabled={quota <= 0 || state.status === 'ivr'}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-xs border disabled:opacity-30 active:scale-95 transition-all ${
                    isChung
                      ? 'bg-[hsl(var(--chung))]/15 text-[hsl(var(--chung))] border-[hsl(var(--chung))]/40'
                      : 'bg-[hsl(var(--hong))]/15 text-[hsl(var(--hong))] border-[hsl(var(--hong))]/40'
                  }`}>
                  <Video size={12} />
                  <span>IVR {isChung ? t('blue') : t('red')}</span>
                  <span className="flex items-center gap-1 ms-1" aria-label={`${quota} cards left`}>
                    {Array.from({ length: Math.max(total, quota) }, (_, i) => (
                      <span key={i} className={`inline-block w-3 h-4 rounded-sm border ${
                        i < quota
                          ? isChung
                            ? 'bg-[hsl(var(--chung))] border-white/60 shadow-[0_0_6px_hsl(var(--chung)/0.7)]'
                            : 'bg-[hsl(var(--hong))] border-white/60 shadow-[0_0_6px_hsl(var(--hong)/0.7)]'
                          : 'bg-transparent border-white/20'
                      }`} />
                    ))}
                  </span>
                  <span className="tabular-nums opacity-80">({quota}/{total})</span>
                </button>
              );
            })}
          </div>

          {/* IVR Decision Panel with Accept/Reject */}
          {state.status === 'ivr' && (
            <div className="mt-3 p-3 rounded-lg border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 w-full max-w-md">
              <div className="text-center font-display text-sm text-[hsl(var(--primary))] mb-2">
                📹 {t('ivr')} — VIDEO REPLAY
                {ivrRequester && (
                  <span className={`ms-2 px-2 py-0.5 rounded text-xs ${ivrRequester === 'chung' ? 'bg-[hsl(var(--chung))]/25 text-[hsl(var(--chung))]' : 'bg-[hsl(var(--hong))]/25 text-[hsl(var(--hong))]'}`}>
                    Requested by {ivrRequester.toUpperCase()}
                  </span>
                )}
              </div>
              {ivrDecision === null ? (
                <div className="flex gap-2 justify-center">
                  <button onClick={() => handleIVRDecision('accept')}
                    className="px-6 py-3 rounded-lg bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] font-semibold text-lg flex items-center gap-2 active:scale-95">
                    <Check size={20} /> ACCEPT
                  </button>
                  <button onClick={() => handleIVRDecision('reject')}
                    className="px-6 py-3 rounded-lg bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] font-semibold text-lg flex items-center gap-2 active:scale-95">
                    <X size={20} /> REJECT
                  </button>
                </div>
              ) : (
                <div className={`text-center font-display text-lg font-bold ${ivrDecision === 'accept' ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'}`}>
                  {ivrDecision === 'accept' ? '✓ ACCEPTED' : '✗ REJECTED'}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-2 flex-wrap justify-center">
            {state.status !== 'finished' && state.status !== 'waiting' && (
              <button onClick={() => dispatch({ type: 'END_ROUND' })}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-semibold text-xs">
                <SkipForward size={12} /> {t('endRound')}
              </button>
            )}
            {state.status === 'paused' && (
              <>
                <button onClick={() => handleKO('chung')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--chung))]/20 text-[hsl(var(--chung))] font-semibold text-xs border border-[hsl(var(--chung))]/30">
                  <Zap size={12} /> KO → {t('blue')}
                </button>
                <button onClick={() => handleKO('hong')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--hong))]/20 text-[hsl(var(--hong))] font-semibold text-xs border border-[hsl(var(--hong))]/30">
                  <Zap size={12} /> KO → {t('red')}
                </button>
              </>
            )}
            {state.status === 'finished' && (
              <button onClick={handleExportPDF}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] font-semibold text-xs">
                <FileText size={12} /> {t('exportPDF')}
              </button>
            )}
            <button onClick={() => {
                const tournamentId = state.status === 'finished' ? state.tournamentId : undefined;
                dispatch({ type: 'RESET' });
                setSavedMatchId(null);
                setWinnerCountdown(null);
                if (tournamentId) navigate('/tournament', { state: { continueTournamentId: tournamentId } });
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] font-semibold text-xs">
              <RotateCcw size={12} /> {t('reset')}
            </button>
          </div>
        </div>

        {/* Calling next players — Par Équipe "rotation" mode announces who's
            entering for the upcoming round before it starts, each in a
            frame colored for their side, with VS between them. */}
        {state.awaitingRoundStart && state.teamMode === 'rotation' && state.teamRoster && (() => {
          const nextIdx = state.currentRound; // 0-based index of the round about to start
          const nextChung = getRotationEntryForRound(state.teamRoster!.chung, nextIdx);
          const nextHong = getRotationEntryForRound(state.teamRoster!.hong, nextIdx);
          return (
            <div className="panel p-4 border-2 border-[hsl(var(--gold))]/40">
              <div className="text-center text-xs font-display font-bold text-[hsl(var(--gold))] uppercase tracking-widest mb-3">
                {t('callPlayers')} — {t('round')} {state.currentRound + 1}
              </div>
              <div className="flex items-center justify-center gap-4">
                <div className="flex-1 max-w-[220px] text-center p-3 rounded-xl border-2 border-[hsl(var(--chung))]/60 bg-[hsl(var(--chung))]/10">
                  <div className="text-[10px] font-bold uppercase text-[hsl(var(--chung))]">CHUNG (청)</div>
                  <div className="font-display font-bold text-[hsl(var(--foreground))] mt-1 truncate">{nextChung?.name || 'TBD'}</div>
                  {nextChung?.nationality && <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{nextChung.nationality}</div>}
                </div>
                <div className="font-display font-black text-lg text-[hsl(var(--muted-foreground))]">VS</div>
                <div className="flex-1 max-w-[220px] text-center p-3 rounded-xl border-2 border-[hsl(var(--hong))]/60 bg-[hsl(var(--hong))]/10">
                  <div className="text-[10px] font-bold uppercase text-[hsl(var(--hong))]">HONG (홍)</div>
                  <div className="font-display font-bold text-[hsl(var(--foreground))] mt-1 truncate">{nextHong?.name || 'TBD'}</div>
                  {nextHong?.nationality && <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{nextHong.nationality}</div>}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Reveal Team Winner — Par Équipe "rotation": every roster player on
            both teams has now played all their rounds. The match freezes
            here (no result yet) until the operator presses this button,
            which computes the winner by total point difference and
            broadcasts the reveal to the public screen. */}
        {state.awaitingTeamReveal && (
          <div className="panel p-4 border-2 border-[hsl(var(--gold))]/50 text-center space-y-2">
            <div className="font-display font-bold text-sm text-[hsl(var(--gold))] uppercase tracking-widest">
              انتهت جولات جميع اللاعبين
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              🔵 {state.teamNames?.chung || 'CHUNG'}: {state.chung.totalScore} — {state.hong.totalScore} :{state.teamNames?.hong || 'HONG'} 🔴
            </div>
            <button onClick={() => dispatch({ type: 'REVEAL_TEAM_RESULT' })}
              className="w-full py-3 rounded-xl gradient-gold text-[hsl(var(--accent-foreground))] font-display font-bold text-lg active:scale-95 transition-all">
              🏆 إظهار الفريق الفائز
            </button>
          </div>
        )}

        {state.pendingTeamFinalDecision && !state.result && (
          <div className="panel p-4 border-2 border-[hsl(var(--gold))]/60 text-center space-y-3">
            <div className="font-display font-black text-sm text-[hsl(var(--gold))] uppercase tracking-widest">PAR ÉQUIPE — FINAL TIE</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">The final team result is tied. Main Referee must make the final superiority decision.</div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => dispatch({ type: 'RESOLVE_TEAM_FINAL_DECISION', winner: 'hong' })} className="py-3 rounded-xl border-2 border-[hsl(var(--hong))] bg-[hsl(var(--hong))]/15 text-[hsl(var(--hong))] font-display font-black">RED TEAM WINS</button>
              <button onClick={() => dispatch({ type: 'RESOLVE_TEAM_FINAL_DECISION', winner: 'chung' })} className="py-3 rounded-xl border-2 border-[hsl(var(--chung))] bg-[hsl(var(--chung))]/15 text-[hsl(var(--chung))] font-display font-black">BLUE TEAM WINS</button>
            </div>
          </div>
        )}

        {/* Players. Hong (red) on the left, Chung (blue) on the right — the
            public/audience scoreboard intentionally keeps the opposite
            (blue-left/red-right) layout; this swap applies only to the
            operator-facing screens (Operator/Judge/Admin). */}
        <div className="grid grid-cols-2 gap-3">
          <PlayerPanel color="hong" keyMap={keyMap} />
          <PlayerPanel color="chung" keyMap={keyMap} />
        </div>

        {/* Score log */}
        <div className="panel p-3">
          <h3 className="text-xs font-display font-bold text-[hsl(var(--muted-foreground))] mb-2">{t('scoreLog')}</h3>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {state.events.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-2">{t('noScoresYet')}</p>
            ) : (
              [...state.events].reverse().map(event => (
                <div key={event.id} className="flex items-center justify-between text-xs py-1 border-b border-[hsl(var(--border))]/50">
                  <span className={`flex items-center gap-1 ${event.player === 'chung' ? 'text-[hsl(var(--chung))]' : 'text-[hsl(var(--hong))]'}`}>
                    {SCORE_ICONS[event.type]} {SCORE_LABELS[event.type]}
                  </span>
                  <span className="text-[hsl(var(--muted-foreground))]">R{event.round} • {formatTime(event.time)} • +{event.points}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showSaveConfirm && state.status === 'finished' && state.result && state.resultConfirmed && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[hsl(var(--gold))]/40 bg-[hsl(var(--background))] p-5 shadow-2xl">
            <div className="text-lg font-black text-[hsl(var(--gold))]">{lang === 'ar' ? 'حفظ المباراة' : 'SAVE MATCH'}</div>
            <div className="text-xs text-muted-foreground mt-1">{lang === 'ar' ? 'هل تريد بالتأكيد حفظ هذه المباراة؟' : 'Are you sure you want to save this match?'}</div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-lg border border-[hsl(var(--chung))]/40 bg-[hsl(var(--chung))]/10 p-3"><div className="text-[10px] text-[hsl(var(--chung))]">BLUE</div><div className="font-bold">{state.chung.player.name}</div></div>
              <div className="rounded-lg border border-[hsl(var(--hong))]/40 bg-[hsl(var(--hong))]/10 p-3"><div className="text-[10px] text-[hsl(var(--hong))]">RED</div><div className="font-bold">{state.hong.player.name}</div></div>
            </div>
            <div className="mt-3 text-center text-2xl font-black">{state.chung.totalScore} — {state.hong.totalScore}</div>
            <div className="mt-1 text-center text-xs text-[hsl(var(--gold))]">{lang === 'ar' ? 'الفائز: ' : 'WINNER: '}{state.result.winner.toUpperCase()}</div>
            <div className="mt-4 rounded-lg bg-white/5 p-3 text-[10px] text-muted-foreground">{lang === 'ar' ? 'سيتم تحديث سجل المباريات وإحصائيات اللاعبين والأندية والبطولة والترتيب والمكتملة والمتبقية.' : 'This will update Match History, Player Statistics, Club Statistics, Tournament Statistics, Rankings, Completed and Remaining.'}</div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowSaveConfirm(false)} className="flex-1 py-2.5 rounded-lg bg-white/10 text-white font-bold">{lang === 'ar' ? 'إلغاء' : 'CANCEL'}</button>
              <button onClick={handleSaveMatch} disabled={savingMatch} className="flex-1 py-2.5 rounded-lg bg-[hsl(var(--gold))] text-black font-black disabled:opacity-50">{savingMatch ? (lang === 'ar' ? 'جارٍ الحفظ…' : 'SAVING…') : (lang === 'ar' ? 'حفظ النتيجة' : 'SAVE RESULT')}</button>
            </div>
          </div>
        </div>
      )}

      {/* KO animation — winner colour is used consistently for logo, frame and KO text */}
      {koAnimation && (() => {
        const isBlue = koAnimation === 'chung';
        const accent = isBlue ? 'hsl(var(--chung))' : 'hsl(var(--hong))';
        const logo = isBlue ? koBlueLogo : koRedLogo;
        return (
          <div className="fixed inset-0 z-[95] flex items-center justify-center overflow-hidden animate-fade-in" style={{ background: 'radial-gradient(circle at 50% 42%, color-mix(in srgb, '+accent+' 24%, transparent), rgba(0,0,0,.96) 58%)' }}>
            <div className="absolute inset-0 opacity-60" style={{ background: `repeating-linear-gradient(120deg, transparent 0 90px, ${accent} 92px, transparent 95px 180px)`, animation: 'koSweep 1.8s linear infinite' }} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 43%, ${accent} 0%, transparent 17%), radial-gradient(circle at 50% 50%, rgba(255,255,255,.08), transparent 42%)`, mixBlendMode: 'screen', animation: 'koFlash .95s ease-out infinite' }} />
            <div className="absolute w-[70vmin] h-[70vmin] rounded-full border-2 opacity-50" style={{ borderColor: accent, boxShadow: `0 0 45px ${accent}, inset 0 0 45px ${accent}`, animation: 'koRing .9s ease-out infinite' }} />
            <div className="absolute w-[48vmin] h-[48vmin] rounded-full border" style={{ borderColor: `${accent}88`, boxShadow: `0 0 30px ${accent}66`, animation: 'koInnerRing 1.1s ease-out infinite' }} />
            <div className="absolute left-[5%] right-[5%] top-1/2 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, boxShadow: `0 0 16px ${accent}`, animation: 'koScan 1s ease-in-out infinite' }} />
            <div className="absolute top-[6%] left-[5%] text-[9px] font-black tracking-[.32em]" style={{ color: accent }}>WAB-TKD · KO</div>
            <div className="absolute top-[6%] right-[5%] text-[9px] font-black tracking-[.22em] text-white/50">WINNER · {isBlue ? 'BLUE' : 'RED'}</div>
            <div className="relative z-10 text-center px-8">
              <div className="mx-auto mb-2 rounded-full p-5" style={{ width: 'clamp(150px, 21vw, 300px)', height: 'clamp(150px, 21vw, 300px)', border: `3px solid ${accent}`, boxShadow: `0 0 25px ${accent}, 0 0 90px color-mix(in srgb, ${accent} 45%, transparent)`, animation: 'koLogoIn .55s cubic-bezier(.2,.8,.2,1) both' }}>
                <img src={logo} alt="" className="w-full h-full object-contain" />
              </div>
              <div className="font-display font-black leading-none tracking-[.12em]" style={{ color: accent, fontSize: 'clamp(72px, 11vw, 170px)', textShadow: `0 0 12px ${accent}, 0 0 42px ${accent}`, animation: 'koText .8s ease-in-out infinite' }}>{t('ko')}</div>
              <div className="font-display font-bold tracking-[.3em] text-white/75" style={{ fontSize: 'clamp(16px, 1.8vw, 30px)' }}>{t('knockout')}</div>
            </div>
            <style>{`@keyframes koLogoIn {0%{opacity:0;transform:scale(.45) translateY(-25px);filter:blur(10px)}65%{opacity:1;transform:scale(1.08);filter:blur(0)}100%{opacity:1;transform:scale(1)}} @keyframes koText {0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.045);filter:brightness(1.45)}} @keyframes koRing {0%{transform:scale(.55);opacity:.75}100%{transform:scale(1.35);opacity:0}} @keyframes koSweep {from{transform:translateX(-18%) rotate(0deg)}to{transform:translateX(18%) rotate(360deg)}} @keyframes koFlash {0%,100%{opacity:.08;transform:scale(.84)}35%{opacity:.34;transform:scale(1.08)}65%{opacity:.14;transform:scale(1.02)}} @keyframes koInnerRing {0%{transform:scale(.68);opacity:.7}100%{transform:scale(1.22);opacity:0}} @keyframes koScan {0%,100%{transform:scaleX(.2);opacity:.12}50%{transform:scaleX(1);opacity:.85}}`}</style>
          </div>
        );
      })()}

      {showResultView && (
        <ResultView
          competitionName={state.competitionName || ''}
          initialMatchNumber={resultViewFocusMatch}
          onClose={() => { setShowResultView(false); setResultViewFocusMatch(undefined); }}
        />
      )}

      {showMatchReplay && (
        <MatchReplay state={state} onClose={() => setShowMatchReplay(false)} />
      )}

      {/* ROUND COMPLETE TOAST — compact Main Referee notification, auto-hides after 5 seconds */}
      {roundEndCountdown !== null && roundEndCountdown > 0 && roundWinner && (
        <div className="main-referee-round-toast" role="status" aria-live="polite">
          <div className="main-referee-round-toast__icon"><Trophy size={14} strokeWidth={2.4} /></div>
          <div className="main-referee-round-toast__content">
            <div className="main-referee-round-toast__eyebrow">WAB-TKD · ROUND COMPLETE</div>
            <div className="main-referee-round-toast__result">
              <span className={roundWinner === 'chung' ? 'main-referee-round-toast__winner is-blue' : 'main-referee-round-toast__winner is-red'}>{roundWinner === 'chung' ? 'BLUE WINS' : 'RED WINS'}</span>
              <span className="main-referee-round-toast__score">{chungRoundWins} — {hongRoundWins}</span>
            </div>
          </div>
          <div className="main-referee-round-toast__timer" aria-hidden="true"><span style={{ animationDuration: `${Math.max(roundEndCountdown, 1)}s` }} /></div>
        </div>
      )}

      {/* PROFESSIONAL MAIN REFEREE RESULT / REVIEW */}
      {state.status === 'finished' && state.result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#03060c]/92 backdrop-blur-md p-5" style={{ animation: 'refReviewIn .35s ease-out' }}>
          <style>{`@keyframes refReviewIn {0%{opacity:0;transform:scale(.985)}100%{opacity:1;transform:scale(1)}}`}</style>
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl border border-[hsl(var(--gold))]/30 bg-[linear-gradient(145deg,#0b111d,#070a11)] shadow-[0_30px_100px_rgba(0,0,0,.65),0_0_60px_rgba(242,193,78,.08)]">
            <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[.28em] text-[hsl(var(--gold))] font-black">MAIN REFEREE · OFFICIAL RESULT REVIEW</div>
                <div className="text-xl md:text-2xl font-display font-black text-white mt-1">MATCH #{state.matchNumber || '—'} · {state.weightCategory || '—'}</div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                <span className="px-2.5 py-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">FINISHED</span>
                <span className="px-2.5 py-1 rounded-full border border-white/10 bg-white/5">NO TIMER RUNNING</span>
              </div>
            </div>

            <div className="grid md:grid-cols-[1.35fr_.9fr] gap-4 p-5">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-[10px] tracking-[.22em] font-black text-white/40 mb-3">OFFICIAL MATCH RESULT</div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <div className="text-center rounded-2xl border border-[hsl(var(--chung))]/35 bg-[hsl(var(--chung))]/[.06] p-4">
                    <div className="text-[10px] font-black text-[hsl(var(--chung))]">BLUE · CHUNG</div>
                    <div className="mt-2 text-lg font-black text-white truncate">{state.chung.player.name}</div>
                    <div className="mt-1 text-4xl font-display font-black text-[hsl(var(--chung))]">{state.result.finalScore.chung}</div>
                    <div className="text-[9px] text-white/40 mt-1">ROUNDS WON: {chungRoundWins}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-white/35 font-black">VS</div>
                    <div className="my-2 h-px w-10 bg-[hsl(var(--gold))]/40 mx-auto" />
                    <div className="text-[10px] font-black text-[hsl(var(--gold))]">WINNER</div>
                    <div className="text-base font-display font-black text-white mt-1">{state.result.winner === 'chung' ? 'BLUE' : 'RED'}</div>
                  </div>
                  <div className="text-center rounded-2xl border border-[hsl(var(--hong))]/35 bg-[hsl(var(--hong))]/[.06] p-4">
                    <div className="text-[10px] font-black text-[hsl(var(--hong))]">RED · HONG</div>
                    <div className="mt-2 text-lg font-black text-white truncate">{state.hong.player.name}</div>
                    <div className="mt-1 text-4xl font-display font-black text-[hsl(var(--hong))]">{state.result.finalScore.hong}</div>
                    <div className="text-[9px] text-white/40 mt-1">ROUNDS WON: {hongRoundWins}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                  <div className="rounded-xl border border-white/10 bg-white/[.03] p-2"><div className="text-[8px] text-white/35">METHOD</div><div className="text-xs font-black text-white mt-1">{state.result.method}</div></div>
                  <div className="rounded-xl border border-white/10 bg-white/[.03] p-2"><div className="text-[8px] text-white/35">ROUNDS</div><div className="text-xs font-black text-white mt-1">{state.config.rounds}</div></div>
                  <div className="rounded-xl border border-white/10 bg-white/[.03] p-2"><div className="text-[8px] text-white/35">HEAD HITS</div><div className="text-xs font-black text-white mt-1">{state.events.filter(e => e.type === 'head_kick' || e.type === 'turning_head').length}</div></div>
                  <div className="rounded-xl border border-white/10 bg-white/[.03] p-2"><div className="text-[8px] text-white/35">TOTAL HITS</div><div className="text-xs font-black text-white mt-1">{state.events.filter(e => e.type !== 'warning' && e.type !== 'gamjeom').length}</div></div>
                </div>
              </div>

              <div className="rounded-2xl border border-[hsl(var(--gold))]/20 bg-[hsl(var(--gold))]/[.035] p-5">
                <div className="text-[10px] tracking-[.22em] font-black text-[hsl(var(--gold))]">ROUND REVIEW &amp; CORRECTION</div>
                <p className="text-[10px] text-white/45 mt-1">Correct a missed point, Gam-jeom or warning after the clock has ended. The correction returns the audience to LIVE MATCH / REST at 00:00, then the referee restarts the official break.</p>
                <div className="mt-4 space-y-2">
                  {state.roundWinners.map((rw) => {
                    const cs = state.chung.scores[rw.round - 1]?.total || 0;
                    const hs = state.hong.scores[rw.round - 1]?.total || 0;
                    const decisive = rw.winner === state.result?.winner;
                    return (
                      <div key={rw.round} className={`flex items-center gap-2 rounded-xl border p-2.5 ${decisive ? 'border-[hsl(var(--gold))]/35 bg-[hsl(var(--gold))]/[.06]' : 'border-white/10 bg-white/[.02]'}`}>
                        <div className="w-12 text-center"><div className="text-[9px] text-white/35">ROUND</div><div className="font-display font-black text-white">R{rw.round}</div></div>
                        <div className="flex-1 text-sm font-black"><span className="text-[hsl(var(--chung))]">{cs}</span><span className="text-white/30 mx-2">—</span><span className="text-[hsl(var(--hong))]">{hs}</span></div>
                        <div className="text-[9px] font-black text-white/45 mr-1">{rw.winner === 'draw' ? 'DRAW' : rw.winner === 'chung' ? 'BLUE' : 'RED'}</div>
                        <button onClick={() => openRoundCorrection(rw.round)} className="rounded-lg border border-[hsl(var(--gold))]/40 bg-[hsl(var(--gold))]/10 px-3 py-2 text-[9px] font-black text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/20">CORRECT R{rw.round}</button>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => openRoundCorrection(Math.max(1, state.roundWinners[state.roundWinners.length - 1]?.round || state.currentRound))} className="mt-3 w-full rounded-xl border-2 border-[hsl(var(--gold))]/45 bg-[hsl(var(--gold))]/10 py-2.5 text-[10px] font-black tracking-wide text-[hsl(var(--gold))]">CORRECT LAST DECIDING ROUND · تصحيح الجولة الحاسمة الأخيرة</button>
              </div>
            </div>

            <div className="px-5 pb-5 flex flex-wrap justify-center gap-2">
              {!state.resultConfirmed ? (
                <button onClick={() => { dispatch({ type: 'CONFIRM_FINAL_RESULT' }); logAudit('official_result_confirmed', `Match #${state.matchNumber ?? '—'} — ${state.result?.winner === 'chung' ? state.chung.player.name : state.hong.player.name}`, { tournamentId: state.tournamentId, category: state.weightCategory }); }} className="px-8 py-3 rounded-xl bg-[hsl(var(--gold))] text-black font-display font-black text-sm shadow-[0_0_30px_rgba(242,193,78,.30)]">✓ CONFIRM FINAL RESULT · MAIN REFEREE</button>
              ) : (
                <div className="px-6 py-3 rounded-xl border-2 border-emerald-400/45 bg-emerald-400/10 text-emerald-300 text-xs font-black">✓ OFFICIAL RESULT CONFIRMED · MAIN REFEREE</div>
              )}
              {state.resultConfirmed && (!savedMatchId || savedMatchId !== state.id) ? (
                <button onClick={() => setShowSaveConfirm(true)} disabled={savingMatch} className="px-8 py-3 rounded-xl bg-[hsl(var(--gold))] text-black font-display font-black text-sm shadow-[0_0_28px_rgba(242,193,78,.25)] disabled:opacity-50">{savingMatch ? 'SAVING…' : 'SAVE RESULT'}</button>
              ) : state.resultConfirmed ? (
                <div className="px-5 py-3 rounded-xl border border-emerald-400/35 bg-emerald-400/10 text-emerald-300 text-xs font-black">✓ MATCH SAVED · COMPLETED</div>
              ) : null}
              <button onClick={() => setShowMatchReplay(true)} className="px-5 py-3 rounded-xl border-2 border-[hsl(var(--chung))]/45 bg-[hsl(var(--chung))]/10 text-[hsl(var(--chung))] text-xs font-black shadow-[0_0_22px_rgba(51,162,255,.12)]"><RotateCcw size={14} className="inline me-1"/>WATCH REPLAY</button>
              {state.config?.competitionMode !== 'par_equipe' && <button onClick={() => window.dispatchEvent(new Event('wab-skip-winner-animation'))} className="px-5 py-3 rounded-xl border-2 border-white/20 bg-black/50 text-white text-xs font-black shadow-[0_0_18px_rgba(255,255,255,.08)]">SKIP RESULT ANIMATION</button>}
              <button onClick={() => { setResultViewFocusMatch(state.matchNumber); setShowResultView(true); }} className="px-5 py-3 rounded-xl border border-white/15 bg-white/5 text-white/80 text-xs font-black">MATCH HISTORY / VIEW</button>
              <button onClick={handleExportPDF} className="px-5 py-3 rounded-xl border border-white/15 bg-white/5 text-white/80 text-xs font-black"><FileText size={14} className="inline me-1" /> PDF</button>
              <button onClick={() => { dispatch({ type: 'RESET' }); setSavedMatchId(null); setWinnerCountdown(null); }} className="px-5 py-3 rounded-xl border border-white/15 bg-white/5 text-white/70 text-xs font-black">RETURN / RESET</button>
              {state.resultConfirmed && savedMatchId === state.id && (
                <button onClick={() => { setSaveCompletedNotice(false); setWinnerCountdown(null); setSavedMatchId(null); dispatch({ type: 'RESET' }); handleOpenMatchSelector(); }} className="px-8 py-3 rounded-xl border-2 border-emerald-400/60 bg-emerald-400/12 text-emerald-200 font-display font-black text-sm shadow-[0_0_24px_rgba(52,211,153,.14)] hover:bg-emerald-400/20">NEXT MATCH →</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Post-match correction mode — no timer, no new round and no intro. */}
      {state.roundCorrection?.active && correctionRound != null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#02050a]/94 backdrop-blur-lg p-5">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl border-2 border-[hsl(var(--gold))]/35 bg-[#080d16] shadow-[0_30px_100px_rgba(0,0,0,.7)]">
            <div className="p-5 border-b border-white/10 flex items-center justify-between gap-3">
              <div><div className="text-[10px] tracking-[.25em] font-black text-[hsl(var(--gold))]">REFEREE CORRECTION · NO TIMER</div><div className="text-xl font-display font-black text-white mt-1">EDIT ROUND {correctionRound}</div></div>
              <button onClick={() => { dispatch({ type: 'CANCEL_ROUND_CORRECTION' }); setCorrectionRound(null); }} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-black text-white/60"><X size={14} className="inline me-1" /> CANCEL</button>
            </div>
            <div className="p-5 grid md:grid-cols-2 gap-4">
              {(['chung','hong'] as PlayerColor[]).map((side) => {
                const blue = side === 'chung';
                const accent = blue ? 'hsl(var(--chung))' : 'hsl(var(--hong))';
                return <div key={side} className="rounded-2xl border p-4" style={{ borderColor: `hsl(${blue ? '217 91% 55%' : '0 72% 55%'} / .3)`, background: `hsl(${blue ? '217 91% 55%' : '0 72% 55%'} / .045)` }}>
                  <div className="text-xs font-black" style={{ color: accent }}>{blue ? 'BLUE' : 'RED'} · {state[side].player.name}</div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {([['punch','+1'],['trunk_kick','+2'],['head_kick','+3'],['turning_kick','+4'],['turning_head',`+${state.config.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints}`],['manual','MANUAL +1']] as [ScoreType,string][]).map(([type,label]) => <button key={type} onClick={() => addCorrectionScore(side,type)} className="rounded-lg border border-white/10 bg-white/[.04] py-2 text-[9px] font-black text-white hover:bg-white/[.08]">{label}</button>)}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <button onClick={() => addCorrectionScore(side,'gamjeom')} className="rounded-lg border border-[hsl(var(--warning))]/35 bg-[hsl(var(--warning))]/10 py-2 text-[9px] font-black text-[hsl(var(--warning))]">GAM-JEOM +1 OPP</button>
                    <button onClick={() => addCorrectionWarning(side,1,false)} className="rounded-lg border border-[hsl(var(--warning))]/35 bg-[hsl(var(--warning))]/10 py-2 text-[9px] font-black text-[hsl(var(--warning))]">WARNING ×1</button>
                    <button onClick={() => addCorrectionWarning(side,2,true)} className="rounded-lg border border-[hsl(var(--destructive))]/35 bg-[hsl(var(--destructive))]/10 py-2 text-[9px] font-black text-[hsl(var(--destructive))]">LAST 10s · ×2</button>
                  </div>
                </div>;
              })}
            </div>
            <div className="px-5 pb-5">
              <div className="rounded-xl border border-[hsl(var(--gold))]/20 bg-[hsl(var(--gold))]/[.04] p-3 text-center text-[10px] text-white/55">Added events are recorded against Round {correctionRound}. The fight clock stays stopped and no Player Call / intro animation is triggered.</div>
              <div className="mt-3 flex justify-center gap-2"><button onClick={finishRoundCorrection} className="rounded-xl bg-[hsl(var(--gold))] px-7 py-3 text-xs font-black text-black">SHOW UPDATED RESULT · إظهار النتيجة الجديدة</button></div>
            </div>
          </div>
        </div>
      )}

      {showSaveConfirm && state.status === 'finished' && state.result && state.resultConfirmed && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[hsl(var(--gold))]/40 bg-[hsl(var(--background))] p-5 shadow-2xl">
            <div className="text-lg font-black text-[hsl(var(--gold))]">{lang === 'ar' ? 'حفظ المباراة' : 'SAVE MATCH'}</div>
            <div className="text-xs text-muted-foreground mt-1">{lang === 'ar' ? 'هل تريد بالتأكيد حفظ هذه المباراة؟' : 'Are you sure you want to save this match?'}</div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-lg border border-[hsl(var(--chung))]/40 bg-[hsl(var(--chung))]/10 p-3"><div className="text-[10px] text-[hsl(var(--chung))]">BLUE</div><div className="font-bold">{state.chung.player.name}</div></div>
              <div className="rounded-lg border border-[hsl(var(--hong))]/40 bg-[hsl(var(--hong))]/10 p-3"><div className="text-[10px] text-[hsl(var(--hong))]">RED</div><div className="font-bold">{state.hong.player.name}</div></div>
            </div>
            <div className="mt-3 text-center text-2xl font-black">{state.chung.totalScore} — {state.hong.totalScore}</div>
            <div className="mt-1 text-center text-xs text-[hsl(var(--gold))]">{lang === 'ar' ? 'الفائز: ' : 'WINNER: '}{state.result.winner.toUpperCase()}</div>
            <div className="mt-4 rounded-lg bg-white/5 p-3 text-[10px] text-muted-foreground">{lang === 'ar' ? 'سيتم تحديث سجل المباريات وإحصائيات اللاعبين والأندية والبطولة والترتيب والمكتملة والمتبقية.' : 'This will update Match History, Player Statistics, Club Statistics, Tournament Statistics, Rankings, Completed and Remaining.'}</div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowSaveConfirm(false)} className="flex-1 py-2.5 rounded-lg bg-white/10 text-white font-bold">{lang === 'ar' ? 'إلغاء' : 'CANCEL'}</button>
              <button onClick={handleSaveMatch} disabled={savingMatch} className="flex-1 py-2.5 rounded-lg bg-[hsl(var(--gold))] text-black font-black disabled:opacity-50">{savingMatch ? (lang === 'ar' ? 'جارٍ الحفظ…' : 'SAVING…') : (lang === 'ar' ? 'حفظ النتيجة' : 'SAVE RESULT')}</button>
            </div>
          </div>
        </div>
      )}

      {state.config?.competitionMode === 'par_equipe' && mainRefereeToolsOpen && (
        <MainRefereeCallPanel
          state={state}
          dispatch={dispatch}
          modal
          openControlsOnMount
          openTeamControlsOnMount={mainRefereeTeamToolsOpen}
          onClose={() => { setMainRefereeToolsOpen(false); setMainRefereeTeamToolsOpen(false); }}
        />
      )}

      {saveCompletedNotice && savedMatchId === state.id && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-emerald-400/40 bg-[#07110d] p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,.75)]">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-300/50 bg-emerald-400/10 text-emerald-300"><CheckCircle2 size={30}/></div>
            <div className="text-xl font-black text-emerald-300">{lang === 'ar' ? 'تم حفظ المباراة بنجاح' : 'MATCH SAVED SUCCESSFULLY'}</div>
            <div className="mt-2 text-xs text-white/55">{lang === 'ar' ? 'تم حفظ النتيجة والإحصائيات وربط المباراة بالبطولة. اضغط OK للمتابعة.' : 'Result, statistics and tournament link are safely saved. Press OK to continue.'}</div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => setSaveCompletedNotice(false)} className="rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-black text-white/75">OK</button>
              <button onClick={() => { setSaveCompletedNotice(false); setWinnerCountdown(null); dispatch({ type: 'RESET' }); setSavedMatchId(null); handleOpenMatchSelector(); }} className="rounded-xl bg-emerald-400 py-3 text-sm font-black text-black">NEXT MATCH</button>
            </div>
          </div>
        </div>
      )}

      {/* KO animation — winner colour is used consistently for logo, frame and KO text */}
      {koAnimation && (() => {
        const isBlue = koAnimation === 'chung';
        const accent = isBlue ? 'hsl(var(--chung))' : 'hsl(var(--hong))';
        const logo = isBlue ? koBlueLogo : koRedLogo;
        return (
          <div className="fixed inset-0 z-[95] flex items-center justify-center overflow-hidden animate-fade-in" style={{ background: 'radial-gradient(circle at 50% 42%, color-mix(in srgb, '+accent+' 24%, transparent), rgba(0,0,0,.96) 58%)' }}>
            <div className="absolute inset-0 opacity-60" style={{ background: `repeating-linear-gradient(120deg, transparent 0 90px, ${accent} 92px, transparent 95px 180px)`, animation: 'koSweep 1.8s linear infinite' }} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 43%, ${accent} 0%, transparent 17%), radial-gradient(circle at 50% 50%, rgba(255,255,255,.08), transparent 42%)`, mixBlendMode: 'screen', animation: 'koFlash .95s ease-out infinite' }} />
            <div className="absolute w-[70vmin] h-[70vmin] rounded-full border-2 opacity-50" style={{ borderColor: accent, boxShadow: `0 0 45px ${accent}, inset 0 0 45px ${accent}`, animation: 'koRing .9s ease-out infinite' }} />
            <div className="absolute w-[48vmin] h-[48vmin] rounded-full border" style={{ borderColor: `${accent}88`, boxShadow: `0 0 30px ${accent}66`, animation: 'koInnerRing 1.1s ease-out infinite' }} />
            <div className="absolute left-[5%] right-[5%] top-1/2 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, boxShadow: `0 0 16px ${accent}`, animation: 'koScan 1s ease-in-out infinite' }} />
            <div className="absolute top-[6%] left-[5%] text-[9px] font-black tracking-[.32em]" style={{ color: accent }}>WAB-TKD · KO</div>
            <div className="absolute top-[6%] right-[5%] text-[9px] font-black tracking-[.22em] text-white/50">WINNER · {isBlue ? 'BLUE' : 'RED'}</div>
            <div className="relative z-10 text-center px-8">
              <div className="mx-auto mb-2 rounded-full p-5" style={{ width: 'clamp(150px, 21vw, 300px)', height: 'clamp(150px, 21vw, 300px)', border: `3px solid ${accent}`, boxShadow: `0 0 25px ${accent}, 0 0 90px color-mix(in srgb, ${accent} 45%, transparent)`, animation: 'koLogoIn .55s cubic-bezier(.2,.8,.2,1) both' }}>
                <img src={logo} alt="" className="w-full h-full object-contain" />
              </div>
              <div className="font-display font-black leading-none tracking-[.12em]" style={{ color: accent, fontSize: 'clamp(72px, 11vw, 170px)', textShadow: `0 0 12px ${accent}, 0 0 42px ${accent}`, animation: 'koText .8s ease-in-out infinite' }}>{t('ko')}</div>
              <div className="font-display font-bold tracking-[.3em] text-white/75" style={{ fontSize: 'clamp(16px, 1.8vw, 30px)' }}>{t('knockout')}</div>
            </div>
            <style>{`@keyframes koLogoIn {0%{opacity:0;transform:scale(.45) translateY(-25px);filter:blur(10px)}65%{opacity:1;transform:scale(1.08);filter:blur(0)}100%{opacity:1;transform:scale(1)}} @keyframes koText {0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.045);filter:brightness(1.45)}} @keyframes koRing {0%{transform:scale(.55);opacity:.75}100%{transform:scale(1.35);opacity:0}} @keyframes koSweep {from{transform:translateX(-18%) rotate(0deg)}to{transform:translateX(18%) rotate(360deg)}} @keyframes koFlash {0%,100%{opacity:.08;transform:scale(.84)}35%{opacity:.34;transform:scale(1.08)}65%{opacity:.14;transform:scale(1.02)}} @keyframes koInnerRing {0%{transform:scale(.68);opacity:.7}100%{transform:scale(1.22);opacity:0}} @keyframes koScan {0%,100%{transform:scaleX(.2);opacity:.12}50%{transform:scaleX(1);opacity:.85}}`}</style>
          </div>
        );
      })()}

      {showResultView && (
        <ResultView
          competitionName={state.competitionName || ''}
          initialMatchNumber={resultViewFocusMatch}
          onClose={() => { setShowResultView(false); setResultViewFocusMatch(undefined); }}
        />
      )}



      {/* Professional post-match controls are rendered in the OFFICIAL MATCH RESULT panel above. */}
      {/* Alert overlay */}
      {alertActive && (
        <div className="fixed inset-0 bg-[hsl(var(--destructive))]/20 backdrop-blur-sm flex items-center justify-center z-40 animate-fade-in">
          <div className="text-center p-8 panel">
            <AlertTriangle className="mx-auto text-[hsl(var(--warning))] mb-4" size={48} />
            <div className="font-display text-xl text-[hsl(var(--warning))] mb-4">⚠ {t('judgeAlert')}</div>
            <button onClick={() => setAlertActive(false)} className="px-6 py-2 rounded-lg bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] font-bold">OK</button>
          </div>
        </div>
      )}

      {/* ===== LIVE MINI PREVIEW — a real, scaled-down instance of the public
          scoreboard, rendered from the exact same MatchContext state as the
          audience screen. Since it's the same React tree (not a separate
          window), it updates in perfect lock-step with every score/timer/
          status change — no polling, no IPC round-trip. ===== */}
      {showMiniPreview && (
        <div
          className="fixed z-[500] rounded-xl overflow-hidden shadow-2xl border-2 border-[hsl(var(--info))]/50 bg-black animate-fade-in relative"
          style={previewPos
            ? { width: previewWidth, left: previewPos.x, top: previewPos.y }
            : { width: previewWidth, bottom: '1rem', insetInlineEnd: '1rem' }}
        >
          <div
            onMouseDown={(e) => {
              const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
              previewDragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
              const onMove = (ev: MouseEvent) => {
                if (!previewDragRef.current) return;
                const { startX, startY, origX, origY } = previewDragRef.current;
                const x = Math.max(0, Math.min(window.innerWidth - previewWidth, origX + (ev.clientX - startX)));
                const y = Math.max(0, Math.min(window.innerHeight - previewWidth * 9 / 16 - 40, origY + (ev.clientY - startY)));
                setPreviewPos({ x, y });
              };
              const onUp = () => {
                previewDragRef.current = null;
                setPreviewPos(pos => {
                  try { if (pos) localStorage.setItem('kyorugi_preview_pos', JSON.stringify(pos)); } catch { /* ignore */ }
                  return pos;
                });
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            className="flex items-center justify-between px-2 py-1 bg-[hsl(var(--info))]/20 cursor-move select-none"
            title="اسحب لتحريك النافذة"
          >
            <span className="text-[10px] font-display font-bold text-[hsl(var(--info))] tracking-wider flex items-center gap-1">
              <Eye size={11} /> LIVE PREVIEW — PUBLIC SCREEN · READ ONLY
            </span>
            <button onClick={() => setShowMiniPreview(false)} className="text-[hsl(var(--info))]/70 hover:text-[hsl(var(--info))]">
              <X size={12} />
            </button>
          </div>
          <div style={{ width: previewWidth, height: previewWidth * 9 / 16, overflow: 'hidden', position: 'relative', pointerEvents: 'none' }}>
            <div style={{ width: 1920, height: 1080, transform: `scale(${previewWidth / 1920})`, transformOrigin: 'top left' }}>
              <PublicScoreboard isMiniPreview />
            </div>
          </div>
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              previewResizeRef.current = { startX: e.clientX, startWidth: previewWidth };
              const onMove = (ev: MouseEvent) => {
                if (!previewResizeRef.current) return;
                const { startX, startWidth } = previewResizeRef.current;
                const next = Math.max(320, Math.min(1000, startWidth + (ev.clientX - startX)));
                setPreviewWidth(next);
              };
              const onUp = () => {
                previewResizeRef.current = null;
                setPreviewWidth(w => {
                  try { localStorage.setItem('kyorugi_preview_width', String(w)); } catch { /* ignore */ }
                  return w;
                });
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end pointer-events-auto"
            title="اسحب لتغيير حجم النافذة"
            style={{ insetInlineEnd: 0 }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className="text-[hsl(var(--info))]/70 m-0.5">
              <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
