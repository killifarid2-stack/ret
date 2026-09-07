// ---------------------------------------------------------------------------
// Connection-mode switch for the referee desktop app: 'internet' (Supabase
// Realtime — used so the separate in-browser /judge page can reach this
// match from anywhere) or 'wifi' (offline WebSocket server over the local
// Wi-Fi network/hotspot for the standalone Side Judge Android app — no
// internet needed, both devices just need to be on the same network).
//
// Bluetooth has been removed entirely: the Side Judge Android app only
// ever connects over local Wi-Fi now, so there is nothing left for a
// Bluetooth central/peripheral pairing to talk to.
//
// This is the desktop-side counterpart of the side-judge app's
// src/lib/judgeTransport.ts — same idea, same tiny Supabase-RealtimeChannel-
// shaped interface, so OperatorScreen.tsx doesn't need to know which
// transport is active.
// ---------------------------------------------------------------------------
import { supabase } from '@/integrations/supabase/client';
import * as wifi from './localWifiCentral';

export type ConnectionMode = 'internet' | 'wifi';
const MODE_KEY = 'tkd-connection-mode';

export function getConnectionMode(): ConnectionMode {
  return (localStorage.getItem(MODE_KEY) as ConnectionMode) || 'internet';
}

export function setConnectionMode(mode: ConnectionMode) {
  localStorage.setItem(MODE_KEY, mode);
}

type JudgeChannelName = 'judge-votes' | 'match-sync';

/** Special internal-only event: tells every connected judge phone the total
 *  connected-judge count, since in a star topology (local Wi-Fi) a judge's
 *  phone has no other way of knowing about the other judges (no
 *  phone-to-phone link, only phone<->desktop). */
const PRESENCE_COUNT_EVENT = '__presence_count__';

// Full match-state broadcasts fire on every state change (including the
// once-a-second timer tick) — fine over the internet, but flooding the
// local Wi-Fi socket with a full state JSON every second would starve the
// judge-vote traffic that actually needs to be fast. This throttles
// 'match-sync'/'match-state' specifically, in Wi-Fi mode only, to a fixed
// cadence with a trailing send so the latest state lands quickly without flooding
// even if a burst of changes just happened.
const OFFLINE_STATE_THROTTLE_MS = 50;
const stateThrottleTimers = new Map<ConnectionMode, ReturnType<typeof setTimeout> | null>();
const pendingStatePayloads = new Map<ConnectionMode, unknown>();

function throttledSendMatchState(mode: ConnectionMode, transport: typeof wifi, payload: unknown) {
  pendingStatePayloads.set(mode, payload);
  if (stateThrottleTimers.get(mode)) return;
  stateThrottleTimers.set(mode, setTimeout(() => {
    stateThrottleTimers.set(mode, null);
    const toSend = pendingStatePayloads.get(mode);
    pendingStatePayloads.delete(mode);
    void transport.sendToAllJudges('match-sync', 'match-state', toSend);
  }, OFFLINE_STATE_THROTTLE_MS));
}

type BroadcastCb = (msg: { payload: any }) => void;
type PresenceCb = () => void;

/** Shim matching the tiny slice of the Supabase RealtimeChannel interface
 *  this app actually uses (.on/.subscribe/.send/presenceState), backed by
 *  the local Wi-Fi server instead of Supabase. */
class RelayChannelShim {
  private broadcastHandlers = new Map<string, BroadcastCb[]>();
  private presenceHandlers: PresenceCb[] = [];
  private unsubMsg: (() => void) | null = null;
  private unsubPresence: (() => void) | null = null;

  constructor(private channelName: JudgeChannelName, private mode: ConnectionMode, private transport: typeof wifi) {}

  on(kind: 'broadcast' | 'presence', filter: { event: string }, cb: any) {
    if (kind === 'broadcast') {
      const list = this.broadcastHandlers.get(filter.event) || [];
      list.push(cb);
      this.broadcastHandlers.set(filter.event, list);
    } else {
      this.presenceHandlers.push(cb);
    }
    return this;
  }

  presenceState() {
    const state: Record<string, unknown[]> = {};
    for (let i = 0; i < this.transport.getConnectedCount(); i++) state[`judge-${i}`] = [{}];
    return state;
  }

  subscribe(cb?: (status: string) => void) {
    this.unsubMsg = this.transport.onMessage((channel, event, payload, fromJudgeId) => {
      if (channel !== this.channelName) return;
      (this.broadcastHandlers.get(event) || []).forEach(h => h({ payload }));
      // Relay to every OTHER judge phone too. Every message that reaches us
      // here came in from a judge phone (the desktop's own sends go out
      // directly via send() below, never loop back through here) — so
      // without this relay, judge B and judge C never find out judge A
      // just requested/voted on a score, since there's no direct
      // phone-to-phone link (star topology: each phone only talks to this
      // computer).
      void this.transport.sendToJudgesExcept(fromJudgeId, this.channelName, event, payload);
    });
    this.unsubPresence = this.transport.onPresenceChange(() => {
      this.presenceHandlers.forEach(h => h());
      // Keep every judge's "N judges connected" display in sync whenever
      // someone joins/leaves.
      void this.transport.sendToAllJudges('judge-votes', PRESENCE_COUNT_EVENT, { count: this.transport.getConnectedCount() });
    });
    // Fire once immediately, the way a real Supabase channel's presence
    // 'sync' always fires right after subscribing — otherwise a judge who
    // connected over Wi-Fi *before* the operator switched into this mode
    // (e.g. connected first, mode auto-switched a tick later) stays
    // invisible in "Judges Connected" until the next join/leave event.
    this.presenceHandlers.forEach(h => h());
    cb?.('SUBSCRIBED');
    return this;
  }

  send(msg: { type: 'broadcast'; event: string; payload: unknown }) {
    if (this.channelName === 'match-sync' && msg.event === 'match-state') {
      throttledSendMatchState(this.mode, this.transport, msg.payload);
      return;
    }
    void this.transport.sendToAllJudges(this.channelName, msg.event, msg.payload);
  }

  teardown() {
    this.unsubMsg?.();
    this.unsubPresence?.();
    this.broadcastHandlers.clear();
    this.presenceHandlers = [];
  }
}

const relayShims = new Map<string, RelayChannelShim>();

export function getChannel(name: JudgeChannelName) {
  const mode = getConnectionMode();
  if (mode === 'internet') {
    return supabase.channel(name);
  }
  const key = `wifi:${name}`;
  let shim = relayShims.get(key);
  if (!shim) { shim = new RelayChannelShim(name, mode, wifi); relayShims.set(key, shim); }
  return shim;
}

export function teardownChannel(channel: any) {
  if (channel instanceof RelayChannelShim) {
    channel.teardown();
  } else {
    supabase.removeChannel(channel);
  }
}
