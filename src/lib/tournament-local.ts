// Local-storage-backed tournament cache. Supabase may be unconfigured or
// unreachable (see integrations/supabase/client.ts), and even when it works,
// navigating between the Tournament page and the Operator screen unmounts
// TournamentManager and loses all of its local React state. Without some
// form of persistence that survives both of those, the "advance to next
// match" flow breaks: Save silently does nothing, or the operator returns
// to a blank match instead of the tournament's next one.
//
// This gives every tournament a durable local copy (id prefixed "local-" if
// it was never accepted by the cloud) that both TournamentManager and
// OperatorScreen can read/write directly, with no network required.

const PREFIX = 'kyorugi_tournament_';

export interface TournamentDisplayColors {
  titleColor: string;
  subColor: string;
  playerNameColor: string;
  blueColor: string;
  redColor: string;
  timerColor: string;
  winnerColor: string;
  roundActiveColor: string;
}

export const DEFAULT_TOURNAMENT_DISPLAY_COLORS: TournamentDisplayColors = {
  titleColor: '#f5c842', subColor: '#f0f0f0', playerNameColor: '#ffffff',
  blueColor: '#2467d6', redColor: '#d33a45', timerColor: '#f5c842',
  winnerColor: '#f5c842', roundActiveColor: '#f5c842',
};


export function getExternalDisplayColors(): TournamentDisplayColors {
  try {
    const raw = localStorage.getItem('tkd-scoreboard-settings');
    const s = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_TOURNAMENT_DISPLAY_COLORS,
      titleColor: s.titleColor || DEFAULT_TOURNAMENT_DISPLAY_COLORS.titleColor,
      subColor: s.subColor || DEFAULT_TOURNAMENT_DISPLAY_COLORS.subColor,
      playerNameColor: s.playerNameColor || DEFAULT_TOURNAMENT_DISPLAY_COLORS.playerNameColor,
      blueColor: s.chungColor || DEFAULT_TOURNAMENT_DISPLAY_COLORS.blueColor,
      redColor: s.hongColor || DEFAULT_TOURNAMENT_DISPLAY_COLORS.redColor,
      timerColor: s.timerColor || DEFAULT_TOURNAMENT_DISPLAY_COLORS.timerColor,
      winnerColor: s.winnerColor || DEFAULT_TOURNAMENT_DISPLAY_COLORS.winnerColor,
      roundActiveColor: s.roundActiveColor || DEFAULT_TOURNAMENT_DISPLAY_COLORS.roundActiveColor,
    };
  } catch { return DEFAULT_TOURNAMENT_DISPLAY_COLORS; }
}

export interface LocalTournamentRecord {
  id: string;
  name: string;
  gender: string;
  weight_category: string;
  age_group: string;
  format: string;
  status?: string;
  bracket_data: any;
  players?: any[];
  /** Saved external/public-display color theme for this tournament. */
  display_colors?: TournamentDisplayColors;
  created_at: string;
  /** Last local mutation; used for deterministic offline/cloud conflict resolution. */
  updated_at?: string;
}

export function saveTournamentLocal(t: LocalTournamentRecord) {
  try {
    const incoming = t.updated_at || new Date().toISOString();
    localStorage.setItem(PREFIX + t.id, JSON.stringify({ ...t, updated_at: incoming }));
  } catch { /* localStorage unavailable */ }
}

export function loadTournamentLocal(id: string): LocalTournamentRecord | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadAllLocalTournaments(): LocalTournamentRecord[] {
  const out: LocalTournamentRecord[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) {
        try { out.push(JSON.parse(localStorage.getItem(k) || '')); } catch { /* skip a corrupted entry */ }
      }
    }
  } catch { /* localStorage unavailable */ }
  return out;
}

export function deleteTournamentLocal(id: string) {
  try { localStorage.removeItem(PREFIX + id); } catch { /* localStorage unavailable */ }
}

export function isLocalTournamentId(id: string | undefined | null): boolean {
  return !!id && id.startsWith('local-');
}
