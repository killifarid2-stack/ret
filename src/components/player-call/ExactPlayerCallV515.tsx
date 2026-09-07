import React, { useMemo } from 'react';
import { EXACT_PLAYER_CALL_BODY, EXACT_PLAYER_CALL_CSS } from './exact-player-call-fragment';
import type { MatchState, PlayerColor } from '@/types/tkd';
import { getLocalFlagUrl, getIso2 } from '@/lib/flags';
import { ANIMATION_ASSETS } from '@/assets/animations';
import { formatPlayerName, type NameFormat } from '@/lib/playerName';
import orbitron400 from '@fontsource/orbitron/files/orbitron-latin-400-normal.woff2?url';
import orbitron700 from '@fontsource/orbitron/files/orbitron-latin-700-normal.woff2?url';
import orbitron900 from '@fontsource/orbitron/files/orbitron-latin-900-normal.woff2?url';
import rajdhani400 from '@fontsource/rajdhani/files/rajdhani-latin-400-normal.woff2?url';
import rajdhani700 from '@fontsource/rajdhani/files/rajdhani-latin-700-normal.woff2?url';
import cairo400 from '@fontsource/cairo/files/cairo-arabic-400-normal.woff2?url';
import cairo700 from '@fontsource/cairo/files/cairo-arabic-700-normal.woff2?url';
import cairo900 from '@fontsource/cairo/files/cairo-arabic-900-normal.woff2?url';
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';

const LOCAL_FONT_FACES = `@font-face{font-family:'Orbitron';src:url('${orbitron400}') format('woff2');font-weight:400;font-style:normal;font-display:swap}@font-face{font-family:'Orbitron';src:url('${orbitron700}') format('woff2');font-weight:700;font-style:normal;font-display:swap}@font-face{font-family:'Orbitron';src:url('${orbitron900}') format('woff2');font-weight:900;font-style:normal;font-display:swap}@font-face{font-family:'Rajdhani';src:url('${rajdhani400}') format('woff2');font-weight:400;font-style:normal;font-display:swap}@font-face{font-family:'Rajdhani';src:url('${rajdhani700}') format('woff2');font-weight:700;font-style:normal;font-display:swap}@font-face{font-family:'Cairo';src:url('${cairo400}') format('woff2');font-weight:400;font-style:normal;font-display:swap}@font-face{font-family:'Cairo';src:url('${cairo700}') format('woff2');font-weight:700;font-style:normal;font-display:swap}@font-face{font-family:'Cairo';src:url('${cairo900}') format('woff2');font-weight:900;font-style:normal;font-display:swap}@font-face{font-family:'Inter';src:url('${inter400}') format('woff2');font-weight:400;font-style:normal;font-display:swap}@font-face{font-family:'Inter';src:url('${inter700}') format('woff2');font-weight:700;font-style:normal;font-display:swap}`;

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
}
function flag(country?: string) { const iso=getIso2(country || ''); return iso ? (getLocalFlagUrl(iso) || '') : ''; }
function player(state: MatchState, side: PlayerColor) {
  const p=state[side].player; const selected=state.selectedCallPlayers?.[side];
  const call=state.callAnimation?.phase==='player' && state.callAnimation.side===side ? state.callAnimation : undefined;
  const teamName=call?.teamName || selected?.teamName || state.teamNames?.[side] || p.club || (side==='chung'?'BLUE TEAM':'RED TEAM');
  const clubName=call?.clubName || selected?.clubName || state.clubNames?.[side] || p.club || teamName;
  const logo=call?.clubLogo || selected?.clubLogo || state.clubLogos?.[side] || p.clubLogo || (side==='chung'?ANIMATION_ASSETS.exactBlueClub:ANIMATION_ASSETS.exactRedClub);
  const country=call?.playerNationality || call?.teamCountry || selected?.country || selected?.nationality || state.teamCountry?.[side] || p.nationality || '';
  const name=call?.playerName || selected?.name || p.name || (side==='chung'?'BLUE PLAYER':'RED PLAYER');
  const seed=call?.seedNumber ?? selected?.seedNumber ?? p.seedNumber ?? p.playerNumber ?? 0;
  const photo=call?.playerPhoto || selected?.photo || p.photoUrl || p.photo || (side==='chung'?ANIMATION_ASSETS.silhouetteBlue:ANIMATION_ASSETS.silhouetteRed);
  return { name, teamName, clubName, logo, country, countryName: country, photo, seed, number: p.playerNumber || seed || 0, flag: flag(country) };
}

export default function ExactPlayerCallV515({ state }: { state: MatchState }) {
  // STRICT 1v1 ONLY: never render this cinematic for Par Équipe.
  const isParEquipe = state.config?.competitionMode === 'par_equipe';
  const active = !isParEquipe && (!!state.singlePlayerCall || state.callAnimation?.phase === 'player');
  if (!active) return null;

  const red = player(state, 'hong');
  const blue = player(state, 'chung');
  const nameFormat = (state.callDisplayConfig?.nameFormat || 'full') as NameFormat;
  const tournament = state.competitionName || 'WAB-TKD';
  const matchSeconds = Math.max(0, Number(state.timeRemaining ?? 120));
  const matchTime = `${Math.floor(matchSeconds / 60)}:${String(matchSeconds % 60).padStart(2, '0')}`;

  const flagStyle = (url?: string) => url
    ? `background-image:url(&quot;${esc(url)}&quot;);background-size:cover;background-position:center;background-repeat:no-repeat;`
    : '';

  const srcDoc = useMemo(() => {
    let body = EXACT_PLAYER_CALL_BODY;
    const values: Record<string, string> = {
      __APP_ICON__: esc(ANIMATION_ASSETS.appIcon),
      __MEDAL__: esc(ANIMATION_ASSETS.exactMedal),
      __TOURNAMENT_NAME__: esc(tournament),
      __TOURNAMENT_TYPE__: 'INDIVIDUAL',
      __WEIGHT__: esc(state.weightCategory || ''),
      __MAT__: esc(state.matNumber ? `MAT ${state.matNumber}` : 'MAT 01'),
      __MATCH_NO__: esc(state.matchNumber || '001'),
      __ROUND__: esc(`${state.currentRound || 1} / 3`),
      __AGE__: esc(state.ageGroup || state.division || ''),
      __GENDER__: esc(state.gender === 'male' ? 'MEN' : state.gender === 'female' ? 'WOMEN' : state.gender || ''),
      __RED_NAME__: esc(formatPlayerName(red.name, nameFormat)),
      __RED_COUNTRY_NAME__: esc(red.countryName),
      __RED_COUNTRY__: esc(red.country),
      __RED_CLUB__: esc(red.clubName),
      __RED_SEED__: esc(red.seed),
      __RED_NUMBER__: esc(red.number),
      __RED_PHOTO__: esc(red.photo || ANIMATION_ASSETS.silhouetteRed),
      __RED_LOGO__: esc(red.logo || ANIMATION_ASSETS.exactRedClub),
      __RED_FLAG_STYLE__: flagStyle(red.flag),
      __BLUE_NAME__: esc(formatPlayerName(blue.name, nameFormat)),
      __BLUE_COUNTRY_NAME__: esc(blue.countryName),
      __BLUE_COUNTRY__: esc(blue.country),
      __BLUE_CLUB__: esc(blue.clubName),
      __BLUE_SEED__: esc(blue.seed),
      __BLUE_NUMBER__: esc(blue.number),
      __BLUE_PHOTO__: esc(blue.photo || ANIMATION_ASSETS.silhouetteBlue),
      __BLUE_LOGO__: esc(blue.logo || ANIMATION_ASSETS.exactBlueClub),
      __BLUE_FLAG_STYLE__: flagStyle(blue.flag),
      __MATCH_TIME__: matchTime,
    };
    Object.entries(values).forEach(([key, value]) => { body = body.split(key).join(value); });

    // The supplied animation is intentionally isolated in a real iframe.
    // Its html/body/global CSS can therefore never leak into WAB-TKD's
    // Operator, Public Display, Team Call or scoreboard layout.
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${EXACT_PLAYER_CALL_CSS.replace('__LOCAL_FONT_FACES__', LOCAL_FONT_FACES)}</style></head><body>${body}</body></html>`;
  }, [state, red.name, red.country, red.countryName, red.clubName, red.seed, red.number, red.photo, red.logo, red.flag, blue.name, blue.country, blue.countryName, blue.clubName, blue.seed, blue.number, blue.photo, blue.logo, blue.flag, tournament, nameFormat, matchTime]);

  const animationId = state.singlePlayerCall?.animationId || state.callAnimation?.ts || 'player-call';

  return (
    <div className="wab-broadcast-layer pointer-events-none fixed inset-0 z-[925] overflow-hidden" style={{ width: '100vw', height: '100vh' }}>
      <iframe
        key={String(animationId)}
        title="WAB-TKD Individual Player Call"
        srcDoc={srcDoc}
        className="block h-full w-full border-0"
        scrolling="no"
        style={{ width: '100%', height: '100%', display: 'block', overflow: 'hidden' }}
      />
    </div>
  );
}
