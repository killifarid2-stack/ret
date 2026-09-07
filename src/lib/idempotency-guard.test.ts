import { describe, it, expect } from 'vitest';
import { createIdempotencyGuard } from './idempotency-guard';

describe('createIdempotencyGuard', () => {
  it('accepts a new id the first time', () => {
    const guard = createIdempotencyGuard();
    expect(guard.markProcessed('vote-1')).toBe(true);
    expect(guard.size()).toBe(1);
  });

  it('rejects the same id on every subsequent call', () => {
    const guard = createIdempotencyGuard();
    expect(guard.markProcessed('vote-1')).toBe(true);
    expect(guard.markProcessed('vote-1')).toBe(false);
    expect(guard.markProcessed('vote-1')).toBe(false);
    expect(guard.size()).toBe(1);
  });

  it('tracks different ids independently', () => {
    const guard = createIdempotencyGuard();
    expect(guard.markProcessed('vote-1')).toBe(true);
    expect(guard.markProcessed('vote-2')).toBe(true);
    expect(guard.markProcessed('vote-1')).toBe(false);
    expect(guard.markProcessed('vote-2')).toBe(false);
    expect(guard.size()).toBe(2);
  });

  it('evicts the oldest id once the cap is exceeded (bounded memory)', () => {
    const guard = createIdempotencyGuard(3);
    guard.markProcessed('a');
    guard.markProcessed('b');
    guard.markProcessed('c');
    expect(guard.size()).toBe(3);
    // A 4th distinct id evicts the oldest ('a') to stay within the cap.
    guard.markProcessed('d');
    expect(guard.size()).toBe(3);
    // 'b', 'c', 'd' are still tracked, so they're correctly rejected as duplicates.
    expect(guard.markProcessed('b')).toBe(false);
    expect(guard.markProcessed('c')).toBe(false);
    expect(guard.markProcessed('d')).toBe(false);
    // 'a' was evicted, so re-seeing it is treated as brand new — checked last,
    // since re-adding it would itself evict 'b' next and cascade further.
    expect(guard.markProcessed('a')).toBe(true);
  });

  it('two independent guards do not share state', () => {
    const guardA = createIdempotencyGuard();
    const guardB = createIdempotencyGuard();
    expect(guardA.markProcessed('shared-id')).toBe(true);
    expect(guardB.markProcessed('shared-id')).toBe(true);
  });
});
