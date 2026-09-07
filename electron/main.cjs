const { app, BrowserWindow, screen, ipcMain, shell, dialog, session } = require('electron');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Let the splash intro video autoplay with sound immediately on launch —
// Chromium's default autoplay policy otherwise requires a prior user
// gesture, which would leave the intro either silent or stuck.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// ---------------------------------------------------------------------------
// GPU/black-screen fix
// ---------------------------------------------------------------------------
// FIX for "the app opens but the whole window just stays solid black
// forever" — the most common real-world cause of this exact symptom on
// packaged Windows Electron apps is a GPU-compositor failure: on some
// Intel integrated GPUs, outdated/blocked graphics drivers, inside a VM,
// or over Remote Desktop, Chromium's GPU process never produces a first
// composited frame, so the window paints nothing but the backgroundColor
// we set (#000000, chosen for the splash) and just sits there — no error,
// no crash, nothing in the renderer's console because the renderer itself
// may be running fine, its output just never reaches the screen.
// `--disable-gpu-compositing` keeps GPU-accelerated video decode (so the
// splash intro still plays smoothly) but forces frame *compositing* onto
// the software path, which is what actually fails on the affected
// machines. This is a no-op / unnoticeable on machines that were never
// affected, so it's safe to always apply rather than only after a user
// reports the bug.
app.commandLine.appendSwitch('disable-gpu-compositing');
// Belt-and-braces: some driver/VM combinations still fail even with only
// compositing disabled. If a user reports the window is STILL black after
// this, set WAB_TKD_FORCE_SOFTWARE=1 in the environment (or uncomment the
// line below) to fall back to fully software rendering, which fixes the
// remaining cases at the cost of extra CPU use during the splash video.
if (process.env.WAB_TKD_FORCE_SOFTWARE === '1') {
  app.disableHardwareAcceleration();
}

// ---------------------------------------------------------------------------
// Single-instance lock
// ---------------------------------------------------------------------------
// CRITICAL FIX for judge-score duplication: this app had no protection at
// all against being launched more than once. Every extra launch (a second
// double-click on the icon, a leftover instance from a previous session
// that never fully closed, Windows relaunching after an update, ...)
// starts a completely independent Electron process — each with its own
// Operator window, each opening its OWN separate subscription to the same
// Supabase 'judge-votes' realtime channel with the same credentials. A
// single side-judge tap then reaches every running instance at once, and
// each instance independently dispatches ADD_SCORE against its own local
// match state and re-broadcasts it on 'match-sync' — so "one tap became
// x2/x4/x8" tracked exactly how many copies of the app happened to be
// running, not anything wrong in the vote-handling logic itself (which was
// already hardened against duplicate delivery *within* one instance).
//
// requestSingleInstanceLock() makes every launch after the first one exit
// immediately instead of opening a second, independently-subscribing copy;
// the 'second-instance' handler below just refocuses the window that's
// already open, which is what the operator wanted anyway.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = operatorWin || BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Persisted config (selected external display for the Public Scoreboard)
// ---------------------------------------------------------------------------
const CONFIG_PATH = path.join(app.getPath('userData'), 'display-config.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return { selectedDisplayId: null };
  }
}

function writeConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.error('[display-config] write failed', e);
  }
}

let config = readConfig();

// ---------------------------------------------------------------------------
// Window state
// ---------------------------------------------------------------------------
let operatorWin = null;
const publicWins = new Map();
let publicWin = null;
/** true when the operator explicitly closed the public display while the
 *  target screen was still connected — prevents auto-reopen until the user
 *  reopens it manually or the screen is unplugged/replugged. */
let manuallyClosed = false;

const INDEX_HTML = path.join(__dirname, '../dist/index.html');
const PRELOAD = path.join(__dirname, 'preload.cjs');
const ICON = path.join(__dirname, '../public/app-icon.ico');

const SECURE_STORE_DIR = path.join(app.getPath('userData'), 'secure-store');
function secureStorePath(key) { return path.join(SECURE_STORE_DIR, `${key.replace(/[^a-z0-9_-]/gi, '_')}.bin`); }
function secureStoreGet(key) {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const file = secureStorePath(key);
    if (!fs.existsSync(file)) return null;
    return safeStorage.decryptString(fs.readFileSync(file));
  } catch (e) { console.error('[secure-store] read failed', e); return null; }
}
function secureStoreSet(key, value) {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false;
    fs.mkdirSync(SECURE_STORE_DIR, { recursive: true });
    const encrypted = safeStorage.encryptString(String(value));
    fs.writeFileSync(secureStorePath(key), encrypted);
    return true;
  } catch (e) { console.error('[secure-store] write failed', e); return false; }
}
function secureStoreDelete(key) {
  try { fs.rmSync(secureStorePath(key), { force: true }); return true; } catch { return false; }
}

const TRUSTED_EXTERNAL_PROTOCOLS = new Set(['https:']);
function isTrustedRenderer(event, { allowPublic = false } = {}) {
  const sender = event?.sender;
  if (!sender || sender.isDestroyed()) return false;
  const trusted = [];
  if (operatorWin && !operatorWin.isDestroyed()) trusted.push(operatorWin.webContents.id);
  if (allowPublic) for (const win of publicWins.values()) if (win && !win.isDestroyed()) trusted.push(win.webContents.id);
  if (!trusted.includes(sender.id)) return false;
  const frameUrl = event?.senderFrame?.url || sender.getURL?.() || '';
  try {
    const parsed = new URL(frameUrl);
    const expected = new URL('file://' + INDEX_HTML);
    return parsed.protocol === expected.protocol && parsed.pathname === expected.pathname;
  } catch { return false; }
}
function requireTrustedRenderer(event, options) {
  if (!isTrustedRenderer(event, options)) throw new Error('Untrusted IPC sender');
  return true;
}
function installContentSecurityPolicy() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    const csp = "default-src 'self' data: blob:; base-uri 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; media-src 'self' data: blob: https:; frame-src 'self' https:; worker-src 'self' blob:; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";
    headers['Content-Security-Policy'] = [csp];
    callback({ responseHeaders: headers });
  });
}

// ---------------------------------------------------------------------------
// loadFile diagnostics
// ---------------------------------------------------------------------------
// FIX for "black screen, forever, with zero feedback": every window here
// used to call win.loadFile(INDEX_HTML) with no error handling at all. If
// dist/index.html doesn't exist — e.g. someone ran `electron-builder`
// without `vite build` first, or packaged from a folder where `dist/` was
// never committed/copied — loadFile() rejects, nobody ever calls
// `.catch()` on it, so it becomes a silent unhandled promise rejection.
// The BrowserWindow itself still fires 'ready-to-show' (an empty Chromium
// page counts as "ready"), so `win.show()` still runs — the operator sees
// exactly one thing: the window's backgroundColor, #000000, forever. No
// crash dialog, no console output the operator would ever see, nothing.
// This checks for the file up front and, if it's missing, shows a real
// Windows error dialog explaining exactly what to do instead of silently
// showing a black window. It also catches any other load failure
// (did-fail-load) the same way, so a black screen always comes with an
// explanation now.
function ensureDevBuild() {
  if (fs.existsSync(INDEX_HTML)) return true;
  // `npx electron .` is a common development launch path for this project.
  // If the renderer has not been built yet, build it automatically instead
  // of opening a blank/error window because dist/index.html is missing.
  // Packaged apps are never rebuilt here: their dist is expected to be
  // bundled by electron-builder.
  if (app.isPackaged) return false;
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  console.log('[WAB-TKD] dist/index.html missing; running npm run build before Electron launch...');
  const result = spawnSync(npmCmd, ['run', 'build'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: false,
    windowsHide: false,
  });
  if (result.error) {
    console.error('[WAB-TKD] automatic build failed to start:', result.error);
    return false;
  }
  if (result.status !== 0 || !fs.existsSync(INDEX_HTML)) {
    console.error('[WAB-TKD] automatic build failed; status:', result.status);
    return false;
  }
  return true;
}

function verifyBuildExists() {
  if (!ensureDevBuild()) {
  if (!fs.existsSync(INDEX_HTML)) {
    dialog.showErrorBox(
      'WAB-TKD — Build missing / البناء غير موجود',
      'dist/index.html was not found next to this app.\n\n' +
      'This means the web app was never built (or the dist folder was not ' +
      'included when this copy was packaged). Run:\n\n' +
      '  npm install\n  npm run build\n  npm run electron:build\n\n' +
      '(and make sure "dist" is not excluded/ignored before packaging).\n\n' +
      '——————————————\n' +
      'لم يتم العثور على dist/index.html بجانب هذا التطبيق.\n' +
      'هذا يعني أن التطبيق لم يُبنَ (npm run build) قبل التغليف، أو أن مجلد ' +
      'dist لم يُدرج عند تجهيز هذه النسخة. نفّذ الأوامر أعلاه ثم أعد التغليف.'
    );
    app.quit();
    return false;
  }
  }
  return true;
}

function attachLoadDiagnostics(win, label) {
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    // -3 is Chromium's ERR_ABORTED, which fires harmlessly on normal
    // navigations (e.g. HashRouter route changes) — not a real failure.
    if (errorCode === -3) return;
    console.error(`[${label}] failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    dialog.showErrorBox(
      'WAB-TKD — Load failed / فشل التحميل',
      `The ${label} window failed to load the app (${errorDescription}, code ${errorCode}).\n` +
      `Path: ${validatedURL}\n\nPress F12 in the window to open DevTools for more detail.`
    );
  });
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------
function serializeDisplay(d, index) {
  return {
    id: d.id,
    label: `Display ${index + 1} (${d.size.width}x${d.size.height})`,
    bounds: d.bounds,
    size: d.size,
    isPrimary: d.id === screen.getPrimaryDisplay().id,
  };
}

function getAllDisplaysSerialized() {
  return screen.getAllDisplays().map(serializeDisplay);
}

function getExternalDisplays() {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().filter((d) => d.id !== primaryId);
}

function findDisplayById(id) {
  return screen.getAllDisplays().find((d) => d.id === id) || null;
}

function broadcastDisplaysChanged() {
  const payload = getAllDisplaysSerialized();
  if (operatorWin && !operatorWin.isDestroyed()) {
    operatorWin.webContents.send('displays:changed', payload);
  }
}

function broadcastPublicStatus() {
  const openDisplays = Array.from(publicWins.entries())
    .filter(([, win]) => win && !win.isDestroyed())
    .map(([id]) => id);
  const status = {
    open: openDisplays.length > 0,
    displayId: publicWin && !publicWin.isDestroyed() ? publicWin.__displayId : (openDisplays[0] ?? null),
    openDisplays,
  };
  if (operatorWin && !operatorWin.isDestroyed()) {
    operatorWin.webContents.send('public-display:status-changed', status);
  }
}

// ---------------------------------------------------------------------------
// Public (scoreboard) window
// ---------------------------------------------------------------------------
function openPublicWindow(displayId) {
  const externals=getExternalDisplays(); let target=displayId!=null?findDisplayById(displayId):null;
  if(!target&&config.selectedDisplayId!=null)target=findDisplayById(config.selectedDisplayId);
  if(!target)target=externals[0]||null; if(!target)return null;
  const existing=publicWins.get(target.id); if(existing&&!existing.isDestroyed()){existing.focus();return existing;}
  config.selectedDisplayId=target.id; writeConfig(config);
  const win=new BrowserWindow({x:target.bounds.x,y:target.bounds.y,width:target.bounds.width,height:target.bounds.height,icon:ICON,frame:false,show:false,autoHideMenuBar:true,backgroundColor:'#000000',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,preload:PRELOAD}});
  win.__displayId=target.id; win.removeMenu?.(); win.once('ready-to-show',()=>{win.show();win.setFullScreen(true);});
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (TRUSTED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) shell.openExternal(url);
    } catch {}
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    try {
      const targetUrl = new URL(url);
      const appPath = new URL('file://' + INDEX_HTML).pathname;
      if (targetUrl.protocol !== 'file:' || targetUrl.pathname !== appPath) {
        event.preventDefault();
        if (TRUSTED_EXTERNAL_PROTOCOLS.has(targetUrl.protocol)) shell.openExternal(url);
      }
    } catch { event.preventDefault(); }
  });
  attachLoadDiagnostics(win, 'Public Scoreboard');
  win.loadFile(INDEX_HTML,{search:`displayWindow=public&displayId=${encodeURIComponent(target.id)}`}).catch((e)=>console.error('[Public Scoreboard] loadFile rejected:', e));
  // Production safety: DevTools are disabled in packaged builds. For field
  // diagnostics, explicitly opt in with WAB_TKD_DEVTOOLS=1. Public screens
  // must never expose a development console to spectators.
  win.webContents.on('before-input-event',(_event,input)=>{
    if(input.key==='F12'&&input.type==='keyDown' && (!app.isPackaged || process.env.WAB_TKD_DEVTOOLS==='1')) {
      win.webContents.toggleDevTools();
    }
  });
  win.on('closed',()=>{publicWins.delete(target.id);if(publicWin===win)publicWin=null;broadcastPublicStatus();});
  publicWins.set(target.id,win); publicWin=win; broadcastPublicStatus(); return win;
}
function closePublicWindow(manual,displayId){
  if(manual)manuallyClosed=true; const ids=displayId!=null?[displayId]:Array.from(publicWins.keys());
  ids.forEach(id=>{const win=publicWins.get(id);if(win&&!win.isDestroyed())win.close();else publicWins.delete(id);}); broadcastPublicStatus();
}

function movePublicWindowToDisplay(target) {
  if(!publicWin||publicWin.isDestroyed())return; const oldId=publicWin.__displayId;
  publicWin.setFullScreen(false); publicWin.setBounds({x:target.bounds.x,y:target.bounds.y,width:target.bounds.width,height:target.bounds.height}); publicWin.setFullScreen(true); publicWin.__displayId=target.id; publicWins.delete(oldId); publicWins.set(target.id,publicWin);
}

// ---------------------------------------------------------------------------
// Operator (main) window
// ---------------------------------------------------------------------------
function createOperatorWindow() {
  // Renderer navigation must remain inside the packaged app. External links
  // are opened explicitly through the OS instead of replacing our window.

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    resizable: true,
    movable: true,
    icon: ICON,
    autoHideMenuBar: true,
    // Keep the window black (not the default white) and hidden until its
    // first frame is ready, so the splash intro's black screen is the very
    // first thing shown — no white window flash before it.
    show: false,
    backgroundColor: '#000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: PRELOAD,
    },
  });

  win.once('ready-to-show', () => {
    // The window used to open at a fixed 1280x800 regardless of the
    // screen's real size, leaving visible OS chrome/empty space around the
    // app and letting content overflow into scrollbars instead of filling
    // the screen. Maximize it on first show so it always fills the actual
    // screen it opens on.
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (TRUSTED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) shell.openExternal(url);
    } catch {}
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url);
      const appOrigin = new URL('file://' + INDEX_HTML);
      if (target.protocol !== appOrigin.protocol || target.pathname !== appOrigin.pathname) {
        event.preventDefault();
        if (TRUSTED_EXTERNAL_PROTOCOLS.has(target.protocol)) shell.openExternal(url);
      }
    } catch { event.preventDefault(); }
  });

  attachLoadDiagnostics(win, 'Operator');
  win.loadFile(INDEX_HTML).catch((e) => console.error('[Operator] loadFile rejected:', e));

  // F12 opens DevTools on demand if a crash needs investigating again.
  // Production safety: DevTools are disabled in packaged builds. Set
  // WAB_TKD_DEVTOOLS=1 only when a technician explicitly needs diagnostics.
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown' && (!app.isPackaged || process.env.WAB_TKD_DEVTOOLS === '1')) {
      win.webContents.toggleDevTools();
    }
  });

  operatorWin = win;
}

// ---------------------------------------------------------------------------
// Display connect / disconnect handling
// ---------------------------------------------------------------------------
function handleDisplaysChanged() {
  broadcastDisplaysChanged(); const externals=getExternalDisplays();
  for(const [id,win] of Array.from(publicWins.entries())){if(win&&!win.isDestroyed()&&!findDisplayById(id)){win.close();publicWins.delete(id);}}
  const knownIds=new Set(handleDisplaysChanged._lastExternalIds||[]);
  for(const d of externals){if(!knownIds.has(d.id)&&operatorWin&&!operatorWin.isDestroyed())operatorWin.webContents.send('displays:new-external',serializeDisplay(d,screen.getAllDisplays().indexOf(d)));}
  handleDisplaysChanged._lastExternalIds=externals.map(d=>d.id); broadcastPublicStatus();
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.on('match-state-broadcast', (event, state) => {
  if (!isTrustedRenderer(event)) return;
  // Broadcast to EVERY open public display, not only the last window opened.
  // This keeps multi-screen/LED/OBS outputs identical when more than one
  // audience display is active.
  for (const win of publicWins.values()) {
    if (win && !win.isDestroyed()) win.webContents.send('match-state-sync', state);
  }
});

ipcMain.handle('public-display:open', (event, displayId) => {
  requireTrustedRenderer(event);
  openPublicWindow(displayId);
  return { open: true, displayId: publicWin?.__displayId ?? null };
});

ipcMain.handle('public-display:close', (event, displayId) => {
  requireTrustedRenderer(event); closePublicWindow(true,displayId); return {open:publicWins.size>0,displayId:publicWin?.__displayId??null,openDisplays:Array.from(publicWins.keys())}; });

ipcMain.handle('public-display:status', (event) => { requireTrustedRenderer(event); return {open:publicWins.size>0,displayId:publicWin?.__displayId??null,openDisplays:Array.from(publicWins.keys())}; });

ipcMain.handle('displays:get', (event) => { requireTrustedRenderer(event); return getAllDisplaysSerialized(); });

ipcMain.handle('displays:select', (event, displayId) => {
  requireTrustedRenderer(event);
  config.selectedDisplayId = displayId;
  writeConfig(config);
  // If the public display is already open elsewhere, move it live in place.
  if (publicWin && !publicWin.isDestroyed() && publicWin.__displayId !== displayId) {
    const target = findDisplayById(displayId);
    if (target) {
      movePublicWindowToDisplay(target);
      broadcastPublicStatus();
    }
  }
  return { selectedDisplayId: displayId };
});

ipcMain.handle('displays:get-selected', (event) => { requireTrustedRenderer(event); return { selectedDisplayId: config.selectedDisplayId }; });

// Local Network (Wi-Fi) judge connections — offline, no internet needed.
// This is the ONLY judge-connection transport in the app: a plain
// WebSocket server (via the well-established 'ws' package) that judge
// phones on the same Wi-Fi network/hotspot connect to directly. It exists
// in Node (this main process), not the renderer, because only Node can
// open a listening server socket — the renderer only gets IPC events
// forwarded from here.
//
// Protocol (must match src/lib/judgeTransport.ts's createLocalTransport on
// the side-judge app):
//   - Judge phone connects to ws://<this-computer's-LAN-IP>:8787
//   - First message from phone: {type:'hello', judgeId, judgeName}
//   - Further messages from phone: {type: 'score-vote-request' |
//     'score-vote-update' | 'judge-alert' | 'pause-request', payload}
//   - Messages we send to a phone: {event, payload} (event being e.g.
//     'match-state', 'score-vote-request', 'score-vote-result')
// ---------------------------------------------------------------------------
const WebSocketServer = require('ws').Server;
const os = require('os');

const LOCAL_WIFI_PORT = 8787;
// Per-launch pairing secret. It is intentionally never persisted: restarting
// the tournament console invalidates every old judge/viewer pairing.
let LOCAL_WIFI_PAIRING_TOKEN = crypto.randomBytes(32).toString('base64url');
const LOCAL_WIFI_TOKEN_MAX_AGE_MS = 10 * 60 * 1000;
const LOCAL_WIFI_MAX_MESSAGES_PER_WINDOW = 80;
const LOCAL_WIFI_MESSAGE_WINDOW_MS = 10 * 1000;
const LOCAL_WIFI_MAX_STRING_FIELD = 256;
const LOCAL_WIFI_ALLOWED_INBOUND_EVENTS = new Set([
  'score-vote-request', 'score-vote-update', 'judge-alert', 'pause-request',
  'substitution-request', 'ivr-decision', 'sync'
]);
function isSafeWifiPayload(payload) {
  if (payload == null) return true;
  if (typeof payload !== 'object' || Array.isArray(payload)) return false;
  try { return JSON.stringify(payload).length <= 48 * 1024; } catch { return false; }
}
function isSafeWifiOutboundEvent(evt) {
  return typeof evt === 'string' && /^[a-z0-9][a-z0-9:_-]{0,63}$/i.test(evt);
}

/** judgeId -> { ws, judgeName } */
const localWifiJudges = new Map();
/** viewerId -> ws — read-only connections (Public Scoreboard / audience
 *  screens running as a plain browser tab on a separate device, e.g. an
 *  Android tablet driving the audience display). They never send scoring
 *  data, only receive whatever we already broadcast to judges (mainly
 *  'match-state'), so they share the exact same connection + broadcast
 *  path as judges instead of needing a second server. */
const localWifiViewers = new Map();
let localWifiServer = null;
let wifiRestartAttempts = 0;
let wifiRestartTimer = null;
/** Last known state of the local Wi-Fi server, surfaced to the renderer so
 *  the operator sees immediately whether judge phones even CAN connect,
 *  instead of only finding out when a judge complains. */
let wifiStatus = { state: 'starting', error: null };

function setWifiStatus(state, error) {
  wifiStatus = { state, error: error ? String(error) : null };
  operatorWin?.webContents.send('local-wifi-status', wifiStatus);
}

// Interface name patterns that are virtual/tunnel adapters rather than a
// real Wi-Fi or Ethernet card — VPN clients, hypervisor virtual switches,
// container bridges, mesh-VPN tools, etc. These often enumerate ahead of
// the real Wi-Fi adapter in os.networkInterfaces(), and their IP is
// invisible to any other device on the venue's actual Wi-Fi — even though
// this computer really is also joined to that Wi-Fi. Picking one of these
// as ips[0] is exactly what used to break the "same Wi-Fi, still can't
// connect" case: the QR/displayed address pointed at an unreachable
// virtual network instead of the real one.
const VIRTUAL_ADAPTER_NAME_PATTERN = /vethernet|virtualbox|vmware|hyper-v|docker|tailscale|zerotier|wireguard|tun\d*|tap\d*|utun\d*|ppp\d*|loopback|npcap|hamachi|radmin|anydesk/i;

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const real = [];
  const virtual = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      // 169.254.x.x (APIPA) means the adapter never got a real DHCP lease —
      // no other device can ever reach it, so it's worse than useless here.
      if (net.address.startsWith('169.254.')) continue;
      (VIRTUAL_ADAPTER_NAME_PATTERN.test(name) ? virtual : real).push(net.address);
    }
  }
  // Real Wi-Fi/Ethernet adapters first (so ips[0] — what the QR code
  // encodes — is the one judge phones can actually reach), then fall back
  // to anything else we filtered out rather than showing nothing.
  return [...real, ...virtual];
}

function safeTokenEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function isValidWifiHello(msg) {
  return safeTokenEquals(msg?.token, LOCAL_WIFI_PAIRING_TOKEN);
}

function broadcastLocalWifiPresence() {
  const list = Array.from(localWifiJudges.entries()).map(([id, j]) => ({ id, name: j.judgeName }));
  operatorWin?.webContents.send('local-wifi-presence', list);
}

// ---------------------------------------------------------------------------
// Auto-detect IP changes — the operator screen/QR code used to only ever
// read the computer's IP once (at server start, or when someone manually
// clicked "Re-check"). But the address a judge phone needs to type/scan
// changes any time this computer:
//   - joins a different Wi-Fi network or hotspot mid-event,
//   - gets a new DHCP lease (routers renew these periodically, especially
//     ones with short lease times common on venue/guest networks),
//   - has its own hotspot toggled off then on again.
// None of those events crash or close the WebSocket server (it's bound to
// 0.0.0.0, so it keeps running fine) — they just silently make the address
// displayed to judges stale, which looks exactly like "sometimes it just
// doesn't connect" from the operator's side, since nothing here ever
// failed or errored. Polling every 4s and pushing a fresh list the instant
// it changes means the operator/QR code self-updates without anyone
// needing to notice and press "Re-check" manually.
let lastKnownIps = [];
function ipListsEqual(a, b) {
  return a.length === b.length && a.every((ip, i) => ip === b[i]);
}
function startIpWatcher() {
  lastKnownIps = getLocalIPs();
  setInterval(() => {
    const current = getLocalIPs();
    if (!ipListsEqual(current, lastKnownIps)) {
      lastKnownIps = current;
      operatorWin?.webContents.send('local-wifi-info', { port: LOCAL_WIFI_PORT, ips: current });
    }
  }, 4000);
}

// Judge phones connecting "sometimes but not always" almost always traces
// back to one of two silent failures that had NO handling before:
//   1. The port was still held by a previous instance of this app that
//      didn't fully release it yet (EADDRINUSE) — the server object never
//      even finished binding, so every "connection" attempt from a phone
//      just times out with no error shown anywhere.
//   2. Some other transient OS-level socket error right after start.
// Both now get caught, surfaced to the operator (instead of failing
// silently), and retried automatically with a short backoff — and the
// operator also gets a manual "Restart Wi-Fi" action for the rare case the
// automatic retries don't recover (e.g. the OS firewall prompt was
// dismissed without allowing the app).
function startLocalWifiServer() {
  if (localWifiServer) return;
  if (wifiRestartTimer) { clearTimeout(wifiRestartTimer); wifiRestartTimer = null; }
  setWifiStatus('starting');

  let server;
  try {
    server = new WebSocketServer({ host: '0.0.0.0', port: LOCAL_WIFI_PORT, maxPayload: 64 * 1024 });
  } catch (e) {
    scheduleWifiRestart(e);
    return;
  }
  localWifiServer = server;

  server.on('error', (err) => {
    // EADDRINUSE etc. — tear down this half-started attempt and retry
    // rather than leaving localWifiServer pointing at a dead server, which
    // would otherwise permanently block every future connection attempt
    // until the whole app was relaunched.
    localWifiServer = null;
    try { server.close(); } catch { /* already broken */ }
    scheduleWifiRestart(err);
  });

  server.on('listening', () => {
    wifiRestartAttempts = 0;
    setWifiStatus('listening');
  });

  server.on('connection', (ws) => {
    let judgeId = null;
    let viewerId = null;
    let authenticated = false;
    const connectedAt = Date.now();
    let messageWindowStartedAt = connectedAt;
    let messageCountInWindow = 0;
    const authTimeout = setTimeout(() => {
      if (!authenticated) { try { ws.close(1008, 'Authentication timeout'); } catch {} }
    }, 10000);

    // Heartbeat — without this, a connection that's been open but silent
    // for a while (e.g. sitting on the standby splash screen before the
    // operator starts the match, or a long rest period) can be dropped
    // dead-silent by a router's NAT idle timeout or a phone's Wi-Fi
    // power-saving mode, with neither side ever getting a 'close' event.
    // The judge phone then shows "connected" while nothing actually
    // reaches the operator anymore. Pinging every 20s (a) keeps the NAT
    // mapping alive so routers don't time it out, and (b) lets us detect
    // and clean up a truly-dead socket via a missed pong, instead of it
    // lingering as a phantom connection.
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      if (raw.length > 16 * 1024) {
        try { ws.close(1009, 'Message too large'); } catch {}
        return;
      }
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string' || msg.type.length > LOCAL_WIFI_MAX_STRING_FIELD) return;
      const now = Date.now();
      if (now - messageWindowStartedAt >= LOCAL_WIFI_MESSAGE_WINDOW_MS) {
        messageWindowStartedAt = now;
        messageCountInWindow = 0;
      }
      messageCountInWindow += 1;
      if (messageCountInWindow > LOCAL_WIFI_MAX_MESSAGES_PER_WINDOW) {
        try { ws.send(JSON.stringify({ event: 'auth-error', payload: { code: 'RATE_LIMITED' } })); } catch {}
        try { ws.close(1008, 'Rate limit exceeded'); } catch {}
        return;
      }

      if (msg.type === 'hello') {
        if (!isValidWifiHello(msg) || Date.now() - connectedAt > LOCAL_WIFI_TOKEN_MAX_AGE_MS) {
          try { ws.send(JSON.stringify({ event: 'auth-error', payload: { code: 'PAIRING_TOKEN_REQUIRED' } })); } catch {}
          ws.close(1008, 'Pairing required');
          return;
        }
        if (typeof msg.judgeId !== 'string' || !msg.judgeId.trim() || msg.judgeId.length > 128) {
          ws.close(1008, 'Invalid judge id');
          return;
        }
        authenticated = true;
        judgeId = msg.judgeId.trim();
        const previous = localWifiJudges.get(judgeId);
        if (previous?.ws && previous.ws !== ws) { try { previous.ws.close(4001, 'Replaced by newer pairing'); } catch {} }
        localWifiJudges.set(judgeId, { ws, judgeName: typeof msg.judgeName === 'string' ? msg.judgeName.slice(0, 120) : 'Judge' });
        broadcastLocalWifiPresence();
        return;
      }

      // Audience/public scoreboard screens identify with 'hello-viewer'
      // instead of 'hello' — read-only, no judgeName/vote traffic, just
      // registers so it receives the same broadcasts judges get.
      if (msg.type === 'hello-viewer') {
        if (!isValidWifiHello(msg) || Date.now() - connectedAt > LOCAL_WIFI_TOKEN_MAX_AGE_MS) {
          try { ws.send(JSON.stringify({ event: 'auth-error', payload: { code: 'PAIRING_TOKEN_REQUIRED' } })); } catch {}
          ws.close(1008, 'Pairing required');
          return;
        }
        authenticated = true;
        viewerId = `viewer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        localWifiViewers.set(viewerId, ws);
        return;
      }

      if (!authenticated || !judgeId) return; // authenticated judge must say hello before anything else is meaningful
      if (!LOCAL_WIFI_ALLOWED_INBOUND_EVENTS.has(msg.type) || !isSafeWifiPayload(msg.payload)) {
        try { ws.send(JSON.stringify({ event: 'protocol-error', payload: { code: 'EVENT_NOT_ALLOWED' } })); } catch {}
        return;
      }

      // Forward to the operator window to process, and relay to every
      // OTHER connected judge phone — there's no phone-to-phone link here,
      // each phone only talks to this computer (star topology).
      operatorWin?.webContents.send('local-wifi-message', { judgeId, event: msg.type, payload: msg.payload });
      for (const [otherId, j] of localWifiJudges) {
        if (otherId !== judgeId && j.ws.readyState === 1) {
          j.ws.send(JSON.stringify({ event: msg.type, payload: msg.payload }));
        }
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      if (judgeId) {
        localWifiJudges.delete(judgeId);
        broadcastLocalWifiPresence();
      }
      if (viewerId) {
        localWifiViewers.delete(viewerId);
      }
    });
  });

  // Every 20s: ping every open socket. Any socket that didn't answer the
  // PREVIOUS ping (isAlive still false) is dead — terminate() it, which
  // fires that socket's own 'close' handler above and does the normal
  // judge/viewer cleanup + presence update. 20s comfortably beats the
  // ~30-300s idle timeouts typical of home/venue routers and phone OSes.
  const wifiHeartbeatInterval = setInterval(() => {
    if (!localWifiServer) return;
    localWifiServer.clients.forEach((ws) => {
      if (ws.isAlive === false) { ws.terminate(); return; }
      ws.isAlive = false;
      try { ws.ping(); } catch { /* socket already going away */ }
    });
  }, 20000);
  server.on('close', () => clearInterval(wifiHeartbeatInterval));
}

/** Backoff: 1s, 2s, 4s, 8s, capped at 15s — fast enough that a busy port
 *  from an app that just closed clears up within a couple of attempts,
 *  without hammering the OS if something is persistently wrong. */
function scheduleWifiRestart(err) {
  wifiRestartAttempts += 1;
  setWifiStatus('error', err && err.code === 'EADDRINUSE'
    ? `Port ${LOCAL_WIFI_PORT} is still in use (retrying…)`
    : err);
  const delay = Math.min(15000, 1000 * Math.pow(2, Math.min(wifiRestartAttempts - 1, 4)));
  wifiRestartTimer = setTimeout(() => { wifiRestartTimer = null; startLocalWifiServer(); }, delay);
}

/** Manual restart, exposed to the operator UI — for the rare case (e.g. a
 *  firewall prompt dismissed without allowing the app, or the Wi-Fi
 *  adapter itself was toggled) where the automatic retry above isn't
 *  enough and the operator needs to explicitly try again. */
function restartLocalWifiServer() {
  // Rotate the pairing secret whenever the operator explicitly restarts the
  // Wi-Fi service. This makes RESTART a real security boundary: a phone that
  // only knows an old token cannot silently reconnect after a restart.
  LOCAL_WIFI_PAIRING_TOKEN = crypto.randomBytes(32).toString('base64url');
  operatorWin?.webContents.send('local-wifi-info', { port: LOCAL_WIFI_PORT, ips: getLocalIPs(), token: LOCAL_WIFI_PAIRING_TOKEN });
  wifiRestartAttempts = 0;
  if (wifiRestartTimer) { clearTimeout(wifiRestartTimer); wifiRestartTimer = null; }
  if (localWifiServer) {
    const old = localWifiServer;
    localWifiServer = null;
    try { old.removeAllListeners(); old.close(() => startLocalWifiServer()); } catch { startLocalWifiServer(); }
  } else {
    startLocalWifiServer();
  }
}

// Turning THIS computer into the access point (rather than just joining an
// existing one) needs the OS's own Wi-Fi hotspot feature — creating a real
// 802.11 access point isn't something Node/Electron can do directly; it
// needs OS-level drivers and admin privileges (netsh on Windows, a WinRT
// API on newer builds, Internet Sharing on macOS, nmcli/hostapd on Linux),
// and there's no single cross-platform library that does it reliably from
// a bundled app. What we CAN do reliably: jump the operator straight to the
// right settings screen with one click instead of them hunting for it, so
// turning it on takes seconds. Once it's on, the WebSocket server above
// already accepts judge phones on it — no internet required either way.
ipcMain.handle('local-wifi:open-hotspot-settings', (event) => {
  requireTrustedRenderer(event);
  try {
    if (process.platform === 'win32') {
      shell.openExternal('ms-settings:network-mobilehotspot');
    } else if (process.platform === 'darwin') {
      // macOS has no "mobile hotspot" pane on desktop Macs — the closest
      // equivalent is Internet Sharing under Sharing preferences.
      shell.openExternal('x-apple.systempreferences:com.apple.preferences.sharing');
    } else {
      // No universal deep-link on Linux desktops; fall back to the
      // system Settings app itself, if present.
      shell.openExternal('settings:///');
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('local-wifi:get-info', (event) => { requireTrustedRenderer(event); return { port: LOCAL_WIFI_PORT, ips: getLocalIPs(), token: LOCAL_WIFI_PAIRING_TOKEN }; });
ipcMain.handle('local-wifi:get-status', (event) => { requireTrustedRenderer(event); return wifiStatus; });
ipcMain.handle('local-wifi:restart', (event) => {
  requireTrustedRenderer(event); restartLocalWifiServer(); return { ok: true }; });
ipcMain.handle('local-wifi:get-judges', (event) => { requireTrustedRenderer(event); return Array.from(localWifiJudges.entries()).map(([id, j]) => ({ id, name: j.judgeName })); });
ipcMain.handle('local-wifi:get-viewer-count', (event) => { requireTrustedRenderer(event); return localWifiViewers.size; });

function broadcastToViewers(evt, payload) {
  const msg = JSON.stringify({ event: evt, payload });
  for (const ws of localWifiViewers.values()) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

ipcMain.on('local-wifi:send-to-all', (event, { event: evt, payload }) => {
  if (!isTrustedRenderer(event) || !isSafeWifiOutboundEvent(evt) || !isSafeWifiPayload(payload)) return;
  for (const j of localWifiJudges.values()) {
    if (j.ws.readyState === 1) j.ws.send(JSON.stringify({ event: evt, payload }));
  }
  // Viewers (audience screens) only care about the match-state stream —
  // there's no reason to also forward judge-vote-only chatter to them.
  if (evt === 'match-state') broadcastToViewers(evt, payload);
});
ipcMain.on('local-wifi:send-to-all-except', (event, { excludeJudgeId, event: evt, payload }) => {
  if (!isTrustedRenderer(event) || !isSafeWifiOutboundEvent(evt) || !isSafeWifiPayload(payload)) return;
  for (const [id, j] of localWifiJudges) {
    if (id !== excludeJudgeId && j.ws.readyState === 1) j.ws.send(JSON.stringify({ event: evt, payload }));
  }
  if (evt === 'match-state') broadcastToViewers(evt, payload);
});

// Renderer-facing secure storage. Secrets are encrypted with the OS provider
// (DPAPI on Windows) rather than kept as plaintext JSON/localStorage.
ipcMain.handle('secure-storage:get', (event, key) => {
  requireTrustedRenderer(event);
  if (typeof key !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(key)) return null;
  return secureStoreGet(key);
});
ipcMain.handle('secure-storage:set', (event, key, value) => {
  requireTrustedRenderer(event);
  if (typeof key !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(key) || typeof value !== 'string' || value.length > 2 * 1024 * 1024) return false;
  return secureStoreSet(key, value);
});
ipcMain.handle('secure-storage:delete', (event, key) => {
  requireTrustedRenderer(event);
  if (typeof key !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(key)) return false;
  return secureStoreDelete(key);
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  if (app.isPackaged) installContentSecurityPolicy();
  if (!verifyBuildExists()) return;
  createOperatorWindow();
  startLocalWifiServer();
  startIpWatcher();

  // Existing secondary displays are not opened automatically. The operator
  // chooses the broadcast mode explicitly; newly connected displays trigger
  // the selection prompt in PublicDisplayControl.
  handleDisplaysChanged._lastExternalIds = getExternalDisplays().map(d => d.id);
  screen.on('display-added', handleDisplaysChanged);
  screen.on('display-removed', handleDisplaysChanged);
  screen.on('display-metrics-changed', broadcastDisplaysChanged);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createOperatorWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
