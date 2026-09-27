// Number that counts up/down smoothly when its value changes. OWNER: meta agent.
import { useEffect, useRef, useState } from 'preact/hooks';
import { fmt } from '../../core/format';

/** 1234567 -> "1,234,567" (switches to compact "12.3M" above 100M). */
export function fmtFull(n: number): string {
  n = Math.round(n);
  if (Math.abs(n) >= 100_000_000) return fmt(n);
  return n.toLocaleString('en-US');
}

export function AnimatedNumber(props: { value: number; format?: (n: number) => string; duration?: number; class?: string }) {
  const { value } = props;
  const format = props.format ?? fmt;
  const [shown, setShown] = useState(value);
  const cur = useRef(value);
  const raf = useRef(0);
  useEffect(() => {
    const a = cur.current;
    const b = value;
    if (a === b) return;
    cancelAnimationFrame(raf.current);
    const dur = props.duration ?? 800;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const v = a + (b - a) * e;
      cur.current = v;
      setShown(v);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  return <span class={props.class}>{format(Math.round(shown))}</span>;
}
