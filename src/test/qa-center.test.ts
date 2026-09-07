import { describe, expect, it } from 'vitest';
import { QA_SUITES, isReleaseReady, summarize } from '@/lib/qa-center';

describe('WAB-TKD QA release gate', () => {
  it('requires every suite to pass before release', () => {
    const results = Object.fromEntries(QA_SUITES.map(s => [s.id, 'PASS'])) as Record<string,'PASS'|'FAIL'>;
    expect(isReleaseReady(results)).toBe(true);
    results[QA_SUITES[0].id] = 'FAIL';
    expect(isReleaseReady(results)).toBe(false);
  });
  it('summarizes test states deterministically', () => {
    const results = {auth:'PASS', 'match-flow':'FAIL'} as Record<string, any>;
    const s = summarize(results);
    expect(s.total).toBe(QA_SUITES.length);
    expect(s.pass).toBe(1);
    expect(s.fail).toBe(1);
    expect(s.notRun).toBe(QA_SUITES.length - 2);
  });
});
