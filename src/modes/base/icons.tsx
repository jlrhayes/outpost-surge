// OWNER: base agent. Inline SVG glyphs used by the base overlay and building screens (no assets).
type P = { size?: number };

export const Hammer = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M3 20l9-9 2 2-9 9z" fill="#b07a3a" stroke="#5a3a14" stroke-width="1.3" />
    <path d="M10 5l4-3 7 7-3 3-2-2-2 2-4-4 2-2z" fill="#aeb8c4" stroke="#3c4550" stroke-width="1.3" />
  </svg>
);

export const ArrowUp = ({ size = 26 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 2l9 10h-5v10H8V12H3z" fill="#5fe04a" stroke="#1d6a14" stroke-width="1.6" stroke-linejoin="round" />
    <path d="M12 5l5.5 6" stroke="#c9ffba" stroke-width="1.4" fill="none" />
  </svg>
);

export const Plus = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" fill="#fff" stroke="#1a5fa8" stroke-width="1.2" />
  </svg>
);

export const Skull = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 2c5 0 8 3.5 8 8 0 3-1.5 4.5-3 5.5V19h-3v-2h-4v2H7v-3.5C5.5 14.5 4 13 4 10c0-4.5 3-8 8-8z" fill="#e8ecd8" stroke="#3a3f2c" stroke-width="1.4" />
    <circle cx="8.8" cy="10.5" r="2.2" fill="#3a3f2c" />
    <circle cx="15.2" cy="10.5" r="2.2" fill="#3a3f2c" />
    <path d="M11 14h2l-1 1.6z" fill="#3a3f2c" />
  </svg>
);

export const Swords = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M4 3l9 9-2 2-9-9V3z" fill="#dfe6ee" stroke="#39414a" stroke-width="1.2" />
    <path d="M20 3l-9 9 2 2 9-9V3z" fill="#dfe6ee" stroke="#39414a" stroke-width="1.2" />
    <path d="M6 16l2 2-3 3-2-2zM18 16l-2 2 3 3 2-2z" fill="#b07a3a" stroke="#5a3a14" stroke-width="1.2" />
  </svg>
);

export const Lock = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M7 10V7a5 5 0 0110 0v3" stroke="#c8d2dc" stroke-width="2.4" fill="none" />
    <rect x="4" y="10" width="16" height="12" rx="2" fill="#f5c542" stroke="#8a6410" stroke-width="1.4" />
  </svg>
);

export const Check = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="#4cc24a" stroke="#1d6a14" stroke-width="1.4" />
    <path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" />
  </svg>
);

export const Cross = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="#ec4b3c" stroke="#8c1a10" stroke-width="1.4" />
    <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.6" stroke-linecap="round" />
  </svg>
);

export const Bolt = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="#ffd23c" stroke="#a07810" stroke-width="1.5" />
  </svg>
);

export const Crate = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M3 8l9-5 9 5v9l-9 5-9-5z" fill="#d89a4a" stroke="#6a4214" stroke-width="1.4" />
    <path d="M3 8l9 5 9-5M12 13v9" stroke="#6a4214" stroke-width="1.3" fill="none" />
    <path d="M7.5 5.5l9 5" stroke="#ffe08a" stroke-width="1.6" />
  </svg>
);

export const Jeep = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M2 14l2-5h9l3 3h5l1 2v3H2z" fill="#6d8a44" stroke="#2c3a18" stroke-width="1.3" />
    <path d="M6 9l1.5-3h4L12 9" stroke="#2c3a18" stroke-width="1.3" fill="#a6d8ee" />
    <circle cx="6.5" cy="17.5" r="2.4" fill="#222" />
    <circle cx="17.5" cy="17.5" r="2.4" fill="#222" />
    <path d="M2 13h20" stroke="#ff8a1a" stroke-width="1.4" />
  </svg>
);

export const Gear = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path
      d="M12 8a4 4 0 100 8 4 4 0 000-8zm8.5 5.4l-.1-2.8 2-1.6-2-3.4-2.4.8-2.3-1.4-.5-2.5h-4l-.5 2.5-2.3 1.4-2.4-.8-2 3.4 2 1.6v2.8l-2 1.6 2 3.4 2.4-.8 2.3 1.4.5 2.5h4l.5-2.5 2.3-1.4 2.4.8 2-3.4z"
      fill="#c8d2dc"
      stroke="#3c4550"
      stroke-width="1.1"
    />
  </svg>
);
