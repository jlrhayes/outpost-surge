// OWNER: runner agent. Runner-only low-poly models built with the art kit's `buildColored`: the spitter
// zombie, lane hazards (spike strip, sweeping barbed-wire barricade + rail, warning sign), the
// reinforcement crate and the acid glob. All geometries are cached for the app's lifetime (never dispose).
import * as THREE from 'three';
import { beam, buildColored, bx, P, PALETTE as C, zombieGeometry, type Part } from '../../three/models';

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = make()));
  return g;
}

const ACID = 0xb8f23a;
const ACID_DARK = 0x6f9f1c;
const WARN_RED = 0xd8321e;

/** Spitter: a walker with a swollen, glowing acid sac on its back and a bloated throat. Faces +Z. */
export function spitterGeometry(): THREE.BufferGeometry {
  return cached('spitter', () => {
    const parts: Part[] = [
      // The art kit's walker as the base body (keeps its own vertex colours).
      { geom: zombieGeometry('walker') },
      // Acid sac hunched on the back + veins.
      { geom: P.sphere, color: ACID, pos: [0, 0.8, -0.16], scale: [0.5, 0.46, 0.44], vary: 0.12 },
      { geom: P.sphereLow, color: ACID_DARK, pos: [0.14, 0.94, -0.2], scale: [0.2, 0.2, 0.2] },
      { geom: P.sphereLow, color: C.pus, pos: [-0.16, 0.7, -0.3], scale: [0.16, 0.16, 0.16] },
      { geom: P.octa, color: C.pus, pos: [0.2, 0.72, -0.34], scale: [0.1, 0.1, 0.1] },
      beam([-0.18, 0.98, -0.08], [-0.05, 0.62, -0.34], 0.03, ACID_DARK),
      beam([0.2, 0.9, -0.02], [0.12, 0.6, -0.32], 0.03, ACID_DARK),
      // Bloated throat under the jaw, dripping.
      { geom: P.sphereLow, color: ACID, pos: [0, 0.74, 0.33], scale: [0.2, 0.17, 0.18] },
      { geom: P.cone4, color: ACID, pos: [0.02, 0.6, 0.38], rot: [Math.PI, 0, 0], scale: [0.05, 0.14, 0.05] },
    ];
    const g = buildColored(parts);
    g.scale(1.08, 1.08, 1.08);
    return g;
  });
}

/** Spike strip: a steel plate with rows of spikes and hazard-striped edges. Width = 2*half along X. */
export function spikeStripGeometry(half: number): THREE.BufferGeometry {
  return cached('spikes_' + half.toFixed(2), () => {
    const w = half * 2;
    const parts: Part[] = [bx(C.steelDark, [0, 0.04, 0], [w, 0.08, 1.5])];
    // Hazard stripes along the front and back edges.
    const n = Math.max(4, Math.round(w / 0.45));
    for (let i = 0; i < n; i++) {
      const x = -half + (i + 0.5) * (w / n);
      const col = i % 2 ? C.black : C.hazard;
      parts.push(bx(col, [x, 0.09, 0.66], [w / n, 0.04, 0.18]));
      parts.push(bx(col, [x, 0.09, -0.66], [w / n, 0.04, 0.18]));
    }
    // Spikes.
    const cols = Math.max(4, Math.round(w / 0.42));
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < cols; i++) {
        const x = -half + (i + 0.5 + (row % 2) * 0.35) * (w / (cols + 0.4));
        parts.push({ geom: P.cone4, color: i % 3 === 0 ? C.steelLight : C.steel, pos: [x, 0.26, (row - 1) * 0.36], scale: [0.16, 0.36, 0.16] });
      }
    return buildColored(parts);
  });
}

/** Barbed-wire barricade (knife-rest trestles + wire coils), ~2*half wide. */
export function wireGeometry(half: number): THREE.BufferGeometry {
  return cached('wire_' + half.toFixed(2), () => {
    const wood = 0x7a5a3a;
    const parts: Part[] = [];
    for (const sx of [-1, 1]) {
      const x = sx * (half - 0.15);
      parts.push(beam([x, 0, -0.55], [x, 1.1, 0.35], 0.12, wood));
      parts.push(beam([x, 0, 0.55], [x, 1.1, -0.35], 0.12, wood));
      // Red warning lamp on top.
      parts.push({ geom: P.sphereLow, color: WARN_RED, pos: [x, 1.2, 0], scale: [0.2, 0.2, 0.2] });
    }
    parts.push(beam([-half, 0.62, 0], [half, 0.62, 0], 0.1, wood));
    // Coils of wire along the bar.
    const coils = Math.max(3, Math.round(half * 2.2));
    for (let i = 0; i < coils; i++) {
      const x = -half + 0.3 + (i * (half * 2 - 0.6)) / Math.max(1, coils - 1);
      parts.push({ geom: P.torus, color: C.steelLight, pos: [x, 0.62, 0], rot: [0, Math.PI / 2, 0], scale: [1.1, 1.1, 0.7] });
      parts.push({ geom: P.torus, color: C.steel, pos: [x + 0.18, 0.62, 0], rot: [0.5, Math.PI / 2, 0], scale: [0.95, 0.95, 0.6] });
    }
    // Barbs.
    for (let i = 0; i < coils * 2; i++) {
      const x = -half + 0.25 + (i * (half * 2 - 0.5)) / Math.max(1, coils * 2 - 1);
      parts.push(bx(C.steelDark, [x, 0.62 + ((i % 3) - 1) * 0.28, 0.12 * ((i % 2) * 2 - 1)], [0.04, 0.2, 0.04], [0.6, 0, 0.8]));
    }
    return buildColored(parts);
  });
}

/** Steel rail across the whole road that the barricade slides along, with striped end stops. */
export function railGeometry(): THREE.BufferGeometry {
  return cached('rail', () => {
    const w = 8.6;
    const parts: Part[] = [bx(C.steelDark, [0, 0.05, 0.28], [w, 0.1, 0.12]), bx(C.steelDark, [0, 0.05, -0.28], [w, 0.1, 0.12])];
    for (let i = 0; i < 18; i++) parts.push(bx(0x5a4a3a, [-w / 2 + (i + 0.5) * (w / 18), 0.03, 0], [0.18, 0.06, 0.8]));
    for (const sx of [-1, 1]) {
      parts.push(bx(C.hazard, [sx * (w / 2 + 0.1), 0.35, 0], [0.3, 0.7, 0.9]));
      parts.push(bx(C.black, [sx * (w / 2 + 0.1), 0.35, 0], [0.32, 0.18, 0.92]));
    }
    return buildColored(parts);
  });
}

/** Roadside warning sign (yellow diamond with a "!"). Faces +Z. */
export function warnSignGeometry(): THREE.BufferGeometry {
  return cached('warnSign', () =>
    buildColored([
      bx(C.steelDark, [0, 0.8, 0], [0.1, 1.6, 0.1]),
      bx(C.black, [0, 1.75, 0.02], [0.82, 0.82, 0.05], [0, 0, Math.PI / 4]),
      bx(C.hazard, [0, 1.75, 0.05], [0.7, 0.7, 0.05], [0, 0, Math.PI / 4]),
      bx(C.black, [0, 1.82, 0.09], [0.1, 0.34, 0.03]),
      bx(C.black, [0, 1.56, 0.09], [0.1, 0.1, 0.03]),
    ]),
  );
}

/** Reinforcement crate: a white field crate with teal bands, a big plus sign and a radio antenna. */
export function reinforceCrateGeometry(): THREE.BufferGeometry {
  return cached('reinforceCrate', () => {
    const white = 0xeef1ec;
    const teal = 0x19b39a;
    const parts: Part[] = [
      bx(white, [0, 0.62, 0], [1.4, 1.2, 1.3]),
      bx(teal, [0, 0.22, 0], [1.44, 0.14, 1.34]),
      bx(teal, [0, 1.12, 0], [1.44, 0.14, 1.34]),
      bx(0xb9c0bb, [0, 1.26, 0], [0.5, 0.08, 0.16]),
      // Antenna + beacon.
      bx(C.steelDark, [0.5, 1.6, -0.4], [0.05, 0.8, 0.05]),
      { geom: P.sphereLow, color: 0x6cffd9, pos: [0.5, 2.02, -0.4], scale: [0.16, 0.16, 0.16] },
    ];
    // Plus signs on four faces.
    for (const [x, z, ry] of [
      [0, 0.66, 0],
      [0, -0.66, 0],
      [0.71, 0, Math.PI / 2],
      [-0.71, 0, Math.PI / 2],
    ]) {
      parts.push(bx(teal, [x, 0.66, z], [0.56, 0.16, 0.03], [0, ry, 0]));
      parts.push(bx(teal, [x, 0.66, z], [0.16, 0.56, 0.03], [0, ry, 0]));
    }
    return buildColored(parts);
  });
}

/** Acid glob (unlit, glowing). */
export function acidGlobGeometry(): THREE.BufferGeometry {
  return cached('acidGlob', () =>
    buildColored([
      { geom: P.sphere, color: 0xd6ff5a, pos: [0, 0, 0], scale: [0.62, 0.55, 0.62] },
      { geom: P.sphereLow, color: 0x9be22a, pos: [0.14, -0.12, 0.1], scale: [0.36, 0.3, 0.36] },
      { geom: P.sphereLow, color: 0xf2ffb0, pos: [-0.1, 0.12, 0.08], scale: [0.2, 0.2, 0.2] },
    ]),
  );
}
