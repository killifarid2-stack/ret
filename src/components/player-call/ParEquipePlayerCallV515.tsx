import React from 'react';
import type { MatchState } from '@/types/tkd';
import ExactPlayerCallBroadcast from '../ExactPlayerCallBroadcast';

/**
 * Par Équipe Player Call renderer.
 *
 * The previous Par Équipe-specific HTML/CSS player-call renderer has been
 * retired. Par Équipe now uses the new cinematic Player Call animation that
 * was supplied in the Arena Glory package, while keeping the existing
 * Main Referee controls, player selection and match state as the data source.
 *
 * This component intentionally stays as the public-display adapter so the
 * existing PublicScoreboard routing does not have to change.
 */
export default function ParEquipePlayerCallV515({ state }: { state: MatchState }) {
  const isParEquipe =
    state.config?.competitionMode === 'par_equipe' ||
    state.teamMode === 'rotation' ||
    state.teamMode === 'substitution';

  if (!isParEquipe) return null;

  return <ExactPlayerCallBroadcast state={state} />;
}
