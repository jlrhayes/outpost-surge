// OWNER: runner agent. Pooled tracer bullets (one InstancedMesh). Each visual bullet carries the pooled
// damage of many soldiers' shots, so a 400-soldier squad costs the same as a 20-soldier one.
import * as THREE from 'three';
import { SIM } from '../../data/runner';

const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
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
  private geo: THREE.BufferGeometry;
  private mat: THREE.MeshBasicMaterial;

  constructor() {
    this.geo = new THREE.BoxGeometry(0.13, 0.13, 1.2);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xfff3a0, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, this.cap);
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
      // Stretch young tracers less so they don't poke out behind the muzzle.
      const len = Math.min(1, (this.d[i] - this.start[i]) / 0.9 + 0.3);
      tmpS.set(1, 1, len);
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
    this.geo.dispose();
    this.mat.dispose();
  }
}
