// OWNER: heroes agent. Procedural battle arenas: road / wasteland / city. Static props are merged into
// a single vertex-coloured mesh per arena (1-2 draw calls).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildColored, P, propGeometry, vcMesh, type PropKind } from '../../three/models';
import { mulberry32 } from '../../core/rng';

export type ArenaKind = 'road' | 'wasteland' | 'city';

export interface ArenaLook {
  sky: number;
  fogNear: number;
  fogFar: number;
  sun: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
}

export const ARENA_LOOK: Record<ArenaKind, ArenaLook> = {
  road: { sky: 0x9ccbee, fogNear: 38, fogFar: 85, sun: 0xfff1dc, sunIntensity: 2.6, hemiSky: 0xe8f4ff, hemiGround: 0x7a8a5c },
  wasteland: { sky: 0xe6c898, fogNear: 30, fogFar: 75, sun: 0xffe6c0, sunIntensity: 2.6, hemiSky: 0xfff0d8, hemiGround: 0x8a7a50 },
  city: { sky: 0xaab4c2, fogNear: 34, fogFar: 80, sun: 0xf4f0ff, sunIntensity: 2.4, hemiSky: 0xe0e8f4, hemiGround: 0x6a6a64 },
};

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const sc = new THREE.Vector3();

class Builder {
  parts: THREE.BufferGeometry[] = [];
  add(geom: THREE.BufferGeometry, x: number, y: number, z: number, rotY = 0, s: number | [number, number, number] = 1, tilt = 0): void {
    // Normalise to non-indexed position/normal/color so every part can be merged.
    const g = geom.index ? geom.toNonIndexed() : geom.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.color) {
      const n = g.attributes.position.count;
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.8), 3));
    }
    g.morphAttributes = {};
    e.set(tilt, rotY, 0);
    q.setFromEuler(e);
    v.set(x, y, z);
    if (Array.isArray(s)) sc.set(s[0], s[1], s[2]);
    else sc.setScalar(s);
    m4.compose(v, q, sc);
    g.applyMatrix4(m4);
    this.parts.push(g);
  }
  prop(kind: PropKind, x: number, z: number, rotY = 0, s = 1): void {
    this.add(propGeometry(kind), x, 0, z, rotY, s);
  }
  box(color: number, x: number, y: number, z: number, w: number, h: number, d: number, rotY = 0): void {
    this.add(buildColored([{ geom: P.box, color }]), x, y, z, rotY, [w, h, d]);
  }
  build(): THREE.Mesh {
    const merged = mergeGeometries(this.parts, false)!;
    for (const p of this.parts) p.dispose();
    this.parts = [];
    merged.computeBoundingSphere();
    return vcMesh(merged, true);
  }
}

function ground(kind: ArenaKind, rng: () => number): THREE.Mesh {
  const W = 70;
  const D = 110;
  const geo = new THREE.PlaneGeometry(W, D, 35, 55).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 14);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const base = kind === 'road' ? new THREE.Color(0x8e9a5a) : kind === 'wasteland' ? new THREE.Color(0xc4a26a) : new THREE.Color(0x8a8a86);
  const alt = kind === 'road' ? new THREE.Color(0xa8a068) : kind === 'wasteland' ? new THREE.Color(0xa88a58) : new THREE.Color(0x7a7a78);
  const c = new THREE.Color();
  // Height jitter away from the playfield for a low-poly terrain feel.
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const far = Math.max(0, Math.abs(x) - 9) + Math.max(0, z - 26);
    if (far > 0) pos.setY(i, Math.sin(x * 0.7 + z * 0.3) * 0.25 * Math.min(1, far / 6) + (Math.sin(x * 1.7) * Math.cos(z * 1.3)) * 0.15 * Math.min(1, far / 6));
  }
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    let t = 0.5 + 0.5 * Math.sin(cx * 0.35 + Math.cos(cz * 0.25) * 2) * Math.cos(cz * 0.18);
    t = t * 0.7 + rng() * 0.3;
    c.copy(base).lerp(alt, t);
    if (kind === 'city') {
      // Concrete slabs.
      const tile = (Math.floor(cx / 3) + Math.floor(cz / 3)) & 1;
      c.offsetHSL(0, 0, tile ? 0.02 : -0.02);
    }
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = c.r;
      colors[(i + k) * 3 + 1] = c.g;
      colors[(i + k) * 3 + 2] = c.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.deleteAttribute('uv');
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.receiveShadow = true;
  return mesh;
}

function sideX(rng: () => number, min: number, max: number): number {
  return (rng() < 0.5 ? -1 : 1) * (min + rng() * (max - min));
}

function buildRoad(b: Builder, rng: () => number): void {
  // Asphalt strip running between the two formations.
  b.box(0x4a4a50, 0, 0.02, 12, 10, 0.04, 100);
  b.box(0x5a5a5e, -5.3, 0.06, 12, 0.6, 0.12, 100);
  b.box(0x5a5a5e, 5.3, 0.06, 12, 0.6, 0.12, 100);
  for (let z = -30; z < 62; z += 3.2) b.box(0xe8c840, 0, 0.05, z, 0.22, 0.02, 1.5);
  b.box(0xe8e8e8, -4.5, 0.05, 12, 0.14, 0.02, 100);
  b.box(0xe8e8e8, 4.5, 0.05, 12, 0.14, 0.02, 100);
  for (let z = -20; z < 60; z += 11) {
    b.prop('lamp', -6.2, z, 0, 1);
    b.prop('lamp', 6.2, z + 5.5, 0, 1);
  }
  for (let i = 0; i < 26; i++) {
    const x = sideX(rng, 8, 22);
    const z = -12 + rng() * 70;
    b.prop(rng() < 0.6 ? 'tree' : 'pine', x, z, rng() * 6, 0.9 + rng() * 0.7);
  }
  b.prop('car_wreck', -6.8, 10, 0.3, 1);
  b.prop('car_wreck', 7.2, 19, -0.5, 1);
  b.prop('car_wreck', -2.5, 26, 1.2, 1.1);
  b.prop('car_wreck', 8, -2, 0.2, 1);
  for (let i = 0; i < 8; i++) b.prop('cone', sideX(rng, 4.8, 6.5), -6 + rng() * 30, 0, 1);
  // Barricade line far down the road + a burnt-out bus.
  b.box(0x9a9a9a, -3, 0.5, 30, 3, 1, 0.7, 0.1);
  b.box(0x9a9a9a, 3.6, 0.5, 31, 3, 1, 0.7, -0.15);
  b.box(0x8a3a2a, 11, 1.4, 28, 3, 2.8, 9, 0.2);
  b.box(0x3a3a3a, 11, 2.2, 28, 3.1, 0.6, 8, 0.2);
  for (let i = 0; i < 6; i++) b.prop('sandbag', sideX(rng, 6.5, 9), -8 + rng() * 26, rng() * 3, 1);
}

function buildWasteland(b: Builder, rng: () => number): void {
  for (let i = 0; i < 30; i++) {
    const x = sideX(rng, 6.5, 24);
    const z = -12 + rng() * 70;
    const r = rng();
    if (r < 0.4) b.prop('rock', x, z, rng() * 6, 0.8 + rng() * 1.6);
    else if (r < 0.6) {
      // Dead tree
      b.add(buildColored([{ geom: P.cyl, color: 0x6a5a4a }]), x, 1.2, z, 0, [0.25, 2.4, 0.25]);
      b.add(buildColored([{ geom: P.cyl, color: 0x6a5a4a }]), x + 0.35, 2.0, z, rng() * 3, [0.12, 1.2, 0.12], 0.7);
      b.add(buildColored([{ geom: P.cyl, color: 0x6a5a4a }]), x - 0.3, 1.7, z, rng() * 3, [0.1, 1.0, 0.1], -0.8);
    } else if (r < 0.8) b.prop('barrel', x, z, 0, 0.9);
    else b.prop('crate', x, z, rng() * 3, 0.8 + rng() * 0.6);
  }
  // Craters on the playfield edges.
  for (let i = 0; i < 7; i++) {
    const x = sideX(rng, 2, 9);
    const z = -8 + rng() * 34;
    b.add(buildColored([{ geom: P.cyl16, color: 0x7a6040 }]), x, 0.01, z, 0, [2.4, 0.04, 2.4]);
    b.add(buildColored([{ geom: P.cyl16, color: 0x5a4430 }]), x, 0.02, z, 0, [1.6, 0.04, 1.6]);
  }
  // Rusted tanks and fences.
  b.add(buildColored([{ geom: P.cyl16, color: 0xa86a3a }]), -12, 1.6, 22, 0, [3.2, 3.2, 3.2]);
  b.add(buildColored([{ geom: P.cyl16, color: 0x8a5a2a }]), -12, 3.3, 22, 0, [3.3, 0.2, 3.3]);
  for (let i = 0; i < 7; i++) b.prop('fence', 8 + i * 1.9, 16 + i * 0.3, 0.15, 1);
  for (let i = 0; i < 5; i++) b.prop('sandbag', sideX(rng, 5.5, 8), -6 + rng() * 24, rng() * 3, 1);
  b.prop('car_wreck', 6.5, 4, 0.9, 1);
  b.prop('car_wreck', -7.5, 13, -0.4, 1);
}

function buildCity(b: Builder, rng: () => number): void {
  // Road markings.
  for (let z = -30; z < 62; z += 3.2) b.box(0xe8e8e8, 0, 0.03, z, 0.2, 0.02, 1.4);
  b.box(0x6e6e70, -5.6, 0.08, 12, 1.4, 0.16, 100);
  b.box(0x6e6e70, 5.6, 0.08, 12, 1.4, 0.16, 100);
  const palette = [0x9a7060, 0xa8a49a, 0xb8a888, 0x8a8e98, 0x7a6a5a, 0xc0b8a8];
  for (const side of [-1, 1]) {
    let z = -14;
    while (z < 62) {
      const w = 4 + rng() * 3;
      const d = 5 + rng() * 5;
      const h = 4 + rng() * 9;
      const x = side * (9.5 + w / 2 + rng() * 1.5);
      const col = palette[Math.floor(rng() * palette.length)];
      b.box(col, x, h / 2, z + d / 2, w, h, d);
      // Broken top
      b.box(col, x + side * 0.6, h + 0.6, z + d * 0.35, w * 0.55, 1.2, d * 0.45);
      // Windows on the street-facing facade.
      const fx = x - side * (w / 2 + 0.02);
      for (let wy = 1.6; wy < h - 0.8; wy += 1.8) {
        for (let wz = z + 1; wz < z + d - 0.6; wz += 1.6) {
          if (rng() < 0.85) b.box(rng() < 0.25 ? 0x2a2a2a : 0x3a4a5a, fx, wy, wz, 0.08, 0.9, 0.8);
        }
      }
      // Rubble at the foot.
      if (rng() < 0.6) b.prop('rock', x - side * (w / 2 + 0.8), z + d / 2, rng() * 3, 0.9 + rng());
      z += d + 0.8 + rng() * 1.5;
    }
  }
  // Far row of buildings across the end of the street.
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const h = 6 + rng() * 10;
    b.box(palette[(i + 3) % palette.length], i * 7, h / 2, 48 + rng() * 4, 6.5, h, 6);
  }
  for (let z = -16; z < 60; z += 12) {
    b.prop('lamp', -6.5, z, 0, 1);
    b.prop('lamp', 6.5, z + 6, 0, 1);
  }
  b.prop('car_wreck', -4.8, 9, 0.2, 1);
  b.prop('car_wreck', 5, 17, -0.3, 1);
  b.prop('car_wreck', 1.5, 30, 1.4, 1.1);
  for (let i = 0; i < 10; i++) b.prop('cone', sideX(rng, 4.5, 6.8), -8 + rng() * 34, 0, 1);
  // Barricades.
  b.box(0x8a8a8a, -5, 0.5, -1, 2.2, 1, 0.6, 0.3);
  b.box(0x8a8a8a, 5.4, 0.5, 21, 2.4, 1, 0.6, -0.2);
}

const cache = new Map<ArenaKind, THREE.Group>();

/** Returns the (cached) arena group for a flavour. */
export function arenaGroup(kind: ArenaKind): THREE.Group {
  let g = cache.get(kind);
  if (g) return g;
  const rng = mulberry32(kind === 'road' ? 11 : kind === 'wasteland' ? 22 : 33);
  g = new THREE.Group();
  g.add(ground(kind, rng));
  const b = new Builder();
  if (kind === 'road') buildRoad(b, rng);
  else if (kind === 'wasteland') buildWasteland(b, rng);
  else buildCity(b, rng);
  g.add(b.build());
  cache.set(kind, g);
  return g;
}
