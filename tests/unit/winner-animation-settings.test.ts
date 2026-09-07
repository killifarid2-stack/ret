import { describe, expect, it } from "vitest";
import {
  normalizeWinnerAnimationDurationSeconds,
  shouldPlayWinnerIntro,
} from "@/lib/winner-animation-settings";

describe("winner animation controls", () => {
  it("keeps the production default at 3 seconds", () => {
    expect(normalizeWinnerAnimationDurationSeconds(undefined)).toBe(3);
  });
  it("clamps duration to the supported 0–10 second range", () => {
    expect(normalizeWinnerAnimationDurationSeconds(-4)).toBe(0);
    expect(normalizeWinnerAnimationDurationSeconds(4.5)).toBe(4.5);
    expect(normalizeWinnerAnimationDurationSeconds(25)).toBe(10);
    expect(normalizeWinnerAnimationDurationSeconds("not-a-number")).toBe(3);
  });
  it("plays only when enabled and duration is greater than zero", () => {
    expect(shouldPlayWinnerIntro(true, 3)).toBe(true);
    expect(shouldPlayWinnerIntro(false, 3)).toBe(false);
    expect(shouldPlayWinnerIntro(true, 0)).toBe(false);
    expect(shouldPlayWinnerIntro(true, -1)).toBe(false);
  });
});
