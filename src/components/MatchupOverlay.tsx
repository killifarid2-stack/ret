import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MatchState, MatchupAnimation } from '@/types/tkd';
import FlagImage from './FlagImage';
import CallStatusStrap from './CallStatusStrap';
import { formatPlayerName, type NameFormat } from '@/lib/playerName';

/**
 * FINAL MATCHUP ANIMATION — "SHOW MATCHUP". Ports the gold VS-burst
 * treatment from the attached arena-glory-vue reference (round-center.tsx:
 * radial gold burst, expanding ring shockwave, spring-in "VS" glyph) plus
 * the player-parts.tsx cutout-portrait rim lighting, side by side for the
 * two corners. Reads the live chung/hong identity off match state — never
 * static data.
 *
 * Display-only: only the Operator (Main Referee) screen dispatches
 * SHOW_MATCHUP / MARK_MATCHUP_READY / REPLAY_MATCHUP.
 */
interface Props {
  state: MatchState;
  matchup?: MatchupAnimation;
}

const RED = { accent: '#ff2b39', soft: 'rgba(255,43,57,.9)', glow: 'rgba(255,43,57,.55)', dim: 'rgba(255,80,90,.25)' };
const BLUE = { accent: '#33a2ff', soft: 'rgba(51,162,255,.9)', glow: 'rgba(51,162,255,.6)', dim: 'rgba(90,170,255,.25)' };
const GOLD = '#f2c14e';
const READY = '#3ad07a';

function CornerPortrait({ name, nameFormat, photo, nationality, teamName, teamLogo, clubName, clubLogo, playerNumber, theme, isRed, delay }: {
  name: string; nameFormat: NameFormat; photo?: string; nationality?: string; teamName?: string; teamLogo?: string; clubName?: string; clubLogo?: string; playerNumber?: number; theme: typeof RED; isRed: boolean; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: isRed ? -140 : 140, filter: 'blur(14px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      transition={{ duration: 1, delay, ease: [0.19, 1, 0.22, 1] }}
      className="flex-1 flex flex-col items-center justify-center rounded-2xl p-4 relative"
      style={{
        border: `2px solid ${theme.accent}88`,
        background: `linear-gradient(160deg, ${theme.dim}, rgba(6,8,14,.85))`,
        boxShadow: `0 0 30px ${theme.dim}`,
      }}
    >
      <span className="font-display font-black uppercase tracking-[.3em] mb-2" style={{ color: theme.accent, fontSize: 'clamp(11px,1.2vw,14px)', textShadow: `0 0 14px ${theme.glow}` }}>
        {isRed ? 'RED CORNER' : 'BLUE CORNER'}
      </span>
      <div className="relative flex items-center justify-center mb-3" style={{ width: '70%', height: 'min(30vh,240px)' }}>
        <div className="absolute inset-0 rounded-xl" style={{ background: `radial-gradient(ellipse at 50% 45%, ${theme.glow} 0%, transparent 70%)`, filter: 'blur(20px)' }} />
        {photo ? (
          <img src={photo} alt={name} className="relative h-full w-full object-contain object-bottom" style={{ filter: `contrast(1.12) saturate(1.1) drop-shadow(0 20px 30px rgba(0,0,0,.85)) drop-shadow(0 0 20px ${theme.dim})` }} />
        ) : (
          <div className="relative h-full w-full flex items-center justify-center rounded-xl border" style={{ borderColor: `${theme.accent}55` }}>
            <span className="font-display font-black text-white/25" style={{ fontSize: 48 }}>{(name || '?').split(' ').slice(0, 2).map(w => w[0]).join('')}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-[10%] bottom-0 h-[40px] rounded-[50%]" style={{ background: `radial-gradient(ellipse at center, ${theme.soft} 0%, transparent 70%)`, filter: 'blur(16px)', opacity: 0.8 }} />
      </div>
      <div className="font-display font-black uppercase text-center text-white" style={{ fontSize: 'clamp(20px,2.6vw,34px)', whiteSpace: nameFormat === 'stacked' ? 'pre-line' : 'nowrap' }}>{formatPlayerName(name || '—', nameFormat)}</div>
      <div className="mt-2 flex items-center justify-center gap-3">
        {teamLogo && <img src={teamLogo} alt="" className="h-10 w-10 rounded-md object-contain bg-black/50 p-1" />}
        {clubLogo && clubLogo !== teamLogo && <img src={clubLogo} alt="" className="h-8 w-8 rounded-md object-contain bg-black/50 p-1" />}
        <span className="font-display text-xs font-black uppercase tracking-wider text-white/65">
          {[teamName, clubName].filter(Boolean).join(' · ')}
        </span>
        {playerNumber != null && <span className="font-display text-lg font-black" style={{ color: theme.accent }}>#{playerNumber}</span>}
      </div>
      {nationality && (
        <div className="flex items-center gap-2 mt-2">
          <FlagImage code={nationality} size={24} className="rounded-sm" style={{ width: 24, height: 16 }} />
          <span className="text-white/70 text-xs font-display uppercase tracking-wide">{nationality}</span>
        </div>
      )}
    </motion.div>
  );
}

function VSBurst({ show }: { show: boolean }) {
  return (
    <div className="relative flex flex-col items-center justify-center px-2 md:px-6">
      <motion.div
        className="pointer-events-none absolute rounded-full"
        animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.6 }}
        transition={{ duration: 0.8 }}
        style={{ width: 260, height: 260, background: 'radial-gradient(circle, rgba(255,214,120,.5) 0%, rgba(242,193,78,.14) 40%, transparent 70%)' }}
      />
      <AnimatePresence>
        {show && (
          <motion.span
            key="ring"
            className="pointer-events-none absolute rounded-full border-2"
            style={{ width: 160, height: 160, borderColor: 'rgba(255,214,120,.8)' }}
            initial={{ opacity: 0.9, scale: 0.3 }}
            animate={{ opacity: 0, scale: 2.4 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      <motion.span
        className="pointer-events-none absolute h-[3px]"
        animate={{ opacity: show ? 1 : 0, scaleX: show ? 1 : 0.2 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        style={{ width: 340, background: 'linear-gradient(90deg, transparent, rgba(255,220,140,.9), transparent)', filter: 'blur(2px)' }}
      />
      <AnimatePresence>
        {show && (
          <motion.span
            initial={{ opacity: 0, scale: 0.35, rotateX: 45 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: 'spring', stiffness: 170, damping: 13 }}
            className="relative font-display font-black leading-none"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)', color: GOLD, textShadow: `0 0 30px ${GOLD}, 0 0 60px rgba(242,193,78,.6)` }}
          >
            VS
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MatchupOverlay({ state, matchup }: Props) {
  if (!matchup) return null;
  const isReady = matchup.status === 'ready';
  const nameFormat = (state.callDisplayConfig?.nameFormat || 'full') as NameFormat;
  const selectedHong = state.selectedCallPlayers?.hong;
  const selectedChung = state.selectedCallPlayers?.chung;
  const hong: any = selectedHong || state.hong.player; // RED corner
  const chung: any = selectedChung || state.chung.player; // BLUE corner

  return (
    <div
      key={matchup.animationId}
      className="wab-broadcast-layer fixed inset-0 z-[906] pointer-events-none overflow-hidden"
      role="status" aria-live="polite" aria-atomic="true"
      aria-label={`MATCHUP — ${hong.name} vs ${chung.name}${isReady ? ' MATCH READY' : ''}`}
      style={{ background: '#020204' }}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(242,193,78,.10) 0%, transparent 60%), #020204' }}
      />
      {!isReady && (
        <CallStatusStrap
          icon="hourglass"
          color={GOLD}
          text="WAITING FOR REFEREE"
          textAr="بانتظار الحكم الرئيسي"
          positionClassName="pointer-events-none absolute inset-x-0 top-[6%] z-20 flex items-center justify-center px-6"
        />
      )}
      <motion.div
        className="absolute inset-3 md:inset-5 rounded-[24px]"
        animate={isReady ? { boxShadow: ['0 0 30px rgba(58,208,122,.6)', '0 0 60px rgba(58,208,122,.9)', '0 0 30px rgba(58,208,122,.6)'] } : {}}
        transition={isReady ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : {}}
        style={{
          border: `3px solid ${isReady ? 'rgba(58,208,122,.7)' : 'rgba(255,216,102,.35)'}`,
          boxShadow: isReady ? undefined : 'inset 0 0 100px rgba(255,216,102,.05), 0 0 55px rgba(255,190,40,.14)',
        }}
      />

      <div className="absolute inset-6 md:inset-10 flex items-stretch justify-center gap-4 md:gap-8">
        <CornerPortrait
          name={hong.name}
          nameFormat={nameFormat}
          photo={hong.photo || hong.photoUrl}
          nationality={hong.nationality || hong.country}
          teamName={hong.teamName || state.teamNames?.hong}
          teamLogo={hong.teamLogo || state.teamLogos?.hong}
          clubName={hong.clubName || state.clubNames?.hong}
          clubLogo={hong.clubLogo || state.clubLogos?.hong}
          playerNumber={hong.playerNumber}
          theme={RED}
          isRed
          delay={0}
        />
        <VSBurst show={true} />
        <CornerPortrait
          name={chung.name}
          nameFormat={nameFormat}
          photo={chung.photo || chung.photoUrl}
          nationality={chung.nationality || chung.country}
          teamName={chung.teamName || state.teamNames?.chung}
          teamLogo={chung.teamLogo || state.teamLogos?.chung}
          clubName={chung.clubName || state.clubNames?.chung}
          clubLogo={chung.clubLogo || state.clubLogos?.chung}
          playerNumber={chung.playerNumber}
          theme={BLUE}
          isRed={false}
          delay={0.15}
        />
      </div>

      <AnimatePresence>
        {isReady && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 font-display font-black uppercase tracking-[.35em] rounded-full px-8 py-3"
            style={{ color: READY, border: `2px solid ${READY}`, background: 'rgba(58,208,122,.12)', boxShadow: `0 0 26px ${READY}80`, fontSize: 'clamp(14px,1.8vw,22px)' }}
          >
            ✓ MATCH READY
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
