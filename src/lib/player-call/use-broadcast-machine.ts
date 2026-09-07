
import { useCallback, useEffect, useRef, useState } from 'react'
import { BROADCAST_SEQUENCE, type BroadcastState } from './types'

/** Auto-play dwell time (ms) for each state while the timeline runs. */
const STATE_DURATION: Record<BroadcastState, number> = {
  intro: 2000,
  showRound: 2000,
  showRedPlayer: 2000,
  showBluePlayer: 2000,
  showBothPlayers: 0, // HOLD — waits for the head referee to confirm both players are ready
  ready: 0, // terminal
}

export function useBroadcastMachine() {
  const [state, setState] = useState<BroadcastState>('intro')
  const [isPlaying, setIsPlaying] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const goTo = useCallback(
    (next: BroadcastState) => {
      clearTimer()
      setIsPlaying(false)
      setState(next)
    },
    [clearTimer],
  )

  const reset = useCallback(() => {
    clearTimer()
    setIsPlaying(false)
    setState('intro')
  }, [clearTimer])

  const play = useCallback(() => {
    clearTimer()
    setState('intro')
    setIsPlaying(true)
  }, [clearTimer])

  const stop = useCallback(() => {
    clearTimer()
    setIsPlaying(false)
  }, [clearTimer])

  const ready = useCallback(() => {
    clearTimer()
    setIsPlaying(false)
    setState('ready')
  }, [clearTimer])

  // Drive the auto-advancing timeline when playing.
  useEffect(() => {
    if (!isPlaying) return
    const index = BROADCAST_SEQUENCE.indexOf(state)
    // Hold the sequence on "both players" until the head referee confirms readiness.
    if (state === 'showBothPlayers' || index === -1 || index >= BROADCAST_SEQUENCE.length - 1) {
      setIsPlaying(false)
      return
    }
    const duration = STATE_DURATION[state]
    timerRef.current = setTimeout(() => {
      setState(BROADCAST_SEQUENCE[index + 1]!)
    }, duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isPlaying, state])

  useEffect(() => () => clearTimer(), [clearTimer])

  return { state, isPlaying, play, stop, reset, goTo, ready }
}

/** Derived focus per state — controls dim/highlight of each player side. */
export function getFocus(state: BroadcastState): 'red' | 'blue' | 'both' | 'none' {
  switch (state) {
    case 'showRedPlayer':
      return 'red'
    case 'showBluePlayer':
      return 'blue'
    case 'showBothPlayers':
    case 'ready':
      return 'both'
    default:
      return 'none'
  }
}

/** Whether a given player card should be visible/entered for a state. */
export function isSideVisible(state: BroadcastState, side: 'red' | 'blue'): boolean {
  const order: Record<BroadcastState, number> = {
    intro: 0,
    showRound: 0,
    showBluePlayer: 1,
    showRedPlayer: 2,
    showBothPlayers: 3,
    ready: 3,
  }
  const level = order[state]
  if (side === 'blue') return level >= 1
  return level >= 2
}
