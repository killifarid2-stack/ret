# متابعة الدمج النهائي — 2026-09-04

- Winner Result continues to use the supplied Winner composition and bundled assets; no generated/recreated images were added.
- Fixed Winner/KO/medal/player-call artwork is resolved from `src/assets` / `src/assets/animations`.
- Main Referee and Public/Broadcast flag rendering use the same local `src/assets/flags/*.svg` resolver.
- Removed emoji flag fallback from the visual broadcast path; when a local flag asset is unavailable, the ISO code is shown instead of inventing a flag image.
- Individual Player Call now falls back to `CHANG (청)` for BLUE and `HONG (홍)` for RED when player information is missing.
- Winner Result displays the actual result method and decisive/result round; KO uses the existing bundled RED/BLUE KO asset.
- Public Winner remains isolated to the second/public display and uses the shared 1920x1080 uniform viewport.
- Text-only country fallbacks now use ISO codes; no emoji/generated flag is used as a broadcast flag.
