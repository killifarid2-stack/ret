import { useEffect, useState } from "react";

interface ScoreComparisonProps {
  blue: number;
  red: number;
}

export function ScoreComparison({ blue, red }: ScoreComparisonProps) {
  const total = blue + red || 1;
  const bluePct = Math.round((blue / total) * 100);
  const redPct = 100 - bluePct;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setWidth(bluePct), 400);
    return () => window.clearTimeout(t);
  }, [bluePct]);

  return (
    <div className="relative h-6 w-full overflow-hidden rounded-full border border-gold/30 bg-teamred-deep xl:h-8">
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center pr-3 font-display text-xs font-black text-foreground xl:text-base"
        style={{ left: `${width}%`, transition: "left 1.2s cubic-bezier(0.22,1,0.36,1)" }}
      >
        <span className="bg-gradient-to-r from-teamred to-teamred-bright bg-clip-padding" />
        {redPct}%
      </div>
      <div
        className="absolute inset-y-0 left-0 flex items-center justify-end pr-3 font-display text-xs font-black text-foreground xl:text-base"
        style={{
          width: `${width}%`,
          background: "var(--gradient-blue)",
          transition: "width 1.2s cubic-bezier(0.22,1,0.36,1)",
          boxShadow: "var(--shadow-blue)",
        }}
      >
        {bluePct}%
      </div>
    </div>
  );
}
