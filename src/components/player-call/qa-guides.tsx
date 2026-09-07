/**
 * Live-preview QA overlay: safe-area guides for the 1920x1080 broadcast canvas.
 * Purely visual — never rendered on air, toggled by the operator (G).
 */
export function QAGuides() {
  const guides = [
    { label: "Action safe 96px", inset: 96, color: "#3ad07a" },
    { label: "Title safe 160px", inset: 160, color: "#f2c14e" },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-[60] font-hud">
      {/* canvas edge */}
      <div className="absolute inset-0 border-2 border-[#ff2b39]/70" />

      {guides.map((g) => (
        <div
          key={g.label}
          className="absolute border-2 border-dashed"
          style={{
            inset: g.inset,
            borderColor: `${g.color}aa`,
          }}
        >
          <span
            className="absolute left-2 top-2 rounded bg-black/75 px-2 py-1 text-[14px] font-bold uppercase tracking-[0.14em]"
            style={{ color: g.color }}
          >
            {g.label}
          </span>
        </div>
      ))}

      {/* thirds + centre cross */}
      <div className="absolute inset-0">
        {[1, 2].map((n) => (
          <span
            key={`v${n}`}
            className="absolute inset-y-0 w-px bg-white/25"
            style={{ left: `${(n * 100) / 3}%` }}
          />
        ))}
        {[1, 2].map((n) => (
          <span
            key={`h${n}`}
            className="absolute inset-x-0 h-px bg-white/25"
            style={{ top: `${(n * 100) / 3}%` }}
          />
        ))}
        <span className="absolute left-1/2 top-1/2 h-[60px] w-px -translate-x-1/2 -translate-y-1/2 bg-[#3ad07a]/80" />
        <span className="absolute left-1/2 top-1/2 h-px w-[60px] -translate-x-1/2 -translate-y-1/2 bg-[#3ad07a]/80" />
      </div>

      <div className="absolute bottom-3 right-3 rounded border border-[#3ad07a]/60 bg-black/80 px-3 py-2 text-[14px] font-bold uppercase tracking-[0.16em] text-[#3ad07a]">
        QA Mode · 1920×1080
      </div>
    </div>
  );
}
