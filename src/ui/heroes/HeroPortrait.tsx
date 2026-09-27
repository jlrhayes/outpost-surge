// OWNER: heroes agent. Procedurally generated SVG character busts (no image assets).
// Each hero's look lives in src/data/heroes.ts (PortraitLook); zombies get ZombiePortrait.
import type { JSX } from 'preact';
import { heroDef, type PortraitLook } from '../../data/heroes';
import type { HeroType, Rarity } from '../../core/types';

const SKIN = ['#ffe0c4', '#f3c9a0', '#dca47a', '#bb8157', '#8e5a3a', '#5f3b25'];

function mix(hex: string, to: string, t: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const ch = (x: number, s: number) => (x >> s) & 255;
  const c = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}
const darken = (h: string, t = 0.2) => mix(h, '#000000', t);
const lighten = (h: string, t = 0.2) => mix(h, '#ffffff', t);

const BG: Record<HeroType, [string, string]> = {
  tank: ['#9ab866', '#26351a'],
  aircraft: ['#86c4f0', '#152a48'],
  missile: ['#eea068', '#431b0e'],
};
const UNIFORM: Record<HeroType, string> = { tank: '#5a6b36', aircraft: '#3f6390', missile: '#8a5634' };

function Face(props: { look: PortraitLook; skin: string }): JSX.Element {
  const { look, skin } = props;
  switch (look.face) {
    case 'round':
      return <ellipse cx="50" cy="45" rx="16.5" ry="17.2" fill={skin} />;
    case 'long':
      return <ellipse cx="50" cy="45.5" rx="14" ry="19.5" fill={skin} />;
    case 'square':
      return <path d="M35 38 Q35 26 50 26 Q65 26 65 38 L65 52 Q64 63 50 64.5 Q36 63 35 52 Z" fill={skin} />;
    case 'heart':
      return <path d="M34.5 40 Q34.5 26 50 26 Q65.5 26 65.5 40 Q65.5 53 50 64.5 Q34.5 53 34.5 40 Z" fill={skin} />;
    default:
      return <ellipse cx="50" cy="45" rx="15" ry="18.3" fill={skin} />;
  }
}

function HairBack(props: { look: PortraitLook }): JSX.Element | null {
  const c = props.look.hairColor;
  switch (props.look.hair) {
    case 'long':
      return <path d="M31 45 Q28 19 50 19 Q72 19 69 45 L72 76 Q64 80 60 73 L40 73 Q36 80 28 76 Z" fill={darken(c, 0.12)} />;
    case 'bob':
      return <path d="M31 45 Q29 20 50 20 Q71 20 69 45 L70 61 Q64 64 60 59 L40 59 Q36 64 30 61 Z" fill={darken(c, 0.12)} />;
    case 'ponytail':
      return <path d="M60 26 Q80 30 76 58 Q74 66 70 70 Q72 52 62 40 Z" fill={darken(c, 0.1)} />;
    case 'bun':
      return (
        <g fill={darken(c, 0.08)}>
          <circle cx="50" cy="19" r="8" />
          <circle cx="50" cy="19" r="4" fill={darken(c, 0.25)} opacity="0.5" />
        </g>
      );
    case 'braids':
      return (
        <g fill={darken(c, 0.1)}>
          {[50, 56, 62, 68, 74].map((y) => (
            <>
              <ellipse cx="32.5" cy={y} rx="3.2" ry="3.6" />
              <ellipse cx="67.5" cy={y} rx="3.2" ry="3.6" />
            </>
          ))}
        </g>
      );
    default:
      return null;
  }
}

function HairFront(props: { look: PortraitLook }): JSX.Element | null {
  const c = props.look.hairColor;
  const hl = lighten(c, 0.25);
  switch (props.look.hair) {
    case 'buzz':
      return <path d="M35 40 Q34 25 50 24.5 Q66 25 65 40 Q61 31 50 30.5 Q39 31 35 40 Z" fill={c} opacity="0.92" />;
    case 'short':
      return (
        <g>
          <path d="M34 42 Q31 21 50 21 Q69 21 66 42 Q63 32 57 31 Q52 35 45 32 Q38 33 34 42 Z" fill={c} />
          <path d="M42 25 Q50 22 58 25" stroke={hl} stroke-width="1.2" fill="none" opacity="0.6" />
        </g>
      );
    case 'sidepart':
      return (
        <g>
          <path d="M33 44 Q30 20 52 20 Q70 21 67 42 Q64 29 58 28 Q48 36 37 35 Q34 39 33 44 Z" fill={c} />
          <path d="M45 24 Q52 22 60 26" stroke={hl} stroke-width="1.2" fill="none" opacity="0.6" />
        </g>
      );
    case 'swept':
      return (
        <g>
          <path d="M34 40 Q29 16 50 14.5 Q71 16 66 40 Q63 28 55 27 Q46 28 40 30.5 Q36 34 34 40 Z" fill={c} />
          <path d="M40 20 Q50 15 60 19" stroke={hl} stroke-width="1.4" fill="none" opacity="0.6" />
        </g>
      );
    case 'mohawk':
      return (
        <g>
          <path d="M35 40 Q34 26 50 25 Q66 26 65 40 Q61 32 50 31 Q39 32 35 40 Z" fill={c} opacity="0.3" />
          <path d="M45.5 31 Q44 13 50 9 Q56 13 54.5 31 Z" fill={c} />
          <path d="M50 11 L50 29" stroke={hl} stroke-width="1" opacity="0.6" />
        </g>
      );
    case 'curly':
      return (
        <g fill={c}>
          {[
            [36, 37, 5],
            [39, 30, 6],
            [45, 25.5, 6],
            [52, 24, 6.5],
            [58.5, 26.5, 6],
            [63, 32, 5.5],
            [64.5, 38.5, 4.5],
          ].map(([x, y, r]) => (
            <circle cx={x} cy={y} r={r} />
          ))}
          <circle cx="47" cy="25" r="2" fill={hl} opacity="0.45" />
        </g>
      );
    case 'bald':
      return <ellipse cx="45" cy="30" rx="5" ry="2.5" fill="#ffffff" opacity="0.18" />;
    case 'long':
    case 'bob':
      return <path d="M34 42 Q33 22 50 21.5 Q67 22 66 42 Q64 34 57 33 Q52 30 48 34 Q40 34 34 42 Z" fill={c} />;
    case 'ponytail':
    case 'bun':
      return (
        <g>
          <path d="M34.5 41 Q33 22 50 21.5 Q67 22 65.5 41 Q62 31 50 30 Q38 31 34.5 41 Z" fill={c} />
          <path d="M42 25 Q50 22.5 58 25" stroke={hl} stroke-width="1.1" fill="none" opacity="0.6" />
        </g>
      );
    case 'braids':
      return (
        <g>
          <path d="M34.5 42 Q33 22 50 21.5 Q67 22 65.5 42 Q62 31 50.8 30 L50 25 L49.2 30 Q38 31 34.5 42 Z" fill={c} />
        </g>
      );
    default:
      return null;
  }
}

function Eye(props: { x: number; look: PortraitLook; kind: PortraitLook['eyes'] }): JSX.Element {
  const { x, look } = props;
  const iris = look.eyeColor ?? '#3a2a1a';
  const ry = props.kind === 'narrow' ? 1.6 : props.kind === 'wide' ? 3.1 : 2.5;
  const ir = props.kind === 'narrow' ? 1.45 : props.kind === 'wide' ? 2.15 : 1.9;
  return (
    <g>
      <ellipse cx={x} cy="46.5" rx="3.4" ry={ry} fill="#ffffff" />
      <circle cx={x + 0.2} cy="46.6" r={ir} fill={iris} />
      <circle cx={x + 0.2} cy="46.6" r={ir * 0.45} fill="#0d0d12" />
      <circle cx={x + 0.9} cy="45.8" r="0.6" fill="#ffffff" />
      <path d={`M${x - 3.6} ${46.5 - ry * 0.55} Q${x} ${46.5 - ry - 0.9} ${x + 3.6} ${46.5 - ry * 0.55}`} stroke="#2a1a14" stroke-width="0.9" fill="none" />
    </g>
  );
}

function Eyes(props: { look: PortraitLook }): JSX.Element {
  const { look } = props;
  const lashes = look.extra?.includes('lashes');
  const lashEls = lashes ? (
    <g stroke="#1a1010" stroke-width="0.8" stroke-linecap="round">
      <path d="M39.8 45 L38.4 43.8" />
      <path d="M60.2 45 L61.6 43.8" />
    </g>
  ) : null;
  switch (look.eyes) {
    case 'visor':
      return (
        <g>
          <rect x="34.5" y="42.2" width="31" height="7.4" rx="3.6" fill={look.eyeColor ?? '#40e0ff'} opacity="0.85" />
          <rect x="34.5" y="42.2" width="31" height="7.4" rx="3.6" fill="none" stroke="#1a2a3a" stroke-width="1" />
          <path d="M37 44.2 L46 44.2" stroke="#ffffff" stroke-width="1.1" opacity="0.8" stroke-linecap="round" />
        </g>
      );
    case 'shades':
      return (
        <g>
          <path d="M36.5 43 L48 43 L47.2 48.4 Q42 50.2 37.6 48.4 Z" fill="#14161c" />
          <path d="M52 43 L63.5 43 L62.4 48.4 Q58 50.2 52.8 48.4 Z" fill="#14161c" />
          <path d="M48 43.6 L52 43.6" stroke="#14161c" stroke-width="1.2" />
          <path d="M34.5 43.4 L36.5 43.2 M63.5 43.2 L65.5 43.4" stroke="#14161c" stroke-width="1" />
          <path d="M38.5 44.4 L42.5 44.4 M54 44.4 L58 44.4" stroke="#8ab8ff" stroke-width="0.9" opacity="0.7" />
        </g>
      );
    case 'wink':
      return (
        <g>
          <Eye x={43.5} look={look} kind="normal" />
          <path d="M53 46.8 Q56.5 49 60 46.8" stroke="#2a1a14" stroke-width="1.3" fill="none" stroke-linecap="round" />
          {lashEls}
        </g>
      );
    case 'patch':
      return (
        <g>
          <path d="M31 41 L69 37.5" stroke="#1a1a1a" stroke-width="1.1" />
          <ellipse cx="43.5" cy="46.5" rx="4.6" ry="4" fill="#1a1a1a" />
          <Eye x={56.5} look={look} kind="normal" />
        </g>
      );
    default:
      return (
        <g>
          <Eye x={43.5} look={look} kind={look.eyes} />
          <Eye x={56.5} look={look} kind={look.eyes} />
          {lashEls}
        </g>
      );
  }
}

function Brows(props: { look: PortraitLook }): JSX.Element {
  const { look } = props;
  const c = look.hair === 'bald' || look.hairColor === '#e8e8e8' ? darken(look.hairColor, 0.45) : darken(look.hairColor, 0.1);
  const w = look.brows === 'thick' ? 2.6 : 1.7;
  const common = { stroke: c, 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round' as const };
  switch (look.brows) {
    case 'angry':
      return (
        <g {...common}>
          <path d="M39.5 40 L47 42.3" />
          <path d="M53 42.3 L60.5 40" />
        </g>
      );
    case 'raised':
      return (
        <g {...common}>
          <path d="M39.5 41.8 Q43.5 38.3 47 40.6" />
          <path d="M53 40.6 Q56.5 38.3 60.5 41.8" />
        </g>
      );
    default:
      return (
        <g {...common}>
          <path d="M39.5 41.6 L47 41" />
          <path d="M53 41 L60.5 41.6" />
        </g>
      );
  }
}

function Mouth(props: { look: PortraitLook }): JSX.Element {
  const lip = '#8a3a2e';
  const common = { stroke: lip, 'stroke-width': 1.35, fill: 'none', 'stroke-linecap': 'round' as const };
  switch (props.look.mouth) {
    case 'smile':
      return <path d="M45.5 56.5 Q50 60.6 54.5 56.5" {...common} />;
    case 'smirk':
      return <path d="M46 57.6 Q51 58.8 54.6 55.4" {...common} />;
    case 'flat':
      return <path d="M46 57.6 L54 57.6" {...common} />;
    case 'grin':
      return (
        <g>
          <path d="M44.5 56 Q50 62.5 55.5 56 Z" fill="#ffffff" stroke={lip} stroke-width="1.1" stroke-linejoin="round" />
          <path d="M45.5 57.2 L54.5 57.2" stroke="#d8d0c8" stroke-width="0.6" />
        </g>
      );
    case 'frown':
      return <path d="M46 58.8 Q50 55.6 54 58.8" {...common} />;
    case 'open':
      return (
        <g>
          <ellipse cx="50" cy="57.6" rx="2.8" ry="2" fill="#6a2020" />
          <ellipse cx="50" cy="58.6" rx="1.6" ry="0.8" fill="#d06060" />
        </g>
      );
  }
}

function Beard(props: { look: PortraitLook }): JSX.Element | null {
  const c = props.look.hairColor;
  switch (props.look.beard) {
    case 'stubble':
      return <path d="M36 51 Q37 64 50 66 Q63 64 64 51 Q61 60.5 50 60.5 Q39 60.5 36 51 Z" fill={c} opacity="0.3" />;
    case 'full':
      return (
        <g>
          <path d="M34.8 47 Q34.5 68 50 70.5 Q65.5 68 65.2 47 Q62 58 56.5 57.8 Q50 55.5 43.5 57.8 Q38 58 34.8 47 Z" fill={c} />
          <path d="M44 55.2 Q47 53 50 54.6 Q53 53 56 55.2 Q53 57 50 56 Q47 57 44 55.2 Z" fill={darken(c, 0.15)} />
        </g>
      );
    case 'mustache':
      return <path d="M44.2 55.4 Q47 52.8 50 54.4 Q53 52.8 55.8 55.4 Q53 57.2 50 56 Q47 57.2 44.2 55.4 Z" fill={c} />;
    case 'goatee':
      return (
        <g fill={c}>
          <path d="M46.5 60 Q50 67.5 53.5 60 Q50 61.8 46.5 60 Z" />
          <path d="M45.5 55.3 Q50 53.5 54.5 55.3 Q50 56.5 45.5 55.3 Z" />
        </g>
      );
    default:
      return null;
  }
}

function Extras(props: { look: PortraitLook; skin: string }): JSX.Element {
  const ex = props.look.extra ?? [];
  return (
    <g>
      {ex.includes('blush') && (
        <g fill="#ff7a8a" opacity="0.32">
          <ellipse cx="40" cy="52.5" rx="3.2" ry="1.8" />
          <ellipse cx="60" cy="52.5" rx="3.2" ry="1.8" />
        </g>
      )}
      {ex.includes('freckles') && (
        <g fill={darken(props.skin, 0.35)} opacity="0.6">
          {[
            [40, 51.5],
            [42.5, 52.8],
            [39, 53.5],
            [60, 51.5],
            [57.5, 52.8],
            [61, 53.5],
          ].map(([x, y]) => (
            <circle cx={x} cy={y} r="0.55" />
          ))}
        </g>
      )}
      {ex.includes('paint') && (
        <g stroke="#1e2418" stroke-width="1.7" opacity="0.85" stroke-linecap="round">
          <path d="M38.5 51 L46.5 50.3" />
          <path d="M53.5 50.3 L61.5 51" />
        </g>
      )}
      {ex.includes('scar') && (
        <g stroke="#b85a52" stroke-width="1.1" fill="none" stroke-linecap="round" opacity="0.9">
          <path d="M57 37.5 L60.5 53" />
          <path d="M57.2 41 L60 40.2 M58 45 L60.8 44.2 M58.8 49 L61.5 48.2" stroke-width="0.7" />
        </g>
      )}
      {ex.includes('mole') && <circle cx="56.5" cy="55" r="0.7" fill="#3a2016" />}
      {ex.includes('bandage') && (
        <g transform="rotate(-18 60 36)">
          <rect x="55.5" y="34" width="9" height="3.6" rx="1" fill="#f4efe4" stroke="#c8bca8" stroke-width="0.5" />
          <path d="M58.5 34.2 L58.5 37.4 M61.5 34.2 L61.5 37.4" stroke="#c8bca8" stroke-width="0.4" />
        </g>
      )}
      {ex.includes('earring') && <circle cx="65.4" cy="53.2" r="1.3" fill="#ffd040" stroke="#a07810" stroke-width="0.4" />}
      {ex.includes('cigar') && (
        <g>
          <path d="M54 57.4 L62.5 59.6" stroke="#6a3f22" stroke-width="2.2" stroke-linecap="round" />
          <circle cx="63" cy="59.8" r="1.1" fill="#ff7a2a" />
          <path d="M64 58 Q66 54 64 51 Q62.5 48 65 45" stroke="#d0d0d0" stroke-width="0.9" fill="none" opacity="0.7" />
        </g>
      )}
    </g>
  );
}

function Hat(props: { look: PortraitLook; type: HeroType }): JSX.Element | null {
  const { look } = props;
  const c = look.hatColor ?? UNIFORM[props.type];
  const d = darken(c, 0.25);
  const l = lighten(c, 0.2);
  switch (look.hat) {
    case 'helmet':
      return (
        <g>
          <path d="M33 42 L37 60" stroke="#2a2a22" stroke-width="1" />
          <path d="M67 42 L63 60" stroke="#2a2a22" stroke-width="1" />
          <path d="M30.5 39 Q30 16 50 15.5 Q70 16 69.5 39 Z" fill={c} />
          <ellipse cx="42" cy="24" rx="4" ry="2.4" fill={d} opacity="0.55" />
          <ellipse cx="57" cy="29" rx="4.5" ry="2.2" fill={d} opacity="0.55" />
          <ellipse cx="50" cy="19.5" rx="3" ry="1.6" fill={l} opacity="0.5" />
          <path d="M27.5 39.5 Q50 34.5 72.5 39.5 L72 42.5 Q50 37.8 28 42.5 Z" fill={d} />
        </g>
      );
    case 'tanker':
      return (
        <g>
          <path d="M29 40 Q28.5 17 50 17 Q71.5 17 71 40 Z" fill={c} />
          <path d="M40 18.5 L37.5 39 M50 17 L50 39 M60 18.5 L62.5 39" stroke={d} stroke-width="1.6" />
          <rect x="27.5" y="37" width="8" height="17" rx="3.5" fill={c} stroke={d} stroke-width="0.8" />
          <rect x="64.5" y="37" width="8" height="17" rx="3.5" fill={c} stroke={d} stroke-width="0.8" />
          <path d="M31 27 Q50 22 69 27" stroke="#2a2016" stroke-width="2.2" fill="none" />
          <circle cx="43" cy="25" r="4.4" fill="#2a2a2a" />
          <circle cx="57" cy="25" r="4.4" fill="#2a2a2a" />
          <circle cx="43" cy="25" r="3" fill="#6ab0c8" />
          <circle cx="57" cy="25" r="3" fill="#6ab0c8" />
          <path d="M41.5 23.8 L43.5 23 M55.5 23.8 L57.5 23" stroke="#ffffff" stroke-width="0.8" />
        </g>
      );
    case 'cap':
      return (
        <g>
          <path d="M33 34 Q32.5 17.5 50 17.5 Q67.5 17.5 67 34 Z" fill={c} />
          <path d="M30.5 33.5 Q50 38.5 69.5 33.5 Q72 36.5 66 38.5 Q50 42.5 34 38.5 Q28 36.5 30.5 33.5 Z" fill={d} />
          <path d="M50 22.5 L51.5 25.8 L55 26 L52.3 28.2 L53.2 31.6 L50 29.7 L46.8 31.6 L47.7 28.2 L45 26 L48.5 25.8 Z" fill="#ffd040" />
        </g>
      );
    case 'beret':
      return (
        <g>
          <path d="M29 35 Q26 21 45 18.5 Q70 16.5 71 30 Q65 34.5 50 34.5 Q38 36 29 35 Z" fill={c} />
          <path d="M31 35 Q50 37.5 68 32.5" stroke={d} stroke-width="2.2" fill="none" />
          <circle cx="39" cy="28" r="3" fill="#e8c040" stroke="#8a6a10" stroke-width="0.5" />
        </g>
      );
    case 'pilot':
      return (
        <g>
          <path d="M29.5 47 Q27.5 14.5 50 14.5 Q72.5 14.5 70.5 47 L70.5 55 Q66.5 57.5 64.5 51 L64.5 40 Q50 33.5 35.5 40 L35.5 51 Q33.5 57.5 29.5 55 Z" fill={c} />
          <ellipse cx="46" cy="19" rx="6" ry="2" fill="#ffffff" opacity="0.2" />
          <rect x="35" y="24" width="30" height="8" rx="4" fill="#20242c" />
          <rect x="36.5" y="25.2" width="12" height="5.6" rx="2.6" fill="#e8a040" opacity="0.9" />
          <rect x="51.5" y="25.2" width="12" height="5.6" rx="2.6" fill="#e8a040" opacity="0.9" />
          <path d="M38 26.8 L42 26.8 M53 26.8 L57 26.8" stroke="#fff4d0" stroke-width="0.8" />
          <path d="M67 53 Q66 62 56.5 61" stroke="#20242c" stroke-width="1.4" fill="none" />
          <circle cx="56" cy="61" r="1.6" fill="#20242c" />
        </g>
      );
    case 'goggles':
      return (
        <g>
          <path d="M33 34 Q50 29.5 67 34" stroke="#2a2016" stroke-width="2.4" fill="none" />
          <circle cx="42.5" cy="32.5" r="5.4" fill={c} />
          <circle cx="57.5" cy="32.5" r="5.4" fill={c} />
          <circle cx="42.5" cy="32.5" r="3.8" fill="#8ad0f0" />
          <circle cx="57.5" cy="32.5" r="3.8" fill="#8ad0f0" />
          <path d="M40.5 30.8 L43 30 M55.5 30.8 L58 30" stroke="#ffffff" stroke-width="1" stroke-linecap="round" />
        </g>
      );
    case 'headset':
      return (
        <g>
          <path d="M31 44 Q29 16 50 16 Q71 16 69 44" stroke="#2a2a2e" stroke-width="3" fill="none" />
          <rect x="27.5" y="40" width="7.5" height="13" rx="3" fill={c} stroke="#2a2a2e" stroke-width="1" />
          <rect x="65" y="40" width="7.5" height="13" rx="3" fill={c} stroke="#2a2a2e" stroke-width="1" />
          <path d="M31 52 Q33 60 44 60" stroke="#2a2a2e" stroke-width="1.3" fill="none" />
          <circle cx="44.5" cy="60" r="1.5" fill="#2a2a2e" />
        </g>
      );
    case 'bandana':
      return (
        <g>
          <path d="M33 33 Q50 27.5 67 33 L67.5 39 Q50 33.5 32.5 39 Z" fill={c} />
          <path d="M66.5 35 L76 38.5 L72.5 44 Z M66.5 36 L74 43.5 L69 45 Z" fill={d} />
          <circle cx="40" cy="34.5" r="0.8" fill="#ffffff" opacity="0.7" />
          <circle cx="47" cy="33" r="0.8" fill="#ffffff" opacity="0.7" />
          <circle cx="55" cy="33" r="0.8" fill="#ffffff" opacity="0.7" />
          <circle cx="62" cy="34.5" r="0.8" fill="#ffffff" opacity="0.7" />
        </g>
      );
    case 'boonie':
      return (
        <g>
          <ellipse cx="50" cy="33.5" rx="25" ry="5.5" fill={d} />
          <path d="M35.5 33.5 Q35.5 18 50 18 Q64.5 18 64.5 33.5 Z" fill={c} />
          <path d="M35.8 30 Q50 33 64.2 30" stroke={d} stroke-width="1.6" fill="none" />
        </g>
      );
    default:
      return null;
  }
}

function Body(props: { type: HeroType; rarity: Rarity; skin: string }): JSX.Element {
  const u = UNIFORM[props.type];
  const d = darken(u, 0.28);
  const l = lighten(u, 0.15);
  const pips = props.rarity === 'UR' ? 3 : props.rarity === 'SSR' ? 2 : 1;
  const pipColor = props.rarity === 'UR' ? '#ffc830' : props.rarity === 'SSR' ? '#e0c0ff' : '#c8d8e8';
  return (
    <g>
      <path d="M43 57 L43 71 Q50 75.5 57 71 L57 57 Z" fill={darken(props.skin, 0.18)} />
      <path d="M6 101 Q8 78 31 72 Q41 69.5 50 76 Q59 69.5 69 72 Q92 78 94 101 Z" fill={u} />
      <path d="M12 90 Q20 80 31 76" stroke={l} stroke-width="1.2" fill="none" opacity="0.5" />
      {props.type === 'tank' && (
        <g>
          <path d="M39.5 70 L50 83 L60.5 70 L56.5 68.8 L50 76.5 L43.5 68.8 Z" fill={d} />
          <path d="M26 74 L40 101" stroke={d} stroke-width="3.2" />
          <rect x="60" y="86" width="12" height="8" rx="1.5" fill={d} />
          <path d="M62 90 L70 90" stroke="#c8b060" stroke-width="1" />
        </g>
      )}
      {props.type === 'aircraft' && (
        <g>
          <path d="M35.5 72.5 Q50 85 64.5 72.5 L67 78 Q50 91 33 78 Z" fill="#e89a2a" />
          <path d="M50 84 L50 101" stroke={d} stroke-width="1.4" />
          <circle cx="30" cy="88" r="4.5" fill={d} />
          <path d="M27.5 88 L32.5 88 M30 85.5 L30 90.5" stroke="#ffffff" stroke-width="0.9" />
        </g>
      )}
      {props.type === 'missile' && (
        <g>
          <path d="M38 71 L47.5 90 L50 79 L52.5 90 L62 71 L57 69.5 L50 77 L43 69.5 Z" fill={d} />
          <path d="M44 72 Q50 80 56 72" stroke="#c83a2a" stroke-width="2.4" fill="none" />
          <rect x="24" y="84" width="10" height="7" rx="1" fill={d} />
          <path d="M26 87.5 L32 87.5" stroke="#ffb040" stroke-width="1.2" />
        </g>
      )}
      <g fill={pipColor} stroke={darken(pipColor, 0.4)} stroke-width="0.5">
        {Array.from({ length: pips }, (_, i) => (
          <rect x={73 + i * 4.2} y="79.5" width="3" height="5.5" rx="0.6" transform={`rotate(18 ${74.5 + i * 4.2} 82)`} />
        ))}
      </g>
    </g>
  );
}

export function PortraitSvg(props: { heroId: string; size?: number }): JSX.Element | null {
  const def = heroDef(props.heroId);
  if (!def) return null;
  const look = def.look;
  const skin = SKIN[Math.max(0, Math.min(SKIN.length - 1, look.skin))];
  const [bgIn, bgOut] = BG[def.type];
  const gid = `pbg-${def.id}`;
  const size = props.size ?? 64;
  const ear = darken(skin, 0.1);
  return (
    <svg width={size} height={size} viewBox="7 6 86 86" class="hp-svg">
      <defs>
        <radialGradient id={gid} cx="50%" cy="38%" r="75%">
          <stop offset="0%" stop-color={bgIn} />
          <stop offset="100%" stop-color={bgOut} />
        </radialGradient>
        <linearGradient id={gid + 's'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.18" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill={`url(#${gid})`} />
      {def.rarity === 'UR' && (
        <g fill="#fff6c8" opacity="0.16">
          <path d="M50 40 L20 -5 L36 -5 Z" />
          <path d="M50 40 L64 -5 L80 -5 Z" />
          <path d="M50 40 L105 10 L105 26 Z" />
          <path d="M50 40 L-5 10 L-5 26 Z" />
        </g>
      )}
      <HairBack look={look} />
      <Body type={def.type} rarity={def.rarity} skin={skin} />
      <ellipse cx="34.5" cy="47.5" rx="3" ry="4.4" fill={ear} />
      <ellipse cx="65.5" cy="47.5" rx="3" ry="4.4" fill={ear} />
      <Face look={look} skin={skin} />
      <ellipse cx="50" cy="56" rx="12" ry="8" fill={`url(#${gid}s)`} />
      <Beard look={look} />
      <Eyes look={look} />
      <Brows look={look} />
      <path d="M50 47.5 Q48.2 52.2 49 53.4 Q50.2 54 51.6 53.2" stroke={darken(skin, 0.3)} stroke-width="1" fill="none" stroke-linecap="round" />
      <Mouth look={look} />
      <Extras look={look} skin={skin} />
      <HairFront look={look} />
      <Hat look={look} type={def.type} />
    </svg>
  );
}

/**
 * Hero portrait with an optional rarity frame/glow.
 * <HeroPortrait heroId="dace" size={72} frame />
 */
export function HeroPortrait(props: { heroId: string; size?: number; frame?: boolean; dim?: boolean; class?: string }) {
  const def = heroDef(props.heroId);
  const size = props.size ?? 64;
  if (!def) return <div style={{ width: size + 'px', height: size + 'px' }} />;
  if (!props.frame) return <PortraitSvg heroId={props.heroId} size={size} />;
  return (
    <div
      class={`hp-frame rar-${def.rarity} ${props.dim ? 'hp-dim' : ''} ${props.class ?? ''}`}
      style={{ width: size + 'px', height: size + 'px' }}
    >
      <PortraitSvg heroId={props.heroId} size={size - 6} />
      {def.rarity === 'UR' && <div class="hp-shine" />}
    </div>
  );
}

/** Small zombie head icons for enemy previews. */
export function ZombiePortrait(props: { model: string; size?: number }) {
  const size = props.size ?? 48;
  const m = props.model.toLowerCase();
  const kind = m.includes('boss') ? 'boss' : m.includes('brute') ? 'brute' : m.includes('runner') ? 'runner' : m.includes('spit') ? 'spitter' : 'walker';
  const skin = kind === 'brute' ? '#6f8f4f' : kind === 'boss' ? '#5f7a44' : kind === 'spitter' ? '#8aa860' : '#8fb070';
  const bg = kind === 'boss' ? ['#c04040', '#3a0c0c'] : ['#6a7a58', '#1e2618'];
  const id = `zbg-${kind}`;
  const wide = kind === 'brute' || kind === 'boss';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" class="hp-svg">
      <defs>
        <radialGradient id={id} cx="50%" cy="40%" r="75%">
          <stop offset="0%" stop-color={bg[0]} />
          <stop offset="100%" stop-color={bg[1]} />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id})`} />
      <path d={wide ? 'M4 101 Q6 70 50 68 Q94 70 96 101 Z' : 'M14 101 Q16 76 50 74 Q84 76 86 101 Z'} fill="#5a4a7a" />
      <path d="M30 80 L36 101 M66 78 L60 101" stroke="#3a2a4a" stroke-width="2" />
      <ellipse cx="50" cy="47" rx={wide ? 22 : 17} ry={wide ? 21 : 20} fill={skin} />
      {kind === 'boss' && <path d="M30 30 L36 16 L42 28 L50 12 L58 28 L64 16 L70 30 Z" fill="#8a8a8a" stroke="#4a4a4a" stroke-width="1" />}
      <path d="M38 36 Q44 33 48 38" stroke="#3a4a2a" stroke-width="2" fill="none" />
      <path d="M52 38 Q58 32 63 37" stroke="#3a4a2a" stroke-width="2" fill="none" />
      <circle cx="42" cy="44" r={kind === 'runner' ? 4.5 : 4} fill="#fff8a0" />
      <circle cx="58" cy="44.5" r={kind === 'runner' ? 4.5 : 3.2} fill="#fff8a0" />
      <circle cx="42" cy="44" r="1.6" fill="#c02020" />
      <circle cx="58" cy="44.5" r="1.4" fill="#c02020" />
      <path d="M40 58 L44 55 L47 59 L50 55 L53 59 L56 55 L60 58 Q50 66 40 58 Z" fill="#3a1414" />
      <path d="M44 55.5 L45 58 M50 55.5 L50.5 58 M56 55.5 L55 58" stroke="#e8e0c0" stroke-width="1.2" />
      {kind === 'spitter' && <path d="M52 62 Q54 70 51 74" stroke="#9aff4a" stroke-width="3" fill="none" stroke-linecap="round" />}
      <path d="M60 30 L66 40 M36 52 L33 58" stroke="#5a2a1a" stroke-width="1.5" opacity="0.7" />
      <ellipse cx={wide ? 30 : 34} cy="48" rx="3" ry="5" fill={skin} />
      <ellipse cx={wide ? 70 : 66} cy="48" rx="3" ry="5" fill={skin} />
    </svg>
  );
}
