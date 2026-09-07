
import { Check, ChevronRight, ShieldCheck, Star, Swords, User, Users, Zap } from 'lucide-react'
import type { BroadcastState } from '@/lib/player-call/types'

type Props = { state: BroadcastState; round: number }

/** Active timeline step (1-8) per broadcast state. */
const ACTIVE_STEP: Record<BroadcastState, number> = {
  intro: 1,
  showRound: 3,
  showRedPlayer: 4,
  showBluePlayer: 5,
  showBothPlayers: 7,
  ready: 8,
}

export function AnimationTimeline({ state, round }: Props) {
  const active = ACTIVE_STEP[state]

  const steps = [
    { n: 1, label: 'Intro', icon: <ShieldCheck className="h-[18px] w-[18px]" />, color: '#f2c14e' },
    { n: 2, label: 'Next Round', icon: <Star className="h-[18px] w-[18px]" />, color: '#f2c14e' },
    { n: 3, label: `Round ${round}`, icon: <span className="text-[15px] font-bold">{round}</span>, color: '#f2c14e' },
    { n: 4, label: 'Red Player', icon: <User className="h-[18px] w-[18px]" />, color: '#ff2b39' },
    { n: 5, label: 'Blue Player', icon: <User className="h-[18px] w-[18px]" />, color: '#33a2ff' },
    { n: 6, label: 'VS', icon: <Swords className="h-[18px] w-[18px]" />, color: '#f2c14e' },
    { n: 7, label: 'Both Players', icon: <Users className="h-[18px] w-[18px]" />, color: '#f2c14e' },
    { n: 8, label: 'Ready', icon: <ShieldCheck className="h-[18px] w-[18px]" />, color: '#3ad07a' },
  ]

  return (
    <div className="absolute inset-x-0 bottom-[18px] z-[60] px-8">
      <div
        className="flex items-center justify-between gap-1 rounded-lg border border-white/10 bg-black/80 px-4 py-1.5 backdrop-blur-md"
        style={{ boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6)' }}
      >
        {steps.map((s, i) => {
          const isActive = s.n === active
          const isDone = s.n < active
          const dim = !isActive && !isDone
          return (
            <div key={s.n} className="flex flex-1 items-center">
              <div
                className="flex items-center gap-3 rounded-md px-2.5 py-1 transition-all"
                style={{
                  border: isActive ? `1px solid ${s.color}` : '1px solid transparent',
                  boxShadow: isActive ? `0 0 18px ${s.color}66` : 'none',
                  background: isActive ? `${s.color}12` : 'transparent',
                }}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full border"
                  style={{
                    borderColor: dim ? 'rgba(255,255,255,0.15)' : s.color,
                    color: dim ? 'rgba(255,255,255,0.35)' : s.color,
                    boxShadow: isActive ? `0 0 14px ${s.color}88` : 'none',
                  }}
                >
                  {s.icon}
                </span>
                <div className="font-hud leading-tight">
                  <div
                    className="text-[11px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: dim ? 'rgba(255,255,255,0.4)' : '#fff' }}
                  >
                    {s.label}
                  </div>
                  <div
                    className="flex items-center gap-1 text-[10px] font-semibold"
                    style={{ color: dim ? 'rgba(255,255,255,0.3)' : s.color }}
                  >
                    {String(s.n).padStart(2, '0')}
                    {isDone && <Check className="h-3.5 w-3.5" />}
                    {isActive && <Zap className="h-3 w-3 pc-blink" />}
                  </div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight
                  className="mx-auto h-4 w-4 shrink-0"
                  style={{ color: isDone ? '#f2c14e88' : 'rgba(255,255,255,0.15)' }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
