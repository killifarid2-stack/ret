import React from 'react';
import { BroadcastStage } from './player-call/broadcast-stage';
import { BroadcastView } from './player-call/broadcast-view';
import type { BroadcastState, Player, UpcomingRound } from '@/lib/player-call/types';
import type { MatchState, PlayerColor, CallAnimation } from '@/types/tkd';
import { getLocalFlagUrl, getIso2 } from '@/lib/flags';
import { ANIMATION_ASSETS } from '@/assets/animations';

function stageLabel(stage: MatchState['matchStage']): string {
  switch (stage) {
    case 'round_of_32': return 'ROUND OF 32';
    case 'round_of_16': return 'ROUND OF 16';
    case 'quarterfinal': return 'QUARTER-FINAL';
    case 'semifinal': return 'SEMI-FINAL';
    case 'bronze': return 'BRONZE';
    case 'final': return 'FINAL';
    default: return 'ROUND';
  }
}

function scoreFor(state: MatchState, side: PlayerColor): string {
  const round = state.currentRound || 1;
  const events = state.events.filter((e) => e.round === round && e.player === side);
  return String(events.reduce((sum, e) => sum + (e.points || 0), 0));
}

function flagFor(country?: string): string {
  if (!country) return '';
  const iso = getIso2(country);
  return iso ? (getLocalFlagUrl(iso) || '') : '';
}

function toPlayer(state: MatchState, side: PlayerColor, call?: CallAnimation): Player {
  const source = state[side].player;
  const selected = state.selectedCallPlayers?.[side];
  const defaultClubLogo = side === 'chung' ? ANIMATION_ASSETS.exactBlueClub : ANIMATION_ASSETS.exactRedClub;
  const teamName = call?.teamName || selected?.teamName || state.teamNames?.[side] || source.club || (side === 'chung' ? 'BLUE TEAM' : 'RED TEAM');
  const clubName = call?.clubName || selected?.clubName || state.clubNames?.[side] || source.club || (side === 'chung' ? 'CHUNG CLUB' : 'HONG CLUB');
  const teamLogo = call?.teamLogo || selected?.teamLogo || state.teamLogos?.[side] || source.teamLogo || defaultClubLogo;
  const clubLogo = call?.clubLogo || selected?.clubLogo || state.clubLogos?.[side] || source.clubLogo || defaultClubLogo;
  const country = call?.playerNationality || call?.teamCountry || selected?.country || selected?.nationality || state.teamCountry?.[side] || source.nationality || '';
  const name = call?.playerName?.trim() || selected?.name?.trim() || source.name?.trim() || (side === 'chung' ? 'CHANG' : 'HONG');
  const seed = call?.seedNumber ?? selected?.seedNumber ?? source.seedNumber ?? source.playerNumber ?? 0;
  const photo = call?.playerPhoto || selected?.photo || source.photoUrl || source.photo || '';
  // The cinematic's fixed artwork (medal, club logos, flags sheet, arena) is
  // bundled under src/assets/animations. Dynamic player photos remain the
  // player's own stored asset/record; no generated image is ever introduced.

  return {
    name, photo, teamName, clubName, teamLogo, clubLogo, country, flag: flagFor(country),
    weight: call?.category || state.weightCategory || source.category || '',
    ageGroup: call?.ageGroup || state.ageGroup || '',
    gender: call?.gender || state.gender || '',
    ranking: seed ? `#${seed}` : '—',
    seed,
    previousScore: scoreFor(state, side),
    winRate: 0,
  };
}

function getBroadcastState(state: MatchState): BroadcastState | null {
  const blue = state.playerCallStatus?.chung;
  const red = state.playerCallStatus?.hong;
  const bothCalled = ['called', 'ready'].includes(blue || '') && ['called', 'ready'].includes(red || '');
  const bothReady = blue === 'ready' && red === 'ready';
  const call = state.callAnimation?.phase === 'player' ? state.callAnimation : undefined;

  // Main Referee manual stage buttons override only the visual stage; they do
  // not mutate scoring, timer, roster or the underlying animation assets.
  if (state.playerCallPreviewState && (state.singlePlayerCall || call)) return state.playerCallPreviewState;

  // A manual recall or a round-bound player call always takes visual priority.
  if (state.singlePlayerCall?.status === 'calling' && state.singlePlayerCall.side === 'chung') return 'showBluePlayer';
  if (state.singlePlayerCall?.status === 'calling' && state.singlePlayerCall.side === 'hong') return 'showRedPlayer';
  if (call?.side === 'chung') return 'showBluePlayer';
  if (call?.side === 'hong') return 'showRedPlayer';
  if (bothReady) return 'ready';
  if (bothCalled) return 'showBothPlayers';
  if (state.singlePlayerCall?.side === 'chung' && ['calling', 'called', 'ready'].includes(blue || '')) return 'showBluePlayer';
  if (state.singlePlayerCall?.side === 'hong' && ['calling', 'called', 'ready'].includes(red || '')) return 'showRedPlayer';
  return null;
}

export default function ExactPlayerCallBroadcast({ state }: { state: MatchState }) {
  const broadcastState = getBroadcastState(state);
  const call = state.callAnimation?.phase === 'player' ? state.callAnimation : undefined;
  const hasPlayerCall = !!state.singlePlayerCall || !!call;
  if (!broadcastState || !hasPlayerCall) return null;

  const data: UpcomingRound = {
    round: state.roundCallPreview?.round || state.currentRound || 1,
    roundStage: stageLabel(state.matchStage),
    category: state.ageGroup || state.division || state.gender || 'TAEKWONDO',
    weightCategory: state.weightCategory || '',
    eventDate: state.eventDate || '',
    eventLocation: state.eventLocation || 'World Arena',
    matNumber: state.matNumber || undefined,
    matchNumber: state.matchNumber || undefined,
    tournamentType: state.teamMode === 'rotation' || state.teamMode === 'substitution' || state.config?.competitionMode === 'par_equipe' ? 'PAR ÉQUIPE' :
      state.config?.competitionMode === 'friendly' ? 'FRIENDLY' :
      state.config?.competitionMode === 'league' ? 'LEAGUE' : state.config?.competitionMode === 'super_fight' ? 'SUPER FIGHT' : 'TOURNAMENT',
    gender: state.gender === 'male' ? 'MALE' : state.gender === 'female' ? 'FEMALE' : '',
    ageGroup: state.ageGroup || '',
    division: state.division || state.config?.division || '',
    redPlayer: toPlayer(state, 'hong', call?.side === 'hong' ? call : undefined),
    bluePlayer: toPlayer(state, 'chung', call?.side === 'chung' ? call : undefined),
  };

  return (
    <div className="wab-broadcast-layer pointer-events-none fixed inset-0 z-[920] overflow-hidden">
      <BroadcastStage>
        <BroadcastView
          data={data}
          state={broadcastState}
          tournamentName={call?.tournamentName || state.competitionName || 'WAB-TKD'}
        />
      </BroadcastStage>
    </div>
  );
}
