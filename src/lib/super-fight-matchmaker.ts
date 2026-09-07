/**
 * Super Fight / Direct Finals matchmaker.
 *
 * This is deliberately deterministic at the rule level: it never mixes age
 * groups and it prefers different-club pairings. A caller may shuffle the
 * input before invoking it when a tournament wants a fresh draw.
 */
export type SuperFightStructure = 'independent_finals' | 'mini_knockout';
export type SuperFightSecondMedal = 'gold_silver' | 'bronze_third';

export interface SuperFightAthlete {
  id: string;
  name: string;
  club?: string | null;
  ageGroup?: string | null;
  category?: string | null;
}

export interface SuperFightMatch {
  match_id: number;
  stage: 'independent_final' | 'semi_final' | 'final' | 'bronze';
  category: string;
  player_1: { id: string; name: string; club?: string | null };
  player_2: { id: string; name: string; club?: string | null };
  target_medal: 'gold_silver' | 'bronze_third';
  prize: string;
}

export interface SuperFightMatchmakerSettings {
  structure: SuperFightStructure;
  independentSecondMatchMedal: SuperFightSecondMedal;
  avoidSameClub: boolean;
  separateAgeGroups: boolean;
}

const key = (value?: string | null) => (value || '').trim().toLowerCase();

function pairGroup(players: SuperFightAthlete[], avoidSameClub: boolean): [SuperFightAthlete, SuperFightAthlete][] {
  const remaining = [...players];
  const pairs: [SuperFightAthlete, SuperFightAthlete][] = [];
  while (remaining.length >= 2) {
    const first = remaining.shift()!;
    let index = 0;
    if (avoidSameClub && first.club) {
      const differentClub = remaining.findIndex(p => key(p.club) !== key(first.club));
      if (differentClub >= 0) index = differentClub;
    }
    const second = remaining.splice(index, 1)[0];
    pairs.push([first, second]);
  }
  return pairs;
}

export function generateSuperFightMatches(
  players: SuperFightAthlete[],
  settings: SuperFightMatchmakerSettings,
): { tournament_type: 'SUPER_FIGHT'; matches: SuperFightMatch[]; unpaired: SuperFightAthlete[] } {
  const groups = new Map<string, SuperFightAthlete[]>();
  for (const player of players) {
    const age = settings.separateAgeGroups ? key(player.ageGroup) : '__all__';
    const category = key(player.category) || 'default';
    const groupKey = `${age}::${category}`;
    const group = groups.get(groupKey) || [];
    group.push(player);
    groups.set(groupKey, group);
  }

  const matches: SuperFightMatch[] = [];
  const unpaired: SuperFightAthlete[] = [];
  let id = 1;

  for (const group of groups.values()) {
    const pairs = pairGroup(group, settings.avoidSameClub);
    const used = pairs.flat();
    for (const player of group) if (!used.some(p => p.id === player.id)) unpaired.push(player);
    const category = group[0]?.category || group[0]?.ageGroup || 'Open';

    if (settings.structure === 'independent_finals') {
      pairs.forEach(([a, b], pairIndex) => {
        const medal = pairIndex === 0 || settings.independentSecondMatchMedal === 'gold_silver'
          ? 'gold_silver'
          : 'bronze_third';
        matches.push({
          match_id: id++, stage: 'independent_final', category,
          player_1: { id: a.id, name: a.name, club: a.club },
          player_2: { id: b.id, name: b.name, club: b.club },
          target_medal: medal,
          prize: medal === 'gold_silver' ? 'Gold & Silver Match' : 'Bronze / 3rd Place Match',
        });
      });
      continue;
    }

    if (pairs.length === 2) {
      const [a, b] = pairs;
      matches.push(
        { match_id: id++, stage: 'semi_final', category, player_1: { id: a[0].id, name: a[0].name, club: a[0].club }, player_2: { id: a[1].id, name: a[1].name, club: a[1].club }, target_medal: 'gold_silver', prize: 'Semi-Final' },
        { match_id: id++, stage: 'semi_final', category, player_1: { id: b[0].id, name: b[0].name, club: b[0].club }, player_2: { id: b[1].id, name: b[1].name, club: b[1].club }, target_medal: 'gold_silver', prize: 'Semi-Final' },
      );
      // The finalists and bronze finalists are generated as dependency slots;
      // player IDs are intentionally left out until the semi-final winners exist.
      matches.push({ match_id: id++, stage: 'final', category, player_1: { id: 'winner_sf1', name: 'Winner SF1' }, player_2: { id: 'winner_sf2', name: 'Winner SF2' }, target_medal: 'gold_silver', prize: 'Gold & Silver Final' });
      matches.push({ match_id: id++, stage: 'bronze', category, player_1: { id: 'loser_sf1', name: 'Loser SF1' }, player_2: { id: 'loser_sf2', name: 'Loser SF2' }, target_medal: 'bronze_third', prize: 'Bronze / 3rd Place Match' });
    } else {
      // For more than four athletes, direct-fight mode remains pair based.
      pairs.forEach(([a, b]) => matches.push({
        match_id: id++, stage: 'independent_final', category,
        player_1: { id: a.id, name: a.name, club: a.club },
        player_2: { id: b.id, name: b.name, club: b.club },
        target_medal: 'gold_silver', prize: 'Gold & Silver Match',
      }));
    }
  }

  return { tournament_type: 'SUPER_FIGHT', matches, unpaired };
}
