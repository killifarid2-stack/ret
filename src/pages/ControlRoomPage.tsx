import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { useMatch } from '@/context/MatchContext';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { RefreshCw, Gavel, Radio, Wifi, WifiOff, ShieldCheck } from 'lucide-react';
import {
  MatLiveStatus, MatDisplayStatus, fetchAllMatStatuses,
  getMatCount, setMatCount as saveMatCount,
} from '@/lib/mat-status';

/**
 * MULTI-MAT CONTROL ROOM — /control-room
 *
 * See DOCUMENTATION.md §8 for the full bilingual explanation of why this
 * page exists and exactly what it does and doesn't do. Short version:
 *
 * - Every mat still has exactly ONE operator entering its live scores at
 *   any given moment — this page does NOT let one window score several
 *   matches at the same time. MatchContext (the live match state) is
 *   still exactly one match per window, completely unchanged.
 * - What this page DOES do: show every mat's live status side-by-side
 *   (read from the `mat_live_status` heartbeat table — see mat-status.ts),
 *   and let this window SWITCH which mat it is actively operating, by
 *   navigating to /operator with that mat number applied. That matches
 *   what was actually asked for: "التبديل بين البسطات للتحكم في كل واحد
 *   على حدة" (switch between mats to control each one individually).
 * - Requires a working Supabase connection (this is cross-device by
 *   nature) — shows a clear message instead of silently looking empty
 *   when the cloud isn't configured/reachable, same as the rest of the app.
 */

const STATUS_LABEL: Record<MatDisplayStatus, { ar: string; en: string; color: string }> = {
  idle: { ar: 'خامل', en: 'Idle', color: 'hsl(var(--muted-foreground))' },
  waiting: { ar: 'بانتظار البدء', en: 'Waiting', color: 'hsl(var(--gold))' },
  running: { ar: 'جارٍ الآن', en: 'Running', color: 'hsl(var(--success))' },
  paused: { ar: 'متوقف مؤقتًا', en: 'Paused', color: 'hsl(var(--gold))' },
  finished: { ar: 'انتهت', en: 'Finished', color: 'hsl(var(--muted-foreground))' },
};

export default function ControlRoomPage() {
  const { lang } = useI18n();
  const isAr = lang === 'ar';
  const navigate = useNavigate();
  const { dispatch } = useMatch();

  const [statuses, setStatuses] = useState<MatLiveStatus[]>([]);
  const [matCount, setMatCountState] = useState(getMatCount());
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [wifi, setWifi] = useState<{state:string;error:string|null;judges:number}|null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchAllMatStatuses();
    setStatuses(data);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    let alive=true;
    const poll=async()=>{ try { const api=(window as any).electronAPI; if(!api?.getLocalWifiStatus)return; const status=await api.getLocalWifiStatus(); const judges=await api.getLocalWifiJudges?.()||[]; if(alive)setWifi({state:status?.state||'unknown',error:status?.error||null,judges:judges.length}); } catch {} };
    poll(); const id=setInterval(poll,3000); return()=>{alive=false;clearInterval(id)};
  }, []);

  const handleMatCountChange = (n: number) => {
    setMatCountState(n);
    saveMatCount(n);
  };

  const handleTakeControl = (matNumber: number) => {
    dispatch({ type: 'SET_MATCH_INFO', matNumber });
    navigate('/operator');
  };

  const byMat = new Map(statuses.map(s => [s.mat_number, s]));
  const slots = Array.from({ length: matCount }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]" dir={isAr ? 'rtl' : 'ltr'}>
      
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-lg font-bold text-[hsl(var(--gold))] flex items-center gap-2">
            <Radio size={20} />
            {isAr ? 'غرفة التحكم — حالة كل البسطات' : 'Control Room — All Mats'}
          </h1>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[hsl(var(--muted-foreground))]">
              {isAr ? 'عدد البسطات' : 'Number of mats'}
            </label>
            <input type="number" min={1} max={32} value={matCount}
              onChange={e => handleMatCountChange(parseInt(e.target.value, 10) || 1)}
              className="w-16 px-2 py-1 rounded bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm" />
            <button onClick={refresh} className="p-2 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]" title={isAr ? 'تحديث' : 'Refresh'}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="panel p-4 text-sm text-[hsl(0_72%_60%)]">
            {isAr
              ? '⚠ لا يوجد اتصال بقاعدة البيانات السحابية — غرفة التحكم تحتاج اتصالًا بالإنترنت لعرض حالة البسطات الأخرى (كل جهاز على شبكة مختلفة). راجع ملف .env.example.'
              : '⚠ No cloud database connection — Control Room needs internet access to see other mats\' status (each device is a separate machine). See .env.example.'}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-3"><div className="panel p-3 border border-white/10"><div className="text-[9px] tracking-[.2em] text-muted-foreground">JUDGE NETWORK</div><div className="mt-1 font-black text-sm flex items-center gap-2">{wifi?.state==='listening'?<Wifi size={15}/>:<WifiOff size={15}/>} {wifi?.state==='listening'?'OPERATIONAL':wifi?.state?.toUpperCase()||'UNKNOWN'}</div><div className="text-[9px] text-muted-foreground mt-1">{wifi?.judges??0} connected judge(s){wifi?.error?` · ${wifi.error}`:''}</div></div><div className="panel p-3 border border-white/10"><div className="text-[9px] tracking-[.2em] text-muted-foreground">MAT ISOLATION</div><div className="mt-1 font-black text-sm flex items-center gap-2"><ShieldCheck size={15}/> ONE OPERATOR / MAT</div><div className="text-[9px] text-muted-foreground mt-1">Each control action remains bound to the selected mat.</div></div><div className="panel p-3 border border-white/10"><div className="text-[9px] tracking-[.2em] text-muted-foreground">CLOUD</div><div className="mt-1 font-black text-sm">{isSupabaseConfigured?'CONNECTED CONFIGURED':'LOCAL-FIRST'}</div><div className="text-[9px] text-muted-foreground mt-1">Live status is never replaced by synthetic data.</div></div></div>

        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {isAr
            ? 'هذه الشاشة للمراقبة والتبديل فقط — كل بساط لا يزال يُدار من جهاز تشغيل واحد في كل لحظة. اضغط "تحكم" لجعل هذه النافذة تدير ذلك البساط.'
            : 'This screen is for monitoring and switching only — every mat is still run by exactly one operator instance at a time. Tap "Control" to make this window operate that mat.'}
          {lastRefresh && (
            <span className="ms-2 opacity-70">
              {isAr ? 'آخر تحديث:' : 'Last refresh:'} {lastRefresh.toLocaleTimeString(isAr ? 'ar-MA' : 'en-US')}
            </span>
          )}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {slots.map(matNumber => {
            const s = byMat.get(matNumber) as MatLiveStatus | undefined;
            const status: MatDisplayStatus = s?.status || 'idle';
            const label = STATUS_LABEL[status];
            return (
              <div key={matNumber} className="panel p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-display font-black text-[hsl(var(--gold))]">
                      {isAr ? 'بساط' : 'MAT'} {String(matNumber).padStart(2, '0')}
                    </span>
                    {s?.device_name && <div className="text-[8px] text-muted-foreground mt-0.5">🖥 {s.device_name}</div>}
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: label.color, backgroundColor: `${label.color}1a` }}>
                    {isAr ? label.ar : label.en}
                  </span>
                </div>
                {s && (s.chung_name || s.hong_name) ? (
                  <div className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[hsl(var(--chung))] font-semibold truncate">{s.chung_name || '—'}</span>
                      <span className="font-display font-bold">{s.chung_score ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[hsl(var(--hong))] font-semibold truncate">{s.hong_name || '—'}</span>
                      <span className="font-display font-bold">{s.hong_score ?? 0}</span>
                    </div>
                    {s.competition_name && (
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 truncate">{s.competition_name}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {isAr ? 'لا توجد مباراة حاليًا' : 'No match right now'}
                  </div>
                )}
                <button onClick={() => handleTakeControl(matNumber)}
                  className="w-full mt-1 py-1.5 rounded-lg bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Gavel size={12} /> {isAr ? 'تحكم بهذا البساط' : 'Control this mat'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
