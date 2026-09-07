/**
 * WAB-TKD Smart Matchmaker / Bracket Generator integration.
 *
 * Extension only: it prepares entrants before the existing match engine runs.
 * It never replaces scoring, match lifecycle, or the existing bracket engine.
 */
import { Player } from '@/types/tkd';
import { generateBracket } from '@/lib/match-engine';
import { orderEntrantsForFairBracket, separateSameClubFirstRound } from '@/lib/bracket-seeding';

export interface SmartMatchmakerSettings {
  allowSoloPlayerMerge?: boolean;
  avoidSameClubFirstRounds?: boolean;
  separateAgeGroups?: boolean;
}

export interface SoloMergeRecord {
  player_id: string;
  player_name: string;
  original_category: string;
  new_category: string;
  reason: 'nearest_weight';
}

export interface SmartPreparedEntrants {
  players: Player[];
  merged_categories: SoloMergeRecord[];
  unpaired: Player[];
}

const norm = (v?: string | null) => String(v || '').trim().toLowerCase();

/** Extracts the numeric weight from labels such as -45 kg, 48KG, +80 kg. */
function weightValue(category?: string | null): number | null {
  const text = String(category || '').replace(',', '.');
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/**
 * Groups by category and moves a true solo category into the nearest category
 * represented by at least two athletes. Age groups are never crossed here.
 * If no safe same-age target exists, the solo athlete stays where they are.
 */
export function mergeSoloPlayersByNearestCategory(
  players: Player[],
  currentAgeGroup?: string | null,
  settings: SmartMatchmakerSettings = {},
): SmartPreparedEntrants {
  if (settings.allowSoloPlayerMerge === false || players.length < 2) {
    return { players: [...players], merged_categories: [], unpaired: players.length % 2 ? [players[players.length - 1]] : [] };
  }

  const groups = new Map<string, Player[]>();
  for (const p of players) {
    const category = norm(p.category) || 'default';
    const list = groups.get(category) || [];
    list.push(p);
    groups.set(category, list);
  }

  const mergeTargets = Array.from(groups.entries()).filter(([, list]) => list.length >= 2);
  if (!mergeTargets.length) {
    return { players: [...players], merged_categories: [], unpaired: players.length % 2 ? [players[players.length - 1]] : [] };
  }

  const result = players.map(p => ({ ...p }));
  const merged_categories: SoloMergeRecord[] = [];

  for (const [category, list] of groups.entries()) {
    if (list.length !== 1) continue;
    const solo = list[0];
    const soloWeight = weightValue(solo.category);
    if (soloWeight == null) continue;

    const candidates = mergeTargets
      .map(([targetCategory, targetPlayers]) => ({ targetCategory, targetPlayers, distance: Math.abs((weightValue(targetCategory) ?? soloWeight) - soloWeight) }))
      .filter(c => c.targetCategory !== category)
      .sort((a, b) => a.distance - b.distance || a.targetCategory.localeCompare(b.targetCategory));

    const target = candidates[0];
    if (!target) continue;

    const index = result.findIndex(p => p.id === solo.id);
    if (index >= 0) {
      result[index] = { ...result[index], category: target.targetCategory };
      merged_categories.push({
        player_id: solo.id,
        player_name: solo.name,
        original_category: solo.category || category,
        new_category: target.targetCategory,
        reason: 'nearest_weight',
      });
    }
  }

  return {
    players: result,
    merged_categories,
    unpaired: result.length % 2 ? [result[result.length - 1]] : [],
  };
}

export function generateSmartKnockout(
  players: Player[],
  ageGroup?: string | null,
  settings: SmartMatchmakerSettings = {},
) {
  const prepared = mergeSoloPlayersByNearestCategory(players, ageGroup, settings);
  const fair = orderEntrantsForFairBracket(prepared.players);
  const generated = generateBracket(fair as { id: string; name: string; nationality: string }[]);
  const matches = settings.avoidSameClubFirstRounds === false
    ? generated.matches
    : separateSameClubFirstRound(generated.matches as any, fair as any);

  return {
    ...generated,
    matches,
    ...prepared,
    tournament_info: {
      status: 'success' as const,
      merged_categories: prepared.merged_categories,
    },
  };
}

export interface LeagueScheduleResult {
  matches: Array<{ id: string; matchNumber: number; round: number; player1: Player; player2: Player }>;
  totalRounds: number;
  totalMatches: number;
  merged_categories: SoloMergeRecord[];
}

/** Full round-robin schedule. Existing results are never touched by this generator. */
export function generateSmartLeague(players: Player[], ageGroup?: string | null, settings: SmartMatchmakerSettings = {}): LeagueScheduleResult {
  const prepared = mergeSoloPlayersByNearestCategory(players, ageGroup, settings);
  const list = prepared.players;
  const totalRounds = list.length <= 1 ? 0 : (list.length % 2 === 0 ? list.length - 1 : list.length);
  const totalMatches = list.length * Math.max(0, list.length - 1) / 2;

  if (list.length < 2) return { matches: [], totalRounds, totalMatches, merged_categories: prepared.merged_categories };

  const bye = list.length % 2 ? [{ id: '__BYE__', name: 'BYE', nationality: '' } as Player] : [];
  const roster = [...list, ...bye];
  const n = roster.length;
  let rotation = [...roster];
  const matches: LeagueScheduleResult['matches'] = [];
  let matchNumber = 1;

  for (let round = 1; round <= totalRounds; round++) {
    const half = n / 2;
    for (let i = 0; i < half; i++) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (a.id !== '__BYE__' && b.id !== '__BYE__') {
        const first = settings.avoidSameClubFirstRounds !== false && round <= Math.max(1, Math.floor(totalRounds / 2)) && norm(a.club) && norm(a.club) === norm(b.club)
          ? b : a;
        const second = first.id === a.id ? b : a;
        matches.push({ id: crypto.randomUUID(), matchNumber: matchNumber++, round, player1: first, player2: second });
      }
    }
    rotation = [rotation[0], rotation[n - 1], ...rotation.slice(1, n - 1)];
  }

  return { matches, totalRounds, totalMatches, merged_categories: prepared.merged_categories };
}
