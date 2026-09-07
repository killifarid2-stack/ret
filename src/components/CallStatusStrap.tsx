import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Hourglass } from 'lucide-react';

/**
 * Centre-screen broadcast status strap — ported from arena-glory's
 * status-bar.tsx (StatusBar), reused for both SinglePlayerCallOverlay
 * (CALLING RED/BLUE PLAYER…) and MatchupOverlay (WAITING FOR REFEREE /
 * BOTH PLAYERS READY). Text is bilingual (EN/AR) to match wab-tkd's own
 * convention, not the reference's English-only strap.
 */
interface Props {
  text: string;
  textAr: string;
  color: string;
  icon: 'hourglass' | 'check';
  positionClassName?: string; // where in the overlay this strap sits
}

export default function CallStatusStrap({ text, textAr, color, icon, positionClassName }: Props) {
  return (
    <div className={positionClassName || 'pointer-events-none absolute inset-x-0 top-[8%] z-20 flex items-center justify-center px-6'}>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${text}-${textAr}`}
          initial={{ opacity: 0, y: 14, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.94 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative flex items-center gap-3 rounded-lg border-[3px] px-6 py-2.5 md:px-8 md:py-3"
          style={{
            borderColor: color,
            background: 'rgba(0,0,0,.8)',
            boxShadow: `0 0 30px ${color}80, 0 0 90px ${color}30`,
          }}
        >
          {icon === 'hourglass'
            ? <Hourglass size={18} className="animate-pulse" style={{ color }} />
            : <CheckCircle2 size={20} style={{ color }} />}
          <span className="font-display font-black uppercase tracking-[.12em]" style={{ color, fontSize: 'clamp(13px,1.6vw,22px)', textShadow: `0 0 18px ${color}cc` }}>
            {text} / {textAr}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
