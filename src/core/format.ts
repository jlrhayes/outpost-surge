// Number/time formatting helpers.

/** 1234 -> "1.2K", 3_400_000 -> "3.4M". */
export function fmt(n: number): string {
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n < 1000) return sign + Math.floor(n).toString();
  const units = ['K', 'M', 'B', 'T'];
  let u = -1;
  while (n >= 1000 && u < units.length - 1) {
    n /= 1000;
    u++;
  }
  return sign + (n >= 100 ? Math.floor(n).toString() : n.toFixed(1).replace(/\.0$/, '')) + units[u];
}

/** Milliseconds -> "1d 2h", "3h 04m", "12:05", "0:09". */
export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}
