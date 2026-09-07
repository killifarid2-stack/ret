import splashUrl from "@/assets/splash-banner.png";

/**
 * Cinematic arena backdrop — the WAB-TKD key art photo plus static lighting.
 * Floating dust / drifting beam animations were removed on request.
 */
export function ArenaBackground() {
  return (
    <div className="arena-bg" aria-hidden="true">
      <div className="photo" style={{ backgroundImage: `url(${splashUrl})` }} />
      <div className="side-glow red" />
      <div className="side-glow blue" />

      <div className="grid" />
      <div className="vignette" />
    </div>
  );
}
