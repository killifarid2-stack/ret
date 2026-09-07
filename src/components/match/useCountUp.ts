import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 900, delay = 200) {
  const [value, setValue] = useState(0);
  const frame = useRef<number>(0);

  useEffect(() => {
    let start: number | null = null;
    const timer = window.setTimeout(() => {
      const step = (t: number) => {
        if (start === null) start = t;
        const p = Math.min((t - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(target * eased);
        if (p < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame.current);
    };
  }, [target, duration, delay]);

  return value;
}
