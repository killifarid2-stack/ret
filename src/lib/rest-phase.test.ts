import { describe, expect, it } from 'vitest';
import { getRestPhase, getRestPhaseLabel } from './rest-phase';

describe('rest phase', () => {
  it('keeps normal rest separate from preparation', () => {
    expect(getRestPhase(45, 'rest', 60)).toBe('REST');
    expect(getRestPhase(10, 'rest', 60)).toBe('PREPARE');
    expect(getRestPhase(5, 'rest', 60)).toBe('GET_READY');
  });
  it('never treats an ended rest as an automatic start', () => {
    expect(getRestPhase(0, 'paused', 60)).toBe('REFEREE_CONFIRM');
  });
  it('has bilingual labels', () => {
    expect(getRestPhaseLabel('REFEREE_CONFIRM', 'ar')).toContain('تأكيد');
    expect(getRestPhaseLabel('GET_READY', 'en')).toContain('GET READY');
  });
});
