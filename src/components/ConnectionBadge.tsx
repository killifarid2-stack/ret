import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, CloudOff } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

type CloudState = 'synced' | 'checking' | 'degraded' | 'unconfigured';

const PING_INTERVAL_MS = 20000;
const PING_TIMEOUT_MS = 6000;

/**
 * Persistent connectivity badge. Two things are checked, not one:
 *  1. navigator.onLine — does this device have ANY network path at all.
 *  2. A real, lightweight Supabase ping — is the cloud actually reachable.
 *
 * Previously this only checked (1), so an operator could see a reassuring
 * green "Online" badge while the Supabase project itself was unreachable
 * (DNS block, RLS/auth misconfiguration, the project paused, a corporate
 * firewall blocking only that host, etc.) — the badge would stay green
 * right up until a save silently failed. Now a genuine but stalled cloud
 * ping surfaces as "Cloud unreachable" (amber) instead of a false "Online".
 */
export default function ConnectionBadge({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [cloud, setCloud] = useState<CloudState>(() => (isSupabaseConfigured ? 'checking' : 'unconfigured'));
  const inFlight = useRef(false);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => { setOnline(false); setCloud(isSupabaseConfigured ? 'degraded' : 'unconfigured'); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    const ping = async () => {
      if (inFlight.current || cancelled) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) { setCloud('degraded'); return; }
      inFlight.current = true;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
        // Cheapest possible round-trip: HEAD-style count-only query against a
        // table every deployment has (RLS may still block rows — a clean
        // *response*, even a permission error, proves the cloud is reachable;
        // only a network-level failure/timeout means "unreachable").
        const { error, status } = await supabase
          .from('tournaments')
          .select('id', { count: 'exact', head: true })
          .abortSignal(controller.signal)
          .limit(1);
        clearTimeout(timer);
        if (cancelled) return;
        const reachable = !error || (typeof status === 'number' && status > 0 && status < 500);
        setCloud(reachable ? 'synced' : 'degraded');
      } catch {
        if (!cancelled) setCloud('degraded');
      } finally {
        inFlight.current = false;
      }
    };

    ping();
    const interval = setInterval(ping, PING_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const state: 'offline' | 'synced' | 'degraded' = !online ? 'offline' : cloud === 'synced' ? 'synced' : cloud === 'unconfigured' ? 'synced' : 'degraded';
  const label = state === 'offline' ? t('offline') : state === 'degraded' ? t('cloudUnreachable') : t('onlineSynced');
  const icon = state === 'offline' ? <WifiOff size={compact ? 11 : 13} /> : state === 'degraded' ? <CloudOff size={compact ? 11 : 13} /> : <Wifi size={compact ? 11 : 13} />;
  const colorClass = state === 'synced'
    ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border border-[hsl(var(--success))]/30'
    : state === 'degraded'
      ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30 animate-pulse'
      : 'bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/30 animate-pulse';

  return (
    <div
      title={label}
      className={`flex items-center gap-1 rounded-full font-semibold transition-colors ${
        compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-xs'
      } ${colorClass}`}
    >
      {icon}
      {!compact && <span>{label}</span>}
    </div>
  );
}
