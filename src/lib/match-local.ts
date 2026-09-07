// Mirrors the finished/cancelled match rows normally read from the
// Supabase `matches` table, but cached locally so the Tournament Bracket
// Strip (TournamentBar) keeps showing accurate match statuses even when
// the cloud is unreachable (see tournament-local.ts for the same pattern
// applied to whole tournaments).

const PREFIX = 'kyorugi_match_';

export interface LocalMatchRecord {
  id: string;
  match_id?: string;
  tournament_name?: string | null;
  competition_name: string;
  match_number: number;
  mat_number?: number | null;
  weight_category: string | null;
  gender: string | null;
  age_group: string | null;
  match_stage: string | null;
  chung_name: string | null;
  hong_name: string | null;
  chung_nationality?: string | null;
  hong_nationality?: string | null;
  // Individual matches only (Par Équipe already carries club identity via
  // team_names/club_logos below) — needed so club points can be computed
  // for individual competitions too. Optional: older cached records and
  // any match saved before this field existed simply won't contribute to
  // individual-match club totals (never backfilled/invented — see
  // club-points.ts doc comment).
  chung_club?: string | null;
  hong_club?: string | null;
  chung_score?: number | null;
  hong_score?: number | null;
  /** Official final-result score; for GDP/SUP this is the Golden Round score, not cumulative match points. */
  result_chung_score?: number | null;
  result_hong_score?: number | null;
  chung_gamjeom?: number | null;
  hong_gamjeom?: number | null;
  chung_head_points?: number | null;
  chung_trunk_points?: number | null;
  hong_head_points?: number | null;
  hong_trunk_points?: number | null;
  status: string | null; // 'finished' | 'cancelled'
  lifecycle_status?: 'COMPLETED' | 'VOID' | string;
  winner: string | null;
  win_method?: string | null;
  /** Explicit WT golden-round metadata; older records may omit these fields. */
  golden_point_win?: boolean;
  golden_round?: number | null;
  golden_win_criterion?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  saved_at?: string | null;
  updated_at?: string | null;
  duration_seconds?: number | null;
  result_round?: number | null;
  animation_state?: any;
  referee_decision?: any;
  /** Main referee captured at save time so tournament awards can be data-driven. */
  referee_name?: string | null;
  ai_score?: { chung?: number; hong?: number } | null;
  ai_confidence?: number | null;
  timer_state?: { currentRound: number; timeRemaining: number; status: string } | null;
  score_events?: any[];
  /** Optional real-camera binding. Events remain usable without video; when a camera source is attached each event may carry a video timecode. */
  video_replay?: { sourceUrl?: string | null; sourceId?: string | null; durationSeconds?: number | null; attachedAt?: string | null } | null;
  statistics?: any;
  rounds_data?: any;
  round_winners?: any;
  tournament_id?: string | null;
  competition_mode?: string | null;
  team_names?: { chung: string; hong: string } | null;
  team_logos?: { chung?: string; hong?: string } | null;
  club_logos?: { chung?: string; hong?: string } | null;
  team_country?: { chung?: string; hong?: string } | null;
  // Par Équipe: full roster snapshot at save time — lets the match be
  // fully restored/replayed later (player names, numbers, photos) without
  // re-entering anything.
  player_ids?: { chung?: string | null; hong?: string | null };
  team_ids?: { chung?: string | null; hong?: string | null };
  club_ids?: { chung?: string | null; hong?: string | null };
  team_roster?: { chung: { name: string; nationality: string; rounds?: number; playerNumber?: number; seedNumber?: number; photo?: string }[]; hong: { name: string; nationality: string; rounds?: number; playerNumber?: number; seedNumber?: number; photo?: string }[] } | null;
  mvp_reveal?: { best?: { side: 'chung'|'hong'; name: string; photo?: string; nationality?: string; playerNumber?: number; seedNumber?: number; club?: string; points: number; gamjeom: number }; fairPlay?: { side: 'chung'|'hong'; name: string; photo?: string; nationality?: string; playerNumber?: number; seedNumber?: number; club?: string; points: number; gamjeom: number }; ts?: number } | null;
}

export function saveMatchLocal(m: LocalMatchRecord) {
  try {
    const updated_at = m.updated_at || m.saved_at || new Date().toISOString();
    // Match number is only unique inside one tournament/category. The old key
    // used competition_name + match_number, so Match #1 of -68 KG could
    // overwrite Match #1 of -58 KG when both belonged to the same tournament.
    // Keep the competition prefix for backward compatibility, but partition
    // by tournament id and then the stable match id.
    const tournamentKey = String(m.tournament_id || 'no-tournament');
    const matchKey = String(m.match_id || m.id || m.match_number);
    localStorage.setItem(PREFIX + m.competition_name + '_' + tournamentKey + '_' + matchKey, JSON.stringify({ ...m, updated_at }));
  } catch { /* ignore */ }
}

export function loadMatchesLocal(competitionName: string): LocalMatchRecord[] {
  const out: LocalMatchRecord[] = [];
  const prefix = PREFIX + competitionName + '_';
  const seen = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        try {
          const row = JSON.parse(localStorage.getItem(k) || '');
          const identity = String(row?.match_id || row?.id || `${row?.tournament_id || ''}|${row?.match_number || ''}`);
          // If both a legacy key and the new partitioned key exist, keep the
          // newest copy rather than counting the same match twice.
          const previous = out.findIndex(x => String(x.match_id || x.id || `${x.tournament_id || ''}|${x.match_number || ''}`) === identity);
          if (previous >= 0) {
            const oldTs = Date.parse(String(out[previous].updated_at || out[previous].saved_at || '')) || 0;
            const newTs = Date.parse(String(row.updated_at || row.saved_at || '')) || 0;
            if (newTs >= oldTs) out[previous] = row;
          } else if (!seen.has(identity)) {
            seen.add(identity); out.push(row);
          }
        } catch { /* skip corrupted entry */ }
      }
    }
  } catch { /* localStorage unavailable */ }
  return out;
}

/** All cached match records across every competition — used for the full local-data backup/export. */
export function loadAllMatchesLocal(): LocalMatchRecord[] {
  const out: LocalMatchRecord[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) {
        try { out.push(JSON.parse(localStorage.getItem(k) || '')); } catch { /* skip corrupted entry */ }
      }
    }
  } catch { /* localStorage unavailable */ }
  return out;
}
