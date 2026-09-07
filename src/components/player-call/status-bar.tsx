import { CheckCircle2, Hourglass } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { BroadcastState } from "@/lib/player-call/types";

type Props = { state: BroadcastState; reducedMotion?: boolean };

const STATUS: Partial<
  Record<BroadcastState, { text: string; color: string; icon: "hourglass" | "check" }>
> = {
  showRedPlayer: { text: "CALLING RED PLAYER...", color: "#ff2b39", icon: "hourglass" },
  showBluePlayer: { text: "CALLING BLUE PLAYER...", color: "#33a2ff", icon: "hourglass" },
  showBothPlayers: {
    text: "WAITING FOR THE HEAD REFEREE...",
    color: "#f2c14e",
    icon: "hourglass",
  },
  ready: { text: "BOTH PLAYERS ARE READY", color: "#3ad07a", icon: "check" },
};

/** Centre-screen broadcast message strap (sits over the middle of the canvas). */
export function StatusBar({ state, reducedMotion = false }: Props) {
  const status = STATUS[state];
  const holding = state === "showBothPlayers";
  const isReady = state === "ready";

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-8">
      <AnimatePresence mode="wait">
        {status && (
          <motion.div
            key={state}
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            animate={
              isReady && !reducedMotion
                ? { opacity: 1, y: 0, scale: [1, 1.035, 1] }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={{ opacity: 0, y: -12, scale: 0.94 }}
            transition={
              isReady && !reducedMotion
                ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                : { duration: reducedMotion ? 0.15 : 0.45, ease: "easeOut" }
            }
            className="relative flex flex-col items-center gap-3 rounded-lg border-[3px] bg-black/80 px-14 py-4 backdrop-blur-md"
            style={{
              borderColor: status.color,
              boxShadow: reducedMotion
                ? `0 0 20px ${status.color}66`
                : `0 0 46px ${status.color}99, 0 0 140px ${status.color}44, inset 0 0 34px ${status.color}22`,
            }}
          >
            {!reducedMotion && (
              <span
                className="pointer-events-none absolute inset-x-[-40%] top-1/2 h-[3px] -translate-y-1/2"
                style={{
                  background: `linear-gradient(90deg, transparent, ${status.color}, transparent)`,
                  filter: "blur(2px)",
                  opacity: 0.7,
                }}
              />
            )}

            <div className="relative flex items-center gap-5">
              {status.icon === "hourglass" ? (
                <Hourglass
                  className={`relative h-8 w-8 ${reducedMotion ? "" : "pc-blink"}`}
                  style={{ color: status.color }}
                />
              ) : (
                <CheckCircle2 className="relative h-9 w-9" style={{ color: status.color }} />
              )}
              <span
                className="relative font-display text-[42px] font-bold uppercase leading-none tracking-[0.14em]"
                style={{ color: status.color, textShadow: `0 0 26px ${status.color}cc` }}
              >
                {status.text}
              </span>
              {status.icon === "check" && (
                <CheckCircle2 className="relative h-9 w-9" style={{ color: status.color }} />
              )}
            </div>

            {holding && (
              <div className="relative flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-5 py-2">
                <Hourglass className="h-5 w-5" style={{ color: status.color }} />
                <span className="font-hud text-[18px] font-bold uppercase tracking-[0.2em] text-white/75">
                  WAITING FOR HEAD REFEREE · PRESS READY
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
