import { useEffect, useState } from "react";

interface HitSplitBarProps {
  head: number;
  body: number;
}

export function HitSplitBar({ head, body }: HitSplitBarProps) {
  const total = head + body || 1;
  const headPct = Math.round((head / total) * 100);
  const bodyPct = 100 - headPct;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setWidth(headPct), 400);
    return () => window.clearTimeout(t);
  }, [headPct]);

  return (
    <div className="w-full">
      <div className="relative h-6 w-full overflow-hidden rounded-full border border-gold/35 xl:h-8">
        {/* body side — blue */}
        <div
          className="absolute inset-0 flex items-center justify-end pr-3 font-display text-xs font-black text-foreground xl:text-base"
          style={{ background: "var(--gradient-blue)", boxShadow: "inset 0 0 22px var(--teamblue-deep)" }}
        >
          {bodyPct}%
        </div>
        {/* head side — gold */}
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-end pr-3 font-display text-xs font-black xl:text-base"
          style={{
            width: `${width}%`,
            background: "var(--gradient-gold)",
            color: "oklch(0.16 0.03 265)",
            transition: "width 1.2s cubic-bezier(0.22,1,0.36,1)",
            boxShadow: "var(--shadow-gold)",
          }}
        >
          {headPct}%
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between font-display text-[0.68rem] uppercase tracking-[0.18em] text-foreground/80 xl:text-sm">
        <span className="text-gold">Head {head}</span>
        <span className="text-foreground/70">
          Diff {Math.abs(head - body)} · Total {head + body}
        </span>
        <span className="text-teamblue-bright">Body {body}</span>
      </div>
    </div>
  );
}
