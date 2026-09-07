import React, { useState, useEffect, useRef } from 'react';
import { useMatch } from '@/context/MatchContext';
import { ScoreType, SCORE_LABELS, PlayerColor, DEFAULT_CONFIG } from '@/types/tkd';
import { formatTime } from '@/lib/match-engine';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/lib/i18n';
import { sounds } from '@/lib/sounds';
import { AlertTriangle, Send, Pause, Hand, Target, CircleDot, Zap, Bell } from 'lucide-react';
import FlagImage from './FlagImage';

const SCORE_ICONS: Record<string, React.ReactNode> = {
  punch: <Hand size={16} />,
  trunk_kick: <Target size={16} />,
  head_kick: <CircleDot size={16} />,
  turning_kick: <Zap size={16} />,
  turning_head: <Zap size={16} />,
  gamjeom: <AlertTriangle size={16} />,
};

interface PendingVote {
  id: string;
  judgeId: string;
  judgeName: string;
  player: PlayerColor;
  type: ScoreType;
  // Weighted voting: each side judge = weight 1, the chief referee = weight
  // 2 (cast from the Operator screen). The Operator screen is the single
  // source of truth for actually applying the score once a side's summed
  // weight reaches majority — this panel just casts its vote and displays
  // the running tally, it never applies the score itself.
  votes: Record<string, { decision: 'approve' | 'reject'; weight: number }>;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}

export default function JudgePanel({ judgeId, judgeName }: { judgeId: string; judgeName: string }) {
  const { state, dispatch, setAlertActive } = useMatch();
  const { t } = useI18n();
  const [pendingScore, setPendingScore] = useState<{ player: PlayerColor; type: ScoreType } | null>(null);
  const [pendingVotes, setPendingVotes] = useState<PendingVote[]>([]);
  const [voteNotification, setVoteNotification] = useState<string | null>(null);
  const [connectedJudgeCount, setConnectedJudgeCount] = useState(1);
  // Connection health, surfaced to the judge instead of failing silently.
  // 'connected': channels subscribed and healthy.
  // 'reconnecting': a drop was detected (network blip, or the phone's
  //   browser suspending the socket while the screen was locked/backgrounded
  //   — extremely common on mobile) and a fresh subscribe is in flight.
  const [connStatus, setConnStatus] = useState<'connected' | 'reconnecting'>('connected');

  // Bumping this remounts the channel-subscription effect below, forcing a
  // brand new subscribe from scratch — the reliable way to recover a
  // Supabase Realtime channel that silently died, since simply calling
  // .subscribe() again on an already-errored channel object doesn't
  // reliably resume it.
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const forceReconnect = () => { setConnStatus('reconnecting'); setReconnectNonce(n => n + 1); };

  // The single, already-subscribed 'judge-votes' channel. Every send
  // (score, vote, alert, pause-request) below MUST reuse this exact
  // object — calling supabase.channel('judge-votes') again anywhere else
  // creates a brand new, never-subscribed, never-cleaned-up channel
  // instance for the SAME topic. This was the actual root cause of the
  // connection dropping after every single point a judge sent: each of
  // the 4 action handlers (send score, cast vote, alert, pause request)
  // was doing exactly that on every tap — silently leaking an orphaned
  // channel bound to 'judge-votes' each time, which destabilizes the one
  // real subscribed connection. Reusing the same channel object fixes it
  // at the source instead of just reconnecting faster after the fact.
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Listen for score vote requests from other judges
  useEffect(() => {
    const channel = supabase.channel('judge-votes')
      .on('presence', { event: 'sync' }, () => {
        setConnectedJudgeCount(Math.max(1, Object.keys(channel.presenceState()).length));
      })
      .on('broadcast', { event: 'score-vote-request' }, (payload) => {
        const vote = payload.payload as PendingVote;
        if (vote.judgeId !== judgeId) {
          setPendingVotes(prev => [...prev.filter(v => v.id !== vote.id), vote]);
          sounds.click();
        }
      })
      .on('broadcast', { event: 'score-vote-update' }, (payload) => {
        // Another judge (or the referee, weight 2) cast a vote — keep our
        // own copy of the tally in sync so the "N votes" badge is accurate.
        const { id, voterId, weight, decision } = payload.payload || {};
        if (!id || !voterId) return;
        setPendingVotes(prev => prev.map(v => v.id === id ? { ...v, votes: { ...v.votes, [voterId]: { decision, weight } } } : v));
      })
      .on('broadcast', { event: 'score-vote-result' }, (payload) => {
        const { id, status, player, type } = payload.payload;
        setPendingVotes(prev => prev.filter(v => v.id !== id));
        if (status === 'approved') {
          setVoteNotification(`✓ ${SCORE_LABELS[type]} → ${player.toUpperCase()} approved`);
        } else {
          setVoteNotification(`✗ ${SCORE_LABELS[type]} → ${player.toUpperCase()} rejected`);
        }
        setTimeout(() => setVoteNotification(null), 3000);
      })
      .subscribe(async (status) => {
        // Announce this judge's presence once actually subscribed — this is
        // what lets the Operator screen show "N judges connected".
        if (status === 'SUBSCRIBED') {
          setConnStatus('connected');
          channelRef.current = channel;
          await channel.track({ judgeId, judgeName, ts: Date.now() });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          channelRef.current = null;
          // The channel died — most commonly a mobile browser suspending
          // the socket while the phone's screen was locked/backgrounded.
          // Previously this failed completely silently: the judge's clock
          // display would freeze on whatever state it last received, and
          // every further score tap would go nowhere, with zero indication
          // anything was wrong. Now: show it, and recover automatically.
          setConnStatus('reconnecting');
        }
      });
    // The operator broadcasts the live match state (scores, timer, and — importantly —
    // the match config/rules) on the 'match-sync' channel, not 'judge-votes'. This was
    // the actual reason a Competition Rules change in Admin never reached the judges:
    // this panel was listening for it on the wrong channel entirely.
    const stateChannel = supabase.channel('match-sync')
      .on('broadcast', { event: 'match-state' }, (payload) => {
        if (payload.payload) dispatch({ type: 'SET_STATE', state: payload.payload });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnStatus('reconnecting');
        }
      });

    // Recover as soon as the phone's screen/tab comes back — mobile
    // browsers throttle or fully suspend WebSocket connections while a
    // tab is backgrounded or the screen is locked, which is exactly the
    // moment-to-moment usage pattern of a side judge holding a phone. As
    // soon as the page is visible again, force a fresh subscribe instead
    // of waiting on an unreliable/slow automatic reconnect.
    const onVisible = () => { if (document.visibilityState === 'visible') forceReconnect(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', forceReconnect);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', forceReconnect);
      channelRef.current = null;
      supabase.removeChannel(channel);
      supabase.removeChannel(stateChannel);
    };
  }, [judgeId, reconnectNonce]);

  // Every judge → operator broadcast goes through this — reusing the one
  // subscribed channel (see channelRef comment above) instead of ever
  // calling supabase.channel('judge-votes') again elsewhere. If the
  // channel happens to be down right when the judge taps something, this
  // also immediately kicks off a reconnect instead of the send just
  // silently going nowhere.
  const sendJudgeEvent = (event: string, payload: Record<string, unknown> | PendingVote) => {
    if (!channelRef.current) {
      forceReconnect();
      return;
    }
    channelRef.current.send({ type: 'broadcast', event, payload });
  };

  const handleSendScore = () => {
    if (!pendingScore) return;
    // Send score request for voting — seeded with this judge's own approve vote (weight 1)
    const voteRequest: PendingVote = {
      id: crypto.randomUUID(),
      judgeId,
      judgeName,
      player: pendingScore.player,
      type: pendingScore.type,
      votes: { [judgeId]: { decision: 'approve', weight: 1 } },
      status: 'pending',
      timestamp: Date.now(),
    };
    
    // Broadcast vote request
    sendJudgeEvent('score-vote-request', voteRequest);
    
    setPendingVotes(prev => [...prev, voteRequest]);
    setPendingScore(null);
    sounds.scoreSound(pendingScore.type);
  };

  const handleVote = (voteId: string, decision: 'approve' | 'reject') => {
    // Cast this judge's weighted vote (weight 1) and broadcast it — the
    // Operator screen (and every other judge, for display) tallies it
    // against the majority of (2 for the referee + connected judges). We
    // don't apply the score ourselves; the Operator screen is what's
    // actually authoritative for the real match state.
    sendJudgeEvent('score-vote-update', { id: voteId, voterId: judgeId, weight: 1, decision });
    setPendingVotes(prev => prev.map(v => v.id === voteId ? { ...v, votes: { ...v.votes, [judgeId]: { decision, weight: 1 } } } : v));
    sounds.click();
  };

  const handleAlert = () => {
    setAlertActive(true);
    sounds.error();
    sendJudgeEvent('judge-alert', { judgeId, judgeName, timestamp: Date.now() });
  };

  const handlePauseRequest = () => {
    sounds.kallyeo();
    sendJudgeEvent('pause-request', { judgeId, judgeName });
  };

  const scoreTypes: { type: ScoreType; label: string; points: number }[] = [
    { type: 'punch', label: t('punch'), points: 1 },
    { type: 'trunk_kick', label: t('trunkKick'), points: 2 },
    { type: 'head_kick', label: t('headKick'), points: 3 },
    { type: 'turning_kick', label: t('turningKick'), points: 4 },
    { type: 'turning_head', label: t('turningHead'), points: state.config.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints },
    { type: 'gamjeom', label: t('gamjeom'), points: 1 },
    { type: 'warning', label: t('warning'), points: 0 },
  ];

  const GamjeomCircles = ({ count }: { count: number }) => (
    <div className="flex gap-1">
      {Array.from({ length: Math.min(state.config.gamjeomLimit, 10) }, (_, i) => (
        <div key={i} className={`w-2.5 h-2.5 rounded-full border ${
          i < count ? 'bg-[hsl(var(--warning))] border-[hsl(var(--warning))]' : 'border-[hsl(var(--muted-foreground))]/30'
        }`} />
      ))}
    </div>
  );

  const currentChungScore = state.chung.scores[state.currentRound - 1]?.total || 0;
  const currentHongScore = state.hong.scores[state.currentRound - 1]?.total || 0;

  return (
    <div className="min-h-screen gradient-dark flex flex-col">
      
      <div className="p-4 flex flex-col gap-4 flex-1">
        {/* Connection health — was previously invisible: a dropped channel
            (very common on mobile when the screen locks/backgrounds) meant
            score taps silently went nowhere and the timer display froze,
            with no indication anything was wrong. Now it's shown, with a
            manual retry available immediately instead of waiting on an
            automatic reconnect that may be slow. */}
        {connStatus === 'reconnecting' && (
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[hsl(var(--destructive))] text-white font-bold text-xs animate-pulse shadow-lg flex items-center gap-2">
            انقطع الاتصال — جاري إعادة المحاولة...
            <button onClick={forceReconnect} className="underline">أعد المحاولة الآن</button>
          </div>
        )}

        {/* Vote notification */}
        {voteNotification && (
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-bold text-sm animate-fade-in shadow-lg">
            {voteNotification}
          </div>
        )}

        {/* Header */}
        <div className="panel p-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">{t('judge')}</div>
            <div className="font-display font-bold text-[hsl(var(--primary))] text-sm">{judgeName}</div>
          </div>
          <div className="text-center">
            <div className="timer-display text-2xl">{formatTime(state.timeRemaining)}</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">R{state.currentRound}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePauseRequest}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-bold text-sm active:scale-95 transition-all">
              <Pause size={16} /> {t('kallyeo')}
            </button>
            <button onClick={handleAlert}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] font-bold text-sm active:scale-95 transition-all animate-pulse">
              <Bell size={16} /> {t('judgeAlert')}
            </button>
          </div>
        </div>

        {/* Pending votes from other judges */}
        {pendingVotes.filter(v => v.judgeId !== judgeId && v.status === 'pending' && !v.votes[judgeId]).map(vote => (
          <div key={vote.id} className="panel p-3 border-2 border-[hsl(var(--gold))]/50 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-[hsl(var(--gold))] font-display font-bold">{t('scoreRequest')}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">{vote.judgeName}</div>
            </div>
            <div className="text-sm text-[hsl(var(--foreground))] mb-3 text-center">
              {SCORE_LABELS[vote.type]} → <span className={vote.player === 'chung' ? 'text-[hsl(var(--chung))]' : 'text-[hsl(var(--hong))]'}>{vote.player.toUpperCase()}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleVote(vote.id, 'approve')}
                className="flex-1 py-2 rounded-lg bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] font-bold text-sm active:scale-95">
                ✓ {t('voteApprove')}
              </button>
              <button onClick={() => handleVote(vote.id, 'reject')}
                className="flex-1 py-2 rounded-lg bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] font-bold text-sm active:scale-95">
                ✗ {t('voteReject')}
              </button>
            </div>
          </div>
        ))}

        {/* Current scores. Hong (red) shown on the left, Chung (blue) on the
            right — matches the same left/right convention now used on the
            Operator screen; only the public audience screen keeps the
            opposite (blue-left/red-right) layout. */}
        <div className="flex gap-3">
          <div className="flex-1 panel p-3 text-center border-2 border-[hsl(var(--hong))]/30">
            <div className="text-xs text-[hsl(var(--hong))] font-bold">{t('hong')}</div>
            <div className="score-display text-3xl text-[hsl(var(--hong))]">
              {state.config.scoreResetPerRound ? currentHongScore : state.hong.totalScore}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] flex items-center justify-center gap-1 mt-0.5">
              <FlagImage code={state.hong.player.nationality} size={20} className="h-3.5 w-5 rounded-sm" />
              {state.hong.player.name || t('red')}
            </div>
            <div className="mt-1 flex justify-center"><GamjeomCircles count={state.hong.gamjeomCount} /></div>
          </div>
          <div className="flex-1 panel p-3 text-center border-2 border-[hsl(var(--chung))]/30">
            <div className="text-xs text-[hsl(var(--chung))] font-bold">{t('chung')}</div>
            <div className="score-display text-3xl text-[hsl(var(--chung))]">
              {state.config.scoreResetPerRound ? currentChungScore : state.chung.totalScore}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] flex items-center justify-center gap-1 mt-0.5">
              <FlagImage code={state.chung.player.nationality} size={20} className="h-3.5 w-5 rounded-sm" />
              {state.chung.player.name || t('blue')}
            </div>
            <div className="mt-1 flex justify-center"><GamjeomCircles count={state.chung.gamjeomCount} /></div>
          </div>
        </div>

        {/* Score selection */}
        <div className="panel p-4">
          <h3 className="font-display text-xs text-[hsl(var(--muted-foreground))] mb-3">{t('selectScoreType')}</h3>
          <div className="grid grid-cols-3 gap-2">
            {scoreTypes.map(({ type, label, points }) => (
              <button key={type}
                onClick={() => setPendingScore(prev => prev?.type === type ? null : { ...prev!, type })}
                className={`px-3 py-3 rounded-lg text-sm font-semibold transition-all active:scale-95 ${
                  pendingScore?.type === type
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] ring-2 ring-[hsl(var(--primary))]'
                    : type === 'gamjeom'
                      ? 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border border-[hsl(var(--warning))]/30'
                      : 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))]'
                }`}>
                <div className="flex items-center justify-center gap-1 text-xs opacity-70">
                  {SCORE_ICONS[type]} {label}
                </div>
                <div className="font-display text-lg">{type === 'gamjeom' ? '⚠' : type === 'warning' ? '⚠ 0' : `+${points}`}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Player selection + Send */}
        <div className="panel p-4">
          <h3 className="font-display text-xs text-[hsl(var(--muted-foreground))] mb-3">{t('assignToPlayer')}</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setPendingScore(prev => prev ? { ...prev, player: 'hong' } : { player: 'hong', type: 'punch' })}
              className={`flex-1 py-4 rounded-xl font-display font-bold text-lg transition-all active:scale-95 ${
                pendingScore?.player === 'hong'
                  ? 'btn-hong ring-2 ring-[hsl(var(--hong))]'
                  : 'bg-[hsl(var(--hong))]/10 text-[hsl(var(--hong))] border border-[hsl(var(--hong))]/30'
              }`}>
              {t('hong')}
            </button>
            <button
              onClick={() => setPendingScore(prev => prev ? { ...prev, player: 'chung' } : { player: 'chung', type: 'punch' })}
              className={`flex-1 py-4 rounded-xl font-display font-bold text-lg transition-all active:scale-95 ${
                pendingScore?.player === 'chung'
                  ? 'btn-chung ring-2 ring-[hsl(var(--chung))]'
                  : 'bg-[hsl(var(--chung))]/10 text-[hsl(var(--chung))] border border-[hsl(var(--chung))]/30'
              }`}>
              {t('chung')}
            </button>
          </div>

          {pendingScore?.player && pendingScore?.type && (
            <button onClick={handleSendScore}
              className="btn-power w-full mt-4 py-3 rounded-xl font-display text-sm flex items-center justify-center gap-2">
              <Send size={16} />
              {t('scoreRequest')}: {SCORE_LABELS[pendingScore.type]} → {pendingScore.player.toUpperCase()}
            </button>
          )}
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-2 text-center">
            Score will be sent for majority approval
          </p>
        </div>

        {/* Pending votes status */}
        {pendingVotes.filter(v => v.judgeId === judgeId && v.status === 'pending').length > 0 && (
          <div className="panel p-3">
            <h3 className="font-display text-xs text-[hsl(var(--muted-foreground))] mb-2">{t('pendingApproval')}</h3>
            {pendingVotes.filter(v => v.judgeId === judgeId && v.status === 'pending').map(v => (
              <div key={v.id} className="flex items-center justify-between text-sm py-1">
                <span>{SCORE_LABELS[v.type]} → {v.player.toUpperCase()}</span>
                <span className="text-[hsl(var(--warning))] text-xs animate-pulse">
                  ⏳ {(Object.values(v.votes) as any[]).reduce((s, x) => s + Number(x?.weight || 0), 0)}/{2 + connectedJudgeCount} weight
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
