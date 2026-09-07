import { MEDAL_URL, MEDAL_FILTER } from "./MedalImage";

interface ChampionshipMedalProps {
  /** Total artwork width in px (ribbon + disc). The disc is ~50% of this. */
  width?: number;
  className?: string;
}

/**
 * Independent, animation-ready championship medal — full original WAB-TKD
 * artwork (ribbon, emblem, laurels) with its ribbon continuing past the top
 * boundary so the medal reads as hanging in from outside the screen.
 * The component never renders wider than `width`, so it can never overlap the
 * neighbouring broadcast frames on fullscreen or audience screens.
 */
export function ChampionshipMedal({ width = 200, className = "" }: ChampionshipMedalProps) {
  const artWidth = width;
  const artHeight = artWidth * 1.499;
  const discSize = artWidth * 0.68;
  /* full medal visible — ribbon and disc both inside the lane */
  const topOffset = 0;


  return (
    <div
      className={`pointer-events-none relative w-full ${className}`}
      style={{ maxWidth: artWidth, height: artHeight + topOffset }}
    >
      <div className="absolute inset-x-0" style={{ top: topOffset }}>
        <div className="animate-medal-drop relative w-full">
          {/* rotating light rays behind the disc (contained inside the lane) */}
          <div
            className="animate-ray-spin absolute opacity-40"
            style={{
              left: "50%",
              top: "80%",
              width: discSize * 1.8,
              height: discSize * 1.8,
              transform: "translate(-50%, -50%)",
              background:
                "conic-gradient(from 0deg, transparent 0 6deg, color-mix(in oklab, var(--gold) 32%, transparent) 6deg 9deg, transparent 9deg 30deg)",
              maskImage: "radial-gradient(circle, oklch(0 0 0) 16%, transparent 68%)",
              WebkitMaskImage: "radial-gradient(circle, oklch(0 0 0) 16%, transparent 68%)",
            }}
          />
          {/* warm light spill onto the surrounding interface */}
          <div
            className="absolute rounded-full"
            style={{
              left: "50%",
              top: "80%",
              width: discSize * 1.7,
              height: discSize * 1.7,
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(circle, color-mix(in oklab, var(--gold-bright) 38%, transparent), transparent 62%)",
              filter: "blur(10px)",
            }}
          />

          <img
            src={MEDAL_URL}
            alt="WAB-TKD championship gold medal"
            width={Math.round(artWidth)}
            height={Math.round(artHeight)}
            className="animate-glow-pulse relative block w-full mix-blend-screen"
            style={{
              height: "auto",
              filter: `${MEDAL_FILTER.gold} drop-shadow(0 18px 30px oklch(0 0 0 / 0.72)) drop-shadow(0 0 30px color-mix(in oklab, var(--gold) 60%, transparent))`,
            }}
          />

          {/* golden sparks rising around the disc */}
          {[20, 35, 50, 65, 80].map((left, i) => (
            <span
              key={left}
              className="animate-spark-rise absolute h-1 w-1 rounded-full bg-gold-bright"
              style={{
                left: `${left}%`,
                top: "86%",
                animationDelay: `${i * 0.55}s`,
                boxShadow: "0 0 10px color-mix(in oklab, var(--gold-bright) 90%, transparent)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
