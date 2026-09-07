import { BarChart3, Hash, Percent, Scale, Swords, Trophy, User } from "lucide-react";
import { motion } from "motion/react";
import FlagImage from "@/components/FlagImage";
import type { Player, Side } from "@/lib/player-call/types";
import { CornerBracket, CountryBadge, PlayerPhoto, SIDE_THEME, TeamLogo } from "./player-parts";

type Props = {
  player: Player;
  side: Side;
  category: string;
  weightCategory: string;
  visible: boolean;
  active: boolean;
  statusLabel: string | null;
};

function InfoRow({
  icon,
  label,
  children,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <div
      className="flex items-center gap-3 border-t-2 py-[5px]"
      style={{ borderColor: `${accent}33` }}
    >
      <span className="flex w-[168px] items-center gap-2 font-hud text-[16px] font-bold uppercase tracking-[0.14em] text-white/70">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </span>
      <span className="flex-1 font-hud text-[20px] font-bold uppercase tracking-wide text-white">
        {children}
      </span>
    </div>
  );
}

export function PlayerCard({
  player,
  side,
  category,
  weightCategory,
  visible,
  active,
  statusLabel,
}: Props) {
  const theme = SIDE_THEME[side];
  const isRed = side === "red";

  return (
    <motion.section
      initial={{ opacity: 0, x: isRed ? -90 : 90, filter: "blur(8px)" }}
      animate={{
        opacity: visible ? 1 : 0,
        x: visible ? 0 : isRed ? -90 : 90,
        filter: visible ? "blur(0px)" : "blur(8px)",
      }}
      transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
      className="relative h-full w-full"
      aria-hidden={!visible}
    >
      <motion.div
        className="relative flex h-full w-full flex-col"
        animate={{
          opacity: active ? 1 : 0.4,
          scale: active ? 1 : 0.985,
        }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* outer glow bed — kept inside the canvas bounds */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[26px] transition-opacity duration-700"
          style={{
            opacity: active ? 1 : 0.25,
            background: `radial-gradient(ellipse at ${isRed ? "25%" : "75%"} 45%, ${theme.dim} 0%, transparent 68%)`,
            filter: "blur(24px)",
          }}
        />

        {/* Multi-layer metallic + neon broadcast frame */}
        <div
          className="relative flex h-full w-full flex-col rounded-[14px] p-[2px]"
          style={{
            background: `linear-gradient(150deg, ${theme.accent} 0%, rgba(255,255,255,0.55) 18%, ${theme.accent} 38%, rgba(20,22,30,0.9) 62%, ${theme.accent} 100%)`,
            boxShadow: active
              ? `0 0 42px ${theme.glow}, 0 0 120px ${theme.dim}, 0 30px 60px rgba(0,0,0,0.8)`
              : `0 18px 40px rgba(0,0,0,0.75)`,
          }}
        >
          <div
            className="relative flex h-full w-full flex-col overflow-hidden rounded-[12px] p-5 backdrop-blur-md"
            style={{
              background:
                "linear-gradient(160deg, rgba(14,16,24,0.94) 0%, rgba(7,9,15,0.97) 55%, rgba(4,5,10,0.99) 100%)",
              boxShadow: "inset 0 0 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* brushed metal inner rail */}
            <div
              className="pointer-events-none absolute inset-[6px] rounded-[9px] border"
              style={{ borderColor: "rgba(255,255,255,0.09)" }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
              style={{
                background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
                boxShadow: `0 0 18px ${theme.accent}`,
              }}
            />
            <CornerBracket position="tl" color={theme.accent} />
            <CornerBracket position="tr" color={theme.accent} />
            <CornerBracket position="bl" color={theme.accent} />
            <CornerBracket position="br" color={theme.accent} />

            {/* Top: seed + large portrait + logos */}
            <div className={`flex gap-4 ${isRed ? "flex-row" : "flex-row-reverse"}`}>
              <div className="flex w-[70px] shrink-0 flex-col items-center gap-2">
                <div
                  className="flex w-full flex-col items-center rounded-md border bg-black/60 py-2"
                  style={{ borderColor: `${theme.accent}66`, boxShadow: `inset 0 0 18px ${theme.dim}` }}
                >
                  <span className="font-display text-[34px] font-bold leading-none text-white">
                    {player.seed}
                  </span>
                  <span className="font-hud text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                    Seed
                  </span>
                </div>
                {statusLabel && (
                  <span
                    className="pc-status-pulse w-full rounded-md border px-1 py-2 text-center font-hud text-[11px] font-bold uppercase leading-tight tracking-[0.12em]"
                    style={{
                      borderColor: theme.accent,
                      color: "#fff",
                      background: `linear-gradient(180deg, ${theme.dim}, rgba(0,0,0,0.5))`,
                      boxShadow: `0 0 22px ${theme.glow}`,
                    }}
                  >
                    {statusLabel}
                  </span>
                )}
              </div>

              {/* Large cutout portrait — ~70% of card height */}
              <div className="relative h-[336px] flex-1">
                <PlayerPhoto src={player.photo} name={player.name} side={side} active={active} />
                <span
                  className={`absolute bottom-2 ${isRed ? "left-2" : "right-2"} h-[30px] min-w-[44px] overflow-hidden rounded-[4px] border bg-black/70`}
                  style={{ borderColor: theme.accent, boxShadow: `0 0 14px ${theme.glow}` }}
                >
                  <FlagImage
                    code={player.flag || player.country}
                    size={80}
                    className="h-full w-full object-cover"
                  />
                </span>
              </div>

              <div className="flex w-[118px] shrink-0 flex-col gap-2">
                <TeamLogo
                  src={player.teamLogo}
                  label={`Team ${player.teamName}`}
                  caption={player.teamName}
                  side={side}
                />
                <TeamLogo
                  src={player.clubLogo}
                  label="CLUB"
                  caption={player.clubName}
                  side={side}
                  kind="club"
                />
              </div>
            </div>

            {/* Name banner */}
            <div className="relative mt-3">
              <div
                className="pc-sweep relative overflow-hidden rounded-md border-[3px] py-3 text-center"
                style={{
                  borderColor: "#f2c14e",
                  background: "linear-gradient(180deg, rgba(10,10,14,0.98), rgba(0,0,0,0.99))",
                  boxShadow: "0 0 24px rgba(242,193,78,.22), inset 0 1px 0 rgba(255,225,150,.14)",
                }}
              >
                <h2 className="px-4 font-display text-[42px] font-black uppercase leading-none tracking-[0.045em] text-[#f2c14e]" style={{ textShadow: "0 0 16px rgba(242,193,78,.35)" }}>
                  {player.name}
                </h2>
              </div>
            </div>

            {/* Info table */}
            <div className="mt-2 flex-1">
              <InfoRow icon={<User className="h-[18px] w-[18px]" />} label="Country" accent={theme.accent}>
                <CountryBadge country={player.country} flag={player.flag} side={side} />
              </InfoRow>
              <InfoRow icon={<Swords className="h-[18px] w-[18px]" />} label="Category" accent={theme.accent}>
                <span className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md border px-2 py-1" style={{ borderColor: `${theme.accent}44`, background: 'rgba(255,255,255,.03)' }}>{category || '—'}</span>
                  <span className="rounded-md border px-2 py-1 text-white/80" style={{ borderColor: `${theme.accent}44`, background: 'rgba(255,255,255,.03)' }}>{weightCategory || '—'}</span>
                </span>
              </InfoRow>
              <InfoRow icon={<User className="h-[18px] w-[18px]" />} label="Age / Gender" accent={theme.accent}>
                <span className="flex flex-wrap gap-2">
                  <span className="rounded-md border px-3 py-1" style={{ borderColor: `${theme.accent}55`, background: 'rgba(255,255,255,.035)' }}>
                    AGE: {player.ageGroup || '—'}
                  </span>
                  <span className="rounded-md border px-3 py-1" style={{ borderColor: `${theme.accent}55`, background: 'rgba(255,255,255,.035)' }}>
                    GENDER: {player.gender === 'male' ? 'MALE' : player.gender === 'female' ? 'FEMALE' : (player.gender || '—').toUpperCase()}
                  </span>
                </span>
              </InfoRow>
              <InfoRow icon={<BarChart3 className="h-[18px] w-[18px]" />} label="Ranking" accent={theme.accent}>
                <span className="font-display text-[22px] font-bold" style={{ color: theme.accent }}>
                  {player.ranking}
                </span>
              </InfoRow>
              <InfoRow icon={<Hash className="h-[18px] w-[18px]" />} label="Player No." accent={theme.accent}>
                <span className="font-display text-[24px] font-bold" style={{ color: theme.accent }}>
                  #{player.seed}
                </span>
              </InfoRow>
              <InfoRow icon={<Scale className="h-[18px] w-[18px]" />} label="Weight" accent={theme.accent}>
                <span className="font-display text-[24px] font-bold">{player.weight}</span>
              </InfoRow>
              <InfoRow icon={<Percent className="h-[18px] w-[18px]" />} label="Win Rate" accent={theme.accent}>
                <span className="flex w-full items-center gap-3">
                  <span
                    className="relative h-[12px] flex-1 overflow-hidden rounded-full border"
                    style={{ borderColor: `${theme.accent}66`, background: "rgba(255,255,255,0.06)" }}
                  >
                    <motion.span
                      className="absolute inset-y-0 left-0 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(0, Math.min(100, player.winRate))}%` }}
                      transition={{ duration: 1.1, ease: "easeOut" }}
                      style={{
                        background: `linear-gradient(90deg, ${theme.accent}, #ffffff)`,
                        boxShadow: `0 0 16px ${theme.glow}`,
                      }}
                    />
                  </span>
                  <span className="font-display text-[24px] font-bold" style={{ color: theme.accent }}>
                    {player.winRate}%
                  </span>
                </span>
              </InfoRow>
              <InfoRow icon={<Trophy className="h-[18px] w-[18px]" />} label="Previous Score" accent={theme.accent}>
                <span className="flex items-center gap-2">
                  <Trophy className="h-[18px] w-[18px] text-[#f2c14e]" />
                  {player.previousScore}
                </span>
              </InfoRow>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
}
