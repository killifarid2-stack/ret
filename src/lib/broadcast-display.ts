export type BroadcastDisplayMode='scoreboard'|'mat_announcer'|'upcoming';
export interface BroadcastDisplayConfig { mode: BroadcastDisplayMode; matNumber?: number; }
const KEY='wab-tkd-broadcast-display-config-v2';
const OLD_KEY='wab-tkd-broadcast-display-mode-v1';
function read():Record<string,BroadcastDisplayConfig>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{return{};}}
export function getBroadcastDisplayConfig(displayId?:number|null):BroadcastDisplayConfig{try{const all=read();const k=displayId==null?'default':String(displayId);if(all[k])return all[k];const old=localStorage.getItem(OLD_KEY);return{mode:old==='mat_announcer'?'mat_announcer':'scoreboard'};}catch{return{mode:'scoreboard'};}}
export function setBroadcastDisplayConfig(displayId:number|undefined|null,config:BroadcastDisplayConfig){try{const all=read();all[displayId==null?'default':String(displayId)]=config;localStorage.setItem(KEY,JSON.stringify(all));window.dispatchEvent(new Event('wab-display-config-changed'));}catch{}}
export function getBroadcastDisplayMode(displayId?:number|null):BroadcastDisplayMode{return getBroadcastDisplayConfig(displayId).mode;}
export function setBroadcastDisplayMode(mode:BroadcastDisplayMode,displayId?:number|null){setBroadcastDisplayConfig(displayId,{...getBroadcastDisplayConfig(displayId),mode});}
