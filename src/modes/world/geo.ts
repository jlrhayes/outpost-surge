// OWNER: world agent. World-map-only low-poly geometries (cached, vertex coloured, facing +Z).
// Shared characters/vehicles/buildings come from src/three/models; these are map dressing.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildColored, P, survivorGeometry, propGeometry, type PropKind } from '../../three/models';
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

// ------------------------------------------------------------------ resource tiles
export function farmGeometry(): THREE.BufferGeometry {
  return cached('farm', () => {
    const parts: Part[] = [{ geom: P.box, color: 0x6e4f33, pos: [0, 0.07, 0], scale: [3.3, 0.14, 3.0] }];
    for (let i = 0; i < 5; i++) {
      parts.push({ geom: P.box, color: i % 2 ? 0xb9c24a : 0x8fbf45, pos: [-0.35, 0.28, -1.15 + i * 0.56], scale: [2.3, 0.32, 0.36] });
      parts.push({ geom: P.box, color: 0xe0c85a, pos: [-0.35, 0.47, -1.15 + i * 0.56], scale: [2.1, 0.08, 0.2] });
    }
    parts.push({ geom: P.cyl, color: 0xdcd6c6, pos: [1.25, 0.85, -0.85], scale: [0.75, 1.7, 0.75] });
    parts.push({ geom: P.cone, color: 0xb2402f, pos: [1.25, 1.95, -0.85], scale: [0.9, 0.55, 0.9] });
    parts.push({ geom: P.box, color: 0x9a3a2a, pos: [1.25, 0.5, 0.75], scale: [0.8, 0.8, 0.9] });
    parts.push({ geom: P.box, color: 0x6a2a20, pos: [1.25, 0.98, 0.75], rot: [0, 0, 0], scale: [0.95, 0.18, 1.0] });
    return buildColored(parts);
  });
}

export function ironGeometry(): THREE.BufferGeometry {
  return cached('ironDeposit', () =>
    buildColored([
      { geom: P.box, color: 0x6a6258, pos: [0, 0.05, 0], scale: [3.2, 0.1, 3.0] },
      { geom: P.sphereLow, color: 0x6d747c, pos: [-0.45, 0.5, 0.15], scale: [1.8, 1.3, 1.6] },
      { geom: P.sphereLow, color: 0x7f878f, pos: [0.85, 0.4, -0.55], scale: [1.3, 1.0, 1.2] },
      { geom: P.sphereLow, color: 0x5d646c, pos: [0.55, 0.3, 0.95], scale: [1.0, 0.8, 1.0] },
      { geom: P.box, color: 0x2f3542, pos: [-0.2, 0.95, 0.5], rot: [0.4, 0.3, 0.2], scale: [0.42, 0.34, 0.4] },
      { geom: P.box, color: 0x2f3542, pos: [0.9, 0.85, -0.3], rot: [0.2, 0.8, 0.3], scale: [0.36, 0.3, 0.36] },
      { geom: P.box, color: 0xa2603c, pos: [-0.9, 0.9, -0.3], rot: [0.5, 0.2, 0.1], scale: [0.34, 0.3, 0.34] },
      { geom: P.box, color: 0x8a5a3a, pos: [-1.1, 0.38, -1.05], scale: [0.85, 0.42, 0.6] },
      { geom: P.box, color: 0x2f3542, pos: [-1.1, 0.64, -1.05], scale: [0.7, 0.14, 0.45] },
      { geom: P.cyl, color: 0x222222, pos: [-1.45, 0.16, -1.05], rot: [0, 0, Math.PI / 2], scale: [0.3, 0.1, 0.3] },
      { geom: P.cyl, color: 0x222222, pos: [-0.75, 0.16, -1.05], rot: [0, 0, Math.PI / 2], scale: [0.3, 0.1, 0.3] },
      { geom: P.box, color: 0x5a4a3a, pos: [1.1, 1.1, 0.9], rot: [0, 0, 0.3], scale: [0.12, 2.2, 0.12] },
      { geom: P.box, color: 0x5a4a3a, pos: [1.55, 1.1, 0.9], rot: [0, 0, -0.3], scale: [0.12, 2.2, 0.12] },
      { geom: P.box, color: 0x4a3a2a, pos: [1.33, 2.1, 0.9], scale: [0.7, 0.12, 0.2] },
    ]),
  );
}

export function goldGeometry(): THREE.BufferGeometry {
  return cached('goldVein', () =>
    buildColored([
      { geom: P.box, color: 0x7a6a50, pos: [0, 0.05, 0], scale: [3.1, 0.1, 2.9] },
      { geom: P.sphereLow, color: 0x8a7658, pos: [-0.3, 0.55, 0.1], scale: [1.9, 1.4, 1.6] },
      { geom: P.sphereLow, color: 0x9d8a6a, pos: [0.95, 0.4, 0.6], scale: [1.2, 1.0, 1.1] },
      { geom: P.sphereLow, color: 0x7a664a, pos: [0.6, 0.35, -0.95], scale: [1.1, 0.8, 1.0] },
      { geom: P.sphereLow, color: 0xffc93a, pos: [-0.5, 1.1, 0.55], scale: [0.45, 0.4, 0.45] },
      { geom: P.sphereLow, color: 0xffd650, pos: [0.3, 0.95, -0.2], scale: [0.4, 0.36, 0.4] },
      { geom: P.sphereLow, color: 0xf0b020, pos: [1.1, 0.8, 0.5], scale: [0.35, 0.3, 0.35] },
      { geom: P.sphereLow, color: 0xffc93a, pos: [-1.1, 0.5, -0.6], scale: [0.4, 0.35, 0.4] },
      { geom: P.box, color: 0xfff2a8, pos: [-0.5, 1.35, 0.55], rot: [0.6, 0.6, 0], scale: [0.14, 0.14, 0.14] },
      { geom: P.box, color: 0x6a4a2a, pos: [-1.2, 0.25, 1.0], scale: [0.7, 0.3, 0.5] },
      { geom: P.sphereLow, color: 0xffc93a, pos: [-1.2, 0.45, 1.0], scale: [0.5, 0.2, 0.35] },
    ]),
  );
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

export function shrubGeometry(): THREE.BufferGeometry {
  return cached('shrub', () =>
    buildColored([
      { geom: P.sphereLow, color: 0x5f8a3a, pos: [0, 0.25, 0], scale: [0.8, 0.55, 0.8] },
      { geom: P.sphereLow, color: 0x6f9a42, pos: [0.3, 0.2, 0.2], scale: [0.5, 0.4, 0.5] },
    ]),
  );
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

export function prop(kind: PropKind): THREE.BufferGeometry {
  return propGeometry(kind);
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

/** Flag pole (the banner is a separate, tinted mesh). */
export function flagGeometry(): THREE.BufferGeometry {
  return cached('flag', () =>
    buildColored([
      { geom: P.cyl, color: 0x3a3a3a, pos: [0, 1.6, 0], scale: [0.1, 3.2, 0.1] },
      { geom: P.sphereLow, color: 0xd8c060, pos: [0, 3.25, 0], scale: [0.2, 0.2, 0.2] },
    ]),
  );
}
