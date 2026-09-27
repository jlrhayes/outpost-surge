// OWNER: world agent (also used by the base scene). Memory helpers for large, static, merged scenery:
// compact vertex formats and dropping the CPU copy of geometry once it lives on the GPU.
import * as THREE from 'three';
import { engine } from '../../three/engine';

/**
 * Stores normals as normalized Int8 (3 bytes/vertex instead of 12). Use only for geometry that is
 * rendered as-is (never merged with float-normal geometry or edited afterwards). Returns `g`.
 */
export function int8Normals(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (!n || (n as unknown as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute || n.array instanceof Int8Array) return g;
  const out = new Int8Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i);
    const y = n.getY(i);
    const z = n.getZ(i);
    const l = Math.hypot(x, y, z) || 1;
    out[i * 3] = Math.round((x / l) * 127);
    out[i * 3 + 1] = Math.round((y / l) * 127);
    out[i * 3 + 2] = Math.round((z / l) * 127);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3, true));
  return g;
}

function dropArray(this: THREE.BufferAttribute): void {
  (this as unknown as { array: unknown }).array = null;
}

/**
 * Frees the CPU copy of every attribute right after it is uploaded to the GPU.
 * ONLY for static geometry that is never raycast, merged, measured or edited, and that its owner can
 * rebuild from source (watch contextEpoch(): a restored WebGL context needs the data again).
 * Bounds are computed first because frustum culling needs them.
 */
export function releaseAfterUpload(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!g.boundingSphere) g.computeBoundingSphere();
  if (!g.boundingBox) g.computeBoundingBox();
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k] as THREE.BufferAttribute;
    if (a.isBufferAttribute) a.onUpload(dropArray);
  }
  g.index?.onUpload(dropArray);
  return g;
}

let epoch = 0;
let watching = false;
/** Changes whenever the WebGL context was lost and restored: geometry freed after upload must be rebuilt. */
export function contextEpoch(): number {
  if (!watching && engine.canvas) {
    watching = true;
    engine.canvas.addEventListener('webglcontextrestored', () => epoch++);
  }
  return epoch;
}
