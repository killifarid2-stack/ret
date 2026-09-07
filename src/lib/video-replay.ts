import type { LocalMatchRecord } from '@/lib/match-local';

export interface VideoReplayBinding {
  sourceUrl?: string | null;
  sourceId?: string | null;
  durationSeconds?: number | null;
  attachedAt?: string | null;
}

export function attachVideoReplay(match: LocalMatchRecord, binding: VideoReplayBinding): LocalMatchRecord {
  return { ...match, video_replay: { ...binding, attachedAt: binding.attachedAt || new Date().toISOString() } };
}

export function getEventVideoTimecode(event: any): number | null {
  const value = event?.videoTimecode ?? event?.video_timecode ?? event?.cameraTime ?? null;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function formatVideoTimecode(seconds: number | null): string {
  if (seconds == null) return '--:--';
  const s=Math.max(0,Math.floor(seconds));
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}
