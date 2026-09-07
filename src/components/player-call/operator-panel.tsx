
import { Eye, Play, RotateCcw, Save, ShieldCheck, X } from 'lucide-react'
import type { BroadcastState, Player, UpcomingRound } from '@/lib/player-call/types'

type Props = {
  open: boolean
  onClose: () => void
  data: UpcomingRound
  onChange: (data: UpcomingRound) => void
  onSave: () => void
  onResetData: () => void
  state: BroadcastState
  isPlaying: boolean
  onPlay: () => void
  onPreview: () => void
  onReady: () => void
  onResetAnim: () => void
  onGoTo: (s: BroadcastState) => void
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string | number
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[14px] text-white outline-none transition-colors focus:border-[#f2c14e] focus:bg-white/10"
      />
    </label>
  )
}

const PLAYER_FIELDS: { key: keyof Player; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'photo', label: 'Photo URL' },
  { key: 'teamName', label: 'Team' },
  { key: 'clubName', label: 'Club' },
  { key: 'teamLogo', label: 'Team Logo URL' },
  { key: 'clubLogo', label: 'Club Logo URL' },
  { key: 'country', label: 'Country' },
  { key: 'flag', label: 'Flag (code / URL)' },
  { key: 'weight', label: 'Weight Category' },
  { key: 'ranking', label: 'Ranking' },
  { key: 'seed', label: 'Seed / Player No.' },
  { key: 'winRate', label: 'Win Rate %' },
  { key: 'previousScore', label: 'Previous Score' },
]

function PlayerEditor({
  title,
  accent,
  player,
  onField,
}: {
  title: string
  accent: string
  player: Player
  onField: (key: keyof Player, value: string) => void
}) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: `${accent}55` }}>
      <h3
        className="mb-3 font-display text-[16px] font-bold uppercase tracking-[0.16em]"
        style={{ color: accent }}
      >
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {PLAYER_FIELDS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            type={f.key === 'seed' || f.key === 'winRate' ? 'number' : 'text'}
            value={player[f.key]}
            onChange={(v) => onField(f.key, v)}
          />
        ))}
      </div>
    </div>
  )
}

const CONTROL_BUTTONS: {
  key: string
  label: string
  icon: React.ReactNode
  color: string
}[] = [
  { key: 'save', label: 'Save', icon: <Save className="h-4 w-4" />, color: '#f2c14e' },
  { key: 'reset', label: 'Reset', icon: <RotateCcw className="h-4 w-4" />, color: '#94a3b8' },
  { key: 'preview', label: 'Preview', icon: <Eye className="h-4 w-4" />, color: '#33a2ff' },
  { key: 'play', label: 'Play', icon: <Play className="h-4 w-4" />, color: '#3ad07a' },
  { key: 'ready', label: 'Ready', icon: <ShieldCheck className="h-4 w-4" />, color: '#ff2b39' },
]

export function OperatorPanel(props: Props) {
  const {
    open,
    onClose,
    data,
    onChange,
    onSave,
    onResetData,
    state,
    isPlaying,
    onPlay,
    onPreview,
    onReady,
    onResetAnim,
  } = props

  const update = (patch: Partial<UpcomingRound>) => onChange({ ...data, ...patch })
  const updatePlayer = (side: 'redPlayer' | 'bluePlayer', key: keyof Player, value: string) => {
    const parsed = key === 'seed' || key === 'winRate' ? Number(value) || 0 : value
    onChange({ ...data, [side]: { ...data[side], [key]: parsed } })
  }

  const handleControl = (key: string) => {
    switch (key) {
      case 'save':
        onSave()
        break
      case 'reset':
        onResetAnim()
        onResetData()
        break
      case 'preview':
        onPreview()
        break
      case 'play':
        onPlay()
        break
      case 'ready':
        onReady()
        break
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-[560px] max-w-[92vw] flex-col border-l border-white/10 bg-[#0a0c14] font-hud text-white shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="font-display text-[20px] font-bold uppercase tracking-[0.16em] text-[#f2c14e]">
              Operator Panel
            </h2>
            <p className="text-[12px] text-white/50">Player Call · Round Announcement Control</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-white/15 p-2 text-white/70 transition-colors hover:bg-white/10"
            aria-label="Close operator panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="border-b border-white/10 px-5 py-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {CONTROL_BUTTONS.map((b) => (
              <button
                key={b.key}
                onClick={() => handleControl(b.key)}
                className="flex items-center gap-2 rounded-md border px-4 py-2 text-[13px] font-semibold uppercase tracking-wide transition-all hover:brightness-125"
                style={{ borderColor: b.color, color: b.color, background: `${b.color}12` }}
              >
                {b.icon}
                {b.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-white/50">Jump to:</span>
            {(
              [
                'intro',
                'showRound',
                'showRedPlayer',
                'showBluePlayer',
                'showBothPlayers',
                'ready',
              ] as BroadcastState[]
            ).map((s) => (
              <button
                key={s}
                onClick={() => props.onGoTo(s)}
                className={`rounded px-2 py-1 transition-colors ${
                  state === s
                    ? 'bg-[#f2c14e] text-black'
                    : 'border border-white/15 text-white/70 hover:bg-white/10'
                }`}
              >
                {s}
              </button>
            ))}
            <span className="ml-auto text-white/40">
              {isPlaying ? '● playing' : '‖ paused'} · <span className="text-[#f2c14e]">{state}</span>
            </span>
          </div>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Round meta */}
          <div className="rounded-lg border border-[#f2c14e]/40 p-4">
            <h3 className="mb-3 font-display text-[16px] font-bold uppercase tracking-[0.16em] text-[#f2c14e]">
              Round
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Round"
                type="number"
                value={data.round}
                onChange={(v) => update({ round: Number(v) || 0 })}
              />
              <Field
                label="Round Stage"
                value={data.roundStage}
                onChange={(v) => update({ roundStage: v })}
              />
              <Field label="Category" value={data.category} onChange={(v) => update({ category: v })} />
              <Field
                label="Weight Category"
                value={data.weightCategory}
                onChange={(v) => update({ weightCategory: v })}
              />
              <Field
                label="Event Date"
                value={data.eventDate}
                onChange={(v) => update({ eventDate: v })}
              />
              <Field
                label="Event Location"
                value={data.eventLocation}
                onChange={(v) => update({ eventLocation: v })}
              />
            </div>
          </div>

          <PlayerEditor
            title="Red Player"
            accent="#ff2b39"
            player={data.redPlayer}
            onField={(k, v) => updatePlayer('redPlayer', k, v)}
          />
          <PlayerEditor
            title="Blue Player"
            accent="#33a2ff"
            player={data.bluePlayer}
            onField={(k, v) => updatePlayer('bluePlayer', k, v)}
          />
        </div>
      </aside>
    </>
  )
}
