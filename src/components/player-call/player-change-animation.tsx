import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import appIconUrl from '@/assets/app-icon.png'
import type { ChangeSide, RosterPlayer, TeamSide } from '@/lib/player-call/match-types'
import type { NameFormat } from '@/lib/playerName'
import { PlayerName } from '@/components/broadcast-new/PlayerName'
import playerChangeBlueUrl from '@/assets/player-change/player-change-blue.png'
import playerChangeRedUrl from '@/assets/player-change/player-change-red.png'

export type ChangePhase = 'current' | 'energy' | 'out' | 'in' | 'confirm' | 'done'

const PHASE_DURATION: Record<Exclude<ChangePhase, 'done'>, number> = {
  current: 1200,
  energy: 700,
  out: 820,
  in: 980,
  confirm: 1550,
}

const PHASES: Exclude<ChangePhase, 'done'>[] = ['current', 'energy', 'out', 'in', 'confirm']

const THEME = {
  BLUE: { accent: '#33a2ff', glow: 'rgba(51,162,255,0.72)', soft: 'rgba(51,162,255,0.20)' },
  RED: { accent: '#ff2b39', glow: 'rgba(255,43,57,0.72)', soft: 'rgba(255,43,57,0.20)' },
} as const

const GOLD = '#f2c14e'

type SharedTeamInfo = {
  name?: string
  logo?: string
  club?: string
  country?: string
}

export type PlayerChangeAnimationProps = {
  visible: boolean
  side: ChangeSide
  oldPlayer?: RosterPlayer | null
  newPlayer?: RosterPlayer | null
  oldRedPlayer?: RosterPlayer | null
  newRedPlayer?: RosterPlayer | null
  onComplete?: () => void
  onCue?: (cue: 'transition' | 'player-out' | 'player-in' | 'confirm') => void
  reducedMotion?: boolean
  tournamentName?: string
  eventDate?: string
  eventLocation?: string
  matchNumber?: string | number
  roundNumber?: string | number
  tournamentType?: string
  gender?: string
  ageGroup?: string
  division?: string
  weightCategory?: string
  /** Shared team identity. Players in the same team are intentionally not duplicated. */
  teamInfo?: SharedTeamInfo
  /** Par Équipe tag/change window. The cinematic keeps its phase structure but scales to this duration. */
  tagSeconds?: number
  /** Uses the same Player Name Format selected in Team Call. */
  nameFormat?: NameFormat
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function InfoFrame({ label, value, accent = GOLD, wide = false }: { label: string; value?: string | number; accent?: string; wide?: boolean }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div
      className={`${wide ? 'min-w-[12vw]' : 'min-w-0'} relative overflow-hidden rounded-[.7vh] border bg-black/60 px-[.72vw] py-[.7vh] text-center`}
      style={{ borderColor: `${accent}55`, boxShadow: `inset 0 0 18px ${accent}0b, 0 0 18px ${accent}08` }}
    >
      <div className="absolute inset-x-[.7vw] top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="font-hud text-[.76vh] font-black uppercase tracking-[.18em]" style={{ color: `${accent}dd` }}>{label}</div>
      <div className="mt-[.3vh] truncate font-display text-[1.7vh] font-black uppercase tracking-[.035em] text-white">{value}</div>
    </div>
  )
}

function TeamIdentity({ team, accent }: { team: SharedTeamInfo; accent: string }) {
  return (
    <div className="pcx-team-frame relative mx-auto flex w-[70%] items-center justify-center gap-[1vw] overflow-hidden rounded-[1.1vh] border bg-black/65 px-[1.2vw] py-[.75vh]" style={{ borderColor: `${accent}66`, boxShadow: `inset 0 0 28px ${accent}0d, 0 0 30px ${accent}12` }}>
      {team.logo ? (
        <img src={team.logo} alt="" className="h-[5vh] w-[5vh] shrink-0 object-contain" />
      ) : null}
      <div className="min-w-0 text-left">
        <div className="font-hud text-[.9vh] font-black uppercase tracking-[.28em]" style={{ color: accent }}>PLAYER CHANGE · TEAM</div>
        <div className="truncate font-display text-[2.8vh] font-black uppercase text-white" style={{ textShadow: `0 0 20px ${accent}55` }}>{team.name || 'TEAM'}</div>
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-[.45vw]">
        <InfoFrame label="CLUB" value={team.club || '—'} accent={accent} />
        <InfoFrame label="COUNTRY" value={team.country || '—'} accent={accent} />
      </div>
    </div>
  )
}

function Portrait({ player, accent, glow }: { player: RosterPlayer; accent: string; glow: string }) {
  return (
    <div className="relative flex h-[27vh] w-full items-center justify-center">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[18vh] w-[18vh] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 68%)`, filter: 'blur(20px)' }} />
      <div className="pcx-photo-frame relative flex h-[23vh] w-[18vh] items-center justify-center overflow-hidden rounded-[1vh] border-2 bg-black/80" style={{ borderColor: `${accent}cc`, boxShadow: `0 0 22px ${glow}, inset 0 0 24px ${glow}` }}>
        {player.photo ? (
          <img src={player.photo} alt={player.fullName} className="h-full w-full select-none object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-[5vh] font-black text-white/80">{initials(player.fullName) || '—'}</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-white/10" />
        <div className="pointer-events-none absolute inset-[.45vh] border border-white/15 rounded-[.65vh]" />
      </div>
    </div>
  )
}

function PlayerCard({ player, side, status, animClass, nameFormat = 'full' }: { player: RosterPlayer; side: TeamSide; status: 'OUT' | 'IN'; animClass: string; nameFormat?: NameFormat }) {
  const theme = THEME[side]
  const isIn = status === 'IN'
  return (
    <div className={`relative flex h-full w-full flex-col items-center ${animClass}`}>
      <div className="mb-[.55vh] flex items-center gap-[.7vw] rounded-full border px-[1.3vw] py-[.45vh] font-hud text-[.85vh] font-black uppercase tracking-[.3em]" style={{ color: theme.accent, borderColor: `${theme.accent}66`, background: `${theme.accent}12`, boxShadow: `0 0 20px ${theme.soft}` }}>
        {status === 'OUT' ? 'PLAYER OUT' : 'PLAYER IN'}
      </div>

      <div className="pcx-player-card relative flex w-full max-w-[42vw] flex-col items-center rounded-[1.35vh] border bg-black/68 px-[1vw] pb-[1.1vh] pt-[.4vh]" style={{ borderColor: `${theme.accent}66`, boxShadow: `inset 0 0 35px ${theme.accent}0d, 0 0 34px ${theme.accent}12` }}>
        <Portrait player={player} accent={theme.accent} glow={theme.glow} />

        <div className="w-full rounded-[.8vh] border bg-black/55 px-[.9vw] py-[.7vh] text-center" style={{ borderColor: `${theme.accent}55` }}>
          <div className="font-display text-[3.35vh] font-black uppercase leading-none tracking-[.03em] text-white" style={{ textShadow: `0 0 18px ${theme.glow}` }}><PlayerName name={player.fullName || 'PLAYER'} format={nameFormat} /></div>
        </div>

        <div className="mt-[.7vh] grid w-full grid-cols-3 gap-[.45vw]">
          <InfoFrame label="PLAYER NO." value={player.playerNumber > 0 ? `#${player.playerNumber}` : '—'} accent={theme.accent} />
          <InfoFrame label="RANK / SEED" value={player.ranking || '—'} accent={theme.accent} />
          <InfoFrame label="COUNTRY" value={player.country || '—'} accent={theme.accent} />
          <InfoFrame label="WEIGHT" value={player.weightCategory || '—'} accent={theme.accent} />
          <InfoFrame label="WIN RATE" value={player.winRate ? `${player.winRate}%` : '—'} accent={theme.accent} />
          <InfoFrame label="PREVIOUS SCORE" value={player.previousScore || '—'} accent={theme.accent} />
        </div>
      </div>

      <div className="mt-[.65vh] h-[.3vh] w-[72%] rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`, boxShadow: `0 0 18px ${theme.accent}` }} />
      <span className="mt-[.35vh] font-hud text-[.72vh] font-black uppercase tracking-[.3em]" style={{ color: `${theme.accent}bb` }}>{isIn ? 'ACTIVE ATHLETE' : 'SUBSTITUTED ATHLETE'}</span>
    </div>
  )
}

function Sparks({ color }: { color: string }) {
  const sparks = useMemo(() => Array.from({ length: 34 }, (_, i) => ({
    id: i,
    left: 42 + Math.random() * 16,
    top: 35 + Math.random() * 30,
    dx: `${(Math.random() - 0.5) * 1100}px`,
    dy: `${(Math.random() - 0.5) * 760}px`,
    size: 2 + Math.random() * 5,
    dur: `${700 + Math.random() * 850}ms`,
    delay: `${Math.random() * 350}ms`,
  })), [])
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {sparks.map((s) => (
        <span key={s.id} className="pcx-spark absolute rounded-full" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, background: s.id % 4 === 0 ? GOLD : color, boxShadow: `0 0 16px ${s.id % 4 === 0 ? GOLD : color}`, '--dx': s.dx, '--dy': s.dy, '--dur': s.dur, animationDelay: s.delay } as CSSProperties} />
      ))}
    </div>
  )
}

function PlayerChangeArtwork({ side, phase }: { side: TeamSide; phase: ChangePhase }) {
  const src = side === 'RED' ? playerChangeRedUrl : playerChangeBlueUrl
  const accent = side === 'RED' ? THEME.RED.accent : THEME.BLUE.accent
  const phaseClass = phase === 'energy' ? 'pcx-artwork-burst' : phase === 'out' ? 'pcx-artwork-out' : phase === 'in' ? 'pcx-artwork-in' : phase === 'confirm' ? 'pcx-artwork-confirm' : 'pcx-artwork-idle'
  return (
    <div className={`pointer-events-none absolute left-1/2 top-[52%] z-[8] h-[82vh] w-[82vw] -translate-x-1/2 -translate-y-1/2 ${phaseClass}`} aria-hidden="true">
      <div className="absolute inset-[8%] rounded-full opacity-70" style={{ background: `radial-gradient(circle, ${accent}22 0%, transparent 68%)`, filter: 'blur(30px)' }} />
      <img src={src} alt="" className="relative h-full w-full object-contain select-none" style={{ filter: `drop-shadow(0 0 18px ${accent}55) drop-shadow(0 0 48px ${accent}22)` }} />
    </div>
  )
}

function EnergyBurst({ colors }: { colors: string[] }) {
  const shards = useMemo(() => Array.from({ length: 30 }, (_, i) => ({ id: i, angle: (360 / 30) * i + (i % 2 ? 3 : -3), distance: 34 + (i % 7) * 8, size: 0.55 + (i % 4) * 0.4, delay: (i % 8) * 45 })), [])
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="pcx-vignette absolute inset-0" />
      {colors.map((c, i) => <div key={c + i} className="pcx-shockwave absolute left-1/2 top-1/2 rounded-full border-2" style={{ width: `${15 + i * 9}vh`, height: `${15 + i * 9}vh`, borderColor: c, boxShadow: `0 0 65px ${c}, inset 0 0 25px ${c}`, animationDelay: `${i * 80}ms` }} />)}
      <div className="pcx-core absolute left-1/2 top-1/2 h-[32vh] w-[32vh] rounded-full" style={{ background: `radial-gradient(circle, #fff 0%, ${GOLD} 17%, ${colors[0] ?? GOLD} 46%, transparent 72%)`, filter: 'blur(6px)' }} />
      <div className="pcx-ring absolute left-1/2 top-1/2 h-[22vh] w-[22vh] rounded-full border" style={{ borderColor: `${GOLD}dd`, boxShadow: `0 0 55px ${GOLD}` }} />
      <div className="pcx-ring pcx-ring-delay absolute left-1/2 top-1/2 h-[44vh] w-[44vh] rounded-full border" style={{ borderColor: `${colors[0] ?? GOLD}99`, boxShadow: `0 0 80px ${colors[0] ?? GOLD}` }} />
      <div className="pcx-burst-cross absolute left-1/2 top-1/2 h-[2px] w-[65vw] -translate-x-1/2 -translate-y-1/2" style={{ background: `linear-gradient(90deg, transparent, #fff, ${colors[0] ?? GOLD}, #fff, transparent)`, boxShadow: `0 0 24px ${colors[0] ?? GOLD}` }} />
      <div className="pcx-burst-cross pcx-burst-cross-v absolute left-1/2 top-1/2 h-[55vh] w-[2px] -translate-x-1/2 -translate-y-1/2" style={{ background: `linear-gradient(180deg, transparent, #fff, ${GOLD}, #fff, transparent)`, boxShadow: `0 0 24px ${GOLD}` }} />
      {shards.map((s) => <span key={s.id} className="pcx-shard absolute left-1/2 top-1/2 h-[.55vh] origin-left rounded-full" style={{ width: `${s.size}vw`, background: s.id % 4 === 0 ? GOLD : colors[s.id % colors.length] ?? GOLD, boxShadow: `0 0 14px ${s.id % 4 === 0 ? GOLD : colors[s.id % colors.length] ?? GOLD}`, '--travel': `${s.distance}vw`, '--angle': `${s.angle}deg`, animationDelay: `${s.delay}ms` } as CSSProperties} />)}
      <Sparks color={colors[0] ?? GOLD} />
    </div>
  )
}

export function PlayerChangeAnimation({
  visible,
  side,
  oldPlayer,
  newPlayer,
  oldRedPlayer,
  newRedPlayer,
  onComplete,
  onCue,
  reducedMotion = false,
  tournamentName,
  eventDate,
  eventLocation,
  matchNumber,
  roundNumber,
  tournamentType,
  gender,
  ageGroup,
  division,
  weightCategory,
  teamInfo,
  tagSeconds = 5,
  nameFormat = 'full',
}: PlayerChangeAnimationProps) {
  const [phase, setPhase] = useState<ChangePhase>('done')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const cueRef = useRef(onCue)
  const completeRef = useRef(onComplete)
  cueRef.current = onCue
  completeRef.current = onComplete

  useEffect(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (!visible) { setPhase('done'); return }
    setPhase('current')
    let acc = 0
    const baseDuration = PHASES.reduce((sum, phase) => sum + PHASE_DURATION[phase], 0)
    const durationScale = Math.max(0.25, Math.min(4, (Math.max(1, tagSeconds) * 1000) / baseDuration))
    PHASES.forEach((p, i) => {
      acc += PHASE_DURATION[p] * durationScale * (reducedMotion ? 0.35 : 1)
      const next = PHASES[i + 1]
      timers.current.push(setTimeout(() => {
        if (next) {
          setPhase(next)
          if (next === 'energy') cueRef.current?.('transition')
          if (next === 'out') cueRef.current?.('player-out')
          if (next === 'in') cueRef.current?.('player-in')
          if (next === 'confirm') cueRef.current?.('confirm')
        } else {
          setPhase('done')
          completeRef.current?.()
        }
      }, acc))
    })
    return () => { timers.current.forEach(clearTimeout); timers.current = [] }
  }, [visible, reducedMotion, tagSeconds, oldPlayer?.playerId, newPlayer?.playerId, oldRedPlayer?.playerId, newRedPlayer?.playerId])

  if (!visible || phase === 'done') return null

  const isDual = side === 'DUAL'
  const bluePair = side === 'BLUE' || isDual ? { out: oldPlayer ?? null, in: newPlayer ?? null } : null
  const redPair = side === 'RED' ? { out: oldRedPlayer ?? oldPlayer ?? null, in: newRedPlayer ?? newPlayer ?? null } : isDual ? { out: oldRedPlayer ?? null, in: newRedPlayer ?? null } : null
  const activeSide: TeamSide = side === 'RED' ? 'RED' : 'BLUE'
  const colors = isDual ? [THEME.BLUE.accent, THEME.RED.accent, GOLD] : side === 'RED' ? [THEME.RED.accent, GOLD] : [THEME.BLUE.accent, GOLD]
  const headline = isDual ? 'PLAYER CHANGE' : 'PLAYER CHANGE'
  const confirmLabel = isDual ? 'NEW PLAYERS' : side === 'RED' ? 'NEW RED PLAYER' : 'NEW BLUE PLAYER'
  const accent = THEME[activeSide].accent
  // Player changes enter/exit from the CENTER of the broadcast frame.
  // This keeps the cinematic visually anchored instead of sliding athletes
  // in from the left/right edges of the screen.
  const outClass = 'pcx-out-center'
  const inClass = 'pcx-in-center'
  const showOut = phase === 'current' || phase === 'energy' || phase === 'out'
  const showIn = phase === 'in' || phase === 'confirm'

  const renderPair = (pair: { out: RosterPlayer | null; in: RosterPlayer | null }, pairSide: TeamSide) => (
    <div className="relative flex h-full min-w-0 items-center justify-center">
      {/* Single-player substitution is always centered. The animation itself may
          transform/scale, so centering is kept on this wrapper to prevent the
          player card from drifting into the left side of the broadcast. */}
      {showOut && pair.out && (
        <div className="absolute left-1/2 top-1/2 w-[44vw] max-w-[820px] min-w-[420px] -translate-x-1/2 -translate-y-1/2">
          <PlayerCard player={pair.out} side={pairSide} status="OUT" nameFormat={nameFormat} animClass={phase === 'current' ? 'pcx-focus' : phase === 'out' ? outClass : ''} />
        </div>
      )}
      {showIn && pair.in && (
        <div className="absolute left-1/2 top-1/2 w-[44vw] max-w-[820px] min-w-[420px] -translate-x-1/2 -translate-y-1/2">
          <PlayerCard player={pair.in} side={pairSide} status="IN" nameFormat={nameFormat} animClass={inClass} />
        </div>
      )}
    </div>
  )

  return (
    <div className={`wab-broadcast-layer fixed inset-0 z-[95] flex items-center justify-center bg-black/95 ${reducedMotion ? 'pc-reduced' : ''}`} role="dialog" aria-live="polite" aria-label={headline}>
      <div className="relative aspect-video h-full w-full max-h-full max-w-[1920px] overflow-hidden bg-[#01030a] font-hud">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 45%, ${colors[0]}22 0%, transparent 58%), radial-gradient(ellipse at 50% 100%, ${GOLD}18 0%, transparent 52%), #01030a` }} />
        <div className="pc-grain pointer-events-none absolute inset-0 opacity-[0.05]" />
        {!isDual && <PlayerChangeArtwork side={activeSide} phase={phase} />}
        <div className="pointer-events-none absolute inset-[1.1%] z-50 border" style={{ borderColor: `${accent}55`, boxShadow: `inset 0 0 90px ${accent}14, 0 0 36px ${accent}18` }} />

        <header className="absolute inset-x-[2.2%] top-[1.5%] z-30">
          <div className="mx-auto max-w-[1840px] text-center">
            <div className="flex items-center justify-center gap-[1vw]">
              <div className="pcx-app-icon relative h-[5.5vh] w-[5.5vh] shrink-0 overflow-hidden rounded-[1vh] border-2 bg-black/90 p-[.4vh]" style={{ borderColor: `${GOLD}cc`, boxShadow: `0 0 18px ${GOLD}88, 0 0 44px ${GOLD}22` }}>
                <img src={appIconUrl} alt="WAB-TKD" className="h-full w-full rounded-[.65vh] object-cover" />
              </div>
              <div className="min-w-0">
                <div className="pc-gold-shimmer pcx-tournament-title truncate font-display text-[6vh] font-black uppercase leading-none tracking-[.035em]">{tournamentName || 'WAB-TKD CHAMPIONSHIP'}</div>
                <div className="mt-[.45vh] font-hud text-[.95vh] font-black uppercase tracking-[.38em] text-[#f2c14e]">PLAYER CHANGE • OFFICIAL BROADCAST</div>
              </div>
            </div>

            <div className="mx-auto mt-[.9vh] flex w-full flex-nowrap items-stretch justify-center gap-[.45vw] overflow-hidden rounded-[1vh] border bg-black/88 px-[.55vw] py-[.55vh]" style={{ borderColor: `${GOLD}44`, boxShadow: `inset 0 0 24px ${GOLD}08` }}>
              {[
                ['TYPE', tournamentType || 'PAR ÉQUIPE'],
                ['GENDER', gender || '—'],
                ['AGE', ageGroup || '—'],
                ['DIVISION', division || '—'],
                ['WEIGHT', weightCategory || '—'],
                ['MATCH', matchNumber !== undefined ? `#${matchNumber}` : '—'],
                ['ROUND', roundNumber !== undefined ? String(roundNumber) : '—'],
                ['DATE', eventDate || '—'],
                ['LOCATION', eventLocation || 'WORLD ARENA'],
              ].map(([label, value]) => <InfoFrame key={label} label={label} value={value} accent={GOLD} wide />)}
            </div>
          </div>
        </header>

        <main className="absolute inset-x-[4.5%] bottom-[4%] top-[22%] z-20">
          {!isDual && teamInfo && <div className="absolute left-1/2 top-0 z-20 w-full -translate-x-1/2"><TeamIdentity team={teamInfo} accent={accent} /></div>}

          <div className={`absolute inset-x-0 bottom-0 ${teamInfo && !isDual ? 'top-[11vh]' : 'top-0'} grid ${isDual ? 'grid-cols-2 gap-[2vw]' : 'grid-cols-1'}`}>
            {bluePair && renderPair(bluePair, 'BLUE')}
            {redPair && !isDual && renderPair(redPair, 'RED')}
            {redPair && isDual && renderPair(redPair, 'RED')}
          </div>

          {!isDual && <div className="pointer-events-none absolute left-1/2 top-[13%] bottom-[2%] z-10 w-px -translate-x-1/2" style={{ background: `linear-gradient(180deg, transparent, ${accent}66 22%, ${GOLD}aa 50%, ${accent}66 78%, transparent)`, boxShadow: `0 0 18px ${accent}55` }} />}
          {!isDual && <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 h-[16vh] w-[16vh] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `radial-gradient(circle, ${GOLD}1f, ${accent}08 42%, transparent 70%)`, boxShadow: `0 0 50px ${accent}18` }} />}
        </main>

        <div className="absolute bottom-[1.8%] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border bg-black/60 px-[2vw] py-[.65vh] font-hud text-[1.05vh] font-black uppercase tracking-[.32em]" style={{ color: accent, borderColor: `${accent}66`, boxShadow: `0 0 24px ${accent}18` }}>
          {phase === 'current' ? 'CURRENT PLAYER' : phase === 'energy' ? 'PLAYER CHANGE IN PROGRESS' : phase === 'out' ? 'PLAYER EXITING' : phase === 'in' ? 'NEW PLAYER ENTERING' : 'PLAYER CHANGE COMPLETE'}
        </div>

        {phase === 'energy' && <div className="absolute inset-0 z-40"><EnergyBurst colors={colors} /></div>}
        {phase === 'confirm' && <div className="pcx-flash pointer-events-none absolute inset-0 z-50" style={{ background: `radial-gradient(circle at 50% 50%, #fff 0%, ${GOLD} 30%, transparent 68%)` }} />}
      </div>
    </div>
  )
}
