import { beforeEach, describe, expect, it } from 'vitest';
import { acquireMatchLease, getMatchLease, releaseMatchLease, renewMatchLease } from './mat-conflict';
import { runLocalReadiness } from './release-readiness';
import { QA_SUITES } from './qa-center';

describe('final integration readiness', () => {
  beforeEach(() => localStorage.clear());

  it('prevents two operators from controlling the same match', () => {
    expect(acquireMatchLease('m1', 'pc-a', 1).ok).toBe(true);
    const conflict = acquireMatchLease('m1', 'pc-b', 2);
    expect(conflict.ok).toBe(false);
    expect(conflict.conflict?.ownerId).toBe('pc-a');
    expect(getMatchLease('m1')?.matNumber).toBe(1);
  });

  it('allows the owner to renew and release its lease', () => {
    expect(acquireMatchLease('m2', 'pc-a', 2).ok).toBe(true);
    expect(renewMatchLease('m2', 'pc-a')).toBe(true);
    expect(releaseMatchLease('m2', 'pc-a')).toBe(true);
    expect(getMatchLease('m2')).toBeNull();
  });

  it('does not declare release ready until every QA suite passes', () => {
    const pass = Object.fromEntries(QA_SUITES.map(s => [s.id, 'PASS'])) as any;
    expect(runLocalReadiness(pass).ready).toBe(true);
    pass[QA_SUITES[0].id] = 'FAIL';
    expect(runLocalReadiness(pass).ready).toBe(false);
  });
});
