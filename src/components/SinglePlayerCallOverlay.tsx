import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Hourglass } from 'lucide-react';
import { PlayerColor, SinglePlayerCall } from '@/types/tkd';
import FlagImage from './FlagImage';
import CallStatusStrap from './CallStatusStrap';

/**
 * SINGLE PLAYER CALL ANIMATION — ports the cinematic broadcast card system
 * from the attached arena-glory-vue reference (player-parts.tsx /
 * player-card.tsx: metallic corner-bracket frame, cutout portrait with rim
 * lighting, gradient name banner) — same motion values, same layered glow
 * technique, same "corner bracket" frame — adapted to call exactly ONE
 * player (never a team, never two players at once).
 *
 * Fully display-only. Only the Main Referee (Operator) screen dispatches
 * CALL_SINGLE_PLAYER / MARK_SINGLE_PLAYER_READY / REPLAY_SINGLE_PLAYER_CALL.
 */
interface Props {
  call?: SinglePlayerCall;
}

const SIDE_THEME: Record<PlayerColor, { accent: string; soft: string; glow: string; dim: string; label: string }> = {
  hong: { accent: '#ff2b39', soft: 'rgba(255,43,57,0.9)', glow: 'rgba(255,43,57,0.55)', dim: 'rgba(255,80,90,0.25)', label: 'RED CORNER' },
  chung: { accent: '#33a2ff', soft: 'rgba(51,162,255,0.9)', glow: 'rgba(51,162,255,0.6)', dim: 'rgba(90,170,255,0.25)', label: 'BLUE CORNER' },
};
const READY = { accent: '#3ad07a', glow: 'rgba(58,208,122,0.6)', dim: 'rgba(58,208,122,0.25)' };

function CornerBracket({ position, color }: { position: 'tl' | 'tr' | 'bl' | 'br'; color: string }) {
  const base = 'pointer-events-none absolute h-8 w-8';
  const map = {
    tl: 'left-[-2px] top-[-2px] border-l-2 border-t-2 rounded-tl-[14px]',
    tr: 'right-[-2px] top-[-2px] border-r-2 border-t-2 rounded-tr-[14px]',
    bl: 'left-[-2px] bottom-[-2px] border-b-2 border-l-2 rounded-bl-[14px]',
    br: 'right-[-2px] bottom-[-2px] border-b-2 border-r-2 rounded-br-[14px]',
  } as const;
  return <span className={`${base} ${map[position]}`} style={{ borderColor: color, boxShadow: `0 0 14px ${color}` }} />;
}

function PlayerPhoto({ src, name, isRed, theme, active }: { src?: string; name: string; isRed: boolean; theme: typeof SIDE_THEME['hong']; active: boolean }) {
  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[85%] w-[80%] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700"
        style={{ opacity: active ? 0.95 : 0.35, background: `radial-gradient(ellipse at 50% 45%, ${theme.glow} 0%, ${theme.dim} 38%, transparent 70%)`, filter: 'blur(30px)' }} />
      {src ? (
        <>
          <img src={src} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain object-bottom transition-opacity duration-700"
            style={{ opacity: active ? 0.9 : 0.3, transform: `translateX(${isRed ? -6 : 6}px) scale(1.01)`, filter: `brightness(0) drop-shadow(0 0 16px ${theme.accent}) drop-shadow(0 0 34px ${theme.glow})` }} />
          <img src={src} alt={name} className="relative h-full w-full select-none object-contain object-bottom"
            style={{ filter: active ? `contrast(1.16) saturate(1.12) drop-shadow(0 26px 40px rgba(0,0,0,0.85)) drop-shadow(0 0 26px ${theme.dim})` : 'contrast(1.02) saturate(0.7) brightness(0.72)', transition: 'filter 700ms ease' }} />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black/60 font-display text-4xl font-bold uppercase tracking-widest text-white/30">
          {name.split(' ').slice(0, 2).map(w => w[0]).join('')}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-[12%] bottom-[2%] h-[52px] rounded-[50%] transition-opacity duration-700"
        style={{ opacity: active ? 0.85 : 0.3, background: `radial-gradient(ellipse at center, ${theme.soft} 0%, transparent 70%)`, filter: 'blur(18px)' }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/80 to-transparent" />
    </div>
  );
}

/**
 * Purely cosmetic staging of the banner text once this player has been
 * called and is sitting at the "called" stop point (see TeamCallOverlay's
 * useGreetingStage for the same pattern / same guarantee): CALLING →
 * PLAYER GREETING → AWAITING CONFIRMATION. `call.status` itself is never
 * touched here — only the Main Referee's MARK_SINGLE_PLAYER_READY can move
 * the real state to 'ready'.
 */
function useGreetingStage(status: SinglePlayerCall['status'], resetKey: unknown): 'greeting' | 'awaiting' {
  const [stage, setStage] = React.useState<'greeting' | 'awaiting'>('greeting');
  React.useEffect(() => {
    if (status !== 'called') { setStage('greeting'); return; }
    setStage('greeting');
    const t = window.setTimeout(() => setStage('awaiting'), 1800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, resetKey]);
  return stage;
}

export default function SinglePlayerCallOverlay({ call }: Props) {
  if (!call) return null;
  const theme = SIDE_THEME[call.side];
  const isReady = call.status === 'ready';
  const isRed = call.side === 'hong';
  const greetingStage = useGreetingStage(call.status, call.animationId);
  const isGreeting = call.status === 'called' && greetingStage === 'greeting';

  return (
    <div
      key={call.animationId}
      className="fixed inset-0 z-[905] pointer-events-none overflow-hidden flex items-center justify-center"
      role="status" aria-live="polite" aria-atomic="true"
      aria-label={`CALL PLAYER — ${call.playerName}${isReady ? ' READY' : ''}`}
      style={{ background: 'radial-gradient(120% 90% at 50% 45%, rgba(20,10,10,.4), #020204 78%)' }}
    >
      <CallStatusStrap
        icon={isReady ? 'check' : 'hourglass'}
        color={isReady ? READY.accent : theme.accent}
        text={isReady ? 'PLAYER READY' : call.status === 'calling' ? `CALLING ${isRed ? 'RED' : 'BLUE'} PLAYER…` : isGreeting ? 'PLAYER GREETING' : 'AWAITING CONFIRMATION'}
        textAr={isReady ? 'اللاعب جاهز' : call.status === 'calling' ? `نداء اللاعب ${isRed ? 'الأحمر' : 'الأزرق'}...` : isGreeting ? 'تحية اللاعب' : 'بانتظار التأكيد'}
      />
      <motion.div
        initial={{ opacity: 0, x: isRed ? -140 : 140, filter: 'blur(14px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        transition={{ duration: 1, ease: [0.19, 1, 0.22, 1] }}
        className="relative"
        style={{ width: 'min(30vw, 400px)', height: 'min(78vh, 640px)' }}
      >
        {/* outer glow bed */}
        <motion.div
          className="pointer-events-none absolute -inset-6 rounded-[26px]"
          animate={{ opacity: isReady ? 1 : 0.85, background: `radial-gradient(ellipse at 50% 45%, ${isReady ? READY.dim : theme.dim} 0%, transparent 68%)` }}
          transition={{ duration: 0.7 }}
          style={{ filter: 'blur(24px)' }}
        />

        {/* metallic + neon frame */}
        <motion.div
          className="relative flex h-full w-full flex-col rounded-[14px] p-[2px]"
          animate={{
            background: `linear-gradient(150deg, ${isReady ? READY.accent : theme.accent} 0%, rgba(255,255,255,0.55) 18%, ${isReady ? READY.accent : theme.accent} 38%, rgba(20,22,30,0.9) 62%, ${isReady ? READY.accent : theme.accent} 100%)`,
            boxShadow: `0 0 42px ${isReady ? READY.glow : theme.glow}, 0 0 120px ${isReady ? READY.dim : theme.dim}, 0 30px 60px rgba(0,0,0,0.8)`,
          }}
          transition={{ duration: 0.6 }}
        >
          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[12px] p-5 backdrop-blur-md"
            style={{ background: 'linear-gradient(160deg, rgba(14,16,24,0.94) 0%, rgba(7,9,15,0.97) 55%, rgba(4,5,10,0.99) 100%)', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
            <div className="pointer-events-none absolute inset-[6px] rounded-[9px] border" style={{ borderColor: 'rgba(255,255,255,0.09)' }} />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${isReady ? READY.accent : theme.accent}, transparent)`, boxShadow: `0 0 18px ${isReady ? READY.accent : theme.accent}` }} />
            <CornerBracket position="tl" color={isReady ? READY.accent : theme.accent} />
            <CornerBracket position="tr" color={isReady ? READY.accent : theme.accent} />
            <CornerBracket position="bl" color={isReady ? READY.accent : theme.accent} />
            <CornerBracket position="br" color={isReady ? READY.accent : theme.accent} />

            <div className="text-center font-display text-[13px] font-bold uppercase tracking-[0.3em]" style={{ color: isReady ? READY.accent : theme.accent, textShadow: `0 0 14px ${isReady ? READY.glow : theme.glow}` }}>
              {theme.label}
            </div>

            {/* team + club logos — dynamic from Match Setup */}
            {(call.teamLogo || call.clubLogo) && (
              <div className="mt-2 flex items-center justify-center gap-2">
                {call.teamLogo && (
                  <div className="flex h-[56px] w-[56px] items-center justify-center rounded-md border bg-black/50 p-1" style={{ borderColor: `${theme.accent}66` }}>
                    <img src={call.teamLogo} alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                )}
                {call.clubLogo && call.clubLogo !== call.teamLogo && (
                  <div className="flex h-[46px] w-[46px] items-center justify-center rounded-md border bg-black/50 p-1" style={{ borderColor: `${theme.accent}44` }}>
                    <img src={call.clubLogo} alt="" className="max-h-full max-w-full object-contain" />
                  </div>
                )}
              </div>
            )}

            {/* portrait */}
            <div className="relative mt-2 flex-1">
              <PlayerPhoto src={call.playerPhoto} name={call.playerName} isRed={isRed} theme={theme} active />
              {call.country && (
                <span className={`absolute bottom-2 ${isRed ? 'left-2' : 'right-2'} h-[26px] w-[38px] overflow-hidden rounded-[3px] border`} style={{ borderColor: theme.accent, boxShadow: `0 0 14px ${theme.glow}` }}>
                  <FlagImage code={call.country} size={38} className="h-full w-full object-cover" />
                </span>
              )}
            </div>

            {/* name banner */}
            <div className="relative mt-3">
              <div className="relative overflow-hidden rounded-md border-[3px] py-2.5 text-center"
                style={{ borderColor: isReady ? READY.accent : theme.accent, background: 'linear-gradient(180deg, rgba(26,28,38,0.96), rgba(8,9,14,0.99))', boxShadow: `0 0 26px ${isReady ? READY.dim : theme.dim}, inset 0 1px 0 rgba(255,255,255,0.12)` }}>
                <h2 className="px-3 font-display text-[26px] font-bold uppercase leading-none tracking-wide text-white">{call.playerName}</h2>
              </div>
            </div>

            {/* number / country / team */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-white/85">
              {call.playerNumber != null && (
                <span className="font-display text-[15px] font-bold" style={{ color: isReady ? READY.accent : theme.accent }}>#{call.playerNumber}</span>
              )}
              {call.country && <span className="font-hud text-[12px] font-semibold uppercase tracking-wide">{call.country}</span>}
              {call.teamName && <span className="font-hud text-[12px] font-semibold uppercase tracking-wide text-white/60">{call.teamName}</span>}
              {call.clubName && <span className="font-hud text-[12px] font-semibold uppercase tracking-wide text-white/45">{call.clubName}</span>}
            </div>

            {/* status strap — CALLING / CALLED / READY */}
            <div className="mt-2 flex justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={isReady ? 'ready' : call.status}
                  initial={{ opacity: 0, y: 10, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.94 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="flex items-center gap-2 rounded-full border-2 px-4 py-1.5"
                  style={{
                    borderColor: isReady ? READY.accent : theme.accent,
                    boxShadow: `0 0 20px ${isReady ? READY.glow : theme.glow}55`,
                  }}
                >
                  {isReady ? <CheckCircle2 size={16} style={{ color: READY.accent }} /> : <Hourglass size={16} style={{ color: theme.accent }} className="animate-pulse" />}
                  <span className="font-display text-[13px] font-bold uppercase tracking-[0.2em]" style={{ color: isReady ? READY.accent : theme.accent }}>
                    {isReady ? '✓ READY' : call.status === 'calling' ? 'CALLING…' : isGreeting ? 'GREETING…' : 'AWAITING CONFIRMATION'}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
