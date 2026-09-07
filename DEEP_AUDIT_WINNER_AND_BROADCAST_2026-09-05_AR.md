# WAB-TKD — Deep Audit 2026-09-05

## Confirmed fixes in this delivery

1. Winner/Result public animation continues to use the configured duration (0–10s, default 3s).
2. Winner intro remains isolated to the public display layer.
3. Winner artwork now resolves the supplied local `src/assets/medal.png` instead of the external `.asset.json` URL used by the old championship-medal component.
4. Winner/Result arena background now uses the supplied local `src/assets/animations/player-call/arena-bg.png` instead of `arena.jpg.asset.json`.
5. Electron match-state synchronization now broadcasts to every open public display, not only the last opened display.
6. Electron public-display status now reports the complete `openDisplays` list to the operator UI.

## Deep-audit findings still requiring attention

### A. Local fonts
`src/index.css` and the exact player-call CSS still import Orbitron, Inter, Cairo and Rajdhani from Google Fonts. The visual identity is correct when the fonts are available, but a venue with no Internet connection can fall back to system fonts. For a truly offline broadcast release, the exact font files should be bundled locally and loaded with `@font-face`.

### B. Country flags
The current local flag directory contains only `gb.svg`, `kr.svg`, `ma.svg`, and `tr.svg`. The country mapping covers many countries, but most mapped countries do not have a corresponding local SVG. In an offline venue this can produce an empty flag for countries outside those four. A production release should bundle the complete required country set locally.

### C. Legacy/external asset manifests
The project still contains `.asset.json` manifests whose `url` points to the original platform asset service. The current Winner path no longer depends on the arena/medal manifests changed above, but other parts of the project may still use them. The production asset audit therefore correctly reports 24 external asset references. A complete offline asset migration should replace every remaining runtime `.asset.json` dependency with a bundled local image and then re-run the asset audit.

### D. Production validation
The structural/final feature/production audits pass. `npm install` could not complete in the test environment because it timed out, so ESLint/Vite/Playwright could not be executed there. `node --check` passes for the Electron entry points and production audit scripts.

### E. Regression-test coverage
The existing E2E suite is a smoke suite. It does not yet exercise the complete Winner flow: individual match finish → confirmation → 3s intro → final result, duration 0/1/3/5/10, disabled mode, replay/re-render protection, or two simultaneous public displays. These should be added as release-gate tests on a machine with dependencies installed.

## Recommended final additions

- Bundle exact fonts locally.
- Bundle the complete country-flag set required by the tournament.
- Add Winner-animation unit/E2E tests for duration, OFF/0s, and one-shot behavior.
- Add a two-public-display regression test.
- Complete the remaining external `.asset.json` migration and require `production:asset-audit` to pass without REVIEW REQUIRED.
