import { resolveFlagSrc } from "@/lib/player-call/data";
import FlagImage from "@/components/FlagImage";
import type { Side } from "@/lib/player-call/types";

export const SIDE_THEME = {
  red: {
    accent: "#ff2b39",
    soft: "rgba(255,43,57,0.9)",
    glow: "rgba(255,43,57,0.55)",
    dim: "rgba(255,80,90,0.25)",
    rim: "rgba(255,70,80,0.95)",
  },
  blue: {
    accent: "#33a2ff",
    soft: "rgba(51,162,255,0.9)",
    glow: "rgba(51,162,255,0.6)",
    dim: "rgba(90,170,255,0.25)",
    rim: "rgba(110,190,255,0.95)",
  },
} as const;

/**
 * Large cutout portrait (70-85% of card height) with cinematic rim lighting,
 * a contact-shadow pedestal and depth separation from the arena plate.
 */
export function PlayerPhoto({
  src,
  name,
  side,
  active,
}: {
  src: string;
  name: string;
  side: Side;
  active: boolean;
}) {
  const theme = SIDE_THEME[side];
  const isRed = side === "red";

  return (
    <div className="relative h-full w-full">
      {/* back light halo behind the cutout */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[85%] w-[80%] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700"
        style={{
          opacity: active ? 1 : 0.4,
          background: `radial-gradient(ellipse at 50% 45%, ${theme.rim} 0%, ${theme.glow} 30%, ${theme.dim} 52%, transparent 74%)`,
          filter: "blur(34px)",
        }}
      />

      {src ? (
        <>
          {/* rim-light duplicates, offset each side for a hard cinematic edge */}
          <img
            src={src}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain object-bottom transition-opacity duration-700"
            style={{
              opacity: active ? 1 : 0.35,
              transform: `translateX(${isRed ? -9 : 9}px) scale(1.015)`,
              filter: `brightness(0) drop-shadow(0 0 14px ${theme.rim}) drop-shadow(0 0 30px ${theme.rim}) drop-shadow(0 0 60px ${theme.glow})`,
            }}
          />
          <img
            src={src}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain object-bottom transition-opacity duration-700"
            style={{
              opacity: active ? 0.8 : 0.25,
              transform: `translateX(${isRed ? 7 : -7}px) translateY(-3px) scale(1.012)`,
              filter: `brightness(0) drop-shadow(0 0 12px ${theme.rim}) drop-shadow(0 0 40px ${theme.glow})`,
            }}
          />
          <img
            src={src}
            alt={name}
            className="pc-portrait relative h-full w-full select-none object-contain object-bottom"
            style={{
              filter: active
                ? `contrast(1.24) saturate(1.2) drop-shadow(0 26px 40px rgba(0,0,0,0.85)) drop-shadow(0 0 30px ${theme.glow}) drop-shadow(0 0 70px ${theme.dim})`
                : "contrast(1.04) saturate(0.7) brightness(0.7) drop-shadow(0 18px 30px rgba(0,0,0,0.8))",
              transition: "filter 700ms ease",
            }}
          />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black/60 font-hud text-sm uppercase tracking-widest text-white/40">
          No Photo
        </div>
      )}

      {/* colour spill onto the floor / contact shadow */}
      <div
        className="pointer-events-none absolute inset-x-[12%] bottom-[2%] h-[52px] rounded-[50%] transition-opacity duration-700"
        style={{
          opacity: active ? 0.85 : 0.3,
          background: `radial-gradient(ellipse at center, ${theme.soft} 0%, transparent 70%)`,
          filter: "blur(18px)",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/80 to-transparent" />
    </div>
  );
}

export function TeamLogo({
  src,
  label,
  caption,
  side,
  kind = 'team',
}: {
  src: string;
  label: string;
  caption: string;
  side: Side;
  kind?: 'team' | 'club';
}) {
  const theme = SIDE_THEME[side];
  return (
    <div
      className={`relative flex flex-col items-center gap-1 overflow-hidden rounded-md border px-3 py-2 backdrop-blur-sm ${kind === 'club' ? 'pc-club-logo-card' : ''}`}
      style={{
        borderColor: kind === 'club' ? `${theme.accent}cc` : `${theme.accent}55`,
        background: kind === 'club'
          ? `linear-gradient(160deg, ${theme.dim}, rgba(8,10,18,.96) 58%, rgba(0,0,0,.98))`
          : 'linear-gradient(160deg,rgba(24,26,34,0.75),rgba(6,8,14,0.9))',
        boxShadow: kind === 'club'
          ? `0 0 18px ${theme.glow}, 0 0 38px ${theme.dim}, inset 0 1px 0 rgba(255,255,255,0.16)`
          : `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 18px ${theme.dim}`,
      }}
    >
      <span className="font-hud text-[10px] font-black uppercase tracking-[0.16em] text-white/70">
        {label}
      </span>
      {src ? (
        <img
          src={src}
          alt={caption}
          className="h-[64px] w-[64px] object-contain"
          style={{ filter: `drop-shadow(0 0 10px ${theme.dim}) drop-shadow(0 0 22px ${kind === 'club' ? theme.glow : 'transparent'})` }}
        />
      ) : (
        <div
          className="flex h-[64px] w-[64px] items-center justify-center rounded-full border font-display text-lg font-bold"
          style={{ borderColor: theme.accent, color: theme.accent }}
        >
          {caption.slice(0, 2)}
        </div>
      )}
      <span className="max-w-full truncate rounded-md px-2 py-0.5 text-center font-display text-[12px] font-black uppercase tracking-[.08em] text-white" style={{ border: `1px solid ${theme.accent}88`, boxShadow: kind === 'club' ? `0 0 14px ${theme.glow}` : 'none', textShadow: kind === 'club' ? `0 0 10px ${theme.glow}` : 'none' }}>
        {caption || '—'}
      </span>
    </div>
  );
}

export function CountryBadge({
  country,
  flag,
  side,
}: {
  country: string;
  flag: string;
  side: Side;
}) {
  const theme = SIDE_THEME[side];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-flex h-[22px] w-[32px] items-center justify-center overflow-hidden rounded-[3px] border"
        style={{ borderColor: `${theme.accent}88` }}
      >
        <FlagImage
          code={flag || country}
          size={80}
          className="h-full w-full object-cover"
        />
      </span>
      <span className="font-hud text-[17px] font-semibold uppercase tracking-wide text-white">
        {country}
      </span>
    </span>
  );
}

/** Decorative machined corner bracket for the broadcast frames. */
export function CornerBracket({
  position,
  color,
}: {
  position: "tl" | "tr" | "bl" | "br";
  color: string;
}) {
  const base = "pointer-events-none absolute h-8 w-8";
  const map = {
    tl: "left-[-2px] top-[-2px] border-l-2 border-t-2 rounded-tl-[14px]",
    tr: "right-[-2px] top-[-2px] border-r-2 border-t-2 rounded-tr-[14px]",
    bl: "left-[-2px] bottom-[-2px] border-b-2 border-l-2 rounded-bl-[14px]",
    br: "right-[-2px] bottom-[-2px] border-b-2 border-r-2 rounded-br-[14px]",
  } as const;
  return (
    <span
      className={`${base} ${map[position]}`}
      style={{ borderColor: color, boxShadow: `0 0 14px ${color}` }}
    />
  );
}
