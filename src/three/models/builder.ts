// Helpers to build low-poly, vertex-coloured, merged geometries from primitives.
// One shared material for everything keeps draw calls low on phones; merged geometries
// are ideal for InstancedMesh crowds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface Part {
  geom: THREE.BufferGeometry;
  color: THREE.ColorRepresentation;
  /** position, rotation (euler radians), scale */
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();

/** Merge parts into one non-indexed geometry with a `color` attribute (flat-shaded look). */
export function buildColored(parts: Part[]): THREE.BufferGeometry {
  const geoms: THREE.BufferGeometry[] = [];
  for (const p of parts) {
    const g = p.geom.index ? p.geom.toNonIndexed() : p.geom.clone();
    if (g.getAttribute('uv')) g.deleteAttribute('uv');
    tmpE.set(...(p.rot ?? [0, 0, 0]));
    tmpQ.setFromEuler(tmpE);
    tmpV.set(...(p.pos ?? [0, 0, 0]));
    tmpS.set(...(p.scale ?? [1, 1, 1]));
    tmpM.compose(tmpV, tmpQ, tmpS);
    g.applyMatrix4(tmpM);
    const c = new THREE.Color(p.color);
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geoms.push(g);
  }
  const merged = mergeGeometries(geoms, false)!;
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

// Shared primitive geometries (unit sized; scale via Part.scale).
export const P = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl16: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  sphere: new THREE.IcosahedronGeometry(0.5, 1),
  sphereLow: new THREE.IcosahedronGeometry(0.5, 0),
};

let sharedMat: THREE.MeshLambertMaterial | null = null;
/** The shared vertex-colour material (flat shaded). */
export function vcMaterial(): THREE.MeshLambertMaterial {
  if (!sharedMat) sharedMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  return sharedMat;
}

/** Convenience: wrap a vertex-coloured geometry in a mesh with the shared material. */
export function vcMesh(geom: THREE.BufferGeometry, castShadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geom, vcMaterial());
  m.castShadow = castShadow;
  m.receiveShadow = true;
  return m;
}
