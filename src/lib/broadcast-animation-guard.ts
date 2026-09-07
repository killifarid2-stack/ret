/** Shared guard for broadcast animations: one active animation at a time,
 * cancellable timers, and deterministic cleanup when returning to LIVE. */
export class BroadcastAnimationGuard {
  private timers = new Set<number>();
  private active: string | null = null;
  start(id: string, cancel?: () => void) { if (this.active && this.active !== id) cancel?.(); this.clear(); this.active = id; }
  after(ms: number, fn: () => void) { const t = window.setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); return t; }
  stop(id?: string) { if (!id || this.active === id) { this.clear(); this.active = null; } }
  private clear() { this.timers.forEach(window.clearTimeout); this.timers.clear(); }
}
export const broadcastAnimationGuard = new BroadcastAnimationGuard();
