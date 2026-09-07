export function TournamentBranding({ label = "WAB-TKD" }: { label?: string }) {
  return (
    <div className="flex justify-center">
      <div
        className="gold-sheen border border-gold/70 bg-[oklch(0.12_0.03_265/0.85)] px-8 py-1 shadow-[0_0_22px_color-mix(in_oklab,var(--gold)_35%,transparent)]"
        style={{
          clipPath: "polygon(16px 0, calc(100% - 16px) 0, 100% 100%, 0 100%)",
        }}
      >
        <span className="font-display text-lg font-black italic tracking-[0.12em] text-gold xl:text-2xl">
          {label}
        </span>
      </div>
    </div>
  );
}
