// OWNER: runner agent. Pooled tracer bullets (one InstancedMesh). Each visual bullet carries the pooled
// damage of many soldiers' shots, so a 400-soldier squad costs the same as a 20-soldier one.
import * as THREE from 'three';
import { bulletGeometry, vcGlowMaterial } from '../../three/models';
import { SIM } from '../../data/runner';

const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
// The model points along +Z; our bullets fly up the road toward -Z.
const tmpQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const tmpS = new THREE.Vector3(1, 1, 1);

export class Bullets {
  readonly mesh: THREE.InstancedMesh;
  readonly cap = 180;
  n = 0;
  readonly x = new Float32Array(this.cap);
  readonly y = new Float32Array(this.cap);
  readonly d = new Float32Array(this.cap);
  readonly start = new Float32Array(this.cap);
  readonly dmg = new Float32Array(this.cap);

  constructor() {
    // Cached model geometry + shared unlit material: never disposed here.
    this.mesh = new THREE.InstancedMesh(bulletGeometry(), vcGlowMaterial(), this.cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  spawn(x: number, y: number, d: number, dmg: number): void {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.x[i] = x;
    this.y[i] = y;
    this.d[i] = d;
    this.start[i] = d;
    this.dmg[i] = dmg;
  }

  kill(i: number): void {
    const l = --this.n;
    if (i !== l) {
      this.x[i] = this.x[l];
      this.y[i] = this.y[l];
      this.d[i] = this.d[l];
      this.start[i] = this.start[l];
      this.dmg[i] = this.dmg[l];
    }
  }

  get range(): number {
    return SIM.bulletRange;
  }

  render(): void {
    for (let i = 0; i < this.n; i++) {
      tmpV.set(this.x[i], this.y[i], -this.d[i]);
      // Stretch into a streak once it has left the muzzle.
      const len = Math.min(2.4, (this.d[i] - this.start[i]) * 1.4 + 0.6);
      tmpS.set(1.5, 1.5, len);
      tmpM.compose(tmpV, tmpQ, tmpS);
      this.mesh.setMatrixAt(i, tmpM);
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.n = 0;
    this.mesh.count = 0;
  }

  dispose(): void {
    this.mesh.dispose();
  }
}
