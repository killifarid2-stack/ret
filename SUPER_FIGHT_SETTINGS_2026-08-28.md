# Super Fight / Direct Finals — Admin Settings

Added to the existing project without creating a new database or replacing the match system.

## Competition type
- `SUPER_FIGHT` is now an available tournament mode.

## Admin settings
- Match Structure:
  - Independent Finals
  - Mini Knockout (Semi-Finals + Final + Bronze)
- For Independent Finals, second-match medal target:
  - Gold & Silver
  - Bronze / 3rd Place
- Strict age-group separation
- Avoid same-club matchups when possible

## Matchmaker
`src/lib/super-fight-matchmaker.ts` provides the reusable pairing engine and keeps age groups separated while preferring different clubs. For four athletes in Mini Knockout it creates two semi-finals plus dependency slots for the final and bronze match.

The existing 1v1, League, Knockout, Par Équipe, animations, score logic, and database remain intact.
