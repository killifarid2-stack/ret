import React from 'react';
import type { MatchState, PlayerColor } from '@/types/tkd';
import { MATCH_STAGE_LABELS, COMPETITION_MODE_LABELS } from '@/types/tkd';
import { formatTime } from '@/lib/match-engine';
import FlagImage from './FlagImage';
import { ClipboardCheck, Clock, Cpu, MapPin, Scale, ShieldCheck, Swords, Trophy, User, Users } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { PlayerName } from './broadcast-new/PlayerName';

type Props = { state: MatchState };

const StatBox = ({
  icon,
  label,
  value,
  delay = 0,
  connection = false,
  alertWhenDisconnected = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  delay?: number;
  connection?: boolean;
  alertWhenDisconnected?: boolean;
}) => {
  const isAlert = alertWhenDisconnected && !connection;
  const color = connection ? '#39ff6a' : isAlert ? '#ff4655' : 'white';
  const labelColor = connection ? '#39ff6a' : isAlert ? '#ff6875' : '#d8bd72';

  return (
    <div
      className="flex-1 min-w-[110px] px-3 py-2.5 rounded-lg text-center"
      style={{
        background: connection ? 'rgba(57,255,106,.12)' : isAlert ? 'rgba(255,55,70,.12)' : 'rgba(20,24,35,.72)',
        border: connection ? '1px solid rgba(57,255,106,.5)' : isAlert ? '1px solid rgba(255,55,70,.5)' : '1px solid rgba(75,82,105,.55)',
        boxShadow: connection ? '0 0 18px rgba(57,255,106,.2)' : isAlert ? '0 0 18px rgba(255,55,70,.2)' : undefined,
        backdropFilter: 'blur(4px)',
        animation: 'nextStatIn .45s ease-out both',
        animationDelay: `${delay}s`,
      }}
    >
      <div
        className="flex items-center justify-center gap-1.5 text-[9px] md:text-[10px] font-display tracking-widest uppercase"
        style={{ color: labelColor }}
      >
        {(connection || isAlert) && (
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: color, animation: connection ? 'nextLivePulse 1.6s ease-out infinite' : undefined }}
          />
        )}
        {icon} {label}
      </div>
      <div className="font-display font-black mt-1" style={{ fontSize: 'clamp(14px,1.6vw,22px)', color }}>
        {value}
      </div>
    </div>
  );
};

function PlayerCard({ side, player, state }: {
  side: PlayerColor;
  player: MatchState['chung']['player'];
  state: MatchState;
}) {
  const { t } = useI18n();
  const isBlue = side === 'chung';
  const color = isBlue ? '#33a2ff' : '#ff2b39';
  const teamName = state.teamNames?.[side] || (isBlue ? 'BLUE TEAM' : 'RED TEAM');
  const teamLogo = state.teamLogos?.[side] || player.teamLogo || '';
  const clubLogo = state.clubLogos?.[side] || player.clubLogo || '';
  const hasHero = !!(teamLogo || clubLogo);
  const photo = player.photoUrl || player.photo || '';

  return (
    <div
      className="flex flex-col items-center w-full"
      style={{ animation: `${isBlue ? 'nextPlayerBlue' : 'nextPlayerRed'} .7s cubic-bezier(.16,1,.3,1) both` }}
    >
      {hasHero ? (
        <div className="relative z-20" style={{ marginBottom: 'clamp(-40px,-4vw,-28px)' }}>
          <div className="absolute inset-0 rounded-full blur-2xl pointer-events-none" style={{ background: color, opacity: .5, transform: 'scale(1.3)' }} />
          <div className="relative" style={{ height: 'clamp(96px,11vw,168px)', width: 'clamp(96px,11vw,168px)' }}>
            <img
              src={teamLogo || clubLogo}
              alt=""
              className="w-full h-full rounded-2xl object-cover"
              style={{
                border: `3px solid ${color}`,
                boxShadow: `0 0 32px ${color}99, 0 0 64px ${color}59, 0 6px 18px rgba(0,0,0,.55)`,
                animation: 'nextCardGlow 2.2s ease-in-out infinite',
              }}
            />
            {clubLogo && teamLogo && clubLogo !== teamLogo && (
              <img
                src={clubLogo}
                alt=""
                className="absolute rounded-full object-cover bg-black"
                style={{ width: '38%', height: '38%', bottom: '-8%', right: '-8%', border: `2px solid ${color}` }}
              />
            )}
          </div>
        </div>
      ) : photo ? (
        <div className="relative z-20" style={{ marginBottom: 'clamp(-40px,-4vw,-28px)' }}>
          <div className="absolute inset-0 rounded-full blur-2xl pointer-events-none" style={{ background: color, opacity: .5, transform: 'scale(1.3)' }} />
          <img
            src={photo}
            alt={player.name || ''}
            className="relative rounded-2xl object-cover"
            style={{
              height: 'clamp(96px,11vw,168px)',
              width: 'clamp(96px,11vw,168px)',
              border: `3px solid ${color}`,
              boxShadow: `0 0 32px ${color}99, 0 0 64px ${color}59, 0 6px 18px rgba(0,0,0,.55)`,
              animation: 'nextCardGlow 2.2s ease-in-out infinite',
            }}
          />
        </div>
      ) : null}

      <div
        className="flex-1 max-w-sm w-full rounded-2xl p-4 md:p-5 relative overflow-hidden"
        style={{
          border: `2px solid ${color}`,
          background: 'linear-gradient(180deg,rgba(15,19,30,.94),rgba(7,9,15,.94))',
          boxShadow: `0 0 40px ${color}59, 0 0 90px ${color}33, inset 0 0 34px ${color}1a`,
          paddingTop: hasHero || photo ? 'clamp(52px,6.5vw,76px)' : undefined,
          animation: 'nextCardGlow 2.2s ease-in-out infinite',
        }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-0 bottom-0 w-1/3"
            style={{
              background: `linear-gradient(90deg,transparent,${color}38,transparent)`,
              animation: `nextLightSweep ${isBlue ? '3.4s' : '3.9s'} ease-in-out infinite`,
              animationDelay: isBlue ? '0s' : '1.1s',
            }}
          />
        </div>

        {player.nationality && (
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none">
            <FlagImage code={player.nationality} size={200} className="w-full h-40 object-cover" />
          </div>
        )}

        <div className="relative">
          {state.teamMode === 'rotation' && teamName && (
            <div
              className="text-center font-display font-black uppercase tracking-wide mb-2 px-2 py-1 rounded-lg truncate"
              style={{
                fontSize: 'clamp(14px,1.8vw,22px)',
                color: 'white',
                background: `${color}38`,
                border: `1px solid ${color}99`,
                textShadow: `0 0 12px ${color}`,
              }}
            >
              {teamName}
            </div>
          )}

          <div className="text-center text-[10px] md:text-xs font-display font-bold tracking-[.25em] mb-3" style={{ color }}>
            {isBlue ? 'CHUNG (청)' : 'HONG (홍)'}
          </div>

          {player.nationality && (
            <div className="flex justify-center mb-2">
              <FlagImage code={player.nationality} size={40} className="w-10 h-7 rounded shadow-lg" />
            </div>
          )}

          <div
            className="text-center font-display font-black leading-tight mb-4 break-words"
            style={{
              fontSize: (player.name || '').length > 24 ? 'clamp(14px,2vw,20px)' : (player.name || '').length > 18 ? 'clamp(16px,2.3vw,24px)' : 'clamp(20px,3vw,34px)',
              minHeight: 'clamp(26px,3.6vw,40px)',
              color: 'white',
              textShadow: `0 0 12px ${color},0 0 28px ${color}99,0 2px 6px rgba(0,0,0,.5)`,
            }}
          >
            <PlayerName name={player.name || '—'} format={(state.callDisplayConfig?.nameFormat || 'full') as any} />
          </div>

          {player.club && (
            <div className="flex justify-center mb-2 px-1">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full max-w-full" style={{ background: `${color}29`, border: `1.5px solid ${color}b3` }}>
                <ShieldCheck size={14} style={{ color }} />
                <span className="font-display font-black uppercase tracking-wide break-words text-center" style={{ fontSize: 'clamp(13px,1.5vw,19px)', color: 'white' }}>
                  {player.club}
                </span>
              </div>
            </div>
          )}

          {player.nationality && (
            <div className="text-center text-[11px] md:text-xs text-white/50 tracking-wide mb-3">{player.nationality}</div>
          )}

          {(player.seedNumber != null || player.playerNumber != null) && (
            <div className="flex gap-2 mt-2">
              <div className="flex-1 text-center rounded-lg py-1.5" style={{ background: 'rgba(18,23,35,.82)' }}>
                <div className="text-[8px] text-white/35 tracking-widest">{t('broadcastSeed')}</div>
                <div className="font-display font-bold text-white text-sm">{player.seedNumber ?? '—'}</div>
              </div>
              <div className="flex-1 text-center rounded-lg py-1.5" style={{ background: 'rgba(18,23,35,.82)' }}>
                <div className="text-[8px] text-white/35 tracking-widest">{t('broadcastPlayerNumber')}</div>
                <div className="font-display font-bold text-white text-sm">{player.playerNumber ?? '—'}</div>
              </div>
            </div>
          )}

          {state.teamMode === 'rotation' && state.teamRoster?.[side]?.length ? (
            <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${color}4d` }}>
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                {[...state.teamRoster[side]]
                  .sort((a, b) => (a.playerNumber ?? a.seedNumber ?? 0) - (b.playerNumber ?? b.seedNumber ?? 0))
                  .map((p, i) => (
                    <span key={i} className="font-display text-[10px] md:text-xs text-white/70 bg-black/20 rounded px-1.5 py-0.5">
                      {p.name}
                    </span>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function NextOnMatchOverlay({ state }: Props) {
  const { t, lang } = useI18n();
  const stageLabel = state.matchStage ? MATCH_STAGE_LABELS[state.matchStage]?.[lang] || MATCH_STAGE_LABELS[state.matchStage]?.en || MATCH_STAGE_LABELS[state.matchStage]?.ar : null;
  const ageLabel = state.ageGroup ? state.ageGroup.replace(/_/g, ' ') : null;
  const modeLabel = state.config.competitionMode ? COMPETITION_MODE_LABELS[state.config.competitionMode]?.[lang] || COMPETITION_MODE_LABELS[state.config.competitionMode]?.en || COMPETITION_MODE_LABELS[state.config.competitionMode]?.ar : null;

  return (
    <div
      className="wab-broadcast-layer fixed inset-0 flex flex-col overflow-hidden pointer-events-none"
      style={{
        background: `
          radial-gradient(ellipse 60% 80% at 0% 100%, rgba(51,162,255,.28), transparent 60%),
          radial-gradient(ellipse 60% 80% at 100% 100%, rgba(255,43,57,.28), transparent 60%),
          linear-gradient(180deg,#0b101c,#05070c 60%)
        `,
      }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: .45 }}>
        <div className="absolute inset-x-0 top-0 h-[46%]" style={{
          background: 'repeating-linear-gradient(180deg,rgba(32,38,53,.9) 0px,rgba(32,38,53,.9) 3px,rgba(18,22,32,.9) 3px,rgba(18,22,32,.9) 9px)',
          maskImage: 'linear-gradient(180deg,black 0%,black 55%,transparent 100%)',
          WebkitMaskImage: 'linear-gradient(180deg,black 0%,black 55%,transparent 100%)',
        }} />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(200deg,rgba(255,216,102,.10) 0%,transparent 30%),linear-gradient(160deg,rgba(255,216,102,.08) 0%,transparent 26%),linear-gradient(180deg,rgba(255,216,102,.06) 0%,transparent 22%)',
        }} />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-4 px-6 md:px-12 pt-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-11 h-11 md:w-14 md:h-14 rounded-xl border border-[#f2c14e]/30 bg-black/30 flex items-center justify-center font-display font-black text-[#f2c14e]">TK</div>
          <div className="hidden sm:block leading-tight">
            <div className="font-display font-black text-white/90 tracking-wider text-sm">WAB-TKD</div>
            <div className="text-[8px] text-white/35 tracking-[.15em] uppercase">{t('broadcastScoringSystem')}</div>
          </div>
        </div>
        <div className="text-center flex-1">
          <div className="font-display font-black tracking-[.1em]" style={{ fontSize: 'clamp(20px,2.8vw,42px)', color: '#f5d477', textShadow: '0 0 14px #f2c14ecc,0 0 34px #f2c14e66' }}>
            {state.competitionName || 'WAB-TKD'}
          </div>
          {(state.eventDate || state.eventLocation) && (
            <div className="text-[10px] md:text-xs text-white/40 font-display tracking-[.2em] uppercase mt-1">
              {[state.eventDate, state.eventLocation].filter(Boolean).join(' | ')}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block leading-tight text-right">
            <div className="font-display font-black text-white/90 tracking-wider text-sm">WORLD ARENA</div>
            <div className="text-[8px] text-white/35 tracking-[.15em] uppercase">{lang === 'ar' ? 'البث' : 'Broadcast'}</div>
          </div>
          <div className="w-11 h-11 md:w-14 md:h-14 rounded-xl border border-[#f2c14e]/30 bg-black/30 flex items-center justify-center font-display font-black text-[#f2c14e]">TK</div>
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap justify-center gap-2 px-6 mt-4 mb-4 shrink-0">
        {modeLabel && <StatBox icon={<Swords size={11} />} label={lang === 'ar' ? 'النوع' : 'Type'} value={modeLabel} delay={.12} />}
        <StatBox icon={<MapPin size={11} />} label={lang === 'ar' ? 'رقم البساط' : 'MAT NO.'} value={state.matNumber ? `MAT ${String(state.matNumber).padStart(2, '0')}` : 'MAT 01'} delay={.145} />
        {state.matchNumber != null && <StatBox icon={<Swords size={11} />} label={t('match')} value={state.matchNumber} delay={.17} />}
        <StatBox icon={<Trophy size={11} />} label={t('broadcastRound')} value={`${state.currentRound} / ${state.config.rounds}`} delay={.18} />
        {state.weightCategory && <StatBox icon={<Scale size={11} />} label={lang === 'ar' ? 'الوزن' : 'Weight'} value={state.weightCategory} delay={.20} />}
        {ageLabel && <StatBox icon={<User size={11} />} label={lang === 'ar' ? 'العمر' : 'Age'} value={ageLabel} delay={.22} />}
        {state.gender && <StatBox label={lang === 'ar' ? 'الجنس' : 'Gender'} value={state.gender === 'male' ? (lang === 'ar' ? 'رجال' : 'MEN') : (lang === 'ar' ? 'نساء' : 'WOMEN')} delay={.25} />}
        {stageLabel && <StatBox icon={<Trophy size={11} />} label={lang === 'ar' ? 'المرحلة' : 'Stage'} value={stageLabel} delay={.28} />}
      </div>

      <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center gap-4 md:gap-8 px-4 md:px-10">
        <div className="flex-1 max-w-sm" style={{ order: 3 }}>
          <PlayerCard side="chung" player={state.chung.player} state={state} />
        </div>

        <div className="flex flex-col items-center shrink-0 px-2 relative" style={{ order: 2, animation: 'nextCenterIn .7s ease-out both', animationDelay: '.45s' }}>
          <div className="relative flex items-center justify-center" style={{ width: 'clamp(100px,10vw,148px)', height: 'clamp(100px,10vw,148px)' }}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/2 top-1/2 w-3 h-full -translate-x-1/2 -translate-y-1/2" style={{ background: 'linear-gradient(180deg,transparent,rgba(51,162,255,.55),transparent)', transform: 'rotate(20deg)', animation: 'nextPulse 2s ease-in-out infinite' }} />
              <div className="absolute left-1/2 top-1/2 w-3 h-full -translate-x-1/2 -translate-y-1/2" style={{ background: 'linear-gradient(180deg,transparent,rgba(255,43,57,.55),transparent)', transform: 'rotate(-20deg)', animation: 'nextPulse 2s ease-in-out infinite 1s' }} />
            </div>
            <div className="font-display font-black relative z-10" style={{ fontSize: 'clamp(40px,6.5vw,92px)', fontStyle: 'italic', color: 'white', textShadow: '-9px 2px 26px rgba(51,162,255,.95),9px 2px 26px rgba(255,43,57,.95),0 0 60px rgba(255,255,255,.4)', animation: 'nextVsPulse 1.6s ease-in-out infinite' }}>
              VS
            </div>
          </div>
          <div className="font-display font-black tracking-[.35em] uppercase mt-2 whitespace-nowrap relative" style={{ fontSize: 'clamp(12px,1.4vw,18px)', color: '#f5d477', textShadow: '0 0 14px #f2c14ea6,0 0 30px #f2c14e4d' }}>
            {lang === 'ar' ? 'المباراة القادمة' : 'Next On The Match'}
          </div>
          <div className="w-24 md:w-32 border-t border-dashed border-white/15 mt-2" />
          <div className="mt-4 rounded-xl px-4 py-2 text-center" style={{ background: 'rgba(2,6,13,.96)', border: '1px solid rgba(255,216,102,.45)', boxShadow: '0 0 20px rgba(255,200,60,.10)' }}>
            <div className="font-display text-[9px] text-white/45 tracking-[.22em]">{t('broadcastMatchTime')}</div>
            <div className="font-display font-black text-[#ffd866] leading-none mt-1" style={{ fontSize: 'clamp(28px,3vw,48px)' }}>{formatTime(state.config.roundTime)}</div>
          </div>
          <div className="mt-3 rounded-xl px-4 py-2.5 text-center" style={{ background: 'linear-gradient(180deg,rgba(255,216,102,.10),rgba(0,0,0,.82))', border: '1.5px solid rgba(255,216,102,.62)', boxShadow: '0 0 24px rgba(255,200,60,.12)' }}>
            <div className="font-display font-black text-[#ffd866]" style={{ fontSize: 'clamp(13px,1.25vw,19px)' }}>{t('broadcastPlayerCall')}</div>
            <div className="font-display text-[9px] text-white/45 mt-1 tracking-wider"><PlayerName name={state.chung.player.name || 'BLUE'} format={(state.callDisplayConfig?.nameFormat || 'full') as any} /> &nbsp; VS &nbsp; <PlayerName name={state.hong.player.name || 'RED'} format={(state.callDisplayConfig?.nameFormat || 'full') as any} /></div>
          </div>
        </div>

        <div className="flex-1 max-w-sm" style={{ order: 1 }}>
          <PlayerCard side="hong" player={state.hong.player} state={state} />
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap justify-center gap-2 px-6 py-4 shrink-0" style={{ borderTop: '1px solid rgba(75,82,105,.45)', background: 'rgba(10,13,22,.72)' }}>
        <StatBox icon={<Users size={11} />} label="Judges Present" value={`${state.connectedJudgeCount ?? 0}/${state.config.judgeCount}`} connection={(state.connectedJudgeCount ?? 0) > 0} alertWhenDisconnected delay={.55} />
        <StatBox icon={<ClipboardCheck size={11} />} label="Match Status" value={lang === 'ar' ? 'جاهز' : 'READY'} delay={.58} />
        <StatBox icon={<Clock size={11} />} label="Round Time" value={formatTime(state.config.roundTime)} delay={.61} />
        <StatBox icon={<Cpu size={11} />} label="System Status" value={lang === 'ar' ? 'يعمل' : 'OPERATIONAL'} connection delay={.64} />
        <StatBox icon={<ShieldCheck size={11} />} label="Referee Connected" value={lang === 'ar' ? 'نعم' : 'YES'} connection delay={.67} />
      </div>

      <style>{`
        @keyframes nextPlayerRed { from{opacity:0;transform:translateX(70px)} to{opacity:1;transform:translateX(0)} }
        @keyframes nextPlayerBlue { from{opacity:0;transform:translateX(-70px)} to{opacity:1;transform:translateX(0)} }
        @keyframes nextCenterIn { from{opacity:0;transform:scale(.75)} to{opacity:1;transform:scale(1)} }
        @keyframes nextStatIn { from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes nextCardGlow { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.12)} }
        @keyframes nextLightSweep { 0%,82%,100%{left:-40%;opacity:0} 6%{opacity:1} 38%{left:110%;opacity:0} }
        @keyframes nextPulse { 0%,100%{opacity:.7} 50%{opacity:1} }
        @keyframes nextVsPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
        @keyframes nextLivePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.8)} }
      `}</style>
    </div>
  );
}
