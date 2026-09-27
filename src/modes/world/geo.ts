// OWNER: world agent. World-map-only low-poly geometries (cached, vertex coloured, facing +Z).
// Shared characters/vehicles/buildings come from src/three/models; these are map dressing.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildColored, P, survivorGeometry, rockGeom, ruinedBlockModel } from '../../three/models';
import type { Part } from '../../three/models/builder';

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = make()));
  return g;
}

/** Merge already-built vertex-coloured geometries with per-part transforms. */
function mergeWith(items: { geom: THREE.BufferGeometry; pos?: [number, number, number]; rotY?: number; scale?: number }[]): THREE.BufferGeometry {
  const list: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (const it of items) {
    const g = it.geom.clone();
    q.setFromAxisAngle(up, it.rotY ?? 0);
    const sc = it.scale ?? 1;
    m.compose(new THREE.Vector3(...(it.pos ?? [0, 0, 0])), q, new THREE.Vector3(sc, sc, sc));
    g.applyMatrix4(m);
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name);
    list.push(g);
  }
  const out = mergeGeometries(list, false)!;
  out.computeBoundingSphere();
  return out;
}

// ------------------------------------------------------------------ radar pickups
export function campGeometry(): THREE.BufferGeometry {
  return cached('survivorCamp', () => {
    const base = buildColored([
      { geom: P.box, color: 0x8a7a5a, pos: [0, 0.04, 0], scale: [3.0, 0.08, 2.6] },
      { geom: P.cone, color: 0xc9a46a, pos: [-0.7, 0.7, -0.4], rot: [0, Math.PI / 8, 0], scale: [1.7, 1.4, 1.7] },
      { geom: P.box, color: 0x6b4a2a, pos: [0.7, 0.12, 0.5], rot: [0, 0.5, 0], scale: [0.8, 0.14, 0.14] },
      { geom: P.box, color: 0x6b4a2a, pos: [0.7, 0.12, 0.5], rot: [0, -0.6, 0], scale: [0.8, 0.14, 0.14] },
      { geom: P.cone, color: 0xff8a2a, pos: [0.7, 0.4, 0.5], scale: [0.35, 0.55, 0.35] },
      { geom: P.cone, color: 0xffd060, pos: [0.7, 0.35, 0.5], scale: [0.2, 0.35, 0.2] },
      { geom: P.cyl, color: 0x444444, pos: [1.2, 1.1, -0.8], scale: [0.07, 2.2, 0.07] },
      { geom: P.box, color: 0xe84a3a, pos: [1.5, 1.95, -0.8], scale: [0.6, 0.4, 0.05] },
      { geom: P.box, color: 0x6a5a3a, pos: [-1.2, 0.2, 0.8], scale: [0.5, 0.4, 0.5] },
    ]);
    return mergeWith([
      { geom: base },
      { geom: survivorGeometry(), pos: [0.2, 0.08, 1.0], rotY: Math.PI },
      { geom: survivorGeometry(), pos: [1.1, 0.08, 1.0], rotY: -2.4 },
      { geom: survivorGeometry(), pos: [0.25, 0.08, -0.1], rotY: 0.4 },
    ]);
  });
}

export function cacheGeometry(): THREE.BufferGeometry {
  return cached('supplyDrop', () =>
    buildColored([
      { geom: P.box, color: 0x4f6a3e, pos: [0, 0.45, 0], scale: [1.2, 0.9, 1.2] },
      { geom: P.box, color: 0xd8c890, pos: [0, 0.45, 0], scale: [1.24, 0.14, 1.24] },
      { geom: P.box, color: 0xd8c890, pos: [0, 0.45, 0], scale: [0.14, 0.94, 1.24] },
      { geom: P.box, color: 0x4a6a3a, pos: [0.9, 0.3, 0.5], rot: [0, 0.4, 0], scale: [0.8, 0.6, 0.8] },
      { geom: P.sphere, color: 0xeeeeee, pos: [-1.2, 0.15, -0.6], scale: [1.8, 0.35, 1.4] },
      { geom: P.sphere, color: 0xe07030, pos: [-1.2, 0.2, -0.6], scale: [0.6, 0.38, 1.45] },
      { geom: P.box, color: 0xcccccc, pos: [-0.55, 0.3, -0.3], rot: [0, 0.5, 0.3], scale: [1.2, 0.03, 0.03] },
    ]),
  );
}

export function digGeometry(): THREE.BufferGeometry {
  return cached('digSite', () =>
    buildColored([
      { geom: P.sphereLow, color: 0x7a5a3a, pos: [0.3, 0.1, 0.2], scale: [2.0, 0.6, 1.7] },
      { geom: P.sphereLow, color: 0x6a4a2e, pos: [-0.8, 0.1, -0.5], scale: [1.0, 0.4, 0.9] },
      { geom: P.box, color: 0xd83a2a, pos: [-0.9, 0.05, 0.9], rot: [0, Math.PI / 4, 0], scale: [1.4, 0.08, 0.26] },
      { geom: P.box, color: 0xd83a2a, pos: [-0.9, 0.05, 0.9], rot: [0, -Math.PI / 4, 0], scale: [1.4, 0.08, 0.26] },
      { geom: P.box, color: 0x9a6a30, pos: [0.4, 0.45, 0.1], rot: [0.2, 0.3, 0], scale: [0.8, 0.45, 0.55] },
      { geom: P.box, color: 0xf0c040, pos: [0.4, 0.62, 0.1], rot: [0.2, 0.3, 0], scale: [0.84, 0.08, 0.6] },
      { geom: P.cyl, color: 0x7a5a3a, pos: [1.2, 0.9, -0.6], rot: [0, 0, 0.35], scale: [0.07, 1.6, 0.07] },
      { geom: P.box, color: 0x888888, pos: [0.95, 0.2, -0.6], rot: [0, 0, 0.35], scale: [0.3, 0.4, 0.06] },
    ]),
  );
}

// ------------------------------------------------------------------ ruins & terrain props
export const RUIN_VARIANTS = 5;
export function ruinGeometry(v: number): THREE.BufferGeometry {
  return cached('ruin' + v, () => {
    const conc = 0x8c8780;
    const dark = 0x3b3d44;
    const rub = 0x77736d;
    switch (v % RUIN_VARIANTS) {
      case 0: {
        const parts: Part[] = [{ geom: P.box, color: conc, pos: [0, 2.1, 0], scale: [2.4, 4.2, 2.4] }];
        for (const y of [1.0, 1.9, 2.8, 3.7]) {
          parts.push({ geom: P.box, color: dark, pos: [0, y, -0.55], scale: [2.46, 0.3, 0.45] });
          parts.push({ geom: P.box, color: dark, pos: [0, y, 0.55], scale: [2.46, 0.3, 0.45] });
          parts.push({ geom: P.box, color: dark, pos: [-0.55, y, 0], scale: [0.45, 0.3, 2.46] });
          parts.push({ geom: P.box, color: dark, pos: [0.55, y, 0], scale: [0.45, 0.3, 2.46] });
        }
        parts.push({ geom: P.box, color: conc, pos: [0.45, 4.55, 0.35], rot: [0.1, 0, 0.35], scale: [1.4, 0.9, 1.3] });
        parts.push({ geom: P.box, color: rub, pos: [1.5, 0.25, 0.8], rot: [0.2, 0.5, 0.1], scale: [0.8, 0.5, 0.6] });
        parts.push({ geom: P.box, color: rub, pos: [-1.3, 0.2, -1.2], rot: [0.1, 0.9, 0.2], scale: [0.6, 0.4, 0.7] });
        return buildColored(parts);
      }
      case 1:
        return buildColored([
          { geom: P.box, color: 0x9b8b72, pos: [0, 0.75, 0], scale: [3.2, 1.5, 2.4] },
          { geom: P.box, color: 0x6e6258, pos: [0.55, 1.35, 0.05], rot: [0, 0, -0.3], scale: [2.0, 0.16, 2.3] },
          { geom: P.box, color: dark, pos: [-0.8, 0.55, 1.21], scale: [0.8, 1.1, 0.04] },
          { geom: P.box, color: dark, pos: [0.7, 0.9, 1.21], scale: [0.9, 0.4, 0.04] },
          { geom: P.box, color: 0xb04a30, pos: [-0.8, 1.6, 0], scale: [1.4, 0.2, 2.45] },
          { geom: P.box, color: rub, pos: [1.9, 0.2, -0.6], rot: [0.2, 0.4, 0.1], scale: [0.7, 0.4, 0.8] },
        ]);
      case 2:
        return buildColored([
          { geom: P.box, color: 0x7f7a74, pos: [0, 1.3, -0.9], scale: [3.0, 2.6, 1.1] },
          { geom: P.box, color: 0x7a746c, pos: [-0.95, 1.0, 0.55], scale: [1.1, 2.0, 2.0] },
          { geom: P.box, color: dark, pos: [0.3, 0.9, -0.34], scale: [2.2, 0.3, 0.04] },
          { geom: P.box, color: dark, pos: [0.3, 1.8, -0.34], scale: [2.2, 0.3, 0.04] },
          { geom: P.box, color: dark, pos: [-0.39, 1.2, 0.6], scale: [0.04, 0.3, 1.6] },
          { geom: P.box, color: 0x7f7a74, pos: [1.0, 2.75, -0.9], rot: [0, 0, 0.5], scale: [0.9, 0.5, 1.0] },
          { geom: P.box, color: rub, pos: [0.8, 0.2, 0.7], rot: [0.1, 0.3, 0.2], scale: [1.0, 0.4, 0.8] },
        ]);
      case 3: {
        const parts: Part[] = [];
        const pts: [number, number, number, number][] = [
          [-0.8, 0.3, 0.2, 1.3],
          [0.5, 0.25, -0.4, 1.1],
          [0.2, 0.55, 0.3, 0.8],
          [-0.3, 0.2, -1.0, 0.9],
          [1.1, 0.2, 0.8, 0.7],
          [-1.2, 0.15, 1.1, 0.6],
        ];
        pts.forEach(([x, y, z, sc], i) =>
          parts.push({ geom: P.box, color: i % 2 ? 0x8a8078 : 0x6f6a64, pos: [x, y, z], rot: [i * 0.4, i * 0.9, i * 0.3], scale: [sc, sc * 0.6, sc * 0.8] }),
        );
        parts.push({ geom: P.cyl, color: 0x5a3a2a, pos: [0.1, 0.9, 0.0], rot: [0.5, 0, 0.3], scale: [0.06, 1.4, 0.06] });
        parts.push({ geom: P.cyl, color: 0x5a3a2a, pos: [0.4, 0.8, 0.2], rot: [-0.4, 0, -0.2], scale: [0.06, 1.2, 0.06] });
        return buildColored(parts);
      }
      default:
        return buildColored([
          { geom: P.box, color: 0x6a5a4e, pos: [0, 0.8, 0], scale: [2.2, 1.6, 2.0] },
          { geom: P.cone, color: 0x3a3230, pos: [0.15, 2.0, 0], rot: [0, Math.PI / 8, 0.2], scale: [2.9, 1.1, 2.7] },
          { geom: P.box, color: 0x2a2624, pos: [0.3, 0.6, 1.01], scale: [0.6, 1.0, 0.04] },
          { geom: P.box, color: 0x4a4038, pos: [-1.3, 0.3, -0.7], rot: [0.3, 0.2, 0.4], scale: [0.8, 0.3, 0.5] },
        ]);
    }
  });
}

export function deadTreeGeometry(): THREE.BufferGeometry {
  return cached('deadTree', () =>
    buildColored([
      { geom: P.cyl, color: 0x5a4632, pos: [0, 0.9, 0], scale: [0.2, 1.8, 0.2] },
      { geom: P.cyl, color: 0x5a4632, pos: [0.3, 1.5, 0], rot: [0, 0, -0.8], scale: [0.1, 0.9, 0.1] },
      { geom: P.cyl, color: 0x5a4632, pos: [-0.25, 1.3, 0.1], rot: [0.3, 0, 0.9], scale: [0.09, 0.7, 0.09] },
    ]),
  );
}

// ------------------------------------------------------------------ outpost walls
/**
 * Circular wall ring with towers, leaving gaps at the given angles (radians, atan2(z, x)).
 * Cached per key since gaps depend on the road layout.
 */
export function wallRingGeometry(key: string, radius: number, gapAngles: number[], gapHalf = 0.22, height = 1.3): THREE.BufferGeometry {
  return cached('wall_' + key, () => {
    const parts: Part[] = [];
    const segs = Math.max(12, Math.round(radius * 2.4));
    const inGap = (a: number) =>
      gapAngles.some((g) => {
        let d = Math.abs(a - g) % (Math.PI * 2);
        if (d > Math.PI) d = Math.PI * 2 - d;
        return d < gapHalf;
      });
    const segLen = ((Math.PI * 2 * radius) / segs) * 1.04;
    for (let i = 0; i < segs; i++) {
      const a = ((i + 0.5) / segs) * Math.PI * 2;
      if (inGap(a)) continue;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      const yaw = -a + Math.PI / 2;
      parts.push({ geom: P.box, color: 0x9a968c, pos: [x, height / 2, z], rot: [0, yaw, 0], scale: [segLen, height, 0.55] });
      parts.push({ geom: P.box, color: 0x77736a, pos: [x, height + 0.08, z], rot: [0, yaw, 0], scale: [segLen, 0.16, 0.7] });
      const next = ((i + 1.5) / segs) * Math.PI * 2;
      const prev = ((i - 0.5) / segs) * Math.PI * 2;
      if (inGap(next) || inGap(prev) || i % 4 === 0) {
        parts.push({ geom: P.cyl, color: 0x8a867c, pos: [x, height * 0.8, z], scale: [1.0, height * 1.6, 1.0] });
        parts.push({ geom: P.cyl, color: 0x5d5a52, pos: [x, height * 1.65, z], scale: [1.15, 0.2, 1.15] });
      }
    }
    return buildColored(parts);
  });
}

// ------------------------------------------------------------------ art-library wrappers
export const ROCK_VARIANTS = 4;
const ROCK_COLORS = [0x8a8174, 0x7b7468, 0x978e7e, 0x6f6a60];
/** Irregular boulder (art library hull), vertex coloured, cached per variant. */
export function rockVariant(i: number): THREE.BufferGeometry {
  const v = ((i % ROCK_VARIANTS) + ROCK_VARIANTS) % ROCK_VARIANTS;
  return cached('rockv' + v, () => buildColored([{ geom: rockGeom(100 + v * 7), color: ROCK_COLORS[v], scale: [1.2, 1, 1.1] }]));
}

/** Static body geometry + rotation of a ruined 12x12 city block (its fog child is discarded). */
export function ruinedBlockBody(seed: number): { geom: THREE.BufferGeometry; rotY: number } | null {
  const g = ruinedBlockModel(seed);
  let out: { geom: THREE.BufferGeometry; rotY: number } | null = null;
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.name === 'body' && !out) out = { geom: m.geometry, rotY: m.rotation.y };
    else if (m.name === 'fog') (m.material as THREE.Material).dispose();
  });
  return out;
}
// ------------------------------------------------------------------ map-scale vegetation
// The art library's trees are detailed (~800 verts); forests on the world map use thousands of them,
// so these lighter versions (~150 verts) share its palette and silhouette for mass scatter.
const P_CONE6 = new THREE.ConeGeometry(0.5, 1, 6);
const P_CONE7 = new THREE.ConeGeometry(0.5, 1, 7);

export function mapPineGeometry(v = 0): THREE.BufferGeometry {
  const dark = v % 2 ? 0x2f6b44 : 0x2a6040;
  const mid = v % 2 ? 0x3c7f4e : 0x367548;
  return cached('mapPine' + (v % 2), () =>
    buildColored([
      { geom: P_CONE6, color: 0x6b4a2e, pos: [0, 0.45, 0], scale: [0.32, 0.9, 0.32] },
      { geom: P_CONE7, color: dark, pos: [0, 1.25, 0], scale: [1.6, 1.4, 1.6] },
      { geom: P_CONE7, color: mid, pos: [0, 2.05, 0], rot: [0, 0.4, 0], scale: [1.15, 1.2, 1.15] },
    ]),
  );
}

export function mapTreeGeometry(v = 0): THREE.BufferGeometry {
  const a = v % 2 ? 0x5ea447 : 0x6db34e;
  const b = v % 2 ? 0x4e9440 : 0x5fa646;
  return cached('mapTree' + (v % 2), () =>
    buildColored([
      { geom: P_CONE6, color: 0x7a5534, pos: [0, 0.6, 0], scale: [0.34, 1.2, 0.34] },
      { geom: P.sphereLow, color: a, pos: [0, 1.75, 0], scale: [1.7, 1.45, 1.7] },
      { geom: P.sphereLow, color: b, pos: [0.35, 1.45, 0.25], rot: [0.5, 0.3, 0], scale: [1.1, 0.95, 1.1] },
    ]),
  );
}

export function mapShrubGeometry(): THREE.BufferGeometry {
  return cached('mapShrub', () =>
    buildColored([
      { geom: P.sphereLow, color: 0x5f963e, pos: [0, 0.3, 0], scale: [0.95, 0.65, 0.95] },
      { geom: P.sphereLow, color: 0x72a848, pos: [0.35, 0.24, 0.2], scale: [0.6, 0.48, 0.6] },
    ]),
  );
}