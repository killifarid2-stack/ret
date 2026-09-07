import medalAsset from "@/assets/medal.png";

type MedalVariant = "gold" | "silver" | "bronze";
interface MedalProps { variant?: MedalVariant; size?: number; className?: string; glow?: boolean; }
const FILTERS: Record<MedalVariant, string> = {
  gold: "none",
  silver: "grayscale(1) brightness(1.28) contrast(1.05)",
  bronze: "sepia(0.9) saturate(2.1) hue-rotate(335deg) brightness(.78) contrast(1.08)",
};
function srcFor(_variant: MedalVariant) { return medalAsset; }
export function Medal({ variant = "gold", size = 44, className = "", glow = true }: MedalProps) {
  return <span className={`relative inline-block shrink-0 ${glow ? "animate-glow-pulse" : ""} ${className}`} style={{ width: size, height: size }}>
    <img src={srcFor(variant)} alt={`${variant} medal`} loading="lazy" width={size} height={size} className="h-full w-full object-contain object-bottom mix-blend-screen" style={{ objectPosition: "center 92%", transform: "scale(2.7)", filter: FILTERS[variant] }} />
  </span>;
}
export function MedalFull({ size = 260, variant = "gold" as MedalVariant, className = "" }) {
  return <img src={srcFor(variant)} alt="WAB-TKD champion medal" loading="lazy" width={size} height={size * 1.5} className={`animate-glow-pulse object-contain mix-blend-screen ${className}`} style={{ width: size, height: "auto", filter: FILTERS[variant] }} />;
}
