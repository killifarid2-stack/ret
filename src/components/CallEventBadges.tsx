import React from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Globe } from 'lucide-react';

/**
 * Left "date" badge / right "location" badge, ported from arena-glory's
 * championship-header.tsx (ChampionshipHeader) left/right badge pair.
 * Reads MatchState.eventDate / eventLocation, already present on
 * MatchState — never invents ARENA/DATE/REFEREE fields that aren't in the
 * real data. Purely decorative — sits inside the existing call-overlay
 * header, does not replace or duplicate tournamentHeader/readyBanner
 * (those belong to the base scoreboard, not the call cinematic).
 */
interface Props {
  eventDate?: string;
  eventLocation?: string;
}

export default function CallEventBadges({ eventDate, eventLocation }: Props) {
  if (!eventDate && !eventLocation) return null;
  return (
    <div className="absolute inset-x-0 top-0 flex items-start justify-between px-6 md:px-10 pt-1 pointer-events-none">
      {eventDate ? (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex items-center gap-2 rounded-md px-3 py-1.5"
          style={{ border: '1px solid rgba(255,216,102,.4)', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)' }}
        >
          <CalendarDays size={13} style={{ color: '#f2c14e' }} />
          <span className="font-display font-bold text-white/90" style={{ fontSize: 'clamp(9px,.85vw,13px)' }}>{eventDate}</span>
        </motion.div>
      ) : <span />}
      {eventLocation ? (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex items-center gap-2 rounded-md px-3 py-1.5"
          style={{ border: '1px solid rgba(255,216,102,.4)', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)' }}
        >
          <span className="font-display font-bold text-white/90 uppercase" style={{ fontSize: 'clamp(9px,.85vw,13px)' }}>{eventLocation}</span>
          <Globe size={13} style={{ color: '#f2c14e' }} />
        </motion.div>
      ) : <span />}
    </div>
  );
}
