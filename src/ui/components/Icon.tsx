// Inline SVG icon set (no image assets). OWNER: meta agent — add more icons here.
// Usage: <Icon name="food" size={18} />   Other modules may add their own with registerIcon().
// Style: chunky dark outline (#1b2530), bright flat fills, a light highlight stroke.
import type { JSX } from 'preact';

type El = JSX.Element;
const O = '#1b2530';
const sv = (s: number, c: El | El[], vb = '0 0 24 24'): El => (
  <svg width={s} height={s} viewBox={vb} aria-hidden="true">
    {c}
  </svg>
);

/** Stopwatch badge used by the speed-up items. */
const stopwatch = (color: string, label: string) => (s: number) =>
  sv(s, [
    <rect x="7" y="3" width="5" height="3" rx="1" fill={color} stroke={O} stroke-width="1.2" />,
    <circle cx="9.5" cy="14" r="8" fill="#eef6ff" stroke={O} stroke-width="1.6" />,
    <path d="M9.5 14V6a8 8 0 0 1 8 8z" fill={color} opacity="0.9" />,
    <path d="M9.5 14V9M9.5 14l3 2" stroke={O} stroke-width="1.8" stroke-linecap="round" />,
    <rect x="12.5" y="0.6" width="11.2" height="8.4" rx="2.6" fill={color} stroke={O} stroke-width="1.2" />,
    <text x="18.1" y="7" font-size="6.6" font-weight="900" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif">
      {label}
    </text>,
  ]);

/** Wooden crate with a round resource badge in the corner. */
const crate = (badge?: { fill: string; mark: El }) => (s: number) =>
  sv(s, [
    <path d="M2 7.5l9-4 9 4v10l-9 4-9-4z" fill="#c9893f" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
    <path d="M2 7.5l9 4 9-4M11 11.5v10" stroke={O} stroke-width="1.3" fill="none" />,
    <path d="M3.5 11l6 2.7M3.5 14.5l6 2.7M12.5 13.7l6-2.7M12.5 17.2l6-2.7" stroke="#8a5a24" stroke-width="1" />,
    <path d="M2 7.5l9-4 9 4-9 4z" fill="#e0a55a" stroke={O} stroke-width="1.3" stroke-linejoin="round" />,
    badge ? <circle cx="17.5" cy="17.5" r="6" fill={badge.fill} stroke={O} stroke-width="1.4" /> : <g />,
    badge ? badge.mark : <g />,
  ]);
const CRATE_FOOD = crate({
  fill: '#ffe07a',
  mark: <path d="M17.5 21.5v-7M17.5 15.5l-2-1.5M17.5 15.5l2-1.5M17.5 18l-2-1.5M17.5 18l2-1.5" stroke="#8a5a14" stroke-width="1.4" stroke-linecap="round" fill="none" />,
});
const CRATE_IRON = crate({
  fill: '#b8c4d2',
  mark: <path d="M13.8 19.8l1.4-3.6h4.6l1.4 3.6z" fill="#e8eef5" stroke={O} stroke-width="1" stroke-linejoin="round" />,
});
const CRATE_GOLD = crate({
  fill: '#ffc83a',
  mark: <circle cx="17.5" cy="17.5" r="3" fill="none" stroke="#a86a00" stroke-width="1.4" />,
});

const shard = (fill: string, dark: string) => (s: number) =>
  sv(s, [
    <path d="M12 2l5 6-2 13-6 1-4-9z" fill={fill} stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
    <path d="M12 2l-1 10 4 9M5 13l6-1 6-4" stroke={dark} stroke-width="1" fill="none" />,
    <path d="M12.5 4.5l2.5 3" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity="0.8" />,
    <path d="M19 3l.8 1.8 1.8.8-1.8.8L19 8.2l-.8-1.8-1.8-.8 1.8-.8z" fill="#fff" />,
  ]);

const book = (cover: string, band: string) => (s: number) =>
  sv(s, [
    <path d="M4 4.5A2 2 0 0 1 6 2.5h13v16H6a2 2 0 0 0-2 2z" fill={cover} stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
    <path d="M4 20.5a2 2 0 0 1 2-2h13v3H6a2 2 0 0 1-2-1z" fill="#f4ecd8" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
    <rect x="8" y="6" width="8" height="4" rx="1" fill={band} stroke={O} stroke-width="1" />,
    <path d="M12 12.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="#ffe27a" stroke={O} stroke-width="0.8" />,
  ]);

const ICONS: Record<string, (s: number) => El> = {
  // ---------------- Currencies ----------------
  food: (s) =>
    sv(s, [
      <path d="M12 22V8" stroke="#7a5212" stroke-width="2" stroke-linecap="round" />,
      <g fill="#f5c542" stroke={O} stroke-width="1.2">
        <ellipse cx="12" cy="5" rx="2.1" ry="3.2" />
        <ellipse cx="8.4" cy="9.2" rx="1.9" ry="3" transform="rotate(-38 8.4 9.2)" />
        <ellipse cx="15.6" cy="9.2" rx="1.9" ry="3" transform="rotate(38 15.6 9.2)" />
        <ellipse cx="8.4" cy="14.4" rx="1.9" ry="3" transform="rotate(-38 8.4 14.4)" />
        <ellipse cx="15.6" cy="14.4" rx="1.9" ry="3" transform="rotate(38 15.6 14.4)" />
      </g>,
      <path d="M11.3 3.6v2" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity="0.8" />,
    ]),
  iron: (s) =>
    sv(s, [
      <path d="M1.5 20.5l2-5h7.5l2 5z" fill="#9aa6b4" stroke={O} stroke-width="1.4" stroke-linejoin="round" />,
      <path d="M11.5 20.5l2-5H21l2 5z" fill="#9aa6b4" stroke={O} stroke-width="1.4" stroke-linejoin="round" />,
      <path d="M6.5 15.5l2-5H16l2 5z" fill="#c3ccd7" stroke={O} stroke-width="1.4" stroke-linejoin="round" />,
      <path d="M9.2 12h5.8M4.2 17h5.8M14.2 17h5.8" stroke="#fff" stroke-width="1" opacity="0.7" />,
    ]),
  gold: (s) =>
    sv(s, [
      <ellipse cx="12" cy="17" rx="8.5" ry="4" fill="#d19a1c" stroke={O} stroke-width="1.4" />,
      <ellipse cx="12" cy="15" rx="8.5" ry="4" fill="#f5c542" stroke={O} stroke-width="1.4" />,
      <ellipse cx="12" cy="10" rx="8.5" ry="4" fill="#d19a1c" stroke={O} stroke-width="1.4" />,
      <ellipse cx="12" cy="8" rx="8.5" ry="4" fill="#ffd95a" stroke={O} stroke-width="1.4" />,
      <ellipse cx="12" cy="8" rx="4.5" ry="2" fill="none" stroke="#b07c10" stroke-width="1.2" />,
      <path d="M6 6.5c1.5-1.2 3.5-1.6 5-1.6" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity="0.8" fill="none" />,
    ]),
  diamonds: (s) =>
    sv(s, [
      <path d="M6.5 3.5h11L22 9.5 12 21.5 2 9.5z" fill="#4fc6ff" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M2 9.5h20" stroke={O} stroke-width="1.1" />,
      <path d="M6.5 3.5L9 9.5l3 12 3-12 2.5-6" fill="none" stroke="#1a78a8" stroke-width="1" />,
      <path d="M9 9.5l3-6 3 6z" fill="#9ae4ff" />,
      <path d="M4.5 9.5L12 21.5 9 9.5z" fill="#2aa2e0" opacity="0.7" />,
      <path d="M7.2 5l-1.4 3" stroke="#fff" stroke-width="1.2" stroke-linecap="round" />,
    ]),
  heroExp: (s) =>
    sv(s, [
      <path d="M12 1.8l8.5 4.9v10.6L12 22.2l-8.5-4.9V6.7z" fill="#58c94a" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M7.5 12l4.5-3.5 4.5 3.5M7.5 16.5l4.5-3.5 4.5 3.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />,
      <path d="M5.5 7.5l4-2.3" stroke="#c8ffb8" stroke-width="1.2" stroke-linecap="round" />,
    ]),
  power: (s) =>
    sv(s, [
      <path d="M13.5 1.5L4 13.5h6.5L9 22.5l10-13h-6.8z" fill="#ffd23c" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M12.2 4.8l-4.6 6.3" stroke="#fff6c0" stroke-width="1.2" stroke-linecap="round" />,
    ]),
  stamina: (s) =>
    sv(s, [
      <path d="M12 1.8c4.3 5 7.3 8.4 7.3 12.6a7.3 7.3 0 0 1-14.6 0c0-4.2 3-7.6 7.3-12.6z" fill="#ff7a3c" stroke={O} stroke-width="1.5" />,
      <path d="M13 9.5l-3.6 5h2.8l-1 4.2 3.8-5.3h-2.8z" fill="#fff4b0" stroke={O} stroke-width="0.8" stroke-linejoin="round" />,
    ]),
  troops: (s) =>
    sv(s, [
      <path d="M3.5 22c0-5 3.8-7.8 8.5-7.8s8.5 2.8 8.5 7.8z" fill="#6f8f4e" stroke={O} stroke-width="1.5" />,
      <circle cx="12" cy="10" r="4.2" fill="#f0c49a" stroke={O} stroke-width="1.4" />,
      <path d="M6.8 9.2C6.8 5.3 9 3 12 3s5.2 2.3 5.2 6.2z" fill="#56733a" stroke={O} stroke-width="1.4" stroke-linejoin="round" />,
      <path d="M5.8 9.2h12.4" stroke={O} stroke-width="1.6" stroke-linecap="round" />,
      <path d="M9 17l3 2.5 3-2.5" stroke="#3d5428" stroke-width="1.3" fill="none" />,
    ]),
  clock: (s) =>
    sv(s, [
      <circle cx="12" cy="12" r="9.5" fill="#f6fbff" stroke={O} stroke-width="1.6" />,
      <path d="M12 6.5V12l3.5 2.5" stroke={O} stroke-width="2" fill="none" stroke-linecap="round" />,
    ]),

  // ---------------- Items ----------------
  speed_1m: stopwatch('#6fbf5a', '1m'),
  speed_5m: stopwatch('#2fae64', '5m'),
  speed_1h: stopwatch('#3a8ee8', '1h'),
  speed_8h: stopwatch('#9b55e6', '8h'),
  speedup: (s) =>
    sv(s, [
      <rect x="9.5" y="1.5" width="5" height="3" rx="1" fill="#3a9cf0" stroke={O} stroke-width="1.2" />,
      <circle cx="12" cy="13" r="8.5" fill="#eef6ff" stroke={O} stroke-width="1.6" />,
      <path d="M13.5 6.5l-4.5 7h3l-1 4.5 4.5-7h-3z" fill="#ffc83a" stroke={O} stroke-width="1" stroke-linejoin="round" />,
    ]),
  ticket: (s) =>
    sv(s, [
      <path d="M2.5 7a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v2.2a2.8 2.8 0 0 0 0 5.6V17a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-2.2a2.8 2.8 0 0 0 0-5.6z" fill="#ff9a3c" stroke={O} stroke-width="1.5" />,
      <path d="M16 5.5v13" stroke="#b85a10" stroke-width="1.2" stroke-dasharray="1.6 1.4" />,
      <path d="M9.2 7.5l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.2 1.2.4-2.5-1.8-1.7 2.5-.3z" fill="#fff4b8" stroke={O} stroke-width="0.9" stroke-linejoin="round" />,
    ]),
  medal: (s) =>
    sv(s, [
      <path d="M7 1.5h4l2 7H9zM13 1.5h4l-2 7h-4z" fill="#e0483c" stroke={O} stroke-width="1.2" stroke-linejoin="round" />,
      <path d="M11 1.5h2l-1 3.5z" fill="#3a6ee8" />,
      <circle cx="12" cy="15" r="6.8" fill="#ffc83a" stroke={O} stroke-width="1.5" />,
      <circle cx="12" cy="15" r="4.6" fill="none" stroke="#b07c10" stroke-width="1" />,
      <path d="M12 11.6l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" fill="#fff4b8" stroke="#8a5a14" stroke-width="0.7" />,
    ]),
  shard_ssr: shard('#b25cff', '#6a26b0'),
  shard_ur: shard('#ffb52a', '#a86a00'),
  shard: shard('#58b8ff', '#1a5fa8'),
  crate_food: CRATE_FOOD,
  crate_iron: CRATE_IRON,
  crate_gold: CRATE_GOLD,
  box: crate(),
  supply: (s) =>
    sv(s, [
      <path d="M3 9a9 7 0 0 1 18 0z" fill="#e8eef5" stroke={O} stroke-width="1.4" />,
      <path d="M8 9a4 7 0 0 1 8 0" fill="#f06a4a" stroke={O} stroke-width="1" />,
      <path d="M3 9l6 6M21 9l-6 6M12 9v6" stroke={O} stroke-width="1" />,
      <rect x="7.5" y="14.5" width="9" height="7.5" rx="1" fill="#6f8f4e" stroke={O} stroke-width="1.4" />,
      <path d="M7.5 18h9M12 14.5V22" stroke="#3d5428" stroke-width="1.2" />,
    ]),
  gem_pouch: (s) =>
    sv(s, [
      <path d="M8 6.5h8l-1.5 2.5c4 1.5 6.5 5 6.5 8.5 0 3-2.5 4.5-9 4.5s-9-1.5-9-4.5c0-3.5 2.5-7 6.5-8.5z" fill="#8a4fd0" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M7 6.5c1-2 2.5-3.5 5-3.5s4 1.5 5 3.5" fill="none" stroke={O} stroke-width="1.4" />,
      <path d="M9 9h6" stroke="#ffc83a" stroke-width="1.6" stroke-linecap="round" />,
      <path d="M10 13.5h4l1.5 2-3.5 4-3.5-4z" fill="#4fc6ff" stroke={O} stroke-width="1" stroke-linejoin="round" />,
    ]),
  manual: book('#3d9a45', '#c8f0b8'),
  codex: book('#7a3fc0', '#e2c8ff'),
  potion: (s) =>
    sv(s, [
      <rect x="9.5" y="2" width="5" height="3" rx="1" fill="#a86a3a" stroke={O} stroke-width="1.2" />,
      <path d="M10 5h4v3.2c3 1.2 5 3.8 5 7a7 7 0 0 1-14 0c0-3.2 2-5.8 5-7z" fill="#e8f4ff" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M5.4 14c2 1 4.5 1.2 6.6 0s4.4-1 6.6 0a7 7 0 0 1-13.2 0z" fill="#ff7a3c" />,
      <path d="M12.8 11.5l-2.5 3.5h2l-.7 3 2.6-3.7h-2z" fill="#fff4b0" />,
      <path d="M8 11c.6-.8 1.3-1.3 2-1.6" stroke="#fff" stroke-width="1.2" stroke-linecap="round" />,
    ]),

  // ---------------- Navigation / features ----------------
  flask: (s) =>
    sv(s, [
      <path d="M9 2.5h6M10 2.5v6.2L4.2 18.6A2 2 0 0 0 6 21.5h12a2 2 0 0 0 1.8-2.9L14 8.7V2.5" fill="#e8f4ff" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M6.8 14.5h10.4l2.6 4.1a2 2 0 0 1-1.8 2.9H6a2 2 0 0 1-1.8-2.9z" fill="#38d6b0" />,
      <path d="M4.2 18.6A2 2 0 0 0 6 21.5h12a2 2 0 0 0 1.8-2.9L14 8.7V2.5M10 2.5v6.2z" fill="none" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <circle cx="10" cy="17.5" r="1.2" fill="#fff" />,
      <circle cx="13.8" cy="16" r="0.8" fill="#fff" />,
    ]),
  tasks: (s) =>
    sv(s, [
      <rect x="4" y="3.5" width="16" height="19" rx="2.2" fill="#f4ecd8" stroke={O} stroke-width="1.5" />,
      <rect x="8" y="1.8" width="8" height="4" rx="1.2" fill="#c98a3a" stroke={O} stroke-width="1.3" />,
      <path d="M7 10l1.5 1.5L11 9M7 15.5l1.5 1.5L11 14.5" stroke="#2f9a2a" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />,
      <path d="M13 10.5h4M13 16h4" stroke="#8a7a60" stroke-width="1.6" stroke-linecap="round" />,
    ]),
  bag: (s) =>
    sv(s, [
      <path d="M8.5 6V4.5a3.5 3.5 0 0 1 7 0V6" fill="none" stroke={O} stroke-width="1.6" />,
      <path d="M4.5 9a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v10.5a2.5 2.5 0 0 1-2.5 2.5H7a2.5 2.5 0 0 1-2.5-2.5z" fill="#b8844a" stroke={O} stroke-width="1.5" />,
      <path d="M4.5 11.5h15" stroke={O} stroke-width="1.3" />,
      <rect x="8" y="13.5" width="8" height="5.5" rx="1.2" fill="#d9a668" stroke={O} stroke-width="1.2" />,
      <rect x="10.5" y="10" width="3" height="3.2" rx="0.8" fill="#ffd23c" stroke={O} stroke-width="1" />,
    ]),
  gear: (s) =>
    sv(s, [
      <path
        d="M10.3 2h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9-2.6-.5v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z"
        fill="#a9b6c6"
        stroke={O}
        stroke-width="1.4"
        stroke-linejoin="round"
      />,
      <circle cx="12" cy="12" r="3.6" fill="#5a6878" stroke={O} stroke-width="1.4" />,
    ]),
  settings: (s) => ICONS.gear(s),
  globe: (s) =>
    sv(s, [
      <circle cx="12" cy="12" r="10" fill="#3aa0e8" stroke={O} stroke-width="1.6" />,
      <path d="M5 6.2c1.8.5 3.2 1.6 3 3.3-.2 1.6-2.4 1.8-2.6 3.4-.2 1.8 2.2 2.3 2.6 4.1.2 1-.3 2-1 2.7A10 10 0 0 1 5 6.2z" fill="#6fcf5a" stroke={O} stroke-width="1" />,
      <path d="M13 2.2c-.7 1.6.3 3.3 2 3.5 1.8.2 3.3 1.3 2.8 3-.5 1.8-3 1.6-3.4 3.4-.4 1.6 1.4 2.5 1.2 4.3-.1 1.3-1 2.6-2 3.4A10 10 0 0 0 13 2.2z" fill="#6fcf5a" stroke={O} stroke-width="1" />,
      <path d="M6.5 5.5a9 9 0 0 1 5-2.3" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity="0.7" fill="none" />,
    ]),
  map: (s) =>
    sv(s, [
      <path d="M2.5 5.5l6-2.5 7 2.5 6-2.5v15.5l-6 2.5-7-2.5-6 2.5z" fill="#f0dfb0" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M8.5 3v15.5M15.5 5.5V21" stroke={O} stroke-width="1.1" />,
      <path d="M5 13c2-1 4 1 6 0s3-3 5-2 3 0 4-1" stroke="#d04a3a" stroke-width="1.4" stroke-dasharray="1.8 1.4" fill="none" />,
      <path d="M17.5 7.5l2 2M19.5 7.5l-2 2" stroke="#d04a3a" stroke-width="1.5" stroke-linecap="round" />,
    ]),
  home: (s) =>
    sv(s, [
      <path d="M2.5 11.5L12 3l9.5 8.5" fill="none" stroke={O} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />,
      <path d="M5 10v11h14V10l-7-6z" fill="#e8c27a" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M2.5 11.5L12 3l9.5 8.5" fill="none" stroke="#c0453a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />,
      <rect x="9.5" y="14" width="5" height="7" rx="0.8" fill="#8a5a24" stroke={O} stroke-width="1.2" />,
    ]),
  helmet: (s) =>
    sv(s, [
      <path d="M3 15.5C3 9 7 4.5 12 4.5S21 9 21 15.5z" fill="#6f8f4e" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M1.8 15.5h20.4v2.2a1.3 1.3 0 0 1-1.3 1.3H3.1a1.3 1.3 0 0 1-1.3-1.3z" fill="#56733a" stroke={O} stroke-width="1.4" />,
      <path d="M12 7.5l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z" fill="#ffd23c" stroke={O} stroke-width="0.9" stroke-linejoin="round" />,
      <path d="M6 10.5c.8-2 2.2-3.5 4-4.2" stroke="#b8d69a" stroke-width="1.2" stroke-linecap="round" fill="none" />,
    ]),
  hero: (s) =>
    sv(s, [
      <path d="M3 22c0-5 4-8 9-8s9 3 9 8z" fill="#3a6ea8" stroke={O} stroke-width="1.5" />,
      <circle cx="12" cy="9.5" r="4.6" fill="#f0c49a" stroke={O} stroke-width="1.4" />,
      <path d="M7 8.5c0-3.5 2.2-6 5-6s5 2.5 5 6c-2-1.2-6-1.2-10 0z" fill="#3b2a1e" stroke={O} stroke-width="1.2" />,
      <path d="M9 17.5l3 3 3-3" stroke="#ffd23c" stroke-width="1.5" fill="none" />,
    ]),
  swords: (s) =>
    sv(s, [
      <path d="M4 3l10.5 10.5-1.5 1.5L2.5 4.5 2.5 3z" fill="#dfe6ee" stroke={O} stroke-width="1.3" stroke-linejoin="round" />,
      <path d="M20 3L9.5 13.5l1.5 1.5L21.5 4.5V3z" fill="#dfe6ee" stroke={O} stroke-width="1.3" stroke-linejoin="round" />,
      <path d="M11.5 15.5l-5 5M12.5 15.5l5 5" stroke="#8a5a24" stroke-width="2.4" stroke-linecap="round" />,
      <path d="M8 12.5l3.5 3.5M16 12.5l-3.5 3.5" stroke="#ffc83a" stroke-width="2.4" stroke-linecap="round" />,
      <circle cx="5.5" cy="21" r="1.4" fill="#ffc83a" stroke={O} stroke-width="0.9" />,
      <circle cx="18.5" cy="21" r="1.4" fill="#ffc83a" stroke={O} stroke-width="0.9" />,
    ]),
  sword: (s) => ICONS.swords(s),
  shield: (s) =>
    sv(s, [
      <path d="M12 2l8.5 3v6.5c0 5-3.6 9-8.5 10.5C7.1 20.5 3.5 16.5 3.5 11.5V5z" fill="#3a8ee8" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M12 2v20c4.9-1.5 8.5-5.5 8.5-10.5V5z" fill="#2a6ec0" />,
      <path d="M12 2l8.5 3v6.5c0 5-3.6 9-8.5 10.5C7.1 20.5 3.5 16.5 3.5 11.5V5z" fill="none" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M12 7l1.3 2.7 3 .4-2.2 2 .6 2.9-2.7-1.5-2.7 1.5.6-2.9-2.2-2 3-.4z" fill="#ffd23c" stroke={O} stroke-width="0.9" stroke-linejoin="round" />,
    ]),
  formation: (s) =>
    sv(s, [
      <rect x="2" y="2" width="20" height="20" rx="3" fill="#2a4e74" stroke={O} stroke-width="1.5" />,
      <circle cx="8.5" cy="8" r="2.6" fill="#ffd23c" stroke={O} stroke-width="1" />,
      <circle cx="15.5" cy="8" r="2.6" fill="#ffd23c" stroke={O} stroke-width="1" />,
      <circle cx="6" cy="16" r="2.3" fill="#8fd0ff" stroke={O} stroke-width="1" />,
      <circle cx="12" cy="16" r="2.3" fill="#8fd0ff" stroke={O} stroke-width="1" />,
      <circle cx="18" cy="16" r="2.3" fill="#8fd0ff" stroke={O} stroke-width="1" />,
    ]),
  truck: (s) =>
    sv(s, [
      <path d="M1.5 8.5h12v8h-12z" fill="#7a8f4e" stroke={O} stroke-width="1.4" stroke-linejoin="round" />,
      <path d="M13.5 10.5h4.5l3.5 3.5v2.5h-8z" fill="#5f7340" stroke={O} stroke-width="1.4" stroke-linejoin="round" />,
      <path d="M15 11.5h2.6l2 2H15z" fill="#bfe4ff" stroke={O} stroke-width="0.9" />,
      <path d="M4 6.5h6l1 2H3z" fill="#5f7340" stroke={O} stroke-width="1.2" stroke-linejoin="round" />,
      <path d="M7 6.5V4.2h6" stroke={O} stroke-width="1.5" stroke-linecap="round" fill="none" />,
      <circle cx="5.5" cy="17.5" r="2.4" fill="#2c3440" stroke={O} stroke-width="1.2" />,
      <circle cx="17.5" cy="17.5" r="2.4" fill="#2c3440" stroke={O} stroke-width="1.2" />,
      <circle cx="5.5" cy="17.5" r="0.9" fill="#9aa6b4" />,
      <circle cx="17.5" cy="17.5" r="0.9" fill="#9aa6b4" />,
      <path d="M3.5 12.5h8" stroke="#ffd23c" stroke-width="1.4" stroke-dasharray="2 1.5" />,
    ]),
  skull: (s) =>
    sv(s, [
      <path d="M12 2.5c-5 0-8.5 3.4-8.5 8 0 2.8 1.3 4.6 3 5.6V19a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-2.9c1.7-1 3-2.8 3-5.6 0-4.6-3.5-8-8.5-8z" fill="#9fcf7a" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <ellipse cx="8.5" cy="11" rx="2.3" ry="2.6" fill="#2a1e1e" />,
      <ellipse cx="15.5" cy="11" rx="2.3" ry="2.6" fill="#2a1e1e" />,
      <circle cx="8.5" cy="11" r="0.9" fill="#ff5a3c" />,
      <circle cx="15.5" cy="11" r="0.9" fill="#ff5a3c" />,
      <path d="M12 14l-1.2 2h2.4z" fill="#2a1e1e" />,
      <path d="M9.5 17.5v3M12 17.5v3M14.5 17.5v3" stroke={O} stroke-width="1.1" />,
    ]),
  district: (s) => ICONS.skull(s),
  calendar: (s) =>
    sv(s, [
      <rect x="2.5" y="4" width="19" height="17.5" rx="2.5" fill="#f6fbff" stroke={O} stroke-width="1.5" />,
      <path d="M2.5 6.5A2.5 2.5 0 0 1 5 4h14a2.5 2.5 0 0 1 2.5 2.5V9.5h-19z" fill="#ec4b3c" stroke={O} stroke-width="1.5" />,
      <path d="M7.5 2v4M16.5 2v4" stroke={O} stroke-width="2" stroke-linecap="round" />,
      <path d="M7.5 15l3 3 6-6" stroke="#2f9a2a" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round" />,
    ]),
  hammer: (s) =>
    sv(s, [
      <path d="M11.5 9.5l-8 8a1.8 1.8 0 0 0 2.5 2.5l8-8z" fill="#b8844a" stroke={O} stroke-width="1.4" stroke-linejoin="round" />,
      <path d="M9.5 6.5l5-4 3 1 3.5 3.5-2 2-1.5-1-3 3-5-4.5z" fill="#9aa6b4" stroke={O} stroke-width="1.4" stroke-linejoin="round" />,
      <path d="M12 4.8l2.5-1.8" stroke="#fff" stroke-width="1" stroke-linecap="round" />,
    ]),
  hospital: (s) =>
    sv(s, [
      <rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="#f6fbff" stroke={O} stroke-width="1.5" />,
      <path d="M9.5 5.5h5v4h4v5h-4v4h-5v-4h-4v-5h4z" fill="#ec4b3c" stroke={O} stroke-width="1.2" stroke-linejoin="round" />,
    ]),
  heart: (s) =>
    sv(s, [
      <path d="M12 21s-9-5.4-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.6-9 12-9 12z" fill="#ec4b3c" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M6.5 7.5a2.5 2.5 0 0 1 2.5-1.5" stroke="#ffb8b0" stroke-width="1.4" stroke-linecap="round" fill="none" />,
    ]),
  boot: (s) =>
    sv(s, [
      <path d="M6 2.5h7v9l6.5 3a2.5 2.5 0 0 1 1.5 2.3V19H3.5v-3.5L6 13z" fill="#8a5a24" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M3.5 19h17.5v2.5H3.5z" fill="#3a2a1e" stroke={O} stroke-width="1.3" />,
      <path d="M8.5 6h4M8.5 9h4" stroke="#d9a668" stroke-width="1.3" stroke-linecap="round" />,
    ]),
  target: (s) =>
    sv(s, [
      <circle cx="12" cy="12" r="9.5" fill="#f6fbff" stroke={O} stroke-width="1.5" />,
      <circle cx="12" cy="12" r="6.2" fill="#ec4b3c" stroke={O} stroke-width="1.2" />,
      <circle cx="12" cy="12" r="3" fill="#f6fbff" stroke={O} stroke-width="1.1" />,
      <path d="M12 0.8v5M12 18.2v5M0.8 12h5M18.2 12h5" stroke={O} stroke-width="1.6" />,
    ]),
  star: (s) =>
    sv(s, [
      <path d="M12 1.8l3.1 6.4 7 1-5.1 4.9 1.2 7L12 17.8l-6.2 3.3 1.2-7L1.9 9.2l7-1z" fill="#ffd23c" stroke={O} stroke-width="1.4" stroke-linejoin="round" />,
      <path d="M10.5 6.5l-1 2" stroke="#fff" stroke-width="1.2" stroke-linecap="round" />,
    ]),
  star_empty: (s) =>
    sv(s, [
      <path d="M12 1.8l3.1 6.4 7 1-5.1 4.9 1.2 7L12 17.8l-6.2 3.3 1.2-7L1.9 9.2l7-1z" fill="#3a4a5c" stroke={O} stroke-width="1.4" stroke-linejoin="round" />,
    ]),
  wheat: (s) => ICONS.food(s),
  lock: (s) =>
    sv(s, [
      <path d="M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3" fill="none" stroke={O} stroke-width="2.6" />,
      <path d="M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3" fill="none" stroke="#b8c4d2" stroke-width="1.3" />,
      <rect x="4.5" y="10" width="15" height="12" rx="2.5" fill="#ffc83a" stroke={O} stroke-width="1.5" />,
      <circle cx="12" cy="15" r="1.8" fill={O} />,
      <path d="M12 15v3.5" stroke={O} stroke-width="1.8" stroke-linecap="round" />,
    ]),
  check: (s) =>
    sv(s, [
      <circle cx="12" cy="12" r="10" fill="#4cc24a" stroke={O} stroke-width="1.5" />,
      <path d="M7 12.5l3.3 3.3L17 9" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />,
    ]),
  cross: (s) =>
    sv(s, [
      <circle cx="12" cy="12" r="10" fill="#ec4b3c" stroke={O} stroke-width="1.5" />,
      <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.8" stroke-linecap="round" />,
    ]),
  close: (s) =>
    sv(s, [<path d="M5 5l14 14M19 5L5 19" stroke="#fff" stroke-width="3.4" stroke-linecap="round" />]),
  arrow_right: (s) =>
    sv(s, [<path d="M8 4l8 8-8 8" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />]),
  arrow_left: (s) =>
    sv(s, [<path d="M16 4l-8 8 8 8" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />]),
  arrow: (s) => ICONS.arrow_right(s),
  upgrade: (s) =>
    sv(s, [
      <path d="M12 2l9 9.5h-5.2V22H8.2V11.5H3z" fill="#4cc24a" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M12 5.5l-4.5 4.8" stroke="#c8ffb8" stroke-width="1.4" stroke-linecap="round" />,
    ]),
  plus: (s) => sv(s, [<path d="M12 4v16M4 12h16" stroke="#fff" stroke-width="3.6" stroke-linecap="round" />]),
  minus: (s) => sv(s, [<path d="M4 12h16" stroke="#fff" stroke-width="3.6" stroke-linecap="round" />]),
  info: (s) =>
    sv(s, [
      <circle cx="12" cy="12" r="10" fill="#3a9cf0" stroke={O} stroke-width="1.5" />,
      <circle cx="12" cy="7.2" r="1.6" fill="#fff" />,
      <path d="M12 11v6.5" stroke="#fff" stroke-width="2.8" stroke-linecap="round" />,
    ]),
  chest: (s) =>
    sv(s, [
      <path d="M3 10.5h18v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20.5z" fill="#b8742e" stroke={O} stroke-width="1.5" />,
      <path d="M3 10.5C3 6 6 3.5 12 3.5S21 6 21 10.5z" fill="#d18c3c" stroke={O} stroke-width="1.5" />,
      <path d="M7.5 4.5v17.5M16.5 4.5v17.5" stroke="#ffc83a" stroke-width="2" />,
      <path d="M3 10.5h18" stroke={O} stroke-width="1.5" />,
      <rect x="10" y="9" width="4" height="5" rx="1" fill="#ffd23c" stroke={O} stroke-width="1.2" />,
    ]),
  chest_open: (s) =>
    sv(s, [
      <path d="M4 3.5h16l-1.5 7h-13z" fill="#8a5424" stroke={O} stroke-width="1.4" stroke-linejoin="round" />,
      <path d="M5 10.5l7-2 7 2" fill="#fff3a0" stroke="none" />,
      <circle cx="9" cy="9" r="1.4" fill="#ffd23c" stroke={O} stroke-width="0.8" />,
      <circle cx="13.5" cy="8.4" r="1.4" fill="#4fc6ff" stroke={O} stroke-width="0.8" />,
      <path d="M3 10.5h18v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20.5z" fill="#b8742e" stroke={O} stroke-width="1.5" />,
      <path d="M7.5 10.5v11.5M16.5 10.5v11.5" stroke="#ffc83a" stroke-width="2" />,
    ]),
  gift: (s) =>
    sv(s, [
      <rect x="3" y="9" width="18" height="12.5" rx="1.5" fill="#ec4b3c" stroke={O} stroke-width="1.5" />,
      <rect x="2" y="6.5" width="20" height="4.5" rx="1.2" fill="#ff6a5a" stroke={O} stroke-width="1.5" />,
      <path d="M10 6.5h4v15h-4z" fill="#ffd23c" stroke={O} stroke-width="1.2" />,
      <path d="M12 6.5C10 2.5 6 2.5 6.5 5S12 6.5 12 6.5 17.5 7.5 17.5 5 14 2.5 12 6.5z" fill="#ffd23c" stroke={O} stroke-width="1.2" />,
    ]),
  trophy: (s) =>
    sv(s, [
      <path d="M6.5 3h11v6a5.5 5.5 0 0 1-11 0z" fill="#ffc83a" stroke={O} stroke-width="1.5" />,
      <path d="M6.5 5H3.5v1.5a4 4 0 0 0 4 4M17.5 5h3v1.5a4 4 0 0 1-4 4" fill="none" stroke={O} stroke-width="1.5" />,
      <path d="M10.5 14h3v4h-3z" fill="#d19a1c" stroke={O} stroke-width="1.2" />,
      <rect x="6.5" y="18" width="11" height="3.5" rx="1" fill="#8a5a24" stroke={O} stroke-width="1.3" />,
      <path d="M9 5v4" stroke="#fff6c0" stroke-width="1.3" stroke-linecap="round" />,
    ]),
  sound: (s) =>
    sv(s, [
      <path d="M3 9h4l5-4.5v15L7 15H3z" fill="#dfe6ee" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="#dfe6ee" stroke-width="2" fill="none" stroke-linecap="round" />,
    ]),
  music: (s) =>
    sv(s, [
      <path d="M9 18V5.5l11-2.5v12.5" fill="none" stroke="#dfe6ee" stroke-width="2.2" stroke-linejoin="round" />,
      <ellipse cx="6.5" cy="18" rx="3.2" ry="2.6" fill="#dfe6ee" stroke={O} stroke-width="1.2" />,
      <ellipse cx="17.5" cy="15.5" rx="3.2" ry="2.6" fill="#dfe6ee" stroke={O} stroke-width="1.2" />,
    ]),
  quality: (s) =>
    sv(s, [
      <rect x="2" y="4" width="20" height="13" rx="2" fill="#2a4e74" stroke={O} stroke-width="1.5" />,
      <path d="M5 14l4-4 3 3 3-4 4 5z" fill="#6fcf5a" stroke={O} stroke-width="0.9" stroke-linejoin="round" />,
      <circle cx="16.5" cy="7.8" r="1.5" fill="#ffd23c" />,
      <path d="M8 20.5h8M12 17v3.5" stroke="#dfe6ee" stroke-width="2" stroke-linecap="round" />,
    ]),
  wrench: (s) =>
    sv(s, [
      <path d="M14.5 2.5a5.5 5.5 0 0 0-5.2 7.3L2.8 16.3a2 2 0 0 0 0 2.9l2 2a2 2 0 0 0 2.9 0l6.5-6.5a5.5 5.5 0 0 0 7.3-5.2l-3.3 3.3-3.5-1-1-3.5L17 5a5.5 5.5 0 0 0-2.5-2.5z" fill="#a9b6c6" stroke={O} stroke-width="1.5" stroke-linejoin="round" />,
    ]),
  rifle: (s) =>
    sv(s, [
      <path d="M2 13.5h15l3-2h2v3l-3 1H10l-2 5H5l1.5-5H2z" fill="#a9b6c6" stroke={O} stroke-width="1.4" stroke-linejoin="round" />,
      <path d="M9 13.5l1 -3h5l1 3" fill="#c98a3a" stroke={O} stroke-width="1.2" stroke-linejoin="round" />,
      <path d="M3 13.5v-2h3" stroke={O} stroke-width="1.2" fill="none" />,
    ]),
  type_tank: (s) =>
    sv(s, [
      <rect x="2.5" y="13.5" width="19" height="6" rx="3" fill="#4a5a3a" stroke={O} stroke-width="1.4" />,
      <path d="M5 13.5l2-4h9l2 4z" fill="#6f8f4e" stroke={O} stroke-width="1.4" stroke-linejoin="round" />,
      <path d="M13 10.5h9" stroke={O} stroke-width="2.2" stroke-linecap="round" />,
      <circle cx="6.5" cy="16.5" r="1.3" fill="#9aa6b4" />,
      <circle cx="12" cy="16.5" r="1.3" fill="#9aa6b4" />,
      <circle cx="17.5" cy="16.5" r="1.3" fill="#9aa6b4" />,
    ]),
  type_aircraft: (s) =>
    sv(s, [
      <path d="M12 2c1 0 1.6 1.2 1.6 3v4.5l8 5v2.2l-8-2.5v4.3l2.5 2v1.5L12 21l-4.1 1v-1.5l2.5-2v-4.3l-8 2.5v-2.2l8-5V5c0-1.8.6-3 1.6-3z" fill="#5aa8e8" stroke={O} stroke-width="1.3" stroke-linejoin="round" />,
    ]),
  type_missile: (s) =>
    sv(s, [
      <path d="M17.5 2.5l4 4-11 11-4-4z" fill="#e8eef5" stroke={O} stroke-width="1.4" stroke-linejoin="round" />,
      <path d="M17.5 2.5c2-.8 3.5-.7 4 0s.8 2 0 4z" fill="#ec4b3c" stroke={O} stroke-width="1.2" />,
      <path d="M6.5 13.5l-4 1 2.5 2.5M10.5 17.5l-1 4-2.5-2.5" fill="#ec4b3c" stroke={O} stroke-width="1.2" stroke-linejoin="round" />,
      <path d="M5 19l-3 3" stroke="#ffb03a" stroke-width="2.2" stroke-linecap="round" />,
    ]),
};

export function Icon(props: { name: string; size?: number; class?: string }) {
  const f = ICONS[props.name];
  const s = props.size ?? 20;
  if (!f)
    return (
      <span class={'icon ' + (props.class ?? '')} style={{ width: s + 'px', height: s + 'px' }}>
        {ICONS.box(s)}
      </span>
    );
  return <span class={'icon ' + (props.class ?? '')}>{f(s)}</span>;
}

export function hasIcon(name: string): boolean {
  return !!ICONS[name];
}

export function registerIcon(name: string, render: (size: number) => preact.JSX.Element): void {
  ICONS[name] = render;
}
