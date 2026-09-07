import { CalendarDays, Globe, MapPin, Trophy } from 'lucide-react'
import { motion } from 'motion/react'
import appIconUrl from '@/assets/app-icon.png'

type Props = {
  eventDate: string
  eventLocation: string
  tournamentName?: string
  tournamentType?: string
  gender?: string
  ageGroup?: string
  division?: string
  weightCategory?: string
  matchNumber?: number
  matNumber?: number
}

const normalizeMetaValue = (value?: string | number) => {
  if (value === undefined || value === '') return '—'
  const raw = String(value).trim()
  const key = raw.toUpperCase()
  if (key === 'TEAM' || key === 'TEAM MATCH' || key === 'PAR EQUIPE' || key === 'PAR ÉQUIPE') return 'PAR ÉQUIPE'
  if (key === 'INDIVIDUAL' || key === '1V1') return 'INDIVIDUAL / 1V1'
  if (key === 'MALE' || key === 'M') return 'MALE'
  if (key === 'FEMALE' || key === 'F') return 'FEMALE'
  return raw
}

const meta = (label: string, value?: string | number) => ({
  label,
  value: normalizeMetaValue(value),
})

export function ChampionshipHeader({
  eventDate,
  eventLocation,
  tournamentName = 'WAB-TKD',
  tournamentType,
  gender,
  ageGroup,
  division,
  weightCategory,
  matchNumber,
  matNumber,
}: Props) {
  const items = [
    meta('TYPE', tournamentType),
    meta('GENDER', gender),
    meta('AGE GROUP', ageGroup),
    meta('DIVISION', division),
    meta('WEIGHT', weightCategory),
    meta('MATCH', matchNumber),
    meta('DATE', eventDate),
    meta('LOCATION', eventLocation || 'WORLD ARENA'),
  ]

  return (
    <header className="absolute inset-x-0 top-0 z-[60] px-10 pt-8">
      <div className="flex items-start justify-between gap-8">
        {/* Left: date / location */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-2 flex w-[220px] shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-black/92 px-4 py-2.5 backdrop-blur-xl"
          style={{ boxShadow: '0 0 28px rgba(0,0,0,.55), inset 0 0 18px rgba(242,193,78,.07)' }}
        >
          <CalendarDays className="h-6 w-6 shrink-0 text-[#f2c14e]" />
          <div className="font-hud leading-tight">
            <div className="text-[15px] font-black tracking-wide text-white">{eventDate || '—'}</div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
              <MapPin className="h-3 w-3 text-[#f2c14e]" />
              {eventLocation || 'World Arena'}
            </div>
          </div>
        </motion.div>

        {/* Center: tournament identity + complete live metadata */}
        <motion.div
          initial={{ opacity: 0, y: -22, scale: .97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="flex min-w-0 flex-1 flex-col items-center"
        >
          <div className="flex items-center gap-4">
            <div
              className="relative h-[62px] w-[62px] shrink-0 overflow-hidden rounded-xl border-2 border-[#f2c14e]/75 bg-black/90 p-1.5"
              style={{ boxShadow: '0 0 16px rgba(242,193,78,.5), 0 0 42px rgba(242,193,78,.18), inset 0 0 18px rgba(255,255,255,.08)' }}
            >
              <img src={appIconUrl} alt="WAB-TKD" className="h-full w-full rounded-xl object-cover" />
              <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/20" />
            </div>
            <div className="min-w-0 text-center leading-none">
              <div className="pc-metallic truncate font-display text-[68px] font-black uppercase tracking-[0.02em] leading-none drop-shadow-[0_0_24px_rgba(242,193,78,.25)]">
                {tournamentName || 'WAB-TKD'}
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-2">
                <span className="h-px w-16 bg-gradient-to-r from-transparent to-[#f2c14e]" />
                <Trophy className="h-5 w-5 text-[#f2c14e]" />
                <span className="pc-gold-shimmer font-display text-[17px] font-black tracking-[0.30em]">CHAMPIONSHIP</span>
                <span className="h-px w-16 bg-gradient-to-l from-transparent to-[#f2c14e]" />
              </div>
            </div>
          </div>

          <div
            className="mt-3 flex w-[1680px] max-w-full flex-nowrap items-stretch justify-center gap-2 overflow-hidden rounded-xl border border-[#f2c14e]/40 bg-black/95 px-3 py-2.5 shadow-[0_0_32px_rgba(0,0,0,.8),inset_0_0_24px_rgba(242,193,78,.06)] backdrop-blur-xl"
            style={{ boxShadow: '0 0 32px rgba(0,0,0,.8), 0 0 55px rgba(242,193,78,.08), inset 0 0 24px rgba(242,193,78,.06)' }}
          >
            {items.map((item, index) => (
              <div
                key={item.label}
                className="group relative flex min-w-0 flex-1 flex-col justify-center overflow-hidden rounded-lg border border-[#f2c14e]/25 bg-gradient-to-b from-white/[0.09] to-white/[0.02] px-3 py-2.5 text-center font-hud leading-none transition-all duration-500"
                style={{ boxShadow: 'inset 0 0 14px rgba(255,255,255,.025), 0 0 12px rgba(0,0,0,.35)' }}
              >
                <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-[#f2c14e]/80 to-transparent" />
                <div className="whitespace-nowrap text-[10px] font-black tracking-[0.18em] text-[#f2c14e]">{item.label}</div>
                <div className={`mt-1.5 truncate whitespace-nowrap font-display text-[18px] font-black uppercase tracking-[0.045em] drop-shadow-[0_0_10px_rgba(255,255,255,.12)] ${index === 0 ? 'text-[#f2c14e] drop-shadow-[0_0_12px_rgba(242,193,78,.42)]' : 'text-white'}`} title={item.value}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: international identity */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-2 flex w-[220px] shrink-0 items-center justify-end gap-3 rounded-xl border border-white/10 bg-black/92 px-4 py-2.5 text-right backdrop-blur-xl"
          style={{ boxShadow: '0 0 28px rgba(0,0,0,.55), inset 0 0 18px rgba(242,193,78,.07)' }}
        >
          <div className="font-hud leading-tight">
            <div className="text-[14px] font-black uppercase tracking-wide text-white">
              {eventLocation?.split('·')[0]?.trim() || eventLocation || 'WORLD ARENA'}
            </div>
            <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">LIVE BROADCAST</div>
          </div>
          <Globe className="h-6 w-6 text-[#f2c14e]" />
        </motion.div>
      </div>
    </header>
  )
}
