import React from 'react';
import { motion } from 'framer-motion';
import { CallAnimation, MatchState, PlayerColor, CallDisplayConfig } from '@/types/tkd';
import splashBannerUrl from '@/assets/splash-banner.png';
import FlagImage from './FlagImage';
import { ANIMATION_ASSETS } from '@/assets/animations';

/**
 * TEAM CALL — PAR ÉQUIPE team-identity phase (callAnim.phase === 'team').
 *
 * Ported from the broadcast-suite reference's TeamPanel.tsx technique
 * (energy-sweep entrance, glow on the actively-called team, roster list
 * with a per-player status dot, lit/ready status banner) — reimplemented
 * here with framer-motion (already a wab-tkd dependency, see
 * SinglePlayerCallOverlay.tsx / MatchupOverlay.tsx) instead of importing
 * broadcast.css, whose --background/--muted/--gold CSS variables collide
 * with wab-tkd's own theme tokens. Every class below is prefixed `tco-`
 * and scoped to this component only.
 *
 * Strictly respects team sides: RED is always hong's own physical corner
 * (gridColumn 1 / left) and BLUE is always chung's (gridColumn 3 / right),
 * decided by `side`/`isRed`, never by array order.
 *
 * Adds the one thing the previous inline block never rendered even though
 * the data has always carried it: `callAnim.roster` (name / nationality /
 * playerNumber / seedNumber — no photos at this phase, by design). A
 * roster entry is shown "verified" (green check) once it already has at
 * least one recorded round (`roundScores`), i.e. this player has actually
 * played before in this match — never an invented/random ready flag.
 *
 * Also carries a toned-down cinematic backdrop (ported from broadcast-suite's
 * ArenaBackground.tsx technique: key-art photo + red/blue side glow +
 * vignette) confined to THIS overlay only — it mounts and unmounts with the
 * Team Call phase, never touching the public screen's own background.
 * Deliberately dimmed (low photo opacity + heavy blur + dark vignette) so it
 * reads as atmosphere behind the team cards, never competes with them.
 */
interface Props {
  state: MatchState;
  callAnim: CallAnimation;
  cc: CallDisplayConfig;
}

const SIDE_THEME: Record<PlayerColor, { accent: string; glow: string; label: string }> = {
  hong: { accent: 'hsl(0 72% 55%)', glow: 'rgba(255,43,57,.55)', label: 'RED / أحمر' },
  chung: { accent: 'hsl(217 91% 58%)', glow: 'rgba(51,140,255,.55)', label: 'BLUE / أزرق' },
};

/**
 * Purely cosmetic staging of the banner text while this side is being
 * called: ENTERING → TEAM GREETING → AWAITING REFEREE CONFIRMATION. This
 * never changes teamCallStatus, never dispatches anything, and never
 * auto-advances the match — it only sequences what text is shown on top
 * of the already-frozen stop point (see AUTOMATIC CALL FLOW §4/§9). If the
 * referee confirms before the greeting beat finishes, the card just
 * unmounts/changes as normal; nothing here can delay or skip a real
 * confirmation.
 */
function useGreetingStage(active: boolean, resetKey: unknown): 'entering' | 'greeting' | 'awaiting' {
  const [stage, setStage] = React.useState<'entering' | 'greeting' | 'awaiting'>('entering');
  React.useEffect(() => {
    if (!active) { setStage('entering'); return; }
    setStage('entering');
    const t1 = window.setTimeout(() => setStage('greeting'), 900);
    const t2 = window.setTimeout(() => setStage('awaiting'), 2600);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, resetKey]);
  return stage;
}

function TeamCard({ side, callAnim, state, cc, delay }: {
  side: PlayerColor; callAnim: CallAnimation; state: MatchState; cc: CallDisplayConfig; delay: number;
}) {
  const isRed = side === 'hong';
  const theme = SIDE_THEME[side];
  const isCalled = callAnim.side === side;
  const greetingStage = useGreetingStage(isCalled, callAnim.ts);

  // Team identity: prefer the live call payload (only ever carries ONE
  // side), fall back to the general per-side match state so BOTH team
  // cards render fully even though only one is "currently announcing".
  const defaultClubLogo = side === 'chung' ? ANIMATION_ASSETS.exactBlueClub : ANIMATION_ASSETS.exactRedClub;
  const teamName = (isCalled ? callAnim.teamName : undefined) || state.teamNames?.[side] || (side === 'chung' ? 'BLUE TEAM' : 'RED TEAM');
  const clubName = (isCalled ? callAnim.clubName : undefined) || state.clubNames?.[side] || (side === 'chung' ? 'CHUNG CLUB' : 'HONG CLUB');
  const teamLogo = (isCalled ? callAnim.teamLogo : undefined) || state.teamLogos?.[side] || defaultClubLogo;
  const clubLogo = (isCalled ? callAnim.clubLogo : undefined) || state.clubLogos?.[side] || defaultClubLogo;
  const roster = isCalled && state.teamCallShowPlayers !== false ? callAnim.roster : undefined;
  const country = (isCalled ? callAnim.teamCountry : undefined) || state.teamCountry?.[side];

  return (
    <motion.div
      className="tco-card relative h-full min-h-0 min-w-0 rounded-[22px] flex flex-col overflow-hidden"
      style={{
        gridColumn: isRed ? '1' : '3',
        border: `3px solid ${theme.accent}`,
        background: 'linear-gradient(160deg, #0d0d10 0%, #08080a 45%, #030304 100%)',
        boxShadow: isCalled
          ? `0 0 60px ${theme.glow}, 0 18px 40px rgba(0,0,0,.6), inset 0 0 0 1px ${theme.accent}`
          : `0 0 20px ${theme.glow.replace(/,\s*[\d.]+\)/, ',.15)')}, 0 10px 26px rgba(0,0,0,.5)`,
      }}
      // "Energy sweep" entrance — a bright bar of the team's own color
      // sweeps in from that team's own side, the card fades/slides in
      // right behind it.
      initial={{ opacity: 0, x: isRed ? -90 : 90 }}
      animate={{ opacity: isCalled ? 1 : 0.55, x: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1.4, 0.3, 1] }}
    >
      {/* energy sweep bar */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 h-full w-full"
        style={{
          [isRed ? 'left' : 'right']: 0,
          background: `linear-gradient(${isRed ? '90deg' : '270deg'}, ${theme.accent}, transparent 60%)`,
        } as React.CSSProperties}
        initial={{ opacity: 0.9, scaleX: 1 }}
        animate={{ opacity: 0, scaleX: 0 }}
        transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      />

      <div className="relative flex flex-col items-center text-center p-4 md:p-5 shrink-0">
        <div className="tco-side-badge" style={{ color: theme.accent, borderColor: theme.accent, boxShadow: `0 0 18px ${theme.glow}` }}>
          {theme.label}{isCalled ? ' • CALLED' : ''}
        </div>
        <div className="flex items-center justify-center gap-3 mt-3">
          {teamLogo && cc.showTeamLogo && (
            <img src={teamLogo} alt="" className="object-contain rounded-xl" style={{ width: 'clamp(56px,6vw,92px)', height: 'clamp(56px,6vw,92px)', border: `2px solid ${theme.accent}`, background: '#000', boxShadow: `0 0 14px ${theme.glow}` }} />
          )}
          {clubLogo && cc.showClubLogo && clubLogo !== teamLogo && (
            <img src={clubLogo} alt="" className="object-contain rounded-xl" style={{ width: 'clamp(40px,4.4vw,64px)', height: 'clamp(40px,4.4vw,64px)', border: `2px solid ${theme.accent}`, background: '#000' }} />
          )}
        </div>
        <div className="font-display font-black text-white mt-3 truncate w-full" style={{ fontSize: 'clamp(18px,2.2vw,32px)' }}>{teamName}</div>
        {clubName && <div className="font-display font-bold mt-1 truncate w-full" style={{ color: theme.accent, fontSize: 'clamp(12px,1.2vw,17px)' }}>{clubName}</div>}
        {country && (
          <div className="mt-2 flex items-center justify-center gap-2 text-white/80">
            <FlagImage code={country} size={36} className="h-4 w-6 rounded-sm object-cover" />
            <span className="font-display text-[11px] font-bold uppercase tracking-[.16em]">{country}</span>
          </div>
        )}
      </div>

      {/* Roster — team's players, sorted by playerNumber/seedNumber as
          already prepared upstream. Shown only during THIS side's own
          call, matching the data (`callAnim.roster` is only ever
          populated for the announced side). */}
      {roster && roster.length > 0 && (
        <div className="tco-roster flex-1 min-h-0 overflow-y-auto px-3 pb-3">
          <div className="tco-roster-head" style={{ color: `${theme.accent}` }}>
            <span>#</span><span>ATHLETE / اللاعب</span><span>PHOTO</span><span>NAT</span><span className="text-center">ST</span>
          </div>
          {roster.map((p, i) => {
            const verified = !!(p.roundScores && p.roundScores.length > 0);
            return (
              <motion.div
                key={`${p.name}-${i}`}
                className="tco-roster-row"
                initial={{ opacity: 0, x: isRed ? -14 : 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: delay + 0.15 + i * 0.05 }}
              >
                <span className="tco-pnum">{p.playerNumber ?? i + 1}</span>
                <span className="tco-pname">{p.name}</span>
                <span className="flex items-center justify-center">
                  {p.photo ? (
                    <img src={p.photo} alt="" className="h-7 w-7 rounded-full object-cover border" style={{ borderColor: `${theme.accent}66` }} />
                  ) : (
                    <span className="h-7 w-7 rounded-full border flex items-center justify-center text-[8px] font-black" style={{ borderColor: `${theme.accent}44`, color: theme.accent }}>
                      {(p.name || '?').split(' ').map((x: string) => x[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="tco-pnat">{p.nationality || '—'}</span>
                <span className={`tco-pstatus${verified ? ' ok' : ''}`} title={verified ? 'شارك سابقًا في هذه المباراة' : 'لم يشارك بعد'}>
                  {verified ? '✓' : '•'}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className={`tco-status-banner${isCalled ? ' lit' : ''}`} style={{ borderColor: theme.accent, color: isCalled ? '#050505' : theme.accent, background: isCalled ? theme.accent : 'transparent' }}>
        {!isCalled
          ? 'STAND BY — بالانتظار'
          : greetingStage === 'entering'
            ? 'TEAM CALL — نداء الفريق'
            : greetingStage === 'greeting'
              ? 'TEAM GREETING — تحية الفريق'
              : 'AWAITING REFEREE CONFIRMATION — بانتظار تأكيد الحكم'}
      </div>
    </motion.div>
  );
}

export default function TeamCallOverlay({ state, callAnim, cc }: Props) {
  return (
    <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_minmax(90px,.4fr)_minmax(0,1fr)] items-stretch gap-2 md:gap-5 lg:gap-8 py-5 relative">
      {/* Scoped arena backdrop — first child so it paints behind the team
          cards (both are position:relative with z-index:auto, so normal
          DOM order decides stacking; no explicit z-index needed/wanted
          here). Lives and dies with this overlay only. */}
      <div className="tco-arena-bg" aria-hidden="true">
        <div className="tco-arena-photo" style={{ backgroundImage: `url(${splashBannerUrl})` }} />
        <div className="tco-arena-glow tco-arena-glow-red" />
        <div className="tco-arena-glow tco-arena-glow-blue" />
        <div className="tco-arena-vignette" />
      </div>
      <TeamCard side="hong" callAnim={callAnim} state={state} cc={cc} delay={0.05} />
      <div className="flex flex-col items-center justify-center relative" style={{ gridColumn: '2' }}>
        <motion.div
          className="font-display font-black italic"
          style={{ fontSize: 'clamp(26px,2.6vw,42px)', color: '#ffd866', textShadow: '0 0 18px rgba(255,216,102,.55), 0 0 34px rgba(255,216,102,.25)' }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3, type: 'spring', stiffness: 180, damping: 14 }}
        >
          VS
        </motion.div>
      </div>
      <TeamCard side="chung" callAnim={callAnim} state={state} cc={cc} delay={0.05} />

      <style>{`
        .tco-side-badge { display:inline-flex; align-items:center; gap:.4em; padding:.3em 1em; border-radius:999px; border:1.5px solid; background:#050507; font-family: var(--font-display, inherit); font-weight:900; letter-spacing:.18em; font-size: clamp(9px,.78vw,13px); white-space:nowrap; }
        .tco-roster { font-family: var(--font-display, inherit); }
        .tco-roster-head, .tco-roster-row { display:grid; grid-template-columns: 22px 1fr 34px 44px 24px; align-items:center; gap:6px; }
        .tco-roster-head { font-size:9px; letter-spacing:.12em; opacity:.6; padding:2px 4px; border-bottom:1px solid rgba(255,255,255,.12); margin-bottom:2px; }
        .tco-roster-row { font-size:clamp(10px,1vw,13px); color:#fff; padding:3px 4px; border-bottom:1px solid rgba(255,255,255,.06); }
        .tco-pnum { opacity:.55; font-weight:700; }
        .tco-pname { font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .tco-pnat { opacity:.6; font-size:.85em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .tco-pstatus { text-align:center; opacity:.4; }
        .tco-pstatus.ok { opacity:1; color:#39ff6a; text-shadow:0 0 8px rgba(57,255,106,.7); }
        .tco-status-banner { margin-top:auto; text-align:center; padding:8px 6px; font-family: var(--font-display, inherit); font-weight:900; letter-spacing:.14em; font-size:clamp(9px,.9vw,12px); border-top:2px solid; transition: background .3s, color .3s; }

        /* Scoped, dimmed arena backdrop — see the component doc comment.
           position:absolute inset:0 on a first-rendered child + no z-index
           on the cards after it is enough for correct stacking (DOM order
           governs paint order among position:relative/absolute siblings
           that share z-index:auto). */
        .tco-arena-bg { position:absolute; inset:0; overflow:hidden; border-radius:22px; pointer-events:none; }
        .tco-arena-photo { position:absolute; inset:-6%; background-position:center; background-size:cover; opacity:.22; filter: blur(7px) saturate(1.1) brightness(.7); }
        .tco-arena-glow { position:absolute; top:0; width:38%; height:100%; filter:blur(80px); opacity:.26; }
        .tco-arena-glow-red { left:-8%; background: radial-gradient(closest-side, rgba(199,25,40,.55), transparent 72%); }
        .tco-arena-glow-blue { right:-8%; background: radial-gradient(closest-side, rgba(8,112,216,.55), transparent 72%); }
        .tco-arena-vignette { position:absolute; inset:0; background: radial-gradient(120% 90% at 50% 45%, transparent 38%, rgba(0,0,0,.78) 100%); }
      `}</style>
    </div>
  );
}
