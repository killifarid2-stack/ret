# Broadcast Animation Integration Manifest

This project is the complete base archive. The following broadcast requirements are now the integration contract for future animation changes:

- Player Call: dynamic player/tournament data, Main Referee controls, READY/CONFIRM path, configurable timing and clean transition to match.
- Team Call: independent TEAM CALL CONTROLS, BLUE/RED call and recall, replay/stop, auto/hold, READY/CONFIRM, head-referee confirmation, next/reset/start/go-live and direct stage jumps.
- Bar Équipe player change: separate BLUE/RED selection, outgoing/incoming player cards with photo, name and number, dynamic roster data, and side-specific broadcast change animation.
- Winner animation: 1:1 player image, raised left placement, horizontal round/medal cards, medal-only glow, tournament title in gold, framed tournament metadata, framed match number/result, all dynamic.
- Every broadcast animation renders on the 1920x1080 / 16:9 Public Display and must fill the broadcast canvas without replacing its original motion design.
- Performance contract: preload where possible, transform/opacity animation, no page reload between stages, cleanup timers/frames, and never run competing animations simultaneously.
- Original files/assets/database/match logic remain the base and are not deleted solely to add an animation.
