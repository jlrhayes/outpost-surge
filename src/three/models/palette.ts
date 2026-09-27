// OWNER: art agent. Shared colour palette for all procedural models.
// Bright, saturated, toy-like. Keep hues consistent across models so the game reads as one world.
import type { Rarity } from '../../core/types';

export const C = {
  // neutrals
  white: 0xf6f3ec,
  offWhite: 0xe7e1d3,
  paper: 0xfaf6ea,
  concrete: 0xbdb8ab,
  concreteLight: 0xd3cfc4,
  concreteDark: 0x8f8b80,
  asphalt: 0x4b4f55,
  asphaltLight: 0x62676e,
  steel: 0x8994a0,
  steelLight: 0xb4bec8,
  steelDark: 0x4d5763,
  gunmetal: 0x30353c,
  black: 0x202328,
  rubber: 0x2a2c30,

  // wood & earth
  wood: 0xb57a41,
  woodLight: 0xd4a364,
  woodDark: 0x7e512b,
  log: 0x9a6536,
  straw: 0xe8c86a,
  dirt: 0x9c7a52,
  dirtDark: 0x7a5c3c,
  soil: 0x7d5a3a,
  sand: 0xdcc38a,
  sandDark: 0xc0a46a,
  brick: 0xb8573e,
  stone: 0xa3a098,
  stoneDark: 0x7b7a74,

  // team / military
  blue: 0x3a86ea,
  blueLight: 0x6fb0ff,
  blueDark: 0x2659b0,
  navy: 0x1f3564,
  olive: 0x7d9b3f,
  oliveLight: 0x93b24e,
  oliveDark: 0x5c7a2c,
  armyGreen: 0x5e8c3a,
  khaki: 0xc6a765,
  khakiDark: 0xa68a4f,
  tan: 0xcfae70,

  // accents
  red: 0xe43d30,
  redDark: 0xa9261c,
  orange: 0xff8a1f,
  yellow: 0xffcf23,
  hazard: 0xffc414,
  gold: 0xffc21a,
  goldLight: 0xffe070,
  goldDark: 0xc98a0a,
  purple: 0x9b4dff,
  teal: 0x26b3b8,
  tealDark: 0x1a8a90,
  cyan: 0x5fd8ff,
  glass: 0x77cfee,
  glassDark: 0x2f6d93,
  windowLit: 0xffe08a,
  glowWhite: 0xfffbe8,
  glowYellow: 0xfff2a0,
  glowOrange: 0xffa53a,

  // nature
  grass: 0x78b84a,
  leaf: 0x5cb048,
  leafDark: 0x3f8d38,
  leafLight: 0x86cf5a,
  pine: 0x2f7b4c,
  pineDark: 0x245f3c,
  bark: 0x7a5232,
  crop: 0x8fcf3f,
  wheat: 0xf0c64a,

  // people
  skin: 0xf3c6a0,
  skinDark: 0xc98f62,
  hairBrown: 0x5a3a22,
  hairBlack: 0x2b2522,

  // zombies
  zSkin: 0x8fc155,
  zSkinDark: 0x6a9a3c,
  zSkinGrey: 0x9db48a,
  zSkinBrute: 0x74a148,
  zPurple: 0x7d56b8,
  zPurpleDark: 0x4d3572,
  zBrown: 0x7a5638,
  zRust: 0x8a5537,
  zEye: 0xff3322,
  zMouth: 0x3b1717,
  bone: 0xefe4c6,
  pus: 0xd4ff4a,
} as const;

/** Rarity trim colours (SR blue, SSR purple, UR gold). */
export function rarityColor(r: Rarity): number {
  return r === 'UR' ? 0xffb617 : r === 'SSR' ? 0xa64dff : 0x3d8cff;
}
