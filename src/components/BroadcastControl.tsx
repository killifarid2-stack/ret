import React from 'react';
import { Radio, RadioTower } from 'lucide-react';
import { useMatch, isPublicDisplayWindow } from '@/context/MatchContext';
import { useI18n } from '@/lib/i18n';

/**
 * "Start Broadcast" / "Stop Broadcast" toggle.
 *
 * Controls `state.publicBroadcastLive`, which every audience-facing render
 * of PublicScoreboard (the real second Electron display, the /scoreboard
 * web route, and the Operator screen's own mini-preview) checks before
 * showing anything but the standby splash-banner.
 *
 * Deliberately available everywhere (not just inside Electron, unlike
 * PublicDisplayControl) — this is also how the whole flow can be tried out
 * on a single screen: press "Start Broadcast", then open /scoreboard (or
 * watch the mini-preview on the Operator screen) to see it switch from the
 * banner to the real call-up/live screen, no second monitor required.
 */
export default function BroadcastControl() {
  // Broadcast transport controls belong to the operator/admin shell only.
  // Never expose Start/Stop Broadcast inside the audience/public window.
  if (isPublicDisplayWindow()) return null;

  const { state, dispatch } = useMatch();
  const { t } = useI18n();
  const live = !!state.publicBroadcastLive;

  return (
    <button
      onClick={() => dispatch({ type: 'SET_BROADCAST_LIVE', live: !live })}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
        live
          ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25'
          : 'bg-[hsl(var(--secondary))]/50 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]'
      }`}
      title={live ? t('broadcastLive') : t('broadcastPending')}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-500 animate-pulse' : 'bg-[hsl(var(--muted-foreground))]/50'}`} />
      {live ? <RadioTower size={12} /> : <Radio size={12} />}
      {live ? t('stopBroadcast') : t('startBroadcast')}
    </button>
  );
}
