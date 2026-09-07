const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  secureStorageGet: (key) => ipcRenderer.invoke('secure-storage:get', key),
  secureStorageSet: (key, value) => ipcRenderer.invoke('secure-storage:set', key, value),
  secureStorageDelete: (key) => ipcRenderer.invoke('secure-storage:delete', key),

  // ---- Match state sync (operator -> public scoreboard) ----
  broadcastMatchState: (state) => ipcRenderer.send('match-state-broadcast', state),
  onMatchStateSync: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('match-state-sync', listener);
    return () => ipcRenderer.removeListener('match-state-sync', listener);
  },

  // ---- Public display window control ----
  openPublicDisplay: (displayId) => ipcRenderer.invoke('public-display:open', displayId),
  closePublicDisplay: (displayId) => ipcRenderer.invoke('public-display:close', displayId),
  getPublicDisplayStatus: () => ipcRenderer.invoke('public-display:status'),
  onPublicDisplayStatusChanged: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('public-display:status-changed', listener);
    return () => ipcRenderer.removeListener('public-display:status-changed', listener);
  },
  onNewExternalDisplay: (callback) => {
    const listener = (_event, display) => callback(display);
    ipcRenderer.on('displays:new-external', listener);
    return () => ipcRenderer.removeListener('displays:new-external', listener);
  },

  // ---- Display (monitor) discovery / selection ----
  getDisplays: () => ipcRenderer.invoke('displays:get'),
  onDisplaysChanged: (callback) => {
    const listener = (_event, displays) => callback(displays);
    ipcRenderer.on('displays:changed', listener);
    return () => ipcRenderer.removeListener('displays:changed', listener);
  },
  selectDisplay: (displayId) => ipcRenderer.invoke('displays:select', displayId),
  getSelectedDisplay: () => ipcRenderer.invoke('displays:get-selected'),

  // ---- Local Network (Wi-Fi) judge connections (offline, no internet) ----
  getLocalWifiInfo: () => ipcRenderer.invoke('local-wifi:get-info'),
  getLocalWifiStatus: () => ipcRenderer.invoke('local-wifi:get-status'),
  restartLocalWifi: () => ipcRenderer.invoke('local-wifi:restart'),
  openHotspotSettings: () => ipcRenderer.invoke('local-wifi:open-hotspot-settings'),
  getLocalWifiJudges: () => ipcRenderer.invoke('local-wifi:get-judges'),
  onLocalWifiStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('local-wifi-status', listener);
    return () => ipcRenderer.removeListener('local-wifi-status', listener);
  },
  onLocalWifiInfoChanged: (callback) => {
    const listener = (_event, info) => callback(info);
    ipcRenderer.on('local-wifi-info', listener);
    return () => ipcRenderer.removeListener('local-wifi-info', listener);
  },
  sendToAllLocalWifiJudges: (event, payload) => ipcRenderer.send('local-wifi:send-to-all', { event, payload }),
  sendToLocalWifiJudgesExcept: (excludeJudgeId, event, payload) => ipcRenderer.send('local-wifi:send-to-all-except', { excludeJudgeId, event, payload }),
  onLocalWifiMessage: (callback) => {
    const listener = (_event, msg) => callback(msg);
    ipcRenderer.on('local-wifi-message', listener);
    return () => ipcRenderer.removeListener('local-wifi-message', listener);
  },
  onLocalWifiPresence: (callback) => {
    const listener = (_event, list) => callback(list);
    ipcRenderer.on('local-wifi-presence', listener);
    return () => ipcRenderer.removeListener('local-wifi-presence', listener);
  },
});
