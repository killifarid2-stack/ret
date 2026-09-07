// Extracted from OperatorScreen's judge-vote handling so it can be unit
// tested in isolation (item #11) — same "belt-and-suspenders" guard: a
// single judge vote/request should never be able to add a score twice.
// Every id that has actually resulted in a real score dispatch gets
// recorded here first; any further delivery of the same id (duplicate
// network delivery, a leftover zombie channel, a judge phone's own retry,
// React StrictMode's dev-only double effect invocation, etc.) is a no-op.
// Capped so a whole day-long tournament doesn't grow this unboundedly.
export interface IdempotencyGuard {
  /** Returns true (and records the id) the first time it's seen; returns
   *  false — a no-op — for every subsequent call with the same id. */
  markProcessed(id: string): boolean;
  /** Number of ids currently tracked (for tests/diagnostics only). */
  size(): number;
}

export function createIdempotencyGuard(maxSize = 500): IdempotencyGuard {
  const order: string[] = [];
  const seen = new Set<string>();

  return {
    markProcessed(id: string): boolean {
      if (seen.has(id)) return false;
      seen.add(id);
      order.push(id);
      if (order.length > maxSize) {
        const oldest = order.shift()!;
        seen.delete(oldest);
      }
      return true;
    },
    size(): number {
      return seen.size;
    },
  };
}
