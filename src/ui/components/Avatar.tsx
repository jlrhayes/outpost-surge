// Procedural commander portraits (original inline SVG). OWNER: meta agent.
//   <Avatar index={game.player.avatar} size={56} />
const O = '#1b2530';

interface Look {
  bg: [string, string];
  skin: string;
  hair: string;
  gear: 'helmet' | 'beret' | 'cap' | 'bandana' | 'headset' | 'none';
  gearColor: string;
  beard?: boolean;
  scar?: boolean;
  glasses?: boolean;
}

export const AVATAR_LOOKS: Look[] = [
  { bg: ['#3a9cf0', '#1a4f8a'], skin: '#f0c49a', hair: '#3b2a1e', gear: 'beret', gearColor: '#c0392b', scar: true },
  { bg: ['#4cc24a', '#1f6a2a'], skin: '#c68a5a', hair: '#1e1612', gear: 'helmet', gearColor: '#6f8f4e', beard: true },
  { bg: ['#b25cff', '#4a1f8a'], skin: '#f6d2b0', hair: '#c9772e', gear: 'bandana', gearColor: '#2c3e50' },
  { bg: ['#ffae1a', '#a0520a'], skin: '#8a5a3a', hair: '#141010', gear: 'cap', gearColor: '#5a6f3a', glasses: true },
  { bg: ['#ec4b3c', '#7a1a14'], skin: '#e8b48a', hair: '#d8d0c0', gear: 'headset', gearColor: '#34495e', beard: true },
  { bg: ['#2fc6b8', '#0f5a5a'], skin: '#f0c49a', hair: '#e8c05a', gear: 'none', gearColor: '#000', scar: true },
];

export function Avatar(props: { index?: number; size?: number; class?: string }) {
  const L = AVATAR_LOOKS[Math.abs(props.index ?? 0) % AVATAR_LOOKS.length];
  const s = props.size ?? 56;
  const id = 'av' + (Math.abs(props.index ?? 0) % AVATAR_LOOKS.length);
  return (
    <svg class={props.class} width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id={id + 'bg'} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stop-color={L.bg[0]} />
          <stop offset="100%" stop-color={L.bg[1]} />
        </radialGradient>
        <clipPath id={id + 'clip'}>
          <circle cx="32" cy="32" r="30" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${id}bg)`} />
      <g clip-path={`url(#${id}clip)`}>
        {/* shoulders / uniform */}
        <path d="M6 66c0-12 11-19 26-19s26 7 26 19z" fill="#4a5a3a" stroke={O} stroke-width="2" />
        <path d="M24 48l8 9 8-9" fill="#e8e0c8" stroke={O} stroke-width="1.6" stroke-linejoin="round" />
        <path d="M12 56l6-2M52 56l-6-2" stroke="#ffd23c" stroke-width="2.4" stroke-linecap="round" />
        {/* neck */}
        <path d="M26 40h12v9l-6 4-6-4z" fill={L.skin} stroke={O} stroke-width="1.6" />
        {/* head */}
        <ellipse cx="32" cy="30" rx="12.5" ry="14" fill={L.skin} stroke={O} stroke-width="2" />
        {/* ears */}
        <ellipse cx="19.5" cy="31" rx="2.4" ry="3.4" fill={L.skin} stroke={O} stroke-width="1.6" />
        <ellipse cx="44.5" cy="31" rx="2.4" ry="3.4" fill={L.skin} stroke={O} stroke-width="1.6" />
        {/* hair (visible under beret/cap/none) */}
        {L.gear !== 'helmet' && <path d="M19.5 27c0-9 5.5-13.5 12.5-13.5S44.5 18 44.5 27c-3-4-7-5.5-12.5-5.5S22.5 23 19.5 27z" fill={L.hair} stroke={O} stroke-width="1.6" />}
        {/* eyes & brows */}
        <path d="M24.5 27.5l5-1M39.5 27.5l-5-1" stroke={O} stroke-width="2.2" stroke-linecap="round" />
        <ellipse cx="27.3" cy="31" rx="1.6" ry="1.9" fill={O} />
        <ellipse cx="36.7" cy="31" rx="1.6" ry="1.9" fill={O} />
        {L.glasses && (
          <g>
            <rect x="22.5" y="28" width="8.5" height="6" rx="2" fill="#1b2530" opacity="0.85" />
            <rect x="33" y="28" width="8.5" height="6" rx="2" fill="#1b2530" opacity="0.85" />
            <path d="M31 30.5h2" stroke={O} stroke-width="1.6" />
          </g>
        )}
        {/* nose & mouth */}
        <path d="M32 32v4.5h-2" stroke={O} stroke-width="1.4" fill="none" stroke-linecap="round" />
        <path d="M28 39.5c2.5 1.2 5.5 1.2 8 0" stroke={O} stroke-width="1.8" fill="none" stroke-linecap="round" />
        {L.beard && <path d="M20 33c1 8 5.5 11 12 11s11-3 12-11c-2 4-5 5.5-7 5-2-1.5-8-1.5-10 0-2 .5-5-1-7-5z" fill={L.hair} stroke={O} stroke-width="1.4" />}
        {L.scar && <path d="M38.5 34.5l3 4M39.5 35.5l1.5-.8M40.5 37l1.5-.8" stroke="#b0524a" stroke-width="1.3" stroke-linecap="round" />}
        {/* headgear */}
        {L.gear === 'helmet' && (
          <g>
            <path d="M18 29c0-11 6-17 14-17s14 6 14 17z" fill={L.gearColor} stroke={O} stroke-width="2" stroke-linejoin="round" />
            <path d="M16 28.5h32" stroke={O} stroke-width="3.4" stroke-linecap="round" />
            <path d="M16 28.5h32" stroke={L.gearColor} stroke-width="1.6" stroke-linecap="round" />
            <path d="M23 20c2-3 5-4.5 8-5" stroke="#b8d69a" stroke-width="1.6" stroke-linecap="round" fill="none" />
          </g>
        )}
        {L.gear === 'beret' && (
          <g>
            <path d="M18 23c1-7 8-10.5 16-10s13 5 11 9.5c-.5 1.2-2 1.5-3.5 1.5H20c-1.5 0-2.2-.5-2-1z" fill={L.gearColor} stroke={O} stroke-width="2" stroke-linejoin="round" />
            <circle cx="24.5" cy="19.5" r="2.4" fill="#ffd23c" stroke={O} stroke-width="1.2" />
          </g>
        )}
        {L.gear === 'cap' && (
          <g>
            <path d="M19.5 24c0-8 5.5-12 12.5-12s12.5 4 12.5 12z" fill={L.gearColor} stroke={O} stroke-width="2" stroke-linejoin="round" />
            <path d="M18 24h28c0 2-2 3-4 3H22c-2 0-4-1-4-3z" fill={L.gearColor} stroke={O} stroke-width="1.8" stroke-linejoin="round" />
            <path d="M30 16h4v4h-4z" fill="#ffd23c" stroke={O} stroke-width="1" />
          </g>
        )}
        {L.gear === 'bandana' && (
          <g>
            <path d="M19.5 25c0-8 5.5-12.5 12.5-12.5S44.5 17 44.5 25c-4-2-8-2.5-12.5-2.5S23.5 23 19.5 25z" fill={L.gearColor} stroke={O} stroke-width="1.8" stroke-linejoin="round" />
            <path d="M44 22l6 3-5 2" fill={L.gearColor} stroke={O} stroke-width="1.6" stroke-linejoin="round" />
            <circle cx="28" cy="18" r="0.9" fill="#fff" />
            <circle cx="35" cy="17.5" r="0.9" fill="#fff" />
          </g>
        )}
        {L.gear === 'headset' && (
          <g>
            <path d="M18 30c0-11 6-17.5 14-17.5S46 19 46 30" fill="none" stroke={L.gearColor} stroke-width="3" />
            <rect x="15.5" y="27" width="6" height="9" rx="2.5" fill={L.gearColor} stroke={O} stroke-width="1.4" />
            <rect x="42.5" y="27" width="6" height="9" rx="2.5" fill={L.gearColor} stroke={O} stroke-width="1.4" />
            <path d="M19 35c0 5 3 7 7 7.5" stroke={L.gearColor} stroke-width="1.8" fill="none" />
            <circle cx="27" cy="42.5" r="1.6" fill="#ec4b3c" />
          </g>
        )}
      </g>
      <circle cx="32" cy="32" r="30" fill="none" stroke={O} stroke-width="2" />
    </svg>
  );
}
