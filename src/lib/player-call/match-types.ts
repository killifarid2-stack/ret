import type { Player } from './types'

/** Sides used by the match/roster system (DB values). */
export type TeamSide = 'BLUE' | 'RED'
/** Side carried by a PLAYER_CHANGE event. */
export type ChangeSide = TeamSide | 'DUAL'

export type MatchType = 'SOLO' | 'TEAM' | 'HYBRID'
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'FINISHED'
export type MatchPlayerStatus = 'ACTIVE' | 'BENCH' | 'SUBSTITUTED' | 'UNAVAILABLE'

/** Match types where the CHANGE PLAYER system is allowed. */
export const SUBSTITUTION_MATCH_TYPES: MatchType[] = ['TEAM', 'HYBRID']

export function allowsPlayerChange(match: MatchInfo | null | undefined): boolean {
  if (!match) return false
  if (!SUBSTITUTION_MATCH_TYPES.includes(match.matchType)) return false
  return match.status === 'LIVE' || match.status === 'PAUSED'
}

export type MatchInfo = {
  id: string
  matchType: MatchType
  round: number
  roundStage: string
  category: string
  weightCategory: string
  eventDate: string
  eventLocation: string
  status: MatchStatus
}

/** A player as they exist inside a specific match line-up. */
export type RosterPlayer = {
  matchPlayerId: string
  playerId: string
  side: TeamSide
  status: MatchPlayerStatus
  fullName: string
  photo: string
  teamName: string
  clubName: string
  clubLogo: string
  teamLogo: string
  country: string
  flag: string
  weightCategory: string
  playerNumber: number
  ranking: string
  winRate: number
  previousScore: string
}

/** Adapt a roster player to the existing broadcast card shape. */
export function toBroadcastPlayer(p: RosterPlayer): Player {
  return {
    name: p.fullName,
    photo: p.photo,
    teamName: p.teamName || p.clubName,
    clubName: p.clubName,
    teamLogo: p.teamLogo || p.clubLogo,
    clubLogo: p.clubLogo,
    country: p.country,
    flag: p.flag,
    weight: p.weightCategory,
    ranking: p.ranking,
    seed: p.playerNumber,
    previousScore: p.previousScore,
    winRate: p.winRate,
  }
}

/** The PLAYER_CHANGE domain event persisted with every substitution. */
export type PlayerChangeEvent = {
  type: 'PLAYER_CHANGE'
  matchId: string
  teamSide: ChangeSide
  oldPlayerId: string | null
  newPlayerId: string | null
  oldPlayer: RosterPlayer | null
  newPlayer: RosterPlayer | null
  oldRedPlayer: RosterPlayer | null
  newRedPlayer: RosterPlayer | null
  timestamp: string
}

/** A substitution staged in the modal, before confirmation. */
export type StagedChange = {
  out: RosterPlayer
  in: RosterPlayer
}
