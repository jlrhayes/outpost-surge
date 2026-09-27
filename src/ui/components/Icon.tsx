// Inline SVG icon set (no image assets). OWNER: meta agent — add more icons here.
// Usage: <Icon name="food" size={18} />
const ICONS: Record<string, (s: number) => preact.JSX.Element> = {
  food: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <ellipse cx="12" cy="14" rx="9" ry="7" fill="#e8a33c" stroke="#8a5a14" stroke-width="1.5" />
      <path d="M6 12c2-2 4-2 6 0s4 2 6 0" stroke="#8a5a14" stroke-width="1.5" fill="none" />
    </svg>
  ),
  iron: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M3 16l4-8h10l4 8z" fill="#9aa4b0" stroke="#4a525c" stroke-width="1.5" />
      <path d="M7 8l2 8M17 8l-2 8" stroke="#4a525c" stroke-width="1" />
    </svg>
  ),
  gold: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="#f5c542" stroke="#a07810" stroke-width="1.5" />
      <text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="900" fill="#a07810">$</text>
    </svg>
  ),
  diamonds: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M6 4h12l4 6-10 11L2 10z" fill="#5ad0ff" stroke="#1a78a8" stroke-width="1.5" />
      <path d="M2 10h20M9 4l3 17 3-17" stroke="#1a78a8" stroke-width="1" fill="none" />
    </svg>
  ),
  heroExp: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z" fill="#7ee06a" stroke="#2f7a22" stroke-width="1.5" />
    </svg>
  ),
  power: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="#ffd23c" stroke="#a07810" stroke-width="1.5" />
    </svg>
  ),
  stamina: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M12 2c4 5 7 8 7 12a7 7 0 01-14 0c0-4 3-7 7-12z" fill="#ff7a3c" stroke="#a03a10" stroke-width="1.5" />
    </svg>
  ),
  troops: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <circle cx="12" cy="7" r="4" fill="#6b8e4e" stroke="#2f4a22" stroke-width="1.5" />
      <path d="M4 21c0-5 4-8 8-8s8 3 8 8z" fill="#6b8e4e" stroke="#2f4a22" stroke-width="1.5" />
    </svg>
  ),
  clock: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="#fff" stroke="#333" stroke-width="2" />
      <path d="M12 7v5l3 3" stroke="#333" stroke-width="2" fill="none" />
    </svg>
  ),
};

export function Icon(props: { name: string; size?: number }) {
  const f = ICONS[props.name];
  const s = props.size ?? 20;
  if (!f) return <span style={{ display: 'inline-block', width: s + 'px' }}>•</span>;
  return <span class="icon">{f(s)}</span>;
}

export function registerIcon(name: string, render: (size: number) => preact.JSX.Element): void {
  ICONS[name] = render;
}
