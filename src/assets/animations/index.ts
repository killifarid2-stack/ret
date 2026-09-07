// Central registry for every raster/vector image used by broadcast animations.
// Keeping animation media under src/assets makes Vite fingerprint and bundle it
// instead of relying on files in public/ or network URLs at the venue.
import appIcon from './player-call-exact/app-icon.png';
import exactRedPlayer from './player-call-exact/red-player.png';
import exactBluePlayer from './player-call-exact/blue-player.png';
import exactRedClub from './player-call-exact/club-red-logo.png';
import exactBlueClub from './player-call-exact/club-blue-logo.png';
import exactMedal from './player-call-exact/medal.png';
import exactFlagsSheet from './player-call-exact/flags-sheet.png';
import silhouetteBlue from './player-call-exact/silhouette-blue.svg';
import silhouetteRed from './player-call-exact/silhouette-red.svg';
import playerArena from './player-call/arena-bg.png';
import playerRed from './player-call/red-player.png';
import playerBlue from './player-call/blue-player.png';
import playerHongClub from './player-call/hong-club-logo.png';
import playerChungClub from './player-call/chung-club-logo.png';
import playerTrophy from './player-call/trophy.png';
import kyeshiCall from './kyeshi/kyeshi-call.png';
import wooseGirokArms from './woose-girok/woose-girok-arms.png';

export const ANIMATION_ASSETS = {
  appIcon,
  exactRedPlayer,
  exactBluePlayer,
  exactRedClub,
  exactBlueClub,
  exactMedal,
  exactFlagsSheet,
  silhouetteBlue,
  silhouetteRed,
  playerArena,
  playerRed,
  playerBlue,
  playerHongClub,
  playerChungClub,
  playerTrophy,
  kyeshiCall,
  wooseGirokArms,
} as const;
