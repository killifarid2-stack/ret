import { getRestPhase, getRestPhaseLabel } from '@/lib/rest-phase';
import React, { useEffect, useState, useRef } from 'react';
import { useMatch, isPublicDisplayWindow } from '@/context/MatchContext';
import { formatTime, getCurrentRoundScore, getRotationEntryForRound } from '@/lib/match-engine';
import { PlayerColor, MATCH_STAGE_LABELS, COMPETITION_MODE_LABELS, DEFAULT_DISPLAY_CONFIG, DEFAULT_CALL_DISPLAY_CONFIG } from '@/types/tkd';
import { Maximize, Settings as SettingsIcon, QrCode as QrIcon, X, Video, Swords, Scale, User, Trophy, Users, ClipboardCheck, Clock, ShieldCheck, Cpu, Wifi, WifiOff, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { loadTournamentLocal, saveTournamentLocal, isLocalTournamentId, getExternalDisplayColors } from '@/lib/tournament-local';
import { QRCodeSVG } from 'qrcode.react';
import FlagImage from './FlagImage';
import MatchupOverlay from './MatchupOverlay';
import ExactPlayerCallBroadcast from './ExactPlayerCallBroadcast';
import ExactPlayerCallV515 from './player-call/ExactPlayerCallV515';
import ParEquipePlayerCallV515 from './player-call/ParEquipePlayerCallV515';
import NextOnMatchOverlay from './NextOnMatchOverlay';
import CallEventBadges from './CallEventBadges';
import judgeDecisionBlueArmUrl from '@/assets/judge-decision/blue-arm.png';
import judgeDecisionRedArmUrl from '@/assets/judge-decision/red-arm.png';
import { PlayerChangeAnimation } from './player-call/player-change-animation';
import LiveTeamCallBroadcast from './broadcast-new/LiveTeamCallBroadcast';
import DoctorCallAnimation from './DoctorCallAnimation';
import KyeshiCallAnimation from './KyeshiCallAnimation';
import { formatPlayerName, type NameFormat } from '@/lib/playerName';

/** Player photo with a real fallback to the nationality flag — not just a
 *  blank space — when the photo URL is missing, invalid, or fails to load
 *  (expired blob URL, bad link, etc). Previously a broken photo URL just
 *  hid itself via onError with nothing in its place, even though a flag
 *  should have been shown instead. */
import type { MatchData } from './individual-result/types';
import { IndividualWinnerAnimation } from './individual-result/IndividualWinnerAnimation';

function PhotoOrFlag({ photoUrl, nationality, showPhoto, showFlag, size, className }: {
  photoUrl?: string; nationality?: string; showPhoto: boolean; showFlag: boolean;
  size: { width: string; height: string; flagWidth?: string };
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [photoUrl]);
  if (showPhoto && photoUrl && !failed) {
    return (
      <img src={photoUrl} alt="" className={className} style={{ height: size.height, width: size.width }}
        onError={() => setFailed(true)} />
    );
  }
  if (showFlag) {
    return (
      <FlagImage code={nationality || ''} size={160} className={className}
        style={{ height: size.height, width: size.flagWidth || size.width } as any} />
    );
  }
  return null;
}
import { sounds, announcer } from '@/lib/sounds';
import { useI18n } from '@/lib/i18n';
import MatBroadcastScreen from './MatBroadcastScreen';
import { getBroadcastDisplayMode, getBroadcastDisplayConfig } from '@/lib/broadcast-display';
import { useBroadcastViewport } from '@/lib/broadcast-viewport';
import appIconUrl from '@/assets/app-icon.png';
import splashBannerUrl from '@/assets/splash-banner.png';
import trophyWabTkdUrl from '@/assets/trophy-wab-tkd-transparent.png';
import medalWabTkdUrl from '@/assets/medal.png';
// Real equipment photography for the Hit Statistics panel (spectator screen).
// Blue = chung, Red = hong — never swapped, never replaced with generic icons.
import gloveBlueUrl from '@/assets/hit-stats/glove-blue.png';
import gloveRedUrl from '@/assets/hit-stats/glove-red.png';
import huguBlueUrl from '@/assets/hit-stats/hogu-blue.png';
import huguRedUrl from '@/assets/hit-stats/hogu-red.png';
import headgearBlueUrl from '@/assets/hit-stats/headgear-blue.png';
import headgearRedUrl from '@/assets/hit-stats/headgear-red.png';
// Custom Video Replay cards supplied for the Public Display. Blue = replay available; red = no replay remaining.
import videoReplayAvailableBlueUrl from '@/assets/hit-stats/video-replay-available-blue.png';
import videoReplayUnavailableRedUrl from '@/assets/hit-stats/video-replay-unavailable-red.png';
// Dedicated Judge Decision arms — blue/red, used by the existing cinematic IVR decision animation.
import koRedLogoUrl from '@/assets/ko/ko-red.png';
import koBlueLogoUrl from '@/assets/ko/ko-blue.png';
import wooseGirokArmsUrl from '@/assets/woose-girok-arms.png';

function broadcastName(value: string | undefined, format: NameFormat, fallback?: string): string {
  return formatPlayerName(value || '', format) || fallback || '—';
}


// ===== HIT ICON (realistic silhouettes — fist / chest guard / head guard) =====
function HitIcon({ kind, size = 22 }: { kind: 'punch' | 'body' | 'head'; size?: number }) {
  const s = { width: size, height: size, display: 'block' as const };
  if (kind === 'punch') return (
    // KPNP-style padded fist protector — matches hogu/head guard aesthetic
    <svg viewBox="0 0 32 32" style={s} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* Forearm cuff (like hogu belt) */}
      <path d="M9 23h14v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 9 27v-4z" fill="currentColor" fillOpacity="0.5"/>
      <path d="M9 23h14v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 9 27v-4z"/>
      {/* KPNP-style center stripe on cuff (mirrors hogu center panel) */}
      <rect x="15" y="23" width="2" height="5.5" fill="hsl(0 0% 100%)" fillOpacity="0.75" stroke="none"/>
      {/* Padded glove body — rounded plated shell */}
      <path d="M8 13.5c0-2.6 2-4.5 4.5-4.5h7c2.5 0 4.5 1.9 4.5 4.5V22c0 .6-.5 1-1 1H9c-.6 0-1-.4-1-1v-8.5z" fill="currentColor" fillOpacity="0.55"/>
      <path d="M8 13.5c0-2.6 2-4.5 4.5-4.5h7c2.5 0 4.5 1.9 4.5 4.5V22c0 .6-.5 1-1 1H9c-.6 0-1-.4-1-1v-8.5z"/>
      {/* Segmented knuckle plates (like hogu plate seams) */}
      <path d="M12 12.5v9M16 11.8v9.2M20 12.5v9" strokeOpacity="0.85" strokeWidth="1"/>
      {/* Top knuckle highlights */}
      <path d="M10.5 12.2c.6-1.4 1.7-2.2 3-2.2M14.5 11.4c.5-1.1 1.5-1.6 2.5-1.6M18.5 11.4c1 0 2 .5 2.5 1.6" strokeOpacity="0.9" stroke="hsl(0 0% 100%)" strokeWidth="0.8"/>
      {/* Thumb pad */}
      <path d="M8 16c-1.7 0-3 1.1-3 2.6s1.3 2.6 3 2.6" fill="currentColor" fillOpacity="0.55"/>
      <path d="M8 16c-1.7 0-3 1.1-3 2.6s1.3 2.6 3 2.6"/>
    </svg>
  );
  if (kind === 'body') return (
    // Hogu (chest guard) — segmented plates + target
    <svg viewBox="0 0 32 32" style={s} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Shoulder straps */}
      <path d="M9 6l3 3M23 6l-3 3" strokeWidth="2"/>
      {/* Main hogu body */}
      <path d="M7 9l5-2h8l5 2v10c0 4.4-3.6 8-8 8h-2c-4.4 0-8-3.6-8-8V9z" fill="currentColor" fillOpacity="0.35"/>
      <path d="M7 9l5-2h8l5 2v10c0 4.4-3.6 8-8 8h-2c-4.4 0-8-3.6-8-8V9z"/>
      {/* Vertical center seam */}
      <line x1="16" y1="7" x2="16" y2="27" strokeOpacity="0.7"/>
      {/* Horizontal plate seams */}
      <path d="M7.5 14h17M8 19h16" strokeOpacity="0.5"/>
      {/* Target ring */}
      <circle cx="16" cy="16.5" r="3.6" fill="currentColor" fillOpacity="0.9"/>
      <circle cx="16" cy="16.5" r="2.2" fill="hsl(0 0% 100%)" fillOpacity="0.85"/>
      <circle cx="16" cy="16.5" r="1" fill="currentColor"/>
    </svg>
  );
  return (
    // Head guard (helmet) — side/front hybrid with cheek + chin strap + target
    <svg viewBox="0 0 32 32" style={s} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Skull dome */}
      <path d="M6 15a10 10 0 0 1 20 0v4H6v-4z" fill="currentColor" fillOpacity="0.3"/>
      <path d="M6 15a10 10 0 0 1 20 0v4H6v-4z"/>
      {/* Cheek + jaw guard */}
      <path d="M8 19v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" fill="currentColor" fillOpacity="0.2"/>
      <path d="M8 19v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3"/>
      {/* Ear cutout */}
      <circle cx="9" cy="17" r="1.4" fill="currentColor" fillOpacity="0.9"/>
      <circle cx="23" cy="17" r="1.4" fill="currentColor" fillOpacity="0.9"/>
      {/* Chin strap */}
      <path d="M11 25l1.5 2h7L21 25" strokeOpacity="0.7"/>
      {/* Face opening arch */}
      <path d="M11 19h10" strokeOpacity="0.6"/>
      {/* Target ring on forehead */}
      <circle cx="16" cy="13" r="3" fill="currentColor" fillOpacity="0.9"/>
      <circle cx="16" cy="13" r="1.7" fill="hsl(0 0% 100%)" fillOpacity="0.85"/>
      <circle cx="16" cy="13" r="0.8" fill="currentColor"/>
    </svg>
  );
}


// ===== HIT STATS CHIP — real equipment photos, replaces the old generic
// SVG icon chips in the corners of each score panel. =====
// Read-only display of Punch / Body / Head hit counts. Data comes straight
// from getHitCounts() (derived from state.events, the single source of
// truth for the match) — this component never keeps its own counters.
const HIT_STAT_EQUIPMENT: Record<'punch' | 'body' | 'head', { chung: string; hong: string; labelKey: 'broadcastPunch' | 'broadcastBody' | 'broadcastHead' }> = {
  punch: { chung: gloveBlueUrl, hong: gloveRedUrl, labelKey: 'broadcastPunch' },
  body: { chung: huguBlueUrl, hong: huguRedUrl, labelKey: 'broadcastBody' },
  head: { chung: headgearBlueUrl, hong: headgearRedUrl, labelKey: 'broadcastHead' },
};

function HitStatChip({ kind, count, side, pulseKey, reverse, size = 22 }: {
  kind: 'punch' | 'body' | 'head';
  count: number;
  side: 'chung' | 'hong';
  pulseKey: number; // increments each time this stat goes up -> replays the glow
  reverse?: boolean; // true = number first then icon (used on the HONG/right-aligned side)
  size?: number; // wired to the existing admin "Hit icon (px)" slider (displaySettings.hitIconSize)
}) {
  const { t } = useI18n();
  const eq = HIT_STAT_EQUIPMENT[kind];
  const img = side === 'chung' ? eq.chung : eq.hong;
  const accent = side === 'chung' ? 'hsl(217 91% 78%)' : 'hsl(0 80% 82%)';
  const display = String(Math.max(0, count)).padStart(2, '0');
  const iconEl = (
    <img key="icon" src={img} alt={t(eq.labelKey)} draggable={false} style={{
      width: size, height: size, objectFit: 'contain',
    }} />
  );
  const numEl = (
    <span key="num" className="hs-chip-num font-display font-black text-white tabular-nums" style={{
      fontSize: 'clamp(14px, 1.1vw, 20px)', minWidth: 22, textAlign: reverse ? 'left' : 'right',
    }}>{display}</span>
  );
  return (
    <div key={pulseKey} className="hs-chip flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{
      background: 'rgba(0,0,0,0.5)', border: '1.5px solid rgba(255,255,255,0.25)', color: accent,
      animation: pulseKey > 0 ? 'hsChipGlow 480ms cubic-bezier(0.22,1,0.36,1)' : 'none',
    }}>
      {reverse ? [numEl, iconEl] : [iconEl, numEl]}
      <style>{`
        @keyframes hsChipGlow {
          0% { box-shadow: none; }
          30% { box-shadow: 0 0 18px ${accent}; }
          100% { box-shadow: none; }
        }
      `}</style>
    </div>
  );
}

// ===== VIDEO REPLAY QUOTA — state-driven visual indicator =====
// Shows one artwork per available replay card. Used cards remain visible but
// transition to a dark/inactive state so the operator/spectator can see the
// original quota at a glance. The icon size scales down gently as the number
// of cards grows; no new image assets are created.
function VideoReplayQuota({
  quota,
  totalQuota,
  side,
}: {
  quota: number;
  totalQuota: number;
  side: 'chung' | 'hong';
}) {
  const { t } = useI18n();
  const total = Math.max(0, Math.min(12, Math.floor(totalQuota || 0)));
  if (total === 0) return null;
  const remaining = Math.max(0, Math.min(total, Math.floor(quota || 0)));
  const base = total <= 2 ? 50 : total <= 4 ? 43 : total <= 6 ? 37 : total <= 8 ? 32 : 28;
  const asset = side === 'chung' ? videoReplayAvailableBlueUrl : videoReplayUnavailableRedUrl;
  const accent = side === 'chung' ? 'hsl(217 91% 60%)' : 'hsl(0 85% 55%)';

  return (
    <div
      className={`video-replay-quota video-replay-quota-${side}`}
      aria-label={`${remaining} of ${total} video replay cards available`}
      style={{ '--vr-size': `${base}px`, '--vr-accent': accent } as React.CSSProperties}
    >
      {Array.from({ length: total }, (_, i) => {
        const available = i < remaining;
        return (
          <div key={`${side}-ivr-${i}`} className={`video-replay-card ${available ? 'is-available' : 'is-used'}`}
            title={available ? t('broadcastReplayAvailable') : t('broadcastReplayUsed')}>
            <img src={asset} alt="" draggable={false} />
          </div>
        );
      })}
    </div>
  );
}

// ===== CONFETTI =====
function Confetti({ color }: { color: 'chung' | 'hong' }) {
  const particles = useRef(
    Array.from({ length: 80 }, (_, i) => ({
      id: i, x: Math.random() * 100, delay: Math.random() * 4,
      duration: 2.5 + Math.random() * 3, size: 4 + Math.random() * 10,
      hue: color === 'chung' ? 200 + Math.random() * 40 : Math.random() * 40,
      rotation: Math.random() * 360,
    }))
  ).current;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {particles.map(p => (
        <div key={p.id} className="absolute" style={{
          left: `${p.x}%`, top: '-12px', width: p.size, height: p.size * 0.5,
          background: `hsl(${p.hue} 85% 60%)`, borderRadius: 2,
          animation: `confettiFall ${p.duration}s ${p.delay}s linear infinite`,
          transform: `rotate(${p.rotation}deg)`,
        }} />
      ))}
      <style>{`@keyframes confettiFall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(110vh) rotate(900deg);opacity:0} }`}</style>
    </div>
  );
}

// ===== LIGHT PARTICLES =====
function LightParticles({ color }: { color: string }) {
  const dots = useRef(
    Array.from({ length: 30 }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: 2 + Math.random() * 4, delay: Math.random() * 5, duration: 3 + Math.random() * 4,
    }))
  ).current;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-5">
      {dots.map(d => (
        <div key={d.id} className="absolute rounded-full" style={{
          left: `${d.x}%`, top: `${d.y}%`, width: d.size, height: d.size,
          background: color, opacity: 0.4,
          animation: `particleFloat ${d.duration}s ${d.delay}s ease-in-out infinite alternate`,
        }} />
      ))}
      <style>{`@keyframes particleFloat { 0%{transform:translateY(0) scale(1);opacity:0.2} 50%{opacity:0.6} 100%{transform:translateY(-40px) scale(1.5);opacity:0.1} }`}</style>
    </div>
  );
}

// ===== TROPHY BURST — Par Équipe championship reveal =====
// Golden trophy rising from the bottom, ringed by expanding energy waves,
// slowly rotating light rays, rising sparks and two soft lens flares.
// Shown once, on entrance, behind the WINNER banner for team-match
// ("Par Équipe") results only — it's the whole squad's championship
// moment, not a per-player effect.
function TrophyBurst() {
  const sparks = useRef(
    Array.from({ length: 46 }, (_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 46,
      delay: Math.random() * 1.8,
      duration: 1.8 + Math.random() * 1.6,
      size: 2 + Math.random() * 3,
      drift: (Math.random() - 0.5) * 60,
    }))
  ).current;
  return (
    <div className="absolute inset-0 flex items-end justify-center pointer-events-none z-10" style={{ overflow: 'hidden' }}>
      {/* slowly rotating golden light rays behind the trophy */}
      <div className="absolute" style={{
        bottom: '4%', width: '120vmax', height: '120vmax',
        background: 'repeating-conic-gradient(hsl(45 100% 62% / 0.10) 0deg 4deg, transparent 4deg 14deg)',
        animation: 'trophyRaysRotate 14s linear infinite',
        maskImage: 'radial-gradient(circle at 50% 100%, black 0%, transparent 55%)',
        WebkitMaskImage: 'radial-gradient(circle at 50% 100%, black 0%, transparent 55%)',
      }} />
      {/* expanding rings from the trophy base */}
      {[0, 0.5, 1].map(delay => (
        <div key={delay} className="absolute rounded-full" style={{
          bottom: 18, left: '50%', width: 12, height: 12,
          border: '2px solid hsl(45 93% 65% / 0.6)',
          animation: `trophyRing 2.2s ease-out ${delay}s infinite`,
        }} />
      ))}
      {/* rising golden sparks */}
      {sparks.map(s => (
        <div key={s.id} className="absolute rounded-full" style={{
          left: `${s.x}%`, bottom: 20, width: s.size, height: s.size,
          background: 'hsl(45 93% 68%)', boxShadow: '0 0 6px hsl(45 93% 60%)',
          animation: `trophySpark ${s.duration}s ${s.delay}s ease-out infinite`,
          // @ts-ignore — custom property read by the keyframes below
          '--drift': `${s.drift}px`,
        } as React.CSSProperties} />
      ))}
      {/* two soft lens flares drifting near the trophy */}
      <div className="absolute rounded-full" style={{
        left: '38%', bottom: '46%', width: 10, height: 10,
        background: 'hsl(48 100% 92%)', boxShadow: '0 0 24px 8px hsl(48 100% 78% / 0.8)',
        animation: 'trophyFlareA 4.5s ease-in-out 1.4s infinite',
      }} />
      <div className="absolute rounded-full" style={{
        left: '63%', bottom: '58%', width: 6, height: 6,
        background: 'hsl(45 100% 90%)', boxShadow: '0 0 18px 6px hsl(45 100% 75% / 0.7)',
        animation: 'trophyFlareB 5.2s ease-in-out 1.9s infinite',
      }} />
      {/* the trophy itself */}
      <img src={trophyWabTkdUrl} alt="" className="relative" style={{
        width: 150, height: 'auto',
        filter: 'drop-shadow(0 0 20px hsl(45 100% 85% / 0.7)) drop-shadow(0 0 44px hsl(45 93% 58% / 0.6)) drop-shadow(0 0 84px hsl(45 93% 58% / 0.3))',
        animation: 'trophyRise 1.1s cubic-bezier(0.2,0.7,0.25,1) both, trophyFloat 3.2s ease-in-out 1.1s infinite',
      }} />
      <style>{`
        @keyframes trophyRise { 0%{ transform: translateY(60%); opacity: 0; } 100%{ transform: translateY(0); opacity: 1; } }
        @keyframes trophyFloat { 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-8px); } }
        @keyframes trophyRing { 0%{ transform: translate(-50%,50%) scale(0); opacity: 0.9; border-width: 3px; }
          100%{ transform: translate(-50%,50%) scale(18); opacity: 0; border-width: 1px; } }
        @keyframes trophySpark { 0%{ transform: translate(0,0) scale(1); opacity: 0; }
          10%{ opacity: 1; } 100%{ transform: translate(var(--drift), -220px) scale(0.3); opacity: 0; } }
        @keyframes trophyRaysRotate { 0%{ transform: translateX(-50%) rotate(0deg); } 100%{ transform: translateX(-50%) rotate(360deg); } }
        @keyframes trophyFlareA { 0%,100%{ opacity: 0; transform: scale(0.6); } 50%{ opacity: 1; transform: scale(1.3); } }
        @keyframes trophyFlareB { 0%,100%{ opacity: 0; transform: scale(0.6); } 55%{ opacity: 0.9; transform: scale(1.2); } }
      `}</style>
    </div>
  );
}

// ===== ENTRY FREEZE — brief pre-reveal build-up for Par Équipe endings =====
// Match freezes → VS mark pulses once → screen darkens, then fades out to
// hand off to the champion reveal beneath it once winnerScale kicks in.
function EntryFreeze({ vsPulse, dark, done }: { vsPulse: boolean; dark: boolean; done: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none" style={{
      background: dark ? 'hsl(224 40% 2% / 0.92)' : 'transparent',
      opacity: done ? 0 : 1,
      transition: done ? 'opacity 0.55s ease-out' : 'background 0.55s ease-in',
    }}>
      <div className="font-display font-black" style={{
        fontSize: 'clamp(48px,8vw,96px)', color: 'hsl(0 0% 100%)',
        textShadow: '0 0 60px hsl(0 0% 100% / 0.8)',
        animation: vsPulse ? 'entryVsPulse 0.6s ease-out both' : 'none',
        opacity: vsPulse ? 1 : 0,
      }}>VS</div>
      <style>{`@keyframes entryVsPulse { 0%{ transform: scale(1); opacity: 0.9; } 45%{ transform: scale(1.4); opacity: 1; } 100%{ transform: scale(1); opacity: 0; } }`}</style>
    </div>
  );
}


function TeamWinnerScreen({ state, winner, winnerScale, isMiniPreview = false }: { state: any; winner: PlayerColor; winnerScale: boolean; isMiniPreview?: boolean }) {
  const { t } = useI18n();
  // FINAL BROADCAST TEMPLATE: RED is always LEFT, BLUE is always RIGHT on
  // the audience display — matching Player Call, the live match screen,
  // and every other screen in the app. (This used to say the opposite and
  // rendered BLUE on the left / RED on the right, inconsistent with the
  // rest of the broadcast.) The screen is intentionally static and
  // information-driven: no explosive reveal, no confetti burst, and no
  // moving trophy. The exact WAB-TKD trophy asset supplied for this
  // project is used in the center.
  const redSide: PlayerColor = 'hong';
  const blueSide: PlayerColor = 'chung';
  const rounds = Math.max(4, state.config?.rounds || 4, state.roundWinners?.length || 0);
  const trophyUrl = trophyWabTkdUrl;

  const meta = (side: PlayerColor) => {
    const p = state[side]?.player || {};
    const roster = (state.teamRoster?.[side] || []) as any[];
    return {
      teamName: state.teamNames?.[side] || (side === redSide ? 'RED TEAM' : 'BLUE TEAM'),
      clubName: state.clubNames?.[side] || p.club || 'CLUB',
      teamLogo: state.teamLogos?.[side] || p.teamLogo,
      clubLogo: state.clubLogos?.[side] || p.clubLogo,
      country: state.teamCountry?.[side] || p.nationality,
      roster,
      score: side === blueSide ? state.chung.totalScore : state.hong.totalScore,
      color: side === redSide ? '#d33a45' : '#2467d6',
    };
  };

  const red = meta(redSide);
  const blue = meta(blueSide);
  const redWon = winner === redSide;

  const roundScore = (side: PlayerColor, round: number) => {
    const rw = state.roundWinners?.find((r: any) => r.round === round);
    if (!rw) return '—';
    return side === blueSide ? (rw.chungScore ?? '—') : (rw.hongScore ?? '—');
  };

  const playerRoundScore = (p: any, round: number) => {
    const direct = p?.roundScores?.find?.((r: any) => r.round === round);
    return direct?.score ?? '—';
  };

  const PlayerCard = ({ p, side, index }: { p: any; side: PlayerColor; index: number }) => {
    const c = side === redSide ? red.color : blue.color;
    const initials = (p?.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x: string) => x[0]).join('').toUpperCase();
    return (
      <div className="relative overflow-hidden rounded-xl" style={{
        border: `2px solid ${c}`,
        background: `linear-gradient(160deg, ${c}22, rgba(3,7,15,.97) 38%, rgba(0,0,0,.98))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.08), inset 0 0 22px ${c}12, 0 8px 22px rgba(0,0,0,.4), 0 0 14px ${c}25`,
      }}>
        <div className="absolute left-2 top-2 z-10 rounded-md px-2 py-1 font-display font-black" style={{ background: c, color: '#05070b', fontSize: 10 }}>
          {index + 1}
        </div>
        <div className="p-2">
          {p?.photo ? (
            <img src={p.photo} alt="" className="w-full object-cover rounded-lg" style={{ aspectRatio: '1 / 1.08', border: `1px solid ${c}75` }} />
          ) : (
            <div className="w-full rounded-lg flex items-center justify-center font-display font-black" style={{ aspectRatio: '1 / 1.08', border: `1px solid ${c}65`, background: `${c}12`, color: c, fontSize: 28 }}>
              {initials}
            </div>
          )}
          <div className="mt-2 text-center font-display font-black text-white leading-tight truncate" style={{ fontSize: 'clamp(10px, 1vw, 16px)' }}>
            {p?.name || 'PLAYER'}
          </div>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-white/60 font-display" style={{ fontSize: 9 }}>
            {p?.nationality && <FlagImage code={p.nationality} size={16} className="rounded" />}
            <span>{p?.nationality || '—'}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap font-display" style={{ fontSize: 8 }}>
            {(p?.weight || state.weightCategory) && <span className="px-2 py-0.5 rounded-full text-white/70" style={{ border: '1px solid rgba(255,255,255,.14)' }}>{p?.weight || state.weightCategory}</span>}
            {p?.rank && <span className="px-2 py-0.5 rounded-full" style={{ border: `1px solid ${c}70`, color: '#ffd866' }}>RANK {p.rank}</span>}
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1 rounded-lg p-1" style={{ background: 'rgba(0,0,0,.30)', border: '1px solid rgba(255,255,255,.08)' }}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="text-center rounded-md py-1" style={{ background: `${c}0c` }}>
                <div className="text-white/35 font-display" style={{ fontSize: 7 }}>R{i + 1}</div>
                <div className="font-display font-black" style={{ color: c, fontSize: 11 }}>{playerRoundScore(p, i + 1)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const TeamPanel = ({ side }: { side: PlayerColor }) => {
    const m = side === redSide ? red : blue;
    const isWinner = winner === side;
    return (
      <section className="relative min-w-0 rounded-2xl overflow-hidden" style={{
        border: `3px solid ${m.color}${isWinner ? 'ff' : '90'}`,
        background: `linear-gradient(160deg, ${m.color}${isWinner ? '22' : '0d'} 0%, rgba(4,6,10,.97) 40%, rgba(0,0,0,.99) 100%)`,
        boxShadow: isWinner
          ? `0 0 40px ${m.color}45, 0 14px 30px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.1), inset 0 0 30px ${m.color}12`
          : `0 0 18px ${m.color}08`,
        opacity: isWinner ? 1 : 0.62,
        filter: isWinner ? 'none' : 'grayscale(.65) brightness(.58)',
        transition: 'opacity .8s ease, filter .8s ease',
        animation: isWinner ? `${side === redSide ? 'teamGlowPulseRed' : 'teamGlowPulseBlue'} 3s ease-in-out 1s infinite` : undefined,
      }}>
        {/* Corner accent brackets — same broadcast-frame language as Player Call */}
        {isWinner && [['top','left' as const],['top','right' as const],['bottom','left' as const],['bottom','right' as const]].map(([v,h]) => (
          <div key={`${v}-${h}`} className="absolute w-9 h-9 pointer-events-none z-10" style={{
            [v]: -3, [h]: -3,
            borderTop: v==='top' ? `4px solid ${m.color}` : 'none',
            borderBottom: v==='bottom' ? `4px solid ${m.color}` : 'none',
            borderLeft: h==='left' ? `4px solid ${m.color}` : 'none',
            borderRight: h==='right' ? `4px solid ${m.color}` : 'none',
            filter: `drop-shadow(0 0 10px ${m.color})`,
          } as any} />
        ))}
        {/* Periodic light sweep on the winning panel */}
        {isWinner && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-y-0 w-1/4" style={{
              left: '-30%',
              background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.1) 45%, rgba(255,255,255,.18) 50%, rgba(255,255,255,.1) 55%, transparent)',
              animation: 'cardLightSweep 4s ease-in-out 1.8s infinite',
            }} />
          </div>
        )}
        <div className="h-1" style={{ background: `linear-gradient(90deg, transparent, ${m.color}, #fff8, ${m.color}, transparent)` }} />
        <div className="p-3 md:p-4">
          <div className="text-center font-display font-black tracking-[.24em]" style={{ color: isWinner ? '#ffd866' : 'rgba(255,255,255,.55)', fontSize: 10 }}>
            {isWinner ? t('broadcastWinningTeam') : t('broadcastLosingTeam')}
          </div>
          <div className="flex items-center justify-center gap-3 mt-2">
            {m.teamLogo && <img src={m.teamLogo} alt="" className="object-contain rounded-xl" style={{ width: 'clamp(54px, 5vw, 78px)', height: 'clamp(54px, 5vw, 78px)', border: `2px solid ${m.color}90`, background: '#02050a' }} />}
            {m.clubLogo && m.clubLogo !== m.teamLogo && <img src={m.clubLogo} alt="" className="object-contain rounded-lg" style={{ width: 'clamp(34px, 3vw, 46px)', height: 'clamp(34px, 3vw, 46px)', border: `1px solid ${m.color}70`, background: '#02050a' }} />}
          </div>
          <div className="text-center font-display font-black text-white mt-2 truncate" style={{ fontSize: 'clamp(18px, 2vw, 30px)' }}>{m.teamName}</div>
          {m.clubName && m.clubName !== 'CLUB' && <div className="text-center font-display font-bold mt-0.5 truncate" style={{ color: m.color, fontSize: 'clamp(10px, 1vw, 15px)' }}>{m.clubName}</div>}
          <div className="flex items-center justify-center gap-2 mt-1 text-white/70 font-display" style={{ fontSize: 10 }}>
            {m.country && <FlagImage code={m.country} size={18} className="rounded" />}
            {m.country && <span>{m.country}</span>}
          </div>
          <div className="mt-2 grid grid-cols-3 rounded-lg overflow-hidden" style={{ border: `1px solid ${m.color}40` }}>
            <div className="text-center py-1.5" style={{ borderRight: `1px solid ${m.color}30` }}><div className="text-white/40 font-display" style={{ fontSize: 7 }} >{t('broadcastPoints')}</div><div className="font-display font-black" style={{ color: m.color, fontSize: 19 }}>{m.score}</div></div>
            <div className="text-center py-1.5" style={{ borderRight: `1px solid ${m.color}30` }}><div className="text-white/40 font-display" style={{ fontSize: 7 }} >{t('broadcastWins')}</div><div className="font-display font-black text-white" style={{ fontSize: 16 }}>{state.roundWinners?.filter((r: any) => r.winner === side).length || 0}</div></div>
            <div className="text-center py-1.5"><div className="text-white/40 font-display" style={{ fontSize: 7 }} >{t('broadcastStatus')}</div><div className="font-display font-black" style={{ color: isWinner ? '#ffd866' : '#fff', fontSize: 11 }}>{isWinner ? t('broadcastWinner') : t('broadcastFinal')}</div></div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {m.roster.slice(0, 3).map((p: any, i: number) => <PlayerCard key={`${p?.name || 'player'}-${i}`} p={p} side={side} index={i} />)}
          </div>
        </div>
      </section>
    );
  };

  const openAudience = async () => { try { await window.electronAPI?.openPublicDisplay?.(); } catch {} };
  const fullScreen = async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch {} };

  return (
    <div className="fixed inset-0 overflow-hidden text-white" style={{ background: '#01040a', fontFamily: 'Inter, Cairo, sans-serif' }}>
      {/* Atmospheric background image behind the arena gradients — adds
          depth without ever competing with the score/roster content. */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.20 }}>
        <img src={splashBannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'blur(3px) saturate(1.2)' }} />
      </div>
      {/* Static arena background: strong red/blue sides, gold center, no explosions. */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 48%, rgba(255,207,73,.24), transparent 22%), linear-gradient(90deg, rgba(45,125,246,.30) 0%, rgba(45,125,246,.10) 30%, transparent 44%, transparent 56%, rgba(239,51,64,.10) 70%, rgba(239,51,64,.30) 100%)' }} />
      <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 80%, rgba(255,180,20,.16), transparent 40%), linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.58))' }} />
      <div className="absolute inset-3 pointer-events-none rounded-2xl" style={{ border: '2px solid rgba(255,216,102,.6)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06), inset 0 0 90px rgba(255,200,60,.08), 0 0 40px rgba(255,200,60,.1)' }} />

      <div className="relative z-10 h-full flex flex-col p-3 md:p-5 gap-3">
        <header className="flex items-center justify-between px-2 md:px-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <img src={appIconUrl} alt="" className="w-10 h-10 md:w-12 md:h-12 rounded-xl" />
            <div className="leading-tight hidden sm:block"><div className="font-display font-black tracking-wider text-white" style={{ fontSize: 14 }}>WAB-TKD</div><div className="text-[8px] text-white/45 tracking-[.16em] uppercase">{t('broadcastWorldAdvanced')}</div></div>
          </div>
          <div className="text-center">
            <div className="font-display font-black tracking-[.16em]" style={{ fontSize: 'clamp(34px, 5vw, 72px)', color: '#ffd866', lineHeight: .82, textShadow: '0 0 22px rgba(255,210,90,.45)' }} >{t('broadcastWinner')}</div>
            <div className="font-display font-bold tracking-[.3em] text-white/85 mt-2" style={{ fontSize: 'clamp(9px, 1vw, 14px)' }} >{t('broadcastEnded')}</div>
          </div>
          <div className="text-right hidden sm:block"><div className="font-display font-black tracking-wider text-white" style={{ fontSize: 14 }} >{t('broadcastWorldArena')}</div><div className="text-[8px] text-white/45 tracking-[.16em] uppercase" >{t('broadcastLabel')}</div></div>
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_minmax(250px,.78fr)_minmax(0,1fr)] gap-3 items-stretch">
          <TeamPanel side={redSide} />

          <section className="relative min-w-0 rounded-2xl overflow-hidden flex flex-col items-center justify-center" style={{ border: '3px solid rgba(255,216,102,.65)', background: 'linear-gradient(160deg, rgba(255,202,64,.12), rgba(2,6,13,.88) 42%, rgba(0,0,0,.97))', boxShadow: '0 0 48px rgba(255,194,35,.22), inset 0 1px 0 rgba(255,255,255,.1), inset 0 0 40px rgba(255,214,90,.06)' }}>
            {/* Corner accent brackets — same broadcast-frame language as the team panels and Player Call */}
            {[['top','left' as const],['top','right' as const],['bottom','left' as const],['bottom','right' as const]].map(([v,h]) => (
              <div key={`${v}-${h}`} className="absolute w-8 h-8 pointer-events-none z-30" style={{
                [v]: -3, [h]: -3,
                borderTop: v==='top' ? '3px solid #ffd866' : 'none',
                borderBottom: v==='bottom' ? '3px solid #ffd866' : 'none',
                borderLeft: h==='left' ? '3px solid #ffd866' : 'none',
                borderRight: h==='right' ? '3px solid #ffd866' : 'none',
                filter: 'drop-shadow(0 0 8px #ffd866)',
              } as any} />
            ))}
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, transparent, #ffd866, #fff6c0, #ffd866, transparent)' }} />
            {/* Slowly rotating light rays behind the trophy — a real pedestal-spotlight moment */}
            <div className="absolute pointer-events-none" style={{
              width: 'min(60vw, 900px)', height: 'min(60vw, 900px)', top: '38%', left: '50%',
              transform: 'translate(-50%,-50%)',
              background: 'conic-gradient(from 0deg, transparent, rgba(255,216,102,.10), transparent 12%, transparent 50%, rgba(255,216,102,.08), transparent 62%)',
              animation: 'vsRingSpin 22s linear infinite',
            }} />
            <div className="absolute inset-x-0 top-10 h-32 pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(255,219,110,.20), transparent 68%)' }} />
            {/* Rising sparkle particles around the trophy */}
            {[...Array(8)].map((_, i) => (
              <div key={i} className="absolute rounded-full pointer-events-none" style={{
                left: `${18 + (i * 11) % 64}%`, bottom: '8%',
                width: 2 + (i % 3), height: 2 + (i % 3),
                background: '#ffe9ab', boxShadow: '0 0 6px #ffd866',
                animation: `particleFloatGold ${4 + (i % 4)}s ease-in-out ${i * .5}s infinite`,
              }} />
            ))}
            <div className="font-display font-black tracking-[.24em] text-[#ffd866] relative z-20" style={{ fontSize: 10 }} >{state.competitionName || t('broadcastChampionship')}</div>
            <img src={trophyUrl} alt="WAB-TKD championship trophy" className="relative z-20 object-contain" style={{ width: 'min(29vw, 430px)', height: 'min(58vh, 560px)', filter: 'drop-shadow(0 0 22px rgba(255,240,200,.8)) drop-shadow(0 0 46px rgba(255,216,102,.6)) drop-shadow(0 0 84px rgba(255,170,0,.32))', objectPosition: 'center', animation: 'trophyRise 1.1s cubic-bezier(0.2,0.7,0.25,1) both, trophyFloat 3.6s ease-in-out 1.1s infinite' }} />
            <div className="relative z-20 -mt-3 rounded-xl px-5 py-2 text-center" style={{ border: '2px solid rgba(255,216,102,.7)', background: 'rgba(2,5,10,.9)', boxShadow: '0 0 32px rgba(255,190,30,.22)' }}>
              <div className="font-display font-bold text-[#ffd866] tracking-[.16em]" style={{ fontSize: 9 }} >{t('broadcastFinalScore')}</div>
              <div className="font-display font-black leading-none" style={{ fontSize: 'clamp(34px, 4vw, 58px)' }}><span style={{ color: red.color }}>{red.score}</span><span className="text-white/35 mx-2">:</span><span style={{ color: blue.color }}>{blue.score}</span></div>
            </div>
          </section>

          <TeamPanel side={blueSide} />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center shrink-0">
          <div className="rounded-xl p-2" style={{ border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.62)' }}>
            <div className="grid grid-cols-5 gap-1 text-center font-display">
              <div className="text-white/40 text-[8px] py-1" >{t('broadcastRound')}</div>
              {[1,2,3,4].map(i => <div key={i} className="text-white/45 text-[8px] py-1">R{i}</div>)}
              <div className="text-white/40 text-[8px] py-1" >{t('broadcastTotal')}</div>
            </div>
            <div className="grid grid-cols-5 gap-1 text-center font-display items-center">
              <div className="font-black text-[10px]" style={{ color: blue.color }}>{blue.teamName}</div>
              {[1,2,3,4].map(i => <div key={i} className="font-black text-[13px]" style={{ color: blue.color }}>{roundScore(blueSide, i)}</div>)}
              <div className="font-black text-[16px]" style={{ color: blue.color }}>{blue.score}</div>
            </div>
            <div className="grid grid-cols-5 gap-1 text-center font-display items-center mt-1">
              <div className="font-black text-[10px]" style={{ color: red.color }}>{red.teamName}</div>
              {[1,2,3,4].map(i => <div key={i} className="font-black text-[13px]" style={{ color: red.color }}>{roundScore(redSide, i)}</div>)}
              <div className="font-black text-[16px]" style={{ color: red.color }}>{red.score}</div>
            </div>
          </div>

          <div className="rounded-xl px-5 py-2 text-center min-w-[180px]" style={{ border: '1px solid rgba(255,216,102,.42)', background: 'rgba(0,0,0,.72)' }}>
            <div className="font-display text-white/45 tracking-[.16em]" style={{ fontSize: 8 }} >{t('broadcastMatchInformation')}</div>
            <div className="font-display font-bold text-white/85 mt-1" style={{ fontSize: 10 }}>{state.weightCategory || t('broadcastCategory')} • {state.config?.competitionMode === 'par_equipe' ? 'PAR ÉQUIPE' : 'MATCH'}</div>
            <div className="font-display text-white/45 mt-1" style={{ fontSize: 8 }}>{state.eventDate || t('broadcastDate')} • {state.eventLocation || t('broadcastWorldArena')}</div>
          </div>

          <div className="rounded-xl p-2" style={{ border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.62)' }}>
            <div className="grid grid-cols-3 gap-2 text-center font-display">
              <div><div className="text-white/40 text-[8px]" >{t('broadcastMatchTime')}</div><div className="font-black text-[#ffd866] text-[13px]">{Math.floor((state.config?.roundTime || 120) / 60).toString().padStart(2,'0')}:{((state.config?.roundTime || 120) % 60).toString().padStart(2,'0')}</div></div>
              <div><div className="text-white/40 text-[8px]" >{t('broadcastJudges')}</div><div className="font-black text-emerald-400 text-[13px]">{state.connectedJudgeCount || state.config?.judgeCount || 0} / {state.config?.judgeCount || 3}</div></div>
              <div><div className="text-white/40 text-[8px]" >{t('broadcastReferee')}</div><div className="font-black text-emerald-400 text-[11px]" >{t('broadcastConnected')}</div></div>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-2 shrink-0">
          <button onClick={openAudience} className="px-5 py-2 rounded-lg font-display font-black text-xs tracking-widest" style={{ border: '1px solid rgba(255,216,102,.65)', background: 'rgba(255,190,40,.12)', color: '#ffd866' }}>▣ {t('broadcastAudienceScoreboard')}</button>
          <button onClick={fullScreen} className="px-4 py-2 rounded-lg font-display font-bold text-xs" style={{ border: '1px solid rgba(255,255,255,.16)', background: 'rgba(0,0,0,.45)', color: 'rgba(255,255,255,.72)' }} >{t('broadcastFullScreen')}</button>
        </div>
      </div>
    </div>
  );
}

function ScoreboardView({ isMiniPreview = false }: { isMiniPreview?: boolean } = {}) {
  const { state, dispatch } = useMatch();
  const { t, lang } = useI18n();

  // Transparent stream-overlay mode: add ?transparent=1 (or ?obs=1) to the
  // public display URL to use this window as an OBS/Streamlabs Browser
  // Source — background becomes fully transparent (so only the scoreboard
  // graphics show over the camera feed) and the internal nav bar is
  // hidden, since a production switcher/OBS scene provides its own chrome.
  // Everything else (scores, call animations, winner screen...) renders
  // exactly as normal. Has no effect unless the query param is present, so
  // regular Electron/browser windows are unaffected.
  const isStreamOverlay = React.useMemo(() => {
    if (isMiniPreview) return false;
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('transparent') === '1' || sp.get('obs') === '1';
    } catch { return false; }
  }, [isMiniPreview]);


  // "Who's up next" — when this match ends, the audience should immediately
  // see who's coming to the mat next (name + side color, VS), pulled from
  // the same tournament bracket the Operator screen advances. Read-only
  // here; only used once the match has actually finished.
  const [announceBracket, setAnnounceBracket] = useState<any[] | null>(null);
  useEffect(() => {
    const tournamentId = state.tournamentId;
    if (!tournamentId) { setAnnounceBracket(null); return; }
    (async () => {
      if (isLocalTournamentId(tournamentId)) {
        const rec = loadTournamentLocal(tournamentId);
        setAnnounceBracket(rec?.bracket_data?.bracket ?? null);
        return;
      }
      try {
        const { data: t } = await supabase.from('tournaments').select('bracket_data').eq('id', tournamentId).single();
        setAnnounceBracket((t?.bracket_data as any)?.bracket ?? null);
      } catch {
        setAnnounceBracket(null);
      }
    })();
  }, [state.tournamentId, state.status]);
  const nextMatch = announceBracket?.find((m: any) =>
    m.id !== state.bracketMatchId && !m.winner && !m.isBye && m.player1 && m.player2
  ) ?? null;
  // Public Display follows the same application language as the operator.
  // It remains a clean audience screen, but its UI text is bilingual through i18n.
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);
  // True on the real Public Scoreboard window OR when embedded as the live
  // mini-preview inside the Operator screen — in both cases none of the
  // operator/referee controls (nav bar, QR toggle, settings gear, fullscreen
  // button) should be reachable.
  const isPublicWindow = isPublicDisplayWindow() || isMiniPreview;
  const { chung, hong, currentRound, timeRemaining, status, config, result } = state;
  // Admin-controlled show/hide of flag/club/photo/stage/weight on the public screen.
  const dc = state.displayConfig || DEFAULT_DISPLAY_CONFIG;
  const [showNav, setShowNav] = useState(false);
  // Persistent nav bar: on the actual public/connected display window
  // (isPublicWindow) the audience must never see admin/operator controls,
  // so it never renders there. Everywhere else — including this same
  // screen when it's just being previewed inside the main app window —
  // it now stays permanently visible (not hover-gated) so the operator
  // can always jump back to Operator/Admin/Judge/Par Équipe from here.
  const persistentTopNav = !isPublicWindow && (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      
    </div>
  );
  const [showEndOfRound, setShowEndOfRound] = useState(false);
  // GOLDEN POINT cinematic visibility is now derived directly from synced
  // state (present = show, undefined = hidden) instead of local timers.
  // Both the automatic "round starts" trigger (MatchContext.tsx, operator
  // window) and the operator's manual "End animation now" button dispatch
  // GOLDEN_POINT_ANIMATE / CLEAR_GOLDEN_POINT_ANIMATE, which get mirrored
  // to this window like any other state field. This fixes a bug where the
  // cinematic could get stuck on screen forever if the match status
  // changed again (e.g. the golden round ended) before a local timeout
  // fired — see MatchContext.tsx for the full explanation.
  const showGoldenPoint = !!state.config.goldenRound && !!state.goldenPointAnimation;
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    // Plain "end of round" banner — unchanged, fires the moment rest begins
    // (golden round has no such banner; it gets its own cinematic instead).
    if (status === 'rest' && prevStatus !== 'rest' && !state.isGoldenRound) {
      setShowEndOfRound(true);
      const timer = setTimeout(() => setShowEndOfRound(false), 2000);
      prevStatusRef.current = status;
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = status;
  }, [status, state.isGoldenRound]);

  const [centiseconds, setCentiseconds] = useState(0);

  // ===== Score-scored flash (scale up + gold glow + brief pulse) =====
  const [chungFlash, setChungFlash] = useState(false);
  const [hongFlash, setHongFlash] = useState(false);
  const prevChungScoreRef = useRef<number | null>(null);
  const prevHongScoreRef = useRef<number | null>(null);
  useEffect(() => {
    const val = config.scoreResetPerRound ? getCurrentRoundScore(state, 'chung') : state.chung.totalScore;
    if (prevChungScoreRef.current !== null && val > prevChungScoreRef.current) {
      setChungFlash(true);
      const timer = setTimeout(() => setChungFlash(false), 650);
      prevChungScoreRef.current = val;
      return () => clearTimeout(timer);
    }
    prevChungScoreRef.current = val;
  }, [state.chung.totalScore, currentRound]);
  useEffect(() => {
    const val = config.scoreResetPerRound ? getCurrentRoundScore(state, 'hong') : state.hong.totalScore;
    if (prevHongScoreRef.current !== null && val > prevHongScoreRef.current) {
      setHongFlash(true);
      const timer = setTimeout(() => setHongFlash(false), 650);
      prevHongScoreRef.current = val;
      return () => clearTimeout(timer);
    }
    prevHongScoreRef.current = val;
  }, [state.hong.totalScore, currentRound]);
  const centiRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recentAction, setRecentAction] = useState<{ id: string; player: PlayerColor; type: string; points: number } | null>(null);
  const [ptgAnimation, setPtgAnimation] = useState(false); // flash+shake window (configurable)
  const [ptgFlash, setPtgFlash] = useState(false);
  const ptgActive = !!state.ptgActive; // Drive PTG UI from shared state (locked until referee confirms)
  const [winnerScale, setWinnerScale] = useState(false);
  const [entryVsPulse, setEntryVsPulse] = useState(false);
  const [entryDark, setEntryDark] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [sbTab, setSbTab] = useState<'sizes' | 'colors' | 'text'>('sizes');
  const DEFAULT_SB = {
    // Sizes
    hitIconSize: 22,
    roundBoxBorder: 2.5,
    gamjeomSize: 18,
    titleScale: 1,
    subScale: 1,
    playerNameScale: 1,
    bigScoreScale: 1,
    timerScale: 1,
    winnerSize: 1,
    flagScale: 1,
    // Colors (hex)
    titleColor: '#f5c842',
    subColor: '#f0f0f0',
    playerNameColor: '#ffffff',
    chungColor: '#2467d6',
    hongColor: '#d33a45',
    timerColor: '#f5c842',
    gamjeomColor: '#f5c842',
    hitIconColor: '#f5c842',
    roundActiveColor: '#f5c842',
    winnerColor: '#f5c842',
    // Video Replay (IVR) request banner text — white or yellow (or any color)
    ivrRequestColor: '#ffffff',
    // FIGHT badge
    fightText: 'FIGHT',
    fightColor: '#22c55e',
  };
  type SBSettings = typeof DEFAULT_SB;
  const [displaySettings, setDisplaySettings] = useState<SBSettings>(() => {
    try {
      const s = localStorage.getItem('tkd-scoreboard-settings');
      if (s) return { ...DEFAULT_SB, ...JSON.parse(s) };
    } catch {}
    return DEFAULT_SB;
  });
  useEffect(() => {
    try { localStorage.setItem('tkd-scoreboard-settings', JSON.stringify(displaySettings)); } catch {}
    // Re-read colors immediately when Tournament Manager restores a saved theme.
    const onRestore = () => {
      try {
        const raw = localStorage.getItem('tkd-scoreboard-settings');
        if (raw) setDisplaySettings(s => ({ ...s, ...JSON.parse(raw) }));
      } catch {}
    };
    window.addEventListener('wab-tournament-colors-restored', onRestore);
    // External scoreboard colors are part of the active tournament snapshot too.
    // This keeps a color change made outside Tournament Manager attached to the
    // current tournament, so opening that tournament later restores the same identity.
    const tid = state.tournamentId;
    if (tid) {
      const rec = loadTournamentLocal(tid);
      if (rec) {
        const colors = getExternalDisplayColors();
        saveTournamentLocal({ ...rec, display_colors: colors, bracket_data: { ...(rec.bracket_data || {}), displayColors: colors } });
      }
    }
    return () => window.removeEventListener('wab-tournament-colors-restored', onRestore);
  }, [displaySettings, state.tournamentId]);
  const sb = displaySettings;
  // Hit pulse counters — bump to retrigger CSS animation
  const [hitPulse, setHitPulse] = useState<{ chung: Record<string, number>; hong: Record<string, number> }>({ chung: {}, hong: {} });
  const prevHitsRef = useRef<{ chung: Record<string, number>; hong: Record<string, number> }>({ chung: {}, hong: {} });

  const [approvalToast, setApprovalToast] = useState<{ status: 'approved' | 'rejected'; judge: string; referee: string; type: string; player: string } | null>(null);

  // Supabase sync + judge approval toast (internet mode — needs both this
  // screen and the operator to have internet access).
  useEffect(() => {
    const matchCh = supabase.channel('match-sync')
      .on('broadcast', { event: 'match-state' }, (payload) => {
        if (payload.payload) dispatch({ type: 'SET_STATE', state: payload.payload });
      }).subscribe();
    const voteCh = supabase.channel('judge-votes')
      .on('broadcast', { event: 'score-vote-result' }, (payload) => {
        const p = payload.payload || {};
        setApprovalToast({
          status: p.status, judge: p.judgeName || 'Judge',
          referee: p.refereeName || 'Referee', type: p.type || '', player: p.player || '',
        });
        setTimeout(() => setApprovalToast(null), 2500);
      }).subscribe();
    return () => { supabase.removeChannel(matchCh); supabase.removeChannel(voteCh); };
  }, []);

  // ---------------------------------------------------------------------
  // Offline / local Wi-Fi sync — for an audience screen running as a plain
  // browser tab or webview on a SEPARATE device (e.g. an Android tablet
  // driving the venue TV), when the operator is in offline "Wi-Fi" mode
  // (no internet, so the Supabase channel above never fires). It connects
  // directly to the same local WebSocket server the desktop app already
  // runs for judge phones (electron/main.cjs, port 8787), registering as a
  // read-only "viewer" instead of a judge. This is skipped entirely when
  // this component IS the Electron-managed public window (isPublicWindow)
  // since that already gets state instantly over IPC — no need to also
  // open a socket to itself.
  // ---------------------------------------------------------------------
  const LOCAL_WS_KEY = 'tkd-public-ws-address';
  const [wsAddress, setWsAddress] = useState<string>(() => {
    try { return localStorage.getItem(LOCAL_WS_KEY) || ''; } catch { return ''; }
  });
  const [wsConnected, setWsConnected] = useState(false);
  const [showWifiConnect, setShowWifiConnect] = useState(false);
  const [wsAddressInput, setWsAddressInput] = useState(wsAddress);
  const wsRef = useRef<WebSocket | null>(null);
  const wsRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStandaloneScreen = typeof window !== 'undefined' && !isPublicWindow && !(window as any).electronAPI;

  useEffect(() => {
    if (!isStandaloneScreen || !wsAddress) { setWsConnected(false); return; }
    let cancelled = false;

    const scheduleRetry = () => {
      if (cancelled) return;
      if (wsRetryRef.current) clearTimeout(wsRetryRef.current);
      wsRetryRef.current = setTimeout(connect, 3000);
    };

    function connect() {
      if (cancelled) return;
      let url = wsAddress.trim();
      if (!/^wss?:\/\//i.test(url)) url = `ws://${url}`;
      let ws: WebSocket;
      try { ws = new WebSocket(url); } catch { scheduleRetry(); return; }
      wsRef.current = ws;
      ws.onopen = () => {
        setWsConnected(true);
        try {
          const token = new URLSearchParams(window.location.search).get('token') || '';
          ws.send(JSON.stringify({ type: 'hello-viewer', token }));
        } catch {}
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.event === 'match-state' && msg.payload) {
            dispatch({ type: 'SET_STATE', state: msg.payload });
          }
        } catch {}
      };
      ws.onclose = () => { setWsConnected(false); scheduleRetry(); };
      ws.onerror = () => { try { ws.close(); } catch {} };
    }
    connect();

    return () => {
      cancelled = true;
      if (wsRetryRef.current) clearTimeout(wsRetryRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [isStandaloneScreen, wsAddress, dispatch]);

  const saveWsAddress = (value: string) => {
    const trimmed = value.trim();
    setWsAddress(trimmed);
    try {
      if (trimmed) localStorage.setItem(LOCAL_WS_KEY, trimmed);
      else localStorage.removeItem(LOCAL_WS_KEY);
    } catch {}
  };

  // Track score events for action flash
  const prevEventsLen = useRef(state.events.length);
  useEffect(() => {
    if (state.events.length > prevEventsLen.current) {
      const e = state.events[state.events.length - 1];
      if (e.type !== 'gamjeom') {
        setRecentAction({ id: e.id, player: e.player, type: e.type, points: e.points });
        setTimeout(() => setRecentAction(null), 2500);
      }
    }
    prevEventsLen.current = state.events.length;
  }, [state.events.length]);

  // Centiseconds for last 10s
  useEffect(() => {
    if (status === 'fighting' && timeRemaining <= 10 && timeRemaining > 0) {
      setCentiseconds(99);
      centiRef.current = setInterval(() => setCentiseconds(p => p <= 0 ? 99 : p - 1), 10);
    } else {
      if (centiRef.current) clearInterval(centiRef.current);
      setCentiseconds(0);
    }
    return () => { if (centiRef.current) clearInterval(centiRef.current); };
  }, [status, timeRemaining]);

  // PTG announcement — replaces timer with flashing PTG + soft shake for a configurable window.
  // PTG stays visible until the referee confirms (state.ptgActive cleared) and round winner is announced.
  const ptgFlashStartedRef = useRef(false);
  useEffect(() => {
    if (state.ptgActive && !ptgFlashStartedRef.current) {
      ptgFlashStartedRef.current = true;
      setPtgAnimation(true);
      if (!isMiniPreview) sounds.endRound();
      const fi = setInterval(() => setPtgFlash(p => !p), 500);
      const durationMs = Math.max(1, config.ptgDisplayDuration ?? 5) * 1000;
      setTimeout(() => { clearInterval(fi); setPtgAnimation(false); setPtgFlash(false); }, durationMs);
    }
    if (!state.ptgActive) {
      ptgFlashStartedRef.current = false;
      setPtgAnimation(false);
      setPtgFlash(false);
    }
  }, [state.ptgActive]);

  // Match-end presentation is intentionally information-first.
  // There is no explosion, confetti burst, VS flash, or trophy entrance: the
  // finished-match template appears immediately and only its live data changes.
  useEffect(() => {
    if (status !== 'finished') {
      setWinnerScale(false);
      setEntryVsPulse(false);
      setEntryDark(false);
      return;
    }
    if (result) {
      if (!isMiniPreview) {
        sounds.winner();
        // Winner + Best Player (MVP) voice announcement — MVP is computed
        // the same way as the on-screen MVP card (sum of real recorded
        // roundScores across both rosters), so the voice never announces a
        // name the audience can't also see on screen.
        try {
          const winnerName = state[result.winner]?.player?.name;
          const winnerSideLabel = result.winner === 'hong' ? 'Red' : 'Blue';
          const mvpCandidates: { name: string; total: number }[] = [];
          (['chung', 'hong'] as PlayerColor[]).forEach((side) => {
            (state.teamRoster?.[side] || []).forEach((entry: any) => {
              const total = (entry.roundScores || []).reduce((sum: number, rs: any) => sum + (rs.score || 0), 0);
              if (total > 0) mvpCandidates.push({ name: entry.name, total });
            });
          });
          mvpCandidates.sort((a, b) => b.total - a.total);
          const mvp = mvpCandidates[0];
          setTimeout(() => {
            announcer.speak(`${winnerSideLabel} corner wins.${winnerName ? ' ' + winnerName + '.' : ''}`, { rate: 0.9 });
          }, 300);
          if (mvp) {
            setTimeout(() => announcer.announceMvp({ playerName: mvp.name, points: mvp.total }), 3200);
          }
        } catch {}
      }
      setEntryVsPulse(false);
      setEntryDark(false);
      setWinnerScale(true);
    }
  }, [status, result]);

  // Countdown warnings — chime at 30s and 10s remaining during a fighting round.
  const lastWarnedRef = useRef<number>(-1);
  useEffect(() => {
    if (status === 'fighting' && (timeRemaining === 30 || timeRemaining === 10)) {
      if (lastWarnedRef.current !== timeRemaining) {
        lastWarnedRef.current = timeRemaining;
        if (!isMiniPreview) {
          try {
            sounds.countdown();
            setTimeout(() => sounds.countdown(), 220);
            if (timeRemaining === 10) setTimeout(() => sounds.countdown(), 440);
          } catch {}
        }
      }
    }
    if (status !== 'fighting') lastWarnedRef.current = -1;
  }, [status, timeRemaining]);

  // Voice call players when rest time ends.
  const restEndedRef = useRef(false);
  useEffect(() => {
    if (status === 'rest') restEndedRef.current = false;
    if ((status === 'paused' || status === 'fighting') && state.awaitingRoundStart && !restEndedRef.current) {
      restEndedRef.current = true;
      if (!isMiniPreview) {
        try {
          const u = new SpeechSynthesisUtterance('Call players. Round ' + (currentRound + 1));
          u.rate = 0.95; u.pitch = 1; u.volume = 1;
          window.speechSynthesis?.cancel();
          window.speechSynthesis?.speak(u);
        } catch {}
      }
    }
  }, [status, state.awaitingRoundStart, currentRound]);


  // Voice announcement for the Team/Player Call cinematic. Fires once per
  // distinct call event (keyed by callAnimation.ts, set fresh by the reducer
  // every time START_CALL_ANIMATION / ADVANCE_CALL_ANIMATION runs) so a
  // re-render mid-animation never re-triggers or overlaps speech, and a
  // fast RED→BLUE chain always cancels the previous utterance in favor of
  // the new one (handled inside announcer.speak).
  const lastAnnouncedCallRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const ca = state.callAnimation;
    if (!ca || isMiniPreview || lastAnnouncedCallRef.current === ca.ts) return;
    lastAnnouncedCallRef.current = ca.ts;
    if (ca.phase === 'team') {
      announcer.announceTeamCall({ teamName: ca.teamName, clubName: ca.clubName, country: ca.teamCountry, side: ca.side });
    } else {
      announcer.announcePlayerCall({
        side: ca.side,
        playerName: ca.playerName,
        playerNumber: ca.playerNumber,
        seedNumber: (ca as any).seedNumber,
        nationality: ca.playerNationality,
        teamName: ca.teamName,
        clubName: ca.clubName,
        isSubstitution: ca.isSubstitution,
        outgoingName: ca.outgoingName,
      });
    }
  }, [state.callAnimation?.ts, isMiniPreview]);

  // SINGLE PLAYER CALL + MATCHUP — display-only, driven entirely by
  // state.singlePlayerCall / state.matchupAnimation (Main Referee only
  // dispatches the actions that set these).
  const matchupOverlay = <MatchupOverlay state={state} matchup={state.matchupAnimation} />;

  const handleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  const chungRoundScore = getCurrentRoundScore(state, 'chung');
  const hongRoundScore = getCurrentRoundScore(state, 'hong');
  const displayChung = config.scoreResetPerRound ? chungRoundScore : chung.totalScore;
  const displayHong = config.scoreResetPerRound ? hongRoundScore : hong.totalScore;
  const chungRoundWins = state.roundWinners.filter(r => r.winner === 'chung').length;
  const hongRoundWins = state.roundWinners.filter(r => r.winner === 'hong').length;
  const isLast30 = timeRemaining <= 30 && timeRemaining > 10 && status === 'fighting';
  const isLast10 = timeRemaining <= 10 && timeRemaining > 0 && status === 'fighting';
  const isLast5 = timeRemaining <= 5 && timeRemaining > 0 && status === 'fighting';
  const isTimeout = status === 'paused' && !state.awaitingRoundStart;
  const isSpecialStatus = status === 'doctor' || status === 'kyeshi' || status === 'ivr';

  const timerDisplay = isLast10
    ? `${timeRemaining}.${centiseconds.toString().padStart(2, '0')}`
    : formatTime(timeRemaining);

  // Professional timer color ladder: user's normal color -> yellow (<=30s) -> red (<=10s),
  // with a pulse starting only in the last 5 seconds.
  const timerStateColor = isLast10 ? 'hsl(0 72% 51%)' : isLast30 ? 'hsl(45 93% 58%)' : sb.timerColor;

  const getGamjeomForRound = (player: PlayerColor) =>
    state.events.filter(e => e.player === player && e.type === 'gamjeom' && e.round === currentRound).length;

  const getHitCounts = (player: PlayerColor) => {
    const evs = state.events.filter(e => e.player === player && e.round === currentRound);
    return {
      punch: evs.filter(e => e.type === 'punch').length,
      body: evs.filter(e => e.type === 'trunk_kick' || e.type === 'turning_kick').length,
      head: evs.filter(e => e.type === 'head_kick' || e.type === 'turning_head').length,
      turning: evs.filter(e => e.type === 'turning_kick' || e.type === 'turning_head').length,
    };
  };
  const chungHits = getHitCounts('chung');
  const hongHits = getHitCounts('hong');

  // Trigger pulse animation when a hit count goes up
  useEffect(() => {
    const ph = prevHitsRef.current;
    const next = { chung: { ...hitPulse.chung }, hong: { ...hitPulse.hong } };
    let changed = false;
    (['punch', 'body', 'head'] as const).forEach(k => {
      if ((chungHits[k] || 0) > (ph.chung[k] || 0)) { next.chung[k] = (next.chung[k] || 0) + 1; changed = true; }
      if ((hongHits[k] || 0) > (ph.hong[k] || 0)) { next.hong[k] = (next.hong[k] || 0) + 1; changed = true; }
    });
    prevHitsRef.current = { chung: { ...chungHits }, hong: { ...hongHits } };
    if (changed) setHitPulse(next);
  }, [chungHits.punch, chungHits.body, chungHits.head, hongHits.punch, hongHits.body, hongHits.head]);

  const getHitLabel = (type: string) => {
    switch (type) {
      case 'punch': return 'PUNCH';
      case 'trunk_kick': return 'BODY KICK';
      case 'head_kick': return 'HEAD KICK';
      case 'turning_kick': return 'TURNING KICK';
      case 'turning_head': return 'TURNING HEAD';
      default: return '';
    }
  };

  const currentFrame: 'fight' | 'rest' | 'match_end' =
    status === 'finished' ? 'match_end' : status === 'rest' ? 'rest' : 'fight';
  const currentRoundDecision = state.roundWinners.find(r => r.round === currentRound)?.decisionType;
  const currentRoundDecisionLabel = currentRoundDecision === 'AI_RECOMMENDATION' ? 'AI DECISION' : currentRoundDecision === 'WOOSE_GIROK' ? 'WOO-SE-GIROK' : '';

  // Standby splash — takes priority over EVERYTHING else on this screen
  // (call-up screen, live bout, results) until the operator explicitly
  // starts the broadcast. Never reachable from this screen itself; the
  // operator flips it on/off from BroadcastControl in the TopNav.
  const hasCinematicOverride = Boolean(
    state.singlePlayerCall ||
    state.matchupAnimation ||
    state.callAnimation ||
    state.autoCallSequence?.active ||
    state.substitutionAnimation ||
    (currentFrame === 'match_end' && result)
  );

  if (!state.publicBroadcastLive && !hasCinematicOverride) {
    return (
      <div
        dir="ltr"
        className={`fixed inset-0 bg-black overflow-hidden ${isMiniPreview ? 'public-scoreboard-mini' : ''}`}
        onMouseEnter={() => setShowNav(true)}
        onMouseLeave={() => setShowNav(false)}
      >
        {persistentTopNav}
        <img
          src={splashBannerUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover select-none"
          draggable={false}
        />
      </div>
    );
  }

  // Pre-match calling screen — shown for EVERY match (tournament, friendly,
  // or Par Équipe) until the referee presses "Match Ready" on the Operator
  // screen. Takes priority over the normal scoreboard, but never overrides
  // the winner/match_end screen (that's a different, already-decided state).
  // ===== Two-phase Call / Change-Player cinematic (Par Équipe) =====
  // Phase 'team': team logo + name + tournament name at top.
  // Phase 'player': player photo + name + numbers + category, in a frame
  // colored per side, with the tournament name still shown at top.
  // Replaces the old single-phase substitution flash entirely.
  const callAnim = state.callAnimation;
  const cc = state.callDisplayConfig || DEFAULT_CALL_DISPLAY_CONFIG;
  const nameFormat = (cc.nameFormat || 'full') as NameFormat;
  // 'subtle' halves the glow/particle strength of the call cinematic
  // (Player Call + Round Call Preview) for the admin-controlled light
  // intensity toggle. Multiply any opacity/blur figure that scales the
  // glow by this factor.
  const lightFactor = cc.lightIntensity === 'subtle' ? 0.5 : 1;
  // A 'player' phase call is either a fresh first-entrance call or a
  // mid-match substitution (isSubstitution) — the audience needs a
  // visibly different title for the latter so they don't think the
  // match is restarting from zero.
  const isChangeCall = !!callAnim?.isSubstitution;

  const competitionTypeLabel = state.config?.competitionMode === 'par_equipe' ? 'PAR ÉQUIPE'
    : state.config?.competitionMode === 'friendly' ? 'FRIENDLY'
    : state.config?.competitionMode === 'league' ? 'LEAGUE' : state.config?.competitionMode === 'super_fight' ? 'SUPER FIGHT' : 'TOURNAMENT';
  const genderLabel = state.gender === 'male' ? 'MALE' : state.gender === 'female' ? 'FEMALE' : '—';
  const publicMatchMetaBar = (
    <div className="relative z-20 w-full border-b-2 border-[#ffd866]/30 bg-[linear-gradient(180deg,rgba(5,7,14,.98),rgba(5,7,14,.88))] px-5 py-3 shadow-[0_8px_35px_rgba(0,0,0,.35)]">
      <div className="mx-auto max-w-[1900px] text-center">
        <div className="font-display font-black uppercase tracking-[.08em] text-[#fff1bd]" style={{ fontSize: 'clamp(24px, 3vw, 52px)', lineHeight: 1.05, textShadow: '0 0 28px rgba(255,216,102,.32)' }}>
          {state.competitionName || 'WAB-TKD'}
        </div>
        <div className="mx-auto mt-2 flex max-w-[1800px] flex-wrap items-center justify-center gap-2">
          {[
            ['TYPE', competitionTypeLabel],
            ['GENDER', genderLabel],
            ['AGE GROUP', state.ageGroup || '—'],
            ['DIVISION', state.division || state.config?.division || '—'],
            ['WEIGHT', state.weightCategory || '—'],
            ['MATCH', state.matchNumber ? `#${state.matchNumber}` : '---'],
            ...(status === 'rest' && currentRoundDecisionLabel ? [['ROUND DECISION', currentRoundDecisionLabel]] : []),
            ['DATE', state.eventDate || '—'],
            ['LOCATION', state.eventLocation || 'WORLD ARENA'],
          ].map(([label, value]) => (
            <span key={label} className="rounded-lg border border-[#ffd866]/25 bg-white/[.035] px-3 py-1.5 font-display text-[11px] font-black uppercase tracking-[.10em] text-white/85 shadow-[inset_0_0_14px_rgba(255,216,102,.04)]">
              <span className="text-[#ffd866]">{label}</span> <span className="mx-1 text-white/25">•</span> {value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  // Between-round team match preview: show the exact two athletes assigned to
  // the upcoming round with a fixed BLUE-right / RED-left VS composition.
  // This is intentionally different from the first-match team call.
  const roundPreview = state.roundCallPreview;
  const roundPreviewAge = roundPreview ? Date.now() - roundPreview.ts : Infinity;
  // Exact PLAYER CALL cinematic from the supplied broadcast project.
  // It is driven by the live Main Referee call state; no demo data is used.
  const isParEquipeMatch = state.config?.competitionMode === 'par_equipe';
  // HARD ISOLATION: only one Player Call renderer can be active.
  // 1v1 and Par Équipe have separate components and separate activation rules.
  const callAnimationOverlay = (state.singlePlayerCall || (callAnim && callAnim.phase === 'player')) ? (
    isParEquipeMatch
      ? <ParEquipePlayerCallV515 state={state} />
      : <ExactPlayerCallV515 state={state} />
  ) : null;

  // TEAM CALL must have a real public-display renderer. Previously the
  // reducer changed callAnimation.phase to 'team', but PublicScoreboard only
  // rendered the player cinematic, so referee buttons changed state without
  // producing anything on the audience screen.
  const teamCallActive = Boolean(
    !state.substitutionAnimation &&
    state.callScreenActive &&
    (
      callAnim?.phase === 'team' ||
      state.autoCallSequence?.mode === 'teams' ||
      state.teamCallStatus?.chung === 'called' ||
      state.teamCallStatus?.hong === 'called'
    )
  );
  const teamCallOverlay = teamCallActive ? (
    <div className="fixed inset-0 z-[950] pointer-events-none overflow-hidden">
      <LiveTeamCallBroadcast state={state} dispatch={dispatch} isMiniPreview={isMiniPreview} />
    </div>
  ) : null;

  // One cinematic at a time. This prevents the round intro, call frames,
  // matchup and standby cards from stacking over each other before LIVE.
  const doctorCallOverlay = state.status === 'doctor' ? <DoctorCallAnimation isMiniPreview={isMiniPreview} /> : null;
  const kyeshiCallOverlay = state.status === 'kyeshi' ? <KyeshiCallAnimation timeRemaining={timeRemaining} isMiniPreview={isMiniPreview} /> : null;

  const cinematicActive = !!(state.status === 'doctor' || state.status === 'kyeshi' || state.substitutionAnimation || teamCallOverlay || callAnimationOverlay || state.matchupAnimation || state.singlePlayerCall || state.callAnimation || state.autoCallSequence?.active || state.ivrAnimation || state.koAnimation || state.mvpReveal || state.poolMvpReveal || state.roundStartIntro?.active);

  // Exact Par Équipe PLAYER CHANGE cinematic supplied by the user.
  // It is created only by CONFIRM_SUBSTITUTION in teamMode='substitution'
  // and is cleared by its own completion callback; the normal Player Call
  // overlay is intentionally not used for this flow.
  const substitutionAnimationOverlay = state.substitutionAnimation ? (() => {
    const sub = state.substitutionAnimation;
    const sideKey = sub.side;
    const side = sideKey === 'chung' ? 'BLUE' : 'RED';
    const toRosterPlayer = (player: typeof sub.oldPlayer, status: 'ACTIVE' | 'SUBSTITUTED') => ({
      matchPlayerId: `${state.id}-${sideKey}-${status}-${sub.ts}`,
      playerId: `${state.id}-${sideKey}-${player.name || 'player'}`,
      side,
      status,
      fullName: player.name || '—',
      photo: player.photo || '',
      teamName: state.teamNames?.[sideKey] || '',
      clubName: state.clubNames?.[sideKey] || state[sideKey].player.club || '',
      clubLogo: state.clubLogos?.[sideKey] || '',
      teamLogo: state.teamLogos?.[sideKey] || '',
      country: player.nationality || state.teamCountry?.[sideKey] || '',
      flag: player.nationality || state.teamCountry?.[sideKey] || '',
      weightCategory: state.weightCategory || '',
      playerNumber: player.playerNumber || 0,
      ranking: player.seedNumber ? String(player.seedNumber) : '',
      winRate: 0,
      previousScore: '',
    });
    return (
      <PlayerChangeAnimation
        key={sub.ts}
        visible
        side={side}
        oldPlayer={toRosterPlayer(sub.oldPlayer, 'SUBSTITUTED') as any}
        newPlayer={toRosterPlayer(sub.newPlayer, 'ACTIVE') as any}
        tournamentName={state.competitionName || t('broadcastChampionship')}
        eventDate={state.eventDate || ''}
        eventLocation={state.eventLocation || ''}
        matchNumber={state.matchNumber}
        roundNumber={state.currentRound}
        tournamentType={competitionTypeLabel}
        gender={genderLabel}
        ageGroup={state.ageGroup || ''}
        division={state.division || state.config?.division || ''}
        weightCategory={state.weightCategory || ''}
        tagSeconds={state.config?.parEquipeTagSeconds ?? 5}
        nameFormat={state.callDisplayConfig?.nameFormat || 'full'}
        teamInfo={{
          name: state.teamNames?.[sideKey] || state[sideKey].player.club || '',
          logo: state.teamLogos?.[sideKey] || '',
          club: state.clubNames?.[sideKey] || state[sideKey].player.club || '',
          country: state.teamCountry?.[sideKey] || state[sideKey].player.nationality || '',
        }}
        onComplete={() => dispatch({ type: 'CLEAR_SUBSTITUTION_ANIMATION' })}
      />
    );
  })() : null;
  // Restored pre-call cinematic from the previous WAB-TKD presentation.
  // It appears only during the call-screen waiting gap; active Team/Player/
  // Matchup animations always take visual priority over it.
  const nextOnMatchOverlay = state.callScreenActive
    && !callAnim
    && !state.singlePlayerCall
    && !state.matchupAnimation
    ? <NextOnMatchOverlay state={state} />
    : null;

  // ===== League standings — full-screen table, toggled by the operator
  // (state.showStandings) so it can be shown between matches without
  // leaving the Operator screen. Independent of match status so it can
  // even be shown mid-rest or right before the next call. =====
  const standingsOverlay = state.showStandings && state.leagueStandings && state.leagueStandings.length > 0 && (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{
      background: 'radial-gradient(ellipse at 50% 30%, hsl(224 35% 10%), hsl(224 40% 4%) 75%)',
      animation: 'frameEnter 0.4s ease-out',
    }}>
      <div className="text-center py-4 shrink-0" style={{ borderBottom: '1px solid hsl(224 35% 18%)' }}>
        <div className="font-display font-black text-[hsl(var(--gold))] tracking-[0.2em]" style={{ fontSize: 'clamp(22px, 3vw, 38px)' }}>
          🏆 {state.competitionName || 'LEAGUE'} — {t('broadcastStatus')}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 md:px-16 py-6">
        <table className="w-full font-display" style={{ fontSize: 'clamp(13px, 1.4vw, 22px)' }}>
          <thead>
            <tr className="text-white/40 text-left uppercase tracking-wider" style={{ fontSize: '0.6em' }}>
              <th className="pb-2 pl-2">#</th>
              <th className="pb-2" >{t('broadcastName')}</th>
              <th className="pb-2 text-center">P</th>
              <th className="pb-2 text-center">W</th>
              <th className="pb-2 text-center">L</th>
              <th className="pb-2 text-center">+/-</th>
              <th className="pb-2 pr-2 text-center" >{t('broadcastDiff')}</th>
            </tr>
          </thead>
          <tbody>
            {state.leagueStandings.map((s, i) => (
              <tr key={i} className="text-white" style={{
                background: i === 0 ? 'hsl(45 93% 58% / 0.12)' : i % 2 === 0 ? 'hsl(0 0% 100% / 0.03)' : 'transparent',
                borderBottom: '1px solid hsl(224 35% 15%)',
              }}>
                <td className="py-2.5 pl-2 font-black" style={{ color: i === 0 ? 'hsl(45 93% 58%)' : 'white' }}>{i + 1}</td>
                <td className="py-2.5 font-bold flex items-center gap-2">
                  {s.nationality && <FlagImage code={s.nationality} size={28} className="w-7 h-5 rounded shadow" />}
                  <span className="truncate">{s.name}</span>
                  {s.club && <span className="text-white/40 text-[0.7em] truncate">({s.club})</span>}
                </td>
                <td className="py-2.5 text-center text-white/70">{s.played}</td>
                <td className="py-2.5 text-center text-[hsl(142_71%_50%)] font-bold">{s.wins}</td>
                <td className="py-2.5 text-center text-[hsl(0_72%_58%)] font-bold">{s.losses}</td>
                <td className="py-2.5 text-center text-white/50">{s.pointsFor}-{s.pointsAgainst}</td>
                <td className="py-2.5 pr-2 text-center font-bold" style={{ color: s.diff > 0 ? 'hsl(142 71% 50%)' : s.diff < 0 ? 'hsl(0 72% 58%)' : 'white' }}>
                  {s.diff > 0 ? '+' : ''}{s.diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ===== READY banner — sticky ribbon shown before the match starts (Shijak),
  // separate from every other overlay/animation so it never overlaps them. =====
  const readyBanner = status === 'waiting' && (
    <div className="w-full py-2 px-4 text-center shrink-0 relative z-30" style={{
      background: 'linear-gradient(90deg, hsl(45 93% 40%), hsl(48 96% 55%), hsl(45 93% 40%))',
      borderTop: '2px solid hsl(50 100% 75%)',
      borderBottom: '2px solid hsl(45 93% 25%)',
      boxShadow: '0 4px 24px hsl(48 96% 55% / 0.55)',
      animation: 'readyPulse 1.6s ease-in-out infinite',
    }}>
      <div className="font-display font-black tracking-[0.32em] text-black" style={{
        fontSize: 'clamp(16px, 1.6vw, 26px)',
        textShadow: '0 1px 0 rgba(255,255,255,0.4)',
      }}>
        ⏳ READY — استعدوا — {broadcastName(chung.player.name, nameFormat)} VS {broadcastName(hong.player.name, nameFormat)} ⏳
      </div>
      <style>{`@keyframes readyPulse { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.3)} }`}</style>
    </div>
  );

  // ===== GREETING banner — both teams called, courtesy bow before player
  // calling begins. Only shown while the automatic call sequence is
  // actually paused on this stop (never a timer — referee confirms it). =====
  const greetingBanner = state.config.classification !== 'team' && state.autoCallSequence?.active && state.autoCallSequence.stage === 'GREETING' && !callAnim && (
    <div className="w-full py-2 px-4 text-center shrink-0 relative z-30" style={{
      background: 'linear-gradient(90deg, hsl(200 80% 40%), hsl(200 85% 55%), hsl(200 80% 40%))',
      borderTop: '2px solid hsl(200 90% 75%)',
      borderBottom: '2px solid hsl(200 80% 25%)',
      boxShadow: '0 4px 24px hsl(200 85% 55% / 0.55)',
      animation: 'readyPulse 1.6s ease-in-out infinite',
    }}>
      <div className="font-display font-black tracking-[0.28em] text-white" style={{
        fontSize: 'clamp(15px, 1.5vw, 24px)',
        textShadow: '0 1px 0 rgba(0,0,0,0.4)',
      }}>
        🤝 WAITING FOR GREETING — انتظار التحية 🤝
      </div>
    </div>
  );

  // ===== GOLDEN POINT banner — sticky ribbon during sudden-death round =====
  const goldenBanner = state.config.goldenRound && state.isGoldenRound && status !== 'finished' && (
    <div className="w-full py-2 px-4 text-center shrink-0 relative z-30" style={{
      background: 'linear-gradient(90deg, hsl(45 93% 45%), hsl(45 100% 60%), hsl(45 93% 45%))',
      borderTop: '2px solid hsl(45 100% 75%)',
      borderBottom: '2px solid hsl(45 100% 30%)',
      boxShadow: '0 4px 24px hsl(45 93% 58% / 0.6)',
      animation: 'goldenPulse 1.6s ease-in-out infinite',
    }}>
      <div className="font-display font-black tracking-[0.28em] text-black" style={{
        fontSize: 'clamp(16px, 1.6vw, 26px)',
        textShadow: '0 1px 0 rgba(255,255,255,0.5)',
      }}>
        🥇 GOLDEN POINT ROUND — النقطة الذهبية — FIRST VALID POINT WINS 🥇
      </div>
      <style>{`@keyframes goldenPulse { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.25)} }`}</style>
    </div>
  );

  // ===== GOLDEN POINT cinematic — full-screen, frame-independent overlay =====
  // Fires the instant the last rest period ends and the decisive (sudden-death)
  // round begins fighting — i.e. right after rest, right before the round is
  // truly under way. Rendered as a shared overlay (like goldenBanner above) so
  // it appears no matter which frame (rest/fight) is on screen at that moment:
  // impact flash → rotating rays → shockwave rings → rising sparks → a
  // spinning +1 gold circle (replaces the old static medal) + text landing
  // with a bounce. Arabic and English titles share identical size, weight and
  // glow — neither line dominates the other.
  const goldenPointOverlay = showGoldenPoint && (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden" style={{
      background: 'radial-gradient(ellipse at center, hsl(45 65% 9% / 0.98), hsl(224 35% 2% / 0.98))',
      animation: 'frameEnter 0.3s ease-out',
    }}>
      {/* Impact flash on entry — scaled by the same admin light-intensity
          toggle as Player Call / Round Call Preview, so all three call/score
          cinematics stay visually consistent. */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(circle, hsl(48 100% 88%) 0%, hsl(45 93% 58% / 0) 65%)',
        animation: 'gpFlash 0.7s ease-out forwards',
        opacity: lightFactor,
      }} />

      {/* Slowly rotating light rays behind everything */}
      <div className="absolute pointer-events-none" style={{
        width: '150vmax', height: '150vmax',
        background: `repeating-conic-gradient(hsl(45 100% 60% / ${0.14 * lightFactor}) 0deg 6deg, transparent 6deg 18deg)`,
        animation: 'gpRayRotate 9s linear infinite',
      }} />

      {/* Expanding shockwave rings, staggered */}
      {[0, 0.55, 1.1].map((delay) => (
        <div key={delay} className="absolute rounded-full pointer-events-none" style={{
          width: '100px', height: '100px',
          border: '3px solid hsl(45 100% 65% / 0.85)',
          animation: `gpShockwave 2s ease-out ${delay}s infinite`,
        }} />
      ))}

      {/* Rising gold sparks */}
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none" style={{
          width: `${4 + (i % 3) * 2}px`, height: `${4 + (i % 3) * 2}px`,
          left: `${(i * 6.25) % 100}%`,
          bottom: '-12px',
          background: 'hsl(45 100% 68%)',
          boxShadow: '0 0 10px hsl(45 100% 65%), 0 0 4px white',
          animation: `gpSparkRise ${2.6 + (i % 4) * 0.45}s ease-in ${(i * 0.18) % 2.4}s infinite`,
        }} />
      ))}

      {/* +1 circle + text — lands with an elastic bounce, then the
          circle keeps spinning on itself continuously (replaces the
          old static medal emoji) while the text settles into a
          steady pulse. Arabic and English titles are the same size,
          weight and glow — neither line dominates the other. */}
      <div className="text-center relative z-10" style={{ animation: 'gpZoomIn 0.75s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        {/* Gold coin — spins on its own axis like a rotating globe (sliding
            meridian stripes + a sweeping shine/terminator line) rather than
            a flat 2D spin, so the "+1" stays flat-facing and readable
            instead of flipping upside down mid-rotation. */}
        <div className="mx-auto relative flex items-center justify-center rounded-full overflow-hidden" style={{
          width: 'clamp(90px, 12vw, 160px)',
          height: 'clamp(90px, 12vw, 160px)',
          background: 'radial-gradient(circle at 35% 30%, hsl(48 100% 78%), hsl(45 90% 42%) 72%)',
          border: '4px solid hsl(45 100% 88%)',
          boxShadow: '0 0 40px hsl(45 100% 60% / 0.8), inset 0 0 22px hsl(28 80% 30% / 0.5)',
          animation: 'gpCircleEnter 0.9s cubic-bezier(0.34,1.56,0.64,1) both, gpMedalGlow 1.3s ease-in-out infinite 0.9s',
        }}>
          {/* Meridian stripes sliding sideways — the "planet turning" texture */}
          <div className="absolute inset-0 rounded-full pointer-events-none" style={{
            background: 'repeating-linear-gradient(90deg, hsl(28 70% 32% / 0.4) 0 3px, transparent 3px 20px)',
            backgroundSize: '200% 100%',
            animation: 'gpEarthSpin 2.4s linear infinite 0.9s',
            mixBlendMode: 'multiply',
          }} />
          {/* Sweeping shine — like a highlight/terminator line crossing a sphere */}
          <div className="absolute inset-0 rounded-full pointer-events-none" style={{
            background: 'linear-gradient(90deg, transparent 0%, hsl(48 100% 92% / 0.55) 45%, transparent 62%)',
            backgroundSize: '250% 100%',
            animation: 'gpEarthShine 2.4s linear infinite 0.9s',
          }} />
          <span className="font-display font-black relative" style={{
            fontSize: 'clamp(34px, 5vw, 62px)',
            color: 'hsl(28 75% 16%)',
            textShadow: '0 1px 0 hsl(48 100% 88% / 0.7)',
          }}>+1</span>
        </div>
        <div className="font-display font-black tracking-[0.3em] mt-3" style={{
          fontSize: 'clamp(40px, 6.5vw, 95px)',
          color: 'hsl(45 93% 58%)',
          textShadow: '0 0 50px hsl(45 93% 58% / 0.9), 0 0 110px hsl(45 93% 58% / 0.55), 0 4px 0 hsl(28 80% 18%)',
          animation: 'gpTextPulse 1s ease-in-out infinite 0.75s',
        }}>
          GOLDEN POINT
        </div>
        <div className="font-display font-black tracking-[0.3em] mt-2" dir="rtl" style={{
          fontSize: 'clamp(40px, 6.5vw, 95px)',
          color: 'hsl(45 93% 58%)',
          textShadow: '0 0 50px hsl(45 93% 58% / 0.9), 0 0 110px hsl(45 93% 58% / 0.55), 0 4px 0 hsl(28 80% 18%)',
          animation: 'gpTextPulse 1s ease-in-out infinite 0.8s',
        }}>
          النقطة الذهبية
        </div>
        <div className="font-display font-bold tracking-[0.35em] mt-3" style={{
          fontSize: 'clamp(13px, 1.7vw, 21px)',
          color: 'hsl(45 55% 72%)',
          animation: 'gpSlideUp 0.6s ease-out 0.5s both',
        }}>
          SUDDEN DEATH — FIRST VALID POINT WINS
        </div>
      </div>

      <style>{`
        @keyframes gpFlash { 0%{opacity:1} 100%{opacity:0} }
        @keyframes gpRayRotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes gpShockwave { 0%{transform:scale(0.3);opacity:0.9;border-width:4px} 100%{transform:scale(9);opacity:0;border-width:0.5px} }
        @keyframes gpSparkRise { 0%{transform:translateY(0) scale(1);opacity:0} 15%{opacity:1} 100%{transform:translateY(-70vh) scale(0.3);opacity:0} }
        @keyframes gpZoomIn { 0%{transform:scale(0.25) rotate(-10deg);opacity:0} 60%{transform:scale(1.08) rotate(2deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
        @keyframes gpCircleEnter { 0%{transform:scale(0.2) rotate(-180deg)} 70%{transform:scale(1.15) rotate(10deg)} 100%{transform:scale(1) rotate(0deg)} }
        @keyframes gpEarthSpin { from{background-position:0% 0%} to{background-position:-200% 0%} }
        @keyframes gpEarthShine { from{background-position:130% 0%} to{background-position:-150% 0%} }
        @keyframes gpMedalGlow { 0%,100%{filter:drop-shadow(0 0 12px hsl(45 100% 65% / 0.7))} 50%{filter:drop-shadow(0 0 32px hsl(45 100% 70% / 0.95))} }
        @keyframes gpTextPulse { 0%,100%{filter:brightness(1) drop-shadow(0 0 0 transparent)} 50%{filter:brightness(1.3)} }
        @keyframes gpSlideUp { 0%{transform:translateY(14px);opacity:0} 100%{transform:translateY(0);opacity:1} }
      `}</style>
    </div>
  );

  // ===== IVR RESULT animation — premium camera review / official decision =====
  // The requester camera is always derived from the requesting side. No fixed
  // red/blue decision styling is used for the requester itself.
  const ivrAnim = state.ivrAnimation;
  const ivrIsBlue = ivrAnim?.side === 'chung';
  const ivrPlayerName = ivrAnim ? (ivrIsBlue ? state.chung.player.name : state.hong.player.name) : '';
  const ivrSideColor = ivrAnim ? (ivrIsBlue ? sb.chungColor : sb.hongColor) : '';
  const ivrSideLabel = ivrIsBlue ? 'BLUE' : 'RED';
  const ivrAccepted = ivrAnim?.decision === 'accepted';
  const ivrDecisionColor = ivrAccepted ? 'hsl(142 75% 55%)' : 'hsl(0 85% 60%)';
  const ivrCameraAssetBySide: Record<PlayerColor, string> = { chung: videoReplayAvailableBlueUrl, hong: videoReplayUnavailableRedUrl };
  const ivrRequesterAsset = ivrAnim ? ivrCameraAssetBySide[ivrAnim.side] : videoReplayAvailableBlueUrl;
  const ivrOverlay = ivrAnim && (Date.now() - ivrAnim.ts < 4600) && (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center pointer-events-none overflow-hidden"
      style={{
        background: `radial-gradient(circle at 50% 43%, ${ivrSideColor}24 0%, rgba(3,8,18,.94) 42%, rgba(1,4,10,.985) 100%)`,
        animation: 'ivrOverlayIn .38s ease-out both',
      }}
    >
      {/* Broadcast energy field */}
      <div className="absolute inset-0 opacity-90" style={{
        background: `conic-gradient(from 0deg, transparent 0deg, ${ivrSideColor}18 28deg, transparent 62deg, ${ivrSideColor}14 128deg, transparent 178deg, ${ivrSideColor}20 238deg, transparent 300deg, ${ivrSideColor}12 338deg, transparent 360deg)`,
        animation: 'ivrSpin 9s linear infinite',
      }} />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at center, transparent 0 42%, rgba(0,0,0,.68) 100%)',
      }} />
      <div className="absolute inset-0 opacity-25" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(255,255,255,.055) 4px)',
        animation: 'ivrScan 2.6s linear infinite',
      }} />

      {/* Expanding review rings */}
      <div className="absolute rounded-full" style={{
        width: 'min(92vw, 1320px)', height: 'min(92vw, 1320px)',
        border: `1px solid ${ivrSideColor}45`,
        boxShadow: `0 0 100px ${ivrSideColor}18, inset 0 0 100px ${ivrSideColor}0c`,
        animation: 'ivrRing 1.8s ease-out forwards',
      }} />
      <div className="absolute rounded-full" style={{
        width: 'min(64vw, 920px)', height: 'min(64vw, 920px)',
        border: `2px solid ${ivrSideColor}58`,
        boxShadow: `0 0 70px ${ivrSideColor}20`,
        animation: 'ivrRing 1.25s .12s ease-out forwards',
      }} />
      <div className="absolute rounded-full" style={{
        width: 'min(36vw, 520px)', height: 'min(36vw, 520px)',
        border: `1px solid ${ivrSideColor}55`,
        animation: 'ivrRing 1s .25s ease-out forwards',
      }} />

      {/* Cinematic light sweep */}
      <div className="absolute top-0 bottom-0 w-[16vw] max-w-[240px]" style={{
        background: `linear-gradient(90deg, transparent, ${ivrSideColor}20, transparent)`,
        transform: 'skewX(-16deg)',
        animation: 'ivrSweep 2.8s .15s ease-in-out infinite',
      }} />

      <div
        className="relative w-[min(94vw,1320px)] min-h-[min(82vh,820px)] rounded-[38px] px-6 py-7 md:px-12 md:py-10 text-center flex flex-col justify-center"
        style={{
          background: `linear-gradient(145deg, rgba(5,11,21,.97), rgba(11,20,34,.94) 55%, ${ivrSideColor}0d)`,
          border: `1px solid ${ivrSideColor}88`,
          boxShadow: `0 0 70px ${ivrSideColor}30, 0 35px 130px rgba(0,0,0,.82), inset 0 0 80px ${ivrSideColor}0c`,
          animation: ivrAccepted ? 'ivrCardIn .78s cubic-bezier(.16,1,.3,1)' : 'ivrCardReject .7s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {/* Header / broadcast identity */}
        <div className="flex items-center justify-center gap-3 mb-2" style={{ animation: 'ivrFadeUp .5s .12s both' }}>
          <span className="h-px w-14 md:w-24" style={{ background: `linear-gradient(90deg, transparent, ${ivrSideColor})` }} />
          <span className="font-display font-black tracking-[.3em] text-white/80" style={{ fontSize: 'clamp(13px, 1.35vw, 21px)' }}>
            VIDEO REPLAY
          </span>
          <span className="h-px w-14 md:w-24" style={{ background: `linear-gradient(90deg, ${ivrSideColor}, transparent)` }} />
        </div>
        <div className="font-display font-bold tracking-[.32em] text-white/35" style={{ fontSize: 'clamp(8px, .75vw, 13px)', animation: 'ivrFadeUp .5s .2s both' }}>
          OFFICIAL VIDEO REVIEW · {ivrSideLabel} REQUEST
        </div>

        {/* Main camera → decision composition */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-7 md:gap-10 lg:gap-16 mt-6 md:mt-8">
          {/* Requester camera */}
          <div className="flex flex-col items-center min-w-0 md:w-[42%]" style={{ animation: 'ivrRequesterIn .82s .16s cubic-bezier(.16,1,.3,1) both' }}>
            <div className="inline-flex items-center gap-2 rounded-full px-5 py-2 font-display font-black tracking-[.22em]" style={{
              border: `1px solid ${ivrSideColor}88`, color: '#fff', background: `${ivrSideColor}16`,
              boxShadow: `0 0 28px ${ivrSideColor}20`, fontSize: 'clamp(9px, .8vw, 13px)',
            }}>
              <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full rounded-full opacity-80" style={{ background: ivrSideColor, animation: 'ivrDot 1.2s ease-out infinite' }} /><span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: ivrSideColor }} /></span>
              {ivrSideLabel} · REVIEW REQUEST
            </div>

            <div className="relative mt-2" style={{ animation: 'ivrCameraFloat 1.7s ease-in-out infinite' }}>
              <div className="absolute inset-[12%] rounded-full" style={{
                border: `1px solid ${ivrSideColor}55`, boxShadow: `0 0 65px ${ivrSideColor}2c`,
                animation: 'ivrCameraPulse 1.35s ease-out infinite',
              }} />
              <div className="absolute inset-[24%] rounded-full" style={{
                border: `1px dashed ${ivrSideColor}35`, animation: 'ivrCameraOrbit 5s linear infinite',
              }} />
              <img
                src={ivrRequesterAsset}
                alt={`${ivrSideLabel} video replay camera`}
                style={{
                  display: 'block', width: 'clamp(260px, 30vw, 500px)', height: 'clamp(190px, 21vw, 330px)',
                  objectFit: 'contain', position: 'relative', zIndex: 1,
                  filter: `drop-shadow(0 0 18px ${ivrSideColor}) drop-shadow(0 0 58px ${ivrSideColor}99)`,
                }}
              />
              <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 h-1 rounded-full" style={{ width: '55%', background: ivrSideColor, boxShadow: `0 0 20px ${ivrSideColor}` }} />
            </div>

            <div className="font-display font-black text-white mt-1" style={{ fontSize: 'clamp(19px, 1.9vw, 31px)', animation: 'ivrFadeUp .5s .46s both' }}>
              {ivrPlayerName || ivrSideLabel}
            </div>
            <div className="font-display font-bold tracking-[.28em] mt-1" style={{ color: ivrSideColor, fontSize: 'clamp(9px, .8vw, 13px)' }}>
              {ivrSideLabel} CORNER
            </div>
          </div>

          {/* Decision core */}
          <div className="relative flex flex-col items-center justify-center md:w-[34%]" style={{ minHeight: 'clamp(230px, 25vw, 360px)' }}>
            <div className="absolute rounded-full" style={{
              width: 'clamp(190px, 20vw, 300px)', height: 'clamp(190px, 20vw, 300px)',
              border: `2px solid ${ivrDecisionColor}75`,
              boxShadow: `0 0 70px ${ivrDecisionColor}35, inset 0 0 60px ${ivrDecisionColor}12`,
              animation: 'ivrPulse 1.2s ease-out infinite',
            }} />
            <div className="absolute rounded-full" style={{
              width: 'clamp(135px, 14vw, 210px)', height: 'clamp(135px, 14vw, 210px)',
              border: `1px solid ${ivrDecisionColor}55`, animation: 'ivrRingSmall 1.5s ease-out infinite',
            }} />
            <div className="font-display font-black leading-none relative" style={{
              fontSize: 'clamp(110px, 15vw, 235px)', color: ivrDecisionColor,
              textShadow: `0 0 22px ${ivrDecisionColor}, 0 0 70px ${ivrDecisionColor}aa, 0 10px 0 rgba(0,0,0,.55)`,
              animation: ivrAccepted ? 'ivrApprove .76s .25s cubic-bezier(.16,1,.3,1) both' : 'ivrReject .76s .25s cubic-bezier(.16,1,.3,1) both',
            }}>
              {ivrAccepted ? 'O' : 'X'}
            </div>
            <div className="font-display font-black tracking-[.22em] mt-[-5px]" style={{ color: ivrDecisionColor, fontSize: 'clamp(10px, .9vw, 15px)', animation: 'ivrFadeUp .5s .5s both' }}>
              {ivrAccepted ? 'REVIEW ACCEPTED' : 'REVIEW REJECTED'}
            </div>
          </div>
        </div>

        {/* Official result strip */}
        <div className="mt-7 md:mt-9 pt-5" style={{ borderTop: `1px solid ${ivrSideColor}35`, animation: 'ivrFadeUp .55s .62s both' }}>
          <div className="font-display font-black text-white leading-none" style={{
            fontSize: 'clamp(34px, 5vw, 76px)', letterSpacing: '.09em',
            textShadow: `0 0 30px ${ivrDecisionColor}35, 0 6px 24px rgba(0,0,0,.7)`,
          }}>
            {ivrAccepted ? 'ACCEPTED' : 'REJECTED'}
          </div>
          <div className="font-display font-bold text-white/70 mt-3" style={{ fontSize: 'clamp(13px, 1.35vw, 22px)' }}>
            {ivrAccepted ? 'قُبل طلب إعادة الفيديو' : 'رُفض طلب إعادة الفيديو'}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-4 text-white/35" style={{ animation: 'ivrFadeUp .55s .78s both' }}>
          <span className="h-px w-10 md:w-20" style={{ background: `${ivrSideColor}40` }} />
          <span className="font-display font-bold tracking-[.22em]" style={{ fontSize: 'clamp(8px, .7vw, 11px)' }}>
            WAB-TKD · OFFICIAL DECISION
          </span>
          <span className="h-px w-10 md:w-20" style={{ background: `${ivrSideColor}40` }} />
        </div>
      </div>

      <style>{`
        @keyframes ivrRequestEnter { 0%{opacity:0;transform:translateY(30px) scale(.82);filter:blur(8px)} 55%{opacity:1;transform:translateY(-3px) scale(1.03);filter:blur(0)} 100%{opacity:1;transform:none} }
        @keyframes ivrRequestRing { 0%{transform:scale(.55);opacity:.8} 100%{transform:scale(1.3);opacity:0} }
        @keyframes ivrRequestScan { from{background-position:0 0} to{background-position:0 32px} }
        @keyframes ivrRequestSweep { 0%,15%{left:-25%;opacity:0} 38%{opacity:.8} 72%{opacity:.2} 100%{left:125%;opacity:0} }
        @keyframes ivrRequestBlink { 0%,100%{opacity:.55} 50%{opacity:1} }
        @keyframes ivrOverlayIn { from{opacity:0;transform:scale(1.015)} to{opacity:1;transform:scale(1)} }
        @keyframes ivrSpin { from{transform:rotate(0deg) scale(1.08)} to{transform:rotate(360deg) scale(1.08)} }
        @keyframes ivrScan { from{background-position:0 0} to{background-position:0 24px} }
        @keyframes ivrRing { 0%{transform:scale(.42);opacity:0} 18%{opacity:.9} 100%{transform:scale(1.18);opacity:0} }
        @keyframes ivrRingSmall { 0%{transform:scale(.72);opacity:.8} 100%{transform:scale(1.22);opacity:0} }
        @keyframes ivrSweep { 0%,15%{left:-20%;opacity:0} 35%{opacity:.75} 72%{opacity:.25} 100%{left:120%;opacity:0} }
        @keyframes ivrCardIn { 0%{transform:translateY(45px) scale(.82);opacity:0;filter:blur(10px)} 58%{transform:translateY(-5px) scale(1.018);opacity:1;filter:blur(0)} 100%{transform:translateY(0) scale(1);opacity:1} }
        @keyframes ivrCardReject { 0%{transform:scale(.86);opacity:0;filter:blur(9px)} 45%{transform:scale(1.018);opacity:1;filter:blur(0)} 58%{transform:translateX(-12px)} 68%{transform:translateX(12px)} 78%{transform:translateX(-7px)} 88%{transform:translateX(7px)} 100%{transform:translateX(0) scale(1);opacity:1} }
        @keyframes ivrCameraFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-9px) scale(1.035)} }
        @keyframes ivrCameraPulse { 0%{transform:scale(.78);opacity:.78} 70%{transform:scale(1.18);opacity:0} 100%{transform:scale(1.18);opacity:0} }
        @keyframes ivrCameraOrbit { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes ivrRequesterIn { 0%{transform:translateX(-60px) scale(.62);opacity:0} 62%{transform:translateX(5px) scale(1.045);opacity:1} 100%{transform:translateX(0) scale(1);opacity:1} }
        @keyframes ivrApprove { 0%{transform:scale(.18) rotate(-25deg);opacity:0} 60%{transform:scale(1.2) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes ivrReject { 0%{transform:scale(.18) rotate(-18deg);opacity:0} 55%{transform:scale(1.18) rotate(7deg);opacity:1} 75%{transform:scale(.96) rotate(-3deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes ivrPulse { 0%{transform:scale(.72);opacity:.9} 70%{transform:scale(1.12);opacity:0} 100%{transform:scale(1.12);opacity:0} }
        @keyframes ivrDot { 0%{transform:scale(.6);opacity:.9} 100%{transform:scale(2.8);opacity:0} }
        @keyframes ivrFadeUp { 0%{transform:translateY(18px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @media (prefers-reduced-motion: reduce) {
          .ivr-reduced-motion, [style*="ivrSpin"], [style*="ivrSweep"] { animation: none !important; }
        }
      `}</style>
    </div>
  );

  // ===== KO animation — side is the WINNER. Colour/logo are always derived from it. =====
  const koAnim = state.koAnimation;
  const koWinner = koAnim?.side ?? null;
  const koOverlay = koAnim && (Date.now() - koAnim.ts < 3000) && (() => {
    const isBlue = koWinner === 'chung';
    const accent = isBlue ? 'hsl(var(--chung))' : 'hsl(var(--hong))';
    const logo = isBlue ? koBlueLogoUrl : koRedLogoUrl;
    return (
      <div className="fixed inset-0 z-[900] flex items-center justify-center pointer-events-none overflow-hidden" style={{ background: `radial-gradient(circle at 50% 43%, color-mix(in srgb, ${accent} 25%, transparent), rgba(0,0,0,.97) 60%)`, animation: 'ivrOverlayIn .25s ease-out' }}>
        <div className="absolute inset-0" style={{ background: `repeating-linear-gradient(120deg, transparent 0 100px, ${accent} 102px, transparent 105px 205px)`, opacity: .32, animation: 'koSweep 1.7s linear infinite' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 45%, ${accent} 0%, transparent 18%), radial-gradient(circle at 50% 50%, rgba(255,255,255,.09), transparent 42%)`, mixBlendMode: 'screen', animation: 'koFlash 1.15s ease-out infinite' }} />
        <div className="absolute w-[72vmin] h-[72vmin] rounded-full border-2" style={{ borderColor: accent, boxShadow: `0 0 55px ${accent}, inset 0 0 55px ${accent}`, opacity: .6, animation: 'koRing .9s ease-out infinite' }} />
        <div className="absolute w-[52vmin] h-[52vmin] rounded-full border border-white/15" style={{ borderColor: `${accent}88`, boxShadow: `0 0 28px ${accent}66`, animation: 'koRingInner 1.2s ease-out infinite' }} />
        <div className="absolute left-0 right-0 top-1/2 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: .7, boxShadow: `0 0 14px ${accent}`, animation: 'koScan 1.1s ease-in-out infinite' }} />
        <div className="absolute top-[8%] left-[6%] text-[9px] md:text-xs font-black tracking-[.35em]" style={{ color: accent }}>WAB-TKD · KNOCKOUT</div>
        <div className="absolute top-[8%] right-[6%] text-[9px] md:text-xs font-black tracking-[.25em] text-white/55">WINNER · {isBlue ? 'BLUE' : 'RED'}</div>
        <div className="relative z-10 text-center px-8">
          <div className="mx-auto mb-2 rounded-full p-5" style={{ width: 'clamp(160px, 22vw, 340px)', height: 'clamp(160px, 22vw, 340px)', border: `3px solid ${accent}`, boxShadow: `0 0 30px ${accent}, 0 0 100px color-mix(in srgb, ${accent} 42%, transparent)`, animation: 'koLogoIn .55s cubic-bezier(.2,.8,.2,1) both' }}>
            <img src={logo} alt="" className="w-full h-full object-contain" />
          </div>
          <div className="font-display font-black leading-none tracking-[.12em]" style={{ color: accent, fontSize: 'clamp(76px, 11vw, 175px)', textShadow: `0 0 14px ${accent}, 0 0 48px ${accent}`, animation: 'koText .8s ease-in-out infinite' }}>KO</div>
          <div className="font-display font-bold tracking-[.28em] text-white/75" style={{ fontSize: 'clamp(16px, 1.7vw, 30px)' }}>{t('broadcastKnockout')}</div>
        </div>
        <style>{`@keyframes koLogoIn {0%{opacity:0;transform:scale(.45) translateY(-25px);filter:blur(10px)}65%{opacity:1;transform:scale(1.08);filter:blur(0)}100%{opacity:1;transform:scale(1)}} @keyframes koText {0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.045);filter:brightness(1.45)}} @keyframes koRing {0%{transform:scale(.55);opacity:.8}100%{transform:scale(1.35);opacity:0}} @keyframes koSweep {from{transform:translateX(-18%) rotate(0deg)}to{transform:translateX(18%) rotate(360deg)}} @keyframes koFlash {0%,100%{opacity:.10;transform:scale(.85)}35%{opacity:.38;transform:scale(1.08)}65%{opacity:.16;transform:scale(1.02)}} @keyframes koRingInner {0%{transform:scale(.72);opacity:.7}100%{transform:scale(1.22);opacity:0}} @keyframes koScan {0%,100%{transform:scaleX(.25);opacity:.15}50%{transform:scaleX(1);opacity:.9}}`}</style>
      </div>
    );
  })();

  // ===== Substitution (Par Équipe) — full screen while the operator is
  // entering the replacement's name, then a brief "new player" flash once confirmed =====
  const pendingSub = state.pendingSubstitution;
  const subSideColor = pendingSub?.side === 'chung' ? 'hsl(var(--chung))' : 'hsl(var(--hong))';
  const pendingSubOverlay = pendingSub && state.status !== 'fighting' && (
    <div className="fixed inset-0 z-[900] flex items-center justify-center pointer-events-none" style={{
      background: 'hsl(0 0% 0% / 0.92)', animation: 'ivrOverlayIn 0.35s ease-out',
    }}>
      <div className="text-center">
        <div className="font-display font-black text-white" style={{ fontSize: 'clamp(28px, 3vw, 56px)', letterSpacing: '0.15em' }} >{t('broadcastSubstitution')}</div>
        <div className="font-display font-bold mt-3" style={{ fontSize: 'clamp(22px, 2.2vw, 40px)', color: subSideColor }}>
          {pendingSub?.side === 'chung' ? 'BLUE' : 'RED'}
        </div>
      </div>
    </div>
  );


  // Live CSS overrides driven by settings (uses class hooks on key elements)
  const settingsStyleTag = (
    <style>{`
      .sb-title { font-size: calc(clamp(26px, 2.8vw, 52px) * ${sb.titleScale}) !important; color: ${sb.titleColor} !important; text-shadow: 0 0 22px ${sb.titleColor}88, 0 2px 4px rgba(0,0,0,0.6) !important; }
      .sb-sub   { font-size: calc(clamp(14px, 1.35vw, 22px) * ${sb.subScale}) !important; color: ${sb.subColor} !important; }
      .sb-player-name { font-size: calc(clamp(24px, 2.6vw, 48px) * ${sb.playerNameScale}) !important; color: ${sb.playerNameColor} !important; }
      .sb-score-chung { font-size: calc(clamp(90px, 18vw, 240px) * ${sb.bigScoreScale}) !important; }
      .sb-score-hong  { font-size: calc(clamp(90px, 18vw, 240px) * ${sb.bigScoreScale}) !important; }
      .sb-side-chung { background: ${sb.chungColor} !important; }
      .sb-side-hong  { background: ${sb.hongColor} !important; }
      .sb-timer { font-size: calc(clamp(44px, 5vw, 88px) * ${sb.timerScale}) !important; }
      .sb-fight-badge { background: ${sb.fightColor} !important; box-shadow: 0 0 18px ${sb.fightColor}b3 !important; border-color: ${sb.fightColor} !important; }
      .sb-winner {
        font-size: calc(clamp(60px, 7vw, 120px) * ${sb.winnerSize}) !important;
        color: ${sb.winnerColor} !important;
        text-shadow: 0 0 30px ${sb.winnerColor}88 !important;
        /* Fixed dark outline, independent of the chosen text color and of
           the banner's gold-metal background/frame — so "WINNER" always
           reads clearly even if the operator picks a gold/yellow text
           color that would otherwise blend into the gold frame around it. */
        -webkit-text-stroke: 2px hsl(224 45% 7% / 0.85);
        paint-order: stroke fill;
      }
      .sb-flag { transform: scale(${sb.flagScale}); transform-origin: center; }
      .sb-round-active { border-color: ${sb.roundActiveColor} !important; box-shadow: 0 0 18px ${sb.roundActiveColor}66 !important; }
      .sb-gamjeom-dot { background: ${sb.gamjeomColor} !important; color: #000 !important; }
      .sb-hit-icon { color: ${sb.hitIconColor} !important; }
      .sb-hit-icon svg { color: ${sb.hitIconColor} !important; }
    `}</style>
  );

  const SbField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center gap-2 py-1">
      <span className="font-display text-[10px] text-white/55 uppercase tracking-wide flex-1">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
  const SbSlider = ({ value, onChange, min, max, step = 0.1 }: any) => (
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(+e.target.value)} className="w-28 accent-amber-400" />
  );
  const SbColor = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input type="color" value={value} onChange={e => onChange(e.target.value)}
      className="w-8 h-6 rounded cursor-pointer bg-transparent border border-white/20" />
  );
  const SbNum = ({ value }: { value: number }) => (
    <span className="font-display text-[10px] text-white/80 tabular-nums w-9 text-right">
      {Number.isInteger(value) ? value : value.toFixed(2)}
    </span>
  );

  // Settings overlay — comprehensive control panel
  const settingsOverlay = !isPublicWindow && showSettings && (
    <div className="fixed top-14 right-4 z-[60] rounded-2xl p-4 w-[340px] max-h-[80vh] overflow-y-auto" style={{
      background: 'hsl(224 35% 8%)', border: '1px solid hsl(224 35% 18%)', boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
    }}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-display text-sm font-bold text-white tracking-wider" >{t('broadcastScoreboardControls')}</div>
        <button onClick={() => setShowSettings(false)} className="text-white/50 hover:text-white"><X size={14} /></button>
      </div>

      <div className="flex gap-1 mb-3 p-1 rounded-lg bg-black/30">
        {(['sizes', 'colors', 'text'] as const).map(t => (
          <button key={t} onClick={() => setSbTab(t)}
            className={`flex-1 text-[11px] font-display font-bold tracking-wider py-1.5 rounded-md uppercase ${sbTab === t ? 'bg-amber-400 text-black' : 'text-white/60 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {sbTab === 'sizes' && (
        <div className="space-y-1">
          <SbField label="Title"><SbSlider value={sb.titleScale} min={0.5} max={2} onChange={(v: number) => setDisplaySettings(s => ({ ...s, titleScale: v }))} /><SbNum value={sb.titleScale} /></SbField>
          <SbField label="Sub header"><SbSlider value={sb.subScale} min={0.5} max={2} onChange={(v: number) => setDisplaySettings(s => ({ ...s, subScale: v }))} /><SbNum value={sb.subScale} /></SbField>
          <SbField label="Player name"><SbSlider value={sb.playerNameScale} min={0.6} max={1.8} onChange={(v: number) => setDisplaySettings(s => ({ ...s, playerNameScale: v }))} /><SbNum value={sb.playerNameScale} /></SbField>
          <SbField label="Flag"><SbSlider value={sb.flagScale} min={0.6} max={1.6} onChange={(v: number) => setDisplaySettings(s => ({ ...s, flagScale: v }))} /><SbNum value={sb.flagScale} /></SbField>
          <SbField label="Big score"><SbSlider value={sb.bigScoreScale} min={0.6} max={1.6} onChange={(v: number) => setDisplaySettings(s => ({ ...s, bigScoreScale: v }))} /><SbNum value={sb.bigScoreScale} /></SbField>
          <SbField label="Timer"><SbSlider value={sb.timerScale} min={0.6} max={1.8} onChange={(v: number) => setDisplaySettings(s => ({ ...s, timerScale: v }))} /><SbNum value={sb.timerScale} /></SbField>
          <SbField label="Winner banner"><SbSlider value={sb.winnerSize} min={0.6} max={1.8} onChange={(v: number) => setDisplaySettings(s => ({ ...s, winnerSize: v }))} /><SbNum value={sb.winnerSize} /></SbField>
          <SbField label="Hit icon (px)"><SbSlider value={sb.hitIconSize} min={14} max={48} step={1} onChange={(v: number) => setDisplaySettings(s => ({ ...s, hitIconSize: v }))} /><SbNum value={sb.hitIconSize} /></SbField>
          <SbField label="Gamjeom dot (px)"><SbSlider value={sb.gamjeomSize} min={10} max={36} step={1} onChange={(v: number) => setDisplaySettings(s => ({ ...s, gamjeomSize: v }))} /><SbNum value={sb.gamjeomSize} /></SbField>
          <SbField label="Round box border"><SbSlider value={sb.roundBoxBorder} min={1} max={8} step={0.5} onChange={(v: number) => setDisplaySettings(s => ({ ...s, roundBoxBorder: v }))} /><SbNum value={sb.roundBoxBorder} /></SbField>
        </div>
      )}

      {sbTab === 'colors' && (
        <div className="space-y-1">
          <SbField label="Title"><SbColor value={sb.titleColor} onChange={v => setDisplaySettings(s => ({ ...s, titleColor: v }))} /></SbField>
          <SbField label="Sub header"><SbColor value={sb.subColor} onChange={v => setDisplaySettings(s => ({ ...s, subColor: v }))} /></SbField>
          <SbField label="Player name"><SbColor value={sb.playerNameColor} onChange={v => setDisplaySettings(s => ({ ...s, playerNameColor: v }))} /></SbField>
          <SbField label="Chung (blue) bg"><SbColor value={sb.chungColor} onChange={v => setDisplaySettings(s => ({ ...s, chungColor: v }))} /></SbField>
          <SbField label="Hong (red) bg"><SbColor value={sb.hongColor} onChange={v => setDisplaySettings(s => ({ ...s, hongColor: v }))} /></SbField>
          <SbField label="Timer"><SbColor value={sb.timerColor} onChange={v => setDisplaySettings(s => ({ ...s, timerColor: v }))} /></SbField>
          <SbField label="FIGHT badge"><SbColor value={sb.fightColor} onChange={v => setDisplaySettings(s => ({ ...s, fightColor: v }))} /></SbField>
          <SbField label="Winner"><SbColor value={sb.winnerColor} onChange={v => setDisplaySettings(s => ({ ...s, winnerColor: v }))} /></SbField>
          <SbField label="Active round"><SbColor value={sb.roundActiveColor} onChange={v => setDisplaySettings(s => ({ ...s, roundActiveColor: v }))} /></SbField>
          <SbField label="Gamjeom"><SbColor value={sb.gamjeomColor} onChange={v => setDisplaySettings(s => ({ ...s, gamjeomColor: v }))} /></SbField>
          <SbField label="Hit icons"><SbColor value={sb.hitIconColor} onChange={v => setDisplaySettings(s => ({ ...s, hitIconColor: v }))} /></SbField>
          <SbField label="Video Replay text"><SbColor value={sb.ivrRequestColor} onChange={v => setDisplaySettings(s => ({ ...s, ivrRequestColor: v }))} /></SbField>
        </div>
      )}

      {sbTab === 'text' && (
        <div className="space-y-2">
          <div>
            <div className="font-display text-[10px] text-white/55 uppercase tracking-wide mb-1">FIGHT badge text</div>
            <input type="text" value={sb.fightText} maxLength={10}
              onChange={e => setDisplaySettings(s => ({ ...s, fightText: e.target.value.toUpperCase() }))}
              className="w-full px-2 py-1.5 rounded-md bg-black/40 border border-white/15 text-white font-display text-sm tracking-widest" />
          </div>
          <div className="text-[10px] text-white/40 leading-relaxed pt-2">
            Tip: use Sizes &amp; Colors tabs for everything else. Settings are saved automatically and apply to every match.
          </div>
        </div>
      )}

      <button onClick={() => setDisplaySettings(DEFAULT_SB)}
        className="w-full mt-3 px-3 py-1.5 rounded-lg text-xs bg-white/10 text-white/70 hover:bg-white/20 font-display tracking-wider">
        RESET DEFAULTS
      </button>
    </div>
  );

  // ================================================================
  // 🏆 MATCH END FRAME — Daedo style
  // ================================================================
  if (currentFrame === 'match_end' && result) {
    const w = result.winner;
    // Par Équipe "rotation" — the winner is the TEAM (by total point
    // difference across every player's rounds), so show the team name and
    // point totals here instead of whichever individual last happened to be
    // on the mat and the round-win tally.
    const isTeamReveal = !!state.teamNames && !!state.teamRoster && (state.teamMode === 'rotation' || state.config?.competitionMode === 'par_equipe');
    if (isTeamReveal) {
      return <TeamWinnerScreen state={state} winner={w} winnerScale={winnerScale} isMiniPreview={isMiniPreview} />;
    }
    if (!isMiniPreview) {
      return <IndividualWinnerAnimation state={state} winner={w} />;
    }
    const displayName = isTeamReveal ? (state.teamNames![w]) : broadcastName(state[w].player.name, nameFormat);
    const chungBig = isTeamReveal ? state.chung.totalScore : chungRoundWins;
    const hongBig = isTeamReveal ? state.hong.totalScore : hongRoundWins;
    const resultMethodLabel = isTeamReveal ? 'فارق النقاط' : result.method;
    // Par Équipe winner reveal also needs the team photo, the CLUB logo/name
    // (separate from the team's own identity), and every player who
    // fought — not just the team name — so the audience sees the whole
    // roster on the champion banner, matching the pre-match team call.
    const winTeamLogo = isTeamReveal ? state.teamLogos?.[w] : undefined;
    const winClubLogo = isTeamReveal ? state.clubLogos?.[w] : undefined;
    const winClubName = isTeamReveal ? state[w].player.club : undefined;
    const winRoster = isTeamReveal ? state.teamRoster?.[w] : undefined;
    // The losing team's identity + roster — shown mirrored, in the same
    // individual player-card style, so the audience sees both full squads
    // on the result screen, not just the winner's.
    const loserSide: PlayerColor = w === 'chung' ? 'hong' : 'chung';
    const loserTeamName = isTeamReveal ? state.teamNames?.[loserSide] : undefined;
    const loserTeamLogo = isTeamReveal ? state.teamLogos?.[loserSide] : undefined;
    const loserClubLogo = isTeamReveal ? state.clubLogos?.[loserSide] : undefined;
    const loserClubName = isTeamReveal ? state[loserSide].player.club : undefined;
    const loserRoster = isTeamReveal ? state.teamRoster?.[loserSide] : undefined;
    const loserColor = loserSide === 'chung' ? 'hsl(217 91% 55%)' : 'hsl(0 72% 51%)';
    const isChung = w === 'chung';
    const winColor = isChung ? 'hsl(217 91% 55%)' : 'hsl(0 72% 51%)';
    const winGlow = isChung ? 'hsl(217 91% 55% / 0.25)' : 'hsl(0 72% 51% / 0.25)';
    const particleColor = isChung ? 'hsl(217 91% 65%)' : 'hsl(0 72% 60%)';

    // Best Player (MVP) — computed strictly from real roundScores data
    // (sum of points actually scored across their rounds), across BOTH
    // rosters, not invented. Only shown when at least one roster entry has
    // recorded scores.
    const mvp = (() => {
      const candidates: { name: string; photo?: string; nationality?: string; side: PlayerColor; total: number }[] = [];
      (['chung', 'hong'] as PlayerColor[]).forEach((side) => {
        (state.teamRoster?.[side] || []).forEach((entry: any) => {
          const total = (entry.roundScores || []).reduce((sum: number, rs: any) => sum + (rs.score || 0), 0);
          if (total > 0) candidates.push({ name: entry.name, photo: entry.photo, nationality: entry.nationality, side, total });
        });
      });
      candidates.sort((a, b) => b.total - a.total);
      return candidates[0];
    })();
    const mvpColor = mvp?.side === 'chung' ? 'hsl(217 91% 58%)' : 'hsl(0 72% 55%)';

    return (
      <div key="frame-end" className={`fixed inset-0 flex flex-col overflow-hidden ${isMiniPreview ? 'public-scoreboard-mini' : ''}`}
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${winGlow}, transparent 55%),
            radial-gradient(ellipse at 50% 105%, hsl(45 80% 10% / 0.55), transparent 60%),
            radial-gradient(ellipse at 50% 40%, hsl(224 40% 7%), hsl(224 45% 2%) 85%)`,
          animation: 'frameEnter 0.7s ease-out',
        }}
        onMouseEnter={() => setShowNav(true)} onMouseLeave={() => setShowNav(false)}>
        {persistentTopNav}
        {/* Broadcast-style bezel frame — a strong double border with a
            faint gold glow, so the whole result reads as a produced
            championship graphic rather than a plain fullscreen panel. */}
        <div className="fixed inset-3 pointer-events-none z-30" style={{
          border: '1px solid hsl(45 93% 58% / 0.35)',
          boxShadow: 'inset 0 0 0 1px hsl(224 40% 60% / 0.12), inset 0 0 60px hsl(45 93% 58% / 0.08)',
          borderRadius: 18,
        }} />
        <div className="fixed inset-5 pointer-events-none z-30" style={{
          border: '1px solid hsl(224 40% 70% / 0.10)',
          borderRadius: 14,
        }} />
        <style>{`@keyframes winnerMedalFloat { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-8px) rotate(1deg)} }`}</style>
        {isTeamReveal && <EntryFreeze vsPulse={entryVsPulse} dark={entryDark} done={winnerScale} />}
        {settingsOverlay}{settingsStyleTag}{ivrOverlay}{koOverlay}{doctorCallOverlay}{kyeshiCallOverlay}{cinematicActive ? null : pendingSubOverlay}{substitutionAnimationOverlay || teamCallOverlay || callAnimationOverlay || (state.matchupAnimation ? matchupOverlay : null) || (cinematicActive ? null : nextOnMatchOverlay)}{cinematicActive ? null : readyBanner}{cinematicActive ? null : greetingBanner}{cinematicActive ? null : goldenBanner}{cinematicActive ? null : goldenPointOverlay}{cinematicActive ? null : standingsOverlay}



        {/* Ambient screen glow */}
        <div className="absolute inset-0 pointer-events-none z-0" style={{
          background: `radial-gradient(circle at 50% 50%, ${winGlow}, transparent 50%)`,
          animation: 'screenGlow 3s ease-in-out infinite alternate',
        }} />

        {/* TOP: Category bar */}
        <div className="text-center py-2 relative z-20" style={{ background: 'hsl(224 35% 8% / 0.9)', borderBottom: '1px solid hsl(224 35% 15%)' }}>
          <div className="font-display text-sm text-white/50 tracking-[0.25em] uppercase font-bold">
            {state.competitionName || 'TAEKWONDO'}
            {(dc.showWeight && state.weightCategory) ? ` — ${state.weightCategory}` : ''}
          </div>
        </div>

        {/* MATCH X RESULT — large */}
        <div className="text-center py-4 relative z-20" style={{ background: 'hsl(224 35% 5% / 0.7)' }}>
          <div className="font-display font-black tracking-wider" style={{
            fontSize: 'clamp(28px, 4vw, 48px)',
            color: 'hsl(45 93% 58%)',
            textShadow: '0 0 20px hsl(45 93% 58% / 0.3)',
          }}>
            MATCH {state.matchNumber || '---'} RESULT
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 relative z-20">

          {/* Individual winner uses the approved MEDAL reveal — never the old trophy.
              Par Équipe keeps its separate TeamWinnerScreen trophy treatment. */}
          <div style={{
            transform: winnerScale ? 'translateY(0) scale(1)' : 'translateY(20px) scale(.78)',
            opacity: winnerScale ? 1 : 0,
            transition: 'all .8s cubic-bezier(.2,.8,.25,1) .3s',
            height: 'clamp(130px, 18vh, 220px)',
            position: 'relative',
            filter: 'drop-shadow(0 0 18px rgba(255,226,120,.75)) drop-shadow(0 0 48px rgba(255,170,0,.35))',
          }}>
            <img src={medalWabTkdUrl} alt="WAB-TKD championship medal" className="h-full w-auto object-contain" style={{ animation: winnerScale ? 'winnerMedalFloat 3s ease-in-out .8s infinite' : 'none' }} />
            <div className="absolute inset-0 rounded-full pointer-events-none" style={{ boxShadow: '0 0 55px rgba(255,216,102,.35)' }} />
          </div>

          {/* Round Score — plain big numbers side by side, flat (no boxes),
              matching the reference broadcast graphic exactly: just two
              bold numbers on the dark background, colour-coded per side. */}
          <div className="flex items-center gap-10" style={{
            transform: winnerScale ? 'translateY(0)' : 'translateY(30px)',
            opacity: winnerScale ? 1 : 0,
            transition: 'all 0.6s ease-out 0.4s',
          }}>
            <div className="font-display font-black leading-none" style={{
              fontSize: 'clamp(60px, 12vw, 120px)',
              color: 'hsl(217 91% 60%)',
              textShadow: '0 0 30px hsl(217 91% 55% / 0.5)',
            }}>{chungBig}</div>
            <div className="font-display font-black leading-none" style={{
              fontSize: 'clamp(60px, 12vw, 120px)',
              color: 'hsl(0 80% 60%)',
              textShadow: '0 0 30px hsl(0 72% 51% / 0.5)',
            }}>{hongBig}</div>
          </div>

          {/* Champion info bar — flag flush against the left edge (full
              bar height, no border/rounding of its own) with the name set
              directly beside it, left-aligned, on the same team-colour
              strip: matches the reference broadcast graphic's
              flag-block + name-block layout exactly, rather than a
              centered card with a floating framed flag. */}
          <div className="w-full max-w-3xl" style={{
            transform: winnerScale ? 'translateY(0)' : 'translateY(40px)',
            opacity: winnerScale ? 1 : 0,
            transition: 'all 0.6s ease-out 0.6s',
          }}>
            <div className="rounded-xl overflow-hidden flex items-stretch" style={{
              background: winColor,
              boxShadow: `0 0 30px ${winGlow}`,
              minHeight: 88,
            }}>
              {/* Individual match ("لاعب ضد لاعب"): large flag/photo block
                  with its own clean frame — a real player photo gets a
                  visible border so it reads as a distinct framed element
                  (per broadcast-graphic convention); the flag fallback
                  stays flush with the bar like a TV lower-third. */}
              {!isTeamReveal && dc.showFlag && (
                <div className="shrink-0" style={{ width: 132, animation: 'gpZoomIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                  {(dc.showPhoto && state[w].player.photoUrl) ? (
                    <img src={state[w].player.photoUrl} alt="" className="w-full h-full object-cover" style={{
                      border: '3px solid rgba(255,255,255,0.85)', boxSizing: 'border-box',
                    }} />
                  ) : (
                    <FlagImage code={state[w].player.nationality} size={200} className="w-full h-full object-cover" />
                  )}
                </div>
              )}
              {/* Par Équipe: team crest — team logo + club logo badge, with
                  an expanding shockwave ring burst on entrance so it reads
                  as a trophy/crest presentation rather than a personal
                  spotlight — the whole squad's win, not one athlete's. */}
              {isTeamReveal && (winTeamLogo || winClubLogo) && (
                <div className="relative shrink-0 my-3 ml-3" style={{ width: 88, height: 88 }}>
                  <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none" style={{
                    border: `3px solid ${winColor}`, width: 40, height: 40, animation: 'gpShockwave 1.6s ease-out infinite',
                  }} />
                  <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none" style={{
                    border: `3px solid ${winColor}`, width: 40, height: 40, animation: 'gpShockwave 1.6s ease-out 0.5s infinite',
                  }} />
                  <img src={winTeamLogo || winClubLogo} alt="" className="relative w-full h-full rounded-2xl object-cover" style={{
                    border: '4px solid white', boxShadow: `0 0 30px ${winColor}, 0 0 60px ${winColor.replace(')', ' / 0.5)')}`,
                    animation: 'gpZoomIn 0.7s cubic-bezier(0.34,1.56,0.64,1) both, callGlowPulse 2.2s ease-in-out infinite',
                  }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  {winClubLogo && winTeamLogo && winClubLogo !== winTeamLogo && (
                    <img src={winClubLogo} alt="" className="absolute rounded-full object-cover bg-black"
                      style={{ width: '38%', height: '38%', bottom: '-8%', right: '-8%', border: '2px solid rgba(255,255,255,0.85)' }} />
                  )}
                </div>
              )}
              <div className="flex-1 flex flex-col justify-center gap-1.5 px-5 py-2 text-left" dir="ltr">
                {/* Name + country — its own framed box, per broadcast
                    convention, rather than plain floating text. */}
                <div className="inline-block w-fit px-3 py-1 rounded-md" style={{
                  border: '2px solid rgba(255,255,255,0.55)', background: 'rgba(0,0,0,0.15)',
                }}>
                  <div className="font-display text-3xl font-black text-white tracking-wider" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                    {isTeamReveal
                      ? displayName
                      : `${displayName.toUpperCase()}${state[w].player.nationality ? ` (${state[w].player.nationality})` : ''}`}
                  </div>
                </div>
                {isTeamReveal && (
                  <div className="font-display text-sm text-white/70">
                    {resultMethodLabel}{winClubName ? ` • ${winClubName}` : ''}
                  </div>
                )}
                {/* Club name — its own small framed badge, shown only when
                    the winning player actually has one on file. */}
                {!isTeamReveal && dc.showClub && state[w].player.club && (
                  <div className="inline-block w-fit px-2.5 py-0.5 rounded-md" style={{
                    border: '1.5px solid rgba(255,255,255,0.45)', background: 'rgba(0,0,0,0.15)',
                  }}>
                    <div className="font-display text-sm font-bold text-white/85 tracking-wide">
                      {state[w].player.club}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Individual player cards — every player who represented each
                team, as its own small photo/initial frame (not a flat text
                badge), winner's squad prominent and the loser's squad
                mirrored beside it in the same style, so the audience sees
                both full rosters on the result screen. */}
            {isTeamReveal && ((winRoster && winRoster.length > 0) || (loserRoster && loserRoster.length > 0)) && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                {[
                  { roster: loserRoster, color: loserColor, teamName: loserTeamName, clubName: loserClubName, label: 'الفريق الخاسر', isLoser: true },
                  { roster: winRoster, color: winColor, teamName: displayName, clubName: winClubName, label: 'الفريق الفائز', isLoser: false },
                ].map((group, gi) => group.roster && group.roster.length > 0 && (
                  <div key={gi} className="rounded-xl p-3" style={{
                    background: 'hsl(224 35% 10% / 0.5)',
                    border: `1px solid ${group.color.replace(')', ' / 0.35)')}`,
                    opacity: group.isLoser ? 0.55 : 1,
                    filter: group.isLoser ? 'grayscale(0.5) brightness(0.75)' : 'none',
                    transition: 'opacity 0.6s ease, filter 0.6s ease',
                  }}>
                    <div className="text-center font-display text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: group.color }}>
                      {group.label} • {group.teamName}
                    </div>
                    <div className="flex flex-wrap items-start justify-center gap-2.5">
                      {[...group.roster]
                        .sort((a, b) => (a.playerNumber ?? a.seedNumber ?? 0) - (b.playerNumber ?? b.seedNumber ?? 0))
                        .map((p, i) => (
                          <div key={i} className="flex flex-col items-center gap-1" style={{ width: 58 }}>
                            <div className="relative">
                              {p.photo ? (
                                <img src={p.photo} alt="" className="rounded-lg object-cover" style={{
                                  width: 52, height: 52, border: `2px solid ${group.color}`,
                                }} />
                              ) : (
                                <div className="rounded-lg flex items-center justify-center font-display font-bold text-white/70" style={{
                                  width: 52, height: 52, border: `2px solid ${group.color}`, background: 'hsl(0 0% 100% / 0.08)', fontSize: 16,
                                }}>
                                  {p.name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}
                                </div>
                              )}
                              {(p.playerNumber ?? p.seedNumber) != null && (
                                <div className="absolute -top-1.5 -left-1.5 rounded flex items-center justify-center font-display font-bold" style={{
                                  width: 16, height: 16, fontSize: 9, background: group.color, color: 'hsl(224 40% 6%)',
                                  border: '1px solid rgba(255,255,255,0.6)',
                                }}>
                                  {p.playerNumber ?? p.seedNumber}
                                </div>
                              )}
                              {p.nationality && (
                                <div className="absolute -bottom-1 -right-1 rounded shadow" style={{ border: '1px solid rgba(255,255,255,0.4)' }}>
                                  <FlagImage code={p.nationality} size={18} className="w-[18px] h-3 rounded" />
                                </div>
                              )}
                            </div>
                            <span className="font-display text-[9px] font-bold text-white/85 text-center leading-tight truncate w-full">
                              {p.name}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Best Player (MVP) — the athlete with the most points actually
                scored across their rounds, computed from real data above.
                Uses the same gold "winner" treatment as the trophy screen. */}
            {isTeamReveal && mvp && (
              <div className="mt-4 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden" style={{
                border: '2px solid rgba(255,216,102,.75)',
                background: 'linear-gradient(160deg, rgba(255,202,64,.14), rgba(2,6,13,.9) 55%, rgba(0,0,0,.97))',
                boxShadow: '0 0 32px rgba(255,194,35,.25), inset 0 1px 0 rgba(255,255,255,.1)',
                animation: 'seqFadeUp .6s cubic-bezier(.22,1,.36,1) .3s both',
              }}>
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, transparent, #ffd866, #fff6c0, #ffd866, transparent)' }} />
                <div className="relative shrink-0">
                  {mvp.photo ? (
                    <img src={mvp.photo} alt="" className="rounded-xl object-cover" style={{ width: 68, height: 68, border: '3px solid #ffd866', boxShadow: '0 0 20px rgba(255,216,102,.6)' }} />
                  ) : (
                    <div className="rounded-xl flex items-center justify-center font-display font-black text-white/70" style={{ width: 68, height: 68, border: '3px solid #ffd866', background: 'rgba(255,255,255,.08)', fontSize: 22 }}>
                      {mvp.name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -top-2 -right-2 rounded-full flex items-center justify-center" style={{ width: 24, height: 24, background: '#ffd866', boxShadow: '0 0 10px rgba(255,216,102,.8)' }}>
                    <span style={{ fontSize: 13 }}>🏅</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-black tracking-[.2em] text-[#ffd866]" style={{ fontSize: 10 }}>BEST PLAYER / أفضل لاعب</div>
                  <div className="font-display font-black text-white truncate" style={{ fontSize: 'clamp(18px,2vw,28px)' }}>{mvp.name}</div>
                  {mvp.nationality && <div className="font-display font-bold text-white/60" style={{ fontSize: 12 }}>{mvp.nationality} • <span style={{ color: mvpColor }}>{mvp.side === 'chung' ? 'BLUE' : 'RED'}</span></div>}
                </div>
                <div className="shrink-0 text-center rounded-xl px-4 py-2" style={{ border: '1px solid rgba(255,216,102,.6)', background: 'rgba(2,5,10,.7)' }}>
                  <div className="font-display text-[#ffd866]/70" style={{ fontSize: 9 }} >{t('broadcastPoints')}</div>
                  <div className="font-display font-black text-[#ffd866]" style={{ fontSize: 26 }}>{mvp.total}</div>
                </div>
              </div>
            )}
          </div>

          {/* Round-by-round summary */}
          <div className="w-full max-w-2xl" style={{
            opacity: winnerScale ? 1 : 0,
            transition: 'opacity 0.6s ease-out 0.8s',
          }}>
            <div className="grid gap-1.5">
              {state.roundWinners.map(rw => (
                <div key={rw.round} className="flex items-center gap-4 px-5 py-2 rounded-lg" style={{ background: 'hsl(224 35% 8% / 0.7)' }}>
                  <span className="font-display text-xs text-white/30 w-8">R{rw.round}</span>
                  <span className="flex-1 text-right font-display font-bold" style={{ color: 'hsl(217 91% 55%)' }}>{rw.chungScore}</span>
                  <span className="text-white/15 text-xs">—</span>
                  <span className="flex-1 font-display font-bold" style={{ color: 'hsl(0 72% 51%)' }}>{rw.hongScore}</span>
                  <span className="w-6 text-center">{rw.winner === 'chung' ? '🔵' : rw.winner === 'hong' ? '🔴' : '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Calling next players — name + side color, VS between, pulled
              straight from the tournament bracket so the audience (and the
              next two athletes) know immediately who's up. */}
          {nextMatch && (
            <div className="w-full max-w-2xl" style={{
              opacity: winnerScale ? 1 : 0,
              transform: winnerScale ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.6s ease-out 1s',
            }}>
              <div className="text-center font-display text-xs text-white/40 tracking-[0.3em] uppercase mb-2">Next Match</div>
              <div className="flex items-center justify-center gap-5 rounded-xl py-4 px-6" style={{ background: 'hsl(224 35% 8% / 0.85)', border: '1px solid hsl(224 35% 18%)' }}>
                <div className="text-center flex-1 max-w-[260px]">
                  <div className="font-display text-2xl font-black truncate" style={{ color: 'hsl(217 91% 60%)', textShadow: '0 0 15px hsl(217 91% 55% / 0.4)' }}>
                    {nextMatch.player1?.name}
                  </div>
                </div>
                <div className="font-display text-xl text-white/25 font-bold">VS</div>
                <div className="text-center flex-1 max-w-[260px]">
                  <div className="font-display text-2xl font-black truncate" style={{ color: 'hsl(0 72% 58%)', textShadow: '0 0 15px hsl(0 72% 51% / 0.4)' }}>
                    {nextMatch.player2?.name}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <style>{`
          @keyframes winnerGlowPulse { 0%,100%{ box-shadow: 0 0 50px hsl(45 93% 58% / 0.55), 0 0 100px hsl(45 93% 58% / 0.25), inset 0 1px 0 rgba(255,255,255,0.35); } 50%{ box-shadow: 0 0 70px hsl(45 93% 58% / 0.75), 0 0 140px hsl(45 93% 58% / 0.4), inset 0 1px 0 rgba(255,255,255,0.5); } }
          @keyframes screenGlow { 0%{opacity:0.3} 100%{opacity:0.7} }
        `}</style>
      </div>
    );
  }

  // ================================================================
  // ⏱️ REST / INTERMISSION FRAME
  // ================================================================
  if (currentFrame === 'rest') {
    const restProgress = config.restTime > 0 ? timeRemaining / config.restTime : 0;
    const timerColor = restProgress > 0.5 ? 'hsl(142 71% 45%)' : restProgress > 0.2 ? 'hsl(45 93% 58%)' : 'hsl(0 72% 51%)';
    const bluePlayer = state.chung.player;
    const redPlayer = state.hong.player;
    const nextBlue = nextMatch?.player2;
    const nextRed = nextMatch?.player1;
    const judges = Math.max(0, Number(state.connectedJudgeCount ?? 0));
    const refereeConnected = Boolean(state.publicBroadcastLive);
    const roundsTotal = Math.max(1, Number(config.rounds || 3));
    const nextRound = Math.min(roundsTotal, currentRound + 1);
    const roundLabel = `${currentRound} / ${roundsTotal}`;
    const restLabel = state.isGoldenRound ? 'GOLDEN ROUND REST' : `ROUND ${currentRound} REST`;
    const restPhase = getRestPhase(timeRemaining, state.status, config.restTime);
    const restPhaseLabel = getRestPhaseLabel(restPhase, lang === 'ar' ? 'ar' : 'en');
    const decisionLabel = currentRoundDecisionLabel || (state.pendingRoundDecision ? 'AI TIE ANALYSIS' : 'WAITING FOR NEXT ROUND');
    const lastRoundResult = state.roundWinners?.find(r => r.round === currentRound);
    const roundHistory = (state.roundWinners || []).slice().sort((a,b) => a.round - b.round);
    const blueRoundWins = roundHistory.filter(r => r.winner === 'chung').length;
    const redRoundWins = roundHistory.filter(r => r.winner === 'hong').length;
    const roundMatchScore = `${blueRoundWins} — ${redRoundWins}`;
    const lastRoundWinnerLabel = lastRoundResult
      ? (lastRoundResult.winner === 'draw' ? (lang === 'ar' ? 'تعادل' : 'DRAW') : lastRoundResult.winner === 'chung' ? (lang === 'ar' ? 'أزرق (تشونغ)' : 'BLUE / CHUNG') : (lang === 'ar' ? 'أحمر (هونغ)' : 'RED / HONG'))
      : '';
    const roundMethodLabel = (method?: string, decisionType?: string) => {
      if (decisionType === 'WOOSE_GIROK') return lang === 'ar' ? 'قرار WOO-SE-GIROK' : 'WOO-SE-GIROK DECISION';
      if (decisionType === 'AI_RECOMMENDATION') return lang === 'ar' ? 'قرار تحليل AI' : 'AI DECISION';
      if (method === 'superiority') return lang === 'ar' ? 'قرار الحكام / الأفضلية' : 'JUDGES DECISION / SUPERIORITY';
      if (method === 'gamjeom') return lang === 'ar' ? 'بفارق Gam-jeom' : 'GAM-JEOM ADVANTAGE';
      if (method === 'score') return lang === 'ar' ? 'بفارق النقاط' : 'POINT GAP';
      if (method === 'draw') return lang === 'ar' ? 'تعادل' : 'DRAW';
      return method ? String(method).toUpperCase() : '';
    };
    const finalRoundAlert = lastRoundResult && (currentRound >= roundsTotal || state.result)
      ? (lastRoundResult.decisionType === 'WOOSE_GIROK' || lastRoundResult.decisionType === 'AI_RECOMMENDATION' || lastRoundResult.method === 'superiority'
        ? (lang === 'ar' ? 'انتهت بقرار' : 'ENDED BY DECISION')
        : (lang === 'ar' ? 'انتهت بفارق النقاط' : 'ENDED BY POINT GAP'))
      : '';
    const redGamjeom = getGamjeomForRound('hong');
    const blueGamjeom = getGamjeomForRound('chung');
    const infoRows = [
      ['TOURNAMENT TYPE', competitionTypeLabel],
      ['MAT', state.matNumber ? `MAT ${String(state.matNumber).padStart(2, '0')}` : 'MAT 01'],
      ['MATCH NO.', state.matchNumber ? String(state.matchNumber).padStart(3, '0') : '---'],
      ['ROUND', roundLabel],
      ['AGE', state.ageGroup || '—'],
      ['GENDER', genderLabel],
      ['WEIGHT', state.weightCategory || '—'],
      ['CONTEST TIME', formatTime(config.roundTime || 120)],
    ];

    return (
      <div key="frame-rest" className={`fixed inset-0 flex flex-col overflow-hidden ${isMiniPreview ? 'public-scoreboard-mini' : ''}`}
        style={{ background: '#020306', animation: 'frameEnter 0.6s ease-out', color: '#fff' }}
        onMouseEnter={() => setShowNav(true)} onMouseLeave={() => setShowNav(false)}>
        {persistentTopNav}
        {settingsOverlay}{settingsStyleTag}{ivrOverlay}{koOverlay}{doctorCallOverlay}{kyeshiCallOverlay}{cinematicActive ? null : pendingSubOverlay}{substitutionAnimationOverlay || teamCallOverlay || callAnimationOverlay || (state.matchupAnimation ? matchupOverlay : null) || (cinematicActive ? null : nextOnMatchOverlay)}{cinematicActive ? null : readyBanner}{cinematicActive ? null : greetingBanner}{cinematicActive ? null : goldenBanner}{cinematicActive ? null : goldenPointOverlay}{cinematicActive ? null : standingsOverlay}
        {publicMatchMetaBar}

        {showEndOfRound && !state.isGoldenRound && (
          <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(2,3,6,.94)', animation: 'frameEnter 0.3s ease-out' }}>
            <div className="font-display font-black tracking-[0.25em] text-center" style={{ fontSize: 'clamp(40px, 6vw, 90px)', color: 'hsl(45 93% 58%)', textShadow: '0 0 40px hsl(45 93% 58% / .7)' }}>
              END OF ROUND {currentRound}
            </div>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(circle at 12% 88%, rgba(32,130,255,.16), transparent 32%), radial-gradient(circle at 88% 88%, rgba(255,42,62,.16), transparent 32%), radial-gradient(circle at 50% 50%, rgba(255,216,102,.055), transparent 48%), linear-gradient(180deg, rgba(255,255,255,.025), transparent 18%, rgba(0,0,0,.45))',
        }} />

        {/* WT-style one-minute inter-round rest is the default; the configured
            restTime remains authoritative so custom event formats still work. */}
        <div className="relative z-10 shrink-0 px-5 py-2.5 border-b border-white/10" style={{ background: 'rgba(0,0,0,.72)' }}>
          <div className="mx-auto max-w-[1900px] flex items-center justify-between gap-4">
            <div className="font-display font-black tracking-[.18em] text-[11px] text-white/55 uppercase">{state.competitionName || 'WAB TAEKWONDO'}</div>
            <div className="font-display font-black tracking-[.22em] text-white text-[clamp(16px,1.5vw,28px)]">{state.division || state.config?.division || 'CADETS - OTHERS'}</div>
            <div className="flex items-center gap-2 text-[10px] font-display font-black tracking-[.16em] text-white/45"><span className="h-2 w-2 rounded-full" style={{ background: 'hsl(142 71% 45%)', boxShadow: '0 0 10px hsl(142 71% 45%)' }} /> LIVE BROADCAST</div>
          </div>
        </div>

        {/* FROZEN MATCH STRIP — deliberately mirrors the live scoreboard while
            making it obvious that the athletes are in rest, not fighting. */}
        <div className="relative z-10 shrink-0 px-4 pt-3">
          <div className="mx-auto max-w-[1900px] grid grid-cols-[1fr_minmax(180px,250px)_1fr] gap-2 items-stretch">
            <div className="rounded-xl overflow-hidden border border-red-500/35" style={{ background: 'linear-gradient(135deg, rgba(155,12,20,.92), rgba(45,3,7,.96))', boxShadow: '0 0 35px rgba(255,42,62,.12)' }}>
              <div className="px-4 py-2 flex items-center justify-between border-b border-white/10"><span className="font-display font-black text-[10px] tracking-[.25em] text-red-200">RED / HONG</span><span className="text-[10px] text-white/55">GAM-JEOM {redGamjeom}</span></div>
              <div className="px-4 py-2 flex items-center gap-3"><span className="font-display font-black text-[clamp(16px,1.7vw,28px)] truncate">{broadcastName(redPlayer.name, nameFormat, 'HONG')}</span><span className="text-[10px] font-black text-white/45">{redPlayer.nationality || '—'}</span></div>
            </div>
            <div className="rounded-xl border border-white/15 flex flex-col items-center justify-center px-3" style={{ background: 'rgba(2,4,8,.96)', boxShadow: 'inset 0 0 25px rgba(255,255,255,.025)' }}>
              <div className="font-display text-[9px] text-white/40 tracking-[.3em]">MATCH</div>
              <div className="font-display font-black text-2xl text-[#ffd866]">{state.matchNumber || '---'}</div>
              <div className="mt-1 rounded-md border border-white/10 bg-white/[.035] px-3 py-1 font-display text-[9px] font-black tracking-[.16em] text-white/55">REST · R{currentRound}</div>
            </div>
            <div className="rounded-xl overflow-hidden border border-blue-500/35" style={{ background: 'linear-gradient(135deg, rgba(8,39,150,.95), rgba(2,8,48,.98))', boxShadow: '0 0 35px rgba(32,130,255,.12)' }}>
              <div className="px-4 py-2 flex items-center justify-between border-b border-white/10"><span className="font-display font-black text-[10px] tracking-[.25em] text-blue-200">BLUE / CHUNG</span><span className="text-[10px] text-white/55">GAM-JEOM {blueGamjeom}</span></div>
              <div className="px-4 py-2 flex items-center justify-end gap-3"><span className="text-[10px] font-black text-white/45">{bluePlayer.nationality || '—'}</span><span className="font-display font-black text-[clamp(16px,1.7vw,28px)] truncate">{broadcastName(bluePlayer.name, nameFormat, 'CHUNG')}</span></div>
            </div>
          </div>
        </div>

        {/* MAIN REST STAGE — player image zones + central countdown, matching
            the requested red/blue broadcast language. */}
        <div className="relative z-10 flex-1 min-h-0 px-4 py-3">
          <div className="mx-auto max-w-[1900px] h-full grid grid-cols-[minmax(220px,1fr)_minmax(300px,520px)_minmax(220px,1fr)] gap-4 items-stretch">
            <div className="relative overflow-hidden rounded-2xl border-2 border-red-500/70" style={{ background: 'radial-gradient(circle at 50% 48%, rgba(255,42,62,.24), transparent 48%), linear-gradient(160deg, rgba(75,5,12,.95), rgba(7,3,7,.98))', boxShadow: '0 0 45px rgba(255,42,62,.16), inset 0 0 45px rgba(255,42,62,.08)' }}>
              <div className="absolute top-3 left-3 right-3 z-10 flex justify-between"><span className="font-display text-[10px] font-black tracking-[.28em] text-red-200">RED CORNER</span><span className="font-display text-[10px] text-white/45">{redPlayer.playerNumber ?? redPlayer.seedNumber ?? '—'}</span></div>
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-red-950/70 to-transparent" />
              <div className="absolute inset-0 flex items-end justify-center pt-7 pb-20">
                <PhotoOrFlag photoUrl={redPlayer.photoUrl || redPlayer.photo} nationality={redPlayer.nationality} showPhoto={dc.showPhoto} showFlag={dc.showFlag} size={{ width: '78%', height: '78%' }} className="max-h-full max-w-full object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,.9)]" />
              </div>
              <div className="absolute bottom-3 left-3 right-3 z-10 text-center"><div className="font-display font-black text-[clamp(15px,1.5vw,25px)] truncate">{broadcastName(redPlayer.name, nameFormat, 'HONG')}</div><div className="text-[10px] font-black text-white/55 mt-1">{redPlayer.club || '—'} · {redPlayer.nationality || '—'}</div></div>
            </div>

            <div className="rounded-2xl border border-white/10 flex flex-col items-center justify-center px-4 py-3" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(255,216,102,.10), transparent 45%), rgba(0,0,0,.72)', boxShadow: '0 0 55px rgba(0,0,0,.55), inset 0 0 30px rgba(255,255,255,.025)' }}>
              <div className="font-display text-[10px] font-black tracking-[.45em] text-[#ffd866] uppercase">{restLabel}</div>
              <div className="font-display font-black tabular-nums leading-none mt-1" style={{ fontSize: 'clamp(70px,9vw,145px)', color: timerColor, textShadow: `0 0 18px ${timerColor}, 0 0 55px ${timerColor}` }}>{formatTime(timeRemaining)}</div>
              <div className="w-[82%] h-2 rounded-full mt-2 overflow-hidden" style={{ background: 'rgba(255,255,255,.08)', boxShadow: 'inset 0 1px 4px rgba(0,0,0,.8)' }}><div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(1, restProgress)) * 100}%`, background: timerColor, boxShadow: `0 0 18px ${timerColor}` }} /></div>
              <div className={`mt-5 font-display font-black text-[clamp(13px,1.2vw,19px)] tracking-[.16em] ${restPhase === 'REFEREE_CONFIRM' ? 'text-[#ffd866]' : restPhase === 'GET_READY' ? 'text-red-200' : 'text-white/75'}`}>{restPhaseLabel}</div>
              <div className="mt-2 flex items-center gap-2 text-[10px] font-display font-black tracking-[.18em] text-white/40"><Clock size={13} /> {restPhase === 'REFEREE_CONFIRM' ? (lang === 'ar' ? 'لا يبدأ القتال تلقائيًا' : 'ROUND DOES NOT START AUTOMATICALLY') : (lang === 'ar' ? `الجولة التالية ${nextRound}` : `NEXT ROUND ${nextRound}`)}</div>
              {lastRoundResult && (
                <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/[.06] px-4 py-2 text-center max-w-full">
                  <div className="font-display text-[9px] tracking-[.25em] text-emerald-300/80">{lang === 'ar' ? `نتيجة الجولة ${currentRound}` : `ROUND ${currentRound} RESULT`}</div>
                  <div className="font-display font-black text-sm mt-1 truncate">{lastRoundWinnerLabel}{typeof lastRoundResult.chungScore === 'number' && typeof lastRoundResult.hongScore === 'number' ? ` · ${lastRoundResult.hongScore} – ${lastRoundResult.chungScore}` : ''}</div>
                  <div className="mt-1 text-[9px] font-black tracking-[.14em] text-white/55">{roundMethodLabel(lastRoundResult.method, lastRoundResult.decisionType)}</div>
                </div>
              )}
              <div className="mt-3 rounded-xl border-2 border-[#ffd866]/45 bg-[#ffd866]/[.08] px-4 py-2.5 text-center max-w-full shadow-[0_0_24px_rgba(255,216,102,.10)]">
                <div className="font-display text-[9px] tracking-[.28em] text-[#ffd866]/75">{lang === 'ar' ? 'نتيجة الجولات' : 'ROUND SCORE'}</div>
                <div className="font-display font-black text-2xl mt-0.5"><span className="text-[hsl(var(--chung))]">{blueRoundWins}</span><span className="text-white/35 mx-2">—</span><span className="text-[hsl(var(--hong))]">{redRoundWins}</span></div>
                <div className="text-[8px] text-white/45 mt-0.5 tracking-[.12em]">BLUE ROUNDS — RED ROUNDS</div>
              </div>
              {finalRoundAlert && (
                <div className="mt-3 rounded-xl border-2 border-red-300/55 bg-red-500/[.10] px-4 py-3 text-center animate-pulse shadow-[0_0_30px_rgba(255,60,80,.18)]">
                  <div className="font-display font-black text-[clamp(13px,1.2vw,20px)] tracking-[.18em] text-white">{finalRoundAlert}</div>
                  <div className="mt-1 font-display font-black text-[10px] tracking-[.18em] text-red-200">{roundMethodLabel(lastRoundResult?.method, lastRoundResult?.decisionType)}</div>
                </div>
              )}
              {restPhase === 'REFEREE_CONFIRM' && <div className="mt-3 rounded-xl border-2 border-[#ffd866]/55 bg-[#ffd866]/[.08] px-4 py-2.5 text-center max-w-full shadow-[0_0_25px_rgba(255,216,102,.12)]"><div className="font-display text-[9px] tracking-[.28em] text-[#ffd866]/75">REFEREE CONTROL</div><div className="font-display font-black text-sm mt-1">{lang === 'ar' ? 'اضغط تأكيد الحكم لبدء تحضير الجولة' : 'REFEREE CONFIRMATION REQUIRED'}</div></div>}
              <div className="mt-3 rounded-xl border border-[#ffd866]/25 bg-[#ffd866]/[.05] px-4 py-2 text-center max-w-full"><div className="font-display text-[9px] tracking-[.25em] text-[#ffd866]/70">ROUND DECISION</div><div className="font-display font-black text-sm mt-1 truncate">{decisionLabel}</div></div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border-2 border-blue-500/70" style={{ background: 'radial-gradient(circle at 50% 48%, rgba(32,130,255,.24), transparent 48%), linear-gradient(160deg, rgba(5,28,90,.98), rgba(3,5,12,.98))', boxShadow: '0 0 45px rgba(32,130,255,.16), inset 0 0 45px rgba(32,130,255,.08)' }}>
              <div className="absolute top-3 left-3 right-3 z-10 flex justify-between"><span className="font-display text-[10px] font-black tracking-[.28em] text-blue-200">BLUE CORNER</span><span className="font-display text-[10px] text-white/45">{bluePlayer.playerNumber ?? bluePlayer.seedNumber ?? '—'}</span></div>
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-blue-950/70 to-transparent" />
              <div className="absolute inset-0 flex items-end justify-center pt-7 pb-20">
                <PhotoOrFlag photoUrl={bluePlayer.photoUrl || bluePlayer.photo} nationality={bluePlayer.nationality} showPhoto={dc.showPhoto} showFlag={dc.showFlag} size={{ width: '78%', height: '78%' }} className="max-h-full max-w-full object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,.9)]" />
              </div>
              <div className="absolute bottom-3 left-3 right-3 z-10 text-center"><div className="font-display font-black text-[clamp(15px,1.5vw,25px)] truncate">{broadcastName(bluePlayer.name, nameFormat, 'CHUNG')}</div><div className="text-[10px] font-black text-white/55 mt-1">{bluePlayer.club || '—'} · {bluePlayer.nationality || '—'}</div></div>
            </div>
          </div>
        </div>

        {/* LOWER INFORMATION BAR — status only on Public/Broadcast. The Main
            Referee keeps all actionable controls; the audience only mirrors state. */}
        <div className="relative z-10 shrink-0 px-4 pb-3">
          <div className="mx-auto max-w-[1900px] grid grid-cols-[1fr_1fr_1.35fr_1.35fr] gap-2">
            <div className="rounded-xl border border-white/10 bg-black/60 px-4 py-2 text-center"><div className="font-display text-[9px] font-black tracking-[.2em] text-white/40">JUDGES PRESENT</div><div className={`font-display font-black text-lg ${judges >= 3 ? 'text-green-400' : 'text-[#ffd866]'}`}>{Math.min(judges,3)} / 3</div></div>
            <div className="rounded-xl border border-white/10 bg-black/60 px-4 py-2 text-center"><div className="font-display text-[9px] font-black tracking-[.2em] text-white/40">REFEREE CONNECTED</div><div className={`font-display font-black text-lg ${refereeConnected ? 'text-green-400' : 'text-red-400'}`}>{refereeConnected ? 'YES' : 'WAITING'}</div></div>
            <div className="rounded-xl border border-white/10 bg-black/60 px-4 py-2"><div className="font-display text-[9px] font-black tracking-[.2em] text-[#ffd866]/70">MATCH INFO</div><div className="mt-1 grid grid-cols-4 gap-x-3 gap-y-1">{infoRows.map(([label,value]) => <div key={label} className="min-w-0"><div className="text-[7px] text-white/35 font-black tracking-[.12em] truncate">{label}</div><div className="text-[10px] font-display font-black text-white/85 truncate">{value}</div></div>)}</div></div>
            <div className="rounded-xl border border-white/10 bg-black/60 px-4 py-2"><div className="font-display text-[9px] font-black tracking-[.2em] text-[#ffd866]/70">NEXT ON THE MAT</div><div className="mt-1 flex items-center gap-2"><div className="min-w-0 flex-1"><div className="text-[11px] font-display font-black text-red-300 truncate">{nextRed?.name || 'WAITING'}</div></div><div className="font-display text-[9px] text-white/30">VS</div><div className="min-w-0 flex-1 text-right"><div className="text-[11px] font-display font-black text-blue-300 truncate">{nextBlue?.name || 'WAITING'}</div></div></div><div className="mt-1 text-center text-[8px] font-black tracking-[.14em] text-white/35">{nextMatch ? `MATCH ${nextMatch.matchNumber ?? 'NEXT'} · ${nextRed?.nationality || '—'} VS ${nextBlue?.nationality || '—'}` : 'NO NEXT MATCH ASSIGNED'}</div></div>
          </div>
        </div>

        <style>{`
          @keyframes restPulseGold {0%,100%{opacity:.8}50%{opacity:1}}
          @media (max-width: 900px){
            .public-scoreboard-mini .grid-cols-\[minmax\(220px\,1fr\)_minmax\(300px\,520px\)_minmax\(220px\,1fr\)\]{grid-template-columns:1fr!important}
          }
        `}</style>
      </div>
    );
  }

  // ================================================================
  // ⚖️ INDIVIDUAL ROUND TIE BROADCAST — read-only mirror of Main Referee
  // ================================================================
  const tieReview = state.roundTieReview;
  const tieDetails = state.roundWinners.find(r => r.round === state.currentRound)?.tiebreakDetails;
  const showTieResult = tieReview?.phase === 'result' && state.status === 'rest' && !!state.roundDecisionRevealUntil && Date.now() < state.roundDecisionRevealUntil;
  const tieBroadcastOverlay = (state.pendingRoundDecision || showTieResult) && config.competitionMode !== 'par_equipe' && config.roundTieBroadcastAnimationEnabled !== false ? (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/92 backdrop-blur-sm pointer-events-none">
      <div className="w-[min(94vw,1200px)] rounded-3xl border-2 border-[hsl(var(--gold))]/60 bg-[#070a10] shadow-[0_0_80px_rgba(245,200,66,.16)] overflow-hidden">
        <div className="px-8 py-5 border-b border-white/10 text-center"><div className="text-[hsl(var(--gold))] text-xs font-black tracking-[.4em]">ROUND {state.currentRound} — TIE</div><div className="mt-2 text-4xl font-display font-black"><span className="text-[hsl(var(--chung))]">BLUE {state.chung.scores[state.currentRound-1]?.total ?? 0}</span><span className="text-white/30 mx-6">—</span><span className="text-[hsl(var(--hong))]">{state.hong.scores[state.currentRound-1]?.total ?? 0} RED</span></div></div>
        <div className="p-8 min-h-[420px] relative">
          {(!tieReview || tieReview.phase === 'ai') && <div className="text-center animate-fade-in"><div className="text-[10px] tracking-[.35em] text-white/50">AI TIE ANALYSIS</div><div className={`mt-3 text-5xl font-display font-black ${tieDetails?.aiWinner==='chung'?'text-[hsl(var(--chung))]':tieDetails?.aiWinner==='hong'?'text-[hsl(var(--hong))]':'text-white'}`}>{tieDetails?.aiWinner==='chung'?'BLUE':tieDetails?.aiWinner==='hong'?'RED':'NO CLEAR ADVANTAGE'}</div><div className="mt-3 text-lg text-white/80">CONFIDENCE {tieDetails?.aiConfidence ?? state.aiConfidence ?? 0}%</div><div className="mt-2 text-sm font-black"><span className="text-[hsl(var(--chung))]">BLUE {tieDetails?.aiScore?.chung ?? '—'}</span><span className="text-white/30 mx-2">—</span><span className="text-[hsl(var(--hong))]">{tieDetails?.aiScore?.hong ?? '—'} RED</span></div><div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-left"><div className="rounded-xl border border-white/10 p-3"><span className="text-[9px] text-white/50">HEAD HITS</span><div className="font-black mt-1"><span className="text-[hsl(var(--chung))]">{tieDetails?.chungHeadKicks ?? 0}</span> — <span className="text-[hsl(var(--hong))]">{tieDetails?.hongHeadKicks ?? 0}</span></div></div><div className="rounded-xl border border-white/10 p-3"><span className="text-[9px] text-white/50">BODY HITS</span><div className="font-black mt-1"><span className="text-[hsl(var(--chung))]">{tieDetails?.chungTrunkKicks ?? 0}</span> — <span className="text-[hsl(var(--hong))]">{tieDetails?.hongTrunkKicks ?? 0}</span></div></div><div className="rounded-xl border border-white/10 p-3"><span className="text-[9px] text-white/50">ATTACKS</span><div className="font-black mt-1"><span className="text-[hsl(var(--chung))]">{tieDetails?.chungValidHits ?? 0}</span> — <span className="text-[hsl(var(--hong))]">{tieDetails?.hongValidHits ?? 0}</span></div></div><div className="rounded-xl border border-white/10 p-3"><span className="text-[9px] text-white/50">PENALTIES</span><div className="font-black mt-1"><span className="text-[hsl(var(--chung))]">{tieDetails?.chungPenalties ?? 0}</span> — <span className="text-[hsl(var(--hong))]">{tieDetails?.hongPenalties ?? 0}</span></div></div><div className="rounded-xl border border-white/10 p-3"><span className="text-[9px] text-white/50">PSS HITS</span><div className="font-black mt-1"><span className="text-[hsl(var(--chung))]">{tieDetails?.chungPssHits ?? 0}</span> — <span className="text-[hsl(var(--hong))]">{tieDetails?.hongPssHits ?? 0}</span></div></div></div><div className="mt-6 text-sm text-white/60 max-w-3xl mx-auto">{tieDetails?.reason || 'REFEREE DECISION REQUIRED'}</div></div>}
          {tieReview?.phase === 'summons' && <div className="h-full flex flex-col items-center justify-center text-center relative overflow-hidden girok-public-scene"><img src={wooseGirokArmsUrl} alt="" className="girok-public-arms"/><div className="relative z-10 girok-public-center"><div className="text-[hsl(var(--gold))] text-sm tracking-[.5em]">우세기록</div><div className="girok-gold-title font-display text-5xl mt-3">WOO-SE-GIROK</div><div className="mt-8 text-white/60 tracking-[.3em]">THREE JUDGES SUMMONED</div></div></div>}
          {tieReview?.phase === 'countdown' && <div className="h-full flex flex-col items-center justify-center text-center relative overflow-hidden girok-public-scene"><img src={wooseGirokArmsUrl} alt="" className="girok-public-arms countdown-arms"/><div className="relative z-10 girok-count-between"><div className="text-[hsl(var(--gold))] text-8xl font-display font-black">{tieReview.countdownStep}</div><div className="text-2xl font-black text-white mt-2">{tieReview.countdownStep===1?'HANA — 하나':tieReview.countdownStep===2?'DUL — 둘':'SET — 셋'}</div></div></div>}
          {tieReview?.phase === 'voting' && <div className="text-center relative"><div className="text-xs tracking-[.35em] text-[hsl(var(--gold))] font-black">THREE REFEREES</div><div className="grid grid-cols-3 gap-5 mt-8">{(['left','center','right'] as const).map((id,i)=>{const vote=tieReview.votes[id]; const name=tieReview.judgeNames?.[id] || (i===0?'Judge 1':i===1?'Center Referee':'Judge 3'); const role=i===1?'CENTER / MAT REFEREE':'SIDE JUDGE'; const photo=tieReview.judgePhotos?.[id]; const armSrc = vote==='chung'?judgeDecisionBlueArmUrl:vote==='hong'?judgeDecisionRedArmUrl:null; return <div key={id} className={`girok-public-judge girok-frame-strong ${i===1?'is-center':''} ${vote?(vote==='chung'?'is-voted-chung':'is-voted-hong'):''}`}><div className="girok-public-photo-wrap">{photo ? <img src={photo} alt="" className="girok-public-photo"/> : <div className="girok-public-photo-placeholder">{name.slice(0,1).toUpperCase()}</div>}</div>{armSrc ? <img src={armSrc} alt="" className={`girok-judge-arms-voted ${vote==='chung'?'is-chung-arm':'is-hong-arm'}`}/> : <img src={wooseGirokArmsUrl} alt="" className="girok-judge-arms"/>}<div className="relative z-10"><div className="text-sm font-black">{name}</div><div className="text-[9px] tracking-[.18em] text-white/45 mt-1">{role}</div><div className={`mt-5 text-2xl font-display font-black ${vote==='chung'?'text-[hsl(var(--chung))]':vote==='hong'?'text-[hsl(var(--hong))]':'text-white/30'}`}>{vote==='chung'?'BLUE':vote==='hong'?'RED':'WAITING'}</div></div></div>})}</div><div className="mt-8 text-3xl font-display font-black">BLUE {Object.values(tieReview.votes).filter(v=>v==='chung').length} — {Object.values(tieReview.votes).filter(v=>v==='hong').length} RED</div></div>}
          {tieReview?.phase === 'result' && (() => { const blue=Object.values(tieReview.votes).filter(v=>v==='chung').length; const red=Object.values(tieReview.votes).filter(v=>v==='hong').length; const winner=blue>=2?'chung':'hong'; const unanimous=blue===3||red===3; return <div className="h-full flex flex-col items-center justify-center text-center relative overflow-hidden girok-result-scene"><div className="relative z-10 w-full"><div className="text-[10px] tracking-[.3em] text-white/45 font-black mb-4">THREE REFEREES · FINAL VOTE</div><div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">{(['left','center','right'] as const).map((id,i)=>{const vote=tieReview.votes[id]; const name=tieReview.judgeNames?.[id] || (i===0?'Judge 1':i===1?'Center Referee':'Judge 3'); const role=i===1?'CENTER / MAT REFEREE':'SIDE JUDGE'; const photo=tieReview.judgePhotos?.[id]; const armSrc = vote==='chung'?judgeDecisionBlueArmUrl:judgeDecisionRedArmUrl; return <div key={id} className={`girok-public-judge girok-frame-strong is-small ${i===1?'is-center':''} ${vote==='chung'?'is-voted-chung':'is-voted-hong'}`}><div className="girok-public-photo-wrap is-small">{photo ? <img src={photo} alt="" className="girok-public-photo"/> : <div className="girok-public-photo-placeholder">{name.slice(0,1).toUpperCase()}</div>}</div><img src={armSrc} alt="" className={`girok-judge-arms-voted is-small ${vote==='chung'?'is-chung-arm':'is-hong-arm'}`}/><div className="relative z-10"><div className="text-xs font-black">{name}</div><div className="text-[8px] tracking-[.16em] text-white/45 mt-1">{role}</div><div className={`mt-3 text-lg font-display font-black ${vote==='chung'?'text-[hsl(var(--chung))]':'text-[hsl(var(--hong))]'}`}>{vote==='chung'?'BLUE':'RED'}</div></div></div>})}</div><div className={`girok-decision-frame mt-8 mx-auto relative overflow-hidden p-6 ${winner==='chung'?'is-chung':'is-hong'}`} style={{maxWidth:640}}><img src={winner==='chung'?judgeDecisionBlueArmUrl:judgeDecisionRedArmUrl} alt="" className="girok-decision-arm"/><div className="relative z-10"><div className="girok-gold-title font-display text-lg md:text-xl">{unanimous?'UNANIMOUS DECISION':'MAJORITY DECISION'}</div><div className={`mt-3 text-6xl md:text-7xl font-display font-black ${winner==='chung'?'text-[hsl(var(--chung))]':'text-[hsl(var(--hong))]'}`}>{winner==='chung'?'BLUE':'RED'}</div><div className="girok-result-frame mt-4"><div className="text-[10px] tracking-[.3em] text-white/50">ROUND {state.currentRound} WINNER</div><div className="text-3xl font-display font-black mt-2">{blue} — {red}</div><div className="text-xs mt-2 text-white/65">JUDGES DECISION</div></div><div className="mt-3 text-xs text-white/55 tracking-[.2em]">{state.status==='rest' ? `REST — ${formatTime(state.timeRemaining)}` : 'REST STARTING…'}</div></div></div></div></div> })()}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div key="frame-fight" dir="ltr" className={`fixed inset-0 flex flex-col overflow-hidden ${ptgAnimation ? 'ptg-shake' : ''} ${isMiniPreview ? 'public-scoreboard-mini' : ''}`}
      style={{ background: isStreamOverlay ? 'transparent' : 'hsl(224 35% 4%)', animation: 'frameEnter 0.6s ease-out' }}
      onMouseEnter={() => setShowNav(true)} onMouseLeave={() => setShowNav(false)}>
      {state.config.trainingMode && !isStreamOverlay && (
        <div className="w-full py-1 text-center text-[11px] font-black tracking-[0.3em] bg-[hsl(38_92%_50%)] text-black z-[70] relative shrink-0">
          🎓 TRAINING MODE — NOT AN OFFICIAL MATCH
        </div>
      )}
      {!isStreamOverlay && persistentTopNav}
      {tieBroadcastOverlay}
      {settingsOverlay}{settingsStyleTag}{ivrOverlay}{koOverlay}{doctorCallOverlay}{kyeshiCallOverlay}{cinematicActive ? null : pendingSubOverlay}{substitutionAnimationOverlay || teamCallOverlay || callAnimationOverlay || (state.matchupAnimation ? matchupOverlay : null) || (cinematicActive ? null : nextOnMatchOverlay)}{cinematicActive ? null : readyBanner}{cinematicActive ? null : greetingBanner}{cinematicActive ? null : goldenBanner}{cinematicActive ? null : goldenPointOverlay}{cinematicActive ? null : standingsOverlay}
      {publicMatchMetaBar}
      <style>{`
        @keyframes ptgSoftShake {
          0%,100% { transform: translate(0,0); }
          20% { transform: translate(-3px,2px); }
          40% { transform: translate(3px,-2px); }
          60% { transform: translate(-2px,-2px); }
          80% { transform: translate(2px,2px); }
        }
        .ptg-shake { animation: ptgSoftShake 180ms linear infinite; }
      `}</style>


      {/* Judge approval toast (from main referee) */}
      {approvalToast && (
        <div className="fixed top-[10%] left-1/2 -translate-x-1/2 z-[300] animate-fade-in pointer-events-none">
          <div className={`px-8 py-4 rounded-2xl shadow-2xl border-2 backdrop-blur-md ${
            approvalToast.status === 'approved'
              ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
              : 'bg-red-500/25 border-red-400 text-red-100'
          }`}>
            <div className="text-center font-display font-black tracking-widest text-2xl">
              {approvalToast.status === 'approved' ? '✓ POINT APPROVED' : '✗ POINT REJECTED'}
            </div>
            <div className="text-center text-sm opacity-90 mt-1">
              {approvalToast.judge} → <span className="uppercase font-bold">{approvalToast.player}</span> · {approvalToast.type.replace('_',' ')}
              <span className="opacity-70"> · by {approvalToast.referee}</span>
            </div>
          </div>
        </div>
      )}


      {/* BACKGROUND MOTION LAYER */}
      <div className="absolute inset-0 z-0" style={{
        background: displayChung > displayHong
          ? 'radial-gradient(ellipse at 30% 50%, hsl(217 91% 15% / 0.3), transparent 60%)'
          : displayHong > displayChung
          ? 'radial-gradient(ellipse at 70% 50%, hsl(0 72% 15% / 0.3), transparent 60%)'
          : 'none',
        transition: 'all 1s ease',
      }} />

      {/* Special status overlays. IVR is a dedicated camera/replay request cinematic;
          the old plain VIDEO REPLAY title is intentionally not used anymore. */}
      {isSpecialStatus && (
        <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden"
          style={{
            background: status === 'doctor' ? 'hsl(0 72% 8% / 0.96)' :
              status === 'kyeshi' ? 'hsl(0 0% 0% / 0.96)' : 'rgba(2,7,17,.96)',
          }}>
          {status === 'ivr' && (() => {
            const requester = state.ivrRequestedBy;
            const blue = requester === 'chung';
            const accent = blue ? sb.chungColor : sb.hongColor;
            const player = requester ? (blue ? state.chung.player : state.hong.player) : null;
            const elapsed = ivrAnim ? Date.now() - ivrAnim.ts : 0;
            return (
              <div className="absolute inset-0 flex items-center justify-center" style={{ '--ivr-accent': accent } as React.CSSProperties}>
                <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%, ${accent}2b 0%, transparent 34%, rgba(0,0,0,.92) 78%)` }} />
                <div className="absolute w-[74vmin] h-[74vmin] rounded-full border" style={{ borderColor: `${accent}45`, boxShadow: `0 0 80px ${accent}18, inset 0 0 80px ${accent}10`, animation: 'ivrRequestRing 1.7s ease-out infinite' }} />
                <div className="absolute w-[48vmin] h-[48vmin] rounded-full border-2" style={{ borderColor: `${accent}65`, boxShadow: `0 0 55px ${accent}20`, animation: 'ivrRequestRing 1.25s .18s ease-out infinite' }} />
                <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 4px, rgba(255,255,255,.035) 5px)', animation: 'ivrRequestScan 2.2s linear infinite', opacity: .55 }} />
                <div className="absolute top-0 bottom-0 w-[18vw]" style={{ background: `linear-gradient(90deg, transparent, ${accent}22, transparent)`, transform: 'skewX(-16deg)', animation: 'ivrRequestSweep 2.5s ease-in-out infinite' }} />

                <div className="relative z-10 flex flex-col items-center justify-center text-center px-8" style={{ animation: 'ivrRequestEnter .65s cubic-bezier(.16,1,.3,1) both' }}>
                  <div className="font-display font-black tracking-[.38em] text-white/65 mb-3" style={{ fontSize: 'clamp(9px, 1vw, 15px)' }}>WAB-TKD · OFFICIAL REVIEW</div>
                  <div className="relative" style={{ animation: 'ivrCameraFloat 1.35s ease-in-out infinite' }}>
                    <div className="absolute inset-[12%] rounded-full" style={{ border: `2px solid ${accent}55`, boxShadow: `0 0 45px ${accent}55`, animation: 'ivrCameraPulse 1.15s ease-out infinite' }} />
                    <div className="absolute inset-[2%] rounded-full border border-dashed" style={{ borderColor: `${accent}50`, animation: 'ivrCameraOrbit 4s linear infinite' }} />
                    <img src={ivrRequesterAsset} alt="Video replay camera" className="relative z-10 object-contain" style={{ width: 'clamp(150px, 18vw, 290px)', height: 'clamp(115px, 14vw, 220px)', filter: `drop-shadow(0 0 16px ${accent}) drop-shadow(0 0 55px ${accent}99)` }} />
                  </div>
                  <div className="font-display font-black tracking-[.22em] text-white mt-1" style={{ fontSize: 'clamp(30px, 5vw, 74px)', textShadow: `0 0 25px ${accent}88` }}>VIDEO REPLAY</div>
                  <div className="mt-2 rounded-full px-5 py-2 font-display font-black tracking-[.18em]" style={{ color: '#fff', background: `${accent}20`, border: `2px solid ${accent}88`, boxShadow: `0 0 25px ${accent}20`, fontSize: 'clamp(10px, 1vw, 16px)' }}>
                    {blue ? 'BLUE' : 'RED'} · REVIEW REQUEST
                  </div>
                  {player && <div className="font-display font-bold text-white/70 mt-3" style={{ fontSize: 'clamp(12px, 1.2vw, 19px)' }}>{broadcastName(player.name, nameFormat)}</div>}
                  <div className="font-display font-black tracking-[.3em] mt-4" style={{ color: accent, fontSize: 'clamp(8px, .8vw, 12px)', animation: 'ivrRequestBlink 1s ease-in-out infinite' }}>WAITING FOR REFEREE DECISION</div>
                  {elapsed > 0 && <div className="sr-only">{elapsed}</div>}
                </div>
              </div>
            );
          })()}

          {status === 'doctor' && <div className="text-center"><div className="font-display text-7xl font-black mb-4" style={{ color: 'hsl(0 72% 51%)', animation: 'pulseScore 2s ease-in-out infinite', letterSpacing: '0.1em' }}>DOCTOR</div></div>}
          {status === 'kyeshi' && <div className="text-center"><div className="font-display text-7xl font-black mb-4" style={{ color: 'white', animation: 'pulseScore 2s ease-in-out infinite', letterSpacing: '0.1em' }}>KYESHI</div><div className="font-display font-black mt-4" style={{ fontSize: 'clamp(80px, 12vw, 180px)', color: 'white', textShadow: '0 0 30px rgba(255,255,255,.5)' }}>{formatTime(timeRemaining)}</div></div>}
        </div>
      )}

      {/* PTG is now rendered inside the timer area (see center column). */}

      {/* Test Mode badge — small persistent corner tag, doesn't block the view */}
      {state.testMode && (
        <div className="absolute top-3 start-3 z-40 px-3 py-1.5 rounded-lg font-display font-black text-sm tracking-widest animate-pulse"
          style={{ background: 'hsl(45 93% 15%)', color: 'hsl(45 93% 58%)', border: '2px solid hsl(45 93% 58%)' }}>
          TEST MODE
        </div>
      )}

      {/* Awaiting round start */}
      {state.awaitingRoundStart && !ptgAnimation && (
        <div className="absolute inset-0 z-35 flex items-center justify-center" style={{ background: 'hsl(224 35% 3% / 0.9)' }}>
          <div className="text-center">
            <div className="font-display text-4xl mb-3 animate-pulse" style={{ color: 'hsl(45 93% 58%)' }} >{t('broadcastCallPlayers')}</div>
            <div className="font-display text-2xl text-white/40">ROUND {currentRound + 1}</div>
          </div>
        </div>
      )}

      {/* ZONE 1: Player names with flags + club + country — top strip (responsive) */}
      <div className="flex items-stretch shrink-0 relative z-10" style={{ background: 'hsl(224 35% 6%)' }}>
        {/* Chung player bar — BLUE, always on the right */}
        <div className="flex-1 flex items-center gap-4 px-6 py-3 min-w-0 flex-row-reverse" style={{ borderBottom: '4px solid hsl(217 91% 55%)', order: 3 }}>
          <div className="relative shrink-0">
            <PhotoOrFlag photoUrl={chung.player.photoUrl} nationality={chung.player.nationality}
              showPhoto={dc.showPhoto} showFlag={dc.showFlag}
              size={{ height: 'clamp(48px, 4.5vw, 80px)', width: 'clamp(48px, 4.5vw, 80px)', flagWidth: 'clamp(72px, 6.6vw, 120px)' }}
              className="rounded-md shadow-lg shrink-0 object-cover" />
            {dc.showFlag && dc.showPhoto && chung.player.photoUrl && chung.player.nationality && (
              <div className="absolute -bottom-1 -left-1 rounded shadow" style={{ border: '1.5px solid white' }}>
                <FlagImage code={chung.player.nationality} size={28} className="rounded" style={{ height: '1.3em', width: 'auto' } as any} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-row-reverse">
              {chung.player.seedNumber && (
                <span className="font-display font-black px-1.5 py-0.5 rounded shrink-0" style={{ fontSize: 'clamp(10px, 0.85vw, 14px)', background: 'hsl(45 93% 58% / 0.25)', color: 'hsl(45 93% 65%)' }}>
                  SEED {chung.player.seedNumber}
                </span>
              )}
              {chung.player.playerNumber && (
                <span className="font-display font-black px-1.5 py-0.5 rounded shrink-0" style={{ fontSize: 'clamp(10px, 0.85vw, 14px)', background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                  #{chung.player.playerNumber}
                </span>
              )}
            </div>
            <div className="sb-player-name font-display font-black text-white truncate leading-[1.05] text-right" style={{
              fontSize: 'clamp(24px, 2.6vw, 48px)',
              textShadow: '0 2px 6px rgba(0,0,0,0.5)',
              whiteSpace: nameFormat === 'stacked' ? 'pre-line' : 'nowrap',
            }}>{broadcastName(chung.player.name, nameFormat)}</div>
            <div className="flex items-center gap-3 mt-1 min-w-0 flex-row-reverse">
              {chung.player.club && (
                <span className="font-display font-black truncate text-right px-3 py-1 rounded-md" style={{
                  fontSize: 'clamp(11px, 1vw, 18px)',
                  color: '#f2c14e',
                  letterSpacing: '0.08em',
                  border: '2px solid rgba(242,193,78,.75)',
                  background: 'rgba(0,0,0,.55)',
                  boxShadow: '0 0 16px rgba(242,193,78,.16), inset 0 0 12px rgba(242,193,78,.05)',
                }}>CLUB · {chung.player.club}</span>
              )}
              {chung.player.nationality && (
                <span className="font-display font-black tracking-[0.18em] px-2 py-0.5 rounded shrink-0" style={{
                  fontSize: 'clamp(11px, 0.95vw, 16px)',
                  background: 'rgba(255,255,255,0.12)',
                  color: 'white',
                }}>{chung.player.nationality}</span>
              )}
              {dc.showFlag && chung.player.nationality && (
                <FlagImage code={chung.player.nationality} size={24} className="rounded shrink-0"
                  style={{ height: '1.1em', width: 'auto', border: '1px solid rgba(255,255,255,0.25)' } as any} />
              )}
            </div>
          </div>
        </div>

        {/* Hong player bar — RED, always on the left */}
        <div className="flex-1 flex items-center gap-4 px-6 py-3 min-w-0" style={{ borderBottom: '4px solid hsl(0 72% 51%)', order: 1 }}>
          <div className="relative shrink-0">
            <PhotoOrFlag photoUrl={hong.player.photoUrl} nationality={hong.player.nationality}
              showPhoto={dc.showPhoto} showFlag={dc.showFlag}
              size={{ height: 'clamp(48px, 4.5vw, 80px)', width: 'clamp(48px, 4.5vw, 80px)', flagWidth: 'clamp(72px, 6.6vw, 120px)' }}
              className="rounded-md shadow-lg shrink-0 object-cover" />
            {dc.showFlag && dc.showPhoto && hong.player.photoUrl && hong.player.nationality && (
              <div className="absolute -bottom-1 -right-1 rounded shadow" style={{ border: '1.5px solid white' }}>
                <FlagImage code={hong.player.nationality} size={28} className="rounded" style={{ height: '1.3em', width: 'auto' } as any} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {hong.player.seedNumber && (
                <span className="font-display font-black px-1.5 py-0.5 rounded shrink-0" style={{ fontSize: 'clamp(10px, 0.85vw, 14px)', background: 'hsl(45 93% 58% / 0.25)', color: 'hsl(45 93% 65%)' }}>
                  SEED {hong.player.seedNumber}
                </span>
              )}
              {hong.player.playerNumber && (
                <span className="font-display font-black px-1.5 py-0.5 rounded shrink-0" style={{ fontSize: 'clamp(10px, 0.85vw, 14px)', background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                  #{hong.player.playerNumber}
                </span>
              )}
            </div>
            <div className="sb-player-name font-display font-black text-white truncate leading-[1.05]" style={{
              fontSize: 'clamp(24px, 2.6vw, 48px)',
              textShadow: '0 2px 6px rgba(0,0,0,0.5)',
              whiteSpace: nameFormat === 'stacked' ? 'pre-line' : 'nowrap',
            }}>{broadcastName(hong.player.name, nameFormat)}</div>
            <div className="flex items-center gap-3 mt-1 min-w-0">
              {hong.player.club && (
                <span className="font-display font-black truncate px-3 py-1 rounded-md" style={{
                  fontSize: 'clamp(11px, 1vw, 18px)',
                  color: '#f2c14e',
                  letterSpacing: '0.08em',
                  border: '2px solid rgba(242,193,78,.75)',
                  background: 'rgba(0,0,0,.55)',
                  boxShadow: '0 0 16px rgba(242,193,78,.16), inset 0 0 12px rgba(242,193,78,.05)',
                }}>CLUB · {hong.player.club}</span>
              )}
              {dc.showFlag && hong.player.nationality && (
                <FlagImage code={hong.player.nationality} size={24} className="rounded shrink-0"
                  style={{ height: '1.1em', width: 'auto', border: '1px solid rgba(255,255,255,0.25)' } as any} />
              )}
              {hong.player.nationality && (
                <span className="font-display font-black tracking-[0.18em] px-2 py-0.5 rounded shrink-0" style={{
                  fontSize: 'clamp(11px, 0.95vw, 16px)',
                  background: 'rgba(255,255,255,0.12)',
                  color: 'white',
                }}>{hong.player.nationality}</span>
              )}
            </div>
          </div>
        </div>
      </div>



      {/* ZONE 2+3: MAIN SCORING AREA (fills remaining space) */}
      <div className="flex-1 flex items-stretch relative z-10">

        {/* CHUNG Score Panel — ~39% width, matching the KPNP FOB scoreboard proportions */}
        <div className="sb-side-chung flex flex-col items-center justify-center relative" style={{ flex: '0 0 39%', background: 'hsl(217 91% 50%)', order: 3 }}>
          {/* Team/club emblem (Par Équipe only) — shown above the score, never
              rendered at all when no logo is set (avoids a broken-image icon
              filling this large space; the score number below is enough). */}
          {config.competitionMode === 'par_equipe' && (state.teamLogos?.chung || state.clubLogos?.chung) && (
            <div className="rounded-2xl p-2 mb-3 flex items-center justify-center" style={{
              background: 'rgba(255,255,255,0.92)',
              boxShadow: '0 0 30px rgba(0,0,0,0.35)',
              width: 'clamp(72px, 8vw, 140px)', height: 'clamp(72px, 8vw, 140px)',
            }}>
              <img src={state.teamLogos?.chung || state.clubLogos?.chung} alt=""
                className="max-w-full max-h-full object-contain rounded-xl"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
          {/* Single-frame score — decluttered */}
          <div className="rounded-2xl px-6 md:px-10 py-2 md:py-4 flex items-center justify-center" style={{
            border: '2px solid rgba(255,255,255,0.5)',
            background: 'rgba(0,0,0,0.22)',
            boxShadow: '0 0 30px rgba(0,0,0,0.35), inset 0 0 20px rgba(0,0,0,0.35)',
          }}>
            <div className="sb-score-chung font-display font-black text-white leading-none select-none" style={{
              fontSize: 'clamp(90px, 18vw, 240px)',
              textShadow: chungFlash ? '0 0 60px hsl(45 93% 58%), 0 0 100px hsl(45 93% 58% / 0.8), 0 4px 40px rgba(0,0,0,0.5)' : '0 4px 40px rgba(0,0,0,0.5)',
              transform: chungFlash ? 'scale(1.12)' : 'scale(1)',
              transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), text-shadow 0.25s ease',
              animation: chungFlash ? 'pulseScore 0.3s ease-in-out' : 'none',
            }}>
              {displayChung}
            </div>
          </div>

          {/* BLUE VIDEO REPLAY — one visible card per configured quota. */}
          <VideoReplayQuota quota={chung.ivrQuota} totalQuota={state.config?.ivrQuota ?? chung.ivrQuota} side="chung" />


          {/* Hit breakdown chips — top-left (real equipment photos) */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {(['punch', 'body', 'head'] as const).map((k) => (
              <HitStatChip key={k} kind={k} side="chung" count={chungHits[k]} pulseKey={hitPulse.chung[k] || 0} size={displaySettings.hitIconSize} />
            ))}
          </div>

          {/* Per-round scores — framed boxes at very bottom */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            {chung.scores.slice(0, config.rounds).map((s, i) => {
              const active = i === currentRound - 1;
              const bw = displaySettings.roundBoxBorder;
              return (
                <div key={i} className={`${active ? 'sb-round-active' : ''} rounded-lg flex flex-col items-center justify-center transition-all`} style={{
                  minWidth: 'clamp(54px, 4.5vw, 88px)',
                  padding: 'clamp(4px, 0.4vw, 8px) clamp(8px, 0.7vw, 14px)',
                  background: active ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
                  border: `${active ? bw + 1 : bw}px solid ${active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)'}`,
                  boxShadow: active ? '0 0 22px rgba(255,255,255,0.35), inset 0 0 14px rgba(0,0,0,0.45)' : 'inset 0 0 8px rgba(0,0,0,0.3)',
                }}>
                  <div className="font-display font-bold text-white/80 tracking-widest" style={{ fontSize: 'clamp(9px, 0.7vw, 12px)' }}>R{i + 1}</div>
                  <div className="font-display font-black text-white leading-none tabular-nums" style={{ fontSize: 'clamp(20px, 1.8vw, 32px)' }}>{s.total}</div>
                </div>
              );
            })}
          </div>

          {/* Gamjeom dots — above round scores */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-lg" style={{ bottom: 'clamp(70px, 6vw, 110px)', background: 'rgba(0,0,0,0.4)' }}>
            <span className="text-white/70 font-display font-bold tracking-widest" style={{ fontSize: 'clamp(10px, 0.75vw, 13px)' }}>GAM</span>
            {Array.from({ length: Math.min(config.gamjeomLimit, 10) }, (_, i) => (
              <div key={i} className="rounded-full border-2" style={{
                width: 'clamp(14px, 1.1vw, 22px)', height: 'clamp(14px, 1.1vw, 22px)',
                background: i < getGamjeomForRound('chung') ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.08)',
                borderColor: i < getGamjeomForRound('chung') ? 'hsl(38 92% 65%)' : 'rgba(255,255,255,0.2)',
                boxShadow: i < getGamjeomForRound('chung') ? '0 0 10px hsl(38 92% 50%)' : 'none',
              }} />
            ))}
          </div>

          {/* Action flash on score — slides from left, positioned above gamjeom+round boxes */}
          {recentAction?.player === 'chung' && (
            <div className="absolute left-6" style={{ bottom: 'clamp(140px, 11vw, 180px)', animation: 'hitSlideLeft 0.5s ease-out', zIndex: 15 }}>
              <div className="px-5 py-2.5 rounded-lg text-white font-display font-black"
                style={{ fontSize: 'clamp(14px, 1.2vw, 20px)', background: 'rgba(0,0,0,0.65)', border: '2px solid rgba(255,255,255,0.55)', boxShadow: '0 0 24px hsl(217 91% 55% / 0.7)' }}>
                {getHitLabel(recentAction.type)} +{recentAction.points}
              </div>
            </div>
          )}
        </div>

        {/* CENTER COLUMN: MATCH + Timer + Round — ~22% width, matching the KPNP layout */}
        <div className="flex flex-col items-center justify-center relative" style={{ flex: '0 0 22%', background: 'hsl(224 35% 3%)', order: 2 }}>
          {/* MATCH header above timer — bold & clear */}
          <div className="mb-3 px-5 py-2 rounded-xl text-center" style={{
            background: 'linear-gradient(180deg, hsl(45 93% 58% / 0.12), hsl(45 93% 58% / 0.02))',
            border: '2px solid hsl(45 93% 58% / 0.4)',
            boxShadow: '0 0 22px hsl(45 93% 58% / 0.18), inset 0 0 12px hsl(45 93% 58% / 0.08)',
          }}>
            <div className="font-display font-black text-white tracking-[0.3em] leading-none" style={{
              fontSize: 'clamp(20px, 1.8vw, 32px)',
              textShadow: '0 0 10px rgba(0,0,0,0.6)',
            }} >{t('match')}</div>
            <div className="font-display font-black leading-none mt-1" style={{
              fontSize: 'clamp(44px, 5vw, 88px)',
              color: 'hsl(45 93% 58%)',
              textShadow: '0 0 22px hsl(45 93% 58% / 0.6), 0 2px 0 rgba(0,0,0,0.4)',
            }}>
              #{state.matchNumber || '---'}
            </div>
          </div>
          {/* Timer (or PTG announcement replacing the timer) */}
          {ptgActive ? (
            <div className="rounded-xl px-6 py-3 text-center" style={{
              background: ptgAnimation ? (ptgFlash ? 'hsl(0 0% 0%)' : 'hsl(45 93% 58%)') : 'hsl(0 0% 0%)',
              border: '3px solid hsl(45 93% 58%)',
              boxShadow: '0 0 40px hsl(45 93% 58% / 0.7), inset 0 0 20px hsl(45 93% 58% / 0.25)',
              transition: 'background 60ms linear',
              minWidth: 'clamp(180px, 14vw, 320px)',
            }}>
              <div className="font-display font-black leading-none tracking-tight" style={{
                fontSize: 'clamp(60px, 7vw, 120px)',
                color: ptgAnimation && !ptgFlash ? 'hsl(0 0% 0%)' : 'hsl(45 93% 58%)',
                textShadow: (!ptgAnimation || ptgFlash) ? '0 0 30px hsl(45 93% 58% / 0.8)' : 'none',
              }}>PTG</div>
              <div className="font-display font-black mt-1 tracking-[0.35em]" style={{
                fontSize: 'clamp(10px, 0.9vw, 16px)',
                color: ptgAnimation && !ptgFlash ? 'hsl(0 0% 0%)' : 'hsl(45 93% 58%)',
              }} >{t('broadcastPointGap')}</div>
            </div>
          ) : (
            <div className="rounded-xl px-5 py-2" style={{
              background: isTimeout ? 'hsl(45 93% 58%)' : 'transparent',
              border: isTimeout ? '3px solid hsl(45 93% 40%)' : '2px solid hsl(45 93% 58% / 0.35)',
              boxShadow: isTimeout ? '0 0 24px hsl(45 93% 58% / 0.5)' : 'none',
            }}>
              <div className="sb-timer font-display font-black leading-none text-center" style={{
                fontSize: isLast10 ? 'clamp(32px, 5vw, 56px)' : 'clamp(40px, 6vw, 64px)',
                color: isTimeout ? 'hsl(0 0% 0%)' : timerStateColor,
                textShadow: isTimeout ? 'none' : isLast30 || isLast10 ? `0 0 20px ${timerStateColor}` : undefined,
                animation: isLast5 ? 'pulseScore 0.5s ease-in-out infinite' : 'none',
              }}>
                {timerDisplay}
              </div>
            </div>
          )}

          {/* TIME OUT */}
          {isTimeout && (
            <div className="mt-2 px-3 py-1 rounded animate-pulse" style={{ background: 'hsl(38 92% 50% / 0.12)', border: '1px solid hsl(38 92% 50% / 0.3)' }}>
              <span className="font-display text-[10px] font-bold" style={{ color: 'hsl(38 92% 50%)' }} >{t('broadcastTimeOut')}</span>
            </div>
          )}

          {/* Round */}
          <div className="mt-3 rounded-lg px-5 py-1.5" style={{ background: 'hsl(217 91% 60% / 0.08)' }}>
            <div className="text-white/15 font-display text-[8px] text-center tracking-[0.3em]" >{t('broadcastRound')}</div>
            <div className="font-display text-3xl text-center font-bold" style={{ color: 'hsl(217 91% 60%)' }}>{currentRound}</div>
          </div>

          {/* FIGHT indicator (live) — GREEN */}
          {status === 'fighting' && (
            <div className="sb-fight-badge mt-3 flex items-center gap-2 px-4 py-1.5 rounded-full" style={{
              background: 'hsl(142 71% 38%)',
              boxShadow: '0 0 18px hsl(142 71% 45% / 0.7)',
              border: '2px solid hsl(142 71% 65%)',
              animation: 'pulseScore 1.2s ease-in-out infinite',
            }}>
              <div className="w-2.5 h-2.5 rounded-full bg-white" style={{ animation: 'pulseScore 0.8s ease-in-out infinite' }} />
              <span className="font-display font-black text-white tracking-[0.3em]" style={{ fontSize: 'clamp(13px, 1vw, 18px)' }}>{sb.fightText}</span>
            </div>
          )}

          {/* Round-win indicators — BOTTOM, enlarged, with R labels */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
            <div className="font-display text-[9px] text-white/40 tracking-[0.35em]">ROUND WINS</div>
            <div className="flex gap-2.5">
              {Array.from({ length: config.rounds }, (_, i) => {
                const rw = state.roundWinners.find(r => r.round === i + 1);
                const c = rw?.winner === 'chung' ? 'hsl(217 91% 55%)' : rw?.winner === 'hong' ? 'hsl(0 72% 51%)' : 'hsl(224 24% 18%)';
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <div className="rounded-full border-2 flex items-center justify-center" style={{
                      width: 32, height: 32,
                      background: c,
                      borderColor: rw ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)',
                      boxShadow: rw ? `0 0 14px ${c}` : 'none',
                    }}>
                      <span className="font-display text-[10px] font-black text-white">
                        {rw?.winner === 'chung' ? '🔵' : rw?.winner === 'hong' ? '🔴' : ''}
                      </span>
                    </div>
                    <span className="font-display text-[9px] text-white/40 font-bold">R{i + 1}</span>
                  </div>
                );
              })}
            </div>
            {/* Round-win tally — framed scoreboard look */}
            <div className="flex items-stretch gap-0 mt-2 rounded-lg overflow-hidden" style={{
              border: '2px solid rgba(255,255,255,0.25)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
            }}>
              <div className="flex flex-col items-center justify-center px-3 py-1" style={{ background: 'hsl(217 91% 50%)', minWidth: 'clamp(36px, 3vw, 56px)' }}>
                <span className="font-display font-black text-white tabular-nums leading-none" style={{ fontSize: 'clamp(20px, 1.8vw, 32px)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{chungRoundWins}</span>
              </div>
              <div className="flex items-center justify-center px-1.5" style={{ background: 'hsl(224 35% 8%)' }}>
                <span className="font-display text-white/45 font-black" style={{ fontSize: 'clamp(14px, 1.1vw, 20px)' }}>:</span>
              </div>
              <div className="flex flex-col items-center justify-center px-3 py-1" style={{ background: 'hsl(0 72% 45%)', minWidth: 'clamp(36px, 3vw, 56px)' }}>
                <span className="font-display font-black text-white tabular-nums leading-none" style={{ fontSize: 'clamp(20px, 1.8vw, 32px)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{hongRoundWins}</span>
              </div>
            </div>
          </div>
        </div>

        {/* HONG Score Panel — ~39% width, matching the KPNP FOB scoreboard proportions */}
        <div className="sb-side-hong flex flex-col items-center justify-center relative" style={{ flex: '0 0 39%', background: 'hsl(0 72% 45%)', order: 1 }}>
          {/* Team/club emblem (Par Équipe only) — same as CHUNG side; never
              rendered when no logo is set. */}
          {config.competitionMode === 'par_equipe' && (state.teamLogos?.hong || state.clubLogos?.hong) && (
            <div className="rounded-2xl p-2 mb-3 flex items-center justify-center" style={{
              background: 'rgba(255,255,255,0.92)',
              boxShadow: '0 0 30px rgba(0,0,0,0.35)',
              width: 'clamp(72px, 8vw, 140px)', height: 'clamp(72px, 8vw, 140px)',
            }}>
              <img src={state.teamLogos?.hong || state.clubLogos?.hong} alt=""
                className="max-w-full max-h-full object-contain rounded-xl"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
          {/* Single-frame score — decluttered */}
          <div className="rounded-2xl px-6 md:px-10 py-2 md:py-4 flex items-center justify-center" style={{
            border: '2px solid rgba(255,255,255,0.5)',
            background: 'rgba(0,0,0,0.22)',
            boxShadow: '0 0 30px rgba(0,0,0,0.35), inset 0 0 20px rgba(0,0,0,0.35)',
          }}>
            <div className="sb-score-hong font-display font-black text-white leading-none select-none" style={{
              fontSize: 'clamp(90px, 18vw, 240px)',
              textShadow: hongFlash ? '0 0 60px hsl(45 93% 58%), 0 0 100px hsl(45 93% 58% / 0.8), 0 4px 40px rgba(0,0,0,0.5)' : '0 4px 40px rgba(0,0,0,0.5)',
              transform: hongFlash ? 'scale(1.12)' : 'scale(1)',
              transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), text-shadow 0.25s ease',
              animation: hongFlash ? 'pulseScore 0.3s ease-in-out' : 'none',
            }}>
              {displayHong}
            </div>
          </div>

          {/* Hit breakdown chips — top-right (real equipment photos) */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
            {(['punch', 'body', 'head'] as const).map((k) => (
              <HitStatChip key={k} kind={k} side="hong" count={hongHits[k]} pulseKey={hitPulse.hong[k] || 0} reverse size={displaySettings.hitIconSize} />
            ))}
          </div>

          {/* RED VIDEO REPLAY — one visible card per configured quota. */}
          <VideoReplayQuota quota={hong.ivrQuota} totalQuota={state.config?.ivrQuota ?? hong.ivrQuota} side="hong" />


          {/* Per-round scores — framed boxes at very bottom */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            {hong.scores.slice(0, config.rounds).map((s, i) => {
              const active = i === currentRound - 1;
              const bw = displaySettings.roundBoxBorder;
              return (
                <div key={i} className={`${active ? 'sb-round-active' : ''} rounded-lg flex flex-col items-center justify-center transition-all`} style={{
                  minWidth: 'clamp(54px, 4.5vw, 88px)',
                  padding: 'clamp(4px, 0.4vw, 8px) clamp(8px, 0.7vw, 14px)',
                  background: active ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
                  border: `${active ? bw + 1 : bw}px solid ${active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)'}`,
                  boxShadow: active ? '0 0 22px rgba(255,255,255,0.35), inset 0 0 14px rgba(0,0,0,0.45)' : 'inset 0 0 8px rgba(0,0,0,0.3)',
                }}>
                  <div className="font-display font-bold text-white/80 tracking-widest" style={{ fontSize: 'clamp(9px, 0.7vw, 12px)' }}>R{i + 1}</div>
                  <div className="font-display font-black text-white leading-none tabular-nums" style={{ fontSize: 'clamp(20px, 1.8vw, 32px)' }}>{s.total}</div>
                </div>
              );
            })}
          </div>

          {/* Gamjeom dots — above round scores */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-lg" style={{ bottom: 'clamp(70px, 6vw, 110px)', background: 'rgba(0,0,0,0.4)' }}>
            <span className="text-white/70 font-display font-bold tracking-widest" style={{ fontSize: 'clamp(10px, 0.75vw, 13px)' }}>GAM</span>
            {Array.from({ length: Math.min(config.gamjeomLimit, 10) }, (_, i) => (
              <div key={i} className="rounded-full border-2" style={{
                width: 'clamp(14px, 1.1vw, 22px)', height: 'clamp(14px, 1.1vw, 22px)',
                background: i < getGamjeomForRound('hong') ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.08)',
                borderColor: i < getGamjeomForRound('hong') ? 'hsl(38 92% 65%)' : 'rgba(255,255,255,0.2)',
                boxShadow: i < getGamjeomForRound('hong') ? '0 0 10px hsl(38 92% 50%)' : 'none',
              }} />
            ))}
          </div>

          {/* Action flash — slides from right side, positioned above gamjeom+round boxes */}
          {recentAction?.player === 'hong' && (
            <div className="absolute right-6" style={{ bottom: 'clamp(140px, 11vw, 180px)', animation: 'hitSlideRight 0.5s ease-out', zIndex: 15 }}>
              <div className="px-5 py-2.5 rounded-lg text-white font-display font-black"
                style={{ fontSize: 'clamp(14px, 1.2vw, 20px)', background: 'rgba(0,0,0,0.65)', border: '2px solid rgba(255,255,255,0.55)', boxShadow: '0 0 24px hsl(0 72% 51% / 0.7)' }}>
                {getHitLabel(recentAction.type)} +{recentAction.points}
              </div>
            </div>
          )}
        </div>

        {/* ZONE 3: Central action overlay (hit type flash) */}
        {recentAction && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
            <div className="px-8 py-4 rounded-2xl" style={{
              background: recentAction.player === 'chung' ? 'hsl(217 91% 55% / 0.15)' : 'hsl(0 72% 51% / 0.15)',
              backdropFilter: 'blur(4px)',
              animation: 'actionFlash 0.5s ease-out',
            }}>
              <div className="font-display text-2xl font-black text-white text-center" style={{
                textShadow: `0 0 20px ${recentAction.player === 'chung' ? 'hsl(217 91% 55%)' : 'hsl(0 72% 51%)'}`,
              }}>
                {getHitLabel(recentAction.type)}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        /* Mini public preview must stay inside the referee preview frame. Any
           fixed descendant becomes local/absolute so no public animation or
           scoreboard layer can escape and cover the Main Referee controls. */
        .public-scoreboard-mini { position: absolute !important; inset: 0 !important; overflow: hidden !important; }
        .public-scoreboard-mini .fixed { position: absolute !important; }
        .public-scoreboard-mini .fixed.inset-0 { inset: 0 !important; }
        @keyframes actionFlash { 0%{transform:scale(1.5);opacity:0} 30%{transform:scale(1);opacity:1} 100%{opacity:0.7} }
        @keyframes actionPop { 0%{transform:translateY(10px) scale(0.8);opacity:0} 100%{transform:translateY(0) scale(1);opacity:1} }
        @keyframes frameEnter { 0%{opacity:0;transform:scale(0.985)} 100%{opacity:1;transform:scale(1)} }
        @keyframes hitSlideLeft { 0%{transform:translateX(-60px) scale(0.7);opacity:0} 40%{transform:translateX(0) scale(1.1);opacity:1} 100%{transform:translateX(0) scale(1);opacity:1} }
        @keyframes hitSlideRight { 0%{transform:translateX(60px) scale(0.7);opacity:0} 40%{transform:translateX(0) scale(1.1);opacity:1} 100%{transform:translateX(0) scale(1);opacity:1} }
      `}</style>
    </div>
  );
}

export default function PublicScoreboard(props: {isMiniPreview?:boolean}={}){useBroadcastViewport(!props.isMiniPreview);const displayId=React.useMemo(()=>{try{return Number(new URLSearchParams(window.location.search).get('displayId'))||undefined}catch{return undefined}},[]);const[mode,setMode]=useState(()=>getBroadcastDisplayConfig(displayId).mode);useEffect(()=>{const sync=()=>setMode(getBroadcastDisplayConfig(displayId).mode);window.addEventListener('storage',sync);window.addEventListener('wab-display-config-changed',sync);const id=window.setInterval(sync,500);return()=>{window.removeEventListener('storage',sync);window.removeEventListener('wab-display-config-changed',sync);clearInterval(id);};},[displayId]);if(!props.isMiniPreview&&isPublicDisplayWindow()&&(mode==='mat_announcer'||mode==='upcoming'))return <MatBroadcastScreen displayId={displayId} mode={mode}/>;return <ScoreboardView {...props}/>;}
