export interface WinnerAnimationSettings {
  /** Whether the short cinematic intro should play before the final result. */
  enabled: boolean;
  /** Intro duration in seconds. 0 means show the final result immediately. */
  durationSeconds: number;
}

export const DEFAULT_WINNER_ANIMATION_SETTINGS: WinnerAnimationSettings = {
  enabled: true,
  durationSeconds: 3,
};

const STORAGE_KEY = 'wab-tkd-winner-animation-settings-v1';

function normalize(input: Partial<WinnerAnimationSettings> | null | undefined): WinnerAnimationSettings {
  const duration = Number(input?.durationSeconds);
  return {
    enabled: input?.enabled !== false,
    durationSeconds: Number.isFinite(duration)
      ? Math.min(10, Math.max(0, duration))
      : DEFAULT_WINNER_ANIMATION_SETTINGS.durationSeconds,
  };
}

export function normalizeWinnerAnimationDurationSeconds(value: unknown, fallback = 3): number {
  const duration = Number(value);
  return Number.isFinite(duration) ? Math.min(10, Math.max(0, duration)) : fallback;
}

export function shouldPlayWinnerIntro(enabled: unknown, durationSeconds: unknown): boolean {
  return enabled !== false && normalizeWinnerAnimationDurationSeconds(durationSeconds) > 0;
}

export function getWinnerAnimationSettings(): WinnerAnimationSettings {
  if (typeof window === 'undefined') return DEFAULT_WINNER_ANIMATION_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : DEFAULT_WINNER_ANIMATION_SETTINGS;
  } catch {
    return DEFAULT_WINNER_ANIMATION_SETTINGS;
  }
}

export function setWinnerAnimationSettings(
  patch: Partial<WinnerAnimationSettings>,
): WinnerAnimationSettings {
  const next = normalize({ ...getWinnerAnimationSettings(), ...patch });
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('wab-winner-animation-settings-changed', { detail: next }));
    } catch {
      // localStorage can be unavailable in restricted/private browser contexts.
    }
  }
  return next;
}
