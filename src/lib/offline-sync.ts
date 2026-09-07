/**
 * Durable, local-first synchronization queue.
 *
 * Queue entries are retained until a registered handler completes successfully.
 * This avoids the previous "queue exists but nothing consumes it" dead end.
 * Handlers are intentionally registered by the feature that owns a payload;
 * this module never guesses how a domain record should be written.
 */
export type PendingSyncAction={id:string;type:string;payload:any;createdAt:string};
const KEY='wab-tkd-offline-sync-queue-v2';
const LEGACY_KEY='wab-tkd-offline-sync-queue-v1';
type SyncHandler=(action:PendingSyncAction)=>Promise<boolean>|boolean;
const handlers=new Map<string,SyncHandler>();
let processing=false;

function readRaw(key:string):PendingSyncAction[]{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}}
export function getPendingSyncActions():PendingSyncAction[]{
  const current=readRaw(KEY);
  if(current.length)return current;
  const legacy=readRaw(LEGACY_KEY);
  if(legacy.length){try{localStorage.setItem(KEY,JSON.stringify(legacy));localStorage.removeItem(LEGACY_KEY)}catch{} return legacy;}
  return [];
}
function writeQueue(entries:PendingSyncAction[]){try{localStorage.setItem(KEY,JSON.stringify(entries));window.dispatchEvent(new CustomEvent('wab-sync-queue-changed'));}catch{}}
export function queueSyncAction(type:string,payload:any){
  const existing=getPendingSyncActions();
  // Idempotency: callers may safely enqueue the same logical action twice.
  const fingerprint=JSON.stringify([type,payload]);
  if(existing.some(x=>JSON.stringify([x.type,x.payload])===fingerprint)) return existing.length;
  const next=[...existing,{id:crypto.randomUUID(),type,payload,createdAt:new Date().toISOString()}];
  writeQueue(next); void processPendingSyncActions(); return next.length;
}
export function clearPendingSyncActions(){writeQueue([])}
export function registerSyncHandler(type:string,handler:SyncHandler){handlers.set(type,handler);void processPendingSyncActions();return()=>handlers.delete(type)}
export function unregisterSyncHandler(type:string){handlers.delete(type)}
export function isOnline(){return typeof navigator==='undefined'?true:navigator.onLine;}

export async function processPendingSyncActions():Promise<{processed:number;remaining:number}> {
  if(processing || !isOnline()) return {processed:0,remaining:getPendingSyncActions().length};
  processing=true; let processed=0;
  try {
    let queue=getPendingSyncActions();
    for(const action of [...queue]){
      if(!isOnline()) break;
      const handler=handlers.get(action.type);
      if(!handler) continue; // leave unknown domain actions for their feature to register
      try {
        const ok=await handler(action);
        if(ok){queue=queue.filter(x=>x.id!==action.id);writeQueue(queue);processed++;}
      } catch (error) { console.warn('[offline-sync] action failed; retained for retry',action.type,error); }
    }
    return {processed,remaining:queue.length};
  } finally { processing=false; }
}

if(typeof window!=='undefined'){
  window.addEventListener('online',()=>{void processPendingSyncActions()});
  window.addEventListener('wab-sync-register',()=>{void processPendingSyncActions()});
}
