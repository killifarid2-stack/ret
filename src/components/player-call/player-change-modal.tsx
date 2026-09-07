import { AlertTriangle, ArrowRight, Check, Loader2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { MatchInfo, RosterPlayer, StagedChange, TeamSide } from '@/lib/player-call/match-types'
import { getIso2, getLocalFlagUrl } from '@/lib/flags'

const THEME = {
  BLUE: { accent: '#33a2ff', label: 'Blue Team' },
  RED: { accent: '#ff2b39', label: 'Red Team' },
} as const

const GOLD = '#f2c14e'

export type PlayerChangeSelection = {
  blue: StagedChange | null
  red: StagedChange | null
}

type Props = {
  open: boolean
  onClose: () => void
  match: MatchInfo
  roster: RosterPlayer[]
  submitting: boolean
  error?: string | null
  onConfirm: (selection: PlayerChangeSelection) => void
}

function flagSrc(flag: string) {
  if (!flag) return ''
  if (flag.startsWith('data:')) return flag
  if (flag.startsWith('/')) return flag
  const iso = getIso2(flag)
  return iso ? getLocalFlagUrl(iso) : ''
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function Avatar({ player, size }: { player: RosterPlayer; size: number }) {
  return player.photo ? (
    <img
      src={player.photo}
      alt={player.fullName}
      className="shrink-0 rounded-md object-cover object-top"
      style={{ width: size, height: size, background: 'rgba(255,255,255,0.06)' }}
    />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 font-display font-bold text-white/60"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(player.fullName) || '—'}
    </div>
  )
}

function PlayerRow({
  player,
  accent,
  selected,
  disabled,
  onSelect,
}: {
  player: RosterPlayer
  accent: string
  selected: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all ${
        disabled ? 'cursor-not-allowed opacity-35' : 'hover:bg-white/[0.06]'
      }`}
      style={{
        borderColor: selected ? accent : 'rgba(255,255,255,0.10)',
        background: selected ? `${accent}18` : 'transparent',
        boxShadow: selected ? `0 0 0 1px ${accent}, 0 0 22px ${accent}44` : 'none',
      }}
    >
      <Avatar player={player} size={52} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[14px] font-bold uppercase tracking-wide text-white">
            {player.fullName}
          </span>
          {player.playerNumber > 0 && (
            <span className="shrink-0 rounded bg-white/10 px-1.5 text-[11px] text-white/60">
              #{player.playerNumber}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] uppercase tracking-wide text-white/55">
          {player.teamName && <span>{player.teamName}</span>}
          {player.clubName && <span style={{ color: GOLD }}>{player.clubName}</span>}
          {player.country && (
            <span className="flex items-center gap-1">
              {flagSrc(player.flag) && <img src={flagSrc(player.flag)} alt="" className="h-3 w-auto rounded-[2px]" />}
              {player.country}
            </span>
          )}
          {player.weightCategory && <span>{player.weightCategory}</span>}
        </div>
      </div>
      <span
        className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{
          color: player.status === 'ACTIVE' ? accent : player.status === 'BENCH' ? '#94a3b8' : '#64748b',
          border: `1px solid ${player.status === 'ACTIVE' ? accent : 'rgba(255,255,255,0.15)'}`,
        }}
      >
        {player.status}
      </span>
    </button>
  )
}

export function PlayerChangeModal({ open, onClose, match, roster, submitting, error, onConfirm }: Props) {
  const [side, setSide] = useState<TeamSide>('BLUE')
  const [selection, setSelection] = useState<PlayerChangeSelection>({ blue: null, red: null })
  const [outId, setOutId] = useState<string | null>(null)
  const [inId, setInId] = useState<string | null>(null)
  const [step, setStep] = useState<'select' | 'confirm'>('select')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSelection({ blue: null, red: null })
      setOutId(null)
      setInId(null)
      setStep('select')
      setLocalError(null)
      setSide('BLUE')
    }
  }, [open])

  const sideRoster = useMemo(() => roster.filter((p) => p.side === side), [roster, side])
  const outCandidates = useMemo(() => sideRoster.filter((p) => p.status === 'ACTIVE'), [sideRoster])
  const inCandidates = useMemo(() => sideRoster.filter((p) => p.status === 'BENCH'), [sideRoster])

  if (!open) return null

  const accent = THEME[side].accent
  const stageKey = side === 'BLUE' ? 'blue' : 'red'

  const stage = () => {
    const out = sideRoster.find((p) => p.matchPlayerId === outId)
    const incoming = sideRoster.find((p) => p.matchPlayerId === inId)
    if (!out || !incoming) {
      setLocalError('Select the player to remove and the player to enter.')
      return
    }
    if (out.playerId === incoming.playerId) {
      setLocalError('The outgoing and incoming player must be different.')
      return
    }
    if (out.side !== incoming.side) {
      setLocalError('Both players must belong to the same team.')
      return
    }
    if (incoming.status !== 'BENCH') {
      setLocalError('The incoming player is not available for this match.')
      return
    }
    setLocalError(null)
    setSelection((s) => ({ ...s, [stageKey]: { out, in: incoming } }))
    setOutId(null)
    setInId(null)
  }

  const staged = [selection.blue, selection.red].filter(Boolean) as StagedChange[]
  const changeSide = selection.blue && selection.red ? 'DUAL' : selection.blue ? 'BLUE' : 'RED'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />

      <div className="relative flex max-h-[92vh] w-full max-w-[980px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#080a12] font-hud text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="font-display text-[20px] font-black uppercase tracking-[0.18em]" style={{ color: GOLD }}>
              Change Player
            </h2>
            <p className="text-[12px] uppercase tracking-[0.16em] text-white/45">
              {match.matchType} Match · Round {match.round} {match.roundStage && `· ${match.roundStage}`}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-white/15 p-2 text-white/70 transition-colors hover:bg-white/10 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'select' ? (
          <>
            <div className="flex gap-2 border-b border-white/10 px-6 py-3">
              {(['BLUE', 'RED'] as TeamSide[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSide(s)
                    setOutId(null)
                    setInId(null)
                    setLocalError(null)
                  }}
                  className="rounded-md border px-4 py-2 text-[13px] font-bold uppercase tracking-[0.16em] transition-all"
                  style={{
                    borderColor: side === s ? THEME[s].accent : 'rgba(255,255,255,0.12)',
                    color: side === s ? THEME[s].accent : 'rgba(255,255,255,0.55)',
                    background: side === s ? `${THEME[s].accent}18` : 'transparent',
                  }}
                >
                  {THEME[s].label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/45">
                {selection.blue && <span style={{ color: THEME.BLUE.accent }}>Blue staged</span>}
                {selection.red && <span style={{ color: THEME.RED.accent }}>Red staged</span>}
              </div>
            </div>

            <div className="grid flex-1 grid-cols-2 gap-5 overflow-y-auto px-6 py-5">
              <div>
                <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.2em] text-white/60">
                  Player to Remove
                </h3>
                <div className="space-y-2">
                  {outCandidates.length === 0 && (
                    <p className="text-[12px] text-white/40">No active player on this side.</p>
                  )}
                  {outCandidates.map((p) => (
                    <PlayerRow
                      key={p.matchPlayerId}
                      player={p}
                      accent={accent}
                      selected={outId === p.matchPlayerId}
                      onSelect={() => setOutId(p.matchPlayerId)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.2em] text-white/60">Player to Enter</h3>
                <div className="space-y-2">
                  {inCandidates.length === 0 && (
                    <p className="text-[12px] text-white/40">No available substitutes on this side.</p>
                  )}
                  {inCandidates.map((p) => (
                    <PlayerRow
                      key={p.matchPlayerId}
                      player={p}
                      accent={accent}
                      selected={inId === p.matchPlayerId}
                      disabled={outId === p.matchPlayerId}
                      onSelect={() => setInId(p.matchPlayerId)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {(localError || error) && (
              <div className="flex items-center gap-2 border-t border-red-500/30 bg-red-500/10 px-6 py-2.5 text-[12px] text-red-300">
                <AlertTriangle className="h-4 w-4" /> {localError || error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
              <button
                onClick={onClose}
                className="rounded-md border border-white/15 px-4 py-2 text-[13px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={stage}
                disabled={!outId || !inId}
                className="rounded-md border px-4 py-2 text-[13px] font-semibold uppercase tracking-wide transition-all disabled:opacity-35"
                style={{ borderColor: accent, color: accent, background: `${accent}14` }}
              >
                Stage {THEME[side].label} Change
              </button>
              <button
                onClick={() => {
                  if (staged.length === 0) {
                    setLocalError('Stage at least one player change first.')
                    return
                  }
                  setLocalError(null)
                  setStep('confirm')
                }}
                disabled={staged.length === 0}
                className="flex items-center gap-2 rounded-md px-5 py-2 text-[13px] font-bold uppercase tracking-wide text-black transition-all disabled:opacity-35"
                style={{ background: GOLD }}
              >
                Review <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <p className="mb-5 text-center font-display text-[15px] font-bold uppercase tracking-[0.3em] text-white/60">
                {changeSide === 'DUAL' ? 'Double Player Change' : `${changeSide} Player Change`}
              </p>

              <div className={`grid gap-5 ${staged.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {staged.map((pair) => {
                  const a = THEME[pair.out.side].accent
                  return (
                    <div
                      key={pair.out.matchPlayerId}
                      className="rounded-xl border p-4"
                      style={{ borderColor: `${a}55`, background: `${a}0d` }}
                    >
                      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: a }}>
                        {THEME[pair.out.side].label}
                      </div>
                      {[
                        { label: 'Old Player', p: pair.out },
                        { label: 'New Player', p: pair.in },
                      ].map((entry, i) => (
                        <div key={entry.label}>
                          {i === 1 && (
                            <div className="my-2 text-center text-[18px]" style={{ color: GOLD }}>
                              ↓
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <Avatar player={entry.p} size={64} />
                            <div className="min-w-0">
                              <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">{entry.label}</div>
                              <div className="truncate font-display text-[16px] font-bold uppercase text-white">
                                {entry.p.fullName}
                              </div>
                              <div className="text-[11px] uppercase tracking-wide text-white/55">
                                {entry.p.teamName} {entry.p.clubName && <span style={{ color: GOLD }}>· {entry.p.clubName}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>

            {(localError || error) && (
              <div className="flex items-center gap-2 border-t border-red-500/30 bg-red-500/10 px-6 py-2.5 text-[12px] text-red-300">
                <AlertTriangle className="h-4 w-4" /> {localError || error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
              <button
                onClick={() => setStep('select')}
                disabled={submitting}
                className="rounded-md border border-white/15 px-4 py-2 text-[13px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10 disabled:opacity-40"
              >
                Back
              </button>
              <button
                onClick={onClose}
                disabled={submitting}
                className="rounded-md border border-white/15 px-4 py-2 text-[13px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(selection)}
                disabled={submitting}
                className="flex items-center gap-2 rounded-md px-6 py-2 text-[13px] font-black uppercase tracking-wide text-black transition-all disabled:opacity-50"
                style={{ background: GOLD }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirm Change
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
