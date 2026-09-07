import { describe, it, expect } from 'vitest';
import { createInitialMatchState, addScore, endRound, startNextRound } from './match-engine';

function next(s:any){ return startNextRound({ ...s, currentRound:s.currentRound+1 }); }

describe('World Taekwondo golden-round rules', () => {
  it('does not finish on one golden-round point', () => {
    let s:any=createInitialMatchState({ rounds:3, goldenRound:true });
    s={...s,currentRound:4,isGoldenRound:true,status:'fighting'};
    s=addScore(s,'chung','punch');
    expect(s.result).toBeUndefined();
    expect(s.status).toBe('fighting');
  });

  it('wins after two golden-round points', () => {
    let s:any=createInitialMatchState({ rounds:3, goldenRound:true });
    s={...s,currentRound:4,isGoldenRound:true,status:'fighting'};
    s=addScore(s,'chung','punch');
    expect(s.result).toBeUndefined();
    s=addScore(s,'chung','trunk_kick');
    expect(s.result?.winner).toBe('chung');
    expect(s.result?.method).toBe('GDP');
    expect(s.result?.finalScore).toEqual({chung:3,hong:0});
  });

  it('wins after opponent receives two golden-round Gam-jeoms', () => {
    let s:any=createInitialMatchState({ rounds:3, goldenRound:true });
    s={...s,currentRound:4,isGoldenRound:true,status:'fighting'};
    s=addScore(s,'hong','gamjeom');
    expect(s.result).toBeUndefined();
    s=addScore(s,'hong','gamjeom');
    expect(s.result?.winner).toBe('chung');
  });

  it('golden-round expiry uses punch point before PSS hits', () => {
    let s:any=createInitialMatchState({ rounds:3, goldenRound:true });
    s={...s,currentRound:4,isGoldenRound:true,status:'fighting'};
    s=addScore(s,'chung','punch','operator');
    s=addScore(s,'hong','trunk_kick','pss');
    s=endRound(s);
    expect(s.result?.winner).toBe('chung');
    expect(s.result?.method).toBe('SUP');
  });

  it('golden-round expiry falls back to referee when all official criteria tie', () => {
    let s:any=createInitialMatchState({ rounds:3, goldenRound:true });
    s={...s,currentRound:4,isGoldenRound:true,status:'fighting'};
    // Each side scores a single 1-point punch via PSS so punch points,
    // PSS-hit counts, regulation-round wins and Gam-jeoms are all tied —
    // neither reaches the golden round's 2-point threshold, so the round
    // must run to expiry and fall back to the superiority hierarchy.
    s=addScore(s,'chung','punch','pss');
    s=addScore(s,'hong','punch','pss');
    s=endRound(s);
    expect(s.result).toBeUndefined();
    expect(s.pendingRoundDecision).toBe(true);
  });

  it('ten Gam-jeoms finish an individual match by PUN, not PTG', () => {
    let s:any=createInitialMatchState({ rounds:3, goldenRound:true, gamjeomLimit:10, enforceGamjeomLimit:true });
    s={...s,status:'fighting'};
    for(let i=0;i<10;i++) s=addScore(s,'hong','gamjeom');
    expect(s.result?.winner).toBe('chung');
    expect(s.result?.method).toBe('PUN');
    expect(s.status).toBe('finished');
  });

});
