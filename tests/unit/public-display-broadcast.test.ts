import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const mainSource = fs.readFileSync(path.resolve(process.cwd(), "electron/main.cjs"), "utf8");

describe("public display broadcast isolation", () => {
  it("broadcasts MatchState to every open public display window", () => {
    expect(mainSource).toContain("for (const win of publicWins.values())");
    expect(mainSource).toContain("win.webContents.send('match-state-sync', state)");
  });
  it("reports all currently open public displays", () => {
    expect(mainSource).toContain("openDisplays: Array.from(publicWins.values())");
  });
});
