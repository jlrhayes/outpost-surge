// OWNER: base agent. Small geometry helpers for the base scene (merged vertex-coloured parts).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { P, buildColored, type Part } from '../../three/models/builder';

/** Accumulates vertex-coloured primitive parts; call build() for one merged geometry. */
export class PartList {
  parts: Part[] = [];

  box(color: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0): this {
    this.parts.push({ geom: P.box, color, pos: [x, y, z], scale: [sx, sy, sz], rot: [rx, ry, rz] });
    return this;
  }

  /** Box resting on the ground (y = bottom). */
  slab(color: number, x: number, bottom: number, z: number, sx: number, sy: number, sz: number, ry = 0): this {
    return this.box(color, x, bottom + sy / 2, z, sx, sy, sz, ry);
  }

  cyl(color: number, x: number, y: number, z: number, r: number, h: number, rx = 0, rz = 0, hi = false): this {
    this.parts.push({ geom: hi ? P.cyl16 : P.cyl, color, pos: [x, y, z], scale: [r * 2, h, r * 2], rot: [rx, 0, rz] });
    return this;
  }

  cone(color: number, x: number, y: number, z: number, r: number, h: number, ry = 0): this {
    this.parts.push({ geom: P.cone, color, pos: [x, y, z], scale: [r * 2, h, r * 2], rot: [0, ry, 0] });
    return this;
  }

  blob(color: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, low = true): this {
    this.parts.push({ geom: low ? P.sphereLow : P.sphere, color, pos: [x, y, z], scale: [sx, sy, sz], rot: [0, ry, 0] });
    return this;
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }
}

export function buildParts(list: PartList): THREE.BufferGeometry {
  return buildColored(list.parts);
}

const tmpColor = new THREE.Color();

/**
 * Normalises any geometry to non-indexed position/normal/color (so it can merge with buildColored output).
 * `fallbackColor` fills the colour when the source has none.
 */
export function normalizeGeometry(src: THREE.BufferGeometry, matrix: THREE.Matrix4 | null, fallbackColor: THREE.Color): THREE.BufferGeometry {
  let g = src.index ? src.toNonIndexed() : src.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const col = g.getAttribute('color');
  if (!col || col.itemSize !== 3) {
    if (col) g.deleteAttribute('color');
    const n = g.getAttribute('position').count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = fallbackColor.r;
      arr[i * 3 + 1] = fallbackColor.g;
      arr[i * 3 + 2] = fallbackColor.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  if (matrix) g.applyMatrix4(matrix);
  g.morphAttributes = {};
  return g;
}

/** Merges every mesh of a group into one vertex-coloured geometry (world transform relative to the group). */
export function groupToGeometry(group: THREE.Object3D): THREE.BufferGeometry | null {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const list: THREE.BufferGeometry[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    const c = (mat as THREE.MeshLambertMaterial | undefined)?.color;
    tmpColor.set(c ? c : 0x888888);
    const mtx = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    list.push(normalizeGeometry(m.geometry, mtx, tmpColor));
  });
  if (!list.length) return null;
  const merged = mergeGeometries(list, false);
  for (const g of list) g.dispose();
  return merged ?? null;
}

/** Merges already-normalised geometries (dispose inputs yourself if they were temporary). */
export function mergeAll(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (!list.length) return null;
  const m = mergeGeometries(list, false);
  if (m) {
    m.computeBoundingSphere();
    m.computeBoundingBox();
  }
  return m ?? null;
}

/** Multiplies the colour attribute of a geometry in place (darken/tint). */
export function tintGeometry(g: THREE.BufferGeometry, r: number, gg: number, b: number): void {
  const c = g.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!c) return;
  for (let i = 0; i < c.count; i++) {
    c.setXYZ(i, c.getX(i) * r, c.getY(i) * gg, c.getZ(i) * b);
  }
  c.needsUpdate = true;
}
