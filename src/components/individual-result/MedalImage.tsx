import medalAsset from "@/assets/medal.png";

export type MedalMaterial = "gold" | "silver";

/**
 * Material treatment applied to the single source medal artwork.
 * Shape, ribbon, emblem and engraving are never altered — only the metal.
 */
export const MEDAL_FILTER: Record<MedalMaterial, string> = {
  gold: "saturate(1.12) contrast(1.12) brightness(1.06)",
  silver:
    "grayscale(1) brightness(1.34) contrast(1.16) saturate(0.2) hue-rotate(185deg)",
};

export const MEDAL_URL = medalAsset;

interface MedalDiscProps {
  /** Rendered diameter of the medal disc in px. */
  size: number;
  material?: MedalMaterial;
  /** Glow color emitted by the medal itself (round winner color, or gold). */
  aura?: string;
  className?: string;
  alt?: string;
}

/**
 * Crops the championship medal disc out of the full artwork (ribbon excluded).
 * The medal itself glows — no lit rings or halo circles are drawn around it.
 */
export function MedalDisc({
  size,
  material = "gold",
  aura,
  className = "",
  alt = "WAB-TKD championship medal",
}: MedalDiscProps) {
  const isGold = material === "gold";
  const halo = aura ?? (isGold ? "var(--gold-bright)" : "oklch(0.92 0.02 250)");
  const rim = isGold ? "var(--gold)" : "oklch(0.9 0.015 250)";
  /** artwork width needed so the disc (~68% of artwork) fills the box */
  const artWidth = size / 0.68;

  const discMask =
    "radial-gradient(circle at 50% 50%, oklch(0 0 0) 0 49%, transparent 51%)";


  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        /* glow follows the medal silhouette itself — no lit ring or square halo */
        filter: `drop-shadow(0 0 8px color-mix(in oklab, ${rim} 85%, transparent)) drop-shadow(0 0 20px color-mix(in oklab, ${halo} 65%, transparent)) drop-shadow(0 4px 10px oklch(0 0 0 / 0.55))`,
      }}
    >
      <span
        className="relative block h-full w-full"
        style={{ maskImage: discMask, WebkitMaskImage: discMask }}
      >
        <img
          src={MEDAL_URL}
          alt={alt}
          width={size}
          height={size}
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            width: artWidth,
            height: "auto",
            /* disc bottom sits at ~97.7% of artwork height */
            bottom: `-${Math.round(artWidth * 0.035)}px`,

            imageRendering: "auto",
            filter: MEDAL_FILTER[material],
          }}
        />
      </span>
    </span>
  );
}
