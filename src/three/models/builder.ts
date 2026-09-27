// OWNER: art agent.
// Helpers to build low-poly, vertex-coloured, merged geometries from primitives.
// One shared material for everything keeps draw calls low on phones; merged geometries
// are ideal for InstancedMesh crowds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

export type V3 = [number, number, number];
export type V2 = [number, number];

export interface Part {
  geom: THREE.BufferGeometry;
  /** Flat colour for the whole part. Omit to keep the geometry's own `color` attribute (composing cached models). */
  color?: THREE.ColorRepresentation;
  /** position, rotation (euler XYZ radians), scale */
  pos?: V3;
  rot?: V3;
  scale?: V3;
  /** Extra parent transform applied after pos/rot/scale (set by group()/mirrorX()). */
  matrix?: THREE.Matrix4;
  /** Random per-face brightness variation (e.g. 0.1 = +-10%) for organic, hand-painted surfaces. */
  vary?: number;
  /** Per-face colour from the face centroid in the primitive's local (untransformed) space. */
  faceColor?: (x: number, y: number, z: number, face: number) => THREE.ColorRepresentation | undefined | null;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const baseC = new THREE.Color();

/**
 * Vertex colours are stored as normalized Uint8 (3 bytes/vertex instead of 12). Values are clamped to 0..1.
 * Returns the same geometry. No-op if it has no colour attribute or already uses Uint8.
 */
export function uint8Colors(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const c = g.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!c || (c as unknown as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) return g;
  if (c.array instanceof Uint8Array && c.normalized) return g;
  const n = c.count * c.itemSize;
  const out = new Uint8Array(n);
  const src = c.array as ArrayLike<number>;
  if (!c.normalized) {
    for (let i = 0; i < n; i++) {
      const v = src[i];
      out[i] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
    }
  } else {
    for (let i = 0; i < c.count; i++) {
      for (let k = 0; k < c.itemSize; k++) {
        const v = c.getComponent(i, k);
        out[i * c.itemSize + k] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
      }
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, c.itemSize, true));
  return g;
}

/** Float32 copy of a (possibly normalized-integer) colour attribute, so it can be edited/merged with float colours. */
function floatColors(g: THREE.BufferGeometry): void {
  const c = g.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!c || c.array instanceof Float32Array) return;
  const out = new Float32Array(c.count * c.itemSize);
  for (let i = 0; i < c.count; i++) for (let k = 0; k < c.itemSize; k++) out[i * c.itemSize + k] = c.getComponent(i, k);
  g.setAttribute('color', new THREE.BufferAttribute(out, c.itemSize));
}

/**
 * Merge parts into one non-indexed geometry with a `color` attribute (flat-shaded look).
 * The result's colours are normalized Uint8 (see uint8Colors); read them with getX()/getComponent().
 */
export function buildColored(parts: Part[]): THREE.BufferGeometry {
  const geoms: THREE.BufferGeometry[] = [];
  let seed = 918273;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const p of parts) {
    const g = p.geom.index ? p.geom.toNonIndexed() : p.geom.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && !(name === 'color' && p.color === undefined)) g.deleteAttribute(name);
    }
    // composing cached (Uint8-coloured) models: merge in float, compact once at the end
    floatColors(g);
    g.clearGroups();
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const pos = g.attributes.position as THREE.BufferAttribute;
    const n = pos.count;
    if (p.color !== undefined || !g.getAttribute('color')) {
      const colors = new Float32Array(n * 3);
      baseC.set(p.color ?? 0xff00ff);
      for (let f = 0; f < n / 3; f++) {
        tmpC.copy(baseC);
        if (p.faceColor) {
          const i = f * 3;
          const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
          const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
          const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
          const fc = p.faceColor(cx, cy, cz, f);
          if (fc !== undefined && fc !== null) tmpC.set(fc);
        }
        if (p.vary) {
          const k = 1 + (rnd() * 2 - 1) * p.vary;
          tmpC.r *= k;
          tmpC.g *= k;
          tmpC.b *= k;
        }
        for (let v = 0; v < 3; v++) {
          colors[(f * 3 + v) * 3] = tmpC.r;
          colors[(f * 3 + v) * 3 + 1] = tmpC.g;
          colors[(f * 3 + v) * 3 + 2] = tmpC.b;
        }
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    tmpE.set(...(p.rot ?? [0, 0, 0]));
    tmpQ.setFromEuler(tmpE);
    tmpV.set(...(p.pos ?? [0, 0, 0]));
    tmpS.set(...(p.scale ?? [1, 1, 1]));
    tmpM.compose(tmpV, tmpQ, tmpS);
    if (p.matrix) tmpM.premultiply(p.matrix);
    g.applyMatrix4(tmpM);
    if (tmpM.determinant() < 0) flipWinding(g);
    geoms.push(g);
  }
  const merged = mergeGeometries(geoms, false)!;
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return uint8Colors(merged);
}

function flipWinding(g: THREE.BufferGeometry): void {
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name] as THREE.BufferAttribute;
    const arr = a.array as Float32Array;
    const s = a.itemSize;
    for (let i = 0; i < a.count; i += 3) {
      for (let k = 0; k < s; k++) {
        const t = arr[(i + 1) * s + k];
        arr[(i + 1) * s + k] = arr[(i + 2) * s + k];
        arr[(i + 2) * s + k] = t;
      }
    }
    a.needsUpdate = true;
  }
}

/** Triangle count of a (non-indexed or indexed) geometry. */
export function triCount(g: THREE.BufferGeometry): number {
  return (g.index ? g.index.count : g.attributes.position.count) / 3;
}

// ---------------------------------------------------------------------------------------------
// Primitive geometries (unit sized, centred at the origin unless noted; scale via Part.scale).

function halfCylZ(segs: number): THREE.BufferGeometry {
  // Half cylinder lying along Z, dome up: x in [-.5,.5], y in [0,.5], z in [-.5,.5].
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, segs, 1, false, 0, Math.PI);
  g.rotateZ(Math.PI / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

export const P = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl16: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  sphere: new THREE.IcosahedronGeometry(0.5, 1),
  sphereLow: new THREE.IcosahedronGeometry(0.5, 0),
  // ---- extras
  cyl4: new THREE.CylinderGeometry(0.5, 0.5, 1, 4),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cone4: new THREE.ConeGeometry(0.5, 1, 4),
  cone6: new THREE.ConeGeometry(0.5, 1, 6),
  cone12: new THREE.ConeGeometry(0.5, 1, 12),
  /** Smooth-ish low sphere (8x4, 48 tris) - heads. */
  head: new THREE.SphereGeometry(0.5, 8, 4),
  /** 8x5 sphere (64 tris). */
  ball: new THREE.SphereGeometry(0.5, 8, 5),
  /** 12x8 sphere for hero pieces. */
  ball12: new THREE.SphereGeometry(0.5, 12, 8),
  /** Dome: upper hemisphere, base at y=0, top at y=0.5 (40 tris). */
  hemi: new THREE.SphereGeometry(0.5, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2),
  hemi12: new THREE.SphereGeometry(0.5, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2),
  /** Half cylinder along Z, dome up (quonset huts, hangars, tunnels). y in [0, .5]. */
  halfCyl: halfCylZ(8),
  halfCyl12: halfCylZ(12),
  torus: new THREE.TorusGeometry(0.35, 0.15, 4, 10),
  octa: new THREE.OctahedronGeometry(0.5),
  dodeca: new THREE.DodecahedronGeometry(0.5),
  tetra: new THREE.TetrahedronGeometry(0.5),
  /** Gable roof prism: triangle in XY (base y=-.5, apex y=.5), extruded along Z. */
  roof: extrudeXY(
    [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0, 0.5],
    ],
    1,
  ),
  /** Ramp wedge: vertical back face at z=-.5, slope descends toward +Z. */
  wedge: (() => {
    const g = extrudeXY(
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [-0.5, 0.5],
      ],
      1,
    );
    // shape X -> world Z, extrusion Z -> world X
    g.rotateY(-Math.PI / 2);
    return g;
  })(),
  /** Bevelled unit box. */
  chamfer: null as unknown as THREE.BufferGeometry,
};

/** Polygon in the XY plane extruded along Z (centred, depth along Z). Works for concave shapes. */
export function extrudeXY(pts: V2[], depth = 1): THREE.BufferGeometry {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Horizontal slab: polygon given in plan as [x, z] points, thickness along Y (centred). */
export function slab(pts: V2[], thickness = 1): THREE.BufferGeometry {
  const g = extrudeXY(
    pts.map(([x, z]) => [x, -z] as V2),
    thickness,
  );
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Vertical plate in the YZ plane: polygon given as [z, y] points, thickness along X (centred). */
export function plateYZ(pts: V2[], thickness = 1): THREE.BufferGeometry {
  const g = extrudeXY(
    pts.map(([z, y]) => [-z, y] as V2),
    thickness,
  );
  g.rotateY(Math.PI / 2);
  return g;
}

/** Convex hull of points (great for sloped hulls, tapered torsos, rocks, gems). */
export function hull(pts: V3[]): THREE.BufferGeometry {
  return new ConvexGeometry(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function gc(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}

/** Bevelled box with real dimensions (centred). */
export function rbox(w: number, h: number, d: number, b: number): THREE.BufferGeometry {
  return gc(`rbox${w},${h},${d},${b}`, () => {
    const pts: V3[] = [];
    const hx = w / 2,
      hy = h / 2,
      hz = d / 2;
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          pts.push([sx * (hx - b), sy * hy, sz * (hz - b)]);
          pts.push([sx * hx, sy * (hy - b), sz * (hz - b)]);
          pts.push([sx * (hx - b), sy * (hy - b), sz * hz]);
        }
    return hull(pts);
  });
}

P.chamfer = rbox(1, 1, 1, 0.15);

/** Tapered block from y=0 (bottom w x d) to y=h (top tw x td, offset by tz/tx). */
export function taper(bw: number, bd: number, tw: number, td: number, h: number, tz = 0, tx = 0): THREE.BufferGeometry {
  return gc(`taper${bw},${bd},${tw},${td},${h},${tz},${tx}`, () =>
    hull([
      [-bw / 2, 0, -bd / 2],
      [bw / 2, 0, -bd / 2],
      [-bw / 2, 0, bd / 2],
      [bw / 2, 0, bd / 2],
      [-tw / 2 + tx, h, -td / 2 + tz],
      [tw / 2 + tx, h, -td / 2 + tz],
      [-tw / 2 + tx, h, td / 2 + tz],
      [tw / 2 + tx, h, td / 2 + tz],
    ]),
  );
}

/** Frustum (cylinder with different top/bottom radius), height 1 centred. */
export function frustum(rTop: number, rBottom: number, segs = 8): THREE.BufferGeometry {
  return gc(`fr${rTop},${rBottom},${segs}`, () => new THREE.CylinderGeometry(rTop, rBottom, 1, segs));
}

/** Lathe around Y from [radius, y] profile points. */
export function lathe(profile: V2[], segs = 8): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segs,
  );
}

// ---------------------------------------------------------------------------------------------
// Part helpers

const UP = new THREE.Vector3(0, 1, 0);

/** Box part (most common). */
export function bx(color: THREE.ColorRepresentation, pos: V3, scale: V3, rot?: V3): Part {
  return { geom: P.box, color, pos, scale, rot };
}

/** A prism (box by default) stretched between two points a -> b with cross-section w x d. */
export function beam(
  a: V3,
  b: V3,
  w: number,
  color: THREE.ColorRepresentation,
  d = w,
  geom: THREE.BufferGeometry = P.box,
): Part {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  const mid = va.add(vb).multiplyScalar(0.5);
  return { geom, color, pos: [mid.x, mid.y, mid.z], rot: [e.x, e.y, e.z], scale: [w, len, d] };
}

/** Round rod between two points. */
export function rod(a: V3, b: V3, r: number, color: THREE.ColorRepresentation, geom: THREE.BufferGeometry = P.cyl6): Part {
  return beam(a, b, r * 2, color, r * 2, geom);
}

/** Apply a parent transform (pos/rot/uniform-or-xyz scale) to a list of parts. */
export function group(parts: Part[], pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 | number = 1): Part[] {
  const s = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    s,
  );
  return parts.map((p) => ({ ...p, matrix: p.matrix ? m.clone().multiply(p.matrix) : m }));
}

const FLIP_X = new THREE.Matrix4().makeScale(-1, 1, 1);
/** Mirror parts across the YZ plane (x -> -x). Returns ONLY the mirrored copies. */
export function mirrored(parts: Part[]): Part[] {
  return parts.map((p) => ({ ...p, matrix: p.matrix ? FLIP_X.clone().multiply(p.matrix) : FLIP_X }));
}
/** Parts plus their x-mirrored copies (symmetric assemblies). */
export function sym(...parts: Part[]): Part[] {
  return [...parts, ...mirrored(parts)];
}

/** Alternating stripes by angle around the local Y axis (for cylinders). */
export function stripesAround(n: number, a: THREE.ColorRepresentation, b: THREE.ColorRepresentation) {
  return (x: number, _y: number, z: number) => (Math.floor(((Math.atan2(z, x) / (Math.PI * 2) + 1) * n) % n) % 2 ? a : b);
}

// ---------------------------------------------------------------------------------------------
// Materials

let sharedMat: THREE.MeshLambertMaterial | null = null;
/** The shared vertex-colour material (flat shaded). */
export function vcMaterial(): THREE.MeshLambertMaterial {
  if (!sharedMat) sharedMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  return sharedMat;
}

let glowMat: THREE.MeshBasicMaterial | null = null;
/** Shared UNLIT vertex-colour material: use for tracers, muzzle flashes, glowing eyes/lights (looks emissive). */
export function vcGlowMaterial(): THREE.MeshBasicMaterial {
  if (!glowMat) glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  return glowMat;
}

/** Convenience: wrap a vertex-coloured geometry in a mesh with the shared material. */
export function vcMesh(geom: THREE.BufferGeometry, castShadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geom, vcMaterial());
  m.castShadow = castShadow;
  m.receiveShadow = true;
  return m;
}

/** Mesh with the shared unlit glow material (no shadows). */
export function glowMesh(geom: THREE.BufferGeometry): THREE.Mesh {
  const m = new THREE.Mesh(geom, vcGlowMaterial());
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

let shadowMat: THREE.MeshBasicMaterial | null = null;
const shadowGeo = new THREE.CircleGeometry(0.5, 16).rotateX(-Math.PI / 2);
/** Soft-looking blob shadow disc (radius r) lying on the ground; for flying things / low quality mode. */
export function blobShadow(r = 1): THREE.Mesh {
  if (!shadowMat)
    shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
  const m = new THREE.Mesh(shadowGeo, shadowMat);
  m.scale.set(r * 2, 1, r * 2);
  m.position.y = 0.03;
  m.renderOrder = -1;
  m.name = 'blobShadow';
  return m;
}
