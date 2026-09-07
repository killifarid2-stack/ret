// Player name display formatting for the TV/broadcast call screens.
// Kept in its own module because it's shared between the format picker
// buttons (nameFormatLabels) and the actual on-screen renderer
// (formatPlayerName). 'large-initial' and 'stacked' are rendered as
// multi-span JSX directly by <Name/> in ExactTeamCallBroadcast.tsx, so
// this module only needs to handle plain-string output for 'full' and
// 'initial' — but all four keys must exist here for the format-picker
// button row (Object.keys(nameFormatLabels)) to list them all.

export type NameFormat = 'full' | 'initial' | 'large-initial' | 'stacked';

export const nameFormatLabels: Record<NameFormat, string> = {
  full: 'FULL',
  initial: 'INITIAL',
  'large-initial': 'LARGE',
  stacked: 'STACKED',
};

/**
 * Formats a player's full name for on-screen display.
 * - 'full': returned unchanged.
 * - 'initial': "First L." — first name plus the initial of the surname.
 * - 'large-initial' / 'stacked': not handled here (rendered as JSX by the
 *   caller); falls back to the full name if ever called directly.
 */
export function formatPlayerName(value: string, format: NameFormat): string {
  const name = (value || '').trim();
  if (!name) return '';

  const parts = name.split(/\s+/);
  const first = parts[0] || '';
  const rest = parts.slice(1).join(' ');

  if (format === 'initial') {
    const lastInitial = rest ? `${rest[0].toUpperCase()}.` : '';
    return lastInitial ? `${first} ${lastInitial}` : first;
  }

  if (format === 'large-initial') {
    return rest ? `${first.charAt(0).toUpperCase()}. ${rest}` : first;
  }

  if (format === 'stacked') {
    return rest ? `${first}\n${rest}` : first;
  }

  return name;
}
