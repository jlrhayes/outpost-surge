// OWNER: runner agent. Spitter acid globs: an arcing glowing glob plus a telegraphed landing circle on the
// road (outer ring + a disc that fills up until impact). Pooled, 3 instanced draw calls, no allocations.
import * as THREE from 'three';
import { vcGlowMaterial } from '../../three/models';
import { SIM } from '../../data/runner';
import { acidGlobGeometry } from './models';
import { ringMat } from './mats';

const CAP = 16;
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const flatQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();

let geos: { ring: THREE.BufferGeometry; disc: THREE.BufferGeometry } | null = null;

export class Acid {
  readonly group = new THREE.Group();
  private glob: THREE.InstancedMesh;
  private ring: THREE.InstancedMesh;
  private disc: THREE.InstancedMesh;
  private meshes: THREE.InstancedMesh[];
  n = 0;
  readonly x0 = new Float32Array(CAP);
  readonly d0 = new Float32Array(CAP);
  readonly y0 = new Float32Array(CAP);
  readonly x1 = new Float32Array(CAP);
  readonly d1 = new Float32Array(CAP);
  readonly t = new Float32Array(CAP);
  readonly dur = new Float32Array(CAP);

  constructor() {
    geos ??= { ring: new THREE.RingGeometry(0.84, 1, 36), disc: new THREE.CircleGeometry(1, 28) };
    this.glob = new THREE.InstancedMesh(acidGlobGeometry(), vcGlowMaterial(), CAP);
    this.ring = new THREE.InstancedMesh(geos.ring, ringMat(), CAP);
    this.disc = new THREE.InstancedMesh(geos.disc, ringMat(), CAP);
    this.meshes = [this.glob, this.ring, this.disc];
    for (const m of this.meshes) {
      m.count = 0;
      m.frustumCulled = false;
      m.setColorAt(0, tmpC.setRGB(1, 1, 1));
      this.group.add(m);
    }
    this.ring.renderOrder = 4;
    this.disc.renderOrder = 3;
  }

  launch(x0: number, d0: number, y0: number, x1: number, d1: number, dur = SIM.spitFlight): void {
    if (this.n >= CAP) return;
    const i = this.n++;
    this.x0[i] = x0;
    this.d0[i] = d0;
    this.y0[i] = y0;
    this.x1[i] = x1;
    this.d1[i] = d1;
    this.t[i] = 0;
    this.dur[i] = dur;
  }

  /** Advance globs; `onLand(x, d)` fires on impact. */
  update(dt: number, onLand: (x: number, d: number) => void): void {
    let i = 0;
    while (i < this.n) {
      this.t[i] += dt;
      if (this.t[i] >= this.dur[i]) {
        const x = this.x1[i];
        const d = this.d1[i];
        this.remove(i);
        onLand(x, d);
        continue;
      }
      i++;
    }
  }

  private remove(i: number): void {
    const l = --this.n;
    if (i === l) return;
    this.x0[i] = this.x0[l];
    this.d0[i] = this.d0[l];
    this.y0[i] = this.y0[l];
    this.x1[i] = this.x1[l];
    this.d1[i] = this.d1[l];
    this.t[i] = this.t[l];
    this.dur[i] = this.dur[l];
  }

  render(time: number): void {
    const R = SIM.spitSplash;
    for (let i = 0; i < this.n; i++) {
      const p = this.t[i] / this.dur[i];
      // Glob: lobbed arc, spinning.
      const x = this.x0[i] + (this.x1[i] - this.x0[i]) * p;
      const d = this.d0[i] + (this.d1[i] - this.d0[i]) * p;
      const y = this.y0[i] * (1 - p) + Math.sin(p * Math.PI) * 4.2 + 0.2;
      tmpQ.setFromAxisAngle(tmpV.set(0.4, 1, 0.3).normalize(), time * 7 + i);
      tmpV.set(x, y, -d);
      const s = 0.9 + Math.sin(time * 18 + i) * 0.08;
      tmpS.set(s, s * 1.1, s);
      tmpM.compose(tmpV, tmpQ, tmpS);
      this.glob.setMatrixAt(i, tmpM);
      this.glob.setColorAt(i, tmpC.setRGB(1, 1, 1));
      // Landing circle: pulsing rim + a disc that fills up toward impact.
      const pulse = 0.75 + 0.25 * Math.sin(time * 16 + i * 2);
      tmpV.set(this.x1[i], 0.07, -this.d1[i]);
      tmpS.set(R, R, R);
      tmpM.compose(tmpV, flatQ, tmpS);
      this.ring.setMatrixAt(i, tmpM);
      this.ring.setColorAt(i, tmpC.setRGB(0.75 * pulse, 1 * pulse, 0.15 * pulse));
      const f = Math.max(0.05, p) * R;
      tmpV.y = 0.06;
      tmpS.set(f, f, f);
      tmpM.compose(tmpV, flatQ, tmpS);
      this.disc.setMatrixAt(i, tmpM);
      this.disc.setColorAt(i, tmpC.setRGB(0.35 + 0.25 * p, 0.55 + 0.3 * p, 0.05));
    }
    for (const m of this.meshes) {
      m.count = this.n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  clear(): void {
    this.n = 0;
    this.render(0);
  }

  dispose(): void {
    for (const m of this.meshes) m.dispose();
  }
}
