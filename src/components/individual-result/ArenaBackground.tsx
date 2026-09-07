import arena from "@/assets/animations/player-call/arena-bg.png";

export function ArenaBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        src={arena}
        alt=""
        width={1920}
        height={1088}
        className="h-full w-full object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,color-mix(in_oklab,var(--gold)_16%,transparent),transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,oklch(0.08_0.02_265/0.82),oklch(0.08_0.02_265/0.55)_45%,oklch(0.07_0.02_265/0.9))]" />
      <div className="animate-light-drift absolute -left-32 top-0 h-full w-1/3 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--teamblue-bright)_22%,transparent),transparent_70%)]" />
      <div className="animate-light-drift absolute -right-32 top-0 h-full w-1/3 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--teamred-bright)_20%,transparent),transparent_70%)]" />
      {/* right-side cinematic stadium lighting (stays behind the UI) */}
      <div className="absolute inset-y-0 right-0 w-[46%] bg-[radial-gradient(ellipse_at_78%_40%,color-mix(in_oklab,var(--teamred-bright)_30%,transparent),transparent_68%)]" />
      <div className="absolute inset-y-0 right-0 w-[38%] bg-[radial-gradient(ellipse_at_92%_78%,color-mix(in_oklab,var(--teamblue-bright)_22%,transparent),transparent_66%)]" />
      <div className="absolute inset-y-0 right-0 w-[30%] bg-[radial-gradient(ellipse_at_88%_14%,color-mix(in_oklab,var(--gold)_20%,transparent),transparent_62%)]" />
      {/* spotlight beams */}
      {[
        { right: "6%", rot: "14deg", w: 90, c: "var(--teamred-bright)", o: 0.16 },
        { right: "22%", rot: "-10deg", w: 60, c: "var(--gold)", o: 0.14 },
        { right: "34%", rot: "8deg", w: 44, c: "var(--teamblue-bright)", o: 0.12 },
      ].map((b) => (
        <span
          key={b.right}
          className="animate-light-drift absolute -top-1/4 h-[150%] origin-top"
          style={{
            right: b.right,
            width: b.w,
            transform: `rotate(${b.rot})`,
            opacity: b.o,
            background: `linear-gradient(180deg, color-mix(in oklab, ${b.c} 85%, transparent), transparent 72%)`,
            filter: "blur(10px)",
          }}
        />
      ))}
      {/* soft smoke + lens flare on the right */}
      <div className="absolute bottom-0 right-0 h-1/2 w-[44%] bg-[radial-gradient(ellipse_at_70%_100%,oklch(0.6_0.02_265/0.16),transparent_70%)] blur-2xl" />
      <span className="absolute right-[12%] top-[26%] h-24 w-24 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--gold-bright)_40%,transparent),transparent_70%)] blur-md" />
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={`rp-${i}`}
          className="absolute bottom-0 h-[3px] w-[3px] rounded-full bg-gold-bright/60"
          style={{
            right: `${(i * 4.6 + 3) % 42}%`,
            animation: `particle-float ${20 + (i % 4) * 7}s linear ${i * 2.1}s infinite`,
          }}
        />
      ))}
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="absolute bottom-0 h-1 w-1 rounded-full bg-gold/70"
          style={{
            left: `${(i * 7.3 + 4) % 100}%`,
            animation: `particle-float ${26 + (i % 5) * 6}s linear ${i * 1.7}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
