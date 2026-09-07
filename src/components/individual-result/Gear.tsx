import helmetBlue from "@/assets/hit-stats/headgear-blue.png";
import helmetRed from "@/assets/hit-stats/headgear-red.png";
import chestBlue from "@/assets/hit-stats/hogu-blue.png";
import chestRed from "@/assets/hit-stats/hogu-red.png";
import type { Corner } from "./types";

interface GearProps { corner?: Corner; size?: number; className?: string; }

export function HeadGear({ corner = "blue", size = 48, className = "" }: GearProps) {
  return <img src={corner === "blue" ? helmetBlue : helmetRed} alt={`${corner} corner WAB-TKD head guard`} loading="lazy" width={size} height={size} style={{ width: size, height: "auto" }} className={`object-contain drop-shadow-[0_0_14px_color-mix(in_oklab,var(--gold)_45%,transparent)] ${className}`} />;
}
export function ChestGear({ corner = "blue", size = 48, className = "" }: GearProps) {
  return <img src={corner === "blue" ? chestBlue : chestRed} alt={`${corner} corner WAB-TKD chest protector`} loading="lazy" width={size} height={size} style={{ width: size, height: "auto" }} className={`object-contain drop-shadow-[0_0_14px_color-mix(in_oklab,var(--gold)_45%,transparent)] ${className}`} />;
}
