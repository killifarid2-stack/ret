import { AnimatePresence, motion } from "motion/react";
import type { BroadcastState } from "@/lib/player-call/types";
import trophyWabTkdUrl from "@/assets/trophy-wab-tkd-transparent.png";

type Props = {
  round: number;
  roundStage: string;
  category: string;
  weightCategory: string;
  /** Current mat/court number, when known. Badge is hidden if omitted. */
  matNumber?: number;
  state: BroadcastState;
};

const GOLD_BORDER = "#f2c14e";

function VSDisplay({ show }: { show: boolean }) {
  return (
    <div className="relative flex h-[170px] items-center justify-center">
      {/* gold energy burst */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2"
        animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.6 }}
        transition={{ duration: 0.8 }}
        style={{
          background:
            "radial-gradient(circle, rgba(255,214,120,0.5) 0%, rgba(242,193,78,0.14) 40%, transparent 70%)",
        }}
      />
      {/* impact shockwave ring */}
      <AnimatePresence>
        {show && (
          <motion.span
            key="ring"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{ borderColor: "rgba(255,214,120,0.8)" }}
            initial={{ opacity: 0.9, scale: 0.3 }}
            animate={{ opacity: 0, scale: 2.4 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
      {/* horizontal light rays */}
      <motion.span
        className="pointer-events-none absolute left-1/2 top-1/2 h-[3px] w-[420px] -translate-x-1/2 -translate-y-1/2"
        animate={{ opacity: show ? 1 : 0, scaleX: show ? 1 : 0.2 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,220,140,0.9), transparent)",
          filter: "blur(2px)",
        }}
      />
      <AnimatePresence>
        {show && (
          <motion.span
            initial={{ opacity: 0, scale: 0.35, rotateX: 45 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: "spring", stiffness: 170, damping: 13 }}
            className="pc-gold-shimmer pc-vs-glow relative font-display text-[150px] font-bold leading-none tracking-tight"
          >
            VS
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RoundCenter({ round, roundStage, category, weightCategory, matNumber, state }: Props) {
  const showRound = state !== "intro";
  const showVS = state === "showBothPlayers" || state === "ready";

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {/* volumetric gold shaft behind the centre column */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-full w-[360px] -translate-x-1/2"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,206,120,0.28) 0%, rgba(255,196,84,0.09) 45%, transparent 85%)",
          filter: "blur(34px)",
          clipPath: "polygon(38% 0%, 62% 0%, 100% 100%, 0% 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[460px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,206,120,0.22) 0%, transparent 68%)",
        }}
      />

      {/* Championship gold frame */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.2 }}
        className="relative flex w-[460px] flex-col items-center rounded-[18px] p-[3px]"
        style={{
          background:
            "linear-gradient(160deg, #fff0c0 0%, #f2c14e 22%, #a9741f 48%, #f2c14e 74%, #ffe9a8 100%)",
          boxShadow: "0 0 60px rgba(242,193,78,0.4), 0 30px 70px rgba(0,0,0,0.8)",
        }}
      >
        <div
          className="relative flex w-full flex-col items-center rounded-[15px] border-2 border-black/60 px-6 py-5 backdrop-blur-[3px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(12,11,16,0.82), rgba(5,5,9,0.94))",
            boxShadow:
              "inset 0 0 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,225,150,0.25)",
          }}
        >
          {/* small trophy, framed and seated above NEXT ROUND */}
          <div
            className="mb-2 w-[176px] rounded-[12px] p-[2px]"
            style={{
              background:
                "linear-gradient(160deg, #fff0c0 0%, #f2c14e 25%, #a9741f 55%, #ffe9a8 100%)",
              boxShadow: "0 0 26px rgba(242,193,78,0.35)",
            }}
          >
            <div
              className="flex h-[120px] w-full items-center justify-center rounded-[10px] border border-black/60 py-2"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 35%, rgba(255,206,120,0.18) 0%, rgba(5,5,9,0.95) 70%)",
                boxShadow: "inset 0 0 30px rgba(0,0,0,0.85)",
              }}
            >
              <motion.img
                src={trophyWabTkdUrl}
                alt="WAB-TKD Championship Trophy"
                className="pc-trophy-float pointer-events-none mx-auto block max-h-[104px] w-[104px] select-none object-contain"
                animate={{
                  opacity: state === "intro" ? 1 : 0.92,
                  scale: state === "ready" ? 1.05 : 1,
                }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  filter:
                    "drop-shadow(0 0 26px rgba(255,200,90,0.6)) drop-shadow(0 12px 30px rgba(0,0,0,0.85))",
                }}
              />
            </div>
          </div>

          <div className="pc-metallic font-display text-[44px] font-bold uppercase leading-none tracking-[0.05em]">
            Next Round
          </div>

          {/* stage label — semi-final / final / etc. */}
          <div
            className="mt-2 rounded-md border-2 px-5 py-1"
            style={{
              borderColor: GOLD_BORDER,
              background: "linear-gradient(180deg, rgba(242,193,78,0.18), rgba(0,0,0,0.6))",
              boxShadow: "0 0 24px rgba(242,193,78,0.35)",
            }}
          >
            <span className="pc-gold-shimmer font-display text-[26px] font-bold uppercase tracking-[0.22em]">
              {roundStage}
            </span>
          </div>

          {matNumber ? (
            <div
              className="mt-1.5 rounded-md border px-4 py-0.5"
              style={{ borderColor: `${GOLD_BORDER}66`, background: "rgba(0,0,0,0.55)" }}
            >
              <span className="font-hud text-[13px] font-bold uppercase tracking-[0.3em] text-white/80">
                MAT {String(matNumber).padStart(2, "0")}
              </span>
            </div>
          ) : null}

          <div className="mt-2 mb-1 flex items-center gap-2">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#f2c14e]" />
            <span className="text-[12px] text-[#f2c14e]">★★★</span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#f2c14e]" />
          </div>

          <AnimatePresence>
            {showRound && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="flex flex-col items-center"
              >
                <span className="pc-gold font-display text-[28px] font-bold uppercase tracking-[0.3em]">
                  Round
                </span>
                <span
                  className="pc-gold-shimmer font-display text-[96px] font-bold leading-[0.85]"
                  style={{ filter: "drop-shadow(0 0 26px rgba(242,193,78,0.7))" }}
                >
                  {round}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <VSDisplay show={showVS} />

          <div
            className="mt-2 flex w-full flex-col items-center rounded-lg border-2 bg-black/60 py-3"
            style={{ borderColor: `${GOLD_BORDER}99`, boxShadow: "inset 0 0 28px rgba(0,0,0,0.7)" }}
          >
            <span className="font-hud text-[16px] font-bold uppercase tracking-[0.24em] text-white/75">
              Category
            </span>
            <span className="pc-gold font-display text-[30px] font-bold uppercase leading-tight tracking-wide">
              {category}
            </span>
            <span className="pc-gold-shimmer font-display text-[30px] font-bold uppercase leading-tight tracking-wide">
              {weightCategory}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
