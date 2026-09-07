import { useMemo } from "react";
import splashBanner from "@/assets/splash-banner.png";
import { ANIMATION_ASSETS } from "@/assets/animations";
import type { BroadcastState } from "@/lib/player-call/types";
import { getFocus } from "@/lib/player-call/use-broadcast-machine";

type Props = { state: BroadcastState; reducedMotion?: boolean };

/**
 * Multi-layer cinematic arena background:
 * photo plate → depth grade → volumetric beams → colour spill → haze/fog
 * → HUD grid + technical marks → particles → vignette + film grain.
 */
export function BroadcastBackground({ state, reducedMotion = false }: Props) {
  const focus = getFocus(state);

  const particles = useMemo(
    () =>
      Array.from({ length: 70 }).map((_, i) => {
        const r = ((i * 9301 + 49297) % 233280) / 233280;
        const r2 = ((i * 4099 + 7907) % 233280) / 233280;
        const r3 = ((i * 6151 + 1301) % 233280) / 233280;
        return {
          left: r * 100,
          top: r2 * 100,
          size: 1 + (i % 4) * 0.9,
          delay: (r3 * 8).toFixed(2),
          duration: (8 + r2 * 10).toFixed(2),
          opacity: 0.35 + r3 * 0.6,
        };
      }),
    [],
  );

  const beams = useMemo(
    () => [
      { left: 8, rotate: -14, width: 190, color: "255,52,66", delay: "0s" },
      { left: 22, rotate: -8, width: 130, color: "255,90,70", delay: "1.4s" },
      { left: 38, rotate: -3, width: 150, color: "255,196,84", delay: "2.2s" },
      { left: 50, rotate: 0, width: 220, color: "255,214,120", delay: "0.6s" },
      { left: 62, rotate: 3, width: 150, color: "255,196,84", delay: "3s" },
      { left: 78, rotate: 8, width: 130, color: "70,150,255", delay: "1.8s" },
      { left: 92, rotate: 14, width: 190, color: "40,140,255", delay: "0.9s" },
    ],
    [],
  );

  const redOn = focus === "red" || focus === "both";
  const blueOn = focus === "blue" || focus === "both";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#01030a]">
      {/* 1 — arena photo plate, slowly breathing */}
      <img
        src={ANIMATION_ASSETS.playerArena}
        alt=""
        aria-hidden="true"
        className="pc-drift absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.55]"
        style={{ filter: "saturate(0.55) contrast(1.35) brightness(0.5)" }}
      />

      {/* 1b — championship splash plate (WAB-TKD key art) */}
      <img
        src={splashBanner}
        alt=""
        aria-hidden="true"
        className="pc-drift-slow absolute inset-0 h-full w-full scale-[1.06] object-cover opacity-[0.5] mix-blend-screen"
        style={{ filter: "saturate(1.15) contrast(1.1) brightness(0.85)" }}
      />
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0.2) 0%, rgba(0,2,8,0.72) 55%, rgba(0,1,5,0.95) 100%)",
        }}
      />

      {/* 2 — deep cinematic grade */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(6,12,30,0.25)_0%,rgba(2,4,10,0.88)_62%,#000106_100%)]" />
      <div className="absolute inset-0 mix-blend-color bg-[linear-gradient(90deg,rgba(120,10,20,0.55)_0%,rgba(6,8,20,0)_35%,rgba(6,8,20,0)_65%,rgba(10,40,120,0.55)_100%)]" />

      {/* 3 — volumetric spotlight beams from the rig */}
      <div className="absolute inset-0" style={{ opacity: reducedMotion ? 0.35 : 1 }}>
        {(reducedMotion ? beams.slice(2, 5) : beams).map((b, i) => (
          <span
            key={i}
            className="pc-beam absolute -top-[22%] block h-[150%] origin-top"
            style={{
              left: `${b.left}%`,
              width: b.width,
              marginLeft: -b.width / 2,
              transform: `rotate(${b.rotate}deg)`,
              animationDelay: b.delay,
              background: `linear-gradient(to bottom, rgba(${b.color},0.42) 0%, rgba(${b.color},0.16) 35%, rgba(${b.color},0.03) 68%, transparent 100%)`,
              filter: "blur(26px)",
              clipPath: "polygon(42% 0%, 58% 0%, 100% 100%, 0% 100%)",
            }}
          />
        ))}
      </div>

      {/* 4 — side colour spill, reacting to focus */}
      <div
        className="absolute -left-52 top-0 h-full w-[52%] transition-opacity duration-1000"
        style={{
          opacity: redOn ? 1 : focus === "blue" ? 0.18 : 0.5,
          background:
            "radial-gradient(ellipse at 18% 48%, rgba(255,38,52,0.6) 0%, rgba(140,10,22,0.24) 42%, transparent 72%)",
        }}
      />
      <div
        className="absolute -right-52 top-0 h-full w-[52%] transition-opacity duration-1000"
        style={{
          opacity: blueOn ? 1 : focus === "red" ? 0.18 : 0.5,
          background:
            "radial-gradient(ellipse at 82% 48%, rgba(36,140,255,0.6) 0%, rgba(10,44,130,0.24) 42%, transparent 72%)",
        }}
      />
      {/* floor bounce */}
      <div
        className="absolute inset-x-0 bottom-0 h-[38%]"
        style={{
          background:
            "linear-gradient(to top, rgba(255,40,55,0.18) 0%, transparent 60%), linear-gradient(to top left, rgba(40,140,255,0.18) 0%, transparent 60%)",
          filter: "blur(30px)",
        }}
      />

      {/* 5 — centre gold championship haze */}
      <div
        className="absolute left-1/2 top-0 h-full w-[40%] -translate-x-1/2 transition-opacity duration-1000"
        style={{
          opacity: state === "intro" ? 0.35 : 0.8,
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(255,198,88,0.4) 0%, rgba(130,86,12,0.14) 44%, transparent 74%)",
        }}
      />

      {/* 6 — rolling atmospheric fog */}
      {!reducedMotion && (
        <>
          <div className="pc-fog absolute inset-x-[-30%] bottom-[-10%] h-[70%] opacity-45" />
          <div
            className="pc-fog-slow absolute inset-x-[-30%] top-[6%] h-[55%] opacity-25"
            style={{ animationDirection: "reverse" }}
          />
        </>
      )}

      {/* 7 — technical HUD grid + horizon lines */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "120px 120px",
          maskImage: "radial-gradient(ellipse at center, black 26%, transparent 78%)",
        }}
      />
      <div className="absolute inset-x-0 top-[150px] h-px bg-gradient-to-r from-transparent via-[#f2c14e]/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-[150px] h-px bg-gradient-to-r from-transparent via-[#f2c14e]/20 to-transparent" />

      {/* 8 — light sweep across the arena */}
      {!reducedMotion && <div className="pc-arena-sweep absolute inset-y-0 w-[420px]" />}

      {/* 9 — particulate / dust in the beams */}
      {(reducedMotion ? [] : particles).map((p, i) => (
        <span
          key={i}
          className="pc-particle absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            background: "rgba(255,214,140,0.95)",
            boxShadow: "0 0 8px 2px rgba(255,196,84,0.65)",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            opacity: p.opacity,
          }}
        />
      ))}

      {/* 10 — vignette, letterbox falloff, grain */}
      <div className="absolute inset-0 shadow-[inset_0_0_360px_140px_rgba(0,0,0,0.92)]" />
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/85 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/92 to-transparent" />
      <div className="pc-grain absolute inset-0 opacity-[0.055]" />
      <div className="pc-scanlines absolute inset-0 opacity-[0.05]" />
    </div>
  );
}
