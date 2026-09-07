// ---------------------------------------------------------------------------
// Local Network (Wi-Fi) judge connections — the desktop/renderer side.
//
// The actual WebSocket server lives in electron/main.cjs (Node, not the
// renderer — only Node can open a listening server socket). This module
// just bridges that over IPC into the small shape localChannel.ts expects —
// this is the ONLY judge-connection transport in the app (no Bluetooth, no
// cloud/internet channel for judge phones).
// ---------------------------------------------------------------------------
type JudgeChannelName = 'judge-votes' | 'match-sync';

type MessageHandler = (channel: JudgeChannelName, event: string, payload: unknown, fromJudgeId: string) => void;
type PresenceHandler = () => void;

const messageHandlers = new Set<MessageHandler>();
const presenceHandlers = new Set<PresenceHandler>();
let connectedJudges: { id: string; name: string }[] = [];
let wired = false;

function ensureWired() {
  if (wired) return;
  wired = true;
  const api = (window as any).electronAPI;
  if (!api?.onLocalWifiMessage) return; // not running under Electron (e.g. plain browser tab in dev)

  api.onLocalWifiMessage((msg: { judgeId: string; event: string; payload: unknown }) => {
    // Every message the phone sends us is a 'judge-votes'-channel event —
    // match-state only ever flows the other way (desktop -> phone).
    messageHandlers.forEach(cb => cb('judge-votes', msg.event, msg.payload, msg.judgeId));
  });
  api.onLocalWifiPresence((list: { id: string; name: string }[]) => {
    connectedJudges = list;
    presenceHandlers.forEach(cb => cb());
  });
}

export function onMessage(cb: MessageHandler) {
  ensureWired();
  messageHandlers.add(cb);
  return () => { messageHandlers.delete(cb); };
}

export function onPresenceChange(cb: PresenceHandler) {
  ensureWired();
  presenceHandlers.add(cb);
  return () => { presenceHandlers.delete(cb); };
}

export function getConnectedCount() {
  return connectedJudges.length;
}

export function getConnectedJudges() {
  return connectedJudges;
}

export async function sendToAllJudges(_channel: JudgeChannelName, event: string, payload: unknown) {
  (window as any).electronAPI?.sendToAllLocalWifiJudges(event, payload);
}

export async function sendToJudgesExcept(excludeJudgeId: string, _channel: JudgeChannelName, event: string, payload: unknown) {
  (window as any).electronAPI?.sendToLocalWifiJudgesExcept(excludeJudgeId, event, payload);
}

/** For the operator UI: which IP address(es) + port judges should type into
 *  their phone's "Local Network" connection screen. */
export async function getServerInfo(): Promise<{ port: number; ips: string[]; token: string } | null> {
  const api = (window as any).electronAPI;
  if (!api?.getLocalWifiInfo) return null;
  return api.getLocalWifiInfo();
}

export type WifiServerStatus = { state: 'starting' | 'listening' | 'error'; error: string | null };

/** Current health of the local Wi-Fi server (bind succeeded / still
 *  starting / failed and retrying) — lets the operator see immediately
 *  that judge phones can't possibly connect right now instead of only
 *  discovering it once a judge reports a problem. */
export async function getServerStatus(): Promise<WifiServerStatus | null> {
  const api = (window as any).electronAPI;
  if (!api?.getLocalWifiStatus) return null;
  return api.getLocalWifiStatus();
}

export function onServerStatusChange(cb: (status: WifiServerStatus) => void) {
  const api = (window as any).electronAPI;
  if (!api?.onLocalWifiStatus) return () => {};
  return api.onLocalWifiStatus(cb);
}

/** Fires automatically whenever this computer's own address changes
 *  (new network, new DHCP lease, hotspot toggled) — no manual "Re-check"
 *  needed. The operator/QR panel should just re-render with the new info. */
export function onServerInfoChange(cb: (info: { port: number; ips: string[]; token: string }) => void) {
  const api = (window as any).electronAPI;
  if (!api?.onLocalWifiInfoChanged) return () => {};
  return api.onLocalWifiInfoChanged(cb);
}

/** Manual "try again" — closes and re-binds the local Wi-Fi server. Useful
 *  when the automatic retry loop isn't enough (e.g. a firewall prompt was
 *  dismissed, or the Wi-Fi adapter was toggled after the app started). */
export async function restartServer(): Promise<boolean> {
  const api = (window as any).electronAPI;
  if (!api?.restartLocalWifi) return false;
  const res = await api.restartLocalWifi();
  return !!res?.ok;
}

/** One-click shortcut to this OS's own Wi-Fi hotspot settings screen, so the
 *  operator can turn this computer INTO the access point (no router, no
 *  internet) instead of hunting through system settings manually. */
export async function openHotspotSettings(): Promise<boolean> {
  const api = (window as any).electronAPI;
  if (!api?.openHotspotSettings) return false;
  const res = await api.openHotspotSettings();
  return !!res?.ok;
}
